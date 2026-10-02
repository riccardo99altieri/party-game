// Gli artisti del Circo, simulati: servono alle CPU (host.js), al pilota automatico di chi
// ha il telefono spento e alle persone simulate del banco (test/bench/circo.mjs).
// Un artista "vede" solo il suo telefono: le sfide quando arrivano, il cursore, le macchie.
// Per ogni sfida decide come va con i limiti di una persona vera (tempo di reazione, mano
// che trema, memoria, dita che si staccano, distrazioni, confusione dopo uno scambio) e
// restituisce gli errori come li manderebbe il telefono: { r: ruolo, i: sfida, t: secondo }.
// Lo Straccio è simulato davvero: stesso schermo sporco del telefono e un dito che strofina.

import { gauss } from '../cpu.js';
import { GRAZIA_INGRESSO, SPORCO, fase, nelVerde, cursore, attivo, creaSporco } from './regole.js';

export const TELEFONO = { w: 390, h: 640 }; // area di gioco di un telefono tipico (px)

// Chi gioca per la prima volta e non ci capisce niente (0) e un campione (1).
const PRINCIPIANTE = {
  rt: 0.56, // tempo di reazione mediano a un segnale (s), tocco compreso
  rtS: 0.3, // dispersione (log-normale)
  mov: 0.3, // spostare un dito o fare uno swipe (s)
  sdTiro: 0.045, // Cecchino: errore di tempo sul cursore in movimento (s)
  sdRitmo: 0.075, // Batterista: errore di tempo su ogni nota (s)
  memoria: 0.025, // Batterista: probabilità di sbagliare una nota (sequenza da 3)
  scivola: 0.04, // Giocoliere: un dito fermo che si stacca mentre l'altro si sposta
  dito: 0.022, // Giocoliere: sposta il dito sbagliato
  verso: 0.025, // Navigatore: swipe nella direzione sbagliata
  inverso: 0.42, // Navigatore: sbaglia la prima freccia al contrario
  strofina: 0.9, // Straccio: velocità del dito (larghezze di schermo al secondo)
  mira: 2, // Straccio: quante zone guarda prima di scegliere dove strofinare
  giro: 1.2, // Straccio: ogni quanto cambia zona (s)
  distr: 0.16, // distrazioni al secondo (guarda la TV, ride, urla ai compagni)
  distrDur: 0.9, // durata media di una distrazione (s)
  adatta: 1.0, // dopo uno scambio di ruoli: tempo per capire cosa fare (s)
  confuso: 0.35, // e probabilità di sbagliare la prima sfida
  setup: 1.6, // Giocoliere: rimettere tre dita sui cerchi (s)
  fretta: 0.03, // Cecchino: colpo partito per agitazione
};
const CAMPIONE = {
  rt: 0.3,
  rtS: 0.14,
  mov: 0.14,
  sdTiro: 0.014,
  sdRitmo: 0.028,
  memoria: 0.002,
  scivola: 0.006,
  dito: 0.003,
  verso: 0.004,
  inverso: 0.1,
  strofina: 2.4,
  mira: 12,
  giro: 0.5,
  distr: 0.03,
  distrDur: 0.45,
  adatta: 0.35,
  confuso: 0.06,
  setup: 0.6,
  fretta: 0.003,
};

// Abilità di chi gioca sulla scala qui sopra (misure in test/bench/circo.mjs).
export const ABILITA = { facile: 0.15, normale: 0.4, difficile: 0.7, persona: 0.4, esperto: 0.8 };
const NEUTRO = { prudenza: 0.5, aggressivita: 0.5, costanza: 0.5, pazienza: 0.5 };

export function parametri(a, tratti = NEUTRO) {
  const { prudenza, aggressivita, costanza, pazienza } = tratti;
  const P = {};
  for (const k in PRINCIPIANTE) P[k] = PRINCIPIANTE[k] + (CAMPIONE[k] - PRINCIPIANTE[k]) * a;
  // il carattere: l'impulsivo è più svelto ma sbaglia di più, il costante trema meno,
  // il paziente si distrae meno, il prudente aspetta il passaggio giusto del cursore
  P.rt *= 1.06 - 0.12 * aggressivita;
  P.verso *= 0.8 + 0.4 * aggressivita;
  P.fretta *= 0.6 + 0.8 * aggressivita;
  P.sdTiro *= 1.1 - 0.2 * costanza;
  P.sdRitmo *= 1.1 - 0.2 * costanza;
  P.distr *= 1.3 - 0.6 * pazienza;
  P.prudenza = prudenza;
  P.bias = gauss() * P.sdTiro * 0.5; // chi tocca sempre un filo in anticipo o in ritardo
  return P;
}

export function parametriCpu(cpu) {
  const a = cpu.per(ABILITA.facile, ABILITA.normale, ABILITA.difficile) + (cpu.abilita - cpu.per(0.25, 0.55, 0.85)) * 0.5;
  return parametri(a, cpu.tratti);
}

const prob = (p) => Math.random() < p;
const num = (a, b) => a + Math.random() * (b - a);

