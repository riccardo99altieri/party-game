// Banco di prova del Polpo (gioco a ruoli: 1–2 Polpi contro tutti i pesci).
// Uso: node test/bench/polpo.mjs [partite] [--veloce]
//
// Misure:
//  1. equilibrio per numero di giocatori, tutte CPU Normali: quanti pesci arrivano
//     (obiettivo 45–65%: il Polpo deve fare paura, ma la maggior parte ce la fa), quanti
//     vengono catturati, quanti punti torneo prende il Polpo rispetto alla media (il ruolo
//     non deve essere né una condanna né un premio sicuro), quanto dura la partita;
//  2. CPU pesce contro le persone simulate: 1 CPU + 3 persone-pesce contro un Polpo CPU
//     Normale (5 giocatori). Quante volte la CPU fa più punti di una persona (a coppie,
//     pari = mezzo punto). Obiettivo della specifica: F 20–30%, N 45–55%, D 70–85%;
//  3. CPU Polpo contro la persona simulata: quanti pesci ferma una CPU Polpo contro 4
//     persone-pesce, confrontato con quanti ne ferma una persona-Polpo nella stessa
//     situazione: P(la CPU ne ferma di più) + ½ P(pari). Stesso obiettivo;
//  4. ordine dei livelli: un pesce F, uno N e uno D insieme (contro un Polpo Normale).
//
// =============================================================================
// PERSONE SIMULATE (ipotesi dichiarate)
// =============================================================================
//
// Persona-pesce (alla prima o seconda partita, telefono in mano, guarda la TV):
// - vede i passaggi tra gli scogli e ci va (la stessa "strada" delle CPU, percorso.js),
//   con qualche esitazione: decide ogni 0,2–0,3 s;
// - tempo di reazione log-normale, mediana 0,36 s (come cpu.reazione del Normale);
// - si accorge di un preavviso che la riguarda 7 volte su 10 e scappa, e usa lo scatto
//   per scappare 6 volte su 10 (se è pronto);
// - usa lo scatto spesso anche per correre (le persone lo premono appena si ricarica);
// - si accorge del mirino addosso 1 volta su 2 e cambia direzione;
// - con la Marea cerca riparo 1 volta su 2;
// - coralli: se ne vede uno vicino (< 220 px) ci va 1 volta su 2;
// - comandi invertiti: capisce e corregge dopo ~1 s.
// Bravura presa a caso dalla popolazione (z gaussiana): cambia attenzione e reazione.
//
// Persona-Polpo (dito sulla mappa del telefono, occhi sulla TV):
// - insegue soprattutto chi è davanti (6 volte su 10), altrimenti chi è vicino al mirino;
//   se un pesce ha una sola bolla, lo nota 1 volta su 2;
// - muove il mirino a ~1100 px/s, mira dove il pesce è ora (anticipa poco), errore ~30 px;
// - lancia il tentacolo appena può; la spinta a volte (e sul pesce tenuto 1 volta su 3);
// - la medusa ogni tanto davanti a un pesce; la Marea a metà partita, quando se ne ricorda.
// =============================================================================

import { pathToFileURL } from 'node:url';
import { carica, partita } from './lib.mjs';
import { gauss } from '../../public/games/cpu.js';
import { puntiDaGruppi } from '../../public/shared/util.js';
import { creaPercorso } from '../../public/games/polpo/percorso.js';
import { suMappa, POTERI } from '../../public/games/polpo/regole.js';

const argomenti = process.argv.slice(2);
const VELOCE = argomenti.includes('--veloce');
const VOLTE = Number(argomenti.find((a) => /^\d+$/.test(a))) || (VELOCE ? 60 : 200);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const NOMI = ['Facile', 'Normale', 'Difficile'];
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;
const dir8 = (x, y) => {
  if (Math.hypot(x, y) < 1e-6) return [0, 0];
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
};

// Le persone guardano la TV: il gioco dice cosa c'è sullo schermo (tv()).
function conTv(def) {
  return { ...def, crea: (ctx) => (ctx.__gioco = def.crea(ctx)) };
}

