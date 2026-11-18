// Dados PÚBLICOS da loja (sem senhas e sem tokens) para o cardápio, cozinha e garçom.
import { loadTenantBySlug, sanitizeTenant } from '../../lib/storeServer';

export default async function handler(req, res) {
  const slug = req.query.slug || req.body?.slug;
  if (!slug) return res.status(400).json({ error: 'slug' });
  try {
    const tenant = await loadTenantBySlug(slug);
    if (!tenant) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ tenant: sanitizeTenant(tenant) });
  } catch (e) {
    console.error('public-store:', e);
    return res.status(500).json({ error: 'server' });
  }
}
