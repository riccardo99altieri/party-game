// Tempi e cerchi di Twister delle Dita, condivisi da schermo e telefoni (tempi in
// secondi dall'inizio). La CPU usa gli stessi cerchi del telefono, quindi stanno qui.

import { TAU, clamp, seeded } from '../../shared/util.js';

export const BERSAGLI = 5;
export const PRIMO = 1.5;
export const OGNI = 3.2;
export const TEMPO_PER_TOCCARE = 3;
export const INIZIO_MOVIMENTO = PRIMO + OGNI * (BERSAGLI - 1) + TEMPO_PER_TOCCARE + 0.5;
export const DURATA = 60;

export const appare = (i) => PRIMO + OGNI * i;
export const scadenza = (i) => appare(i) + TEMPO_PER_TOCCARE;

// Raggio dei cerchi in un campo largo w e alto h.
export const raggioCerchio = (w, h) => Math.min(w, h) * 0.095;

// I cerchi di una partita: stessi numeri dal seme, nello stesso ordine, ovunque.
export function creaCerchi(seme) {
  const rng = seeded(seme || 1);
  const pts = [];
  let tent = 0;
  while (pts.length < BERSAGLI && tent++ < 800) {
    const p = [rng.range(0.18, 0.82), rng.range(0.2, 0.85)];
    if (pts.every((q) => Math.hypot((q[0] - p[0]) * 0.6, q[1] - p[1]) > 0.2)) pts.push(p);
  }
  while (pts.length < BERSAGLI) pts.push([rng.range(0.2, 0.8), rng.range(0.2, 0.8)]);
  return pts.map((b, i) => ({ b, fase: rng.range(0, TAU), fase2: rng.range(0, TAU), w: rng.range(0.5, 0.9) * (i % 2 ? 1 : -1) }));
}

// Dove si trova il cerchio q al tempo t, in un campo w x h con raggio r
// (fermo fino a INIZIO_MOVIMENTO, poi gira sempre più largo e veloce).
export function posizioneCerchio(q, t, w, h, r) {
  let x = q.b[0] * w;
  let y = q.b[1] * h;
  if (t > INIZIO_MOVIMENTO) {
    const k = Math.min(1, (t - INIZIO_MOVIMENTO) / 20);
    const amp = Math.min(w, h) * 0.13 * k;
    const vel = 1 + (t - INIZIO_MOVIMENTO) / 25;
    const tt = t - INIZIO_MOVIMENTO;
    x += Math.cos(tt * q.w * vel + q.fase) * amp;
    y += Math.sin(tt * q.w * 0.8 * vel + q.fase2) * amp;
  }
  return [clamp(x, r, w - r), clamp(y, r + 30, h - r)];
}
