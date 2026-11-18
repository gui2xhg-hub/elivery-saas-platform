import { supabase } from './supabase';

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

// Plano B: se o servidor estiver fora do ar, confere a senha do jeito antigo para a loja nunca ficar trancada
async function fallbackLogin(slug, password) {
  try {
    const { data: t } = await supabase.from('tenants').select('slug, admin_password').eq('slug', slug).maybeSingle();
    let ok = !!(t && password && String(t.admin_password || '').trim() === String(password).trim());
    if (!ok) {
      const r = await fetch('/api/check-master', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      ok = !!(r.ok && (await r.json()).ok);
    }
    if (ok) { saveShopToken(slug, 'local.' + Date.now()); return { ok: true, fallback: true }; }
    return { ok: false, error: 'Senha incorreta.' };
  } catch (e) {
    return { ok: false, error: 'Sem conexão. Tente de novo.' };
  }
}

export async function shopLogin(slug, password) {
  let data = null;
  try {
    const r = await fetch('/api/store-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password }) });
    data = r.ok ? await r.json() : { ok: false, server_error: true };
  } catch (e) {
    data = { ok: false, server_error: true };
  }
  if (data.ok && data.token) { saveShopToken(slug, data.token); return data; }
  if (data.server_error) return fallbackLogin(slug, password);
  return data;
}

export async function shopSessionValid(slug) {
  const token = getShopToken(slug);
  if (!token) return false;
  if (token.startsWith('local.')) return true; // entrou pelo plano B
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
  let data = null;
  try {
    const r = await fetch('/api/store-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, password }) });
    data = r.ok ? await r.json() : { ok: false, server_error: true };
  } catch (e) {
    data = { ok: false, server_error: true };
  }
  if (data.ok) return true;
  if (data.server_error) { const f = await fallbackLogin(slug, password); return !!f.ok; }
  return false;
}
