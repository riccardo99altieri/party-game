// Percorsi di Filo Scottante: generati dal seme, uguali per tutti i telefoni.
// Coordinate in un riquadro 1000 x 1600 (verticale), dal basso verso l'alto.

import { seeded } from '../../shared/util.js';

export const LARGHEZZA = 1000;
export const ALTEZZA = 1600;
export const LIVELLI = [
  { tappe: 6, semi: 78 },
  { tappe: 8, semi: 60 },
  { tappe: 10, semi: 46 },
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

// Restituisce { punti: [[x,y],...] ogni ~6 unità, semi: mezza larghezza del corridoio }.
export function creaPercorso(seme, livello) {
  const L = LIVELLI[livello];
  const rng = seeded(seme * 31 + livello * 7919 + 1);
  const tappe = [[500, 1500]];
  let lato = rng.next() < 0.5 ? -1 : 1;
  for (let i = 1; i <= L.tappe; i++) {
    const y = 1500 - (1400 * i) / (L.tappe + 1);
    const ampiezza = rng.range(160, 360);
    const x = Math.max(L.semi + 40, Math.min(1000 - L.semi - 40, 500 + lato * ampiezza + rng.range(-60, 60)));
    tappe.push([x, y]);
    lato = -lato;
  }
  tappe.push([500, 100]);
  const ext = [tappe[0], ...tappe, tappe[tappe.length - 1]];
  const grezzi = [];
  for (let i = 1; i < ext.length - 2; i++) {
    for (let k = 0; k < 24; k++) grezzi.push(catmull(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], k / 24));
  }
  grezzi.push(tappe[tappe.length - 1]);
  // Ricampiona a passo costante
  const punti = [grezzi[0]];
  let acc = 0;
  for (let i = 1; i < grezzi.length; i++) {
    const [ax, ay] = grezzi[i - 1];
    const [bx, by] = grezzi[i];
    const d = Math.hypot(bx - ax, by - ay);
    acc += d;
    if (acc >= 6) {
      punti.push([bx, by]);
      acc = 0;
    }
  }
  const ultimo = tappe[tappe.length - 1];
  const fine = punti[punti.length - 1];
  if (fine[0] !== ultimo[0] || fine[1] !== ultimo[1]) punti.push(ultimo);
  return { punti, semi: L.semi };
}
