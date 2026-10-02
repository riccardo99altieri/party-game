// Banco di prova dell'agente "Mente": Mezzogiorno di Fuoco, Il Più Alto Unico, Galleria d'Arte.
// Uso: node test/bench/mente.mjs [volte] [fuoco,unico,galleria]
//
// ============================================================================
// TABELLE DI RIFERIMENTO "UMANE" (ipotesi scritte, con la motivazione)
// ============================================================================
//
// 🤠 Mezzogiorno di Fuoco (persona media che guarda la TV e tocca il telefono)
// | grandezza                              | persona media | perché |
// |----------------------------------------|---------------|--------|
// | reazione a FUOCO!, mediana             | 0,33 s        | reazione visiva semplice ~0,22–0,25 s in laboratorio, + ritardo della TV (30–80 ms) + tocco sul telefono (40–80 ms) + è un compito "vai/non andare" (bisogna leggere la parola): ~0,30–0,36 s |
// | dispersione (log-normale)              | sigma 0,20    | le reazioni umane hanno una coda a destra (ex-gaussiana / log-normale) |
// | distrazioni (+0,15…0,7 s)              | 4% dei round  | cali di attenzione occasionali: la coda lunga oltre 0,6 s |
// | casca in una parola finta              | 15% per finta | errori di "commissione" nei compiti vai/non-vai veloci: 10–20%; le finte hanno lettere e colore simili (FUNGO!, FOCA!…) |
// | sparo nervoso senza nessuna parola     | ~1,5% a round | partenze anticipate quando l'attesa si allunga |
// | reazione più rapida credibile          | ≥ 0,20 s      | sotto 0,2 s con TV + telefono è anticipazione, non reazione |
//
// Livelli CPU scelti su questa tabella (mediana reazione, finte in cui casca, distrazioni, nervosi a round):
// Facile ~0,42 s, ~21%, 8%, ~2,5%; Normale ~0,34 s, ~15%, 4%, ~1,2%; Difficile ~0,29 s, ~10%, 1,5%, ~0,4%.
// La personalità sposta il compromesso velocità/precisione; il Difficile in più gestisce il rischio
// guardando la classifica (avanti = prudente, indietro negli ultimi round = grilletto facile).
//
// 🔢 Il Più Alto Unico (persona media alla prima partita, 3–6 giocatori, numeri 1–10)
// | grandezza                              | persona media | perché |
// |----------------------------------------|---------------|--------|
// | sceglie il massimo (10)                | ~22%          | avidità: il numero più alto "vale di più" (tipico nei giochi di offerta unica) |
// | sceglie 9 / 8                          | ~17% / ~13%   | ragionamento di primo livello: "tutti prendono 10, io 9" |
// | numeri "salienti" (7, 3, 1)            | ~25% in tutto | numeri fortunati e il trucco "nessuno prende 1" |
// | dopo un doppione cambia numero         | ~70%          | di solito scende di 1–3 |
// | dopo un unico ripete lo stesso numero  | ~40%          | "ha funzionato" (spesso sale di 1 se ha preso il bonus) |
// | tempo per scegliere                    | 3–9 s su 12   | legge, ci pensa, a volte cambia idea |
//
// 🎨 Galleria d'Arte (persona media, 75 s di disegno col dito sul telefono)
// | grandezza                              | persona media | perché |
// |----------------------------------------|---------------|--------|
// | tratti in 75 s                         | 15–35         | un tratto dura 1–3 s più le pause per scegliere colore e pennello |
// | colori usati                           | 3–5           | i più usano nero + 2–4 colori; pochi riempiono lo sfondo |
// | superficie colorata                    | 15–35%        | contorni e qualche riempimento; lo sfondo pieno è da "bravi" |
// | velocità del dito                      | 800–2000 unità/s (foglio = 1000) | 5–15 cm/s sul telefono per i contorni, di più per gli scarabocchi di riempimento |
// | voto                                   | premia impegno, colori e disegni "pieni", con gusto personale e un po' di caso |
//
// Livelli CPU: Facile = scarabocchio da bambino (9–22 tratti, ~3 colori, ~13% coperto, spesso riga
// verde e sole, "Ho finito" dopo ~30 s); Normale = disegnino riconoscibile (13–41 tratti, 4–5 colori,
// ~20% coperto, ~45 s); Difficile = scena composta: soggetto colorato e contornato, oggetti legati al
// tema (30–58 tratti, ~7 colori); circa metà riempie tutto lo sfondo, gli "impazienti" mettono tutta
// la cura nel soggetto; usa 50–75 s.

