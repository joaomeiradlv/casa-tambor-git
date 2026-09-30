import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const products = db.prepare(`
    SELECT id, slug, name, description, category, icon, price_cents, stock
    FROM products WHERE active = 1 ORDER BY category, name`).all();
  res.json({ products });
});

router.get('/:slug', (req, res) => {
  const p = db.prepare(`
    SELECT id, slug, name, description, category, icon, price_cents, stock
    FROM products WHERE slug = ? AND active = 1`).get(String(req.params.slug));
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json({ product: p });
});

export default router;
