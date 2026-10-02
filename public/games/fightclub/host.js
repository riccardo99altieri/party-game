// Fight Club: duelli 1 contro 1 su cui il pubblico scommette e fa il tifo a raffica.
// Ogni duello: 4 s di scommesse (i gladiatori si preparano), il duello col cursore sul
// telefono (il tifo lo rende più facile), poi l'esito con i punti. Vince chi ne fa di più.
// BOT PROVVISORI (da creare / calibrare): un cervello unico, le tre potenze giocano uguali.

import { TAU, clamp, lerp, ease } from '../../shared/util.js';
import { prepara } from '../../shared/avatar.js';
import {
  TEMPI,
  MANCATO,
  RAFFICA,
  MODI,
  TIFO,
  capienza,
  calendario,
  tri,
  faseVerso,
  velocita,
  larghezza,
  qualita,
  prossimaZona,
  spinta,
  taglio,
  precisione,
  puntiDuello,
} from './regole.js';

const XA = 300; // gladiatore di sinistra
const XB = 1620; // gladiatore di destra
const PIEDI = 790;
const ALTO = 470;
const BX = 690; // barre dei cursori
const BW = 540;
const TRIBUNA = 905; // teste del pubblico
const MAX_TIFO = 14; // tocchi al secondo contati al massimo per persona
const ANTICIPO = 0.2; // la CPU mira al passaggio del cursore che arriva tra almeno 0,2 s

