import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

// MÁSCARA AUXILIAR DE WHATSAPP / TELEFONE
const maskPhone = (value) => {
  if (!value) return '';
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return clean.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').slice(0, 15);
};

export default function DeliveryCliente() {
  const router = useRouter();
  const { slug, mesa, m } = router.query;

  const [tenant, setTenant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [globalAddons, setGlobalAddons] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // DETECÇÃO DE MESA VIA URL (?mesa=05 ou ?m=05)
  const [tableNumber, setTableNumber] = useState('');

  // MODAL DE DETALHES DO PRODUTO (ADICIONAIS, COMBOS, BORDAS E OBSERVAÇÃO)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [comboSelections, setComboSelections] = useState({}); // { [stepIndex]: [addonObj1, addonObj2] }
  const [selectedBorder, setSelectedBorder] = useState(null);
  const [itemObservation, setItemObservation] = useState('');
  
  // BUSCA INTERNA DE SABORES NO MODAL
  const [modalAddonSearch, setModalAddonSearch] = useState('');

  // CARRINHO DE COMPRAS E CHECKOUT
  const [cart, setCart] = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [deliveryType, setDeliveryType] = useState('ENTREGA');
  const [selectedNeighFee, setSelectedNeighFee] = useState(0);
  const [selectedNeighName, setSelectedNeighName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pagar no Balcão');
  const [cardPaymentType, setCardPaymentType] = useState('maquininha');
  const [changeValue, setChangeValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ESTADOS DO PIX DINÂMICO AUTOMÁTICO
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState(null);
  const [pixStatus, setPixStatus] = useState('pending');
  const [pixCopySuccess, setPixCopySuccess] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  useEffect(() => {
    if (router.isReady) {
      const currentMesa = mesa || m || '';
      if (currentMesa) {
        setTableNumber(String(currentMesa));
        setDeliveryType('MESA');
        setPaymentMethod('Pagar no Balcão');
      }
      if (slug) {
        fetchTenantData();
      }
    }

    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('delivery_client_name');
      const savedPhone = localStorage.getItem('delivery_client_phone');
      const savedAddr = localStorage.getItem('delivery_client_address');

      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(maskPhone(savedPhone));
      if (savedAddr) setCustomerAddress(savedAddr);
    }
  }, [router.isReady, slug, mesa, m]);

  // POLLING EM TEMPO REAL DO PIX DINÂMICO
  useEffect(() => {
    let interval = null;
    if (showPixModal && pixPaymentId && tenant?.pix_access_token && pixStatus !== 'approved') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${pixPaymentId}`, {
            headers: { 'Authorization': `Bearer ${tenant.pix_access_token}` }
          });
          const data = await res.json();
          if (data && data.status === 'approved') {
            setPixStatus('approved');
            if (currentOrderId) {
              await supabase.from('orders').update({ is_paid: true, status: 'em_preparo' }).eq('id', currentOrderId);
            }
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Erro ao verificar status do PIX:", e);
        }
      }, 3500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showPixModal, pixPaymentId, pixStatus, tenant, currentOrderId]);

  const fetchTenantData = async () => {
    setLoading(true);
    const cleanSlug = String(slug).toLowerCase().trim();
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', cleanSlug).maybeSingle();

    if (tData) {
      setTenant(tData);

      if (tData.pixel_id && typeof window !== 'undefined') {
        !(function (f, b, e, v, n, t, s) {
          if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
          if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
          n.queue = []; t = b.createElement(e); t.async = !0;
          t.src = v; s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        window.fbq('init', tData.pixel_id);
        window.fbq('track', 'PageView');
      }

      const { data: cData } = await supabase.from('categories').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });
      const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('active', true).order('id', { ascending: true });
      const { data: aData } = await supabase.from('global_addons').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });
      const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tData.id).order('name', { ascending: true });

      if (cData) setCategories(cData);
      if (pData) setProducts(pData);
      if (aData) setGlobalAddons(aData);
      if (nData) setNeighborhoods(nData);
    }
    setLoading(false);
  };

  const isStoreOpen = () => {
    if (!tenant) return true;
    if (!tenant.opening_time || !tenant.closing_time) return true;

    const now = new Date();
    const currentDay = now.getDay();
    const workDays = tenant.work_days || [1, 2, 3, 4, 5, 6, 0];

    if (!workDays.includes(currentDay)) return false;

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = tenant.opening_time.split(':').map(Number);
    const [closeH, closeM] = tenant.closing_time.split(':').map(Number);

    const openMins = openH * 60 + openM;
    let closeMins = closeH * 60 + closeM;

    if (closeMins < openMins) {
      closeMins += 24 * 60;
      if (currentMins < openMins) {
        const adjustedCurrent = currentMins + 24 * 60;
        return adjustedCurrent >= openMins && adjustedCurrent <= closeMins;
      }
    }

    return currentMins >= openMins && currentMins <= closeMins;
  };

  const handleOpenProductModal = (product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setSelectedAddons([]);
    setComboSelections({});
    setItemObservation('');
    setModalAddonSearch('');

    const borders = getBordersArray(product.borders_list);
    if (borders.length > 0) {
      setSelectedBorder(borders[0]);
    } else {
      setSelectedBorder(null);
    }
  };

  // NORMAS DE LIMITAÇÃO PARA PRODUTOS NORMAIS
  const toggleAddon = (addon) => {
    const exists = selectedAddons.some(a => a.name === addon.name);
    const maxAllowed = Number(selectedProduct?.max_addons || 0);

    if (exists) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      if (maxAllowed > 0 && selectedAddons.length >= maxAllowed) {
        return alert(`Você pode escolher no máximo ${maxAllowed} sabores/opções para este item!`);
      }
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // NORMAS DE LIMITAÇÃO PARA ETAPAS DE COMBO
  const toggleComboAddon = (stepIdx, addon, stepMax) => {
    const currentStepSelected = comboSelections[stepIdx] || [];
    const exists = currentStepSelected.some(a => a.name === addon.name);

    if (exists) {
      setComboSelections({
        ...comboSelections,
        [stepIdx]: currentStepSelected.filter(a => a.name !== addon.name)
      });
    } else {
      if (stepMax > 0 && currentStepSelected.length >= stepMax) {
        return alert(`Nesta etapa você pode escolher no máximo ${stepMax} opção(ões)!`);
      }
      setComboSelections({
        ...comboSelections,
        [stepIdx]: [...currentStepSelected, addon]
      });
    }
  };

  const handleAddProductToCart = () => {
    if (!selectedProduct) return;

    // VALIDAÇÃO DE COMBO
    if (selectedProduct.is_combo && selectedProduct.combo_steps?.length > 0) {
      for (let idx = 0; idx < selectedProduct.combo_steps.length; idx++) {
        const step = selectedProduct.combo_steps[idx];
        const selectedInStep = comboSelections[idx] || [];
        if (selectedInStep.length === 0) {
          return alert(`Por favor, selecione as opções da etapa: "${step.title || `Etapa #${idx + 1}`}"`);
        }
      }
    }

    let unitPrice = Number(selectedProduct.price);
    let formattedComboSteps = [];

    if (selectedProduct.is_combo && selectedProduct.combo_steps?.length > 0) {
      let comboExtras = 0;
      Object.values(comboSelections).forEach(addons => {
        addons.forEach(a => { comboExtras += Number(a.price || 0); });
      });
      unitPrice += comboExtras;

      formattedComboSteps = selectedProduct.combo_steps.map((step, idx) => ({
        title: step.title || `Etapa #${idx + 1}`,
        items: comboSelections[idx] || []
      }));
    } else {
      const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
      unitPrice += addonsTotal;
    }

    const borderFee = selectedBorder ? Number(selectedBorder.price) : 0;
    unitPrice += borderFee;

    const cartItem = {
      cartItemId: `${selectedProduct.id}-${Date.now()}`,
      id: selectedProduct.id,
      name: selectedProduct.name,
      price: unitPrice,
      basePrice: Number(selectedProduct.price),
      unitPrice: unitPrice,
      quantity: productQuantity,
      is_combo: selectedProduct.is_combo || false,
      comboSteps: formattedComboSteps,
      selectedAddons: selectedAddons,
      selectedBorder: selectedBorder,
      observation: itemObservation,
      image: selectedProduct.image
    };

    setCart([...cart, cartItem]);
    setSelectedProduct(null);

    if (window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_name: selectedProduct.name,
        value: unitPrice * productQuantity,
        currency: 'BRL'
      });
    }
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const copyPixCode = () => {
    if (!pixCopyPaste) return;
    navigator.clipboard.writeText(pixCopyPaste);
    setPixCopySuccess(true);
    setTimeout(() => setPixCopySuccess(false), 3000);
  };

  const sendWhatsAppNotification = (orderId, isPaid = false, customPaymentLabel = null) => {
    let itemsText = cart.map(i => {
      let txt = `• ${i.quantity}x ${i.name} (R$ ${(i.unitPrice * i.quantity).toFixed(2)})`;
      
      if (i.is_combo && i.comboSteps && i.comboSteps.length > 0) {
        i.comboSteps.forEach(step => {
          const itemsStr = step.items.map(a => `${a.name}${Number(a.price) > 0 ? ` (+R$ ${Number(a.price).toFixed(2)})` : ''}`).join(', ');
          if (itemsStr) {
            txt += `\n   └ *${step.title}:* ${itemsStr}`;
          }
        });
      } else if (i.selectedAddons && i.selectedAddons.length > 0) {
        txt += `\n   + Sabores/Adicionais: ${i.selectedAddons.map(a => `${a.name}${Number(a.price) > 0 ? ` (+R$ ${Number(a.price).toFixed(2)})` : ''}`).join(', ')}`;
      }

      if (i.selectedBorder && i.selectedBorder.name !== 'Sem Borda') {
        txt += `\n   + Borda: ${i.selectedBorder.name}${Number(i.selectedBorder.price) > 0 ? ` (+R$ ${Number(i.selectedBorder.price).toFixed(2)})` : ''}`;
      }
      if (i.observation) {
        txt += `\n   Obs: _"${i.observation}"_`;
      }
      return txt;
    }).join('\n\n');

    let msg = `*NOVO PEDIDO #${orderId} - ${tenant.name.toUpperCase()}*\n\n`;
    msg += `*Cliente:* ${customerName}\n`;
    if (customerPhone) msg += `*Telefone:* ${customerPhone}\n`;

    if (deliveryType === 'MESA' || tableNumber) {
      msg += `*Local:* 🪑 MESA ${tableNumber}\n`;
    } else {
      msg += `*Tipo:* ${deliveryType === 'ENTREGA' ? '🛵 Entrega em Casa' : '🏪 Retirar no Balcão'}\n`;
      if (deliveryType === 'ENTREGA') {
        msg += `*Endereço:* ${customerAddress}\n*Bairro:* ${selectedNeighName}\n`;
      }
    }

    msg += `\n*ITENS DO PEDIDO:*\n${itemsText}\n\n`;
    msg += `*Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
    if (deliveryType === 'ENTREGA' && !tableNumber) {
      msg += `*Taxa Entrega:* R$ ${currentDeliveryFee.toFixed(2)}\n`;
    }
    msg += `*TOTAL:* *R$ ${total.toFixed(2)}*\n`;

    const activePaymentLabel = customPaymentLabel || paymentMethod;
    if (isPaid) {
      msg += `*Pagamento:* 🟢 PIX PAGO (Confirmado pelo Sistema Automático)`;
    } else {
      msg += `*Pagamento:* ${activePaymentLabel} ${changeValue ? `(Troco para R$ ${changeValue})` : ''}`;
    }

    if (tenant.custom_message) {
      msg += `\n\n📌 _${tenant.custom_message}_`;
    }

    const cleanWhatsapp = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, '') : '';
    if (cleanWhatsapp) {
      window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleFinishOrder = async (e) => {
    e.preventDefault();
    const cleanPhone = customerPhone.replace(/\D/g, '');

    if (cart.length === 0) return alert("Seu carrinho está vazio!");
    if (!customerName) return alert("Preencha seu Nome!");
    if (deliveryType === 'ENTREGA' && !tableNumber && !customerAddress) return alert("Preencha seu Endereço para entrega!");

    setIsSubmitting(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('delivery_client_name', customerName);
      localStorage.setItem('delivery_client_phone', cleanPhone);
      if (customerAddress) localStorage.setItem('delivery_client_address', customerAddress);
    }

    let fullAddress = 'Retirada no Balcão';
    if (deliveryType === 'ENTREGA') {
      fullAddress = `${customerAddress} (${selectedNeighName || 'Sem bairro'})`;
    } else if (deliveryType === 'MESA' || tableNumber) {
      fullAddress = `MESA ${tableNumber || 'Consumo Local'}`;
    }

    let finalPaymentLabel = paymentMethod;
    if (paymentMethod.includes('Cartão')) {
      finalPaymentLabel = cardPaymentType === 'online' 
        ? 'Cartão (PAGO ONLINE)' 
        : 'Cartão (Levar Maquininha)';
    }

    const orderData = {
      tenant_id: tenant.id,
      customer_name: customerName,
      customer_phone: cleanPhone || '00000000000',
      customer_address: fullAddress,
      order_type: (deliveryType === 'ENTREGA' ? 'delivery' : deliveryType === 'MESA' ? 'mesa' : 'balcao'),
      table_number: tableNumber || null,
      neighborhood: selectedNeighName || '',
      items: cart,
      subtotal: subtotal,
      delivery_fee: currentDeliveryFee,
      total: total,
      payment_method: finalPaymentLabel,
      change_for: changeValue,
      status: 'recebido',
      is_paid: false
    };

    const { data: createdOrder, error } = await supabase.from('orders').insert([orderData]).select().single();

    if (error) {
      setIsSubmitting(false);
      return alert("Erro ao enviar pedido: " + error.message);
    }

    setCurrentOrderId(createdOrder.id);

    if (window.fbq) {
      window.fbq('track', 'Purchase', { value: total, currency: 'BRL' });
    }

    if (paymentMethod === 'PIX' && tenant.pix_enabled && tenant.pix_access_token) {
      try {
        const mpRes = await fetch('/api/create-pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(total.toFixed(2)),
            description: `Pedido #${createdOrder.id} - ${tenant.name}`,
            accessToken: tenant.pix_access_token,
            orderId: createdOrder.id,
            payer: { email: `${cleanPhone || 'cliente'}@delivery.com`, name: customerName }
          })
        });

        const mpData = await mpRes.json();
        if (mpRes.ok && mpData.qr_code_base64) {
          setPixQrCodeBase64(mpData.qr_code_base64);
          setPixCopyPaste(mpData.qr_code);
          setPixPaymentId(mpData.id);
          setPixStatus('pending');
          setShowPixModal(true);
          setShowCartModal(false);
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.error("Erro ao gerar PIX:", err);
      }
    }

    if (paymentMethod.includes('Cartão') && cardPaymentType === 'online' && tenant?.pix_access_token) {
      try {
        const prefRes = await fetch('/api/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            deliveryFee: currentDeliveryFee,
            accessToken: tenant.pix_access_token,
            orderId: createdOrder.id,
            tenantName: tenant.name,
            customerName: customerName,
            customerPhone: cleanPhone
          })
        });

        const prefData = await prefRes.json();
        if (prefRes.ok && prefData.init_point) {
          setIsSubmitting(false);
          setCart([]);
          setShowCartModal(false);
          window.location.href = prefData.init_point;
          return;
        }
      } catch (err) {
        console.error("Erro ao gerar link de pagamento online:", err);
        alert("Não foi possível iniciar o pagamento online. O pedido foi registrado para pagamento na entrega.");
      }
    }

    sendWhatsAppNotification(createdOrder.id, false, finalPaymentLabel);
    setIsSubmitting(false);
    setCart([]);
    setShowCartModal(false);
    alert(`Pedido #${createdOrder.id} enviado com sucesso!`);
  };

  // PARSER DE SABORES COM INGREDIENTES E CATEGORIA AGRUPADA
  const getProductAddonsArray = (addonsStr) => {
    if (!addonsStr) return [];

    let list = [];
    if (typeof addonsStr === 'object') {
      list = Array.isArray(addonsStr) ? addonsStr : [];
    } else {
      try {
        const parsed = JSON.parse(addonsStr);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        list = String(addonsStr).split(',').filter(Boolean).map(item => {
          const parts = item.split(':');
          const name = parts[0] ? parts[0].trim() : item;
          const price = parts[1] ? parseFloat(parts[1].replace(',', '.')) : 0;
          return { name, price: isNaN(price) ? 0 : price };
        });
      }
    }

    return list.map(item => {
      const matched = globalAddons.find(g => g.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      return {
        ...item,
        description: item.description || matched?.description || '',
        category_type: matched?.category_type || '🍕 Sabores Tradicionais'
      };
    });
  };

  // PARSER DE BORDAS RECHEADAS
  const getBordersArray = (bordersStr) => {
    if (!bordersStr) return [];
    return String(bordersStr).split(',').filter(Boolean).map(item => {
      const parts = item.split(':');
      const name = parts[0] ? parts[0].trim() : item;
      const price = parts[1] ? parseFloat(parts[1].replace(',', '.')) : 0;
      return { name, price: isNaN(price) ? 0 : price };
    });
  };

  // HELPER PARA AGRUPAR ADICIONAIS/SABORES POR CATEGORIA E FILTRAR POR BUSCA
  const getGroupedAddons = (addonsStr) => {
    const allAddons = getProductAddonsArray(addonsStr);
    
    const filtered = allAddons.filter(a => 
      a.name.toLowerCase().includes(modalAddonSearch.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(modalAddonSearch.toLowerCase()))
    );

    const groups = {};
    filtered.forEach(item => {
      const cat = item.category_type || '🍕 Sabores / Opcionais';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return groups;
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-xs text-gray-400">Carregando cardápio...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  const primaryColor = tenant.primary_color || '#FF8C00';
  const btnTextColor = tenant.button_text_color || '#FFFFFF';
  const bgColor = tenant.background_color || tenant.secondary_color || '#090D16';
  const cardColor = tenant.card_color || '#111827';
  const textColor = tenant.text_color || '#FFFFFF';

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const currentDeliveryFee = deliveryType === 'ENTREGA' ? Number(selectedNeighFee || 0) : 0;
  const total = subtotal + currentDeliveryFee;

  const filteredProducts = selectedCat === 'ALL' ? products : products.filter(p => String(p.category_id) === String(selectedCat));
  const promoBannerList = tenant.promo_banners ? tenant.promo_banners.split(',').map(b => b.trim()).filter(Boolean) : [];
  const isOpen = isStoreOpen();

  // CÁLCULO DINÂMICO DE PREÇO NO MODAL DO PRODUTO
  let currentModalUnitPrice = Number(selectedProduct?.price || 0);
  if (selectedProduct) {
    if (selectedProduct.is_combo && selectedProduct.combo_steps?.length > 0) {
      let comboExtras = 0;
      Object.values(comboSelections).forEach(addons => {
        addons.forEach(a => { comboExtras += Number(a.price || 0); });
      });
      currentModalUnitPrice += comboExtras;
    } else {
      currentModalUnitPrice += selectedAddons.reduce((a, b) => a + Number(b.price || 0), 0);
    }
    if (selectedBorder) {
      currentModalUnitPrice += Number(selectedBorder.price || 0);
    }
  }

  return (
    <div className="min-h-screen font-sans pb-28 max-w-6xl mx-auto transition-colors duration-300 relative px-3 sm:px-6 lg:px-8" style={{ backgroundColor: bgColor, color: textColor }}>
      
      {tenant.custom_message && (
        <div className="bg-orange-600 text-white text-[11px] sm:text-xs font-bold py-2.5 px-4 text-center shadow rounded-b-xl flex items-center justify-center space-x-2">
          <span>📢 {tenant.custom_message}</span>
        </div>
      )}

      {/* BANNER E PERFIL RESPONSIVO */}
      <div className="relative h-40 sm:h-52 md:h-64 bg-gray-900 border-b border-white/10 rounded-2xl overflow-hidden mt-3 shadow-2xl">
        <img src={tenant.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80'} alt="Banner" className="w-full h-full object-cover opacity-50" />
        
        {tenant.instagram_url && (
          <a
            href={tenant.instagram_url.startsWith('http') ? tenant.instagram_url : `https://${tenant.instagram_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg transition flex items-center space-x-1.5 hover:scale-105 z-10">
            <span>📸 Instagram</span>
          </a>
        )}

        <div className="absolute -bottom-2 left-4 sm:left-8 flex items-end space-x-4 pb-4">
          <img src={tenant.logo_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80'} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-gray-950 object-cover bg-gray-800 shadow-xl" />
          <div className="pb-1">
            <h1 className="font-extrabold text-xl sm:text-2xl md:text-3xl leading-tight" style={{ color: textColor }}>{tenant.name}</h1>
            <p className="text-xs sm:text-sm opacity-80 font-medium">
              {tableNumber ? `🪑 Autoatendimento • Mesa ${tableNumber}` : '🛵 Cardápio Digital & Delivery'}
            </p>
          </div>
        </div>
      </div>

      {!isOpen && (
        <div className="mt-6">
          <div className="bg-red-500/20 border border-red-500/40 text-red-400 p-3.5 rounded-2xl text-xs sm:text-sm text-center font-bold">
            🔴 Loja Fechada no Momento. (Horário: {tenant.opening_time || '18:00'} às {tenant.closing_time || '23:30'})
          </div>
        </div>
      )}

      {tableNumber && (
        <div className="mt-4">
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-lg flex justify-between items-center text-xs sm:text-sm font-bold">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📍</span>
              <div>
                <p className="font-extrabold uppercase leading-tight">Você está na MESA {tableNumber}</p>
                <p className="text-xs opacity-90 font-normal">Seus pedidos serão entregues direto na sua mesa.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {promoBannerList.length > 0 && (
        <div className="mt-6">
          <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-none">
            {promoBannerList.map((bannerUrl, idx) => (
              <img key={idx} src={bannerUrl} alt={`Promoção ${idx + 1}`} className="w-80 h-36 sm:w-96 sm:h-44 rounded-2xl object-cover border border-white/10 shrink-0 shadow-md hover:scale-105 transition" />
            ))}
          </div>
        </div>
      )}

      {/* SELETOR DE CATEGORIAS */}
      <div className="mt-6">
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            style={{ 
              backgroundColor: selectedCat === 'ALL' ? primaryColor : cardColor,
              color: selectedCat === 'ALL' ? btnTextColor : textColor
            }}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border border-white/10 transition shadow-sm">
            🍽️ Todos os Itens
          </button>
          {categories.map(c => {
            const isSelected = String(selectedCat) === String(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                style={{ 
                  backgroundColor: isSelected ? primaryColor : cardColor,
                  color: isSelected ? btnTextColor : textColor
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border border-white/10 transition shadow-sm">
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA DE PRODUTOS MODULAR (GRID RESPONSIVO) */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(p => (
          <div 
            key={p.id} 
            onClick={() => handleOpenProductModal(p)}
            style={{ backgroundColor: cardColor }} 
            className="p-3.5 rounded-2xl border border-white/10 hover:border-orange-500/50 transition flex flex-col justify-between cursor-pointer space-y-3 group shadow-lg">
            
            <div className="flex items-start space-x-3">
              <img src={p.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80'} alt={p.name} className="w-20 h-20 rounded-xl object-cover border border-white/10 bg-gray-800 shrink-0 group-hover:scale-105 transition" />
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-xs sm:text-sm flex items-center space-x-1 truncate" style={{ color: textColor }}>
                  <span>{p.name}</span>
                  {p.is_combo && <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold">COMBO</span>}
                </h3>
                <p className="text-[11px] opacity-60 line-clamp-2 mt-1">{p.description || 'Sem descrição'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="font-extrabold text-sm sm:text-base" style={{ color: primaryColor }}>
                R$ {Number(p.price).toFixed(2)}
                {p.max_addons > 0 && !p.is_combo && <span className="text-[10px] opacity-70 font-normal ml-1 block sm:inline">(Até {p.max_addons} sab.)</span>}
              </span>

              <button style={{ backgroundColor: primaryColor, color: btnTextColor }} className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shadow transition group-hover:opacity-90">
                + Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-16 border-t border-white/10 pt-8 pb-10 text-center space-y-4">
        <div className="flex flex-col items-center justify-center space-y-2">
          <img
            src={tenant.logo_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'}
            alt={tenant.name}
            className="w-14 h-14 rounded-2xl border border-white/10 object-cover bg-gray-800 shadow"
          />
          <h3 className="font-bold text-base" style={{ color: textColor }}>{tenant.name}</h3>
          {tenant.opening_time && tenant.closing_time && (
            <p className="text-xs opacity-70">
              🕒 Horário: {tenant.opening_time} às {tenant.closing_time}
            </p>
          )}
        </div>

        <div className="flex justify-center items-center space-x-4 text-xs font-bold pt-1">
          {tenant.whatsapp && (
            <a
              href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:underline flex items-center space-x-1">
              <span>💬 Contato WhatsApp</span>
            </a>
          )}
          {tenant.instagram_url && (
            <a
              href={tenant.instagram_url.startsWith('http') ? tenant.instagram_url : `https://${tenant.instagram_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:underline flex items-center space-x-1">
              <span>📸 Instagram</span>
            </a>
          )}
        </div>

        <div className="text-[10px] opacity-40 border-t border-white/5 pt-4 space-y-1">
          <p>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</p>
          <p>Plataforma Desenvolvida com ⚡ Sinerge MKT</p>
        </div>
      </footer>

      {/* BOTÃO FLUTUANTE DO CARRINHO */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setShowCartModal(true)}
            style={{ backgroundColor: primaryColor, color: btnTextColor }}
            className="w-full font-bold p-4 rounded-2xl flex justify-between items-center shadow-2xl transition hover:opacity-95">
            <span className="text-xs bg-black/20 px-3 py-1.5 rounded-xl font-extrabold">🛒 {cart.reduce((a, b) => a + b.quantity, 0)} itens</span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider">{tableNumber ? `Enviar p/ Mesa ${tableNumber}` : 'Ver Carrinho'}</span>
            <span className="text-xs sm:text-sm font-black">R$ {subtotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MODAL DE DETALHES DO ITEM COM SABORES ORGANIZADOS POR CATEGORIA */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-white/10 w-full max-w-lg rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-extrabold text-base truncate" style={{ color: primaryColor }}>{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="opacity-60 hover:opacity-100 font-bold text-xs bg-black/30 px-3 py-1.5 rounded-xl">✕ Fechar</button>
            </div>

            <img src={selectedProduct.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80'} alt={selectedProduct.name} className="w-full h-40 sm:h-48 rounded-2xl object-cover border border-white/10" />
            <p className="text-xs opacity-75">{selectedProduct.description}</p>

            {/* MONTAGEM DE COMBO EM ETAPAS */}
            {selectedProduct.is_combo && selectedProduct.combo_steps?.length > 0 ? (
              <div className="space-y-4 pt-2 border-t border-white/10">
                {selectedProduct.combo_steps.map((step, stepIdx) => {
                  const allLinkedAddons = getProductAddonsArray(selectedProduct.addons_list);
                  let stepAddons = allLinkedAddons.filter(a => a.category_type === step.category_type);
                  
                  if (stepAddons.length === 0) {
                    stepAddons = globalAddons.filter(g => g.category_type === step.category_type);
                  }

                  const selectedInStep = comboSelections[stepIdx] || [];
                  const stepMax = Number(step.max || 1);

                  return (
                    <div key={stepIdx} className="space-y-2 bg-black/20 p-3 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-extrabold block text-orange-400">
                          {step.title || `Etapa #${stepIdx + 1}`}
                        </label>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          selectedInStep.length === stepMax
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        }`}>
                          {selectedInStep.length} / {stepMax}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {stepAddons.length === 0 ? (
                          <p className="text-[10px] opacity-50 italic">Nenhum item cadastrado nesta categoria.</p>
                        ) : (
                          stepAddons.map((addon, idx) => {
                            const isChecked = selectedInStep.some(a => a.name === addon.name);
                            return (
                              <div
                                key={idx}
                                onClick={() => toggleComboAddon(stepIdx, addon, stepMax)}
                                style={{
                                  backgroundColor: isChecked ? `${primaryColor}22` : bgColor,
                                  borderColor: isChecked ? primaryColor : 'rgba(255,255,255,0.1)'
                                }}
                                className="p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition">
                                <div className="flex items-center space-x-2">
                                  <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-orange-500 pointer-events-none" />
                                  <div>
                                    <span className="font-bold block">{addon.name}</span>
                                    {addon.description && <p className="text-[10px] opacity-60 leading-tight">{addon.description}</p>}
                                  </div>
                                </div>
                                <span style={{ color: primaryColor }} className="font-bold shrink-0 whitespace-nowrap pl-1">
                                  {Number(addon.price) > 0 ? `+ R$ ${Number(addon.price).toFixed(2)}` : 'Incluso'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SEÇÃO DE ITEM SIMPLES / PIZZA COM SABORES CATEGORIZADOS */
              getProductAddonsArray(selectedProduct.addons_list).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-extrabold block opacity-90">
                      {selectedProduct.max_addons > 0 ? '🍕 Escolha os Sabores:' : '➕ Adicionais Opcionais:'}
                    </label>

                    {selectedProduct.max_addons > 0 && (
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                        selectedAddons.length === Number(selectedProduct.max_addons)
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      }`}>
                        Selecionados: {selectedAddons.length} / {selectedProduct.max_addons}
                      </span>
                    )}
                  </div>

                  {/* CAMPO DE BUSCA DE SABORES */}
                  <input
                    type="text"
                    placeholder="🔍 Pesquisar sabor ou ingrediente..."
                    value={modalAddonSearch}
                    onChange={(e) => setModalAddonSearch(e.target.value)}
                    style={{ backgroundColor: bgColor, color: textColor }}
                    className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none focus:border-orange-500"
                  />

                  {/* LISTA DE SABORES AGRUPADOS POR CATEGORIA (DOCES, SALGADAS, ETC) */}
                  <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                    {Object.keys(getGroupedAddons(selectedProduct.addons_list)).length === 0 ? (
                      <p className="text-xs opacity-50 text-center py-4">Nenhum sabor encontrado.</p>
                    ) : (
                      Object.entries(getGroupedAddons(selectedProduct.addons_list)).map(([catName, groupAddons]) => (
                        <div key={catName} className="space-y-2">
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-orange-400 bg-black/40 px-2.5 py-1 rounded-lg border-l-4 border-orange-500">
                            {catName}
                          </h4>

                          <div className="space-y-1.5">
                            {groupAddons.map((addon, idx) => {
                              const isChecked = selectedAddons.some(a => a.name === addon.name);
                              return (
                                <div
                                  key={idx}
                                  onClick={() => toggleAddon(addon)}
                                  style={{ 
                                    backgroundColor: isChecked ? `${primaryColor}22` : bgColor, 
                                    borderColor: isChecked ? primaryColor : 'rgba(255,255,255,0.1)' 
                                  }}
                                  className="p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition">
                                  <div className="flex items-center space-x-2">
                                    <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-orange-500 pointer-events-none" />
                                    <div>
                                      <span className="font-bold block">{addon.name}</span>
                                      {addon.description && <p className="text-[10px] opacity-60 leading-tight">{addon.description}</p>}
                                    </div>
                                  </div>
                                  <span style={{ color: primaryColor }} className="font-bold shrink-0 whitespace-nowrap pl-1">
                                    {Number(addon.price) > 0 ? `+ R$ ${Number(addon.price).toFixed(2)}` : 'Grátis'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            )}

            {/* SEÇÃO DE BORDAS RECHEADAS */}
            {getBordersArray(selectedProduct.borders_list).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-extrabold block opacity-90">🫓 Escolha a Borda:</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {getBordersArray(selectedProduct.borders_list).map((border, idx) => {
                    const isSelected = selectedBorder?.name === border.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedBorder(border)}
                        style={{ backgroundColor: isSelected ? `${primaryColor}22` : bgColor, borderColor: isSelected ? primaryColor : 'rgba(255,255,255,0.1)' }}
                        className="p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition">
                        <div className="flex items-center space-x-2">
                          <input type="radio" checked={isSelected} onChange={() => {}} className="accent-orange-500 pointer-events-none" />
                          <span className="font-bold">{border.name}</span>
                        </div>
                        <span style={{ color: primaryColor }} className="font-bold text-[11px]">
                          {Number(border.price) > 0 ? `+ R$ ${Number(border.price).toFixed(2)}` : 'Grátis'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1 pt-2 border-t border-white/10">
              <label className="text-xs font-bold block opacity-80">📝 Observação do Item:</label>
              <input
                type="text"
                placeholder="Ex: Sem cebola, retirar azeitona..."
                value={itemObservation}
                onChange={(e) => setItemObservation(e.target.value)}
                style={{ backgroundColor: bgColor, color: textColor }}
                className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <div className="flex items-center space-x-2 bg-black/30 p-1 rounded-xl border border-white/10">
                <button onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))} className="w-8 h-8 rounded-lg bg-gray-800 text-white font-bold text-sm">-</button>
                <span className="font-bold px-2">{productQuantity}</span>
                <button onClick={() => setProductQuantity(productQuantity + 1)} style={{ backgroundColor: primaryColor, color: btnTextColor }} className="w-8 h-8 rounded-lg font-bold text-sm">+</button>
              </div>

              <button
                onClick={handleAddProductToCart}
                style={{ backgroundColor: primaryColor, color: btnTextColor }}
                className="flex-1 font-extrabold py-3 rounded-xl text-xs shadow-lg transition hover:opacity-90">
                Adicionar • R$ {(currentModalUnitPrice * productQuantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CARRINHO & CHECKOUT */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-white/10 w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: primaryColor }}>
                {tableNumber ? `🪑 Pedido - Mesa ${tableNumber}` : '🛒 Seu Carrinho'}
              </h3>
              <button onClick={() => setShowCartModal(false)} className="opacity-60 hover:opacity-100 font-bold text-xs bg-black/30 px-3 py-1.5 rounded-xl">✕ Fechar</button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map(item => (
                <div key={item.cartItemId} style={{ backgroundColor: bgColor }} className="p-3 rounded-xl border border-white/10 flex justify-between items-start text-xs space-x-2">
                  <div className="flex-1">
                    <span className="font-extrabold block flex items-center space-x-1">
                      <span>{item.quantity}x {item.name}</span>
                      {item.is_combo && <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded font-bold">COMBO</span>}
                    </span>

                    {item.is_combo && item.comboSteps?.length > 0 ? (
                      <div className="space-y-0.5 mt-1 border-l-2 border-purple-500/40 pl-2">
                        {item.comboSteps.map((step, sIdx) => (
                          <p key={sIdx} className="text-[10px] opacity-80">
                            <b>{step.title}:</b> {step.items.map(i => i.name).join(', ')}
                          </p>
                        ))}
                      </div>
                    ) : (
                      item.selectedAddons && item.selectedAddons.length > 0 && (
                        <p className="text-[10px] opacity-60">Sabores/Adicionais: {item.selectedAddons.map(a => a.name).join(', ')}</p>
                      )
                    )}

                    {item.selectedBorder && item.selectedBorder.name !== 'Sem Borda' && (
                      <p className="text-[10px] opacity-60">Borda: {item.selectedBorder.name}</p>
                    )}
                    {item.observation && (
                      <p className="text-[10px] text-orange-400 italic">Obs: "{item.observation}"</p>
                    )}
                    <span style={{ color: primaryColor }} className="font-extrabold block mt-1">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>

                  <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-400 font-bold text-xs p-1">🗑</button>
                </div>
              ))}
            </div>

            <form onSubmit={handleFinishOrder} className="space-y-3 pt-2 border-t border-white/10">
              {!tableNumber ? (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('ENTREGA')}
                    style={{ 
                      backgroundColor: deliveryType === 'ENTREGA' ? primaryColor : bgColor,
                      color: deliveryType === 'ENTREGA' ? btnTextColor : textColor
                    }}
                    className="w-1/2 py-2 rounded-xl text-xs font-bold border border-white/10 transition">
                    🛵 Entrega
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryType('BALCAO');
                      setSelectedNeighFee(0);
                    }}
                    style={{ 
                      backgroundColor: deliveryType === 'BALCAO' ? primaryColor : bgColor,
                      color: deliveryType === 'BALCAO' ? btnTextColor : textColor
                    }}
                    className="w-1/2 py-2 rounded-xl text-xs font-bold border border-white/10 transition">
                    🏪 Balcão
                  </button>
                </div>
              ) : (
                <div className="bg-orange-500/10 border border-orange-500/30 p-2.5 rounded-xl text-center">
                  <span className="text-xs font-bold text-orange-400">📍 Pedido vinculado à MESA {tableNumber}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] opacity-70 block mb-1">Seu Nome / Identificação:</label>
                <input type="text" required placeholder="Ex: João Silva" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              </div>

              {!tableNumber && (
                <div>
                  <label className="text-[11px] opacity-70 block mb-1">Seu WhatsApp:</label>
                  <input type="text" placeholder="(DDD) 99999-9999" value={customerPhone} onChange={(e) => setCustomerPhone(maskPhone(e.target.value))} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
                </div>
              )}

              {deliveryType === 'ENTREGA' && !tableNumber && (
                <>
                  <div>
                    <label className="text-[11px] opacity-70 block mb-1">Seu Bairro (Taxa Entrega):</label>
                    <select
                      onChange={(e) => {
                        const selected = neighborhoods.find(n => String(n.id) === String(e.target.value));
                        if (selected) {
                          setSelectedNeighFee(selected.fee);
                          setSelectedNeighName(selected.name);
                        } else {
                          setSelectedNeighFee(0);
                          setSelectedNeighName('');
                        }
                      }}
                      style={{ backgroundColor: bgColor, color: textColor }}
                      className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none font-bold">
                      <option value="">Selecione seu bairro...</option>
                      {neighborhoods.map(n => (
                        <option key={n.id} value={n.id}>{n.name} (+R$ {Number(n.fee).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] opacity-70 block mb-1">Endereço Completo e Número:</label>
                    <input type="text" required value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] opacity-70 block mb-1">Forma de Pagamento:</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none font-bold">
                  {tableNumber && <option value="Pagar no Balcão">Pagar no Balcão ao Sair</option>}
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito/Débito">Cartão de Crédito/Débito</option>
                  <option value="PIX">PIX</option>
                </select>
              </div>

              {paymentMethod.includes('Cartão') && (
                <div style={{ backgroundColor: bgColor }} className="p-2.5 rounded-xl border border-white/10 space-y-2">
                  <label className="text-[11px] font-bold block text-orange-400">💳 Como prefere pagar no Cartão?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCardPaymentType('maquininha')}
                      style={{
                        backgroundColor: cardPaymentType === 'maquininha' ? primaryColor : 'transparent',
                        color: cardPaymentType === 'maquininha' ? btnTextColor : textColor
                      }}
                      className="py-2 px-2 rounded-xl text-[10px] font-bold border border-white/10 transition text-center">
                      🛵 Na Maquininha
                    </button>

                    <button
                      type="button"
                      onClick={() => setCardPaymentType('online')}
                      style={{
                        backgroundColor: cardPaymentType === 'online' ? primaryColor : 'transparent',
                        color: cardPaymentType === 'online' ? btnTextColor : textColor
                      }}
                      className="py-2 px-2 rounded-xl text-[10px] font-bold border border-white/10 transition text-center">
                      🌐 Pagar Agora Online
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'Dinheiro' && (
                <input type="text" placeholder="Troco para quanto? (Opcional)" value={changeValue} onChange={(e) => setChangeValue(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              )}

              <div style={{ backgroundColor: bgColor }} className="p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                <div className="flex justify-between"><span className="opacity-60">Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {deliveryType === 'ENTREGA' && !tableNumber && (
                  <div className="flex justify-between"><span className="opacity-60">Taxa de Entrega:</span><span>R$ {currentDeliveryFee.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-white/10"><span style={{ color: primaryColor }}>TOTAL:</span><span style={{ color: primaryColor }}>R$ {total.toFixed(2)}</span></div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: primaryColor, color: btnTextColor }}
                className="w-full font-extrabold py-3.5 rounded-xl text-xs shadow-lg transition hover:opacity-90">
                {isSubmitting ? 'Enviando Pedido...' : (tableNumber ? 'Confirmar Pedido na Mesa 🚀' : 'Enviar Pedido 🚀')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PIX DINÂMICO AUTOMÁTICO */}
      {showPixModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-green-500/40 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl relative">
            <div className="space-y-1">
              <span className="text-2xl block">⚡</span>
              <h3 className="font-extrabold text-base text-green-400">Pagamento PIX Dinâmico</h3>
              <p className="text-[11px] opacity-70">Pague no app do seu banco. A baixa é automática!</p>
            </div>

            {pixStatus === 'approved' ? (
              <div className="bg-green-500/20 border border-green-500/50 p-3 rounded-2xl space-y-1 animate-bounce">
                <span className="text-xl">✅</span>
                <p className="font-extrabold text-xs text-green-400">PAGAMENTO CONFIRMADO!</p>
                <p className="text-[10px] text-gray-300">Seu pedido já deu entrada na cozinha.</p>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-2 rounded-2xl flex items-center justify-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping"></span>
                <span className="text-xs font-bold text-yellow-400">Aguardando confirmação do banco...</span>
              </div>
            )}

            {pixQrCodeBase64 && (
              <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto border border-gray-200">
                <img 
                  src={`data:image/jpeg;base64,${pixQrCodeBase64}`} 
                  alt="QR Code PIX" 
                  className="w-44 h-44 object-contain mx-auto" 
                />
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={copyPixCode}
                className={`w-full font-bold py-3 rounded-xl text-xs border transition flex items-center justify-center space-x-2 ${
                  pixCopySuccess ? 'bg-green-600 text-white border-green-500' : 'bg-gray-800 text-white border-gray-700 hover:bg-gray-700'
                }`}>
                <span>{pixCopySuccess ? '✓ Chave Copiada!' : '📋 Copiar Chave PIX'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => {
                  sendWhatsAppNotification(currentOrderId, pixStatus === 'approved');
                  setShowPixModal(false);
                  setCart([]);
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-2">
                <span>💬 Avisar Restaurante no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
