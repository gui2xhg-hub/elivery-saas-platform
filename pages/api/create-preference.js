// Link de pagamento com cartão (Mercado Pago). Token e valores vêm do banco, não do navegador.
import { loadTenantById, loadOrder, mpHeaders, baseUrlFrom } from '../../lib/storeServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const { tenant_id, orderId, customerName, customerPhone } = req.body || {};
  if (!tenant_id || !orderId) return res.status(400).json({ error: 'Dados incompletos para processar pagamento.' });

  try {
    const tenant = await loadTenantById(tenant_id);
    if (!tenant?.pix_access_token) return res.status(400).json({ error: 'Pagamento online não configurado.' });
    const order = await loadOrder(tenant.id, orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const amount = Math.round((Number(order.total) || 0) * 100) / 100;
    if (!(amount > 0)) return res.status(400).json({ error: 'Valor do pedido inválido.' });

    const base = baseUrlFrom(req);
    const back = base ? `${base}/${tenant.slug}?pedido=${order.id}` : undefined;
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: mpHeaders(tenant.pix_access_token),
      body: JSON.stringify({
        items: [{ title: `Pedido #${order.id} - ${tenant.name}`.slice(0, 250), quantity: 1, unit_price: amount, currency_id: 'BRL' }],
        payer: { name: customerName || order.customer_name || 'Cliente Delivery', phone: { number: customerPhone || order.customer_phone || '' } },
        external_reference: String(order.id),
        statement_descriptor: tenant.name ? String(tenant.name).slice(0, 13) : 'DELIVERY',
        ...(base.startsWith('https://') ? { notification_url: `${base}/api/mp-webhook?tenant_id=${encodeURIComponent(tenant.id)}` } : {}),
        ...(back ? { back_urls: { success: back, pending: back, failure: back }, auto_return: 'approved' } : {})
      })
    });
    const data = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago (Preference):', data);
      return res.status(mpResponse.status).json({ error: data.message || 'Erro ao gerar checkout de cartão' });
    }
    return res.status(200).json({ init_point: data.init_point });
  } catch (error) {
    console.error('Erro na API de preferência de cartão:', error);
    return res.status(500).json({ error: 'Erro interno ao processar cartão.' });
  }
}
