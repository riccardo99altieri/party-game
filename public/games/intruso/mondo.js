// Trova l'Intruso: la simulazione, senza disegno. Lo schermo la fa girare e ci disegna
// sopra; i test e il banco la usano direttamente.
//
// Tutti i personaggi (giocatori e passanti) stanno nello stesso elenco `ents`, mescolato
// a ogni round: dall'indice non si capisce chi è un giocatore.

import { angDiff } from '../../shared/util.js';
import {
  DURATA,
  RAGGIO,
  PORTATA,
  CD_PUGNO,
  T_PUGNO,
  T_ERRORE,
  T_STORDITO,
  T_FERMO,
  PASSO_FERMO,
  GRAZIA,
  T_ACQUA,
  T_MONETA,
  PRESA_MONETA,
  OGNI_TICK,
  PODIO_DA,
  PUNTI,
  ROUND,
  config,
  puntiRound,
  nuoveVoci,
  puntoLibero,
  libero,
  pianoZona,
  raggioZona,
  prossimoRaggio,
  passoZona,
  zonaObiettivo,
  spingiFuori,
  dirVerso,
  spostamento,
} from './regole.js';
import { creaPasso, prossimoDir, ripianifica, scegliAttivita } from './folla.js';

const ORBITA = 58; // a che distanza gira intorno a chi sta fermo un passante incuriosito
const CURIOSI_MAX = 4;
const SPAVENTO = 120; // i passanti così vicini a un pugno scappano (a volte)
// A ogni passo dell'acqua alta una parte dei passanti va a curiosare proprio verso l'acqua
// (e viene portata via) e qualcuno non se ne accorge proprio: senza, alla fine la piazza
// resterebbe piena e non ci sarebbe nessuna resa dei conti.
const CURIOSI_ACQUA = [0.25, 0.3, 0.38];
const DISTRATTI = 0.15;

