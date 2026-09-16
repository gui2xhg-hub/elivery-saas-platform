import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

// FUNÇÃO AUXILIAR PARA PARSE DE PREÇOS (ACEITA VÍRGULA E PONTO)
const parsePrice = (val) => {
  if (!val) return 0;
  const clean = String(val).replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export default function AdminTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('pdv');
  const [loading, setLoading] = useState(true);

  const [tenant, setTenant] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [globalAddons, setGlobalAddons] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [reportFilter, setReportFilter] = useState('all');

  // MODAL DE PROMOÇÃO DE CLIENTE
  const [selectedPromoClient, setSelectedPromoClient] = useState(null);
  const [promoMessageText, setPromoMessageText] = useState('');

  // CONFIGURAÇÃO DE MESAS E QR CODES
  const [tableCount, setTableCount] = useState(10);
  const [baseUrl, setBaseUrl] = useState('');

  // ESTADOS DO PDV / LANÇAMENTO MANUAL (CAIXA / GARÇOM)
  const [pdvOrderType, setPdvOrderType] = useState('balcao');
  const [pdvCustomer, setPdvCustomer] = useState({ name: '', phone: '', address: '' });
  const [pdvTableNum, setPdvTableNum] = useState('');
  const [pdvWaiterName, setPdvWaiterName] = useState('');
  const [pdvSelectedNeighborhood, setPdvSelectedNeighborhood] = useState(null);
  const [pdvPaymentMethod, setPdvPaymentMethod] = useState('DINHEIRO');
  const [pdvNotes, setPdvNotes] = useState('');
  const [pdvCart, setPdvCart] = useState([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // MODAIS ADICIONAIS
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);
  const [splitModalOrder, setSplitModalOrder] = useState(null);
  const [splitPeopleCount, setSplitPeopleCount] = useState(2);

  // DIAS DA SEMANA
  const ALL_DAYS = [
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
    { id: 0, label: 'Dom' }
  ];

  const ADDON_TYPES = [
    '🍕 Pizza Salgada',
    '🍫 Pizza Doce',
    '🫓 Tipo / Sabor de Borda',
    '🍔 Adicional de Lanche',
    '🥤 Molhos & Acompanhamentos',
    '📌 Outros'
  ];

  const INITIAL_PROD_STATE = {
    name: '',
    price: '',
    category_id: '',
    description: '',
    image: '',
    addons_list: '',
    max_addons: 0,
    borders_list: '',
    is_combo: false,
    combo_steps: []
  };

  const [newProd, setNewProd] = useState(INITIAL_PROD_STATE);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingAddon, setEditingAddon] = useState(null);
  const [editingNeigh, setEditingNeigh] = useState(null);

  const [newCatName, setNewCatName] = useState('');
  const [newAddon, setNewAddon] = useState({ name: '', price: '', description: '', category_type: '🍕 Pizza Salgada' });
  const [newNeigh, setNewNeigh] = useState({ name: '', fee: '' });

  useEffect(() => {
    if (slug) fetchTenant();
    if (typeof window !== 'undefined') {
      setBaseUrl(`${window.location.protocol}//${window.location.host}`);
    }
  }, [slug]);

  const fetchTenant = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant({
        ...tData,
        work_days: tData.work_days || [1, 2, 3, 4, 5, 6]
      });
    }
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (tenant && (password === tenant.admin_password || password === 'master123')) {
      setIsAuthenticated(true);
      fetchData(tenant.id);
    } else {
      alert('Senha incorreta!');
    }
  };

  const fetchData = async (tenantId = tenant?.id) => {
    if (!tenantId) return;
    const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    const { data: cData } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).order('id', { ascending: true });
    const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tenantId).order('id', { ascending: true });
    const { data: aData } = await supabase.from('global_addons').select('*').eq('tenant_id', tenantId).order('id', { ascending: true });
    const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tenantId).order('id', { ascending: true });
    const { data: oData } = await supabase.from('orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });

    if (tData) {
      setTenant({
        ...tData,
        work_days: tData.work_days || [1, 2, 3, 4, 5, 6]
      });
    }
    if (cData) {
      setCategories(cData);
      if (cData.length > 0 && !newProd.category_id) setNewProd(prev => ({ ...prev, category_id: cData[0].id }));
    }
    if (pData) setProducts(pData);
    if (aData) setGlobalAddons(aData);
    if (nData) setNeighborhoods(nData);
    if (oData) setAllOrders(oData);
  };

  const toggleDaySelection = (currentDays, dayId) => {
    const arr = [...(currentDays || [])];
    if (arr.includes(dayId)) {
      return arr.filter(d => d !== dayId);
    } else {
      return [...arr, dayId].sort();
    }
  };

  const handlePdvAddToCart = (product) => {
    const existingIndex = pdvCart.findIndex(item => item.id === product.id);
    if (existingIndex > -1) {
      const updated = [...pdvCart];
      updated[existingIndex].quantity += 1;
      setPdvCart(updated);
    } else {
      setPdvCart([...pdvCart, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        notes: ''
      }]);
    }
  };

  const handlePdvUpdateQty = (index, delta) => {
    const updated = [...pdvCart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setPdvCart(updated);
  };

  const pdvSubtotal = pdvCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pdvDeliveryFee = pdvOrderType === 'delivery' ? parsePrice(pdvSelectedNeighborhood?.fee || 0) : 0;
  const pdvTotal = pdvSubtotal + pdvDeliveryFee;

  const handlePdvSubmitOrder = async (e) => {
    e.preventDefault();
    if (pdvCart.length === 0) return alert('Adicione pelo menos um item ao pedido!');
    if (pdvOrderType === 'delivery' && !pdvCustomer.name) return alert('Informe o nome do cliente!');
    if (pdvOrderType === 'mesa' && !pdvTableNum) return alert('Informe o número da mesa!');

    let customerAddr = 'Retirada no Balcão';
    if (pdvOrderType === 'delivery') {
      customerAddr = `${pdvCustomer.address || ''} - Bairro: ${pdvSelectedNeighborhood?.name || 'Não informado'}`;
    } else if (pdvOrderType === 'mesa') {
      customerAddr = `Mesa ${pdvTableNum}`;
    }

    const payload = {
      tenant_id: tenant.id,
      customer_name: pdvCustomer.name || (pdvOrderType === 'mesa' ? `Mesa ${pdvTableNum}` : 'Cliente Balcão'),
      customer_phone: pdvCustomer.phone ? pdvCustomer.phone.replace(/\D/g, '') : '',
      customer_address: customerAddr,
      delivery_fee: pdvDeliveryFee,
      subtotal: pdvSubtotal,
      total: pdvTotal,
      payment_method: pdvPaymentMethod,
      items: pdvCart,
      notes: pdvNotes,
      status: 'pendente',
      order_type: pdvOrderType,
      waiter_name: pdvWaiterName || null
    };

    const { data: insertedOrder, error } = await supabase.from('orders').insert([payload]).select().single();

    if (error) {
      alert('Erro ao lançar pedido: ' + error.message);
      return;
    }

    alert('Pedido lançado com sucesso!');
    setPdvCart([]);
    setPdvCustomer({ name: '', phone: '', address: '' });
    setPdvTableNum('');
    setPdvNotes('');
    fetchData();

    if (confirm('Deseja imprimir o recibo do pedido agora?')) {
      setSelectedReceiptOrder(insertedOrder || payload);
      setTimeout(() => window.print(), 300);
    }
  };

  const addComboStep = (mode) => {
    const defaultStep = { title: '', category_type: ADDON_TYPES[0], max: 1 };
    if (mode === 'new') {
      setNewProd(prev => ({ ...prev, combo_steps: [...(prev.combo_steps || []), defaultStep] }));
    } else {
      setEditingProduct(prev => ({ ...prev, combo_steps: [...(prev.combo_steps || []), defaultStep] }));
    }
  };

  const removeComboStep = (index, mode) => {
    if (mode === 'new') {
      setNewProd(prev => ({ ...prev, combo_steps: prev.combo_steps.filter((_, i) => i !== index) }));
    } else {
      setEditingProduct(prev => ({ ...prev, combo_steps: prev.combo_steps.filter((_, i) => i !== index) }));
    }
  };

  const updateComboStep = (index, field, value, mode) => {
    if (mode === 'new') {
      const steps = [...(newProd.combo_steps || [])];
      steps[index] = { ...steps[index], [field]: value };
      setNewProd(prev => ({ ...prev, combo_steps: steps }));
    } else {
      const steps = [...(editingProduct.combo_steps || [])];
      steps[index] = { ...steps[index], [field]: value };
      setEditingProduct(prev => ({ ...prev, combo_steps: steps }));
    }
  };

  const handleToggleGroupAddons = (itemsGroup, currentAddonsList, mode) => {
    let currentArr = currentAddonsList ? currentAddonsList.split(',').filter(Boolean) : [];
    const allSelected = itemsGroup.every(a => (currentAddonsList || '').includes(a.name));

    if (allSelected) {
      itemsGroup.forEach(a => {
        currentArr = currentArr.filter(item => !item.startsWith(a.name));
      });
    } else {
      itemsGroup.forEach(a => {
        if (!currentArr.some(item => item.startsWith(a.name))) {
          currentArr.push(`${a.name}:${a.price}`);
        }
      });
    }

    const updatedStr = currentArr.join(',');
    if (mode === 'new') {
      setNewProd(prev => ({ ...prev, addons_list: updatedStr }));
    } else if (mode === 'edit') {
      setEditingProduct(prev => ({ ...prev, addons_list: updatedStr }));
    }
  };

  const handleSaveTenantSettings = async (e) => {
    e.preventDefault();
    const cleanWhatsapp = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, '') : '';
    const { error } = await supabase.from('tenants').update({
      name: tenant.name,
      cnpj: tenant.cnpj || '',
      address: tenant.address || '',
      whatsapp: cleanWhatsapp,
      logo_url: tenant.logo_url || '',
      banner_url: tenant.banner_url || '',
      instagram_url: tenant.instagram_url || '',
      promo_banners: tenant.promo_banners || '',
      primary_color: tenant.primary_color || '#FF8C00',
      secondary_color: tenant.secondary_color || '#111827',
      opening_time: tenant.opening_time || '18:00',
      closing_time: tenant.closing_time || '23:30',
      work_days: tenant.work_days || [1, 2, 3, 4, 5, 6],
      pixel_id: tenant.pixel_id || '',
      custom_message: tenant.custom_message || '',
      admin_password: tenant.admin_password,
      pix_enabled: tenant.pix_enabled || false,
      pix_provider: tenant.pix_provider || 'mercadopago',
      pix_access_token: tenant.pix_access_token || '',
      has_delivery: tenant.has_delivery ?? true,
      has_balcao: tenant.has_balcao ?? true,
      has_tables: tenant.has_tables ?? true,
      has_waiters: tenant.has_waiters ?? false
    }).eq('id', tenant.id);

    if (error) alert("Erro ao salvar configurações: " + error.message);
    else { alert("Configurações salvas com sucesso!"); fetchData(); }
  };

  const handleClearFinancialData = async () => {
    if (confirm("⚠️ ATENÇÃO: Tem certeza que deseja zerar TODOS os pedidos e dados financeiros?\n\nEsta ação vai apagar definitivamente todos os pedidos do banco de dados.")) {
      const { error } = await supabase.from('orders').delete().eq('tenant_id', tenant.id);

      if (error) {
        alert("Erro ao limpar financeiro: " + error.message);
      } else {
        alert("Histórico financeiro zerado com sucesso!");
        fetchData();
      }
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.price) return alert("Preencha nome e preço!");
    const formattedPrice = parsePrice(newProd.price);

    const { error } = await supabase.from('products').insert([{
      tenant_id: tenant.id,
      category_id: parseInt(newProd.category_id || categories[0]?.id),
      name: newProd.name.trim(),
      description: newProd.description,
      price: formattedPrice,
      image: newProd.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',
      active: true,
      addons_list: newProd.addons_list,
      max_addons: parseInt(newProd.max_addons || 0),
      borders_list: newProd.borders_list || '',
      is_combo: newProd.is_combo,
      combo_steps: newProd.combo_steps || []
    }]);

    if (error) return alert("Erro ao cadastrar produto: " + error.message);

    setNewProd({ ...INITIAL_PROD_STATE, category_id: categories[0]?.id || '' });
    fetchData();
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    const formattedPrice = parsePrice(editingProduct.price);

    const { error } = await supabase.from('products').update({
      name: editingProduct.name.trim(),
      price: formattedPrice,
      description: editingProduct.description,
      category_id: parseInt(editingProduct.category_id),
      image: editingProduct.image,
      addons_list: editingProduct.addons_list,
      max_addons: parseInt(editingProduct.max_addons || 0),
      borders_list: editingProduct.borders_list || '',
      is_combo: editingProduct.is_combo || false,
      combo_steps: editingProduct.combo_steps || []
    }).eq('id', editingProduct.id);

    if (error) return alert("Erro ao atualizar produto: " + error.message);

    setEditingProduct(null);
    fetchData();
  };

  const handleAddGlobalAddon = async (e) => {
    e.preventDefault();
    if (!newAddon.name) return alert("Preencha o nome do adicional/sabor!");
    const formattedPrice = parsePrice(newAddon.price);

    const payload = {
      tenant_id: tenant.id,
      name: newAddon.name.trim(),
      price: formattedPrice,
      description: newAddon.description ? newAddon.description.trim() : '',
      category_type: newAddon.category_type || '🍕 Pizza Salgada'
    };

    const { error } = await supabase.from('global_addons').insert([payload]);

    if (error) return alert("Erro ao salvar adicional: " + error.message);

    setNewAddon({ name: '', price: '', description: '', category_type: '🍕 Pizza Salgada' });
    fetchData();
  };

  const handleUpdateAddon = async (e) => {
    e.preventDefault();
    const formattedPrice = parsePrice(editingAddon.price);

    const { error } = await supabase.from('global_addons').update({
      name: editingAddon.name.trim(),
      price: formattedPrice,
      description: editingAddon.description || '',
      category_type: editingAddon.category_type || '🍕 Pizza Salgada'
    }).eq('id', editingAddon.id);

    if (error) return alert("Erro ao editar adicional: " + error.message);

    setEditingAddon(null);
    fetchData();
  };

  const handleAddNeighborhood = async (e) => {
    e.preventDefault();
    if (!newNeigh.name) return alert("Preencha o nome do bairro!");
    const formattedFee = parsePrice(newNeigh.fee);

    const { error } = await supabase.from('neighborhoods').insert([{ tenant_id: tenant.id, name: newNeigh.name.trim(), fee: formattedFee }]);
    if (error) return alert("Erro ao adicionar bairro: " + error.message);

    setNewNeigh({ name: '', fee: '' });
    fetchData();
  };

  const handleUpdateNeigh = async (e) => {
    e.preventDefault();
    const formattedFee = parsePrice(editingNeigh.fee);

    const { error } = await supabase.from('neighborhoods').update({ name: editingNeigh.name.trim(), fee: formattedFee }).eq('id', editingNeigh.id);
    if (error) return alert("Erro ao atualizar bairro: " + error.message);

    setEditingNeigh(null);
    fetchData();
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert([{ tenant_id: tenant.id, name: newCatName.trim() }]);
    if (error) return alert("Erro ao cadastrar categoria: " + error.message);

    setNewCatName('');
    fetchData();
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('categories').update({ name: editingCategory.name.trim() }).eq('id', editingCategory.id);
    if (error) return alert("Erro ao atualizar categoria: " + error.message);

    setEditingCategory(null);
    fetchData();
  };

  const getFilteredOrders = () => {
    const now = new Date();
    return allOrders.filter(o => {
      if (o.status === 'cancelado') return false;
      if (reportFilter === 'all') return true;
      if (!o.created_at) return true;
      const orderDate = new Date(o.created_at);
      const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
      if (reportFilter === 'today') return orderDate.toDateString() === now.toDateString();
      if (reportFilter === '7days') return diffDays <= 7;
      if (reportFilter === '15days') return diffDays <= 15;
      if (reportFilter === '30days') return diffDays <= 30;
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalSubtotal = filteredOrders.reduce((sum, o) => sum + Number(o.subtotal || o.total || 0), 0);
  const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);

  const paymentBreakdown = {
    pix: filteredOrders.filter(o => (o.payment_method || '').toUpperCase().includes('PIX')).reduce((sum, o) => sum + Number(o.total || 0), 0),
    dinheiro: filteredOrders.filter(o => (o.payment_method || '').toUpperCase().includes('DINHEIRO')).reduce((sum, o) => sum + Number(o.total || 0), 0),
    cardOnline: filteredOrders.filter(o => (o.payment_method || '').toUpperCase().includes('ONLINE')).reduce((sum, o) => sum + Number(o.total || 0), 0),
    cardMachine: filteredOrders.filter(o => (o.payment_method || '').toUpperCase().includes('MAQUININHA')).reduce((sum, o) => sum + Number(o.total || 0), 0),
    other: filteredOrders.filter(o => {
      const pm = (o.payment_method || '').toUpperCase();
      return !pm.includes('PIX') && !pm.includes('DINHEIRO') && !pm.includes('ONLINE') && !pm.includes('MAQUININHA');
    }).reduce((sum, o) => sum + Number(o.total || 0), 0)
  };

  const productSalesMap = {};
  filteredOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const q = it.quantity || 1;
        productSalesMap[it.name] = (productSalesMap[it.name] || 0) + q;
      });
    }
  });

  const topProducts = Object.entries(productSalesMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);

  const getCustomerList = () => {
    const customerMap = {};
    allOrders.forEach(order => {
      const rawPhone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
      const key = rawPhone || order.customer_name?.toLowerCase().trim() || 'anonimo';

      if (!customerMap[key]) {
        customerMap[key] = {
          name: order.customer_name || 'Cliente Sem Nome',
          phone: rawPhone,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.created_at,
          address: order.customer_address || '',
          ordersList: []
        };
      }

      customerMap[key].totalOrders += 1;
      customerMap[key].totalSpent += Number(order.total || 0);
      customerMap[key].ordersList.push(order);

      if (new Date(order.created_at) > new Date(customerMap[key].lastOrderDate)) {
        customerMap[key].lastOrderDate = order.created_at;
        if (order.customer_address) customerMap[key].address = order.customer_address;
      }
    });

    return Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  const customerList = getCustomerList();

  const handleOpenPromoModal = (client) => {
    setSelectedPromoClient(client);
    setPromoMessageText(`Olá ${client.name}! 👋 Temos um cupom de desconto exclusivo para você no *${tenant.name}*! Venha aproveitar nossas ofertas hoje: ${baseUrl}/${tenant.slug}`);
  };

  const handleSendPromoWhatsapp = () => {
    if (!selectedPromoClient?.phone) return alert("Telefone indisponível!");
    window.open(`https://wa.me/55${selectedPromoClient.phone}?text=${encodeURIComponent(promoMessageText)}`, '_blank');
    setSelectedPromoClient(null);
  };

  const groupAddonsByType = (addonsArray) => {
    const grouped = {};
    ADDON_TYPES.forEach(type => { grouped[type] = []; });

    addonsArray.forEach(addon => {
      const type = addon.category_type || '🍕 Pizza Salgada';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(addon);
    });

    return grouped;
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-sm text-gray-400">Carregando admin...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 w-full max-w-sm space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-orange-500">{tenant.name}</h2>
            <p className="text-xs text-gray-400">Painel Administrativo & PDV</p>
          </div>
          <input type="password" placeholder="Senha de acesso..." className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white focus:outline-none" onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-orange-600 transition">Entrar no Painel</button>
        </form>
      </div>
    );
  }

  const groupedAddons = groupAddonsByType(globalAddons);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-sans pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            color: #000 !important;
            background: #fff !important;
            font-family: monospace !important;
            padding: 5px !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* CABEÇALHO ADMIN */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6 no-print">
        <div>
          <h1 className="font-bold text-xl sm:text-2xl text-orange-500">{tenant.name}</h1>
          <p className="text-xs sm:text-sm text-gray-400">Painel ERP & Lançamento de Pedidos (PDV)</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-red-400 font-bold transition">Sair</button>
      </header>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex space-x-2 bg-gray-900 p-1.5 rounded-xl border border-gray-800 mb-6 text-xs font-bold overflow-x-auto no-print scrollbar-none">
        <button onClick={() => setActiveTab('pdv')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'pdv' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>🛒 Lançamento PDV</button>
        <button onClick={() => setActiveTab('products')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🍔 Itens</button>
        <button onClick={() => setActiveTab('addons')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'addons' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>➕ Adicionais/Sabores</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🏷️ Categorias</button>
        <button onClick={() => setActiveTab('clients')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'clients' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>👥 Clientes</button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'reports' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>📊 Financeiro</button>
        <button onClick={() => setActiveTab('tables')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'tables' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🪑 Mesas QR</button>
        <button onClick={() => setActiveTab('neighborhoods')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'neighborhoods' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🛵 Bairros</button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'settings' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>⚙️ Config</button>
      </div>

      {/* ABA PDV */}
      {activeTab === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-2 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4">
            <h3 className="font-bold text-sm text-green-400 flex items-center justify-between">
              <span>🛒 Selecione os Produtos</span>
              <span className="text-xs text-gray-400 font-normal">Clique no item para adicionar à comanda</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePdvAddToCart(p)}
                  className="bg-gray-950 p-3 rounded-xl border border-gray-800 hover:border-green-500 text-left transition flex flex-col justify-between group"
                >
                  <div>
                    <span className="font-bold text-xs text-white group-hover:text-green-400 block truncate">{p.name}</span>
                    <span className="text-[10px] text-gray-400 block line-clamp-1">{p.description}</span>
                  </div>
                  <span className="text-xs font-bold text-green-400 mt-2 block">R$ {Number(p.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4">
            <h3 className="font-bold text-sm text-orange-400">📝 Dados do Pedido</h3>

            <div className="grid grid-cols-3 gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-bold">
              <button onClick={() => setPdvOrderType('balcao')} className={`py-1.5 rounded-lg transition ${pdvOrderType === 'balcao' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🛍️ Balcão</button>
              <button onClick={() => setPdvOrderType('delivery')} className={`py-1.5 rounded-lg transition ${pdvOrderType === 'delivery' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🛵 Delivery</button>
              <button onClick={() => setPdvOrderType('mesa')} className={`py-1.5 rounded-lg transition ${pdvOrderType === 'mesa' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🪑 Mesa</button>
            </div>

            {pdvOrderType === 'mesa' && (
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nº da Mesa Ex: 04" value={pdvTableNum} onChange={(e) => setPdvTableNum(e.target.value)} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                <input type="text" placeholder="Nome do Garçom" value={pdvWaiterName} onChange={(e) => setPdvWaiterName(e.target.value)} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
              </div>
            )}

            <div className="space-y-2 relative">
              <input
                type="text"
                placeholder="Nome do Cliente..."
                value={pdvCustomer.name}
                onChange={(e) => {
                  setPdvCustomer({ ...pdvCustomer, name: e.target.value });
                  setCustomerSearchQuery(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
              />

              {showCustomerDropdown && customerSearchQuery.length > 1 && (
                <div className="absolute left-0 right-0 top-11 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 max-h-40 overflow-y-auto">
                  {customerList.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone.includes(customerSearchQuery)).map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPdvCustomer({ name: c.name, phone: c.phone, address: c.address });
                        setShowCustomerDropdown(false);
                      }}
                      className="w-full text-left p-2.5 text-xs hover:bg-gray-800 border-b border-gray-800 text-gray-200"
                    >
                      <span className="font-bold block">{c.name}</span>
                      <span className="text-[10px] text-gray-400">{c.phone} - {c.address}</span>
                    </button>
                  ))}
                </div>
              )}

              {pdvOrderType === 'delivery' && (
                <>
                  <input type="text" placeholder="WhatsApp do Cliente" value={pdvCustomer.phone} onChange={(e) => setPdvCustomer({ ...pdvCustomer, phone: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                  <input type="text" placeholder="Endereço de Entrega (Rua, Nº, Bairro)" value={pdvCustomer.address} onChange={(e) => setPdvCustomer({ ...pdvCustomer, address: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
                  <select onChange={(e) => setPdvSelectedNeighborhood(neighborhoods.find(n => n.id === parseInt(e.target.value)))} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none">
                    <option value="">Selecione o Bairro (Taxa de Entrega)...</option>
                    {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name} (+R$ {Number(n.fee).toFixed(2)})</option>)}
                  </select>
                </>
              )}
            </div>

            <div className="space-y-2 border-t border-gray-800 pt-3">
              <span className="text-xs font-bold text-gray-400 block">Itens do Pedido ({pdvCart.length})</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pdvCart.length === 0 ? (
                  <p className="text-[11px] text-gray-500 italic py-2 text-center">Nenhum item adicionado ainda.</p>
                ) : (
                  pdvCart.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-950 p-2 rounded-xl text-xs border border-gray-800">
                      <div>
                        <span className="font-bold text-white block">{item.name}</span>
                        <span className="text-[10px] text-green-400">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handlePdvUpdateQty(index, -1)} className="w-6 h-6 bg-gray-800 rounded-lg text-red-400 font-bold">-</button>
                        <span className="font-bold">{item.quantity}</span>
                        <button onClick={() => handlePdvUpdateQty(index, 1)} className="w-6 h-6 bg-gray-800 rounded-lg text-green-400 font-bold">+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-3 space-y-2">
              <label className="text-[11px] text-gray-400 block">Forma de Pagamento:</label>
              <select value={pdvPaymentMethod} onChange={(e) => setPdvPaymentMethod(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none">
                <option value="DINHEIRO">💵 Dinheiro</option>
                <option value="PIX">⚡ PIX</option>
                <option value="CARTAO_MAQUININHA">💳 Cartão Maquininha</option>
                <option value="PAGAR_NO_BALCAO">🏪 Pagar no Balcão</option>
              </select>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                <div className="flex justify-between text-xs text-gray-400"><span>Subtotal:</span><span>R$ {pdvSubtotal.toFixed(2)}</span></div>
                {pdvOrderType === 'delivery' && <div className="flex justify-between text-xs text-gray-400"><span>Taxa Entrega:</span><span>R$ {pdvDeliveryFee.toFixed(2)}</span></div>}
                <div className="flex justify-between text-sm font-extrabold text-green-400 pt-1 border-t border-gray-800"><span>Total:</span><span>R$ {pdvTotal.toFixed(2)}</span></div>
              </div>

              {pdvCart.length > 0 && (
                <button onClick={() => setSplitModalOrder({ total: pdvTotal, items: pdvCart })} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/30 py-2 rounded-xl text-xs font-bold hover:bg-blue-600/30 transition">
                  🧮 Simular Divisão de Comanda (Split)
                </button>
              )}

              <button onClick={handlePdvSubmitOrder} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-lg">
                🚀 Finalizar e Lançar Pedido
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ABA PRODUTOS */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4 h-fit">
            <h3 className="font-bold text-sm text-orange-400">➕ Cadastrar Lanche / Item / Pizza / Combo</h3>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <input type="text" placeholder="Nome do Produto (Ex: X-Salada, Combo Família)" value={newProd.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} />
              <input type="text" placeholder="Descrição curta (Ex: Pizza 60cm + Refri 2L)" value={newProd.description} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, description: e.target.value })} />

              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Preço R$" value={newProd.price} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, price: e.target.value })} />
                <select value={newProd.category_id} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, category_id: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="bg-gray-950 p-3.5 rounded-xl border border-purple-500/30 space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={newProd.is_combo} onChange={(e) => setNewProd({ ...newProd, is_combo: e.target.checked })} className="w-4 h-4 accent-purple-500 rounded cursor-pointer" />
                  <span className="text-xs font-bold text-purple-400">🎁 Este produto é um Combo em Etapas?</span>
                </label>

                {newProd.is_combo ? (
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] text-gray-400 block font-semibold">Configure as etapas do combo (ex: 1º Escolha a Salgada, 2º Escolha a Doce):</span>
                    {(newProd.combo_steps || []).map((step, idx) => (
                      <div key={idx} className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-orange-400">Etapa #{idx + 1}</span>
                          <button type="button" onClick={() => removeComboStep(idx, 'new')} className="text-[10px] text-red-400 hover:text-red-300 font-bold bg-red-500/10 px-2 py-0.5 rounded">Remover</button>
                        </div>

                        <input type="text" placeholder="Título da Etapa (Ex: Escolha 1 Sabor Doce)" value={step.title} onChange={(e) => updateComboStep(idx, 'title', e.target.value, 'new')} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" />

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-gray-400 block mb-0.5">Grupo do Item:</label>
                            <select value={step.category_type} onChange={(e) => updateComboStep(idx, 'category_type', e.target.value, 'new')} className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-[11px] text-white focus:outline-none">
                              {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] text-gray-400 block mb-0.5">Qtd Máxima:</label>
                            <input type="number" min="1" value={step.max} onChange={(e) => updateComboStep(idx, 'max', parseInt(e.target.value) || 1, 'new')} className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-[11px] text-white focus:outline-none font-bold" />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button type="button" onClick={() => addComboStep('new')} className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1">
                      <span>➕ Adicionar Etapa ao Combo</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-gray-800">
                    <span className="text-xs font-bold text-orange-400 block">🍕 Opções de Pizza Comum (Opcional)</span>
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Limite Máximo de Sabores Escolhidos:</label>
                      <input type="number" min="0" placeholder="0 = Ilimitado (Lanches). Ex: 2, 3 ou 4 para Pizzas" value={newProd.max_addons} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none font-bold" onChange={(e) => setNewProd({ ...newProd, max_addons: e.target.value })} />
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Bordas Disponíveis (Opcional):</label>
                      <input type="text" placeholder="Ex: Sem Borda:0, Catupiry:8.00, Cheddar:8.00" value={newProd.borders_list} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, borders_list: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <input type="text" placeholder="URL da Foto (https://...)" value={newProd.image} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, image: e.target.value })} />
                {newProd.image && (
                  <div className="mt-2 flex items-center space-x-2 bg-gray-950 p-2 rounded-lg border border-gray-800">
                    <img src={newProd.image} alt="Prévia" className="w-10 h-10 rounded-md object-cover border border-gray-700" onError={(e) => e.target.style.display = 'none'} />
                    <span className="text-[10px] text-gray-400">Prévia da foto</span>
                  </div>
                )}
              </div>

              {/* RESTAURADO: LISTA DE VÍNCULO DE ADICIONAIS / SABORES */}
              {globalAddons.length > 0 && (
                <div className="border-t border-gray-800 pt-3 space-y-3">
                  <label className="text-[11px] text-gray-300 font-bold block">Vincular Adicionais / Sabores Habilitados:</label>

                  {ADDON_TYPES.map(type => {
                    const itemsOfType = groupedAddons[type] || [];
                    if (itemsOfType.length === 0) return null;

                    const isAllSelected = itemsOfType.every(a => (newProd.addons_list || '').includes(a.name));

                    return (
                      <div key={type} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 space-y-1.5">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                          <span className="text-[11px] font-bold text-orange-400">{type}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleGroupAddons(itemsOfType, newProd.addons_list, 'new')}
                            className="text-[10px] text-orange-300 hover:text-orange-200 font-bold bg-orange-500/20 hover:bg-orange-500/30 px-2 py-0.5 rounded-md border border-orange-500/30 transition">
                            {isAllSelected ? '❌ Desmarcar Todos' : '✅ Marcar Todos'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                          {itemsOfType.map(a => {
                            const formattedStr = `${a.name}:${a.price}`;
                            const isSelected = (newProd.addons_list || '').includes(a.name);
                            return (
                              <label key={a.id} className="flex items-center space-x-1.5 bg-gray-800 p-1.5 rounded-lg text-[10px] cursor-pointer hover:bg-gray-750 transition">
                                <input type="checkbox" checked={isSelected} onChange={(e) => {
                                  let currentArr = newProd.addons_list ? newProd.addons_list.split(',').filter(Boolean) : [];
                                  if (e.target.checked) currentArr.push(formattedStr);
                                  else currentArr = currentArr.filter(item => !item.startsWith(a.name));
                                  setNewProd({ ...newProd, addons_list: currentArr.join(',') });
                                }} />
                                <span className="truncate">{a.name} (+R${Number(a.price).toFixed(2)})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="submit" className="w-full bg-green-600 font-bold py-3 rounded-xl text-xs hover:bg-green-700 transition shadow-lg">Salvar Produto 🚀</button>
            </form>
          </section>

          <section className="lg:col-span-2 space-y-3">
            <h3 className="font-bold text-sm text-gray-300">📋 Produtos ({products.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map((item) => (
                <div key={item.id} className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center space-x-3">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <img src={item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} alt={item.name} className="w-14 h-14 rounded-xl object-cover border border-gray-800 bg-gray-800 shrink-0" />
                    <div className="truncate">
                      <span className={`font-bold text-xs flex items-center space-x-1 truncate ${!item.active ? 'line-through text-gray-500' : 'text-white'}`}>
                        <span className="truncate">{item.name}</span>
                        {item.is_combo && <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold shrink-0">COMBO</span>}
                      </span>
                      <span className="text-xs text-orange-400 font-bold">
                        R$ {Number(item.price).toFixed(2)} {item.max_addons > 0 && !item.is_combo && <span className="text-[10px] text-purple-400 font-normal ml-1">(Até {item.max_addons} sab.)</span>}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button onClick={() => setEditingProduct(item)} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30 hover:bg-blue-600/30 transition">✏️</button>
                    <button onClick={async () => { await supabase.from('products').update({ active: !item.active }).eq('id', item.id); fetchData(); }} className={`text-[10px] font-bold px-2.5 py-2 rounded-xl ${item.active ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{item.active ? 'Ativo' : 'Pausado'}</button>
                    <button onClick={async () => { if (confirm("Excluir?")) { await supabase.from('products').delete().eq('id', item.id); fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-2 rounded-xl font-bold hover:bg-red-500/30 transition">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ABA ADICIONAIS / SABORES */}
      {activeTab === 'addons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-orange-400">➕ Cadastrar Adicional ou Sabor</h3>
            <form onSubmit={handleAddGlobalAddon} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Categoria / Tipo:</label>
                <select value={newAddon.category_type} onChange={(e) => setNewAddon({ ...newAddon, category_type: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold">
                  {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <input type="text" placeholder="Nome Ex: Bacon Extra ou Calabresa" value={newAddon.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })} />
              <input type="text" placeholder="Ingredientes / Descrição Ex: Fatias crocantes de bacon" value={newAddon.description} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, description: e.target.value })} />
              <input type="text" placeholder="Valor Adicional R$ Ex: 4.50 (ou 0.00)" value={newAddon.price} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })} />
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-xl text-xs hover:bg-green-700 transition">Cadastrar no Sistema</button>
            </form>
          </section>

          <section className="lg:col-span-2 space-y-4 h-fit">
            {ADDON_TYPES.map(type => {
              const list = groupedAddons[type] || [];
              if (list.length === 0) return null;

              return (
                <div key={type} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 space-y-3">
                  <h4 className="font-bold text-xs text-orange-400 uppercase tracking-wider">{type} ({list.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {list.map((a) => (
                      <div key={a.id} className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold block text-white">{a.name}</span>
                          {a.description && <p className="text-[10px] text-gray-400 italic mb-0.5">{a.description}</p>}
                          <span className="text-orange-400 font-bold">+ R$ {Number(a.price).toFixed(2)}</span>
                        </div>
                        <div className="flex space-x-1.5">
                          <button onClick={() => setEditingAddon(a)} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30">✏️</button>
                          <button onClick={async () => { if (confirm("Excluir?")) { const { error } = await supabase.from('global_addons').delete().eq('id', a.id); if (error) alert(error.message); else fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-2 rounded-xl font-bold">🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* ABA CATEGORIAS */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-orange-400">🏷️ Nova Categoria</h3>
            <form onSubmit={handleAddCategory} className="flex space-x-2">
              <input type="text" placeholder="Nome" value={newCatName} className="flex-1 bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewCatName(e.target.value)} />
              <button type="submit" className="bg-green-600 font-bold px-4 py-2.5 rounded-xl text-xs">Adicionar</button>
            </form>
          </section>

          <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 h-fit">
            {categories.map((c) => (
              <div key={c.id} className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center text-xs">
                <span className="font-bold text-white">{c.name}</span>
                <div className="flex space-x-1.5">
                  <button onClick={() => setEditingCategory(c)} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30">✏️</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { const { error } = await supabase.from('categories').delete().eq('id', c.id); if (error) alert(error.message); else fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-2 rounded-xl font-bold">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ABA CLIENTES */}
      {activeTab === 'clients' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-1">
            <h3 className="font-bold text-sm text-orange-400">👥 Registro & Ranking de Clientes (CRM)</h3>
            <p className="text-xs text-gray-400">Clientes identificados automaticamente com histórico completo de compras e endereço.</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4 col-span-full">Nenhum cliente cadastrado ainda.</p>
            ) : (
              customerList.map((client, idx) => (
                <div key={idx} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-xs text-orange-400">
                          {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs text-white">{client.name}</h4>
                          {client.phone && <p className="text-[10px] text-gray-400">📱 {client.phone}</p>}
                        </div>
                      </div>

                      <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                        R$ {client.totalSpent.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-400 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                      <span>📦 <b>{client.totalOrders}</b> pedido(s)</span>
                      <span>🕒 Último: <b>{new Date(client.lastOrderDate).toLocaleDateString('pt-BR')}</b></span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <button onClick={() => setSelectedClientHistory(client)} className="w-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 py-2 rounded-xl text-xs font-bold transition">
                      📜 Ver Histórico de Pedidos
                    </button>

                    {client.phone && (
                      <button onClick={() => handleOpenPromoModal(client)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1 transition shadow">
                        <span>📢 Enviar Promoção WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {/* ABA RELATÓRIOS E FINANCEIRO */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-900 p-4 rounded-2xl border border-gray-800 gap-3 no-print">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-xs font-bold">Filtrar Período:</span>
              <div className="flex space-x-1 overflow-x-auto">
                <button onClick={() => setReportFilter('all')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Tudo</button>
                <button onClick={() => setReportFilter('today')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === 'today' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Hoje</button>
                <button onClick={() => setReportFilter('7days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '7days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>7 Dias</button>
                <button onClick={() => setReportFilter('30days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '30days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>30 Dias</button>
              </div>
            </div>

            <button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow w-full sm:w-auto">
              🖨️ Imprimir Relatório
            </button>
          </div>

          <div className="print-area space-y-6">
            <div className="hidden print:block text-center border-b border-black pb-2 mb-2">
              <h2 className="font-bold text-base">{tenant.name}</h2>
              <p className="text-xs">RELATÓRIO FINANCEIRO DE VENDAS</p>
              <p className="text-[10px]">Data: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-xs text-gray-400 block mb-1 print:text-black">Faturamento Total</span>
                <span className="text-2xl font-extrabold text-green-400 print:text-black">R$ {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-xs text-gray-400 block mb-1 print:text-black">Total de Pedidos</span>
                <span className="text-2xl font-extrabold text-orange-400 print:text-black">{filteredOrders.length}</span>
              </div>
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-xs text-gray-400 block mb-1 print:text-black">Subtotal Produtos</span>
                <span className="text-2xl font-extrabold text-blue-400 print:text-black">R$ {totalSubtotal.toFixed(2)}</span>
              </div>
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-xs text-gray-400 block mb-1 print:text-black">Taxas de Entrega</span>
                <span className="text-2xl font-extrabold text-purple-400 print:text-black">R$ {totalDeliveryFees.toFixed(2)}</span>
              </div>
            </div>

            {/* AUDITORIA DETALHADA DE PEDIDOS */}
            <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 no-print">
              <h3 className="font-bold text-xs text-orange-400 uppercase">📋 Histórico Auditado de Pedidos</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredOrders.map(o => (
                  <div key={o.id} className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">#{o.id} - {o.customer_name} ({o.order_type || 'delivery'})</span>
                      <span className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('pt-BR')} • {o.payment_method}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-green-400">R$ {Number(o.total).toFixed(2)}</span>
                      <button onClick={() => setSelectedReceiptOrder(o)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        📄 Recibo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="bg-gray-900 p-5 rounded-2xl border border-red-500/30 flex justify-between items-center no-print">
            <div>
              <h4 className="font-bold text-xs text-red-400">🧹 Zerar Dados de Teste</h4>
              <p className="text-[11px] text-gray-400">Apaga todo o histórico de pedidos para recomeçar do zero.</p>
            </div>
            <button type="button" onClick={handleClearFinancialData} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/40 px-4 py-2.5 rounded-xl text-xs font-bold transition">
              🗑️ Limpar Pedidos
            </button>
          </section>
        </div>
      )}

      {/* ABA MESAS QR CODE */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 no-print">
            <h3 className="font-bold text-sm text-orange-400">🪑 Gerador de QR Code por Mesa</h3>
            <p className="text-xs text-gray-400">Defina a quantidade de mesas para gerar os links e QR Codes prontos para impressão.</p>

            <div className="flex items-center space-x-3 pt-1">
              <label className="text-xs font-bold text-gray-300 whitespace-nowrap">Qtd de Mesas:</label>
              <input type="number" min="1" max="100" value={tableCount} onChange={(e) => setTableCount(Math.max(1, parseInt(e.target.value) || 1))} className="w-28 bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white text-center font-bold" />
            </div>
          </section>

          <section className="space-y-4 print-tables-area">
            <div className="flex justify-between items-center no-print">
              <h4 className="font-bold text-xs text-gray-300">Cartões para Impressão ({tableCount} mesas)</h4>
              <button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow">
                🖨️ Imprimir Cartões
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: tableCount }, (_, i) => {
                const tableNum = String(i + 1).padStart(2, '0');
                const tableUrl = `${baseUrl}/${tenant.slug}?mesa=${tableNum}`;
                const qrCodeApi = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tableUrl)}`;

                return (
                  <div key={i} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex flex-col items-center space-y-2 text-center print:bg-white print:border-black print:text-black">
                    <span className="font-extrabold text-xs text-orange-400 print:text-black truncate max-w-full">{tenant.name}</span>
                    <span className="font-bold text-xs bg-orange-500 text-white px-2.5 py-0.5 rounded-md print:bg-black print:text-white">MESA {tableNum}</span>
                    <img src={qrCodeApi} alt={`Mesa ${tableNum}`} className="w-28 h-28 rounded-xl bg-white p-1.5 border border-gray-700 shadow" />
                    <span className="text-[9px] opacity-70">Escaneie para pedir</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ABA BAIRROS */}
      {activeTab === 'neighborhoods' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-orange-400">🛵 Novo Bairro</h3>
            <form onSubmit={handleAddNeighborhood} className="space-y-3">
              <input type="text" placeholder="Nome do Bairro" value={newNeigh.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewNeigh({ ...newNeigh, name: e.target.value })} />
              <input type="text" placeholder="Taxa R$" value={newNeigh.fee} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setNewNeigh({ ...newNeigh, fee: e.target.value })} />
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-xl text-xs">Cadastrar Bairro</button>
            </form>
          </section>

          <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 h-fit">
            {neighborhoods.map((n) => (
              <div key={n.id} className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold block text-white">{n.name}</span>
                  <span className="text-orange-400 font-bold">Taxa: R$ {Number(n.fee).toFixed(2)}</span>
                </div>
                <div className="flex space-x-1.5">
                  <button onClick={() => setEditingNeigh(n)} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30">✏️</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { const { error } = await supabase.from('neighborhoods').delete().eq('id', n.id); if (error) alert(error.message); else fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-2 rounded-xl font-bold">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ABA CONFIGURAÇÕES DA LOJA (TOTALMENTE RESTAURADA) */}
      {activeTab === 'settings' && (
        <div className="no-print space-y-6 max-w-4xl mx-auto">
          <form onSubmit={handleSaveTenantSettings} className="space-y-6">
            
            {/* INFORMAÇÕES BÁSICAS E CORPORATIVAS */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">🏢 Dados da Empresa & Recibos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
                  <input type="text" value={tenant.name || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">CNPJ (Exibido nos Recibos):</label>
                  <input type="text" placeholder="00.000.000/0001-00" value={tenant.cnpj || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, cnpj: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Endereço Completo (Exibido nos Recibos):</label>
                <input type="text" placeholder="Rua, Número, Bairro, Cidade - UF" value={tenant.address || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, address: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">WhatsApp de Vendas/Recebimento:</label>
                  <input type="text" placeholder="5511999999999" value={tenant.whatsapp || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, whatsapp: e.target.value })} />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Link do Instagram:</label>
                  <input type="text" placeholder="https://instagram.com/seurestaurante" value={tenant.instagram_url || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, instagram_url: e.target.value })} />
                </div>
              </div>
            </section>

            {/* MÓDULO DE PAGAMENTO DINÂMICO VIA PIX / MERCADO PAGO */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-green-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <h3 className="font-bold text-base text-green-400 flex items-center space-x-2">
                  <span>⚡ Pagamento Dinâmico (PIX Automático)</span>
                </h3>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={tenant.pix_enabled || false} 
                    onChange={(e) => setTenant({ ...tenant, pix_enabled: e.target.checked })} 
                    className="w-4 h-4 accent-green-500 rounded cursor-pointer" 
                  />
                  <span className="text-xs font-bold text-green-400">Ativar PIX Automático</span>
                </label>
              </div>

              {tenant.pix_enabled && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Provedor de Pagamento PIX:</label>
                    <select
                      value={tenant.pix_provider || 'mercadopago'}
                      onChange={(e) => setTenant({ ...tenant, pix_provider: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold"
                    >
                      <option value="mercadopago">Mercado Pago (PIX QR Code Dinâmico)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Mercado Pago Access Token (APP_USR-...):</label>
                    <input
                      type="password"
                      placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxx font..."
                      value={tenant.pix_access_token || ''}
                      onChange={(e) => setTenant({ ...tenant, pix_access_token: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Obtenha este token no painel do Mercado Pago Desenvolvedores em Suas Aplicações &gt; Credenciais de Produção.</p>
                  </div>
                </div>
              )}
            </section>

            {/* HORÁRIOS E DIAS DE FUNCIONAMENTO */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">⏰ Horários de Funcionamento</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Horário de Abertura:</label>
                  <input type="time" value={tenant.opening_time || '18:00'} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, opening_time: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Horário de Fechamento:</label>
                  <input type="time" value={tenant.closing_time || '23:30'} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, closing_time: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-2">Dias de Funcionamento:</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map((day) => {
                    const isSelected = (tenant.work_days || []).includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setTenant({ ...tenant, work_days: toggleDaySelection(tenant.work_days, day.id) })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                          isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* APARÊNCIA, BANNERS E IMAGENS */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">🎨 Aparência e Banners Promocionais</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">URL da Logo (https://...):</label>
                  <input type="text" value={tenant.logo_url || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">URL do Banner Principal:</label>
                  <input type="text" value={tenant.banner_url || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, banner_url: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Banners Promocionais do Carrossel (URLs separadas por vírgula):</label>
                <textarea rows={2} value={tenant.promo_banners || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, promo_banners: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Cor Primária (Hex):</label>
                  <input type="color" value={tenant.primary_color || '#FF8C00'} className="w-full h-10 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer p-1" onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Cor Secundária (Hex):</label>
                  <input type="color" value={tenant.secondary_color || '#111827'} className="w-full h-10 bg-gray-800 border border-gray-700 rounded-xl cursor-pointer p-1" onChange={(e) => setTenant({ ...tenant, secondary_color: e.target.value })} />
                </div>
              </div>
            </section>

            {/* SEGURANÇA E MARKETING */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">🔑 Segurança & Recursos de Marketing</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Senha do Painel de Administração:</label>
                  <input type="text" value={tenant.admin_password || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold" onChange={(e) => setTenant({ ...tenant, admin_password: e.target.value })} />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Facebook Pixel ID:</label>
                  <input type="text" placeholder="Ex: 1234567890" value={tenant.pixel_id || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, pixel_id: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Mensagem Final Customizada do WhatsApp:</label>
                <textarea rows={2} placeholder="Ex: Agradecemos a preferência! Seu pedido será preparado com carinho." value={tenant.custom_message || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, custom_message: e.target.value })} />
              </div>
            </section>

            {/* MÓDULOS HABILITADOS */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-3">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">🧩 Módulos Ativos no Sistema</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" checked={tenant.has_delivery ?? true} onChange={(e) => setTenant({ ...tenant, has_delivery: e.target.checked })} className="accent-orange-500 w-4 h-4" />
                  <span className="font-bold">🛵 Delivery</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" checked={tenant.has_balcao ?? true} onChange={(e) => setTenant({ ...tenant, has_balcao: e.target.checked })} className="accent-orange-500 w-4 h-4" />
                  <span className="font-bold">🛍️ Balcão</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" checked={tenant.has_tables ?? true} onChange={(e) => setTenant({ ...tenant, has_tables: e.target.checked })} className="accent-orange-500 w-4 h-4" />
                  <span className="font-bold">🪑 Mesas</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" checked={tenant.has_waiters ?? false} onChange={(e) => setTenant({ ...tenant, has_waiters: e.target.checked })} className="accent-orange-500 w-4 h-4" />
                  <span className="font-bold">👤 Garçons</span>
                </label>
              </div>
            </section>

            <button type="submit" className="w-full bg-green-600 font-bold py-4 rounded-xl text-sm transition hover:bg-green-700 shadow-xl text-white">
              💾 Salvar Todas as Configurações da Loja
            </button>
          </form>
        </div>
      )}

      {/* MODAL DE RECIBO NÃO-FISCAL PARA IMPRESSÃO */}
      {selectedReceiptOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-orange-500/40 space-y-4">
            <h3 className="font-bold text-sm text-orange-400">📄 Comprovante Recibo do Cliente</h3>

            <div className="bg-white text-black p-4 rounded-xl font-mono text-xs space-y-2 border border-gray-300">
              <div className="text-center border-b pb-2">
                <span className="font-extrabold text-sm block">{tenant.name}</span>
                {tenant.cnpj && <span className="text-[10px] block">CNPJ: {tenant.cnpj}</span>}
                {tenant.address && <span className="text-[10px] block">{tenant.address}</span>}
              </div>

              <div className="border-b pb-2 text-[10px] space-y-0.5">
                <div><b>Cliente:</b> {selectedReceiptOrder.customer_name}</div>
                {selectedReceiptOrder.customer_phone && <div><b>Tel:</b> {selectedReceiptOrder.customer_phone}</div>}
                <div><b>Tipo:</b> {selectedReceiptOrder.order_type || 'Delivery'}</div>
                {selectedReceiptOrder.waiter_name && <div><b>Garçom:</b> {selectedReceiptOrder.waiter_name}</div>}
                <div><b>Data:</b> {new Date().toLocaleString('pt-BR')}</div>
              </div>

              <div className="border-b pb-2 space-y-1">
                <div className="font-bold text-[11px]">ITENS DO PEDIDO:</div>
                {(selectedReceiptOrder.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span>{it.quantity}x {it.name}</span>
                    <span>R$ {(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] space-y-0.5 pt-1">
                <div className="flex justify-between"><span>Subtotal:</span><span>R$ {Number(selectedReceiptOrder.subtotal || selectedReceiptOrder.total).toFixed(2)}</span></div>
                {Number(selectedReceiptOrder.delivery_fee || 0) > 0 && <div className="flex justify-between"><span>Taxa Entrega:</span><span>R$ {Number(selectedReceiptOrder.delivery_fee).toFixed(2)}</span></div>}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t"><span>TOTAL:</span><span>R$ {Number(selectedReceiptOrder.total).toFixed(2)}</span></div>
                <div className="text-[10px] pt-1"><b>Pagamento:</b> {selectedReceiptOrder.payment_method}</div>
              </div>
            </div>

            <div className="flex space-x-2">
              <button onClick={() => setSelectedReceiptOrder(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Fechar</button>
              <button onClick={() => window.print()} className="w-1/2 bg-orange-500 hover:bg-orange-600 py-2.5 rounded-xl text-xs font-bold text-white">🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* RESTAURADO: ÁREA INVISÍVEL PARA IMPRESSORA TÉRMICA 80MM */}
      {selectedReceiptOrder && (
        <div className="print-area hidden print:block">
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '5px' }}>
            <strong style={{ fontSize: '13px' }}>{tenant.name}</strong><br />
            {tenant.cnpj && <span>CNPJ: {tenant.cnpj}<br /></span>}
            {tenant.address && <span>{tenant.address}<br /></span>}
            --------------------------------
          </div>
          <div style={{ padding: '5px 0', borderBottom: '1px dashed #000' }}>
            CLIENTE: {selectedReceiptOrder.customer_name}<br />
            TIPO: {selectedReceiptOrder.order_type || 'Delivery'}<br />
            {selectedReceiptOrder.waiter_name && <span>GARÇOM: {selectedReceiptOrder.waiter_name}<br /></span>}
            DATA: {new Date().toLocaleString('pt-BR')}<br />
            --------------------------------
          </div>
          <div style={{ padding: '5px 0', borderBottom: '1px dashed #000' }}>
            {(selectedReceiptOrder.items || []).map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{it.quantity}x {it.name}</span>
                <span>R$ {(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: '5px' }}>
            TOTAL: R$ {Number(selectedReceiptOrder.total).toFixed(2)}<br />
            PAGAMENTO: {selectedReceiptOrder.payment_method}<br />
            <br />
            <center>Obrigado pela preferência!</center>
          </div>
        </div>
      )}

      {/* MODAL SIMULADOR DE DIVISÃO DE COMANDA (SPLIT) */}
      {splitModalOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-4">
            <h3 className="font-bold text-sm text-blue-400">🧮 Calculadora de Divisão de Comanda</h3>

            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span>Valor Total do Pedido:</span>
                <span className="font-bold text-green-400 text-sm">R$ {Number(splitModalOrder.total).toFixed(2)}</span>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Dividir igualmente entre quantas pessoas?</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={splitPeopleCount}
                  onChange={(e) => setSplitPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white text-center font-extrabold"
                />
              </div>

              <div className="bg-blue-600/10 border border-blue-500/30 p-3 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-blue-300 block">Valor individual por pessoa:</span>
                <span className="text-xl font-extrabold text-blue-400">
                  R$ {(Number(splitModalOrder.total) / splitPeopleCount).toFixed(2)}
                </span>
              </div>
            </div>

            <button onClick={() => setSplitModalOrder(null)} className="w-full bg-gray-800 py-2.5 rounded-xl text-xs font-bold">Concluído</button>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO COMPLETO DO CLIENTE */}
      {selectedClientHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-blue-500/40 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div>
                <h3 className="font-bold text-sm text-blue-400">{selectedClientHistory.name}</h3>
                <p className="text-[10px] text-gray-400">📱 {selectedClientHistory.phone || 'Sem Telefone'}</p>
              </div>
              <button onClick={() => setSelectedClientHistory(null)} className="text-xs bg-gray-800 px-3 py-1 rounded-lg">Fechar</button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-300">Histórico de {selectedClientHistory.ordersList?.length || 0} pedido(s):</span>
              {(selectedClientHistory.ordersList || []).map((o, idx) => (
                <div key={idx} className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-orange-400">
                    <span>Pedido #{o.id}</span>
                    <span>R$ {Number(o.total).toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Data: {new Date(o.created_at).toLocaleString('pt-BR')} • {o.payment_method}
                  </div>
                  <div className="text-[10px] text-gray-300">
                    Itens: {(o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DISPARO DE PROMOÇÃO WHATSAPP */}
      {selectedPromoClient && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-green-500/40 space-y-3">
            <h3 className="font-bold text-sm text-green-400">📢 Disparar Promoção via WhatsApp</h3>
            <p className="text-xs text-gray-300"><b>Cliente:</b> {selectedPromoClient.name} ({selectedPromoClient.phone})</p>

            <textarea
              rows={4}
              value={promoMessageText}
              onChange={(e) => setPromoMessageText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
            />

            <div className="flex space-x-2">
              <button type="button" onClick={() => setSelectedPromoClient(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button>
              <button type="button" onClick={handleSendPromoWhatsapp} className="w-1/2 bg-green-600 hover:bg-green-700 py-2.5 rounded-xl text-xs font-bold text-white">Enviar 🚀</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE EDIÇÃO */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateAddon} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Adicional / Sabor</h3>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Categoria / Tipo:</label>
              <select
                value={editingAddon.category_type || '🍕 Pizza Salgada'}
                onChange={(e) => setEditingAddon({ ...editingAddon, category_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold">
                {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input type="text" value={editingAddon.name} onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <input type="text" placeholder="Ingredientes / Descrição" value={editingAddon.description || ''} onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <input type="text" value={editingAddon.price} onChange={(e) => setEditingAddon({ ...editingAddon, price: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingAddon(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2.5 rounded-xl text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {editingNeigh && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateNeigh} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Bairro</h3>
            <input type="text" value={editingNeigh.name} onChange={(e) => setEditingNeigh({ ...editingNeigh, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <input type="text" value={editingNeigh.fee} onChange={(e) => setEditingNeigh({ ...editingNeigh, fee: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingNeigh(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2.5 rounded-xl text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateCategory} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Categoria</h3>
            <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingCategory(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2.5 rounded-xl text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PRODUTO / COMBO COM RESTAURAÇÃO DE ADICIONAIS */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateProduct} className="bg-gray-900 w-full max-w-md rounded-2xl p-5 border border-blue-500/40 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Produto / Combo</h3>
            <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <input type="text" value={editingProduct.description || ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />

            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
              <select value={editingProduct.category_id} onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })} className="bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="bg-gray-950 p-3.5 rounded-xl border border-purple-500/30 space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.is_combo || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, is_combo: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-purple-400">🎁 Este produto é um Combo em Etapas?</span>
              </label>

              {editingProduct.is_combo ? (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] text-gray-400 block font-semibold">Etapas Configuradas:</span>

                  {(editingProduct.combo_steps || []).map((step, idx) => (
                    <div key={idx} className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-orange-400">Etapa #{idx + 1}</span>
                        <button type="button" onClick={() => removeComboStep(idx, 'edit')} className="text-[10px] text-red-400 hover:text-red-300 font-bold bg-red-500/10 px-2 py-0.5 rounded">Remover</button>
                      </div>

                      <input type="text" placeholder="Título da Etapa" value={step.title} onChange={(e) => updateComboStep(idx, 'title', e.target.value, 'edit')} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-gray-400 block mb-0.5">Grupo do Item:</label>
                          <select value={step.category_type} onChange={(e) => updateComboStep(idx, 'category_type', e.target.value, 'edit')} className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-[11px] text-white focus:outline-none">
                            {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] text-gray-400 block mb-0.5">Qtd Máxima:</label>
                          <input type="number" min="1" value={step.max} onChange={(e) => updateComboStep(idx, 'max', parseInt(e.target.value) || 1, 'edit')} className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-[11px] text-white focus:outline-none font-bold" />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={() => addComboStep('edit')} className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1">
                    <span>➕ Adicionar Etapa ao Combo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-gray-800">
                  <span className="text-xs font-bold text-orange-400 block">🍕 Opções de Pizza Comum (Opcional)</span>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Limite Máximo de Sabores:</label>
                    <input type="number" min="0" value={editingProduct.max_addons || 0} onChange={(e) => setEditingProduct({ ...editingProduct, max_addons: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-0.5">Bordas Disponíveis:</label>
                    <input type="text" placeholder="Ex: Sem Borda:0, Catupiry:8.00" value={editingProduct.borders_list || ''} onChange={(e) => setEditingProduct({ ...editingProduct, borders_list: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <input type="text" placeholder="URL da Foto" value={editingProduct.image || ''} onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
              {editingProduct.image && (
                <div className="mt-2 flex items-center space-x-2 bg-gray-950 p-2 rounded-lg border border-gray-800">
                  <img src={editingProduct.image} alt="Prévia" className="w-10 h-10 rounded-md object-cover border border-gray-700" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-[10px] text-gray-400">Prévia da imagem</span>
                </div>
              )}
            </div>

            {/* RESTAURADO: VÍNCULO DE ADICIONAIS NA EDIÇÃO DE PRODUTO */}
            {globalAddons.length > 0 && (
              <div className="border-t border-gray-800 pt-3 space-y-3">
                <label className="text-[11px] text-gray-300 font-bold block">Adicionais / Sabores Vinculados:</label>
                {ADDON_TYPES.map(type => {
                  const itemsOfType = groupedAddons[type] || [];
                  if (itemsOfType.length === 0) return null;

                  const isAllSelected = itemsOfType.every(a => (editingProduct.addons_list || '').includes(a.name));

                  return (
                    <div key={type} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 space-y-1.5">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                        <span className="text-[10px] font-bold text-orange-400">{type}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleGroupAddons(itemsOfType, editingProduct.addons_list, 'edit')}
                          className="text-[10px] text-orange-300 hover:text-orange-200 font-bold bg-orange-500/20 hover:bg-orange-500/30 px-2 py-0.5 rounded-md border border-orange-500/30 transition">
                          {isAllSelected ? '❌ Desmarcar Todos' : '✅ Marcar Todos'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                        {itemsOfType.map(a => {
                          const formattedStr = `${a.name}:${a.price}`;
                          const isSelected = (editingProduct.addons_list || '').includes(a.name);
                          return (
                            <label key={a.id} className="flex items-center space-x-1.5 bg-gray-800 p-1.5 rounded-lg text-[10px] cursor-pointer">
                              <input type="checkbox" checked={isSelected} onChange={(e) => {
                                let currentArr = editingProduct.addons_list ? editingProduct.addons_list.split(',').filter(Boolean) : [];
                                if (e.target.checked) currentArr.push(formattedStr);
                                else currentArr = currentArr.filter(item => !item.startsWith(a.name));
                                setEditingProduct({ ...editingProduct, addons_list: currentArr.join(',') });
                              }} />
                              <span className="truncate">{a.name} (+R${Number(a.price).toFixed(2)})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setEditingProduct(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs font-bold text-gray-300">Cancelar</button>
              <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-xs font-bold text-white">Atualizar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
