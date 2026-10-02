// Banco di prova dell'agente "Precisione": Filo Scottante, Mano Ferma, Colore Perfetto,
// Twister delle Dita. Uso:
//   node test/bench/precisione.mjs [volte=100] [filo,manoferma,colore,twister]
//
// Per ogni gioco: tabella di riferimento "umana" (qui sotto, con le ipotesi), partite
// Facile/Normale/Difficile a 3, misure del singolo livello confrontate con la tabella,
// 1 contro 1 con una "persona simulata" media (che manda gli stessi dati del telefono),
// durate con 3, 4 e 8 CPU dello stesso livello.
//
// Come si leggono le fasce: il Facile imita il 20°–30° percentile delle persone, il
// Normale la persona mediana, il Difficile l'85°–90° percentile (SPECIFICA.md). Il
// confronto decisivo è il testa a testa con la persona media: F 20–30%, N 45–55%, D 70–85%.
//
// ============================================================================
// ⚡ FILO SCOTTANTE — riferimento umano
// ============================================================================
// Scala: il riquadro 1000x1600 del percorso sta in ~390x760 px di telefono, cioè
// 1000 unità ≈ 6 cm. Corridoi larghi 9,5 / 7,3 / 5,6 mm; percorsi lunghi in media
// 21 / 28 / 34 cm (6, 8, 10 tornanti).
// Ipotesi: legge dello steering (Accot & Zhai 1997) T = a + b·L/W con il dito su un
// percorso curvo b ≈ 0,15–0,2 s (circa il doppio di un tunnel dritto con lo stilo);
// in gara si va più veloci che in laboratorio, quindi qualche scossa per livello, di più
// nei tornanti e nei corridoi stretti. Ogni scossa costa 0,7 s di blocco + ~0,7 s per
// ritoccare il checkpoint + la strada persa (in media 1/6 di livello). Metà circa della
// differenza tra due tentativi è fortuna (dove capitano le scosse): per questo il 25° e
// l'87° percentile stanno a ~6–7 s dalla mediana e non di più (il 25° percentile batte la
// mediana ~1 volta su 4).
//
//                          mediana: tracciare      scosse
//   livello 1 (21 cm, 9,5 mm)      4,0 s             0,6
//   livello 2 (28 cm, 7,3 mm)      6,0 s             1,0
//   livello 3 (34 cm, 5,6 mm)      9,0 s             1,6
//                            25° perc.   mediana   87° perc.
//   tempo totale (con pause)   ~38 s      ~31 s      ~25 s
//   scosse                     ~4,5       ~3,2       ~1,9
//
// ============================================================================
// ✍️ MANO FERMA — riferimento umano (punti 0–100 di logica.js, foglio 1000x1000 ≈ 6 cm)
// ============================================================================
//                               25° perc.   mediana   87° perc.
//   cerchio perfetto               72         80         87
//   taglio a metà                  78         86         93      (scarto dal 50%: 7,3 / 4,7 / 2,3 punti)
//   punti a memoria                38         50         62      (errore medio: 110 / 90 / 68 unità)
//   totale                        ~188       ~216       ~242
//   tempi: cerchio 2–5 s, taglio 3–6 s, punti: primo tocco ~1 s dopo la sparizione, poi ~0,5 s a tocco
//
// Ipotesi.
// - Cerchio: il punteggio è 100·(1 − 4·rms/r). I cerchi a mano libera sono ovali (rapporto tra gli
//   assi ~1,05–1,15, cioè rms ≈ 2–3,5% del raggio), a spirale (il raggio cambia del 3–6% dall'inizio
//   alla fine), con qualche bozzo lento (~1%) e poco tremolio sul vetro. Totale rms ≈ 5% → 80 punti.
//   Circa 1 persona su 30 stacca il dito troppo presto o fa un bozzo grosso (punteggio sotto 50).
// - Taglio: il punteggio è 100 − 3·scarto%. L'occhio stima il baricentro di una forma con un
//   errore del 3–6% della sua grandezza ed è attirato dal centro del riquadro che la contiene; una
//   retta per il baricentro non divide mai esattamente a metà (fino a 44/56). Chi confronta a occhio
//   le due metà corregge in parte (legge di Weber per le aree: 7–12%).
// - Punti: la memoria visiva a breve termine tiene 3–4 oggetti (Luck & Vogel 1997); con 2,8 s di
//   osservazione se ne fissano bene ~3,5 con un errore di ~4–5 mm (70 unità), gli altri restano solo
//   come "zona" (~250 unità, ridotte dall'abbinamento migliore del punteggio). Le posizioni ricordate
//   si stringono verso il centro del gruppo (tendenza centrale, Huttenlocher 1991) e si sfocano
//   col passare dei secondi.
//
// ============================================================================
// 🌈 COLORE PERFETTO — riferimento umano (distanza CIEDE2000; punti = 100 − 2·ΔE)
// ============================================================================
//                                   25° perc.   mediana   87° perc.    fascia indicata
//   round 1 (colore visibile)          6,5          5         3,8          4–8
//   round 2 (visto per 3 s)           13           10         7,3          8–14
//   round 3 (visto per 1,5 s)         16           12,5       9,2         10–18
//   punti totali                     ~223         ~242       ~258
//   conferma: 6–9 s col colore visibile, 4–6 s a memoria (si fa presto per non dimenticare)
//
// Verifica delle fasce: la persona simulata qui sotto usa solo parametri da letteratura e
// ne escono ΔE ≈ 5 / 10 / 12, dentro le fasce 4–8, 8–14, 10–18. Ipotesi:
// - Col colore visibile l'errore non va a zero: TV e telefono non mostrano lo stesso colore
//   (schermi non calibrati, ~2–4 ΔE00 soprattutto di luminosità), si confrontano due schermi
//   lontani (la soglia di differenza è 2–3 volte quella di due colori affiancati) e il dito sul
//   quadrato saturazione/luminosità (~4 cm) sbaglia di qualche percento.
// - A memoria (Bae et al. 2015; Pérez-Carpinell et al. 1998): la tinta si ricorda con uno scarto
//   tipico di 10–15° e scivola verso il colore "tipico" più vicino; la saturazione si ricorda più
//   alta (colori della memoria più vividi) e la luminosità va verso il medio. Con 1,5 s di
//   osservazione la traccia è più povera (errore di memoria ~×1,3–1,5).
// - La tinta si azzecca meglio di saturazione e luminosità: sull'anello basta un colpo d'occhio,
//   nel quadrato S e V si scambiano facilmente (troppo scuro o troppo spento?).
//
// ============================================================================
// 🖐️ TWISTER DELLE DITA — riferimento umano (secondi dalla partenza)
// ============================================================================
// Cinematica del gioco (regole.js + phone.js, telefono tipico 390x760 px): cerchi di raggio
// 37 px (~6 mm); si esce oltre 1,45 raggi (54 px, ~8,6 mm). Dal secondo 17,8 si muovono con
// ampiezza che cresce fino a 51 px (~8 mm) in 20 s e velocità angolare w·(1 + 2t/25) che non
// smette di salire. Con le dita ferme si regge finché l'escursione (fino a √2 volte l'ampiezza)
// resta sotto i 54 px, cioè fino a ~30–32 s; poi bisogna inseguire 5 cerchi indipendenti con
// una mano sola. Persone: ritardo visuo-motorio 0,13–0,22 s, attenzione che passa da un dito
// all'altro ogni 0,3–0,45 s, dita poco indipendenti (l'anulare è il peggiore, Häger-Ross e
// Schieber 2000), stanchezza. Siccome la difficoltà sale in fretta, persone di bravura diversa
// cadono a pochi secondi di distanza: la gara si decide tra i 28 e i 40 s e al minuto non
// arriva praticamente nessuno. Posare un dito: reazione (~0,4 s) + spostamento (Fitts, più
// lento a ogni dito già giù) ≈ 1–1,5 s sui 3 concessi; chi si distrae o deve allungarsi per il
// 4°–5° dito a volte non ce la fa.
//
//                                            25° perc.   mediana   87° perc.
//   esce mentre posa le dita (0–17,8 s)         17%         7%         3%    (quasi sempre 4°–5° dito)
//   mediana di chi ha posato tutte le dita      31 s        34 s       37 s
//   ancora in gioco a 35 s                       5%        30%        75%
//   ancora in gioco a 40 s                       0%         1%         8%
//   ancora in gioco a 60 s                       0%         0%        ~0%
//
// ============================================================================

