// USO EXCLUSIVO NO SERVIDOR. Gera e confere o "crachá" de acesso (token) salvo no aparelho.
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || ('sinerge-' + (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev'));
const DAYS = 180;

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

// level: 'admin' (painel admin + agenda) ou 'agenda' (só agenda)
export function createToken(slug, level) {
  const payload = b64(JSON.stringify({ s: String(slug).toLowerCase(), l: level, e: Date.now() + DAYS * 86400000 }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token, slug) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const expected = sign(payload);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.e < Date.now()) return null;
    if (slug && data.s !== String(slug).toLowerCase()) return null;
    return { slug: data.s, level: data.l };
  } catch (e) {
    return null;
  }
}
