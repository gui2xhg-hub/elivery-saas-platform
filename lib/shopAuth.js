// Login da equipe (cozinha) conferido no servidor; o aparelho guarda só um "crachá" (token).
const key = (slug) => `sinerge_delivery_token_${String(slug || '').toLowerCase()}`;

export function getShopToken(slug) {
  try { return localStorage.getItem(key(slug)) || ''; } catch (e) { return ''; }
}
export function saveShopToken(slug, token) {
  try { localStorage.setItem(key(slug), token); } catch (e) {}
}
export function clearShopToken(slug) {
  try { localStorage.removeItem(key(slug)); } catch (e) {}
}

export async function shopLogin(slug, password) {
  try {
    const r = await fetch('/api/store-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password }) });
    const data = await r.json();
    if (data.ok && data.token) saveShopToken(slug, data.token);
    return data;
  } catch (e) {
    return { ok: false, error: 'Sem conexão. Tente de novo.' };
  }
}

export async function shopSessionValid(slug) {
  const token = getShopToken(slug);
  if (!token) return false;
  try {
    const r = await fetch('/api/store-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, token }) });
    const data = await r.json();
    return !!data.ok;
  } catch (e) {
    return true; // sem internet momentânea: não derruba a cozinha no meio do serviço
  }
}

// Confere uma senha de administrador sem guardar sessão (ex.: liberar edição de pedido)
export async function checkAdminPassword(slug, password) {
  try {
    const r = await fetch('/api/store-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password }) });
    const data = await r.json();
    return !!data.ok;
  } catch (e) {
    return false;
  }
}
