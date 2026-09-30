import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  icon        TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id        TEXT NOT NULL UNIQUE,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','paid','rejected','cancelled','expired','shipped','refunded')),
  subtotal_cents   INTEGER NOT NULL,
  shipping_cents   INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  ship_name        TEXT NOT NULL,
  ship_cep         TEXT NOT NULL,
  ship_street      TEXT NOT NULL,
  ship_number      TEXT NOT NULL,
  ship_complement  TEXT,
  ship_district    TEXT NOT NULL,
  ship_city        TEXT NOT NULL,
  ship_state       TEXT NOT NULL,
  ship_phone       TEXT NOT NULL,
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  stock_released   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  name             TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty > 0)
);

-- Guarda cada notificação processada para não aplicar a mesma duas vezes
CREATE TABLE IF NOT EXISTS payment_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mp_payment_id TEXT NOT NULL,
  status        TEXT NOT NULL,
  received_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mp_payment_id, status)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);
