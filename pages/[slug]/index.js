import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function DeliveryCliente() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // CARRINHO DE COMPRAS
  const [cart, setCart] = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedNeighFee, setSelectedNeighFee] = useState(0);
  const [selectedNeighName, setSelectedNeighName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [changeValue, setChangeValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (router.isReady && slug) {
      fetchTenantData();
    }
  }, [router.isReady, slug]);

  const fetchTenantData = async () => {
    setLoading(true);
    const cleanSlug = String(slug).toLowerCase().trim();
    const { data: tData } = await supabase.from('tenants').select('*').eq('slug', cleanSlug).maybeSingle();

    if (tData) {
      setTenant(tData);
      const { data: cData } = await supabase.from('categories').select('*').eq('tenant_id', tData.id).order('id', { ascending: true });
      const { data: pData } = await supabase.from('products').select('*').eq('tenant_id', tData.id).eq('active', true).order('id', { ascending: true });
      const { data: nData } = await supabase.from('neighborhoods').select('*').eq('tenant_id', tData.id).order('name', { ascending: true });

      if (cData) setCategories(cData);
      if (pData) setProducts(pData);
      if (nData) setNeighborhoods(nData);
    }
    setLoading(false);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    const existing = cart.find(item => item.id === productId);
    if (existing.quantity === 1) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item));
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><p className="text-xs text-gray-400">Carregando cardápio...</p></div>;
  if (!tenant) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center font-sans"><h1 className="text-xl font-bold text-orange-500">Restaurante não encontrado</h1></div>;

  // VARIÁVEIS DE CORES DINÂMICAS DO MASTER
  const primaryColor = tenant.primary_color || '#FF8C00';
  const btnTextColor = tenant.button_text_color || '#FFFFFF';
  const bgColor = tenant.background_color || tenant.secondary_color || '#090D16';
  const cardColor = tenant.card_color || '#111827';
  const textColor = tenant.text_color || '#FFFFFF';

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  const total = subtotal + Number(selectedNeighFee || 0);

  const filteredProducts = selectedCat === 'ALL' ? products : products.filter(p => String(p.category_id) === String(selectedCat));

  const handleFinishOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Seu carrinho está vazio!");
    if (!customerName || !customerPhone || !customerAddress) return alert("Preencha Nome, WhatsApp e Endereço!");

    setIsSubmitting(true);

    const orderData = {
      tenant_id: tenant.id,
      customer_name: customerName,
      customer_phone: customerPhone.replace(/\D/g, ''),
      customer_address: `${customerAddress} (${selectedNeighName || 'Sem bairro'})`,
      items: cart,
      subtotal: subtotal,
      delivery_fee: selectedNeighFee,
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

    let itemsText = cart.map(i => `• ${i.quantity}x ${i.name} (R$ ${(Number(i.price) * i.quantity).toFixed(2)})`).join('\n');
    let msg = `*NOVO PEDIDO #${createdOrder.id} - ${tenant.name.toUpperCase()}*\n\n`;
    msg += `*Cliente:* ${customerName}\n*Telefone:* ${customerPhone}\n*Endereço:* ${customerAddress}\n*Bairro:* ${selectedNeighName}\n\n`;
    msg += `*ITENS DO PEDIDO:*\n${itemsText}\n\n`;
    msg += `*Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
    msg += `*Taxa Entrega:* R$ ${Number(selectedNeighFee).toFixed(2)}\n`;
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
    alert("Pedido enviado com sucesso!");
  };

  return (
    <div className="min-h-screen font-sans pb-24 max-w-md mx-auto transition-colors duration-300" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* CAPA & RESTAURANTE */}
      <div className="relative h-36 bg-gray-900 border-b border-white/10">
        <img src={tenant.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80'} alt="Banner" className="w-full h-full object-cover opacity-50" />
        <div className="absolute -bottom-5 left-4 flex items-center space-x-3">
          <img src={tenant.logo_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} alt="Logo" className="w-16 h-16 rounded-full border-2 border-black/40 object-cover bg-gray-800 shadow-lg" />
          <div className="pt-4">
            <h1 className="font-bold text-lg leading-tight" style={{ color: textColor }}>{tenant.name}</h1>
            <p className="text-[11px] opacity-70">🛵 Cardápio Digital & Delivery</p>
          </div>
        </div>
      </div>

      {/* CATEGORIAS */}
      <div className="mt-8 px-4">
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
        {filteredProducts.map(p => {
          const cartItem = cart.find(i => i.id === p.id);
          const qty = cartItem ? cartItem.quantity : 0;

          return (
            <div key={p.id} style={{ backgroundColor: cardColor }} className="p-3 rounded-2xl border border-white/10 flex justify-between items-center transition">
              <div className="flex items-center space-x-3">
                <img src={p.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80'} alt={p.name} className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-gray-800 shrink-0" />
                <div>
                  <h3 className="font-bold text-xs" style={{ color: textColor }}>{p.name}</h3>
                  <p className="text-[10px] opacity-60 line-clamp-2">{p.description}</p>
                  <span className="font-bold text-xs block mt-1" style={{ color: primaryColor }}>R$ {Number(p.price).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {qty > 0 ? (
                  <div className="flex items-center space-x-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
                    <button onClick={() => removeFromCart(p.id)} className="w-6 h-6 rounded-lg bg-gray-800 text-white font-bold text-xs flex items-center justify-center">-</button>
                    <span className="text-xs font-bold px-1">{qty}</span>
                    <button onClick={() => addToCart(p)} className="w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center" style={{ backgroundColor: primaryColor, color: btnTextColor }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(p)} style={{ backgroundColor: primaryColor, color: btnTextColor }} className="px-3 py-1.5 rounded-xl text-xs font-bold transition">
                    + Adicionar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* BARRA DO CARRINHO FLUTUANTE */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={() => setShowCartModal(true)}
            style={{ backgroundColor: primaryColor, color: btnTextColor }}
            className="w-full font-bold p-3.5 rounded-2xl flex justify-between items-center shadow-2xl transition hover:opacity-95">
            <span className="text-xs bg-black/20 px-2.5 py-1 rounded-lg">🛒 {cart.reduce((a, b) => a + b.quantity, 0)} itens</span>
            <span className="text-xs font-bold uppercase tracking-wider">Ver Carrinho</span>
            <span className="text-xs font-bold">R$ {subtotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MODAL DO CARRINHO */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div style={{ backgroundColor: cardColor, color: textColor }} className="border border-white/10 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-bold text-sm" style={{ color: primaryColor }}>🛒 Seu Carrinho</h3>
              <button onClick={() => setShowCartModal(false)} className="opacity-60 font-bold text-xs">✕ Fechar</button>
            </div>

            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.id} style={{ backgroundColor: bgColor }} className="p-2.5 rounded-xl border border-white/10 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold block">{item.name}</span>
                    <span style={{ color: primaryColor }} className="font-bold">R$ {(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => removeFromCart(item.id)} className="w-5 h-5 bg-gray-800 text-white rounded font-bold">-</button>
                    <span className="font-bold">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} style={{ backgroundColor: primaryColor, color: btnTextColor }} className="w-5 h-5 rounded font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleFinishOrder} className="space-y-3 pt-2 border-t border-white/10">
              <div>
                <label className="text-[11px] opacity-70 block mb-1">Seu Nome:</label>
                <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              </div>

              <div>
                <label className="text-[11px] opacity-70 block mb-1">Seu WhatsApp:</label>
                <input type="text" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              </div>

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

              <div>
                <label className="text-[11px] opacity-70 block mb-1">Forma de Pagamento:</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none">
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito/Débito">Cartão de Crédito/Débito (na entrega)</option>
                  <option value="PIX">PIX</option>
                </select>
              </div>

              {paymentMethod === 'Dinheiro' && (
                <input type="text" placeholder="Troco para quanto? (Opcional)" value={changeValue} onChange={(e) => setChangeValue(e.target.value)} style={{ backgroundColor: bgColor, color: textColor }} className="w-full border border-white/10 p-2.5 rounded-xl text-xs focus:outline-none" />
              )}

              <div style={{ backgroundColor: bgColor }} className="p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                <div className="flex justify-between"><span className="opacity-60">Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="opacity-60">Taxa de Entrega:</span><span>R$ {Number(selectedNeighFee).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-white/10"><span style={{ color: primaryColor }}>TOTAL:</span><span style={{ color: primaryColor }}>R$ {total.toFixed(2)}</span></div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: primaryColor, color: btnTextColor }}
                className="w-full font-bold py-3.5 rounded-xl text-xs shadow-lg transition hover:opacity-90">
                {isSubmitting ? 'Enviando Pedido...' : 'Enviar Pedido no WhatsApp 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