// prog: programmi(seme) (le sfide di tutti i ruoli); eventi: il Caos (regole.caos).
// passo(dt, t, ruolo): ruolo = quello che ha in mano adesso (cambia negli scambi).
// { da }: comincia a giocare da quel secondo (il pilota automatico che subentra a metà).
export function creaArtista(P, prog, eventi, { da = null } = {}) {
  const W = TELEFONO.w;
  const H = TELEFONO.h;
  let ruolo = null;
  let entrata = 0;
  let scambiato = false; // la prossima sfida è la prima dopo uno scambio
  let coda = []; // errori decisi, in attesa del loro momento
  const prossimo = {}; // ruolo -> indice della prossima sfida da decidere
  let distrDa = -1;
  let distrA = -1;
  let prossimaDistr = rndEsp(P.distr) + 2;
  let pronto = 0; // Giocoliere: quando ha di nuovo tre dita sui cerchi
  let invVisti = 0; // frecce al contrario già viste in questa inversione
  let invT = -1;
  // Straccio
  const sporco = creaSporco();
  let iSchizzo = 0;
  let tregua = 0;
  const dito = { x: W / 2, y: H / 2, cx: W / 2, cy: H / 2, tx: W / 2, ty: H / 2, fi: 0, cambio: 0 };

  function rndEsp(rate) {
    return -Math.log(1 - Math.random()) / Math.max(1e-6, rate);
  }
  const reazione = (k = 1) => Math.min(2.5, P.rt * k * Math.exp(gauss() * P.rtS));
  // quanto resta di una distrazione al tempo t (la sfida viene vista dopo)
  const ritardoDistr = (t) => (t >= distrDa && t < distrA ? distrA - t : 0);
  const terremoto = (t) => attivo(eventi, 'terremoto', t);

  function errore(r, i, t) {
    coda.push({ r, i, t: Math.max(0, t) });
  }

  // Prima sfida dopo uno scambio: ci vuole un attimo per capire.
  function confusione() {
    if (!scambiato) return { extra: 0, p: 0 };
    scambiato = false;
    return { extra: P.adatta * num(0.6, 1.4), p: P.confuso };
  }

  function batterista(s) {
    const c = confusione();
    const L = s.note.length;
    // distratto durante la chiamata: non ha visto bene la sequenza
    const distratto = distrA > s.t0 && distrDa < s.tR;
    const pMem = P.memoria * (L / 3) ** 1.5 * (distratto ? 4 : 1);
    if (prob(c.p)) return errore('batterista', s.i, s.tR + num(0, s.b));
    for (let k = 0; k < L; k++) {
      const T = s.tR + k * s.b;
      if (prob(pMem)) return errore('batterista', s.i, T + num(-0.05, 0.08));
      const sd = P.sdRitmo * (terremoto(T) ? 1.35 : 1) * (s.b < 0.4 ? 1.12 : 1);
      const e = gauss() * sd + P.bias;
      if (Math.abs(e) > s.tol) return errore('batterista', s.i, e > 0 ? T + s.tol : T + e);
    }
  }

  function giocoliere(s) {
    if (s.t0 < pronto) return; // sta ancora rimettendo le dita: la sfida salta
    const c = confusione();
    const rt = reazione(terremoto(s.t0) ? 1.1 : 1) + P.mov + ritardoDistr(s.t0) + c.extra;
    const f = fase(s.t0);
    let quando = null;
    if (rt > s.fine - s.t0) quando = s.fine;
    else if (prob(P.scivola * (terremoto(s.t0) ? 1.8 : 1) * (f === 2 ? 1.25 : 1))) quando = s.t0 + rt * num(0.4, 1);
    else if (prob(P.dito + c.p)) quando = s.t0 + rt;
    if (quando == null) return;
    errore('giocoliere', s.i, quando);
    pronto = quando + P.setup * num(0.7, 1.3);
  }

  function navigatore(s) {
    const c = confusione();
    const rt = reazione(1.12) + P.mov * 0.6 + ritardoDistr(s.t0) + c.extra;
    const t = s.t0 + rt;
    if (rt > s.fine - s.t0) return errore('navigatore', s.i, s.fine);
    let p = P.verso + c.p;
    if (attivo(eventi, 'inversione', t)) {
      const ev = eventi.find((e) => e.tipo === 'inversione');
      if (invT !== ev.t) {
        invT = ev.t;
        invVisti = 0;
      }
      p = Math.max(p, P.inverso * 0.4 ** invVisti);
      invVisti++;
    }
    if (prob(p)) errore('navigatore', s.i, t);
  }

  function cecchino(s) {
    const c = confusione();
    if (prob(P.fretta + c.p * 0.5)) return errore('cecchino', s.i, s.t0 + reazione() + num(0, 0.4));
    let pronto = s.t0 + reazione() + 0.12 + ritardoDistr(s.t0) + c.extra;
    // il prudente lascia passare un cursore che arriva troppo presto
    const attesa = 0.08 + 0.25 * P.prudenza;
    let tc = null;
    let prima = cursore(pronto) - 0.5;
    for (let t = pronto + 0.005; t <= s.fine; t += 0.005) {
      const ora = cursore(t) - 0.5;
      if (Math.sign(ora) !== Math.sign(prima) && t - pronto >= attesa) {
        tc = t;
        break;
      }
      prima = ora;
    }
    if (tc == null) return errore('cecchino', s.i, s.fine);
    const sd = P.sdTiro * (terremoto(tc) ? 1.35 : 1);
    const tiro = tc + gauss() * sd + P.bias;
    if (tiro > s.fine) return errore('cecchino', s.i, s.fine);
    if (!nelVerde(tiro)) errore('cecchino', s.i, tiro);
  }

  const DISCRETI = { batterista, giocoliere, navigatore, cecchino };

  // Straccio: il dito va avanti e indietro sopra la zona scelta, e ogni tanto ne sceglie
  // un'altra (i più bravi guardano meglio dov'è lo sporco).
  function sceltaZona() {
    const { cols, righe, cella } = sporco;
    let best = null;
    for (let k = 0; k < Math.round(P.mira); k++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * righe);
      const v = cella[r * cols + c] + Math.random() * 0.05;
      if (!best || v > best.v) best = { v, x: ((c + 0.5) / cols) * W, y: ((r + 0.5) / righe) * H };
    }
    return best;
  }

  function straccio(dt, t) {
    const schizzi = prog.straccio;
    while (iSchizzo < schizzi.length && schizzi[iSchizzo].t0 <= t) {
      if (schizzi[iSchizzo].t0 >= entrata) sporco.schizza(schizzi[iSchizzo], W, H);
      iSchizzo++;
    }
    const fermo = t >= distrDa && t < distrA;
    if (!fermo) {
      dito.cambio -= dt;
      if (dito.cambio <= 0) {
        const z = sceltaZona();
        dito.tx = z.x;
        dito.ty = z.y;
        dito.cambio = P.giro * num(0.7, 1.3);
      }
      const v = P.strofina * W * (terremoto(t) ? 0.85 : 1);
      // il centro del movimento scivola verso la zona scelta
      const dx = dito.tx - dito.cx;
      const dy = dito.ty - dito.cy;
      const d = Math.hypot(dx, dy);
      const sp = Math.min(d, v * 0.6 * dt);
      if (d > 0) {
        dito.cx += (dx / d) * sp;
        dito.cy += (dy / d) * sp;
      }
      const A = 0.15 * W;
      const passi = Math.max(1, Math.ceil((v * dt) / 12));
      for (let k = 0; k < passi; k++) {
        dito.fi += (v * dt) / passi / (A * 1.3);
        const x = Math.min(W, Math.max(0, dito.cx + A * Math.sin(dito.fi)));
        const y = Math.min(H, Math.max(0, dito.cy + 0.35 * A * Math.sin(dito.fi * 2.3)));
        const lun = Math.hypot(x - dito.x, y - dito.y);
        dito.x = x;
        dito.y = y;
        sporco.pulisci(x, y, lun, W, H);
      }
    }
    if (sporco.livello() >= 1 && t >= tregua) {
      errore('straccio', Math.max(0, iSchizzo - 1), t);
      sporco.salva();
      tregua = t + SPORCO.tregua;
    }
  }

  return {
    sporco,
    passo(dt, t, nuovo) {
      if (nuovo !== ruolo) {
        // cambio di ruolo (inizio o scambio): quello che era in sospeso non conta più
        const primo = ruolo == null;
        ruolo = nuovo;
        entrata = primo ? (da ?? -10) : t;
        coda = [];
        scambiato = !primo;
        if (ruolo === 'giocoliere') pronto = primo && da == null ? 0 : t + P.setup * num(0.7, 1.3) + (primo ? 0 : P.adatta * 0.5);
        if (ruolo === 'straccio') {
          const ps = prog.straccio;
          while (iSchizzo < ps.length && ps[iSchizzo].t0 < t) iSchizzo++;
        }
        const lista = prog[ruolo] || [];
        let k = prossimo[ruolo] || 0;
        while (k < lista.length && lista[k].t0 < entrata + GRAZIA_INGRESSO) k++;
        prossimo[ruolo] = k;
      }
      // distrazioni
      if (t >= prossimaDistr) {
        distrDa = t;
        distrA = t + P.distrDur * num(0.6, 1.4);
        prossimaDistr = distrA + rndEsp(P.distr);
      }
      if (ruolo === 'straccio') straccio(dt, t);
      else if (DISCRETI[ruolo]) {
        const lista = prog[ruolo];
        let k = prossimo[ruolo] || 0;
        while (k < lista.length && lista[k].t0 <= t) DISCRETI[ruolo](lista[k++]);
        prossimo[ruolo] = k;
      }
      const ora = coda.filter((e) => e.t <= t);
      if (ora.length) coda = coda.filter((e) => e.t > t);
      return ora;
    },
  };
}
