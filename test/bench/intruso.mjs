// Banco di prova di Trova l'Intruso: livelli delle CPU, confronto con le persone simulate,
// durata dei round e quanti passanti restano alla fine.
// Uso: node test/bench/intruso.mjs [volte]
//
// ============================================================================
// TABELLA DI RIFERIMENTO "UMANA" (persona media alla prima partita)
// ============================================================================
//
// | grandezza                                   | persona media | perché |
// |---------------------------------------------|---------------|--------|
// | accorgersi di un pugno vicino (< 300 px)    | 60%           | è un'animazione di 0,3 s, piccola: la si vede se si guarda lì |
// | … a metà schermo / lontano                  | ×0,6 / ×0,3   | si guarda soprattutto intorno al proprio personaggio |
// | accorgersi di un errore (rosso + nome)      | 85%           | lampeggia 2 s e c'è il nome in alto: difficile non vederlo |
// | accorgersi di una moneta presa (vicino)     | 45%           | la moneta sparisce con un "+1" |
// | seguire con gli occhi chi è sospetto        | lo scambia nel 40–50% degli incroci | 96 personaggi identici: quando due si sfiorano non si sa più chi è chi |
// | lo perde di vista quando è lontano          | 12% al secondo| si guarda il proprio personaggio |
// | "quello sta fermo da un po'" (vicino)        | si nota dopo 3–4 s | |
// | "quello mi segue"                           | 25% dopo 4,5 s vicino | |
// | prima di tirare: controlla chi è in mezzo   | metà delle volte | col pollice sul tasto si va di fretta |
// | si fa tradire da una pausa troppo lunga     | 4% delle pause| guarda il telefono, si distrae |
// | va a prendere una moneta vicina             | 45%           | è un +1 facile, ma ti scopri |
// Queste sono le stesse grandezze del profilo Normale (mente.js): per definizione il Normale
// è "una persona alla prima partita". Il banco controlla che il Facile perda e il Difficile
// vinca contro di lei più o meno quanto chiede SPECIFICA.md.

import { carica, partita } from './lib.mjs';
import { creaMente, PROFILI } from '../../public/games/intruso/mente.js';
import { gauss } from '../../public/games/cpu.js';

const volte = Number(process.argv[2]) || 60;
// node test/bench/intruso.mjs 100 persone4  -> solo una parte (ordine, persone4, persone8, durata)
const parte = process.argv[3] || '';
const fai = (k) => !parte || parte === k;
const base = await carica('intruso');
const def = { ...base, crea: (ctx) => (ctx.__gioco = base.crea(ctx)) };
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// La persona media: il profilo Normale, con la sua variazione personale.
function persona(io) {
  const gioco = io.ctx.__gioco;
  const z = gauss();
  const P = { ...PROFILI[1], vedePugno: clamp(0.6 + 0.08 * z, 0.3, 0.9), scambio: clamp(1 - 0.15 * z, 0.4, 1.6), controlla: clamp(0.5 + 0.15 * z, 0, 1) };
  const tratti = { aggressivita: Math.random(), prudenza: Math.random(), pazienza: Math.random(), costanza: Math.random() };
  const coda = [];
  gioco.ascolta((ev) => coda.push(ev));
  let mente = null;
  let round = -1;
  return {
    aggiorna(dt) {
      const M = gioco.mondo;
      if (M.round !== round) {
        round = M.round;
        mente = creaMente(P, { tratti });
        coda.length = 0;
      }
      if (gioco.fase() !== 'gioco') return;
      const me = gioco.io(io.id);
      for (const ev of coda) mente.osserva(ev, me);
      coda.length = 0;
      const out = mente.decidi(gioco.tv(), me, dt);
      io.input({ j: out.j, p: out.p ? 1 : 0 });
    },
  };
}