export default {
  id: 'fightclub',
  nome: 'Fight Club',
  emoji: '🥊',
  colore: '#e11d48',
  descrizione: 'Duelli 1 contro 1: il pubblico scommette e fa il tifo a raffica per il suo gladiatore',
  comeSiGioca: [
    "A ogni duello due giocatori scendono nell'arena: tutti combattono lo stesso numero di volte",
    'Pubblico: hai 4 secondi per puntare su chi vincerà, poi tocca a raffica FAI IL TIFO!',
    'Più tifo riceve, più è facile il duello per il gladiatore: mirino più lento, zona verde più larga',
    'Gladiatori: guardate il telefono e toccate quando il cursore è nel verde (o al centro)',
    'Vincitore +4, sconfitto −1, scommessa giusta +2 (+3 se eravate in pochi), Miracolo +2 a chi vince con meno tifo',
  ],
  controllo: 'duello',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const gioc = ctx.giocatori.map((p) => ({ id: p.id, p, av: prepara(p.av), punti: 0, vinti: 0, hx: W / 2, hy: H + 80, bump: 0, budget: MAX_TIFO, tifoLato: null }));
  const perId = new Map(gioc.map((q) => [q.id, q]));
  const duelli = calendario(gioc.map((q) => q.id));
  const cap = capienza(gioc.length - 2);
  let i = -1;
  let d = null; // il duello in corso
  let t = 0;
  let tInvio = 0;
  let finito = false;
  let banner = null; // { testo, sotto, colore, t }
  const vis = [0, 0]; // tifo mostrato sulla TV (ammorbidito)

  const lato = (id) => (id === d.a ? 0 : id === d.b ? 1 : null);
  const info = (id) => {
    const p = perId.get(id).p;
    return { id, nome: p.nome, colore: p.colore, av: p.av };
  };
  const gladiatore = (id) => ({ id, f: 0, z: 0.5, k: 0, stun: 0, ultimo: -9, colpi: 0, mancati: 0, prog: 0, tiro: null, pugno: 0 });
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------------------
  // Viste dei telefoni

  function vistaPer(q) {
    if (!d) return { fase: 'attesa' };
    const r = lato(q.id);
    const v = { fase: d.fase, i, tot: duelli.length, modo: d.modo, a: info(d.a), b: info(d.b), fineFase: d.fineFase, punti: q.punti, ruolo: r ?? 'pub' };
    if (r == null) v.scommessa = d.scommesse[q.id] ?? null;
    if (d.fase === 'duello') Object.assign(v, { t0: d.t0, f0: d.f0, seme: d.seme });
    if (d.fase === 'esito') {
      const e = d.esito;
      v.esito = { v: e.vincitore == null ? null : lato(e.vincitore), delta: e.punti[q.id] ?? 0, miracolo: e.miracolo, quota: e.quotaAlta };
    }
    return v;
  }
  const mandaViste = () => gioc.forEach((q) => ctx.vista(q.id, vistaPer(q)));
  const statoLive = () => ({
    i,
    h: d.hype.map(r2),
    tf: d.tifo,
    c: r2(d.corda),
    p: d.lati.map((g) => r2(g.prog)),
    s: d.lati.map((g) => g.tiro),
  });

  // ---------------------------------------------------------------------------
  // Fasi

  function nuovoDuello() {
    i++;
    const c = duelli[i];
    d = {
      ...c,
      fase: 'scommessa',
      tf: 0,
      fineFase: ctx.ora() + TEMPI.scommessa * 1000,
      seme: (Math.random() * 2 ** 31) >>> 0,
      f0: Math.random() * 2,
      t0: 0,
      scommesse: {},
      tifo: [0, 0],
      nuovi: [0, 0],
      rate: [0, 0],
      hype: [0, 0],
      lati: [gladiatore(c.a), gladiatore(c.b)],
      corda: 0, // Braccio di Ferro: -1 vince chi è a sinistra, +1 chi è a destra
      decisivo: null, // Taglio della Legna: chi ha finito per primo
      esito: null,
    };
    vis[0] = vis[1] = 0;
    for (const q of gioc) q.tifoLato = null;
    banner = null;
    sfx.whoosh();
    mandaViste();
  }

  function iniziaDuello() {
    d.fase = 'duello';
    d.tf = 0;
    d.t0 = ctx.ora();
    d.fineFase = d.t0 + MODI[d.modo].durata * 1000;
    for (const g of d.lati) {
      g.f = d.f0;
      g.z = prossimaZona(d.seme, 0, tri(d.f0));
    }
    tInvio = 0;
    sfx.via();
    fx.lampo('#fff', 0.15);
    mandaViste();
  }

  function risolvi() {
    const [ga, gb] = d.lati;
    let v = null;
    if (d.modo === 'colpo') {
      const da = ga.tiro == null ? Infinity : Math.abs(ga.tiro - 0.5);
      const db = gb.tiro == null ? Infinity : Math.abs(gb.tiro - 0.5);
      if (da < db) v = d.a;
      else if (db < da) v = d.b;
    } else if (d.modo === 'braccio') {
      if (d.corda < 0) v = d.a;
      else if (d.corda > 0) v = d.b;
      else if (ga.colpi !== gb.colpi) v = ga.colpi > gb.colpi ? d.a : d.b;
    } else if (d.decisivo) v = d.decisivo;
    else if (ga.prog !== gb.prog) v = ga.prog > gb.prog ? d.a : d.b;

    const res = puntiDuello({ a: d.a, b: d.b, vincitore: v, tifo: d.tifo, scommesse: d.scommesse });
    for (const [id, p] of Object.entries(res.punti)) perId.get(id).punti += p;
    d.esito = { vincitore: v, ...res };
    d.fase = 'esito';
    d.tf = 0;
    d.fineFase = ctx.ora() + TEMPI.esito * 1000;

    if (v) {
      const s = lato(v);
      const q = perId.get(v);
      q.vinti++;
      const x = s ? XB : XA;
      const xp = s ? XA : XB;
      fx.particelle(x, PIEDI - ALTO * 0.6, { n: 40, colori: ['#ffd23f', '#fff', q.p.colore], vel: 520, forma: 'stella', dim: 14 });
      fx.scuoti(14);
      fx.testo(x, PIEDI - ALTO - 50, `+${res.punti[v]}`, { colore: '#ffd23f', dim: 80, vita: 2 });
      fx.testo(xp, PIEDI - ALTO - 50, '−1', { colore: '#ff4d6d', dim: 64, vita: 2 });
      banner = { testo: `🏆 ${q.p.nome} vince!`, sotto: res.miracolo ? '✨ MIRACOLO! Ha vinto con meno tifo: +2' : '', colore: res.miracolo ? '#7cf3ff' : '#ffd23f', t: 0 };
      for (const q2 of gioc) {
        const p = res.punti[q2.id];
        if (lato(q2.id) == null && p > 0) fx.testo(q2.hx, q2.hy - 50, `+${p}`, { colore: '#4cd97b', dim: 40, vita: 1.6 });
      }
      res.miracolo ? sfx.fanfara() : sfx.ding();
    } else {
      banner = { testo: '🤝 Pareggio!', sotto: 'Nessuno vince: niente punti', colore: '#fff', t: 0 };
      sfx.fallimento();
    }
    mandaViste();
  }

  function termina() {
    finito = true;
    ctx.fine({
      punteggi: Object.fromEntries(gioc.map((q) => [q.id, q.punti])),
      fmt: (v, id) => {
        const n = perId.get(id).vinti;
        return `${v} punti · ${n} ${n === 1 ? 'vittoria' : 'vittorie'}`;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Azioni

  function scommetti(q, s) {
    d.scommesse[q.id] = s;
    q.bump = 1;
    sfx.pop();
    ctx.vista(q.id, vistaPer(q));
  }

  function tifa(q, n, s) {
    const side = d.scommesse[q.id] ?? (s === 0 || s === 1 ? s : null);
    n = Math.min(Math.floor(n), Math.floor(q.budget));
    if (side == null || !(n > 0)) return;
    q.budget -= n;
    d.tifo[side] += n;
    d.nuovi[side] += n;
    q.tifoLato = side;
    q.bump = 1;
    if (Math.random() < 0.6) {
      const c = perId.get(side ? d.b : d.a).p.colore;
      fx.particelle(q.hx, q.hy - 30, { n: 1, colori: [c, '#ffd23f'], vel: 260, velMin: 160, grav: 60, vita: 0.7, dim: 8, angolo: -Math.PI / 2, apertura: 0.5 });
    }
  }

  function colpo(g, s, q, z, x = tri(g.f)) {
    if (d.modo === 'colpo' || d.tf - g.ultimo < RAFFICA * 0.5) return;
    g.ultimo = d.tf;
    g.k++;
    g.colpi++;
    g.z = Number.isFinite(z) ? clamp(z, 0, 1) : prossimaZona(d.seme, g.k, x);
    g.pugno = 0.3;
    const h = d.hype[s];
    if (d.modo === 'braccio') {
      d.corda = clamp(d.corda + (s ? 1 : -1) * spinta(q, h), -1, 1);
      fx.particelle(960 + Math.sin(-d.corda * 1.15) * 170, 470 - Math.cos(d.corda * 1.15) * 170, { n: 8, colori: ['#fff', '#ffd23f'], vel: 300, dim: 7, vita: 0.4 });
    } else {
      g.prog = Math.min(1, g.prog + taglio(q, h));
      if (g.prog >= 1 && !d.decisivo) d.decisivo = g.id;
      fx.particelle(s ? 1110 : 810, 260 + g.prog * 300, { n: 10, colori: ['#e9b872', '#a0622d', '#fff3d6'], vel: 380, dim: 8, vita: 0.5 });
    }
    sfx.colpo(0.5 + 0.5 * q);
  }

  function mancato(g, s) {
    if (d.modo === 'colpo') return;
    g.stun = MANCATO;
    g.mancati++;
    fx.testo(BX + BW / 2, s ? 715 : 650, '✗ fuori!', { colore: '#ff4d6d', dim: 34, vita: 0.7 });
    sfx.tic();
  }

  function sparo(g, s, x) {
    if (d.modo !== 'colpo' || g.tiro != null || !Number.isFinite(x)) return;
    g.tiro = clamp(x, 0, 1);
    g.pugno = 0.4;
    const cx = (s ? 1110 : 810) + (g.tiro - 0.5) * 250;
    fx.particelle(cx, 400, { n: 18, colori: ['#fff5c0', '#ffd23f', '#1b1030'], vel: 320, dim: 9, vita: 0.5 });
    sfx.sparo();
  }

  // ---------------------------------------------------------------------------
  // CPU provvisorie (BOT DA CREARE / CALIBRARE): stesso cervello per le tre potenze.
  // Il gladiatore guarda il cursore e tocca quando pensa che passerà dalla zona, con un
  // errore di tempo umano (30–50 ms); il pubblico punta a caso e tappa a 4–7,5 colpi al secondo.

  const tempoVerso = (f, x, v) => ANTICIPO + faseVerso(f + ANTICIPO * v, x) / v;

  function botGladiatore(g, s) {
    const cpu = ctx.cpu(g.id);
    const m = cpu.mem;
    if (m.duello !== i) {
      m.duello = i;
      m.piano = null;
      m.pronto = cpu.num(0.3, 0.6);
      m.sigma = cpu.num(0.03, 0.05);
      m.attesa = cpu.num(1.5, 4); // Colpo Secco: aspetta un po' di tifo prima di sparare
    }
    if (g.stun > 0 || d.tf < m.pronto) return;
    const v = velocita(d.modo, d.hype[s]);
    if (d.modo === 'colpo') {
      if (g.tiro != null) return;
      if (m.piano == null) {
        if (d.tf < Math.min(m.attesa, MODI.colpo.durata - 1.2)) return;
        m.piano = d.tf + tempoVerso(g.f, 0.5, v) + cpu.errore(m.sigma);
      }
      if (d.tf >= m.piano) sparo(g, s, tri(g.f - v * (d.tf - m.piano)));
      return;
    }
    if (m.piano == null || m.k !== g.k) {
      m.k = g.k;
      m.piano = d.tf + tempoVerso(g.f, g.z, v) + cpu.errore(m.sigma) + (cpu.prob(0.05) ? cpu.num(0.3, 0.8) : 0);
    }
    if (d.tf >= m.piano) {
      const x = tri(g.f - v * (d.tf - m.piano));
      const q = qualita(x, g.z, larghezza(d.modo, d.hype[s]));
      if (q == null) mancato(g, s);
      else colpo(g, s, q, NaN, x);
      m.piano = null;
      m.pronto = d.tf + cpu.num(0.12, 0.28);
    }
  }

  function botPubblico(q, dt) {
    const cpu = ctx.cpu(q.id);
    const m = cpu.mem;
    if (m.duello !== i) {
      m.duello = i;
      m.tPunta = cpu.num(0.6, 3.2);
      m.via = cpu.num(0.2, 0.7);
      m.ritmo = cpu.num(4, 7.5);
      m.acc = 0;
    }
    if (d.fase === 'scommessa') {
      if (d.scommesse[q.id] == null && d.tf >= m.tPunta) scommetti(q, cpu.prob(0.5) ? 0 : 1);
    } else if (d.fase === 'duello' && d.tf >= m.via) {
      m.acc += m.ritmo * dt * cpu.num(0.6, 1.4);
      if (m.acc >= 1) {
        const n = Math.floor(m.acc);
        m.acc -= n;
        tifa(q, n);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Disegno

  const fondo = (() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const cielo = g.createLinearGradient(0, 0, 0, H);
    cielo.addColorStop(0, '#0d0509');
    cielo.addColorStop(0.55, '#2a0a1c');
    cielo.addColorStop(1, '#12060d');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, H);
    // rete metallica sul fondo
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 2;
    for (let x = -H; x < W + H; x += 46) {
      g.beginPath();
      g.moveTo(x, 130);
      g.lineTo(x + 520, 650);
      g.moveTo(x + 520, 130);
      g.lineTo(x, 650);
      g.stroke();
    }
    // folla in ombra
    for (let fila = 0; fila < 2; fila++) {
      for (let x = -20; x < W + 40; x += 54) {
        const y = 600 + fila * 50 + ((x * 7) % 23);
        g.fillStyle = fila ? '#1c0a14' : '#160811';
        g.beginPath();
        g.arc(x + fila * 27, y, 22, 0, TAU);
        g.fill();
        g.beginPath();
        g.roundRect(x + fila * 27 - 34, y + 16, 68, 80, 26);
        g.fill();
      }
    }
    // pavimento e ring
    g.fillStyle = '#24121b';
    g.fillRect(0, 700, W, H - 700);
    g.beginPath();
    g.ellipse(W / 2, 800, 900, 120, 0, 0, TAU);
    g.fillStyle = '#331822';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#8b1e3f';
    g.stroke();
    // lampadine appese
    for (const x of [420, 960, 1500]) {
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 120);
      g.stroke();
      const l = g.createRadialGradient(x, 132, 4, x, 132, 120);
      l.addColorStop(0, 'rgba(255,220,150,0.5)');
      l.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = l;
      g.fillRect(x - 120, 12, 240, 240);
      g.fillStyle = '#ffe9b0';
      g.beginPath();
      g.arc(x, 132, 12, 0, TAU);
      g.fill();
    }
    return c;
  })();

  function faro(g, x, y, r, a) {
    const l = g.createRadialGradient(x, y, 10, x, y, r);
    l.addColorStop(0, `rgba(255,236,200,${a})`);
    l.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = l;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function disegnaGladiatore(g, s) {
    const gl = d.lati[s];
    const q = perId.get(gl.id);
    const entra = d.fase === 'scommessa' ? ease.outBack(clamp(d.tf / 0.6, 0, 1)) : 1;
    const x = (s ? XB : XA) + (1 - entra) * (s ? 520 : -520);
    let pose = 'idle';
    let espr = d.fase === 'duello' ? 'arrabbiato' : null;
    if (d.fase === 'esito' && d.esito.vincitore) {
      const vince = d.esito.vincitore === gl.id;
      pose = vince ? 'cheer' : 'sad';
      espr = vince ? 'felice' : 'triste';
    } else if (gl.pugno > 0) pose = 'pugno';
    else if (gl.stun > 0) {
      pose = 'hit';
      espr = 'stordito';
    }
    faro(g, x, PIEDI - ALTO * 0.45, 330, d.fase === 'esito' && d.esito.vincitore === gl.id ? 0.35 : 0.18);
    g.save();
    g.translate(x, 0);
    if (s) g.scale(-1, 1);
    ctx.avatar(g, q.av, 0, PIEDI, ALTO, { pose, t, espr, dir: 1 });
    g.restore();
    ctx.etichetta(g, q.p.nome, x, PIEDI + 36, q.p.colore, { dim: 32, maxW: 320 });
  }

  function barraTifo(g, s) {
    const x = s ? 1385 : 495;
    const y0 = 230;
    const hh = 440;
    const w = 46;
    const k = vis[s];
    ctx.pannello(g, x - 10, y0 - 10, w + 20, hh + 20, { r: 22 });
    if (k > 0.01) {
      const grd = g.createLinearGradient(0, y0 + hh, 0, y0);
      grd.addColorStop(0, '#ffd23f');
      grd.addColorStop(1, '#ff3b5c');
      g.beginPath();
      g.roundRect(x, y0 + hh * (1 - k), w, hh * k, 14);
      g.fillStyle = grd;
      g.fill();
    }
    ctx.testo(g, '🔥', x + w / 2, y0 - 42, { dim: 40 + 30 * k, bordo: 0 });
    ctx.testo(g, 'TIFO', x + w / 2, y0 + hh + 34, { dim: 24 });
    if (d.fase !== 'scommessa') ctx.testo(g, d.tifo[s], x + w / 2, y0 + hh + 64, { dim: 26, colore: '#ffd23f' });
  }

  function barraCursore(g, s, y) {
    const gl = d.lati[s];
    const q = perId.get(gl.id);
    const hh = 40;
    ctx.pannello(g, BX - 72, y - hh / 2 - 9, BW + 92, hh + 18, { r: 24 });
    ctx.testa(g, q.av, BX - 38, y, 22);
    g.beginPath();
    g.roundRect(BX, y - hh / 2, BW, hh, 12);
    g.fillStyle = '#2a1830';
    g.fill();
    if (d.modo === 'colpo') {
      for (const [k, c] of [
        [0.5, '#5b2a43'],
        [0.3, '#8b1e3f'],
        [0.14, '#e11d48'],
        [0.04, '#ffd23f'],
      ]) {
        g.fillStyle = c;
        g.fillRect(BX + BW * (0.5 - k / 2), y - hh / 2, BW * k, hh);
      }
    } else if (d.fase === 'duello') {
      const w = larghezza(d.modo, d.hype[s]);
      g.fillStyle = '#4cd97b';
      g.fillRect(BX + BW * clamp(gl.z - w, 0, 1), y - hh / 2, BW * (clamp(gl.z + w, 0, 1) - clamp(gl.z - w, 0, 1)), hh);
      g.fillStyle = '#c8ffd9';
      g.fillRect(BX + BW * gl.z - 2, y - hh / 2, 4, hh);
    }
    if (d.fase === 'scommessa') {
      ctx.testo(g, 'PREPARATI…', BX + BW / 2, y, { dim: 26, colore: '#ffd23f' });
      return;
    }
    if (d.fase !== 'duello' && gl.tiro == null) return;
    const xc = gl.tiro ?? tri(gl.f);
    const cx = BX + xc * BW;
    g.beginPath();
    g.roundRect(cx - 6, y - hh / 2 - 10, 12, hh + 20, 6);
    g.fillStyle = gl.tiro != null ? '#ffd23f' : '#fff';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#1b1030';
    g.stroke();
    if (gl.stun > 0) {
      g.fillStyle = 'rgba(20,10,30,0.6)';
      g.fillRect(BX, y - hh / 2, BW, hh);
      ctx.testo(g, '✗ bloccato', BX + BW / 2, y, { dim: 26, colore: '#ff4d6d' });
    }
  }

  function scenaColpo(g) {
    for (const s of [0, 1]) {
      const gl = d.lati[s];
      const cx = s ? 1110 : 810;
      const cy = 400;
      const r = 125;
      const anelli = ['#f8fafc', '#e11d48', '#f8fafc', '#e11d48', '#ffd23f'];
      anelli.forEach((c, k) => {
        g.beginPath();
        g.arc(cx, cy, r * (1 - k * 0.19), 0, TAU);
        g.fillStyle = c;
        g.fill();
      });
      g.lineWidth = 6;
      g.strokeStyle = '#1b1030';
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.stroke();
      const colore = perId.get(gl.id).p.colore;
      if (gl.tiro != null) {
        const hx = cx + (gl.tiro - 0.5) * 2 * r;
        g.beginPath();
        g.arc(hx, cy, 13, 0, TAU);
        g.fillStyle = '#1b1030';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = colore;
        g.stroke();
        ctx.testo(g, `${precisione(gl.tiro)}%`, cx, cy + r + 40, { dim: 40, colore: '#ffd23f' });
      } else if (d.fase === 'duello') {
        const hx = cx + (tri(gl.f) - 0.5) * 2 * r;
        g.lineWidth = 5;
        g.strokeStyle = colore;
        g.beginPath();
        g.arc(hx, cy, 26, 0, TAU);
        g.moveTo(hx - 40, cy);
        g.lineTo(hx + 40, cy);
        g.moveTo(hx, cy - 40);
        g.lineTo(hx, cy + 40);
        g.stroke();
        ctx.testo(g, '…', cx, cy + r + 40, { dim: 40 });
      }
    }
  }

  function scenaBraccio(g) {
    const cy = 470;
    const th = -d.corda * 1.15; // chi vince spinge le mani verso il lato dell'altro
    const mx = 960 + Math.sin(th) * 170;
    const my = cy - Math.cos(th) * 170;
    g.fillStyle = '#4a2a10';
    g.fillRect(760, cy + 40, 26, 44);
    g.fillRect(1134, cy + 40, 26, 44);
    g.beginPath();
    g.roundRect(700, cy, 520, 44, 12);
    g.fillStyle = '#8a5428';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#1b1030';
    g.stroke();
    for (const s of [0, 1]) {
      const ex = s ? 1060 : 860;
      g.lineCap = 'round';
      g.lineWidth = 60;
      g.strokeStyle = '#1b1030';
      g.beginPath();
      g.moveTo(ex, cy);
      g.lineTo(mx, my);
      g.stroke();
      g.lineWidth = 50;
      g.strokeStyle = perId.get(d.lati[s].id).p.colore;
      g.stroke();
    }
    g.beginPath();
    g.arc(mx, my, 40, 0, TAU);
    g.fillStyle = '#f8cfa6';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#1b1030';
    g.stroke();
    // segnapunti della forza
    const y = 590;
    g.beginPath();
    g.roundRect(720, y - 12, 480, 24, 12);
    g.fillStyle = '#2a1830';
    g.fill();
    const mk = 960 + d.corda * 240;
    g.fillStyle = d.corda <= 0 ? perId.get(d.a).p.colore : perId.get(d.b).p.colore;
    g.fillRect(Math.min(960, mk), y - 12, Math.abs(mk - 960), 24);
    g.fillStyle = '#fff';
    g.fillRect(958, y - 18, 4, 36);
  }

  function scenaLegna(g) {
    for (const s of [0, 1]) {
      const gl = d.lati[s];
      const cx = s ? 1110 : 810;
      const top = 260;
      const hh = 300;
      const w = 130;
      const p = gl.prog;
      const tronco = (dx, ang, x0, x1) => {
        g.save();
        g.translate(cx + dx, top + hh);
        g.rotate(ang);
        g.beginPath();
        g.roundRect(x0, -hh, x1 - x0, hh, 14);
        g.fillStyle = '#a0622d';
        g.fill();
        g.lineWidth = 6;
        g.strokeStyle = '#4a2a10';
        g.stroke();
        g.restore();
      };
      if (p >= 1) {
        tronco(-14, -0.22, -w / 2, 0);
        tronco(14, 0.22, 0, w / 2);
      } else {
        tronco(0, 0, -w / 2, w / 2);
        g.beginPath();
        g.ellipse(cx, top, w / 2, 16, 0, 0, TAU);
        g.fillStyle = '#e9b872';
        g.fill();
        g.stroke();
        if (p > 0) {
          const wn = 14 + 26 * p;
          g.beginPath();
          g.moveTo(cx - wn, top);
          g.lineTo(cx + wn, top);
          g.lineTo(cx, top + p * hh);
          g.closePath();
          g.fillStyle = '#2a1408';
          g.fill();
        }
      }
      g.save();
      g.translate(cx + 44, top - 30 + p * hh * 0.4);
      g.rotate(gl.pugno > 0 ? -0.9 * (gl.pugno / 0.3) + 0.3 : 0.3);
      ctx.testo(g, '🪓', 0, 0, { dim: 70, bordo: 0 });
      g.restore();
      ctx.testo(g, `${Math.round(p * 100)}%`, cx, top + hh + 40, { dim: 38, colore: p >= 1 ? '#4cd97b' : '#fff' });
    }
  }

  function tribuna(g) {
    for (const q of gioc) {
      if (lato(q.id) != null) continue;
      const puntato = d.scommesse[q.id];
      const vinto = d.fase === 'esito' && d.esito.vincitore != null && puntato === lato(d.esito.vincitore);
      g.globalAlpha = puntato == null ? 0.55 : d.fase === 'esito' && !vinto ? 0.5 : 1;
      if (vinto) {
        g.beginPath();
        g.arc(q.hx, q.hy, 31, 0, TAU);
        g.fillStyle = '#4cd97b';
        g.fill();
      }
      ctx.testa(g, q.av, q.hx, q.hy, 24 * (1 + q.bump * 0.25));
      g.globalAlpha = 1;
      if (puntato != null && d.fase === 'scommessa') ctx.testo(g, '💰', q.hx + 18, q.hy - 22, { dim: 22, bordo: 0 });
    }
    if (d.fase === 'scommessa') {
      const conta = [0, 1].map((s) => Object.values(d.scommesse).filter((x) => x === s).length);
      ctx.testo(g, `💰 ${conta[0]}`, XA + 300, TRIBUNA - 50, { dim: 30 });
      ctx.testo(g, `💰 ${conta[1]}`, XB - 300, TRIBUNA - 50, { dim: 30 });
    }
  }

  function aggiornaTeste(dt) {
    const k = 1 - Math.exp(-9 * dt);
    const gruppi = [[], [], []];
    for (const q of gioc) if (d && lato(q.id) == null) gruppi[d.scommesse[q.id] ?? q.tifoLato ?? 2].push(q);
    const centri = [XA, XB, W / 2];
    gruppi.forEach((arr, s) => {
      const passo = Math.min(58, (s === 2 ? 360 : 520) / Math.max(1, arr.length));
      arr.forEach((q, j) => {
        q.hx = lerp(q.hx, centri[s] + (j - (arr.length - 1) / 2) * passo, k);
        q.hy = lerp(q.hy, TRIBUNA + (arr.length > 9 && j % 2 ? 14 : 0), k);
      });
    });
  }

  function classifica(g) {
    const ord = [...gioc].sort((a, b) => b.punti - a.punti);
    const n = ord.length;
    const passo = Math.min(112, 1700 / n);
    const x0 = W / 2 - ((n - 1) * passo) / 2;
    ctx.pannello(g, x0 - passo / 2 - 10, 966, n * passo + 20, 104, { r: 26, colore: 'rgba(15,6,20,0.8)' });
    ord.forEach((q, j) => {
      const x = x0 + j * passo;
      const inDuello = d && lato(q.id) != null;
      if (inDuello) {
        g.beginPath();
        g.arc(x, 1000, 27, 0, TAU);
        g.fillStyle = '#e11d48';
        g.fill();
      }
      ctx.testa(g, q.av, x, 1000, 22);
      ctx.testo(g, q.punti, x, 1046, { dim: 26, colore: j === 0 && q.punti > 0 ? '#ffd23f' : '#fff' });
    });
  }

  function testata(g) {
    const M = MODI[d.modo];
    ctx.pannello(g, W / 2 - 340, 16, 680, 66, { r: 33 });
    ctx.testo(g, `Duello ${i + 1} di ${duelli.length} · ${M.emoji} ${M.nome}`, W / 2, 50, { dim: 34, maxW: 640 });
    const tot = d.fase === 'scommessa' ? TEMPI.scommessa : d.fase === 'duello' ? M.durata : TEMPI.esito;
    if (d.fase !== 'esito') ctx.barraTempo(g, tot - d.tf, tot, { y: 100, w: 480 });
  }

  function scritte(g) {
    const M = MODI[d.modo];
    if (d.fase === 'scommessa') {
      g.fillStyle = 'rgba(10,4,12,0.62)';
      g.beginPath();
      g.roundRect(610, 160, 700, 470, 30);
      g.fill();
      ctx.testo(g, `${perId.get(d.a).p.nome}  VS  ${perId.get(d.b).p.nome}`, W / 2, 220, { dim: 44, maxW: 660 });
      const k = 1 + 0.06 * Math.sin(t * 9);
      ctx.testo(g, '💰 PUNTATE! 💰', W / 2, 330, { dim: 84 * k, colore: '#ffd23f' });
      ctx.testo(g, 'Chi vince? Scegli sul telefono', W / 2, 410, { dim: 32 });
      ctx.testo(g, `${M.emoji} ${M.nome}`, W / 2, 500, { dim: 40, colore: '#ff8fab' });
      const [r1, r2] = M.regola.split(': ');
      ctx.testo(g, r2 ? `${r1}:` : r1, W / 2, 552, { dim: 24, maxW: 660 });
      if (r2) ctx.testo(g, r2, W / 2, 588, { dim: 22, maxW: 670 });
    } else if (d.fase === 'duello' && d.tf < 0.9) {
      const k = ease.outBack(clamp(d.tf / 0.3, 0, 1));
      g.save();
      g.globalAlpha = clamp((0.9 - d.tf) / 0.3, 0, 1);
      g.translate(W / 2, 400);
      g.scale(k, k);
      ctx.testo(g, 'COMBATTETE!', 0, 0, { dim: 130, colore: '#ff3b5c', bordo: 16 });
      g.restore();
    } else if (d.fase === 'esito' && banner) {
      const k = ease.outBack(clamp(banner.t / 0.35, 0, 1));
      g.save();
      g.translate(W / 2, 230);
      g.scale(k, k);
      g.fillStyle = 'rgba(10,4,12,0.7)';
      g.beginPath();
      g.roundRect(-600, -62, 1200, banner.sotto ? 190 : 124, 40);
      g.fill();
      ctx.testo(g, banner.testo, 0, 0, { dim: 72, colore: banner.colore, bordo: 12, maxW: 1100 });
      if (banner.sotto) ctx.testo(g, banner.sotto, 0, 78, { dim: 38, colore: '#fff', maxW: 1100 });
      g.restore();
    }
  }

  // il primo duello parte al VIA; prima i telefoni aspettano
  mandaViste();

  return {
    inizia() {
      nuovoDuello();
    },

    aggiorna(dt) {
      t += dt;
      if (banner) banner.t += dt;
      for (const q of gioc) {
        q.bump = Math.max(0, q.bump - dt * 4);
        q.budget = Math.min(MAX_TIFO, q.budget + MAX_TIFO * dt);
      }
      if (!d) return;
      aggiornaTeste(dt);
      for (const s of [0, 1]) vis[s] = lerp(vis[s], d.fase === 'esito' ? vis[s] : d.hype[s], 1 - Math.exp(-8 * dt));
      if (finito) return;
      d.tf += dt;
      for (const g of d.lati) {
        g.pugno = Math.max(0, g.pugno - dt);
        g.stun = Math.max(0, g.stun - dt);
      }
      if (d.fase === 'scommessa') {
        if (d.tf >= TEMPI.scommessa) iniziaDuello();
      } else if (d.fase === 'duello') {
        for (const s of [0, 1]) {
          d.rate[s] += (d.nuovi[s] - d.rate[s] * dt) / TIFO.tau;
          d.nuovi[s] = 0;
          d.hype[s] = clamp(d.rate[s] / cap, 0, 1);
          const g = d.lati[s];
          g.f += velocita(d.modo, d.hype[s]) * dt;
          // telefono spento: una CPU combatte al suo posto
          if (!perId.get(g.id).p.bot && !ctx.connesso(g.id)) botGladiatore(g, s);
        }
        tInvio -= dt;
        if (tInvio <= 0) {
          tInvio = 0.15;
          ctx.invia('*', statoLive());
        }
        const deciso = d.modo === 'colpo' ? d.lati.every((g) => g.tiro != null) : d.modo === 'braccio' ? Math.abs(d.corda) >= 1 : !!d.decisivo;
        if (deciso || d.tf >= MODI[d.modo].durata) risolvi();
      } else if (d.fase === 'esito' && d.tf >= TEMPI.esito) {
        if (i + 1 < duelli.length) nuovoDuello();
        else termina();
      }
    },

    disegna(g) {
      g.drawImage(fondo, 0, 0);
      if (!d) {
        ctx.testo(g, '🥊 FIGHT CLUB', W / 2, H / 2 - 60, { dim: 140, colore: '#ff3b5c', bordo: 16 });
        return;
      }
      faro(g, W / 2, 420, 420, 0.12);
      if (d.modo === 'colpo') scenaColpo(g);
      else if (d.modo === 'braccio') scenaBraccio(g);
      else scenaLegna(g);
      barraCursore(g, 0, 650);
      barraCursore(g, 1, 715);
      barraTifo(g, 0);
      barraTifo(g, 1);
      disegnaGladiatore(g, 0);
      disegnaGladiatore(g, 1);
      tribuna(g);
      classifica(g);
      testata(g);
      scritte(g);
    },

    input(id, m) {
      const q = perId.get(id);
      if (!q || !m || !d || finito) return;
      const s = lato(id);
      if (s == null) {
        if (m.k === 'p' && d.fase === 'scommessa' && (m.s === 0 || m.s === 1)) scommetti(q, m.s);
        else if (m.k === 't' && d.fase === 'duello') tifa(q, Number(m.n) || 0, m.s);
        return;
      }
      if (d.fase !== 'duello') return;
      const g = d.lati[s];
      // il telefono è l'arbitro: la TV si rimette dove dice lui
      const f = Number(m.f);
      const tm = Number(m.t);
      if (Number.isFinite(f) && Number.isFinite(tm)) g.f = f + velocita(d.modo, d.hype[s]) * clamp((ctx.ora() - tm) / 1000, 0, 0.4);
      if (m.k === 'c') colpo(g, s, clamp(Number(m.q) || 0, 0, 1), Number(m.z));
      else if (m.k === 'm') mancato(g, s);
      else if (m.k === 's') sparo(g, s, Number(m.x));
    },

    bot(id, dt) {
      if (!d || finito) return;
      const s = lato(id);
      if (s == null) botPubblico(perId.get(id), dt);
      else if (d.fase === 'duello') botGladiatore(d.lati[s], s);
    },

    rientrato(id) {
      const q = perId.get(id);
      if (q) ctx.vista(id, vistaPer(q));
    },
  };
}
