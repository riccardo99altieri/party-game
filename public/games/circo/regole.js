// Circo dei Disperati: regole "pure" (niente disegno) condivise da schermo, telefoni e
// banco di prova: fasi e danni, squadre e ruoli, le sfide di ogni ruolo (dal seme, uguali
// per i doppioni e per le due squadre), il Caos, la sporcizia dello Straccio, i punti.

import { seeded } from '../../shared/util.js';

export const DURATA = 45;

// vel = quanto vanno più veloci le sfide; danno = danno base per errore (% della barra).
export const FASI = [
  { nome: 'Riscaldamento', da: 0, a: 15, vel: 1, danno: 8 },
  { nome: 'Il Ritmo', da: 15, a: 30, vel: 1.4, danno: 12 },
  { nome: 'Il Caos', da: 30, a: 45, vel: 1.8, danno: 18 },
];
export const fase = (t) => (t < 15 ? 0 : t < 30 ? 1 : 2);

// Danno di un errore: più giocatori ci sono nella squadra, meno pesa ognuno. Non proprio in
// proporzione (5 / giocatori) ma un po' meno: le squadre grandi sbagliano in modo più regolare
// e i doppioni non pagano due volte la stessa sfida, così con 5/giocatori una squadra da 8 si
// salvava 3 volte su 4 e una da 3 meno di una su 2. Con l'esponente 0,65 si salvano circa
// allo stesso modo (misure in test/bench/circo.mjs). Per 5 giocatori resta il danno base.
export const ESPONENTE_DANNO = 0.65;
export const danno = (t, membri) => FASI[fase(t)].danno * Math.pow(5 / Math.max(1, membri), ESPONENTE_DANNO);

export const RUOLI = {
  batterista: { emoji: '🥁', nome: 'Batterista', art: 'il', azione: 'Rifai il ritmo!' },
  giocoliere: { emoji: '🤹', nome: 'Giocoliere', art: 'il', azione: 'Tre dita sui cerchi!' },
  straccio: { emoji: '🧽', nome: 'Straccio', art: 'lo', azione: 'Strofina via le macchie!' },
  cecchino: { emoji: '🎯', nome: 'Cecchino', art: 'il', azione: 'Tocca quando è nel verde!' },
  navigatore: { emoji: '🧭', nome: 'Navigatore', art: 'il', azione: 'Swipe come la freccia!' },
};
export const NOMI_RUOLI = Object.keys(RUOLI);

export const SQUADRE = [
  { nome: 'Leoni', emoji: '🦁', colore: '#ff7a45' },
  { nome: 'Elefanti', emoji: '🐘', colore: '#4aa8ff' },
];

// Da 9 giocatori si gioca in due squadre parallele, con le stesse sfide.
export const quanteSquadre = (n) => (n >= 9 ? 2 : 1);

