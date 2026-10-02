// Binari e regole di Mani Incrociate, condivisi da schermo, telefoni e CPU.
//
// Il percorso è lungo LUNGHEZZA "schermi": 1 unità = l'altezza del telefono. Sul telefono
// i binari scorrono verso il basso; la linea dei pollici (RIF, frazione dell'altezza dal
// alto) è la posizione s del giocatore, sopra si vede il pezzo che sta arrivando.
// La x dei binari è una frazione della larghezza del telefono: [rosso, blu].

import { clamp, lerp, seeded } from '../../shared/util.js';

export const LUNGHEZZA = 26;
export const RIF = 0.72; // linea dei pollici e dei cerchi di partenza
export const COMODO = [0.28, 0.72]; // dove ripartono i binari dopo un errore
export const PAUSA = 1.5; // secondi fermi dopo un errore
export const GRAZIA = 0.12; // secondi fuori dal binario tollerati (tremolio del tocco)
export const TOLLERANZA = 1.1; // il pollice conta "sopra" fino a 1,1 mezze larghezze
export const DURATA = 120;
export const DOPO_PRIMO = 15; // secondi concessi dopo il primo arrivo
export const COMBO_MAX = 1.5;
export const MIN_SEP = 0.26; // distanza minima tra i binari quando non si incrociano
export const COLORI = ['#ff3b5c', '#3b8cff'];

// Più si resiste senza errori più si corre (fino a ×1,5 dopo 12,5 s puliti).
export const combo = (pulito) => 1 + Math.min(COMBO_MAX - 1, Math.max(0, pulito) * 0.04);
// Velocità di scorrimento in schermi al secondo: cresce un po' lungo il percorso.
export const velocita = (s, c = 1) => (0.32 + 0.12 * clamp(s / LUNGHEZZA, 0, 1)) * c;
// Mezza larghezza del binario (frazione della larghezza): si stringe lungo il percorso.
export const semiLarghezza = (c) => lerp(0.12, 0.085, clamp(c / LUNGHEZZA, 0, 1));

const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// Inviluppo delle onde: parte e finisce a zero senza strappi.
const inviluppo = (u) => ss(Math.min(1, u * 4, (1 - u) * 4));

// Le figure del percorso: nome per il telefono e ostacolo per la TV.
export const FIGURE = {
  specchio: { nome: '🦋 SPECCHIO', ostacolo: 'coni' },
  apri: { nome: '↔ ALLARGA', ostacolo: 'pozza' },
  stringi: { nome: '→← STRINGI', ostacolo: 'cancello' },
  parallela: { nome: '〰 ONDA', ostacolo: 'balla' },
  zigzag: { nome: '⚡ ZIG-ZAG', ostacolo: 'coni' },
  incrocio: { nome: '✖ INCROCIO!', ostacolo: 'ostacolo' },
  largo: { nome: '🤞 SUPER INCROCIO!', ostacolo: 'ostacolo' },
  caos: { nome: '🌀 CAOS', ostacolo: 'gomme' },
  scambio: { nome: '✖ INCROCIO + ONDA', ostacolo: 'ostacolo' },
};

export const INCROCI = ['incrocio', 'largo', 'scambio'];

