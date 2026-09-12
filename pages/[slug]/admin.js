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
  const [activeTab, setActiveTab] = useState('products');
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

  // DIAS DA SEMANA (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
  const ALL_DAYS = [
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
    { id: 0, label: 'Dom' }
  ];

  const [newProd, setNewProd] = useState({ name: '', price: '', category_id: '', description: '', image: '', addons_list: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingAddon, setEditingAddon] = useState(null);
  const [editingNeigh, setEditingNeigh] = useState(null);

  const [newCatName, setNewCatName] = useState('');
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });
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

  const handleSaveTenantSettings = async (e) => {
    e.preventDefault();
    const cleanWhatsapp = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, '') : '';
    const { error } = await supabase.from('tenants').update({
      name: tenant.name,
      whatsapp: cleanWhatsapp,
      logo_url: tenant.logo_url,
      banner_url: tenant.banner_url,
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
      pix_access_token: tenant.pix_access_token || ''
    }).eq('id', tenant.id);

    if (error) alert("Erro ao salvar: " + error.message);
    else { alert("Configurações salvas com sucesso!"); fetchData(); }
  };

  // LIMPAR HISTÓRICO DE PEDIDOS / ZERAR TESTES FINANCEIROS
  const handleClearFinancialData = async () => {
    if (confirm("⚠️ ATENÇÃO: Tem certeza que deseja zerar TODOS os pedidos e dados financeiros?\n\nEsta ação vai apagar definitivamente todos os pedidos de teste do banco de dados. Não poderá ser desfeito!")) {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('tenant_id', tenant.id);

      if (error) {
        alert("Erro ao limpar financeiro: " + error.message);
      } else {
        alert("Histórico financeiro e pedidos zerados com sucesso!");
        fetchData();
      }
    }
  };

  // HANDLERS DE CADASTRO E EDIÇÃO DE PRODUTO (COM IMAGEM)
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.price) return alert("Preencha nome e preço!");
    const formattedPrice = parsePrice(newProd.price);
    
    await supabase.from('products').insert([{
      tenant_id: tenant.id,
      category_id: parseInt(newProd.category_id || categories[0]?.id),
      name: newProd.name.trim(),
      description: newProd.description,
      price: formattedPrice,
      image: newProd.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80',
      active: true,
      addons_list: newProd.addons_list
    }]);

    setNewProd({ name: '', price: '', category_id: categories[0]?.id || '', description: '', image: '', addons_list: '' });
    fetchData();
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    const formattedPrice = parsePrice(editingProduct.price);

    await supabase.from('products').update({
      name: editingProduct.name.trim(),
      price: formattedPrice,
      description: editingProduct.description,
      category_id: parseInt(editingProduct.category_id),
      image: editingProduct.image,
      addons_list: editingProduct.addons_list
    }).eq('id', editingProduct.id);

    setEditingProduct(null);
    fetchData();
  };

  const handleAddGlobalAddon = async (e) => {
    e.preventDefault();
    if (!newAddon.name) return alert("Preencha o nome do adicional!");
    const formattedPrice = parsePrice(newAddon.price);

    await supabase.from('global_addons').insert([{ tenant_id: tenant.id, name: newAddon.name.trim(), price: formattedPrice }]);
    setNewAddon({ name: '', price: '' });
    fetchData();
  };

  const handleUpdateAddon = async (e) => {
    e.preventDefault();
    const formattedPrice = parsePrice(editingAddon.price);

    await supabase.from('global_addons').update({ name: editingAddon.name.trim(), price: formattedPrice }).eq('id', editingAddon.id);
    setEditingAddon(null);
    fetchData();
  };

  const handleAddNeighborhood = async (e) => {
    e.preventDefault();
    if (!newNeigh.name) return alert("Preencha o nome do bairro!");
    const formattedFee = parsePrice(newNeigh.fee);

    await supabase.from('neighborhoods').insert([{ tenant_id: tenant.id, name: newNeigh.name.trim(), fee: formattedFee }]);
    setNewNeigh({ name: '', fee: '' });
    fetchData();
  };

  const handleUpdateNeigh = async (e) => {
    e.preventDefault();
    const formattedFee = parsePrice(editingNeigh.fee);

    await supabase.from('neighborhoods').update({ name: editingNeigh.name.trim(), fee: formattedFee }).eq('id', editingNeigh.id);
    setEditingNeigh(null);
    fetchData();
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await supabase.from('categories').insert([{ tenant_id: tenant.id, name: newCatName.trim() }]);
    setNewCatName('');
    fetchData();
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    await supabase.from('categories').update({ name: editingCategory.name.trim() }).eq('id', editingCategory.id);
    setEditingCategory(null);
    fetchData();
  };

  // CÁLCULO SEGURO DO RELATÓRIO FINANCEIRO
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

  // DETALHAMENTO DE FORMAS DE PAGAMENTO
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

  // CONSOLIDADO E RANKING DOS MELHORES CLIENTES
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
          address: order.customer_address || ''
        };
      }

      customerMap[key].totalOrders += 1;
      customerMap[key].totalSpent += Number(order.total || 0);

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

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-sm text-gray-400">Carregando admin...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 w-full max-w-sm space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-orange-500">{tenant.name}</h2>
            <p className="text-xs text-gray-400">Painel Administrativo</p>
          </div>
          <input type="password" placeholder="Senha de acesso..." className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white focus:outline-none" onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-orange-600 transition">Entrar no Painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-md mx-auto font-sans pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            color: #000 !important;
            background: #fff !important;
            font-family: monospace !important;
            padding: 10px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* CABEÇALHO ADMIN */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-4 no-print">
        <div>
          <h1 className="font-bold text-lg text-orange-500">{tenant.name}</h1>
          <p className="text-xs text-gray-400">Painel de Gestão</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg text-red-400 font-bold">Sair</button>
      </header>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex space-x-1 bg-gray-900 p-1 rounded-xl border border-gray-800 mb-6 text-[11px] font-bold overflow-x-auto no-print">
        <button onClick={() => setActiveTab('products')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🍔 Itens</button>
        <button onClick={() => setActiveTab('clients')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'clients' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>👥 Clientes</button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'reports' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>📊 Financeiro</button>
        <button onClick={() => setActiveTab('tables')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'tables' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🪑 Mesas QR</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🏷️ Categorias</button>
        <button onClick={() => setActiveTab('addons')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'addons' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>➕ Adicionais</button>
        <button onClick={() => setActiveTab('neighborhoods')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'neighborhoods' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🛵 Bairros</button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 px-2.5 rounded-lg whitespace-nowrap ${activeTab === 'settings' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>⚙️ Config</button>
      </div>

      {/* ABA ITENS / PRODUTOS (COM COM MINIATURA DE FOTO) */}
      {activeTab === 'products' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">➕ Cadastrar Lanche / Item</h3>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <input type="text" placeholder="Nome do Produto" value={newProd.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} />
              <input type="text" placeholder="Descrição curta" value={newProd.description} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, description: e.target.value })} />
              
              <div className="flex space-x-2">
                <input type="text" placeholder="Preço R$" value={newProd.price} className="w-1/2 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, price: e.target.value })} />
                <select value={newProd.category_id} className="w-1/2 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, category_id: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* INPUT DE FOTO COM PRÉVIA EM TEMPO REAL */}
              <div>
                <input type="text" placeholder="URL da Foto (https://...)" value={newProd.image} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, image: e.target.value })} />
                {newProd.image && (
                  <div className="mt-2 flex items-center space-x-2 bg-gray-950 p-2 rounded-lg border border-gray-800">
                    <img src={newProd.image} alt="Prévia" className="w-10 h-10 rounded-md object-cover border border-gray-700" onError={(e) => e.target.style.display = 'none'} />
                    <span className="text-[10px] text-gray-400">Prévia da foto vinculada</span>
                  </div>
                )}
              </div>
              
              {globalAddons.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Adicionais Opcionais Vinculados:</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {globalAddons.map(a => {
                      const formattedStr = `${a.name}:${a.price}`;
                      const isSelected = (newProd.addons_list || '').includes(a.name);
                      return (
                        <label key={a.id} className="flex items-center space-x-1.5 bg-gray-800 p-2 rounded text-[11px] cursor-pointer">
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
              )}
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs hover:bg-green-700 transition">Salvar Lanche 🚀</button>
            </form>
          </section>

          {/* LISTA DE PRODUTOS COM EXIBIÇÃO DA MINIATURA */}
          <section className="space-y-2">
            <h3 className="font-bold text-sm text-gray-300">📋 Produtos ({products.length})</h3>
            {products.map((item) => (
              <div key={item.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center space-x-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <img 
                    src={item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} 
                    alt={item.name} 
                    className="w-12 h-12 rounded-lg object-cover border border-gray-800 bg-gray-800 shrink-0" 
                  />
                  <div className="truncate">
                    <span className={`font-bold text-xs block truncate ${!item.active ? 'line-through text-gray-500' : 'text-white'}`}>{item.name}</span>
                    <span className="text-xs text-orange-400 font-bold">R$ {Number(item.price).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button onClick={() => setEditingProduct(item)} className="text-xs bg-blue-600/20 text-blue-400 p-1.5 rounded-lg font-bold border border-blue-500/30">✏️ Editar</button>
                  <button onClick={async () => { await supabase.from('products').update({ active: !item.active }).eq('id', item.id); fetchData(); }} className={`text-[10px] font-bold px-2 py-1.5 rounded-lg ${item.active ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{item.active ? 'Ativo' : 'Pausado'}</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { await supabase.from('products').delete().eq('id', item.id); fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-1.5 rounded-lg font-bold">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ABA DE CLIENTES E RANKING DOS MELHORES */}
      {activeTab === 'clients' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2">
            <h3 className="font-bold text-sm text-orange-400">👥 Registro & Ranking de Clientes</h3>
            <p className="text-xs text-gray-400">Clientes identificados automaticamente pelo histórico de compras.</p>
          </section>

          <section className="space-y-2">
            {customerList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">Nenhum cliente cadastrado ainda.</p>
            ) : (
              customerList.map((client, idx) => (
                <div key={idx} className="bg-gray-900 p-3 rounded-xl border border-gray-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-xs text-orange-400">
                        {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : idx === 3 ? '🥉 #3' : `#${idx + 1}`}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-white">{client.name}</h4>
                        {client.phone && <p className="text-[10px] text-gray-400">📱 {client.phone}</p>}
                      </div>
                    </div>
                    
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                      R$ {client.totalSpent.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-gray-400 bg-gray-950 p-2 rounded-lg border border-gray-800/80">
                    <span>📦 <b>{client.totalOrders}</b> pedido(s)</span>
                    <span>🕒 Último: <b>{new Date(client.lastOrderDate).toLocaleDateString('pt-BR')}</b></span>
                  </div>

                  {client.phone && (
                    <button
                      onClick={() => handleOpenPromoModal(client)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center space-x-1 transition">
                      <span>📢 Enviar Promoção WhatsApp</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {/* ABA RELATÓRIOS E FINANCEIRO DETALHADO + IMPRESSÃO */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col space-y-2 bg-gray-900 p-3 rounded-xl border border-gray-800 text-xs no-print">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-bold">Período de Vendas:</span>
              <button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] transition">
                🖨️ Imprimir Relatório
              </button>
            </div>

            <div className="flex space-x-1 overflow-x-auto pb-1">
              <button onClick={() => setReportFilter('all')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>Tudo</button>
              <button onClick={() => setReportFilter('today')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === 'today' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>Hoje</button>
              <button onClick={() => setReportFilter('7days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '7days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>7 Dias</button>
              <button onClick={() => setReportFilter('30days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '30days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>30 Dias</button>
            </div>
          </div>

          {/* ÁREA IMPRESSA / EXIBIÇÃO FINANCEIRA */}
          <div className="print-area space-y-4">
            <div className="hidden print:block text-center border-b border-black pb-2 mb-2">
              <h2 className="font-bold text-base">{tenant.name}</h2>
              <p className="text-xs">RELATÓRIO FINANCIAL DE VENDAS</p>
              <p className="text-[10px]">Data: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-[11px] text-gray-400 block mb-1 print:text-black">Faturamento Total</span>
                <span className="text-lg font-bold text-green-400 print:text-black">R$ {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 print:border-black print:bg-white print:text-black">
                <span className="text-[11px] text-gray-400 block mb-1 print:text-black">Total de Pedidos</span>
                <span className="text-lg font-bold text-orange-400 print:text-black">{filteredOrders.length}</span>
              </div>
            </div>

            {/* DETALHAMENTO DE VALORES */}
            <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2 text-xs print:border-black print:bg-white print:text-black">
              <h3 className="font-bold text-xs text-orange-400 uppercase border-b border-gray-800 pb-2 print:text-black print:border-black">💰 Detalhamento de Faturamento</h3>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">Produtos (Subtotal):</span>
                <span className="font-bold">R$ {totalSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">Taxas de Entrega:</span>
                <span className="font-bold">R$ {totalDeliveryFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-green-400 print:text-black">
                <span>TOTAL CONSOLIDADO:</span>
                <span>R$ {totalRevenue.toFixed(2)}</span>
              </div>
            </section>

            {/* DETALHAMENTO POR FORMA DE PAGAMENTO */}
            <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2 text-xs print:border-black print:bg-white print:text-black">
              <h3 className="font-bold text-xs text-orange-400 uppercase border-b border-gray-800 pb-2 print:text-black print:border-black">💳 Faturamento por Pagamento</h3>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">⚡ PIX Dinâmico / Manual:</span>
                <span className="font-bold">R$ {paymentBreakdown.pix.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">🌐 Cartão Pago Online (Site):</span>
                <span className="font-bold">R$ {paymentBreakdown.cardOnline.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">🛵 Cartão na Maquininha:</span>
                <span className="font-bold">R$ {paymentBreakdown.cardMachine.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60 print:border-black">
                <span className="text-gray-400 print:text-black">💵 Dinheiro Espécie:</span>
                <span className="font-bold">R$ {paymentBreakdown.dinheiro.toFixed(2)}</span>
              </div>
              {paymentBreakdown.other > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-400 print:text-black">📌 Pagar no Balcão / Outros:</span>
                  <span className="font-bold">R$ {paymentBreakdown.other.toFixed(2)}</span>
                </div>
              )}
            </section>

            {/* ITENS MAIS VENDIDOS */}
            <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 print:border-black print:bg-white print:text-black">
              <h3 className="font-bold text-xs text-orange-400 uppercase tracking-wider print:text-black">🏆 ITENS MAIS VENDIDOS</h3>
              <div className="space-y-2">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum pedido registrado ainda.</p>
                ) : (
                  topProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-800 p-2.5 rounded-lg text-xs print:bg-white print:border-b print:border-black">
                      <span className="font-bold text-white print:text-black">{idx + 1}. {p.name}</span>
                      <span className="bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-md font-bold print:text-black">{p.qty} un.</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ZERAR DADOS DE TESTE */}
          <section className="bg-gray-900 p-4 rounded-xl border border-red-500/30 flex justify-between items-center mt-4 no-print">
            <div>
              <h4 className="font-bold text-xs text-red-400">🧹 Zerar Dados de Teste</h4>
              <p className="text-[10px] text-gray-400">Apaga todo o histórico de pedidos para recomeçar do zero.</p>
            </div>
            <button
              type="button"
              onClick={handleClearFinancialData}
              className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/40 px-3 py-2 rounded-xl text-xs font-bold transition">
              🗑️ Limpar
            </button>
          </section>
        </div>
      )}

      {/* ABA MESAS QR CODE */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 no-print">
            <h3 className="font-bold text-sm text-orange-400">🪑 Gerador de QR Code por Mesa</h3>
            <p className="text-xs text-gray-400">Defina a quantidade de mesas para gerar os links e QR Codes prontos para impressão.</p>
            
            <div className="flex items-center space-x-2 pt-1">
              <label className="text-xs font-bold text-gray-300 whitespace-nowrap">Qtd de Mesas:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={tableCount}
                onChange={(e) => setTableCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white text-center font-bold"
              />
            </div>
          </section>

          <section className="space-y-3 print-tables-area">
            <div className="flex justify-between items-center no-print">
              <h4 className="font-bold text-xs text-gray-300">Cartões para Impressão ({tableCount} mesas)</h4>
              <button 
                onClick={() => window.print()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition">
                🖨️ Imprimir Cartões
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: tableCount }, (_, i) => {
                const tableNum = String(i + 1).padStart(2, '0');
                const tableUrl = `${baseUrl}/${tenant.slug}?mesa=${tableNum}`;
                const qrCodeApi = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tableUrl)}`;

                return (
                  <div key={i} className="bg-gray-900 p-3 rounded-2xl border border-gray-800 flex flex-col items-center space-y-2 text-center print:bg-white print:border-black print:text-black">
                    <span className="font-extrabold text-sm text-orange-400 print:text-black">{tenant.name}</span>
                    <span className="font-bold text-xs bg-orange-500 text-white px-2 py-0.5 rounded-md print:bg-black print:text-white">MESA {tableNum}</span>
                    <img src={qrCodeApi} alt={`Mesa ${tableNum}`} className="w-28 h-28 rounded-xl bg-white p-1.5 border border-gray-700 shadow" />
                    <span className="text-[9px] opacity-70">Escaneie para fazer seu pedido</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ADICIONAIS */}
      {activeTab === 'addons' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">➕ Novo Adicional Opcional</h3>
            <form onSubmit={handleAddGlobalAddon} className="space-y-3">
              <input type="text" placeholder="Nome Ex: Bacon Extra" value={newAddon.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })} />
              <input type="text" placeholder="Valor R$ Ex: 3.50" value={newAddon.price} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })} />
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs">Cadastrar Adicional</button>
            </form>
          </section>
          <section className="space-y-2">
            {globalAddons.map((a) => (
              <div key={a.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold block text-white">{a.name}</span>
                  <span className="text-orange-400 font-bold">+ R$ {Number(a.price).toFixed(2)}</span>
                </div>
                <div className="flex space-x-1.5">
                  <button onClick={() => setEditingAddon(a)} className="text-xs bg-blue-600/20 text-blue-400 p-1.5 rounded-lg font-bold border border-blue-500/30">✏️ Editar</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { await supabase.from('global_addons').delete().eq('id', a.id); fetchData(); } }} className="text-red-400 font-bold p-1">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* BAIRROS */}
      {activeTab === 'neighborhoods' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">🛵 Novo Bairro</h3>
            <form onSubmit={handleAddNeighborhood} className="space-y-3">
              <input type="text" placeholder="Nome do Bairro" value={newNeigh.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewNeigh({ ...newNeigh, name: e.target.value })} />
              <input type="text" placeholder="Taxa R$" value={newNeigh.fee} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewNeigh({ ...newNeigh, fee: e.target.value })} />
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs">Cadastrar Bairro</button>
            </form>
          </section>
          <section className="space-y-2">
            {neighborhoods.map((n) => (
              <div key={n.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold block text-white">{n.name}</span>
                  <span className="text-orange-400 font-bold">Taxa: R$ {Number(n.fee).toFixed(2)}</span>
                </div>
                <div className="flex space-x-1.5">
                  <button onClick={() => setEditingNeigh(n)} className="text-xs bg-blue-600/20 text-blue-400 p-1.5 rounded-lg font-bold border border-blue-500/30">✏️ Editar</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { await supabase.from('neighborhoods').delete().eq('id', n.id); fetchData(); } }} className="text-red-400 font-bold p-1">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* CATEGORIAS */}
      {activeTab === 'categories' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">🏷️ Nova Categoria</h3>
            <form onSubmit={handleAddCategory} className="flex space-x-2">
              <input type="text" placeholder="Nome" value={newCatName} className="flex-1 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewCatName(e.target.value)} />
              <button type="submit" className="bg-green-600 font-bold px-4 py-2.5 rounded-lg text-xs">Adicionar</button>
            </form>
          </section>
          <section className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                <span className="font-bold text-white">{c.name}</span>
                <div className="flex space-x-1.5">
                  <button onClick={() => setEditingCategory(c)} className="text-xs bg-blue-600/20 text-blue-400 p-1.5 rounded-lg font-bold border border-blue-500/30">✏️ Editar</button>
                  <button onClick={async () => { if (confirm("Excluir?")) { await supabase.from('categories').delete().eq('id', c.id); fetchData(); } }} className="text-red-400 font-bold p-1">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* CONFIGURAÇÕES DA LOJA */}
      {activeTab === 'settings' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">⚙️ Configurações da Loja</h3>
            <form onSubmit={handleSaveTenantSettings} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Nome da Loja:</label>
                <input type="text" value={tenant.name || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Link do Instagram:</label>
                <input 
                  type="text" 
                  placeholder="Ex: https://instagram.com/pizzaria_top" 
                  value={tenant.instagram_url || ''} 
                  className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" 
                  onChange={(e) => setTenant({ ...tenant, instagram_url: e.target.value })} 
                />
              </div>

              {/* HORÁRIOS E DIAS DE FUNCIONAMENTO */}
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <label className="text-[11px] font-bold text-orange-400 block">🛵 Dias de Funcionamento do Delivery:</label>
                  <div className="flex space-x-1 text-[10px]">
                    <button type="button" onClick={() => setTenant({ ...tenant, work_days: [1, 2, 3, 4, 5] })} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-bold">Seg-Sex</button>
                    <button type="button" onClick={() => setTenant({ ...tenant, work_days: [1, 2, 3, 4, 5, 6] })} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-bold">Seg-Sáb</button>
                    <button type="button" onClick={() => setTenant({ ...tenant, work_days: [0, 1, 2, 3, 4, 5, 6] })} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-bold">Todos</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {ALL_DAYS.map(day => {
                    const isSelected = (tenant.work_days || []).includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setTenant({ ...tenant, work_days: toggleDaySelection(tenant.work_days, day.id) })}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-900 text-gray-500 border-gray-800'}`}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/80">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Horário Abertura:</label>
                    <input type="time" value={tenant.opening_time || '18:00'} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, opening_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Horário Fechamento:</label>
                    <input type="time" value={tenant.closing_time || '23:30'} className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, closing_time: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">ID do Pixel do Meta (Facebook/Instagram):</label>
                <input type="text" placeholder="Ex: 123456789012345" value={tenant.pixel_id || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none font-mono" onChange={(e) => setTenant({ ...tenant, pixel_id: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Aviso/Instrução Adicional no Pedido:</label>
                <input type="text" placeholder="Ex: Chave PIX: CNPJ 00.000.000/0001-00. Entrega em 40 min." value={tenant.custom_message || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, custom_message: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL da Logo (Perfil):</label>
                <input type="text" value={tenant.logo_url || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL do Banner (Capa):</label>
                <input type="text" value={tenant.banner_url || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, banner_url: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URLs dos Banners de Promoção (Separados por vírgula):</label>
                <input type="text" placeholder="https://link1.com, https://link2.com" value={tenant.promo_banners || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, promo_banners: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Cor Principal:</label>
                  <input type="color" value={tenant.primary_color || '#FF8C00'} onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })} className="h-9 w-full bg-gray-800 rounded cursor-pointer" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Cor Secundária:</label>
                  <input type="color" value={tenant.secondary_color || '#111827'} onChange={(e) => setTenant({ ...tenant, secondary_color: e.target.value })} className="h-9 w-full bg-gray-800 rounded cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">WhatsApp:</label>
                <input type="text" value={tenant.whatsapp || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, whatsapp: e.target.value })} />
              </div>

              {/* PIX DINÂMICO E PAGAMENTOS AUTOMÁTICOS */}
              <div className="pt-3 border-t border-gray-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-green-400">⚡ PIX Dinâmico com Baixa Automática</h4>
                    <p className="text-[10px] text-gray-400">Confirma o pagamento sozinho sem conferir comprovante.</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={tenant.pix_enabled || false}
                    onChange={(e) => setTenant({ ...tenant, pix_enabled: e.target.checked })}
                    className="w-4 h-4 accent-green-500 cursor-pointer"
                  />
                </div>

                {tenant.pix_enabled && (
                  <div className="space-y-2 bg-gray-800/60 p-3 rounded-xl border border-gray-700">
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Gateway de Pagamento:</label>
                      <select
                        value={tenant.pix_provider || 'mercadopago'}
                        onChange={(e) => setTenant({ ...tenant, pix_provider: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none">
                        <option value="mercadopago">Mercado Pago</option>
                        <option value="efi">Efí (Gerencianet)</option>
                        <option value="asaas">Asaas</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Token de Acesso / Chave de API:</label>
                      <input
                        type="password"
                        placeholder="Ex: APP_USR-xxxx-xxxx..."
                        value={tenant.pix_access_token || ''}
                        className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white focus:outline-none"
                        onChange={(e) => setTenant({ ...tenant, pix_access_token: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs transition hover:bg-green-700">
                Salvar Alterações
              </button>
            </form>
          </section>
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
              className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
            />

            <div className="flex space-x-2">
              <button type="button" onClick={() => setSelectedPromoClient(null)} className="w-1/2 bg-gray-800 py-2 rounded-lg text-xs">Cancelar</button>
              <button type="button" onClick={handleSendPromoWhatsapp} className="w-1/2 bg-green-600 hover:bg-green-700 py-2 rounded-lg text-xs font-bold text-white">Enviar 🚀</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE EDIÇÃO */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateAddon} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Adicional</h3>
            <input type="text" value={editingAddon.name} onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <input type="text" value={editingAddon.price} onChange={(e) => setEditingAddon({ ...editingAddon, price: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingAddon(null)} className="w-1/2 bg-gray-800 py-2 rounded-lg text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2 rounded-lg text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {editingNeigh && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateNeigh} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Bairro</h3>
            <input type="text" value={editingNeigh.name} onChange={(e) => setEditingNeigh({ ...editingNeigh, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <input type="text" value={editingNeigh.fee} onChange={(e) => setEditingNeigh({ ...editingNeigh, fee: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingNeigh(null)} className="w-1/2 bg-gray-800 py-2 rounded-lg text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2 rounded-lg text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateCategory} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Categoria</h3>
            <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <div className="flex space-x-2"><button type="button" onClick={() => setEditingCategory(null)} className="w-1/2 bg-gray-800 py-2 rounded-lg text-xs">Cancelar</button><button type="submit" className="w-1/2 bg-blue-600 py-2 rounded-lg text-xs font-bold text-white">Salvar</button></div>
          </form>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateProduct} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Produto</h3>
            <input type="text" value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            <input type="text" value={editingProduct.description || ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            
            <div className="flex space-x-2">
              <input type="text" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} className="w-1/2 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
              <select value={editingProduct.category_id} onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })} className="w-1/2 bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <input type="text" placeholder="URL da Foto" value={editingProduct.image || ''} onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
              {editingProduct.image && (
                <div className="mt-2 flex items-center space-x-2 bg-gray-950 p-2 rounded-lg border border-gray-800">
                  <img src={editingProduct.image} alt="Prévia" className="w-10 h-10 rounded-md object-cover border border-gray-700" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-[10px] text-gray-400">Prévia da imagem</span>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setEditingProduct(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-lg text-xs font-bold text-gray-300">Cancelar</button>
              <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-lg text-xs font-bold text-white">Atualizar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