import { carica, partita, serie, stampa } from './lib.mjs';
import { creaCpu } from '../../public/games/cpu.js';
import { tracciaCerchio, tagliaAOcchio, memorizzaPunti, toccaPunti } from '../../public/games/manoferma/host.js';
import { punteggioCerchio, punteggioTaglio, punteggioPunti, creaForma, creaPunti } from '../../public/games/manoferma/logica.js';
import { scartoSchermo, vediColore, pianoColore, labToRgb } from '../../public/games/colore/host.js';
import { hsvToRgb, rgbToHsv, rgbToLab, deltaE2000 } from '../../public/shared/util.js';
import { appare } from '../../public/games/twister/regole.js';

const volte = Number(process.argv[2]) || 100;
const solo = process.argv[3] ? process.argv[3].split(',') : ['filo', 'manoferma', 'colore', 'twister'];

const NOMI = ['Facile', 'Normale', 'Difficile'];
const OBIETTIVO_VS = [
  [0.2, 0.3],
  [0.45, 0.55],
  [0.7, 0.85],
];
const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
};
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const pc = (v) => `${(v * 100).toFixed(0)}%`;
const lognorm = (s) => Math.exp(gauss() * s);
function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

const verdetti = [];
function verifica(gioco, cosa, ok, valore) {
  verdetti.push({ gioco, cosa, ok, valore });
  console.log(`  ${ok ? '✔' : '✘'} ${cosa}: ${valore}`);
}

