// Banco di prova di Detonazione: livelli delle CPU, confronto con le persone simulate, durata.
// Uso: node test/bench/bomba.mjs [volte]
//
// ============================================================================
// TABELLA DI RIFERIMENTO "UMANA" (persona media alla prima partita)
// ============================================================================
//
// | grandezza                                  | persona media | perché |
// |--------------------------------------------|---------------|--------|
// | accorgersi che è arrivata la bomba         | 0,47 s        | si guarda la TV: il telefono vibra, bisogna abbassare gli occhi e leggere il primo gesto (reazione a uno stimolo tattile ~0,3 s + spostare lo sguardo) |
// | distrazioni (+0,3…0,9 s)                   | 6% delle volte| si stava guardando un'altra bomba, si rideva… |
// | leggere il gesto dopo                      | 0,20 s        | la sequenza è già tutta sul telefono: basta spostare lo sguardo di un'icona |
// | swipe                                      | 0,26 s        | un colpo di pollice di 4–5 cm |
// | doppio tap                                 | 0,30 s        | due tocchi a ~0,12 s l'uno dall'altro più il tempo di arrivare |
// | tieni premuto                              | 0,50 + 0,12 s | il telefono vuole 0,5 s fermo, più appoggiare il dito |
// | pizzica                                    | 0,55 s        | mettere giù due dita (serve riposizionare la mano) e avvicinarle |
// | gesto sbagliato (si ricomincia)            | 4% a gesto    | sotto pressione si confondono ← e →, ↑ e ↓, o si "anticipa" il gesto dopo |
// | gesto non riconosciuto (si rifà)           | 8% a gesto    | solo doppio tap, tieni premuto e pizzica: tap troppo lenti, dito alzato presto, pizzico corto |
// | panico col timer sotto 4                   | errori ×1,4   | la fretta fa sbagliare |
// Totale: 4 gesti ≈ 2,9–3,2 s a passaggio per una persona media.
//
// Persona esperta (ci ha già giocato parecchio, mani veloci): accorgersi 0,32 s, leggere 0,14 s,
// gesti ×0,6, 1% di gesti sbagliati, 2,5% non riconosciuti, panico ×1,05. Deve battere (di poco) il Difficile.
//
// Livelli CPU (host.js): Facile = gesti ×1,45, 7% sbagliati, 14% non riconosciuti, spesso distratto,
// panico ×1,8; Normale = la persona media; Difficile = gesti ×0,68, 1,2% sbagliati, 3% non
// riconosciuti, panico ×1,1. Il gioco non ha scelte (il bersaglio è a caso): la differenza tra
// i livelli sta solo nella velocità, negli errori e nei nervi saldi. Con la fortuna di mezzo
// (a chi va la bomba, quando scoppia) il gioco è "caotico" come le Bocce.

import { carica, partita, stampa, serie } from './lib.mjs';
import { gauss } from '../../public/games/cpu.js';
import { LUNGHEZZA, TIENI_MS, GESTI, display } from '../../public/games/bomba/regole.js';
import { ESEGUI } from '../../public/games/bomba/host.js';

const volte = Number(process.argv[2]) || 200;
const def = await carica('bomba');
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;

const PERSONA = { accorgersi: 0.47, distratto: 0.06, leggere: 0.2, vel: 1, varia: 0.22, sbaglia: 0.04, manca: 0.08, panico: 1.4 };
const ESPERTO = { accorgersi: 0.32, distratto: 0.02, leggere: 0.14, vel: 0.6, varia: 0.14, sbaglia: 0.01, manca: 0.025, panico: 1.05 };

const logn = (mediana, sigma) => mediana * Math.exp(gauss() * sigma);

// Persona simulata: usa solo il suo telefono (la vista) e manda quello che manderebbe il telefono.
function persona(P = PERSONA, nome = 'persona') {
  const f = (io) => {
    let k = null;
    let i = 0;
    let tt = 0;
    const num = (b) => display(b.B0, Math.max(0, b.T - (b.scade - io.ora()) / 1000));
    const durata = (g, b) => logn(P.leggere, 0.25) + ESEGUI[g] * P.vel * Math.exp(gauss() * P.varia) * (num(b) <= 4 ? 0.92 : 1) + (g === 'tieni' ? TIENI_MS / 1000 : 0);
    return {
      aggiorna(dt) {
        const v = io.vista();
        const b = v && v.fase === 'gioco' && v.bomba;
        if (!b) {
          k = null;
          return;
        }
        if (b.k !== k) {
          k = b.k;
          i = 0;
          tt = logn(P.accorgersi, 0.25) + (Math.random() < P.distratto ? 0.3 + Math.random() * 0.6 : 0) + durata(b.seq[0], b);
          return;
        }
        tt -= dt;
        if (tt > 0) return;
        const g = b.seq[i];
        if (Math.random() < P.sbaglia * (num(b) <= 4 ? P.panico : 1)) {
          io.input({ k, errore: true });
          i = 0;
          tt = 0.25 + Math.random() * 0.3 + durata(b.seq[0], b);
          return;
        }
        if (GESTI[g].tipo !== 'swipe' && Math.random() < P.manca) {
          tt = 0.12 + Math.random() * 0.18 + durata(g, b);
          return;
        }
        i++;
        if (i >= LUNGHEZZA) io.input({ k, fatto: true });
        else {
          io.input({ k, passo: i });
          tt = durata(b.seq[i], b);
        }
      },
    };
  };
  return { umano: f, nome };
}

