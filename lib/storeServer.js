// USO EXCLUSIVO NO SERVIDOR (pages/api). Dados da loja e regras de pagamento do delivery.
import { serverSupabase } from './serverSupabase';

const PRIVATE_FIELDS = ['admin_password', 'financial_password', 'pix_access_token', 'api_key', 'bot_whatsapp_token', 'instance_id'];
const SECRET_PATTERN = /(password|senha|token|secret|api_key|apikey)$/i;

// Remove senhas e tokens antes de mandar a loja para o navegador
export function sanitizeTenant(t) {
  if (!t) return t;
  const clean = {};
  Object.keys(t).forEach((k) => {
    if (PRIVATE_FIELDS.includes(k) || SECRET_PATTERN.test(k)) return;
    clean[k] = t[k];
  });
  const hasMp = !!(t.pix_access_token && String(t.pix_access_token).trim());
  clean.pix_ready = !!t.pix_enabled && hasMp; // PIX automático (QR Code) disponível
  clean.card_ready = hasMp;                  // cartão online disponível
  return clean;
}

export async function loadTenantBySlug(slug) {
  const { data } = await serverSupabase.from('tenants').select('*').ilike('slug', String(slug || '').trim()).maybeSingle();
  return data;
}
export async function loadTenantById(id) {
  const { data } = await serverSupabase.from('tenants').select('*').eq('id', id).maybeSingle();
  return data;
}
export async function loadOrder(tenantId, orderId) {
  const { data } = await serverSupabase.from('orders').select('*').eq('id', orderId).eq('tenant_id', tenantId).maybeSingle();
  return data;
}

// Pagamento confirmado: marca como pago e libera para a cozinha
export async function markOrderPaid(order) {
  if (!order) return null;
  if (order.is_paid && order.status !== 'aguardando_pagamento') return order;
  const patch = { is_paid: true };
  if (!order.status || order.status === 'aguardando_pagamento' || order.status === 'pendente_pagamento') patch.status = 'recebido';
  await serverSupabase.from('orders').update(patch).eq('id', order.id).eq('tenant_id', order.tenant_id);
  return { ...order, ...patch };
}

export function mpHeaders(token, extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${String(token || '').trim()}`, ...extra };
}

export function baseUrlFrom(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}