// 1 contro 1 con la persona simulata: vittoria = 1, pari = 0,5.
function testaATesta(def, livello, umano, n) {
  let v = 0;
  for (let k = 0; k < n; k++) {
    const r = partita(def, [{ livello }, { umano, nome: 'Persona' }]);
    v += r.pos.p0 < r.pos.p1 ? 1 : r.pos.p0 === r.pos.p1 ? 0.5 : 0;
  }
  return v / n;
}

function ordineLivelli(def, n, caotico = false) {
  const s = serie(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], n);
  stampa(`${def.emoji} ${def.nome} — Facile/Normale/Difficile, ${n} partite`, s);
  const [F, N, D] = s.giocatori;
  const soglia = caotico ? 0.4 : 0.5;
  verifica(def.id, 'ordine D < N < F (posizione media)', D.posMedia < N.posMedia && N.posMedia < F.posMedia, `${D.posMedia.toFixed(2)} < ${N.posMedia.toFixed(2)} < ${F.posMedia.toFixed(2)}`);
  verifica(def.id, `D vince almeno il ${pc(soglia)}`, D.vittorie >= soglia, pc(D.vittorie));
  verifica(def.id, `F ultimo almeno il ${pc(soglia)}`, F.ultimi >= soglia, pc(F.ultimi));
  return s;
}

function controPersona(def, umano, n) {
  console.log(`\n  1 contro 1 con la persona simulata media (${n} partite per livello):`);
  for (let l = 0; l < 3; l++) {
    const v = testaATesta(def, l, umano, n);
    const [a, b] = OBIETTIVO_VS[l];
    // margine di 5 punti per il rumore statistico di un campione finito
    verifica(def.id, `${NOMI[l].padEnd(9)} vince ${pc(v)} (obiettivo ${pc(a)}–${pc(b)})`, v >= a - 0.05 && v <= b + 0.05, pc(v));
  }
}

function durate(def, n, limite) {
  const righe = [];
  for (const quanti of [3, 4, 8]) {
    for (let l = 0; l < 3; l++) {
      let tot = 0;
      let max = 0;
      for (let k = 0; k < n; k++) {
        const r = partita(def, Array.from({ length: quanti }, () => ({ livello: l })));
        tot += r.secondi;
        max = Math.max(max, r.secondi);
      }
      righe.push(`${quanti}×${NOMI[l][0]} ${f1(tot / n)} s (max ${f1(max)})`);
      if (max > limite) verifica(def.id, `durata con ${quanti} ${NOMI[l]}`, false, `${f1(max)} s`);
    }
  }
  console.log(`\n  Durate medie: ${righe.join(' · ')}`);
}

// ============================================================================
// ⚡ Filo Scottante
// ============================================================================

const RIF_FILO = {
  tempi: [4.0, 6.0, 9.0], // persona mediana, per livello (solo tracciare)
  scosse: [0.6, 1.0, 1.6],
  totale: [38, 31, 25], // 25° perc., mediana, 87° perc.
  scosseTot: [4.5, 3.2, 1.9],
};

// Persona simulata: segue la tabella (tempi per livello con dispersione log-normale,
// scosse come eventi di Poisson), non il modello della CPU. Stessi messaggi del telefono.
function umanoFilo() {
  return (io) => {
    let liv = 0;
    let x = 0;
    let zaps = 0;
    let pausa = 0.35 + 0.3 * lognorm(0.3);
    let invio = 0;
    let fatto = false;
    let T = RIF_FILO.tempi[0] * lognorm(0.12);
    return {
      aggiorna(dt) {
        const v = io.vista();
        if (fatto || !v || v.inizio == null || io.ora() < v.inizio) return;
        if (pausa > 0) return void (pausa -= dt);
        // 0,85: la strada rifatta dopo una scossa è tempo in più in cui si può sbagliare
        if (Math.random() < ((0.85 * RIF_FILO.scosse[liv]) / T) * dt) {
          zaps++;
          io.input({ p: (liv + x) / 3, z: zaps, liv });
          x = Math.floor(x * 3) / 3;
          pausa = 0.7 + 0.35 + 0.4 * lognorm(0.3);
          return;
        }
        x += (dt / T) * (0.7 + 0.6 * Math.random());
        if (x >= 1) {
          if (liv === 2) {
            fatto = true;
            return io.input({ fatto: io.ora() - v.inizio, z: zaps, p: 1 });
          }
          liv++;
          x = 0;
          T = RIF_FILO.tempi[liv] * lognorm(0.12);
          io.input({ p: liv / 3, z: zaps, liv });
          pausa = 0.9 + 0.35 + 0.45 * lognorm(0.3);
          return;
        }
        invio -= dt;
        if (invio <= 0) {
          invio = 0.2;
          io.input({ p: (liv + x) / 3, z: zaps, liv });
        }
      },
    };
  };
}

