import crypto from 'node:crypto';
import { config } from '../config.js';

// Proteção CSRF por "double submit": o servidor grava um token num cookie
// legível pelo site, e toda requisição que altera dados precisa devolver o
// mesmo token no cabeçalho X-CSRF-Token. Um site de terceiros não consegue
// ler o cookie, então não consegue forjar o cabeçalho.
const COOKIE = 'csrf';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrf(req, res, next) {
  let token = req.cookies?.[COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(COOKIE, token, { httpOnly: false, secure: config.isProd, sameSite: 'strict', path: '/' });
  }
  if (SAFE.has(req.method)) return next();

  const header = req.get('x-csrf-token') || '';
  const a = Buffer.from(header);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Sessão expirada. Recarregue a página e tente de novo.' });
  }
  next();
}