function personaPesce(io) {
  const z = gauss();
  const reazione = () => Math.min(2, 0.36 * Math.exp(-0.1 * z + gauss() * 0.22));
  const attenzione = clamp(0.7 + 0.1 * z, 0.4, 0.95);
  const schiva = clamp(0.5 + 0.15 * z, 0.15, 0.9);
  const riparo = clamp(0.5 + 0.15 * z, 0.15, 0.9);
  const scattoFuga = 0.6;
  const scattoCorsa = clamp(0.5 + 0.2 * gauss(), 0.1, 0.9);
  const adatta = () => Math.min(3, Math.exp(gauss() * 0.3 - 0.1 * z));
  let t = 0;
  let tDecidi = 0;
  let strada = null;
  let rotta = [1, 0];
  let fuga = null;
  const visti = new Map();
  let mirato = null;
  let marea = null;
  let zig = 1;
  let tZig = 0;
  let bersaglio = null;
  const valutati = new Set();
  let jx = 0;
  let jy = 0;
  let adattaDa = -1;
  let fineInv = -1;
  let eraInv = false;
  let pronto = 0; // quando lo scatto torna disponibile (la persona vede il suo telefono)
  let letti = 0;
  const scatta = () => {
    if (t >= pronto) io.input({ s: 1 });
  };
  return {
    aggiorna(dt) {
      t += dt;
      while (letti < io.messaggi.length) {
        const m = io.messaggi[letti++];
        if (m.ev === 'scatto') pronto = t + (m.dur || 2) + (m.cd || 5);
      }
      const tv = io.ctx.__gioco.tv();
      const me = tv.pesci.find((p) => p.id === io.id);
      if (!me || !me.inGioco) return;
      if (!strada) strada = creaPercorso(tv.fondale, { raggio: tv.raggio });
      for (const a of tv.attacchi) {
        const k = `${a.tipo}${a.x.toFixed(0)}${a.y.toFixed(0)}`;
        if (!visti.has(k)) visti.set(k, { vede: Math.random() < attenzione, quando: t + reazione() });
        const v = visti.get(k);
        if (!v.vede || t < v.quando || v.fatto) continue;
        const d = Math.hypot(me.x - a.x, me.y - a.y);
        if (d > a.raggio + tv.raggio + 14) continue;
        v.fatto = true;
        const ex = (me.x - a.x) / (d || 1) + 0.5;
        const ey = d < 6 ? (Math.random() < 0.5 ? 1 : -1) : (me.y - a.y) / d;
        if (Math.random() < scattoFuga) scatta();
        fuga = { d: [ex, ey], fino: t + a.resta + 0.15 };
        bersaglio = null;
      }
      if (tv.marea != null && !marea) marea = { vede: Math.random() < riparo, quando: t + reazione() * 1.2 };
      if (tv.marea == null) marea = null;
      if (marea && marea.vede && t >= marea.quando && !marea.meta) {
        let best = null;
        let bd = Infinity;
        for (const s of tv.fondale.scogli) {
          if (s.corsia !== me.corsia) continue;
          const mx = s.x - s.r - 40 * tv.scala;
          const d = Math.hypot(mx - me.x, s.y - me.y);
          if (d / (tv.V * 1.5) < tv.marea - 0.2 && d < bd && strada.dritto(me.x, me.y, mx, s.y)) {
            bd = d;
            best = { x: mx, y: s.y };
          }
        }
        marea.meta = best || { nessuna: true };
      }
      const mirino = tv.polpi.find((o) => Math.hypot(o.mx - me.x, o.my - me.y) < 150 * tv.scala);
      if (!mirino) mirato = null;
      else if (!mirato) mirato = { o: mirino, vede: Math.random() < schiva, quando: t + reazione() };
      if (me.invertito && !eraInv) adattaDa = t + adatta();
      if (!me.invertito && eraInv) fineInv = t + reazione();
      eraInv = me.invertito;
      if (t >= tDecidi) {
        tDecidi = t + 0.2 + Math.random() * 0.1;
        let d;
        if (fuga && t < fuga.fino) d = fuga.d;
        else if (marea && marea.meta && !marea.meta.nessuna) {
          const m = marea.meta;
          d = Math.hypot(m.x - me.x, m.y - me.y) < 12 ? [0, 0] : [m.x - me.x, m.y - me.y];
        } else {
          fuga = null;
          for (const c of tv.coralli) {
            const k = `${c.x.toFixed(0)},${c.y.toFixed(0)}`;
            if (c.corsia !== me.corsia || valutati.has(k) || Math.hypot(c.x - me.x, c.y - me.y) > 220) continue;
            valutati.add(k);
            if (c.x > me.x - 40 && Math.random() < 0.5) bersaglio = c;
          }
          if (bersaglio && !tv.coralli.some((c) => Math.abs(c.x - bersaglio.x) < 1 && Math.abs(c.y - bersaglio.y) < 1)) bersaglio = null;
          d = strada.direzione(me.x, me.y);
          if (bersaglio && strada.dritto(me.x, me.y, bersaglio.x, bersaglio.y)) d = [bersaglio.x - me.x, bersaglio.y - me.y];
          else bersaglio = null;
          if (mirato && mirato.vede && t >= mirato.quando && !bersaglio) {
            if (t >= tZig) {
              zig = Math.abs(mirato.o.my - me.y) > 10 && Math.random() < 0.7 ? Math.sign(me.y - mirato.o.my) : -zig;
              tZig = t + 0.35 + Math.random() * 0.3;
            }
            if (strada.dritto(me.x, me.y, me.x + 28 * tv.scala, me.y + zig * 28 * tv.scala)) d = [1, zig];
          }
          if (t >= pronto && Math.random() < scattoCorsa * 0.3) scatta();
        }
        rotta = dir8(d[0], d[1]);
      }
      let [ux, uy] = rotta;
      if ((me.invertito && adattaDa >= 0 && t >= adattaDa) || (!me.invertito && t < fineInv)) {
        ux = -ux;
        uy = -uy;
      }
      if (ux !== jx || uy !== jy) {
        jx = ux;
        jy = uy;
        io.input({ j: [ux, uy] });
      }
    },
  };
}

