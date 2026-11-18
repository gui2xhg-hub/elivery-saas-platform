// Aviso automático do Mercado Pago: quando um pagamento (cartão ou PIX) é aprovado, o pedido é baixado.
// Sempre confirma o pagamento consultando o próprio Mercado Pago (não confia no conteúdo do aviso).
import { loadTenantById, loadOrder, markOrderPaid, mpHeaders } from '../../lib/storeServer';

export default async function handler(req, res) {
  const tenantId = req.query.tenant_id;
  const body = req.body || {};
  const type = body.type || body.topic || req.query.type || req.query.topic;
  const paymentId = body?.data?.id || req.query['data.id'] || req.query.id;

  // Responde 200 sempre, para o Mercado Pago não ficar reenviando
  if (!tenantId || !paymentId || (type && type !== 'payment')) return res.status(200).json({ ok: true, ignored: true });

  try {
    const tenant = await loadTenantById(tenantId);
    if (!tenant?.pix_access_token) return res.status(200).json({ ok: true, ignored: true });
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: mpHeaders(tenant.pix_access_token) });
    const payment = await r.json();
    if (payment?.status === 'approved' && payment.external_reference) {
      const order = await loadOrder(tenantId, payment.external_reference);
      if (order) await markOrderPaid(order);
      return res.status(200).json({ ok: true, paid: !!order });
    }
    return res.status(200).json({ ok: true, status: payment?.status });
  } catch (e) {
    console.error('mp-webhook:', e);
    return res.status(200).json({ ok: true, error: true });
  }
}