function mescola(arr, caso) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(caso() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chiave del ruolo (per def.ruoli / ctx.ruoli): 'batterista' con una squadra sola,
// 'batterista@0' / 'batterista@1' con due.
export const chiaveRuolo = (ruolo, sq, nsq) => (nsq > 1 ? `${ruolo}@${sq}` : ruolo);
export function leggiRuolo(chiave) {
  const [ruolo, sq] = String(chiave || '').split('@');
  return { ruolo: RUOLI[ruolo] ? ruolo : null, sq: sq === '1' ? 1 : 0 };
}

// Squadre e ruoli a caso. Le persone si dividono a metà tra le squadre, poi i bot
// (alternando le potenze, così le squadre sono simili). In ogni squadra i ruoli sono i
// primi della stessa lista: 5 ruoli diversi, poi i doppioni (al massimo uno per ruolo).
// Con squadre di grandezza diversa la più piccola ha un ruolo in meno.
export function assegna(giocatori, caso = Math.random) {
  const n = giocatori.length;
  const nsq = quanteSquadre(n);
  const squadre = Array.from({ length: nsq }, () => []);
  const umani = mescola(giocatori.filter((p) => !p.bot), caso);
  const bot = mescola(giocatori.filter((p) => p.bot), caso).sort((a, b) => (b.livello ?? 1) - (a.livello ?? 1));
  const forza = squadre.map(() => 0);
  const metti = (p, bot) => {
    let k = 0;
    for (let i = 1; i < nsq; i++) {
      const meno = squadre[i].length - squadre[k].length || (bot ? forza[i] - forza[k] : 0) || (caso() < 0.5 ? -1 : 1);
      if (meno < 0) k = i;
    }
    squadre[k].push(p);
    if (bot) forza[k] += p.livello ?? 1;
  };
  for (const p of umani) metti(p, false);
  for (const p of bot) metti(p, true);
  const lista = [...mescola(NOMI_RUOLI, caso), ...mescola(NOMI_RUOLI, caso).slice(0, 3)];
  const ruoli = {};
  squadre.forEach((membri, sq) => {
    const miei = mescola(lista.slice(0, membri.length), caso);
    membri.forEach((p, i) => (ruoli[p.id] = chiaveRuolo(miei[i % miei.length], sq, nsq)));
  });
  return ruoli;
}

// ---------------------------------------------------------------------------
// Le sfide di ogni ruolo. Ogni sfida ha un indice i (la "chiave" dell'errore: se due
// doppioni sbagliano la stessa sfida, il danno scatta una volta sola, per il primo),
// un inizio t0 e una fine. Un errore = una sfida fallita (mai più di uno per sfida).

const SEMI = { batterista: 0x9e3779b1, giocoliere: 0x85ebca6b, straccio: 0xc2b2ae35, cecchino: 0x27d4eb2f, navigatore: 0x165667b1 };
const rngRuolo = (ruolo, seme) => seeded((seme ^ SEMI[ruolo]) >>> 0);

// Batterista: le luci suonano una sequenza (la "chiamata"), poi la si rifà sugli stessi
// battiti (la "risposta"). Ogni nota va toccata sul pad giusto entro ±tol dal suo battito.
export const BATTERISTA = { pad: 3, battito: [0.6, 0.46, 0.38], note: [3, 4, 4], tol: [0.21, 0.18, 0.16], pausa: [0.6, 0.46, 0.38] };
// Giocoliere: 3 dita su 3 dei 4 cerchi; quando il 4° si accende, si sposta lì il dito
// del cerchio indicato (j = quale dei tre, contando in ordine) entro il limite.
export const GIOCOLIERE = { limite: [2.1, 1.65, 1.3], passo: [2.8, 2.05, 1.6], setup: 4 };
// Cecchino: il cursore va avanti e indietro; a ogni "SPARA!" si tocca quando è nel verde.
// giro = secondi per attraversare la barra a velocità 1; verde = larghezza a inizio e fine.
export const CECCHINO = { giro: 1.15, verde: [0.34, 0.24], finestra: [2.4, 1.9, 1.6], pausa: [0.75, 0.55, 0.45] };
// Navigatore: una freccia, uno swipe in quella direzione entro il limite.
export const NAVIGATORE = { limite: [2.0, 1.55, 1.35], passo: [2.3, 1.75, 1.62] };
// Straccio: il pubblico tira pomodori, uova e torte sullo schermo (una ogni "passo" s, più o meno).
export const STRACCIO = { passo: [1.1, 0.98, 1.0] };
export const DIREZIONI = ['su', 'giu', 'sx', 'dx'];
export const OPPOSTO = { su: 'giu', giu: 'su', sx: 'dx', dx: 'sx' };
export const SCHIZZI = ['pomodoro', 'uovo', 'torta'];

// Posizione del cursore del Cecchino (0–1) al tempo t: va e viene sempre più veloce.
function giri(t) {
  let s = 0;
  for (const f of FASI) {
    if (t <= f.da) break;
    s += (Math.min(t, f.a) - f.da) * f.vel;
  }
  if (t > DURATA) s += (t - DURATA) * FASI[2].vel;
  return s / CECCHINO.giro;
}
export function cursore(t) {
  const p = ((giri(Math.max(0, t)) % 2) + 2) % 2;
  return p < 1 ? p : 2 - p;
}
// Metà larghezza della zona verde (centrata in 0,5): si restringe col tempo.
export const verde = (t) => (CECCHINO.verde[0] + (CECCHINO.verde[1] - CECCHINO.verde[0]) * Math.min(1, Math.max(0, t / DURATA))) / 2;
export const nelVerde = (t) => Math.abs(cursore(t) - 0.5) <= verde(t);
// Velocità del cursore (barre al secondo) al tempo t.
export const velCursore = (t) => FASI[fase(t)].vel / CECCHINO.giro;

export function programma(ruolo, seme) {
  const r = rngRuolo(ruolo, seme);
  const lista = [];
  if (ruolo === 'batterista') {
    const B = BATTERISTA;
    let t = 0.8;
    for (;;) {
      const f = fase(t);
      const b = B.battito[f];
      const L = B.note[f];
      const note = [];
      while (note.length < L) {
        const p = r.int(0, B.pad - 1);
        if (note.length >= 2 && note.at(-1) === p && note.at(-2) === p) continue;
        note.push(p);
      }
      const tR = t + (L + 1) * b;
      const fine = tR + (L - 1) * b + B.tol[f];
      if (fine > DURATA) break;
      lista.push({ i: lista.length, t0: t, b, note, tR, fine, tol: B.tol[f] });
      t = fine + B.pausa[f];
    }
  } else if (ruolo === 'giocoliere') {
    const G = GIOCOLIERE;
    let t = 1.3;
    for (;;) {
      const f = fase(t);
      const fine = t + G.limite[f];
      if (fine > DURATA) break;
      lista.push({ i: lista.length, t0: t, fine, j: r.int(0, 2) });
      t += G.passo[f] * r.range(0.9, 1.1);
    }
  } else if (ruolo === 'cecchino') {
    const C = CECCHINO;
    let t = 1;
    for (;;) {
      const f = fase(t);
      const fine = t + C.finestra[f];
      if (fine > DURATA) break;
      lista.push({ i: lista.length, t0: t, fine });
      t = fine + C.pausa[f] * r.range(0.8, 1.2);
    }
  } else if (ruolo === 'navigatore') {
    const N = NAVIGATORE;
    let t = 1;
    let prima = null;
    for (;;) {
      const f = fase(t);
      const fine = t + N.limite[f];
      if (fine > DURATA) break;
      let dir = r.pick(DIREZIONI);
      if (dir === prima && r.next() < 0.6) dir = r.pick(DIREZIONI.filter((d) => d !== prima));
      lista.push({ i: lista.length, t0: t, fine, dir });
      prima = dir;
      t += N.passo[f] * r.range(0.92, 1.08);
    }
  } else if (ruolo === 'straccio') {
    let t = 0.5;
    while (t < DURATA) {
      const grossa = r.next() < 0.15;
      lista.push({ i: lista.length, t0: t, x: r.range(0.12, 0.88), y: r.range(0.1, 0.9), r: grossa ? r.range(0.21, 0.25) : r.range(0.13, 0.17), q: r.range(0.75, 1), tipo: r.pick(SCHIZZI) });
      t += STRACCIO.passo[fase(t)] * r.range(0.6, 1.4) * (grossa ? 1.3 : 1);
    }
  }
  return lista;
}

export function programmi(seme) {
  return Object.fromEntries(NOMI_RUOLI.map((r) => [r, programma(r, seme)]));
}

// Una sfida conta solo se il ruolo era già in mano a chi gioca quando è cominciata
// (dopo uno scambio di ruoli, quella a metà non vale per nessuno dei due).
export const GRAZIA_INGRESSO = 0.25;

// ---------------------------------------------------------------------------
// Straccio: lo schermo è una griglia di celle con un po' di sporco (0–1). Gli schizzi lo
// aggiungono, il dito che strofina lo toglie (ogni passata ne toglie solo una parte: bisogna
// strofinare davvero). La barra dello sporco è piena quando lo sporco totale arriva a CAP.

export const SPORCO = { cols: 16, righe: 26, cap: 0.2, raggio: 0.16, forza: 6, salvataggio: 0.45, tregua: 0.9 };

export function creaSporco() {
  const { cols, righe } = SPORCO;
  const n = cols * righe;
  const cella = new Float32Array(n);
  const tipo = new Uint8Array(n);
  const cap = SPORCO.cap * n;
  let somma = 0;
  const ricalcola = () => {
    somma = 0;
    for (let k = 0; k < n; k++) somma += cella[k];
  };
  return {
    cols,
    righe,
    cella,
    tipo,
    // schizzo s ({ x, y, r, q, tipo }) su uno schermo w × h (px)
    schizza(s, w, h) {
      const R = s.r * w;
      const cx = s.x * w;
      const cy = s.y * h;
      const ti = Math.max(0, SCHIZZI.indexOf(s.tipo));
      for (let rr = 0; rr < righe; rr++) {
        const y = ((rr + 0.5) / righe) * h;
        if (Math.abs(y - cy) > R) continue;
        for (let c = 0; c < cols; c++) {
          const x = ((c + 0.5) / cols) * w;
          const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R);
          if (d2 >= 1) continue;
          const k = rr * cols + c;
          const add = s.q * (1 - d2 * 0.75);
          if (add > cella[k] * 0.5) tipo[k] = ti;
          cella[k] = Math.min(1, cella[k] + add);
        }
      }
      ricalcola();
    },
    // il dito passa per (x, y) dopo aver percorso `lun` px: toglie sporco tutto intorno
    pulisci(x, y, lun, w, h) {
      if (lun <= 0) return;
      const R = SPORCO.raggio * w;
      const kf = (SPORCO.forza * lun) / w;
      const r0 = Math.max(0, Math.floor(((y - R) / h) * righe));
      const r1 = Math.min(righe - 1, Math.floor(((y + R) / h) * righe));
      for (let rr = r0; rr <= r1; rr++) {
        const cy = ((rr + 0.5) / righe) * h;
        for (let c = 0; c < cols; c++) {
          const cx = ((c + 0.5) / cols) * w;
          const d2 = ((cx - x) ** 2 + (cy - y) ** 2) / (R * R);
          if (d2 >= 1) continue;
          const k = rr * cols + c;
          const v = cella[k] * Math.exp(-kf * (1 - d2));
          cella[k] = v < 0.02 ? 0 : v;
        }
      }
      ricalcola();
    },
    // dopo un errore lo schermo torna un po' più pulito (lo "salvataggio")
    salva() {
      for (let k = 0; k < n; k++) cella[k] *= SPORCO.salvataggio;
      ricalcola();
    },
    svuota() {
      cella.fill(0);
      somma = 0;
    },
    livello: () => somma / cap,
  };
}