// Statistiche dei round (durata, motivo, passanti rimasti) per una partita.
function conRound(acc) {
  return {
    ...def,
    crea(ctx) {
      const gg = def.crea(ctx);
      const a = gg.aggiorna;
      let visto = -1;
      gg.aggiorna = (dt) => {
        a(dt);
        const M = gg.mondo;
        if (M.fine && visto !== M.round) {
          visto = M.round;
          acc.round.push(M.fine.t);
          acc.motivi[M.fine.motivo] = (acc.motivi[M.fine.motivo] || 0) + 1;
          acc.passanti.push(M.ents.filter((e) => e.tipo === 'npc' && e.vivo).length);
          for (const g of M.giocatori.values()) {
            const r = g.rounds[g.rounds.length - 1];
            acc.kill += r.kill;
            acc.errori += r.errori;
            acc.monete += r.monete;
          }
        }
      };
      return gg;
    },
  };
}

const media = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

// 1. Ordine dei livelli: una CPU per livello (più due Normali per non giocare in 3 soli).
if (fai('ordine')) {
  console.log(`\n== Ordine dei livelli (${volte} partite: F, N, D + 2 N di contorno) ==`);
  const pos = [0, 0, 0];
  const vince = [0, 0, 0];
  const ultimo = [0, 0, 0];
  const punti = [0, 0, 0];
  for (let k = 0; k < volte; k++) {
    const r = partita(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }, { livello: 1 }, { livello: 1 }]);
    const peggio = Math.max(...Object.values(r.pos));
    for (let i = 0; i < 3; i++) {
      const id = r.ids[i];
      pos[i] += r.pos[id];
      if (r.pos[id] === 1) vince[i]++;
      if (r.pos[id] === peggio) ultimo[i]++;
      punti[i] += r.punteggi[id];
    }
  }
  ['Facile', 'Normale', 'Difficile'].forEach((nome, i) =>
    console.log(`  ${nome.padEnd(10)} pos. media ${(pos[i] / volte).toFixed(2)}  vince ${pct(vince[i] / volte)}  ultimo ${pct(ultimo[i] / volte)}  punti ${(punti[i] / volte).toFixed(1)}`),
  );
}

// 2. Una CPU in mezzo a persone simulate: quante volte fa più punti di una persona.
for (const n of [4, 8]) {
  if (!fai(`persone${n}`)) continue;
  console.log(`\n== CPU contro persone simulate (${n} giocatori: 1 CPU + ${n - 1} persone, ${volte} partite) ==`);
  for (let liv = 0; liv < 3; liv++) {
    let meglio = 0;
    let confronti = 0;
    let pCpu = 0;
    let pUm = 0;
    for (let k = 0; k < volte; k++) {
      const specs = [{ livello: liv }, ...Array.from({ length: n - 1 }, () => ({ umano: persona }))];
      const r = partita(def, specs);
      const c = r.punteggi[r.ids[0]];
      pCpu += c;
      for (const id of r.ids.slice(1)) {
        const u = r.punteggi[id];
        pUm += u / (n - 1);
        meglio += c > u ? 1 : c === u ? 0.5 : 0;
        confronti++;
      }
    }
    console.log(`  ${PROFILI[liv].nome.padEnd(10)} batte la persona ${pct(meglio / confronti)}   punti CPU ${(pCpu / volte).toFixed(1)} · persona ${(pUm / volte).toFixed(1)}`);
  }
}

// 3. Durata e ritmo con sole CPU Normali.
if (fai('durata')) console.log(`\n== Durata (CPU Normali, ${Math.ceil(volte / 3)} partite per gruppo) ==`);
for (const n of fai('durata') ? [3, 4, 8, 16] : []) {
  const acc = { round: [], motivi: {}, passanti: [], kill: 0, errori: 0, monete: 0 };
  const quante = Math.ceil(volte / 3);
  let durata = 0;
  for (let k = 0; k < quante; k++) durata += partita(conRound(acc), Array.from({ length: n }, () => ({ livello: 1 }))).secondi;
  const nr = acc.round.length;
  console.log(
    `  ${String(n).padStart(2)} giocatori: partita ${(durata / quante).toFixed(0)} s · round ${media(acc.round).toFixed(0)} s · finiti col tempo ${pct((acc.motivi.tempo || 0) / nr)} · passanti alla fine ${media(acc.passanti).toFixed(0)} · a round: eliminati ${(acc.kill / nr).toFixed(1)}, errori ${(acc.errori / nr).toFixed(1)}, monete ${(acc.monete / nr).toFixed(1)}`,
  );
}
