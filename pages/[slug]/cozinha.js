import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

const parsePrice = (val) => {
  if (!val) return 0;
  const clean = String(val).replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Função auxiliar para converter valor em Reais para Extenso
const valorPorExtenso = (v) => {
  const valor = parsePrice(v);
  if (valor === 0) return 'Zero Reais';

  const unidades = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Quatorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove'];
  const dezenas = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
  const centenas = ['', 'Cento', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos'];

  const inteiros = Math.floor(valor);
  const centavos = Math.round((valor - inteiros) * 100);

  const getExtensoNumero = (num) => {
    if (num === 0) return '';
    if (num === 100) return 'Cem';
    if (num < 20) return unidades[num];
    if (num < 100) {
      const d = Math.floor(num / 10);
      const u = num % 10;
      return dezenas[d] + (u > 0 ? ` e ${unidades[u]}` : '');
    }
    const c = Math.floor(num / 100);
    const resto = num % 100;
    return centenas[c] + (resto > 0 ? ` e ${getExtensoNumero(resto)}` : '');
  };

  let str = '';
  if (inteiros > 0) {
    str += `${getExtensoNumero(inteiros)} ${inteiros === 1 ? 'Real' : 'Reais'}`;
  }
  if (centavos > 0) {
    if (inteiros > 0) str += ' e ';
    str += `${getExtensoNumero(centavos)} ${centavos === 1 ? 'Centavo' : 'Centavos'}`;
  }

  return str;
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
  const [filterType, setFilterType] = useState('ALL');

  // IMPRESSÃO
  const [printConfig, setPrintConfig] = useState(null);

  // ÁUDIO E AUTOMAÇÃO
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const audioCtxRef = useRef(null);
  const prevOrdersCountRef = useRef(0);
  const autoPrintRef = useRef(autoPrintEnabled);
  const soundEnabledRef = useRef(soundEnabled);

  // EDIÇÃO DE PEDIDO ADMIN & AUTENTICAÇÃO
  const [editingOrder, setEditingOrder] = useState(null);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminEditAuth, setIsAdminEditAuth] = useState(false);
  const [orderToEditPendingAuth, setOrderToEditPendingAuth] = useState(null);
  const [editCartItems, setEditCartItems] = useState([]);
  const [selectedProdForEdit, setSelectedProdForEdit] = useState(null);

  // ESTADOS DO PDV
  const [pdvOrderType, setPdvOrderType] = useState('balcao');
  const [pdvTableNum, setPdvTableNum] = useState('');
  const [pdvCustomerName, setPdvCustomerName] = useState('');
  const [pdvCustomerPhone, setPdvCustomerPhone] = useState('');
  const [pdvAddress, setPdvAddress] = useState('');
  const [pdvNeighborhood, setPdvNeighborhood] = useState('');
  const [pdvDeliveryFee, setPdvDeliveryFee] = useState(0);
  const [pdvCart, setPdvCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // MODAL DE ADIÇÃO DE ITEM AO PDV COM BUSCA & REGRAS DE CARDÁPIO
  const [selectedProdForPdv, setSelectedProdForPdv] = useState(null);
  const [selectedAddonsForProd, setSelectedAddonsForProd] = useState([]);
  const [selectedBorderForProd, setSelectedBorderForProd] = useState('');
  const [prodObservation, setProdObservation] = useState('');
  const [prodQuantity, setProdQuantity] = useState(1);
  const [addonSearch, setAddonSearch] = useState('');

  // MODAL FECHAMENTO DE CAIXA / DIVISÃO POR ITENS & PESSOAS / TROCO
  const [closingOrder, setClosingOrder] = useState(null);
  const [selectedItemIndexesToPay, setSelectedItemIndexesToPay] = useState([]);
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
      .channel(`schema-db-changes-pdv-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          if (soundEnabledRef.current) playBeepSound();
          if (autoPrintRef.current) handlePrintOrder(payload.new, 'kitchen');
        }
        fetchOrders(tenantId, true);
      })
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
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      alert("Erro ao atualizar status no banco: " + error.message);
      if (tenant) fetchOrders(tenant.id);
    }
  };

  const archiveOrder = async (orderId) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, archived: true, status: 'concluido' } : o));
    const { error } = await supabase.from('orders').update({ archived: true, status: 'concluido' }).eq('id', orderId);
    if (error) {
      alert("Erro ao arquivar pedido: " + error.message);
      if (tenant) fetchOrders(tenant.id);
    }
  };

  const clearAllArchived = async () => {
    if (confirm("Deseja apagar definitivamente todos os pedidos arquivados da tela?")) {
      const { error } = await supabase.from('orders').delete().eq('tenant_id', tenant.id).eq('archived', true);
      if (error) alert("Erro ao limpar arquivados: " + error.message);
      if (tenant) fetchOrders(tenant.id);
    }
  };

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

  const handleStartEditOrder = (order) => {
    if (isAdminEditAuth) {
      openEditModal(order);
    } else {
      setOrderToEditPendingAuth(order);
      setAdminPasswordInput('');
      setShowAdminAuthModal(true);
    }
  };

  const handleAdminAuthSubmit = (e) => {
    e.preventDefault();
    if (tenant && (adminPasswordInput === tenant.admin_password || adminPasswordInput === 'master123')) {
      setIsAdminEditAuth(true);
      setShowAdminAuthModal(false);
      if (orderToEditPendingAuth) {
        openEditModal(orderToEditPendingAuth);
      }
    } else {
      alert("Senha de Administrador incorreta!");
    }
  };

  const openEditModal = (order) => {
    setEditingOrder(order);
    setEditCartItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
  };

  const handleRemoveEditCartItem = (index) => {
    const updated = [...editCartItems];
    updated.splice(index, 1);
    setEditCartItems(updated);
  };

  const handleAddProdToEditCart = (prod) => {
    const cartItem = {
      id: prod.id,
      name: prod.name,
      price: parsePrice(prod.price),
      quantity: 1,
      details: '',
      selectedAddons: [],
      observation: ''
    };
    setEditCartItems([...editCartItems, cartItem]);
    setSelectedProdForEdit(null);
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;

    const newSubtotal = editCartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0);
    const deliveryFee = Number(editingOrder.delivery_fee || 0);
    const newTotal = newSubtotal + deliveryFee;

    const previousPaid = Number(editingOrder.paid_amount || (editingOrder.is_paid ? editingOrder.total : 0));
    const openBalance = Math.max(0, newTotal - previousPaid);
    const isFullyPaid = openBalance === 0 && previousPaid > 0;

    const payload = {
      items: editCartItems,
      subtotal: newSubtotal,
      total: newTotal,
      paid_amount: previousPaid,
      is_paid: isFullyPaid
    };

    setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...payload } : o));

    const { error } = await supabase.from('orders').update(payload).eq('id', editingOrder.id);
    if (error) {
      alert("Erro ao atualizar pedido: " + error.message);
      if (tenant) fetchOrders(tenant.id);
      return;
    }

    alert(openBalance > 0
      ? `Pedido atualizado! Novo valor total R$ ${newTotal.toFixed(2)}. Valor em aberto a cobrar: R$ ${openBalance.toFixed(2)}.`
      : "Pedido atualizado com sucesso!");

    setEditingOrder(null);
    if (tenant) fetchOrders(tenant.id);
  };

  // REGRAS DO CARDÁPIO DE PIZZAS / PRODUTOS
  const getMaxFlavorsForProduct = (prod) => {
    if (!prod) return 1;
    if (prod.max_flavors) return Number(prod.max_flavors);
    if (prod.flavor_limit) return Number(prod.flavor_limit);

    const desc = (prod.description || '' ) + ' ' + (prod.name || '');
    const match = desc.match(/(?:sabores|quantidade de sabores):\s*0*(\d+)/i);
    if (match && match[1]) return parseInt(match[1], 10);

    return 99; // Se não for pizza com limite, permite múltiplos adicionais livres
  };

  const isPizzaProduct = (prod) => {
    if (!prod) return false;
    const catName = categories.find(c => c.id === prod.category_id)?.name || '';
    const text = (prod.name + ' ' + (prod.description || '') + ' ' + catName).toLowerCase();
    return text.includes('pizza') || prod.max_flavors > 0 || prod.flavor_limit > 0;
  };

  const handleOpenProdModal = (prod) => {
    setSelectedProdForPdv(prod);
    setSelectedAddonsForProd([]);
    setSelectedBorderForProd('');
    setProdObservation('');
    setProdQuantity(1);
    setAddonSearch('');
  };

  const handleToggleAddon = (addon) => {
    if (!selectedProdForPdv) return;
    const isSelected = selectedAddonsForProd.some(a => a.id === addon.id);
    const isPizza = isPizzaProduct(selectedProdForPdv);
    const maxFlavors = getMaxFlavorsForProduct(selectedProdForPdv);

    if (isSelected) {
      setSelectedAddonsForProd(selectedAddonsForProd.filter(a => a.id !== addon.id));
    } else {
      if (isPizza && maxFlavors < 99 && selectedAddonsForProd.length >= maxFlavors) {
        alert(`Este tamanho (${selectedProdForPdv.name}) permite no máximo ${maxFlavors} sabor(es)!`);
        return;
      }
      setSelectedAddonsForProd([...selectedAddonsForProd, addon]);
    }
  };

  const handleAddProdToCart = () => {
    if (!selectedProdForPdv) return;

    const isPizza = isPizzaProduct(selectedProdForPdv);
    const maxFlavors = getMaxFlavorsForProduct(selectedProdForPdv);

    if (isPizza && maxFlavors < 99 && selectedAddonsForProd.length === 0) {
      return alert("Por favor, selecione pelo menos 1 sabor para a pizza!");
    }

    const addonsTotal = selectedAddonsForProd.reduce((acc, a) => acc + parsePrice(a.price), 0);
    let borderPrice = 0;
    if (selectedBorderForProd && selectedBorderForProd.includes(':')) {
      borderPrice = parsePrice(selectedBorderForProd.split(':')[1]);
    }

    const unitPrice = parsePrice(selectedProdForPdv.price) + addonsTotal + borderPrice;
    
    // FORMATAÇÃO IGUAL AO CARDÁPIO (1/2, 1/3, 1/4)
    let detailsFormatted = '';
    const addonCount = selectedAddonsForProd.length;

    if (isPizza && addonCount > 0 && maxFlavors < 99) {
      const fractionStr = addonCount > 1 ? `1/${addonCount} ` : '';
      detailsFormatted = selectedAddonsForProd.map(a => `${fractionStr}${a.name}`).join(', ');
    } else if (addonCount > 0) {
      detailsFormatted = selectedAddonsForProd.map(a => a.name).join(', ');
    }

    if (selectedBorderForProd) {
      const borderName = selectedBorderForProd.split(':')[0];
      detailsFormatted += detailsFormatted ? ` | Borda: ${borderName}` : `Borda: ${borderName}`;
    }

    const cartItem = {
      id: selectedProdForPdv.id,
      name: selectedProdForPdv.name,
      price: unitPrice,
      quantity: prodQuantity,
      details: detailsFormatted,
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
      paid_amount: 0,
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
    if (tenant) fetchOrders(tenant.id);
    setActiveTab('kds');
  };

  const handleOpenClosingModal = (order) => {
    setClosingOrder(order);
    setSplitPeopleCount(1);
    if (order.items && Array.isArray(order.items)) {
      setSelectedItemIndexesToPay(order.items.map((_, idx) => idx));
    } else {
      setSelectedItemIndexesToPay([]);
    }
    setCashGiven('');
    setSelectedPaymentMethod(order.payment_method || 'Dinheiro');
  };

  const toggleItemToPay = (index) => {
    if (selectedItemIndexesToPay.includes(index)) {
      setSelectedItemIndexesToPay(selectedItemIndexesToPay.filter(i => i !== index));
    } else {
      setSelectedItemIndexesToPay([...selectedItemIndexesToPay, index]);
    }
  };

  const handleConfirmClosingPayment = async () => {
    if (!closingOrder) return;
    if (selectedItemIndexesToPay.length === 0) return alert("Selecione pelo menos um item para efetuar o pagamento!");

    const allItems = closingOrder.items || [];
    const isPayingAll = selectedItemIndexesToPay.length === allItems.length;
    const currentPaid = Number(closingOrder.paid_amount || 0);

    if (isPayingAll) {
      const payload = {
        is_paid: true,
        paid_amount: Number(closingOrder.total || 0),
        payment_method: selectedPaymentMethod,
        archived: true,
        status: 'concluido'
      };

      setOrders(prev => prev.map(o => o.id === closingOrder.id ? { ...o, ...payload } : o));

      const { error } = await supabase.from('orders').update(payload).eq('id', closingOrder.id);

      if (error) {
        alert("Erro ao encerrar pedido no banco: " + error.message);
        if (tenant) fetchOrders(tenant.id);
        return;
      }

      alert("Pedido totalmente quitado e encerrado!");
    } else {
      const remainingItems = allItems.filter((_, idx) => !selectedItemIndexesToPay.includes(idx));
      const paidItems = allItems.filter((_, idx) => selectedItemIndexesToPay.includes(idx));

      const paidTotalNow = paidItems.reduce((acc, it) => acc + (parsePrice(it.price) * it.quantity), 0);
      const newSubtotal = remainingItems.reduce((acc, it) => acc + (parsePrice(it.price) * it.quantity), 0);
      const deliveryFee = Number(closingOrder.delivery_fee || 0);
      const newTotal = newSubtotal + deliveryFee;

      const payload = {
        items: remainingItems,
        subtotal: newSubtotal,
        total: newTotal,
        paid_amount: currentPaid + paidTotalNow,
        notes: closingOrder.notes 
          ? `${closingOrder.notes} (Pago parcial R$ ${paidTotalNow.toFixed(2)})` 
          : `Pago parcial R$ ${paidTotalNow.toFixed(2)}`
      };

      setOrders(prev => prev.map(o => o.id === closingOrder.id ? { ...o, ...payload } : o));

      const { error } = await supabase.from('orders').update(payload).eq('id', closingOrder.id);

      if (error) {
        alert("Erro ao aplicar pagamento parcial: " + error.message);
        if (tenant) fetchOrders(tenant.id);
        return;
      }

      alert(`Recebido R$ ${paidTotalNow.toFixed(2)}! O pedido/mesa continua ABERTO com o saldo restante de R$ ${newTotal.toFixed(2)}.`);
    }

    setClosingOrder(null);
    if (tenant) fetchOrders(tenant.id);
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

  if (loading) return <div className="p-4 text-white text-center font-sans">Carregando Painel...</div>;
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

  const tableOrders = orders.filter(o => getOrderCategory(o) === 'MESA' && !o.archived && o.status !== 'concluido');
  const archivedOrders = orders.filter(o => o.archived === true || o.status === 'arquivado' || o.status === 'concluido');

  const filteredGlobalAddons = globalAddons.filter(a => 
    a.name.toLowerCase().includes(addonSearch.toLowerCase())
  );

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

    const paidAmount = Number(order.paid_amount || (order.is_paid ? order.total : 0));
    const totalAmount = Number(order.total || 0);
    const openBalance = Math.max(0, totalAmount - paidAmount);

    return (
      <div key={order.id} className={`bg-gray-900 border-2 ${
        isTable ? 'border-orange-500 bg-orange-950/20' : 
        isDelayed ? 'border-red-500 animate-pulse' : 'border-gray-800'
      } p-4 rounded-2xl space-y-3 shadow-2xl relative`}>

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

        {isDelivery && (
          <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-200 font-bold">📍 {fullAddr}</p>
                {order.neighborhood && <p className="text-gray-400"><b>Bairro:</b> {order.neighborhood}</p>}
                {order.reference && <p className="text-orange-300 italic"><b>Ref:</b> {order.reference}</p>}
              </div>

              <a href={mapsUrl} target="_blank" rel="noreferrer" className="bg-green-600/20 hover:bg-green-600/40 text-green-400 font-bold border border-green-500/30 px-2.5 py-1.5 rounded-lg text-[10px] shrink-0 ml-2">
                🗺️ Maps
              </a>
            </div>
          </div>
        )}

        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold text-[11px]">Pagamento:</span>
            {openBalance === 0 && (order.is_paid || isCardOnline || paidAmount >= totalAmount) ? (
              <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg font-extrabold text-[11px]">
                🟢 PAGO (R$ {totalAmount.toFixed(2)})
              </span>
            ) : paidAmount > 0 ? (
              <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-2.5 py-1 rounded-lg font-extrabold text-[11px]">
                🟡 PARCIAL (R$ {paidAmount.toFixed(2)} PAGO)
              </span>
            ) : (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-extrabold text-[11px]">
                🔴 PENDENTE
              </span>
            )}
          </div>

          {openBalance > 0 && paidAmount > 0 && (
            <div className="bg-orange-500/20 border border-orange-500/50 p-1.5 rounded-lg text-center mt-1">
              <span className="text-orange-300 text-[11px] font-black uppercase tracking-wider block">
                ⚠️ Valor em Aberto: R$ {openBalance.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-b border-gray-800 py-2.5">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Itens para Preparo:</span>

          {order.items && Array.isArray(order.items) && order.items.map((it, idx) => {
            const hasAddons = it.selectedAddons && it.selectedAddons.length > 0;
            const addonNamesStr = hasAddons ? it.selectedAddons.map(a => a.name).join(', ') : '';
            const detailsIsDuplicate = it.details && addonNamesStr && it.details.includes(addonNamesStr);

            return (
              <div key={idx} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 space-y-1">
                <div className="flex items-start justify-between">
                  <span className="font-black text-sm text-white flex items-center flex-wrap gap-1">
                    <span className="text-orange-400 bg-orange-500/20 border border-orange-500/40 px-1.5 py-0.5 rounded-md mr-1">{it.quantity}x</span> 
                    {it.name}
                    {it.is_combo && <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-bold">COMBO</span>}
                  </span>
                  <span className="text-xs font-bold text-green-400">R$ {(parsePrice(it.price) * it.quantity).toFixed(2)}</span>
                </div>

                {it.is_combo && it.comboSteps && it.comboSteps.length > 0 ? (
                  <div className="space-y-0.5 mt-1 border-l-2 border-purple-500/50 pl-2">
                    {it.comboSteps.map((step, sIdx) => (
                      <p key={sIdx} className="text-xs text-purple-300 font-bold">
                        <span className="text-gray-400 font-normal">{step.title}:</span> {step.items?.map(i => i.name).join(', ')}
                      </p>
                    ))}
                  </div>
                ) : (
                  <>
                    {it.details && !detailsIsDuplicate && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold text-xs p-1.5 rounded-lg mt-1">
                        🍕 {it.details}
                      </div>
                    )}

                    {hasAddons && !it.details && (
                      <p className="text-xs text-purple-300 font-bold pl-1 mt-0.5">
                        ➕ {addonNamesStr}
                      </p>
                    )}
                  </>
                )}

                {it.selectedBorder && it.selectedBorder.name && it.selectedBorder.name !== 'Sem Borda' && (
                  <p className="text-xs text-gray-300 font-semibold pl-1">
                    🫓 Borda: {it.selectedBorder.name}
                  </p>
                )}

                {it.observation && (
                  <div className="bg-red-500/20 border border-red-500/40 text-red-300 font-extrabold text-xs p-1.5 rounded-lg mt-1">
                    ⚠️ OBS: "{it.observation}"
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center font-black text-sm pt-1">
          <span className="text-gray-400">TOTAL PEDIDO:</span>
          <span className="text-green-400 text-base">R$ {totalAmount.toFixed(2)}</span>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex space-x-1.5 text-xs font-bold">
            {(!order.status || order.status === 'recebido' || order.status === 'pendente' || order.status === 'novo') && (
              <button onClick={() => { updateOrderStatus(order.id, 'em_producao'); sendWhatsAppStatus(order, 'producao'); }} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-white font-extrabold text-xs">
                👨‍🍳 Produção ➔
              </button>
            )}

            {(order.status === 'em_producao' || order.status === 'em_preparo') && (
              <button onClick={() => { updateOrderStatus(order.id, 'saiu_entrega'); sendWhatsAppStatus(order, 'entrega'); }} className="flex-1 bg-purple-600 hover:bg-purple-700 py-2.5 rounded-xl text-white font-extrabold text-xs">
                {isTable ? '🪑 Servir ➔' : isDelivery ? '🛵 Entrega ➔' : '🛍️ Pronto ➔'}
              </button>
            )}

            <button onClick={() => handleOpenClosingModal(order)} className="flex-1 bg-green-600 hover:bg-green-700 py-2.5 rounded-xl text-white font-extrabold text-xs">
              💰 Cobrar
            </button>

            <button onClick={() => handleStartEditOrder(order)} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-2.5 rounded-xl font-bold" title="Editar Pedido (Admin)">
              ✏️
            </button>

            <button onClick={() => archiveOrder(order.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2.5 rounded-xl border border-gray-700 font-bold" title="Arquivar">
              📦
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handlePrintOrder(order, 'kitchen')} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 py-2 rounded-xl text-[11px] font-bold text-gray-300">
              🖨️ Via Cozinha
            </button>
            <button onClick={() => handlePrintOrder(order, 'receipt')} className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 py-2 rounded-xl text-[11px] font-bold text-orange-300">
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
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
          }
          body * { 
            visibility: hidden !important; 
          }
          #print-area, #print-area * { 
            visibility: visible !important; 
          }
          #print-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 78mm !important; 
            padding: 4px !important; 
            color: #000 !important; 
            background: #fff !important; 
            font-family: Arial, sans-serif !important; 
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
          .no-print { 
            display: none !important; 
          }
        }
      `}</style>

      {/* ÁREA DE IMPRESSÃO */}
      {printConfig?.order && (
        <div id="print-area" className="hidden print:block text-black">
          {printConfig.mode === 'kitchen' ? (
            <div className="font-mono">
              <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <h2 className="font-extrabold text-sm uppercase">{tenant.name}</h2>
                <p className="text-[10px] font-bold mt-0.5">*** VIA DE PRODUÇÃO COZINHA ***</p>
                <p className="text-[12px] font-black mt-1">PEDIDO {getOrderDisplayNumber(printConfig.order)}</p>
                <p className="text-[9px] mt-0.5">{new Date(printConfig.order.created_at || Date.now()).toLocaleString('pt-BR')}</p>
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px] space-y-0.5">
                <p><b>CLIENTE:</b> {printConfig.order.customer_name}</p>
                <p><b>LOCAL:</b> {printConfig.order.customer_address}</p>
                {printConfig.order.waiter_name && <p><b>GARÇOM:</b> {printConfig.order.waiter_name}</p>}
                {printConfig.order.customer_phone && <p><b>TEL:</b> {printConfig.order.customer_phone}</p>}
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px]">
                <p className="font-bold border-b border-black pb-1 mb-1">ITENS DO PEDIDO:</p>
                {printConfig.order.items?.map((it, idx) => (
                  <div key={idx} className="mb-1.5">
                    <div className="flex justify-between font-bold">
                      <span>{it.quantity}x {it.name}</span>
                    </div>
                    {it.details && <p className="pl-2 text-[9px]">↳ {it.details}</p>}
                    {it.observation && <p className="pl-2 text-[9px] font-bold">↳ OBS: {it.observation}</p>}
                  </div>
                ))}
              </div>

              {printConfig.order.notes && (
                <div className="text-[10px]">
                  <p><b>OBS. PEDIDO:</b> {printConfig.order.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-black p-2 font-sans text-black">
              <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
                <div>
                  <h2 className="font-black text-sm uppercase tracking-wide">{tenant.name}</h2>
                  <p className="text-[9px] font-bold">Lanchonete e Alimentos</p>
                  {tenant.phone && <p className="text-[8px]">Tel: {tenant.phone}</p>}
                </div>
                <div className="text-right bg-gray-200 border border-black p-1 rounded">
                  <span className="block text-[8px] font-bold uppercase">RECIBO Nº {getOrderDisplayNumber(printConfig.order)}</span>
                  <span className="block text-xs font-black">R$ {Number(printConfig.order.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[10px] space-y-1.5 leading-snug">
                <p className="border-b border-dotted border-gray-600 pb-0.5">
                  <b>Recebi(emos) de:</b> {printConfig.order.customer_name || 'Cliente Balcão'}
                </p>

                {(printConfig.order.customer_phone || printConfig.order.customer_address) && (
                  <p className="border-b border-dotted border-gray-600 pb-0.5">
                    <b>Contato/End:</b> {[printConfig.order.customer_phone, printConfig.order.customer_address].filter(Boolean).join(' - ')}
                  </p>
                )}

                <p className="border-b border-dotted border-gray-600 pb-0.5">
                  <b>A quantia de:</b> {valorPorExtenso(printConfig.order.total)}
                </p>

                <div className="border-b border-dotted border-gray-600 pb-1">
                  <b>Referente a:</b> Consumo de lanchonete/pedidos:
                  <ul className="pl-2 mt-0.5 space-y-0.5 text-[9px]">
                    {printConfig.order.items?.map((it, idx) => (
                      <li key={idx}>
                        • {it.quantity}x {it.name} {it.details ? `(${it.details})` : ''} - R$ {(it.price * it.quantity).toFixed(2)}
                      </li>
                    ))}
                    {Number(printConfig.order.delivery_fee) > 0 && (
                      <li>• 1x Taxa de Entrega - R$ {Number(printConfig.order.delivery_fee).toFixed(2)}</li>
                    )}
                  </ul>
                </div>

                <p className="border-b border-dotted border-gray-600 pb-0.5">
                  <b>Forma de Pagamento:</b> {printConfig.order.payment_method || 'Dinheiro / Outro'}
                </p>
              </div>

              <div className="mt-4 pt-2 text-center text-[9px] space-y-3">
                <p>Data: {new Date(printConfig.order.created_at || Date.now()).toLocaleDateString('pt-BR')}</p>

                <div className="pt-4 border-t border-black w-3/4 mx-auto">
                  <p className="font-bold text-[8px] uppercase">{tenant.name}</p>
                  <p className="text-[7px]">Assinatura / Carimbo do Emissor</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print flex-wrap gap-3">
        <div>
          <h1 className="font-extrabold text-xl sm:text-2xl text-orange-500">🖥️ PDV & KDS Operacional — {tenant.name}</h1>
          <p className="text-xs text-gray-400">Painel Integrado de Vendas e Produção</p>
        </div>

        <div className="flex space-x-2 items-center flex-wrap gap-2">
          <button onClick={enableAudioAlert} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${soundEnabled ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse'}`}>
            {soundEnabled ? '🔊 Som Ativo' : '🔔 Ativar Som'}
          </button>
          <button onClick={() => setAutoPrintEnabled(!autoPrintEnabled)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${autoPrintEnabled ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-gray-800 text-gray-400'}`}>
            {autoPrintEnabled ? '🖨️ Auto Print: ON' : '🖨️ Auto Print: OFF'}
          </button>
          <button onClick={() => fetchOrders(tenant.id)} className="bg-orange-500 hover:bg-orange-600 px-3.5 py-2 rounded-xl text-xs font-bold">🔄</button>
        </div>
      </header>

      {/* NAV ABAS */}
      <div className="flex space-x-2 bg-gray-900 p-1.5 rounded-2xl border border-gray-800 mb-6 text-xs font-bold overflow-x-auto no-print">
        <button onClick={() => setActiveTab('kds')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition ${activeTab === 'kds' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>👨‍🍳 KDS Cozinha ({activeOrders.length})</button>
        <button onClick={() => setActiveTab('pdv')} className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition ${activeTab === 'pdv' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>➕ PDV Novo Pedido</button>
        <button onClick={() => setActiveTab('mesas')} className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl transition ${activeTab === 'mesas' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🪑 Mesas ({tableOrders.length})</button>
        <button onClick={() => setActiveTab('arquivados')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition ${activeTab === 'arquivados' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>📦 Arquivados ({archivedOrders.length})</button>
      </div>

      {/* ABA 1: KDS COZINHA */}
      {activeTab === 'kds' && (
        <div className="space-y-6">
          <div className="flex space-x-2 no-print overflow-x-auto text-xs font-bold">
            <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-xl border ${filterType === 'ALL' ? 'bg-orange-500 border-orange-500' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>Todos</button>
            <button onClick={() => setFilterType('DELIVERY')} className={`px-4 py-2 rounded-xl border ${filterType === 'DELIVERY' ? 'bg-purple-600 border-purple-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛵 Delivery</button>
            <button onClick={() => setFilterType('BALCAO')} className={`px-4 py-2 rounded-xl border ${filterType === 'BALCAO' ? 'bg-blue-600 border-blue-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🛍️ Balcão</button>
            <button onClick={() => setFilterType('MESA')} className={`px-4 py-2 rounded-xl border ${filterType === 'MESA' ? 'bg-orange-600 border-orange-600' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>🪑 Mesas</button>
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
                    {columnOrders.length === 0 ? <p className="text-xs text-gray-500 text-center py-6">Sem pedidos</p> : columnOrders.map(order => renderOrderCard(order))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: PDV */}
      {activeTab === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none text-xs font-bold">
              <button 
                onClick={() => setSelectedCategory('ALL')} 
                className={`px-4 py-2.5 rounded-xl border whitespace-nowrap transition shadow-sm ${
                  selectedCategory === 'ALL' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                🍽️ Todos os Itens
              </button>
              {categories.map(c => (
                <button 
                  key={c.id} 
                  onClick={() => setSelectedCategory(c.id)} 
                  className={`px-4 py-2.5 rounded-xl border whitespace-nowrap transition shadow-sm ${
                    selectedCategory === c.id ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {products.filter(p => selectedCategory === 'ALL' || p.category_id === selectedCategory).map(prod => (
                <div 
                  key={prod.id} 
                  onClick={() => handleOpenProdModal(prod)} 
                  className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 hover:border-orange-500/60 cursor-pointer transition flex flex-col justify-between space-y-3 group shadow-lg"
                >
                  <div className="flex space-x-3 items-start">
                    {prod.image && (
                      <img src={prod.image} alt={prod.name} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-800 bg-gray-800" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-white group-hover:text-orange-400 transition truncate">{prod.name}</h4>
                      <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{prod.description || 'Sem descrição'}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-800/60">
                    <span className="font-black text-sm text-green-400">R$ {Number(prod.price).toFixed(2)}</span>
                    <span className="bg-orange-500/20 text-orange-300 group-hover:bg-orange-500 group-hover:text-white text-[10px] font-extrabold px-2.5 py-1 rounded-xl border border-orange-500/30 transition flex items-center space-x-1">
                      <span>➕ Lançar</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4 h-fit shadow-xl">
            <h3 className="font-bold text-sm text-orange-400 border-b border-gray-800 pb-2">🛒 Detalhes do Pedido PDV</h3>

            <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
              <button onClick={() => setPdvOrderType('balcao')} className={`py-2 rounded-xl border transition ${pdvOrderType === 'balcao' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>🛍️ Balcão</button>
              <button onClick={() => setPdvOrderType('mesa')} className={`py-2 rounded-xl border transition ${pdvOrderType === 'mesa' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>🪑 Mesa</button>
              <button onClick={() => setPdvOrderType('delivery')} className={`py-2 rounded-xl border transition ${pdvOrderType === 'delivery' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>🛵 Delivery</button>
            </div>

            {pdvOrderType === 'mesa' && (
              <input type="text" placeholder="Número da Mesa (Ex: 05)" value={pdvTableNum} onChange={(e) => setPdvTableNum(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-orange-500" />
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
                    <option value="">Selecione Bairro...</option>
                    {neighborhoods.map(n => <option key={n.id} value={n.name}>{n.name} (+R${Number(n.fee).toFixed(2)})</option>)}
                  </select>
                  <input type="number" placeholder="Taxa R$" value={pdvDeliveryFee} onChange={(e) => setPdvDeliveryFee(e.target.value)} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none" />
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto border-t border-b border-gray-800 py-3">
              {pdvCart.length === 0 ? <p className="text-xs text-gray-500 text-center py-4">Nenhum item no carrinho</p> : pdvCart.map((item, idx) => (
                <div key={idx} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-white">{item.quantity}x {item.name}</span>
                    {item.details && <p className="text-[10px] text-orange-300 font-bold">{item.details}</p>}
                    <span className="text-green-400 font-bold block">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <button onClick={() => handleRemovePdvCartItem(idx)} className="text-red-400 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition">🗑</button>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-black text-sm text-green-400 pt-1 border-t border-gray-800">
                <span>TOTAL PEDIDO:</span>
                <span>R$ {(pdvCart.reduce((a, b) => a + (b.price * b.quantity), 0) + (pdvOrderType === 'delivery' ? Number(pdvDeliveryFee) : 0)).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleFinalizePdvOrder} className="w-full bg-green-600 hover:bg-green-700 font-extrabold py-3.5 rounded-xl text-xs text-white shadow-lg transition">
              🚀 Confirmar e Lançar Pedido
            </button>
          </div>
        </div>
      )}

      {/* ABA 3: GESTÃO DE MESAS */}
      {activeTab === 'mesas' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-orange-400">🪑 Mesas Abertas ({tableOrders.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tableOrders.length === 0 ? <p className="text-xs text-gray-500 py-6">Nenhuma mesa aberta.</p> : tableOrders.map(order => (
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
                  <button onClick={() => handleOpenClosingModal(order)} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl text-xs">
                    💰 Fechar / Cobrar Parcial
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
              <h3 className="font-bold text-sm text-gray-200">📦 Histórico de Pedidos Arquivados / Concluídos</h3>
              <p className="text-xs text-gray-400">Total: {archivedOrders.length} pedidos.</p>
            </div>
            {archivedOrders.length > 0 && (
              <button onClick={clearAllArchived} className="bg-red-600/20 text-red-400 font-bold px-4 py-2 rounded-xl text-xs border border-red-500/30">
                🧹 Limpar Arquivados
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedOrders.map(order => renderOrderCard(order))}
          </div>
        </div>
      )}

      {/* MODAL SENHA ADMIN */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleAdminAuthSubmit} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-4">
            <h3 className="font-bold text-sm text-blue-400">🔑 Autenticação de Administrador</h3>
            <p className="text-xs text-gray-300">Digite a senha administrativa para editar este pedido:</p>
            <input 
              type="password" 
              placeholder="Senha de admin..." 
              value={adminPasswordInput} 
              onChange={(e) => setAdminPasswordInput(e.target.value)} 
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-xs text-white focus:outline-none font-bold"
            />
            <div className="flex space-x-2">
              <button type="button" onClick={() => setShowAdminAuthModal(false)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-xs font-bold text-white">Acessar 🔓</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-lg rounded-2xl p-5 border border-blue-500/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div>
                <h3 className="font-bold text-sm text-blue-400">✏️ Editar Pedido {getOrderDisplayNumber(editingOrder)}</h3>
                <p className="text-[10px] text-gray-400">Cliente: {editingOrder.customer_name}</p>
              </div>
              <button onClick={() => setEditingOrder(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Adicionar item ao pedido:</label>
              <div className="flex space-x-2">
                <select 
                  onChange={(e) => {
                    const found = products.find(p => p.id === parseInt(e.target.value));
                    setSelectedProdForEdit(found || null);
                  }} 
                  className="flex-1 bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - R$ {Number(p.price).toFixed(2)}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => selectedProdForEdit && handleAddProdToEditCart(selectedProdForEdit)} 
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl text-xs font-bold text-white shrink-0"
                >
                  ➕ Adicionar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-800 rounded-xl p-2 bg-gray-950">
              {editCartItems.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Pedido sem itens.</p>
              ) : (
                editCartItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-gray-800 bg-gray-900 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{item.quantity}x {item.name}</span>
                      <span className="text-green-400 font-bold block">R$ {(parsePrice(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveEditCartItem(idx)} className="text-red-400 font-bold bg-red-500/10 p-2 rounded-lg">🗑</button>
                  </div>
                ))
              )}
            </div>

            {(() => {
              const newSubtotal = editCartItems.reduce((acc, item) => acc + (parsePrice(item.price) * item.quantity), 0);
              const deliveryFee = Number(editingOrder.delivery_fee || 0);
              const newTotal = newSubtotal + deliveryFee;

              const paidAmount = Number(editingOrder.paid_amount || (editingOrder.is_paid ? editingOrder.total : 0));
              const openBalance = Math.max(0, newTotal - paidAmount);

              return (
                <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Novo Valor Total:</span>
                    <span className="font-extrabold text-sm text-white">R$ {newTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-green-400">
                    <span>Valor Já Pago Anteriormente:</span>
                    <span className="font-extrabold">R$ {paidAmount.toFixed(2)}</span>
                  </div>

                  {openBalance > 0 ? (
                    <div className="bg-orange-500/20 border border-orange-500/50 p-2 rounded-xl flex justify-between items-center text-orange-300 font-black text-sm pt-1">
                      <span>⚠️ VALOR EM ABERTO:</span>
                      <span>R$ {openBalance.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="bg-green-500/20 border border-green-500/40 p-2 rounded-xl text-center text-green-400 font-extrabold text-xs">
                      ✅ Pedido Quitado / Sem Saldo em Aberto
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex space-x-2 pt-1">
              <button type="button" onClick={() => setEditingOrder(null)} className="w-1/2 bg-gray-800 py-3 rounded-xl text-xs font-bold">Cancelar</button>
              <button type="button" onClick={handleSaveEditedOrder} className="w-1/2 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl text-xs font-bold text-white shadow-lg">💾 Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADIÇÃO DE ITEM PDV IGUAL AO CARDÁPIO */}
      {selectedProdForPdv && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-lg rounded-2xl p-5 border border-orange-500/40 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div>
                <h3 className="font-extrabold text-base text-orange-400">{selectedProdForPdv.name}</h3>
                {selectedProdForPdv.description && (
                  <p className="text-[11px] text-gray-400 font-medium">{selectedProdForPdv.description}</p>
                )}
              </div>
              <button onClick={() => setSelectedProdForPdv(null)} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-lg text-gray-300 font-bold">Fechar</button>
            </div>

            {/* SELEÇÃO DE BORDA RECHEADA */}
            {selectedProdForPdv.borders_list && (
              <div className="space-y-1.5 bg-gray-950 p-3 rounded-xl border border-gray-800">
                <label className="text-xs font-bold text-gray-200 block">🫓 Escolha a Borda:</label>
                <select value={selectedBorderForProd} onChange={(e) => setSelectedBorderForProd(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500 font-bold">
                  <option value="">Sem borda especial</option>
                  {selectedProdForPdv.borders_list.split(',').map((b, idx) => (
                    <option key={idx} value={b.trim()}>{b.trim()}</option>
                  ))}
                </select>
              </div>
            )}

            {/* SELEÇÃO DE SABORES / ADICIONAIS COM LIMITE DO CARDÁPIO */}
            <div className="space-y-2">
              {(() => {
                const maxF = getMaxFlavorsForProduct(selectedProdForPdv);
                const isPizza = isPizzaProduct(selectedProdForPdv);

                return (
                  <div className="flex justify-between items-center bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                    <label className="text-xs font-bold text-gray-200">
                      {isPizza ? '🍕 Escolha os Sabores:' : '➕ Escolha os Adicionais:'}
                    </label>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                      selectedAddonsForProd.length === maxF && maxF < 99 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}>
                      {maxF < 99 ? `${selectedAddonsForProd.length} / ${maxF} selecionado(s)` : `${selectedAddonsForProd.length} selecionado(s)`}
                    </span>
                  </div>
                );
              })()}

              <input
                type="text"
                placeholder="🔍 Pesquisar sabor ou adicional (Ex: Calabresa, Frango...)"
                value={addonSearch}
                onChange={(e) => setAddonSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500 font-medium"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1.5 border border-gray-800 rounded-xl bg-gray-950">
                {filteredGlobalAddons.length === 0 ? (
                  <p className="text-xs text-gray-500 col-span-2 text-center py-6">Nenhum sabor ou adicional encontrado.</p>
                ) : (
                  filteredGlobalAddons.map(a => {
                    const isChecked = selectedAddonsForProd.some(item => item.id === a.id);
                    const addonPrice = parsePrice(a.price);

                    return (
                      <div
                        key={a.id}
                        onClick={() => handleToggleAddon(a)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked 
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-extrabold shadow-sm' 
                            : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="accent-orange-500 pointer-events-none"
                          />
                          <span className="truncate">{a.name}</span>
                        </div>
                        {addonPrice > 0 && (
                          <span className="text-[10px] text-green-400 font-bold shrink-0 ml-1">
                            +R${addonPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* OBSERVAÇÃO DO ITEM */}
            <input 
              type="text" 
              placeholder="📝 Observações do item (Ex: Tirar cebola, maionese à parte)" 
              value={prodObservation} 
              onChange={(e) => setProdObservation(e.target.value)} 
              className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500" 
            />

            {/* VALOR CALCULADO & QUANTIDADE */}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <div className="flex items-center space-x-2">
                <button onClick={() => setProdQuantity(Math.max(1, prodQuantity - 1))} className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg font-black text-red-400 border border-gray-700">-</button>
                <span className="font-extrabold text-sm text-white px-1">{prodQuantity}</span>
                <button onClick={() => setProdQuantity(prodQuantity + 1)} className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg font-black text-green-400 border border-gray-700">+</button>
              </div>

              <button onClick={handleAddProdToCart} className="bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition">
                Adicionar ao Pedido 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FECHAMENTO CAIXA */}
      {closingOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-green-500/40 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-green-400">💰 Fechamento / Divisão por Itens</h3>
              <button onClick={() => setClosingOrder(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1 text-xs">
              <div className="flex justify-between"><span>Pedido:</span><span className="font-bold">{getOrderDisplayNumber(closingOrder)}</span></div>
              <div className="flex justify-between"><span>Cliente/Mesa:</span><span className="font-bold">{closingOrder.customer_name}</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Selecione os itens que serão pagos AGORA:</label>

              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-800 rounded-xl p-2 bg-gray-950">
                {closingOrder.items?.map((item, idx) => {
                  const isSelected = selectedItemIndexesToPay.includes(idx);
                  const itemTotal = parsePrice(item.price) * item.quantity;

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleItemToPay(idx)}
                      className={`p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition ${
                        isSelected ? 'bg-green-500/20 border-green-500 text-white font-bold' : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-green-500" />
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                      <span className="text-green-400 font-bold">R$ {itemTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(() => {
              const selectedItems = closingOrder.items?.filter((_, idx) => selectedItemIndexesToPay.includes(idx)) || [];
              const selectedSum = selectedItems.reduce((acc, it) => acc + (parsePrice(it.price) * it.quantity), 0);
              const remainingSum = Number(closingOrder.total || 0) - selectedSum;
              const perPersonValue = selectedSum / splitPeopleCount;

              return (
                <div className="space-y-3">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                    <label className="text-xs font-bold text-gray-300 block">Dividir valor selecionado por quantas pessoas?</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={splitPeopleCount}
                        onChange={(e) => setSplitPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-gray-800 border border-gray-700 p-2 rounded-xl text-xs font-bold text-center text-white focus:outline-none focus:border-orange-500"
                      />
                      <span className="text-xs text-orange-400 font-extrabold">
                        ↳ R$ {perPersonValue.toFixed(2)} / pessoa
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-300 font-bold">
                      <span>Valor Total a Cobrar Agora:</span>
                      <span className="text-green-400 text-sm">R$ {selectedSum.toFixed(2)}</span>
                    </div>
                    {remainingSum > 0 && (
                      <div className="flex justify-between text-orange-400 text-[11px] font-bold">
                        <span>Restante que ficará em aberto:</span>
                        <span>R$ {remainingSum.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

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

                {(() => {
                  const selectedItems = closingOrder.items?.filter((_, idx) => selectedItemIndexesToPay.includes(idx)) || [];
                  const selectedSum = selectedItems.reduce((acc, it) => acc + (parsePrice(it.price) * it.quantity), 0);
                  const change = parsePrice(cashGiven) - selectedSum;

                  return change > 0 ? (
                    <div className="text-xs font-extrabold text-yellow-400 flex justify-between pt-1">
                      <span>TROCO A DEVOLVER:</span>
                      <span>R$ {change.toFixed(2)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <button onClick={handleConfirmClosingPayment} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-lg">
              ✅ Confirmar Recebimento do(s) Item(ns)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
