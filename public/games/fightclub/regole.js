// Fight Club: regole "pure" (niente disegno): calendario dei duelli, cursore dei
// gladiatori, tifo del pubblico e punti. Le usano lo schermo, i telefoni e i test.
//
// Il cursore va avanti e indietro su una barra da 0 a 1 (onda a triangolo): la sua
// "fase" f cresce con la velocità e la posizione è tri(f). Il telefono del gladiatore
// è l'arbitro dei suoi tocchi (niente ritardi di rete); lo schermo li riceve e li mostra.

import { clamp } from '../../shared/util.js';

export const TEMPI = { scommessa: 4, esito: 3.5 };
export const MANCATO = 0.6; // secondi di blocco dopo un tocco fuori dalla zona
export const RAFFICA = 0.15; // due colpi non possono essere più vicini di così

// I tre duelli. Il tifo (h da 0 a 1) aiuta il gladiatore:
// Colpo Secco: il mirino rallenta; Braccio di Ferro e Taglio della Legna: la zona verde
// si allarga e i colpi sono più forti (lì un cursore lento farebbe solo perdere tempo).
export const MODI = {
  colpo: {
    nome: 'Colpo Secco',
    emoji: '🎯',
    durata: 6,
    vel: 1.7,
    rallenta: 0.4,
    regola: 'Un colpo solo: tocca quando il mirino è più vicino possibile al centro',
  },
  braccio: {
    nome: 'Braccio di Ferro',
    emoji: '💪',
    durata: 8,
    vel: 1.4,
    zona: 0.075,
    allarga: 0.35,
    forte: 0.1,
    spinta: 0.2,
    regola: 'Tocca quando il cursore è nel verde: ogni colpo spinge il braccio. Fuori dal verde resti bloccato',
  },
  legna: {
    nome: 'Taglio della Legna',
    emoji: '🪓',
    durata: 8,
    vel: 1.3,
    zona: 0.11,
    allarga: 0.35,
    forte: 0.1,
    taglio: 0.18,
    regola: 'Tocca quando il cursore è nel verde: più sei al centro, più è profondo il colpo d\'ascia',
  },
};
export const ORDINE_MODI = ['colpo', 'braccio', 'legna'];

// Tifo: tocchi al secondo (media su ~0,8 s). La barra è piena con 6 tocchi al secondo
// per ogni persona di metà pubblico (almeno una): se il pubblico si divide a metà e
// tutti tappano forte, le due barre sono piene.
export const TIFO = { tau: 0.8, perPersona: 6 };
export const capienza = (nPubblico) => TIFO.perPersona * Math.max(1, nPubblico / 2);

// Punti di un duello.
export const PUNTI = { vittoria: 4, sconfitta: -1, miracolo: 2, scommessa: 2, quotaAlta: 3 };

// ---------------------------------------------------------------------------
// Calendario

// Quanti duelli: vicino a 8, ma in modo che tutti combattano lo stesso numero di volte
// (2 × duelli divisibile per i giocatori). Se non si può (13 e 15 giocatori) si resta a 8.
export function numeroDuelli(n) {
  let migliore = 8;
  let scarto = Infinity;
  for (let d = 6; d <= 12; d++) {
    if ((2 * d) % n) continue;
    const s = Math.abs(d - 8);
    if (s < scarto || (s === scarto && d > migliore)) {
      migliore = d;
      scarto = s;
    }
  }
  return migliore;
}

// Coppie dei duelli: prima chi ha combattuto meno, poi le coppie che si sono sfidate
// meno volte, poi chi non era nel duello appena finito (in 4 si rischiava di rivedere sempre
// le stesse due coppie). I conti restano pari (al massimo uno di differenza), quindi alla
// fine tutti hanno combattuto lo stesso numero di volte.
export function calendario(ids, quanti = numeroDuelli(ids.length), rnd = Math.random) {
  const volte = new Map(ids.map((id) => [id, 0]));
  const incontri = new Map();
  const chiave = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const duelli = [];
  let prima = [];
  const primoModo = Math.floor(rnd() * ORDINE_MODI.length);
  for (let i = 0; i < quanti; i++) {
    const caso = new Map(ids.map((id) => [id, rnd()]));
    const peso = (id, altro) => volte.get(id) * 100 + (prima.includes(id) ? 10 : 0) + (altro ? 15 * (incontri.get(chiave(id, altro)) || 0) : 0) + caso.get(id);
    const a = [...ids].sort((x, y) => peso(x) - peso(y))[0];
    const b = ids.filter((id) => id !== a).sort((x, y) => peso(x, a) - peso(y, a))[0];
    volte.set(a, volte.get(a) + 1);
    volte.set(b, volte.get(b) + 1);
    incontri.set(chiave(a, b), (incontri.get(chiave(a, b)) || 0) + 1);
    // a sinistra o a destra a caso
    duelli.push(rnd() < 0.5 ? { a, b } : { a: b, b: a });
    prima = [a, b];
  }
  // i modi girano in ordine, così si vedono tutti e tre
  duelli.forEach((d, i) => (d.modo = ORDINE_MODI[(primoModo + i) % ORDINE_MODI.length]));
  return duelli;
}

