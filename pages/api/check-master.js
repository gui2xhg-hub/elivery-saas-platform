// Confere a senha mestra NO SERVIDOR (antes ficava escrita no código do site, visível para qualquer um).
// Defina MASTER_PASSWORD nas variáveis de ambiente da Vercel DESTE projeto (delivery).
// Enquanto ela não estiver cadastrada, as senhas antigas continuam valendo para você não ficar trancado fora.
const LEGACY = ['master123', 'sinerge2026'];

const attempts = new Map();

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'ip';
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 15) return res.status(429).json({ ok: false, error: 'Muitas tentativas. Aguarde 10 minutos.' });

  const pass = String((req.body && req.body.password) || '').trim();
  const master = String(process.env.MASTER_PASSWORD || '').trim();

  const ok = pass !== '' && (master ? pass === master : LEGACY.includes(pass));

  if (!ok) {
    list.push(now);
    attempts.set(ip, list);
  }
  return res.status(200).json({ ok, usingLegacy: !master });
}
