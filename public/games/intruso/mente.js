// La mente dei bot di Trova l'Intruso (la usano anche le persone simulate del banco).
//
// Niente trucchi: sa solo quello che si vede sulla TV (personaggi tutti uguali, monete,
// acqua alta, i passanti incuriositi col "?") più gli eventi pubblici (un pugno si vede,
// un errore ha il nome di chi l'ha fatto, una moneta presa sparisce sotto i piedi di
// qualcuno) e quello che dice il suo telefono (dove è lui). Per seguire qualcuno con gli
// occhi usa l'indice del personaggio, ma lo può perdere o scambiare con un altro quando
// si incrociano nella folla, come succede a una persona.
//
// Indizi che usa per sospettare di qualcuno:
//  - forti (quasi sempre giusti): l'ha visto tirare un pugno, sbagliarlo o raccogliere una
//    moneta; i passanti col "?" gli girano intorno;
//  - deboli (giusti più o meno 2 volte su 3): sta fermo da più di 3 s, gli sta appiccicato
//    da un po', si muove a scatti (inversioni senza fermarsi), gli viene dritto addosso.
// Per mimetizzarsi cammina come i passanti (stesso "passo" in folla.js). I livelli si
// distinguono per attenzione, per quanto perdono di vista chi seguono, per i "tic" che li
// tradiscono, per la prudenza (monete, pugni a caso) e per la furbizia nella caccia.

import { creaPasso, prossimoDir, ripianifica, PAUSA_MAX } from './folla.js';
import { VEL, PORTATA, PASSO_FERMO, dirVerso } from './regole.js';
import { gauss } from '../cpu.js';

// Profili: 0 Facile, 1 Normale, 2 Difficile. Il banco li misura contro le persone simulate.
export const PROFILI = [
  {
    nome: 'Facile',
    passo: 0.36, // ogni quanto riguarda la scena (s)
    vedePugno: 0.3, // probabilità di accorgersi di un pugno (vicino; lontano meno, vedi attenzione)
    vedeErrore: 0.7, // l'errore lampeggia rosso col nome: lo si nota di più
    vedeMoneta: 0.2,
    vedeAnello: 0.15, // al secondo
    vedeFermo: 0.2,
    vedeStrano: 0.15, // scatti e inversioni senza fermarsi: i passanti non lo fanno
    unisce: false, // mette insieme due indizi deboli diversi
    vedeSegue: 0.08,
    scambio: 2, // al secondo, quando chi segue con gli occhi ne incrocia un altro
    perde: 0.35, // al secondo, quando è lontano (più di 450 px): lo perde di vista
    dubbio: 1, // quando chi segue con gli occhi sfiora un altro, si fida meno (×)
    memoria: 12, // quanto dura un sospetto: dopo questi secondi vale circa un terzo
    caccia: 0.55, // sospetto che basta per andargli addosso
    soglia: 0.4, // sospetto che basta per tirare il pugno
    controlla: 0, // controlla che non ci sia un passante in mezzo
    avidita: 0.65, // voglia di andare a prendere le monete
    notaMoneta: 0.45, // si accorge che è comparsa una moneta
    ritardoMoneta: 2.5, // … dopo quante "reazioni"
    prudenteMoneta: false, // l'esperto non la prende sotto il naso di un sospetto
    raggioMoneta: 900,
    tic: 0.5, // a fine attività resta fermo troppo (si fa notare)
    nervoso: 0.35, // al secondo: cambia direzione di scatto
    schiva: 0, // si accorge di chi gli viene dritto addosso e si scansa
    fuga: 0.15, // scappa da chi gli viene addosso
    nasconde: 0.1, // dopo essersi scoperto si allontana
    zonaTardi: 0.5, // si accorge tardi dell'acqua
    azzardo: 0.02, // a ogni occhiata: pugno a caso a chi gli è accanto
    calma: 0, // fino a questo secondo caccia solo chi è vicino (0 = sempre)
    furbo: false, // si avvicina di sbieco e si ferma un attimo prima di cambiare strada
    pazienza: 5, // per quanto insegue prima di lasciar perdere (s)
  },
  {
    nome: 'Normale',
    passo: 0.28,
    vedePugno: 0.6,
    vedeErrore: 0.85,
    vedeMoneta: 0.45,
    vedeAnello: 0.4,
    vedeFermo: 0.5,
    vedeStrano: 0.4,
    unisce: false,
    vedeSegue: 0.25,
    scambio: 1,
    perde: 0.12,
    dubbio: 0.97,
    memoria: 20,
    caccia: 0.6,
    soglia: 0.7,
    controlla: 0.5,
    avidita: 0.45,
    notaMoneta: 0.75,
    ritardoMoneta: 1.5,
    prudenteMoneta: false,
    raggioMoneta: 450,
    tic: 0.12,
    nervoso: 0.08,
    schiva: 0.3,
    fuga: 0.6,
    nasconde: 0.5,
    zonaTardi: 0.12,
    azzardo: 0.0008,
    calma: 0,
    furbo: false,
    pazienza: 8,
  },
  {
    nome: 'Difficile',
    passo: 0.22,
    vedePugno: 0.95,
    vedeErrore: 1,
    vedeMoneta: 0.85,
    vedeAnello: 0.7,
    vedeFermo: 0.9,
    vedeStrano: 0.75,
    unisce: true,
    vedeSegue: 0.5,
    scambio: 0.35,
    perde: 0.03,
    dubbio: 0.85,
    memoria: 30,
    caccia: 0.6,
    soglia: 0.72,
    controlla: 1,
    avidita: 0.5,
    notaMoneta: 0.95,
    ritardoMoneta: 1,
    prudenteMoneta: true,
    raggioMoneta: 260,
    tic: 0,
    nervoso: 0,
    schiva: 0.8,
    fuga: 0.85,
    nasconde: 0.9,
    zonaTardi: 0.02,
    azzardo: 0,
    calma: 45,
    furbo: true,
    pazienza: 11,
  },
];

