import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MasterAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [tenants, setTenants] = useState([]);

  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    whatsapp: '',
    logo_url: '',
    banner_url: '',
    primary_color: '#FF8C00',
    admin_password: ''
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (masterPassword === 'master123') {
      setIsAuthenticated(true);
      fetchTenants();
    } else {
      alert('Senha master incorreta!');
    }
  };

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('*').order('id', { ascending: true });
    if (data) setTenants(data);
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

    const { data, error } = await supabase.from('tenants').insert([{
      name: newTenant.name.trim(),
      slug: cleanSlug,
      whatsapp: cleanPhone,
      logo_url: newTenant.logo_url || fallbackLogo,
      banner_url: newTenant.banner_url || fallbackBanner,
      admin_password: newTenant.admin_password || '123456',
      primary_color: newTenant.primary_color || '#FF8C00'
    }]).select().single();

    if (error) {
      alert("Erro ao criar cliente: " + error.message);
    } else {
      await supabase.from('categories').insert([
        { tenant_id: data.id, name: 'Lanches' },
        { tenant_id: data.id, name: 'Bebidas' }
      ]);

      alert(`Restaurante "${data.name}" criado com sucesso!\nLink do Cardápio: /${data.slug}`);
      setNewTenant({ name: '', slug: '', whatsapp: '', logo_url: '', banner_url: '', primary_color: '#FF8C00', admin_password: '' });
      fetchTenants();
    }
  };

  const handleDeleteTenant = async (id, name) => {
    if (confirm(`TEM CERTEZA que deseja apagar o cliente "${name}"?\nIsso apaga todos os produtos e pedidos dele definitivamente liberando espaço!`)) {
      await supabase.from('tenants').delete().eq('id', id);
      fetchTenants();
      alert(`Cliente ${name} removido com sucesso.`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-6 rounded-2xl border border-orange-500/30 w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-orange-500">👑 Painel Super Admin</h1>
            <p className="text-xs text-gray-400">Gestão Geral do SaaS de Delivery</p>
          </div>
          <input 
            type="password" 
            placeholder="Senha Master..."
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white focus:outline-none"
          />
          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 font-bold py-3 rounded-xl text-sm transition">
            Acessar Painel Geral
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto font-sans pb-12">
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6">
        <div>
          <h1 className="font-bold text-xl text-orange-500">👑 Super Admin SaaS</h1>
          <p className="text-xs text-gray-400">Gestão de Clientes e Licenças</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg text-red-400 font-bold">
          Sair
        </button>
      </header>

      {/* CADASTRAR NOVO CLIENTE */}
      <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-4 mb-8">
        <h2 className="font-bold text-sm text-orange-400">➕ Cadastrar Novo Restaurante / Cliente</h2>
        <form onSubmit={handleCreateTenant} className="space-y-3">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
            <input 
              type="text" 
              placeholder="Ex: Santo Dog" 
              value={newTenant.name}
              onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Slug / Link (Sem espaços):</label>
              <input 
                type="text" 
                placeholder="Ex: santodog" 
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
              <input 
                type="text" 
                placeholder="Ex: 47996302864" 
                value={newTenant.whatsapp}
                onChange={(e) => setNewTenant({ ...newTenant, whatsapp: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">URL da Logo (Opcional):</label>
              <input 
                type="text" 
                placeholder="https://..." 
                value={newTenant.logo_url}
                onChange={(e) => setNewTenant({ ...newTenant, logo_url: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">URL do Banner (Opcional):</label>
              <input 
                type="text" 
                placeholder="https://..." 
                value={newTenant.banner_url}
                onChange={(e) => setNewTenant({ ...newTenant, banner_url: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Cor do Cardápio:</label>
              <div className="flex space-x-2 items-center">
                <input 
                  type="color" 
                  value={newTenant.primary_color} 
                  onChange={(e) => setNewTenant({ ...newTenant, primary_color: e.target.value })}
                  className="h-9 w-12 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                />
                <input 
                  type="text" 
                  value={newTenant.primary_color} 
                  onChange={(e) => setNewTenant({ ...newTenant, primary_color: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 p-2 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Senha Admin Dele:</label>
              <input 
                type="text" 
                placeholder="Ex: teste123" 
                value={newTenant.admin_password}
                onChange={(e) => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 font-bold py-3 rounded-xl text-xs transition">
            🚀 Criar Restaurante Agora
          </button>
        </form>
      </section>

      {/* LISTA DE CLIENTES ATIVOS */}
      <section className="space-y-3">
        <h2 className="font-bold text-sm text-gray-300">🏢 Clientes Cadastrados ({tenants.length})</h2>

        {tenants.map(t => (
          <div key={t.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full inline-block border border-gray-700" style={{ backgroundColor: t.primary_color || '#FF8C00' }}></span>
                  <h3 className="font-bold text-md text-white">{t.name}</h3>
                </div>
                <p className="text-xs text-orange-400 font-mono mt-0.5">Link: /{t.slug}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Zap: {t.whatsapp} • Senha: <span className="font-mono text-gray-200">{t.admin_password}</span></p>
              </div>

              <button 
                onClick={() => handleDeleteTenant(t.id, t.name)}
                className="bg-red-500/20 text-red-400 p-2 rounded-lg text-xs font-bold border border-red-500/30 hover:bg-red-500/30 transition">
                🗑 Excluir Cliente
              </button>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-gray-800 text-[11px]">
              <a 
                href={`/${t.slug}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-1.5 rounded-lg font-bold text-gray-300">
                🍔 Cardápio
              </a>
              <a 
                href={`/${t.slug}/cozinha`} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-1.5 rounded-lg font-bold text-orange-400">
                👨‍🍳 Cozinha
              </a>
              <a 
                href={`/${t.slug}/admin`} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-1.5 rounded-lg font-bold text-blue-400">
                ⚙️ Admin
              </a>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