// "12,3 s · ⚡2" oppure "57% · ⚡3"
function leggiFilo(det) {
  const m = /^([\d.,]+)\s*(s|%)\s*·\s*⚡(\d+)/.exec(det || '');
  if (!m) return null;
  return m[2] === 's' ? { tempo: numero(m[1]), zaps: Number(m[3]) } : { tempo: null, perc: numero(m[1]), zaps: Number(m[3]) };
}

async function filo() {
  const def0 = await carica('filo');
  // Per dividere tempi e scosse per livello si ascoltano i messaggi che arrivano al gioco.
  let registro = [];
  const def = {
    ...def0,
    crea(ctx) {
      const g = def0.crea(ctx);
      const input = g.input.bind(g);
      g.input = (id, d) => {
        registro.push({ t: ctx.tempo, d });
        input(id, d);
      };
      return g;
    },
  };
  console.log(`\n${'='.repeat(78)}\n${def.emoji} ${def.nome}\n${'='.repeat(78)}`);
  ordineLivelli(def, volte);
  const n = Math.max(150, volte * 2);
  console.log(`\n  Da soli (${n} partite)   tempo totale 25°/50°/75°   scosse   non finiti   per livello: tempo (tutto compreso) e scosse`);
  for (let l = -1; l < 3; l++) {
    const tempi = [];
    const zaps = [];
    const tl = [0, 0, 0];
    const zl = [0, 0, 0];
    let nonFiniti = 0;
    for (let k = 0; k < n; k++) {
      registro = [];
      const r = partita(def, [l < 0 ? { umano: umanoFilo() } : { livello: l }]);
      const d = leggiFilo(r.dettagli.p0);
      zaps.push(d.zaps);
      if (d.tempo == null) nonFiniti++;
      else tempi.push(d.tempo);
      let liv = 0;
      let t0 = 0;
      let z = 0;
      for (const { t, d: m } of registro) {
        if (typeof m.z === 'number' && m.z > z) zl[liv] += m.z - z;
        if (typeof m.z === 'number') z = Math.max(z, m.z);
        if ((typeof m.liv === 'number' && m.liv > liv) || m.fatto) {
          tl[liv] += t - t0;
          t0 = t;
          if (m.fatto) break;
          liv = m.liv;
        }
      }
    }
    const nome = l < 0 ? 'Persona media (sim.)' : NOMI[l];
    const livelli = tl.map((x, i) => `${f1(x / n)} s ${(zl[i] / n).toFixed(2)}`).join(' · ');
    console.log(`  ${nome.padEnd(22)} ${f1(quantile(tempi, 0.25)).padStart(5)} ${f1(quantile(tempi, 0.5)).padStart(5)} ${f1(quantile(tempi, 0.75)).padStart(5)} s   ${f1(media(zaps)).padStart(5)}   ${pc(nonFiniti / n).padStart(5)}      ${livelli}`);
    if (l >= 0) {
      const med = quantile(tempi, 0.5);
      console.log(`  ${''.padEnd(22)} tabella: ~${RIF_FILO.totale[l]} s, ${RIF_FILO.scosseTot[l]} scosse`);
      verifica('filo', `${NOMI[l]}: tempo mediano vicino alla tabella (±15%)`, Math.abs(med - RIF_FILO.totale[l]) / RIF_FILO.totale[l] <= 0.15, `${f1(med)} s contro ${RIF_FILO.totale[l]} s`);
      verifica('filo', `${NOMI[l]}: scosse medie vicino alla tabella (±30%)`, Math.abs(media(zaps) - RIF_FILO.scosseTot[l]) / RIF_FILO.scosseTot[l] <= 0.3, `${f1(media(zaps))} contro ${RIF_FILO.scosseTot[l]}`);
    }
  }
  controPersona(def, umanoFilo(), Math.max(200, volte * 2));
  durate(def, Math.max(20, volte / 5), 100);
}

// ============================================================================
// ✍️ Mano Ferma
// ============================================================================

