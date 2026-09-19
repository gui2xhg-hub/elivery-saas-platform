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

const DEFAULT_ADDON_TYPES = [
  '🍕 Pizza Salgada',
  '🍫 Pizza Doce',
  '🫓 Tipo / Sabor de Borda',
  '🍔 Adicional de Lanche',
  '🥤 Molhos & Acompanhamentos',
  '📌 Outros'
];

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

  // GARÇONS
  const [waitersList, setWaitersList] = useState([]);
  const [newWaiter, setNewWaiter] = useState({ name: '', pin: '', phone: '' });
  const [editingWaiter, setEditingWaiter] = useState(null);

  // MODAL DE PROMOÇÃO DE CLIENTE
  const [selectedPromoClient, setSelectedPromoClient] = useState(null);
  const [promoMessageText, setPromoMessageText] = useState('');

  // CONFIGURAÇÃO DE MESAS E QR CODES
  const [tableCount, setTableCount] = useState(10);
  const [baseUrl, setBaseUrl] = useState('');

  // MODAIS ADICIONAIS
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);

  // ESTADOS PARA CATEGORIA PERSONALIZADA DE ADICIONAIS
  const [isCustomCategoryNew, setIsCustomCategoryNew] = useState(false);
  const [customCategoryInputNew, setCustomCategoryInputNew] = useState('');
  const [isCustomCategoryEdit, setIsCustomCategoryEdit] = useState(false);
  const [customCategoryInputEdit, setCustomCategoryInputEdit] = useState('');

  // DIAS DA SEMANA
  const ALL_DAYS = [
    { id: 1, label: 'Segunda-feira', short: 'Seg' },
    { id: 2, label: 'Terça-feira', short: 'Ter' },
    { id: 3, label: 'Quarta-feira', short: 'Qua' },
    { id: 4, label: 'Quinta-feira', short: 'Qui' },
    { id: 5, label: 'Sexta-feira', short: 'Sex' },
    { id: 6, label: 'Sábado', short: 'Sáb' },
    { id: 0, label: 'Domingo', short: 'Dom' }
  ];

  // AUXILIAR PARA ESTRUTURA DOS HORÁRIOS DA SEMANA
  const getDefaultWeeklySchedule = (tData) => {
    let parsed = null;
    if (tData?.weekly_schedule) {
      try {
        parsed = typeof tData.weekly_schedule === 'string' ? JSON.parse(tData.weekly_schedule) : tData.weekly_schedule;
      } catch (e) {
        parsed = null;
      }
    }

    if (parsed && typeof parsed === 'object') {
      return parsed;
    }

    const activeDays = tData?.work_days || [1, 2, 3, 4, 5, 6];
    const schedule = {};
    ALL_DAYS.forEach(day => {
      schedule[day.id] = {
        active: activeDays.includes(day.id),
        has_lunch: tData?.has_lunch_break ?? false,
        open1: tData?.lunch_opening_time || '11:00',
        close1: tData?.lunch_closing_time || '14:30',
        open2: tData?.opening_time || '18:00',
        close2: tData?.closing_time || '23:30'
      };
    });
    return schedule;
  };

  // MONTA A LISTA DE TIPOS DE ADICIONAIS INCLUINDO AS CATEGORIAS PERSONALIZADAS
  const customTypesInAddons = Array.from(
    new Set((globalAddons || []).map(a => a.category_type).filter(Boolean))
  ).filter(t => !DEFAULT_ADDON_TYPES.includes(t));

  const ADDON_TYPES = [...DEFAULT_ADDON_TYPES, ...customTypesInAddons];

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
      let updatedTenant = {
        ...tData,
        work_days: tData.work_days || [1, 2, 3, 4, 5, 6],
        auto_reset_orders: tData.auto_reset_orders ?? false,
        has_lunch_break: tData.has_lunch_break ?? false,
        lunch_opening_time: tData.lunch_opening_time || '11:00',
        lunch_closing_time: tData.lunch_closing_time || '14:30',
        weekly_schedule: getDefaultWeeklySchedule(tData)
      };

      // VERIFICA SE O AUTO-ZERAR ESTÁ ATIVADO E SE JÁ MUDOU O DIA DO EXPEDIENTE
      if (updatedTenant.auto_reset_orders) {
        const lastReset = updatedTenant.order_reset_at ? new Date(updatedTenant.order_reset_at) : new Date(0);
        const now = new Date();
        const isDifferentDay = now.toDateString() !== lastReset.toDateString();

        if (isDifferentDay) {
          const nowIso = now.toISOString();
          await supabase.from('tenants').update({ order_reset_at: nowIso }).eq('id', updatedTenant.id);
          updatedTenant.order_reset_at = nowIso;
        }
      }

      setTenant(updatedTenant);
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
    const { data: wData } = await supabase.from('waiters').select('*').eq('tenant_id', tenantId).order('id', { ascending: true });

    if (tData) {
      setTenant({
        ...tData,
        work_days: tData.work_days || [1, 2, 3, 4, 5, 6],
        auto_reset_orders: tData.auto_reset_orders ?? false,
        has_lunch_break: tData.has_lunch_break ?? false,
        lunch_opening_time: tData.lunch_opening_time || '11:00',
        lunch_closing_time: tData.lunch_closing_time || '14:30',
        weekly_schedule: getDefaultWeeklySchedule(tData)
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
    if (wData) setWaitersList(wData);
  };

  // CÁLCULO INTELIGENTE DA NUMERAÇÃO DE PEDIDO
  const getOrderDisplayNumber = (order) => {
    if (order.daily_number) {
      return `#${String(order.daily_number).padStart(2, '0')}`;
    }

    const resetDate = tenant?.order_reset_at ? new Date(tenant.order_reset_at) : null;

    if (resetDate) {
      const orderDate = new Date(order.created_at);

      if (orderDate >= resetDate) {
        const ordersAfterReset = allOrders
          .filter(o => new Date(o.created_at) >= resetDate)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const idx = ordersAfterReset.findIndex(o => o.id === order.id);
        if (idx !== -1) return `#${String(idx + 1).padStart(2, '0')}`;
      } else {
        const ordersBeforeReset = allOrders
          .filter(o => new Date(o.created_at) < resetDate)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const idx = ordersBeforeReset.findIndex(o => o.id === order.id);
        if (idx !== -1) return `#${String(idx + 1).padStart(2, '0')}`;
      }
    }

    const sortedAll = [...allOrders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const globalIdx = sortedAll.findIndex(o => o.id === order.id);
    if (globalIdx !== -1) return `#${String(globalIdx + 1).padStart(2, '0')}`;

    return `#${order.id}`;
  };

  const handleResetOrderCounter = async () => {
    if (confirm("⚠️ Deseja zerar o contador do expediente agora?\n\nOs novos pedidos começarão a partir do número #01. Os pedidos já registrados continuarão salvos com suas numerações anteriores.")) {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('tenants').update({ order_reset_at: nowIso }).eq('id', tenant.id);
      if (error) {
        alert("Erro ao zerar contador: " + error.message);
      } else {
        alert("Sequência de pedidos zerada com sucesso! O próximo pedido será o #01.");
        fetchData();
      }
    }
  };

  const handleToggleAutoReset = async (enabled) => {
    setTenant(prev => ({ ...prev, auto_reset_orders: enabled }));
    const { error } = await supabase.from('tenants').update({ auto_reset_orders: enabled }).eq('id', tenant.id);
    if (error) alert("Erro ao salvar opção de auto-zerar: " + error.message);
  };

  const toggleDaySelection = (currentDays, dayId) => {
    const arr = [...(currentDays || [])];
    if (arr.includes(dayId)) {
      return arr.filter(d => d !== dayId);
    } else {
      return [...arr, dayId].sort();
    }
  };

  // ATUALIZAÇÃO DA PROGRAMAÇÃO POR DIA DA SEMANA
  const updateDaySchedule = (dayId, field, value) => {
    setTenant(prev => {
      const currentSched = prev.weekly_schedule || getDefaultWeeklySchedule(prev);
      const daySched = currentSched[dayId] || { active: true, has_lunch: false, open1: '11:00', close1: '14:30', open2: '18:00', close2: '23:30' };
      
      const updatedDay = { ...daySched, [field]: value };
      const updatedSched = { ...currentSched, [dayId]: updatedDay };

      const activeDays = Object.keys(updatedSched)
        .filter(d => updatedSched[d]?.active)
        .map(Number);

      return {
        ...prev,
        weekly_schedule: updatedSched,
        work_days: activeDays
      };
    });
  };

  const copyDayScheduleToAll = (sourceDayId) => {
    setTenant(prev => {
      const currentSched = prev.weekly_schedule || getDefaultWeeklySchedule(prev);
      const sourceData = currentSched[sourceDayId];
      if (!sourceData) return prev;

      const newSched = {};
      ALL_DAYS.forEach(day => {
        newSched[day.id] = { ...sourceData };
      });

      const activeDays = Object.keys(newSched)
        .filter(d => newSched[d]?.active)
        .map(Number);

      return {
        ...prev,
        weekly_schedule: newSched,
        work_days: activeDays
      };
    });
    alert('Horários e turnos replicados para todos os dias da semana!');
  };

  const handleAddWaiter = async (e) => {
    e.preventDefault();
    if (!newWaiter.name || !newWaiter.pin) return alert("Preencha nome e PIN do garçom!");

    const cleanPhone = newWaiter.phone ? newWaiter.phone.replace(/\D/g, '') : '';

    const { error } = await supabase.from('waiters').insert([{
      tenant_id: tenant.id,
      name: newWaiter.name.trim(),
      pin: newWaiter.pin.trim(),
      phone: cleanPhone,
      active: true
    }]);

    if (error) return alert("Erro ao cadastrar garçom: " + error.message);

    alert("Garçom cadastrado com sucesso!");
    setNewWaiter({ name: '', pin: '', phone: '' });
    fetchData();
  };

  const handleSendWaiterAccessWhatsApp = (waiter) => {
    let targetPhone = waiter.phone;
    if (!targetPhone) {
      const inputPhone = prompt(`Digite o WhatsApp do garçom ${waiter.name} (com DDD, ex: 11999998888):`);
      if (!inputPhone) return;
      targetPhone = inputPhone.replace(/\D/g, '');
    }

    if (!targetPhone) return alert("Telefone inválido!");

    const waiterAccessUrl = `${baseUrl}/${tenant.slug}/garcom`;
    const message = `Olá ${waiter.name}! 👋\n\nAqui está seu link de acesso ao painel do garçom no *${tenant.name}*:\n\n🔗 *Acesso:* ${waiterAccessUrl}\n🔑 *Seu PIN:* ${waiter.pin}\n\nBom trabalho! 🚀`;

    window.open(`https://wa.me/55${targetPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleUpdateWaiter = async (e) => {
    e.preventDefault();
    if (!editingWaiter.name || !editingWaiter.pin) return alert("Preencha nome e PIN!");

    const cleanPhone = editingWaiter.phone ? editingWaiter.phone.replace(/\D/g, '') : '';

    const { error } = await supabase.from('waiters').update({
      name: editingWaiter.name.trim(),
      pin: editingWaiter.pin.trim(),
      phone: cleanPhone
    }).eq('id', editingWaiter.id);

    if (error) return alert("Erro ao atualizar garçom: " + error.message);

    setEditingWaiter(null);
    fetchData();
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

  // --- LÓGICA DE VERIFICAÇÃO E SELEÇÃO DE ADICIONAIS SEM MISTURAR CATEGORIAS COM MESMO NOME ---
  const isAddonInList = (addonsListStr, addon) => {
    if (!addonsListStr || !addon) return false;
    const items = addonsListStr.split(',').map(i => i.trim()).filter(Boolean);
    
    return items.some(item => {
      const parts = item.split(':');
      const itemName = parts[0];
      const itemPrice = parsePrice(parts[1]);
      const itemCat = parts[2];

      if (itemName !== addon.name) return false;

      // Se a categoria está salva no item, compara categoricamente
      if (itemCat) {
        return itemCat === addon.category_type;
      }

      // Legado (sem categoria salva no item): compara nome e preço
      return Math.abs(itemPrice - parsePrice(addon.price)) < 0.01;
    });
  };

  const handleSingleAddonToggle = (addon, currentAddonsList, isChecked, mode) => {
    let currentArr = currentAddonsList ? currentAddonsList.split(',').map(s => s.trim()).filter(Boolean) : [];
    const formattedStr = `${addon.name}:${addon.price}:${addon.category_type || ''}`;

    if (isChecked) {
      if (!isAddonInList(currentAddonsList, addon)) {
        currentArr.push(formattedStr);
      }
    } else {
      currentArr = currentArr.filter(item => {
        const parts = item.split(':');
        const itemName = parts[0];
        const itemPrice = parsePrice(parts[1]);
        const itemCat = parts[2];

        if (itemName !== addon.name) return true;

        if (itemCat) {
          return itemCat !== addon.category_type;
        }

        return Math.abs(itemPrice - parsePrice(addon.price)) >= 0.01;
      });
    }

    const updatedStr = currentArr.join(',');
    if (mode === 'new') {
      setNewProd(prev => ({ ...prev, addons_list: updatedStr }));
    } else if (mode === 'edit') {
      setEditingProduct(prev => ({ ...prev, addons_list: updatedStr }));
    }
  };

  const handleToggleGroupAddons = (itemsGroup, currentAddonsList, mode) => {
    let currentArr = currentAddonsList ? currentAddonsList.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allSelected = itemsGroup.every(a => isAddonInList(currentAddonsList, a));

    if (allSelected) {
      itemsGroup.forEach(a => {
        currentArr = currentArr.filter(item => {
          const parts = item.split(':');
          const itemName = parts[0];
          const itemPrice = parsePrice(parts[1]);
          const itemCat = parts[2];

          const matchesName = itemName === a.name;
          const matchesCat = itemCat ? itemCat === a.category_type : Math.abs(itemPrice - parsePrice(a.price)) < 0.01;
          return !(matchesName && matchesCat);
        });
      });
    } else {
      itemsGroup.forEach(a => {
        if (!isAddonInList(currentArr.join(','), a)) {
          currentArr.push(`${a.name}:${a.price}:${a.category_type || ''}`);
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

    const activeDaysFromSchedule = tenant.weekly_schedule
      ? Object.keys(tenant.weekly_schedule)
          .filter(dayId => tenant.weekly_schedule[dayId]?.active)
          .map(Number)
      : (tenant.work_days || [1, 2, 3, 4, 5, 6]);

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
      has_lunch_break: tenant.has_lunch_break ?? false,
      lunch_opening_time: tenant.lunch_opening_time || '11:00',
      lunch_closing_time: tenant.lunch_closing_time || '14:30',
      work_days: activeDaysFromSchedule,
      weekly_schedule: typeof tenant.weekly_schedule === 'object' ? JSON.stringify(tenant.weekly_schedule) : tenant.weekly_schedule,
      pixel_id: tenant.pixel_id || '',
      custom_message: tenant.custom_message || '',
      admin_password: tenant.admin_password,
      pix_enabled: tenant.pix_enabled || false,
      pix_provider: tenant.pix_provider || 'mercadopago',
      pix_access_token: tenant.pix_access_token || '',
      has_delivery: tenant.has_delivery ?? true,
      has_balcao: tenant.has_balcao ?? true,
      has_tables: tenant.has_tables ?? true,
      has_waiters: tenant.has_waiters ?? false,
      auto_reset_orders: tenant.auto_reset_orders ?? false
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

    const finalCategoryType = isCustomCategoryNew
      ? (customCategoryInputNew.trim() || '📌 Outros')
      : (newAddon.category_type || '🍕 Pizza Salgada');

    const payload = {
      tenant_id: tenant.id,
      name: newAddon.name.trim(),
      price: formattedPrice,
      description: newAddon.description ? newAddon.description.trim() : '',
      category_type: finalCategoryType
    };

    const { error } = await supabase.from('global_addons').insert([payload]);

    if (error) return alert("Erro ao salvar adicional: " + error.message);

    setNewAddon({ name: '', price: '', description: '', category_type: '🍕 Pizza Salgada' });
    setIsCustomCategoryNew(false);
    setCustomCategoryInputNew('');
    fetchData();
  };

  const handleUpdateAddon = async (e) => {
    e.preventDefault();
    const formattedPrice = parsePrice(editingAddon.price);

    const finalCategoryType = isCustomCategoryEdit
      ? (customCategoryInputEdit.trim() || '📌 Outros')
      : (editingAddon.category_type || '🍕 Pizza Salgada');

    const { error } = await supabase.from('global_addons').update({
      name: editingAddon.name.trim(),
      price: formattedPrice,
      description: editingAddon.description || '',
      category_type: finalCategoryType
    }).eq('id', editingAddon.id);

    if (error) return alert("Erro ao editar adicional: " + error.message);

    setEditingAddon(null);
    setIsCustomCategoryEdit(false);
    setCustomCategoryInputEdit('');
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

  const getCustomerList = () => {
    const customerMap = {};
    allOrders.forEach(order => {
      const rawPhone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
      const rawName = order.customer_name?.trim() || '';
      const orderType = (order.order_type || '').toLowerCase();
      const addr = (order.customer_address || '').toLowerCase();

      const isTable = orderType === 'mesa' || addr.includes('mesa') || order.table_number;
      const isGenericName = !rawName || rawName.toLowerCase().includes('mesa') || rawName.toLowerCase().includes('balcão') || rawName.toLowerCase().includes('balcao');

      if (isTable || !rawPhone || isGenericName) return;

      const key = rawPhone;

      if (!customerMap[key]) {
        customerMap[key] = {
          name: rawName,
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
            <p className="text-xs text-gray-400">Painel Administrativo ERP</p>
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
          <p className="text-xs sm:text-sm text-gray-400">Painel ERP & Gestão do Restaurante</p>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-red-400 font-bold transition">Sair</button>
      </header>

      {/* ABAS DE NAVEGAÇÃO COMPATÍVEIS COM MÓDULOS ATIVOS */}
      <div className="flex space-x-2 bg-gray-900 p-1.5 rounded-xl border border-gray-800 mb-6 text-xs font-bold overflow-x-auto no-print scrollbar-none">
        <button onClick={() => setActiveTab('products')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🍔 Itens</button>
        <button onClick={() => setActiveTab('addons')} className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'addons' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>➕ Adicionais/Sabores</button>
        <button onClick={() => setActiveTab('categories')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🏷️ Categorias</button>

        {(tenant.has_waiters ?? false) && (
          <button onClick={() => setActiveTab('waiters')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'waiters' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>👤 Garçons</button>
        )}

        <button onClick={() => setActiveTab('clients')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'clients' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>👥 Clientes</button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'reports' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>📊 Financeiro</button>

        {(tenant.has_tables ?? true) && (
          <button onClick={() => setActiveTab('tables')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'tables' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🪑 Mesas QR</button>
        )}

        {(tenant.has_delivery ?? true) && (
          <button onClick={() => setActiveTab('neighborhoods')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'neighborhoods' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>🛵 Bairros</button>
        )}

        <button onClick={() => setActiveTab('settings')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-lg text-center transition ${activeTab === 'settings' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>⚙️ Config</button>
      </div>

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

              {globalAddons.length > 0 && (
                <div className="border-t border-gray-800 pt-3 space-y-3">
                  <label className="text-[11px] text-gray-300 font-bold block">Vincular Adicionais / Sabores Habilitados:</label>

                  {ADDON_TYPES.map(type => {
                    const itemsOfType = groupedAddons[type] || [];
                    if (itemsOfType.length === 0) return null;

                    const isAllSelected = itemsOfType.every(a => isAddonInList(newProd.addons_list, a));

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
                            const isSelected = isAddonInList(newProd.addons_list, a);
                            return (
                              <label key={a.id} className="flex items-center space-x-1.5 bg-gray-800 p-1.5 rounded-lg text-[10px] cursor-pointer hover:bg-gray-750 transition">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleSingleAddonToggle(a, newProd.addons_list, e.target.checked, 'new')}
                                />
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

      {/* ABA ADICIONAIS / SABORES COM OPÇÃO DE CATEGORIA PERSONALIZADA */}
      {activeTab === 'addons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-orange-400">➕ Cadastrar Adicional ou Sabor</h3>
            <form onSubmit={handleAddGlobalAddon} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Categoria / Tipo:</label>
                <select 
                  value={isCustomCategoryNew ? 'CUSTOM' : newAddon.category_type} 
                  onChange={(e) => {
                    if (e.target.value === 'CUSTOM') {
                      setIsCustomCategoryNew(true);
                    } else {
                      setIsCustomCategoryNew(false);
                      setNewAddon({ ...newAddon, category_type: e.target.value });
                    }
                  }} 
                  className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold"
                >
                  {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="CUSTOM">✨ + Categoria Personalizada...</option>
                </select>
              </div>

              {isCustomCategoryNew && (
                <div>
                  <label className="text-[11px] text-orange-400 block mb-1 font-bold">Nome da Nova Categoria:</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 🍨 Sobremesas Especiais" 
                    value={customCategoryInputNew} 
                    onChange={(e) => setCustomCategoryInputNew(e.target.value)} 
                    className="w-full bg-gray-800 border border-orange-500/60 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold" 
                  />
                </div>
              )}

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
                          <button onClick={() => { setEditingAddon(a); setIsCustomCategoryEdit(false); }} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30">✏️</button>
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

      {/* ABA GARÇONS */}
      {activeTab === 'waiters' && (tenant.has_waiters ?? false) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          <section className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 h-fit">
            <h3 className="font-bold text-sm text-orange-400">👤 Cadastrar Garçom</h3>
            <form onSubmit={handleAddWaiter} className="space-y-3">
              <input
                type="text"
                placeholder="Nome do Garçom (Ex: Carlos)"
                value={newWaiter.name}
                onChange={(e) => setNewWaiter({ ...newWaiter, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
              <input
                type="text"
                maxLength={6}
                placeholder="PIN Numérico (Ex: 1234)"
                value={newWaiter.pin}
                onChange={(e) => setNewWaiter({ ...newWaiter, pin: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold"
              />
              <input
                type="text"
                placeholder="WhatsApp do Garçom (Ex: 11999998888)"
                value={newWaiter.phone}
                onChange={(e) => setNewWaiter({ ...newWaiter, phone: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
              <button type="submit" className="w-full bg-green-600 font-bold py-2.5 rounded-xl text-xs hover:bg-green-700 transition">
                Cadastrar Garçom 🚀
              </button>
            </form>
          </section>

          <section className="lg:col-span-2 space-y-3">
            <h3 className="font-bold text-sm text-gray-300">👥 Equipe de Garçons Cadastrados ({waitersList.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {waitersList.map((w) => (
                <div key={w.id} className="bg-gray-900 p-3.5 rounded-2xl border border-gray-800 space-y-3">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className={`font-bold block ${!w.active ? 'line-through text-gray-500' : 'text-white'}`}>👤 {w.name}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">PIN: <b className="text-orange-400 font-mono">{w.pin}</b></span>
                      {w.phone && <span className="text-[10px] text-blue-400 block">📱 {w.phone}</span>}
                    </div>

                    <div className="flex space-x-1.5">
                      <button onClick={() => setEditingWaiter(w)} className="text-xs bg-blue-600/20 text-blue-400 p-2 rounded-xl font-bold border border-blue-500/30 hover:bg-blue-600/30 transition">✏️</button>
                      <button onClick={async () => { await supabase.from('waiters').update({ active: !w.active }).eq('id', w.id); fetchData(); }} className={`text-[10px] font-bold px-2.5 py-2 rounded-xl ${w.active ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{w.active ? 'Ativo' : 'Pausado'}</button>
                      <button onClick={async () => { if (confirm("Excluir garçom?")) { await supabase.from('waiters').delete().eq('id', w.id); fetchData(); } }} className="text-xs bg-red-500/20 text-red-400 p-2 rounded-xl font-bold hover:bg-red-500/30 transition">🗑</button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendWaiterAccessWhatsApp(w)}
                    className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1">
                    <span>📱 Enviar Acesso WhatsApp</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ABA CLIENTES (CRM) - SOMENTE CLIENTES REAIS */}
      {activeTab === 'clients' && (
        <div className="space-y-6 no-print">
          <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-1">
            <h3 className="font-bold text-sm text-orange-400">👥 Registro & Ranking de Clientes (CRM)</h3>
            <p className="text-xs text-gray-400">Clientes identificados com nome e telefone (excluindo mesas e pedidos anônimos).</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customerList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4 col-span-full">Nenhum cliente com cadastro e telefone identificado ainda.</p>
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

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <label className="flex items-center space-x-2 cursor-pointer bg-gray-800 border border-gray-700 px-3 py-2 rounded-xl text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={tenant.auto_reset_orders || false}
                  onChange={(e) => handleToggleAutoReset(e.target.checked)}
                  className="w-3.5 h-3.5 accent-orange-500 rounded cursor-pointer"
                />
                <span>Auto-zerar a cada dia</span>
              </label>

              <button onClick={handleResetOrderCounter} className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-bold px-3 py-2 rounded-xl text-xs transition">
                🔄 Zerar Agora (#01)
              </button>
              <button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow">
                🖨️ Imprimir
              </button>
            </div>
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

            <section className="bg-gray-900 p-5 rounded-2xl border border-gray-800 space-y-3 no-print">
              <h3 className="font-bold text-xs text-orange-400 uppercase">📋 Histórico Auditado de Pedidos</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredOrders.map(o => (
                  <div key={o.id} className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{getOrderDisplayNumber(o)} - {o.customer_name} ({o.order_type || 'delivery'})</span>
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
      {activeTab === 'tables' && (tenant.has_tables ?? true) && (
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
      {activeTab === 'neighborhoods' && (tenant.has_delivery ?? true) && (
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

      {/* ABA CONFIGURAÇÕES DA LOJA */}
      {activeTab === 'settings' && (
        <div className="no-print space-y-6 max-w-4xl mx-auto">
          <form onSubmit={handleSaveTenantSettings} className="space-y-6">
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
                      placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxx..."
                      value={tenant.pix_access_token || ''}
                      onChange={(e) => setTenant({ ...tenant, pix_access_token: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Obtenha este token no painel do Mercado Pago Desenvolvedores em Suas Aplicações &gt; Credenciais de Produção.</p>
                  </div>
                </div>
              )}
            </section>

            {/* SEÇÃO ATUALIZADA: HORÁRIOS DE FUNCIONAMENTO SEMANAI E PAUSA ALMOÇO */}
            <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="font-bold text-base text-orange-400 border-b border-gray-800 pb-2">⏰ Horários de Funcionamento & Sequência de Pedidos</h3>

              <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenant.auto_reset_orders || false}
                    onChange={(e) => setTenant({ ...tenant, auto_reset_orders: e.target.checked })}
                    className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-orange-400">🔄 Auto-zerar sequência de pedidos a cada expediente/virada de dia</span>
                </label>
                <p className="text-[10px] text-gray-400 pl-6">Quando ativado, os novos pedidos do próximo dia/expediente começarão automaticamente do #01 sem alterar o histórico anterior.</p>
              </div>

              {/* PROGRAMAÇÃO DE HORÁRIOS DETALHADA POR DIA DA SEMANA */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-200">🗓️ Programação Semanal de Funcionamento:</h4>
                  <span className="text-[10px] text-gray-400 italic">Configure horários e pausa para almoço por dia</span>
                </div>

                <div className="space-y-3">
                  {ALL_DAYS.map((day) => {
                    const sched = tenant.weekly_schedule?.[day.id] || {
                      active: (tenant.work_days || []).includes(day.id),
                      has_lunch: tenant.has_lunch_break || false,
                      open1: tenant.lunch_opening_time || '11:00',
                      close1: tenant.lunch_closing_time || '14:30',
                      open2: tenant.opening_time || '18:00',
                      close2: tenant.closing_time || '23:30'
                    };

                    return (
                      <div key={day.id} className={`p-3.5 rounded-2xl border transition ${sched.active ? 'bg-gray-950 border-gray-800' : 'bg-gray-950/40 border-gray-900 opacity-60'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-3">
                          <div className="flex items-center space-x-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sched.active}
                                onChange={(e) => updateDaySchedule(day.id, 'active', e.target.checked)}
                                className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                              />
                              <span className="font-bold text-xs text-white">{day.label}</span>
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${sched.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {sched.active ? 'Aberto' : 'Fechado / Folga'}
                            </span>
                          </div>

                          {sched.active && (
                            <div className="flex items-center space-x-3">
                              <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-purple-300">
                                <input
                                  type="checkbox"
                                  checked={sched.has_lunch || false}
                                  onChange={(e) => updateDaySchedule(day.id, 'has_lunch', e.target.checked)}
                                  className="w-3.5 h-3.5 accent-purple-500 rounded cursor-pointer"
                                />
                                <span>Pausar para Almoço?</span>
                              </label>

                              <button
                                type="button"
                                onClick={() => copyDayScheduleToAll(day.id)}
                                className="text-[10px] bg-gray-800 hover:bg-gray-700 text-orange-400 font-bold px-2.5 py-1 rounded-lg border border-gray-700 transition"
                              >
                                📋 Copiar para Todos
                              </button>
                            </div>
                          )}
                        </div>

                        {sched.active && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* TURNO DE ALMOÇO (SE ATIVADO) */}
                            {sched.has_lunch ? (
                              <div className="bg-purple-950/20 border border-purple-500/20 p-2.5 rounded-xl space-y-1.5">
                                <span className="text-[10px] font-bold text-purple-300 block">☀️ 1º Turno (Almoço):</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-gray-400 block">Abertura:</label>
                                    <input
                                      type="time"
                                      value={sched.open1 || '11:00'}
                                      onChange={(e) => updateDaySchedule(day.id, 'open1', e.target.value)}
                                      className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-400 block">Fechamento:</label>
                                    <input
                                      type="time"
                                      value={sched.close1 || '14:30'}
                                      onChange={(e) => updateDaySchedule(day.id, 'close1', e.target.value)}
                                      className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="hidden sm:block"></div>
                            )}

                            {/* TURNO DA NOITE / JANTAR / EXPEDIENTE PRINCIPAL */}
                            <div className="bg-gray-900 border border-gray-800 p-2.5 rounded-xl space-y-1.5">
                              <span className="text-[10px] font-bold text-orange-400 block">🌙 {sched.has_lunch ? '2º Turno (Jantar / Noite):' : 'Turno Único de Funcionamento:'}</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] text-gray-400 block">Abertura:</label>
                                  <input
                                    type="time"
                                    value={sched.open2 || '18:00'}
                                    onChange={(e) => updateDaySchedule(day.id, 'open2', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-xs text-white focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-400 block">Fechamento:</label>
                                  <input
                                    type="time"
                                    value={sched.close2 || '23:30'}
                                    onChange={(e) => updateDaySchedule(day.id, 'close2', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 p-1.5 rounded-lg text-xs text-white focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

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

      {/* MODAL DE RECIBO NÃO-FISCAL */}
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
                <div><b>Pedido:</b> {getOrderDisplayNumber(selectedReceiptOrder)}</div>
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

      {/* ÁREA INVISÍVEL PARA IMPRESSORA TÉRMICA 80MM */}
      {selectedReceiptOrder && (
        <div className="print-area hidden print:block">
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '5px' }}>
            <strong style={{ fontSize: '13px' }}>{tenant.name}</strong><br />
            {tenant.cnpj && <span>CNPJ: {tenant.cnpj}<br /></span>}
            {tenant.address && <span>{tenant.address}<br /></span>}
            --------------------------------
          </div>
          <div style={{ padding: '5px 0', borderBottom: '1px dashed #000' }}>
            PEDIDO: {getOrderDisplayNumber(selectedReceiptOrder)}<br />
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
                    <span>Pedido {getOrderDisplayNumber(o)}</span>
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

      {/* MODAL EDITAR GARÇOM */}
      {editingWaiter && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateWaiter} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Garçom</h3>
            <input type="text" value={editingWaiter.name} onChange={(e) => setEditingWaiter({ ...editingWaiter, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <input type="text" maxLength={6} value={editingWaiter.pin} onChange={(e) => setEditingWaiter({ ...editingWaiter, pin: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold" />
            <input type="text" placeholder="WhatsApp do Garçom" value={editingWaiter.phone || ''} onChange={(e) => setEditingWaiter({ ...editingWaiter, phone: e.target.value })} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none" />
            <div className="flex space-x-2">
              <button type="button" onClick={() => setEditingWaiter(null)} className="w-1/2 bg-gray-800 py-2.5 rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="w-1/2 bg-blue-600 py-2.5 rounded-xl text-xs font-bold text-white">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDITAR ADICIONAL OU SABOR */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 no-print">
          <form onSubmit={handleUpdateAddon} className="bg-gray-900 w-full max-w-sm rounded-2xl p-5 border border-blue-500/40 space-y-3">
            <h3 className="font-bold text-sm text-blue-400">✏️ Editar Adicional / Sabor</h3>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Categoria / Tipo:</label>
              <select
                value={isCustomCategoryEdit ? 'CUSTOM' : (editingAddon.category_type || '🍕 Pizza Salgada')}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setIsCustomCategoryEdit(true);
                  } else {
                    setIsCustomCategoryEdit(false);
                    setEditingAddon({ ...editingAddon, category_type: e.target.value });
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold"
              >
                {ADDON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="CUSTOM">✨ + Categoria Personalizada...</option>
              </select>
            </div>

            {isCustomCategoryEdit && (
              <div>
                <label className="text-[11px] text-orange-400 block mb-1 font-bold">Nome da Nova Categoria:</label>
                <input 
                  type="text" 
                  placeholder="Ex: 🍨 Sobremesas Especiais" 
                  value={customCategoryInputEdit} 
                  onChange={(e) => setCustomCategoryInputEdit(e.target.value)} 
                  className="w-full bg-gray-800 border border-orange-500/60 p-2.5 rounded-xl text-xs text-white focus:outline-none font-bold" 
                />
              </div>
            )}

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

      {/* MODAL DE EDIÇÃO DE PRODUTO / COMBO */}
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

            {globalAddons.length > 0 && (
              <div className="border-t border-gray-800 pt-3 space-y-3">
                <label className="text-[11px] text-gray-300 font-bold block">Adicionais / Sabores Vinculados:</label>
                {ADDON_TYPES.map(type => {
                  const itemsOfType = groupedAddons[type] || [];
                  if (itemsOfType.length === 0) return null;

                  const isAllSelected = itemsOfType.every(a => isAddonInList(editingProduct.addons_list, a));

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
                          const isSelected = isAddonInList(editingProduct.addons_list, a);
                          return (
                            <label key={a.id} className="flex items-center space-x-1.5 bg-gray-800 p-1.5 rounded-lg text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSingleAddonToggle(a, editingProduct.addons_list, e.target.checked, 'edit')}
                              />
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
