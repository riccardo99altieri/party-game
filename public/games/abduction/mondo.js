// Abduction: la simulazione del campo (niente DOM). Mucche vere e mucche dei giocatori
// sono lo stesso oggetto; cambia solo chi decide cosa fanno.
// Pose (le stesse per tutte): cammina, pascola, fermo, gelo (immobile sotto il raggio).

import { clamp, angDiff, TAU } from '../../shared/util.js';
import {
  DURATA,
  T_FURIA,
  T_RADAR,
  T_BRUCA,
  CD_SPINTA,
  T_FUORI,
  T_RAPIMENTO,
  TOLLERANZA,
  VEL_MUCCA,
  VEL_DISCO,
  FURIA_VEL,
  PASSO_SPINTA,
  T_SPINTA,
  R_MUCCA,
  CAMPO,
  config,
  valoreBrucata,
  bottino,
  nelRaggio,
  bersaglioSpinta,
  percorso,
} from './regole.js';

const GIRO = 7; // rad/s: quanto in fretta una mucca si gira

export function creaMondo({ ids, rnd = Math.random }) {
  const cfg = config(ids.length);
  const mucche = [];
  const giocatori = new Map();
  const mandrie = [];
  const dischi = [];
  let prossimo = 0;
  const mondo = { t: 0, cfg, mucche, giocatori, mandrie, dischi, eventi: [], fine: false, furia: false };
  const num = (a, b) => a + rnd() * (b - a);

  // ---------------------------------------------------------------------------
  // Preparazione

  const MX = 200;
  const MY = 160;
  for (let k = 0; k < cfg.mandrie; k++) {
    // mandrie sparse per il campo (una griglia larga, mescolata un po')
    const col = k % 3;
    const riga = Math.floor(k / 3);
    const righe = Math.ceil(cfg.mandrie / 3);
    mandrie.push({
      x: clamp(CAMPO.x0 + MX + ((col + 0.5) / 3) * (CAMPO.x1 - CAMPO.x0 - 2 * MX) + num(-120, 120), CAMPO.x0 + MX, CAMPO.x1 - MX),
      y: clamp(CAMPO.y0 + MY + ((riga + 0.5) / righe) * (CAMPO.y1 - CAMPO.y0 - 2 * MY) + num(-90, 90), CAMPO.y0 + MY, CAMPO.y1 - MY),
      a: rnd() * TAU,
      tGira: num(4, 9),
      n: 0,
    });
  }

  function libero(x, y) {
    const D = 2 * R_MUCCA + 6;
    return mucche.every((m) => m.via || Math.hypot(m.x - x, m.y - y) >= D);
  }

  function nuovaMucca() {
    const mandria = rnd() < 0.85 ? Math.floor(rnd() * mandrie.length) : -1;
    let x = 0;
    let y = 0;
    for (let k = 0; k < 60; k++) {
      if (mandria >= 0) {
        const c = mandrie[mandria];
        const a = rnd() * TAU;
        const r = Math.sqrt(rnd()) * 170;
        x = c.x + Math.cos(a) * r;
        y = c.y + Math.sin(a) * r * 0.8;
      } else {
        x = num(CAMPO.x0 + 60, CAMPO.x1 - 60);
        y = num(CAMPO.y0 + 60, CAMPO.y1 - 60);
      }
      x = clamp(x, CAMPO.x0 + 30, CAMPO.x1 - 30);
      y = clamp(y, CAMPO.y0 + 30, CAMPO.y1 - 30);
      if (libero(x, y)) break;
    }
    if (mandria >= 0) mandrie[mandria].n++;
    const m = {
      i: prossimo++,
      x,
      y,
      ang: rnd() * TAU,
      posa: 'fermo',
      g: null, // id del giocatore, se è sua
      mandria,
      stato: 'fermo',
      timer: num(0.2, 3),
      meta: null,
      gelo: 0,
      geloDopo: 0,
      dentro: false,
      spinta: null,
      rapita: null,
      via: false,
      passo: rnd() * TAU,
      coda: rnd() * TAU,
      mastica: rnd() * TAU,
    };
    // all'inizio un po' brucano e un po' no
    if (rnd() < 0.45) {
      m.stato = 'pascola';
      m.posa = 'pascola';
      m.timer = num(0.5, 6);
    }
    mucche.push(m);
    return m;
  }

  for (let k = 0; k < cfg.mucche + ids.length; k++) nuovaMucca();
  // i giocatori prendono mucche a caso: nessuno sa quali
  const libere = [...mucche];
  for (const id of ids) {
    const m = libere.splice(Math.floor(rnd() * libere.length), 1)[0];
    m.g = id;
    m.stato = 'fermo';
    m.posa = 'fermo';
    giocatori.set(id, {
      id,
      ent: m,
      punti: 0,
      bruca: false,
      prog: 0,
      j: [0, 0],
      cd: 0,
      fuori: 0,
      radar: T_RADAR,
      sospetto: 0,
      brucate: 0,
      rapito: 0,
      persi: 0,
      prese: 0,
      rubati: 0,
    });
  }

  for (let k = 0; k < cfg.dischi; k++) {
    const sx = k % 2 === 0;
    const d = { k: 0, x: sx ? CAMPO.x0 - 160 : CAMPO.x1 + 160, y: CAMPO.y0 + (CAMPO.y1 - CAMPO.y0) * (k === 0 ? 0.35 : 0.65), r: cfg.raggio, vx: 0, vy: 0, sosta: 0, fermo: 0, punti: [], tipo: '' };
    const p = percorso(d, d.r, rnd);
    d.punti = p.punti;
    d.tipo = p.tipo;
    dischi.push(d);
  }

  // ---------------------------------------------------------------------------
  // Movimento

  function sposta(m, dx, dy) {
    m.x = clamp(m.x + dx, CAMPO.x0 + 26, CAMPO.x1 - 26);
    m.y = clamp(m.y + dy, CAMPO.y0 + 26, CAMPO.y1 - 26);
    // si sposta solo chi si muove: chi è fermo fa da ostacolo
    const D = 2 * R_MUCCA;
    for (const o of mucche) {
      if (o === m || o.via || o.rapita) continue;
      const ox = m.x - o.x;
      const oy = m.y - o.y;
      if (ox > D || ox < -D || oy > D || oy < -D) continue;
      const d = Math.hypot(ox, oy);
      if (d < D && d > 0.001) {
        m.x = o.x + (ox / d) * D;
        m.y = o.y + (oy / d) * D;
      }
    }
  }

  function gira(m, dx, dy, dt) {
    const a = Math.atan2(dy, dx);
    m.ang += clamp(angDiff(m.ang, a), -GIRO * dt, GIRO * dt);
  }

  function cammina(m, dx, dy, dt) {
    const k = Math.hypot(dx, dy) || 1;
    sposta(m, (dx / k) * VEL_MUCCA * dt, (dy / k) * VEL_MUCCA * dt);
    gira(m, dx, dy, dt);
    m.posa = 'cammina';
    m.passo += dt * 9;
  }

  function muoviDisco(d, dt, vel) {
    const x = d.x;
    const y = d.y;
    if (d.fermo > 0) d.fermo -= dt;
    else if (d.sosta > 0) d.sosta -= dt;
    else {
      let resto = vel * dt;
      for (let giri = 0; resto > 0 && giri < 50; giri++) {
        if (d.k >= d.punti.length) {
          const p = percorso(d, d.r, rnd);
          d.punti = p.punti;
          d.tipo = p.tipo;
          d.k = 0;
        }
        const p = d.punti[d.k];
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        const dd = Math.hypot(dx, dy);
        if (dd <= resto) {
          d.x = p.x;
          d.y = p.y;
          resto -= dd;
          d.k++;
          if (p.sosta) {
            d.sosta = p.sosta;
            break;
          }
        } else {
          d.x += (dx / dd) * resto;
          d.y += (dy / dd) * resto;
          resto = 0;
        }
      }
    }
    d.vx = dt > 0 ? (d.x - x) / dt : 0;
    d.vy = dt > 0 ? (d.y - y) / dt : 0;
  }

  function muoviMandrie(dt) {
    for (const c of mandrie) {
      c.tGira -= dt;
      if (c.tGira <= 0) {
        c.a += num(-1.6, 1.6);
        c.tGira = num(4, 9);
      }
      c.x += Math.cos(c.a) * 11 * dt;
      c.y += Math.sin(c.a) * 11 * dt;
      if (c.x < CAMPO.x0 + MX || c.x > CAMPO.x1 - MX) c.a = Math.PI - c.a;
      if (c.y < CAMPO.y0 + MY || c.y > CAMPO.y1 - MY) c.a = -c.a;
      c.x = clamp(c.x, CAMPO.x0 + MX, CAMPO.x1 - MX);
      c.y = clamp(c.y, CAMPO.y0 + MY, CAMPO.y1 - MY);
    }
  }

  const raggioDi = (m) => {
    for (const d of dischi) if (nelRaggio(m, d)) return d;
    return null;
  };

  // ---------------------------------------------------------------------------
  // Mucche vere: brucano, girano un po', seguono la mandria. Sotto il raggio si
  // immobilizzano (e ci mettono un attimo a ripartire quando se ne va).

  function nuovoStato(m, dopoCammino) {
    const c = m.mandria >= 0 ? mandrie[m.mandria] : null;
    const rM = c ? 110 + 14 * Math.sqrt(c.n) : 0;
    const lontana = c && Math.hypot(m.x - c.x, m.y - c.y) > rM;
    if (!dopoCammino && (lontana || rnd() < 0.5)) {
      let mx;
      let my;
      if (c) {
        const a = rnd() * TAU;
        const r = Math.sqrt(rnd()) * rM;
        mx = c.x + Math.cos(a) * r;
        my = c.y + Math.sin(a) * r * 0.8;
      } else {
        const a = rnd() * TAU;
        const r = num(60, 220);
        mx = m.x + Math.cos(a) * r;
        my = m.y + Math.sin(a) * r;
      }
      // passi brevi: al massimo 240 px alla volta
      const dx = mx - m.x;
      const dy = my - m.y;
      const d = Math.hypot(dx, dy);
      if (d > 240) {
        mx = m.x + (dx / d) * 240;
        my = m.y + (dy / d) * 240;
      }
      m.meta = { x: clamp(mx, CAMPO.x0 + 40, CAMPO.x1 - 40), y: clamp(my, CAMPO.y0 + 40, CAMPO.y1 - 40) };
      m.stato = 'cammina';
      m.timer = 5;
    } else if (rnd() < 0.62) {
      m.stato = 'pascola';
      m.timer = num(2, 8);
    } else {
      m.stato = 'fermo';
      m.timer = num(1, 3.5);
    }
  }

  function aggiornaNpc(m, raggio, dt) {
    if (raggio) {
      if (!m.dentro) m.geloDopo = num(0.2, 1.1);
      m.dentro = true;
      m.gelo = m.geloDopo;
      m.posa = 'gelo';
      return;
    }
    m.dentro = false;
    if (m.gelo > 0) {
      m.gelo -= dt;
      m.posa = 'gelo';
      return;
    }
    m.timer -= dt;
    if (m.stato === 'cammina') {
      const dx = m.meta.x - m.x;
      const dy = m.meta.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || m.timer <= 0) return nuovoStato(m, true);
      const x = m.x;
      const y = m.y;
      cammina(m, dx, dy, dt);
      // bloccata da un'altra mucca: lascia perdere prima
      if (Math.hypot(m.x - x, m.y - y) < VEL_MUCCA * dt * 0.3) m.timer -= dt * 3;
    } else if (m.stato === 'pascola') {
      m.posa = 'pascola';
      m.mastica += dt;
      if (m.timer <= 0) nuovoStato(m);
    } else {
      m.posa = 'fermo';
      if (m.timer <= 0) nuovoStato(m);
    }
  }

  // ---------------------------------------------------------------------------
  // Mucche dei giocatori

  function aggiornaGiocatore(m, raggio, dt) {
    const g = giocatori.get(m.g);
    let attivo = false;
    if (g.bruca) {
      attivo = true;
      g.prog += dt;
      m.posa = 'pascola';
      m.mastica += dt;
      if (g.prog >= T_BRUCA) {
        g.prog -= T_BRUCA;
        const v = valoreBrucata(mondo.t);
        g.punti += v;
        g.brucate++;
        mondo.eventi.push({ tipo: 'brucata', id: g.id, ent: m, v, x: m.x, y: m.y });
      }
    } else {
      g.prog = 0;
      const [jx, jy] = g.j;
      if (Math.hypot(jx, jy) > 0.25) {
        attivo = true;
        cammina(m, jx, jy, dt);
      }
    }
    // stesso "gelo" delle mucche vere quando sei immobile sotto il raggio
    if (raggio) {
      if (!m.dentro) m.geloDopo = num(0.2, 1.1);
      m.dentro = true;
      m.gelo = m.geloDopo;
    } else {
      m.dentro = false;
      if (m.gelo > 0) m.gelo -= dt;
    }
    if (!attivo) m.posa = m.gelo > 0 ? 'gelo' : 'fermo';
    if (raggio && attivo) {
      g.sospetto += dt;
      if (g.sospetto >= TOLLERANZA) rapisci(m, raggio, null);
    } else g.sospetto = 0;
  }

  function rapisci(m, d, da) {
    m.rapita = { t: 0, disco: d, x0: m.x, y0: m.y };
    m.spinta = null;
    d.fermo = Math.max(d.fermo, T_RAPIMENTO);
    if (m.g) {
      const g = giocatori.get(m.g);
      const persi = g.punti;
      g.punti = 0;
      g.persi += persi;
      g.rapito++;
      g.fuori = T_FUORI;
      g.bruca = false;
      g.prog = 0;
      g.j = [0, 0];
      g.sospetto = 0;
      g.radar = 0;
      g.ent = null;
      let rubati = 0;
      const ladro = da && da !== g.id ? giocatori.get(da) : null;
      if (ladro) {
        rubati = bottino(persi);
        ladro.punti += rubati;
        ladro.prese++;
        ladro.rubati += rubati;
      }
      mondo.eventi.push({ tipo: 'rapito', id: g.id, ent: m, persi, da: ladro ? da : null, rubati, x: m.x, y: m.y });
    } else mondo.eventi.push({ tipo: 'rapita', ent: m, da, x: m.x, y: m.y });
  }

  // Dopo il rapimento il disco ti rimette giù di nascosto: prendi il posto di una mucca
  // vera lontana dai raggi (così il gregge si assottiglia un po' alla volta).
  function rientra(g) {
    const vive = mucche.filter((m) => !m.g && !m.via && !m.rapita && !m.spinta);
    const lontane = vive.filter((m) => dischi.every((d) => Math.hypot(m.x - d.x, m.y - d.y) > d.r + 260));
    const pool = lontane.length ? lontane : vive;
    const m = pool.length ? pool[Math.floor(rnd() * pool.length)] : nuovaMucca();
    m.g = g.id;
    m.stato = 'fermo';
    if (m.posa === 'cammina') m.posa = 'fermo';
    g.ent = m;
    g.radar = T_RADAR;
    g.sospetto = 0;
    g.prog = 0;
    g.bruca = false;
    g.j = [0, 0];
    mondo.eventi.push({ tipo: 'rientro', id: g.id, ent: m });
  }

  // ---------------------------------------------------------------------------
  // Passo della simulazione

  mondo.passo = (dt) => {
    // dopo la fine si finiscono solo le animazioni dei rapimenti
    if (!mondo.fine) {
      mondo.t += dt;
      if (!mondo.furia && mondo.t >= T_FURIA) {
        mondo.furia = true;
        mondo.eventi.push({ tipo: 'furia' });
      }
      const vel = VEL_DISCO * (mondo.furia ? FURIA_VEL : 1);
      for (const d of dischi) muoviDisco(d, dt, vel);
      muoviMandrie(dt);
    }
    for (const m of mucche) {
      if (m.via) continue;
      m.coda += dt * (m.posa === 'gelo' ? 0.6 : 2.2);
      if (m.rapita) {
        m.rapita.t += dt;
        if (m.rapita.t >= T_RAPIMENTO) m.via = true;
        continue;
      }
      if (mondo.fine) continue;
      const raggio = raggioDi(m);
      if (m.spinta) {
        const s = m.spinta;
        s.t += dt;
        const k = Math.min(1, s.t / T_SPINTA);
        const dove = PASSO_SPINTA * (1 - (1 - k) * (1 - k));
        sposta(m, s.dx * (dove - s.fatto), s.dy * (dove - s.fatto));
        s.fatto = dove;
        m.posa = 'fermo';
        // spinta sotto il raggio: si muove, quindi il disco la prende
        const r = raggioDi(m) || raggio;
        if (r) rapisci(m, r, s.da);
        else if (k >= 1) m.spinta = null;
        continue;
      }
      if (m.g) aggiornaGiocatore(m, raggio, dt);
      else aggiornaNpc(m, raggio, dt);
    }
    if (mondo.fine) return;
    for (const g of giocatori.values()) {
      if (g.cd > 0) g.cd = Math.max(0, g.cd - dt);
      if (g.radar > 0) g.radar = Math.max(0, g.radar - dt);
      if (g.fuori > 0) {
        g.fuori -= dt;
        if (g.fuori <= 0) {
          g.fuori = 0;
          rientra(g);
        }
      }
    }
    // ogni tanto si tolgono dalla lista le mucche già portate via
    if (mucche.length > 20 && mucche.filter((m) => m.via).length > 10) {
      for (let k = mucche.length - 1; k >= 0; k--) if (mucche[k].via) mucche.splice(k, 1);
    }
    if (mondo.t >= DURATA) {
      mondo.fine = true;
      mondo.eventi.push({ tipo: 'fine' });
    }
  };

  // ---------------------------------------------------------------------------
  // Comandi dal telefono: { j: [x, y] } joystick, { b: 1 | 0 } BRUCA, { s: 1 } SPINGI

  mondo.input = (id, d) => {
    const g = giocatori.get(id);
    if (!g || !d || mondo.fine) return null;
    if (Array.isArray(d.j)) g.j = [clamp(Number(d.j[0]) || 0, -1, 1), clamp(Number(d.j[1]) || 0, -1, 1)];
    if (d.b != null) {
      const vuole = !!d.b && g.fuori <= 0 && !!g.ent && !g.ent.spinta;
      if (!vuole) g.prog = 0;
      g.bruca = vuole;
    }
    if (d.s) return spingi(g);
    return null;
  };

  function spingi(g) {
    if (!g.ent || g.fuori > 0 || g.cd > 0 || g.ent.spinta) return { esito: 'no' };
    const b = bersaglioSpinta(g.ent, mucche);
    if (!b) return { esito: 'vuoto' };
    g.cd = CD_SPINTA;
    if (g.bruca) {
      g.bruca = false;
      g.prog = 0;
    }
    const m = b.m;
    m.spinta = { dx: b.dx, dy: b.dy, t: 0, fatto: 0, da: g.id };
    if (m.g) {
      // una testata interrompe la brucata (0 punti)
      const v = giocatori.get(m.g);
      if (v.bruca || v.prog > 0) mondo.eventi.push({ tipo: 'interrotta', id: v.id });
      v.bruca = false;
      v.prog = 0;
    } else if (m.stato !== 'cammina') {
      m.stato = 'fermo';
      m.timer = num(0.5, 1.5);
    }
    mondo.eventi.push({ tipo: 'spinta', da: g.id, ent: m });
    return { esito: 'ok', ent: m };
  }

  mondo.vive = () => mucche.filter((m) => !m.via && !m.rapita);
  mondo.vere = () => mucche.filter((m) => !m.via && !m.rapita && !m.g).length;
  mondo.resta = () => Math.max(0, DURATA - mondo.t);

  return mondo;
}
