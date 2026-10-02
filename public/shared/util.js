// Utilità condivise tra schermo, telefoni e test.

export const MAX_GIOCATORI = 16;
export const MIN_GIOCATORI = 3;

// 16 colori giocatore ben distinguibili (uno per persona).
export const COLORI_GIOCATORE = [
  { hex: '#ef4444', nome: 'Rosso' },
  { hex: '#f97316', nome: 'Arancio' },
  { hex: '#facc15', nome: 'Giallo' },
  { hex: '#a3e635', nome: 'Lime' },
  { hex: '#22c55e', nome: 'Verde' },
  { hex: '#14b8a6', nome: 'Acqua' },
  { hex: '#22d3ee', nome: 'Azzurro' },
  { hex: '#3b82f6', nome: 'Blu' },
  { hex: '#6366f1', nome: 'Indaco' },
  { hex: '#a855f7', nome: 'Viola' },
  { hex: '#e879f9', nome: 'Fucsia' },
  { hex: '#f472b6', nome: 'Rosa' },
  { hex: '#b45309', nome: 'Marrone' },
  { hex: '#f1f5f9', nome: 'Bianco' },
  { hex: '#475569', nome: 'Grigio' },
  { hex: '#be123c', nome: 'Bordeaux' },
];

export const coloreGiocatore = (i) => (COLORI_GIOCATORE[i] || COLORI_GIOCATORE[0]).hex;

// ---------------------------------------------------------------------------
// Numeri

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const TAU = Math.PI * 2;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Differenza tra due angoli, nell'intervallo (-PI, PI].
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

// Joystick "a scatti": una delle 8 direzioni (componenti -1, 0 o 1), oppure [0, 0]
// se la levetta è quasi al centro. x, y in [-1, 1].
export function dir8(x, y, morto = 0.3) {
  if (!(Math.hypot(x, y) >= morto)) return [0, 0];
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
}

// Generatore casuale con seme: schermo e telefoni ottengono gli stessi numeri.
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

// ---------------------------------------------------------------------------
// Formattazione (all'italiana)

export function fmtNum(n, dec = 0) {
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export const fmtSec = (ms, dec = 2) => `${fmtNum(ms / 1000, dec)} s`;
export const fmtPct = (v, dec = 1) => `${fmtNum(v, dec)}%`;

// ---------------------------------------------------------------------------
// Classifiche e punti

// Da una mappa id -> punteggio a gruppi ordinati [[id], [id, id], ...] (pari merito insieme).
export function gruppiDaPunteggi(punteggi, altoMeglio = true) {
  const ids = Object.keys(punteggi);
  ids.sort((a, b) => (altoMeglio ? punteggi[b] - punteggi[a] : punteggi[a] - punteggi[b]));
  const gruppi = [];
  let last = null;
  for (const id of ids) {
    const v = punteggi[id];
    if (gruppi.length && Math.abs(v - last) < 1e-9) gruppi[gruppi.length - 1].push(id);
    else gruppi.push([id]);
    last = v;
  }
  return gruppi;
}

// Punti del minigioco: 1 punto per ogni avversario battuto, +2 a chi vince.
export const BONUS_VITTORIA = 2;

export function puntiDaGruppi(gruppi, moltiplicatore = 1) {
  const totale = gruppi.reduce((n, g) => n + g.length, 0);
  const punti = {};
  let prima = 0;
  gruppi.forEach((g, i) => {
    prima += g.length;
    const battuti = totale - prima;
    const bonus = i === 0 && totale > 1 ? BONUS_VITTORIA : 0;
    for (const id of g) punti[id] = (battuti + bonus) * moltiplicatore;
  });
  return punti;
}

// Posizione (1, 2, 2, 4...) di ciascun id.
export function posizioniDaGruppi(gruppi) {
  const pos = {};
  let n = 1;
  for (const g of gruppi) {
    for (const id of g) pos[id] = n;
    n += g.length;
  }
  return pos;
}

// ---------------------------------------------------------------------------
// Griglie: dispone n riquadri in un'area mantenendoli il più grandi possibile.

export function griglia(n, x, y, w, h, { rapporto = 1, spazio = 16 } = {}) {
  if (n <= 0) return [];
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    let cw = (w - spazio * (cols - 1)) / cols;
    let ch = (h - spazio * (rows - 1)) / rows;
    if (cw / ch > rapporto) cw = ch * rapporto;
    else ch = cw / rapporto;
    if (!best || cw * ch > best.cw * best.ch) best = { cols, rows, cw, ch };
  }
  const { cols, rows, cw, ch } = best;
  const totH = rows * ch + (rows - 1) * spazio;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const rowW = inRow * cw + (inRow - 1) * spazio;
    const c = i - r * cols;
    out.push({
      x: x + (w - rowW) / 2 + c * (cw + spazio),
      y: y + (h - totH) / 2 + r * (ch + spazio),
      w: cw,
      h: ch,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Colori

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

// h in [0,360), s e v in [0,1] -> [r,g,b] 0..255
export function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export function rgbToHsv([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

// Schiarisce (amt > 0) o scurisce (amt < 0) un colore esadecimale.
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex([r + (t - r) * p, g + (t - g) * p, b + (t - b) * p]);
}

export function rgbToLab([r, g, b]) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Differenza di colore percepita (CIEDE2000).
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lmp = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let hmp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hmp += h1p + h2p < 360 ? 360 : -360;
    hmp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hmp - 30) * rad) +
    0.24 * Math.cos(2 * hmp * rad) +
    0.32 * Math.cos((3 * hmp + 6) * rad) -
    0.2 * Math.cos((4 * hmp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hmp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lmp - 50, 2)) / Math.sqrt(20 + Math.pow(Lmp - 50, 2));
  const Sc = 1 + 0.045 * Cmp;
  const Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh),
  );
}
