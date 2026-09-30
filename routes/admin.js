import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { validate, productUpdateSchema, orderStatusSchema } from '../lib/validate.js';
import { orderView, setOrderStatus } from '../lib/orders.js';

const router = Router();
router.use(requireAdmin);

router.get('/summary', (_req, res) => {
  const s = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('paid','shipped') THEN total_cents END), 0) AS revenue_cents,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) AS to_ship,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending
    FROM orders`).get();
  const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE active = 1 AND stock <= 3').get().c;
  res.json({ ...s, low_stock: lowStock });
});

router.get('/orders', (_req, res) => {
  const rows = db.prepare(`
    SELECT o.*, u.email AS user_email FROM orders o JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC LIMIT 200`).all();
  res.json({ orders: rows.map((o) => ({ ...orderView(o), user_email: o.user_email })) });
});

router.patch('/orders/:publicId', validate(orderStatusSchema), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(String(req.params.publicId));
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (!setOrderStatus(order, req.body.status)) {
    return res.status(409).json({ error: 'Esse pedido não pode mudar para esse status.' });
  }
  res.json({ order: orderView(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
});

router.get('/products', (_req, res) => {
  res.json({ products: db.prepare('SELECT * FROM products ORDER BY category, name').all() });
});

router.patch('/products/:id', validate(productUpdateSchema), (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const next = {
    price_cents: req.body.price_cents ?? p.price_cents,
    stock: req.body.stock ?? p.stock,
    active: req.body.active === undefined ? p.active : Number(req.body.active),
  };
  db.prepare('UPDATE products SET price_cents = ?, stock = ?, active = ? WHERE id = ?').run(next.price_cents, next.stock, next.active, id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(id) });
});

export default router;
