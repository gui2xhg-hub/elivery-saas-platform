import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// FUNÇÃO AUXILIAR PARA PARSE DE VALORES MONETÁRIOS
const parsePrice = (val, defaultVal = 0) => {
  if (!val) return defaultVal;
  const clean = String(val).replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? defaultVal : num;
};

export default function MasterAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  
  // NAVEGAÇÃO PRINCIPAL DO PAINEL MASTER
  const [activeMainTab, setActiveMainTab] = useState('saas'); // 'saas' | 'internal'

  // ==========================================
  // ESTADOS DO MÓDULO SAAS (CLIENTES DA PLATAFORMA)
  // ==========================================
  const [tenants, setTenants] = useState([]);
  const [tenantStats, setTenantStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [copiedTenantId, setCopiedTenantId] = useState(null);

  // CONTROLE DE INTERFACE (JANELAS E EXPANSÕES)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [expandedTenantId, setExpandedTenantId] = useState(null);

  // FORMULÁRIO DE NOVO CLIENTE SAAS
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    whatsapp: '',
    logo_url: '',
    banner_url: '',
    primary_color: '#FF8C00',
    button_text_color: '#FFFFFF',
    secondary_color: '#090D16',
    card_bg_color: '#111827',
    text_color: '#FFFFFF',
    price_color: '#FF8C00',
    due_date: '',
    monthly_fee: '99.00',
    admin_password: '',
    business_type: 'delivery',
    has_tables: true
  });

  // ESTADO DE EDIÇÃO DE CLIENTE SAAS EXISTENTE
  const [editingTenant, setEditingTenant] = useState(null);

  // ==========================================
  // ESTADOS DO MÓDULO DE GESTÃO INTERNA (AGÊNCIA)
  // ==========================================
  const [internalSubTab, setInternalSubTab] = useState('billing'); // 'billing', 'expenses', 'team', 'clients'
  const [internalClients, setInternalClients] = useState([]);
  const [internalTeam, setInternalTeam] = useState([]);
  const [internalServices, setInternalServices] = useState([]);
  const [internalExpenses, setInternalExpenses] = useState([]);

  // FORMULÁRIOS DA GESTÃO INTERNA
  const [newInternalClient, setNewInternalClient] = useState({ name: '', phone: '', email: '', document: '', notes: '' });
  const [newMember, setNewMember] = useState({ name: '', phone: '', role: '', pix_key: '' });
  const [newService, setNewService] = useState({ client_id: '', title: '', amount: '', due_date: '', assigned_team_id: '', payout_amount: '' });
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', due_date: '', category: 'Servidores' });

  // LOGIN MASTER
  const handleLogin = (e) => {
    e.preventDefault();
    if (masterPassword === 'master123' || masterPassword === 'sinerge2026') {
      setIsAuthenticated(true);
      fetchTenants();
      fetchInternalData();
    } else {
      alert('Senha master incorreta!');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      fetchInternalData();
    }
  }, [isAuthenticated]);

  // ==========================================
  // BUSCA E AÇÕES DO MÓDULO SAAS
  // ==========================================
  const fetchTenants = async () => {
    const { data: rawTenants } = await supabase.from('tenants').select('*').order('id', { ascending: false });

    if (!rawTenants) return;

    // 1. VERIFICA E DESATIVA AUTOMATICAMENTE CLIENTES VENCIDOS
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const updatedTenants = await Promise.all(rawTenants.map(async (t) => {
      if (t.due_date && t.active) {
        if (t.due_date < todayStr) {
          await supabase.from('tenants').update({ active: false }).eq('id', t.id);
          return { ...t, active: false };
        }
      }
      return t;
    }));

    setTenants(updatedTenants);

    // 2. BUSCAR ESTATÍSTICAS DE USO (ORDERS + APPOINTMENTS)
    const validTenantIds = new Set(updatedTenants.map(t => t.id));
    let statsMap = {};

    validTenantIds.forEach(id => {
      statsMap[id] = { count: 0, revenue: 0, lastOrderAt: null };
    });

    try {
      // BUSCA EM PEDIDOS (DELIVERY E E-COMMERCE)
      const { data: oData } = await supabase
        .from('orders')
        .select('id, tenant_id, total, created_at, payment_method, status');

      if (oData) {
        oData.forEach(order => {
          if (!validTenantIds.has(order.tenant_id)) return;

          statsMap[order.tenant_id].count += 1;

          const isPaid = order.payment_method?.toUpperCase().includes('PAGO') || order.status === 'concluido' || order.status === 'entregue';
          if (isPaid) {
            statsMap[order.tenant_id].revenue += parsePrice(order.total, 0);
          }

          if (order.created_at) {
            const orderDate = new Date(order.created_at);
            if (!statsMap[order.tenant_id].lastOrderAt || orderDate > new Date(statsMap[order.tenant_id].lastOrderAt)) {
              statsMap[order.tenant_id].lastOrderAt = order.created_at;
            }
          }
        });
      }

      // BUSCA EM AGENDAMENTOS (AGENDAMENTO / BARBEARIA / SALÃO)
      const { data: aData } = await supabase
        .from('appointments')
        .select('id, tenant_id, total_price, created_at, appointment_date, status');

      if (aData) {
        aData.forEach(app => {
          if (!validTenantIds.has(app.tenant_id)) return;
          if (app.status === 'cancelado') return;

          statsMap[app.tenant_id].count += 1;

          const isPaidOrValid = app.status === 'concluido' || app.status === 'agendado';
          if (isPaidOrValid) {
            statsMap[app.tenant_id].revenue += parsePrice(app.total_price, 0);
          }

          const appDateStr = app.created_at || (app.appointment_date ? `${app.appointment_date}T00:00:00` : null);
          if (appDateStr) {
            const appDate = new Date(appDateStr);
            if (!statsMap[app.tenant_id].lastOrderAt || appDate > new Date(statsMap[app.tenant_id].lastOrderAt)) {
              statsMap[app.tenant_id].lastOrderAt = appDateStr;
            }
          }
        });
      }
    } catch (err) {
      console.log("Erro ao carregar estatísticas:", err);
    }

    setTenantStats(statsMap);
  };

  const getDueDateInfo = (dueDateStr) => {
    if (!dueDateStr) return { diffDays: 999, isExpiring: false, isExpired: false, label: 'Livre / Perpétuo' };
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const today = new Date(todayStr + 'T00:00:00');
    const dueDate = new Date(dueDateStr + 'T00:00:00');

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { diffDays, isExpiring: false, isExpired: true, label: '🔴 VENCIDO (SUSPENSO)' };
    } else if (diffDays <= 3) {
      return { diffDays, isExpiring: true, isExpired: false, label: `⚠️ VENCE EM ${diffDays === 0 ? 'HOJE' : diffDays + ' DIA(S)'}` };
    } else {
      return { diffDays, isExpiring: false, isExpired: false, label: `Vence em ${diffDays} dias` };
    }
  };

  const handleSendWhatsAppBilling = (tenant, diffDays) => {
    const formattedDate = tenant.due_date ? tenant.due_date.split('-').reverse().join('/') : '';
    const phone = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, '') : '';
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

    let text = '';
    if (diffDays < 0) {
      text = `🔴 *AVISO DE DESATIVAÇÃO DE SISTEMA — SINERGE*\n\n` +
        `Olá, *${tenant.name}*!\n\n` +
        `Sua mensalidade no valor de *R$ ${parsePrice(tenant.monthly_fee, 99).toFixed(2)}* venceu em *${formattedDate}*.\n\n` +
        `⚠️ *Seu acesso ao sistema será desativado em breve.* Para reativar imediatamente e evitar interrupções no seu atendimento, efetue o pagamento via PIX:\n\n` +
        `🔑 *Chave PIX:* financeiro@sinergemkt.com\n\n` +
        `Após realizar o pagamento, envie o comprovante por aqui para liberação automática.`;
    } else {
      text = `⚠️ *AVISO DE RENOVAÇÃO DE MENSALIDADE — SINERGE*\n\n` +
        `Olá, *${tenant.name}*!\n\n` +
        `Passando para lembrar que sua mensalidade no valor de *R$ ${parsePrice(tenant.monthly_fee, 99).toFixed(2)}* vence ${diffDays === 0 ? '*HOJE*' : `em *${diffDays} dia(s)* (${formattedDate})`}.\n\n` +
        `Por favor, confirme a renovação para manter seu sistema ativo sem interrupções!\n\n` +
        `🔑 *Chave PIX:* financeiro@sinergemkt.com`;
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedText}`, '_blank');
  };

  const applyPreset = (type) => {
    if (type === 'dark_orange') {
      setNewTenant(prev => ({ ...prev, primary_color: '#FF8C00', button_text_color: '#FFFFFF', secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF', price_color: '#FF8C00' }));
    } else if (type === 'light_pink') {
      setNewTenant(prev => ({ ...prev, primary_color: '#EC4899', button_text_color: '#FFFFFF', secondary_color: '#F9FAFB', card_bg_color: '#FFFFFF', text_color: '#111827', price_color: '#EC4899' }));
    } else if (type === 'purple_barber') {
      setNewTenant(prev => ({ ...prev, primary_color: '#A855F7', button_text_color: '#FFFFFF', secondary_color: '#0F172A', card_bg_color: '#1E293B', text_color: '#F8FAFC', price_color: '#A855F7' }));
    } else if (type === 'blue_ecommerce') {
      setNewTenant(prev => ({ ...prev, primary_color: '#3B82F6', button_text_color: '#FFFFFF', secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF', price_color: '#3B82F6' }));
    }
  };

  const applyEditPreset = (type) => {
    if (!editingTenant) return;
    if (type === 'dark_orange') {
      setEditingTenant(prev => ({ ...prev, primary_color: '#FF8C00', button_text_color: '#FFFFFF', secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF', price_color: '#FF8C00' }));
    } else if (type === 'light_pink') {
      setEditingTenant(prev => ({ ...prev, primary_color: '#EC4899', button_text_color: '#FFFFFF', secondary_color: '#F9FAFB', card_bg_color: '#FFFFFF', text_color: '#111827', price_color: '#EC4899' }));
    } else if (type === 'purple_barber') {
      setEditingTenant(prev => ({ ...prev, primary_color: '#A855F7', button_text_color: '#FFFFFF', secondary_color: '#0F172A', card_bg_color: '#1E293B', text_color: '#F8FAFC', price_color: '#A855F7' }));
    } else if (type === 'blue_ecommerce') {
      setEditingTenant(prev => ({ ...prev, primary_color: '#3B82F6', button_text_color: '#FFFFFF', secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF', price_color: '#3B82F6' }));
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug || !newTenant.whatsapp) return alert("Preencha Nome, Slug e WhatsApp!");

    const cleanSlug = newTenant.slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const cleanPhone = newTenant.whatsapp.replace(/\D/g, '');

    const isDelivery = newTenant.business_type === 'delivery';
    const isAgendamento = newTenant.business_type === 'agendamento';
    const isEcommerce = newTenant.business_type === 'ecommerce';

    const { data, error } = await supabase.from('tenants').insert([{
      name: newTenant.name.trim(),
      slug: cleanSlug,
      whatsapp: cleanPhone,
      logo_url: newTenant.logo_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80',
      banner_url: newTenant.banner_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      admin_password: newTenant.admin_password || '123456',
      primary_color: newTenant.primary_color || '#FF8C00',
      button_text_color: newTenant.button_text_color || '#FFFFFF',
      secondary_color: newTenant.secondary_color || '#090D16',
      card_bg_color: newTenant.card_bg_color || '#111827',
      text_color: newTenant.text_color || '#FFFFFF',
      price_color: newTenant.price_color || '#FF8C00',
      due_date: newTenant.due_date || null,
      monthly_fee: parsePrice(newTenant.monthly_fee, 99.00),
      active: true,
      has_delivery: isDelivery,
      has_agendamento: isAgendamento,
      has_ecommerce: isEcommerce,
      has_tables: newTenant.has_tables,
      business_type: newTenant.business_type
    }]).select().single();

    if (error) {
      alert("Erro ao criar cliente: " + error.message);
    } else {
      if (isDelivery) {
        await supabase.from('categories').insert([{ tenant_id: data.id, name: 'Lanches' }, { tenant_id: data.id, name: 'Bebidas' }]);
      } else if (isEcommerce) {
        await supabase.from('categories').insert([{ tenant_id: data.id, name: 'Camisas' }, { tenant_id: data.id, name: 'Personalizados' }]);
      }

      alert(`Cliente "${data.name}" criado com sucesso!`);
      setIsCreateFormOpen(false);
      setNewTenant({
        name: '', slug: '', whatsapp: '', logo_url: '', banner_url: '',
        primary_color: '#FF8C00', button_text_color: '#FFFFFF',
        secondary_color: '#090D16', card_bg_color: '#111827', text_color: '#FFFFFF',
        price_color: '#FF8C00', due_date: '', monthly_fee: '99.00', admin_password: '', business_type: 'delivery',
        has_tables: true
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
      monthly_fee: parsePrice(editingTenant.monthly_fee, 99.00),
      due_date: editingTenant.due_date || null,
      logo_url: editingTenant.logo_url,
      banner_url: editingTenant.banner_url,
      primary_color: editingTenant.primary_color,
      button_text_color: editingTenant.button_text_color,
      secondary_color: editingTenant.secondary_color,
      card_bg_color: editingTenant.card_bg_color,
      text_color: editingTenant.text_color,
      price_color: editingTenant.price_color,
      has_tables: editingTenant.has_tables ?? true
    }).eq('id', editingTenant.id);

    if (error) {
      alert("Erro ao atualizar: " + error.message);
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
    }
  };

  const handleCopyOnboardingMsg = (tenant) => {
    const isEcommerce = tenant.has_ecommerce || tenant.business_type === 'ecommerce';
    const isAgendamento = tenant.has_agendamento && !tenant.has_delivery && !isEcommerce;

    let portalUrl = 'https://delivery.sinergemkt.com';
    let systemName = 'Sinerge Delivery';
    let emoji = '🍔';

    if (isEcommerce) {
      portalUrl = 'https://loja.sinergemkt.com';
      systemName = 'Sinerge Catálogo / E-commerce';
      emoji = '👕';
    } else if (isAgendamento) {
      portalUrl = 'https://agendamento.sinergemkt.com';
      systemName = 'Sinerge Agendamento';
      emoji = '✂️';
    }

    const text = `${emoji} *Seu Acesso ao ${systemName}!*\n\n` +
      `Olá! Seu sistema está pronto e liberado.\n\n` +
      `🔗 *Acesse o Portal:* ${portalUrl}\n` +
      `🔑 *Seu Identificador (Slug):* \`${tenant.slug}\`\n` +
      `🔐 *Sua Senha Admin:* \`${tenant.admin_password}\`\n\n` +
      `_Ao entrar, você poderá gerenciar seu painel, configurar seu catálogo/agenda e pegar o link público da sua loja!_`;

    navigator.clipboard.writeText(text);
    setCopiedTenantId(tenant.id);
    setTimeout(() => setCopiedTenantId(null), 2500);
  };

  // ==========================================
  // BUSCA E AÇÕES DO MÓDULO DE GESTÃO INTERNA
  // ==========================================
  const fetchInternalData = async () => {
    try {
      const { data: cData } = await supabase.from('internal_clients').select('*').order('name');
      const { data: tData } = await supabase.from('internal_team').select('*').order('name');
      const { data: sData } = await supabase.from('internal_services').select('*, internal_clients(name, phone), internal_team(name, pix_key)').order('due_date', { ascending: true });
      const { data: eData } = await supabase.from('internal_expenses').select('*').order('due_date', { ascending: true });

      if (cData) setInternalClients(cData);
      if (tData) setInternalTeam(tData);
      if (sData) setInternalServices(sData);
      if (eData) setInternalExpenses(eData);
    } catch (err) {
      console.log("Aguardando tabelas internas serem criadas no Supabase:", err);
    }
  };

  const handleAddInternalClient = async (e) => {
    e.preventDefault();
    if (!newInternalClient.name || !newInternalClient.phone) return alert('Preencha Nome e Telefone!');
    await supabase.from('internal_clients').insert([newInternalClient]);
    setNewInternalClient({ name: '', phone: '', email: '', document: '', notes: '' });
    fetchInternalData();
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name) return alert('Preencha o Nome do membro!');
    await supabase.from('internal_team').insert([newMember]);
    setNewMember({ name: '', phone: '', role: '', pix_key: '' });
    fetchInternalData();
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newService.client_id || !newService.title || !newService.amount || !newService.due_date) {
      return alert('Preencha cliente, título, valor e vencimento!');
    }
    await supabase.from('internal_services').insert([{
      client_id: parseInt(newService.client_id),
      title: newService.title,
      amount: parseFloat(newService.amount),
      due_date: newService.due_date,
      assigned_team_id: newService.assigned_team_id ? parseInt(newService.assigned_team_id) : null,
      payout_amount: newService.payout_amount ? parseFloat(newService.payout_amount) : 0,
      status: 'pendente',
      payout_status: 'pendente'
    }]);
    setNewService({ client_id: '', title: '', amount: '', due_date: '', assigned_team_id: '', payout_amount: '' });
    fetchInternalData();
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount || !newExpense.due_date) return alert('Preencha os campos obrigatórios!');
    await supabase.from('internal_expenses').insert([{
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      due_date: newExpense.due_date,
      category: newExpense.category,
      status: 'pendente'
    }]);
    setNewExpense({ description: '', amount: '', due_date: '', category: 'Servidores' });
    fetchInternalData();
  };

  const handleSendInternalChargeMessage = (srv) => {
    const phone = srv.internal_clients?.phone ? srv.internal_clients.phone.replace(/\D/g, '') : '';
    if (!phone) return alert('Cliente sem telefone cadastrado!');
    const clientName = srv.internal_clients?.name || 'Cliente';
    const formattedDate = srv.due_date ? srv.due_date.split('-').reverse().join('/') : '';

    const msg = `Olá *${clientName}*! 👋\n\n` +
      `Passando para lembrar referente ao serviço *${srv.title}*:\n` +
      `• Vencimento: *${formattedDate}*\n` +
      `• Valor: *R$ ${Number(srv.amount).toFixed(2)}*\n\n` +
      `📌 *Chave PIX para pagamento:*\nfinanceiro@sinergemkt.com\n\n` +
      `Qualquer dúvida fico à disposição!`;

    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // CÁLCULOS DO DRE INTERNO DA AGÊNCIA
  const totalInternalReceivables = internalServices.reduce((acc, s) => acc + (s.status === 'pago' ? Number(s.amount) : 0), 0);
  const totalInternalPayouts = internalServices.reduce((acc, s) => acc + (s.payout_status === 'pago' ? Number(s.payout_amount) : 0), 0);
  const totalInternalExpenses = internalExpenses.reduce((acc, e) => acc + (e.status === 'pago' ? Number(e.amount) : 0), 0);
  const netInternalProfit = totalInternalReceivables - totalInternalPayouts - totalInternalExpenses;

  // FILTROS DE CLIENTES SAAS
  const activeTenants = tenants.filter(t => t.active);
  const totalMRR = activeTenants.reduce((acc, t) => acc + parsePrice(t.monthly_fee, 0), 0);

  const deliveryCount = activeTenants.filter(t => (t.has_delivery || t.business_type === 'delivery' || (!t.has_agendamento && !t.has_ecommerce && t.business_type !== 'agendamento' && t.business_type !== 'ecommerce'))).length;
  const agendamentoCount = activeTenants.filter(t => (t.has_agendamento || t.business_type === 'agendamento') && !t.has_delivery && !t.has_ecommerce && t.business_type !== 'ecommerce').length;
  const ecommerceCount = activeTenants.filter(t => t.has_ecommerce || t.business_type === 'ecommerce').length;

  const totalGlobalOrders = Object.values(tenantStats).reduce((acc, s) => acc + (s.count || 0), 0);
  const totalGlobalVolume = Object.values(tenantStats).reduce((acc, s) => acc + (s.revenue || 0), 0);

  const expiringTenants = tenants.filter(t => {
    const dueInfo = getDueDateInfo(t.due_date);
    return t.active && dueInfo.isExpiring;
  });

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const isEcommerce = t.has_ecommerce || t.business_type === 'ecommerce';
    const isAgendamento = (t.has_agendamento || t.business_type === 'agendamento') && !t.has_delivery && !isEcommerce;
    const dueInfo = getDueDateInfo(t.due_date);

    if (!matchesSearch) return false;
    if (filterType === 'DELIVERY') return !isAgendamento && !isEcommerce;
    if (filterType === 'AGENDAMENTO') return isAgendamento;
    if (filterType === 'ECOMMERCE') return isEcommerce;
    if (filterType === 'EXPIRING') return t.active && dueInfo.isExpiring;
    if (filterType === 'EXPIRED') return dueInfo.isExpired || !t.active;
    return true;
  });

  const formatLastActivity = (dateStr) => {
    if (!dateStr) return 'Sem movimentação';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.abs(now - date) / 36e5;
    if (diffHours < 24 && now.getDate() === date.getDate()) {
      return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-3xl border border-orange-500/30 w-full max-w-sm space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500"></div>

          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl flex items-center justify-center text-xl mx-auto mb-2">⚡</div>
            <h1 className="text-xl font-bold text-white">Sinerge Master</h1>
            <p className="text-xs text-gray-400">Painel Geral de Gestão SaaS & Agência</p>
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

          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 font-bold py-3.5 rounded-xl text-xs transition text-white shadow-lg shadow-orange-500/20">
            Acessar Painel de Controle 🚀
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 max-w-6xl mx-auto font-sans pb-16">
      
      {/* CABEÇALHO PRINCIPAL */}
      <header className="flex justify-between items-center py-4 border-b border-gray-800 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-orange-500/20">⚡</div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Sinerge Multi-SaaS Master</h1>
            <p className="text-xs text-gray-400">Plataformas SaaS + Gestão Financeira Interna</p>
          </div>
        </div>

        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 px-4 py-2 rounded-xl text-red-400 font-bold transition">
          🚪 Sair
        </button>
      </header>

      {/* ABA DE NAVEGAÇÃO PRINCIPAL (SAAS x GESTÃO INTERNA) */}
      <div className="flex space-x-2 border-b border-gray-800 pb-3 mb-6">
        <button
          onClick={() => setActiveMainTab('saas')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeMainTab === 'saas' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
          <span>🏢 Clientes SaaS</span>
          <span className="bg-black/30 text-[10px] px-2 py-0.5 rounded-full">{tenants.length}</span>
        </button>

        <button
          onClick={() => setActiveMainTab('internal')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeMainTab === 'internal' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
          <span>💼 Gestão Interna (Agência)</span>
          <span className="bg-black/30 text-[10px] px-2 py-0.5 rounded-full">{internalServices.length}</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* CONTEÚDO DA ABA 1: CLIENTES SAAS           */}
      {/* ========================================== */}
      {activeMainTab === 'saas' && (
        <div className="space-y-6">
          {/* BANNER DE AVISO DE CLIENTES A VENCER */}
          {expiringTenants.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/40 p-4 rounded-2xl mb-6 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl animate-bounce">⚠️</span>
                <div>
                  <h3 className="font-bold text-xs text-yellow-400">Atenção! {expiringTenants.length} cliente(s) vencendo nos próximos 3 dias:</h3>
                  <p className="text-[11px] text-gray-300">
                    {expiringTenants.map(t => `${t.name} (${getDueDateInfo(t.due_date).label})`).join(', ')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setFilterType('EXPIRING')}
                className="bg-yellow-500 text-black font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-yellow-400 transition">
                🔍 Ver Apenas Vencendo
              </button>
            </div>
          )}

          {/* DASHBOARD DE MÉTRICAS */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-8">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Faturamento (MRR)</span>
              <span className="text-lg font-bold text-green-400">R$ {totalMRR.toFixed(2)}</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Clientes</span>
              <span className="text-lg font-bold text-white">{tenants.length} <span className="text-[10px] text-green-400">({activeTenants.length} ativos)</span></span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-orange-400 uppercase block">Delivery Ativos</span>
              <span className="text-lg font-bold text-orange-400">{deliveryCount}</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-purple-400 uppercase block">Agendamento Ativos</span>
              <span className="text-lg font-bold text-purple-400">{agendamentoCount}</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-blue-400 uppercase block">E-commerce Ativos</span>
              <span className="text-lg font-bold text-blue-400">{ecommerceCount}</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-yellow-400 uppercase block">Vendas Totais SaaS</span>
              <span className="text-lg font-bold text-yellow-400">{totalGlobalOrders} <span className="text-[10px] text-gray-400">(R$ {totalGlobalVolume.toFixed(0)})</span></span>
            </div>
          </div>

          {/* BOTÃO MESTRE / SANFONA PARA CADASTRAR NOVO CLIENTE */}
          <section className="mb-8">
            <button
              onClick={() => setIsCreateFormOpen(!isCreateFormOpen)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold p-4 rounded-2xl flex justify-between items-center shadow-lg transition">
              <span className="flex items-center space-x-2 text-sm">
                <span>➕</span>
                <span>Cadastrar Novo Cliente / Estabelecimento</span>
              </span>
              <span className="text-xs bg-black/30 px-3 py-1 rounded-lg">
                {isCreateFormOpen ? '▲ Ocultar Formulário' : '▼ Expandir Formulário'}
              </span>
            </button>

            {isCreateFormOpen && (
              <form onSubmit={handleCreateTenant} className="bg-gray-900 p-6 rounded-b-3xl border border-orange-500/30 border-t-0 space-y-4 shadow-2xl transition-all">
                <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800 space-y-2">
                  <label className="text-[11px] font-bold text-gray-300 block uppercase tracking-wider">Selecione o Nicho do Cliente:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs transition ${newTenant.business_type === 'delivery' ? 'bg-orange-500/20 text-orange-400 border-orange-500' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>
                      <input type="radio" name="business_type" value="delivery" checked={newTenant.business_type === 'delivery'} onChange={() => setNewTenant({ ...newTenant, business_type: 'delivery' })} className="hidden" />
                      <span>🍔 Delivery (Alimentação)</span>
                    </label>

                    <label className={`flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs transition ${newTenant.business_type === 'agendamento' ? 'bg-purple-500/20 text-purple-400 border-purple-500' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>
                      <input type="radio" name="business_type" value="agendamento" checked={newTenant.business_type === 'agendamento'} onChange={() => setNewTenant({ ...newTenant, business_type: 'agendamento' })} className="hidden" />
                      <span>✂️ Agendamento (Barbearia/Salão)</span>
                    </label>

                    <label className={`flex items-center justify-center space-x-2 p-3 rounded-xl border cursor-pointer font-bold text-xs transition ${newTenant.business_type === 'ecommerce' ? 'bg-blue-500/20 text-blue-400 border-blue-500' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>
                      <input type="radio" name="business_type" value="ecommerce" checked={newTenant.business_type === 'ecommerce'} onChange={() => setNewTenant({ ...newTenant, business_type: 'ecommerce' })} className="hidden" />
                      <span>👕 E-commerce / Loja (Roupas)</span>
                    </label>
                  </div>
                </div>

                {newTenant.business_type === 'delivery' && (
                  <div className="bg-gray-950 p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-xs text-white block">🪑 Habilitar Módulo de Mesas / Autoatendimento (QR Code)</span>
                      <span className="text-[10px] text-gray-400">Permite ao restaurante gerar QR Codes para os clientes pedirem direto da mesa.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={newTenant.has_tables}
                      onChange={(e) => setNewTenant({ ...newTenant, has_tables: e.target.checked })}
                      className="w-4 h-4 accent-orange-500 cursor-pointer"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
                  <input type="text" placeholder="Ex: Salão Lanna ou Hamburgueria Silva" value={newTenant.name} onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Slug / Identificador (Sem espaços):</label>
                    <input type="text" placeholder="Ex: lannadesigner" value={newTenant.slug} onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500" />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
                    <input type="text" placeholder="Ex: 47996302864" value={newTenant.whatsapp} onChange={(e) => setNewTenant({ ...newTenant, whatsapp: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800 space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <label className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">🎨 Personalização das Cores do Tema:</label>
                    <div className="flex space-x-1.5 text-[10px] flex-wrap">
                      <button type="button" onClick={() => applyPreset('dark_orange')} className="bg-gray-900 border border-orange-500/50 text-orange-400 px-2.5 py-1 rounded-lg font-bold">Dark Laranja</button>
                      <button type="button" onClick={() => applyPreset('light_pink')} className="bg-pink-500/20 border border-pink-500 text-pink-300 px-2.5 py-1 rounded-lg font-bold">Rosa / Claro</button>
                      <button type="button" onClick={() => applyPreset('purple_barber')} className="bg-purple-500/20 border border-purple-500 text-purple-300 px-2.5 py-1 rounded-lg font-bold">Roxo Barber</button>
                      <button type="button" onClick={() => applyPreset('blue_ecommerce')} className="bg-blue-500/20 border border-blue-500 text-blue-300 px-2.5 py-1 rounded-lg font-bold">Azul Loja</button>
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

                    <div>
                      <label className="text-[10px] font-bold text-orange-400 block mb-1">Cor do Preço / Valores:</label>
                      <div className="flex space-x-1.5 items-center">
                        <input type="color" value={newTenant.price_color} onChange={(e) => setNewTenant({ ...newTenant, price_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                        <input type="text" value={newTenant.price_color} onChange={(e) => setNewTenant({ ...newTenant, price_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Data de Vencimento:</label>
                    <input type="date" value={newTenant.due_date} onChange={(e) => setNewTenant({ ...newTenant, due_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }} />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Mensalidade (R$):</label>
                    <input type="text" placeholder="99.00" value={newTenant.monthly_fee} onChange={(e) => setNewTenant({ ...newTenant, monthly_fee: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Senha Admin do Cliente:</label>
                    <input type="text" placeholder="123456" value={newTenant.admin_password} onChange={(e) => setNewTenant({ ...newTenant, admin_password: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-green-600 hover:bg-green-700 font-bold py-3.5 rounded-xl text-xs transition text-white shadow-lg shadow-green-600/20">
                  🚀 Cadastrar Cliente Agora
                </button>
              </form>
            )}
          </section>

          {/* LISTA DE CLIENTES E PESQUISA COM RECUO DE DETALHES */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800">
              <h2 className="font-bold text-sm text-gray-200">🏢 Clientes Cadastrados ({filteredTenants.length})</h2>

              <div className="flex space-x-2 w-full sm:w-auto flex-wrap gap-y-2">
                <input type="text" placeholder="🔍 Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none w-full sm:w-48" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none">
                  <option value="ALL">Todos os Nichos</option>
                  <option value="EXPIRING">⚠️ Vencendo em 3 Dias</option>
                  <option value="EXPIRED">🔴 Vencidos / Bloqueados</option>
                  <option value="DELIVERY">🍔 Delivery</option>
                  <option value="AGENDAMENTO">✂️ Agendamento</option>
                  <option value="ECOMMERCE">👕 E-commerce</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredTenants.map(t => {
                const isEcommerce = t.has_ecommerce || t.business_type === 'ecommerce';
                const isAgendamento = (t.has_agendamento || t.business_type === 'agendamento') && !t.has_delivery && !isEcommerce;
                const isCopied = copiedTenantId === t.id;

                const stats = tenantStats[t.id] || { count: 0, revenue: 0, lastOrderAt: null };
                const dueInfo = getDueDateInfo(t.due_date);
                const isExpanded = expandedTenantId === t.id;

                return (
                  <div key={t.id} className={`bg-gray-900 p-4 rounded-2xl border transition ${dueInfo.isExpiring ? 'border-yellow-500/80 shadow-lg shadow-yellow-500/10' : dueInfo.isExpired || !t.active ? 'border-red-500/50 bg-red-950/10' : 'border-gray-800'}`}>
                    
                    {/* LINHA PRINCIPAL RESUMIDA DO CLIENTE */}
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${t.active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500'}`}></span>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            <h3 className="font-bold text-sm text-white">{t.name}</h3>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${isEcommerce ? 'bg-blue-500/20 text-blue-400' : isAgendamento ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {isEcommerce ? '👕 E-commerce' : isAgendamento ? '✂️ Agendamento' : '🍔 Delivery'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${dueInfo.isExpiring ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse' : dueInfo.isExpired ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                              {dueInfo.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Slug: <b className="text-orange-400">/{t.slug}</b> • Zap: <b className="text-gray-300">{t.whatsapp}</b> • R$ <b className="text-green-400">{parsePrice(t.monthly_fee, 99).toFixed(2)}</b>
                          </p>
                        </div>
                      </div>

                      {/* AÇÕES RÁPIDAS NO TOPO */}
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <button 
                          onClick={() => handleSendWhatsAppBilling(t, dueInfo.diffDays)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${dueInfo.isExpiring || dueInfo.isExpired ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md' : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/40'}`}>
                          <span>📩 Cobrar Zap</span>
                        </button>

                        <button 
                          onClick={() => toggleTenantActive(t.id, t.active)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${t.active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                          {t.active ? '🟢 Autorizado' : '🔴 Bloqueado'}
                        </button>

                        <button 
                          onClick={() => setExpandedTenantId(isExpanded ? null : t.id)}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold transition">
                          {isExpanded ? '▲ Ocultar' : '👁️ Links/Detalhes'}
                        </button>
                      </div>
                    </div>

                    {/* JANELA RETRÁTIL DE DETALHES / LINKS E AÇÕES AVANÇADAS */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-800/80 space-y-3 bg-gray-950/60 p-3 rounded-xl">
                        <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                          <div className="text-gray-400 space-x-3">
                            <span>Senha Admin: <b className="font-mono text-white">{t.admin_password}</b></span>
                            <span>Uso: <b className="text-green-400">{stats.count} pedidos/agendamentos</b></span>
                            <span>Vendas: <b className="text-green-400">R$ {stats.revenue.toFixed(2)}</b></span>
                            <span>Último: <b className="text-white">{formatLastActivity(stats.lastOrderAt)}</b></span>
                          </div>

                          <div className="flex space-x-1.5">
                            <button onClick={() => handleCopyOnboardingMsg(t)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                              {isCopied ? '✓ Copiado' : '💬 Msg Acesso'}
                            </button>
                            <button onClick={() => setEditingTenant(t)} className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-bold">✏️ Editar</button>
                            <button onClick={() => handleDeleteTenant(t.id, t.name)} className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg text-xs font-bold">🗑</button>
                          </div>
                        </div>

                        {/* PAINEL DE LINKS RÁPIDOS POR NICHO */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                          {isEcommerce ? (
                            <>
                              <a href={`https://loja.sinergemkt.com/${t.slug}`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-gray-300 font-bold hover:bg-gray-800">🛍️ Catálogo Público</a>
                              <a href={`https://loja.sinergemkt.com/${t.slug}/producao`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-blue-400 font-bold hover:bg-gray-800">👕 Fila Produção</a>
                              <a href={`https://loja.sinergemkt.com/${t.slug}/admin`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-orange-400 font-bold hover:bg-gray-800">⚙️ Admin Loja</a>
                            </>
                          ) : isAgendamento ? (
                            <>
                              <a href={`https://agendamento.sinergemkt.com/${t.slug}`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-gray-300 font-bold hover:bg-gray-800">🛍️ Página Cliente</a>
                              <a href={`https://agendamento.sinergemkt.com/${t.slug}/agenda`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-purple-400 font-bold hover:bg-gray-800">📅 Painel Agenda</a>
                              <a href={`https://agendamento.sinergemkt.com/${t.slug}/admin`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-blue-400 font-bold hover:bg-gray-800">⚙️ Admin Agenda</a>
                            </>
                          ) : (
                            <>
                              <a href={`https://delivery.sinergemkt.com/${t.slug}`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-gray-300 font-bold hover:bg-gray-800">🍔 Cardápio Digital</a>
                              <a href={`https://delivery.sinergemkt.com/${t.slug}/cozinha`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-orange-400 font-bold hover:bg-gray-800">🍳 Cozinha / Pedidos</a>
                              <a href={`https://delivery.sinergemkt.com/${t.slug}/admin`} target="_blank" rel="noreferrer" className="bg-gray-900 border border-gray-800 text-center py-1.5 rounded-lg text-blue-400 font-bold hover:bg-gray-800">⚙️ Admin Delivery</a>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================== */}
      {/* CONTEÚDO DA ABA 2: GESTÃO INTERNA (AGÊNCIA)*/}
      {/* ========================================== */}
      {activeMainTab === 'internal' && (
        <div className="space-y-6">
          {/* CARD DRE / RESUMO FINANCEIRO DA SUA AGÊNCIA */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-xl">
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block font-bold">ENTRADAS (PAGAS)</span>
              <span className="text-base font-bold text-green-400">R$ {totalInternalReceivables.toFixed(2)}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block font-bold">REPASSES EQUIPE</span>
              <span className="text-base font-bold text-purple-400">R$ {totalInternalPayouts.toFixed(2)}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-[10px] text-gray-400 block font-bold">DESPESAS FIXAS/VARIÁVEIS</span>
              <span className="text-base font-bold text-red-400">R$ {totalInternalExpenses.toFixed(2)}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-orange-500/30">
              <span className="text-[10px] text-orange-400 block font-bold">LUCRO LÍQUIDO</span>
              <span className={`text-base font-bold ${netInternalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R$ {netInternalProfit.toFixed(2)}
              </span>
            </div>
          </div>

          {/* SUB-NAVEGAÇÃO INTERNA */}
          <div className="flex space-x-2 border-b border-gray-800 pb-2 text-xs font-bold flex-wrap gap-y-2">
            <button onClick={() => setInternalSubTab('billing')} className={`px-3 py-1.5 rounded-lg transition ${internalSubTab === 'billing' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>💰 Serviços & Cobranças</button>
            <button onClick={() => setInternalSubTab('expenses')} className={`px-3 py-1.5 rounded-lg transition ${internalSubTab === 'expenses' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📉 Contas a Pagar</button>
            <button onClick={() => setInternalSubTab('team')} className={`px-3 py-1.5 rounded-lg transition ${internalSubTab === 'team' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>👨‍💻 Equipe & Repasses</button>
            <button onClick={() => setInternalSubTab('clients')} className={`px-3 py-1.5 rounded-lg transition ${internalSubTab === 'clients' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>👥 Clientes Diretos</button>
          </div>

          {/* SUB-ABA 1: SERVIÇOS E COBRANÇAS */}
          {internalSubTab === 'billing' && (
            <div className="space-y-4">
              <form onSubmit={handleAddService} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 text-xs shadow-lg">
                <h4 className="font-bold text-orange-400">➕ Novo Serviço / Cobrança</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={newService.client_id} onChange={(e) => setNewService({ ...newService, client_id: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white">
                    <option value="">-- Selecionar Cliente --</option>
                    {internalClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="text" placeholder="Título (Ex: Gestão de Anúncios - Mês 10)" value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="Valor Cobrado R$" value={newService.amount} onChange={(e) => setNewService({ ...newService, amount: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="date" value={newService.due_date} onChange={(e) => setNewService({ ...newService, due_date: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white cursor-pointer" style={{ colorScheme: 'dark' }} />
                  <select value={newService.assigned_team_id} onChange={(e) => setNewService({ ...newService, assigned_team_id: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white">
                    <option value="">-- Responsável da Equipe (Opcional) --</option>
                    {internalTeam.map(t => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
                  </select>
                  <input type="text" placeholder="Valor Repasse Equipe R$" value={newService.payout_amount} onChange={(e) => setNewService({ ...newService, payout_amount: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                </div>
                <button type="submit" className="bg-green-600 hover:bg-green-700 font-bold px-4 py-2.5 rounded-lg text-white shadow-md transition">Cadastrar Cobrança 🚀</button>
              </form>

              {/* LISTA DE COBRANÇAS INTERNAS */}
              <div className="space-y-2">
                {internalServices.length === 0 ? (
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center text-xs text-gray-500">
                    Nenhum serviço ou cobrança cadastrado até o momento.
                  </div>
                ) : (
                  internalServices.map(srv => (
                    <div key={srv.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                      <div>
                        <span className="font-bold text-white block">{srv.title} — <b className="text-orange-400">{srv.internal_clients?.name || 'Sem Cliente'}</b></span>
                        <span className="text-gray-400 text-[10px]">Vencimento: {srv.due_date ? srv.due_date.split('-').reverse().join('/') : ''} • R$ {Number(srv.amount).toFixed(2)}</span>
                        {srv.internal_team && (
                          <span className="text-purple-400 text-[10px] block mt-0.5">Repasse: {srv.internal_team.name} (R$ {Number(srv.payout_amount).toFixed(2)}) — Status Repasse: <b>{srv.payout_status}</b></span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <button onClick={() => handleSendInternalChargeMessage(srv)} className="bg-green-600/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg font-bold hover:bg-green-600/30">💬 Cobrar Zap</button>
                        <button onClick={async () => { await supabase.from('internal_services').update({ status: srv.status === 'pago' ? 'pendente' : 'pago' }).eq('id', srv.id); fetchInternalData(); }} className={`px-2.5 py-1 rounded-lg font-bold ${srv.status === 'pago' ? 'bg-green-500 text-white' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                          {srv.status === 'pago' ? '✓ Pago' : 'Pendente'}
                        </button>
                        {srv.assigned_team_id && (
                          <button onClick={async () => { await supabase.from('internal_services').update({ payout_status: srv.payout_status === 'pago' ? 'pendente' : 'pago' }).eq('id', srv.id); fetchInternalData(); }} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${srv.payout_status === 'pago' ? 'bg-purple-600 text-white' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                            {srv.payout_status === 'pago' ? '✓ Repasse Pago' : 'Repasse Pendente'}
                          </button>
                        )}
                        <button onClick={async () => { if (confirm('Excluir este serviço?')) { await supabase.from('internal_services').delete().eq('id', srv.id); fetchInternalData(); } }} className="text-red-400 hover:text-red-300 font-bold p-1">🗑</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SUB-ABA 2: CONTAS A PAGAR */}
          {internalSubTab === 'expenses' && (
            <div className="space-y-4">
              <form onSubmit={handleAddExpense} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 text-xs shadow-lg">
                <h4 className="font-bold text-red-400">➕ Nova Conta / Despesa Interna</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input type="text" placeholder="Descrição (Ex: Servidor Vercel/Supabase)" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="Valor R$" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="date" value={newExpense.due_date} onChange={(e) => setNewExpense({ ...newExpense, due_date: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white cursor-pointer" style={{ colorScheme: 'dark' }} />
                  <select value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white">
                    <option value="Servidores">Servidores / Infra</option>
                    <option value="Ferramentas">Ferramentas / SaaS</option>
                    <option value="Marketing">Marketing / Tráfego</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <button type="submit" className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2.5 rounded-lg text-white shadow-md transition">Lançar Despesa 📉</button>
              </form>

              <div className="space-y-2">
                {internalExpenses.length === 0 ? (
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center text-xs text-gray-500">
                    Nenhuma conta a pagar cadastrada.
                  </div>
                ) : (
                  internalExpenses.map(exp => (
                    <div key={exp.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white block">{exp.description} <span className="text-[10px] text-gray-400">({exp.category})</span></span>
                        <span className="text-gray-400 text-[10px]">Vencimento: {exp.due_date ? exp.due_date.split('-').reverse().join('/') : ''} • R$ {Number(exp.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={async () => { await supabase.from('internal_expenses').update({ status: exp.status === 'pago' ? 'pendente' : 'pago' }).eq('id', exp.id); fetchInternalData(); }} className={`px-2.5 py-1 rounded-lg font-bold ${exp.status === 'pago' ? 'bg-green-500 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {exp.status === 'pago' ? '✓ Pago' : 'Pendente'}
                        </button>
                        <button onClick={async () => { if (confirm('Excluir despesa?')) { await supabase.from('internal_expenses').delete().eq('id', exp.id); fetchInternalData(); } }} className="text-red-400 hover:text-red-300 font-bold p-1">🗑</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SUB-ABA 3: EQUIPE */}
          {internalSubTab === 'team' && (
            <div className="space-y-4">
              <form onSubmit={handleAddMember} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 text-xs shadow-lg">
                <h4 className="font-bold text-purple-400">➕ Cadastrar Membro / Freelancer</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input type="text" placeholder="Nome Completo" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="WhatsApp" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="Cargo/Função (Ex: Designer)" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="Chave PIX para Repasse" value={newMember.pix_key} onChange={(e) => setNewMember({ ...newMember, pix_key: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                </div>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 font-bold px-4 py-2.5 rounded-lg text-white shadow-md transition">Salvar Membro</button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {internalTeam.map(t => (
                  <div key={t.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white block">{t.name} <span className="text-purple-400 text-[10px]">({t.role || 'Membro'})</span></span>
                      <span className="text-gray-400 text-[10px] block">📱 {t.phone || 'Sem Zap'}</span>
                      <span className="text-green-400 text-[10px] font-mono block">PIX: {t.pix_key || 'Não informada'}</span>
                    </div>
                    <button onClick={async () => { if (confirm(`Remover ${t.name}?`)) { await supabase.from('internal_team').delete().eq('id', t.id); fetchInternalData(); } }} className="text-red-400 font-bold p-1">🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-ABA 4: CLIENTES DIRETO */}
          {internalSubTab === 'clients' && (
            <div className="space-y-4">
              <form onSubmit={handleAddInternalClient} className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-3 text-xs shadow-lg">
                <h4 className="font-bold text-orange-400">➕ Cadastrar Cliente Direto</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" placeholder="Nome do Cliente / Razão Social" value={newInternalClient.name} onChange={(e) => setNewInternalClient({ ...newInternalClient, name: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="WhatsApp (Ex: 47999999999)" value={newInternalClient.phone} onChange={(e) => setNewInternalClient({ ...newInternalClient, phone: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                  <input type="text" placeholder="CPF/CNPJ" value={newInternalClient.document} onChange={(e) => setNewInternalClient({ ...newInternalClient, document: e.target.value })} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-white" />
                </div>
                <button type="submit" className="bg-orange-500 hover:bg-orange-600 font-bold px-4 py-2.5 rounded-lg text-white shadow-md transition">Salvar Cliente</button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {internalClients.map(c => (
                  <div key={c.id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white block">{c.name}</span>
                      <span className="text-gray-400 text-[10px] block">📱 {c.phone} {c.document && `• Doc: ${c.document}`}</span>
                    </div>
                    <button onClick={async () => { if (confirm(`Remover cliente ${c.name}?`)) { await supabase.from('internal_clients').delete().eq('id', c.id); fetchInternalData(); } }} className="text-red-400 font-bold p-1">🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CLIENTE SAAS */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdateTenant} className="bg-gray-900 w-full max-w-xl rounded-3xl p-6 border border-blue-500/40 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-sm text-blue-400">✏️ Editar Cliente: <span className="text-white">{editingTenant.name}</span></h3>
              <button type="button" onClick={() => setEditingTenant(null)} className="text-xs text-gray-400 hover:text-white font-bold">✕ Fechar</button>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Nome do Estabelecimento:</label>
              <input type="text" value={editingTenant.name || ''} onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">WhatsApp (DDD + Número):</label>
                <input type="text" value={editingTenant.whatsapp || ''} onChange={(e) => setEditingTenant({ ...editingTenant, whatsapp: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Senha de Admin:</label>
                <input type="text" value={editingTenant.admin_password || ''} onChange={(e) => setEditingTenant({ ...editingTenant, admin_password: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
              </div>
            </div>

            <div className="bg-gray-950 p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-xs text-white block">🪑 Módulo de Mesas / Autoatendimento (QR Code)</span>
                <span className="text-[10px] text-gray-400">Ativa a aba de gerenciamento de QR Codes no Admin do cliente.</span>
              </div>
              <input
                type="checkbox"
                checked={editingTenant.has_tables ?? true}
                onChange={(e) => setEditingTenant({ ...editingTenant, has_tables: e.target.checked })}
                className="w-4 h-4 accent-orange-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Valor da Mensalidade (R$):</label>
                <input type="text" value={editingTenant.monthly_fee || ''} onChange={(e) => setEditingTenant({ ...editingTenant, monthly_fee: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Data de Vencimento:</label>
                <input type="date" value={editingTenant.due_date || ''} onChange={(e) => setEditingTenant({ ...editingTenant, due_date: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none cursor-pointer" style={{ colorScheme: 'dark' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL da Logo:</label>
                <input type="text" value={editingTenant.logo_url || ''} onChange={(e) => setEditingTenant({ ...editingTenant, logo_url: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">URL do Banner:</label>
                <input type="text" value={editingTenant.banner_url || ''} onChange={(e) => setEditingTenant({ ...editingTenant, banner_url: e.target.value })} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-xs text-white focus:outline-none" />
              </div>
            </div>

            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <label className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">🎨 Alterar Cores do Tema:</label>
                <div className="flex space-x-1 text-[10px] flex-wrap">
                  <button type="button" onClick={() => applyEditPreset('dark_orange')} className="bg-gray-900 border border-orange-500/50 text-orange-400 px-2 py-0.5 rounded font-bold">Dark</button>
                  <button type="button" onClick={() => applyEditPreset('light_pink')} className="bg-pink-500/20 border border-pink-500 text-pink-300 px-2 py-0.5 rounded font-bold">Rosa</button>
                  <button type="button" onClick={() => applyEditPreset('purple_barber')} className="bg-purple-500/20 border border-purple-500 text-purple-300 px-2 py-0.5 rounded font-bold">Roxo</button>
                  <button type="button" onClick={() => applyEditPreset('blue_ecommerce')} className="bg-blue-500/20 border border-blue-500 text-blue-300 px-2 py-0.5 rounded font-bold">Azul</button>
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

                <div>
                  <label className="text-[10px] font-bold text-blue-400 block mb-1">Cor do Preço / Valores:</label>
                  <div className="flex space-x-1.5 items-center">
                    <input type="color" value={editingTenant.price_color || '#FF8C00'} onChange={(e) => setEditingTenant({ ...editingTenant, price_color: e.target.value })} className="h-8 w-8 bg-gray-900 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={editingTenant.price_color || ''} onChange={(e) => setEditingTenant({ ...editingTenant, price_color: e.target.value })} className="w-full bg-gray-900 border border-gray-700 p-1.5 rounded text-[11px] text-white font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setEditingTenant(null)} className="w-1/2 bg-gray-800 text-gray-300 font-bold py-3 rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition">Salvar Alterações 💾</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
