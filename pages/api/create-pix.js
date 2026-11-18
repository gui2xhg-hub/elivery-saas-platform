// Gera o PIX (QR Code) do pedido. O token do Mercado Pago e o VALOR vêm do banco, nunca do navegador.
import { loadTenantById, loadOrder, mpHeaders, baseUrlFrom } from '../../lib/storeServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const { tenant_id, orderId, description, payer } = req.body || {};
  if (!tenant_id || !orderId) return res.status(400).json({ error: 'Dados incompletos para gerar o PIX.' });

  try {
    const tenant = await loadTenantById(tenant_id);
    if (!tenant?.pix_enabled || !tenant?.pix_access_token) return res.status(400).json({ error: 'PIX automático não configurado.' });
    const order = await loadOrder(tenant.id, orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const amount = Math.round((Number(order.total) || 0) * 100) / 100;
    if (!(amount > 0)) return res.status(400).json({ error: 'Valor do pedido inválido.' });

    const base = baseUrlFrom(req);
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: mpHeaders(tenant.pix_access_token, { 'X-Idempotency-Key': `order-${orderId}-${Date.now()}` }),
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || `Pedido #${orderId} - ${tenant.name}`,
        payment_method_id: 'pix',
        external_reference: String(orderId),
        ...(base.startsWith('https://') ? { notification_url: `${base}/api/mp-webhook?tenant_id=${encodeURIComponent(tenant.id)}` } : {}),
        payer: { email: payer?.email || 'cliente@delivery.com', first_name: payer?.name || 'Cliente' }
      })
    });
    const data = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(mpResponse.status).json({ error: data.message || 'Erro ao comunicar com Mercado Pago' });
    }
    return res.status(200).json({
      id: data.id,
      status: data.status,
      amount,
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      qr_code: data.point_of_interaction?.transaction_data?.qr_code
    });
  } catch (error) {
    console.error('Erro interno na API de PIX:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao gerar PIX.' });
  }
}
