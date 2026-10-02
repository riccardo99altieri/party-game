// Sumo Glaciale: arena di ghiaccio che si restringe, joystick + PUGNO.
// Vince l'ultimo che resta in piedi; la classifica segue l'ordine di caduta.
// Le posizioni sono in coordinate "mondo" con il centro dell'arena in (0, 0);
// sullo schermo l'arena è schiacciata in verticale (vista in prospettiva).

import { TAU, rand, pick, clamp, fmtNum, shade, angDiff } from '../../shared/util.js';

const DURATA = 90;
const RAGGIO = 34; // ingombro di un giocatore sul ghiaccio
const SY = 0.72; // schiacciamento prospettico
const CD_PUGNO = 1; // secondi tra un pugno e l'altro
const T_PUGNO = 0.3; // durata dell'animazione del guantone
const PORTATA = 170; // distanza massima (tra i centri) a cui arriva il pugno
const CONO = 1.05; // apertura del colpo, per lato (radianti)
const FORZA = 720; // velocità data a chi viene colpito
const STORDITO = 0.35; // secondi con poco controllo dopo un pugno
const INIZIO_STRINGE = 20;
const FINE_STRINGE = 70;
const PAROLE = ['POW!', 'BAM!', 'SBAM!', 'PAF!', 'BOOM!'];

export default {
  id: 'sumo',
  nome: 'Sumo Glaciale',
  emoji: '🧊',
  colore: '#3ec6ff',
  descrizione: 'A suon di pugni, butta gli altri giù dal ghiaccio!',
  comeSiGioca: [
    'Muoviti con il joystick: il ghiaccio scivola!',
    'Tocca PUGNO 🥊 quando sei vicino a qualcuno: lo fai volare via',
    "Col tempo l'arena si restringe: resta dentro fino alla fine",
  ],
  controllo: 'joystick',
  crea,
};

