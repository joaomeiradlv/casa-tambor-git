import crypto from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { config } from '../config.js';

const client = config.mpAccessToken
  ? new MercadoPagoConfig({ accessToken: config.mpAccessToken, options: { timeout: 8000 } })
  : null;

export const gatewayReady = Boolean(client);

// Cria o checkout do Mercado Pago (Checkout Pro: Pix, cartão, boleto).
// Os dados de cartão são digitados no ambiente do Mercado Pago e nunca
// passam por este servidor.
export async function createCheckout(order, items, buyerEmail) {
  if (!client) throw new Error('Gateway de pagamento não configurado.');

  const mpItems = items.map((it) => ({
    id: String(it.product_id),
    title: it.name,
    quantity: it.qty,
    unit_price: it.unit_price_cents / 100,
    currency_id: 'BRL',
  }));
  if (order.shipping_cents > 0) {
    mpItems.push({ id: 'frete', title: 'Frete', quantity: 1, unit_price: order.shipping_cents / 100, currency_id: 'BRL' });
  }

  const back = `${config.baseUrl}/#/pedido/${order.public_id}`;
  const preference = await new Preference(client).create({
    body: {
      items: mpItems,
      payer: { email: buyerEmail },
      external_reference: order.public_id,
      notification_url: `${config.baseUrl}/api/webhooks/mercadopago`,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      statement_descriptor: 'CASATAMBOR',
      expires: true,
      expiration_date_to: new Date(Date.now() + config.pendingOrderTtlMinutes * 60_000).toISOString(),
    },
    requestOptions: { idempotencyKey: `pref-${order.public_id}` },
  });

  return { preferenceId: preference.id, redirectUrl: preference.init_point };
}

// Busca o pagamento direto na API do Mercado Pago. Nunca confiamos no status
// que chega pela URL ou pelo corpo da notificação.
export async function fetchPayment(paymentId) {
  if (!client) throw new Error('Gateway de pagamento não configurado.');
  return new Payment(client).get({ id: paymentId });
}

// Valida a assinatura x-signature enviada pelo Mercado Pago nas notificações.
// Formato: "ts=1704908010,v1=<hmac>". Manifesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
export function verifyWebhookSignature({ signatureHeader, requestId, dataId }) {
  if (!config.mpWebhookSecret || !signatureHeader || !dataId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.trim().split('=').map((s) => s.trim()))
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  // Rejeita notificações muito antigas (proteção contra reenvio)
  const tsMs = ts.length > 10 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60_000) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : String(dataId);
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac('sha256', config.mpWebhookSecret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
