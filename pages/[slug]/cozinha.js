import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function CozinhaTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) fetchTenantAndOrders();
  }, [slug]);

  const fetchTenantAndOrders = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant(tData);
      fetchOrders(tData.id);
    }
    setLoading(false);
  };

  const fetchOrders = async (tenantId) => {
    const { data: oData } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (oData) setOrders(oData);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const sendWhatsAppStatus = (order, msgType) => {
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    let msg = '';

    if (msgType === 'producao') {
      msg = `Olá ${order.customer_name}! 👨‍🍳 Seu pedido #${order.id} no *${tenant.name}* já está sendo preparado com todo carinho!`;
    } else if (msgType === 'entrega') {
      msg = `Olá ${order.customer_name}! 🛵 Boa notícia: Seu pedido #${order.id} no *${tenant.name}* saiu para entrega e logo chega aí!`;
    } else if (msgType === 'pronto') {
      msg = `Olá ${order.customer_name}! 🛍️ Seu pedido #${order.id} no *${tenant.name}* está PRONTO para ser retirado no balcão!`;
    }

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-4 text-white text-center font-sans">Carregando Cozinha...</div>;
  if (!tenant) return <div className="p-4 text-white text-center font-sans">Restaurante não encontrado.</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans max-w-4xl mx-auto">
      {/* CSS Exclusivo para Impressão Térmica */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .order-card { border: 1px solid #000 !important; margin-bottom: 15px !important; page-break-inside: avoid; }
        }
      `}</style>

      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👨‍🍳 Painel da Cozinha — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Gestão de Pedidos em Tempo Real</p>
        </div>
        <button onClick={() => fetchOrders(tenant.id)} className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-xl text-xs font-bold transition">
          🔄 Atualizar
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 no-print">Nenhum pedido recebido no momento.</p>
        ) : (
          orders.map(order => (
            <div key={order.id} className="order-card bg-gray-900 border border-gray-800 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-start border-b border-gray-800 pb-2">
                <div>
                  <span className="font-bold text-sm text-orange-400">PEDIDO #{order.id}</span>
                  <h3 className="font-bold text-sm text-white">{order.customer_name}</h3>
                  <p className="text-xs text-gray-400">📱 {order.customer_phone}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                  order.status === 'recebido' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  order.status === 'em_producao' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  order.status === 'concluido' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {order.status || 'recebido'}
                </span>
              </div>

              {/* DETALHES DE ENTREGA/RETIRADA */}
              <div className="text-xs text-gray-300 bg-gray-800/50 p-2.5 rounded-xl border border-gray-800">
                <p><b>Tipo:</b> {order.order_type === 'delivery' ? '🛵 Entrega' : '🛍️ Retirada'}</p>
                {order.order_type === 'delivery' && (
                  <>
                    <p><b>Bairro:</b> {order.neighborhood}</p>
                    <p><b>Endereço:</b> {order.address}</p>
                    {order.reference && <p className="text-gray-400"><b>Ref:</b> {order.reference}</p>}
                  </>
                )}
                <p><b>Pagamento:</b> {order.payment_method}</p>
              </div>

              {/* ITENS DO PEDIDO */}
              <div className="space-y-1.5 border-t border-b border-gray-800 py-2">
                <span className="text-[11px] font-bold text-gray-400 block uppercase">Itens:</span>
                {order.items && Array.isArray(order.items) && order.items.map((it, idx) => (
                  <div key={idx} className="text-xs">
                    <span className="font-bold text-white">{it.quantity}x {it.name}</span>
                    {it.details && <p className="text-[10px] text-orange-300 italic pl-2">{it.details}</p>}
                  </div>
                ))}
              </div>

              {/* TOTAL */}
              <div className="flex justify-between items-center text-xs font-bold">
                <span>TOTAL:</span>
                <span className="text-green-400 text-sm">R$ {Number(order.total || 0).toFixed(2)}</span>
              </div>

              {/* AÇÕES DE STATUS + WHATSAPP + IMPRESSÃO */}
              <div className="space-y-2 pt-1 no-print">
                <div className="flex space-x-1.5 text-[11px]">
                  <button onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} className="flex-1 bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg font-bold">👨‍🍳 Em Produção</button>
                  <button onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} className="flex-1 bg-purple-600 hover:bg-purple-700 py-1.5 rounded-lg font-bold">🛵 Saiu Entrega</button>
                  <button onClick={() => { updateOrderStatus(order.id, 'concluido'); }} className="flex-1 bg-green-600 hover:bg-green-700 py-1.5 rounded-lg font-bold">✅ Concluir</button>
                </div>

                <button onClick={handlePrint} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 py-2 rounded-xl text-xs font-bold text-gray-200">
                  🛈 Imprimir Comprovante
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