// ---------------------------------------------------------------------------
// Il Caos (fase 3): inversione del Navigatore (3 s), terremoto (2 s), scambio di ruoli (5 s).
// Arrivano uno per tipo in ordine casuale; senza Navigatori l'inversione non c'è.
// squadre: per ogni squadra, l'elenco dei ruoli dei membri in ordine.
// Restituisce { eventi: [{ t, tipo, durata }], scambi: [[i, j] | null] } (per ogni squadra,
// le posizioni dei due membri che si scambiano il ruolo).
export const CAOS = { inversione: 3, terremoto: 2, scambio: 5 };

export function caos(seme, squadre) {
  const r = seeded((seme ^ 0x5bd1e995) >>> 0);
  const conNav = squadre.some((ruoli) => ruoli.includes('navigatore'));
  const tipi = mescola(['inversione', 'terremoto', 'scambio'].filter((x) => x !== 'inversione' || conNav), r.next);
  const tempi = tipi.length === 3 ? [31, 36.5, 41.5] : [32, 39];
  const eventi = tipi.map((tipo, k) => ({ t: tempi[k] + r.range(-0.5, 0.5), tipo, durata: CAOS[tipo] }));
  const sorte = r.next();
  const scambi = squadre.map((ruoli) => {
    const presenti = NOMI_RUOLI.filter((x) => ruoli.includes(x));
    const coppie = [];
    for (let a = 0; a < presenti.length; a++) for (let b = a + 1; b < presenti.length; b++) coppie.push([presenti[a], presenti[b]]);
    if (!coppie.length) return null;
    const [ra, rb] = coppie[Math.floor(sorte * coppie.length)];
    return [ruoli.indexOf(ra), ruoli.indexOf(rb)];
  });
  return { eventi, scambi };
}

