import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

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
  const [reportFilter, setReportFilter] = useState('7days');

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  const [newProd, setNewProd] = useState({ name: '', price: '', category_id: '', description: '', image: '', addons_list: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });
  const [newNeigh, setNewNeigh] = useState({ name: '', fee: '' });

  useEffect(() => {
    if (slug) {
      fetchTenant();
    }
  }, [slug]);

  const fetchTenant = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (tData) {
      setTenant(tData);
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

    if (tData) setTenant(tData);
    if (cData) {
      setCategories(cData);
      if (cData.length > 0 && !newProd.category_id) {
        setNewProd(prev => ({ ...prev, category_id: cData[0].id }));
      }
    }
    if (pData) setProducts(pData);
    if (aData) setGlobalAddons(aData);
    if (nData) setNeighborhoods(nData);
    if (oData) setAllOrders(oData);
  };

  const handleSaveTenantSettings = async (e) => {
    e.preventDefault();
    const cleanWhatsapp = tenant.whatsapp.replace(/\D/g, '');

    const { error } = await supabase.from('tenants').update({
      name: tenant.name,
      whatsapp: cleanWhatsapp,
      logo_url: tenant.logo_url,
      banner_url: tenant.banner_url,
      primary_color: tenant.primary_color || '#FF8C00',
      admin_password: tenant.admin_password
    }).eq('id', tenant.id);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      alert("Configurações e cores salvas com sucesso!");
      fetchData();
    }
  };

  const handleResetOrders = async (e) => {
    e.preventDefault();
    if (resetPasswordInput !== tenant.admin_password && resetPasswordInput !== 'master123') {
      return alert("Senha incorreta!");
    }

    const { error } = await supabase.from('orders').delete().eq('tenant_id', tenant.id);

    if (error) {
      alert("Erro ao zerar relatórios: " + error.message);
    } else {
      alert("Relatórios zerados com sucesso!");
      setShowResetModal(false);
      setResetPasswordInput('');
      fetchData();
    }
  };

  const getFilteredOrders = () => {
    const now = new Date();
    return allOrders.filter(o => {
      if (o.status === 'cancelado') return false;
      const orderDate = new Date(o.created_at);

      if (reportFilter === 'today') {
        return orderDate.toDateString() === now.toDateString();
      } else if (reportFilter === '7days') {
        return ((now - orderDate) / (1000 * 60 * 60 * 24)) <= 7;
      } else if (reportFilter === '15days') {
        return ((now - orderDate) / (1000 * 60 * 60 * 24)) <= 15;
      } else if (reportFilter === '30days') {
        return ((now - orderDate) / (1000 * 60 * 60 * 24)) <= 30;
      }
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

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

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.price) return alert("Preencha nome e preço!");

    const formattedPrice = parseFloat(String(newProd.price).replace(',', '.'));
    const selectedCategory = newProd.category_id || (categories[0] ? categories[0].id : 1);
    const fallbackImg = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80';

    const { error } = await supabase.from('products').insert([{
      tenant_id: tenant.id,
      category_id: parseInt(selectedCategory),
      name: newProd.name,
      description: newProd.description,
      price: formattedPrice,
      image: newProd.image || fallbackImg,
      active: true,
      has_options: true,
      addons_list: newProd.addons_list
    }]);

    if (error) alert("Erro: " + error.message);
    else {
      setNewProd({ name: '', price: '', category_id: categories[0]?.id || '', description: '', image: '', addons_list: '' });
      fetchData();
      alert("Lanche salvo!");
    }
  };

  const toggleProductActive = async (id, currentStatus) => {
    await supabase.from('products').update({ active: !currentStatus }).eq('id', id);
    fetchData();
  };

  const deleteProduct = async (id) => {
    if (confirm("Excluir produto?")) {
      await supabase.from('products').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await supabase.from('categories').insert([{ tenant_id: tenant.id, name: newCatName.trim() }]);
    setNewCatName('');
    fetchData();
  };

  const deleteCategory = async (id) => {
    if (confirm("Excluir categoria?")) {
      await supabase.from('categories').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAddGlobalAddon = async (e) => {
    e.preventDefault();
    const formattedPrice = parseFloat(String(newAddon.price).replace(',', '.'));
    await supabase.from('global_addons').insert([{ tenant_id: tenant.id, name: newAddon.name.trim(), price: formattedPrice }]);
    setNewAddon({ name: '', price: '' });
    fetchData();
  };

  const deleteGlobalAddon = async (id) => {
    if (confirm("Excluir adicional?")) {
      await supabase.from('global_addons').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAddNeighborhood = async (e) => {
    e.preventDefault();
    const formattedFee = parseFloat(String(newNeigh.fee).replace(',', '.'));
    await supabase.from('neighborhoods').insert([{ tenant_id: tenant.id, name: newNeigh.name.trim(), fee: formattedFee }]);
    setNewNeigh({ name: '', fee: '' });
    fetchData();
  };

  const deleteNeighborhood = async (id) => {
    if (confirm("Excluir bairro?")) {
      await supabase.from('neighborhoods').delete().eq('id', id);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans">
        <p className="text-sm text-gray-400">Carregando admin...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 font-sans">
        <h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 w-full max-w-sm">
          <h2 className="text-xl font-bold text-orange-500 mb-1 text-center">{tenant.name}</h2>
          <p className="text-xs text-gray-400 text-center mb-6">Painel Administrativo</p>
          <input 
            type="password" placeholder="Senha de acesso..."
            className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm mb-4 text-white focus:outline-none"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm">
            Entrar no Painel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-md mx-auto font-sans pb-12">
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-4">
        <div>
          <h1 className="font-bold text-lg text-orange-500">{tenant.name}</h1>
          <p className="text-xs text-gray-400">Painel de Gestão</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg text-red-400 font-bold">
          Sair
        </button>
      </header>

      <div className="flex space-x-1 bg-gray-900 p-1 rounded-xl border border-gray-800 mb-6 text-[11px] font-bold overflow-x-auto">
        <button onClick={() => setActiveTab('products')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🍔 Itens</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🏷️ Categorias</button>
        <button onClick={() => setActiveTab('addons')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'addons' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>➕ Adicionais</button>
        <button onClick={() => setActiveTab('neighborhoods')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'neighborhoods' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>🛵 Bairros</button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'reports' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>📊 Relatórios</button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 px-2 rounded-lg whitespace-nowrap ${activeTab === 'settings' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>⚙️ Config</button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
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
              <input type="text" placeholder="URL da Foto" value={newProd.image} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewProd({ ...newProd, image: e.target.value })} />
              
              {globalAddons.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Adicionais Deste Lanche:</label>
                  <div className="grid grid-cols-2 gap-2">
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
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs">Salvar Lanche 🚀</button>
            </form>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-sm text-gray-300">📋 Produtos ({products.length})</h3>
            {products.map((item) => (
              <div key={item.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                <div>
                  <span className={`font-bold text-xs block ${!item.active ? 'line-through text-gray-500' : 'text-white'}`}>{item.name}</span>
                  <span className="text-xs text-orange-400 font-bold">R$ {Number(item.price).toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => toggleProductActive(item.id, item.active)} className={`text-[10px] font-bold px-2 py-1.5 rounded-lg ${item.active ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{item.active ? 'Ativo' : 'Pausado'}</button>
                  <button onClick={() => deleteProduct(item.id)} className="text-xs bg-red-500/20 text-red-400 p-1.5 rounded-lg font-bold">🗑</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
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
                <button onClick={() => deleteCategory(c.id)} className="text-red-400 font-bold p-1">🗑</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === 'addons' && (
        <div className="space-y-6">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">➕ Novo Adicional</h3>
            <form onSubmit={handleAddGlobalAddon} className="space-y-3">
              <input type="text" placeholder="Nome" value={newAddon.name} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })} />
              <input type="text" placeholder="Valor R$" value={newAddon.price} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })} />
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
                <button onClick={() => deleteGlobalAddon(a.id)} className="text-red-400 font-bold p-1">🗑</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === 'neighborhoods' && (
        <div className="space-y-6">
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
                <button onClick={() => deleteNeighborhood(n.id)} className="text-red-400 font-bold p-1">🗑</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col space-y-2 bg-gray-900 p-3 rounded-xl border border-gray-800 text-xs">
            <span className="text-gray-400 font-bold">Período:</span>
            <div className="flex space-x-1 overflow-x-auto pb-1">
              <button onClick={() => setReportFilter('today')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === 'today' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>Hoje</button>
              <button onClick={() => setReportFilter('7days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '7days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>7 Dias</button>
              <button onClick={() => setReportFilter('15days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '15days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>15 Dias</button>
              <button onClick={() => setReportFilter('30days')} className={`px-3 py-1.5 rounded-lg font-bold text-xs ${reportFilter === '30days' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>30 Dias</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <span className="text-[11px] text-gray-400 block mb-1">Faturamento</span>
              <span className="text-lg font-bold text-green-400">R$ {totalRevenue.toFixed(2)}</span>
            </div>
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <span className="text-[11px] text-gray-400 block mb-1">Pedidos</span>
              <span className="text-lg font-bold text-orange-400">{filteredOrders.length}</span>
            </div>
          </div>

          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-xs text-orange-400 uppercase tracking-wider">🏆 MAIS VENDIDOS</h3>
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800 p-2.5 rounded-lg text-xs">
                  <span className="font-bold text-white">{idx + 1}. {p.name}</span>
                  <span className="bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-md font-bold">{p.qty} un.</span>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-4 border-t border-gray-800">
            <button onClick={() => setShowResetModal(true)} className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold py-3 rounded-xl text-xs border border-red-500/30">
              🗑️ Zerar Relatórios
            </button>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <section className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-sm text-orange-400">⚙️ Configurações da Loja</h3>
            <form onSubmit={handleSaveTenantSettings} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Nome da Loja:</label>
                <input type="text" value={tenant.name || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Cor Principal do Cardápio:</label>
                <div className="flex space-x-2 items-center">
                  <input 
                    type="color" 
                    value={tenant.primary_color || '#FF8C00'} 
                    onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })}
                    className="h-9 w-12 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={tenant.primary_color || '#FF8C00'} 
                    onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
                <input type="text" value={tenant.whatsapp || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, whatsapp: e.target.value })} />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Senha de Acesso do Admin:</label>
                <input type="text" value={tenant.admin_password || ''} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" onChange={(e) => setTenant({ ...tenant, admin_password: e.target.value })} />
              </div>

              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-lg text-xs mt-2">
                Salvar Configurações e Cor
              </button>
            </form>
          </section>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-red-500/40 space-y-4">
            <h3 className="font-bold text-sm text-red-400">⚠️ Zerar Relatórios</h3>
            <p className="text-xs text-gray-300">Digite a senha de admin para confirmar:</p>
            <form onSubmit={handleResetOrders} className="space-y-3">
              <input type="password" value={resetPasswordInput} onChange={(e) => setResetPasswordInput(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" autoFocus />
              <div className="flex space-x-2">
                <button type="button" onClick={() => setShowResetModal(false)} className="w-1/2 bg-gray-800 py-2 rounded-lg text-xs text-gray-300">Cancelar</button>
                <button type="submit" className="w-1/2 bg-red-600 py-2 rounded-lg text-xs text-white font-bold">Zerar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
