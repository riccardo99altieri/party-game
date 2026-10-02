// Trova l'Intruso: regole, mappa e numeri condivisi da schermo, telefono, test e banco.
// Le coordinate sono quelle dello schermo grande (1920x1080): la piazza va da MAPPA.x0 a
// MAPPA.x1 e da MAPPA.y0 a MAPPA.y1; sopra c'è la fascia con tempo e messaggi.

import { clamp, lerp } from '../../shared/util.js';

export const ROUND = 3;
export const DURATA = 90; // secondi di un round (al massimo)
export const VEL = 92; // px/s: uguale per giocatori e passanti, anche in diagonale
export const RAGGIO = 13; // ingombro di un personaggio
export const PORTATA = 50; // distanza massima (tra i centri) a cui arriva il pugno
export const CD_PUGNO = 1; // secondi tra un pugno e l'altro
export const T_PUGNO = 0.3; // il pugno: animazione, e chi lo tira resta fermo
export const T_ERRORE = 2; // pugno a un passante: fermo e rosso per 2 s
export const T_STORDITO = 2.4; // il passante colpito resta a terra (poi si rialza)
export const T_FERMO = 3; // dopo 3 s quasi fermi i passanti vicini si incuriosiscono
export const PASSO_FERMO = 30; // "fermo" = non ti sei allontanato di più di così
export const GRAZIA = 5; // nei primi secondi del round i passanti non si incuriosiscono
export const T_ACQUA = 3; // secondi nell'acqua prima di essere portati via
export const T_MONETA = 5; // una moneta resta 5 s
export const PRESA_MONETA = 22;
export const OGNI_TICK = 10; // +1 ogni 10 s in vita
export const PODIO_DA = 6; // il bonus "tra gli ultimi 3" vale da 6 giocatori in su

export const PUNTI = { tick: 1, moneta: 1, kill: 3, vivo: 2, ultimo: 5, podio: 2, errore: -1 };

// Quanti passanti e quante monete secondo i giocatori.
export function config(n) {
  if (n <= 6) return { npc: 40, ogni: 8, monete: 2 };
  if (n <= 11) return { npc: 60, ogni: 8, monete: 3 };
  return { npc: 80, ogni: 6, monete: 4 };
}

// Punti di un round a partire dalle sue voci.
export function puntiRound(r) {
  return r.tick * PUNTI.tick + r.monete * PUNTI.moneta + r.kill * PUNTI.kill + r.errori * PUNTI.errore + r.vivo + r.ultimo + r.podio;
}

export const nuoveVoci = () => ({ tick: 0, monete: 0, kill: 0, errori: 0, vivo: 0, ultimo: 0, podio: 0 });

// ---------------------------------------------------------------------------
// La piazza

export const MAPPA = { x0: 60, y0: 120, x1: 1860, y1: 1050 };
export const LARGA = MAPPA.x1 - MAPPA.x0;
export const ALTA = MAPPA.y1 - MAPPA.y0;

export const FONTANA = { x: 960, y: 600, r: 78 };
export const GIRO_FONTANA = 140;
export const GIOSTRA = { x: 1560, y: 330, r: 100 };
export const GIRO_GIOSTRA = 162;
export const BANCHI = [
  { x: 150, y: 205, w: 150, h: 44, colore: '#e11d48' },
  { x: 390, y: 205, w: 150, h: 44, colore: '#16a34a' },
  { x: 150, y: 375, w: 150, h: 44, colore: '#2563eb' },
  { x: 390, y: 375, w: 150, h: 44, colore: '#f59e0b' },
];
// Il vicolo cieco: un corridoio tra due file di case, aperto solo a destra.
export const VICOLO = {
  muri: [
    { x: 60, y: 760, w: 470, h: 92 },
    { x: 60, y: 938, w: 470, h: 112 },
  ],
  ingresso: { x: 568, y: 895 },
  mezzo: { x: 330, y: 895 },
  fondo: { x: 92, y: 895 },
};
export const PALCO = { x: 1430, y: 935, w: 380, h: 115 };
export const PUBBLICO = { x0: 1450, y0: 790, x1: 1790, y1: 900 };
export const LAMPIONI = [
  { x: 730, y: 320, r: 12 },
  { x: 1190, y: 320, r: 12 },
  { x: 730, y: 880, r: 12 },
  { x: 1190, y: 880, r: 12 },
];

export const CERCHI = [FONTANA, GIOSTRA, ...LAMPIONI];
export const RETTANGOLI = [...BANCHI, ...VICOLO.muri, PALCO];

// Spinge un personaggio fuori dagli ostacoli e dentro la piazza.
export function spingiFuori(e) {
  for (const c of CERCHI) {
    const dx = e.x - c.x;
    const dy = e.y - c.y;
    const d = Math.hypot(dx, dy);
    const min = c.r + RAGGIO;
    if (d >= min) continue;
    if (d < 1e-6) {
      e.y = c.y - min;
      continue;
    }
    e.x = c.x + (dx / d) * min;
    e.y = c.y + (dy / d) * min;
  }
  for (const r of RETTANGOLI) {
    const px = clamp(e.x, r.x, r.x + r.w);
    const py = clamp(e.y, r.y, r.y + r.h);
    const dx = e.x - px;
    const dy = e.y - py;
    const d = Math.hypot(dx, dy);
    if (d >= RAGGIO) continue;
    if (d > 1e-6) {
      e.x = px + (dx / d) * RAGGIO;
      e.y = py + (dy / d) * RAGGIO;
    } else {
      // il centro è dentro: fuori dal lato più vicino
      const lati = [
        [e.x - r.x, -1, 0],
        [r.x + r.w - e.x, 1, 0],
        [e.y - r.y, 0, -1],
        [r.y + r.h - e.y, 0, 1],
      ].sort((a, b) => a[0] - b[0]);
      const [dist, sx, sy] = lati[0];
      e.x += sx * (dist + RAGGIO);
      e.y += sy * (dist + RAGGIO);
    }
  }
  e.x = clamp(e.x, MAPPA.x0 + RAGGIO, MAPPA.x1 - RAGGIO);
  e.y = clamp(e.y, MAPPA.y0 + RAGGIO, MAPPA.y1 - RAGGIO);
}

