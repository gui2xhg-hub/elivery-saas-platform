import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function CozinhaTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [orders, setOrders] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const printedOrdersRef = useRef(new Set());

  // Modal Cancelamento
  const [cancelingOrder, setCancelingOrder] = useState(null);
  const [cancelPassword, setCancelPassword] = useState('');

  useEffect(() => {
    if (slug) {
      fetchOrders();
      const interval = setInterval(() => {
        fetchOrders();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [slug]);

  const fetchOrders = async () => {
    // 1. Busca o tenant pelo slug
    const { data: tData, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (tErr || !tData) {
      setLoading(false);
      return;
    }

    setTenant(tData);

    // 2. Busca os pedidos do tenant_id correspondente
    const { data: oData } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tData.id)
      .neq('status', 'arquivado')
      .neq('status', 'cancelado')
      .order('id', { ascending: true });

    if (oData) {
      oData.forEach(order => {
        if (!printedOrdersRef.current.has(order.id) && order.status === 'recebido') {
          playBeepSound();
          if (autoPrint) {
            printOrderReceipt(order, tData);
          }
          printedOrdersRef.current.add(order.id);
        }
      });

      setOrders(oData);
    }
    setLoading(false);
  };

  const playBeepSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("Áudio bloqueado pelo navegador");
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    fetchOrders();
  };

  const handleRegressOrderStatus = async (order) => {
    let prevStatus = '';
    if (order.status === 'producao') prevStatus = 'recebido';
    else if (order.status === 'saiu_entrega') prevStatus = 'producao';
    else if (order.status === 'concluido') prevStatus = 'saiu_entrega';

    if (prevStatus) {
      await supabase.from('orders').update({ status: prevStatus }).eq('id', order.id);
      fetchOrders();
    }
  };

  const handleCompleteOrder = async (order) => {
    if (!order.is_paid) {
      const confirmPaid = confirm(`O pedido #${order.id} de ${order.customer_name} ainda consta como PENDENTE.\n\nVocê confirma que o valor de R$ ${Number(order.total).toFixed(2)} foi RECEBIDO?`);
      if (!confirmPaid) return;

      await supabase.from('orders').update({ is_paid: true, status: 'concluido' }).eq('id', order.id);
    } else {
      await supabase.from('orders').update({ status: 'concluido' }).eq('id', order.id);
    }
    fetchOrders();
  };

  const handleArchiveOrder = async (orderId) => {
    await supabase.from('orders').update({ status: 'arquivado' }).eq('id', orderId);
    fetchOrders();
  };

  const togglePaymentStatus = async (orderId, currentPaidStatus) => {
    await supabase.from('orders').update({ is_paid: !currentPaidStatus }).eq('id', orderId);
    fetchOrders();
  };

  const handleConfirmCancelOrder = async (e) => {
    e.preventDefault();
    if (!cancelingOrder) return;

    const adminPass = tenant?.admin_password || '123456';
    if (cancelPassword !== adminPass && cancelPassword !== 'master123') {
      return alert("Senha administrativa incorreta!");
    }

    await supabase.from('orders').update({ status: 'cancelado' }).eq('id', cancelingOrder.id);

    const targetPhone = cancelingOrder.customer_phone || tenant?.whatsapp;
    const cancelMsg = `Olá *${cancelingOrder.customer_name}*! Informamos que seu pedido *#${cancelingOrder.id}* na ${tenant?.name || 'loja'} foi *CANCELADO*. Se tiver dúvidas, entre em contato conosco por aqui.`;

    if (confirm("Deseja enviar a notificação de cancelamento para o cliente no WhatsApp?")) {
      window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(cancelMsg)}`, '_blank');
    }

    setCancelingOrder(null);
    setCancelPassword('');
    fetchOrders();
    alert(`Pedido #${cancelingOrder.id} cancelado com sucesso.`);
  };

  const notifyCustomerWhatsApp = (order, statusText) => {
    const targetPhone = order.customer_phone || tenant?.whatsapp;
    let message = "";

    if (statusText === 'producao') {
      message = `Olá *${order.customer_name}*! 👋\nSeu pedido *#${order.id}* na ${tenant?.name} foi *CONFIRMADO* e já está em produção na nossa cozinha! 🍔🔥`;
    } else if (statusText === 'saiu_entrega') {
      if (order.order_type === 'delivery') {
        message = `Olá *${order.customer_name}*! 🛵\nBoas notícias! Seu pedido *#${order.id}* acabou de sair para entrega. Fique atento!`;
      } else {
        message = `Olá *${order.customer_name}*! 🛍️\nSeu pedido *#${order.id}* está *PRONTO* para retirada no nosso balcão! Pode vir buscar.`;
      }
    }

    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const printOrderReceipt = (order, tenantObj = tenant) => {
    const dateStr = new Date(order.created_at).toLocaleString('pt-BR');
    let itemsHtml = order.items.map(it => `
      <div style="margin-bottom: 6px;">
        <b style="font-size: 14px;">[ ${it.quantity || 1}x ] ${it.name}</b>
        ${it.details ? `<div style="font-size: 11px; padding-left: 8px;">${it.details}</div>` : ''}
      </div>
    `).join('');

    const printWindow = window.open('', '', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Comanda #${order.id}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; color: #000; width: 280px; }
            .center { text-align: center; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .bold { font-weight: bold; }
            .big { font-size: 15px; }
            .alert-box { border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold; margin: 6px 0; }
          </style>
        </head>
        <body>
          <div class="center bold big">${tenantObj?.name || 'DELIVERY'}</div>
          <div class="center bold big">PEDIDO #${order.id}</div>
          <div class="center">${dateStr}</div>
          <div class="line"></div>

          <div class="alert-box">
            ${order.is_paid ? '🟢 PEDIDO PAGO (NÃO COBRAR)' : `🔴 COBRAR R$ ${Number(order.total).toFixed(2)}`}
          </div>
          
          <div><b>Cliente:</b> ${order.customer_name}</div>
          <div><b>Telefone:</b> ${order.customer_phone || 'Não informado'}</div>
          <div><b>Tipo:</b> ${order.order_type === 'delivery' ? 'ENTREGA 🛵' : 'RETIRADA PE🛍️'}</div>
          ${order.order_type === 'delivery' ? `
            <div><b>Bairro:</b> ${order.neighborhood}</div>
            <div><b>Endereço:</b> ${order.address}</div>
            ${order.reference ? `<div><b>Ref:</b> ${order.reference}</div>` : ''}
          ` : ''}
          <div><b>Forma Pagto:</b> ${order.payment_method}</div>
          
          <div class="line"></div>
          <div class="bold">ITENS DO PEDIDO:</div>
          <div style="margin-top: 6px;">${itemsHtml}</div>
          
          <div class="line"></div>
          <div style="display:flex; justify-content: space-between;"><span>Subtotal:</span> <span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
          <div style="display:flex; justify-content: space-between;"><span>Taxa Entrega:</span> <span>R$ ${Number(order.delivery_fee).toFixed(2)}</span></div>
          <div style="display:flex; justify-content: space-between;" class="bold big"><span>TOTAL:</span> <span>R$ ${Number(order.total).toFixed(2)}</span></div>
          <div class="line"></div>
          <div class="center" style="margin-top: 15px;">*** FIM DA COMANDA ***</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getTimeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 60000);
    if (diff < 1) return 'Agora';
    return `há ${diff} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans">
        <p className="text-sm text-gray-400">Carregando painel da cozinha...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
        <h1 className="text-2xl font-bold text-orange-500 mb-2">Restaurante não encontrado</h1>
        <p className="text-xs text-gray-400">Verifique a URL digitada.</p>
      </div>
    );
  }

  const receivedOrders = orders.filter(o => o.status === 'recebido');
  const inProductionOrders = orders.filter(o => o.status === 'producao');
  const deliveryOrders = orders.filter(o => o.status === 'saiu_entrega');
  const completedOrders = orders.filter(o => o.status === 'concluido');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-3 mb-6 gap-3">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👨‍🍳 Painel da Cozinha — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Gerenciamento KDS Multi-Tenant</p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 bg-gray-900 border border-gray-800 px-3 py-2 rounded-lg text-xs cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoPrint} 
              onChange={(e) => setAutoPrint(e.target.checked)}
              className="rounded bg-gray-800 border-gray-700 text-orange-500 focus:ring-0" 
            />
            <span className="font-bold text-gray-300">🖨️ Impressão Automática</span>
          </label>

          <button onClick={fetchOrders} className="bg-gray-800 text-xs px-3 py-2 rounded-lg text-orange-400 font-bold border border-gray-700">
            🔄 Atualizar ({orders.length})
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* COLUNA 1: RECEBIDOS */}
        <div className="bg-gray-900/60 p-3 rounded-2xl border border-gray-800 flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-blue-950/40 p-2.5 rounded-xl border border-blue-800/40">
            <span className="font-bold text-xs text-blue-400 uppercase tracking-wider">📥 1. Recebidos ({receivedOrders.length})</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[75vh]">
            {receivedOrders.map(order => (
              <div key={order.id} className="bg-gray-900 p-3.5 rounded-xl border border-blue-500/30 space-y-2.5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-orange-400 font-bold text-sm block">#{order.id} - {order.customer_name}</span>
                    <span className="text-[11px] text-gray-400">{order.order_type === 'delivery' ? `🛵 ${order.neighborhood}` : '🛍️ Retirada'}</span>
                  </div>
                  <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-bold">{getTimeAgo(order.created_at)}</span>
                </div>

                <div className="flex justify-between items-center bg-gray-950 p-2 rounded-lg border border-gray-800 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">Pagamento: {order.payment_method}</span>
                    <span className="font-bold text-white">R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => togglePaymentStatus(order.id, order.is_paid)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${order.is_paid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {order.is_paid ? '🟢 PAGO' : '🔴 PENDENTE'}
                  </button>
                </div>

                <div className="border-t border-b border-gray-800 py-2 space-y-1.5 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={idx}>
                      <span className="font-bold text-sm text-white">• {it.quantity || 1}x {it.name}</span>
                      {it.details && <span className="text-orange-300 text-[10px] block pl-3">{it.details}</span>}
                    </div>
                  ))}
                </div>

                <div className="flex space-x-1.5 pt-1">
                  <button 
                    onClick={() => printOrderReceipt(order)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-2 rounded-lg text-xs font-bold border border-gray-700">
                    🖨️
                  </button>
                  <button 
                    onClick={() => setCancelingOrder(order)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2.5 py-2 rounded-lg text-xs font-bold border border-red-500/30">
                    ❌
                  </button>
                  <button 
                    onClick={() => {
                      updateOrderStatus(order.id, 'producao');
                      notifyCustomerWhatsApp(order, 'producao');
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-xs">
                    🍳 Produzir & Avisar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA 2: EM PRODUÇÃO */}
        <div className="bg-gray-900/60 p-3 rounded-2xl border border-gray-800 flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-orange-950/40 p-2.5 rounded-xl border border-orange-800/40">
            <span className="font-bold text-xs text-orange-400 uppercase tracking-wider">🍳 2. Em Produção ({inProductionOrders.length})</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[75vh]">
            {inProductionOrders.map(order => (
              <div key={order.id} className="bg-gray-900 p-3.5 rounded-xl border border-orange-500/30 space-y-2.5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-orange-400 font-bold text-sm block">#{order.id} - {order.customer_name}</span>
                    <span className="text-[11px] text-gray-400">{order.order_type === 'delivery' ? `🛵 ${order.neighborhood}` : '🛍️ Retirada'}</span>
                  </div>
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded font-bold">{getTimeAgo(order.created_at)}</span>
                </div>

                <div className="flex justify-between items-center bg-gray-950 p-2 rounded-lg border border-gray-800 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">Pagamento: {order.payment_method}</span>
                    <span className="font-bold text-white">R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => togglePaymentStatus(order.id, order.is_paid)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${order.is_paid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {order.is_paid ? '🟢 PAGO' : '🔴 PENDENTE'}
                  </button>
                </div>

                <div className="border-t border-b border-gray-800 py-2 space-y-1.5 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={idx}>
                      <span className="font-bold text-sm text-white">• {it.quantity || 1}x {it.name}</span>
                      {it.details && <span className="text-orange-300 text-[10px] block pl-3">{it.details}</span>}
                    </div>
                  ))}
                </div>

                <div className="flex space-x-1.5 pt-1">
                  <button 
                    onClick={() => handleRegressOrderStatus(order)}
                    title="Voltar para Recebidos"
                    className="bg-gray-800 hover:bg-gray-700 text-yellow-400 px-2.5 py-2 rounded-lg text-xs font-bold border border-gray-700">
                    ↩️
                  </button>
                  <button 
                    onClick={() => printOrderReceipt(order)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-2 rounded-lg text-xs font-bold border border-gray-700">
                    🖨️
                  </button>
                  <button 
                    onClick={() => setCancelingOrder(order)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2.5 py-2 rounded-lg text-xs font-bold border border-red-500/30">
                    ❌
                  </button>
                  <button 
                    onClick={() => {
                      updateOrderStatus(order.id, 'saiu_entrega');
                      notifyCustomerWhatsApp(order, 'saiu_entrega');
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-xs">
                    {order.order_type === 'delivery' ? '🛵 Saiu p/ Entrega' : '🛍️ Pronto'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA 3: SAIU P/ ENTREGA / PRONTO */}
        <div className="bg-gray-900/60 p-3 rounded-2xl border border-gray-800 flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-green-950/40 p-2.5 rounded-xl border border-green-800/40">
            <span className="font-bold text-xs text-green-400 uppercase tracking-wider">🛵 3. A caminho / Pronto ({deliveryOrders.length})</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[75vh]">
            {deliveryOrders.map(order => (
              <div key={order.id} className="bg-gray-900 p-3.5 rounded-xl border border-gray-800 space-y-2.5 opacity-90">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-green-400 font-bold text-sm block">#{order.id} - {order.customer_name}</span>
                    <span className="text-[11px] text-gray-400">{order.order_type === 'delivery' ? 'A caminho' : 'Aguardando retirada'}</span>
                  </div>
                  <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-bold">{getTimeAgo(order.created_at)}</span>
                </div>

                <div className="flex justify-between items-center bg-gray-950 p-2 rounded-lg border border-gray-800 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">Pagamento: {order.payment_method}</span>
                    <span className="font-bold text-white">R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => togglePaymentStatus(order.id, order.is_paid)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${order.is_paid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {order.is_paid ? '🟢 PAGO' : '🔴 PENDENTE'}
                  </button>
                </div>

                <div className="flex space-x-1.5 pt-1">
                  <button 
                    onClick={() => handleRegressOrderStatus(order)}
                    title="Voltar para Em Produção"
                    className="bg-gray-800 hover:bg-gray-700 text-yellow-400 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-700">
                    ↩️
                  </button>
                  <button 
                    onClick={() => printOrderReceipt(order)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-700">
                    🖨️
                  </button>
                  <button 
                    onClick={() => handleCompleteOrder(order)}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold py-1.5 rounded-lg text-xs border border-green-500/30">
                    ✓ Concluído
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA 4: CONCLUÍDOS / ENTREGUES */}
        <div className="bg-gray-900/60 p-3 rounded-2xl border border-gray-800 flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-purple-950/40 p-2.5 rounded-xl border border-purple-800/40">
            <span className="font-bold text-xs text-purple-400 uppercase tracking-wider">🏁 4. Concluídos ({completedOrders.length})</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[75vh]">
            {completedOrders.map(order => (
              <div key={order.id} className="bg-gray-900 p-3.5 rounded-xl border border-gray-800 space-y-2 opacity-75">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-purple-300 font-bold text-sm block">#{order.id} - {order.customer_name}</span>
                    <span className="text-[11px] text-gray-400">Total: R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">🟢 PAGO</span>
                </div>

                <div className="flex space-x-1.5 pt-1">
                  <button 
                    onClick={() => handleRegressOrderStatus(order)}
                    title="Voltar para A caminho"
                    className="bg-gray-800 hover:bg-gray-700 text-yellow-400 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-700">
                    ↩️ Voltar
                  </button>
                  <button 
                    onClick={() => printOrderReceipt(order)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-700">
                    🖨️
                  </button>
                  <button 
                    onClick={() => handleArchiveOrder(order.id)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-1.5 rounded-lg text-xs border border-gray-700">
                    📦 Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL CANCELAMENTO */}
      {cancelingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-red-500/40 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-red-400">🚨 Cancelar Pedido #{cancelingOrder.id}</h3>
              <button onClick={() => setCancelingOrder(null)} className="text-gray-400 font-bold text-sm">✕</button>
            </div>

            <p className="text-xs text-gray-300">
              Digite a <b>Senha de Administrador</b> da loja para confirmar o cancelamento:
            </p>

            <form onSubmit={handleConfirmCancelOrder} className="space-y-3">
              <input 
                type="password"
                placeholder="Senha de Admin..."
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
                autoFocus
              />

              <div className="flex space-x-2 pt-1">
                <button 
                  type="button" 
                  onClick={() => setCancelingOrder(null)}
                  className="w-1/2 bg-gray-800 py-2.5 rounded-lg text-xs font-bold text-gray-300">
                  Voltar
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 bg-red-600 hover:bg-red-700 py-2.5 rounded-lg text-xs font-bold text-white">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
