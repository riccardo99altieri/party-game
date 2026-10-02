// Il "passo" dei passanti di Trova l'Intruso: ogni passante sceglie un'attività
// (giro della fontana, coda alla giostra, spesa al mercato, vicolo cieco, pubblico del
// palco, passeggiata) e si muove come farebbe una persona col D-pad: 8 direzioni,
// sempre alla stessa velocità, prima in diagonale e poi dritto, con pause brevi (mai
// più di 2,6 s: chi sta fermo più a lungo non è un passante).
// Lo usano i passanti dello schermo e, per mimetizzarsi, i bot.

import {
  FONTANA,
  GIRO_FONTANA,
  GIOSTRA,
  GIRO_GIOSTRA,
  BANCHI,
  VICOLO,
  PUBBLICO,
  MAPPA,
  ottagono,
  puntoLibero,
  libero,
  dirVerso,
} from './regole.js';

const VERTICI_FONTANA = ottagono(FONTANA, GIRO_FONTANA);
const VERTICI_GIOSTRA = ottagono(GIOSTRA, GIRO_GIOSTRA);
const DAVANTI_BANCHI = BANCHI.flatMap((b) => [
  { x: b.x + b.w / 2, y: b.y + b.h + 24 },
  { x: b.x + b.w / 2, y: b.y - 24 },
]).filter((p) => libero(p.x, p.y, 2));

export const PAUSA_MAX = 2.6;

// Ogni attività: peso, se ci sta nel cerchio sicuro e come si costruisce il piano
// (una lista di tappe { x, y, pausa }).
const ATTIVITA = {
  fontana: {
    peso: 22,
    dentro: (z) => dentroCerchio(z, FONTANA.x, FONTANA.y, GIRO_FONTANA + 20),
    piano: (e, rng) => giro(e, rng, VERTICI_FONTANA, rng() < 0.5 ? 1 : -1, 5 + Math.floor(rng() * 7), 0.12, 0.3, 1),
  },
  giostra: {
    peso: 13,
    dentro: (z) => dentroCerchio(z, GIOSTRA.x, GIOSTRA.y, GIRO_GIOSTRA + 20),
    // alla giostra si gira tutti nello stesso verso (la coda)
    piano: (e, rng) => giro(e, rng, VERTICI_GIOSTRA, 1, 4 + Math.floor(rng() * 6), 0.25, 0.4, 1.2),
  },
  mercato: {
    peso: 15,
    dentro: (z) => DAVANTI_BANCHI.every((p) => dentroCerchio(z, p.x, p.y, 20)),
    piano: (e, rng) => {
      const n = 2 + Math.floor(rng() * 2);
      const scelti = [...DAVANTI_BANCHI].sort(() => rng() - 0.5).slice(0, n);
      return scelti.map((p) => ({ x: p.x + (rng() - 0.5) * 50, y: p.y + (rng() - 0.5) * 8, pausa: 1.2 + rng() * 1.4 }));
    },
  },
  vicolo: {
    peso: 9,
    dentro: (z) => [VICOLO.ingresso, VICOLO.fondo].every((p) => dentroCerchio(z, p.x, p.y, 20)),
    piano: (e, rng) => [
      { ...VICOLO.ingresso, pausa: 0 },
      { x: VICOLO.fondo.x + rng() * 40, y: VICOLO.fondo.y + (rng() - 0.5) * 20, pausa: 0.6 + rng() * 1 },
      { ...VICOLO.ingresso, pausa: rng() < 0.3 ? 0.3 + rng() * 0.6 : 0 },
    ],
  },
  palco: {
    peso: 15,
    dentro: (z) =>
      dentroCerchio(z, PUBBLICO.x0, PUBBLICO.y0, 20) &&
      dentroCerchio(z, PUBBLICO.x1, PUBBLICO.y0, 20) &&
      dentroCerchio(z, PUBBLICO.x0, PUBBLICO.y1, 20) &&
      dentroCerchio(z, PUBBLICO.x1, PUBBLICO.y1, 20),
    piano: (e, rng) => {
      let x = PUBBLICO.x0 + rng() * (PUBBLICO.x1 - PUBBLICO.x0);
      let y = PUBBLICO.y0 + rng() * (PUBBLICO.y1 - PUBBLICO.y0);
      const tappe = [{ x, y, pausa: 1.4 + rng() * 1.2 }];
      // ogni tanto un passo per vedere meglio (sempre più lungo di PASSO_FERMO)
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        let nx = x;
        let ny = y;
        for (let k = 0; k < 8 && Math.hypot(nx - x, ny - y) < 36; k++) {
          const a = rng() * Math.PI * 2;
          const d = 38 + rng() * 34;
          nx = Math.min(PUBBLICO.x1, Math.max(PUBBLICO.x0, x + Math.cos(a) * d));
          ny = Math.min(PUBBLICO.y1, Math.max(PUBBLICO.y0, y + Math.sin(a) * d));
        }
        x = nx;
        y = ny;
        tappe.push({ x, y, pausa: 1 + rng() * 1.4 });
      }
      return tappe;
    },
  },
  passeggio: {
    peso: 26,
    dentro: () => true,
    piano: (e, rng, z) => {
      const n = 1 + Math.floor(rng() * 2);
      const tappe = [];
      for (let i = 0; i < n; i++) {
        const p = puntoLibero(rng, (x, y) => dentroCerchio(z, x, y, 30), 8);
        tappe.push({ x: p.x, y: p.y, pausa: rng() < 0.4 ? 0.3 + rng() * 1.2 : 0 });
      }
      return tappe;
    },
  },
};
const NOMI = Object.keys(ATTIVITA);

