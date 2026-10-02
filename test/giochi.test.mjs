// Fa giocare ogni minigioco a soli bot, senza browser, con un tempo simulato.
// Controlla che non ci siano errori e che ogni partita finisca con una classifica valida.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ELENCO } from '../public/games/index.js';
import { casuale, prepara, disegnaAvatar, disegnaTesta } from '../public/shared/avatar.js';
import { coloreGiocatore, griglia, gruppiDaPunteggi } from '../public/shared/util.js';
import { testo, pannello, etichetta, barraTempo, testoSu } from '../public/host/stage.js';
import { creaCpu } from '../public/games/cpu.js';

// GIOCHI=sumo,bocce npm test  -> prova solo quei minigiochi
const SOLO = process.env.GIOCHI ? process.env.GIOCHI.split(',') : null;

// Un finto contesto 2D che accetta qualsiasi chiamata.
function finto2d() {
  const gradiente = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradiente;
        if (prop === 'measureText') return (s) => ({ width: String(s).length * 10 });
        if (prop === 'getContext') return () => finto2d();
        if (prop === 'toDataURL') return () => 'data:image/jpeg;base64,';
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
}

globalThis.document = { createElement: () => finto2d() };

function giocatori(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nome: `Bot ${i + 1}`,
    av: prepara(casuale(i)),
    idx: i,
    colore: coloreGiocatore(i),
    bot: true,
    livello: i % 3, // tutti e tre i livelli di potenza
    connesso: true,
  }));
}

function simula(def, n, secondiMax = 400) {
  let tempoMs = 1_000_000;
  let risultato = null;
  let timers = [];
  const viste = [];
  const lista = giocatori(n);
  const cervelli = new Map();
  const efx = new Proxy({}, { get: () => () => {} });
  const ctx = {
    run: 'test',
    giocatori: lista,
    W: 1920,
    H: 1080,
    tempo: 0,
    fx: efx,
    sfx: efx,
    vista: (chi, s) => viste.push({ chi, s }),
    invia: () => {},
    fine: (r) => {
      if (!risultato) risultato = r;
    },
    dopo: (sec, fn) => timers.push({ t: ctx.tempo + sec, fn }),
    ora: () => tempoMs,
    giocatore: (id) => lista.find((p) => p.id === id),
    cpu: (id) => {
      if (!cervelli.has(id)) cervelli.set(id, creaCpu(lista.find((p) => p.id === id)));
      return cervelli.get(id);
    },
    connesso: () => true,
    avatar: disegnaAvatar,
    testa: disegnaTesta,
    testo,
    pannello,
    etichetta,
    barraTempo,
    griglia,
    testoSu,
  };
  const g = finto2d();
  const gioco = def.crea(ctx);
  gioco.disegna(g);
  if (gioco.inizia) gioco.inizia();
  const dt = 1 / 30;
  for (let passo = 0; passo < secondiMax * 30 && !risultato; passo++) {
    tempoMs += dt * 1000;
    ctx.tempo += dt;
    const scaduti = timers.filter((t) => t.t <= ctx.tempo);
    timers = timers.filter((t) => t.t > ctx.tempo);
    scaduti.forEach((t) => t.fn());
    if (gioco.bot) for (const p of lista) gioco.bot(p.id, dt);
    gioco.aggiorna(dt);
    if (passo % 10 === 0) gioco.disegna(g);
  }
  // Qualche passo dopo la fine (animazioni) non deve rompersi.
  for (let i = 0; i < 20; i++) {
    gioco.aggiorna(dt);
    gioco.disegna(g);
  }
  return { risultato, secondi: ctx.tempo, viste };
}

for (const id of ELENCO.filter((x) => !SOLO || SOLO.includes(x))) {
  const { default: def } = await import(`../public/games/${id}/host.js`);
  for (const n of [3, 8, 16]) {
    test(`${def.nome} con ${n} bot finisce con una classifica valida`, (t) => {
      const { risultato, secondi, viste } = simula(def, n);
      assert.ok(risultato, `la partita non è finita (tempo simulato ${secondi.toFixed(1)} s)`);
      assert.ok(viste.length > 0, 'nessuna vista mandata ai telefoni');
      let gruppi = risultato.gruppi;
      if (!gruppi) {
        assert.ok(risultato.punteggi, 'serve gruppi o punteggi');
        gruppi = gruppiDaPunteggi(risultato.punteggi, risultato.alto !== false);
      }
      const tutti = gruppi.flat().sort();
      assert.deepEqual(tutti, giocatori(n).map((p) => p.id).sort(), 'ogni giocatore compare una volta sola');
      assert.ok(secondi < (def.durataMax || 300), `partita troppo lunga: ${secondi.toFixed(0)} s`);
      t.diagnostic(`durata simulata: ${secondi.toFixed(0)} s`);
    });
  }
}
