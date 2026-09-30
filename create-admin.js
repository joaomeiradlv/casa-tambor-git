// Uso: npm run create-admin -- email@exemplo.com "SenhaForte123" "Seu Nome"
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const [email, password, name = 'Administrador'] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Uso: npm run create-admin -- email senha(mín. 10 caracteres) "Nome"');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hash, existing.id);
  console.log(`Usuário ${email} agora é administrador.`);
} else {
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(name, email.toLowerCase(), hash);
  console.log(`Administrador ${email} criado.`);
}