function dentroCerchio(z, x, y, margine) {
  if (!z) return x > MAPPA.x0 && x < MAPPA.x1 && y > MAPPA.y0 && y < MAPPA.y1;
  return Math.hypot(x - z.x, y - z.y) < z.r - margine;
}

// Un giro intorno a un ottagono, partendo dal vertice più vicino.
function giro(e, rng, vertici, verso, quanti, pPausa, pMin, pMax) {
  let k = 0;
  let dm = Infinity;
  vertici.forEach((v, i) => {
    const d = Math.hypot(v.x - e.x, v.y - e.y);
    if (d < dm) {
      dm = d;
      k = i;
    }
  });
  const tappe = [];
  for (let i = 0; i < quanti; i++) {
    const v = vertici[(((k + i * verso) % 8) + 8) % 8];
    tappe.push({ x: v.x, y: v.y, pausa: rng() < pPausa ? pMin + rng() * (pMax - pMin) : 0 });
  }
  return tappe;
}

// Stato del passo (uno per passante, o per bot che si mimetizza).
export function creaPasso() {
  return { piano: [], pausa: 0, dir: [0, 0], attivita: null, progT: 0, progD: Infinity, sblocchi: 0 };
}

// Butta via il piano (per esempio: arriva l'acqua, o dopo uno spavento).
export function ripianifica(c) {
  c.piano = [];
  c.pausa = 0;
  c.progT = 0;
  c.progD = Infinity;
  c.sblocchi = 0;
}

// Sceglie una nuova attività dentro la zona z ({ x, y, r } oppure null = tutta la piazza).
export function scegliAttivita(c, e, rng, z) {
  const possibili = NOMI.filter((k) => ATTIVITA[k].dentro(z));
  let tot = 0;
  for (const k of possibili) tot += ATTIVITA[k].peso;
  let v = rng() * tot;
  let scelta = possibili[possibili.length - 1];
  for (const k of possibili) {
    v -= ATTIVITA[k].peso;
    if (v <= 0) {
      scelta = k;
      break;
    }
  }
  c.attivita = scelta;
  c.piano = ATTIVITA[scelta].piano(e, rng, z);
  c.progT = 0;
  c.progD = Infinity;
  c.sblocchi = 0;
}

// La direzione (8 direzioni o ferma) per questo fotogramma. e = { x, y }.
// F = { rng, zona } (zona: il cerchio dove stare, o null).
export function prossimoDir(c, e, dt, F) {
  if (c.pausa > 0) {
    c.pausa -= dt;
    c.dir = [0, 0];
    return c.dir;
  }
  if (!c.piano.length) scegliAttivita(c, e, F.rng, F.zona);
  const p = c.piano[0];
  const d = dirVerso(c.dir, p.x - e.x, p.y - e.y);
  if (!d[0] && !d[1]) {
    // arrivato alla tappa
    c.piano.shift();
    c.pausa = Math.min(PAUSA_MAX, p.pausa || 0);
    c.progT = 0;
    c.progD = Infinity;
    if (!p.lato) c.sblocchi = 0; // dopo un passo di lato si riprova la stessa tappa
    c.dir = [0, 0];
    return c.dir;
  }
  // bloccato (contro un ostacolo o nella calca)? Un passo di lato, poi si rinuncia alla tappa.
  c.progT += dt;
  if (c.progT >= 1) {
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    const prima = c.progD;
    c.progT = 0;
    c.progD = dist;
    if (prima - dist < 22) {
      c.sblocchi++;
      if (c.sblocchi >= 3 || p.lato) {
        c.piano.shift();
        c.sblocchi = 0;
      } else {
        const lato = F.rng() < 0.5 ? 1 : -1;
        const px = -d[1] * lato;
        const py = d[0] * lato;
        c.piano.unshift({ x: e.x + px * 55 - d[0] * 12, y: e.y + py * 55 - d[1] * 12, pausa: 0, lato: true });
        c.progD = Infinity;
      }
    }
  }
  c.dir = d;
  return d;
}
