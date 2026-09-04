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
      // Atualiza os pedidos a cada 10 segundos
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
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tom alto 880Hz
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5); // Beep de 0.5s
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
        playBeepSound(); // Toca alerta se entrou pedido novo!
      }
      prevOrdersCountRef.current = activeRecebidos;
      setOrders(oData);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const archiveOrder = async (orderId) => {
    await supabase.from('orders').update({ archived: true, status: 'arquivado' }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const sendWhatsAppStatus = (order, msgType) => {
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    let msg = '';

    if (msgType === 'producao') {
      msg = `Olá ${order.customer_name}! 👨‍🍳 Seu pedido #${order.id} no *${tenant.name}* já está sendo preparado!`;
    } else if (msgType === 'entrega') {
      msg = `Olá ${order.customer_name}! 🛵 Seu pedido #${order.id} no *${tenant.name}* saiu para entrega!`;
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

  // Filtra ativos (não arquivados) ou lista de arquivados
  const displayedOrders = orders.filter(o => showArchived ? o.archived === true : !o.archived);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans max-w-4xl mx-auto pb-12">
      {/* IMPRESSÃO TÉRMICA */}
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

      {/* COMPROVANTE INDIVIDUAL */}
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
            <p><b>PAGAMENTO:</b> {selectedOrderToPrint.payment_method}</p>
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

      {/* CABEÇALHO */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👨‍🍳 Cozinha — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Notificação de novos pedidos ativa 🔔</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowArchived(!showArchived)} 
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${showArchived ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            {showArchived ? '📋 Ver Fila Ativa' : '📦 Arquivados'}
          </button>
          <button onClick={() => fetchOrders(tenant.id)} className="bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl text-xs font-bold transition">
            🔄
          </button>
        </div>
      </header>

      {/* LISTA DE PEDIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        {displayedOrders.length === 0 ? (
          <p className="text-sm text-gray-400">
            {showArchived ? 'Nenhum pedido arquivado.' : 'Nenhum pedido ativo na fila da cozinha.'}
          </p>
        ) : (
          displayedOrders.map(order => {
            const isPix = (order.payment_method || '').toUpperCase().includes('PIX');
            const isMoney = (order.payment_method || '').toUpperCase().includes('DINHEIRO');

            return (
              <div key={order.id} className="bg-gray-900 border border-gray-800 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-start border-b border-gray-800 pb-2">
                  <div>
                    <span className="font-bold text-sm text-orange-400">PEDIDO #{order.id}</span>
                    <h3 className="font-bold text-sm text-white">{order.customer_name}</h3>
                    <p className="text-xs text-gray-400">📱 {order.customer_phone}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    order.status === 'recebido' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    order.status === 'em_producao' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    order.status === 'saiu_entrega' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {order.status || 'recebido'}
                  </span>
                </div>

                {/* ENDEREÇO + BADGE DE COBRANÇA */}
                <div className="text-xs text-gray-300 bg-gray-800/50 p-2.5 rounded-xl border border-gray-800 space-y-1">
                  <p><b>Tipo:</b> {order.order_type === 'delivery' ? '🛵 Entrega' : '🛍️ Retirada'}</p>
                  {order.order_type === 'delivery' && (
                    <>
                      <p><b>Bairro:</b> {order.neighborhood}</p>
                      <p><b>Endereço:</b> {order.address}</p>
                      {order.reference && <p className="text-gray-400"><b>Ref:</b> {order.reference}</p>}
                    </>
                  )}
                  
                  {/* ALERTA DE COBRANÇA DE PAGAMENTO */}
                  <div className="pt-1.5">
                    {isPix ? (
                      <span className="inline-block bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        🟢 PIX (Pago / Transferido)
                      </span>
                    ) : isMoney ? (
                      <span className="inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        💵 Dinheiro (Cobrar R$ {Number(order.total).toFixed(2)} na entrega)
                      </span>
                    ) : (
                      <span className="inline-block bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        💳 Cartão (Passar Maquininha na entrega)
                      </span>
                    )}
                  </div>
                </div>

                {/* ITENS */}
                <div className="space-y-1.5 border-t border-b border-gray-800 py-2">
                  <span className="text-[11px] font-bold text-gray-400 block uppercase">Itens:</span>
                  {order.items && Array.isArray(order.items) && order.items.map((it, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-bold text-white">{it.quantity}x {it.name}</span>
                      {it.details && <p className="text-[10px] text-orange-300 italic pl-2">{it.details}</p>}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs font-bold">
                  <span>TOTAL:</span>
                  <span className="text-green-400 text-sm">R$ {Number(order.total || 0).toFixed(2)}</span>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="space-y-2 pt-1">
                  <div className="flex space-x-1.5 text-[11px]">
                    <button onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} className="flex-1 bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg font-bold">👨‍🍳 Em Produção</button>
                    <button onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} className="flex-1 bg-purple-600 hover:bg-purple-700 py-1.5 rounded-lg font-bold">🛵 Saiu Entrega</button>
                    <button onClick={() => archiveOrder(order.id)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-1.5 rounded-lg font-bold border border-gray-700">📦 Arquivar</button>
                  </div>

                  <button onClick={() => handlePrintSingleOrder(order)} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 py-2 rounded-xl text-xs font-bold text-gray-200">
                    🛈 Imprimir Comprovante
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
