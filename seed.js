import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { catalog } from './catalog.js';

// Insere os produtos que ainda não existem (não sobrescreve preço/estoque já editados)
export function seedProducts() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO products (slug, name, description, category, icon, price_cents, stock)
    VALUES (@slug, @name, @description, @category, @icon, @price_cents, @stock)`);
  db.transaction((items) => { for (const p of items) insert.run(p); })(catalog);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedProducts();
  console.log(`Catálogo pronto: ${db.prepare('SELECT COUNT(*) c FROM products').get().c} produtos.`);
}
