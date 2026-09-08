import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function DeliveryCliente() {
  const router = useRouter();
  const { slug, mesa, m } = router.query;

  const [tenant, setTenant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // DETECÇÃO DE MESA VIA URL (?mesa=05 ou ?m=05)
  const [tableNumber, setTableNumber] = useState('');

  // MODAL DE DETALHES DO PRODUTO (ADICIONAIS E OBSERVAÇÃO)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [itemObservation, setItemObservation] = useState('');

  // CARRINHO DE COMPRAS E CHECKOUT
  const [cart, setCart] = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [deliveryType, setDeliveryType] = useState('ENTREGA'); // 'ENTREGA', 'BALCAO' ou 'MESA'
  const [selectedNeighFee, setSelectedNeighFee] = useState(0);
  const [selectedNeighName, setSelectedNeighName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pagar no Balcão');
  const [changeValue, setChangeValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [router.isReady, slug, mesa, m]);

  const fetchTenantData = async () => {
    setLoading(true);
    const cleanSlug = String(slug).toLowerCase().trim();
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', cleanSlug).maybeSingle();

    if (tData) {
      setTenant(tData);
      
      // CARREGA PIXEL DO META
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
      const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tData.id).order('name', { ascending: true });

      if (cData) setCategories(cData);
      if (pData) setProducts(pData);
      if (nData) setNeighborhoods(nData);
    }
    setLoading(false);
  };

  const handleOpenProductModal = (product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setSelectedAddons([]);
    setItemObservation('');
  };

  const toggleAddon = (addon) => {
    const exists = selectedAddons.some(a => a.name === addon.name);
    if (exists) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleAddProductToCart = () => {
    if (!selectedProduct) return;

    const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
    const unitPrice = Number(selectedProduct.price) + addonsTotal;

    const cartItem = {
      cartItemId: `${selectedProduct.id}-${Date.now()}`,
      id: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: Number(selectedProduct.price),
      unitPrice: unitPrice,
      quantity: productQuantity,
      selectedAddons: selectedAddons,
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

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-xs text-gray-400">Carregando cardápio...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  // VARIÁVEIS DE CORES DINÂMICAS
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

  const handleFinishOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Seu carrinho está vazio!");
    if (!customerName) return alert("Preencha seu Nome!");
    if (deliveryType === 'ENTREGA' && !customerAddress) return alert("Preencha seu Endereço para entrega!");

    setIsSubmitting(true);

    let fullAddress = 'Retirada no Balcão';
    if (deliveryType === 'ENTREGA') {
      fullAddress = `${customerAddress} (${selectedNeighName || 'Sem bairro'})`;
    } else if (deliveryType === 'MESA' || tableNumber) {
      fullAddress = `MESA ${tableNumber || 'Consumo Local'}`;
    }

    const orderData = {
      tenant_id: tenant.id,
      customer_name: customerName,
      customer_phone: customerPhone ? customerPhone.replace(/\D/g, '') : '00000000000',
      customer_address: fullAddress,
      items: cart,
      subtotal: subtotal,
      delivery_fee: currentDeliveryFee,
      total: total,
      payment_method: paymentMethod,
      change_for: changeValue,
      status: 'pendente'
    };

    const { data: createdOrder, error } = await supabase.from('orders').insert([orderData]).select().single();

    if (error) {
      setIsSubmitting(false);
      return alert("Erro ao enviar pedido: " + error.message);
    }

    if (window.fbq) {
      window.fbq('track', 'Purchase', { value: total, currency: 'BRL' });
    }

    // FORMATAR TEXTO DO WHATSAPP
    let itemsText = cart.map(i => {
      let txt = `• ${i.quantity}x ${i.name} (R$ ${(i.unitPrice * i.quantity).toFixed(2)})`;
      if (i.selectedAddons && i.selectedAddons.length > 0) {
        txt += `\n   + Adicionais: ${i.selectedAddons.map(a => `${a.name} (+R$ ${Number(a.price).toFixed(2)})`).join(', ')}`;
      }
      if (i.observation) {
        txt += `\n   Obs: _"${i.observation}"_`;
      }
      return txt;
    }).join('\n\n');

    let msg = `*NOVO PEDIDO #${createdOrder.id} - ${tenant.name.toUpperCase()}*\n\n`;
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
    if (deliveryType === 'ENTREGA') {
      msg += `*Taxa Entrega:* R$ ${currentDeliveryFee.toFixed(2)}\n`;
    }
    msg += `*TOTAL:* *R$ ${total.toFixed(2)}*\n`;
    msg += `*Pagamento:* ${paymentMethod} ${changeValue ? `(Troco para R$ ${changeValue})` : ''}`;

    if (tenant.custom_message) {
      msg += `\n\n📌 _${tenant.custom_message}_`;
    }

    const cleanWhatsapp = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, '') : '';
    if (cleanWhatsapp) {
      window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    setIsSubmitting(false);
    setCart([]);
    setShowCartModal(false);
    alert(`Pedido #${createdOrder.id} enviado com sucesso para a cozinha!`);
  };

  const getProductAddonsArray = (addonsStr) => {
    if (!addonsStr) return [];
    return addonsStr.split(',').filter(Boolean).map(item => {
      const parts = item.split(':');
      return {
        name: parts[0] ? parts[0].trim() : item,
        price: parts[1] ? parseFloat(parts[1]) : 0
      };
    });
  };

  return (
    <div className="min-h-screen font-sans pb-24 max-w-md mx-auto transition-colors duration-300" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* CAPA & RESTAURANTE */}
      <div className="relative h-36 bg-gray-900 border-b border-white/10">
        <img src={tenant.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'} alt="Banner" className="w-full h-full object-cover opacity-50" />
        
        {tenant.instagram_url && (
          <a
            href={tenant.instagram_url.startsWith('http') ? tenant.instagram_url : `https://${tenant.instagram_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-full shadow-lg transition flex items-center space-x-1 hover:opacity-90 z-10">
            <span>📸 Instagram</span>
          </a>
        )}

        <div className="absolute -bottom-5 left-4 flex items-center space-x-3">
          <img src={tenant.logo_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} alt="Logo" className="w-16 h-16 rounded-full border-2 border-black/40 object-cover bg-gray-800 shadow-lg" />
          <div className="pt-4">
            <h1 className="font-bold text-lg leading-tight" style={{ color: textColor }}>{tenant.name}</h1>
            <p className="text-[11px] opacity-70">
              {tableNumber ? `🪑 Autoatendimento • Mesa ${tableNumber}` : '🛵 Cardápio Digital & Delivery'}
            </p>
          </div>
        </div>
      </div>

      {/* SELO DE MESA ATIVA SE ACESSADO VIA QR CODE */}
      {tableNumber && (
        <div className="mt-7 px-4">
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-3 rounded-2xl shadow-lg flex justify-between items-center text-xs font-bold">
            <div className="flex items-center space-x-2">
              <span className="text-base">📍</span>
              <div>
                <p className="font-extrabold uppercase text-[11px] leading-tight">Você está na MESA {tableNumber}</p>
                <p className="text-[10px] opacity-90 font-normal">Seus pedidos serão entregues direto na sua mesa.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNERS PROMOCIONAIS */}
      {promoBannerList.length > 0 && (
        <div className={`${tableNumber ? 'mt-4' : 'mt-8'} px-4`}>
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
            {promoBannerList.map((bannerUrl, idx) => (
              <img key={idx} src={bannerUrl} alt={`Promoção ${idx + 1}`} className="w-72 h-32 rounded-2xl object-cover border border-white/10 shrink-0 shadow-md" />
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIAS */}
      <div className={`${(promoBannerList.length > 0 || tableNumber) ? 'mt-4' : 'mt-8'} px-4`}>
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCat('ALL')}
            style={{ 
              backgroundColor: selectedCat === 'ALL' ? primaryColor : cardColor,
              color: selectedCat === 'ALL' ? btnTextColor : textColor
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border border-white/10 transition">
            Todos
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
                className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border border-white/10 transition">
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA DE PRODUTOS */}
      <div className="mt-4 px-4 space-y-3">
        {filteredProducts.map(p => (
          <div 
            key={p.id} 
            onClick={() => handleOpenProductModal(p)}
            style={{ backgroundColor: cardColor }} 
            className="p-3 rounded-2xl border border-white/10 flex justify-between items-center cursor-pointer hover:border-white/20 transition">
            <div className="flex items-center space-x-3">
              <img src={p.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} alt={p.name} className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-gray-800 shrink-0" />
              <div>
                <h3 className="font-bold text-xs" style={{ color: textColor }}>{p.name}</h3>
                <p className="text-[10px] opacity-60 line-clamp-2">{p.description}</p>
                <span className="font-bold text-xs block mt-1" style={{ color: primaryColor }}>R$ {Number(p.price).toFixed(2)}</span>
              </div>
            </div>

            <button style={{ backgroundColor: primaryColor, color: btnTextColor }} className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ml-2 shadow transition">
              + Adicionar
            </button>
          </div>
        ))}
      </div>

      {/* BARRA DO CARRINHO FLUTUANTE */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={() => setShowCartModal(true)}
            style={{ backgroundColor: primaryColor, color: btnTextColor }}
            className="w-full font-bold p-3.5 rounded-2xl flex justify-between items-center shadow-2xl transition hover:opacity-95">
            <span className="text-xs bg-black/20 px-2.5 py-1 rounded-lg">🛒 {cart.reduce((a, b) => a + b.quantity, 0)} itens</span>
            <span className="text-xs font-bold uppercase tracking-wider">{tableNumber ? `Enviar p/ Mesa ${tableNumber}` : 'Ver Carrinho'}</span>
            <span className="text-xs font-bold">R$ {subtotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MODAL DE ADICIONAIS DO PRODUTO */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-white/10 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-bold text-sm truncate" style={{ color: primaryColor }}>{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="opacity-60 font-bold text-xs">✕ Fechar</button>
            </div>

            <img src={selectedProduct.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80'} alt={selectedProduct.name} className="w-full h-36 rounded-xl object-cover border border-white/10" />
            <p className="text-xs opacity-70">{selectedProduct.description}</p>

            {getProductAddonsArray(selectedProduct.addons_list).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-bold block opacity-80">➕ Adicionais Opcionais:</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {getProductAddonsArray(selectedProduct.addons_list).map((addon, idx) => {
                    const isChecked = selectedAddons.some(a => a.name === addon.name);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleAddon(addon)}
                        style={{ backgroundColor: isChecked ? `${primaryColor}22` : bgColor, borderColor: isChecked ? primaryColor : 'rgba(255,255,255,0.1)' }}
                        className="p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-orange-500" />
                          <span>{addon.name}</span>
                        </div>
                        <span style={{ color: primaryColor }} className="font-bold">+ R$ {addon.price.toFixed(2)}</span>
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
                placeholder="Ex: Sem salada, bem passado..."
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
                className="flex-1 font-bold py-3 rounded-xl text-xs shadow-lg transition">
                Adicionar • R$ {((Number(selectedProduct.price) + selectedAddons.reduce((a, b) => a + b.price, 0)) * productQuantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO CARRINHO & CHECKOUT */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-white/10 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-bold text-sm" style={{ color: primaryColor }}>
                {tableNumber ? `🪑 Pedido - Mesa ${tableNumber}` : '🛒 Seu Carrinho'}
              </h3>
              <button onClick={() => setShowCartModal(false)} className="opacity-60 font-bold text-xs">✕ Fechar</button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map(item => (
                <div key={item.cartItemId} style={{ backgroundColor: bgColor }} className="p-2.5 rounded-xl border border-white/10 flex justify-between items-start text-xs space-x-2">
                  <div className="flex-1">
                    <span className="font-bold block">{item.quantity}x {item.name}</span>
                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <p className="text-[10px] opacity-60">+ {item.selectedAddons.map(a => a.name).join(', ')}</p>
                    )}
                    {item.observation && (
                      <p className="text-[10px] text-orange-400 italic">Obs: "{item.observation}"</p>
                    )}
                    <span style={{ color: primaryColor }} className="font-bold block mt-0.5">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>

                  <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-400 font-bold text-xs p-1">🗑</button>
                </div>
              ))}
            </div>

            <form onSubmit={handleFinishOrder} className="space-y-3 pt-2 border-t border-white/10">
              {/* TIPO DE ATENDIMENTO */}
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
                  <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
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
                      className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none">
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
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none">
                  {tableNumber && <option value="Pagar no Balcão">Pagar no Balcão ao Sair</option>}
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito/Débito">Cartão de Crédito/Débito</option>
                  <option value="PIX">PIX</option>
                </select>
              </div>

              {paymentMethod === 'Dinheiro' && (
                <input type="text" placeholder="Troco para quanto? (Opcional)" value={changeValue} onChange={(e) => setChangeValue(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              )}

              <div style={{ backgroundColor: bgColor }} className="p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                <div className="flex justify-between"><span className="opacity-60">Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {deliveryType === 'ENTREGA' && !tableNumber && (
                  <div className="flex justify-between"><span className="opacity-60">Taxa de Entrega:</span><span>R$ {currentDeliveryFee.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-white/10"><span style={{ color: primaryColor }}>TOTAL:</span><span style={{ color: primaryColor }}>R$ {total.toFixed(2)}</span></div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: primaryColor, color: btnTextColor }}
                className="w-full font-bold py-3.5 rounded-xl text-xs shadow-lg transition hover:opacity-90">
                {isSubmitting ? 'Enviando Pedido...' : (tableNumber ? 'Confirmar Pedido na Mesa 🚀' : 'Enviar Pedido no WhatsApp 🚀')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
