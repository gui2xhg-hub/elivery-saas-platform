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

  // ESTADOS DO PIX E ESTATÍSTICAS
  const [showPixModal, setShowPixModal] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [stats, setStats] = useState({ ordersCount: 0, totalRevenue: 0 });

  // CONFIGURAÇÕES DE DOMÍNIO E PIX OFICIAL (ESTÁTICO R$ 99,99)
  const DOMAIN_URL = 'https://delivery.sinergemkt.com';
  const PIX_COPIA_COLA = "00020101021126330014br.gov.bcb.pix011107758777945520400005303986540599.995802BR5925HENRIQUE GONCALVES DE OLI6009SAO PAULO622905251M24TWWDEN5A3XEVQZMREE1D56304C896";
  const SUPPORT_WHATSAPP = "5547996302864";

  // MURAL DE NOVIDADES DO SAAS
  const systemUpdates = [
    { id: 1, tag: 'NOVO', date: '10/09', title: '🤖 Robô de Lembretes no WhatsApp', desc: 'Envio automático de confirmações para evitar desistências de pedidos.' },
    { id: 2, tag: 'MELHORIA', date: '05/09', title: '🪑 Módulo de Mesas & Autoatendimento', desc: 'Seus clientes agora podem pedir direto da mesa escaneando um QR Code.' }
  ];

  useEffect(() => {
    const savedTenant = localStorage.getItem('sinerge_authenticated_delivery_tenant');
    if (savedTenant) {
      try {
        const parsed = JSON.parse(savedTenant);
        setTenant(parsed);
        fetchTenantStats(parsed.id);
      } catch (e) {
        localStorage.removeItem('sinerge_authenticated_delivery_tenant');
      }
    }
  }, []);

  const fetchTenantStats = async (tenantId) => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status, payment_method')
        .eq('tenant_id', tenantId);

      if (orders) {
        const count = orders.length;
        const revenue = orders.reduce((acc, order) => {
          const isPaid = order.payment_method?.includes('PAGO') || order.status === 'concluido' || order.status === 'entregue';
          return isPaid ? acc + Number(order.total || 0) : acc;
        }, 0);
        setStats({ ordersCount: count, totalRevenue: revenue });
      }
    } catch (err) {
      console.log('Erro ao carregar métricas:', err);
    }
  };

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
      fetchTenantStats(data.id);
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

  const handleCopyPixCopiaCola = () => {
    navigator.clipboard.writeText(PIX_COPIA_COLA);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const getDueDateInfo = (dueDateStr) => {
    if (!dueDateStr) return { diffDays: 999, isExpiring: false, isExpired: false, label: 'Mensalidade em dia' };

    const today = new Date(new Date().toISOString().split('T')[0]);
    const dueDate = new Date(dueDateStr);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { diffDays, isExpiring: false, isExpired: true, label: '🔴 Mensalidade Vencida — Efetue o pagamento para manter o sistema ativo' };
    } else if (diffDays <= 3) {
      return { diffDays, isExpiring: true, isExpired: false, label: `⚠️ Sua mensalidade vence ${diffDays === 0 ? 'HOJE' : `em ${diffDays} dia(s)`}` };
    } else {
      return { diffDays, isExpiring: false, isExpired: false, label: `🟢 Adimplente (Vence em ${diffDays} dias - ${dueDateStr.split('-').reverse().join('/')})` };
    }
  };

  const primaryColor = tenant?.primary_color || '#FF8C00';
  const buttonTextColor = tenant?.button_text_color || '#FFFFFF';
  const secondaryColor = tenant?.secondary_color || '#090D16';
  const cardBgColor = tenant?.card_bg_color || '#111827';
  const textColor = tenant?.text_color || '#FFFFFF';

  const logoUrl = (tenant?.logo_url && tenant.logo_url.trim() !== '')
    ? tenant.logo_url
    : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80';

  const dueInfo = tenant ? getDueDateInfo(tenant.due_date) : null;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(PIX_COPIA_COLA)}`;

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
      <main className="max-w-5xl mx-auto w-full my-auto py-6 space-y-6">
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
            
            {/* HERO BANNER & MÉTRICAS */}
            <div 
              className="border rounded-3xl p-6 space-y-4 relative overflow-hidden shadow-xl"
              style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

              {/* MÉTRICAS RÁPIDAS DE VENDAS NO MÊS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="p-3 rounded-2xl border" style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="opacity-60 block text-[10px]">Vendas Registradas:</span>
                  <span className="text-base font-bold text-green-400">R$ {stats.totalRevenue.toFixed(2)}</span>
                </div>

                <div className="p-3 rounded-2xl border" style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="opacity-60 block text-[10px]">Total de Pedidos:</span>
                  <span className="text-base font-bold" style={{ color: textColor }}>{stats.ordersCount} pedido(s)</span>
                </div>

                <div className="p-3 rounded-2xl border col-span-2 sm:col-span-1 flex justify-between items-center" style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div>
                    <span className="opacity-60 block text-[10px]">Robô de WhatsApp:</span>
                    <span className="text-xs font-bold text-green-400">🟢 Ativo</span>
                  </div>
                  <button onClick={() => router.push(`/${tenant.slug}/admin`)} className="text-[10px] font-bold underline" style={{ color: primaryColor }}>Configurar</button>
                </div>
              </div>
            </div>

            {/* 💳 BARRA DE VENCIMENTO E BOTÃO PIX */}
            <div 
              className={`p-5 rounded-3xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition ${
                dueInfo.isExpired 
                  ? 'bg-red-500/10 border-red-500/50' 
                  : dueInfo.isExpiring 
                  ? 'bg-yellow-500/10 border-yellow-500/50' 
                  : 'border'
              }`}
              style={!dueInfo.isExpired && !dueInfo.isExpiring ? { backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' } : {}}>
              
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base">{dueInfo.isExpired ? '🔴' : dueInfo.isExpiring ? '⚠️' : '💳'}</span>
                  <h3 className="font-bold text-sm" style={{ color: textColor }}>Status da Assinatura SaaS</h3>
                </div>
                <p className="text-xs opacity-80">
                  {dueInfo.label} • Valor: <b className="text-green-400">R$ {Number(tenant.monthly_fee || 99.99).toFixed(2)}/mês</b>
                </p>
              </div>

              <button
                onClick={() => setShowPixModal(true)}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-green-600/20 flex items-center justify-center space-x-1.5 shrink-0">
                <span>⚡ Pagar Mensalidade (PIX)</span>
              </button>
            </div>

            {/* 📢 MURAL DE NOVIDADES */}
            <div 
              className="p-5 rounded-3xl border space-y-3"
              style={{ backgroundColor: cardBgColor, borderColor: 'rgba(255,255,255,0.1)' }}>
              
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider flex items-center space-x-2" style={{ color: primaryColor }}>
                  <span>📢 O que há de novo no Sinerge Delivery?</span>
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">Atualizado</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {systemUpdates.map(up => (
                  <div key={up.id} className="p-3.5 rounded-2xl border space-y-1" style={{ backgroundColor: secondaryColor, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center space-x-2">
                      <span className="bg-orange-500/20 text-orange-400 text-[9px] font-bold px-2 py-0.5 rounded">{up.tag}</span>
                      <span className="text-[10px] opacity-60">{up.date}</span>
                      <h4 className="font-bold text-xs truncate" style={{ color: textColor }}>{up.title}</h4>
                    </div>
                    <p className="text-[11px] opacity-75">{up.desc}</p>
                  </div>
                ))}
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

      {/* MODAL DE PAGAMENTO PIX (COM QR CODE E COPIA E COLA) */}
      {showPixModal && tenant && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-3xl p-6 border border-green-500/40 space-y-4 relative shadow-2xl text-center">
            <button 
              onClick={() => setShowPixModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-sm">
              ✕
            </button>

            <div>
              <h3 className="font-bold text-base text-white">Pagamento de Mensalidade via PIX</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Favorecido: <b className="text-white">Henrique Gonçalves de Olinda</b><br />
                Valor: <b className="text-green-400">R$ {Number(tenant.monthly_fee || 99.99).toFixed(2)}</b>
              </p>
            </div>

            {/* IMAGEM DO QR CODE EXIBIDA NA TELA */}
            <div className="bg-white p-3 rounded-2xl w-44 h-44 mx-auto flex items-center justify-center shadow-lg border-2 border-green-500">
              <img 
                src={qrCodeImageUrl} 
                alt="QR Code PIX Sinerge" 
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] text-gray-400">Abra o app do seu banco e escaneie o código acima.</p>

            {/* CAMPO PIX COPIA E COLA */}
            <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 space-y-2">
              <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">Ou use o PIX Copia e Cola:</span>
              <input 
                type="text" 
                readOnly 
                value={PIX_COPIA_COLA} 
                className="w-full bg-gray-900 border border-gray-800 p-2 rounded-xl text-[10px] text-yellow-400 font-mono focus:outline-none text-center select-all"
              />
              
              <button 
                onClick={handleCopyPixCopiaCola} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-green-600/20">
                {copiedPix ? '✓ PIX Copia e Cola Copiado!' : '📋 Copiar PIX Copia e Cola'}
              </button>
            </div>

            <a 
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                `Olá! Realizei o pagamento da mensalidade do sistema *${tenant.name}* (R$ ${Number(tenant.monthly_fee || 99.99).toFixed(2)}). Segue o comprovante em anexo!`
              )}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-gray-800 hover:bg-gray-700 text-green-400 border border-green-500/30 font-bold py-3 rounded-xl text-xs transition block">
              💬 Enviar Comprovante no WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* RODAPÉ */}
      <footer className="max-w-5xl mx-auto w-full text-center py-4 border-t text-xs opacity-60" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <p>© 2026 Sinerge Delivery — Plataforma SaaS Multi-Tenant.</p>
      </footer>
    </div>
  );
}
