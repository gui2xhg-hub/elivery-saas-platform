import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function HomePortalDelivery() {
  const router = useRouter();

  const [slugInput, setSlugInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // VERIFICA SE JÁ EXISTE SESSÃO SALVA DO DELIVERY
  useEffect(() => {
    const savedTenant = localStorage.getItem('sinerge_authenticated_delivery_tenant');
    if (savedTenant) {
      try {
        setTenant(JSON.parse(savedTenant));
      } catch (e) {
        localStorage.removeItem('sinerge_authenticated_delivery_tenant');
      }
    }
  }, []);

  // LOGIN DO RESTAURANTE / ESTABELECIMENTO
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!slugInput || !passwordInput) return alert("Preencha o identificador (Slug) e a Senha!");

    setLoading(true);
    const cleanSlug = slugInput.toLowerCase().trim();

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', cleanSlug)
      .eq('admin_password', passwordInput)
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      alert("Identificador da loja ou Senha de Administrador incorretos!");
    } else {
      setTenant(data);
      localStorage.setItem('sinerge_authenticated_delivery_tenant', JSON.stringify(data));
    }
  };

  // DESLOGAR DA LOJA
  const handleLogout = () => {
    localStorage.removeItem('sinerge_authenticated_delivery_tenant');
    setTenant(null);
    setSlugInput('');
    setPasswordInput('');
  };

  // COPIAR LINK PÚBLICO DO CARDÁPIO
  const handleCopyPublicLink = () => {
    const publicUrl = `https://delivery.sinergemkt.com/${tenant.slug}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publicUrl = tenant ? `https://delivery.sinergemkt.com/${tenant.slug}` : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col justify-between p-4 md:p-8">
      
      {/* CABEÇALHO SUPERIOR */}
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center py-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-orange-500/20">
            🍔
          </div>
          <div>
            <h1 className="font-bold text-base text-white leading-tight">Sinerge Delivery</h1>
            <p className="text-[11px] text-gray-400">Portal do Restaurante & Cardápio SaaS</p>
          </div>
        </div>

        {tenant && (
          <button
            onClick={handleLogout}
            className="text-xs bg-gray-900 hover:bg-gray-800 text-red-400 border border-gray-800 px-3.5 py-1.5 rounded-xl font-bold transition flex items-center space-x-1">
            <span>🚪 Sair / Trocar Loja</span>
          </button>
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto w-full my-auto py-8">
        
        {!tenant ? (
          /* TELA 1: LOGIN DO DELIVERY */
          <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl flex items-center justify-center text-xl mx-auto">
                🔐
              </div>
              <h2 className="text-xl font-bold text-white">Acessar Meu Delivery</h2>
              <p className="text-xs text-gray-400">Digite seu identificador e senha de administrador para entrar.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-bold block mb-1">Identificador da Loja (Slug):</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: hamburgueria"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-xl text-white focus:outline-none focus:border-orange-500 transition text-sm"
                />
              </div>

              <div>
                <label className="text-gray-300 font-bold block mb-1">Senha de Administrador:</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-xl text-white focus:outline-none focus:border-orange-500 transition text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-xs transition shadow-lg shadow-orange-500/20">
                {loading ? 'Acessando Sistema...' : 'Entrar no Meu Delivery 🚀'}
              </button>
            </form>
          </div>
        ) : (
          /* TELA 2: PORTAL DO DELIVERY (AUTENTICADO) */
          <div className="space-y-6">
            
            {/* HERO BANNER DA LOJA */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
              <div className="flex items-center space-x-4">
                <img
                  src={tenant.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80'}
                  alt={tenant.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500/50 bg-gray-800"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-white">{tenant.name}</h2>
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      🟢 Autenticado
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Painel de controle de pedidos e cardápio digital.</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <button
                  onClick={() => router.push(`/${tenant.slug}/admin`)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-3 rounded-xl text-xs transition shadow-lg shadow-orange-500/20 w-full md:w-auto text-center">
                  ⚙️ Gestão de Cardápio
                </button>
              </div>
            </div>

            {/* CARDS DE MÓDULOS DE TRABALHO */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                📌 O que você deseja acessar agora?
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* CARD 1: PAINEL ADMIN */}
                <div
                  onClick={() => router.push(`/${tenant.slug}/admin`)}
                  className="bg-gray-900 border border-gray-800 hover:border-orange-500/50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center text-lg">
                    ⚙️
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-orange-400 transition">Painel Administrativo</h4>
                    <p className="text-xs text-gray-400 mt-1">Gerencie produtos do cardápio, adicionais, bairros, taxas e horários.</p>
                  </div>
                  <span className="text-xs font-bold text-orange-400 block pt-2">Acessar Admin ➔</span>
                </div>

                {/* CARD 2: COZINHA & PEDIDOS */}
                <div
                  onClick={() => router.push(`/${tenant.slug}/cozinha`)}
                  className="bg-gray-900 border border-gray-800 hover:border-blue-500/50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-lg">
                    🍳
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition">Cozinha & Pedidos</h4>
                    <p className="text-xs text-gray-400 mt-1">Acompanhe novos pedidos em tempo real, imprima comandas e altere o status[cite: 2].</p>
                  </div>
                  <span className="text-xs font-bold text-blue-400 block pt-2">Abrir Cozinha ➔</span>
                </div>

                {/* CARD 3: CARDÁPIO DIGITAL PÚBLICO */}
                <div
                  onClick={() => window.open(publicUrl, '_blank')}
                  className="bg-gray-900 border border-gray-800 hover:border-emerald-500/50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-lg">
                    🍔
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">Cardápio do Cliente</h4>
                    <p className="text-xs text-gray-400 mt-1">Veja exatamente a tela de pedidos e carrinho como os seus clientes enxergam.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 block pt-2">Visualizar Cardápio ➔</span>
                </div>

              </div>
            </div>

            {/* COMPARTILHAMENTO DO LINK DO CARDÁPIO */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center space-x-1">
                    <span>🔗 Link do Seu Cardápio Digital</span>
                  </h4>
                  <p className="text-xs text-gray-400">Envie este link nas redes sociais ou no WhatsApp da sua loja.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-orange-400 font-mono focus:outline-none"
                />

                <div className="flex space-x-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyPublicLink}
                    className={`px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      copied ? 'bg-green-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                    }`}>
                    {copied ? '✓ Copiado!' : '📋 Copiar Link'}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Faça seu pedido diretamente no nosso cardápio digital: ${publicUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap text-center">
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* RODAPÉ */}
      <footer className="max-w-5xl mx-auto w-full text-center py-4 border-t border-gray-800 text-xs text-gray-500">
        <p>© 2026 Sinerge Delivery — Plataforma SaaS Multi-Tenant.</p>
      </footer>

    </div>
  );
}
