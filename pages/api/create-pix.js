export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, description, accessToken, orderId, payer } = req.body;

  if (!amount || !accessToken) {
    return res.status(400).json({ error: 'Dados incompletos para gerar o PIX.' });
  }

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': `order-${orderId}-${Date.now()}`
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: description || `Pedido #${orderId}`,
        payment_method_id: 'pix',
        payer: {
          email: payer?.email || 'cliente@delivery.com',
          first_name: payer?.name || 'Cliente'
        }
      })
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(mpResponse.status).json({ 
        error: data.message || 'Erro ao comunicar com Mercado Pago' 
      });
    }

    // Extrai o QR Code em Imagem (Base64) e o código Copia e Cola
    const qr_code_base64 = data.point_of_interaction?.transaction_data?.qr_code_base64;
    const qr_code = data.point_of_interaction?.transaction_data?.qr_code;

    return res.status(200).json({
      id: data.id,
      status: data.status,
      qr_code_base64,
      qr_code
    });

  } catch (error) {
    console.error('Erro interno na API de PIX:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao gerar PIX.' });
  }
}
