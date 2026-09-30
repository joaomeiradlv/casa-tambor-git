import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { verifyWebhookSignature, fetchPayment } from '../lib/payments.js';
import { setOrderStatus } from '../lib/orders.js';

const router = Router();

const MAP = {
  approved: 'paid',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

router.post('/mercadopago', async (req, res) => {
  const type = req.query.type || req.body?.type || req.query.topic;
  const dataId = req.query['data.id'] || req.body?.data?.id || req.query.id;

  // 1) Confere que a notificação veio mesmo do Mercado Pago
  const valid = verifyWebhookSignature({
    signatureHeader: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId: dataId ? String(dataId) : '',
  });
  if (!valid) {
    console.warn('Webhook com assinatura inválida recusado.');
    return res.sendStatus(401);
  }

  if (type !== 'payment' || !dataId) return res.sendStatus(200);

  try {
    // 2) Busca o pagamento direto na API do Mercado Pago (fonte da verdade)
    const payment = await fetchPayment(String(dataId));
    const newStatus = MAP[payment.status];
    const order = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(String(payment.external_reference || ''));
    if (!order) return res.sendStatus(200);

    // 3) Confere valor e moeda: impede que um pagamento de outro valor libere o pedido
    const paidCents = Math.round(Number(payment.transaction_amount) * 100);
    if (newStatus === 'paid' && (paidCents !== order.total_cents || payment.currency_id !== 'BRL')) {
      console.error(`[pedido ${order.public_id}] valor divergente: pago ${paidCents}, esperado ${order.total_cents}`);
      return res.sendStatus(200);
    }

    // 4) Idempotência: cada (pagamento, status) é aplicado uma única vez
    if (newStatus) {
      const ins = db.prepare('INSERT OR IGNORE INTO payment_events (mp_payment_id, status) VALUES (?, ?)').run(String(payment.id), payment.status);
      if (ins.changes > 0) setOrderStatus(order, newStatus, { paymentId: String(payment.id) });
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('Erro ao processar webhook:', e?.message);
    res.sendStatus(500); // o Mercado Pago reenvia depois
  }
});

export default router;
