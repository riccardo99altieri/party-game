// Il Polpo: regole "pure" (niente disegno), usate dallo schermo, dai test e dal banco.
// Coordinate dello schermo 1920×1080: si nuota da sinistra (partenza) a destra (traguardo).

import { clamp, seeded, fmtNum } from '../../shared/util.js';

export const DURATA = 60;
// Zona di gioco: dalla linea di partenza al traguardo, tra la superficie e la sabbia.
export const ARENA = { partenza: 150, traguardo: 1770, y0: 118, y1: 836 };
export const LUNGHEZZA = ARENA.traguardo - ARENA.partenza;
// Mappa-mirino del telefono del Polpo: questo rettangolo diventa [0, 1] × [0, 1].
export const MAPPA = { x0: 40, x1: 1880, y0: ARENA.y0, y1: ARENA.y1 };
export const SPESSORE_MURO = 26; // muro di roccia tra due corsie

// raggio: quanto è largo il colpo (px, a scala 1). Colpisce chi ci ha dentro almeno una
// parte del corpo: chi guarda il mirino e si sposta in tempo può ancora uscirne.
export const POTERI = {
  tentacolo: { nome: 'Tentacolo', emoji: '🐙', costo: 1, cd: 3, tell: 0.5, raggio: 44 },
  medusa: { nome: 'Medusa', emoji: '🪼', costo: 2, cd: 5, tell: 1, raggio: 34 },
  spinta: { nome: 'Spinta', emoji: '💨', costo: 2, cd: 6, tell: 1, raggio: 60 },
  inversione: { nome: 'Inversione', emoji: '🌀', costo: 3, cd: 10, tell: 1.5, raggio: 70 },
  marea: { nome: 'Marea', emoji: '🌊', costo: 4, cd: 0, tell: 2.5, unaVolta: true },
};
export const ORDINE_POTERI = ['tentacolo', 'medusa', 'spinta', 'inversione', 'marea'];

// Durate degli effetti (secondi) e spinte (frazione del percorso).
export const EFFETTI = {
  presa: 2,
  immune: 1.5, // dopo il tentacolo non si può essere riafferrati subito
  lento: 2,
  rallenta: 0.5,
  invertito: 3,
  spinta: 0.2,
  marea: 0.15,
  corallo: 1,
  scatto: 2,
  cdScatto: 5, // dalla fine dello scatto
};

// Quanti Polpi e quanto sono forti, in base al numero totale di giocatori.
export function configPolpo(n) {
  const polpi = n >= 10 ? 2 : 1;
  const potenziato = (n >= 7 && n <= 9) || n >= 13;
  const pesciPerPolpo = (n - polpi) / polpi;
  return {
    polpi,
    potenziato,
    // bolle = prese di tentacolo che un pesce sopporta prima di essere catturato. Un Polpo
    // lancia un tentacolo ogni 3 s: se ha pochi pesci da inseguire li prenderebbe tutti,
    // quindi le bolle sono di più (misure in test/bench/polpo.mjs)
    bolle: pesciPerPolpo <= 2 ? 3 : 2,
    energiaMax: potenziato ? 8 : 6,
    ricarica: potenziato ? 2.5 : 3,
    presiTentacolo: potenziato ? 2 : 1,
    maxMeduse: n > 12 ? 3 : 2,
    corsie: n >= 10 ? 3 : 1,
    // arena "più grande" = zoom indietro: pesci e poteri più piccoli, stessa gara
    scala: n >= 10 ? 0.72 : n >= 6 ? 0.85 : 1,
  };
}

// Chi fa il Polpo. Con una classifica (torneo) tocca a chi ha meno punti, la rivincita;
// a parità (o senza classifica) a chi l'ha fatto meno volte, poi a caso.
// `escludi`: chi non può essere scelto (serve a "Cambia Polpo").
// Restituisce { id: 'polpo' | 'pesce' }.
export function scegliRuoli(giocatori, { punti = null, volte = {}, escludi = [], caso = Math.random } = {}) {
  const quanti = Math.min(configPolpo(giocatori.length).polpi, Math.max(0, giocatori.length - 1));
  const via = new Set(escludi);
  let candidati = giocatori.filter((p) => !via.has(p.id));
  if (candidati.length < quanti) candidati = [...giocatori];
  const sorte = new Map(candidati.map((p) => [p.id, caso()]));
  candidati.sort(
    (a, b) =>
      (punti ? (punti[a.id] || 0) - (punti[b.id] || 0) : 0) ||
      (volte[a.id] || 0) - (volte[b.id] || 0) ||
      sorte.get(a.id) - sorte.get(b.id),
  );
  const polpi = new Set(candidati.slice(0, quanti).map((p) => p.id));
  const ruoli = {};
  for (const p of giocatori) ruoli[p.id] = polpi.has(p.id) ? 'polpo' : 'pesce';
  return ruoli;
}

// Corsie (fasce orizzontali). Con 3 corsie ci sono due muri di roccia in mezzo.
export function corsie(quante) {
  const h = (ARENA.y1 - ARENA.y0 - (quante - 1) * SPESSORE_MURO) / quante;
  return Array.from({ length: quante }, (_, i) => {
    const y0 = ARENA.y0 + i * (h + SPESSORE_MURO);
    return { y0, y1: y0 + h };
  });
}

