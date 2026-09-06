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

  // DOMÍNIO OFICIAL DO DELIVERY
  const DOMAIN_URL = 'https://delivery.sinergemkt.com';

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

  const handleLogout = () => {
    localStorage.removeItem('sinerge_authenticated_delivery_tenant');
    setTenant(null);
    setSlugInput('');
    setPasswordInput('');
  };

  const publicUrl = tenant ? `${DOMAIN_URL}/${tenant.slug}` : '';

  const handleCopyPublicLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🎨 CORES E TEMAS DINÂMICOS DO CLIENTE
  const primaryColor = tenant?.primary_color || '#FF8C00';
  const buttonTextColor = tenant?.button_text_color || '#FFFFFF';
  const secondaryColor = tenant?.secondary_color || '#090D16';
  const cardBgColor = tenant?.card_bg_color || '#111827';
  const textColor = tenant?.text_color || '#FFFFFF';

  // TRATAMENTO DA LOGO
  const logoUrl = (tenant?.logo_url && tenant.logo_url.trim() !== '')
    ? tenant.logo_url
    : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80';

  return (
    <div 
      className="min-h-screen font-sans flex flex-col justify-between p-4 md:p-8 transition-colors duration-300"
      style={{ backgroundColor: tenant ? secondaryColor : '#090D16', color: tenant ? textColor : '#FFFFFF' }}>
      
      {/* CABEÇALHO */}
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center space-x-3">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg"
            style={{ backgroundColor: tenant ? primaryColor : '#FF8C00', color: tenant ? buttonTextColor : '#FFFFFF' }}>
            🍔
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight" style={{ color: tenant ? textColor : '#FFFFFF' }}>Sinerge Delivery</h1>
            <p className="text-[11px] opacity-75">Portal do Restaurante & Cardápio SaaS</p>
          </div>
        </div>

        {tenant && (
          <button
            onClick={handleLogout}
            style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}
            className="text-xs text-red-400 border px-3.5 py-1.5 rounded-xl font-bold transition flex items-center space-x-1 hover:opacity-80">
            <span>🚪 Sair / Trocar Loja</span>
          </button>
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto w-full my-auto py-8">
        {!tenant ? (
          /* LOGIN */
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
          /* PAINEL AUTENTICADO */
          <div className="space-y-6">
            
            {/* HERO BANNER */}
            <div 
              className="border rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl"
              style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}>
              
              <div className="flex items-center space-x-4">
                <img
                  src={logoUrl}
                  alt={tenant.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 shadow-md"
                  style={{ borderColor: primaryColor, backgroundColor: secondaryColor }}
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold" style={{ color: textColor }}>{tenant.name}</h2>
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      🟢 Autenticado
                    </span>
                  </div>
                  <p className="text-xs opacity-75 mt-0.5">Painel de controle de pedidos e cardápio digital.</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <button
                  onClick={() => router.push(`/${tenant.slug}/admin`)}
                  style={{ backgroundColor: primaryColor, color: buttonTextColor }}
                  className="font-bold px-5 py-3 rounded-xl text-xs transition shadow-lg w-full md:w-auto text-center hover:opacity-90">
                  ⚙️ Gestão de Cardápio
                </button>
              </div>
            </div>

            {/* ATALHOS DE NAVEGAÇÃO */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-75">
                📌 O que você deseja acessar agora?
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* ADMIN */}
                <div
                  onClick={() => router.push(`/${tenant.slug}/admin`)}
                  style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}
                  className="border hover:border-opacity-50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border"
                    style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.1)', color: primaryColor }}>
                    ⚙️
                  </div>
                  <div>
                    <h4 className="font-bold text-sm transition" style={{ color: textColor }}>Painel Administrativo</h4>
                    <p className="text-xs opacity-70 mt-1">Gerencie produtos, adicionais, bairros e taxas.</p>
                  </div>
                  <span className="text-xs font-bold block pt-2" style={{ color: primaryColor }}>Acessar Admin ➔</span>
                </div>

                {/* COZINHA */}
                <div
                  onClick={() => router.push(`/${tenant.slug}/cozinha`)}
                  style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}
                  className="border hover:border-opacity-50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border text-blue-400"
                    style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.1)' }}>
                    🍳
                  </div>
                  <div>
                    <h4 className="font-bold text-sm transition" style={{ color: textColor }}>Cozinha & Pedidos</h4>
                    <p className="text-xs opacity-70 mt-1">Acompanhe novos pedidos em tempo real e altere status.</p>
                  </div>
                  <span className="text-xs font-bold text-blue-400 block pt-2">Abrir Cozinha ➔</span>
                </div>

                {/* CARDÁPIO PÚBLICO */}
                <div
                  onClick={() => window.open(publicUrl, '_blank')}
                  style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}
                  className="border hover:border-opacity-50 p-5 rounded-3xl space-y-3 cursor-pointer transition group shadow-lg">
                  <div 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border text-emerald-400"
                    style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.1)' }}>
                    🍔
                  </div>
                  <div>
                    <h4 className="font-bold text-sm transition" style={{ color: textColor }}>Cardápio do Cliente</h4>
                    <p className="text-xs opacity-70 mt-1">Veja exatamente como os seus clientes enxergam a loja.</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 block pt-2">Visualizar Cardápio ➔</span>
                </div>

              </div>
            </div>

            {/* SEÇÃO DO LINK */}
            <div 
              className="border rounded-3xl p-6 space-y-3 shadow-xl"
              style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}>
              <div>
                <h4 className="font-bold text-sm flex items-center space-x-1" style={{ color: textColor }}>
                  <span>🔗 Link do Seu Cardápio Digital</span>
                </h4>
                <p className="text-xs opacity-70">Envie nas redes sociais ou no WhatsApp da sua loja.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  style={{ backgroundColor: secondaryColor, color: primaryColor, borderColor: 'rgba(255,255,255,0.1)' }}
                  className="w-full border p-3 rounded-xl text-xs font-mono focus:outline-none"
                />

                <div className="flex space-x-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyPublicLink}
                    style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.2)', color: textColor }}
                    className={`px-4 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                      copied ? '!bg-green-600 !text-white' : ''
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
      <footer className="max-w-5xl mx-auto w-full text-center py-4 border-t text-xs opacity-60" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <p>© 2026 Sinerge Delivery — Plataforma SaaS Multi-Tenant.</p>
      </footer>
    </div>
  );
}
