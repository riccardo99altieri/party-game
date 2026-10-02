// Batti le Ali!: tutti saltano da una scogliera con le ali legate alle braccia.
// Ogni tocco sul telefono è un colpo d'ali: più tocchi, più vai lontano e in alto.
// Dopo 12 secondi le braccia sono stanche e si plana fino al tuffo in mare.
// Vince chi atterra (splash!) più lontano.

import { TAU, rand, clamp, lerp, fmtNum } from '../../shared/util.js';

const DURATA = 12; // secondi per sbattere le ali
const QUOTA_INIZIO = 24; // metri: altezza della scogliera
const QUOTA_MAX = 58;
const SPINTA_X = 0.55; // m/s in avanti per ogni battito
const SPINTA_Y = 1.35; // m/s verso l'alto per ogni battito
const ATTRITO_X = 0.35;
const GRAVITA = 7;
const SMORZA_Y = 1.2;
const GRAVITA_PLANATA = 16;
const SMORZA_PLANATA = 0.5;
const TAP_MAX = 18; // battiti al secondo accettati al massimo
const PX_M = 11; // pixel per metro in verticale
const SALTO = 0.45; // durata del salto dalla scogliera

export default {
  id: 'ali',
  nome: 'Batti le Ali!',
  emoji: '🪶',
  colore: '#38bdf8',
  descrizione: 'Tocca più veloce che puoi: vola più lontano di tutti!',
  comeSiGioca: [
    'Tutti saltano dalla scogliera con le ali legate alle braccia',
    "Tocca lo schermo più veloce che puoi (anche con due dita!): ogni tocco è un colpo d'ali",
    'Dopo 12 secondi le braccia si stancano: si plana fino al tuffo. Vince chi arriva più lontano!',
  ],
  controllo: 'raffica',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const ORIZZONTE = 770;
  const MARE_DIETRO = 835;
  const MARE_DAVANTI = 995;
  const AREA_X0 = 60;
  const AREA_X1 = W - 380;
  const H_AV = n > 8 ? 96 : 118;

  let partito = false;
  let finito = false;
  let fineTra = -1;
  let planata = false;
  let t = 0;
  let tInvio = 0;

  const gioc = ctx.giocatori.map((p, i) => {
    const d = n > 1 ? i / (n - 1) : 0.5;
    return {
      id: p.id,
      p,
      d,
      mare: lerp(MARE_DIETRO, MARE_DAVANTI, d),
      s: 0.84 + 0.16 * d,
      xStart: -1.3 - (i % 3) * 1.5,
      x: 0,
      alt: QUOTA_INIZIO,
      vx: 0,
      vy: 0,
      battiti: 0,
      gettoni: 8,
      ritmo: 0,
      fase: Math.random(),
      splash: false,
      tSplash: 0,
      finale: null,
      ia: null,
    };
  });
  const perId = new Map(gioc.map((q) => [q.id, q]));

  // Nuvole e isole lontane (si muovono con la telecamera, più piano: parallasse)
  const nuvole = Array.from({ length: 8 }, () => ({ x: rand(0, W + 600), y: rand(110, 560), s: rand(0.6, 1.3), v: rand(0.2, 0.45) }));
  const isole = Array.from({ length: 4 }, (_, i) => ({ x: i * 520 + rand(0, 200), w: rand(160, 320), h: rand(30, 70) }));

  const tempo = () => (partito ? ctx.tempo : -1);
  const xDisegno = (q) => (!partito ? q.xStart : ctx.tempo < SALTO ? lerp(q.xStart, q.x, ctx.tempo / SALTO) : q.x);

  function bersaglioCamera() {
    let lo = Infinity;
    let hi = -Infinity;
    for (const q of gioc) {
      const x = xDisegno(q);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    lo -= 4;
    hi += 9;
    const larg = AREA_X1 - AREA_X0;
    const scala = clamp(larg / (hi - lo), 5, 26);
    let cam = (lo + hi) / 2 - larg / 2 / scala;
    if ((hi - lo) * scala > larg) cam = hi - larg / scala; // il primo resta sempre in vista
    return [cam, scala];
  }
  let [cam, scala] = bersaglioCamera();
  let odo = cam * 6; // "contachilometri" per lo sfondo
  const sx = (x) => AREA_X0 + (x - cam) * scala;

  ctx.vista('*', { fase: 'pronti', durata: DURATA });

  function batti(q, k) {
    if (!partito || q.splash || ctx.tempo >= DURATA) return;
    for (let i = 0; i < k; i++) {
      if (q.gettoni < 1) break;
      q.gettoni -= 1;
      q.battiti++;
      q.vx += SPINTA_X;
      q.vy = Math.min(q.vy + SPINTA_Y, 7);
      q.ritmo += 2.5;
      if (Math.random() < 0.15) {
        const y = q.mare - q.alt * PX_M - H_AV * q.s * 0.55;
        fx.particelle(sx(q.x) + rand(-40, 40), y, { n: 1, colori: [q.p.colore, '#ffffff'], forma: 'coriandolo', angolo: Math.PI * 0.85, apertura: 0.4, vel: 180, velMin: 60, grav: 120, vita: 1.3, dim: 14 });
      }
    }
  }

  function tuffo(q) {
    q.alt = 0;
    q.vy = 0;
    q.splash = true;
    q.tSplash = 0;
    q.finale = Math.round(q.x * 10) / 10;
    sfx.splash();
    fx.particelle(sx(q.x), q.mare, { n: 22, colori: ['#ffffff', '#bfeaff', '#5ec8ff'], angolo: -Math.PI / 2, apertura: 0.7, vel: 520, grav: 1100, vita: 0.8 });
    ctx.invia(q.id, { splash: q.finale });
  }

  function termina() {
    if (finito) return;
    finito = true;
    const punteggi = {};
    const dettagli = {};
    for (const q of gioc) {
      punteggi[q.id] = q.finale ?? Math.round(q.x * 10) / 10;
      dettagli[q.id] = `${fmtNum(punteggi[q.id], 1)} m · ${q.battiti} battiti`;
    }
    ctx.fine({ punteggi, alto: true, dettagli });
  }

  function classifica() {
    return [...gioc].sort((a, b) => (b.finale ?? b.x) - (a.finale ?? a.x));
  }

  // ---------------------------------------------------------------------------
  // CPU: tocca come una persona (taratura in test/bench/azione.mjs).
  // Ogni bot ha un ritmo personale a braccio fresco che cala con la fatica, intervalli
  // irregolari tra un tocco e l'altro, una deriva lenta del ritmo, qualche inciampo
  // del dito (il principiante ogni tanto alza gli occhi allo schermo grande) e uno
  // sprint quando vede che il tempo sta per finire. Parte dopo il tempo di reazione
  // al VIA e spedisce i tocchi a pacchetti ogni 60 ms, come il telefono.

  function nuovaIa(id) {
    const cpu = ctx.cpu(id);
    const { costanza, aggressivita } = cpu.tratti;
    return {
      cpu,
      // tocchi/s a braccio fresco (la media sui 12 s è ~12% più bassa): Facile ~ 25° percentile
      // delle persone, Normale ~ mediana, Difficile ~ 85°, sempre sotto chi usa due dita
      ritmo: clamp(cpu.per(6.2, 7.2, 9.1) * Math.exp(cpu.errore(0.07)), 4.2, 10.2),
      calo: cpu.per(0.2, 0.15, 0.1) * (1.3 - 0.6 * costanza), // frazione di ritmo persa in 12 s
      cv: cpu.per(0.2, 0.14, 0.1), // irregolarità tra un tocco e il successivo
      sprint: cpu.per(0.03, 0.05, 0.07) * (0.5 + aggressivita),
      inciampo: cpu.per(0.03, 0.013, 0.006), // probabilità per tocco di una pausa
      pausaMax: cpu.per(0.8, 0.45, 0.3),
      deriva: 0,
      prossimo: cpu.reazione(),
      daMandare: 0,
      ultimoInvio: -1,
    };
  }

  // Tempo fino al tocco successivo, dato l'istante del tocco appena fatto.
  function intervallo(ia, tt) {
    const cpu = ia.cpu;
    ia.deriva = ia.deriva * 0.88 + cpu.errore(0.02);
    let r = ia.ritmo * (1 - ia.calo * (tt / DURATA)) * (1 + ia.deriva);
    if (tt < 1.5) r *= 1.05; // partenza a razzo
    else if (tt > DURATA - 2.2) r *= 1 + ia.sprint; // "ultimi secondi!"
    let dtTocco = Math.exp(cpu.errore(ia.cv)) / r;
    if (cpu.prob(ia.inciampo)) dtTocco += cpu.num(0.12, ia.pausaMax);
    return dtTocco;
  }

  // ---------------------------------------------------------------------------
  // Disegno

  function nuvola(g, x, y, s) {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    for (const [dx, dy, r] of [
      [-60, 10, 38],
      [-15, -12, 52],
      [40, 0, 42],
      [80, 14, 30],
    ]) {
      g.moveTo(x + (dx + r) * s, y + dy * s);
      g.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
    }
    g.fill();
  }

  function sfondo(g) {
    const cielo = g.createLinearGradient(0, 0, 0, ORIZZONTE);
    cielo.addColorStop(0, '#4fb6f5');
    cielo.addColorStop(1, '#c9efff');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, ORIZZONTE);
    // sole
    g.fillStyle = 'rgba(255,244,179,0.35)';
    g.beginPath();
    g.arc(1250, 160, 110, 0, TAU);
    g.fill();
    g.fillStyle = '#fff4b3';
    g.beginPath();
    g.arc(1250, 160, 70, 0, TAU);
    g.fill();
    const giro = W + 600;
    for (const c of nuvole) {
      const x = ((((c.x - odo * c.v) % giro) + giro) % giro) - 300;
      nuvola(g, x, c.y, c.s);
    }
    // isole all'orizzonte
    const giroI = 2080;
    for (const is of isole) {
      const x = ((((is.x - odo * 0.08) % giroI) + giroI) % giroI) - 200;
      g.beginPath();
      g.ellipse(x, ORIZZONTE + 2, is.w / 2, is.h, 0, Math.PI, TAU);
      g.fillStyle = '#5fa36a';
      g.fill();
    }
    // mare
    const mare = g.createLinearGradient(0, ORIZZONTE, 0, H);
    mare.addColorStop(0, '#3ab0e6');
    mare.addColorStop(1, '#0b5c99');
    g.fillStyle = mare;
    g.fillRect(0, ORIZZONTE, W, H - ORIZZONTE);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const y = ORIZZONTE + 18 + i * i * 4 + i * 14;
      const k = 0.2 + i * 0.12;
      const per = 160 + i * 30;
      const off = (((-odo * k + t * 20 * (1 + i * 0.1)) % per) + per) % per;
      g.beginPath();
      for (let x = off - per; x < W; x += per) {
        g.moveTo(x, y);
        g.quadraticCurveTo(x + per * 0.15, y - 5, x + per * 0.3, y);
      }
      g.stroke();
    }
  }

  function boe(g) {
    const passi = [5, 10, 20, 25, 50, 100];
    const passo = passi.find((p) => p * scala >= 110) || 100;
    const primo = Math.max(1, Math.ceil(cam / passo));
    const ultimo = cam + (W - AREA_X0) / scala;
    for (let m = primo * passo; m <= ultimo; m += passo) {
      const x = sx(m);
      const y = 1040 + Math.sin(t * 2 + m) * 3;
      g.strokeStyle = '#1b1030';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y - 6);
      g.lineTo(x, y - 42);
      g.stroke();
      g.beginPath();
      g.moveTo(x, y - 42);
      g.lineTo(x + 26, y - 35);
      g.lineTo(x, y - 28);
      g.closePath();
      g.fillStyle = '#ffd23f';
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(x, y, 16, 9, 0, 0, TAU);
      g.fillStyle = m % (passo * 2) === 0 ? '#ef4444' : '#ffffff';
      g.fill();
      g.stroke();
      ctx.testo(g, `${m} m`, x, y + 24, { dim: 22 });
    }
  }

  function scogliera(g) {
    const x0 = sx(0);
    if (x0 < -40) return;
    const topDietro = MARE_DIETRO - QUOTA_INIZIO * PX_M;
    const topDavanti = MARE_DAVANTI - QUOTA_INIZIO * PX_M;
    // parete
    g.fillStyle = '#8d6e63';
    g.fillRect(-10, topDavanti, x0 + 10, H - topDavanti + 10);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 6; i++) g.fillRect(-10, topDavanti + 40 + i * 55, x0 + 10, 12);
    g.fillStyle = '#6d4c41';
    g.fillRect(x0 - 14, topDietro + 6, 14, H - topDietro);
    // prato in cima
    g.beginPath();
    g.moveTo(-10, topDietro);
    g.lineTo(x0, topDietro);
    g.lineTo(x0, topDavanti);
    g.lineTo(-10, topDavanti);
    g.closePath();
    g.fillStyle = '#7cc36b';
    g.fill();
    g.fillStyle = '#5ea650';
    g.fillRect(-10, topDavanti - 6, x0 + 10, 12);
    // bandierina di partenza
    g.strokeStyle = '#1b1030';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x0 - 8, topDietro);
    g.lineTo(x0 - 8, topDietro - 90);
    g.stroke();
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.moveTo(x0 - 8, topDietro - 90);
    g.lineTo(x0 + 40, topDietro - 76 + Math.sin(t * 5) * 4);
    g.lineTo(x0 - 8, topDietro - 62);
    g.closePath();
    g.fill();
    g.stroke();
    // schiuma alla base
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(x0, MARE_DAVANTI + 4, 40, 8, 0, 0, TAU);
    g.fill();
  }

  function giocatore(g, q, capo) {
    const tt = tempo();
    const x = sx(xDisegno(q));
    const h = H_AV * q.s;
    if (x < -120 || x > W + 120) return;
    if (q.splash) {
      // a mollo: si vede solo dalla vita in su, con le onde intorno
      const y = q.mare;
      for (let i = 0; i < 2; i++) {
        const k = ((q.tSplash * 0.6 + i * 0.5) % 1);
        g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x, y, 30 + k * 50, (30 + k * 50) * 0.25, 0, 0, TAU);
        g.stroke();
      }
      g.save();
      g.beginPath();
      g.rect(x - 150, y - h * 2, 300, h * 2);
      g.clip();
      const bob = Math.sin(t * 3 + q.d * 5) * 3;
      ctx.avatar(g, q.p.av, x, y + h * 0.5 + bob, h, { pose: q.tSplash < 1.2 ? 'hit' : 'idle', t, ali: true, espr: q.tSplash < 1.2 ? 'sorpreso' : 'felice', ombra: false });
      g.restore();
      ctx.etichetta(g, `${fmtNum(q.finale, 1)} m`, x, y - h * 0.62 + bob, q.p.colore, { dim: 18 });
      return;
    }
    const y = q.mare - q.alt * PX_M;
    // ombra sull'acqua
    if (partito && x > sx(0)) {
      const k = clamp(1 - q.alt / 70, 0.2, 1);
      g.fillStyle = `rgba(0,30,60,${0.25 * k})`;
      g.beginPath();
      g.ellipse(x, q.mare, 26 * k * q.s, 6 * k * q.s, 0, 0, TAU);
      g.fill();
    }
    let o;
    if (!partito) o = { pose: 'idle', t, ali: true, look: [0.8, 0] };
    else {
      const amp = planata ? 0 : clamp(q.ritmo / 4, 0, 1);
      const espr = q.vy < -9 ? 'sorpreso' : planata ? 'felice' : q.ritmo > 6.5 ? 'arrabbiato' : null;
      const inclina = clamp(q.vx / 45, 0, 0.28) - clamp(q.vy * 0.015, -0.15, 0.15);
      o = { pose: 'vola', t, ali: true, battito: -Math.cos(q.fase * TAU) * amp, inclina, espr, look: [0.8, 0], ombra: false };
    }
    ctx.avatar(g, q.p.av, x, y, h, o);
    if (capo) ctx.testo(g, '👑', x, y - h * 1.12, { dim: 34, bordo: 0 });
    if (n <= 8 && tt < DURATA + 3) ctx.etichetta(g, q.p.nome, x, y + 16, q.p.colore, { dim: 17, maxW: 140 });
  }

  function tabellone(g) {
    const ord = classifica();
    const rowH = Math.min(58, (H - 150) / n);
    const x = W - 350;
    const w = 330;
    ctx.pannello(g, x, 20, w, 60 + n * rowH, { r: 24 });
    ctx.testo(g, '📏 Distanze', x + w / 2, 50, { dim: 30 });
    ord.forEach((q, i) => {
      const y = 80 + i * rowH + rowH / 2;
      if (i === 0 && partito) {
        g.fillStyle = 'rgba(255,210,63,0.22)';
        g.beginPath();
        g.roundRect(x + 8, y - rowH / 2 + 3, w - 16, rowH - 6, 12);
        g.fill();
      }
      ctx.testo(g, `${i + 1}`, x + 26, y, { dim: Math.min(26, rowH * 0.5) });
      ctx.testa(g, q.p.av, x + 66, y, rowH * 0.36, { t });
      ctx.testo(g, q.p.nome, x + 94, y, { dim: Math.min(24, rowH * 0.42), allinea: 'left', maxW: 128, colore: q.p.colore });
      const m = q.finale ?? Math.max(0, q.x);
      ctx.testo(g, `${q.splash ? '💦 ' : ''}${fmtNum(m, 1)} m`, x + w - 14, y, { dim: Math.min(24, rowH * 0.42), allinea: 'right', colore: q.splash ? '#bfeaff' : '#fff' });
    });
  }

  return {
    inizia() {
      partito = true;
      for (const q of gioc) {
        q.x = 0;
        q.vx = 4;
        q.vy = 4;
      }
      ctx.vista('*', { fase: 'via', durata: DURATA });
    },

    aggiorna(dt) {
      t += dt;
      const [camT, scalaT] = bersaglioCamera();
      const k = Math.min(1, dt * 2.5);
      cam += (camT - cam) * k;
      scala += (scalaT - scala) * k;
      odo = cam * 6;
      if (!partito) return;
      const tt = ctx.tempo;
      if (!planata && tt >= DURATA) {
        planata = true;
        sfx.ding();
        fx.testo(W / 2 - 180, 240, 'Braccia stanche! 🪂', { colore: '#ffd23f', dim: 64, vita: 2 });
        ctx.vista('*', { fase: 'plana', durata: DURATA });
      }
      for (const q of gioc) {
        q.gettoni = Math.min(8, q.gettoni + TAP_MAX * dt);
        q.ritmo *= Math.exp(-2.5 * dt);
        q.fase += dt * (0.6 + Math.min(q.ritmo, 9) * 0.8);
        if (q.splash) {
          q.tSplash += dt;
          continue;
        }
        if (!planata) {
          q.vy -= GRAVITA * dt;
          q.vy *= Math.exp(-SMORZA_Y * dt);
        } else {
          q.vy -= GRAVITA_PLANATA * dt;
          q.vy *= Math.exp(-SMORZA_PLANATA * dt);
        }
        q.vx *= Math.exp(-ATTRITO_X * dt);
        q.x += q.vx * dt;
        q.alt += q.vy * dt;
        if (q.alt > QUOTA_MAX) {
          q.alt = QUOTA_MAX;
          if (q.vy > 0) q.vy = 0;
        }
        if (q.alt <= 0 || tt > DURATA + 12) tuffo(q);
      }
      tInvio -= dt;
      if (tInvio <= 0 && !finito) {
        tInvio = 0.25;
        const m = {};
        for (const q of gioc) m[q.id] = Math.round((q.finale ?? Math.max(0, q.x)) * 10) / 10;
        ctx.invia('*', { r: Math.max(0, DURATA - tt), m });
      }
      if (!finito && fineTra < 0 && gioc.every((q) => q.splash)) fineTra = 1.6;
      if (fineTra >= 0) {
        fineTra -= dt;
        if (fineTra <= 0) termina();
      }
    },

    disegna(g) {
      sfondo(g);
      boe(g);
      scogliera(g);
      const capo = partito ? classifica()[0] : null;
      for (const q of gioc) giocatore(g, q, q === capo && !planata && ctx.tempo > 1.5);

      // HUD
      const tt = tempo();
      let frase = 'Pronti a saltare!';
      if (tt >= 0 && !planata) frase = '🪶 SBATTI LE ALI!';
      else if (planata && !gioc.every((q) => q.splash)) frase = '🪂 Planata…';
      else if (planata) frase = '💦 Tutti in acqua!';
      ctx.pannello(g, 30, 20, 560, 80, { r: 40 });
      ctx.testo(g, frase, 310, 60, { dim: 44, colore: tt >= 0 && !planata ? '#ffd23f' : '#fff' });
      if (!planata) ctx.barraTempo(g, tt < 0 ? DURATA : DURATA - tt, DURATA, { w: 560, x: 640, y: 46 });
      tabellone(g);
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || !d) return;
      const k = Math.floor(Number(d.b));
      if (k > 0) batti(q, Math.min(k, 20));
    },

    bot(id) {
      const q = perId.get(id);
      if (!partito || q.splash || ctx.tempo >= DURATA) return;
      const ia = q.ia || (q.ia = nuovaIa(id));
      const tt = ctx.tempo;
      while (ia.prossimo <= tt) {
        ia.daMandare++;
        ia.prossimo += intervallo(ia, ia.prossimo);
      }
      if (ia.daMandare && tt - ia.ultimoInvio >= 0.06) {
        batti(q, ia.daMandare);
        ia.daMandare = 0;
        ia.ultimoInvio = tt;
      }
    },
  };
}
