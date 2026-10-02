// Abduction: un campo di notte visto dall'alto, pieno di mucche tutte uguali. Le mucche
// dei giocatori sono identiche alle altre: solo il radar del telefono (per 3 secondi)
// dice qual è la tua. Si bruca per fare punti; sotto il raggio del disco volante chi si
// muove o bruca viene rapito e perde tutto. Con una testata si spingono gli altri sotto.
// La simulazione è in mondo.js, le regole in regole.js, i bot (provvisori) in mente.js.

import { TAU, clamp, ease, seeded } from '../../shared/util.js';
import { DURATA, T_RADAR, T_BRUCA, CD_SPINTA, T_RAPIMENTO, CAMPO, ALTEZZA_DISCO, PUNTI, valoreBrucata } from './regole.js';
import { creaMondo } from './mondo.js';
import { creaMente } from './mente.js';

const T_SVELA = 4.5; // "Ecco chi eravate!"
const T_FEED = 3.8;

export default {
  id: 'abduction',
  nome: 'Abduction',
  emoji: '🛸',
  colore: '#22c55e',
  descrizione: 'Sei una mucca identica a tutte le altre: bruca per fare punti, resta immobile quando passa il disco volante… e spingi gli altri sotto il raggio!',
  comeSiGioca: [
    '📡 Il radar del telefono ti mostra la tua mucca solo per 3 secondi: poi devi ricordartela!',
    `🌿 Tieni premuto BRUCA per 3 s: +${PUNTI.bruca} (negli ultimi 15 s +${PUNTI.furia}). Se molli prima, niente`,
    '🛸 Sotto il raggio stai IMMOBILE: se ti muovi o bruchi vieni rapito e perdi TUTTI i punti',
    '💥 SPINGI la mucca davanti a te sotto il raggio: se è un giocatore gli rubi metà dei punti',
  ],
  controllo: 'mandria',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const ids = ctx.giocatori.map((p) => p.id);
  const perId = new Map(ctx.giocatori.map((p) => [p.id, p]));
  const nome = (id) => (perId.get(id) || {}).nome || '?';
  const mondo = creaMondo({ ids });
  const menti = new Map();

  let fase = 'attesa'; // attesa (3, 2, 1) → gioco → svela
  let tf = 0;
  let t = 0;
  let tStream = 0;
  let feed = [];
  let banner = null;
  let finito = false;
  const pop = new Map(); // id -> { testo, colore, t } (+10, −80… accanto al nome in classifica)
  const righeY = new Map(); // posizione animata delle righe della classifica
  const sfondo = disegnaSfondo();

  // ---------------------------------------------------------------------------
  // Telefoni

  const r1 = (v) => Math.round(v * 10) / 10;
  const dischiTel = () => mondo.dischi.map((d) => [Math.round(d.x), Math.round(d.y), d.r]);

  function classifica() {
    return ids.map((id) => ({ id, punti: mondo.giocatori.get(id).punti })).sort((a, b) => b.punti - a.punti);
  }

  function vistaPer(id) {
    const g = mondo.giocatori.get(id);
    const v = {
      fase: fase === 'attesa' ? 'pronti' : fase,
      punti: g.punti,
      pos: g.ent ? [Math.round(g.ent.x), Math.round(g.ent.y)] : null,
      dischi: dischiTel(),
      radar: fase === 'attesa' ? T_RADAR : r1(g.radar),
      fuori: r1(g.fuori),
      resta: r1(mondo.resta()),
      cd: CD_SPINTA,
      tb: T_BRUCA,
      valore: valoreBrucata(mondo.t),
    };
    if (fase === 'svela') {
      const pos = 1 + ids.filter((x) => mondo.giocatori.get(x).punti > g.punti).length;
      v.ris = { pos, totale: n, brucate: g.brucate, rapito: g.rapito, prese: g.prese, rubati: g.rubati, persi: g.persi };
    }
    return v;
  }

  function vistaTutti() {
    for (const p of ctx.giocatori) ctx.vista(p.id, vistaPer(p.id));
  }

  function stream() {
    const resta = r1(mondo.resta());
    let u = null;
    for (const p of ctx.giocatori) {
      if (p.bot) continue;
      const g = mondo.giocatori.get(p.id);
      const d = { s: resta, pt: g.punti, br: g.bruca ? Math.round((g.prog / T_BRUCA) * 100) / 100 : 0, cd: r1(g.cd), f: r1(g.fuori) };
      if (g.radar > 0 && g.ent) {
        d.r = [Math.round(g.ent.x), Math.round(g.ent.y), r1(g.radar)];
        d.u = u || (u = dischiTel());
      }
      ctx.invia(p.id, d);
    }
  }

  // ---------------------------------------------------------------------------
  // Bot (e pilota automatico per chi ha il telefono spento)

  function menteDi(id) {
    if (!menti.has(id)) menti.set(id, creaMente(perId.get(id).bot ? ctx.cpu(id) : null));
    return menti.get(id);
  }

  function guida(id, dt) {
    const g = mondo.giocatori.get(id);
    const o = menteDi(id).decidi(mondo, g, dt);
    mondo.input(id, { j: o.j, b: o.b });
    if (o.s) mondo.input(id, { s: 1 });
  }

  // ---------------------------------------------------------------------------
  // Eventi della simulazione

  function aggiungiFeed(testo, colore = '#fff') {
    feed.push({ testo, colore, t });
    if (feed.length > 3) feed.shift();
  }

  const umano = (id) => perId.has(id) && !perId.get(id).bot;

  function gestisci(ev) {
    for (const [id, m] of menti) m.osserva(ev, id);
    switch (ev.tipo) {
      case 'brucata':
        // niente effetti sul campo (ti scoprirebbero): solo il +10 in classifica
        pop.set(ev.id, { testo: `+${ev.v}`, colore: '#4cd97b', t });
        if (umano(ev.id)) ctx.invia(ev.id, { ev: 'brucata', v: ev.v, pt: mondo.giocatori.get(ev.id).punti });
        break;
      case 'rapito': {
        sfx.zap();
        fx.scuoti(5);
        fx.particelle(ev.x, ev.y - 10, { n: 22, colori: ['#b9ffcf', '#4cd97b', '#ffffff'], vel: 260, grav: -220, vita: 0.9, forma: 'stella', dim: 10 });
        const ruba = ev.rubati ? ` · ${nome(ev.da)} ne ruba ${ev.rubati}!` : '';
        aggiungiFeed(`🛸 ${nome(ev.id)} è stato rapito! −${ev.persi}${ruba}`, '#c8ffd9');
        if (ev.persi) pop.set(ev.id, { testo: `−${ev.persi}`, colore: '#ff4d6d', t });
        if (ev.rubati) pop.set(ev.da, { testo: `+${ev.rubati}`, colore: '#ffd23f', t });
        if (umano(ev.id)) {
          ctx.invia(ev.id, { ev: 'rapito', persi: ev.persi, da: ev.da ? nome(ev.da) : null });
          ctx.vista(ev.id, vistaPer(ev.id));
        }
        if (ev.da && umano(ev.da)) ctx.invia(ev.da, { ev: 'presa', chi: nome(ev.id), rubati: ev.rubati, pt: mondo.giocatori.get(ev.da).punti });
        break;
      }
      case 'rapita':
        sfx.zap();
        fx.particelle(ev.x, ev.y - 10, { n: 14, colori: ['#b9ffcf', '#ffffff'], vel: 200, grav: -200, vita: 0.8 });
        aggiungiFeed('🛸 Il disco si è preso una mucca vera', '#e2e8f0');
        if (ev.da && umano(ev.da)) ctx.invia(ev.da, { ev: 'mucca' });
        break;
      case 'rientro':
        if (umano(ev.id)) {
          ctx.vista(ev.id, vistaPer(ev.id));
          ctx.invia(ev.id, { ev: 'rientro' });
        }
        break;
      case 'interrotta':
        if (umano(ev.id)) ctx.invia(ev.id, { ev: 'interrotta' });
        break;
      case 'furia':
        sfx.rullo(1);
        fx.lampo('#7dffb0', 0.25);
        banner = { testo: `🛸 Il disco si arrabbia! Va più veloce, ma ogni brucata vale +${PUNTI.furia}`, colore: '#b9ffcf', t, dur: 3.4 };
        ctx.invia('*', { ev: 'furia', valore: PUNTI.furia });
        break;
      case 'fine':
        vaiA('svela');
        break;
    }
  }

  function vaiA(f) {
    fase = f;
    tf = 0;
    if (f === 'gioco') sfx.via();
    if (f === 'svela') sfx.fanfara();
    vistaTutti();
  }

  function termina() {
    if (finito) return;
    finito = true;
    const punteggi = {};
    const dettagli = {};
    for (const [id, g] of mondo.giocatori) {
      punteggi[id] = g.punti;
      dettagli[id] = `${g.punti} punti · 🌿 ${g.brucate} · 🛸 ${g.rapito}${g.prese ? ` · 💥 ${g.prese}` : ''}`;
    }
    ctx.fine({ punteggi, alto: true, dettagli });
  }

  // ---------------------------------------------------------------------------
  // Disegno

  function disegnaSfondo() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const cielo = g.createLinearGradient(0, 0, 0, H);
    cielo.addColorStop(0, '#060a20');
    cielo.addColorStop(1, '#121b42');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, H);
    const r = seeded(31);
    for (let k = 0; k < 160; k++) {
      g.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.8)})`;
      const s = r.range(1, 2.6);
      g.fillRect(r.range(0, W), r.range(0, H), s, s);
    }
    const { x0, y0, x1, y1 } = CAMPO;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const erba = g.createRadialGradient(cx, cy, 80, cx, cy, 980);
    erba.addColorStop(0, '#4b8b3b');
    erba.addColorStop(1, '#2c5a29');
    g.fillStyle = erba;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // ciuffi d'erba
    g.lineCap = 'round';
    for (let k = 0; k < 1100; k++) {
      const x = r.range(x0 + 6, x1 - 6);
      const y = r.range(y0 + 6, y1 - 6);
      g.strokeStyle = r.next() < 0.5 ? 'rgba(110,170,80,0.45)' : 'rgba(25,60,25,0.4)';
      g.lineWidth = 2;
      for (let s = -1; s <= 1; s++) {
        g.beginPath();
        g.moveTo(x + s * 3, y);
        g.lineTo(x + s * 5, y - 7 - Math.abs(s) * -2);
        g.stroke();
      }
    }
    // macchie d'erba più scura e fiorellini
    for (let k = 0; k < 26; k++) {
      g.beginPath();
      g.ellipse(r.range(x0 + 60, x1 - 60), r.range(y0 + 60, y1 - 60), r.range(40, 110), r.range(25, 60), r.range(0, TAU), 0, TAU);
      g.fillStyle = 'rgba(20,55,25,0.18)';
      g.fill();
    }
    for (let k = 0; k < 90; k++) {
      g.beginPath();
      g.arc(r.range(x0 + 8, x1 - 8), r.range(y0 + 8, y1 - 8), r.range(1.8, 3.2), 0, TAU);
      g.fillStyle = r.next() < 0.6 ? 'rgba(255,255,255,0.75)' : 'rgba(255,220,90,0.8)';
      g.fill();
    }
    // luce della luna sui bordi
    const vign = g.createRadialGradient(cx, cy, 300, cx, cy, 1000);
    vign.addColorStop(0, 'rgba(0,0,30,0)');
    vign.addColorStop(1, 'rgba(0,0,30,0.38)');
    g.fillStyle = vign;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // recinto
    g.strokeStyle = '#6b4a2e';
    g.lineWidth = 5;
    g.strokeRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
    g.strokeStyle = '#8a6240';
    g.lineWidth = 3;
    g.strokeRect(x0 - 13, y0 - 13, x1 - x0 + 26, y1 - y0 + 26);
    g.fillStyle = '#4a311d';
    for (let x = x0 - 10; x <= x1 + 10; x += 64) {
      g.fillRect(x - 4, y0 - 18, 8, 16);
      g.fillRect(x - 4, y1 + 2, 8, 16);
    }
    for (let y = y0 - 10; y <= y1 + 10; y += 64) {
      g.fillRect(x0 - 18, y - 4, 16, 8);
      g.fillRect(x1 + 2, y - 4, 16, 8);
    }
    return c;
  }

  function ellisse(g, x, y, rx, ry, rot = 0) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, TAU);
  }

  const BIANCO = '#f4f1ea';
  const NERO = '#2a2522';
  const MACCHIE = [
    [-13, -8, 9, 7, 0.4],
    [6, 8, 8, 6, -0.5],
    [-22, 10, 6, 5, 0],
    [15, -11, 6, 4.5, 0.6],
    [-2, -15, 5, 4, 0],
  ];

  // Una mucca vista dall'alto (tutte uguali). Guarda verso destra quando ang = 0.
  function mucca(g, m, x = m.x, y = m.y, s = 1, giro = 0, ombra = true) {
    const posa = m.posa;
    g.save();
    g.translate(x, y);
    if (ombra) {
      ellisse(g, 3, 7, 36 * s, 21 * s, m.ang);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fill();
    }
    g.rotate(m.ang + giro);
    g.scale(s, s);
    // zampe
    const cam = posa === 'cammina';
    g.fillStyle = '#3b302b';
    for (const [lx, ly, f] of [
      [16, -16, 0],
      [16, 16, Math.PI],
      [-17, -16, Math.PI],
      [-17, 16, 0],
    ]) {
      ellisse(g, lx + (cam ? Math.sin(m.passo + f) * 5 : 0), ly, 5, 3.6);
      g.fill();
    }
    // coda
    const sw = Math.sin(m.coda);
    g.strokeStyle = NERO;
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-29, 0);
    g.quadraticCurveTo(-37, sw * 6, -44, sw * 12);
    g.stroke();
    ellisse(g, -45, sw * 13, 3.6, 2.6);
    g.fillStyle = NERO;
    g.fill();
    // corpo con le macchie
    ellisse(g, 0, 0, 31, 19);
    g.fillStyle = BIANCO;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = NERO;
    for (const [mx, my, rx, ry, a] of MACCHIE) {
      ellisse(g, mx, my, rx, ry, a);
      g.fill();
    }
    g.restore();
    ellisse(g, 0, 0, 31, 19);
    g.lineWidth = 2.2;
    g.strokeStyle = NERO;
    g.stroke();
    // testa: bassa quando bruca, alta e con gli occhi sgranati sotto il raggio
    let hx = 33;
    let hs = 1;
    if (posa === 'pascola') {
      hx = 37 + Math.sin(m.mastica * 9) * 1.6;
      hs = 0.88;
    } else if (posa === 'gelo') {
      hx = 31;
      hs = 1.1;
    }
    g.translate(hx, 0);
    g.scale(hs, hs);
    for (const sy of [-1, 1]) {
      ellisse(g, -4, sy * 12, 4.2, 7.5, sy * 0.5);
      g.fillStyle = '#ead8c8';
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = NERO;
      g.stroke();
      g.beginPath();
      g.moveTo(1, sy * 7);
      g.quadraticCurveTo(-2, sy * 13, -6, sy * 14);
      g.strokeStyle = '#d9c7a0';
      g.lineWidth = 2.6;
      g.stroke();
    }
    ellisse(g, 2, 0, 12, 11);
    g.fillStyle = BIANCO;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = NERO;
    g.stroke();
    ellisse(g, -1, -5, 5, 4, 0.3);
    g.fillStyle = NERO;
    g.fill();
    ellisse(g, 11, 0, 6, 8);
    g.fillStyle = '#f0a5a5';
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = NERO;
    g.stroke();
    g.fillStyle = '#7a3a3a';
    ellisse(g, 13, -3, 1.4, 1.8);
    g.fill();
    ellisse(g, 13, 3, 1.4, 1.8);
    g.fill();
    if (posa === 'gelo') {
      for (const sy of [-1, 1]) {
        g.beginPath();
        g.arc(4, sy * 5, 3.6, 0, TAU);
        g.fillStyle = '#ffffff';
        g.fill();
        g.lineWidth = 1.2;
        g.strokeStyle = NERO;
        g.stroke();
        g.beginPath();
        g.arc(4.6, sy * 5, 1.6, 0, TAU);
        g.fillStyle = NERO;
        g.fill();
      }
    } else {
      g.fillStyle = NERO;
      for (const sy of [-1, 1]) {
        g.beginPath();
        g.arc(5, sy * 5, 1.5, 0, TAU);
        g.fill();
      }
    }
    if (posa === 'pascola') {
      g.strokeStyle = '#6fbf4a';
      g.lineWidth = 2;
      for (const sy of [-3, 0, 3]) {
        g.beginPath();
        g.moveTo(15, sy);
        g.lineTo(20 + Math.abs(sy), sy * 1.8);
        g.stroke();
      }
    }
    g.restore();
  }

  function raggioTerra(g, d) {
    const grd = g.createRadialGradient(d.x, d.y, d.r * 0.1, d.x, d.y, d.r);
    grd.addColorStop(0, 'rgba(170,255,190,0.28)');
    grd.addColorStop(0.8, 'rgba(120,255,170,0.2)');
    grd.addColorStop(1, 'rgba(120,255,170,0.36)');
    g.beginPath();
    g.arc(d.x, d.y, d.r, 0, TAU);
    g.fillStyle = grd;
    g.fill();
    g.save();
    g.setLineDash([18, 12]);
    g.lineDashOffset = -t * 60;
    g.strokeStyle = 'rgba(200,255,215,0.85)';
    g.lineWidth = 4;
    g.stroke();
    g.restore();
    const k = (t * 0.9) % 1;
    g.beginPath();
    g.arc(d.x, d.y, d.r * k, 0, TAU);
    g.strokeStyle = `rgba(200,255,215,${0.5 * (1 - k)})`;
    g.lineWidth = 3;
    g.stroke();
  }

  function raggioLuce(g, d) {
    const sy = d.y - ALTEZZA_DISCO;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const grd = g.createLinearGradient(0, sy, 0, d.y);
    grd.addColorStop(0, 'rgba(150,255,190,0.2)');
    grd.addColorStop(1, 'rgba(150,255,190,0.05)');
    g.beginPath();
    g.moveTo(d.x - 42, sy + 8);
    g.lineTo(d.x + 42, sy + 8);
    g.lineTo(d.x + d.r, d.y);
    g.arc(d.x, d.y, d.r, 0, Math.PI);
    g.closePath();
    g.fillStyle = grd;
    g.fill();
    g.beginPath();
    g.arc(d.x, d.y, d.r, 0, TAU);
    g.fillStyle = 'rgba(90,255,150,0.08)';
    g.fill();
    g.restore();
  }

  function disco(g, d, i) {
    const x = d.x;
    const y = d.y - ALTEZZA_DISCO + Math.sin(t * 2.2 + i) * 4;
    const arrabbiato = mondo.furia;
    const alone = g.createRadialGradient(x, y, 10, x, y, 110);
    alone.addColorStop(0, arrabbiato ? 'rgba(255,90,90,0.35)' : 'rgba(140,255,190,0.3)');
    alone.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = alone;
    g.fillRect(x - 110, y - 110, 220, 220);
    // cupola
    ellisse(g, x, y - 12, 30, 24);
    const vetro = g.createLinearGradient(x, y - 36, x, y);
    vetro.addColorStop(0, 'rgba(220,255,250,0.95)');
    vetro.addColorStop(1, 'rgba(70,170,200,0.9)');
    g.fillStyle = vetro;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#1d3b4a';
    g.stroke();
    // piatto
    ellisse(g, x, y + 4, 80, 25);
    const metallo = g.createLinearGradient(x, y - 20, x, y + 30);
    metallo.addColorStop(0, '#eef2f7');
    metallo.addColorStop(0.5, '#9aa6b8');
    metallo.addColorStop(1, '#4b5566');
    g.fillStyle = metallo;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2a3140';
    g.stroke();
    ellisse(g, x, y + 10, 40, 9);
    g.fillStyle = arrabbiato ? 'rgba(255,120,120,0.9)' : 'rgba(160,255,200,0.9)';
    g.fill();
    // luci che girano
    const veloce = d.fermo > 0 || d.sosta > 0 ? 3 : 1;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + t * veloce;
      const lx = x + Math.cos(a) * 64;
      const ly = y + 4 + Math.sin(a) * 18;
      if (Math.sin(a) < -0.2) continue; // dietro la cupola
      g.beginPath();
      g.arc(lx, ly, 5, 0, TAU);
      const acceso = (k + Math.floor(t * 6 * veloce)) % 3 === 0;
      g.fillStyle = arrabbiato ? (acceso ? '#ffefef' : '#ff4d6d') : acceso ? '#ffffff' : ['#ffd23f', '#4cd97b', '#4cc9f0'][k % 3];
      g.fill();
    }
  }

  function disegnaRapite(g) {
    for (const m of mondo.mucche) {
      if (!m.rapita || m.via) continue;
      const r = m.rapita;
      const k = clamp(r.t / T_RAPIMENTO, 0, 1);
      const e = ease.inOutQuad(k);
      const tx = r.disco.x;
      const ty = r.disco.y - ALTEZZA_DISCO + 6;
      const x = r.x0 + (tx - r.x0) * e + Math.sin(k * 20) * 6 * (1 - k);
      const y = r.y0 + (ty - r.y0) * e;
      g.save();
      g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      mucca(g, m, x, y, 1 - 0.7 * e, k * 9, false);
      g.restore();
    }
  }

  function disegnaMucche(g) {
    const vive = mondo.mucche.filter((m) => !m.via && !m.rapita).sort((a, b) => a.y - b.y);
    for (const m of vive) mucca(g, m);
  }

  function disegnaNomi(g) {
    const k = ease.outBack(clamp(tf / 0.5, 0, 1));
    for (const id of ids) {
      const gg = mondo.giocatori.get(id);
      if (!gg.ent) continue;
      const p = perId.get(id);
      const { x, y } = gg.ent;
      g.beginPath();
      g.arc(x, y, 40, 0, TAU);
      g.strokeStyle = p.colore;
      g.lineWidth = 5;
      g.stroke();
      ctx.testa(g, p.av, x, y - 62, 22 * k, { espr: 'felice', t });
      if (k > 0.5) ctx.etichetta(g, p.nome, x, y - 100, p.colore, { dim: 18, maxW: 170 });
    }
  }

  function disegnaClassifica(g) {
    const x = 1614;
    const w = 288;
    ctx.pannello(g, x, 18, w, 1040, { r: 26, colore: 'rgba(8,14,40,0.82)' });
    ctx.testo(g, '🏆 Punti', x + w / 2, 56, { dim: 32, colore: '#ffd23f' });
    const lista = classifica();
    const hR = Math.min(70, 960 / n);
    lista.forEach((r, k) => {
      const gg = mondo.giocatori.get(r.id);
      const p = perId.get(r.id);
      const y = righeY.get(r.id) ?? 104 + k * hR;
      const fuori = gg.fuori > 0;
      const pos = 1 + lista.filter((o) => o.punti > r.punti).length;
      g.save();
      if (fuori) g.globalAlpha = 0.5;
      g.beginPath();
      g.roundRect(x + 10, y - hR / 2 + 3, w - 20, hR - 6, 14);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fill();
      g.fillStyle = p.colore;
      g.fillRect(x + 10, y - hR / 2 + 8, 6, hR - 16);
      ctx.testo(g, `${pos}`, x + 34, y, { dim: Math.min(26, hR * 0.42), colore: '#c9d4ff' });
      ctx.testa(g, p.av, x + 70, y, hR * 0.3);
      ctx.testo(g, p.nome, x + 98, y, { dim: Math.min(24, hR * 0.38), allinea: 'left', maxW: 118 });
      ctx.testo(g, fuori ? '🛸' : `${r.punti}`, x + w - 22, y, { dim: Math.min(30, hR * 0.46), allinea: 'right', colore: '#4cd97b' });
      g.restore();
      const pp = pop.get(r.id);
      if (pp && t - pp.t < 1.4) {
        const e = t - pp.t;
        g.save();
        g.globalAlpha = clamp((1.4 - e) / 0.4, 0, 1);
        ctx.testo(g, pp.testo, x + w - 70, y - 6 - e * 14, { dim: Math.min(28, hR * 0.44), allinea: 'right', colore: pp.colore });
        g.restore();
      }
    });
  }

  function disegnaHud(g) {
    ctx.pannello(g, 24, 18, 290, 70, { r: 35 });
    ctx.testo(g, '🛸 Abduction', 169, 54, { dim: 34 });
    ctx.barraTempo(g, mondo.resta(), DURATA, { w: 720, x: 360, y: 40 });
    ctx.pannello(g, 1170, 18, 420, 70, { r: 35, colore: mondo.furia ? 'rgba(120,20,40,0.85)' : undefined });
    ctx.testo(g, mondo.furia ? `⚡ Brucata +${PUNTI.furia} · 🐄 ${mondo.vive().length}` : `🌿 Brucata +${PUNTI.bruca} · 🐄 ${mondo.vive().length}`, 1380, 54, { dim: 30, maxW: 390 });
    disegnaClassifica(g);
    const cx = (CAMPO.x0 + CAMPO.x1) / 2;
    let y = 140;
    for (const f of feed) {
      const eta = t - f.t;
      if (eta > T_FEED) continue;
      g.save();
      g.globalAlpha = clamp((T_FEED - eta) / 0.4, 0, 1) * clamp(eta / 0.15, 0, 1);
      ctx.pannello(g, cx - 430, y - 21, 860, 42, { r: 21, colore: 'rgba(8,14,40,0.85)' });
      ctx.testo(g, f.testo, cx, y, { dim: 24, colore: f.colore, maxW: 830 });
      g.restore();
      y += 48;
    }
    if (banner && t - banner.t < banner.dur) {
      const eta = t - banner.t;
      g.save();
      g.globalAlpha = clamp((banner.dur - eta) / 0.4, 0, 1);
      const s = ease.outBack(clamp(eta / 0.35, 0, 1));
      g.translate(cx, H / 2);
      g.scale(s, s);
      ctx.pannello(g, -640, -44, 1280, 88, { r: 44, colore: 'rgba(60,10,30,0.9)' });
      ctx.testo(g, banner.testo, 0, 0, { dim: 38, colore: banner.colore, maxW: 1240 });
      g.restore();
    }
  }

  // ---------------------------------------------------------------------------

  vistaTutti();

  return {
    inizia() {
      vaiA('gioco');
    },

    aggiorna(dt) {
      t += dt;
      tf += dt;
      // righe della classifica che scivolano al loro posto
      const hR = Math.min(70, 960 / n);
      classifica().forEach((r, k) => {
        const meta = 104 + k * hR;
        const y = righeY.get(r.id);
        righeY.set(r.id, y == null ? meta : y + (meta - y) * Math.min(1, dt * 10));
      });
      if (fase === 'gioco') {
        for (const p of ctx.giocatori) {
          if (p.bot || ctx.connesso(p.id)) continue;
          if (mondo.giocatori.get(p.id).ent) guida(p.id, dt);
        }
        mondo.passo(dt);
        const eventi = mondo.eventi;
        mondo.eventi = [];
        for (const ev of eventi) gestisci(ev);
        tStream -= dt;
        if (tStream <= 0 && fase === 'gioco') {
          tStream = 0.12;
          stream();
        }
      } else if (fase === 'svela') {
        mondo.passo(dt);
        mondo.eventi = [];
        if (tf >= T_SVELA) termina();
      }
    },

    disegna(g) {
      g.drawImage(sfondo, 0, 0);
      for (const d of mondo.dischi) raggioTerra(g, d);
      disegnaMucche(g);
      for (const d of mondo.dischi) raggioLuce(g, d);
      disegnaRapite(g);
      mondo.dischi.forEach((d, i) => disco(g, d, i));
      if (fase === 'svela' || finito) {
        disegnaNomi(g);
        ctx.pannello(g, (CAMPO.x0 + CAMPO.x1) / 2 - 420, H - 120, 840, 72, { r: 36, colore: 'rgba(8,14,40,0.9)' });
        ctx.testo(g, '🐄 Tempo scaduto: ecco chi eravate!', (CAMPO.x0 + CAMPO.x1) / 2, H - 84, { dim: 36, colore: '#ffd23f' });
      }
      disegnaHud(g);
      if (fase === 'attesa') {
        ctx.pannello(g, (CAMPO.x0 + CAMPO.x1) / 2 - 540, H - 130, 1080, 76, { r: 38, colore: 'rgba(8,14,40,0.92)' });
        ctx.testo(g, '📡 Guarda il radar sul telefono: trova la tua mucca!', (CAMPO.x0 + CAMPO.x1) / 2, H - 92, { dim: 36, maxW: 1040 });
      }
    },

    input(id, d) {
      if (fase !== 'gioco' || !d) return;
      const r = mondo.input(id, d);
      if (!r) return;
      if (r.esito === 'vuoto') ctx.invia(id, { ev: 'vuoto' });
      else if (r.esito === 'ok') ctx.invia(id, { ev: 'spinta', cd: CD_SPINTA });
    },

    bot(id, dt) {
      if (fase !== 'gioco') return;
      if (!mondo.giocatori.get(id).ent) return;
      guida(id, dt);
    },

    rientrato(id) {
      const g = mondo.giocatori.get(id);
      if (g) {
        g.j = [0, 0];
        g.bruca = false;
        g.prog = 0;
      }
      menti.delete(id);
      ctx.vista(id, vistaPer(id));
    },

    // Per le prove: il campo.
    mondo,
    fase: () => fase,
  };
}