const RIF_MF = {
  cerchio: [72, 80, 87],
  taglio: [78, 86, 93],
  punti: [38, 50, 62],
  totale: [188, 216, 242],
};

// Persona simulata media: modelli semplici e indipendenti da quelli della CPU, tarati sulla
// mediana della tabella. Usa solo quello che vede nella vista del telefono.
function gestoUmano(v) {
  if (v.tipo === 'cerchio') {
    const R = 250 + Math.random() * 100;
    const asse = Math.random() * Math.PI;
    const ovale = Math.abs(0.035 + gauss() * 0.02);
    const h = [2 + Math.floor(Math.random() * 3), Math.random() * 6.28, gauss() * 0.013];
    const giro = Math.random() < 0.03 ? 0.85 : 1.04 + gauss() * 0.05;
    const c = [];
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2 * giro;
      const r = R * (1 + ovale * Math.cos(2 * (a - asse)) + h[2] * Math.cos(h[0] * a + h[1]) + 0.035 * (i / 120 - 0.5) * Math.sign(gauss()) + gauss() * 0.005);
      c.push([Math.round(500 + Math.cos(a) * r), Math.round(500 + Math.sin(a) * r)]);
    }
    return { c };
  }
  if (v.tipo === 'taglio') {
    // una retta per la media dei vertici (il "centro" a colpo d'occhio), spostata un po'
    let cx = 0;
    let cy = 0;
    for (const [x, y] of v.forma) {
      cx += x / v.forma.length;
      cy += y / v.forma.length;
    }
    const a = Math.random() < 0.5 ? Math.PI / 2 : Math.random() * Math.PI;
    const d = gauss() * 19;
    const [px, py] = [cx - Math.sin(a) * d, cy + Math.cos(a) * d];
    return { t: [px - Math.cos(a) * 450, py - Math.sin(a) * 450, px + Math.cos(a) * 450, py + Math.sin(a) * 450].map(Math.round) };
  }
  // punti: ~3,5 ricordati bene, gli altri solo a grandi linee
  const sx = gauss() * 15;
  const sy = gauss() * 15;
  return {
    p: v.punti.map(([x, y]) => {
      const s = Math.random() < 0.74 ? 44 : 150;
      return [Math.round(x + sx + gauss() * s), Math.round(y + sy + gauss() * s)];
    }),
  };
}

function umanoManoFerma() {
  return (io) => {
    let fatta = -1;
    let attesa = null;
    let gesto = null;
    return {
      aggiorna(dt) {
        const v = io.vista();
        if (!v || v.fase !== 'prova' || fatta === v.prova) return;
        if (attesa == null) {
          attesa = v.tipo === 'cerchio' ? 2 + Math.random() * 2.5 : v.tipo === 'taglio' ? 2.5 + Math.random() * 3 : 3.5 + Math.random() * 2;
          if (v.tipo === 'punti') gesto = gestoUmano(v); // si guarda finché i punti ci sono
        }
        attesa -= dt;
        if (attesa > 0 || (v.tipo === 'punti' && io.ora() < v.mostraFino)) return;
        io.input(gesto || gestoUmano(v));
        fatta = v.prova;
        attesa = null;
        gesto = null;
      },
    };
  };
}