// ---------------------------------------------------------------------------
// Cursore

export function tri(f) {
  const m = ((f % 2) + 2) % 2;
  return m <= 1 ? m : 2 - m;
}

// Quanta fase manca perché il cursore passi da x (andando avanti dalla fase f).
export function faseVerso(f, x) {
  const m = ((f % 2) + 2) % 2;
  let meglio = Infinity;
  for (const c of [x, 2 - x]) {
    let d = c - m;
    if (d < 0) d += 2;
    if (d < meglio) meglio = d;
  }
  return meglio;
}

export const velocita = (modo, h) => MODI[modo].vel * (1 - (MODI[modo].rallenta || 0) * clamp(h, 0, 1));
export const larghezza = (modo, h) => (MODI[modo].zona || 0) * (1 + (MODI[modo].allarga || 0) * clamp(h, 0, 1));
export const forza = (modo, h) => 1 + (MODI[modo].forte || 0) * clamp(h, 0, 1);

// Tocco nella zona: qualità da 0 (bordo) a 1 (centro), oppure null se fuori.
export function qualita(x, z, w) {
  const d = Math.abs(x - z);
  return d <= w ? 1 - d / w : null;
}

// Zone dei colpi: una sequenza dal seme, uguale per i due gladiatori (duello alla pari).
// Se la prossima zona è troppo vicina al cursore la si sposta, così non si colpisce a raffica.
export function zonaDaSeme(seme, k) {
  let a = (seme ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) >>> 0;
  a = (a ^ (a >>> 16)) >>> 0;
  return 0.14 + (a / 4294967296) * 0.72;
}
export function prossimaZona(seme, k, x) {
  const z = zonaDaSeme(seme, k);
  if (Math.abs(z - x) >= 0.25) return z;
  return clamp(z < 0.5 ? z + 0.4 : z - 0.4, 0.12, 0.88);
}

// Effetto di un colpo nella zona: spinta nel Braccio di Ferro, taglio nella Legna.
export const spinta = (q, h) => MODI.braccio.spinta * (0.7 + 0.3 * q) * forza('braccio', h);
export const taglio = (q, h) => MODI.legna.taglio * (0.5 + 0.5 * q) * forza('legna', h);

// Precisione del Colpo Secco in % (100 = centro perfetto).
export const precisione = (x) => Math.round((1 - 2 * Math.abs(x - 0.5)) * 100);

// ---------------------------------------------------------------------------
// Punti

// d: { a, b, vincitore (id o null), tifo: [a, b] (tocchi ricevuti), scommesse: { id: 0 | 1 } }
// Restituisce { punti: { id: delta }, miracolo, quotaAlta: lato in minoranza (0, 1 o null) }.
export function puntiDuello(d) {
  const punti = {};
  const lato = d.vincitore === d.a ? 0 : d.vincitore === d.b ? 1 : null;
  const quanti = [0, 0];
  for (const s of Object.values(d.scommesse)) quanti[s]++;
  // chi punta sul gladiatore con meno scommesse rischia di più (e ha meno tifo): +3
  const quotaAlta = quanti[0] < quanti[1] ? 0 : quanti[1] < quanti[0] ? 1 : null;
  if (lato == null) {
    punti[d.a] = 0;
    punti[d.b] = 0;
    for (const id of Object.keys(d.scommesse)) punti[id] = 0;
    return { punti, miracolo: false, quotaAlta };
  }
  const vince = lato === 0 ? d.a : d.b;
  const perde = lato === 0 ? d.b : d.a;
  const miracolo = d.tifo[lato] < d.tifo[1 - lato];
  punti[vince] = PUNTI.vittoria + (miracolo ? PUNTI.miracolo : 0);
  punti[perde] = PUNTI.sconfitta;
  for (const [id, s] of Object.entries(d.scommesse)) punti[id] = s === lato ? (lato === quotaAlta ? PUNTI.quotaAlta : PUNTI.scommessa) : 0;
  return { punti, miracolo, quotaAlta };
}