export function creaMondo({ ids, rng = Math.random, cfg = config(ids.length) }) {
  const n = ids.length;
  const giocatori = new Map(ids.map((id) => [id, { id, tot: 0, rounds: [], voci: nuoveVoci(), ent: null, morte: null }]));
  let contaMonete = 0;

  const M = {
    n,
    cfg,
    giocatori,
    round: -1,
    t: 0,
    ents: [],
    monete: [],
    piano: null,
    eventi: [],
    fine: null, // { motivo: 'ultimo' | 'tempo' | 'nessuno', t } a round finito
    nuovoRound,
    passo,
    input,
    pugno,
    tv,
    vivi,
    raggio: () => raggioZona(M.piano, M.t),
    prossimo: () => prossimoRaggio(M.piano, M.t),
    zona: () => zonaObiettivo(M.piano, M.t),
    ultimoRound: () => M.round >= ROUND - 1,
  };

  const evento = (e) => M.eventi.push({ t: M.t, ...e });

  function vivi() {
    return [...giocatori.values()].filter((g) => g.ent && g.ent.vivo);
  }

  // -------------------------------------------------------------------------
  // Round

  function nuovoRound() {
    M.round++;
    M.t = 0;
    M.fine = null;
    M.eventi = [];
    M.monete = [];
    M.prossimaMoneta = 4;
    M.piano = pianoZona(rng);
    M.passoVisto = -1;
    M.ultimoTick = 0;
    M.podioDato = n < PODIO_DA;
    const ents = [];
    const base = (tipo, p) => ({
      i: 0,
      tipo,
      id: null,
      x: p.x,
      y: p.y,
      dir: [0, 0],
      face: [0, 1],
      vivo: true,
      morte: null,
      blocco: 0,
      rosso: 0,
      cd: 0,
      pugno: 0,
      pdx: 0,
      pdy: 1,
      steso: 0,
      acqua: 0,
      fermo: 0,
      ancora: { x: p.x, y: p.y },
      jx: 0,
      jy: 0,
      passo: null,
      curioso: null,
      fuga: null,
      distratto: false,
      accorto: false,
      allAcqua: false, // va a curiosare sul bordo dell'acqua e ci resta
      tRecluta: 0,
      fase: rng() * 10, // fase della camminata (solo per il disegno)
    });
    // i giocatori sparsi, lontani tra loro
    const posti = [];
    for (const id of ids) {
      const p = puntoLibero(rng, (x, y) => posti.every((q) => Math.hypot(q.x - x, q.y - y) > 220), 10);
      posti.push(p);
      const e = base('g', p);
      e.id = id;
      const g = giocatori.get(id);
      g.ent = e;
      g.voci = nuoveVoci();
      g.morte = null;
      ents.push(e);
    }
    for (let k = 0; k < cfg.npc; k++) {
      const p = puntoLibero(rng, (x, y) => ents.every((q) => Math.hypot(q.x - x, q.y - y) > 32), 4);
      const e = base('npc', p);
      e.passo = creaPasso();
      scegliAttivita(e.passo, e, rng, null);
      e.passo.pausa = rng() * 2.6; // si "svegliano" un po' alla volta: al via nessuno parte insieme
      e.face = [[-1, 0, 1][Math.floor(rng() * 3)], 1];
      ents.push(e);
    }
    // mescolati: l'indice non tradisce nessuno
    for (let i = ents.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ents[i], ents[j]] = [ents[j], ents[i]];
    }
    ents.forEach((e, i) => (e.i = i));
    M.ents = ents;
  }

  // -------------------------------------------------------------------------
  // Comandi dei giocatori

  function input(id, d) {
    const g = giocatori.get(id);
    const e = g && g.ent;
    if (!e || !e.vivo || M.fine || !d) return null;
    if (Array.isArray(d.j)) {
      e.jx = Math.round(Math.max(-1, Math.min(1, Number(d.j[0]) || 0)));
      e.jy = Math.round(Math.max(-1, Math.min(1, Number(d.j[1]) || 0)));
    }
    if (d.p) return pugno(id);
    return null;
  }

  // A chi arriva il pugno: il più vicino, preferendo chi sta davanti (la direzione in cui
  // si guarda è l'ultima in cui ci si è mossi). Chi è a terra non conta.
  function bersaglio(e) {
    const fa = Math.atan2(e.face[1], e.face[0]);
    let best = null;
    let bv = Infinity;
    for (const o of M.ents) {
      if (o === e || !o.vivo || o.steso > 0) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > PORTATA) continue;
      const v = d / PORTATA + Math.abs(angDiff(fa, Math.atan2(dy, dx))) * 0.6;
      if (v < bv) {
        bv = v;
        best = o;
      }
    }
    return best;
  }

  function pugno(id) {
    const g = giocatori.get(id);
    const e = g && g.ent;
    if (M.fine || !e || !e.vivo || e.blocco > 0 || e.cd > 0) return { esito: 'no' };
    const o = bersaglio(e);
    if (!o) return { esito: 'vuoto' };
    e.cd = CD_PUGNO;
    e.pugno = T_PUGNO;
    e.blocco = T_PUGNO;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.pdx = dx / d;
    e.pdy = dy / d;
    spavento(o.x, o.y, e);
    if (o.tipo === 'g') {
      elimina(o, 'pugno', id);
      g.voci.kill++;
      evento({ tipo: 'kill', ent: e.i, id, vittima: o.i, chi: o.id, x: o.x, y: o.y });
      return { esito: 'kill', chi: o.id };
    }
    // un passante: lui finisce a terra, tu resti fermo e rosso davanti a tutti
    o.steso = T_STORDITO;
    o.curioso = null;
    o.fuga = null;
    o.dir = [0, 0];
    o.pdx = e.pdx;
    o.pdy = e.pdy;
    e.blocco = T_ERRORE;
    e.rosso = T_ERRORE;
    g.voci.errori++;
    evento({ tipo: 'errore', ent: e.i, id, vittima: o.i, x: o.x, y: o.y });
    return { esito: 'errore' };
  }

  function elimina(o, causa, da = null) {
    o.vivo = false;
    o.dir = [0, 0];
    o.curioso = null;
    o.morte = { t: M.t, causa, da };
    const g = giocatori.get(o.id);
    if (g) g.morte = o.morte;
    evento({ tipo: o.tipo === 'g' ? 'eliminato' : 'annegato', ent: o.i, id: o.id, causa, da, x: o.x, y: o.y });
  }

  // Dopo un pugno i passanti lì vicino a volte scappano per un attimo.
  function spavento(x, y, chi) {
    for (const e of M.ents) {
      if (e.tipo !== 'npc' || !e.vivo || e.steso > 0 || e.curioso || e === chi) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > SPAVENTO || d < 1 || rng() > 0.55) continue;
      let dir = dirVerso(null, e.x - x, e.y - y);
      if (!dir[0] && !dir[1]) dir = [rng() < 0.5 ? -1 : 1, 0];
      e.fuga = { ritardo: 0.1 + rng() * 0.25, dur: 0.6 + rng() * 0.5, dir };
    }
  }

  // -------------------------------------------------------------------------
  // Passanti

  function dirPassante(e, dt, z) {
    if (e.fuga) {
      if (e.fuga.ritardo > 0) e.fuga.ritardo -= dt;
      else {
        e.fuga.dur -= dt;
        if (e.fuga.dur > 0) return e.fuga.dir;
        e.fuga = null;
        ripianifica(e.passo);
      }
    }
    if (e.curioso) {
      const c = e.curioso;
      const p = c.ent;
      if (c.ritardo > 0) c.ritardo -= dt;
      else {
        if (c.fine == null && (!p.vivo || p.fermo < 0.05)) c.fine = M.t + 0.5 + rng() * 0.6;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if ((c.fine != null && M.t >= c.fine) || d > 220) {
          e.curioso = null;
          ripianifica(e.passo);
        } else {
          // gira intorno a lui, guardandolo
          const a = Math.atan2(e.y - p.y, e.x - p.x) + c.lato * 0.8;
          const dir = dirVerso(e.passo.dir, p.x + Math.cos(a) * ORBITA - e.x, p.y + Math.sin(a) * ORBITA - e.y);
          e.passo.dir = dir;
          return dir;
        }
      }
    }
    if (e.allAcqua && !e.passo.piano.length && e.passo.pausa <= 0) {
      // resta lì sul bordo, a guardare l'acqua che sale (qualche passo avanti e indietro)
      const p = puntoFuori(e, z, raggioZona(M.piano, M.t) + 200);
      if (p && Math.hypot(p.x - e.x, p.y - e.y) < 260) e.passo.piano = [{ x: p.x, y: p.y, pausa: 1.2 + rng() * 1.3 }];
    }
    return prossimoDir(e.passo, e, dt, { rng, zona: e.distratto ? null : z });
  }

  // Chi sta fermo da più di T_FERMO attira i passanti lì intorno.
  function recluta(p) {
    let gia = 0;
    for (const e of M.ents) if (e.curioso && e.curioso.ent === p) gia++;
    if (gia >= CURIOSI_MAX) return;
    const vicini = M.ents
      .filter((e) => e.tipo === 'npc' && e.vivo && e.steso <= 0 && !e.curioso && !e.fuga && Math.hypot(e.x - p.x, e.y - p.y) < 150)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    for (const e of vicini.slice(0, CURIOSI_MAX - gia)) e.curioso = { ent: p, ritardo: 0.15 + rng() * 0.5, lato: rng() < 0.5 ? 1 : -1, fine: null };
  }

  // L'acqua sta per arrivare: i passanti (non tutti) vanno verso il cerchio nuovo.
  // Molti distratti invece vanno a curiosare proprio verso l'acqua: la folla si dirada e
  // nella resa dei conti restano in pochi (e i giocatori si vedono di più).
  function avvisaZona(k, z) {
    const rAtt = raggioZona(M.piano, M.t);
    for (const e of M.ents) {
      if (e.tipo !== 'npc' || !e.vivo) continue;
      e.accorto = false;
      e.distratto = false;
      if (e.curioso) continue;
      if (rng() < CURIOSI_ACQUA[k]) {
        // va a vedere l'acqua, per la strada più breve, e non torna indietro
        const p = puntoFuori(e, z, rAtt);
        if (p) {
          e.distratto = true;
          e.accorto = true;
          e.allAcqua = true;
          ripianifica(e.passo);
          e.passo.piano = [{ x: p.x, y: p.y, pausa: 1.5 + rng() * 1.1 }];
          e.passo.pausa = rng() * 1.2;
          continue;
        }
      }
      e.distratto = rng() < DISTRATTI;
      if (e.distratto) continue;
      const fuori = (p) => Math.hypot(p.x - z.x, p.y - z.y) > z.r - 25;
      if (fuori(e) || e.passo.piano.some(fuori)) {
        ripianifica(e.passo);
        e.passo.pausa = rng() * 0.5;
      }
    }
  }

  // Un punto appena fuori dal cerchio z (ma ancora asciutto), dalla parte di e.
  function puntoFuori(e, z, rAtt) {
    const a0 = Math.atan2(e.y - z.y, e.x - z.x);
    for (let k = 0; k < 14; k++) {
      const a = a0 + (rng() - 0.5) * 0.7 * (1 + k * 0.4);
      const d = z.r + 50 + rng() * 90;
      if (d > rAtt - 15) continue;
      const x = z.x + Math.cos(a) * d;
      const y = z.y + Math.sin(a) * d;
      if (libero(x, y, 8)) return { x, y };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Monete

  function nuoveMonete() {
    const t = M.t;
    const z = zonaObiettivo(M.piano, t);
    const r = raggioZona(M.piano, t);
    for (let k = 0; k < cfg.monete; k++) {
      const lontana = (x, y) => M.monete.every((m) => Math.hypot(m.x - x, m.y - y) > 90);
      let ok = (x, y) => Math.hypot(x - z.x, y - z.y) < z.r - 40 && lontana(x, y);
      // nella resa dei conti le monete compaiono anche sul bordo dell'acqua
      if (t >= 60 && rng() < 0.5) ok = (x, y) => Math.abs(Math.hypot(x - z.x, y - z.y) - r) < 70 && lontana(x, y);
      const p = puntoLibero(rng, ok, 10);
      const m = { id: ++contaMonete, x: p.x, y: p.y, nasce: t, scade: t + T_MONETA };
      M.monete.push(m);
      evento({ tipo: 'nuovaMoneta', moneta: m.id, x: m.x, y: m.y });
    }
  }

  function aggiornaMonete() {
    const t = M.t;
    if (t >= M.prossimaMoneta && t < DURATA - 3) {
      M.prossimaMoneta += cfg.ogni;
      nuoveMonete();
    }
    for (let k = M.monete.length - 1; k >= 0; k--) {
      const m = M.monete[k];
      if (t >= m.scade) {
        M.monete.splice(k, 1);
        evento({ tipo: 'monetaSvanita', moneta: m.id, x: m.x, y: m.y });
        continue;
      }
      // solo i giocatori le raccolgono: i passanti ci passano sopra
      for (const g of giocatori.values()) {
        const e = g.ent;
        if (!e || !e.vivo || Math.hypot(e.x - m.x, e.y - m.y) > PRESA_MONETA) continue;
        g.voci.monete++;
        M.monete.splice(k, 1);
        evento({ tipo: 'moneta', moneta: m.id, ent: e.i, id: g.id, x: m.x, y: m.y });
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Un passo di simulazione

  function passo(dt) {
    for (const e of M.ents) {
      e.cd = Math.max(0, e.cd - dt);
      e.pugno = Math.max(0, e.pugno - dt);
      e.rosso = Math.max(0, e.rosso - dt);
      if (!e.vivo) continue;
      if (e.dir[0] || e.dir[1]) e.fase += dt * 9;
    }
    if (M.fine) return;
    M.t += dt;
    const t = M.t;
    const z = zonaObiettivo(M.piano, t);
    const pz = passoZona(t);
    if (pz !== M.passoVisto) {
      M.passoVisto = pz;
      if (pz >= 0 && pz < 3) {
        avvisaZona(pz, z);
        evento({ tipo: 'zona', passo: pz });
      }
    }

    // dove vuole andare ognuno
    for (const e of M.ents) {
      if (!e.vivo) continue;
      let dir = [0, 0];
      if (e.blocco > 0) e.blocco -= dt;
      else if (e.tipo === 'g') dir = [e.jx, e.jy];
      else if (e.steso > 0) {
        e.steso -= dt;
        if (e.steso <= 0) ripianifica(e.passo);
      } else dir = dirPassante(e, dt, z);
      e.dir = dir;
    }
    // si muovono tutti alla stessa velocità
    for (const e of M.ents) {
      if (!e.vivo || (!e.dir[0] && !e.dir[1])) continue;
      const [mx, my] = spostamento(e.dir, dt);
      e.x += mx;
      e.y += my;
      e.face = [e.dir[0], e.dir[1]];
    }
    // chi si urta si sposta e basta
    const ents = M.ents;
    for (let a = 0; a < ents.length; a++) {
      const A = ents[a];
      if (!A.vivo || A.steso > 0) continue;
      for (let b = a + 1; b < ents.length; b++) {
        const B = ents[b];
        if (!B.vivo || B.steso > 0) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        if (dx > 2 * RAGGIO || dx < -2 * RAGGIO || dy > 2 * RAGGIO || dy < -2 * RAGGIO) continue;
        const d = Math.hypot(dx, dy);
        if (d >= 2 * RAGGIO) continue;
        const nx = d > 1e-6 ? dx / d : 1;
        const ny = d > 1e-6 ? dy / d : 0;
        const s = (2 * RAGGIO - d) / 2;
        A.x -= nx * s;
        A.y -= ny * s;
        B.x += nx * s;
        B.y += ny * s;
      }
    }
    for (const e of ents) if (e.vivo) spingiFuori(e);

    // chi sta fermo troppo a lungo incuriosisce i passanti
    for (const g of giocatori.values()) {
      const e = g.ent;
      if (!e || !e.vivo) continue;
      if (Math.hypot(e.x - e.ancora.x, e.y - e.ancora.y) > PASSO_FERMO) {
        e.ancora = { x: e.x, y: e.y };
        e.fermo = 0;
      } else e.fermo += dt;
      e.tRecluta -= dt;
      if (t > GRAZIA && e.fermo > T_FERMO && e.tRecluta <= 0) {
        e.tRecluta = 0.25;
        recluta(e);
      }
    }

    aggiornaMonete();

    // l'acqua alta: dopo T_ACQUA secondi fuori dal cerchio si viene portati via
    const r = raggioZona(M.piano, t);
    for (const e of ents) {
      if (!e.vivo) continue;
      if (Math.hypot(e.x - M.piano.cx, e.y - M.piano.cy) > r - 2) {
        e.acqua += dt;
        // un passante distratto a volte si accorge in tempo
        if (e.tipo === 'npc' && e.distratto && !e.accorto && e.acqua > 1.2) {
          e.accorto = true;
          if (rng() < 0.3) {
            e.distratto = false;
            ripianifica(e.passo);
          }
        }
        if (e.acqua >= T_ACQUA) elimina(e, 'acqua');
      } else e.acqua = Math.max(0, e.acqua - dt * 2);
    }

    // +1 ogni 10 secondi in vita
    const k = Math.floor(t / OGNI_TICK + 1e-9);
    if (k > M.ultimoTick) {
      M.ultimoTick = k;
      for (const g of vivi()) g.voci.tick++;
      evento({ tipo: 'tick', k });
    }

    const rimasti = vivi();
    if (!M.podioDato && rimasti.length <= 3 && rimasti.length >= 1) {
      M.podioDato = true;
      for (const g of rimasti) g.voci.podio = PUNTI.podio;
      evento({ tipo: 'podio', ids: rimasti.map((g) => g.id) });
    }
    if (rimasti.length <= 1) chiudi(rimasti.length === 1 ? 'ultimo' : 'nessuno');
    else if (t >= DURATA) chiudi('tempo');
  }

  function chiudi(motivo) {
    const rimasti = vivi();
    M.fine = { motivo, t: M.t };
    if (motivo === 'ultimo') rimasti[0].voci.ultimo = PUNTI.ultimo;
    if (motivo === 'tempo') for (const g of rimasti) g.voci.vivo = PUNTI.vivo;
    for (const g of giocatori.values()) {
      const punti = puntiRound(g.voci);
      g.rounds.push({ ...g.voci, punti });
      g.tot += punti;
    }
    evento({ tipo: 'fineRound', motivo, ids: rimasti.map((g) => g.id) });
  }

  // -------------------------------------------------------------------------
  // Quello che chiunque vede sullo schermo grande (lo usano i bot e il banco).

  function tv() {
    const anelli = [];
    for (const g of giocatori.values()) {
      const e = g.ent;
      if (!e || !e.vivo) continue;
      let c = 0;
      for (const o of M.ents) if (o.curioso && o.curioso.ent === e && o.curioso.ritardo <= 0) c++;
      if (c >= 2) anelli.push({ x: e.x, y: e.y });
    }
    const z = zonaObiettivo(M.piano, M.t);
    return {
      t: M.t,
      fine: !!M.fine,
      ents: M.ents.map((e) => ({
        x: e.x,
        y: e.y,
        vivo: e.vivo,
        steso: !e.vivo || e.steso > 0,
        rosso: e.rosso > 0,
        curioso: !!(e.curioso && e.curioso.ritardo <= 0),
        pugno: e.pugno > 0,
      })),
      monete: M.monete.map((m) => ({ id: m.id, x: m.x, y: m.y, resta: m.scade - M.t })),
      zona: { x: z.x, y: z.y, r: z.r, rAtt: raggioZona(M.piano, M.t) },
      anelli,
    };
  }

  return M;
}
