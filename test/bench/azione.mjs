// Banco di prova dell'agente "Azione": sumo, bocce, lumache, ali.
// Uso: node test/bench/azione.mjs [partite] [id,id,...] [--veloce]
//
// Per ogni gioco misura:
//  1. l'ordine dei livelli: una CPU Facile, una Normale e una Difficile nella stessa partita
//     (posti mescolati a ogni partita);
//  2. la taratura sulle persone: una CPU contro due "persone simulate" prese a caso dalla
//     popolazione descritta nelle tabelle qui sotto. Si conta quante volte la CPU finisce
//     davanti a una persona (confronto a coppie, pari = mezzo punto). Obiettivo della
//     specifica: Facile 20–30%, Normale 45–55%, Difficile 70–85%. Le persone simulate
//     mandano gli stessi dati del telefono (io.input) e vedono solo il telefono e lo
//     schermo grande (lo "guardano" intercettando le chiamate di disegno);
//  3. la durata con 3, 4 e 8 CPU dello stesso livello;
//  4. solo Bocce: l'equità dei posti, con 3, 4 e 5 persone simulate uguali (posti fissi).
//
// =============================================================================
// TABELLE DI RIFERIMENTO "UMANE" (ipotesi dichiarate)
// =============================================================================
//
// Popolazione = persone a una festa, telefono in mano, alla prima o seconda partita.
// "Percentile" = posto nella popolazione. Per costruzione una CPU al p-esimo percentile
// batte una persona presa a caso circa p volte su 100: per questo la specifica chiede
// Facile ~20°–30°, Normale ~50°, Difficile ~85°–90°.
//
// --- ALI (tocchi al secondo sullo schermo) -----------------------------------
// Studi sul finger tapping: con un dito solo 5–7 Hz; su vetro, per 10–15 s, una persona
// tipica fa 6–7 tocchi/s, una brava 8–9, chi alterna due dita 10–12 (il gioco ne accetta
// fino a 18). Nei 12 s il ritmo cala del 10–20% (fatica dell'avambraccio), si parte col
// tempo di reazione al VIA, gli intervalli tra tocchi variano del 10–20% e ci sono
// piccoli inciampi (dito che scivola, occhiata allo schermo): la media sui 12 s è ~12%
// sotto il ritmo "a braccio fresco". Modello: ritmo fresco log-normale, mediana 7,2
// tocchi/s, sigma 0,30.
//
//   percentile                  10°   25°   50°   75°   85°   90°   95°
//   tocchi/s a braccio fresco   4,9   5,9   7,2   8,8   9,8  10,6  11,8 (due dita)
//   tocchi/s medi sui 12 s      4,3   5,2   6,3   7,7   8,6   9,3  10,4
//   calo in 12 s                20%   18%   15%   12%   10%   10%    8%
//   CPU (misurate, media 12 s): Facile 4,9 (~22°), Normale 6,4 (~50°), Difficile 8,5 (~83°).
//   Il Difficile non supera mai 10,2 a braccio fresco: chi usa due dita lo batte.
//
// --- LUMACHE (giri di manovella al secondo) ----------------------------------
// Il telefono misura l'angolo del dito attorno al centro della ruota e manda la somma
// dei giri ogni 60 ms; l'host accetta al massimo 4,5 giri/s (con una piccola riserva
// di 1,5 giri) e 0,8 giri per messaggio. Movimenti circolari ripetuti col dito:
// 1–2 giri/s rilassati, 2–3 impegnati, 3,5–4,5 solo a cerchi piccolissimi e per pochi
// secondi. La corsa (45 giri) dura 15–30 s: la fatica conta (−15/−30% in 20–40 s) e ogni
// tanto si stacca il dito per riprendere la presa (0,2–0,8 s). Nel giro il dito non va
// a velocità costante (±12–25%: il polso rallenta in un punto del cerchio) e il ritmo
// oscilla del 5–10% da un secondo all'altro.
//
//   percentile            10°   25°   50°   75°   85°   90°
//   giri/s a dito fresco  1,85  2,1   2,45  2,85  3,1   3,25
//   dopo 20 s (fatica)    1,5   1,7   2,05  2,45  2,7   2,85
//   stacchi del dito/min  12    10    7     6     5     4
//   arrivo (45 giri)      ~29 s ~26 s ~23 s ~20 s ~18 s ~17 s
//   Modello: giri/s fresco log-normale, mediana 2,45, sigma 0,22.
//   CPU (misurate): Facile arriva in ~28 s (~22°), Normale ~22,4 s (~52°), Difficile ~17,8 s (~82°).
//
// --- BOCCE (fionda: angolo e forza) ------------------------------------------
// Si trascina la boccia all'indietro: la direzione dà l'angolo (max ±60°), la lunghezza
// la forza (barra colorata sul telefono). La distanza percorsa cresce col quadrato della
// velocità, e la persona non conosce questa "taratura": il primo tiro ha un errore
// sistematico che si corregge guardando dove si ferma la propria boccia (se nessuno
// l'ha toccata). Errori ipotizzati (deviazione standard); nella popolazione simulata la
// scala degli errori è log-normale (sigma 0,35) attorno alla persona media:
//
//                                 Facile       persona media  Difficile
//   errore iniziale di forza          35%          17%            6%    (sulla distanza)
//     (il principiante in media tira il 12% troppo piano, per paura di uscire)
//   errore iniziale di direzione      4,4°         2,0°           0,6°
//   stima della distanza a ogni tiro  20%          9%             3%
//   dito sulla forza (barra)          0,062        0,028          0,009 (su 0–1)
//   dito sulla direzione              7,5°         3,2°           1,2°
//   correzione dopo un tiro       a caso 10–125%   55%            85%   dell'errore visto
//   tiro storto (dito che scappa)     16%          5%             1,5%
// Il campo è rotondo e tutti tirano dalla stessa distanza (356 px, posti in cerchio):
// la boccia migliore della persona media finisce a ~16 cm dal pallino, quella del
// Difficile a ~11 cm. Il gioco è molto caotico (le bocce si scontrano spesso, vicino al
// pallino): per questo i parametri del Facile e del Difficile sono più lontani dalla
// media di quanto direbbero i loro percentili (come precisione della mano il Facile è
// sotto il 5°, il Difficile oltre il 98°), e anche così il Facile batte una persona più
// di 1 volta su 4. Taratura del 2026-09-30, dopo il passaggio ai posti in cerchio: con i
// valori di prima il Facile arrivava al 31% e il Difficile al 66%.
//
// Posti: su una linea chi stava al centro tirava da più vicino e vinceva molto più
// spesso (3 persone: 30/46/25%); su un arco a ventaglio la distanza era la stessa ma
// chi stava in mezzo si scontrava in modo diverso e vinceva ancora di più (30/41/29%).
// In cerchio, a distanze uguali, i posti si equivalgono (32/35/36%, 26/27/25/24%).
// Tattica: il principiante tira appena può, sempre al pallino; la persona brava aspetta
// di vedere dove si fermano le bocce degli altri, boccia la boccia avversaria che
// comanda, scansa le bocce avversarie sulla traiettoria, si piazza davanti al pallino
// quando comanda lei e, se all'ultimo tiro è già in testa, non tocca niente.
//
// --- SUMO (joystick + pugno) --------------------------------------------------
// Qui non c'è un "numero" unico: contano il tempo di reazione (cpu.reazione: mediana
// 0,50 / 0,36 / 0,28 s; persona media 0,33–0,36 s), la precisione del pollice sul
// joystick, la prudenza col bordo e la scelta del momento del pugno.
//
//                                        Facile   persona media   Difficile
//   dopo un colpo: pollice fermo (sorpresa) 0,25 s   0,18 s          0,14 s
//   poi nuova decisione (reazione mediana) 0,50 s   0,36 s          0,28 s
//   ogni quanto decide                   0,34 s      0,28 s          0,20 s
//   ogni quanto corregge la rotta        0,12 s      0,10 s          0,08 s
//   margine tenuto dal bordo (±30%)      60 px       90 px           110 px
//   + distanza "da pugno" se c'è pericolo 45%       50%             65%   di un volo (~260 px)
//   pugni a vuoto (misurati)             ~20%        ~8%             ~4%
//   schiva chi arriva col pugno carico   di rado     a volte         spesso
//   si mette tra il centro e il bersaglio quasi mai  4 volte su 10   quasi sempre
// La persona simulata di Sumo è una giocatrice "istintiva" (media): insegue il più
// vicino, tira quando è a tiro, torna verso il centro quando vede il bordo vicino,
// controsterza dopo un colpo col suo tempo di reazione (mediana 0,35 s).
//
// --- PRIMA DELLA RISCRITTURA ---------------------------------------------------
// I vecchi bot ignoravano il livello (node test/bench/base.mjs 40, F/N/D):
//   Sumo    pos. media F 1,75 N 2,23 D 2,02 (vince il Facile!), durata 37 s
//   Bocce   pos. media F 2,00 N 1,65 D 2,35
//   Lumache pos. media F 1,93 N 2,00 D 2,08
//   Ali     pos. media F 1,93 N 2,13 D 1,93
// =============================================================================