import { carica, partita, serie, stampa, finto2d } from './lib.mjs';

const volte = Number(process.argv[2]) || 150;
const solo = process.argv[3] ? process.argv[3].split(',') : ['fuoco', 'unico', 'galleria'];
const NOMI = ['Facile', 'Normale', 'Difficile'];
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;

// Avvolge un minigioco per "guardare lo schermo" nel banco: dopo ogni aggiornamento
// disegna la scena su un finto canvas e annota i testi scritti; intercetta anche le
// viste mandate ai telefoni (servono per le statistiche, mai ai bot).
function conOcchi(def, { suVista } = {}) {
  return {
    ...def,
    crea(ctx) {
      const spia = finto2d();
      const testoVero = ctx.testo;
      const vistaVera = ctx.vista;
      let testi = [];
      ctx.schermo = { testi: [], ora: 0 };
      ctx.testo = (g, s, x, y, o) => {
        if (g === spia) testi.push({ s: String(s), x, y });
        return testoVero(g, s, x, y, o);
      };
      ctx.vista = (chi, s) => {
        if (suVista) suVista(chi, s);
        return vistaVera(chi, s);
      };
      const gioco = def.crea(ctx);
      return {
        ...gioco,
        aggiorna(dt) {
          gioco.aggiorna(dt);
          testi = [];
          gioco.disegna(spia);
          ctx.schermo = { testi, ora: ctx.ora() };
        },
      };
    },
  };
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
const lognormale = (mediana, sigma) => mediana * Math.exp(gauss() * sigma);

// Confronto a coppie: in quante partite il giocatore i finisce davanti al giocatore j
// (pari = mezza vittoria). Nei giochi senza interazione (fuoco) equivale al testa a testa.
function testaATesta(def, specs, volte, i, js, opzioni) {
  let vinte = 0;
  let conti = 0;
  let durata = 0;
  for (let k = 0; k < volte; k++) {
    const r = partita(def, specs, opzioni);
    durata += r.secondi;
    for (const j of js) {
      const a = r.pos[`p${i}`];
      const b = r.pos[`p${j}`];
      vinte += a < b ? 1 : a === b ? 0.5 : 0;
      conti++;
    }
  }
  return { quota: vinte / conti, durata: durata / volte };
}

function durate(def, livelli = [0, 1, 2], quanti = [3, 4, 8], volte = 20) {
  const righe = [];
  for (const l of livelli) {
    const parti = [];
    for (const n of quanti) {
      const s = serie(def, Array.from({ length: n }, () => ({ livello: l })), volte);
      parti.push(`${n} CPU ${s.durata.toFixed(0)} s`);
    }
    righe.push(`  ${NOMI[l].padEnd(10)} ${parti.join(' · ')}`);
  }
  console.log(`\n  Durate (CPU tutte dello stesso livello):\n${righe.join('\n')}`);
}

// ============================================================================
// 🤠 Mezzogiorno di Fuoco
// ============================================================================

// Persona simulata: guarda il cartello sullo schermo (testo disegnato in alto) e
// preme il pulsante del telefono ({ sparo: ora }) dopo il suo tempo di reazione.
function personaFuoco({ mediana = 0.33, sigma = 0.2, pDistr = 0.04, pFinta = 0.15, nervi = 0.0035 } = {}) {
  return (io) => {
    let round = -1;
    let cartello = '';
    let tPremi = null;
    let sparato = false;
    let tAttesa = 0;
    const reazione = () => {
      let r = lognormale(mediana, sigma);
      if (Math.random() < pDistr) r += 0.15 + Math.random() * 0.55;
      return Math.max(0.18, r);
    };
    return {
      aggiorna(dt) {
        const v = io.vista();
        const sch = io.ctx.schermo;
        if (!v || !sch) return;
        if (v.round !== round) {
          round = v.round;
          tPremi = null;
          sparato = false;
          tAttesa = 0;
        }
        if (sparato || v.fase === 'esito') return;
        const scritta = (sch.testi.find((x) => x.y === 192) || {}).s || '';
        if (scritta !== cartello) {
          cartello = scritta;
          if (scritta === 'FUOCO!') {
            const t = sch.ora + reazione() * 1000;
            if (tPremi == null || t < tPremi) tPremi = t;
          } else if (scritta !== 'Pronti…' && tPremi == null && Math.random() < pFinta) {
            tPremi = sch.ora + reazione() * 1000;
          }
        }
        if (scritta === 'Pronti…' || (scritta !== 'FUOCO!' && tPremi == null)) {
          tAttesa += dt;
          if (tPremi == null && Math.random() < nervi * (0.4 + tAttesa / 2.5) * dt) tPremi = io.ora();
        }
        if (tPremi != null && io.ora() >= tPremi) {
          io.input({ sparo: tPremi });
          sparato = true;
        }
      },
    };
  };
}

async function fuoco() {
  const base = await carica('fuoco');
  const def = conOcchi(base);
  console.log('\n==================== 🤠 Mezzogiorno di Fuoco ====================');
  stampa(`Ordine dei livelli — F, N, D insieme, ${volte} partite`, serie(base, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte));

  // Statistiche dei singoli spari (dai messaggi ai telefoni): reazioni, finte, nervosi.
  const stat = [0, 1, 2, 'umano'].map(() => ({ ms: [], presto: 0, lenti: 0, round: 0 }));
  const specs = [{ livello: 0 }, { livello: 1 }, { livello: 2 }, { umano: personaFuoco(), nome: 'persona' }];
  // I messaggi ai telefoni non escono da partita(): li leggiamo con una spia sugli invii.
  const def2 = await carica('fuoco');
  const spiaInvii = {
    ...def2,
    crea(ctx) {
      const inviaVero = ctx.invia;
      ctx.invia = (chi, d) => {
        const i = Number(String(chi).slice(1));
        const s = stat[i];
        if (d.presto) s.presto++;
        else if (d.lento) s.lenti++;
        else if (d.ms != null) s.ms.push(d.ms);
        return inviaVero(chi, d);
      };
      return conOcchi(def2).crea(ctx);
    },
  };
  for (let k = 0; k < volte; k++) partita(spiaInvii, specs);
  console.log('\n  Spari singoli (F, N, D, persona simulata):');
  ['Facile', 'Normale', 'Difficile', 'persona'].forEach((nome, i) => {
    const s = stat[i];
    const ms = [...s.ms].sort((a, b) => a - b);
    const q = (p) => (ms[Math.floor(p * (ms.length - 1))] / 1000).toFixed(3);
    const tot = volte * 5;
    const sotto200 = ms.filter((x) => x < 200).length;
    console.log(
      `  ${nome.padEnd(10)} mediana ${q(0.5)} s  (10°–90° perc. ${q(0.1)}–${q(0.9)} s)  troppo presto ${pct(s.presto / tot)}  lenti ${pct(s.lenti / tot)}  sotto 0,2 s ${sotto200}`,
    );
  });

  console.log('\n  Contro la persona media simulata (partite con 1 CPU + 2 persone, confronto a coppie):');
  for (const l of [0, 1, 2]) {
    const r = testaATesta(def, [{ livello: l }, { umano: personaFuoco(), nome: 'A' }, { umano: personaFuoco(), nome: 'B' }], volte, 0, [1, 2]);
    console.log(`  ${NOMI[l].padEnd(10)} batte la persona ${pct(r.quota)}   (obiettivo ${['20–30%', '45–55%', '70–85%'][l]})`);
  }
  const esperto = personaFuoco({ mediana: 0.25, sigma: 0.14, pDistr: 0.01, pFinta: 0.04, nervi: 0.001 });
  const r = testaATesta(def, [{ livello: 2 }, { umano: esperto, nome: 'A' }, { umano: esperto, nome: 'B' }], volte, 0, [1, 2]);
  console.log(`  Difficile contro un esperto (0,25 s, 4% finte): ${pct(r.quota)}   (deve poter perdere)`);
  durate(base);
}

// ============================================================================
// 🔢 Il Più Alto Unico
// ============================================================================

// Persona simulata: parte dalla tabella di riferimento e ragiona solo su quello che
// le dice il suo telefono dopo lo svelamento (il suo numero, se era unico, il numero vincente).
function personaUnico() {
  return (io) => {
    let chiave = null;
    let tScelta = null;
    let ultimo = null;
    const prior = (M) => {
      const w = [0];
      for (let v = 1; v <= M; v++) w.push(0.25 * 0.72 ** (M - v) + 0.02 + (v === 7 ? 0.05 : 0) + (v === 1 ? 0.04 : 0) + (v === 3 || v === 5 ? 0.02 : 0));
      return w;
    };
    const pesca = (w) => {
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let v = 1; v < w.length; v++) if ((r -= w[v]) <= 0) return v;
      return w.length - 1;
    };
    const intero = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    function scegli(M) {
      const r = Math.random();
      if (ultimo && ultimo.numero != null) {
        const c = ultimo.numero;
        if (ultimo.tipo === 'doppio' && r < 0.7) return Math.max(1, c - intero(1, 3));
        if (ultimo.tipo === 'unico') {
          if (r < 0.4) return c;
          if (ultimo.bonus && r < 0.6) return Math.min(M, c + 1);
          if (!ultimo.bonus && ultimo.migliore && r < 0.55) return Math.min(M, ultimo.migliore + intero(0, 1));
        }
      }
      if (ultimo && ultimo.migliore && Math.random() < 0.12) return ultimo.migliore; // "copio chi ha vinto"
      return pesca(prior(M));
    }
    return {
      aggiorna() {
        const v = io.vista();
        if (!v) return;
        const k = `${v.round}-${v.fase}`;
        if (k !== chiave) {
          chiave = k;
          if (v.fase === 'scelta') tScelta = io.ora() + (2.5 + Math.random() * 6.5) * 1000;
          else {
            ultimo = v;
            tScelta = null;
          }
        }
        if (v.fase === 'scelta' && tScelta != null && io.ora() >= tScelta) {
          io.input({ n: scegli(v.max) });
          tScelta = null;
        }
      },
    };
  };
}

