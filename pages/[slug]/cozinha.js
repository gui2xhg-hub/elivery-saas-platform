import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function CozinhaTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const prevOrdersCountRef = useRef(0);

  useEffect(() => {
    if (slug) {
      fetchTenantAndOrders();
      const interval = setInterval(() => {
        if (tenant?.id) fetchOrders(tenant.id, true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [slug, tenant?.id]);

  const fetchTenantAndOrders = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant(tData);
      fetchOrders(tData.id, false);
    }
    setLoading(false);
  };

  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Erro ao tocar áudio: ", e);
    }
  };

  const fetchOrders = async (tenantId, isInterval = false) => {
    const { data: oData } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (oData) {
      const activeRecebidos = oData.filter(o => o.status === 'recebido' && !o.archived).length;
      if (isInterval && activeRecebidos > prevOrdersCountRef.current) {
        playBeepSound();
      }
      prevOrdersCountRef.current = activeRecebidos;
      setOrders(oData);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const togglePaymentStatus = async (orderId, currentPaidStatus) => {
    await supabase.from('orders').update({ is_paid: !currentPaidStatus }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const archiveOrder = async (orderId) => {
    await supabase.from('orders').update({ archived: true, status: 'arquivado' }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const clearAllArchived = async () => {
    if (confirm("Deseja apagar definitivamente todos os pedidos arquivados da tela? (Os relatórios continuam mantidos)")) {
      await supabase.from('orders').delete().eq('tenant_id', tenant.id).eq('archived', true);
      if (tenant) fetchOrders(tenant.id);
    }
  };

  // MENSAGEM DO WHATSAPP ADAPTADA PARA RETIRADA OU DELIVERY
  const sendWhatsAppStatus = (order, msgType) => {
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    let msg = '';

    const isDelivery = order.order_type === 'delivery';

    if (msgType === 'producao') {
      msg = `Olá ${order.customer_name}! 👨‍🍳 Seu pedido #${order.id} no *${tenant.name}* já está sendo preparado!`;
    } else if (msgType === 'entrega') {
      if (isDelivery) {
        msg = `Olá ${order.customer_name}! 🛵 Seu pedido #${order.id} no *${tenant.name}* saiu para entrega!`;
      } else {
        msg = `Olá ${order.customer_name}! 🛍️ Seu pedido #${order.id} no *${tenant.name}* está PRONTO para retirada no balcão!`;
      }
    }

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrintSingleOrder = (order) => {
    setSelectedOrderToPrint(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (loading) return <div className="p-4 text-white text-center font-sans">Carregando Cozinha...</div>;
  if (!tenant) return <div className="p-4 text-white text-center font-sans">Restaurante não encontrado.</div>;

  // DIVISÃO DOS PEDIDOS EM 3 COLUNAS KANBAN
  const activeOrders = orders.filter(o => !o.archived);
  const recebidosOrders = activeOrders.filter(o => !o.status || o.status === 'recebido');
  const producaoOrders = activeOrders.filter(o => o.status === 'em_producao');
  const entregaOrders = activeOrders.filter(o => o.status === 'saiu_entrega');

  const archivedOrders = orders.filter(o => o.archived === true);

  // COMPONENTE DO CARD DE PEDIDO
  const renderOrderCard = (order) => {
    const isPix = (order.payment_method || '').toUpperCase().includes('PIX');
    const isMoney = (order.payment_method || '').toUpperCase().includes('DINHEIRO');
    const isDelivery = order.order_type === 'delivery';

    return (
      <div key={order.id} className="bg-gray-900 border border-gray-800 p-3.5 rounded-2xl space-y-2.5 shadow-lg">
        <div className="flex justify-between items-start border-b border-gray-800 pb-2">
          <div>
            <span className="font-bold text-xs text-orange-400">PEDIDO #{order.id}</span>
            <h3 className="font-bold text-xs text-white">{order.customer_name}</h3>
            <p className="text-[11px] text-gray-400">📱 {order.customer_phone}</p>
          </div>
        </div>

        <div className="text-[11px] text-gray-300 bg-gray-800/50 p-2 rounded-xl border border-gray-800 space-y-1">
          <p><b>Tipo:</b> {isDelivery ? '🛵 Entrega' : '🛍️ Retirada No Balcão'}</p>
          {isDelivery && (
            <>
              <p><b>Bairro:</b> {order.neighborhood}</p>
              <p><b>End:</b> {order.address}</p>
              {order.reference && <p className="text-gray-400"><b>Ref:</b> {order.reference}</p>}
            </>
          )}

          {/* CONTROLE DE PAGAMENTO PIX/DINHEIRO/CARTÃO */}
          <div className="pt-1 flex justify-between items-center border-t border-gray-700/50">
            {isPix ? (
              <div className="flex items-center justify-between w-full">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  order.is_paid ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {order.is_paid ? '🟢 PIX Confirmado' : '🟡 PIX Pendente'}
                </span>
                <button 
                  onClick={() => togglePaymentStatus(order.id, order.is_paid)}
                  className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-200 font-bold border border-gray-600">
                  {order.is_paid ? 'Desmarcar' : '✅ Validar'}
                </button>
              </div>
            ) : isMoney ? (
              <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                💵 Dinheiro (R$ {Number(order.total).toFixed(2)})
              </span>
            ) : (
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                💳 Cartão na Entrega
              </span>
            )}
          </div>
        </div>

        {/* ITENS */}
        <div className="space-y-1 border-t border-b border-gray-800 py-1.5">
          {order.items && Array.isArray(order.items) && order.items.map((it, idx) => (
            <div key={idx} className="text-[11px]">
              <span className="font-bold text-white">{it.quantity}x {it.name}</span>
              {it.details && <p className="text-[10px] text-orange-300 italic pl-2">{it.details}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center text-xs font-bold">
          <span>TOTAL:</span>
          <span className="text-green-400">R$ {Number(order.total || 0).toFixed(2)}</span>
        </div>

        {/* BOTÕES DE AÇÃO DO KANBAN */}
        <div className="space-y-1.5 pt-1">
          <div className="flex space-x-1 text-[10px] font-bold">
            {(!order.status || order.status === 'recebido') && (
              <button onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} className="flex-1 bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg text-white">
                👨‍🍳 Mover p/ Produção ➔
              </button>
            )}

            {order.status === 'em_producao' && (
              <button 
                onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} 
                className={`flex-1 py-1.5 rounded-lg text-white transition ${isDelivery ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {isDelivery ? '🛵 Mover p/ Entrega ➔' : '🛍️ Pronto p/ Retirada ➔'}
              </button>
            )}

            {order.status === 'saiu_entrega' && (
              <button onClick={() => archiveOrder(order.id)} className="flex-1 bg-green-600 hover:bg-green-700 py-1.5 rounded-lg text-white">
                ✅ Concluir & Arquivar
              </button>
            )}

            <button onClick={() => archiveOrder(order.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1.5 rounded-lg border border-gray-700">
              📦
            </button>
          </div>

          <button onClick={() => handlePrintSingleOrder(order)} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded-lg text-[10px] font-bold text-gray-300">
            🛈 Imprimir
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans max-w-7xl mx-auto pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-receipt-area, #print-receipt-area * { visibility: visible !important; }
          #print-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 5px !important;
            color: #000 !important;
            background: #fff !important;
            font-family: monospace !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* COMPROVANTE TÉRMICO */}
      {selectedOrderToPrint && (
        <div id="print-receipt-area" className="hidden print:block text-black text-xs font-mono">
          <div className="text-center border-b border-black pb-2 mb-2">
            <h2 className="font-bold text-sm uppercase">{tenant.name}</h2>
            <p className="text-[10px]">COMPROVANTE PEDIDO #{selectedOrderToPrint.id}</p>
            <p className="text-[9px]">{new Date(selectedOrderToPrint.created_at || Date.now()).toLocaleString('pt-BR')}</p>
          </div>

          <div className="border-b border-black pb-2 mb-2 space-y-0.5">
            <p><b>CLIENTE:</b> {selectedOrderToPrint.customer_name}</p>
            <p><b>TEL:</b> {selectedOrderToPrint.customer_phone}</p>
            <p><b>TIPO:</b> {selectedOrderToPrint.order_type === 'delivery' ? 'ENTREGA' : 'RETIRADA'}</p>
            {selectedOrderToPrint.order_type === 'delivery' && (
              <>
                <p><b>BAIRRO:</b> {selectedOrderToPrint.neighborhood}</p>
                <p><b>END:</b> {selectedOrderToPrint.address}</p>
                {selectedOrderToPrint.reference && <p><b>REF:</b> {selectedOrderToPrint.reference}</p>}
              </>
            )}
            <p><b>PAGAMENTO:</b> {selectedOrderToPrint.payment_method} ({selectedOrderToPrint.is_paid ? 'PAGO' : 'PENDENTE'})</p>
          </div>

          <div className="border-b border-black pb-2 mb-2">
            <p className="font-bold border-b border-black pb-1 mb-1">ITENS DO PEDIDO:</p>
            {selectedOrderToPrint.items && Array.isArray(selectedOrderToPrint.items) && selectedOrderToPrint.items.map((it, idx) => (
              <div key={idx} className="mb-1">
                <p className="font-bold">{it.quantity}x {it.name} - R$ {(it.totalPrice * it.quantity).toFixed(2)}</p>
                {it.details && <p className="text-[10px] pl-2">↳ {it.details}</p>}
              </div>
            ))}
          </div>

          <div className="text-right font-bold text-sm">
            <p>TAXA: R$ {Number(selectedOrderToPrint.delivery_fee || 0).toFixed(2)}</p>
            <p>TOTAL: R$ {Number(selectedOrderToPrint.total || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* CABEÇALHO DA COZINHA */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👨‍🍳 Painel Kanban — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Notificação de novos pedidos ativa 🔔</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowArchived(!showArchived)} 
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${showArchived ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            {showArchived ? '📋 Voltar ao Kanban' : `📦 Arquivados (${archivedOrders.length})`}
          </button>
          <button onClick={() => fetchOrders(tenant.id)} className="bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl text-xs font-bold transition">
            🔄
          </button>
        </div>
      </header>

      {/* VISUALIZAÇÃO DOS ARQUIVADOS OU KANBAN */}
      {showArchived ? (
        <div className="space-y-4 no-print">
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-2xl border border-gray-800">
            <div>
              <h3 className="font-bold text-sm text-gray-200">📦 Histórico de Pedidos Arquivados</h3>
              <p className="text-xs text-gray-400">Total: {archivedOrders.length} pedidos arquivados nesta sessão.</p>
            </div>
            {archivedOrders.length > 0 && (
              <button 
                onClick={clearAllArchived}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold px-4 py-2 rounded-xl text-xs border border-red-500/30 transition">
                🧹 Limpar Todos os Arquivados
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {archivedOrders.map(order => renderOrderCard(order))}
          </div>
        </div>
      ) : (
        /* KANBAN EM 3 COLUNAS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          {/* COLUNA 1: RECEBIDOS */}
          <div className="bg-gray-900/60 p-3 rounded-2xl border border-yellow-500/30 space-y-3">
            <div className="flex justify-between items-center border-b border-yellow-500/30 pb-2">
              <h2 className="font-bold text-xs text-yellow-400 uppercase tracking-wider">🟡 1. RECEBIDOS ({recebidosOrders.length})</h2>
            </div>
            <div className="space-y-3">
              {recebidosOrders.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Sem novos pedidos</p>
              ) : (
                recebidosOrders.map(order => renderOrderCard(order))
              )}
            </div>
          </div>

          {/* COLUNA 2: EM PRODUÇÃO */}
          <div className="bg-gray-900/60 p-3 rounded-2xl border border-blue-500/30 space-y-3">
            <div className="flex justify-between items-center border-b border-blue-500/30 pb-2">
              <h2 className="font-bold text-xs text-blue-400 uppercase tracking-wider">👨‍🍳 2. EM PRODUÇÃO ({producaoOrders.length})</h2>
            </div>
            <div className="space-y-3">
              {producaoOrders.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Nenhum item em preparo</p>
              ) : (
                producaoOrders.map(order => renderOrderCard(order))
              )}
            </div>
          </div>

          {/* COLUNA 3: SAIU PARA ENTREGA / PRONTO */}
          <div className="bg-gray-900/60 p-3 rounded-2xl border border-purple-500/30 space-y-3">
            <div className="flex justify-between items-center border-b border-purple-500/30 pb-2">
              <h2 className="font-bold text-xs text-purple-400 uppercase tracking-wider">🛵 3. ENTREGA / PRONTO ({entregaOrders.length})</h2>
            </div>
            <div className="space-y-3">
              {entregaOrders.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Nenhum pedido a caminho ou pronto</p>
              ) : (
                entregaOrders.map(order => renderOrderCard(order))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
