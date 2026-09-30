import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { setSession, clearSession } from '../lib/auth.js';
import { validate, registerSchema, loginSchema } from '../lib/validate.js';

const router = Router();

// No máximo 10 tentativas a cada 15 minutos por IP
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' },
});

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta
// ser igual e não revelar quais e-mails têm conta
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente-123', 12);
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  try {
    const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash);
    const user = { id: info.lastInsertRowid, name, email, role: 'customer' };
    setSession(res, user);
    res.status(201).json({ user });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail. Entre com sua senha.' });
    }
    throw e;
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (user?.locked_until && new Date(user.locked_until + 'Z') > new Date()) {
    return res.status(429).json({ error: `Conta bloqueada temporariamente por excesso de tentativas. Tente em ${LOCK_MINUTES} minutos.` });
  }

  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      const fails = user.failed_logins + 1;
      db.prepare(`UPDATE users SET failed_logins = ?, locked_until = CASE WHEN ? >= ? THEN datetime('now', ?) ELSE NULL END WHERE id = ?`)
        .run(fails >= LOCK_AFTER ? 0 : fails, fails, LOCK_AFTER, `+${LOCK_MINUTES} minutes`, user.id);
    }
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  setSession(res, safeUser);
  res.json({ user: safeUser });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

export default router;
