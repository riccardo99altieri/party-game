// Banco di prova del Circo dei Disperati: quante volte la squadra si salva, equilibrio tra
// i ruoli (nessun ruolo deve "condannare" chi lo riceve), livelli delle CPU contro le persone
// simulate, durata.
// Uso: node test/bench/circo.mjs [volte]
//
// ============================================================================
// TABELLA DI RIFERIMENTO "UMANA" (persona media alla prima partita)
// ============================================================================
//
// | grandezza                                 | persona media | perché |
// |-------------------------------------------|---------------|--------|
// | tempo di reazione a un segnale            | 0,46 s        | tocco sul telefono compreso; scelta tra 4 frecce ~0,52 s |
// | spostare un dito / fare uno swipe          | 0,24 s        | |
// | Cecchino: errore di tempo sul cursore      | 33 ms         | anticipare un bersaglio che si muove (coincidence timing) |
// | Batterista: errore di tempo su una nota    | 56 ms         | battere a tempo seguendo un segnale visivo (peggio che con l'audio) |
// | Batterista: memoria                        | ~5% a sequenza da 3, ~10% da 4 | molto di più se ci si distrae durante la chiamata |
// | Giocoliere: dito fermo che si stacca       | 2,6% a mossa  | le dita della stessa mano si trascinano a vicenda (più nel Caos) |
// | Giocoliere: dito sbagliato                 | 1,4% a mossa  | |
// | Navigatore: swipe dalla parte sbagliata    | 1,7%          | nell'Inversione la prima freccia si sbaglia 1 volta su 3 |
// | Straccio: velocità del dito                | 1,5 schermi/s | strofinare avanti e indietro sopra la macchia scelta |
// | distrazioni (guarda la TV, urla)           | 0,11 al s     | 0,4–1 s senza guardare il telefono |
// | dopo uno scambio di ruolo                  | ~0,8 s per capire, 1 volta su 4 sbaglia la prima sfida |
//
// Con queste mani una squadra di 5 persone medie si salva circa metà delle volte, quasi sempre
// con la barra bassa: la fase del Caos fa la differenza. Nel modello (public/games/circo/artisti.js)
// la persona media è l'abilità 0,4 sulla scala principiante (0) – campione (1); l'esperta 0,8.
// Livelli CPU: Facile 0,15 · Normale 0,4 · Difficile 0,7 (con il carattere e una piccola variazione).
// Il danno per errore scala con (5 / giocatori)^0,65: così la squadra si salva più o meno allo
// stesso modo da 3 a 16 giocatori (con 5 / giocatori pieno: 8 persone 77%, 3 persone 40%).
// Nel Circo una CPU "vince" contro una persona quando finisce più in alto in classifica, cioè
// quando sbaglia meno (a pari errori, fa meno danni).

import { carica, partita } from './lib.mjs';
import { programmi, NOMI_RUOLI, fase, DURATA } from '../../public/games/circo/regole.js';
import { creaArtista, parametri, ABILITA } from '../../public/games/circo/artisti.js';

const volte = Number(process.argv[2]) || 200;
const def = await carica('circo');
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;
const NOMI = ['Facile   ', 'Normale  ', 'Difficile'];

// Persona simulata: legge dal suo telefono (la vista) seme, ruolo, scambio e Caos, e gioca
// con le stesse mani simulate delle CPU, ma con l'abilità di una persona.
function persona(a = ABILITA.persona, nome = 'persona') {
  const tratti = { prudenza: Math.random(), aggressivita: Math.random(), costanza: Math.random(), pazienza: Math.random() };
  return {
    nome,
    umano: (io) => {
      let art = null;
      return {
        aggiorna(dt) {
          const v = io.vista();
          if (!v || v.inizio == null || v.crollo != null || v.finito) return;
          const t = (io.ora() - v.inizio) / 1000;
          if (t < 0 || t >= DURATA) return;
          if (!art) art = creaArtista(parametri(a, tratti), programmi(v.seme), v.eventi);
          const ruolo = v.scambio && t >= v.scambio.t0 && t < v.scambio.t1 ? v.scambio.ruolo : v.ruolo;
          for (const e of art.passo(dt, t, ruolo)) io.input({ err: 1, r: e.r, i: e.i, t: e.t });
        },
      };
    },
  };
}

function gioca(specs) {
  let gioco = null;
  const spia = { ...def, crea: (ctx) => (gioco = def.crea(ctx)) };
  const r = partita(spia, specs);
  return { r, st: gioco.statistiche() };
}

const mescola = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

console.log(`Circo dei Disperati — ${volte} partite per prova`);