export const attivo = (eventi, tipo, t) => eventi.some((e) => e.tipo === tipo && t >= e.t && t < e.t + e.durata);

// ---------------------------------------------------------------------------
// Punti della partita (decidono la classifica del minigioco).
// Squadra salva (barra > 0): +2 a tutti; chi ha fatto 0 errori +2, altrimenti l'MVP (meno
// errori; a pari errori meno danni) +1. Squadra crollata: 0; il Colpevole (più errori; a
// pari errori più danni) −1, −2 se ha fatto da solo almeno il 40% degli errori della squadra.
// Con due squadre crollate tutte e due, chi è durata di più prende +1 di consolazione.
// squadre: [{ membri: [{ id, errori, danni }], barra, crollo (secondo del crollo o null) }]
export function punteggi(squadre) {
  const punti = {};
  const info = {};
  const esiti = squadre.map((s) => {
    const salva = s.barra > 0;
    const tot = s.membri.reduce((a, m) => a + m.errori, 0);
    const migliore = (a, b) => a.errori - b.errori || a.danni - b.danni;
    const ordinati = [...s.membri].sort(migliore);
    const esito = { salva, tot, mvp: [], zero: [], colpevoli: [], consolazione: false, crollo: s.crollo };
    for (const m of s.membri) {
      punti[m.id] = salva ? 2 : 0;
      info[m.id] = { ...m, salva, quota: tot ? m.errori / tot : 0, tag: null };
    }
    if (salva) {
      esito.zero = s.membri.filter((m) => m.errori === 0).map((m) => m.id);
      if (esito.zero.length) for (const id of esito.zero) (punti[id] += 2), (info[id].tag = 'zero');
      else if (ordinati.length) {
        esito.mvp = ordinati.filter((m) => migliore(m, ordinati[0]) === 0).map((m) => m.id);
        for (const id of esito.mvp) (punti[id] += 1), (info[id].tag = 'mvp');
      }
    } else if (ordinati.length && tot > 0) {
      const peggio = ordinati.at(-1);
      esito.colpevoli = ordinati.filter((m) => migliore(m, peggio) === 0).map((m) => m.id);
      for (const id of esito.colpevoli) {
        const pesante = info[id].quota >= 0.4 - 1e-9;
        punti[id] += pesante ? -2 : -1;
        info[id].tag = pesante ? 'colpevole2' : 'colpevole';
      }
    }
    return esito;
  });
  if (squadre.length === 2 && !esiti[0].salva && !esiti[1].salva && esiti[0].crollo !== esiti[1].crollo) {
    const k = (esiti[0].crollo ?? DURATA) > (esiti[1].crollo ?? DURATA) ? 0 : 1;
    esiti[k].consolazione = true;
    for (const m of squadre[k].membri) {
      punti[m.id] += 1;
      info[m.id].consolazione = true;
    }
  }
  // classifica: punti, poi meno errori, poi meno danni
  const ids = Object.keys(punti).sort((a, b) => punti[b] - punti[a] || info[a].errori - info[b].errori || info[a].danni - info[b].danni);
  const gruppi = [];
  for (const id of ids) {
    const ref = gruppi.length && gruppi.at(-1)[0];
    if (ref && punti[ref] === punti[id] && info[ref].errori === info[id].errori && Math.abs(info[ref].danni - info[id].danni) < 1e-6) gruppi.at(-1).push(id);
    else gruppi.push([id]);
  }
  return { punti, info, esiti, gruppi };
}
