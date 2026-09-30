import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

const COOKIE = 'sid';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function setSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,               // JavaScript da página não consegue ler
    secure: config.isProd,        // só trafega por HTTPS em produção
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Carrega o usuário (se houver sessão válida) em req.user
export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(payload.sub));
    if (user) req.user = user;
  } catch {
    // token inválido ou expirado: segue como visitante
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito à administração.' });
  next();
}
