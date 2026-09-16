import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function GarcomPDV() {
  const router = useRouter();
  const { slug } = router.query;

  const [tenant, setTenant] = useState(null);
  const [waiters, setWaiters] = useState([]);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [isLogged, setIsLogged] = useState(false);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedTable, setSelectedTable] = useState('');
  const [cart, setCart] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  
  // Modal de Observação do Item
  const [obsModalItem, setObsModalItem] = useState(null);
  const [itemObsText, setItemObsText] = useState('');

  useEffect(() => {
    if (slug) loadData();
  }, [slug]);

  const loadData = async () => {
    const { data: t } = await supabase.from('tenants').select('*').eq('slug', slug).single();
    if (!t) return;
    setTenant(t);

    const { data: w } = await supabase.from('waiters').select('*').eq('tenant_id', t.id).eq('active', true);
    const { data: c } = await supabase.from('categories').select('*').eq('tenant_id', t.id).order('id');
    const { data: p } = await supabase.from('products').select('*').eq('tenant_id', t.id).eq('active', true);

    if (w) setWaiters(w);
    if (c) setCategories(c);
    if (p) setProducts(p);
  };

  const handleWaiterLogin = (e) => {
    e.preventDefault();
    if (!selectedWaiter) return alert('Selecione seu nome!');
    if (selectedWaiter.pin === pinInput.trim()) {
      setIsLogged(true);
    } else {
      alert('PIN / Senha incorreta!');
    }
  };

  const handleAddToCart = (prod) => {
    setObsModalItem(prod);
    setItemObsText('');
  };

  const confirmAddToCart = () => {
    if (!obsModalItem) return;
    
    const cartItem = {
      id: obsModalItem.id,
      name: obsModalItem.name,
      price: Number(obsModalItem.price),
      quantity: 1,
      notes: itemObsText.trim()
    };

    setCart(prev => [...prev, cartItem]);
    setObsModalItem(null);
    setItemObsText('');
  };

  const updateCartQty = (index, delta) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmitOrder = async () => {
    if (!selectedTable) return alert('Informe o número da mesa!');
    if (cart.length === 0) return alert('Adicione pelo menos um item!');

    const payload = {
      tenant_id: tenant.id,
      customer_name: `Mesa ${selectedTable}`,
      customer_phone: '',
      customer_address: `Atendimento Local - Mesa ${selectedTable}`,
      delivery_fee: 0,
      subtotal: cartTotal,
      total: cartTotal,
      payment_method: 'PENDENTE_MESA',
      items: cart,
      notes: orderNotes,
      status: 'pendente',
      order_type: 'mesa',
      waiter_name: selectedWaiter.name
    };

    const { error } = await supabase.from('orders').insert([payload]);

    if (error) {
      alert('Erro ao enviar pedido: ' + error.message);
    } else {
      alert(`🚀 Pedido da Mesa ${selectedTable} enviado para a cozinha!`);
      setCart([]);
      setSelectedTable('');
      setOrderNotes('');
    }
  };

  if (!tenant) return <div className="p-6 text-center text-gray-400">Carregando...</div>;

  // TELA DE LOGIN DO GARÇOM
  if (!isLogged) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleWaiterLogin} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 w-full max-w-sm space-y-4 shadow-2xl">
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-orange-500">{tenant.name}</h1>
            <p className="text-xs text-gray-400">Portal do Garçom / Atendimento</p>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Selecione seu Nome:</label>
            <select
              onChange={(e) => setSelectedWaiter(waiters.find(w => w.id === parseInt(e.target.value)))}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-xs text-white focus:outline-none font-bold"
            >
              <option value="">Selecione...</option>
              {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">PIN / Senha Rápida:</label>
            <input
              type="password"
              maxLength={6}
              placeholder="Ex: 1234"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none font-bold"
            />
          </div>

          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-xs transition">
            Entrar no Comandante 🚀
          </button>
        </form>
      </div>
    );
  }

  // FILTRAGEM RÁPIDA DE PRODUTOS
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category_id === parseInt(selectedCategory);
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3 font-sans pb-32">
      {/* TOPO DE IDENTIFICAÇÃO DO GARÇOM */}
      <header className="flex justify-between items-center bg-gray-900 p-3 rounded-2xl border border-gray-800 mb-3">
        <div>
          <span className="text-[10px] text-gray-400 block">Garçom Ativo</span>
          <span className="text-xs font-bold text-orange-400">👤 {selectedWaiter.name}</span>
        </div>
        <button onClick={() => setIsLogged(false)} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded-lg text-red-400 font-bold">
          Trocar
        </button>
      </header>

      {/* SELEÇÃO DA MESA & BUSCA RÁPIDA */}
      <div className="space-y-2 mb-3">
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Nº da Mesa (Ex: 04)"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-1/2 bg-gray-900 border border-orange-500/50 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none text-center"
          />
          <input
            type="text"
            placeholder="🔍 Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-800 p-2.5 rounded-xl text-xs text-white focus:outline-none"
          />
        </div>

        {/* CHIPS DE CATEGORIA */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${selectedCategory === 'ALL' ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400'}`}
          >
            Todos
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id.toString())}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${selectedCategory === c.id.toString() ? 'bg-orange-500 text-white' : 'bg-gray-900 text-gray-400'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* GRADE DE PRODUTOS */}
      <div className="grid grid-cols-2 gap-2">
        {filteredProducts.map(p => (
          <button
            key={p.id}
            onClick={() => handleAddToCart(p)}
            className="bg-gray-900 p-3 rounded-2xl border border-gray-800 text-left hover:border-orange-500 transition flex flex-col justify-between active:scale-95"
          >
            <div>
              <span className="font-bold text-xs text-white block line-clamp-1">{p.name}</span>
              <span className="text-[10px] text-gray-400 block line-clamp-1">{p.description}</span>
            </div>
            <span className="text-xs font-extrabold text-orange-400 mt-2 block">R$ {Number(p.price).toFixed(2)}</span>
          </button>
        ))}
      </div>

      {/* BARRA FIXA INFERIOR DO CARRINHO */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 space-y-2 z-40">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Itens ({cart.length}) | Mesa: <b className="text-white">{selectedTable || '--'}</b></span>
          <span className="font-extrabold text-green-400 text-sm">Total: R$ {cartTotal.toFixed(2)}</span>
        </div>

        {cart.length > 0 && (
          <div className="max-h-24 overflow-y-auto space-y-1 py-1 border-t border-gray-800">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] bg-gray-950 p-1.5 rounded-lg">
                <span className="truncate flex-1">{item.quantity}x {item.name} {item.notes && <b className="text-orange-400">({item.notes})</b>}</span>
                <div className="flex items-center space-x-1.5 ml-2">
                  <button onClick={() => updateCartQty(idx, -1)} className="bg-gray-800 px-1.5 py-0.5 rounded text-red-400 font-bold">-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateCartQty(idx, 1)} className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400 font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmitOrder}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-2"
        >
          <span>🚀 Lançar Pedido para Cozinha</span>
        </button>
      </div>

      {/* MODAL DE OBSERVAÇÃO DO ITEM */}
      {obsModalItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 w-full max-w-xs rounded-2xl p-4 border border-orange-500/40 space-y-3">
            <h3 className="font-bold text-xs text-orange-400">{obsModalItem.name}</h3>
            <p className="text-[10px] text-gray-400">Alguma observação para a cozinha?</p>

            <input
              type="text"
              placeholder="Ex: Sem cebola, bem passado..."
              value={itemObsText}
              onChange={(e) => setItemObsText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-2.5 rounded-xl text-xs text-white focus:outline-none"
            />

            <div className="flex space-x-2">
              <button onClick={() => setObsModalItem(null)} className="w-1/2 bg-gray-800 py-2 rounded-xl text-xs">Cancelar</button>
              <button onClick={confirmAddToCart} className="w-1/2 bg-orange-500 py-2 rounded-xl text-xs font-bold text-white">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
