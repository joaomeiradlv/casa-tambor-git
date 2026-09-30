import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

export function newPublicId() {
  // Identificador imprevisível: ninguém adivinha o número do pedido de outra pessoa
  return crypto.randomBytes(9).toString('base64url');
}

export function computeShipping(subtotalCents) {
  return subtotalCents >= config.freeShippingFromCents ? 0 : config.shippingCents;
}

// Devolve ao estoque os itens de um pedido que não foi pago (uma única vez)
const releaseStockTx = db.transaction((orderId) => {
  const order = db.prepare('SELECT stock_released FROM orders WHERE id = ?').get(orderId);
  if (!order || order.stock_released) return;
  const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId);
  const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const it of items) inc.run(it.qty, it.product_id);
  db.prepare('UPDATE orders SET stock_released = 1 WHERE id = ?').run(orderId);
});

// Transições de status permitidas. Um pedido pago nunca volta a "pendente".
const ALLOWED = {
  pending:  ['paid', 'rejected', 'cancelled', 'expired'],
  rejected: ['paid'],            // o cliente pode tentar pagar de novo no mesmo checkout
  expired:  [],
  cancelled:[],
  paid:     ['shipped', 'refunded'],
  shipped:  ['refunded'],
  refunded: [],
};

export function setOrderStatus(order, status, extra = {}) {
  if (order.status === status) return false;
  if (!ALLOWED[order.status]?.includes(status)) return false;

  // Se um pedido rejeitado for pago depois, o estoque já foi devolvido:
  // precisamos reservá-lo de novo, e só aceitamos se ainda houver estoque.
  if (status === 'paid' && order.stock_released) {
    const ok = db.transaction(() => {
      const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id);
      const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
      for (const it of items) {
        if (dec.run(it.qty, it.product_id, it.qty).changes === 0) throw new Error('sem estoque');
      }
      db.prepare('UPDATE orders SET stock_released = 0 WHERE id = ?').run(order.id);
      return true;
    });
    try { ok(); } catch { console.error(`[pedido ${order.public_id}] pago mas sem estoque: revisar manualmente`); }
  }

  db.prepare(`UPDATE orders SET status = ?, mp_payment_id = COALESCE(?, mp_payment_id), updated_at = datetime('now') WHERE id = ?`)
    .run(status, extra.paymentId ?? null, order.id);

  if (['rejected', 'cancelled', 'expired', 'refunded'].includes(status)) releaseStockTx(order.id);
  return true;
}

// Expira pedidos pendentes antigos e devolve o estoque reservado
export function expireStaleOrders() {
  const stale = db.prepare(`
    SELECT * FROM orders WHERE status = 'pending'
    AND created_at < datetime('now', ?)`).all(`-${config.pendingOrderTtlMinutes} minutes`);
  for (const o of stale) setOrderStatus(o, 'expired');
  return stale.length;
}

export function orderView(order) {
  const items = db.prepare('SELECT product_id, name, unit_price_cents, qty FROM order_items WHERE order_id = ?').all(order.id);
  return {
    id: order.public_id,
    status: order.status,
    subtotal_cents: order.subtotal_cents,
    shipping_cents: order.shipping_cents,
    total_cents: order.total_cents,
    created_at: order.created_at,
    shipping: {
      name: order.ship_name, cep: order.ship_cep, street: order.ship_street, number: order.ship_number,
      complement: order.ship_complement, district: order.ship_district, city: order.ship_city, state: order.ship_state,
      phone: order.ship_phone,
    },
    items,
  };
}
