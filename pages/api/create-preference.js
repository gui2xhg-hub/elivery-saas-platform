export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { items, accessToken, orderId, tenantName, customerName, customerPhone, deliveryFee } = req.body;

  if (!items || !accessToken) {
    return res.status(400).json({ error: 'Dados incompletos para processar pagamento.' });
  }

  try {
    // Monta a lista de produtos formatada para o Mercado Pago
    const mpItems = items.map(item => ({
      title: item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice),
      currency_id: 'BRL'
    }));

    // Adiciona a Taxa de Entrega como um item se houver
    if (deliveryFee > 0) {
      mpItems.push({
        title: 'Taxa de Entrega',
        quantity: 1,
        unit_price: Number(deliveryFee),
        currency_id: 'BRL'
      });
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: mpItems,
        payer: {
          name: customerName || 'Cliente Delivery',
          phone: { number: customerPhone || '' }
        },
        external_reference: String(orderId),
        statement_descriptor: tenantName ? tenantName.slice(0, 13) : 'DELIVERY',
        auto_return: 'approved'
      })
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago (Preference):', data);
      return res.status(mpResponse.status).json({ 
        error: data.message || 'Erro ao gerar checkout de cartão' 
      });
    }

    // Retorna o link direto do checkout do Mercado Pago
    return res.status(200).json({
      init_point: data.init_point
    });

  } catch (error) {
    console.error('Erro na API de preferência de cartão:', error);
    return res.status(500).json({ error: 'Erro interno ao processar cartão.' });
  }
}
