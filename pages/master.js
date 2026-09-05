import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MasterAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [tenants, setTenants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [copiedTenantId, setCopiedTenantId] = useState(null);

  // FORMULÁRIO DE NOVO CLIENTE
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    whatsapp: '',
    logo_url: '',
    banner_url: '',
    primary_color: '#FF8C00',       // Cor do Botão
    button_text_color: '#FFFFFF',   // Texto do Botão
    secondary_color: '#090D16',     // Fundo do Site
    card_bg_color: '#111827',       // Fundo dos Cards
    text_color: '#FFFFFF',          // Texto Geral do Site
    due_date: '',
    monthly_fee: '99.99',
    admin_password: '',
    business_type: 'delivery'
  });

  // ESTADO DE EDIÇÃO DE CLIENTE EXISTENTE
  const [editingTenant, setEditingTenant] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (masterPassword === 'master123' || masterPassword === 'sinerge2026') {
      setIsAuthenticated(true);
      fetchTenants();
    } else {
      alert('Senha master incorreta!');
    }
  };

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('*').order('id', { ascending: false });
    if (data) setTenants(data);
  };

  // PREDEFINIÇÕES RÁPIDAS DE CORES PARA NOVO CLIENTE
  const applyPreset = (type) => {
    if (type === 'dark_orange') {
      setNewTenant(prev => ({
        ...prev,
        primary_color: '#FF8C00',
        button_text_color: '#FFFFFF',
        secondary_color: '#090D16',
        card_bg_color: '#111827',
        text_color: '#FFFFFF'
      }));
    } else if (type === 'light_pink') {
      setNewTenant(prev => ({
        ...prev,
        primary_color: '#EC4899',
        button_text_color: '#FFFFFF',
        secondary_color: '#F9FAFB',
        card_bg_color: '#FFFFFF',
        text_color: '#111827'
      }));
    } else if (type === 'purple_barber') {
      setNewTenant(prev => ({
        ...prev,
        primary_color: '#A855F7',
        button_text_color: '#FFFFFF',
        secondary_color: '#0F172A',
        card_bg_color: '#1E293B',
        text_color: '#F8FAFC'
      }));
    }
  };

  // PREDEFINIÇÕES RÁPIDAS DE CORES PARA EDIÇÃO
  const applyEditPreset = (type) => {
    if (!editingTenant) return;
    if (type === 'dark_orange') {
      setEditingTenant(prev => ({
        ...prev,
        primary_color: '#FF8C00',
        button_text_color: '#FFFFFF',
        secondary_color: '#090D16',
        card_bg_color: '#111827',
        text_color: '#FFFFFF'
      }));
    } else if (type === 'light_pink') {
      setEditingTenant(prev => ({
        ...prev,
        primary_color: '#EC4899',
        button_text_color: '#FFFFFF',
        secondary_color: '#F9FAFB',
        card_bg_color: '#FFFFFF',
        text_color: '#111827'
      }));
    } else if (type === 'purple_barber') {
      setEditingTenant(prev => ({
        ...prev,
        primary_color: '#A855F7',
        button_text_color: '#FFFFFF',
        secondary_color: '#0F172A',
        card_bg_color: '#1E293B',
        text_color: '#F8FAFC'
      }));
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug || !newTenant.whatsapp) {
      return alert("Preencha Nome, Slug (link) e WhatsApp!");
    }

    const cleanSlug = newTenant.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const cleanPhone = newTenant.whatsapp.replace(/\D/g, '');

    const fallbackLogo = 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80';
    const fallbackBanner = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';

    const isDelivery = newTenant.business_type === 'delivery';
    const isAgendamento = newTenant.business_type === 'agendamento';

    const { data, error } = await supabase.from('tenants').insert([{
      name: newTenant.name.trim(),
      slug: cleanSlug,
      whatsapp: cleanPhone,
      logo_url: newTenant.logo_url || fallbackLogo,
      banner_url: newTenant.banner_url || fallbackBanner,
      admin_password: newTenant.admin_password || '123456',
      primary_color: newTenant.primary_color || '#FF8C00',
      button_text_color: newTenant.button_text_color || '#FFFFFF',
      secondary_color: newTenant.secondary_color || '#090D16',
      card_bg_color: newTenant.card_bg_color || '#111827',
      text_color: newTenant.text_color || '#FFFFFF',
      due_date: newTenant.due_date || null,
      monthly_fee: parseFloat(newTenant.monthly_fee) || 99.00,
      active: true,
      has_delivery: isDelivery,
      has_agendamento: isAgendamento
    }]).select().single();

    if (error) {
      alert("Erro ao criar cliente: " + error.message);
    } else {
      if (isDelivery) {
        await supabase.from('categories').insert([
          { tenant_id: data.id, name: 'Lanches' },
          { tenant_id: data.id, name: 'Bebidas' }
        ]);
      }

      alert(`Cliente "${data.name}" criado com sucesso!\nSlug: /${data.slug}`);
      setNewTenant({
        name: '', slug: '', whatsapp: '', logo_url: '', banner_url: '',
        primary_color: '#FF8C00', button_text_color: '#FFFFFF',
        secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF',
        due_date: '', monthly_fee: '99.00', admin_password: '',
        business_type: 'delivery'
      });
      fetchTenants();
    }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!editingTenant) return;

    const cleanPhone = editingTenant.whatsapp ? editingTenant.whatsapp.replace(/\D/g, '') : '';

    const { error } = await supabase.from('tenants').update({
      name: editingTenant.name.trim(),
      whatsapp: cleanPhone,
      admin_password: editingTenant.admin_password,
      monthly_fee: parseFloat(editingTenant.monthly_fee) || 99.00,
      due_date: editingTenant.due_date || null,
      logo_url: editingTenant.logo_url,
      banner_url: editingTenant.banner_url,
      primary_color: editingTenant.primary_color,
      button_text_color: editingTenant.button_text_color,
      secondary_color: editingTenant.secondary_color,
      card_bg_color: editingTenant.card_bg_color,
      text_color: editingTenant.text_color
    }).eq('id', editingTenant.id);

    if (error) {
      alert("Erro ao atualizar cliente: " + error.message);
    } else {
      alert("Cliente atualizado com sucesso!");
      setEditingTenant(null);
      fetchTenants();
    }
  };

  const toggleTenantActive = async (id, currentStatus) => {
    await supabase.from('tenants').update({ active: !currentStatus }).eq('id', id);
    fetchTenants();
  };

  const handleDeleteTenant = async (id, name) => {
    if (confirm(`TEM CERTEZA que deseja apagar o cliente "${name}"?\nIsso apaga todos os dados definitivamente!`)) {
      await supabase.from('tenants').delete().eq('id', id);
      fetchTenants();
      alert(`Cliente ${name} removido com sucesso.`);
    }
  };

  // COPIAR MENSAGEM DE BOAS-VINDAS PARA WHATSAPP
  const handleCopyOnboardingMsg = (tenant) => {
    const isAgendamento = tenant.has_agendamento && !tenant.has_delivery;
    const portalUrl = isAgendamento ? 'https://agendamento.sinergemkt.com' : 'https://delivery.sinergemkt.com';
    const systemName = isAgendamento ? 'Sinerge Agendamento' : 'Sinerge Delivery';
    const emoji = isAgendamento ? '✂️' : '🍔';

    const text = `${emoji} *Seu Acesso ao ${systemName}!*\n\n` +
      `Olá! Seu sistema está pronto e liberado.\n\n` +
      `🔗 *Acesse o Portal:* ${portalUrl}\n` +
      `🔑 *Seu Identificador (Slug):* \`${tenant.slug}\`\n` +
      `🔐 *Sua Senha Admin:* \`${tenant.admin_password}\`\n\n` +
      `_Ao entrar, você poderá gerenciar seu painel, configurar seu cardápio/agenda e pegar o link público da sua loja!_`;

    navigator.clipboard.writeText(text);
    setCopiedTenantId(tenant.id);
    setTimeout(() => setCopiedTenantId(null), 2500);
  };

  // CÁLCULOS DE MÉTRICAS (MRR & TOTALIZADORES)
  const activeTenants = tenants.filter(t => t.active);
  const totalMRR = activeTenants.reduce((acc, t) => acc + Number(t.monthly_fee || 0), 0);
  const deliveryCount = tenants.filter(t => t.has_delivery || !t.has_agendamento).length;
  const agendamentoCount = tenants.filter(t => t.has_agendamento && !t.has_delivery).length;

  // FILTRAGEM DA LISTA
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const isAgendamento = t.has_agendamento && !t.has_delivery;

    if (!matchesSearch) return false;
    if (filterType === 'DELIVERY') return !isAgendamento;
    if (filterType === 'AGENDAMENTO') return isAgendamento;
    if (filterType === 'PAUSED') return !t.active;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-3xl border border-orange-500/30 w-full max-w-sm space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500"></div>

          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl flex items-center justify-center text-xl mx-auto mb-2">
              ⚡
            </div>
            <h1 className="text-xl font-bold text-white">Sinerge Master</h1>
            <p className="text-xs text-gray-400">Painel Geral de Gestão SaaS</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 block mb-1">Senha Secreta Master:</label>
            <input 
              type="password" 
              placeholder="Digite sua senha..."
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 font-bold py-3.5 rounded-xl text-xs transition shadow-lg shadow-orange-500/20 text-white">
            Acessar Painel de Controle 🚀
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 max-w-6xl mx-auto font-sans pb-16">
      
      {/* CABEÇALHO */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-orange-500/20">
            ⚡
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Sinerge Multi-SaaS Master</h1>
            <p className="text-xs text-gray-400">Gerenciamento Geral de Clientes (Delivery & Agendamento)</p>
          </div>
        </div>

        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 px-4 py-2 rounded-xl text-red-400 font-bold transition">
          🚪 Sair
        </button>
      </header>

      {/* DASHBOARD DE MÉTRICAS DA SUA EMPRESA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-gray-400 uppercase block">Faturamento / Mês (MRR)</span>
          <span className="text-lg font-bold text-green-400">R$ {totalMRR.toFixed(2)}</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-gray-400 uppercase block">Total de Clientes</span>
          <span className="text-lg font-bold text-white">{tenants.length} <span className="text-xs text-green-400">({activeTenants.length} ativos)</span></span>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-orange-400 uppercase block">Clientes Delivery</span>
          <span className="text-lg font-bold text-orange-400">{deliveryCount}</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
          <span className="text-[10px] font-bold text-purple-400 uppercase block">Clientes Agendamento</span>
          <span className="text-lg font-bold text-purple-400">{agendamentoCount}</span>
        </div>
      </div>

      {/* CADASTRAR NOVO CLIENTE */}
      <section className="bg-gray-900 p-6 rounded-3xl border border-gray-800 space-y-5 mb-8 shadow-xl">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <h2 className="font-bold text-sm text-orange-400 flex items-center space-x-2">
            <span>➕ Cadastrar Novo Cliente / Estabelecimento</span>
          </h2>
        </div>

        <form onSubmit={handleCreateTenant} className="space-y-4">
          
          {/* SELEÇÃO DE NICHO */}
          <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 space-y-2">
            <label className="text-[11px] font-bold text-gray-300 block uppercase tracking-wider">Selecione o Nicho do Cliente:</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs transition ${
                newTenant.business_type === 'delivery' ? 'bg-orange-500/20 text-orange-400 border-orange-500' : 'bg-gray-900 text-gray-400 border-gray-800'
              }`}>
                <input 
                  type="radio" 
                  name="business_type" 
                  value="delivery" 
                  checked={newTenant.business_type === 'delivery'} 
                  onChange={() => setNewTenant({ ...newTenant, business_type: 'delivery' })}
                  className="hidden"
                />
                <span>🍔 Delivery (Alimentação)</span>
              </label>

              <label className={`flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs transition ${
                newTenant.business_type === 'agendamento' ? 'bg-purple-500/20 text-purple-400 border-purple-500' : 'bg-gray-900 text-gray-400 border-gray-800'
              }`}>
                <input 
                  type="radio" 
                  name="business_type" 
                  value="agendamento" 
                  checked={newTenant.business_type === 'agendamento'} 
                  onChange={() => setNewTenant({ ...newTenant, business_type: 'agendamento' })}
                  className="hidden"
                />
                <span>✂️ Agendamento (Barbearia/Salão)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
            <input 
              type="text" placeholder="Ex: Salão Lanna ou Hamburgueria Silva" value={newTenant.name}
              onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
              className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Slug / Identificador (Sem espaços):</label>
              <input 
                type="text" placeholder="Ex: lannadesigner" value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
              <input 
                type="text" placeholder="Ex: 47996302864" value={newTenant.whatsapp}
                onChange={(e) => setNewTenant({ ...newTenant, whatsapp: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* PERSONALIZAÇÃO DE CORES DA INTERFACE */}
          <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">🎨 Personalização das Cores do Tema:</label>
              
              <div className="flex space-x-1.5 text-[10px]">
                <button type="button" onClick={() => applyPreset('dark_orange')} className="bg-gray-900 border border-orange-500/50 text-orange-400 px-2.5 py-1 rounded-lg font-bold">Dark Laranja</button>
                <button type="button" onClick={() => applyPreset('light_pink')} className="bg-pink-500/20 border border-pink-500 text-pink-300 px-2.5 py-1 rounded-lg font-bold">Rosa / Claro</button>
                <button type="button" onClick={() => applyPreset('purple_barber')} className="bg-purple-500/20 border border-purple-500 text-purple-300 px-2.5 py-1 rounded-lg font-bold">Roxo Barber</button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Cor do Botão:</label>
                <div className="flex space-x-1.5 items-center">
                  <input type="color" value={newTenant.primary_color} onChange={(e) => setNewTenant({ ...newTenant, primary_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={newTenant.primary_color} onChange={(e) => setNewTenant({ ...newTenant, primary_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Texto do Botão:</label>
                <div className="flex space-x-1.5 items-center">
                  <input type="color" value={newTenant.button_text_color} onChange={(e) => setNewTenant({ ...newTenant, button_text_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={newTenant.button_text_color} onChange={(e) => setNewTenant({ ...newTenant, button_text_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Fundo do Site:</label>
                <div className="flex space-x-1.5 items-center">
                  <input type="color" value={newTenant.secondary_color} onChange={(e) => setNewTenant({ ...newTenant, secondary_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={newTenant.secondary_color} onChange={(e) => setNewTenant({ ...newTenant, secondary_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Fundo dos Cards:</label>
                <div className="flex space-x-1.5 items-center">
                  <input type="color" value={newTenant.card_bg_color} onChange={(e) => setNewTenant({ ...newTenant, card_bg_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={newTenant.card_bg_color} onChange={(e) => setNewTenant({ ...newTenant, card_bg_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Cor da Fonte/Texto:</label>
                <div className="flex space-x-1.5 items-center">
                  <input type="color" value={newTenant.text_color} onChange={(e) => setNewTenant({ ...newTenant, text_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={newTenant.text_color} onChange={(e) => setNewTenant({ ...newTenant, text_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                </div>
              </div>
            </div>
          </div>

          {/* DADOS FINANCEIROS E ACESSO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Data de Vencimento:</label>
              <input 
                type="date" value={newTenant.due_date}
                onChange={(e) => setNewTenant({ ...newTenant, due_date: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Mensalidade (R$):</label>
              <input 
                type="text" placeholder="99.00" value={newTenant.monthly_fee}
                onChange={(e) => setNewTenant({ ...newTenant, monthly_fee: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Senha Admin do Cliente:</label>
              <input 
                type="text" placeholder="123456" value={newTenant.admin_password}
                onChange={(e) => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 font-bold py-3.5 rounded-xl text-xs transition text-white shadow-lg shadow-green-600/20">
            🚀 Cadastrar Cliente Agora
          </button>
        </form>
      </section>

      {/* LISTA DE CLIENTES E PESQUISA */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800">
          <h2 className="font-bold text-sm text-gray-200">🏢 Clientes Cadastrados ({filteredTenants.length})</h2>

          <div className="flex space-x-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none w-full sm:w-48"
            />

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none">
              <option value="ALL">Todos os Nichos</option>
              <option value="DELIVERY">🍔 Apenas Delivery</option>
              <option value="AGENDAMENTO">✂️ Apenas Agendamento</option>
              <option value="PAUSED">🔴 Pausados</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredTenants.map(t => {
            const isAgendamento = t.has_agendamento && !t.has_delivery;
            const isCopied = copiedTenantId === t.id;

            return (
              <div key={t.id} className={`bg-gray-900 p-5 rounded-3xl border ${t.active ? 'border-gray-800' : 'border-red-500/40 opacity-80'} space-y-4 shadow-lg`}>
                
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 rounded-full inline-block border border-gray-700" style={{ backgroundColor: t.primary_color || '#FF8C00' }}></span>
                      <span className="w-3.5 h-3.5 rounded-full inline-block border border-gray-700" style={{ backgroundColor: t.secondary_color || '#090D16' }}></span>
                      
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${isAgendamento ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                        {isAgendamento ? '✂️ Agendamento' : '🍔 Delivery'}
                      </span>
                      
                      <h3 className="font-bold text-base text-white">{t.name}</h3>
                    </div>

                    <p className="text-xs text-gray-400 font-mono mt-1">Identificador (Slug): <span className="text-orange-400">/{t.slug}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      📱 Zap: <span className="text-white font-bold">{t.whatsapp}</span> • Senha Admin: <span className="font-mono text-white font-bold">{t.admin_password}</span>
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      💰 Mensalidade: <b className="text-green-400">R$ {Number(t.monthly_fee || 99).toFixed(2)}</b> • Vencimento: <span className="font-mono text-yellow-400 font-bold">{t.due_date ? t.due_date.split('-').reverse().join('/') : 'Livre'}</span>
                    </p>
                  </div>

                  {/* AÇÕES E STATUS DO CLIENTE */}
                  <div className="flex flex-col items-end space-y-2">
                    <button 
                      onClick={() => toggleTenantActive(t.id, t.active)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${t.active ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'}`}>
                      {t.active ? '🟢 Ativo' : '🔴 Pausado'}
                    </button>

                    <div className="flex space-x-1.5">
                      <button 
                        onClick={() => handleCopyOnboardingMsg(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                          isCopied ? 'bg-green-600 text-white' : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                        }`}>
                        <span>{isCopied ? '✓ Copiado!' : '💬 Enviar Acesso Zap'}</span>
                      </button>

                      <button 
                        onClick={() => setEditingTenant(t)}
                        className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition">
                        ✏️ Editar
                      </button>

                      <button 
                        onClick={() => handleDeleteTenant(t.id, t.name)}
                        className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold transition">
                        🗑
                      </button>
                    </div>
                  </div>
                </div>

                {/* LINKS DE ACESSO DO CLIENTE */}
                {isAgendamento ? (
                  <div className="pt-3 border-t border-gray-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">📅 Links do Agendamento (agendamento.sinergemkt.com):</span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <a href={`https://agendamento.sinergemkt.com/${t.slug}`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-gray-300 hover:bg-gray-800 transition">🛍️ Página do Cliente</a>
                      <a href={`https://agendamento.sinergemkt.com/${t.slug}/agenda`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-purple-400 hover:bg-gray-800 transition">📅 Painel da Agenda</a>
                      <a href={`https://agendamento.sinergemkt.com/${t.slug}/admin`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-blue-400 hover:bg-gray-800 transition">⚙️ Admin Agendamento</a>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gray-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">🍔 Links do Delivery (delivery.sinergemkt.com):</span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <a href={`https://delivery.sinergemkt.com/${t.slug}`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-gray-300 hover:bg-gray-800 transition">🍔 Cardápio Digital</a>
                      <a href={`https://delivery.sinergemkt.com/${t.slug}/cozinha`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-orange-400 hover:bg-gray-800 transition">🍳 Cozinha / Pedidos</a>
                      <a href={`https://delivery.sinergemkt.com/${t.slug}/admin`} target="_blank" rel="noreferrer" className="bg-gray-950 border border-gray-800 text-center py-2 rounded-xl font-bold text-blue-400 hover:bg-gray-800 transition">⚙️ Admin Delivery</a>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL DE EDIÇÃO DO CLIENTE */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdateTenant} className="bg-gray-900 w-full max-w-xl rounded-3xl p-6 border border-blue-500/40 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-sm text-blue-400">✏️ Editar Cliente: <span className="text-white">{editingTenant.name}</span></h3>
              <button type="button" onClick={() => setEditingTenant(null)} className="text-xs text-gray-400 hover:text-white font-bold">✕ Fechar</button>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
              <input 
                type="text" value={editingTenant.name || ''} 
                onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
                <input 
                  type="text" value={editingTenant.whatsapp || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, whatsapp: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Senha de Admin:</label>
                <input 
                  type="text" value={editingTenant.admin_password || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, admin_password: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Valor da Mensalidade (R$):</label>
                <input 
                  type="text" value={editingTenant.monthly_fee || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, monthly_fee: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Data de Vencimento:</label>
                <input 
                  type="date" value={editingTenant.due_date || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, due_date: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none cursor-pointer" 
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL da Logo:</label>
                <input 
                  type="text" value={editingTenant.logo_url || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, logo_url: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL do Banner:</label>
                <input 
                  type="text" value={editingTenant.banner_url || ''} 
                  onChange={(e) => setEditingTenant({ ...editingTenant, banner_url: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" 
                />
              </div>
            </div>

            {/* SEÇÃO DE EDITAR TEMA E CORES */}
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">🎨 Alterar Cores do Tema:</label>
                
                <div className="flex space-x-1 text-[10px]">
                  <button type="button" onClick={() => applyEditPreset('dark_orange')} className="bg-gray-900 border border-orange-500/50 text-orange-400 px-2 py-0.5 rounded font-bold">Dark</button>
                  <button type="button" onClick={() => applyEditPreset('light_pink')} className="bg-pink-500/20 border border-pink-500 text-pink-300 px-2 py-0.5 rounded font-bold">Rosa</button>
                  <button type="button" onClick={() => applyEditPreset('purple_barber')} className="bg-purple-500/20 border border-purple-500 text-purple-300 px-2 py-0.5 rounded font-bold">Roxo</button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Cor do Botão:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.primary_color || '#FF8C00'} onChange={(e) => setEditingTenant({ ...editingTenant, primary_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.primary_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, primary_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Texto do Botão:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.button_text_color || '#FFFFFF'} onChange={(e) => setEditingTenant({ ...editingTenant, button_text_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.button_text_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, button_text_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Fundo do Site:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.secondary_color || '#090D16'} onChange={(e) => setEditingTenant({ ...editingTenant, secondary_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.secondary_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, secondary_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Fundo dos Cards:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.card_bg_color || '#111827'} onChange={(e) => setEditingTenant({ ...editingTenant, card_bg_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.card_bg_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, card_bg_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Cor da Fonte/Texto:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.text_color || '#FFFFFF'} onChange={(e) => setEditingTenant({ ...editingTenant, text_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.text_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, text_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button 
                type="button" 
                onClick={() => setEditingTenant(null)} 
                className="w-1/2 bg-gray-800 text-gray-300 font-bold py-3 rounded-xl text-xs">
                Cancelar
              </button>

              <button 
                type="submit" 
                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition">
                Salvar Alterações 💾
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