// Scogli e correnti. Il disegno è lo stesso in ogni corsia (giusto per tutti) e lascia
// sempre un passaggio: in ogni "colonna" gli scogli coprono al massimo una parte dell'altezza.
export function generaFondale(seme, quante = 1) {
  const r = seeded(seme);
  const lista = corsie(quante);
  const h = lista[0].y1 - lista[0].y0;
  const una = quante === 1;
  const colonne = una ? 6 : 5;
  const x0 = ARENA.partenza + 190;
  const x1 = ARENA.traguardo - 170;
  const passo = (x1 - x0) / (colonne - 1);
  // modello in coordinate relative alla corsia: x assoluta, v = frazione dell'altezza
  const modello = [];
  for (let c = 0; c < colonne; c++) {
    const x = x0 + c * passo + r.range(-0.18, 0.18) * passo;
    if (una && r.next() < 0.55) {
      // due scogli, uno in alto e uno in basso, con un varco in mezzo
      const varco = r.range(0.38, 0.62);
      const ra = r.range(0.07, 0.1);
      const rb = r.range(0.07, 0.1);
      modello.push({ x: x + r.range(-25, 25), v: varco - 0.2 - ra, rv: ra });
      modello.push({ x: x + r.range(-25, 25), v: varco + 0.2 + rb, rv: rb });
    } else {
      const rv = una ? r.range(0.08, 0.13) : r.range(0.15, 0.2);
      // uno scoglio solo: lascia libero almeno un lato largo
      const v = r.next() < 0.5 ? r.range(rv + 0.02, 0.55 - rv) : r.range(0.45 + rv, 0.98 - rv);
      modello.push({ x, v, rv });
    }
  }
  // correnti: una fascia verticale che spinge su o giù, e (con una corsia sola) una controcorrente.
  // Sono sempre più deboli di un pesce (~60 px/s), anche in diagonale: rallentano, non bloccano.
  const correnti = [];
  const cx = x0 + r.range(0.5, 1.5) * passo;
  const verso = r.next() < 0.5 ? -1 : 1;
  const correntiModello = [{ x0: cx - 60, x1: cx + 60, v0: 0, v1: 1, vx: 0, vy: 26 * verso }];
  if (una) {
    const cc = x0 + r.range(2.6, 3.6) * passo;
    const alto = r.next() < 0.5;
    correntiModello.push({ x0: cc - 110, x1: cc + 110, v0: alto ? 0 : 0.55, v1: alto ? 0.45 : 1, vx: -22, vy: 0 });
  }
  const scogli = [];
  for (const [i, c] of lista.entries()) {
    for (const s of modello) scogli.push({ x: s.x, y: c.y0 + s.v * h, r: s.rv * h, corsia: i });
    for (const m of correntiModello) correnti.push({ x0: m.x0, x1: m.x1, y0: c.y0 + m.v0 * h, y1: c.y0 + m.v1 * h, vx: m.vx, vy: m.vy, corsia: i });
  }
  return { corsie: lista, scogli, correnti };
}

// Riparato dalla Marea: subito a sinistra di uno scoglio (l'onda arriva da destra).
export function riparato(x, y, scogli, scala = 1) {
  return scogli.some((s) => x < s.x && x > s.x - s.r - 95 * scala && Math.abs(y - s.y) < s.r * 0.85);
}

const conta = (v, uno, tanti) => `${fmtNum(v, v % 1 ? 1 : 0)} ${v === 1 ? uno : tanti}`;

// Punteggio della partita (decide la classifica del minigioco).
// Pesce: +1 se arriva, +1 per ogni corallo, +2 a tutti con la Fuga perfetta.
// Polpo: la parte di pesci fermati (da 0 a 1), +2 con lo Schiacciamento (nessuno arriva),
// −1 con la Fuga perfetta (arrivano tutti). Così il Polpo sta sopra i pesci che ha fermato
// e sotto quelli arrivati: nel torneo prende circa un punto per ogni pesce fermato, e i
// pesci hanno davvero la possibilità di batterlo.
// polpi: [id]; pesci: [{ id, arrivato, catturato, coralli }].
export function punteggi({ polpi, pesci }) {
  const arrivati = pesci.filter((p) => p.arrivato).length;
  const fermati = pesci.length - arrivati;
  const fuga = pesci.length > 0 && arrivati === pesci.length;
  const schiaccia = pesci.length > 0 && arrivati === 0;
  const punti = {};
  const dettagli = {};
  for (const p of pesci) {
    const v = (p.arrivato ? 1 : 0) + (fuga ? 2 : 0) + p.coralli;
    punti[p.id] = v;
    const parti = [p.arrivato ? '🏁 Arrivato' : p.catturato ? '🐙 Catturato' : '⏱ Non arrivato'];
    if (p.coralli) parti.push(`🪸×${p.coralli}`);
    if (fuga) parti.push('Fuga perfetta +2');
    dettagli[p.id] = `${parti.join(' · ')} = ${conta(v, 'punto', 'punti')}`;
  }
  for (const id of polpi) {
    punti[id] = (pesci.length ? fermati / pesci.length : 0) + (schiaccia ? 2 : 0) - (fuga ? 1 : 0);
    const parti = [`🐙 ${fermati} su ${pesci.length} ${fermati === 1 ? 'fermato' : 'fermati'}`];
    if (schiaccia) parti.push('Schiacciamento!');
    if (fuga) parti.push('Fuga perfetta dei pesci');
    dettagli[id] = parti.join(' · ');
  }
  return { punti, dettagli, arrivati, fermati, fuga, schiaccia };
}

// Da coordinate dello schermo alla mappa del telefono [0, 1] e ritorno.
export const suMappa = (x, y) => [(x - MAPPA.x0) / (MAPPA.x1 - MAPPA.x0), (y - MAPPA.y0) / (MAPPA.y1 - MAPPA.y0)];
export const daMappa = (u, v) => [MAPPA.x0 + clamp(u, 0, 1) * (MAPPA.x1 - MAPPA.x0), MAPPA.y0 + clamp(v, 0, 1) * (MAPPA.y1 - MAPPA.y0)];
