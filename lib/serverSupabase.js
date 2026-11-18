// USO EXCLUSIVO NO SERVIDOR (pasta pages/api). Nunca importe este arquivo em uma página.
//
// Fala com o Supabase direto pela API REST (fetch), SEM a biblioteca @supabase/supabase-js.
// Motivo: as versões novas da biblioteca quebram dentro das funções da Vercel (erro 500),
// porque exigem WebSocket para o "tempo real", que o servidor não usa.
// Aceita o mesmo jeito de escrever: serverSupabase.from('tabela').select('*').eq(...).maybeSingle()

// IMPORTANTE: usa SEMPRE o mesmo banco que as páginas do delivery (lib/supabase.js).
// Não lê NEXT_PUBLIC_SUPABASE_URL da Vercel: se ela apontar para o Supabase de outro sistema,
// o servidor procuraria a loja no banco errado ("Restaurante não encontrado").
const URL_ = 'https://chvkpasvoibrhdqjsskt.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodmtwYXN2b2licmhkcWpzc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTA3NTAsImV4cCI6MjEwNDA2Njc1MH0.G2jT-XW-Zeoar9iZXcQTNC8EZuQJTlO0vMVJbSRvX8Y';
// Chave secreta só é usada se for DESTE banco (o "ref" dentro da chave tem que ser o mesmo)
const refOf = (jwt) => { try { return JSON.parse(Buffer.from(String(jwt).split('.')[1], 'base64').toString()).ref || ''; } catch (e) { return ''; } };
const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const KEYS = SERVICE && refOf(SERVICE) === 'chvkpasvoibrhdqjsskt' ? [SERVICE, ANON] : [ANON];

function query(table) {
  const params = [];
  let method = 'GET';
  let body;
  let mode = 'many';
  let cols = '*';
  let upsert = false;

  const api = {
    select(c = '*') { cols = c; return api; },
    eq(col, v) { params.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(String(v))}`); return api; },
    in(col, list) { params.push(`${encodeURIComponent(col)}=in.(${(list || []).map((v) => encodeURIComponent('"' + String(v).replace(/"/g, '') + '"')).join(',')})`); return api; },
    gte(col, v) { params.push(`${encodeURIComponent(col)}=gte.${encodeURIComponent(String(v))}`); return api; },
    lte(col, v) { params.push(`${encodeURIComponent(col)}=lte.${encodeURIComponent(String(v))}`); return api; },
    ilike(col, v) { params.push(`${encodeURIComponent(col)}=ilike.${encodeURIComponent(String(v))}`); return api; },
    order(col, opts = {}) { params.push(`order=${encodeURIComponent(col)}.${opts.ascending === false ? 'desc' : 'asc'}`); return api; },
    limit(n) { params.push(`limit=${Number(n)}`); return api; },
    update(obj) { method = 'PATCH'; body = JSON.stringify(obj); return api; },
    insert(rows) { method = 'POST'; body = JSON.stringify(rows); return api; },
    upsert(rows, opts = {}) {
      method = 'POST'; body = JSON.stringify(rows); upsert = true;
      if (opts.onConflict) params.push(`on_conflict=${encodeURIComponent(opts.onConflict)}`);
      return api;
    },
    maybeSingle() { mode = 'maybe'; return api; },
    single() { mode = 'single'; return api; },
    async run() {
      try {
        const qs = [...params];
        if (method === 'GET') {
          qs.unshift(`select=${encodeURIComponent(cols)}`);
          if (mode !== 'many') qs.push('limit=2');
        }
        let res = null;
        for (const KEY of KEYS) {
          res = await fetch(`${URL_}/rest/v1/${encodeURIComponent(table)}?${qs.join('&')}`, {
          method,
          headers: {
            apikey: KEY,
            Authorization: `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            Prefer: method === 'GET' ? 'count=none' : (upsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation')
          },
          body
          });
          // chave recusada (de outro projeto ou vencida): tenta a próxima
          if (res.status !== 401 && res.status !== 403) break;
        }
        if (!res) return { data: null, error: { message: 'Supabase não configurado' } };
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) return { data: null, error: { message: (data && (data.message || data.hint)) || `HTTP ${res.status}`, status: res.status } };
        if (mode === 'many') return { data: Array.isArray(data) ? data : [], error: null };
        const list = Array.isArray(data) ? data : [];
        if (mode === 'single' && list.length !== 1) return { data: null, error: { message: 'Registro não encontrado' } };
        return { data: list[0] || null, error: null };
      } catch (e) {
        return { data: null, error: { message: String(e && e.message || e) } };
      }
    },
    then(resolve, reject) { return api.run().then(resolve, reject); }
  };
  return api;
}

export const serverSupabase = { from: query };