// C'è posto per un personaggio in (x, y)? (con un margine in più)
export function libero(x, y, margine = 0) {
  const m = RAGGIO + margine;
  if (x < MAPPA.x0 + m || x > MAPPA.x1 - m || y < MAPPA.y0 + m || y > MAPPA.y1 - m) return false;
  for (const c of CERCHI) if (Math.hypot(x - c.x, y - c.y) < c.r + m) return false;
  for (const r of RETTANGOLI) {
    const px = clamp(x, r.x, r.x + r.w);
    const py = clamp(y, r.y, r.y + r.h);
    if (Math.hypot(x - px, y - py) < m) return false;
  }
  return true;
}

// Un punto libero a caso, che rispetta `ok(x, y)` (se possibile).
export function puntoLibero(rng, ok = () => true, margine = 6) {
  for (let i = 0; i < 200; i++) {
    const x = MAPPA.x0 + rng() * LARGA;
    const y = MAPPA.y0 + rng() * ALTA;
    if (libero(x, y, margine) && ok(x, y)) return { x, y };
  }
  for (let i = 0; i < 200; i++) {
    const x = MAPPA.x0 + rng() * LARGA;
    const y = MAPPA.y0 + rng() * ALTA;
    if (libero(x, y, margine)) return { x, y };
  }
  return { x: FONTANA.x, y: FONTANA.y - FONTANA.r - 40 };
}

// I vertici del giro intorno a un cerchio: un ottagono girato di 22,5°, così ogni lato
// va in una delle 8 direzioni del D-pad (si può imitare alla perfezione).
export function ottagono(c, r) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

// ---------------------------------------------------------------------------
// L'acqua alta: da 60 s la zona sicura (un cerchio) si restringe a scatti.

export const ZONA = {
  annuncio: 55, // da qui si vede il cerchio successivo (tratteggiato)
  passi: [
    [60, 64],
    [70, 74],
    [80, 84],
  ],
  scala: [1.7, 1.3, 1], // raggi dei tre cerchi rispetto a quello finale
};
// Il cerchio finale copre circa un quarto della piazza.
export const R_FINALE = Math.round(Math.sqrt((LARGA * ALTA) / 4 / Math.PI));

export function pianoZona(rng) {
  const cx = 640 + rng() * 640;
  const cy = 500 + rng() * 170;
  const angoli = [
    [MAPPA.x0, MAPPA.y0],
    [MAPPA.x1, MAPPA.y0],
    [MAPPA.x0, MAPPA.y1],
    [MAPPA.x1, MAPPA.y1],
  ];
  const r0 = Math.max(...angoli.map(([x, y]) => Math.hypot(x - cx, y - cy))) + 40;
  return { cx, cy, raggi: [r0, ...ZONA.scala.map((k) => Math.round(R_FINALE * k))] };
}

const liscio = (k) => k * k * (3 - 2 * k);

// Raggio della zona sicura al secondo t del round.
export function raggioZona(piano, t) {
  const { raggi } = piano;
  for (let i = 0; i < ZONA.passi.length; i++) {
    const [a, b] = ZONA.passi[i];
    if (t <= a) return raggi[i];
    if (t < b) return lerp(raggi[i], raggi[i + 1], liscio((t - a) / (b - a)));
  }
  return raggi[raggi.length - 1];
}

// Il prossimo cerchio, se è già stato annunciato (altrimenti null).
export function prossimoRaggio(piano, t) {
  if (t < ZONA.annuncio) return null;
  for (let i = 0; i < ZONA.passi.length; i++) if (t < ZONA.passi[i][1]) return piano.raggi[i + 1];
  return null;
}

// Quale passo di restringimento è in arrivo (0, 1, 2) o in corso; -1 prima dell'annuncio.
export function passoZona(t) {
  if (t < ZONA.annuncio) return -1;
  for (let i = 0; i < ZONA.passi.length; i++) if (t < ZONA.passi[i][1]) return i;
  return ZONA.passi.length;
}

// Il cerchio verso cui conviene stare: il prossimo se annunciato, se no quello attuale.
export function zonaObiettivo(piano, t) {
  const r = prossimoRaggio(piano, t) ?? raggioZona(piano, t);
  return { x: piano.cx, y: piano.cy, r };
}

// ---------------------------------------------------------------------------
// Movimento a 8 direzioni

// Direzione del D-pad per andare verso (dx, dy): prima in diagonale, poi dritto (come
// fa chiunque col D-pad). `attuale` dà un po' di isteresi, così non si trema sul confine.
export function dirVerso(attuale, dx, dy) {
  const sx = Math.abs(dx) > (attuale && attuale[0] ? 3 : 9) ? Math.sign(dx) : 0;
  const sy = Math.abs(dy) > (attuale && attuale[1] ? 3 : 9) ? Math.sign(dy) : 0;
  return [sx, sy];
}

// Spostamento in un passo di tempo: la diagonale va alla stessa velocità del dritto.
export function spostamento(dir, dt) {
  const [sx, sy] = dir;
  if (!sx && !sy) return [0, 0];
  const k = sx && sy ? Math.SQRT1_2 : 1;
  return [sx * k * VEL * dt, sy * k * VEL * dt];
}
