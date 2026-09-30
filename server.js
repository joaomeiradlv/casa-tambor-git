import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { seedProducts } from './seed.js';
import { loadUser } from './lib/auth.js';
import { csrf } from './lib/csrf.js';
import { expireStaleOrders } from './lib/orders.js';
import { gatewayReady } from './lib/payments.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import webhookRoutes from './routes/webhook.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

seedProducts();

// Atrás de um proxy (Render, Railway, Nginx...) para ler o IP e o HTTPS reais
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Força HTTPS em produção
if (config.isProd) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// Cabeçalhos de segurança + política de conteúdo (bloqueia scripts de terceiros)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
  hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

// Webhook vem do Mercado Pago: não tem cookie/CSRF, é protegido pela assinatura
app.use('/api/webhooks', webhookRoutes);

app.use('/api', csrf, loadUser);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, gateway: gatewayReady, demo: config.demoPayments }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', maxAge: config.isProd ? '1h' : 0 }));

// Erros: registra no servidor, mas nunca mostra detalhes internos ao visitante
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dados inválidos.' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente de novo em instantes.' });
});

setInterval(expireStaleOrders, 5 * 60_000).unref();

app.listen(config.port, () => {
  console.log(`Casa Tambor rodando em ${config.baseUrl} (porta ${config.port})`);
  if (!gatewayReady) {
    console.log(config.demoPayments
      ? 'Modo demonstração: pagamentos simulados (defina MP_ACCESS_TOKEN para usar o Mercado Pago).'
      : 'Atenção: MP_ACCESS_TOKEN não definido, o checkout ficará indisponível.');
  }
});