function crea(ctx) {
  const { W, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const CX = W / 2;
  const CY = 590;
  const R0 = Math.min(620, 440 + 12 * n);
  const RMIN = R0 * 0.38;
  let R = R0;
  let finito = false;
  let fineTra = -1;
  let t = 0;

  const P = (x, y) => [CX + x, CY + y * SY];

  // Crepe decorative nel ghiaccio (in frazioni del raggio iniziale)
  const crepe = Array.from({ length: 16 }, () => {
    const a = rand(0, TAU);
    const r1 = rand(0.1, 0.8);
    const pts = [[Math.cos(a) * r1, Math.sin(a) * r1]];
    let ang = a + rand(-1, 1);
    for (let i = 0; i < 4; i++) {
      const [px, py] = pts[pts.length - 1];
      ang += rand(-0.7, 0.7);
      pts.push([px + Math.cos(ang) * 0.07, py + Math.sin(ang) * 0.07]);
    }
    return pts;
  });

  const gioc = ctx.giocatori.map((p, i) => {
    const a = (i / n) * TAU - Math.PI / 2;
    return {
      id: p.id,
      p,
      x: Math.cos(a) * R0 * 0.6,
      y: Math.sin(a) * R0 * 0.6,
      vx: 0,
      vy: 0,
      jx: 0,
      jy: 0,
      cd: 0,
      pugno: 0,
      pdx: 1,
      pdy: 0,
      colpo: 0,
      stordito: 0,
      volo: 0,
      vivo: true,
      caduta: -1,
      eliminato: null,
      dir: Math.cos(a) > 0 ? -1 : 1,
      ia: null,
    };
  });
  const perId = new Map(gioc.map((g) => [g.id, g]));

  const vistaGioco = (g) => ctx.vista(g.id, { vivo: g.vivo, cd: CD_PUGNO, rimasti: gioc.filter((x) => x.vivo).length });
  for (const g of gioc) vistaGioco(g);

  // Verso chi tirare il pugno: l'avversario a portata più "davanti" al joystick
  // (mira generosa: è un party game). Se non c'è nessuno, nella direzione del joystick.
  function mira(q) {
    const mj = Math.hypot(q.jx, q.jy);
    const aj = mj > 0.25 ? Math.atan2(q.jy, q.jx) : null;
    let best = null;
    let bv = Infinity;
    for (const o of gioc) {
      if (o === q || !o.vivo) continue;
      const ox = o.x - q.x;
      const oy = o.y - q.y;
      const d = Math.hypot(ox, oy);
      if (d > PORTATA) continue;
      const da = aj == null ? 0 : Math.abs(angDiff(aj, Math.atan2(oy, ox)));
      if (da > 1.75) continue;
      const v = d / PORTATA + da * 0.5;
      if (v < bv) {
        bv = v;
        best = [ox / (d || 1), oy / (d || 1)];
      }
    }
    if (best) return best;
    if (aj != null) return [q.jx / mj, q.jy / mj];
    const mv = Math.hypot(q.vx, q.vy);
    if (mv > 40) return [q.vx / mv, q.vy / mv];
    return [q.dir, 0];
  }

  function pugno(q) {
    if (!q.vivo || q.cd > 0 || finito) return;
    const [dx, dy] = mira(q);
    q.cd = CD_PUGNO;
    q.pugno = T_PUGNO;
    q.pdx = dx;
    q.pdy = dy;
    if (Math.abs(dx) > 0.15) q.dir = dx > 0 ? 1 : -1;
    const a0 = Math.atan2(dy, dx);
    let colpiti = 0;
    for (const o of gioc) {
      if (o === q || !o.vivo) continue;
      const ox = o.x - q.x;
      const oy = o.y - q.y;
      const d = Math.hypot(ox, oy) || 1;
      if (d > PORTATA || Math.abs(angDiff(a0, Math.atan2(oy, ox))) > CONO) continue;
      let nx = ox / d + dx * 0.6;
      let ny = oy / d + dy * 0.6;
      const m = Math.hypot(nx, ny) || 1;
      nx /= m;
      ny /= m;
      const f = FORZA * (1 - 0.3 * clamp(d / PORTATA, 0, 1));
      o.vx = o.vx * 0.3 + nx * f;
      o.vy = o.vy * 0.3 + ny * f;
      o.volo = 0.6;
      o.stordito = STORDITO;
      o.colpo = 0.6;
      colpiti++;
      const [sx, sy] = P(q.x + ox * 0.65, q.y + oy * 0.65);
      fx.particelle(sx, sy - 55, { n: 14, colori: ['#fff', '#ffd23f', o.p.colore], vel: 420, grav: 300, vita: 0.5, forma: 'stella', dim: 18 });
      fx.testo(sx, sy - 120, pick(PAROLE), { colore: '#ffd23f', dim: 54, vita: 0.8 });
      ctx.invia(o.id, { colpo: 1 });
    }
    // un piccolo rinculo, niente scatto in avanti
    q.vx -= dx * 90;
    q.vy -= dy * 90;
    if (colpiti) {
      sfx.colpo(1);
      fx.scuoti(7 + colpiti * 2);
      ctx.invia(q.id, { preso: colpiti });
    } else sfx.whoosh();
  }

  function passoFisica(dt) {
    for (const g of gioc) {
      if (!g.vivo) continue;
      const ctrl = g.stordito > 0 ? 0.15 : 1;
      g.vx += g.jx * 1500 * ctrl * dt;
      g.vy += g.jy * 1500 * ctrl * dt;
      const attrito = Math.pow(0.16, dt);
      g.vx *= attrito;
      g.vy *= attrito;
      const v = Math.hypot(g.vx, g.vy);
      const max = g.volo > 0 ? 1100 : 520;
      if (v > max) {
        g.vx *= max / v;
        g.vy *= max / v;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    // Urti: chi vola via dopo un pugno può trascinare gli altri (effetto biliardo)
    for (let i = 0; i < gioc.length; i++) {
      const a = gioc[i];
      if (!a.vivo) continue;
      for (let j = i + 1; j < gioc.length; j++) {
        const b = gioc[j];
        if (!b.vivo) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= RAGGIO * 2 || d < 1e-6) continue;
        const nx = dx / d;
        const ny = dy / d;
        const sovra = RAGGIO * 2 - d;
        a.x -= (nx * sovra) / 2;
        a.y -= (ny * sovra) / 2;
        b.x += (nx * sovra) / 2;
        b.y += (ny * sovra) / 2;
        const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vrel <= 0) continue;
        const imp = (1.8 * vrel) / 2;
        a.vx -= imp * nx;
        a.vy -= imp * ny;
        b.vx += imp * nx;
        b.vy += imp * ny;
        if (a.volo > 0 || b.volo > 0) {
          a.volo = Math.max(a.volo, 0.35);
          b.volo = Math.max(b.volo, 0.35);
        }
        if (vrel > 180) {
          const forza = clamp(vrel / 900, 0.2, 1);
          sfx.colpo(forza * 0.7);
          const [sx, sy] = P(a.x + nx * RAGGIO, a.y + ny * RAGGIO);
          fx.particelle(sx, sy, { n: 6 + forza * 10, colori: ['#fff', '#bde8ff', a.p.colore, b.p.colore], vel: 300 * forza + 100, grav: 300, vita: 0.5 });
          if (forza > 0.3) {
            a.colpo = Math.max(a.colpo, 0.4);
            b.colpo = Math.max(b.colpo, 0.4);
            ctx.invia([a.id, b.id], { colpo: forza });
          }
        }
      }
    }
  }

  function cade(g) {
    g.vivo = false;
    g.caduta = 0;
    g.eliminato = ctx.tempo;
    g.jx = g.jy = 0;
    sfx.splash();
    const [sx, sy] = P(g.x, g.y);
    fx.particelle(sx, sy, { n: 30, colori: ['#ffffff', '#7fd1ff', '#2b8fd6'], vel: 420, grav: 900, vita: 0.8 });
    fx.anello(sx, sy, { colore: '#bfe9ff', max: 120 });
    const rimasti = gioc.filter((x) => x.vivo).length;
    fx.testo(sx, sy - 120, 'SPLASH!', { colore: '#7fd1ff', dim: 46 });
    ctx.vista(g.id, { vivo: false, pos: rimasti + 1, tot: n });
    for (const x of gioc) if (x.vivo) vistaGioco(x);
  }

  function termina() {
    if (finito) return;
    finito = true;
    const vivi = gioc.filter((g) => g.vivo).map((g) => g.id);
    const morti = gioc.filter((g) => !g.vivo).sort((a, b) => b.eliminato - a.eliminato);
    const gruppi = vivi.length ? [vivi] : [];
    for (const g of morti) {
      const last = gruppi[gruppi.length - 1];
      const lg = last && perId.get(last[0]);
      if (lg && !lg.vivo && Math.abs(lg.eliminato - g.eliminato) < 0.05) last.push(g.id);
      else gruppi.push([g.id]);
    }
    const dettagli = {};
    for (const g of gioc) dettagli[g.id] = g.vivo ? 'Ancora in piedi! 💪' : `In acqua dopo ${fmtNum(g.eliminato, 1)} s`;
    ctx.fine({ gruppi, dettagli });
  }

  // ---------------------------------------------------------------------------
  // CPU (taratura in test/bench/azione.mjs).
  // Il bot decide a intervalli (0,2–0,34 s secondo il livello) su quello che ha visto
  // all'occhiata prima: posizioni un po' imprecise, velocità stimate dal movimento, chi ha
  // il pugno carico (l'anello bianco) e chi ha appena tirato. Tra una decisione e l'altra
  // il pollice continua a correggere la rotta verso la meta (ogni 0,08–0,12 s) e si
  // sposta con gradualità, come sul joystick del telefono. Priorità, come una persona:
  //  1. non cadere: se la scivolata lo porta verso il bordo frena e rientra; dopo un
  //     pugno subito controsterza, ma solo dopo il suo tempo di reazione;
  //  2. schivare chi arriva col pugno carico, o colpirlo per primo;
  //  3. attaccare il bersaglio che conviene: vicino al bordo, scarico (ha appena tirato),
  //     raggiungibile senza inseguimenti suicidi. Il Difficile si mette tra il centro e il
  //     bersaglio e tira quando il colpo lo spinge verso l'acqua;
  //  4. altrimenti stare verso il centro, muovendosi un po'.
  // Il Facile vaga, reagisce tardi, si distrae vicino al bordo e spreca pugni.

  const KO = 260; // quanto vola, più o meno, chi prende un pugno (stima "a occhio")

  function nuovaIa(q) {
    const cpu = ctx.cpu(q.id);
    const tr = cpu.tratti;
    return {
      cpu,
      passo: cpu.per(0.34, 0.28, 0.2), // ogni quanto riguarda la scena e decide
      riflesso: cpu.per(0.12, 0.1, 0.08), // ogni quanto il pollice corregge la rotta
      occhio: cpu.per(22, 12, 6), // imprecisione nel leggere le posizioni (px)
      margine: cpu.per(60, 90, 110) * (0.7 + 0.6 * tr.prudenza), // distanza voluta dal bordo
      distratto: cpu.per(0.05, 0.02, 0), // occhiate in cui si dimentica del bordo
      vMax: cpu.per(450, 420, 390), // velocità di crociera
      aFreno: cpu.per(1450, 1300, 1100), // frenata che si aspetta (il Facile se la immagina più forte)
      guadagno: cpu.per(6, 7, 9),
      pollice: cpu.per(0.13, 0.11, 0.08), // quanto ci mette il pollice a spostarsi (s)
      schiva: clamp(cpu.per(0.15, 0.25, 0.7) + 0.25 * (tr.prudenza - 0.5), 0, 0.95), // quanto spesso schiva
      tolleranza: cpu.per(-40, 12, 22), // quanto "dentro" la portata vuole essere per tirare
      distanza: cpu.per(80, 105, 115), // da dove attacca
      dalCentro: cpu.per(0.1, 0.4, 0.95), // quanto spesso si mette tra il centro e il bersaglio
      rispetto: cpu.per(0.45, 0.5, 0.65) * (0.6 + 0.8 * tr.prudenza), // quanto sta lontano dal bordo se qualcuno può colpirlo
      // voglia di attaccare (il Facile più che altro vaga)
      attacco: clamp(cpu.per(0.08, 0.2, 0.25) + cpu.per(0.25, 0.45, 0.5) * tr.aggressivita + cpu.errore(0.05), 0.05, 0.9),
      // nei primi 20 s il Normale non si allontana dal centro più di (raggio - cerchio × volo):
      // senza, rincorreva i bersagli verso il bordo e un terzo lo buttava giù (partite lampo)
      cerchio: cpu.per(0, 0.75, 0) * (0.9 + 0.2 * tr.prudenza),
      visti: new Map(),
      t: cpu.num(0.2, 0.6),
      tSterza: 0,
      jx: 0, // dove vuole portare il pollice
      jy: 0,
      px: 0, // dove si trova il pollice
      py: 0,
      gx: q.x,
      gy: q.y,
      fretta: 1,
      fisso: -1,
      allarme: false,
      modo: 'giro',
      bersaglio: null,
      interno: false,
      meta: null,
      tMeta: 0,
      minaccia: null,
      schivo: false,
      pugnoTra: -1,
      colpito: false,
      stordito: false,
      sicuro: 0,
    };
  }

  // Aggiorna quello che il bot "ha visto": errore d'occhio che cambia piano piano e
  // velocità stimate dagli spostamenti (nessuno legge le velocità vere, né i joystick).
  function guarda(q, ia) {
    const { cpu } = ia;
    const ora = ctx.tempo;
    for (const o of gioc) {
      if (o === q) continue;
      let v = ia.visti.get(o.id);
      if (!o.vivo) {
        if (v) ia.visti.delete(o.id);
        continue;
      }
      if (!v) {
        v = { o, x: o.x, y: o.y, vx: 0, vy: 0, ex: 0, ey: 0, t: ora, carico: true, tirato: -9 };
        ia.visti.set(o.id, v);
      }
      v.ex = v.ex * 0.7 + cpu.errore(ia.occhio * 0.7);
      v.ey = v.ey * 0.7 + cpu.errore(ia.occhio * 0.7);
      const x = o.x + v.ex;
      const y = o.y + v.ey;
      const dt = Math.max(0.05, ora - v.t);
      v.vx += ((x - v.x) / dt - v.vx) * 0.6;
      v.vy += ((y - v.y) / dt - v.vy) * 0.6;
      v.x = x;
      v.y = y;
      v.t = ora;
      v.carico = o.cd <= 0;
      if (o.pugno > 0) v.tirato = ora;
    }
  }

  // Quanto spazio c'è da (x, y) al bordo andando nella direzione (dx, dy) (versore).
  function versoBordo(x, y, dx, dy, raggio) {
    const b = x * dx + y * dy;
    const c = x * x + y * y - raggio * raggio;
    return -b + Math.sqrt(Math.max(0, b * b - c));
  }

  // Sceglie dove andare; il pollice poi ci guida (sterza) con continuità.
  function guida(q, ia, gx, gy, fretta = 1) {
    // non si va a cercare guai vicino al bordo (tranne quando si rientra)
    const rg = Math.hypot(gx, gy);
    if (rg > ia.sicuro && ia.modo !== 'salvo') {
      gx *= ia.sicuro / rg;
      gy *= ia.sicuro / rg;
    }
    ia.gx = gx;
    ia.gy = gy;
    ia.fretta = fretta;
    ia.fisso = -1;
    sterza(q, ia);
  }

  // Joystick per arrivare alla meta e fermarsi lì: sul ghiaccio bisogna frenare prima.
  function sterza(q, ia) {
    const ex = ia.gx - q.x;
    const ey = ia.gy - q.y;
    const d = Math.hypot(ex, ey);
    const v = d > 6 ? Math.min(ia.vMax * ia.fretta, Math.sqrt(2 * ia.aFreno * (d - 6))) : 0;
    const vx = d > 6 ? (ex / d) * v : 0;
    const vy = d > 6 ? (ey / d) * v : 0;
    let jx = (vx * 1.83 + (vx - q.vx) * ia.guadagno) / 1500;
    let jy = (vy * 1.83 + (vy - q.vy) * ia.guadagno) / 1500;
    const m = Math.hypot(jx, jy);
    if (m > 1) {
      jx /= m;
      jy /= m;
    }
    ia.jx = jx;
    ia.jy = jy;
  }

  // Joystick tenuto fermo in una direzione per un po' (mira del pugno, panico).
  function tieni(ia, jx, jy, durata) {
    ia.jx = jx;
    ia.jy = jy;
    ia.fisso = ctx.tempo + durata;
  }

  function valuta(q, ia, v, raggio) {
    const { cpu } = ia;
    const d = Math.hypot(v.x - q.x, v.y - q.y);
    const ro = Math.hypot(v.x, v.y) || 1;
    let u = 1 - d / 650 + cpu.per(0.3, 0.8, 1.2) * clamp(1 - (raggio - ro) / 300, 0, 1);
    if (!v.carico) u += cpu.per(0, 0.25, 0.5);
    else u -= cpu.per(0, 0.15, 0.3) * (0.5 + cpu.tratti.prudenza);
    if (v.o === ia.bersaglio) u += 0.2;
    // da dove lo attaccherebbe: se quel punto è troppo vicino al bordo, lascia perdere
    const px = v.x - (v.x / ro) * ia.distanza;
    const py = v.y - (v.y / ro) * ia.distanza;
    if (Math.hypot(px, py) > raggio - ia.margine && cpu.livello > 0) u -= 1;
    return u;
  }

  function pianifica(q, ia) {
    const { cpu } = ia;
    const ora = ctx.tempo;
    ia.t = ia.passo * cpu.num(0.8, 1.2);
    ia.allarme = false;
    // il bordo come lo vede: il Difficile tiene conto che si sta restringendo
    const restringe = ora > INIZIO_STRINGE && R > RMIN + 1;
    const raggio = R - (restringe ? cpu.per(0, 5, 10) : 0);
    const r = Math.hypot(q.x, q.y) || 1;
    // più spazio dal bordo se qualcuno col pugno carico è nei paraggi
    let vicino = false;
    for (const v of ia.visti.values()) if (v.carico && Math.hypot(v.x - q.x, v.y - q.y) < 260) vicino = true;
    ia.sicuro = Math.max(0, raggio - ia.margine - (vicino ? ia.rispetto * KO : 0));
    // all'inizio il Normale resta nel cerchio interno (vedi `cerchio`)
    if (ora < INIZIO_STRINGE) ia.sicuro = Math.min(ia.sicuro, raggio - ia.cerchio * KO);

    // 1. Il bordo
    if (!cpu.prob(ia.distratto)) {
      const vr = (q.x * q.vx + q.y * q.vy) / r;
      const frenata = vr > 0 ? (vr * vr) / (2 * ia.aFreno) : 0;
      if (r + frenata + ia.margine > raggio) {
        ia.modo = 'salvo';
        const k = (raggio * 0.3) / r;
        guida(q, ia, q.x * k, q.y * k, 1.2);
        if (ia.colpito && cpu.livello === 0 && cpu.prob(0.2)) {
          // panico: per un attimo spinge dalla parte sbagliata
          const m = Math.hypot(q.vx, q.vy) || 1;
          tieni(ia, q.vx / m, q.vy / m, cpu.num(0.15, 0.35));
        }
        ia.colpito = false;
        guarda(q, ia);
        return;
      }
    }
    ia.colpito = false;

    // 2. Chi arriva col pugno carico
    let minaccia = null;
    let dm = Infinity;
    for (const v of ia.visti.values()) {
      if (!v.carico) continue;
      const rx = q.x - v.x;
      const ry = q.y - v.y;
      const d = Math.hypot(rx, ry) || 1;
      const avvicina = ((v.vx - q.vx) * rx + (v.vy - q.vy) * ry) / d;
      if (d < 240 && avvicina > 120 && d < dm) {
        dm = d;
        minaccia = v;
      }
    }
    if (minaccia && minaccia !== ia.minaccia) {
      ia.minaccia = minaccia;
      ia.schivo = cpu.prob(ia.schiva);
    }
    if (!minaccia) ia.minaccia = null;
    if (minaccia && ia.schivo) {
      const rx = (q.x - minaccia.x) / dm;
      const ry = (q.y - minaccia.y) / dm;
      if (q.cd <= 0 && dm < PORTATA - 10) {
        // è già a tiro: meglio colpire per primo
        ia.bersaglio = minaccia.o;
        puntaPugno(q, ia, minaccia);
      } else {
        // di lato, dalla parte del centro
        let nx = -ry;
        let ny = rx;
        if (nx * -q.x + ny * -q.y < 0) {
          nx = -nx;
          ny = -ny;
        }
        ia.modo = 'schiva';
        guida(q, ia, q.x + nx * 140 - (q.x / r) * 40, q.y + ny * 140 - (q.y / r) * 40, 1.2);
      }
      guarda(q, ia);
      return;
    }

    // 3. Il bersaglio
    let migliore = null;
    let um = -Infinity;
    for (const v of ia.visti.values()) {
      const u = valuta(q, ia, v, raggio);
      if (u > um) {
        um = u;
        migliore = v;
      }
    }
    // voglia di attaccare: cresce col carattere e man mano che l'arena si stringe
    const soglia = 1 - ia.attacco + 0.35 * clamp(1 - ora / INIZIO_STRINGE, 0, 1) - 0.4 * clamp((ora - INIZIO_STRINGE) / 40, 0, 1);
    if (migliore && um > soglia) {
      if (migliore.o !== ia.bersaglio) {
        ia.bersaglio = migliore.o;
        ia.interno = cpu.prob(ia.dalCentro);
      }
      ia.modo = 'attacco';
      const v = migliore;
      const d = Math.hypot(v.x - q.x, v.y - q.y) || 1;
      if (q.cd <= 0 && d < PORTATA - ia.tolleranza && vuoleTirare(q, ia, v, d, raggio)) puntaPugno(q, ia, v);
      else {
        // si porta dalla parte del centro (o dritto verso di lui, se non ci pensa)
        const ro = Math.hypot(v.x, v.y);
        let ux = (v.x - q.x) / d;
        let uy = (v.y - q.y) / d;
        if (ia.interno && ro > 40) {
          ux = v.x / ro;
          uy = v.y / ro;
        }
        guida(q, ia, v.x - ux * ia.distanza, v.y - uy * ia.distanza);
      }
    } else {
      // 4. Verso il centro, senza stare fermo
      ia.modo = 'giro';
      ia.bersaglio = null;
      if (!ia.meta || ora > ia.tMeta) {
        const a = cpu.num(0, TAU);
        const rr = raggio * cpu.per(0.35, 0.28, 0.2) * Math.sqrt(cpu.caso());
        ia.meta = { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
        ia.tMeta = ora + cpu.num(1.5, 3.5);
      }
      guida(q, ia, ia.meta.x, ia.meta.y, 0.6);
      if (cpu.livello === 0 && q.cd <= 0) {
        // il principiante preme PUGNO appena qualcuno gli arriva vicino (spesso a vuoto)
        let vicino = null;
        let dv = PORTATA + 60;
        for (const v of ia.visti.values()) {
          const d = Math.hypot(v.x - q.x, v.y - q.y);
          if (d < dv) {
            dv = d;
            vicino = v;
          }
        }
        if (vicino && cpu.prob(0.45)) puntaPugno(q, ia, vicino);
        else if (cpu.prob(0.03)) premi(q, ia);
      }
    }
    guarda(q, ia);
  }

  // Tirare adesso? Il pugno spinge il bersaglio lungo la linea che li unisce.
  function vuoleTirare(q, ia, v, d, raggio) {
    const { cpu } = ia;
    if (cpu.livello === 0) return cpu.prob(0.6);
    const spazio = versoBordo(v.x, v.y, (v.x - q.x) / d, (v.y - q.y) / d, raggio);
    const duello = v.carico && d < 150;
    if (cpu.livello === 1) return spazio < KO * 1.4 || duello || cpu.prob(0.2);
    return spazio < KO * 1.15 || duello || cpu.prob(0.12 * cpu.tratti.aggressivita);
  }

  // Porta il pollice verso il bersaglio e preme PUGNO un attimo dopo.
  function puntaPugno(q, ia, v) {
    const d = Math.hypot(v.x - q.x, v.y - q.y) || 1;
    ia.modo = 'attacco';
    tieni(ia, ((v.x - q.x) / d) * 0.7, ((v.y - q.y) / d) * 0.7, 0.2);
    if (ia.pugnoTra < 0) ia.pugnoTra = ctx.tempo + ia.cpu.num(0.04, 0.1);
  }

  function premi(q, ia) {
    ia.pugnoTra = -1;
    pugno(q);
  }

  function muoviBot(q, dt) {
    const ia = q.ia || (q.ia = nuovaIa(q));
    const { cpu } = ia;
    const ora = ctx.tempo;
    // colpito: il controsterzo arriva dopo il tempo di reazione
    if (q.stordito > 0 && !ia.stordito) {
      ia.colpito = true;
      ia.t = cpu.reazione();
      ia.pugnoTra = -1;
      ia.fisso = ora + ia.t * 0.5; // un attimo di sorpresa, poi il pollice riprende a correggere
    }
    ia.stordito = q.stordito > 0;
    if (ia.pugnoTra >= 0 && ora >= ia.pugnoTra) {
      if (q.cd <= 0) premi(q, ia);
      else ia.pugnoTra = -1;
    }
    ia.t -= dt;
    if (ia.t <= 0) pianifica(q, ia);
    // le decisioni sono lente, ma il pollice corregge la rotta di continuo
    ia.tSterza -= dt;
    if (ia.tSterza <= 0) {
      ia.tSterza = ia.riflesso;
      if (ora >= ia.fisso) sterza(q, ia);
      // "sto scivolando fuori!": si accorge del bordo col suo tempo di reazione
      if (ia.modo !== 'salvo' && !ia.allarme && !ia.stordito) {
        const r = Math.hypot(q.x, q.y) || 1;
        const vr = (q.x * q.vx + q.y * q.vy) / r;
        if (vr > 0 && r + (vr * vr) / (2 * ia.aFreno) + ia.margine * 0.5 > R) {
          ia.allarme = true;
          ia.t = Math.min(ia.t, cpu.reazione(0.7));
        }
      }
    }
    // il pollice si sposta con continuità verso la direzione voluta; vicino al centro
    // del joystick il telefono manda zero (zona morta)
    const k = Math.min(1, dt / ia.pollice);
    ia.px += (ia.jx - ia.px) * k;
    ia.py += (ia.jy - ia.py) * k;
    const morto = Math.hypot(ia.px, ia.py) < 0.12;
    q.jx = morto ? 0 : ia.px;
    q.jy = morto ? 0 : ia.py;
  }

  // Guantone da boxe su una molla, che scatta nella direzione del pugno.
  function guantone(g, q, sx, sy, sc) {
    const k = 1 - q.pugno / T_PUGNO;
    const e = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
    const ext = e * 115 * sc;
    if (ext < 4) return;
    let ex = q.pdx;
    let ey = q.pdy * SY;
    const m = Math.hypot(ex, ey) || 1;
    ex /= m;
    ey /= m;
    const x0 = sx + ex * 16 * sc;
    const y0 = sy - 52 * sc + ey * 10 * sc;
    const gx = x0 + ex * ext;
    const gy = y0 + ey * ext;
    // molla
    g.strokeStyle = '#2a1d3d';
    g.lineWidth = 7 * sc;
    g.lineJoin = 'round';
    g.beginPath();
    const giri = 7;
    for (let i = 0; i <= giri; i++) {
      const f = i / giri;
      const off = i === 0 || i === giri ? 0 : (i % 2 ? 1 : -1) * 9 * sc;
      const px = x0 + (gx - x0) * f - ey * off;
      const py = y0 + (gy - y0) * f + ex * off;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 3.5 * sc;
    g.stroke();
    // guantone
    g.save();
    g.translate(gx, gy);
    g.rotate(Math.atan2(ey, ex));
    g.scale(sc, sc);
    g.lineWidth = 4;
    g.strokeStyle = '#2a1d3d';
    g.beginPath();
    g.roundRect(-34, -15, 16, 30, 5);
    g.fillStyle = '#f8fafc';
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(0, 0, 28, 24, 0, 0, TAU);
    g.fillStyle = '#e11d48';
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(-4, -19, 12, 8, -0.3, 0, TAU);
    g.fillStyle = '#be123c';
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(6, -8, 10, 5, -0.4, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fill();
    g.restore();
  }

  return {
    aggiorna(dt) {
      t += dt;
      const k = clamp((ctx.tempo - INIZIO_STRINGE) / (FINE_STRINGE - INIZIO_STRINGE), 0, 1);
      R = R0 - (R0 - RMIN) * k;
      for (const g of gioc) {
        g.cd = Math.max(0, g.cd - dt);
        g.pugno = Math.max(0, g.pugno - dt);
        g.colpo = Math.max(0, g.colpo - dt);
        g.stordito = Math.max(0, g.stordito - dt);
        g.volo = Math.max(0, g.volo - dt);
        if (g.caduta >= 0) g.caduta += dt;
        // verso cui guarda (serve anche alla mira di riserva del pugno)
        if (g.pugno <= 0 && Math.abs(g.vx) > 20) g.dir = g.vx > 0 ? 1 : -1;
      }
      if (!finito) {
        passoFisica(dt / 2);
        passoFisica(dt / 2);
        for (const g of gioc) {
          if (g.vivo && Math.hypot(g.x, g.y) > R + 6) cade(g);
        }
        const vivi = gioc.filter((g) => g.vivo).length;
        if (fineTra < 0 && (vivi <= 1 || ctx.tempo >= DURATA)) fineTra = vivi <= 1 ? 1.2 : 0;
        if (fineTra >= 0) {
          fineTra -= dt;
          if (fineTra <= 0) termina();
        }
      } else {
        for (const g of gioc) {
          if (!g.vivo) continue;
          g.vx *= 0.9;
          g.vy *= 0.9;
          g.x += g.vx * dt;
          g.y += g.vy * dt;
        }
      }
    },

    disegna(g) {
      const { H } = ctx;
      // Acqua
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#0b3d6b');
      grd.addColorStop(1, '#06203d');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,200,255,0.12)';
      g.lineWidth = 4;
      for (let y = 40; y < H; y += 60) {
        g.beginPath();
        for (let x = 0; x <= W; x += 40) {
          const yy = y + Math.sin(x / 90 + t * 1.5 + y) * 8;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
      }
      // Bordo originale (tratteggiato)
      g.setLineDash([18, 16]);
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(CX, CY, R0, R0 * SY, 0, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      // Ghiaccio (lastra con spessore)
      g.beginPath();
      g.ellipse(CX, CY + 22, R, R * SY, 0, 0, TAU);
      g.fillStyle = '#5aa9d6';
      g.fill();
      const ice = g.createRadialGradient(CX - R * 0.3, CY - R * 0.3, R * 0.1, CX, CY, R);
      ice.addColorStop(0, '#f4fcff');
      ice.addColorStop(1, '#a9dcf4');
      g.beginPath();
      g.ellipse(CX, CY, R, R * SY, 0, 0, TAU);
      g.fillStyle = ice;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(80,150,200,0.35)';
      g.lineWidth = 3;
      for (const c of crepe) {
        g.beginPath();
        c.forEach(([x, y], i) => {
          const [px, py] = P(x * R0, y * R0);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        g.stroke();
      }
      // riflessi
      g.globalAlpha = 0.35;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(CX - R * 0.35, CY - R * 0.33, R * 0.35, R * 0.06, -0.35, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      g.restore();
      const restringe = ctx.tempo > INIZIO_STRINGE && R > RMIN + 1;
      g.lineWidth = 10;
      g.strokeStyle = restringe ? `rgba(255,${120 + Math.sin(t * 8) * 60},120,0.9)` : '#ffffff';
      g.beginPath();
      g.ellipse(CX, CY, R, R * SY, 0, 0, TAU);
      g.stroke();

      // Giocatori (prima chi è più lontano)
      const ordine = [...gioc].sort((a, b) => a.y - b.y);
      for (const q of ordine) {
        if (q.caduta > 0.9) continue;
        const k = q.caduta >= 0 ? q.caduta / 0.9 : 0;
        const [sx, sy] = P(q.x, q.y);
        const sc = 1 + (q.y / R0) * 0.12;
        g.save();
        g.globalAlpha = 1 - k;
        if (q.vivo) {
          g.beginPath();
          g.ellipse(sx, sy, (RAGGIO + 4) * sc, (RAGGIO + 4) * SY * 0.6 * sc, 0, 0, TAU);
          g.fillStyle = shade(q.p.colore, -0.1);
          g.globalAlpha = 0.85;
          g.fill();
          g.globalAlpha = 1;
          if (q.cd <= 0) {
            g.lineWidth = 4;
            g.strokeStyle = '#fff';
            g.stroke();
          }
        }
        const vel = Math.hypot(q.vx, q.vy);
        const pose = q.caduta >= 0 || q.colpo > 0 ? 'hit' : q.pugno > 0 ? 'pugno' : vel > 60 ? 'run' : 'idle';
        ctx.avatar(g, q.p.av, sx, sy + k * 50, 110 * sc * (1 - k * 0.5), { pose, t, dir: q.dir, look: [q.dir * 0.6, 0], ombra: false });
        g.restore();
        if (q.vivo) ctx.etichetta(g, q.p.nome, sx, sy + 26 * sc, q.p.colore, { dim: 18, maxW: 150 });
      }
      // I guantoni sopra a tutti, così si vedono sempre
      for (const q of ordine) {
        if (q.pugno <= 0 || !q.vivo) continue;
        const [sx, sy] = P(q.x, q.y);
        guantone(g, q, sx, sy, 1 + (q.y / R0) * 0.12);
      }

      // HUD
      const vivi = gioc.filter((q) => q.vivo).length;
      ctx.barraTempo(g, DURATA - ctx.tempo, DURATA, { w: 600, x: 60, y: 40 });
      ctx.pannello(g, W - 380, 24, 330, 70, { r: 35 });
      ctx.testo(g, `🧍 In piedi: ${vivi}`, W - 215, 60, { dim: 36 });
      if (restringe && ctx.tempo < INIZIO_STRINGE + 4) ctx.testo(g, "L'arena si restringe!", W / 2, 60, { dim: 48, colore: '#ffd23f' });
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || !q.vivo || finito) return;
      if (Array.isArray(d.j)) {
        q.jx = clamp(Number(d.j[0]) || 0, -1, 1);
        q.jy = clamp(Number(d.j[1]) || 0, -1, 1);
        const m = Math.hypot(q.jx, q.jy);
        if (m > 1) {
          q.jx /= m;
          q.jy /= m;
        }
      }
      if (d.s) pugno(q);
    },

    bot(id, dt) {
      const q = perId.get(id);
      if (q.vivo && !finito) muoviBot(q, dt);
    },
  };
}