function personaPolpo(io) {
  const z = gauss();
  const reazione = () => Math.min(2, 0.36 * Math.exp(-0.1 * z + gauss() * 0.22));
  const vel = 1100 * Math.exp(0.15 * z);
  const errore = 30 * Math.exp(-0.25 * z);
  const anticipo = clamp(0.25 + 0.15 * z, 0, 0.7);
  const tMarea = 18 + Math.random() * 25;
  let t = 0;
  let piano = null;
  let tDecidi = 0.8;
  let tInvio = 0;
  let tUltimo = 0;
  const prima = new Map();
  let energia = 6;
  let cd = {};
  let mareaUsata = false;
  const pronto = (k) => (cd[k] || 0) <= t && energia >= POTERI[k].costo && !(k === 'marea' && mareaUsata);
  return {
    aggiorna(dt) {
      t += dt;
      const tv = io.ctx.__gioco.tv();
      const me = tv.polpi.find((o) => o.id === io.id);
      if (!me) return;
      energia = me.energia; // la persona vede la sua barra sul telefono
      mareaUsata = tv.mareaUsata;
      const vivi = tv.pesci.filter((p) => p.inGioco);
      if (!vivi.length) return;
      // velocità dei pesci stimata dal movimento
      for (const p of vivi) {
        const v = prima.get(p.id);
        prima.set(p.id, { x: p.x, y: p.y, t, vx: v && t > v.t ? (p.x - v.x) / (t - v.t) : 0, vy: v && t > v.t ? (p.y - v.y) / (t - v.t) : 0 });
      }
      const lancia = (k) => {
        io.input({ p: k });
        cd[k] = t + POTERI[k].cd;
      };
      if (!mareaUsata && t > tMarea && pronto('marea') && Math.random() < 0.5 * dt) return lancia('marea');
      if (!piano && t >= tDecidi) {
        tDecidi = t + 0.45 + Math.random() * 0.3;
        let q;
        const ultima = vivi.filter((p) => p.bolle === 1);
        if (ultima.length && Math.random() < 0.5) q = ultima[Math.floor(Math.random() * ultima.length)];
        else if (Math.random() < 0.6) q = vivi.reduce((a, b) => (b.x > a.x ? b : a));
        else q = vivi.reduce((a, b) => (Math.hypot(b.x - me.mx, b.y - me.my) < Math.hypot(a.x - me.mx, a.y - me.my) ? b : a));
        const tenuto = vivi.find((p) => p.presa);
        let tipo = null;
        if (tenuto && pronto('spinta') && Math.random() < 0.33) {
          q = tenuto;
          tipo = 'spinta';
        } else if (pronto('tentacolo') && !q.presa && !q.immune) tipo = 'tentacolo';
        else if (pronto('medusa') && Math.random() < 0.2) tipo = 'medusa';
        else if (pronto('spinta') && Math.random() < 0.3) tipo = 'spinta';
        if (tipo) piano = { q: q.id, tipo, ex: gauss() * errore, ey: gauss() * errore, scade: t + 2.5, pronto: null };
      }
      if (!piano) return;
      const p = vivi.find((x) => x.id === piano.q);
      if (!p || t > piano.scade) return void (piano = null);
      const v = prima.get(p.id);
      const lead = piano.tipo === 'medusa' ? 1.8 : anticipo * POTERI[piano.tipo].tell;
      const tx = p.x + v.vx * lead + piano.ex;
      const ty = p.y + v.vy * lead + piano.ey;
      const dx = tx - me.mx;
      const dy = ty - me.my;
      const d = Math.hypot(dx, dy);
      if (d > 1 && t >= tInvio) {
        const passo = Math.min(d, vel * Math.max(dt, t - tUltimo));
        tUltimo = t;
        tInvio = t + 0.04;
        io.input({ m: suMappa(me.mx + (dx / d) * passo, me.my + (dy / d) * passo) });
      }
      if (d < 30 * tv.scala) {
        if (piano.pronto == null) piano.pronto = t + reazione() * 0.5;
        if (t >= piano.pronto) {
          if (pronto(piano.tipo)) lancia(piano.tipo);
          piano = null;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------

const def = conTv(await carica('polpo'));
const polpiPer = (n) => (n >= 10 ? 2 : 1);
const opz = { secondiMax: 120 };
const arrivato = (r, id) => (r.dettagli[id] || '').includes('Arrivato');
const catturato = (r, id) => (r.dettagli[id] || '').includes('Catturato');

function mescola(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gioca con i posti mescolati; restituisce per ogni partita { r, idDi(i) }.
function gioca(specs, volte) {
  const out = [];
  for (let k = 0; k < volte; k++) {
    const ordine = mescola(specs.map((_, i) => i));
    const r = partita(def, ordine.map((i) => specs[i]), opz);
    const idDi = new Array(specs.length);
    ordine.forEach((i, posto) => (idDi[i] = r.ids[posto]));
    out.push({ r, idDi });
  }
  return out;
}

function equilibrio() {
  console.log(`\n1. Equilibrio, tutte CPU Normali (${VOLTE} partite per numero di giocatori): obiettivo 45–65% di pesci arrivati`);
  for (const n of [3, 4, 5, 6, 8, 9, 11, 14, 16]) {
    const np = polpiPer(n);
    const specs = Array.from({ length: n }, (_, i) => (i < np ? { livello: 1, ruolo: 'polpo' } : { livello: 1 }));
    let arr = 0;
    let catt = 0;
    let pesci = 0;
    let durata = 0;
    let puntiPolpo = 0;
    let puntiTutti = 0;
    for (const { r, idDi } of gioca(specs, VOLTE)) {
      durata += r.secondi;
      const punti = puntiDaGruppi(r.gruppi);
      puntiPolpo += punti[idDi[0]];
      puntiTutti += Object.values(punti).reduce((a, b) => a + b, 0) / n;
      for (let i = np; i < n; i++) {
        pesci++;
        if (arrivato(r, idDi[i])) arr++;
        if (catturato(r, idDi[i])) catt++;
      }
    }
    console.log(`  ${String(n).padStart(2)} giocatori: arrivati ${pct(arr / pesci)}  catturati ${pct(catt / pesci)}  punti torneo del Polpo ${(puntiPolpo / VOLTE).toFixed(1)} (media di tutti ${(puntiTutti / VOLTE).toFixed(1)})  durata ${(durata / VOLTE).toFixed(0)} s`);
  }
}

function pesciControPersone() {
  const volte = Math.round(VOLTE * 1.5);
  console.log(`\n2. CPU pesce contro 3 persone-pesce, Polpo CPU Normale (${volte} partite per livello): quante volte la CPU fa più punti di una persona`);
  for (const livello of [0, 1, 2]) {
    const specs = [{ livello }, { umano: personaPesce, nome: 'p1' }, { umano: personaPesce, nome: 'p2' }, { umano: personaPesce, nome: 'p3' }, { livello: 1, ruolo: 'polpo' }];
    let davanti = 0;
    let conti = 0;
    let arr = 0;
    let arrP = 0;
    for (const { r, idDi } of gioca(specs, volte)) {
      const pc = r.punteggi[idDi[0]];
      if (arrivato(r, idDi[0])) arr++;
      for (let i = 1; i <= 3; i++) {
        const pp = r.punteggi[idDi[i]];
        davanti += pc > pp ? 1 : pc === pp ? 0.5 : 0;
        conti++;
        if (arrivato(r, idDi[i])) arrP++;
      }
    }
    const obiettivo = ['20–30%', '45–55%', '70–85%'][livello];
    console.log(`  ${NOMI[livello].padEnd(10)} davanti alla persona ${pct(davanti / conti)}  (obiettivo ${obiettivo})  arriva ${pct(arr / volte)}, persone ${pct(arrP / conti)}`);
  }
}

function polpiControPersone() {
  const volte = Math.round(VOLTE * 1.5);
  const pesci = [1, 2, 3, 4].map((k) => ({ umano: personaPesce, nome: `p${k}` }));
  const fermati = (polpo) =>
    gioca([polpo, ...pesci], volte).map(({ r, idDi }) => [1, 2, 3, 4].filter((i) => !arrivato(r, idDi[i])).length);
  const base = fermati({ umano: personaPolpo, nome: 'persona-polpo', ruolo: 'polpo' });
  const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  console.log(`\n3. CPU Polpo contro 4 persone-pesce (${volte} partite): la persona-Polpo ne ferma in media ${media(base).toFixed(2)}`);
  for (const livello of [0, 1, 2]) {
    const cpu = fermati({ livello, ruolo: 'polpo' });
    let meglio = 0;
    for (const a of cpu) for (const b of base) meglio += a > b ? 1 : a === b ? 0.5 : 0;
    const obiettivo = ['20–30%', '45–55%', '70–85%'][livello];
    console.log(`  ${NOMI[livello].padEnd(10)} ne ferma ${media(cpu).toFixed(2)}: meglio della persona ${pct(meglio / (cpu.length * base.length))}  (obiettivo ${obiettivo})`);
  }
}

function ordine() {
  const volte = VOLTE;
  const specs = [{ livello: 0 }, { livello: 1 }, { livello: 2 }, { livello: 1, ruolo: 'polpo' }];
  const pos = [0, 0, 0];
  const arr = [0, 0, 0];
  const pesceBatte = [0, 0, 0];
  for (const { r, idDi } of gioca(specs, volte)) {
    for (let i = 0; i < 3; i++) {
      if (arrivato(r, idDi[i])) arr[i]++;
      const pi = r.punteggi[idDi[i]];
      // posizione tra i soli pesci
      pos[i] += 1 + [0, 1, 2].filter((j) => j !== i && r.punteggi[idDi[j]] > pi).length + 0.5 * [0, 1, 2].filter((j) => j !== i && r.punteggi[idDi[j]] === pi).length;
      pesceBatte[i] += pi;
    }
  }
  console.log(`\n4. Pesci F, N e D insieme contro un Polpo Normale (${volte} partite): posizione media tra i pesci / arrivati / punti`);
  for (let i = 0; i < 3; i++) console.log(`  ${NOMI[i].padEnd(10)} pos. media ${(pos[i] / volte).toFixed(2)}  arriva ${pct(arr[i] / volte)}  punti ${(pesceBatte[i] / volte).toFixed(2)}`);
}

const lanciato = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lanciato) {
  console.log(`=== 🐙 Il Polpo ===`);
  equilibrio();
  pesciControPersone();
  polpiControPersone();
  ordine();
}

export { personaPesce, personaPolpo, conTv };