async function unico() {
  const base = await carica('unico');
  console.log('\n==================== 🔢 Il Più Alto Unico ====================');
  stampa(`Ordine dei livelli — F, N, D insieme, ${volte} partite`, serie(base, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte));
  stampa(`Due per livello (6 giocatori), ${volte} partite`, serie(base, [0, 0, 1, 1, 2, 2].map((l) => ({ livello: l })), volte));

  console.log('\n  Contro la persona media simulata (1 CPU + 2 persone, confronto a coppie):');
  for (const l of [0, 1, 2]) {
    const r = testaATesta(base, [{ livello: l }, { umano: personaUnico(), nome: 'A' }, { umano: personaUnico(), nome: 'B' }], volte * 2, 0, [1, 2]);
    console.log(`  ${NOMI[l].padEnd(10)} batte la persona ${pct(r.quota)}   (obiettivo ${['20–30%', '45–55%', '70–85%'][l]})`);
  }
  const r2 = testaATesta(base, [{ livello: 2 }, { livello: 2 }, { umano: personaUnico(), nome: 'A' }], volte * 2, 2, [0, 1]);
  console.log(`  Persona contro due Difficili: la persona batte ciascun Difficile nel ${pct(r2.quota)} dei confronti`);

  // Più bot dello stesso livello: quante volte il numero scelto resta unico
  // (se i Difficili si pestassero i piedi, la quota crollerebbe).
  console.log('\n  CPU tutte dello stesso livello: % di scelte rimaste uniche, punti medi a round, numeri più scelti');
  for (const quanti of [3, 4, 8, 16]) {
    const righe = [];
    for (const l of [0, 1, 2]) {
      let uniche = 0;
      let tot = 0;
      let punti = 0;
      const freq = {};
      const def = conOcchi(base, {
        suVista: (chi, s) => {
          if (s.fase !== 'rivela' || chi === '*') return;
          tot++;
          if (s.tipo === 'unico') uniche++;
          punti += s.punti;
          if (s.numero != null) freq[s.numero] = (freq[s.numero] || 0) + 1;
        },
      });
      for (let k = 0; k < Math.ceil(volte / 3); k++) partita(def, Array.from({ length: quanti }, () => ({ livello: l })));
      const top = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([v, f]) => `${v}:${((f / tot) * 100).toFixed(0)}%`)
        .join(' ');
      righe.push(`${NOMI[l][0]} unici ${pct(uniche / tot)} punti ${(punti / tot).toFixed(1).padStart(4)} [${top}]`);
    }
    console.log(`  ${String(quanti).padStart(2)} CPU  ${righe.join('   ')}`);
  }
  durate(base);
}

