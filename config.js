import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name, fallbackForDev) {
  const v = process.env[name];
  if (v) return v;
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
}

const jwtSecret = required('JWT_SECRET', 'dev-secret-troque-isto-em-producao-0123456789');
if (isProd && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 3000),
  baseUrl: required('BASE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  jwtSecret,
  dbPath: process.env.DB_PATH || './data/loja.db',
  // Mercado Pago
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  // Modo demonstração: simula o pagamento sem gateway. Bloqueado em produção.
  demoPayments: !isProd && process.env.PAYMENT_MODE === 'demo',
  // Frete
  shippingCents: Number(process.env.SHIPPING_CENTS || 2500),
  freeShippingFromCents: Number(process.env.FREE_SHIPPING_FROM_CENTS || 30000),
  // Pedidos pendentes expiram e devolvem o estoque
  pendingOrderTtlMinutes: Number(process.env.PENDING_ORDER_TTL_MINUTES || 60),
};

if (isProd) {
  if (!config.mpAccessToken) throw new Error('MP_ACCESS_TOKEN é obrigatório em produção.');
  if (!config.mpWebhookSecret) throw new Error('MP_WEBHOOK_SECRET é obrigatório em produção.');
  if (!config.baseUrl.startsWith('https://')) throw new Error('BASE_URL precisa usar https:// em produção.');
}
