// Abduction: i numeri e le regole (niente DOM: si usano anche nei test).
// Il campo è visto dall'alto; le mucche dei giocatori sono identiche a quelle vere.
// Il disco volante pattuglia a zig-zag o a spirale: sotto il raggio chi si muove o
// bruca viene rapito, chi resta immobile viene scambiato per una mucca vera.

import { clamp, TAU } from '../../shared/util.js';

export const DURATA = 60; // round secco
export const T_FURIA = 45; // ultimi 15 s: il disco si arrabbia
export const T_RADAR = 3; // il telefono mostra dove sei (a inizio partita e quando rientri)
export const T_BRUCA = 3; // secondi tenendo premuto BRUCA
export const PUNTI = { bruca: 10, furia: 20 };
export const CD_SPINTA = 4;
export const T_FUORI = 3; // secondi fuori dopo il rapimento
export const T_RAPIMENTO = 1.2; // la mucca sale nel disco (e il disco si ferma)
export const TOLLERANZA = 0.3; // secondi di movimento o brucata sotto il raggio prima di essere presi
export const VEL_MUCCA = 75; // px/s, uguale per tutte
export const VEL_DISCO = 230;
export const FURIA_VEL = 1.35;
export const PASSO_SPINTA = 72; // "una casella": circa una mucca
export const T_SPINTA = 0.35;
export const PORTATA = 95; // distanza massima della testata
export const R_MUCCA = 23; // ingombro di una mucca (cerchio)
export const CAMPO = { x0: 36, y0: 112, x1: 1596, y1: 1058 };
export const ALTEZZA_DISCO = 175; // il disco si disegna così in alto sopra il suo raggio

export function config(n) {
  const k = clamp(n, 3, 16);
  const mucche = Math.round(40 + ((k - 3) * 40) / 13); // mucche vere: 40 in 3, 80 in 16
  return {
    mucche,
    mandrie: 3 + Math.round((mucche - 40) / 14),
    dischi: k >= 10 ? 2 : 1,
    raggio: k >= 7 && k < 10 ? 165 : 150,
  };
}

export const valoreBrucata = (t) => (t >= T_FURIA ? PUNTI.furia : PUNTI.bruca);

// Chi ti spinge nel raggio ruba metà dei punti che perdi (a multipli di 5).
export const bottino = (persi) => Math.floor(persi / 10) * 5;

export const nelRaggio = (m, d) => Math.hypot(m.x - d.x, m.y - d.y) <= d.r;

// La testata colpisce la mucca più vicina davanti a te (entro PORTATA, ±65°) e la
// sposta nella direzione in cui guardi (un po' verso di lei, così va dove ci si aspetta).
export function bersaglioSpinta(io, mucche) {
  const fx = Math.cos(io.ang);
  const fy = Math.sin(io.ang);
  let best = null;
  let bestV = Infinity;
  for (const m of mucche) {
    if (m === io || m.via || m.rapita) continue;
    const dx = m.x - io.x;
    const dy = m.y - io.y;
    const d = Math.hypot(dx, dy);
    if (d > PORTATA || d < 1) continue;
    const c = (dx * fx + dy * fy) / d;
    if (c < 0.42) continue;
    const v = d * (2 - c);
    if (v < bestV) {
      bestV = v;
      best = m;
    }
  }
  if (!best) return null;
  const d = Math.hypot(best.x - io.x, best.y - io.y);
  const dx = fx + (best.x - io.x) / d;
  const dy = fy + (best.y - io.y) / d;
  const k = Math.hypot(dx, dy) || 1;
  return { m: best, dx: dx / k, dy: dy / k };
}

// Il giro del disco: un pezzo di campo a zig-zag (righe o colonne) oppure una spirale
// (verso fuori o verso dentro), con qualche sosta per scrutare. Parte vicino a "da".
export function percorso(da, r, rnd = Math.random) {
  const M = 70;
  const X0 = CAMPO.x0 + M;
  const X1 = CAMPO.x1 - M;
  const Y0 = CAMPO.y0 + M;
  const Y1 = CAMPO.y1 - M;
  const punti = [];
  const tipo = rnd() < 0.55 ? 'zigzag' : 'spirale';
  if (tipo === 'zigzag') {
    const orizz = rnd() < 0.6;
    const w = (X1 - X0) * (0.55 + rnd() * 0.45);
    const h = (Y1 - Y0) * (0.6 + rnd() * 0.4);
    const ax = X0 + rnd() * (X1 - X0 - w);
    const ay = Y0 + rnd() * (Y1 - Y0 - h);
    const passo = r * 1.8;
    const daSx = Math.abs(da.x - ax) < Math.abs(da.x - (ax + w));
    const daSu = Math.abs(da.y - ay) < Math.abs(da.y - (ay + h));
    if (orizz) {
      const righe = Math.max(2, Math.round(h / passo) + 1);
      for (let k = 0; k < righe; k++) {
        const y = daSu ? ay + (h * k) / (righe - 1) : ay + h - (h * k) / (righe - 1);
        const verso = k % 2 === 0 ? daSx : !daSx;
        punti.push({ x: verso ? ax : ax + w, y }, { x: verso ? ax + w : ax, y });
      }
    } else {
      const colonne = Math.max(2, Math.round(w / passo) + 1);
      for (let k = 0; k < colonne; k++) {
        const x = daSx ? ax + (w * k) / (colonne - 1) : ax + w - (w * k) / (colonne - 1);
        const verso = k % 2 === 0 ? daSu : !daSu;
        punti.push({ x, y: verso ? ay : ay + h }, { x, y: verso ? ay + h : ay });
      }
    }
  } else {
    const R = 260 + rnd() * 200;
    const cx = X0 + R * 0.7 + rnd() * Math.max(0, X1 - X0 - R * 1.4);
    const cy = Y0 + R * 0.5 + rnd() * Math.max(0, Y1 - Y0 - R);
    const giri = R / (r * 1.7);
    const verso = rnd() < 0.5 ? 1 : -1;
    const a0 = rnd() * TAU;
    const n = Math.ceil(giri * 16);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const a = a0 + verso * f * giri * TAU;
      punti.push({ x: clamp(cx + Math.cos(a) * R * f, X0, X1), y: clamp(cy + Math.sin(a) * R * f, Y0, Y1) });
    }
    if (rnd() < 0.5) punti.reverse();
  }
  if (rnd() < 0.7) punti[1 + Math.floor(rnd() * (punti.length - 1))].sosta = 1 + rnd() * 1.2;
  punti[punti.length - 1].sosta = 0.6 + rnd() * 0.8;
  return { tipo, punti };
}
