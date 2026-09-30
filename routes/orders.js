import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { validate, orderSchema } from '../lib/validate.js';
import { newPublicId, computeShipping, orderView, setOrderStatus } from '../lib/orders.js';
import { createCheckout, gatewayReady } from '../lib/payments.js';

const router = Router();
router.use(requireAuth);

const orderLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.' },
});

class StockError extends Error {}

// Cria o pedido. Os preços SEMPRE vêm do banco de dados, nunca do navegador:
// assim ninguém consegue alterar o valor do carrinho.
const createOrderTx = db.transaction((userId, items, shipping) => {
  // agrupa itens repetidos
  const merged = new Map();
  for (const it of items) merged.set(it.productId, (merged.get(it.productId) || 0) + it.qty);

  const getProduct = db.prepare('SELECT id, name, price_cents, stock FROM products WHERE id = ? AND active = 1');
  const reserve = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

  const lines = [];
  let subtotal = 0;
  for (const [productId, qty] of merged) {
    const p = getProduct.get(productId);
    if (!p) throw new StockError('Um dos produtos do carrinho não está mais disponível.');
    if (reserve.run(qty, p.id, qty).changes === 0) {
      throw new StockError(`Estoque insuficiente de "${p.name}". Restam ${p.stock} unidade(s).`);
    }
    lines.push({ product_id: p.id, name: p.name, unit_price_cents: p.price_cents, qty });
    subtotal += p.price_cents * qty;
  }

  const shippingCents = computeShipping(subtotal);
  const publicId = newPublicId();
  const info = db.prepare(`
    INSERT INTO orders (public_id, user_id, subtotal_cents, shipping_cents, total_cents,
      ship_name, ship_cep, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, ship_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    publicId, userId, subtotal, shippingCents, subtotal + shippingCents,
    shipping.name, shipping.cep, shipping.street, shipping.number, shipping.complement,
    shipping.district, shipping.city, shipping.state, shipping.phone,
  );
  const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES (?, ?, ?, ?, ?)');
  for (const l of lines) insItem.run(info.lastInsertRowid, l.product_id, l.name, l.unit_price_cents, l.qty);

  return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid), lines };
});

router.post('/', orderLimiter, validate(orderSchema), async (req, res) => {
  if (!gatewayReady && !config.demoPayments) {
    return res.status(503).json({ error: 'Pagamentos indisponíveis no momento. Tente mais tarde.' });
  }

  let created;
  try {
    created = createOrderTx(req.user.id, req.body.items, req.body.shipping);
  } catch (e) {
    if (e instanceof StockError) return res.status(409).json({ error: e.message });
    throw e;
  }
  const { order, lines } = created;

  if (config.demoPayments && !gatewayReady) {
    return res.status(201).json({ orderId: order.public_id, redirectUrl: `/#/pedido/${order.public_id}`, demo: true });
  }

  try {
    const { preferenceId, redirectUrl } = await createCheckout(order, lines, req.user.email);
    db.prepare('UPDATE orders SET mp_preference_id = ? WHERE id = ?').run(preferenceId, order.id);
    res.status(201).json({ orderId: order.public_id, redirectUrl });
  } catch (e) {
    console.error('Erro ao criar checkout no Mercado Pago:', e?.message);
    setOrderStatus(order, 'cancelled'); // devolve o estoque reservado
    res.status(502).json({ error: 'Não foi possível abrir o pagamento. Seu carrinho foi mantido, tente de novo.' });
  }
});

router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({ orders: orders.map(orderView) });
});

router.get('/:publicId', (req, res) => {
  // Só o dono do pedido (ou um admin) pode ver
  const order = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(String(req.params.publicId));
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  res.json({ order: orderView(order), demo: config.demoPayments && !gatewayReady });
});

// Somente no modo demonstração (bloqueado em produção): simula o resultado do pagamento
if (config.demoPayments) {
  router.post('/:publicId/demo-pay', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE public_id = ? AND user_id = ?').get(String(req.params.publicId), req.user.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const status = req.body?.approve === false ? 'rejected' : 'paid';
    setOrderStatus(order, status, { paymentId: `demo-${Date.now()}` });
    res.json({ order: orderView(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
  });
}

export default router;
