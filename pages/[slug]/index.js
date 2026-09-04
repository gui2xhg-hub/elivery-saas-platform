import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabase';

export default function CardapioTenant() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  // FILTROS DE CATEGORIA E BUSCA
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // MODAL E CHECKOUT
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [itemObs, setItemObs] = useState('');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState('delivery');
  const [selectedNeigh, setSelectedNeigh] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');

  useEffect(() => {
    if (slug) fetchTenantData();
  }, [slug]);

  const fetchTenantData = async () => {
    setLoading(true);
    const { data: tData, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (tErr || !tData) {
      setTenant(null);
      setLoading(false);
      return;
    }

    setTenant(tData);

    if (tData.active !== false) {
      const { data: cData } = await supabase.from('categories').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });
      const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('active', true).order('id', { ascending: true });
      const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });

      if (cData) setCategories(cData);
      if (pData) setProducts(pData);
      if (nData) {
        setNeighborhoods(nData);
        if (nData.length > 0) setSelectedNeigh(nData[0].name);
      }
    }

    setLoading(false);
  };

  // VALIDAÇÃO DE HORÁRIO DE FUNCIONAMENTO
  const checkIfStoreIsOpen = () => {
    if (!tenant?.opening_time || !tenant?.closing_time) return true;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = tenant.opening_time.split(':').map(Number);
    const [closeH, closeM] = tenant.closing_time.split(':').map(Number);

    const openMin = openH * 60 + openM;
    let closeMin = closeH * 60 + closeM;

    if (closeMin < openMin) closeMin += 24 * 60; // Caso o horário passe da meia-noite

    return currentMin >= openMin && currentMin <= closeMin;
  };

  const isOpen = checkIfStoreIsOpen();

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-sm text-gray-400">Carregando cardápio...</p></div>;

  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  if (tenant.active === false) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-gray-900 border border-red-500/30 p-8 rounded-3xl max-w-sm space-y-3">
          <span className="text-4xl block">🛑</span>
          <h1 className="font-bold text-lg text-red-400">Estabelecimento Indisponível</h1>
          <p className="text-xs text-gray-400">O cardápio de <b>{tenant.name}</b> está suspenso temporariamente.</p>
        </div>
      </div>
    );
  }

  const primaryColor = tenant.primary_color || '#FF8C00';
  const secondaryColor = tenant.secondary_color || '#111827';

  // LISTA DE BANNERS DE PROMOÇÃO
  const promoBannersList = tenant.promo_banners ? tenant.promo_banners.split(',').map(s => s.trim()).filter(Boolean) : [];

  const subtotal = cart.reduce((acc, item) => acc + (item.totalPrice * item.quantity), 0);
  const currentNeighObj = neighborhoods.find(n => n.name === selectedNeigh);
  const deliveryFee = orderType === 'delivery' ? Number(currentNeighObj?.fee || 0) : 0;
  const total = subtotal + deliveryFee;

  const handleOpenModal = (prod) => {
    if (!isOpen) return;
    setSelectedProduct(prod);
    setQuantity(1);
    setSelectedAddons([]);
    setItemObs('');
  };

  const handleToggleAddon = (addon) => {
    const exists = selectedAddons.find(a => a.name === addon.name);
    if (exists) setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    else setSelectedAddons([...selectedAddons, addon]);
  };

  const calculateUnitTotal = () => {
    if (!selectedProduct) return 0;
    const addonsTotal = selectedAddons.reduce((acc, a) => acc + Number(a.price), 0);
    return Number(selectedProduct.price) + addonsTotal;
  };

  const handleAddToCart = () => {
    const unitPrice = calculateUnitTotal();
    const addonsText = selectedAddons.map(a => `${a.name} (+R$${a.price.toFixed(2)})`).join(', ');
    let details = addonsText ? `Adicionais: ${addonsText}` : '';
    if (itemObs) details += details ? ` | Obs: ${itemObs}` : `Obs: ${itemObs}`;

    const newItem = {
      id: `${selectedProduct.id}-${Date.now()}`,
      name: selectedProduct.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice,
      details
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
  };

  const handleSendOrder = async (e) => {
    e.preventDefault();
    if (!isOpen) return alert("O estabelecimento está fechado no momento.");
    if (!customerName || !customerPhone) return alert("Preencha seu Nome e WhatsApp!");
    if (orderType === 'delivery' && (!address || !selectedNeigh)) return alert("Preencha o Endereço!");

    const orderData = {
      tenant_id: tenant.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      order_type: orderType,
      neighborhood: orderType === 'delivery' ? selectedNeigh : '',
      address: orderType === 'delivery' ? address : '',
      reference: orderType === 'delivery' ? reference : '',
      payment_method: paymentMethod,
      items: cart,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: 'recebido',
      is_paid: false
    };

    const { data: createdOrder, error } = await supabase.from('orders').insert([orderData]).select().single();
    if (error) return alert("Erro ao enviar pedido: " + error.message);

    let text = `*NOVO PEDIDO #${createdOrder.id} - ${tenant.name.toUpperCase()}*\n\n`;
    text += `*Cliente:* ${customerName}\n*Telefone:* ${customerPhone}\n*Tipo:* ${orderType === 'delivery' ? 'Entrega 🛵' : 'Retirada 🛍️'}\n`;
    if (orderType === 'delivery') text += `*Bairro:* ${selectedNeigh}\n*Endereço:* ${address}\n`;
    text += `*Pagamento:* ${paymentMethod}\n\n*ITENS:*\n`;
    cart.forEach(it => {
      text += `• ${it.quantity}x ${it.name} (R$ ${Number(it.totalPrice * it.quantity).toFixed(2)})\n`;
      if (it.details) text += `   _${it.details}_\n`;
    });
    text += `\n*TOTAL:* *R$ ${total.toFixed(2)}*`;

    if (tenant.custom_message) {
      text += `\n\n📌 _${tenant.custom_message}_`;
    }

    const cleanWhatsapp = tenant.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(text)}`, '_blank');
    setCart([]);
    setIsCheckoutOpen(false);
  };

  const parsedAddons = selectedProduct?.addons_list ? selectedProduct.addons_list.split(',').filter(Boolean).map(str => {
    const parts = str.split(':');
    return { name: parts[0], price: parseFloat(parts[1] || 0) };
  }) : [];

  return (
    <div className="min-h-screen text-white font-sans pb-24 max-w-md mx-auto" style={{ backgroundColor: secondaryColor }}>
      {/* INTEGRAÇÃO DO META PIXEL */}
      {tenant.pixel_id && (
        <Head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${tenant.pixel_id}');
                fbq('track', 'PageView');
              `,
            }}
          />
        </Head>
      )}

      {/* BANNER E LOGO */}
      <div className="relative h-40 bg-gray-900 border-b border-gray-800">
        <img src={tenant.banner_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80'} alt="Banner" className="w-full h-full object-cover opacity-60" />
        <div className="absolute -bottom-6 left-4 flex items-center space-x-3">
          <img src={tenant.logo_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=150&auto=format&fit=crop&q=80'} alt="Logo" className="w-16 h-16 rounded-full border-2 border-gray-950 object-cover bg-gray-800 shadow-lg" />
          <div className="pt-6">
            <h1 className="font-bold text-lg text-white leading-tight">{tenant.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isOpen ? '🟢 Aberto Agora' : `🔴 Fechado (Abre às ${tenant.opening_time || '18:00'})`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 px-4 space-y-4">
        {/* CARROSSEL DE PROMOÇÕES */}
        {promoBannersList.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-gray-300 block">🔥 Destaques e Promoções</span>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
              {promoBannersList.map((url, idx) => (
                <img key={idx} src={url} alt={`Promo ${idx}`} className="w-64 h-28 object-cover rounded-xl flex-shrink-0 border border-white/10 shadow-md" />
              ))}
            </div>
          </div>
        )}

        {/* CAMPO DE BUSCA */}
        <div>
          <input 
            type="text" 
            placeholder="🔍 Buscar no cardápio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-xs text-white focus:outline-none placeholder-gray-400"
          />
        </div>

        {/* BARRA FIXA DESLIZANTE DE CATEGORIAS */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
          <button 
            onClick={() => setSelectedCategory('ALL')}
            style={{ backgroundColor: selectedCategory === 'ALL' ? primaryColor : 'rgba(255,255,255,0.05)' }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-white">
            Todos
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setSelectedCategory(cat.id)}
              style={{ backgroundColor: selectedCategory === cat.id ? primaryColor : 'rgba(255,255,255,0.05)' }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-white">
              {cat.name}
            </button>
          ))}
        </div>

        {/* LISTA DE PRODUTOS */}
        {categories.map(cat => {
          if (selectedCategory !== 'ALL' && selectedCategory !== cat.id) return null;

          const catProducts = products.filter(p => {
            const matchesCat = p.category_id === cat.id;
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCat && matchesSearch;
          });

          if (catProducts.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-3 pt-2">
              <h2 className="font-bold text-sm uppercase tracking-wider border-b border-gray-800/40 pb-1" style={{ color: primaryColor }}>
                {cat.name}
              </h2>
              <div className="space-y-2.5">
                {catProducts.map(prod => (
                  <div key={prod.id} onClick={() => handleOpenModal(prod)} className={`bg-black/30 p-3 rounded-xl border border-white/10 flex justify-between items-center transition ${isOpen ? 'cursor-pointer hover:border-white/20' : 'opacity-60 cursor-not-allowed'}`}>
                    <div className="flex-1 pr-3">
                      <h3 className="font-bold text-xs text-white">{prod.name}</h3>
                      {prod.description && <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{prod.description}</p>}
                      <div className="flex items-center space-x-2 mt-1.5">
                        <span className="text-xs font-bold" style={{ color: primaryColor }}>R$ {Number(prod.price).toFixed(2)}</span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-bold text-gray-200">
                          {isOpen ? '+ Pedir' : 'Fechado'}
                        </span>
                      </div>
                    </div>
                    {prod.image && <img src={prod.image} alt={prod.name} className="w-16 h-16 rounded-lg object-cover bg-gray-800" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* BARRA CARRINHO */}
      {cart.length > 0 && isOpen && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-black/80 backdrop-blur border-t border-white/10 z-40">
          <button onClick={() => setIsCheckoutOpen(true)} style={{ backgroundColor: primaryColor }} className="w-full font-bold py-3 px-4 rounded-xl text-xs flex justify-between items-center text-white shadow-lg">
            <span>🛒 Ver Pedido ({cart.length})</span>
            <span>R$ {subtotal.toFixed(2)} ➔</span>
          </button>
        </div>
      )}

      {/* MODAL ADICIONAR ITEM */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-gray-900 w-full max-w-md rounded-t-2xl p-4 border-t border-gray-800 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-start border-b border-gray-800 pb-2">
              <div>
                <h3 className="font-bold text-sm text-white">{selectedProduct.name}</h3>
                <span className="text-xs font-bold" style={{ color: primaryColor }}>R$ {Number(selectedProduct.price).toFixed(2)}</span>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 font-bold text-sm">✕</button>
            </div>

            {parsedAddons.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">Adicionais Opcionais:</label>
                <div className="space-y-1.5">
                  {parsedAddons.map((ad, idx) => {
                    const isChecked = selectedAddons.some(a => a.name === ad.name);
                    return (
                      <label key={idx} className="flex justify-between items-center bg-gray-800 p-2.5 rounded-lg text-xs cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" checked={isChecked} onChange={() => handleToggleAddon(ad)} className="rounded bg-gray-700" />
                          <span>{ad.name}</span>
                        </div>
                        <span className="font-bold" style={{ color: primaryColor }}>+ R$ {ad.price.toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Observações:</label>
              <input type="text" placeholder="Ex: Sem cebola..." value={itemObs} onChange={(e) => setItemObs(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div className="flex items-center space-x-3 bg-gray-800 rounded-lg p-1">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 bg-gray-700 font-bold rounded text-xs">-</button>
                <span className="font-bold text-xs">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 bg-gray-700 font-bold rounded text-xs">+</button>
              </div>

              <button onClick={handleAddToCart} style={{ backgroundColor: primaryColor }} className="flex-1 ml-3 font-bold py-2.5 rounded-lg text-xs text-white">
                Adicionar ({quantity}x = R$ {(calculateUnitTotal() * quantity).toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-gray-900 w-full max-w-md rounded-t-2xl p-5 border-t border-gray-800 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm" style={{ color: primaryColor }}>🛍️ Finalizar Pedido</h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleSendOrder} className="space-y-3">
              <input type="text" required placeholder="Seu Nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
              <input type="text" required placeholder="Seu WhatsApp" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />

              <div className="flex space-x-2">
                <button type="button" onClick={() => setOrderType('delivery')} style={{ backgroundColor: orderType === 'delivery' ? primaryColor : '' }} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${orderType === 'delivery' ? 'text-white' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>🛵 Delivery</button>
                <button type="button" onClick={() => setOrderType('pickup')} style={{ backgroundColor: orderType === 'pickup' ? primaryColor : '' }} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${orderType === 'pickup' ? 'text-white' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>🛍️ Retirada</button>
              </div>

              {orderType === 'delivery' && (
                <>
                  <select value={selectedNeigh} onChange={(e) => setSelectedNeigh(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none">
                    {neighborhoods.map(n => <option key={n.id} value={n.name}>{n.name} (+R$ {Number(n.fee).toFixed(2)})</option>)}
                  </select>
                  <input type="text" required placeholder="Endereço e Número" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
                  <input type="text" placeholder="Ponto de Referência" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
                </>
              )}

              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-lg text-xs text-white focus:outline-none">
                <option value="PIX">PIX</option>
                <option value="Cartão na Entrega">Cartão na Entrega</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>

              <div className="bg-gray-800 p-3 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between text-gray-400"><span>Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-400"><span>Taxa Entrega:</span><span>R$ {deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-white text-sm border-t border-gray-700 pt-1"><span>TOTAL:</span><span className="text-green-400">R$ {total.toFixed(2)}</span></div>
              </div>

              <button type="submit" className="w-full bg-green-600 font-bold py-3 rounded-xl text-xs text-white">Enviar Pedido pelo WhatsApp 🚀</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
