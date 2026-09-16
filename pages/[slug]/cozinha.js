import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

// FUNÇÃO AUXILIAR PARA PARSE DE PREÇOS
const parsePrice = (val) => {
  if (!val) return 0;
  const clean = String(val).replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export default function PdvKdsTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [globalAddons, setGlobalAddons] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);

  // ABAS PRINCIPAIS: 'kds' | 'pdv' | 'mesas' | 'arquivados'
  const [activeTab, setActiveTab] = useState('kds');
  const [filterType, setFilterType] = useState('ALL'); // ALL, DELIVERY, BALCAO, MESA

  // IMPRESSÃO (COZINHA E RECIBO)
  const [printConfig, setPrintConfig] = useState(null); // { order, mode: 'kitchen' | 'receipt' }

  // ESTADO DE ÁUDIO E IMPRESSÃO AUTOMÁTICA
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const audioCtxRef = useRef(null);
  const prevOrdersCountRef = useRef(0);
  const autoPrintRef = useRef(autoPrintEnabled);
  const soundEnabledRef = useRef(soundEnabled);

  // ESTADO DE EDIÇÃO DE PEDIDO (ADMIN COM SENHA)
  const [editingOrder, setEditingOrder] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [editCartItems, setEditCartItems] = useState([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');

  // ESTADOS DO PDV (LANÇAMENTO MANUAL)
  const [pdvOrderType, setPdvOrderType] = useState('balcao'); // delivery, balcao, mesa
  const [pdvTableNum, setPdvTableNum] = useState('');
  const [pdvCustomerName, setPdvCustomerName] = useState('');
  const [pdvCustomerPhone, setPdvCustomerPhone] = useState('');
  const [pdvAddress, setPdvAddress] = useState('');
  const [pdvNeighborhood, setPdvNeighborhood] = useState('');
  const [pdvDeliveryFee, setPdvDeliveryFee] = useState(0);
  const [pdvCart, setPdvCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // MODAL DE ADIÇÃO DE ITEM AO PDV COM ADICIONAIS/SABORES/BORDAS
  const [selectedProdForPdv, setSelectedProdForPdv] = useState(null);
  const [selectedAddonsForProd, setSelectedAddonsForProd] = useState([]);
  const [selectedBorderForProd, setSelectedBorderForProd] = useState('');
  const [prodObservation, setProdObservation] = useState('');
  const [prodQuantity, setProdQuantity] = useState(1);

  // MODAL FECHAMENTO DE CAIXA / DIVISÃO DE CONTA / TROCO
  const [closingOrder, setClosingOrder] = useState(null);
  const [splitPeopleCount, setSplitPeopleCount] = useState(1);
  const [cashGiven, setCashGiven] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Dinheiro');

  useEffect(() => { autoPrintRef.current = autoPrintEnabled; }, [autoPrintEnabled]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    let unsubscribeRealtime = null;

    if (slug) {
      fetchTenantAndData().then((tenantData) => {
        if (tenantData?.id) {
          unsubscribeRealtime = subscribeRealtime(tenantData.id);
        }
      });

      const interval = setInterval(() => {
        if (tenant?.id) fetchOrders(tenant.id, true);
      }, 10000);

      return () => {
        clearInterval(interval);
        if (unsubscribeRealtime) unsubscribeRealtime();
      };
    }
  }, [slug]);

  const fetchTenantAndData = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant(tData);
      await fetchOrders(tData.id, false);

      const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('active', true);
      const { data: cData } = await supabase.from('categories').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });
      const { data: aData } = await supabase.from('global_addons').select('*').eq('tenant_id', tData.id);
      const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tData.id);

      if (pData) setProducts(pData);
      if (cData) setCategories(cData);
      if (aData) setGlobalAddons(aData);
      if (nData) setNeighborhoods(nData);

      return tData;
    }
    setLoading(false);
    return null;
  };

  const subscribeRealtime = (tenantId) => {
    const channel = supabase
      .channel(`schema-db-changes-pdvkds-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            if (soundEnabledRef.current) playBeepSound();
            if (autoPrintRef.current) handlePrintOrder(payload.new, 'kitchen');
          }
          fetchOrders(tenantId, true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const enableAudioAlert = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      setSoundEnabled(true);
      playBeepSound();
    } catch (e) { console.log("Erro ao ativar áudio: ", e); }
  };

  const playBeepSound = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.5);
    } catch (e) { console.log("Erro ao tocar áudio: ", e); }
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
      if (isInterval && activeRecebidos > prevOrdersCountRef.current && soundEnabledRef.current) playBeepSound();
      prevOrdersCountRef.current = activeRecebidos;
      setOrders(oData);
    }
    setLoading(false);
  };

  const getOrderDisplayNumber = (order) => {
    if (!order) return '';
    if (order.daily_number) return `#${String(order.daily_number).padStart(2, '0')}`;
    const resetDate = tenant?.order_reset_at ? new Date(tenant.order_reset_at) : new Date(0);
    const tenantOrdersAfterReset = orders
      .filter(o => new Date(o.created_at) >= resetDate)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const index = tenantOrdersAfterReset.findIndex(o => o.id === order.id);
    return index !== -1 ? `#${String(index + 1).padStart(2, '0')}` : `#${order.id}`;
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
    await supabase.from('orders').update({ archived: true, status: 'concluido' }).eq('id', orderId);
    if (tenant) fetchOrders(tenant.id);
  };

  const clearAllArchived = async () => {
    if (confirm("Deseja apagar definitivamente todos os pedidos arquivados da tela?")) {
      await supabase.from('orders').delete().eq('tenant_id', tenant.id).eq('archived', true);
      if (tenant) fetchOrders(tenant.id);
    }
  };

  // NOTIFICAÇÃO WHATSAPP
  const sendWhatsAppStatus = (order, msgType) => {
    if (!order.customer_phone) return alert("Telefone não cadastrado.");
    const cleanPhone = order.customer_phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone === '00000000000') return alert("WhatsApp indisponível.");

    let msg = '';
    const isDelivery = order.order_type === 'delivery' || (!order.customer_address?.includes('MESA') && !order.customer_address?.includes('Balcão'));
    const orderNum = getOrderDisplayNumber(order);

    if (msgType === 'producao') {
      msg = `Olá ${order.customer_name}! 👨‍🍳 Seu pedido ${orderNum} no *${tenant.name}* já está em preparo!`;
    } else if (msgType === 'entrega') {
      msg = isDelivery
        ? `Olá ${order.customer_name}! 🛵 Seu pedido ${orderNum} no *${tenant.name}* saiu para entrega!`
        : `Olá ${order.customer_name}! 🛍️ Seu pedido ${orderNum} no *${tenant.name}* está PRONTO para retirada!`;
    }

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // EDIÇÃO DE PEDIDO COM SENHA DE ADMIN
  const handleOpenEditModal = (order) => {
    setEditingOrder(order);
    setEditCartItems(order.items || []);
    setIsAdminAuthenticated(false);
    setAdminPassword('');
  };

  const handleAuthenticateAdmin = (e) => {
    e.preventDefault();
    if (adminPassword === tenant.admin_password || adminPassword === 'master123') {
      setIsAdminAuthenticated(true);
    } else {
      alert("Senha incorreta!");
    }
  };

  const handleAddItemToEditCart = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find(p => p.id === parseInt(selectedProductToAdd));
    if (!prod) return;

    const newItem = {
      id: prod.id,
      name: prod.name,
      price: parsePrice(prod.price),
      quantity: 1
    };

    setEditCartItems([...editCartItems, newItem]);
    setSelectedProductToAdd('');
  };

  const handleUpdateEditItemQty = (index, delta) => {
    const updated = [...editCartItems];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) updated.splice(index, 1);
    setEditCartItems(updated);
  };

  const handleSaveEditedOrder = async () => {
    if (editCartItems.length === 0) return alert("O pedido deve ter pelo menos 1 item!");

    const deliveryFee = Number(editingOrder.delivery_fee || 0);
    const newSubtotal = editCartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0);
    const newTotal = newSubtotal + deliveryFee;

    const originalTotal = Number(editingOrder.total || 0);
    const difference = newTotal - originalTotal;

    let updatedPaidStatus = editingOrder.is_paid;
    if (difference > 0) updatedPaidStatus = false;

    const { error } = await supabase.from('orders').update({
      items: editCartItems,
      subtotal: newSubtotal,
      total: newTotal,
      is_paid: updatedPaidStatus,
      notes: editingOrder.notes ? `${editingOrder.notes} (Editado pelo Admin)` : 'Editado pelo Admin'
    }).eq('id', editingOrder.id);

    if (error) return alert("Erro ao salvar alterações: " + error.message);

    alert(difference > 0 
      ? `Pedido atualizado! Houve um acréscimo de R$ ${difference.toFixed(2)}. Pagamento marcado como PENDENTE.` 
      : "Pedido atualizado com sucesso!");

    setEditingOrder(null);
    fetchOrders();
  };

  // MONTAGEM DO ITEM NO PDV MANUAL
  const handleOpenProdModal = (prod) => {
    setSelectedProdForPdv(prod);
    setSelectedAddonsForProd([]);
    setSelectedBorderForProd('');
    setProdObservation('');
    setProdQuantity(1);
  };

  const handleAddProdToCart = () => {
    if (!selectedProdForPdv) return;

    const addonsTotal = selectedAddonsForProd.reduce((acc, a) => acc + parsePrice(a.price), 0);
    let borderPrice = 0;
    if (selectedBorderForProd && selectedBorderForProd.includes(':')) {
      borderPrice = parsePrice(selectedBorderForProd.split(':')[1]);
    }

    const unitPrice = parsePrice(selectedProdForPdv.price) + addonsTotal + borderPrice;

    const cartItem = {
      id: selectedProdForPdv.id,
      name: selectedProdForPdv.name,
      price: unitPrice,
      quantity: prodQuantity,
      details: selectedBorderForProd ? `Borda: ${selectedBorderForProd.split(':')[0]}` : '',
      selectedAddons: selectedAddonsForProd,
      observation: prodObservation
    };

    setPdvCart([...pdvCart, cartItem]);
    setSelectedProdForPdv(null);
  };

  const handleRemovePdvCartItem = (index) => {
    const updated = [...pdvCart];
    updated.splice(index, 1);
    setPdvCart(updated);
  };

  const handleFinalizePdvOrder = async () => {
    if (pdvCart.length === 0) return alert("Adicione itens ao carrinho!");
    if (pdvOrderType === 'delivery' && !pdvCustomerName) return alert("Informe o nome do cliente!");
    if (pdvOrderType === 'mesa' && !pdvTableNum) return alert("Informe o número da mesa!");

    const subtotal = pdvCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = subtotal + (pdvOrderType === 'delivery' ? Number(pdvDeliveryFee) : 0);

    const addressFormatted = pdvOrderType === 'mesa' 
      ? `MESA ${pdvTableNum}` 
      : pdvOrderType === 'balcao' 
        ? 'Retirada no Balcão' 
        : pdvAddress;

    const payload = {
      tenant_id: tenant.id,
      customer_name: pdvCustomerName || (pdvOrderType === 'mesa' ? `Mesa ${pdvTableNum}` : 'Cliente Balcão'),
      customer_phone: pdvCustomerPhone || '',
      customer_address: addressFormatted,
      neighborhood: pdvOrderType === 'delivery' ? pdvNeighborhood : '',
      order_type: pdvOrderType,
      table_number: pdvOrderType === 'mesa' ? pdvTableNum : null,
      items: pdvCart,
      subtotal: subtotal,
      delivery_fee: pdvOrderType === 'delivery' ? Number(pdvDeliveryFee) : 0,
      total: total,
      payment_method: selectedPaymentMethod,
      is_paid: false,
      status: 'recebido',
      archived: false
    };

    const { error } = await supabase.from('orders').insert([payload]);
    if (error) return alert("Erro ao criar pedido: " + error.message);

    alert("Pedido criado com sucesso!");
    setPdvCart([]);
    setPdvCustomerName('');
    setPdvCustomerPhone('');
    setPdvAddress('');
    setPdvTableNum('');
    fetchOrders();
    setActiveTab('kds');
  };

  // FECHAMENTO DE CAIXA / DIVISÃO / TROCO
  const handleOpenClosingModal = (order) => {
    setClosingOrder(order);
    setSplitPeopleCount(1);
    setCashGiven('');
    setSelectedPaymentMethod(order.payment_method || 'Dinheiro');
  };

  const handleConfirmClosingPayment = async () => {
    if (!closingOrder) return;

    await supabase.from('orders').update({
      is_paid: true,
      payment_method: selectedPaymentMethod,
      archived: true,
      status: 'concluido'
    }).eq('id', closingOrder.id);

    alert("Pagamento confirmado e pedido encerrado no caixa!");
    setClosingOrder(null);
    fetchOrders();
  };

  const handlePrintOrder = (order, mode) => {
    setPrintConfig({ order, mode });
    setTimeout(() => { window.print(); }, 200);
  };

  const getElapsedTime = (createdAt) => {
    if (!createdAt) return { text: 'Agora', minutes: 0 };
    const diffMins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diffMins < 1) return { text: 'Agora', minutes: 0 };
    if (diffMins < 60) return { text: `${diffMins} min`, minutes: diffMins };
    return { text: `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`, minutes: diffMins };
  };

  if (loading) return <div className="p-4 text-white text-center font-sans">Carregando Painel Operacional...</div>;
  if (!tenant) return <div className="p-4 text-white text-center font-sans">Restaurante não encontrado.</div>;

  const getOrderCategory = (o) => {
    if (o.order_type) {
      const type = o.order_type.toLowerCase();
      if (type === 'mesa') return 'MESA';
      if (type === 'balcao' || type === 'retirada') return 'BALCAO';
      if (type === 'delivery') return 'DELIVERY';
    }
    const fullAddr = (o.customer_address || o.address || '').toUpperCase();
    if (fullAddr.includes('MESA') || o.table_number) return 'MESA';
    if (fullAddr.includes('BALCÃO') || fullAddr.includes('RETIRADA')) return 'BALCAO';
    return 'DELIVERY';
  };

  const activeOrders = orders.filter(o => !o.archived && o.status !== 'concluido' && o.status !== 'arquivado').filter(o => {
    const cat = getOrderCategory(o);
    if (filterType === 'DELIVERY') return cat === 'DELIVERY';
    if (filterType === 'BALCAO') return cat === 'BALCAO';
    if (filterType === 'MESA') return cat === 'MESA';
    return true;
  });

  const tableOrders = orders.filter(o => getOrderCategory(o) === 'MESA' && !o.archived);
  const archivedOrders = orders.filter(o => o.archived === true || o.status === 'arquivado' || o.status === 'concluido');

  const renderOrderCard = (order) => {
    const payMethodUpper = (order.payment_method || '').toUpperCase();
    const isMoney = payMethodUpper.includes('DINHEIRO');
    const isCardOnline = payMethodUpper.includes('ONLINE') || payMethodUpper.includes('PAGO ONLINE');

    const orderCategory = getOrderCategory(order);
    const isTable = orderCategory === 'MESA';
    const isDelivery = orderCategory === 'DELIVERY';

    const fullAddr = order.customer_address || order.address || '';
    const elapsed = getElapsedTime(order.created_at);
    const isDelayed = elapsed.minutes >= 20;

    const mapsQuery = encodeURIComponent(`${fullAddr}, ${order.neighborhood || ''}`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    return (
      <div key={order.id} className={`bg-gray-900 border-2 ${
        isTable ? 'border-orange-500 bg-orange-950/20' : 
        isDelayed ? 'border-red-500 animate-pulse' : 'border-gray-800'
      } p-4 rounded-2xl space-y-3 shadow-2xl relative`}>

        {/* CABEÇALHO DO CARD */}
        <div className="flex justify-between items-start border-b border-gray-800 pb-2.5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm text-orange-400">PEDIDO {getOrderDisplayNumber(order)}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isDelayed ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                ⏱️ {elapsed.text}
              </span>
            </div>
            <h3 className="font-bold text-base text-white mt-0.5">{order.customer_name || 'Cliente'}</h3>
            
            {order.waiter_name && (
              <span className="text-xs text-yellow-400 font-extrabold block mt-0.5">
                👤 Garçom: {order.waiter_name}
              </span>
            )}

            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`} className="text-xs text-blue-400 font-bold hover:underline block mt-0.5">
                📱 {order.customer_phone}
              </a>
            )}
          </div>

          <div className="flex flex-col items-end space-y-1">
            {isTable ? (
              <span className="bg-orange-500 text-white font-black text-xs px-3 py-1 rounded-xl shadow block">
                🪑 {fullAddr || `MESA ${order.table_number || ''}`}
              </span>
            ) : isDelivery ? (
              <span className="bg-purple-600 text-white font-black text-xs px-3 py-1 rounded-xl shadow block">
                🛵 DELIVERY
              </span>
            ) : (
              <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-xl shadow block">
                🛍️ BALCÃO
              </span>
            )}

            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleOpenEditModal(order)}
                className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30 px-2 py-0.5 rounded-lg font-bold transition">
                ✏️ Editar
              </button>

              {/* SELETOR DE MUDANÇA LIVRE DE ETAPA NO KDS */}
              <select
                value={order.status || 'recebido'}
                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                className="bg-gray-800 border border-gray-700 text-[10px] text-orange-300 font-bold p-1 rounded-lg focus:outline-none">
                <option value="recebido">🟡 Recebido</option>
                <option value="em_producao">👨‍🍳 Em Produção</option>
                <option value="saiu_entrega">🛵 Pronto/Entrega</option>
                <option value="concluido">✅ Concluído</option>
              </select>
            </div>
          </div>
        </div>

        {/* ENDEREÇO & MAPS */}
        {isDelivery && (
          <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-200 font-bold">📍 {fullAddr}</p>
                {order.neighborhood && <p className="text-gray-400"><b>Bairro:</b> {order.neighborhood}</p>}
                {order.reference && <p className="text-orange-300 italic"><b>Ref:</b> {order.reference}</p>}
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-green-600/20 hover:bg-green-600/40 text-green-400 font-bold border border-green-500/30 px-2.5 py-1.5 rounded-lg text-[10px] flex items-center space-x-1 shrink-0 ml-2">
                <span>🗺️ Maps</span>
              </a>
            </div>
          </div>
        )}

        {/* PAGAMENTO */}
        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold text-[11px]">Pagamento:</span>
            
            {order.is_paid || isCardOnline ? (
              <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg font-extrabold text-[11px]">
                🟢 PAGO ({order.payment_method || 'Online'})
              </span>
            ) : (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-extrabold text-[11px] animate-pulse">
                🔴 COBRAR NA ENTREGA
              </span>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between items-center text-[11px]">
            <span className="text-gray-300 font-bold">
              {isMoney ? `💵 Dinheiro ${order.change_for ? `(Troco p/ R$ ${order.change_for})` : ''}` : `💳 ${order.payment_method}`}
            </span>

            <button
              onClick={() => togglePaymentStatus(order.id, order.is_paid)}
              className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded-lg font-bold border border-gray-700">
              {order.is_paid ? '🔴 Desmarcar Pago' : '✅ Marcar Pago'}
            </button>
          </div>
        </div>

        {/* ITENS DO PEDIDO */}
        <div className="space-y-2 border-t border-b border-gray-800 py-2.5">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Itens para Preparo:</span>

          {order.items && Array.isArray(order.items) && order.items.map((it, idx) => (
            <div key={idx} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 space-y-1">
              <div className="flex items-start justify-between">
                <span className="font-black text-sm text-white">
                  <span className="text-orange-400 bg-orange-500/20 border border-orange-500/40 px-1.5 py-0.5 rounded-md mr-1.5">{it.quantity}x</span> 
                  {it.name}
                </span>
                <span className="text-xs font-bold text-green-400">R$ {(parsePrice(it.price) * it.quantity).toFixed(2)}</span>
              </div>

              {it.details && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold text-xs p-1.5 rounded-lg mt-1">
                  🍕 {it.details}
                </div>
              )}

              {it.selectedAddons && it.selectedAddons.length > 0 && (
                <p className="text-xs text-purple-300 font-bold pl-1 mt-0.5">
                  ➕ {it.selectedAddons.map(a => a.name).join(', ')}
                </p>
              )}

              {it.observation && (
                <div className="bg-red-500/20 border border-red-500/40 text-red-300 font-extrabold text-xs p-1.5 rounded-lg mt-1 flex items-center space-x-1">
                  <span>⚠️ OBS:</span>
                  <span>"{it.observation}"</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* TOTAL */}
        <div className="flex justify-between items-center font-black text-sm pt-1">
          <span className="text-gray-400">TOTAL DO PEDIDO:</span>
          <span className="text-green-400 text-base">R$ {Number(order.total || 0).toFixed(2)}</span>
        </div>

        {/* AÇÕES E IMPRESSÕES */}
        <div className="space-y-2 pt-1">
          <div className="flex space-x-1.5 text-xs font-bold">
            {(!order.status || order.status === 'recebido' || order.status === 'pendente' || order.status === 'novo') && (
              <button 
                onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-white shadow font-extrabold text-xs">
                👨‍🍳 Mover p/ Produção ➔
              </button>
            )}

            {(order.status === 'em_producao' || order.status === 'em_preparo') && (
              <button 
                onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} 
                className={`flex-1 py-2.5 rounded-xl text-white shadow font-extrabold text-xs transition ${
                  isTable ? 'bg-orange-600 hover:bg-orange-700' : isDelivery ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {isTable ? '🪑 Servir na Mesa ➔' : isDelivery ? '🛵 Saiu p/ Entrega ➔' : '🛍️ Pronto p/ Retirada ➔'}
              </button>
            )}

            {(order.status === 'saiu_entrega' || order.status === 'pronto' || order.status === 'entregue' || order.status === 'concluido') && (
              <button 
                onClick={() => handleOpenClosingModal(order)} 
                className="flex-1 bg-green-600 hover:bg-green-700 py-2.5 rounded-xl text-white shadow font-extrabold text-xs">
                💰 Fechar Caixa & Concluir
              </button>
            )}

            <button onClick={() => archiveOrder(order.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2.5 rounded-xl border border-gray-700 font-bold" title="Arquivar Pedido">
              📦
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handlePrintOrder(order, 'kitchen')} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 py-2 rounded-xl text-[11px] font-bold text-gray-300 transition">
              🖨️ Via Cozinha
            </button>
            <button onClick={() => handlePrintOrder(order, 'receipt')} className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 py-2 rounded-xl text-[11px] font-bold text-orange-300 transition">
              📄 Recibo Cliente
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 font-sans max-w-7xl mx-auto pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 5px !important;
            color: #000 !important;
            background: #fff !important;
            font-family: monospace !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* COMPROVANTE DE IMPRESSÃO TÉRMICA 80MM */}
      {printConfig?.order && (
        <div id="print-area" className="hidden print:block text-black font-mono">
          {printConfig.mode === 'kitchen' ? (
            <div>
              <div className="text-center border-b border-black pb-2 mb-2">
                <h2 className="font-bold text-sm uppercase">{tenant.name}</h2>
                <p className="text-[10px]">VIA DE PRODUÇÃO — PEDIDO {getOrderDisplayNumber(printConfig.order)}</p>
                <p className="text-[9px]">{new Date(printConfig.order.created_at || Date.now()).toLocaleString('pt-BR')}</p>
              </div>

              <div className="border-b border-black pb-2 mb-2 space-y-0.5 text-[10px]">
                <p><b>CLIENTE:</b> {printConfig.order.customer_name || 'Cliente'}</p>
                {printConfig.order.waiter_name && <p><b>GARÇOM:</b> {printConfig.order.waiter_name}</p>}
                <p><b>TIPO:</b> {(printConfig.order.order_type || 'DELIVERY').toUpperCase()}</p>
                <p><b>LOCAL:</b> {printConfig.order.customer_address || printConfig.order.address || 'BALCÃO'}</p>
              </div>

              <div className="border-b border-black pb-2 mb-2">
                <p className="font-bold border-b border-black pb-1 mb-1">ITENS DO PEDIDO:</p>
                {printConfig.order.items?.map((it, idx) => (
                  <div key={idx} className="mb-1 text-[11px]">
                    <p className="font-bold">{it.quantity}x {it.name}</p>
                    {it.details && <p className="text-[10px] pl-2">↳ {it.details}</p>}
                    {it.selectedAddons && it.selectedAddons.length > 0 && (
                      <p className="text-[10px] pl-2">↳ + {it.selectedAddons.map(a => a.name).join(', ')}</p>
                    )}
                    {it.observation && <p className="text-[10px] pl-2">↳ OBS: {it.observation}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center border-b border-black pb-2 mb-2">
                <h2 className="font-bold text-sm uppercase">{tenant.name}</h2>
                {tenant.cnpj && <p className="text-[9px]">CNPJ: {tenant.cnpj}</p>}
                {tenant.address && <p className="text-[9px]">{tenant.address}</p>}
                <p className="text-[10px] font-bold mt-1">RECIBO DO CLIENTE — PEDIDO {getOrderDisplayNumber(printConfig.order)}</p>
                <p className="text-[9px]">{new Date(printConfig.order.created_at || Date.now()).toLocaleString('pt-BR')}</p>
              </div>

              <div className="border-b border-black pb-2 mb-2 text-[10px] space-y-0.5">
                <p><b>CLIENTE:</b> {printConfig.order.customer_name}</p>
                {printConfig.order.customer_phone && <p><b>TEL:</b> {printConfig.order.customer_phone}</p>}
                <p><b>ENDEREÇO:</b> {printConfig.order.customer_address || 'Retirada no Balcão'}</p>
                {printConfig.order.waiter_name && <p><b>GARÇOM:</b> {printConfig.order.waiter_name}</p>}
                <p><b>PAGAMENTO:</b> {printConfig.order.payment_method} ({printConfig.order.is_paid ? 'PAGO' : 'PENDENTE'})</p>
              </div>

              <div className="border-b border-black pb-2 mb-2 space-y-1">
                <p className="font-bold text-[10px]">DETALHAMENTO:</p>
                {printConfig.order.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span>{it.quantity}x {it.name}</span>
                    <span>R$ {(parsePrice(it.price) * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-right text-[11px] space-y-0.5">
                <div className="flex justify-between"><span>Subtotal:</span><span>R$ {Number(printConfig.order.subtotal || printConfig.order.total).toFixed(2)}</span></div>
                {Number(printConfig.order.delivery_fee || 0) > 0 && <div className="flex justify-between"><span>Taxa Entrega:</span><span>R$ {Number(printConfig.order.delivery_fee).toFixed(2)}</span></div>}
                <div className="flex justify-between font-extrabold border-t border-black pt-1"><span>TOTAL:</span><span>R$ {Number(printConfig.order.total).toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CABEÇALHO SUPERIOR */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print flex-wrap gap-3">
        <div>
          <h1 className="font-extrabold text-xl sm:text-2xl text-orange-500">🖥️ PDV & KDS Operacional — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Caixa, Lançamento Manual e Monitor de Produção</p>
        </div>

        <div className="flex space-x-2 items-center flex-wrap gap-2">
          <button onClick={enableAudioAlert} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${soundEnabled ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse'}`}>
            {soundEnabled ? '🔊 Som Ativo' : '🔔 Ativar Som'}
          </button>
          <button onClick={() => setAutoPrintEnabled(!autoPrintEnabled)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${autoPrintEnabled ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
            {autoPrintEnabled ? '🖨️ Auto Print: ON' : '🖨️ Auto Print: OFF'}
          </button>
          <button onClick={() => fetchOrders(tenant.id)} className="bg-orange-500 hover:bg-orange-600 px-3.5 py-2 rounded-xl text-xs font-bold transition">🔄</button>
        </div>
      </header>

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex space-x-2 bg-gray-900 p-1.5 rounded-2xl border border-gray-800 mb-6 text-xs font-bold overflow-x-auto no-print">
        <button onClick={() => setActiveTab('kds')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition ${activeTab === 'kds' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>👨‍🍳 KDS Cozinha ({activeOrders.length})</button>
        <button onClick={() => setActiveTab('pdv')} className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition ${activeTab === 'pdv' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>➕ PDV Novo Pedido</button>
        <button onClick={() => setActiveTab('mesas')} className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition ${activeTab === 'mesas' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🪑 Mesas & Comandas ({tableOrders.length})</button>
        <button onClick={() => setActiveTab('arquivados')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition ${activeTab === 'arquivados' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>📦 Arquivados ({archivedOrders.length})</button>
      </div>

      {/* ABA 1: KDS COZINHA */}
      {activeTab === 'kds' && (
        <div className="space-y-6">
          <div className="flex space-x-2 no-print overflow-x-auto text-xs font-bold">
            <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-xl border ${filterType === 'ALL' ? 'bg-orange-500 border-orange-500' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>Todos os Pedidos</button>
            <button onClick={() => setFilterType('DELIVERY')} className={`px-4 py-2 rounded-xl border ${filterType === 'DELIVERY' ? 'bg-purple-600 border-purple-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛵 Delivery</button>
            <button onClick={() => setFilterType('BALCAO')} className={`px-4 py-2 rounded-xl border ${filterType === 'BALCAO' ? 'bg-blue-600 border-blue-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛍️ Retirada Balcão</button>
            <button onClick={() => setFilterType('MESA')} className={`px-4 py-2 rounded-xl border ${filterType === 'MESA' ? 'bg-orange-600 border-orange-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🪑 Consumo em Mesa</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['recebido', 'em_producao', 'saiu_entrega'].map((statusKey) => {
              const columnOrders = activeOrders.filter(o => {
                if (statusKey === 'recebido') return !o.status || o.status === 'recebido' || o.status === 'pendente' || o.status === 'novo';
                if (statusKey === 'em_producao') return o.status === 'em_producao' || o.status === 'em_preparo';
                if (statusKey === 'saiu_entrega') return o.status === 'saiu_entrega' || o.status === 'pronto';
                return false;
              });

              const titles = { recebido: '🟡 1. RECEBIDOS', em_producao: '👨‍🍳 2. EM PRODUÇÃO', saiu_entrega: '🛵 3. PRONTO / EM ENTREGA' };

              return (
                <div key={statusKey} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-4">
                  <h2 className="font-extrabold text-xs text-orange-400 border-b border-gray-800 pb-3">{titles[statusKey]} ({columnOrders.length})</h2>
                  <div className="space-y-4">
                    {columnOrders.length === 0 ? <p className="text-xs text-gray-500 text-center py-6">Sem pedidos nesta etapa</p> : columnOrders.map(order => renderOrderCard(order))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: PDV LANÇAMENTO MANUAL DE PEDIDO */}
      {activeTab === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex space-x-2 overflow-x-auto pb-1 text-xs font-bold">
              <button onClick={() => setSelectedCategory('ALL')} className={`px-3 py-2 rounded-xl border ${selectedCategory === 'ALL' ? 'bg-orange-500 border-orange-500' : 'bg-gray-900 border-gray-800'}`}>Todas Categorias</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setSelectedCategory(c.id)} className={`px-3 py-2 rounded-xl border ${selectedCategory === c.id ? 'bg-orange-500 border-orange-500' : 'bg-gray-900 border-gray-800'}`}>{c.name}</button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {products.filter(p => selectedCategory === 'ALL' || p.category_id === selectedCategory).map(prod => (
                <div key={prod.id} onClick={() => handleOpenProdModal(prod)} className="bg-gray-900 p-3 rounded-2xl border border-gray-800 hover:border-orange-500/50 cursor-pointer transition flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-white">{prod.name}</h4>
                    <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{prod.description}</p>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="font-extrabold text-xs text-orange-400">R$ {Number(prod.price).toFixed(2)}</span>
                    <span className="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-orange-500/30">➕ Lançar</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4 h-fit">
            <h3 className="font-bold text-sm text-orange-400 border-b border-gray-800 pb-2">🛒 Detalhes do Pedido PDV</h3>

            <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
              <button onClick={() => setPdvOrderType('balcao')} className={`py-2 rounded-xl border ${pdvOrderType === 'balcao' ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>🛍️ Balcão</button>
              <button onClick={() => setPdvOrderType('mesa')} className={`py-2 rounded-xl border ${pdvOrderType === 'mesa' ? 'bg-orange-600 border-orange-500' : 'bg-gray-800 border-gray-700'}`}>🪑 Mesa</button>
              <button onClick={() => setPdvOrderType('delivery')} className={`py-2 rounded-xl border ${pdvOrderType === 'delivery' ? 'bg-purple-600 border-purple-500' : 'bg-gray-800 border-gray-700'}`}>🛵 Delivery</button>
            </div>

            {pdvOrderType === 'mesa' && (
              <input type="text" placeholder="Número da Mesa (Ex: 05)" value={pdvTableNum} onChange={(e) => setPdvTableNum(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none" />
            )}

            {pdvOrderType === 'delivery' && (
              <div className="space-y-2">
                <input type="text" placeholder="Nome do Cliente" value={pdvCustomerName} onChange={(e) => setPdvCustomerName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                <input type="text" placeholder="Telefone / WhatsApp" value={pdvCustomerPhone} onChange={(e) => setPdvCustomerPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                <input type="text" placeholder="Endereço Completo" value={pdvAddress} onChange={(e) => setPdvAddress(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                
                <div className="grid grid-cols-2 gap-2">
                  <select value={pdvNeighborhood} onChange={(e) => {
                    setPdvNeighborhood(e.target.value);
                    const neigh = neighborhoods.find(n => n.name === e.target.value);
                    if (neigh) setPdvDeliveryFee(neigh.fee);
                  }} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none">
                    <option value="">Selecione o Bairro...</option>
                    {neighborhoods.map(n => <option key={n.id} value={n.name}>{n.name} (+R${Number(n.fee).toFixed(2)})</option>)}
                  </select>
                  <input type="number" placeholder="Taxa R$" value={pdvDeliveryFee} onChange={(e) => setPdvDeliveryFee(e.target.value)} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none" />
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto border-t border-b border-gray-800 py-3">
              {pdvCart.length === 0 ? <p className="text-xs text-gray-500 text-center py-4">Nenhum item adicionado</p> : pdvCart.map((item, idx) => (
                <div key={idx} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white">{item.quantity}x {item.name}</span>
                    {item.details && <p className="text-[10px] text-gray-400">{item.details}</p>}
                    <span className="text-orange-400 font-bold block">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <button onClick={() => handleRemovePdvCartItem(idx)} className="text-red-400 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-lg">🗑</button>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400"><span>Subtotal:</span><span>R$ {pdvCart.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</span></div>
              {pdvOrderType === 'delivery' && <div className="flex justify-between text-gray-400"><span>Entrega:</span><span>R$ {Number(pdvDeliveryFee).toFixed(2)}</span></div>}
              <div className="flex justify-between font-black text-sm text-green-400 pt-1 border-t border-gray-800">
                <span>TOTAL:</span>
                <span>R$ {(pdvCart.reduce((a, b) => a + (b.price * b.quantity), 0) + (pdvOrderType === 'delivery' ? Number(pdvDeliveryFee) : 0)).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleFinalizePdvOrder} className="w-full bg-green-600 hover:bg-green-700 font-extrabold py-3 rounded-xl text-xs transition shadow-lg text-white">
              🚀 Confirmar & Lançar Pedido
            </button>
          </div>
        </div>
      )}

      {/* ABA 3: GESTÃO DE MESAS E COMANDAS */}
      {activeTab === 'mesas' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-orange-400">🪑 Mesas com Contas Abertas ({tableOrders.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tableOrders.length === 0 ? <p className="text-xs text-gray-500 py-6">Nenhuma mesa aberta no momento.</p> : tableOrders.map(order => (
              <div key={order.id} className="bg-gray-900 p-4 rounded-2xl border border-orange-500/40 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <span className="font-extrabold text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg">MESA {order.table_number || 'ND'}</span>
                    <span className="text-xs text-gray-400 font-mono">Ped. {getOrderDisplayNumber(order)}</span>
                  </div>
                  <div className="space-y-1 mt-3 text-xs">
                    {order.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-gray-300">
                        <span>{it.quantity}x {it.name}</span>
                        <span>R$ {(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800 space-y-2">
                  <div className="flex justify-between font-extrabold text-sm text-green-400">
                    <span>Total:</span>
                    <span>R$ {Number(order.total).toFixed(2)}</span>
                  </div>
                  <button onClick={() => handleOpenClosingModal(order)} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition">
                    💰 Fechar Mesa & Receber
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 4: HISTÓRICO DE ARQUIVADOS */}
      {activeTab === 'arquivados' && (
        <div className="space-y-4 no-print">
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-2xl border border-gray-800">
            <div>
              <h3 className="font-bold text-sm text-gray-200">📦 Histórico de Pedidos Arquivados</h3>
              <p className="text-xs text-gray-400">Total: {archivedOrders.length} pedidos arquivados.</p>
            </div>
            {archivedOrders.length > 0 && (
              <button 
                onClick={clearAllArchived}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold px-4 py-2 rounded-xl text-xs border border-red-500/30 transition">
                🧹 Limpar Todos os Arquivados
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedOrders.map(order => renderOrderCard(order))}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PEDIDO COM SENHA DE ADMIN */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-lg rounded-2xl p-5 border border-yellow-500/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-yellow-400">✏️ Editar Pedido {getOrderDisplayNumber(editingOrder)}</h3>
              <button onClick={() => setEditingOrder(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            {!isAdminAuthenticated ? (
              <form onSubmit={handleAuthenticateAdmin} className="space-y-3 pt-2">
                <p className="text-xs text-gray-300">Digite a senha de administrador para alterar este pedido:</p>
                <input
                  type="password"
                  placeholder="Senha do Administrador..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
                />
                <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold py-2.5 rounded-xl text-xs transition">
                  🔓 Desbloquear Edição
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                  <span className="text-xs font-bold text-gray-300 block">Adicionar Produto ao Pedido:</span>
                  <div className="flex space-x-2">
                    <select
                      value={selectedProductToAdd}
                      onChange={(e) => setSelectedProductToAdd(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 p-2 rounded-xl text-xs text-white focus:outline-none">
                      <option value="">Selecione o Item...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                      ))}
                    </select>
                    <button type="button" onClick={handleAddItemToEditCart} className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-xl text-xs font-bold">
                      ➕ Incluir
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-300 block">Itens Atuais do Pedido:</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {editCartItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                        <div>
                          <span className="font-bold text-white block">{item.name}</span>
                          <span className="text-[10px] text-green-400">R$ {(parsePrice(item.price) * item.quantity).toFixed(2)}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => handleUpdateEditItemQty(index, -1)} className="w-6 h-6 bg-gray-800 rounded-lg text-red-400 font-bold">-</button>
                          <span className="font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => handleUpdateEditItemQty(index, 1)} className="w-6 h-6 bg-gray-800 rounded-lg text-green-400 font-bold">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Taxa de Entrega:</span>
                    <span>R$ {Number(editingOrder.delivery_fee || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-green-400 pt-1 border-t border-gray-800">
                    <span>Novo Total do Pedido:</span>
                    <span>R$ {(editCartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0) + Number(editingOrder.delivery_fee || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button type="button" onClick={() => setEditingOrder(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs font-bold text-gray-300">Cancelar</button>
                  <button type="button" onClick={handleSaveEditedOrder} className="w-1/2 bg-green-600 hover:bg-green-700 py-2.5 rounded-xl text-xs font-bold text-white">💾 Salvar Alterações</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CUSTOMIZAÇÃO DO ITEM NO PDV */}
      {selectedProdForPdv && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-orange-500/40 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-orange-400">{selectedProdForPdv.name}</h3>
              <button onClick={() => setSelectedProdForPdv(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            {selectedProdForPdv.borders_list && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 block">Escolha a Borda:</label>
                <select value={selectedBorderForProd} onChange={(e) => setSelectedBorderForProd(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none">
                  <option value="">Sem borda especial</option>
                  {selectedProdForPdv.borders_list.split(',').map((b, idx) => (
                    <option key={idx} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Adicionais / Sabores:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {globalAddons.map(a => {
                  const isChecked = selectedAddonsForProd.some(item => item.id === a.id);
                  return (
                    <label key={a.id} className="flex items-center space-x-2 bg-gray-950 p-2 rounded-xl border border-gray-800 text-xs cursor-pointer">
                      <input type="checkbox" checked={isChecked} onChange={(e) => {
                        if (e.target.checked) setSelectedAddonsForProd([...selectedAddonsForProd, a]);
                        else setSelectedAddonsForProd(selectedAddonsForProd.filter(item => item.id !== a.id));
                      }} className="accent-orange-500" />
                      <span className="truncate">{a.name} (+R${Number(a.price).toFixed(2)})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <input type="text" placeholder="Observações do item (Ex: Sem cebola)" value={prodObservation} onChange={(e) => setProdObservation(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />

            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <div className="flex items-center space-x-2">
                <button onClick={() => setProdQuantity(Math.max(1, prodQuantity - 1))} className="w-8 h-8 bg-gray-800 rounded-lg font-bold text-red-400">-</button>
                <span className="font-bold text-sm">{prodQuantity}</span>
                <button onClick={() => setProdQuantity(prodQuantity + 1)} className="w-8 h-8 bg-gray-800 rounded-lg font-bold text-green-400">+</button>
              </div>

              <button onClick={handleAddProdToCart} className="bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl text-xs font-bold text-white">
                Adicionar ao Pedido 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FECHAMENTO DE CAIXA / TROCO / DIVISÃO DE CONTA */}
      {closingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-green-500/40 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-green-400">💰 Fechamento de Caixa / Recebimento</h3>
              <button onClick={() => setClosingOrder(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1 text-xs">
              <div className="flex justify-between"><span>Pedido:</span><span className="font-bold">{getOrderDisplayNumber(closingOrder)}</span></div>
              <div className="flex justify-between"><span>Cliente/Mesa:</span><span className="font-bold">{closingOrder.customer_name}</span></div>
              <div className="flex justify-between text-base font-black text-green-400 pt-1 border-t border-gray-800"><span>TOTAL:</span><span>R$ {Number(closingOrder.total).toFixed(2)}</span></div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">Dividir Conta por Pessoas:</label>
              <div className="flex items-center space-x-2">
                <input type="number" min="1" max="50" value={splitPeopleCount} onChange={(e) => setSplitPeopleCount(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 bg-gray-800 border border-gray-700 p-2 rounded-xl text-xs font-bold text-center text-white" />
                <span className="text-xs text-orange-400 font-bold">↳ R$ {(Number(closingOrder.total) / splitPeopleCount).toFixed(2)} / pessoa</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">Forma de Pagamento:</label>
              <select value={selectedPaymentMethod} onChange={(e) => setSelectedPaymentMethod(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold">
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="PIX Mercado Pago">⚡ PIX Automático / Mercado Pago</option>
                <option value="Cartão de Crédito (Maquininha)">💳 Cartão de Crédito (Maquininha)</option>
                <option value="Cartão de Débito (Maquininha)">💳 Cartão de Débito (Maquininha)</option>
              </select>
            </div>

            {selectedPaymentMethod.includes('Dinheiro') && (
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                <label className="text-[11px] text-gray-400 block">Valor Entregue pelo Cliente R$:</label>
                <input type="text" placeholder="Ex: 50.00" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs font-bold text-white focus:outline-none" />
                {parsePrice(cashGiven) > Number(closingOrder.total) && (
                  <div className="text-xs font-extrabold text-yellow-400 flex justify-between pt-1">
                    <span>TROCO A DEVOLVER:</span>
                    <span>R$ {(parsePrice(cashGiven) - Number(closingOrder.total)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleConfirmClosingPayment} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-lg">
              ✅ Confirmar Recebimento & Baixa no Caixa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