// Crea il percorso di una partita dal seme: stesse figure ovunque.
// Restituisce { segmenti, figure: [{ tipo, s0, s1 }], ostacoli: [{ s, tipo }], pos, fine }.
export function creaPista(seme) {
  const rng = seeded((seme || 1) * 13 + 5);
  const seg = [];
  const figure = [];
  const ostacoli = [];
  let s = 0;
  let r = COMODO[0];
  let b = COMODO[1];

  // Un tratto: fn(u) -> [r, b] con u in [0, 1]; deve partire da dove finisce il precedente.
  function tratto(len, fn) {
    seg.push({ s0: s, s1: s + len, fn });
    [r, b] = fn(1);
    s += len;
  }
  function vai(r1, b1, len) {
    const r0 = r;
    const b0 = b;
    tratto(len, (u) => [lerp(r0, r1, ss(u)), lerp(b0, b1, ss(u))]);
  }
  const resta = (len) => {
    const r0 = r;
    const b0 = b;
    tratto(len, () => [r0, b0]);
  };
  // Onde attorno alla posizione attuale: ampiezze e giri per ogni binario.
  function onda(len, aR, gR, aB, gB, faseB = 0) {
    const r0 = r;
    const b0 = b;
    tratto(len, (u) => {
      const e = inviluppo(u);
      return [r0 + aR * e * Math.sin(Math.PI * 2 * gR * u), b0 + aB * e * Math.sin(Math.PI * 2 * gB * u + faseB)];
    });
  }
  // Zig-zag di un binario solo (onda triangolare smussata), l'altro fermo.
  function zigzag(len, j, amp, giri) {
    const r0 = r;
    const b0 = b;
    tratto(len, (u) => {
      const e = inviluppo(u);
      const f = (u * giri) % 1;
      const tri = f < 0.25 ? f * 4 : f < 0.75 ? 2 - f * 4 : f * 4 - 4;
      const z = Math.sin((tri * Math.PI) / 2) * amp * e;
      return j === 0 ? [r0 + z, b0] : [r0, b0 + z];
    });
  }

  // Ogni figura parte e finisce con i binari nella posizione comoda.
  const FAI = {
    specchio(d) {
      // si aprono verso i bordi e si richiudono verso il centro (movimento a specchio: facile);
      // verso il centro meno, così i pollici non si toccano
      const r0 = r;
      const b0 = b;
      const fuori = 0.16;
      const dentro = (b0 - r0 - MIN_SEP) / 2;
      tratto(lerp(2.2, 1.5, d), (u) => {
        const o = Math.sin(Math.PI * 3 * u) * inviluppo(u);
        const a = o > 0 ? fuori * o : dentro * o;
        return [r0 - a, b0 + a];
      });
    },
    apri(d) {
      const T = lerp(0.7, 0.45, d);
      vai(0.12, 0.88, T); // non fino al bordo: tanti telefoni ignorano i tocchi sul bordo
      resta(lerp(0.5, 0.35, d));
      vai(COMODO[0], COMODO[1], T);
    },
    stringi(d) {
      const T = lerp(0.7, 0.45, d);
      const c = 0.5 + rng.range(-0.08, 0.08);
      vai(c - 0.135, c + 0.135, T);
      resta(lerp(0.5, 0.35, d));
      vai(COMODO[0], COMODO[1], T);
    },
    parallela(d) {
      // tutti e due dalla stessa parte: le mani vogliono andare a specchio, qui no
      const A = 0.17;
      onda(lerp(2.4, 1.6, d), A, 2, A, 2);
    },
    zigzag(d) {
      const j = rng.next() < 0.5 ? 0 : 1;
      zigzag(lerp(2.2, 1.5, d), j, j === 0 ? -0.16 : 0.16, 3);
    },
    incrocio(d) {
      const T = lerp(0.75, 0.45, d);
      vai(COMODO[1], COMODO[0], T);
      resta(lerp(0.7, 0.4, d));
      vai(COMODO[0], COMODO[1], T);
    },
    largo(d) {
      // incrociati E larghi: il pollice sinistro sul bordo destro e viceversa
      const T = lerp(0.75, 0.5, d);
      vai(0.86, 0.14, T * 1.3);
      resta(lerp(0.55, 0.35, d));
      vai(COMODO[0], COMODO[1], T * 1.3);
    },
    caos(d) {
      // ogni binario per conto suo, a ritmi diversi (come battere la testa e girare la pancia)
      const T = lerp(0.5, 0.35, d);
      vai(0.23, 0.77, T);
      const A = Math.min(0.12, (b - r - MIN_SEP) / 2);
      onda(lerp(2.2, 1.6, d), A, 2, A, 3, rng.range(0, Math.PI));
      vai(COMODO[0], COMODO[1], T);
    },
    scambio(d) {
      const T = lerp(0.7, 0.45, d);
      vai(COMODO[1], COMODO[0], T);
      onda(lerp(1.5, 1.1, d), 0.15, 1.5, 0.15, 1.5);
      vai(COMODO[0], COMODO[1], T);
    },
  };

  function figura(tipo, d) {
    const s0 = s;
    FAI[tipo](d);
    figure.push({ tipo, s0, s1: s });
    // ostacoli sulla TV: uno per ogni incrocio, uno a metà delle altre figure
    if (INCROCI.includes(tipo)) {
      const a = seg.find((x) => x.s0 >= s0 - 1e-9);
      const z = seg[seg.length - 1];
      ostacoli.push({ s: (a.s0 + a.s1) / 2, tipo: FIGURE[tipo].ostacolo });
      ostacoli.push({ s: (z.s0 + z.s1) / 2, tipo: FIGURE[tipo].ostacolo });
    } else ostacoli.push({ s: (s0 + s) / 2, tipo: FIGURE[tipo].ostacolo });
  }

  // Quali figure a che punto del percorso (d = quanto si è avanti, da 0 a 1).
  function pesca(d, prima, secco) {
    // dopo due figure senza incroci, gli incroci diventano molto più probabili
    const x2 = secco >= 2 ? 2.5 : 1;
    const pool = [
      ['specchio', d < 0.5 ? 1.2 : 0.5],
      ['apri', 1.3],
      ['stringi', 1],
      ['parallela', 1.3],
      ['incrocio', 2.2 * x2],
      ['zigzag', d > 0.2 ? 1.3 : 0],
      ['largo', d > 0.4 ? 1.6 * x2 : 0],
      ['caos', d > 0.45 ? 1.3 : 0],
      ['scambio', d > 0.55 ? 1.3 * x2 : 0],
    ].filter(([t, p]) => p > 0 && t !== prima);
    const tot = pool.reduce((a, [, p]) => a + p, 0);
    let x = rng.next() * tot;
    for (const [t, p] of pool) {
      x -= p;
      if (x <= 0) return t;
    }
    return pool[pool.length - 1][0];
  }

  // Quanto è lunga una figura (la si prova e poi si cancella).
  function misura(tipo, d) {
    const salva = { s, r, b, n: seg.length };
    FAI[tipo](d);
    const len = s - salva.s;
    seg.length = salva.n;
    s = salva.s;
    r = salva.r;
    b = salva.b;
    return len;
  }

  resta(1.2); // partenza comoda
  // l'inizio è sempre gentile: prima un movimento a specchio, poi il primo incrocio lento
  figura(rng.next() < 0.5 ? 'specchio' : 'apri', 0);
  resta(0.7);
  figura('incrocio', 0.05);
  // gran finale: una figura cattiva che si chiude proprio sul traguardo
  const finale = rng.next() < 0.5 ? 'largo' : 'caos';
  const lenFinale = misura(finale, 1);
  const FINE_FIGURE = LUNGHEZZA - 0.25;
  let prima = 'incrocio';
  let secco = 0; // figure di fila senza incroci
  for (;;) {
    const d = s / LUNGHEZZA;
    resta(lerp(0.75, 0.3, d));
    const tipo = pesca(d, prima, secco);
    if (s + misura(tipo, d) + 0.3 + lenFinale > FINE_FIGURE) break;
    figura(tipo, d);
    prima = tipo;
    secco = INCROCI.includes(tipo) ? 0 : secco + 1;
  }
  // il buco rimasto si riempie con figure corte, così non c'è un lungo rettilineo
  for (const tipo of ['stringi', 'apri', 'stringi']) {
    if (FINE_FIGURE - lenFinale - s < misura(tipo, 1) + 0.35 || tipo === prima) continue;
    figura(tipo, 1);
    resta(0.3);
    prima = tipo;
  }
  const buco = FINE_FIGURE - lenFinale - s;
  if (buco > 0) resta(buco);
  figura(finale, 1);
  resta(LUNGHEZZA + 2 - s);

  const fine = s;
  // Posizione dei binari [rosso, blu] al punto c del percorso. Dopo un errore (sReset)
  // i binari ripartono comodi e tornano sul percorso poco alla volta.
  function pos(c, sReset = 0) {
    let lo = 0;
    let hi = seg.length - 1;
    if (c <= 0) return [COMODO[0], COMODO[1]];
    if (c >= fine) {
      const [rr, bb] = seg[hi].fn(1);
      return mescola(rr, bb, c, sReset);
    }
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (seg[m].s1 <= c) lo = m + 1;
      else hi = m;
    }
    const x = seg[lo];
    const [rr, bb] = x.fn((c - x.s0) / (x.s1 - x.s0));
    return mescola(rr, bb, c, sReset);
  }
  function mescola(rr, bb, c, sReset) {
    if (!(sReset > 0)) return [rr, bb];
    const k = ss((c - sReset - 0.45) / 1);
    if (k >= 1) return [rr, bb];
    return [lerp(COMODO[0], rr, k), lerp(COMODO[1], bb, k)];
  }

  return { segmenti: seg, figure, ostacoli, pos, fine };
}

// Distanza (px) del punto (x, y) dal centro del binario j, su un telefono w x h dove la
// linea dei pollici è alla posizione s. Guarda anche un po' sopra e sotto il punto, così
// nei tratti obliqui conta la distanza vera e non quella in orizzontale.
// Restituisce { d, semi } (semi = mezza larghezza del binario in px).
export function distanza(pista, j, x, y, s, sReset, w, h) {
  const c = s + (RIF * h - y) / h;
  const semi = semiLarghezza(c) * w;
  const passo = (semi * 1.6) / h / 4;
  let d = Infinity;
  for (let k = -4; k <= 4; k++) {
    const cc = c + passo * k;
    const bx = pista.pos(cc, sReset)[j] * w;
    const by = RIF * h - (cc - s) * h;
    const dd = Math.hypot(bx - x, by - y);
    if (dd < d) d = dd;
  }
  return { d, semi };
}