async function manoferma() {
  const def = await carica('manoferma');
  console.log(`\n${'='.repeat(78)}\n${def.emoji} ${def.nome}\n${'='.repeat(78)}`);
  ordineLivelli(def, volte);
  // Punteggi delle singole prove: si chiamano direttamente i generatori della CPU.
  const n = 3000;
  console.log(`\n  Punteggi per prova (${n} tentativi per livello): media e 25°/50°/75° percentile`);
  const riga = (nome, a, rif) => `    ${nome.padEnd(8)} ${f1(media(a)).padStart(5)}  (${f1(quantile(a, 0.25))} / ${f1(quantile(a, 0.5))} / ${f1(quantile(a, 0.75))})  tabella ${rif}`;
  const umano = { cerchio: [], taglio: [], punti: [] };
  for (let k = 0; k < n; k++) {
    const seme = 1 + Math.floor(Math.random() * 1e9);
    const forma = creaForma(seme).map(([x, y]) => [Math.round(x), Math.round(y)]);
    const pv = creaPunti(seme);
    umano.cerchio.push(punteggioCerchio(gestoUmano({ tipo: 'cerchio' }).c).punti);
    umano.taglio.push(punteggioTaglio(creaForma(seme), gestoUmano({ tipo: 'taglio', forma }).t).punti);
    umano.punti.push(punteggioPunti(pv, gestoUmano({ tipo: 'punti', punti: pv }).p).punti);
  }
  console.log('  Persona media (sim.)');
  for (const p of ['cerchio', 'taglio', 'punti']) console.log(riga(p, umano[p], RIF_MF[p][1]));
  for (let l = 0; l < 3; l++) {
    const C = [];
    const T = [];
    const P = [];
    const tempi = [];
    for (let k = 0; k < n; k++) {
      const cpu = creaCpu({ livello: l });
      const seme = 1 + Math.floor(Math.random() * 1e9);
      const forma = creaForma(seme);
      const pv = creaPunti(seme);
      C.push(punteggioCerchio(tracciaCerchio(cpu).c).punti);
      T.push(punteggioTaglio(forma, tagliaAOcchio(cpu, forma).t).punti);
      const t = toccaPunti(cpu, memorizzaPunti(cpu, pv, 2.8 - cpu.reazione(1.3)));
      P.push(punteggioPunti(pv, t.p).punti);
      tempi.push(t.fine);
    }
    const tot = media(C) + media(T) + media(P);
    console.log(`  ${NOMI[l]}  (totale medio ${f1(tot)}, tabella ~${RIF_MF.totale[l]}; ultimo tocco ${f1(media(tempi))} s dopo la sparizione)`);
    console.log(riga('cerchio', C, RIF_MF.cerchio[l]));
    console.log(riga('taglio', T, RIF_MF.taglio[l]));
    console.log(riga('punti', P, RIF_MF.punti[l]));
    verifica('manoferma', `${NOMI[l]}: totale medio vicino alla tabella (±12)`, Math.abs(tot - RIF_MF.totale[l]) <= 12, `${f1(tot)} contro ${RIF_MF.totale[l]}`);
  }
  controPersona(def, umanoManoFerma(), Math.max(200, volte * 2));
  durate(def, Math.max(10, volte / 10), 70);
}

// ============================================================================
// 🌈 Colore Perfetto
// ============================================================================

const RIF_COL = {
  // ΔE00: 25° percentile (peggio), mediana, 87° percentile (meglio)
  delta: [
    [6.5, 5, 3.8],
    [13, 10, 7.3],
    [16, 12.5, 9.2],
  ],
  fasce: [
    [4, 8],
    [8, 14],
    [10, 18],
  ],
};
const puntiDaDelta = (d) => Math.max(0, 100 - 2 * d);

// Un "occhio" sullo schermo grande: disegna il fotogramma del gioco su un finto canvas e
// legge il colore della macchia grande (l'unico tracciato con 40 lati). La persona
// simulata vede così esattamente quello che vedrebbe una persona in salotto.
function occhio() {
  let lati = 0;
  let visto = null;
  const g = new Proxy(
    {},
    {
      get(t, p) {
        if (p in t) return t[p];
        if (p === 'beginPath') return () => (lati = 0);
        if (p === 'lineTo') return () => lati++;
        if (p === 'fill') return () => lati >= 40 && typeof t.fillStyle === 'string' && t.fillStyle[0] === '#' && (visto = t.fillStyle);
        if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (p === 'measureText') return (s) => ({ width: String(s).length * 10 });
        return () => {};
      },
      set(t, p, v) {
        t[p] = v;
        return true;
      },
    },
  );
  return {
    guarda(gioco) {
      visto = null;
      gioco.disegna(g);
      return visto && [1, 3, 5].map((i) => parseInt(visto.slice(i, i + 2), 16));
    },
  };
}

// Persona media col selettore: parametri presi dalla letteratura (vedi tabella in testa),
// non dal modello della CPU.
function coloreUmano(rgb, vista) {
  const [L0, a0, b0] = rgbToLab(rgb);
  const m = vista == null ? 0 : vista >= 3 ? 1 : 1.45;
  let h = Math.atan2(b0, a0) + ((gauss() * (3.5 + 10 * m)) / 180) * Math.PI;
  const C = Math.hypot(a0, b0) * (1 + 0.08 * m) * Math.exp(gauss() * (0.08 + 0.15 * m));
  const L = L0 + gauss() * (2.5 + 6 * m) + (55 - L0) * 0.08 * m + gauss() * 3.4;
  const lab = [L, C * Math.cos(h) + gauss() * 3, C * Math.sin(h) + gauss() * 3];
  const [hh, s, v] = rgbToHsv(labToRgb(lab));
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  return hsvToRgb((hh + gauss() * 3 + 360) % 360, clamp01(s + gauss() * 0.06), clamp01(v + gauss() * 0.05)).map(Math.round);
}

