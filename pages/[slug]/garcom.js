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
  const [globalAddons, setGlobalAddons] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedTable, setSelectedTable] = useState('');
  const [cart, setCart] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');

  // ESTADOS DO MODAL COMPLETO DE SELEÇÃO/PERSONALIZAÇÃO DE PRODUTO
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [comboSelections, setComboSelections] = useState({}); // { [stepIndex]: [addonObj1, addonObj2] }
  const [selectedBorder, setSelectedBorder] = useState(null);
  const [itemObservation, setItemObservation] = useState('');

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
    const { data: a } = await supabase.from('global_addons').select('*').eq('tenant_id', t.id).order('id');

    if (w) setWaiters(w);
    if (c) setCategories(c);
    if (p) setProducts(p);
    if (a) setGlobalAddons(a);
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

  // PARSER DE SABORES / ADICIONAIS
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
        category_type: matched?.category_type || '🍕 Sabor de Pizza'
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

  const handleOpenProductModal = (product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setSelectedAddons([]);
    setComboSelections({});
    setItemObservation('');

    const borders = getBordersArray(product.borders_list);
    if (borders.length > 0) {
      setSelectedBorder(borders[0]);
    } else {
      setSelectedBorder(null);
    }
  };

  // TOGGLE DE ADICIONAIS/SABORES NORMAIS
  const toggleAddon = (addon) => {
    const exists = selectedAddons.some(a => a.name === addon.name);
    const maxAllowed = Number(selectedProduct?.max_addons || 0);

    if (exists) {
      setSelectedAddons(selectedAddons.filter(a => a.name !== addon.name));
    } else {
      if (maxAllowed > 0 && selectedAddons.length >= maxAllowed) {
        return alert(`Você pode escolher no máximo ${maxAllowed} opções para este item!`);
      }
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // TOGGLE DE ETAPAS DE COMBO
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

    // MONTAGEM DO STRING DE DETALHES PARA EXIBIÇÃO RÁPIDA
    let detailsArr = [];
    if (selectedProduct.is_combo && formattedComboSteps.length > 0) {
      formattedComboSteps.forEach(s => {
        const itemsStr = s.items.map(i => i.name).join(', ');
        if (itemsStr) detailsArr.push(`${s.title}: ${itemsStr}`);
      });
    } else if (selectedAddons.length > 0) {
      detailsArr.push(selectedAddons.map(a => a.name).join(', '));
    }
    if (selectedBorder && selectedBorder.name !== 'Sem Borda') {
      detailsArr.push(`Borda: ${selectedBorder.name}`);
    }

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
      details: detailsArr.join(' | '),
      observation: itemObservation,
      notes: itemObservation
    };

    setCart([...cart, cartItem]);
    setSelectedProduct(null);
  };

  const updateCartQty = (index, delta) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const handleSubmitOrder = async () => {
    if (!selectedTable) return alert('Informe o número da mesa!');
    if (cart.length === 0) return alert('Adicione pelo menos um item ao pedido!');

    const payload = {
      tenant_id: tenant.id,
      customer_name: `Mesa ${selectedTable}`,
      customer_phone: '',
      customer_address: `Atendimento Local - Mesa ${selectedTable}`,
      table_number: selectedTable, // Campo preenchido para sincronização perfeita
      delivery_fee: 0,
      subtotal: cartTotal,
      total: cartTotal,
      payment_method: 'PAGAR_NO_BALCAO',
      items: cart,
      notes: orderNotes,
      status: 'recebido',
      order_type: 'mesa',
      waiter_name: selectedWaiter.name
    };

    const { error } = await supabase.from('orders').insert([payload]);

    if (error) {
      alert('Erro ao enviar pedido: ' + error.message);
    } else {
      alert(`🚀 Pedido da Mesa ${selectedTable} enviado com sucesso para a cozinha!`);
      setCart([]);
      setSelectedTable('');
      setOrderNotes('');
    }
  };

  if (!tenant) return <div className="p-6 text-center text-gray-400 font-sans">Carregando...</div>;

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

          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-lg">
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

  // CÁLCULO DINÂMICO DE PREÇO DENTRO DA MODAL
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
    <div className="min-h-screen bg-gray-950 text-white p-3 font-sans pb-36 max-w-lg mx-auto">
      {/* TOPO DE IDENTIFICAÇÃO DO GARÇOM */}
      <header className="flex justify-between items-center bg-gray-900 p-3 rounded-2xl border border-gray-800 mb-3 shadow">
        <div>
          <span className="text-[10px] text-gray-400 block">Garçom Ativo</span>
          <span className="text-xs font-bold text-orange-400">👤 {selectedWaiter.name}</span>
        </div>
        <button onClick={() => setIsLogged(false)} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded-lg text-red-400 font-bold hover:bg-gray-700 transition">
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
            className="w-1/2 bg-gray-900 border border-orange-500/50 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none text-center shadow"
          />
          <input
            type="text"
            placeholder="🔍 Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-800 p-2.5 rounded-xl text-xs text-white focus:outline-none shadow"
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
          <div
            key={p.id}
            onClick={() => handleOpenProductModal(p)}
            className="bg-gray-900 p-3 rounded-2xl border border-gray-800 text-left hover:border-orange-500 transition flex flex-col justify-between cursor-pointer active:scale-95 shadow"
          >
            <div>
              <span className="font-bold text-xs text-white block truncate flex items-center justify-between">
                <span className="truncate">{p.name}</span>
                {p.is_combo && <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded font-bold shrink-0 ml-1">COMBO</span>}
              </span>
              <span className="text-[10px] text-gray-400 block line-clamp-1 mt-0.5">{p.description}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs font-extrabold text-orange-400">R$ {Number(p.price).toFixed(2)}</span>
              <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-md font-bold">+ Opções</span>
            </div>
          </div>
        ))}
      </div>

      {/* BARRA FIXA INFERIOR DO CARRINHO */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-gray-900 border-t border-gray-800 p-3 space-y-2 z-40 shadow-2xl">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Itens ({cart.length}) | Mesa: <b className="text-white font-extrabold">{selectedTable || '--'}</b></span>
          <span className="font-extrabold text-green-400 text-sm">Total: R$ {cartTotal.toFixed(2)}</span>
        </div>

        {cart.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-1.5 py-1 border-t border-gray-800">
            {cart.map((item, idx) => (
              <div key={item.cartItemId || idx} className="flex justify-between items-start text-[10px] bg-gray-950 p-2 rounded-xl border border-gray-800">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="font-bold text-white block truncate">
                    {item.quantity}x {item.name}
                    {item.is_combo && <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded ml-1 font-bold">COMBO</span>}
                  </span>

                  {item.is_combo && item.comboSteps?.length > 0 ? (
                    <div className="space-y-0.5 mt-0.5 border-l border-purple-500/40 pl-1.5">
                      {item.comboSteps.map((step, sIdx) => (
                        <p key={sIdx} className="text-[9px] text-gray-400">
                          <b>{step.title}:</b> {step.items.map(i => i.name).join(', ')}
                        </p>
                      ))}
                    </div>
                  ) : (
                    item.selectedAddons && item.selectedAddons.length > 0 && (
                      <p className="text-[9px] text-purple-300 font-semibold">
                        + {item.selectedAddons.map(a => a.name).join(', ')}
                      </p>
                    )
                  )}

                  {item.selectedBorder && item.selectedBorder.name !== 'Sem Borda' && (
                    <p className="text-[9px] text-gray-400">Borda: {item.selectedBorder.name}</p>
                  )}

                  {item.observation && (
                    <p className="text-[9px] text-orange-400 italic">Obs: "{item.observation}"</p>
                  )}
                  <span className="text-green-400 font-bold block mt-0.5">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button onClick={() => updateCartQty(idx, -1)} className="w-5 h-5 bg-gray-800 rounded-md text-red-400 font-bold text-xs">-</button>
                  <span className="font-bold text-xs">{item.quantity}</span>
                  <button onClick={() => updateCartQty(idx, 1)} className="w-5 h-5 bg-gray-800 rounded-md text-green-400 font-bold text-xs">+</button>
                  <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-400 font-bold text-xs ml-1">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmitOrder}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-3.5 rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-2"
        >
          <span>🚀 Lançar Pedido para Cozinha</span>
        </button>
      </div>

      {/* MODAL COMPLETO DE SELEÇÃO E MONTAGEM DE PRODUTO */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-orange-500/40 w-full max-w-sm rounded-2xl p-4 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h3 className="font-bold text-sm text-orange-400 truncate">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 font-bold text-xs hover:text-white">✕ Fechar</button>
            </div>

            {selectedProduct.image && (
              <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-32 rounded-xl object-cover border border-gray-800" />
            )}
            {selectedProduct.description && (
              <p className="text-xs text-gray-400">{selectedProduct.description}</p>
            )}

            {/* MONTAGEM DE COMBO EM ETAPAS */}
            {selectedProduct.is_combo && selectedProduct.combo_steps?.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-gray-800">
                {selectedProduct.combo_steps.map((step, stepIdx) => {
                  const allLinkedAddons = getProductAddonsArray(selectedProduct.addons_list);
                  let stepAddons = allLinkedAddons.filter(a => a.category_type === step.category_type);

                  if (stepAddons.length === 0) {
                    stepAddons = globalAddons.filter(g => g.category_type === step.category_type);
                  }

                  const selectedInStep = comboSelections[stepIdx] || [];
                  const stepMax = Number(step.max || 1);

                  return (
                    <div key={stepIdx} className="space-y-2 bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-orange-400 block">
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

                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {stepAddons.length === 0 ? (
                          <p className="text-[10px] text-gray-500 italic">Nenhum item cadastrado nesta categoria.</p>
                        ) : (
                          stepAddons.map((addon, idx) => {
                            const isChecked = selectedInStep.some(a => a.name === addon.name);
                            return (
                              <div
                                key={idx}
                                onClick={() => toggleComboAddon(stepIdx, addon, stepMax)}
                                className={`p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition ${
                                  isChecked ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-900 border-gray-800'
                                }`}>
                                <div className="flex items-center space-x-2">
                                  <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-orange-500" />
                                  <div>
                                    <span className="font-bold block text-white">{addon.name}</span>
                                    {addon.description && <p className="text-[10px] text-gray-400 leading-tight">{addon.description}</p>}
                                  </div>
                                </div>
                                <span className="font-bold text-orange-400 shrink-0 whitespace-nowrap pl-1">
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
              /* SEÇÃO DE ITEM SIMPLES / PIZZA PADRÃO */
              getProductAddonsArray(selectedProduct.addons_list).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-300 block">
                      {selectedProduct.max_addons > 0 ? '🍕 Escolha os Sabores:' : '➕ Adicionais Opcionais:'}
                    </label>

                    {selectedProduct.max_addons > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedAddons.length === Number(selectedProduct.max_addons)
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      }`}>
                        Selecionados: {selectedAddons.length} / {selectedProduct.max_addons}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {getProductAddonsArray(selectedProduct.addons_list).map((addon, idx) => {
                      const isChecked = selectedAddons.some(a => a.name === addon.name);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleAddon(addon)}
                          className={`p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition ${
                            isChecked ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-900 border-gray-800'
                          }`}>
                          <div className="flex items-center space-x-2">
                            <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-orange-500" />
                            <div>
                              <span className="font-bold block text-white">{addon.name}</span>
                              {addon.description && <p className="text-[10px] text-gray-400 leading-tight">{addon.description}</p>}
                            </div>
                          </div>
                          <span className="font-bold text-orange-400 shrink-0 whitespace-nowrap pl-1">
                            {Number(addon.price) > 0 ? `+ R$ ${Number(addon.price).toFixed(2)}` : 'Grátis'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* SEÇÃO DE BORDAS RECHEADAS */}
            {getBordersArray(selectedProduct.borders_list).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <label className="text-xs font-bold text-gray-300 block">🫓 Escolha a Borda:</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {getBordersArray(selectedProduct.borders_list).map((border, idx) => {
                    const isSelected = selectedBorder?.name === border.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedBorder(border)}
                        className={`p-2.5 rounded-xl border flex justify-between items-center text-xs cursor-pointer transition ${
                          isSelected ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-900 border-gray-800'
                        }`}>
                        <div className="flex items-center space-x-2">
                          <input type="radio" checked={isSelected} onChange={() => {}} className="accent-orange-500" />
                          <span className="font-bold text-white">{border.name}</span>
                        </div>
                        <span className="font-bold text-orange-400 text-[11px]">
                          {Number(border.price) > 0 ? `+ R$ ${Number(border.price).toFixed(2)}` : 'Grátis'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OBSERVAÇÃO DO ITEM */}
            <div className="space-y-1 pt-2 border-t border-gray-800">
              <label className="text-xs font-bold text-gray-300 block">📝 Observação do Item:</label>
              <input
                type="text"
                placeholder="Ex: Sem cebola, bem passado..."
                value={itemObservation}
                onChange={(e) => setItemObservation(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 p-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {/* BARRA DE AÇÃO DA MODAL */}
            <div className="flex items-center space-x-3 pt-2">
              <div className="flex items-center space-x-2 bg-gray-950 p-1 rounded-xl border border-gray-800">
                <button onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))} className="w-8 h-8 rounded-lg bg-gray-800 text-white font-bold text-sm">-</button>
                <span className="font-bold px-2">{productQuantity}</span>
                <button onClick={() => setProductQuantity(productQuantity + 1)} className="w-8 h-8 rounded-lg bg-orange-500 text-white font-bold text-sm">+</button>
              </div>

              <button
                onClick={handleAddProductToCart}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-xs shadow-lg transition">
                Adicionar • R$ {(currentModalUnitPrice * productQuantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
