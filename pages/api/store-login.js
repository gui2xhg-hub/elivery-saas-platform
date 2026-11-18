// Confere a senha do lojista (ou a senha mestra) NO SERVIDOR e devolve um crachá de acesso.
import { loadTenantBySlug, sanitizeTenant } from '../../lib/storeServer';
import { isAdminPassword } from '../../lib/adminAuth';
import { createToken } from '../../lib/authToken';

const attempts = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const { slug, password } = req.body || {};
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'ip';
    const k = `${ip}|${String(slug || '').toLowerCase()}`;
    const now = Date.now();
    const list = (attempts.get(k) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (list.length >= 15) return res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde 10 minutos.' });

    const tenant = await loadTenantBySlug(slug);
    if (!tenant) return res.status(200).json({ ok: false, server_error: true, error: 'Não consegui consultar a loja no servidor.' });
    if (!isAdminPassword(tenant, password)) {
      list.push(now);
      attempts.set(k, list);
      return res.status(200).json({ ok: false, error: 'Senha incorreta.' });
    }
    return res.status(200).json({ ok: true, token: createToken(tenant.slug, 'admin'), tenant: sanitizeTenant(tenant) });
  } catch (e) {
    console.error('store-login:', e);
    return res.status(200).json({ ok: false, server_error: true, error: 'Erro no servidor: ' + String(e && e.message || e).slice(0, 200) });
  }
}
