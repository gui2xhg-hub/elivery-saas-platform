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

  // ESTADO DE ÁUDIO DE NOTIFICAÇÃO
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef(null);
  const prevOrdersCountRef = useRef(0);

  useEffect(() => {
    let unsubscribeRealtime = null;

    if (slug) {
      fetchTenantAndOrders().then((tenantData) => {
        if (tenantData?.id) {
          unsubscribeRealtime = subscribeRealtime(tenantData.id);
        }
      });

      // Polling de segurança a cada 10s caso a conexão caia
      const interval = setInterval(() => {
        if (tenant?.id) fetchOrders(tenant.id, true);
      }, 10000);

      return () => {
        clearInterval(interval);
        if (unsubscribeRealtime) unsubscribeRealtime();
      };
    }
  }, [slug]);

  const fetchTenantAndOrders = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant(tData);
      await fetchOrders(tData.id, false);
      return tData;
    }
    setLoading(false);
    return null;
  };

  const subscribeRealtime = (tenantId) => {
    const channel = supabase
      .channel(`schema-db-changes-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`
        },
        () => {
          fetchOrders(tenantId, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // ATIVAR ÁUDIO PELO CLIQUE DO USUÁRIO (DESBLOQUEIA O NAVEGADOR)
  const enableAudioAlert = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setSoundEnabled(true);
      playBeepSound(); // Toca um teste rápido
    } catch (e) {
      console.log("Erro ao ativar áudio: ", e);
    }
  };

  const playBeepSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.5);
    } catch (e) {
      console.log("Erro ao tocar áudio: ", e);
    }
  };

  const fetchOrders = async (tenantId = tenant?.id, isInterval = false) => {
    if (!tenantId) return;

    const { data: oData } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (oData) {
      const activeRecebidos = oData.filter(o => (!o.status || o.status === 'recebido' || o.status === 'pendente' || o.status === 'novo') && !o.archived).length;
      
      if (isInterval && activeRecebidos > prevOrdersCountRef.current && soundEnabled) {
        playBeepSound();
      }
      
      prevOrdersCountRef.current = activeRecebidos;
      setOrders(oData);
    }
    setLoading(false);
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

  // MENSAGEM DO WHATSAPP ADAPTADA PARA RETIRADA, MESA OU DELIVERY
  const sendWhatsAppStatus = (order, msgType) => {
    if (!order.customer_phone) {
      alert("Este pedido não possui número de telefone/WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone === '00000000000') {
      alert("Número de WhatsApp indisponível para este pedido.");
      return;
    }

    let msg = '';
    const isDelivery = order.order_type === 'delivery' || (!order.customer_address?.includes('MESA') && !order.customer_address?.includes('Balcão'));

    if (msgType === 'producao') {
      msg = `Olá ${order.customer_name}! 👨‍🍳 Seu pedido #${order.id} no *${tenant.name}* já está sendo preparado!`;
    } else if (msgType === 'entrega') {
      if (isDelivery) {
        msg = `Olá ${order.customer_name}! 🛵 Seu pedido #${order.id} no *${tenant.name}* saiu para entrega!`;
      } else {
        msg = `Olá ${order.customer_name}! 🛍️ Seu pedido #${order.id} no *${tenant.name}* está PRONTO!`;
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
  const activeOrders = orders.filter(o => !o.archived && o.status !== 'arquivado');
  const recebidosOrders = activeOrders.filter(o => !o.status || o.status === 'recebido' || o.status === 'pendente' || o.status === 'novo');
  const producaoOrders = activeOrders.filter(o => o.status === 'em_producao' || o.status === 'em_preparo');
  const entregaOrders = activeOrders.filter(o => o.status === 'saiu_entrega' || o.status === 'pronto' || o.status === 'entregue' || o.status === 'concluido');

  const archivedOrders = orders.filter(o => o.archived === true || o.status === 'arquivado');

  // COMPONENTE DO CARD DE PEDIDO
  const renderOrderCard = (order) => {
    const payMethodUpper = (order.payment_method || '').toUpperCase();
    const isPix = payMethodUpper.includes('PIX');
    const isMoney = payMethodUpper.includes('DINHEIRO');
    const isCardOnline = payMethodUpper.includes('ONLINE') || payMethodUpper.includes('PAGO ONLINE');
    const isCardMachine = payMethodUpper.includes('MAQUININHA');

    const fullAddr = order.customer_address || order.address || '';
    const isTable = fullAddr.toUpperCase().includes('MESA') || order.table_number || order.order_type === 'MESA' || order.order_type === 'mesa';
    const isDelivery = !isTable && !fullAddr.toUpperCase().includes('BALCÃO');

    return (
      <div key={order.id} className={`bg-gray-900 border ${isTable ? 'border-orange-500/80 bg-orange-500/5' : 'border-gray-800'} p-3.5 rounded-2xl space-y-2.5 shadow-lg`}>
        <div className="flex justify-between items-start border-b border-gray-800 pb-2">
          <div>
            <span className="font-bold text-xs text-orange-400">PEDIDO #{order.id}</span>
            <h3 className="font-bold text-xs text-white">{order.customer_name || 'Cliente'}</h3>
            {order.customer_phone && <p className="text-[11px] text-gray-400">📱 {order.customer_phone}</p>}
          </div>

          {isTable && (
            <span className="bg-orange-500 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg animate-pulse shadow">
              🪑 {fullAddr || `MESA ${order.table_number}`}
            </span>
          )}
        </div>

        <div className="text-[11px] text-gray-300 bg-gray-800/50 p-2 rounded-xl border border-gray-800 space-y-1">
          {isTable ? (
            <p className="font-bold text-orange-400">📍 Consumo Local: {fullAddr}</p>
          ) : isDelivery ? (
            <>
              <p><b>Tipo:</b> 🛵 Entrega</p>
              {order.neighborhood && <p><b>Bairro:</b> {order.neighborhood}</p>}
              <p><b>End:</b> {fullAddr}</p>
              {order.reference && <p className="text-gray-400"><b>Ref:</b> {order.reference}</p>}
            </>
          ) : (
            <p><b>Tipo:</b> 🛍️ Retirada No Balcão</p>
          )}

          {/* RECONHECIMENTO DE PAGAMENTOS EM TEMPO REAL */}
          <div className="pt-1 flex justify-between items-center border-t border-gray-700/50">
            {isPix ? (
              <div className="flex items-center justify-between w-full">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  order.is_paid ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {order.is_paid ? '🟢 PIX Confirmado (Baixa Aut.)' : '🟡 PIX Pendente'}
                </span>
                <button 
                  onClick={() => togglePaymentStatus(order.id, order.is_paid)}
                  className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-200 font-bold border border-gray-600 hover:bg-gray-600">
                  {order.is_paid ? 'Desmarcar' : '✅ Validar'}
                </button>
              </div>
            ) : isCardOnline ? (
              <div className="flex items-center justify-between w-full">
                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                  🟢 Cartão Pago Online (Site)
                </span>
              </div>
            ) : isCardMachine ? (
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                💳 Cartão (Levar Maquininha)
              </span>
            ) : isMoney ? (
              <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                💵 Dinheiro {order.change_for ? `(Troco p/ R$ ${order.change_for})` : ''}
              </span>
            ) : (
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                💳 {order.payment_method || 'Pagar no Balcão'}
              </span>
            )}
          </div>
        </div>

        {/* ITENS */}
        <div className="space-y-1.5 border-t border-b border-gray-800 py-1.5">
          {order.items && Array.isArray(order.items) && order.items.map((it, idx) => (
            <div key={idx} className="text-[11px] bg-gray-950/40 p-1.5 rounded-lg border border-gray-800/60">
              <span className="font-bold text-white">{it.quantity}x {it.name}</span>
              {it.details && <p className="text-[10px] text-orange-300 italic pl-2">{it.details}</p>}
              {it.selectedAddons && it.selectedAddons.length > 0 && (
                <p className="text-[10px] text-gray-400 pl-2">+ {it.selectedAddons.map(a => a.name).join(', ')}</p>
              )}
              {it.observation && (
                <p className="text-[10px] text-orange-400 italic pl-2">Obs: "{it.observation}"</p>
              )}
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
            {(!order.status || order.status === 'recebido' || order.status === 'pendente' || order.status === 'novo') && (
              <button onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} className="flex-1 bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg text-white">
                👨‍🍳 Mover p/ Produção ➔
              </button>
            )}

            {(order.status === 'em_producao' || order.status === 'em_preparo') && (
              <button 
                onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} 
                className={`flex-1 py-1.5 rounded-lg text-white transition ${isTable ? 'bg-orange-600 hover:bg-orange-700' : isDelivery ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {isTable ? '🪑 Servir na Mesa ➔' : isDelivery ? '🛵 Mover p/ Entrega ➔' : '🛍️ Pronto p/ Retirada ➔'}
              </button>
            )}

            {(order.status === 'saiu_entrega' || order.status === 'pronto' || order.status === 'entregue' || order.status === 'concluido') && (
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
            <p><b>CLIENTE:</b> {selectedOrderToPrint.customer_name || 'Cliente'}</p>
            {selectedOrderToPrint.customer_phone && <p><b>TEL:</b> {selectedOrderToPrint.customer_phone}</p>}
            <p><b>LOCAL/TIPO:</b> {selectedOrderToPrint.customer_address || selectedOrderToPrint.address || (selectedOrderToPrint.order_type === 'delivery' ? 'ENTREGA' : 'RETIRADA')}</p>
            {selectedOrderToPrint.neighborhood && <p><b>BAIRRO:</b> {selectedOrderToPrint.neighborhood}</p>}
            {selectedOrderToPrint.reference && <p><b>REF:</b> {selectedOrderToPrint.reference}</p>}
            <p><b>PAGAMENTO:</b> {selectedOrderToPrint.payment_method} ({selectedOrderToPrint.is_paid ? 'PAGO' : 'PENDENTE'})</p>
          </div>

          <div className="border-b border-black pb-2 mb-2">
            <p className="font-bold border-b border-black pb-1 mb-1">ITENS DO PEDIDO:</p>
            {selectedOrderToPrint.items && Array.isArray(selectedOrderToPrint.items) && selectedOrderToPrint.items.map((it, idx) => (
              <div key={idx} className="mb-1">
                <p className="font-bold">{it.quantity}x {it.name}</p>
                {it.details && <p className="text-[10px] pl-2">↳ {it.details}</p>}
                {it.selectedAddons && it.selectedAddons.length > 0 && (
                  <p className="text-[10px] pl-2">↳ + {it.selectedAddons.map(a => a.name).join(', ')}</p>
                )}
                {it.observation && <p className="text-[10px] pl-2">↳ Obs: {it.observation}</p>}
              </div>
            ))}
          </div>

          <div className="text-right font-bold text-sm">
            {Number(selectedOrderToPrint.delivery_fee || 0) > 0 && <p>TAXA: R$ {Number(selectedOrderToPrint.delivery_fee).toFixed(2)}</p>}
            <p>TOTAL: R$ {Number(selectedOrderToPrint.total || 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* CABEÇALHO DA COZINHA */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print flex-wrap gap-2">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👨‍🍳 Painel Kanban — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Notificação em tempo real ativa ⚡</p>
        </div>
        <div className="flex space-x-2 items-center">
          {/* BOTÃO PARA DESBLOQUEAR ÁUDIO */}
          <button
            onClick={enableAudioAlert}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              soundEnabled
                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse'
            }`}>
            {soundEnabled ? '🔊 Som Ativo' : '🔔 Ativar Alerta Sonoro'}
          </button>

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