// ============================================================================
// 🎨 Galleria d'Arte
// ============================================================================

// Quello che si vede di un disegno (tratti, colori, superficie colorata), ricalcolato
// qui in modo indipendente dai messaggi del telefono.
function misuraDisegno(tratti) {
  const N = 40;
  const g = new Uint8Array(N * N);
  const colori = new Set();
  let valori = 0;
  for (const t of tratti) valori += t.pts.length;
  for (const t of tratti) {
    if (t.c === '#ffffff') continue;
    colori.add(t.c);
    const r = t.w / 2 + 12.5;
    for (let i = 0; i < t.pts.length; i += 2) {
      const x0 = t.pts[i];
      const y0 = t.pts[i + 1];
      const x1 = t.pts[i + 2] ?? x0;
      const y1 = t.pts[i + 3] ?? y0;
      const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20));
      for (let j = 0; j < k; j++) {
        const x = x0 + ((x1 - x0) * j) / k;
        const y = y0 + ((y1 - y0) * j) / k;
        for (let rr = Math.max(0, Math.floor((y - r) / 25)); rr <= Math.min(N - 1, Math.floor((y + r) / 25)); rr++)
          for (let cc = Math.max(0, Math.floor((x - r) / 25)); cc <= Math.min(N - 1, Math.floor((x + r) / 25)); cc++)
            if (Math.hypot((cc + 0.5) * 25 - x, (rr + 0.5) * 25 - y) <= r) g[rr * N + cc] = 1;
      }
    }
  }
  const copertura = g.reduce((a, b) => a + b, 0) / (N * N);
  return { tratti: tratti.length, colori: colori.size, copertura, valori, impegno: Math.log1p(tratti.length) + 0.5 * colori.size + 3.5 * Math.sqrt(copertura) };
}