function umanoColore(giocoCorrente) {
  return (io) => {
    const occ = occhio();
    let visto = null;
    let guardato = -1;
    let fatto = -1;
    let attesa = null;
    return {
      aggiorna(dt) {
        const v = io.vista();
        if (!v) return;
        const gioco = giocoCorrente();
        // guarda lo schermo grande quando il colore c'è
        if ((v.fase === 'mostra' || (v.fase === 'scelta' && v.round === 0)) && guardato !== v.round) {
          const c = occ.guarda(gioco);
          if (c) {
            visto = c;
            guardato = v.round;
          }
        }
        if (v.fase !== 'scelta' || fatto === v.round || guardato !== v.round) return;
        if (attesa == null) attesa = v.round === 0 ? 5.5 + Math.random() * 4 : 3.5 + Math.random() * 3;
        attesa -= dt;
        if (attesa > 0) return;
        io.input({ c: coloreUmano(visto, [null, 3, 1.5][v.round]), ok: 1 });
        fatto = v.round;
        attesa = null;
      },
    };
  };
}

async function colore() {
  const def0 = await carica('colore');
  let ultimo = null;
  const def = { ...def0, crea: (ctx) => (ultimo = def0.crea(ctx)) };
  console.log(`\n${'='.repeat(78)}\n${def.emoji} ${def.nome}\n${'='.repeat(78)}`);
  ordineLivelli(def, volte);
  const n = 3000;
  const bersaglio = () => hsvToRgb(Math.random() * 360, 0.45 + Math.random() * 0.5, 0.45 + Math.random() * 0.5).map(Math.round);
  console.log(`\n  Distanza di colore ΔE00 per round (${n} tentativi): mediana (25°–75°), tempo di conferma medio`);
  const umano = [[], [], []];
  for (let k = 0; k < n; k++) {
    [null, 3, 1.5].forEach((vista, i) => {
      const vero = bersaglio();
      umano[i].push(deltaE2000(rgbToLab(coloreUmano(vero, vista)), rgbToLab(vero)));
    });
  }
  const riga = (d, i, extra = '') => `round ${i + 1} ${f1(quantile(d, 0.5)).padStart(5)} (${f1(quantile(d, 0.25))}–${f1(quantile(d, 0.75))})${extra}`;
  console.log(`  ${'Persona media (sim.)'.padEnd(22)} ${umano.map((d, i) => riga(d, i)).join('  ')}`);
  umano.forEach((d, i) => {
    const [a, b] = RIF_COL.fasce[i];
    verifica('colore', `persona simulata, round ${i + 1}: mediana dentro la fascia ${a}–${b}`, quantile(d, 0.5) >= a && quantile(d, 0.5) <= b, f1(quantile(d, 0.5)));
  });
  for (let l = 0; l < 3; l++) {
    const D = [[], [], []];
    const T = [[], [], []];
    for (let k = 0; k < n; k++) {
      const cpu = creaCpu({ livello: l });
      const sc = scartoSchermo(cpu);
      [null, 3, 1.5].forEach((vista, i) => {
        const vero = bersaglio();
        const ricordo = vista ? vediColore(cpu, vero, vista - cpu.reazione(0.8), sc) : null;
        const p = pianoColore(cpu, { ricordo, vero: ricordo ? null : vero, scarto: sc, tempo: 14 });
        D[i].push(deltaE2000(rgbToLab(p.passi[p.passi.length - 1].c.map(Math.round)), rgbToLab(vero)));
        T[i].push(p.conferma);
      });
    }
    console.log(`  ${NOMI[l].padEnd(22)} ${D.map((d, i) => riga(d, i, ` ${f1(media(T[i]))}s`)).join('  ')}`);
    console.log(`  ${''.padEnd(22)} tabella: ${RIF_COL.delta.map((r) => r[l]).join(' / ')} · punti medi ${D.map((d) => f1(media(d.map(puntiDaDelta)))).join(' + ')}`);
    D.forEach((d, i) => {
      const rif = RIF_COL.delta[i][l];
      verifica('colore', `${NOMI[l]}, round ${i + 1}: ΔE mediano vicino alla tabella (±25%)`, Math.abs(quantile(d, 0.5) - rif) / rif <= 0.25, `${f1(quantile(d, 0.5))} contro ${rif}`);
    });
  }
  controPersona(def, umanoColore(() => ultimo), Math.max(200, volte * 2));
  durate(def, Math.max(10, volte / 10), 80);
}

// ============================================================================
// 🖐️ Twister delle Dita
// ============================================================================

const RIF_TW = {
  // quota di chi esce mentre posa le dita (0–17,8 s), mediana di sopravvivenza per chi le ha
  // posate tutte, e quota ancora in gioco a 35 e 40 s. Colonne: 25° perc., mediana, 87° perc.
  posare: [0.17, 0.07, 0.03],
  mediana: [31, 34, 37],
  a35: [0.05, 0.3, 0.75],
  a40: [0, 0.01, 0.08],
};