import { pathToFileURL } from 'node:url';
import { carica, partita, finto2d } from './lib.mjs';
import { gauss } from '../../public/games/cpu.js';
import { CAMPO as BOCCE_CAMPO, DISTANZA as BOCCE_DISTANZA, angoliPosti as bocceAngoliPosti } from '../../public/games/bocce/host.js';

const argomenti = process.argv.slice(2);
const VELOCE = argomenti.includes('--veloce');
const numeri = argomenti.filter((a) => /^\d+$/.test(a));
const VOLTE = Number(numeri[0]) || (VELOCE ? 60 : 200);
const elenco = argomenti.find((a) => /^[a-z,]+$/.test(a) && !a.startsWith('--'));
const GIOCHI = elenco ? elenco.split(',') : ['ali', 'lumache', 'bocce', 'sumo'];
const VOLTE_DURATA = Math.max(20, Math.round(VOLTE / 4));

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const NOMI = ['Facile', 'Normale', 'Difficile'];
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;

function mescola(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gioca `volte` partite mescolando i posti; riassume per ogni specifica (nell'ordine dato).
// `misura(r, id)` (facoltativa) estrae un numero da ogni partita (es. tocchi al secondo).
function serieMescolata(def, specs, volte, opzioni = {}, misura = null) {
  const n = specs.length;
  const acc = specs.map(() => ({ pos: 0, vittorie: 0, ultimi: 0, punti: 0, conPunti: 0, misura: 0, conMisura: 0 }));
  const coppie = specs.map(() => specs.map(() => 0));
  let durata = 0;
  const durate = [];
  for (let k = 0; k < volte; k++) {
    const ordine = mescola(specs.map((_, i) => i));
    const r = partita(def, ordine.map((i) => specs[i]), opzioni);
    durata += r.secondi;
    durate.push(r.secondi);
    const posDi = new Array(n);
    const puntiDi = new Array(n);
    ordine.forEach((i, seggio) => {
      const id = r.ids[seggio];
      posDi[i] = r.pos[id];
      puntiDi[i] = r.punteggi ? r.punteggi[id] : null;
      const v = misura ? misura.f(r, id) : null;
      if (typeof v === 'number' && isFinite(v)) {
        acc[i].misura += v;
        acc[i].conMisura++;
      }
    });
    const peggiore = Math.max(...posDi);
    for (let i = 0; i < n; i++) {
      acc[i].pos += posDi[i];
      if (posDi[i] === 1) acc[i].vittorie++;
      if (posDi[i] === peggiore && peggiore > 1) acc[i].ultimi++;
      if (typeof puntiDi[i] === 'number' && puntiDi[i] < 1e8) {
        acc[i].punti += puntiDi[i];
        acc[i].conPunti++;
      }
      for (let j = 0; j < n; j++) if (i !== j) coppie[i][j] += posDi[i] < posDi[j] ? 1 : posDi[i] === posDi[j] ? 0.5 : 0;
    }
  }
  durate.sort((a, b) => a - b);
  return {
    durata: durata / volte,
    durataMin: durate[0],
    durataMax: durate[durate.length - 1],
    durataMediana: durate[Math.floor(durate.length / 2)],
    giocatori: acc.map((a, i) => ({
      spec: specs[i].nome || (specs[i].umano ? 'persona' : NOMI[specs[i].livello ?? 1]),
      posMedia: a.pos / volte,
      vittorie: a.vittorie / volte,
      ultimi: a.ultimi / volte,
      puntiMedi: a.conPunti ? a.punti / a.conPunti : null,
      misura: a.conMisura ? a.misura / a.conMisura : null,
    })),
    coppie: coppie.map((r) => r.map((v) => v / volte)),
  };
}

function stampaSerie(titolo, s, fmtPunti = (v) => v.toFixed(1), misura = null) {
  console.log(`\n${titolo}  (durata media ${s.durata.toFixed(1)} s)`);
  for (const g of s.giocatori) {
    const pt = g.puntiMedi == null ? '' : `  punteggio medio ${fmtPunti(g.puntiMedi)}`;
    const mi = misura && g.misura != null ? `  ${misura.nome} ${g.misura.toFixed(misura.cifre ?? 2)}` : '';
    console.log(`  ${g.spec.padEnd(10)} pos. media ${g.posMedia.toFixed(2)}  vince ${pct(g.vittorie)}  ultimo ${pct(g.ultimi)}${pt}${mi}`);
  }
}

// Una CPU di ogni livello contro due persone simulate prese a caso dalla popolazione.
function controPersone(def, persona, volte, opzioni, misura, fmtPunti) {
  console.log(`\n  CPU contro 2 persone simulate (${volte} partite per livello): quante volte la CPU finisce davanti a una persona`);
  const fmtM = (g) => {
    if (misura && g.misura != null) return `${misura.nome} ${g.misura.toFixed(misura.cifre ?? 2)}`;
    return g.puntiMedi != null && fmtPunti ? fmtPunti(g.puntiMedi) : '';
  };
  for (const livello of [0, 1, 2]) {
    const specs = [{ livello }, { umano: persona, nome: 'persona 1' }, { umano: persona, nome: 'persona 2' }];
    const s = serieMescolata(def, specs, volte, opzioni, misura);
    const batte = (s.coppie[0][1] + s.coppie[0][2]) / 2;
    const obiettivo = ['20–30%', '45–55%', '70–85%'][livello];
    const g = s.giocatori;
    console.log(
      `  ${NOMI[livello].padEnd(10)} davanti alla persona ${pct(batte)}  (obiettivo ${obiettivo})  vince la partita ${pct(g[0].vittorie)}  CPU ${fmtM(g[0])}, persone ${fmtM({ misura: (g[1].misura + g[2].misura) / 2, puntiMedi: (g[1].puntiMedi + g[2].puntiMedi) / 2 })}`,
    );
  }
  const s = serieMescolata(def, [1, 2, 3].map((k) => ({ umano: persona, nome: `persona ${k}` })), Math.round(volte / 2), opzioni);
  console.log(`  (controllo: persona contro persona ${pct((s.coppie[0][1] + s.coppie[0][2]) / 2)})`);
}

function durate(def, opzioni, quanti = [3, 4, 8]) {
  console.log(`\n  Durata con CPU dello stesso livello (${VOLTE_DURATA} partite): media [min–max]`);
  for (const n of quanti) {
    const righe = [];
    for (const livello of [0, 1, 2]) {
      const s = serieMescolata(def, Array.from({ length: n }, () => ({ livello })), VOLTE_DURATA, opzioni);
      righe.push(`${NOMI[livello][0]} ${s.durata.toFixed(1)} s [${s.durataMin.toFixed(0)}–${s.durataMax.toFixed(0)}]`);
    }
    console.log(`  ${String(n).padStart(2)} CPU: ${righe.join('   ')}`);
  }
}

// Equità dei posti: `n` persone simulate prese dalla stessa popolazione, ognuna sempre
// allo stesso posto. In un gioco giusto ogni posto vince circa 1 volta su n.
function equitaPosti(def, persona, volte, opzioni, quanti = [3, 4, 5]) {
  console.log(`\n  Equità dei posti (${volte} partite, persone simulate, posti fissi): quante volte vince ogni posto`);
  for (const n of quanti) {
    const vinte = new Array(n).fill(0);
    for (let k = 0; k < volte; k++) {
      const r = partita(def, Array.from({ length: n }, (_, i) => ({ umano: persona, nome: `persona ${i + 1}` })), opzioni);
      r.ids.forEach((id, i) => {
        if (r.pos[id] === 1) vinte[i]++;
      });
    }
    const margine = 200 * Math.sqrt(((1 / n) * (1 - 1 / n)) / volte);
    console.log(`  ${n} persone: ${vinte.map((v) => pct(v / volte)).join(' /')}   (atteso ${pct(1 / n)} ± ${margine.toFixed(0)} per posto)`);
  }
}

// "Occhio" delle persone simulate: legge lo schermo grande intercettando le chiamate
// di disegno del contesto (avatar e teste), come farebbe chi guarda la TV.
// Serve `disegna: true` nelle opzioni della partita (il banco disegna 3 volte al secondo).
// Per ogni fotogramma: avatar (posizione e posa), teste (es. le bocce), etichette (nomi).
function occhio(ctx) {
  if (ctx.__occhio) return ctx.__occhio;
  const o = { t: -1, avatar: new Map(), teste: new Map(), etichette: new Set() };
  const perAv = new Map(ctx.giocatori.map((p) => [p.av, p.id]));
  const perNome = new Map(ctx.giocatori.map((p) => [p.nome, p.id]));
  const fotogramma = () => {
    if (o.t === ctx.tempo) return;
    o.t = ctx.tempo;
    o.avatar = new Map();
    o.teste = new Map();
    o.etichette = new Set();
  };
  const { avatar, testa, etichetta } = ctx;
  ctx.avatar = (g, av, x, y, h, opz) => {
    fotogramma();
    const id = perAv.get(av);
    if (id) o.avatar.set(id, { x, y, h, pose: opz && opz.pose });
    return avatar(g, av, x, y, h, opz);
  };
  ctx.testa = (g, av, x, y, r, opz) => {
    fotogramma();
    const id = perAv.get(av);
    if (id) {
      if (!o.teste.has(id)) o.teste.set(id, []);
      o.teste.get(id).push({ x, y, r });
    }
    return testa(g, av, x, y, r, opz);
  };
  ctx.etichetta = (g, testo, ...resto) => {
    fotogramma();
    const id = perNome.get(testo);
    if (id) o.etichette.add(id);
    return etichetta(g, testo, ...resto);
  };
  ctx.__occhio = o;
  return o;
}

// =============================================================================
// ALI
// =============================================================================

// Persona simulata: stesso modello di tocco della tabella, parametri presi a caso
// dalla popolazione. Parte quando il telefono mostra il VIA, dopo il suo tempo di reazione.
function personaAli(io) {
  const z = gauss();
  const ritmo = clamp(7.2 * Math.exp(0.3 * z), 3.5, 13);
  const calo = clamp(0.15 - 0.025 * z + gauss() * 0.03, 0.04, 0.3);
  const cv = clamp(0.14 - 0.02 * z, 0.07, 0.25);
  const inciampo = clamp(0.013 * Math.exp(-0.5 * z), 0.003, 0.05);
  const sprint = Math.random() * 0.1;
  const reazione = 0.34 * Math.exp(gauss() * 0.2);
  let t = -1;
  let prossimo = 0;
  let deriva = 0;
  let daMandare = 0;
  let ultimoInvio = -1;
  let resto = 12;
  let letti = 0;
  return {
    aggiorna(dt) {
      const v = io.vista();
      while (letti < io.messaggi.length) {
        const m = io.messaggi[letti++];
        if (typeof m.r === 'number') resto = m.r;
      }
      if (!v || v.fase !== 'via') return;
      if (t < 0) {
        t = 0;
        prossimo = reazione;
      }
      t += dt;
      resto -= dt;
      while (prossimo <= t) {
        daMandare++;
        deriva = deriva * 0.88 + gauss() * 0.02;
        let r = ritmo * (1 - (calo * prossimo) / 12) * (1 + deriva);
        if (prossimo < 1.5) r *= 1.05;
        else if (resto < 2.2) r *= 1 + sprint;
        let d = Math.exp(gauss() * cv) / r;
        if (Math.random() < inciampo) d += 0.12 + Math.random() * 0.4;
        prossimo += d;
      }
      if (daMandare && t - ultimoInvio >= 0.06) {
        io.input({ b: daMandare });
        daMandare = 0;
        ultimoInvio = t;
      }
    },
  };
}

// =============================================================================
// LUMACHE
// =============================================================================

// Persona simulata: dito sulla manovella con i parametri della tabella, presi a caso
// dalla popolazione. Sa solo quello che le dice il telefono (percentuale e posizione,
// ogni 0,7 s): quando vede il traguardo vicino dà tutto.
function personaLumache(io) {
  const z = gauss();
  const w0 = clamp(2.45 * Math.exp(0.22 * z), 1.3, 4.2);
  const kf = 0.009 * Math.exp(-0.25 * z + gauss() * 0.2);
  const pPausa = 0.12 * Math.exp(-0.4 * z);
  const sprint = 0.04 + Math.random() * 0.1;
  const polso = 0.12 + Math.random() * 0.13;
  const inizio = 0.34 * 1.4 * Math.exp(gauss() * 0.2);
  let t = 0;
  let w = 0;
  let fat = 0;
  let pausa = 0;
  let giro = Math.random();
  let spinta = 1;
  let deriva = 0;
  let tGuarda = 0;
  let acc = 0;
  let tInvio = 0;
  let perc = 0;
  let letti = 0;
  return {
    aggiorna(dt) {
      t += dt;
      while (letti < io.messaggi.length) {
        const m = io.messaggi[letti++];
        if (typeof m.perc === 'number') perc = m.perc;
      }
      const v = io.vista();
      if (t < inizio || (v && v.arrivato)) return;
      tGuarda -= dt;
      if (tGuarda <= 0) {
        tGuarda = 0.5 + Math.random() * 0.7;
        spinta = perc > 0.89 ? 1 + sprint : 1;
        deriva = deriva * 0.7 + gauss() * 0.04;
      }
      if (pausa > 0) {
        pausa -= dt;
        w *= Math.exp(-14 * dt);
        fat = Math.max(0, fat - 0.04 * dt);
      } else {
        w += (w0 * (1 - fat) * spinta * (1 + deriva) - w) * Math.min(1, 2.5 * dt);
        if (Math.random() < (pPausa + fat * 0.6) * dt) pausa = 0.2 + Math.random() * 0.4;
      }
      fat = Math.min(0.6, fat + kf * (w / w0) ** 2 * dt);
      const d = w * (1 + polso * Math.sin(2 * Math.PI * giro)) * dt;
      giro += d;
      acc += d;
      tInvio -= dt;
      if (tInvio <= 0) {
        tInvio += 0.06;
        if (acc > 0) io.input({ g: acc });
        acc = 0;
      }
    },
  };
}

// =============================================================================
// BOCCE
// =============================================================================

// Geometria che una persona vede sullo schermo: campo rotondo con il pallino al centro,
// posti di tiro sull'arco del bordo, tutti alla stessa distanza (quella del gioco), fisica
// "a occhio". Il proprio posto si riconosce sullo schermo (il cerchio col proprio colore).
const BOC = { ...BOCCE_CAMPO, DIST: BOCCE_DISTANZA, DECEL: 620, V_MIN: 280, V_MAX: 1500, ANG: Math.PI / 3, R: 26 };
const bocPot = (d) => (Math.sqrt(2 * BOC.DECEL * Math.max(0, d)) - BOC.V_MIN) / (BOC.V_MAX - BOC.V_MIN);
const bocDist = (pot) => (BOC.V_MIN + clamp(pot, 0, 1) * (BOC.V_MAX - BOC.V_MIN)) ** 2 / (2 * BOC.DECEL);

// Persona simulata: mira sempre al pallino (sul telefono: dritto in su), tira quando le
// va (2–7 s), con gli errori della tabella scalati sulla sua bravura (presa a caso dalla
// popolazione) e corregge il tiro guardando dove si è fermata la sua ultima boccia, se
// nessuno l'ha toccata. Le distanze le stima "dal suo posto": di lato e in avanti.
function personaBocce(io) {
  const o = occhio(io.ctx);
  const posto = io.ctx.giocatori.findIndex((p) => p.id === io.id);
  const th = bocceAngoliPosti(io.ctx.giocatori.length)[posto];
  const sx = BOC.CX + Math.sin(th) * BOC.DIST;
  const sy = BOC.CY + Math.cos(th) * BOC.DIST;
  const fx = -Math.sin(th);
  const fy = -Math.cos(th);
  const z = gauss();
  const m = Math.exp(-0.35 * z);
  const G = Math.PI / 180;
  let biasD = gauss() * 0.17 * m;
  let biasA = gauss() * 2 * m * G;
  const sD = 0.09 * m;
  const sPot = 0.028 * m;
  const sA = 3.2 * m * G;
  const impara = clamp(0.55 + 0.12 * z, 0.2, 0.85);
  const storto = 0.05 * m;
  let ondata = 0;
  let t = 0;
  let quando = 0;
  let tiro = null;
  const mie = () => o.teste.get(io.id) || [];
  return {
    aggiorna(dt) {
      const v = io.vista();
      if (!v) return;
      if (v.ondata !== ondata) {
        ondata = v.ondata;
        t = 0;
        quando = 2 + Math.random() * 5;
      }
      if (!v.puoi) return;
      t += dt;
      // mezzo secondo dopo l'inizio dell'ondata guarda dov'è finita la sua ultima boccia
      if (tiro && t > 0.5) {
        const viste = mie();
        if (!tiro.storto && viste.length === tiro.prima + 1) {
          const b = viste[viste.length - 1];
          const dx = b.x - sx;
          const dy = b.y - BOC.R * 0.1 - sy;
          const lat = -dx * fy + dy * fx;
          const avanti = dx * fx + dy * fy;
          const L = bocDist(tiro.pot);
          const toccata = Math.hypot(lat - Math.sin(tiro.a) * L, avanti - Math.cos(tiro.a) * L) > 15;
          if (!toccata) {
            const ox = lat + gauss() * 7;
            const oy = avanti + gauss() * 7;
            biasD -= impara * (Math.hypot(ox, oy) / BOC.DIST - 1);
            biasA -= impara * Math.atan2(ox, oy);
          }
        }
        tiro = null;
      }
      if (t < quando || tiro) return;
      let a = biasA + gauss() * sA;
      let pot = bocPot(BOC.DIST * (1 + biasD + gauss() * sD)) + gauss() * sPot;
      const sbaglia = Math.random() < storto;
      if (sbaglia) {
        if (Math.random() < 0.5) pot *= 0.55 + Math.random() * 0.25;
        else a += (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 6) * G;
      }
      a = clamp(a, -BOC.ANG, BOC.ANG);
      pot = clamp(pot, 0.07, 1);
      tiro = { a, pot, storto: sbaglia, prima: mie().length };
      io.input({ l: [a, pot] });
    },
  };
}

// =============================================================================
// SUMO
// =============================================================================

// Per guardare lo schermo più spesso delle 3 volte al secondo del banco, la persona
// simulata chiede al gioco di ridisegnarsi (su una tela finta) ogni 0,1 s.
function conOcchi(def) {
  return { ...def, crea: (ctx) => (ctx.__gioco = def.crea(ctx)) };
}

// Persona simulata "istintiva": guarda lo schermo ogni 0,1 s (posizioni dagli avatar
// disegnati, chi ha appena tirato dalla posa del guantone), sente la vibrazione quando
// la colpiscono. Insegue il più vicino (o chi ha appena sprecato il pugno), tira quando
// è a tiro, torna verso il centro quando vede il bordo vicino, controsterza dopo un
// colpo col suo tempo di reazione. Bravura presa a caso dalla popolazione.
function personaSumo(io) {
  const { ctx } = io;
  const o = occhio(ctx);
  const tela = finto2d();
  const n = ctx.giocatori.length;
  const R0 = Math.min(620, 440 + 12 * n);
  const raggio = (t) => R0 - R0 * 0.62 * clamp((t - 20) / 50, 0, 1);
  const z = gauss();
  const reazione = () => Math.min(2, 0.35 * Math.exp(-0.12 * z + gauss() * 0.2));
  const margine = clamp(85 + 25 * z, 40, 150);
  const voglia = clamp(0.5 + 0.2 * gauss(), 0.1, 0.9);
  const passo = 0.27;
  let t = 0;
  let tGuarda = 0;
  let tDecidi = 0.3;
  let tInvio = 0;
  let meta = [0, 0];
  let fretta = 0.8;
  let jx = 0;
  let jy = 0;
  let mira = null;
  let tPugno = -9;
  let pugnoTra = -1;
  let letti = 0;
  let me = null;
  let pv = null;
  const visti = new Map();
  const mondo = (a) => [a.x - 960, (a.y - 590) / 0.72];
  return {
    aggiorna(dt) {
      t += dt;
      const v = io.vista();
      if (v && v.vivo === false) return;
      while (letti < io.messaggi.length) {
        const m = io.messaggi[letti++];
        if (m.colpo >= 1) tDecidi = Math.min(tDecidi, t + reazione()); // "mi hanno colpito!"
      }
      if (t >= tGuarda) {
        tGuarda = t + 0.1;
        ctx.__gioco.disegna(tela);
        for (const [id, a] of o.avatar) {
          if (!o.etichette.has(id)) continue; // solo chi è ancora sul ghiaccio
          const [x, y] = mondo(a);
          if (id === io.id) {
            if (me) pv = [(x - me[0]) / 0.1, (y - me[1]) / 0.1];
            me = [x, y];
            continue;
          }
          const s = visti.get(id) || { x, y, tirato: -9 };
          s.x = x;
          s.y = y;
          if (a.pose === 'pugno') s.tirato = t;
          s.t = t;
          visti.set(id, s);
        }
        for (const [id, s] of visti) if (s.t !== t) visti.delete(id);
      }
      if (!me || !pv) return;
      const R = raggio(t);
      const r = Math.hypot(me[0], me[1]) || 1;
      if (t >= tDecidi) {
        tDecidi = t + passo * (0.8 + Math.random() * 0.4);
        mira = null;
        const vr = (me[0] * pv[0] + me[1] * pv[1]) / r;
        if (r + Math.max(0, vr) * 0.35 + margine > R) {
          meta = [(me[0] / r) * R * 0.3, (me[1] / r) * R * 0.3];
          fretta = 1.2;
        } else {
          let best = null;
          let bd = Infinity;
          for (const s of visti.values()) {
            const d = Math.hypot(s.x - me[0], s.y - me[1]) - (t - s.tirato < 0.9 ? 120 : 0);
            if (d < bd) {
              bd = d;
              best = s;
            }
          }
          const d = best ? Math.hypot(best.x - me[0], best.y - me[1]) : Infinity;
          if (best && d < 160 && t - tPugno > 1.05 && Math.random() < 0.7) {
            mira = best;
            pugnoTra = t + 0.05 + Math.random() * 0.08;
          } else if (best && (Math.random() < voglia || d < 220 || t > 45)) {
            const lim = R - margine - 40;
            let gx = best.x - ((best.x - me[0]) / d) * 100;
            let gy = best.y - ((best.y - me[1]) / d) * 100;
            const rg = Math.hypot(gx, gy);
            if (rg > lim) {
              gx *= lim / rg;
              gy *= lim / rg;
            }
            meta = [gx, gy];
            fretta = 1;
          } else {
            meta = [meta[0] * 0.5 + (Math.random() - 0.5) * R * 0.3, meta[1] * 0.5 + (Math.random() - 0.5) * R * 0.3];
            fretta = 0.6;
          }
        }
      }
      // pollice: verso il bersaglio per il pugno, altrimenti verso la meta frenando in tempo
      let tx;
      let ty;
      if (mira) {
        const d = Math.hypot(mira.x - me[0], mira.y - me[1]) || 1;
        tx = ((mira.x - me[0]) / d) * 0.7;
        ty = ((mira.y - me[1]) / d) * 0.7;
      } else {
        const ex = meta[0] - me[0];
        const ey = meta[1] - me[1];
        const d = Math.hypot(ex, ey);
        const vv = d > 8 ? Math.min(420 * fretta, Math.sqrt(2 * 1250 * (d - 8))) : 0;
        tx = ((d > 8 ? (ex / d) * vv : 0) * 1.83 + ((d > 8 ? (ex / d) * vv : 0) - pv[0]) * 6) / 1500;
        ty = ((d > 8 ? (ey / d) * vv : 0) * 1.83 + ((d > 8 ? (ey / d) * vv : 0) - pv[1]) * 6) / 1500;
        const m = Math.hypot(tx, ty);
        if (m > 1) {
          tx /= m;
          ty /= m;
        }
      }
      const k = Math.min(1, dt / 0.11);
      jx += (tx - jx) * k;
      jy += (ty - jy) * k;
      if (t >= tInvio) {
        tInvio = t + 0.05;
        io.input({ j: [jx, jy] });
      }
      if (pugnoTra >= 0 && t >= pugnoTra) {
        pugnoTra = -1;
        tPugno = t;
        io.input({ s: 1 });
      }
    },
  };
}

// =============================================================================

const GIOCO = {
  sumo: {
    persona: personaSumo,
    vedeTutto: true,
    // secondi passati sul ghiaccio (fino alla caduta o alla fine)
    misura: { nome: 'in piedi s', cifre: 1, f: (r, id) => (/Ancora/.test(r.dettagli[id] || '') ? r.secondi : Number((r.dettagli[id] || '').match(/dopo ([\d.,]+)/)?.[1]?.replace(',', '.'))) },
  },
  bocce: {
    persona: personaBocce,
    opzioniPersona: { disegna: true },
    fmt: (v) => `${(v / 4).toFixed(0)} cm`,
    posti: true,
  },
  lumache: {
    persona: personaLumache,
    // secondi per arrivare al traguardo (solo chi arriva)
    misura: { nome: 'arrivo s', cifre: 1, f: (r, id) => Number((r.dettagli[id] || '').match(/Arrivata in ([\d.,]+)/)?.[1]?.replace(',', '.')) },
  },
  ali: {
    persona: personaAli,
    fmt: (v) => `${v.toFixed(1)} m`,
    // tocchi al secondo nei 12 s (dal dettaglio "x m · N battiti")
    misura: { nome: 'tocchi/s', f: (r, id) => Number((r.dettagli[id] || '').match(/(\d+) battiti/)?.[1]) / 12 },
  },
};

// Le persone simulate e le serie si possono riusare da altri script: il banco parte solo se lanciato.
export { GIOCO, serieMescolata, occhio, conOcchi };

const lanciato = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
for (const id of lanciato ? GIOCHI : []) {
  const g = GIOCO[id];
  if (!g) continue;
  const def = g.vedeTutto ? conOcchi(await carica(id)) : await carica(id);
  const opzioni = g.opzioni || {};
  console.log(`\n=== ${def.emoji} ${def.nome} ===`);
  const s = serieMescolata(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], VOLTE, opzioni, g.misura);
  stampaSerie(`F/N/D, ${VOLTE} partite`, s, g.fmt, g.misura);
  if (g.persona) controPersone(def, g.persona, Math.round(VOLTE / 2), { ...opzioni, ...(g.opzioniPersona || {}) }, g.misura, g.fmt);
  durate(def, opzioni);
  if (g.posti) equitaPosti(def, g.persona, Math.max(200, Math.round(VOLTE / 2)), { ...opzioni, ...(g.opzioniPersona || {}) });
}