// 1) Quante volte la squadra si salva
console.log('\n1) Squadra salva (e barra media alla fine)   obiettivo: persone medie ~50%');
const prove = [
  ['3 persone', () => Array.from({ length: 3 }, () => persona())],
  ['4 persone', () => Array.from({ length: 4 }, () => persona())],
  ['5 persone', () => Array.from({ length: 5 }, () => persona())],
  ['8 persone', () => Array.from({ length: 8 }, () => persona())],
  ['5 CPU Facili', () => Array.from({ length: 5 }, () => ({ livello: 0 }))],
  ['5 CPU Normali', () => Array.from({ length: 5 }, () => ({ livello: 1 }))],
  ['5 CPU Difficili', () => Array.from({ length: 5 }, () => ({ livello: 2 }))],
  ['2 persone + 3 Normali', () => [persona(), persona(), { livello: 1 }, { livello: 1 }, { livello: 1 }]],
  ['5 persone esperte', () => Array.from({ length: 5 }, () => persona(ABILITA.esperto, 'esperto'))],
  ['16 persone (2 squadre)', () => Array.from({ length: 16 }, () => persona())],
];
const colpe = Object.fromEntries(NOMI_RUOLI.map((r) => [r, 0]));
const erroriRuolo = Object.fromEntries(NOMI_RUOLI.map((r) => [r, [0, 0, 0, 0]])); // fase 1-3 + giocatori
for (const [nome, crea] of prove) {
  let salve = 0;
  let squadre = 0;
  let barra = 0;
  let durata = 0;
  const N = nome.startsWith('16') ? Math.max(20, Math.floor(volte / 4)) : volte;
  for (let k = 0; k < N; k++) {
    const { r, st } = gioca(crea());
    durata += r.secondi;
    for (const s of st.squadre) {
      squadre++;
      if (s.barra > 0) salve++;
      barra += s.barra;
    }
    if (nome === '5 persone') {
      for (const [id, g] of Object.entries(st.giocatori)) {
        erroriRuolo[g.ruolo][3]++;
        for (const e of g.errori) erroriRuolo[g.ruolo][fase(e.t)]++;
      }
      for (const es of st.esito.esiti) for (const id of es.colpevoli) colpe[st.giocatori[id].ruolo] += 1 / es.colpevoli.length;
    }
  }
  console.log(`  ${nome.padEnd(24)} salva ${pct(salve / squadre)}   barra finale ${(barra / squadre).toFixed(0).padStart(3)}%   durata ${(durata / N).toFixed(1)} s`);
}

// 2) Equilibrio tra i ruoli (squadre da 5 persone medie, Caos compreso)
console.log('\n2) Errori di una persona media per ruolo   (fase 1 · fase 2 · fase 3 = totale)   e quante volte è il Colpevole');
for (const r of NOMI_RUOLI) {
  const [a, b, c, n] = erroriRuolo[r];
  const m = (x) => (x / Math.max(1, n)).toFixed(2);
  console.log(`  ${r.padEnd(11)} ${m(a)} · ${m(b)} · ${m(c)} = ${m(a + b + c)}   Colpevole ${pct(colpe[r] / Math.max(1, Object.values(colpe).reduce((x, y) => x + y, 0)))}`);
}

// 3) CPU contro persone medie nella stessa squadra (testa a testa: chi finisce più in alto)
function contro(specCpu, quantePersone, P = ABILITA.persona) {
  let vinte = 0;
  let conti = 0;
  let errCpu = 0;
  let errPers = 0;
  for (let k = 0; k < volte; k++) {
    const specs = mescola([{ ...specCpu, cpu: true }, ...Array.from({ length: quantePersone }, () => persona(P))]);
    const { r, st } = gioca(specs);
    const idC = r.ids[specs.findIndex((s) => s.cpu)];
    errCpu += st.giocatori[idC].errori.length;
    specs.forEach((s, i) => {
      if (s.cpu) return;
      const idP = r.ids[i];
      errPers += st.giocatori[idP].errori.length / quantePersone;
      vinte += r.pos[idC] < r.pos[idP] ? 1 : r.pos[idC] === r.pos[idP] ? 0.5 : 0;
      conti++;
    });
  }
  return { quota: vinte / conti, errCpu: errCpu / volte, errPers: errPers / volte };
}
console.log('\n3) CPU contro una persona media (squadra da 5, pari merito = mezza vittoria)   obiettivo: F 20–30%, N 45–55%, D 70–85%');
for (const liv of [0, 1, 2]) {
  const s = contro({ livello: liv }, 4);
  console.log(`  ${NOMI[liv]}  vince ${pct(s.quota)}   errori a partita: CPU ${s.errCpu.toFixed(2)}, persona ${s.errPers.toFixed(2)}`);
}
{
  const s = contro({ livello: 2 }, 4, ABILITA.esperto);
  console.log(`  Difficile contro persone esperte: vince ${pct(s.quota)} (deve stare sotto il 50%)   errori CPU ${s.errCpu.toFixed(2)}, esperto ${s.errPers.toFixed(2)}`);
}

// 4) Ordine dei livelli: F, N, D nella stessa squadra con due persone
{
  const pos = [0, 0, 0];
  for (let k = 0; k < volte; k++) {
    const specs = mescola([{ livello: 0, k: 0 }, { livello: 1, k: 1 }, { livello: 2, k: 2 }, persona(), persona()]);
    const { r } = gioca(specs);
    specs.forEach((s, i) => {
      if (s.k != null) pos[s.k] += r.pos[r.ids[i]];
    });
  }
  console.log(`\n4) Posizione media (F, N, D + 2 persone): ${pos.map((p, i) => `${NOMI[i].trim()} ${(p / volte).toFixed(2)}`).join('  ')}`);
}
