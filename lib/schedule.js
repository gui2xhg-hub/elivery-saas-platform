// Horário de funcionamento — MESMA regra que o painel admin grava (horário por dia, com ou sem almoço).
// Usa o horário de Brasília, não o relógio do celular do cliente.
export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function parseSchedule(t) {
  let parsed = null;
  if (t?.weekly_schedule) {
    try { parsed = typeof t.weekly_schedule === 'string' ? JSON.parse(t.weekly_schedule) : t.weekly_schedule; } catch (e) { parsed = null; }
  }
  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed;
  // Lojas antigas (sem horário por dia): monta a partir dos campos simples
  const days = Array.isArray(t?.work_days) ? t.work_days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  const s = {};
  for (let d = 0; d < 7; d++) {
    s[d] = {
      active: days.includes(d), has_lunch: !!t?.has_lunch_break,
      open1: t?.lunch_opening_time || '11:00', close1: t?.lunch_closing_time || '14:30',
      open2: t?.opening_time || '', close2: t?.closing_time || ''
    };
  }
  return s;
}

const toMin = (hhmm) => {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Turnos do dia em minutos; turno que passa da meia-noite termina depois de 1440
export function dayShifts(day) {
  if (!day || day.active === false) return [];
  const list = day.has_lunch ? [[day.open1, day.close1], [day.open2, day.close2]] : [[day.open2, day.close2]];
  return list.map(([o, c]) => {
    const a = toMin(o); let b = toMin(c);
    if (a === null || b === null) return null;
    if (b <= a) b += 1440;
    return [a, b];
  }).filter(Boolean);
}

// Dia da semana e minutos no fuso da loja
export function storeClock(date = new Date(), timeZone = 'America/Sao_Paulo') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    const get = (k) => parts.find((p) => p.type === k)?.value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const h = Number(get('hour')) % 24;
    return { day: wd, minutes: h * 60 + Number(get('minute')) };
  } catch (e) {
    return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
  }
}

// Loja sem nenhum horário cadastrado = sempre aberta (como antes).
// Com horário por dia salvo no Admin, vale ele (mesmo que todos os dias estejam fechados).
export function hasAnySchedule(t) {
  let explicit = false;
  if (t?.weekly_schedule) {
    try {
      const p = typeof t.weekly_schedule === 'string' ? JSON.parse(t.weekly_schedule) : t.weekly_schedule;
      explicit = !!p && typeof p === 'object' && Object.keys(p).length > 0;
    } catch (e) { explicit = false; }
  }
  if (explicit) return true;
  return !!(t?.opening_time && t?.closing_time);
}

export function isOpenNow(t, date = new Date()) {
  if (!t) return true;
  if (!hasAnySchedule(t)) return true;
  const s = parseSchedule(t);
  const { day, minutes } = storeClock(date);
  if (dayShifts(s[day]).some(([a, b]) => minutes >= a && minutes <= b)) return true;
  // turno de ontem que atravessou a meia-noite (ex.: sexta 18h às 02h, agora sábado 01h)
  const yesterday = (day + 6) % 7;
  return dayShifts(s[yesterday]).some(([a, b]) => b > 1440 && minutes + 1440 <= b && minutes + 1440 >= a);
}

const fmt = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Texto do horário de hoje, ex.: "11:00 às 14:30 e 18:00 às 23:30"
export function todayHoursText(t, date = new Date()) {
  const s = parseSchedule(t);
  const { day } = storeClock(date);
  const sh = dayShifts(s[day]);
  if (!sh.length) return 'Fechado hoje';
  return sh.map(([a, b]) => `${fmt(a)} às ${fmt(b)}`).join(' e ');
}

// Próxima abertura, ex.: "hoje às 18:00" / "amanhã às 11:00" / "sábado às 18:00"
export function nextOpeningText(t, date = new Date()) {
  const s = parseSchedule(t);
  const { day, minutes } = storeClock(date);
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const starts = dayShifts(s[d]).map(([a]) => a).filter((a) => i > 0 || a > minutes).sort((x, y) => x - y);
    if (starts.length) return `${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DAY_NAMES[d].toLowerCase()} às ${fmt(starts[0])}`;
  }
  return '';
}