// Quanto si guarda una parte della TV: si sta attenti soprattutto intorno a sé.
const attenzione = (d) => (d < 300 ? 1 : d < 600 ? 0.6 : 0.3);
const SCAMBIO = 38; // due personaggi così vicini si confondono
// Gli indizi deboli (sta fermo, mi segue, si muove strano, mi viene addosso) da soli non
// arrivano oltre questo sospetto: bastano per colpire, ma sbagliano più spesso di quelli
// forti. Il Difficile, se ne vede due diversi sullo stesso personaggio, è più sicuro.
const DEBOLE = 0.75;
const DEBOLI_INSIEME = 0.88; // … ma due indizi deboli diversi sullo stesso personaggio valgono di più

const reazioneBase = () => Math.min(2, 0.36 * Math.exp(gauss() * 0.2));

// aiuti: { rng, reazione(), tratti } (dalla CPU del gioco; per le persone simulate li dà il banco)
export function creaMente(P, aiuti = {}) {
  const rng = aiuti.rng || Math.random;
  const reazione = aiuti.reazione || reazioneBase;
  const tr = aiuti.tratti || { aggressivita: 0.5, prudenza: 0.5, pazienza: 0.5, costanza: 0.5 };
  // il carattere sposta un po' le soglie: gli aggressivi cacciano prima, i prudenti scappano di più
  const cacciaSoglia = P.caccia - 0.12 * (tr.aggressivita - 0.5);
  const fugaP = Math.min(0.98, P.fuga * (0.8 + 0.4 * tr.prudenza));
  const avidita = Math.min(0.95, P.avidita * (0.7 + 0.6 * (1 - tr.pazienza)));

  const passo = creaPasso();
  const sosp = new Map(); // indice -> sospetto (0..1)
  const ultimaD = new Map(); // indice -> distanza all'occhiata prima
  const fermi = new Map(); // indice -> { x, y, t0 }: da quando sta lì
  const moti = new Map(); // indice -> { x, y, hx, hy, cambi }: come si muove (scatti, inversioni)
  const vicini = new Map(); // indice -> da quando mi sta vicino
  const scie = []; // le mie posizioni recenti
  const viste = new Map(); // moneta -> quando ci pensa (Infinity: non l'ha notata o ci ha già pensato)

  let tDec = rng() * P.passo;
  let tUltima = 0;
  let modo = 'folla';
  let tModo = 0;
  let fineModo = 0;
  let bersaglio = -1;
  let minaccia = -1;
  let moneta = -1;
  let meta = null;
  let pugnoAlle = -1;
  let esposto = -Infinity;
  let zonaAlle = -1;
  let passoZonaVisto = -1;
  let nervosoFino = 0;
  let dirNervosa = [0, 0];
  let lato = null;
  let pausaVista = 0;
  let arriva = -1; // chi mi sta venendo dritto addosso (visto in questa occhiata)
  let pausaFurba = 0;
  let latoCaccia = 1;

  const perche = new Map(); // indice -> l'ultimo indizio (per il banco)
  const traccia = aiuti.traccia || null;

  const deboli = new Map(); // indice -> tipi di indizi deboli visti su di lui
  const incrocio = new Map(); // indice -> sta sfiorando qualcuno (per il dubbio)

  function aggiungi(i, v, max = 1, motivo = '?') {
    if (max === DEBOLE) {
      if (!deboli.has(i)) deboli.set(i, new Set());
      deboli.get(i).add(motivo);
      if (P.unisce && deboli.get(i).size >= 2) max = DEBOLI_INSIEME;
    }
    sosp.set(i, Math.min(max, Math.max(sosp.get(i) || 0, (sosp.get(i) || 0) + v)));
    if (traccia) perche.set(i, motivo);
  }
  function certo(i, motivo) {
    sosp.set(i, 1);
    if (traccia) perche.set(i, motivo);
  }

  function cambia(m, durata = 0) {
    // chi è esperto prima di cambiare strada si ferma un attimo, come un passante
    // (un'inversione di marcia di colpo si nota)
    if (P.furbo && m !== modo && m !== 'fuga' && m !== 'folla') pausaFurba = tUltima + 0.4 + rng() * 0.3;
    if (m === 'caccia') latoCaccia = rng() < 0.5 ? 1 : -1;
    modo = m;
    tModo = 0;
    fineModo = durata;
    pugnoAlle = -1;
    lato = null;
  }

  // Il personaggio in piedi più vicino a (x, y) entro `max`, escluso `salta`.
  function vicinoA(tv, x, y, max, salta, salta2 = -1) {
    let best = -1;
    let bd = max;
    tv.ents.forEach((e, i) => {
      if (i === salta || i === salta2 || e.steso) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // Come sceglie il gioco a chi arriva il pugno (la stessa regola, con quello che si vede).
  function chiPrende(tv, io) {
    const fa = Math.atan2(io.face[1], io.face[0]);
    let best = -1;
    let bv = Infinity;
    tv.ents.forEach((e, i) => {
      if (i === io.i || e.steso) return;
      const dx = e.x - io.x;
      const dy = e.y - io.y;
      const d = Math.hypot(dx, dy);
      if (d > PORTATA) return;
      let da = Math.abs(Math.atan2(dy, dx) - fa);
      if (da > Math.PI) da = 2 * Math.PI - da;
      const v = d / PORTATA + da * 0.6;
      if (v < bv) {
        bv = v;
        best = i;
      }
    });
    return best;
  }

  // -------------------------------------------------------------------------
  // Gli eventi pubblici: li nota o no

  function osserva(ev, io) {
    const d = ev.x != null ? Math.hypot(ev.x - io.x, ev.y - io.y) : 0;
    const f = attenzione(d);
    if (ev.ent === io.i) {
      if (ev.tipo === 'kill' || ev.tipo === 'errore' || ev.tipo === 'moneta') esposto = ev.t;
      return;
    }
    switch (ev.tipo) {
      case 'kill':
        sosp.delete(ev.vittima);
        if (rng() < P.vedePugno * f) certo(ev.ent, 'pugno');
        break;
      case 'errore':
        sosp.delete(ev.vittima); // quello a terra è di sicuro un passante
        if (rng() < P.vedeErrore * Math.max(0.6, f)) certo(ev.ent, 'errore');
        break;
      case 'moneta':
        if (rng() < P.vedeMoneta * f) aggiungi(ev.ent, 0.95, 1, 'moneta');
        break;
      case 'eliminato':
      case 'annegato':
        sosp.delete(ev.ent);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Ogni tanto: riguarda la scena e decide cosa fare

  function pensa(tv, io) {
    const t = tv.t;
    const dtp = Math.max(0.05, t - tUltima);
    tUltima = t;
    scie.push({ t, x: io.x, y: io.y });
    while (scie.length && t - scie[0].t > 6) scie.shift();

    // la memoria sbiadisce e, nella calca, chi si segue con gli occhi si può scambiare
    for (const [i, s0] of [...sosp]) {
      const e = tv.ents[i];
      if (!e || !e.vivo || e.steso || e.curioso) {
        sosp.delete(i);
        deboli.delete(i);
        continue;
      }
      let s = s0 * Math.exp(-dtp / P.memoria);
      if (s < 0.05) {
        sosp.delete(i);
        continue;
      }
      if (Math.hypot(e.x - io.x, e.y - io.y) > 450 && rng() < P.perde * dtp) {
        sosp.delete(i);
        continue;
      }
      if (s >= 0.3) {
        const o = vicinoA(tv, e.x, e.y, SCAMBIO, i, io.i);
        if (o >= 0 && P.dubbio < 1 && !incrocio.get(i)) {
          // "è passato vicino a un altro: sarà ancora lui?"
          incrocio.set(i, true);
          s *= P.dubbio;
        }
        if (o < 0) incrocio.delete(i);
        if (o >= 0 && rng() < P.scambio * dtp) {
          sosp.delete(i);
          deboli.delete(i);
          sosp.set(o, Math.max(sosp.get(o) || 0, s * 0.95));
          if (traccia) perche.set(o, `scambio(${perche.get(i) || '?'})`);
          continue;
        }
      }
      sosp.set(i, s);
    }

    // i passanti col "?" girano intorno a qualcuno che sta fermo
    for (const a of tv.anelli) {
      const d = Math.hypot(a.x - io.x, a.y - io.y);
      if (d < 4) continue;
      if (rng() < P.vedeAnello * dtp * attenzione(d)) {
        const i = vicinoA(tv, a.x, a.y, 12, io.i);
        if (i >= 0) aggiungi(i, 0.55, 0.92, 'anello');
      }
    }

    // chi sta fermo o mi sta appiccicato (solo intorno a me: lì guardo meglio)
    const mioPrima = scie.find((s) => t - s.t <= 3.6) || scie[0];
    const mioMosso = Math.hypot(io.x - mioPrima.x, io.y - mioPrima.y);
    tv.ents.forEach((e, i) => {
      if (i === io.i) return;
      const d = Math.hypot(e.x - io.x, e.y - io.y);
      if (e.steso || e.curioso || d > 260) {
        fermi.delete(i);
        vicini.delete(i);
        moti.delete(i);
        return;
      }
      // si muove "strano"? due inversioni di marcia in poco tempo senza mai fermarsi
      let m = moti.get(i);
      if (!m) moti.set(i, (m = { x: e.x, y: e.y, hx: 0, hy: 0, cambi: [] }));
      const mx = e.x - m.x;
      const my = e.y - m.y;
      const ml = Math.hypot(mx, my);
      if (ml > 8) {
        const hx = mx / ml;
        const hy = my / ml;
        if ((m.hx || m.hy) && hx * m.hx + hy * m.hy < -0.1) m.cambi.push(t);
        m.hx = hx;
        m.hy = hy;
        m.x = e.x;
        m.y = e.y;
      } else if (ml < 3 && t - (m.tFermo ?? t) > 0.5) {
        m.hx = m.hy = 0; // una pausa: cambiare strada dopo una pausa è normale
        m.cambi.length = 0;
      }
      if (ml < 3) m.tFermo ??= t;
      else m.tFermo = null;
      while (m.cambi.length && t - m.cambi[0] > 2.5) m.cambi.shift();
      // mi viene dritto addosso? (punta verso di me e si avvicina da un po')
      const verso = (m.hx * (io.x - e.x) + m.hy * (io.y - e.y)) / (d || 1);
      if (verso > 0.85 && m.d != null && d < m.d - 4) m.verso = (m.verso || 0) + dtp;
      else m.verso = 0;
      m.d = d;
      if (m.verso >= 0.9 && d < 150 && !m.avvisato) {
        m.avvisato = true;
        if (rng() < P.schiva) {
          aggiungi(i, 0.3, DEBOLE, 'arriva');
          arriva = i;
        }
      }
      if (d > 220) m.avvisato = false;
      if (m.cambi.length >= 2) {
        if (rng() < P.vedeStrano) aggiungi(i, 0.3, DEBOLE, 'strano');
        m.cambi.length = 0;
      }
      const f = fermi.get(i);
      if (!f || Math.hypot(e.x - f.x, e.y - f.y) > PASSO_FERMO) fermi.set(i, { x: e.x, y: e.y, t0: t });
      else if (t - f.t0 > 3.5) aggiungi(i, 0.6 * P.vedeFermo * dtp, DEBOLE, 'fermo');
      if (d < 140) {
        if (!vicini.has(i)) vicini.set(i, t);
        else if (t - vicini.get(i) > 5 && mioMosso > 150) {
          if (rng() < P.vedeSegue) aggiungi(i, 0.3, DEBOLE, 'segue');
          vicini.set(i, t);
        }
      } else vicini.delete(i);
    });

    // l'acqua: quando ci si accorge che bisogna spostarsi
    const z = tv.zona;
    const fuori = Math.hypot(io.x - z.x, io.y - z.y) > z.r - 30;
    if (fuori) {
      if (zonaAlle < 0) zonaAlle = t + (rng() < P.zonaTardi ? 1.5 + rng() * 2.5 : reazione());
    } else zonaAlle = -1;
    const zonaOk = fuori && zonaAlle >= 0 && t >= zonaAlle;
    const dentroOra = Math.hypot(io.x - z.x, io.y - z.y) < z.rAtt - 40;

    // chi mi viene addosso (sospetto alto, vicino, e si avvicina)
    minaccia = -1;
    const scansa = arriva;
    arriva = -1;
    let dMin = Infinity;
    for (const [i, s] of sosp) {
      const e = tv.ents[i];
      const d = Math.hypot(e.x - io.x, e.y - io.y);
      const prima = ultimaD.get(i);
      ultimaD.set(i, d);
      if (s < 0.75 || d > 170 || prima == null || d > prima - 3) continue;
      if (d < dMin) {
        dMin = d;
        minaccia = i;
      }
    }

    tModo += dtp;
    // un inseguimento dura finché il sospetto regge e la pazienza non finisce
    if (modo === 'caccia') {
      const e = tv.ents[bersaglio];
      if (!e || e.steso || (sosp.get(bersaglio) || 0) < cacciaSoglia * 0.75 || tModo > P.pazienza) cambia('folla');
      else if (zonaOk && !dentroOra) cambia('folla');
      else return;
    }
    if ((modo === 'fuga' || modo === 'nascondi') && tModo < fineModo) return;
    if (modo === 'moneta') {
      if (tv.monete.some((m) => m.id === moneta) && !(zonaOk && !dentroOra)) return;
      cambia('folla');
    }
    if (modo !== 'folla') cambia('folla');

    // 1. qualcuno di sospetto mi viene addosso: lo colpisco prima, o scappo
    if (minaccia >= 0) {
      if (dMin <= PORTATA - 4 && (sosp.get(minaccia) || 0) >= P.soglia) {
        bersaglio = minaccia;
        return cambia('caccia');
      }
      if (rng() < fugaP) {
        bersaglio = minaccia;
        return cambia('fuga', 0.9 + rng() * 0.8);
      }
    }
    // qualcuno mi punta dritto: mi scanso (chi è esperto se ne accorge)
    if (scansa >= 0 && modo === 'folla') {
      bersaglio = scansa;
      return cambia('fuga', 0.6 + rng() * 0.5);
    }
    // 2. appena scoperto (pugno o moneta): via di lì, in mezzo alla gente
    if (t - esposto < 1 && rng() < P.nasconde) {
      esposto = -Infinity;
      meta = rifugio(tv, io);
      if (meta) return cambia('nascondi', 2.5 + rng() * 1.5);
    }
    // 3. a caccia del più sospetto (tenendo conto della strada da fare)
    let best = -1;
    let bv = -Infinity;
    for (const [i, s] of sosp) {
      if (s < cacciaSoglia) continue;
      const e = tv.ents[i];
      const d = Math.hypot(e.x - io.x, e.y - io.y);
      // chi è esperto all'inizio non attraversa la piazza per colpire: farsi scoprire
      // presto costa tutti i secondi di sopravvivenza che restano
      if (P.calma && t < P.calma && d > 260) continue;
      if (zonaOk && Math.hypot(e.x - z.x, e.y - z.y) > z.r) continue;
      const v = s - d / 1500;
      if (v > bv) {
        bv = v;
        best = i;
      }
    }
    if (best >= 0) {
      bersaglio = best;
      return cambia('caccia');
    }
    // 4. una moneta nuova a portata
    for (const m of tv.monete) {
      if (!viste.has(m.id)) viste.set(m.id, rng() < P.notaMoneta ? t + reazione() * P.ritardoMoneta : Infinity);
      if (viste.get(m.id) > t) continue;
      viste.set(m.id, Infinity);
      const d = Math.hypot(m.x - io.x, m.y - io.y);
      const fuoriAcqua = Math.hypot(m.x - z.x, m.y - z.y) < z.rAtt - 10;
      if (d > P.raggioMoneta || d / VEL > m.resta - 0.5) continue;
      if (!fuoriAcqua && rng() > 0.4) continue; // nell'acqua ci si va meno volentieri
      if (minaccia >= 0 || rng() > avidita) continue;
      // chi è esperto non va a prendersela sotto il naso di qualcuno che sospetta
      if (P.prudenteMoneta && [...sosp].some(([i, s]) => s >= 0.4 && Math.hypot(tv.ents[i].x - m.x, tv.ents[i].y - m.y) < 400)) continue;
      moneta = m.id;
      return cambia('moneta');
    }
    // 5. un pugno a caso (solo chi è alle prime armi)
    if (P.azzardo && rng() < P.azzardo && io.cd <= 0) {
      const i = chiPrende(tv, io);
      if (i >= 0) {
        bersaglio = i;
        sosp.set(i, Math.max(sosp.get(i) || 0, P.soglia));
        if (traccia) perche.set(i, 'azzardo');
        return cambia('caccia');
      }
    }
    // 6. mimetizzarsi; se arriva l'acqua, il piano va rifatto dentro il cerchio
    if (zonaOk && passoZonaVisto !== Math.round(z.r)) {
      passoZonaVisto = Math.round(z.r);
      ripianifica(passo);
    }
  }

  // Un posto in mezzo alla gente, lontano da dove si è stati visti.
  function rifugio(tv, io) {
    let best = null;
    let bv = -Infinity;
    for (let k = 0; k < 8; k++) {
      const e = tv.ents[Math.floor(rng() * tv.ents.length)];
      if (!e || e.steso) continue;
      const d = Math.hypot(e.x - io.x, e.y - io.y);
      if (d < 80 || d > 380) continue;
      if (Math.hypot(e.x - tv.zona.x, e.y - tv.zona.y) > tv.zona.r - 40) continue;
      let gente = 0;
      for (const o of tv.ents) if (!o.steso && Math.hypot(o.x - e.x, o.y - e.y) < 90) gente++;
      const v = gente - d / 200;
      if (v > bv) {
        bv = v;
        best = { x: e.x, y: e.y };
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Ogni fotogramma: il pollice sul D-pad

  function muovi(tv, io, dt) {
    const t = tv.t;
    const att = passo.dir;
    if (modo === 'caccia') {
      const e = tv.ents[bersaglio];
      if (!e || e.steso) {
        cambia('folla');
        return muovi(tv, io, dt);
      }
      if (lato && t < lato.fino) return lato.dir;
      const d = Math.hypot(e.x - io.x, e.y - io.y);
      if (d <= PORTATA - 8) {
        if (pugnoAlle < 0 && io.cd <= 0 && (sosp.get(bersaglio) || 0) >= P.soglia) pugnoAlle = t + reazione();
        // un passo verso di lui per guardarlo (il pugno va dove si guarda)
        const fa = Math.atan2(io.face[1], io.face[0]);
        let da = Math.abs(Math.atan2(e.y - io.y, e.x - io.x) - fa);
        if (da > Math.PI) da = 2 * Math.PI - da;
        if (da > 0.6 && d > 22) return dirVerso(null, e.x - io.x, e.y - io.y);
        return [0, 0];
      }
      if (d > PORTATA + 4) pugnoAlle = -1;
      if (t < pausaFurba) return [0, 0];
      let tx = e.x;
      let ty = e.y;
      if (P.furbo && d > 90) {
        // di sbieco, non dritto addosso: chi è puntato se ne accorgerebbe
        const off = Math.min(120, d * 0.7) * latoCaccia;
        tx += (-(e.y - io.y) / d) * off;
        ty += ((e.x - io.x) / d) * off;
      }
      passo.dir = dirVerso(att, tx - io.x, ty - io.y);
      return passo.dir;
    }
    if (modo === 'fuga') {
      const e = tv.ents[bersaglio];
      if (!e) return [0, 0];
      passo.dir = dirVerso(att, io.x - e.x, io.y - e.y);
      return passo.dir;
    }
    if ((modo === 'moneta' || modo === 'nascondi') && t < pausaFurba) return [0, 0];
    if (modo === 'moneta') {
      const m = tv.monete.find((x) => x.id === moneta);
      if (!m) {
        cambia('folla');
        return muovi(tv, io, dt);
      }
      passo.dir = dirVerso(att, m.x - io.x, m.y - io.y);
      return passo.dir;
    }
    if (modo === 'nascondi' && meta) {
      const d = dirVerso(att, meta.x - io.x, meta.y - io.y);
      if (d[0] || d[1]) {
        passo.dir = d;
        return d;
      }
      meta = null;
      cambia('folla');
      ripianifica(passo);
    }
    // folla: come un passante (con qualche "tic" per chi è alle prime armi)
    if (t < nervosoFino) return dirNervosa;
    if (P.nervoso && rng() < P.nervoso * dt) {
      nervosoFino = t + 0.3 + rng() * 0.3;
      dirNervosa = [Math.floor(rng() * 3) - 1, Math.floor(rng() * 3) - 1];
      return dirNervosa;
    }
    const z = tv.zona;
    const zona = zonaAlle >= 0 && t < zonaAlle ? { x: z.x, y: z.y, r: z.rAtt } : z;
    const d = prossimoDir(passo, io, dt, { rng, zona });
    // a fine tappa a volte resta lì imbambolato troppo a lungo (e si fa notare)
    if (passo.pausa > 0 && pausaVista <= 0 && P.tic && rng() < P.tic) passo.pausa = PAUSA_MAX + 0.9 + rng() * 3.5;
    pausaVista = passo.pausa;
    return d;
  }

  return {
    osserva,
    // tv: quello che si vede sullo schermo; io: { i, x, y, vivo, blocco, cd, face } (dal telefono)
    decidi(tv, io, dt) {
      if (!io.vivo || tv.fine) return { j: [0, 0], p: false };
      if (io.blocco > 0) {
        pugnoAlle = -1;
        return { j: [0, 0], p: false };
      }
      tDec -= dt;
      if (tDec <= 0) {
        tDec = P.passo * (0.8 + 0.4 * rng());
        pensa(tv, io);
      }
      const j = muovi(tv, io, dt);
      let p = false;
      if (pugnoAlle >= 0 && tv.t >= pugnoAlle) {
        pugnoAlle = -1;
        const e = tv.ents[bersaglio];
        if (e && !e.steso && io.cd <= 0 && Math.hypot(e.x - io.x, e.y - io.y) <= PORTATA) {
          // c'è un passante in mezzo? meglio spostarsi di lato e riprovare
          if (rng() < P.controlla && chiPrende(tv, io) !== bersaglio) {
            const dx = e.x - io.x;
            const dy = e.y - io.y;
            const s = rng() < 0.5 ? 1 : -1;
            lato = { fino: tv.t + 0.3 + rng() * 0.2, dir: dirVerso(null, -dy * s + dx * 0.3, dx * s + dy * 0.3) };
          } else {
            p = true;
            if (traccia) traccia('pugno', perche.get(bersaglio) || '?');
          }
        }
      }
      return { j, p };
    },
    // per il banco e i test
    sospetti: () => sosp,
    modo: () => modo,
  };
}