// Spia sugli input (bot e persone passano tutti da input(), come dal telefono):
// ricostruisce i disegni, i tempi di "Ho finito" e chi ha votato chi.
function conSpia(def, reg) {
  return {
    ...def,
    crea(ctx) {
      const vistaVera = ctx.vista;
      let fase = '';
      let inizio = 0;
      ctx.vista = (chi, s) => {
        if (s && s.fase !== fase) {
          fase = s.fase;
          if (fase === 'disegno') inizio = ctx.tempo;
          if (fase === 'voto') reg.fineDisegno = ctx.tempo - inizio;
        }
        return vistaVera(chi, s);
      };
      const gioco = def.crea(ctx);
      return {
        ...gioco,
        input(id, d) {
          const q = (reg[id] = reg[id] || { tratti: new Map(), ordine: [], annulli: 0, finito: null, voto: null });
          if (fase === 'disegno' && d) {
            if (d.k === 'p') {
              if (!q.tratti.has(d.id)) {
                q.tratti.set(d.id, { c: d.c, w: d.w, pts: [...d.pts] });
                q.ordine.push(d.id);
              } else q.tratti.get(d.id).pts.push(...d.pts.slice(2));
            } else if (d.k === 'u') {
              q.tratti.delete(q.ordine.pop());
              q.annulli++;
            }
            if (d.finito === true && q.finito == null) q.finito = ctx.tempo - inizio;
          }
          if (fase === 'voto' && d && d.voto != null) q.voto = d.voto;
          return gioco.input(id, d);
        },
      };
    },
  };
}

