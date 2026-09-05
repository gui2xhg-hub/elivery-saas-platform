import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function CozinhaTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');

  useEffect(() => {
    if (router.isReady && slug) {
      fetchTenantAndOrders();
    }
  }, [router.isReady, slug]);

  const fetchTenantAndOrders = async () => {
    setLoading(true);
    const cleanSlug = String(slug).toLowerCase().trim();
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', cleanSlug).maybeSingle();

    if (tData) {
      setTenant(tData);
      fetchOrders(tData.id);
    }
    setLoading(false);
  };

  const fetchOrders = async (tenantId = tenant?.id) => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
  };

  // AVANÇAR O STATUS DO PEDIDO CONSIDERANDO O TIPO DE ENTREGA
  const handleAdvanceStatus = async (order) => {
    const isRetirada = order.delivery_type === 'retirada' || order.delivery_type === 'balcao' || order.is_delivery === false;

    let nextStatus = '';
    let pushTitle = '';
    let pushMessage = '';

    if (order.status === 'pendente') {
      nextStatus = 'preparando';
      pushTitle = '👨‍🍳 Pedido em Preparo!';
      pushMessage = `Seu pedido #${order.id} já está sendo preparado pela cozinha.`;
    } else if (order.status === 'preparando') {
      if (isRetirada) {
        nextStatus = 'pronto_retirada';
        pushTitle = '🛍️ Pedido Pronto para Retirada!';
        pushMessage = `Seu pedido #${order.id} está PRONTO! Pode vir retirar no balcão.`;
      } else {
        nextStatus = 'saiu_para_entrega';
        pushTitle = '🛵 Saiu para Entrega!';
        pushMessage = `Seu pedido #${order.id} saiu para entrega e logo chegará até você!`;
      }
    } else if (order.status === 'saiu_para_entrega' || order.status === 'pronto_retirada') {
      nextStatus = 'concluido';
      pushTitle = '✅ Pedido Finalizado!';
      pushMessage = `Seu pedido #${order.id} foi concluído. Obrigado pela preferência!`;
    }

    if (!nextStatus) return;

    // 1. Atualiza no Supabase
    const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);

    if (error) {
      return alert("Erro ao atualizar status: " + error.message);
    }

    // 2. Dispara Notificação Push Automática via OneSignal
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushTitle,
          message: pushMessage,
          url: `https://delivery.sinergemkt.com/${tenant.slug}`
        })
      });
    } catch (err) {
      console.error("Erro ao enviar push:", err);
    }

    fetchOrders();
  };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'todos') return o.status !== 'concluido';
    return o.status === filterStatus;
  });

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-xs text-gray-400">Carregando painel da cozinha...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Estabelecimento não encontrado</h1></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto font-sans pb-12">
      <header className="flex justify-between items-center py-3 border-b border-gray-800 mb-4">
        <div>
          <h1 className="font-bold text-lg text-orange-500">🍳 Cozinha & Pedidos</h1>
          <p className="text-xs text-gray-400">{tenant.name}</p>
        </div>
        <button onClick={() => fetchOrders()} className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-300 font-bold">
          🔄 Atualizar
        </button>
      </header>

      {/* FILTROS DE STATUS */}
      <div className="flex space-x-1 bg-gray-900 p-1 rounded-xl border border-gray-800 mb-4 text-[11px] font-bold overflow-x-auto">
        <button onClick={() => setFilterStatus('todos')} className={`flex-1 py-1.5 px-2 rounded-lg whitespace-nowrap ${filterStatus === 'todos' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Ativos ({orders.filter(o => o.status !== 'concluido').length})</button>
        <button onClick={() => setFilterStatus('pendente')} className={`flex-1 py-1.5 px-2 rounded-lg whitespace-nowrap ${filterStatus === 'pendente' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Pendentes</button>
        <button onClick={() => setFilterStatus('preparando')} className={`flex-1 py-1.5 px-2 rounded-lg whitespace-nowrap ${filterStatus === 'preparando' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Em Preparo</button>
        <button onClick={() => setFilterStatus('concluido')} className={`flex-1 py-1.5 px-2 rounded-lg whitespace-nowrap ${filterStatus === 'concluido' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Concluídos</button>
      </div>

      {/* LISTA DE PEDIDOS */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs">Nenhum pedido encontrado neste filtro.</div>
        ) : (
          filteredOrders.map(order => {
            const isRetirada = order.delivery_type === 'retirada' || order.delivery_type === 'balcao' || order.is_delivery === false;
            const items = typeof order.items_json === 'string' ? JSON.parse(order.items_json || '[]') : (order.items_json || []);

            return (
              <div key={order.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 shadow-lg">
                <div className="flex justify-between items-start border-b border-gray-800 pb-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">Pedido #{order.id}</span>
                      
                      {/* BADGE DE TIPO DE ENTREGA */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isRetirada ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                        {isRetirada ? '🛍️ Retirada Balcão' : '🛵 Delivery'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 font-bold mt-0.5">{order.customer_name} • <span className="text-gray-400 font-normal">{order.customer_phone}</span></p>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                    order.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    order.status === 'preparando' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    order.status === 'pronto_retirada' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    order.status === 'saiu_para_entrega' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                    {order.status === 'pronto_retirada' ? 'Pronto Balcão' : order.status}
                  </span>
                </div>

                {/* ITENS DO PEDIDO */}
                <div className="space-y-1 bg-gray-950 p-2.5 rounded-lg border border-gray-800 text-xs">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-300">
                      <span><b>{item.quantity}x</b> {item.name}</span>
                      <span className="text-gray-400">R$ {Number(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {order.observation && (
                    <p className="text-[11px] text-yellow-400 pt-1 italic border-t border-gray-800">Obs: {order.observation}</p>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO DINÂMICOS */}
                <div className="flex justify-between items-center pt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Total ({order.payment_method})</span>
                    <span className="font-bold text-sm text-green-400">R$ {Number(order.total_price || 0).toFixed(2)}</span>
                  </div>

                  {order.status !== 'concluido' && (
                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-md ${
                        order.status === 'pendente' ? 'bg-blue-600 hover:bg-blue-700' :
                        order.status === 'preparando' ? (isRetirada ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-500 hover:bg-orange-600') :
                        'bg-green-600 hover:bg-green-700'
                      }`}>
                      {order.status === 'pendente' && '👨‍🍳 Iniciar Preparo'}
                      {order.status === 'preparando' && (isRetirada ? '🛍️ Pronto para Retirada' : '🛵 Saiu para Entrega')}
                      {(order.status === 'saiu_para_entrega' || order.status === 'pronto_retirada') && '✅ Finalizar Pedido'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
