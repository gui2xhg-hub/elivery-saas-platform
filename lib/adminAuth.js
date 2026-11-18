// USO NO SERVIDOR: confere a senha do painel admin da loja (ou a senha mestra).
const LEGACY_MASTER = ['master123', 'sinerge2026'];

export function isAdminPassword(tenant, password) {
  const pass = String(password || '').trim();
  if (!pass || !tenant) return false;
  if (tenant.admin_password && pass === String(tenant.admin_password).trim()) return true;
  const master = String(process.env.MASTER_PASSWORD || '').trim();
  return master ? pass === master : LEGACY_MASTER.includes(pass);
}