// Persona simulata che disegna con un certo impegno (tratti, colori, riempimenti)
// mandando i messaggi della lavagna del telefono. Se riceve il registro della spia
// vota anche "da persona" (guarda i quadri: impegno + gusto + un po' di caso),
// altrimenti non vota, così i voti ricevuti vengono solo dai bot.
function personaGalleria({ tratti = 20, colori = 4, pieni = 0.2, durata = 50, reg = null } = {}) {
  const TAV = ['#1b1030', '#ef4444', '#22c55e', '#2563eb', '#facc15', '#a855f7', '#f97316', '#38bdf8', '#f472b6', '#92400e'];
  return (io) => {
    let fatti = 0;
    let t = 0;
    let finito = false;
    let votato = false;
    let tVoto = 3 + Math.random() * 10;
    const tondo = (v) => Math.round(Math.max(0, Math.min(1000, v)));
    return {
      aggiorna(dt) {
        const v = io.vista();
        if (v && v.fase === 'voto' && reg && !votato && (tVoto -= dt) <= 0) {
          votato = true;
          const scelta =
            Math.random() < 0.1
              ? v.opere[Math.floor(Math.random() * v.opere.length)]
              : v.opere.reduce((m, o) => {
                  const q = reg[o.id];
                  const s = misuraDisegno(q ? [...q.tratti.values()] : []).impegno + 1.5 * gauss();
                  return !m || s > m.s ? { id: o.id, s } : m;
                }, null);
          io.input({ voto: scelta.id });
        }
        if (!v || v.fase !== 'disegno' || finito) return;
        t += dt;
        if (fatti < tratti && t >= ((fatti + 1) * durata) / (tratti + 1)) {
          const c = TAV[fatti % colori];
          const pts = [];
          let w = 8;
          if (fatti < tratti * pieni) {
            w = 40;
            const x = 100 + Math.random() * 500;
            const y = 100 + Math.random() * 500;
            for (let r = 0; r < 8; r++) pts.push(tondo(x + (r % 2 ? 300 : 0)), tondo(y + r * 30), tondo(x + (r % 2 ? 0 : 300)), tondo(y + r * 30));
          } else {
            const cx = 150 + Math.random() * 700;
            const cy = 150 + Math.random() * 700;
            const r = 40 + Math.random() * 120;
            for (let k = 0; k <= 24; k++) pts.push(tondo(cx + Math.cos((k / 24) * 6.28) * r), tondo(cy + Math.sin((k / 24) * 6.28) * r * 0.8));
          }
          io.input({ k: 'p', id: `u${fatti}`, c, w, pts });
          fatti++;
        }
        if (fatti >= tratti && t > durata) {
          finito = true;
          io.input({ finito: true });
        }
      },
    };
  };
}

