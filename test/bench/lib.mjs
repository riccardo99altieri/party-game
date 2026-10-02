// Banco di prova delle CPU: fa giocare un minigioco senza browser, con CPU di
// livelli diversi (ed eventualmente "persone simulate"), e raccoglie statistiche.
// Non fa parte di `npm test`: gli script in test/bench/ si lanciano a mano, per esempio
//   node test/bench/azione.mjs

import { casuale, prepara, disegnaAvatar, disegnaTesta } from '../../public/shared/avatar.js';
import { coloreGiocatore, griglia, gruppiDaPunteggi, posizioniDaGruppi } from '../../public/shared/util.js';
import { testo, pannello, etichetta, barraTempo, testoSu } from '../../public/host/stage.js';
import { creaCpu } from '../../public/games/cpu.js';

// Un finto contesto 2D che accetta qualsiasi chiamata.
export function finto2d() {
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

if (!globalThis.document) globalThis.document = { createElement: () => finto2d() };

export async function carica(id) {
  return (await import(`../../public/games/${id}/host.js`)).default;
}

// specs: un elemento per giocatore:
//   { livello: 0|1|2 }                       -> CPU di quel livello
//   { ..., ruolo: 'polpo' }                  -> nei giochi a ruoli, il ruolo di quel giocatore
//   { umano: (io) => ({ aggiorna(dt) {...} }) } -> persona simulata: io.input(d) manda
//       dati come farebbe il telefono, io.vista() è l'ultima schermata ricevuta,
//       io.messaggi i messaggi al volo ricevuti, io.ora() l'orologio.
// Restituisce { ids, gruppi, pos: {id: posizione}, punteggi, dettagli, secondi }.
export function partita(def, specs, { dt = 1 / 30, secondiMax = 400, disegna = false } = {}) {
  let tempoMs = 1_000_000;
  let risultato = null;
  let timers = [];
  const viste = new Map();
  const messaggi = new Map();
  const lista = specs.map((s, i) => ({
    id: `p${i}`,
    nome: s.nome || (s.umano ? `Umano ${i + 1}` : `CPU ${i + 1}`),
    av: prepara(casuale(i % 16)),
    idx: i % 16,
    colore: coloreGiocatore(i % 16),
    bot: !s.umano,
    livello: s.umano ? null : s.livello ?? 1,
    connesso: true,
  }));
  const cervelli = new Map();
  const efx = new Proxy({}, { get: () => () => {} });
  const destinatari = (chi) => (chi === '*' ? lista.map((p) => p.id) : Array.isArray(chi) ? chi : [chi]);
  const ctx = {
    run: 'bench',
    giocatori: lista,
    W: 1920,
    H: 1080,
    tempo: 0,
    fx: efx,
    sfx: efx,
    vista: (chi, s) => {
      for (const id of destinatari(chi)) viste.set(id, s);
    },
    invia: (chi, d) => {
      for (const id of destinatari(chi)) {
        if (!messaggi.has(id)) messaggi.set(id, []);
        messaggi.get(id).push(d);
      }
    },
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
  // Giochi a ruoli (es. Il Polpo): { ruolo: 'polpo' } in una specifica fissa il ruolo;
  // senza, il gioco sceglie da solo.
  if (specs.some((s) => s.ruolo)) ctx.ruoli = Object.fromEntries(lista.map((p, i) => [p.id, specs[i].ruolo || null]));
  const g = finto2d();
  const gioco = def.crea(ctx);
  const umani = [];
  specs.forEach((s, i) => {
    if (!s.umano) return;
    const id = lista[i].id;
    if (!messaggi.has(id)) messaggi.set(id, []);
    umani.push(
      s.umano({
        id,
        ctx,
        input: (d) => gioco.input(id, d),
        vista: () => viste.get(id),
        messaggi: messaggi.get(id),
        ora: () => tempoMs,
      }),
    );
  });
  if (disegna) gioco.disegna(g);
  if (gioco.inizia) gioco.inizia();
  const passi = Math.ceil(secondiMax / dt);
  for (let passo = 0; passo < passi && !risultato; passo++) {
    tempoMs += dt * 1000;
    ctx.tempo += dt;
    const scaduti = timers.filter((t) => t.t <= ctx.tempo);
    timers = timers.filter((t) => t.t > ctx.tempo);
    scaduti.forEach((t) => t.fn());
    if (gioco.bot) for (const p of lista) if (p.bot) gioco.bot(p.id, dt);
    for (const u of umani) u.aggiorna(dt);
    gioco.aggiorna(dt);
    if (disegna && passo % 10 === 0) gioco.disegna(g);
  }
  if (!risultato) throw new Error(`${def.id}: la partita non è finita in ${secondiMax} s`);
  let gruppi = risultato.gruppi;
  if (!gruppi) gruppi = gruppiDaPunteggi(risultato.punteggi || {}, risultato.alto !== false);
  const presenti = new Set(gruppi.flat());
  const mancanti = lista.filter((p) => !presenti.has(p.id)).map((p) => p.id);
  if (mancanti.length) gruppi = [...gruppi, mancanti];
  return {
    ids: lista.map((p) => p.id),
    gruppi,
    pos: posizioniDaGruppi(gruppi),
    punteggi: risultato.punteggi || null,
    dettagli: risultato.dettagli || {},
    secondi: ctx.tempo,
  };
}

// Gioca `volte` partite con gli stessi specs e riassume per ogni giocatore:
// posizione media, % di vittorie (anche a pari merito), % di ultimi posti,
// punteggio medio (se il gioco usa punteggi) e durata media.
// Con { mescola: true } l'ordine dei giocatori (e quindi il posto in campo) cambia a
// ogni partita: serve nei giochi dove il posto conta (per esempio le Bocce).
export function serie(def, specs, volte, opzioni = {}) {
  const n = specs.length;
  const acc = specs.map(() => ({ pos: 0, vittorie: 0, ultimi: 0, punti: 0, conPunti: 0 }));
  let durata = 0;
  for (let k = 0; k < volte; k++) {
    const ordine = specs.map((_, i) => i);
    if (opzioni.mescola) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
      }
    }
    const r = partita(def, ordine.map((i) => specs[i]), opzioni);
    durata += r.secondi;
    const peggiore = Math.max(...Object.values(r.pos));
    // r.ids[posto] gioca per specs[ordine[posto]]
    r.ids.forEach((id, posto) => {
      const i = ordine[posto];
      acc[i].pos += r.pos[id];
      if (r.pos[id] === 1) acc[i].vittorie++;
      if (r.pos[id] === peggiore && peggiore > 1) acc[i].ultimi++;
      if (r.punteggi && typeof r.punteggi[id] === 'number' && r.punteggi[id] < 1e8) {
        acc[i].punti += r.punteggi[id];
        acc[i].conPunti++;
      }
    });
  }
  return {
    durata: durata / volte,
    giocatori: acc.map((a, i) => ({
      spec: specs[i].umano ? specs[i].nome || 'umano' : ['Facile', 'Normale', 'Difficile'][specs[i].livello ?? 1],
      posMedia: a.pos / volte,
      vittorie: a.vittorie / volte,
      ultimi: a.ultimi / volte,
      puntiMedi: a.conPunti ? a.punti / a.conPunti : null,
    })),
    n,
  };
}

// Tabellina leggibile nel terminale.
export function stampa(titolo, s) {
  console.log(`\n${titolo}  (durata media ${s.durata.toFixed(1)} s)`);
  for (const g of s.giocatori) {
    const pt = g.puntiMedi == null ? '' : `  punteggio medio ${g.puntiMedi.toFixed(1)}`;
    console.log(
      `  ${g.spec.padEnd(12)} pos. media ${g.posMedia.toFixed(2)}  vince ${(g.vittorie * 100).toFixed(0).padStart(3)}%  ultimo ${(g.ultimi * 100).toFixed(0).padStart(3)}%${pt}`,
    );
  }
}
