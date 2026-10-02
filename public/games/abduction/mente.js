// Abduction: CPU PROVVISORIA (BOT DA CREARE / CALIBRARE). Un cervello unico e
// semplice, uguale per le tre potenze: serve solo a poter giocare anche in pochi.
// Sa quello che vede una persona: il disco e dove sta andando, le mucche e cosa fanno,
// la propria mucca e il proprio telefono. "Sospetta" di una mucca quando la vede
// alzare la testa nell'istante in cui un giocatore prende +10 in classifica.

import { T_BRUCA, PASSO_SPINTA, bersaglioSpinta, nelRaggio } from './regole.js';

export function creaMente(cpu) {
  const tratti = (cpu && cpu.tratti) || {};
  const reazione = () => (cpu ? cpu.reazione() : 0.35);
  const avidita = 0.8 + (1 - (tratti.prudenza ?? 0.5)) * 0.45; // quanto rischia per finire la brucata
  const cattiveria = 0.12 + (tratti.aggressivita ?? 0.5) * 0.25; // testate "a caso" vicino al raggio
  const cacciatore = (tratti.aggressivita ?? 0.5) > 0.35;
  const out = { j: [0, 0], b: 0, s: 0 };
  let attesa = 0;
  let meta = null;
  let tMeta = 0;
  let giro = 2 + Math.random() * 5;
  let girata = 0; // ultimo passetto per guardare chi spingere
  const sospetti = new Map(); // mucca -> quanto ne è sicuro

  // Fra quanto un raggio arriva su (x, y), se il disco tira dritto (∞ se non arriva).
  function arrivo(mondo, x, y, orizzonte = 5, margine = 30) {
    let min = Infinity;
    for (const d of mondo.dischi) {
      for (let tau = 0; tau <= orizzonte; tau += 0.2) {
        if (Math.hypot(d.x + d.vx * tau - x, d.y + d.vy * tau - y) <= d.r + margine) {
          min = Math.min(min, tau);
          break;
        }
      }
    }
    return min;
  }

  function vicini(mondo, io, r) {
    return mondo.mucche.filter((m) => m !== io && !m.via && !m.rapita && Math.hypot(m.x - io.x, m.y - io.y) < r);
  }

  function preda() {
    let best = null;
    let bv = 0;
    for (const [m, v] of sospetti) {
      if (m.via || m.rapita) sospetti.delete(m);
      else if (v > bv) {
        bv = v;
        best = m;
      }
    }
    return best;
  }

  return {
    osserva(ev, mio) {
      if (ev.tipo === 'brucata' && ev.id !== mio && Math.random() < 0.4) sospetti.set(ev.ent, (sospetti.get(ev.ent) || 0) + 1);
      if (ev.tipo === 'rapito' || ev.tipo === 'rapita') sospetti.delete(ev.ent);
    },

    decidi(mondo, g, dt) {
      pensa(mondo, g, dt);
      const k = Math.hypot(out.j[0], out.j[1]);
      if (k > 1) out.j = [out.j[0] / k, out.j[1] / k];
      return out;
    },
  };

  function pensa(mondo, g, dt) {
    out.s = 0;
    attesa -= dt;
    tMeta -= dt;
    giro -= dt;
    if (attesa > 0) return out;
    attesa = reazione();
    const io = g.ent;
    if (!io) {
      out.j = [0, 0];
      out.b = 0;
      meta = null;
      return out;
    }
    const tA = arrivo(mondo, io.x, io.y);
    const vicino = tA < attesa + 0.35;

    // Testata: se la mucca davanti è sotto il raggio (o ci finisce con la spinta).
    if (g.cd <= 0 && !io.spinta) {
      const b = bersaglioSpinta(io, mondo.mucche);
      if (b) {
        const dopo = { x: b.m.x + b.dx * PASSO_SPINTA, y: b.m.y + b.dy * PASSO_SPINTA };
        const colpo = mondo.dischi.some((d) => nelRaggio(b.m, d) || nelRaggio(dopo, d));
        const voglia = sospetti.has(b.m) ? 0.85 : cattiveria;
        if (colpo && Math.random() < voglia) {
          out.s = 1;
          out.b = 0;
          out.j = [0, 0];
          meta = null;
          return out;
        }
      }
    }

    // Il raggio è qui o sta arrivando: immobile (ma chi sta brucando può rischiare).
    if (vicino || tA < 0.4) {
      out.j = [0, 0];
      meta = null;
      if (out.b && T_BRUCA - g.prog < tA * avidita - 0.1) return out;
      out.b = 0;
      return out;
    }

    // Brucata in corso: si finisce se c'è tempo (push-your-luck).
    if (out.b) {
      if (T_BRUCA - g.prog > tA * avidita - 0.1) out.b = 0;
      return out;
    }

    // In cammino.
    if (meta) {
      const dx = meta.x - io.x;
      const dy = meta.y - io.y;
      const d = Math.hypot(dx, dy);
      if (d < 10 || tMeta <= 0 || tA < 1.6) {
        meta = null;
        out.j = [0, 0];
        // arrivato vicino alla preda: un passetto verso di lei per guardarla
        const p = preda();
        if (p && d < 10 && girata <= 0) {
          out.j = [p.x - io.x, p.y - io.y];
          const k = Math.hypot(out.j[0], out.j[1]) || 1;
          out.j = [out.j[0] / k, out.j[1] / k];
          girata = 1;
        }
      } else {
        out.j = [dx / d, dy / d];
      }
      return out;
    }
    girata = Math.max(0, girata - 1);
    out.j = [0, 0];

    // Caccia: mettiti dietro alla mucca sospetta, dalla parte opposta al disco.
    const p = cacciatore ? preda() : null;
    if (p && tA > 2.5) {
      const d0 = mondo.dischi[0];
      const ux = p.x - d0.x;
      const uy = p.y - d0.y;
      const k = Math.hypot(ux, uy) || 1;
      const mx = p.x + (ux / k) * 70;
      const my = p.y + (uy / k) * 70;
      if (Math.hypot(mx - io.x, my - io.y) > 25 && Math.hypot(p.x - io.x, p.y - io.y) < 700) {
        meta = { x: mx, y: my };
        tMeta = 8;
        out.j = [mx - io.x, my - io.y];
        return out;
      }
    }

    // Ogni tanto si cammina come le altre: verso il gruppo vicino o un po' a caso.
    const attorno = vicini(mondo, io, 260);
    const sola = !attorno.some((m) => Math.hypot(m.x - io.x, m.y - io.y) < 120);
    if ((giro <= 0 || sola) && tA > 3) {
      giro = 4 + Math.random() * 8;
      let mx = io.x + (Math.random() - 0.5) * 300;
      let my = io.y + (Math.random() - 0.5) * 240;
      if (attorno.length >= 3) {
        mx = attorno.reduce((s, m) => s + m.x, 0) / attorno.length + (Math.random() - 0.5) * 120;
        my = attorno.reduce((s, m) => s + m.y, 0) / attorno.length + (Math.random() - 0.5) * 100;
      }
      meta = { x: mx, y: my };
      tMeta = 4;
      out.j = [mx - io.x, my - io.y];
      return out;
    }

    // Altrimenti si bruca, se il disco è abbastanza lontano.
    if (tA > (T_BRUCA + 0.5) / avidita) out.b = 1;
    return out;
  }
}