// Confronto a coppie: quante volte `chi` finisce davanti a ognuna delle persone (pari = mezzo).
function controPersone(specA, quantePersone, volte, P = PERSONA) {
  let vinte = 0;
  let conti = 0;
  let durata = 0;
  for (let k = 0; k < volte; k++) {
    const specs = [specA, ...Array.from({ length: quantePersone }, () => persona(P))];
    // posti mescolati (il posto non conta, ma così è pulito)
    const ordine = specs.map((_, i) => i).sort(() => Math.random() - 0.5);
    const r = partita(def, ordine.map((i) => specs[i]));
    durata += r.secondi;
    const idA = r.ids[ordine.indexOf(0)];
    for (let j = 1; j < specs.length; j++) {
      const idP = r.ids[ordine.indexOf(j)];
      vinte += r.pos[idA] < r.pos[idP] ? 1 : r.pos[idA] === r.pos[idP] ? 0.5 : 0;
      conti++;
    }
  }
  return { quota: vinte / conti, durata: durata / volte };
}

// Tempo medio per passare la bomba (da quando arriva a quando vola via), da una partita sola.
function tempoPassaggio(specs, volte) {
  const somma = specs.map(() => ({ tenuta: 0, passaggi: 0, errori: 0 }));
  for (let k = 0; k < volte; k++) {
    let gioco = null;
    const spia = { ...def, crea: (ctx) => (gioco = def.crea(ctx)) };
    const r = partita(spia, specs);
    const st = gioco.statistiche();
    r.ids.forEach((id, i) => {
      somma[i].tenuta += st[id].tenutaPassata;
      somma[i].passaggi += st[id].passaggi;
      somma[i].errori += st[id].errori;
    });
  }
  return somma.map((s) => ({ secondi: s.tenuta / Math.max(1, s.passaggi), errori: s.errori / Math.max(1, s.passaggi) }));
}

console.log(`Detonazione — ${volte} partite per prova`);

console.log('\n1) Tempo per passare la bomba (media, secondi) e gesti sbagliati a passaggio');
const nomi = ['Facile', 'Normale', 'Difficile', 'persona media', 'persona esperta'];
const tp = tempoPassaggio([{ livello: 0 }, { livello: 1 }, { livello: 2 }, persona(PERSONA), persona(ESPERTO, 'esperto')], Math.ceil(volte / 4));
tp.forEach((x, i) => console.log(`  ${nomi[i].padEnd(16)} ${x.secondi.toFixed(2)} s   errori ${x.errori.toFixed(2)}`));

stampa('2) Ordine dei livelli: F, N, D (3 giocatori, 3 vite)', serie(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte, { mescola: true }));
stampa('   Ordine dei livelli con 6 giocatori (2 per livello, 1 vita)', serie(def, [0, 0, 1, 1, 2, 2].map((l) => ({ livello: l })), volte, { mescola: true }));

console.log('\n3) Contro le persone simulate: % di volte che la CPU finisce davanti a una persona media');
console.log('   obiettivo: Facile 20–30%, Normale 45–55%, Difficile 70–85%');
for (const [persone, etichetta] of [
  [2, '3 giocatori (3 vite)'],
  [3, '4 giocatori (2 vite)'],
  [5, '6 giocatori (1 vita)'],
]) {
  const riga = [0, 1, 2].map((l) => pct(controPersone({ livello: l }, persone, volte).quota));
  console.log(`   ${etichetta.padEnd(22)} F ${riga[0]}   N ${riga[1]}   D ${riga[2]}`);
}
const esp = controPersone({ livello: 2 }, 2, volte, ESPERTO).quota;
console.log(`   Difficile contro una persona esperta (3 giocatori): ${pct(esp)} (deve stare sotto il 50%)`);

console.log('\n4) Durata con CPU tutte uguali (Normale)');
for (const n of [3, 4, 5, 6, 7, 8, 12, 16]) {
  const s = serie(def, Array.from({ length: n }, () => ({ livello: 1 })), Math.ceil(volte / 4));
  console.log(`   ${String(n).padStart(2)} giocatori: ${s.durata.toFixed(0)} s`);
}
