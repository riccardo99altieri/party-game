// Mano Ferma: generazione delle prove e calcolo dei punteggi (0..100).
// Coordinate normalizzate in un quadrato 1000 x 1000.

import { seeded, TAU, angDiff } from '../../shared/util.js';

// --- Cerchio perfetto -------------------------------------------------------

// Cerchio che passa "meglio" per i punti (metodo algebrico di Kåsa).
export function fitCerchio(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const [x, y] of pts) {
    const z = x * x + y * y;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }
  // Sistema 3x3: [sxx sxy sx; sxy syy sy; sx sy n] * [D E F] = -[sxz syz sz]
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const b = [-sxz, -syz, -sz];
  const sol = risolvi3(A, b);
  if (!sol) return null;
  const [D, E, F] = sol;
  const cx = -D / 2;
  const cy = -E / 2;
  const r2 = cx * cx + cy * cy - F;
  if (!(r2 > 0)) return null;
  return { cx, cy, r: Math.sqrt(r2) };
}

function risolvi3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

export function punteggioCerchio(pts) {
  if (!Array.isArray(pts) || pts.length < 12) return { punti: 0, fit: null };
  const fit = fitCerchio(pts);
  if (!fit) return { punti: 0, fit: null };
  const { cx, cy, r } = fit;
  let somma = 0;
  let giro = 0;
  let prec = Math.atan2(pts[0][1] - cy, pts[0][0] - cx);
  for (const [x, y] of pts) {
    const d = Math.hypot(x - cx, y - cy) - r;
    somma += d * d;
    const a = Math.atan2(y - cy, x - cx);
    giro += angDiff(prec, a);
    prec = a;
  }
  const rms = Math.sqrt(somma / pts.length) / r;
  const copertura = Math.min(1, Math.abs(giro) / (TAU * 0.92));
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[pts.length - 1];
  const buco = Math.hypot(x1 - x0, y1 - y0) / r;
  const chiusura = buco < 0.3 ? 1 : Math.max(0, 1 - (buco - 0.3) * 0.8);
  const grandezza = Math.min(1, r / 90);
  const punti = 100 * Math.max(0, 1 - rms * 4) * copertura * chiusura * grandezza;
  return { punti: Math.round(punti * 10) / 10, fit };
}

// --- Taglia a metà ----------------------------------------------------------

export function creaForma(seme) {
  const rng = seeded(seme);
  const n = rng.int(7, 10);
  const rot = rng.range(0, TAU);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU + rng.range(-0.25, 0.25);
    const r = rng.range(210, 400);
    pts.push([500 + Math.cos(a) * r, 500 + Math.sin(a) * r * rng.range(0.75, 1)]);
  }
  return pts;
}

export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

// Parte del poligono dal lato "positivo" della retta per (ax,ay)-(bx,by).
export function taglia(poly, [ax, ay, bx, by]) {
  const lato = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = lato(p);
    const sq = lato(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function punteggioTaglio(poly, linea) {
  if (!Array.isArray(linea) || linea.length !== 4 || linea.some((v) => !isFinite(v))) return { punti: 0, perc: 0 };
  const [ax, ay, bx, by] = linea;
  if (Math.hypot(bx - ax, by - ay) < 20) return { punti: 0, perc: 0 };
  const tot = area(poly);
  const a = area(taglia(poly, linea));
  const perc = (a / tot) * 100;
  const piccola = Math.min(perc, 100 - perc);
  const punti = piccola < 0.5 ? 0 : Math.max(0, 100 - 3 * (50 - piccola));
  return { punti: Math.round(punti * 10) / 10, perc };
}

// --- Punti a memoria --------------------------------------------------------

export function creaPunti(seme, quanti = 5) {
  const rng = seeded(seme + 99);
  const pts = [];
  let tentativi = 0;
  while (pts.length < quanti && tentativi++ < 500) {
    const p = [rng.range(120, 880), rng.range(120, 880)];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 190)) pts.push(p);
  }
  return pts;
}

function permutazioni(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    for (const p of permutazioni([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

// Abbina ogni tocco al punto giusto nel modo migliore possibile.
export function punteggioPunti(veri, tocchi) {
  const t = Array.isArray(tocchi) ? tocchi.filter((p) => Array.isArray(p) && p.length === 2 && p.every(isFinite)).slice(0, veri.length) : [];
  const idx = veri.map((_, i) => i);
  let migliore = Infinity;
  let abbinamento = [];
  for (const perm of permutazioni(idx)) {
    let s = 0;
    for (let i = 0; i < veri.length; i++) {
      const tc = t[i];
      const v = veri[perm[i]];
      s += tc ? Math.hypot(tc[0] - v[0], tc[1] - v[1]) : 400;
    }
    if (s < migliore) {
      migliore = s;
      abbinamento = perm;
    }
  }
  const media = migliore / veri.length;
  const punti = Math.max(0, 100 * (1 - media / 180));
  return { punti: Math.round(punti * 10) / 10, media, abbinamento };
}