async function galleria() {
  const base = await carica('galleria');
  console.log("\n==================== 🎨 Galleria d'Arte ====================");
  stampa(`Ordine dei livelli — F, N, D insieme, ${volte} partite (punteggio = voti)`, serie(base, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte));

  // Com'è fatto il disegno di ogni livello (misurato dai messaggi, come li vedrebbe il server).
  const acc = [0, 1, 2].map(() => ({ tratti: [], colori: [], cop: [], valori: [], finito: [], annulli: 0 }));
  let maxValori = 0;
  for (let k = 0; k < volte; k++) {
    const reg = {};
    partita(conSpia(base, reg), [{ livello: 0 }, { livello: 1 }, { livello: 2 }]);
    for (const l of [0, 1, 2]) {
      const q = reg[`p${l}`];
      const m = misuraDisegno([...q.tratti.values()]);
      const a = acc[l];
      a.tratti.push(m.tratti);
      a.colori.push(m.colori);
      a.cop.push(m.copertura);
      a.valori.push(m.valori);
      a.finito.push(q.finito ?? reg.fineDisegno);
      a.annulli += q.annulli;
      maxValori = Math.max(maxValori, m.valori);
    }
  }
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const fascia = (v) => {
    const s = [...v].sort((a, b) => a - b);
    return `${s[Math.floor(s.length * 0.1)].toFixed(0)}–${s[Math.floor(s.length * 0.9)].toFixed(0)}`;
  };
  console.log('\n  Disegni per livello (media, 10°–90° perc.):');
  for (const l of [0, 1, 2]) {
    const a = acc[l];
    console.log(
      `  ${NOMI[l].padEnd(10)} tratti ${media(a.tratti).toFixed(0).padStart(2)} (${fascia(a.tratti)})  colori ${media(a.colori).toFixed(1)}  superficie ${(media(a.cop) * 100).toFixed(0).padStart(2)}%  "Ho finito" dopo ${media(a.finito).toFixed(0)} s (${fascia(a.finito)})  annulla ${(a.annulli / volte).toFixed(2)}/disegno`,
    );
  }
  console.log(`  valori per disegno: max ${maxValori} (limite del gioco 30000)`);

  // Voto dei bot: persone simulate con impegno diverso + un bot per livello.
  // Le persone non votano: tutti i voti vengono dai bot.
  const concorrenti = [
    { nome: 'persona brava', umano: personaGalleria({ tratti: 60, colori: 8, pieni: 0.4, durata: 68 }) },
    { nome: 'persona media', umano: personaGalleria({ tratti: 22, colori: 4, pieni: 0.15, durata: 50 }) },
    { nome: 'persona pigra', umano: personaGalleria({ tratti: 6, colori: 1, pieni: 0, durata: 20 }) },
    { nome: 'foglio bianco', umano: personaGalleria({ tratti: 0, colori: 1, durata: 5 }) },
    { livello: 0 },
    { livello: 1 },
    { livello: 2 },
  ];
  const nomi = concorrenti.map((c) => c.nome || `CPU ${NOMI[c.livello]}`);
  const ricevuti = concorrenti.map(() => 0);
  const impegni = concorrenti.map(() => []);
  let votiBot = 0;
  let alMigliore = 0;
  let aSeStesso = 0;
  let rho = 0;
  for (let k = 0; k < volte; k++) {
    const reg = {};
    partita(conSpia(base, reg), concorrenti);
    const imp = concorrenti.map((_, i) => misuraDisegno([...(reg[`p${i}`]?.tratti.values() || [])]).impegno);
    imp.forEach((v, i) => impegni[i].push(v));
    const perGara = concorrenti.map(() => 0);
    for (let i = 4; i < concorrenti.length; i++) {
      const v = reg[`p${i}`]?.voto;
      if (v == null) continue;
      const j = Number(v.slice(1));
      if (j === i) aSeStesso++;
      votiBot++;
      ricevuti[j]++;
      perGara[j]++;
      let migliore = -1;
      for (let jj = 0; jj < imp.length; jj++) if (jj !== i && (migliore < 0 || imp[jj] > imp[migliore])) migliore = jj;
      if (j === migliore) alMigliore++;
    }
    // correlazione di rango tra impegno e voti ricevuti in questa partita
    const rango = (v) => v.map((x) => v.filter((y) => y < x).length + (v.filter((y) => y === x).length - 1) / 2);
    const a = rango(imp);
    const b = rango(perGara);
    const ma = media(a);
    const mb = media(b);
    const num = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
    const den = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
    rho += den ? num / den : 0;
  }
  console.log(`\n  Voti dei bot (${volte} partite a 7: 4 persone simulate che non votano + F, N, D):`);
  concorrenti.forEach((c, i) => console.log(`  ${nomi[i].padEnd(15)} impegno medio ${media(impegni[i]).toFixed(1).padStart(4)}   voti dei bot ${pct(ricevuti[i] / votiBot)}`));
  console.log(`  al disegno con più impegno: ${pct(alMigliore / votiBot)} dei voti · correlazione di rango impegno/voti ${(rho / volte).toFixed(2)} · voti a sé stessi ${aSeStesso}`);

  // Contro la persona media (disegno da persona media, che vota guardando i quadri):
  // partite a 3 con 1 CPU + 2 persone, confronto a coppie sui voti ricevuti.
  console.log('\n  Contro la persona media simulata (1 CPU + 2 persone che disegnano e votano, confronto a coppie):');
  const mediaPersona = { tratti: 22, colori: 4, pieni: 0.15, durata: 55 };
  for (const l of [0, 1, 2]) {
    let vinte = 0;
    let conti = 0;
    for (let k = 0; k < volte; k++) {
      const reg = {};
      const r = partita(conSpia(base, reg), [{ livello: l }, { umano: personaGalleria({ ...mediaPersona, reg }) }, { umano: personaGalleria({ ...mediaPersona, reg }) }]);
      for (const j of ['p1', 'p2']) {
        vinte += r.pos.p0 < r.pos[j] ? 1 : r.pos.p0 === r.pos[j] ? 0.5 : 0;
        conti++;
      }
    }
    console.log(`  ${NOMI[l].padEnd(10)} batte la persona ${pct(vinte / conti)}   (riferimento ${['20–30%', '45–55%', '70–85%'][l]}; gioco molto caotico)`);
  }
  durate(base);
}

const giochi = { fuoco, unico, galleria };
for (const id of solo) await giochi[id]();
