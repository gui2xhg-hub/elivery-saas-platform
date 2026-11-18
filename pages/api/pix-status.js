// Consulta o pagamento no Mercado Pago (pelo servidor) e dá baixa no pedido quando aprovado.
import { loadTenantById, loadOrder, markOrderPaid, mpHeaders } from '../../lib/storeServer';

export default async function handler(req, res) {
  const { tenant_id, payment_id, order_id } = req.method === 'POST' ? (req.body || {}) : req.query;
  if (!tenant_id || !payment_id || !order_id) return res.status(400).json({ status: 'invalid' });
  try {
    const tenant = await loadTenantById(tenant_id);
    if (!tenant?.pix_access_token) return res.status(400).json({ status: 'not_configured' });
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment_id)}`, { headers: mpHeaders(tenant.pix_access_token) });
    const data = await r.json();
    const status = data?.status || 'unknown';
    // Só dá baixa se o pagamento for mesmo deste pedido
    if (status === 'approved' && String(data.external_reference || "") === String(order_id)) {
      const order = await loadOrder(tenant_id, order_id);
      await markOrderPaid(order);
    }
    return res.status(200).json({ status });
  } catch (e) {
    console.error('pix-status:', e);
    return res.status(200).json({ status: 'error' });
  }
}