// Persona simulata media: estrae il suo destino dalla tabella (non dal modello della CPU)
// e manda gli stessi messaggi del telefono.
function umanoTwister() {
  return (io) => {
    let uscita;
    let motivo = 'scivolato';
    let maxDita = 5;
    const r = Math.random();
    if (r < RIF_TW.posare[1]) {
      const k = Math.random() < 0.2 ? 2 : Math.random() < 0.45 ? 3 : 4; // 3°, 4° o 5° dito
      motivo = Math.random() < 0.55 ? 'tardi' : 'staccato';
      uscita = motivo === 'tardi' ? appare(k) + 3.02 : appare(k) + 0.8 + Math.random();
      maxDita = k;
    } else if (r < RIF_TW.posare[1] + 0.04) {
      uscita = 18 + Math.random() * 16; // un dito che si alza per sbaglio
      motivo = 'staccato';
    } else uscita = Math.max(20, RIF_TW.mediana[1] + gauss() * 2.2);
    const posa = Array.from({ length: 5 }, (_, i) => appare(i) + 0.6 + Math.random() * 0.8);
    let dita = 0;
    let finito = false;
    return {
      aggiorna() {
        const v = io.vista();
        if (finito || !v || v.inizio == null) return;
        const t = (io.ora() - v.inizio) / 1000;
        if (t < 0) return;
        if (t >= uscita) {
          finito = true;
          return io.input({ fuori: motivo, t: uscita });
        }
        const n = posa.filter((x, i) => i < maxDita && t >= x).length;
        if (n !== dita) io.input({ dita: (dita = n) });
        if (t >= 60) {
          finito = true;
          io.input({ salvo: true });
        }
      },
    };
  };
}

async function twister() {
  const def = await carica('twister');
  console.log(`\n${'='.repeat(78)}\n${def.emoji} ${def.nome}\n${'='.repeat(78)}`);
  ordineLivelli(def, volte);
  const n = Math.max(300, volte * 3);
  console.log(`\n  Da soli (${n} partite per livello): chi esce posando le dita, sopravvivenza (25°/50°/75°), quota in gioco a 30/35/40/45/60 s`);
  const leggi = (det) => {
    const m = /Fuori dopo ([\d.,]+) s/.exec(det || '');
    return m ? numero(m[1]) : 60;
  };
  for (let l = -1; l < 3; l++) {
    const T = [];
    for (let k = 0; k < n; k++) T.push(leggi(partita(def, [l < 0 ? { umano: umanoTwister() } : { livello: l }]).dettagli.p0));
    const S = (t) => T.filter((x) => x > t).length / T.length;
    const dopo = T.filter((x) => x > 17.8);
    const nome = l < 0 ? 'Persona media (sim.)' : NOMI[l];
    console.log(
      `  ${nome.padEnd(22)} posando ${pc(1 - S(17.8)).padStart(4)}   ${f1(quantile(dopo, 0.25))} / ${f1(quantile(dopo, 0.5))} / ${f1(quantile(dopo, 0.75))} s   ${[30, 35, 40, 45, 59.9].map((t) => pc(S(t)).padStart(4)).join(' ')}`,
    );
    if (l >= 0) {
      console.log(`  ${''.padEnd(22)} tabella: posando ${pc(RIF_TW.posare[l])}, mediana ${RIF_TW.mediana[l]} s, a 35 s ${pc(RIF_TW.a35[l])}, a 40 s ${pc(RIF_TW.a40[l])}`);
      verifica('twister', `${NOMI[l]}: mediana di sopravvivenza vicino alla tabella (±2 s)`, Math.abs(quantile(dopo, 0.5) - RIF_TW.mediana[l]) <= 2, `${f1(quantile(dopo, 0.5))} s contro ${RIF_TW.mediana[l]} s`);
      verifica('twister', `${NOMI[l]}: esce posando le dita come in tabella (±6 punti)`, Math.abs(1 - S(17.8) - RIF_TW.posare[l]) <= 0.06, `${pc(1 - S(17.8))} contro ${pc(RIF_TW.posare[l])}`);
    }
  }
  controPersona(def, umanoTwister(), Math.max(200, volte * 2));
  durate(def, Math.max(10, volte / 10), 62.5);
}

// ============================================================================

const giochi = { filo, manoferma, colore, twister };
for (const id of solo) if (giochi[id]) await giochi[id]();

const falliti = verdetti.filter((v) => !v.ok);
console.log(`\n${'='.repeat(78)}\nRiepilogo: ${verdetti.length - falliti.length}/${verdetti.length} controlli superati`);
for (const v of falliti) console.log(`  ✘ ${v.gioco}: ${v.cosa} (${v.valore})`);
