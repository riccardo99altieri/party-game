// Trova l'Intruso: tutti contro tutti, di nascosto. Ognuno è un personaggio identico in
// mezzo a decine di passanti uguali; solo il proprio telefono dice chi si è. Si cammina
// come i passanti (8 direzioni, stessa velocità) e si stendono gli altri giocatori con un
// pugno; un pugno a un passante invece ti fa scoprire. 3 round, punti sommati.
// La simulazione è in mondo.js, i passanti in folla.js, i bot in mente.js.

import { TAU, clamp, shade, ease } from '../../shared/util.js';
import {
  ROUND,
  DURATA,
  CD_PUGNO,
  T_PUGNO,
  T_ERRORE,
  T_ACQUA,
  MAPPA,
  FONTANA,
  GIOSTRA,
  BANCHI,
  VICOLO,
  PALCO,
  PUBBLICO,
  LAMPIONI,
  PUNTI,
  puntiRound,
} from './regole.js';
import { creaMondo } from './mondo.js';
import { creaMente, PROFILI } from './mente.js';

const T_SVELA = 3.5; // "Ecco chi eravate!"
const T_TABELLA = 5.5; // punti del round
const T_PRONTI = 3; // conto alla rovescia dei round dopo il primo
const S = 1.12; // grandezza dei personaggi
const T_FEED = 3.5;

export default {
  id: 'intruso',
  nome: "Trova l'Intruso",
  emoji: '🎭',
  colore: '#64748b',
  descrizione: 'Sei uno dei tanti passanti tutti uguali: nasconditi tra la folla e stendi gli altri giocatori, senza farti scoprire!',
  comeSiGioca: [
    "📱 Il pallino verde sul telefono sei tu: trovati sulla TV e cammina come i passanti (e non far vedere il telefono!)",
    '👊 PUGNO a chi ti sta accanto: se è un giocatore è fuori (+3), se è un passante ti scoprono tutti (−1)',
    "⏱ Mai fermo più di 3 s: i passanti si incuriosiscono. Da 60 s sale l'acqua: stai nel cerchio",
    '🏆 3 round · +1 ogni 10 s in vita · 🪙 +1 · vivo alla fine +2 · ultimo rimasto +5',
  ],
  controllo: 'stealth',
  durataMax: 330, // 3 round da 90 s più le pause tra un round e l'altro
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const ids = ctx.giocatori.map((p) => p.id);
  const perId = new Map(ctx.giocatori.map((p) => [p.id, p]));
  const nome = (id) => (perId.get(id) || {}).nome || '?';
  const mondo = creaMondo({ ids });
  const menti = new Map(); // id -> mente (bot o pilota automatico)

  let fase = 'attesa'; // attesa (3, 2, 1 del primo round) → gioco → svela → tabella → pronti → gioco …
  let tf = 0;
  let t = 0;
  let frame = 0;
  let tvFrame = -1;
  let tvCache = null;
  let tStream = 0;
  let feed = [];
  let banner = null;
  let chiusura = null; // il motivo della fine del round
  let classificaRound = [];
  let finito = false;
  const portati = new Map(); // indice -> quando l'acqua l'ha portato via (orologio dello schermo)
  const sfondo = disegnaSfondo();

  // ---------------------------------------------------------------------------
  // Telefoni

  const moneteTel = () => mondo.monete.map((m) => [Math.round(m.x), Math.round(m.y)]);
  const zonaTel = () => [Math.round(mondo.piano.cx), Math.round(mondo.piano.cy), Math.round(mondo.raggio()), Math.round(mondo.prossimo() || 0)];

  function vistaPer(id) {
    const g = mondo.giocatori.get(id);
    const e = g.ent;
    const v = {
      fase: fase === 'attesa' ? 'pronti' : fase,
      round: mondo.round + 1,
      rounds: ROUND,
      tot: g.tot,
      punti: fase === 'gioco' || fase === 'pronti' || fase === 'attesa' ? puntiRound(g.voci) : g.rounds[g.rounds.length - 1]?.punti ?? 0,
      vivo: e.vivo,
      x: Math.round(e.x),
      y: Math.round(e.y),
      cd: CD_PUGNO,
      monete: moneteTel(),
      zona: zonaTel(),
      resta: Math.max(0, DURATA - mondo.t),
    };
    if (g.morte) v.morte = { causa: g.morte.causa, da: g.morte.da ? nome(g.morte.da) : null };
    if (fase === 'svela' || fase === 'tabella') {
      const r = g.rounds[g.rounds.length - 1];
      const pos = 1 + classificaRound.filter((x) => x.tot > g.tot).length;
      v.ris = { ...r, pos, totale: n, motivo: chiusura };
    }
    return v;
  }

  function vistaTutti() {
    for (const p of ctx.giocatori) ctx.vista(p.id, vistaPer(p.id));
  }

  function stream() {
    const r = Math.round(mondo.raggio());
    const pr = Math.round(mondo.prossimo() || 0);
    const resta = Math.round(Math.max(0, DURATA - mondo.t) * 10) / 10;
    for (const p of ctx.giocatori) {
      if (p.bot) continue;
      const g = mondo.giocatori.get(p.id);
      const e = g.ent;
      if (!e.vivo) continue;
      ctx.invia(p.id, { p: [Math.round(e.x), Math.round(e.y)], z: [r, pr], s: resta, pt: puntiRound(g.voci), a: e.acqua > 0 ? Math.round((e.acqua / T_ACQUA) * 100) / 100 : 0 });
    }
  }

  // ---------------------------------------------------------------------------
  // Bot (e pilota automatico per chi ha il telefono spento)

  function tvOra() {
    if (tvFrame !== frame) {
      tvCache = mondo.tv();
      tvFrame = frame;
    }
    return tvCache;
  }

  function io(id) {
    const e = mondo.giocatori.get(id).ent;
    return { i: e.i, x: e.x, y: e.y, vivo: e.vivo, blocco: e.blocco, cd: e.cd, face: e.face };
  }

  function menteDi(id) {
    if (!menti.has(id)) {
      const p = perId.get(id);
      // (__traccia: solo il banco, per sapere perché i bot colpiscono)
      const traccia = ctx.__traccia ? (k, m) => ctx.__traccia(id, k, m) : null;
      if (p.bot) {
        const cpu = ctx.cpu(id);
        menti.set(id, creaMente(PROFILI[cpu.livello], { reazione: () => cpu.reazione(), tratti: cpu.tratti, traccia }));
      } else menti.set(id, creaMente(PROFILI[1], { traccia }));
    }
    return menti.get(id);
  }

  function guida(id, dt) {
    const out = menteDi(id).decidi(tvOra(), io(id), dt);
    mondo.input(id, { j: out.j, p: out.p ? 1 : 0 });
  }

  // ---------------------------------------------------------------------------
  // Eventi della simulazione: effetti, messaggi, telefoni

  function aggiungiFeed(testo, colore = '#fff') {
    feed.push({ testo, colore, t });
    if (feed.length > 3) feed.shift();
  }

  const ascoltatori = []; // (solo il banco)

  function gestisci(ev) {
    for (const [id, m] of menti) m.osserva(ev, io(id));
    for (const f of ascoltatori) f(ev);
    switch (ev.tipo) {
      case 'kill': {
        sfx.colpo(1);
        fx.scuoti(6);
        fx.particelle(ev.x, ev.y - 30, { n: 18, colori: ['#fff', '#ffd23f', '#ff4d6d'], vel: 320, grav: 300, vita: 0.5, forma: 'stella', dim: 12 });
        fx.testo(ev.x, ev.y - 70, ['POW!', 'BAM!', 'SBAM!', 'PAF!'][Math.floor(Math.random() * 4)], { colore: '#ffd23f', dim: 40, vita: 0.8 });
        aggiungiFeed(`💀 ${nome(ev.chi)} è stato eliminato`, '#ffd0d8');
        ctx.invia(ev.id, { ev: 'kill', chi: nome(ev.chi) });
        break;
      }
      case 'eliminato':
        if (ev.causa === 'acqua') {
          portati.set(ev.ent, t);
          sfx.splash();
          aggiungiFeed(`🌊 ${nome(ev.id)} è stato portato via dall'acqua`, '#bfe6ff');
          fx.particelle(ev.x, ev.y - 10, { n: 20, colori: ['#ffffff', '#7fd1ff', '#2b8fd6'], vel: 260, grav: 700, vita: 0.7 });
        }
        if (!perId.get(ev.id).bot) {
          ctx.invia(ev.id, { ev: 'morto', causa: ev.causa, da: ev.da ? nome(ev.da) : null });
          ctx.vista(ev.id, vistaPer(ev.id));
        }
        break;
      case 'errore':
        sfx.fallimento();
        aggiungiFeed(`❌ ${nome(ev.id)} ha colpito un passante!`, '#ff8fa3');
        fx.testo(ev.x, ev.y - 60, 'OPS!', { colore: '#ff4d6d', dim: 38, vita: 0.9 });
        ctx.invia(ev.id, { ev: 'errore', dur: T_ERRORE });
        break;
      case 'annegato':
        portati.set(ev.ent, t);
        fx.particelle(ev.x, ev.y - 10, { n: 10, colori: ['#ffffff', '#7fd1ff'], vel: 200, grav: 700, vita: 0.6 });
        break;
      case 'moneta':
        sfx.moneta();
        fx.testo(ev.x, ev.y - 40, '+1', { colore: '#ffd23f', dim: 36, vita: 0.9 });
        fx.particelle(ev.x, ev.y - 10, { n: 12, colori: ['#ffd23f', '#fff3b0'], vel: 220, grav: 200, vita: 0.5, forma: 'stella', dim: 10 });
        ctx.invia(ev.id, { ev: 'moneta' });
        ctx.invia('*', { m: moneteTel() });
        break;
      case 'nuovaMoneta':
        fx.anello(ev.x, ev.y - 8, { colore: '#ffd23f', max: 40, vita: 0.4, lw: 4 });
        ctx.invia('*', { m: moneteTel() });
        break;
      case 'monetaSvanita':
        ctx.invia('*', { m: moneteTel() });
        break;
      case 'zona':
        sfx.rullo(1);
        banner = { testo: ev.passo === 0 ? "🌊 Arriva l'acqua alta! Entra nel cerchio tratteggiato" : "🌊 L'acqua salirà ancora: stai nel cerchio tratteggiato!", colore: '#bfe6ff', t, dur: 3.2 };
        ctx.invia('*', { ev: 'zona', passo: ev.passo });
        break;
      case 'podio':
        sfx.ding();
        aggiungiFeed(`🏅 Ultimi ${ev.ids.length}: +${PUNTI.podio} a testa`, '#ffe9a8');
        break;
      case 'fineRound':
        chiusura = ev.motivo === 'ultimo' ? { tipo: 'ultimo', chi: nome(ev.ids[0]) } : ev.motivo === 'tempo' ? { tipo: 'tempo', quanti: ev.ids.length } : { tipo: 'nessuno' };
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Fasi

  function vaiA(f) {
    fase = f;
    tf = 0;
    if (f === 'svela') {
      sfx.fanfara();
      classificaRound = ids.map((id) => ({ id, tot: mondo.giocatori.get(id).tot }));
    }
    if (f === 'pronti') sfx.bip();
    if (f === 'gioco') sfx.via();
    vistaTutti();
  }

  function termina() {
    if (finito) return;
    finito = true;
    const punteggi = {};
    const dettagli = {};
    for (const [id, g] of mondo.giocatori) {
      punteggi[id] = g.tot;
      const kill = g.rounds.reduce((s, r) => s + r.kill, 0);
      const monete = g.rounds.reduce((s, r) => s + r.monete, 0);
      dettagli[id] = `${g.tot} punti · 👊 ${kill} · 🪙 ${monete}`;
    }
    ctx.fine({ punteggi, alto: true, dettagli });
  }

  // ---------------------------------------------------------------------------
  // Disegno

  // La piazza (fissa): disegnata una volta sola.
  function disegnaSfondo() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1636';
    g.fillRect(0, 0, W, H);
    // case colorate sopra la piazza
    const facciate = ['#e9a15b', '#d9734a', '#f2c879', '#c9605a', '#e8b4a0', '#d99a4e', '#b5654a'];
    for (let x = 0, k = 0; x < W; k++) {
      const w = 150 + ((k * 53) % 70);
      g.fillStyle = facciate[k % facciate.length];
      g.fillRect(x, 70 + ((k * 17) % 22), w, 60);
      g.fillStyle = 'rgba(40,20,30,0.35)';
      for (let fx2 = x + 18; fx2 < x + w - 20; fx2 += 34) g.fillRect(fx2, 92 + ((k * 17) % 22), 14, 20);
      x += w;
    }
    // pavimento
    const { x0, y0, x1, y1 } = MAPPA;
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, '#e6d3ab');
    grd.addColorStop(1, '#d6bf93');
    g.fillStyle = grd;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(120,90,50,0.13)';
    g.lineWidth = 2;
    for (let x = x0; x <= x1; x += 60) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
    for (let y = y0; y <= y1; y += 60) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(140,105,60,0.10)';
    for (let k = 0; k < 90; k++) {
      const x = x0 + ((k * 397) % (x1 - x0 - 60));
      const y = y0 + ((k * 211) % (y1 - y0 - 60));
      g.fillRect(x + 1, y + 1, 58, 58);
    }
    g.strokeStyle = '#7d6446';
    g.lineWidth = 8;
    g.strokeRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);

    // fontana
    g.beginPath();
    g.arc(FONTANA.x, FONTANA.y, FONTANA.r, 0, TAU);
    g.fillStyle = '#b9ab92';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#7d6c52';
    g.stroke();
    g.beginPath();
    g.arc(FONTANA.x, FONTANA.y, FONTANA.r - 12, 0, TAU);
    g.fillStyle = '#58c4ee';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 3;
    for (const r of [24, 40, 54]) {
      g.beginPath();
      g.arc(FONTANA.x, FONTANA.y, r, 0, TAU);
      g.stroke();
    }
    g.beginPath();
    g.arc(FONTANA.x, FONTANA.y, 16, 0, TAU);
    g.fillStyle = '#e4dccb';
    g.fill();
    g.strokeStyle = '#7d6c52';
    g.stroke();

    // giostra (vista dall'alto: il tendone a spicchi)
    for (let k = 0; k < 12; k++) {
      g.beginPath();
      g.moveTo(GIOSTRA.x, GIOSTRA.y);
      g.arc(GIOSTRA.x, GIOSTRA.y, GIOSTRA.r, (k * TAU) / 12, ((k + 1) * TAU) / 12);
      g.closePath();
      g.fillStyle = k % 2 ? '#fff4e0' : '#ef4444';
      g.fill();
    }
    g.beginPath();
    g.arc(GIOSTRA.x, GIOSTRA.y, GIOSTRA.r, 0, TAU);
    g.lineWidth = 5;
    g.strokeStyle = '#7a1d1d';
    g.stroke();
    g.beginPath();
    g.arc(GIOSTRA.x, GIOSTRA.y, 14, 0, TAU);
    g.fillStyle = '#ffd23f';
    g.fill();
    g.lineWidth = 3;
    g.stroke();

    // mercato
    for (const b of BANCHI) {
      g.fillStyle = '#8b5a2b';
      g.fillRect(b.x, b.y + 10, b.w, b.h - 10);
      const strisce = 6;
      for (let k = 0; k < strisce; k++) {
        g.fillStyle = k % 2 ? '#fff7ea' : b.colore;
        g.fillRect(b.x + (k * b.w) / strisce, b.y, b.w / strisce + 0.5, 22);
      }
      g.strokeStyle = 'rgba(40,20,10,0.6)';
      g.lineWidth = 3;
      g.strokeRect(b.x, b.y, b.w, b.h);
      const frutta = ['#f97316', '#84cc16', '#ef4444', '#facc15'];
      for (let k = 0; k < 9; k++) {
        g.beginPath();
        g.arc(b.x + 14 + k * 15, b.y + 33, 5, 0, TAU);
        g.fillStyle = frutta[k % 4];
        g.fill();
      }
    }

    // vicolo: due file di case e il corridoio in mezzo
    const vy0 = VICOLO.muri[0].y + VICOLO.muri[0].h;
    const vy1 = VICOLO.muri[1].y;
    g.fillStyle = '#c4ad82';
    g.fillRect(MAPPA.x0, vy0, VICOLO.muri[0].w, vy1 - vy0);
    for (const m of VICOLO.muri) {
      g.fillStyle = '#b8794e';
      g.fillRect(m.x, m.y, m.w, m.h);
      g.fillStyle = '#9a4a2c';
      for (let x = m.x; x < m.x + m.w; x += 26) g.fillRect(x, m.y, 22, m.h);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let y = m.y + 8; y < m.y + m.h; y += 14) g.fillRect(m.x, y, m.w, 3);
      g.strokeStyle = '#4a2416';
      g.lineWidth = 4;
      g.strokeRect(m.x, m.y, m.w, m.h);
    }
    g.fillStyle = 'rgba(30,15,10,0.35)';
    g.fillRect(MAPPA.x0, vy0, 26, vy1 - vy0);

    // palco
    g.fillStyle = '#7c4a1e';
    g.fillRect(PALCO.x, PALCO.y, PALCO.w, PALCO.h);
    g.strokeStyle = 'rgba(30,15,5,0.4)';
    g.lineWidth = 2;
    for (let x = PALCO.x; x < PALCO.x + PALCO.w; x += 38) {
      g.beginPath();
      g.moveTo(x, PALCO.y);
      g.lineTo(x, PALCO.y + PALCO.h);
      g.stroke();
    }
    g.fillStyle = '#9f1239';
    g.fillRect(PALCO.x, PALCO.y + PALCO.h - 34, PALCO.w, 34);
    g.fillStyle = '#be185d';
    for (let x = PALCO.x; x < PALCO.x + PALCO.w; x += 30) g.fillRect(x, PALCO.y + PALCO.h - 34, 12, 34);
    g.strokeStyle = '#3b1d0b';
    g.lineWidth = 4;
    g.strokeRect(PALCO.x, PALCO.y, PALCO.w, PALCO.h);
    for (let x = PALCO.x + 30; x < PALCO.x + PALCO.w; x += 64) {
      g.beginPath();
      g.arc(x, PALCO.y + 8, 7, 0, TAU);
      g.fillStyle = '#fde68a';
      g.fill();
    }
    g.fillStyle = 'rgba(255,240,200,0.12)';
    g.fillRect(PUBBLICO.x0 - 10, PUBBLICO.y0 - 10, PUBBLICO.x1 - PUBBLICO.x0 + 20, PUBBLICO.y1 - PUBBLICO.y0 + 20);

    // lampioni
    for (const l of LAMPIONI) {
      const gl = g.createRadialGradient(l.x, l.y, 4, l.x, l.y, 60);
      gl.addColorStop(0, 'rgba(255,230,140,0.45)');
      gl.addColorStop(1, 'rgba(255,230,140,0)');
      g.fillStyle = gl;
      g.beginPath();
      g.arc(l.x, l.y, 60, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(l.x, l.y, l.r, 0, TAU);
      g.fillStyle = '#2b2b38';
      g.fill();
      g.beginPath();
      g.arc(l.x, l.y, 5, 0, TAU);
      g.fillStyle = '#fde68a';
      g.fill();
    }

    // nomi dei posti
    const scritta = (s, x, y) => ctx.testo(g, s, x, y, { dim: 24, colore: 'rgba(255,255,255,0.85)', bordoColore: 'rgba(60,35,15,0.75)' });
    scritta('Fontana', FONTANA.x, FONTANA.y + FONTANA.r + 92);
    scritta('Mercato', 345, 160);
    scritta('Giostra', GIOSTRA.x, GIOSTRA.y + GIOSTRA.r + 90);
    scritta('Vicolo cieco', 300, VICOLO.muri[0].y - 22);
    scritta('Palco', PALCO.x + PALCO.w / 2, PALCO.y + 32);
    return c;
  }

  function ellisse(g, x, y, rx, ry) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
  }

  const MANTELLO = '#4a4a5a';
  const BORDO = '#211d2b';
  const CAPPUCCIO = '#56566a';
  const MASCHERA = '#efe9dc';

  // Un personaggio in piedi (tutti uguali: passanti e giocatori).
  function omino(g, e) {
    const moving = e.dir[0] || e.dir[1];
    const bob = moving ? Math.abs(Math.sin(e.fase)) * 2.6 : 0;
    const [fx0, fy0] = e.face;
    g.save();
    g.translate(e.x, e.y);
    g.scale(S, S);
    // acqua alle caviglie
    if (e.acqua > 0) {
      g.strokeStyle = `rgba(230,248,255,${0.5 + 0.3 * Math.sin(t * 10)})`;
      g.lineWidth = 2;
      ellisse(g, 0, 0, 15 + Math.sin(t * 8) * 2, 6);
      g.stroke();
    }
    // errore: lampeggia rosso davanti a tutti
    if (e.rosso > 0) {
      const on = Math.floor(e.rosso * 8) % 2 === 0;
      ellisse(g, 0, -2, 26, 11);
      g.fillStyle = on ? 'rgba(255,30,60,0.75)' : 'rgba(255,30,60,0.3)';
      g.fill();
    }
    ellisse(g, 0, 0, 12, 4.5);
    g.fillStyle = 'rgba(40,25,10,0.28)';
    g.fill();
    // piedi
    const passo = moving ? Math.sin(e.fase) * 4 : 0;
    g.fillStyle = BORDO;
    ellisse(g, -4.5 + passo * 0.4, -1 - Math.max(0, passo) * 0.5, 3.6, 2.4);
    g.fill();
    ellisse(g, 4.5 - passo * 0.4, -1 - Math.max(0, -passo) * 0.5, 3.6, 2.4);
    g.fill();
    // mantello
    const y = -bob;
    const rossa = e.rosso > 0 && Math.floor(e.rosso * 8) % 2 === 0;
    g.beginPath();
    g.moveTo(-11, y - 3);
    g.quadraticCurveTo(-10, y - 18, -6.5, y - 26);
    g.lineTo(6.5, y - 26);
    g.quadraticCurveTo(10, y - 18, 11, y - 3);
    g.quadraticCurveTo(0, y + 1, -11, y - 3);
    g.closePath();
    g.fillStyle = rossa ? '#d63250' : MANTELLO;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = BORDO;
    g.stroke();
    // testa: cappuccio e maschera bianca che guarda dove cammina
    let lx = fx0;
    let ly = fy0;
    if (e.curioso && e.curioso.ritardo <= 0 && e.curioso.ent) {
      const dx = e.curioso.ent.x - e.x;
      const dy = e.curioso.ent.y - e.y;
      const m = Math.hypot(dx, dy) || 1;
      lx = dx / m;
      ly = dy / m;
    }
    g.beginPath();
    g.arc(0, y - 33, 10.5, 0, TAU);
    g.fillStyle = rossa ? '#e04460' : CAPPUCCIO;
    g.fill();
    g.stroke();
    if (ly > -0.6 || Math.abs(lx) > 0.5) {
      const mx = lx * 3.2;
      const my = y - 32 + Math.max(0, ly) * 1.2;
      ellisse(g, mx, my, 6.6 - Math.abs(lx) * 1.2, 7.4);
      g.fillStyle = MASCHERA;
      g.fill();
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#1b1030';
      const ex = mx + lx * 1.4;
      const ey = my - 1.2 + ly * 0.8;
      for (const s of [-1, 1]) {
        if (Math.abs(lx) > 0.5 && s === -Math.sign(lx)) continue; // di profilo si vede un occhio solo
        g.beginPath();
        g.arc(ex + s * 2.5, ey, 1.35, 0, TAU);
        g.fill();
      }
    }
    // il pugno: si vede bene da tutti
    if (e.pugno > 0) {
      const k = 1 - e.pugno / T_PUGNO;
      const est = (k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65) * 22;
      const ax = e.pdx * (7 + est);
      const ay = y - 19 + e.pdy * (7 + est) * 0.7;
      g.strokeStyle = BORDO;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(e.pdx * 5, y - 19);
      g.lineTo(ax, ay);
      g.stroke();
      g.beginPath();
      g.arc(ax, ay, 6.5, 0, TAU);
      g.fillStyle = '#e11d48';
      g.fill();
      g.lineWidth = 2;
      g.stroke();
    }
    // incuriosito: il "?"
    if (e.curioso && e.curioso.ritardo <= 0) {
      const by = y - 54 + Math.sin(t * 5 + e.i) * 2;
      g.beginPath();
      g.arc(9, by, 8.5, 0, TAU);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = BORDO;
      g.stroke();
      ctx.testo(g, '?', 9, by + 1, { dim: 14, colore: '#1b1030', bordo: 0, peso: 800 });
    }
    g.restore();
  }

  // Un personaggio a terra: passante stordito (con le stelline) o giocatore eliminato.
  function steso(g, e, p) {
    const dir = e.pdx >= 0 ? 1 : -1;
    g.save();
    g.translate(e.x, e.y);
    g.scale(S, S);
    ellisse(g, 0, 0, 20, 6);
    g.fillStyle = 'rgba(40,25,10,0.25)';
    g.fill();
    ellisse(g, 0, -6, 17, 7.5);
    g.fillStyle = p ? shade(MANTELLO, 0.1) : MANTELLO;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = BORDO;
    g.stroke();
    if (!p) {
      g.beginPath();
      g.arc(dir * 18, -8, 9.5, 0, TAU);
      g.fillStyle = CAPPUCCIO;
      g.fill();
      g.stroke();
      ellisse(g, dir * 19, -8, 6, 6.5);
      g.fillStyle = MASCHERA;
      g.fill();
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + (k * TAU) / 3;
        ctx.testo(g, '★', dir * 18 + Math.cos(a) * 13, -26 + Math.sin(a) * 4, { dim: 11, colore: '#ffd23f', bordo: 2 });
      }
    } else {
      // la maschera è caduta: si vede chi era
      ellisse(g, -dir * 24, -2, 5.5, 6.5);
      g.fillStyle = MASCHERA;
      g.fill();
      g.lineWidth = 1.2;
      g.stroke();
    }
    g.restore();
    if (p) {
      ctx.testa(g, p.av, e.x + dir * 20 * S, e.y - 10 * S, 15, { espr: 'stordito', rot: dir * 1.2 });
      ctx.etichetta(g, p.nome, e.x, e.y - 40, p.colore, { dim: 15, maxW: 140 });
    }
  }

  function disegnaAcqua(g) {
    const p = mondo.piano;
    const r = mondo.raggio();
    const r0 = p.raggi[0];
    const { x0, y0, x1, y1 } = MAPPA;
    if (r < r0 - 1) {
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip(); // prima la piazza: il "pari/dispari" colorerebbe anche il cerchio fuori dalla piazza
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.arc(p.cx, p.cy, r, 0, TAU, true);
      g.fillStyle = 'rgba(38,120,210,0.58)';
      g.fill('evenodd');
      g.clip('evenodd');
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 3;
      for (let y = y0 + 20; y < y1; y += 44) {
        g.beginPath();
        for (let x = x0; x <= x1; x += 40) {
          const yy = y + Math.sin(x / 70 + t * 2 + y) * 6;
          if (x === x0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
      }
      g.restore();
      const stringe = mondo.prossimo() != null && Math.abs(r - (mondo.prossimo() || 0)) > 1 && mondo.t > 59;
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      g.shadowColor = '#ffffff';
      g.shadowBlur = 18;
      g.strokeStyle = stringe ? `rgba(255,255,255,${0.8 + 0.2 * Math.sin(t * 9)})` : '#ffffff';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(p.cx, p.cy, r, 0, TAU);
      g.stroke();
      g.restore();
    }
    const pr = mondo.prossimo();
    if (pr != null && pr < r - 1) {
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      g.setLineDash([16, 14]);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(p.cx, p.cy, pr, 0, TAU);
      g.stroke();
      g.restore();
    }
  }

  function disegnaMonete(g) {
    for (const m of mondo.monete) {
      const resta = m.scade - mondo.t;
      if (resta < 1.5 && Math.floor(resta * 8) % 2 === 0) continue;
      const nasce = clamp((mondo.t - m.nasce) / 0.25, 0, 1);
      const y = m.y - 10 + Math.sin(t * 4 + m.id) * 3;
      const lw = Math.abs(Math.cos(t * 3 + m.id)) * 11 * nasce + 2;
      ellisse(g, m.x, m.y + 2, 10, 4);
      g.fillStyle = 'rgba(40,25,10,0.25)';
      g.fill();
      g.save();
      g.shadowColor = '#ffd23f';
      g.shadowBlur = 16;
      ellisse(g, m.x, y, lw, 11 * nasce + 0.1);
      g.fillStyle = '#ffd23f';
      g.fill();
      g.restore();
      g.lineWidth = 2;
      g.strokeStyle = '#a16207';
      g.stroke();
    }
  }

  function disegnaPersonaggi(g) {
    const ordine = [...mondo.ents].sort((a, b) => a.y - b.y);
    for (const e of ordine) {
      const p = e.tipo === 'g' ? perId.get(e.id) : null;
      if (!e.vivo) {
        if (e.morte.causa === 'acqua') {
          // portato via dall'acqua: sprofonda e sparisce
          const k = portati.has(e.i) ? (t - portati.get(e.i)) / 1.1 : 1;
          if (k >= 1 || k < 0) continue;
          g.save();
          g.globalAlpha = 1 - k;
          g.translate(0, k * 18);
          omino(g, e);
          g.restore();
          continue;
        }
        steso(g, e, p);
        continue;
      }
      if (e.steso > 0) steso(g, e, null);
      else omino(g, e);
    }
    // a round finito si tolgono le maschere: ecco chi eravate
    if (fase === 'svela' || fase === 'tabella' || (fase === 'gioco' && mondo.fine)) {
      const k = fase === 'svela' ? ease.outBack(clamp(tf / 0.5, 0, 1)) : 1;
      for (const e of mondo.ents) {
        if (e.tipo !== 'g' || !e.vivo) continue;
        const p = perId.get(e.id);
        ctx.testa(g, p.av, e.x, e.y - 64 * S, 20 * k, { espr: 'felice', t });
        if (k > 0.5) ctx.etichetta(g, p.nome, e.x, e.y - 98 * S, p.colore, { dim: 17, maxW: 160 });
      }
    }
  }

  function disegnaHud(g) {
    const vivi = mondo.vivi().length;
    ctx.pannello(g, 24, 16, 310, 70, { r: 35 });
    ctx.testo(g, `🎭 Round ${mondo.round + 1}/${ROUND}`, 179, 52, { dim: 34 });
    ctx.barraTempo(g, Math.max(0, DURATA - mondo.t), DURATA, { w: 720, x: W / 2 - 380, y: 38 });
    ctx.pannello(g, W - 380, 16, 356, 70, { r: 35 });
    ctx.testo(g, `🧍 In gioco: ${vivi}/${n}`, W - 202, 52, { dim: 34 });
    // chi è stato eliminato, chi ha sbagliato (mai chi ha colpito)
    let y = 112;
    for (const f of feed) {
      const eta = t - f.t;
      if (eta > T_FEED) continue;
      g.save();
      g.globalAlpha = clamp((T_FEED - eta) / 0.4, 0, 1) * clamp(eta / 0.15, 0, 1);
      ctx.pannello(g, W - 500, y - 20, 476, 40, { r: 20, colore: 'rgba(25,12,60,0.82)' });
      ctx.testo(g, f.testo, W - 262, y, { dim: 22, colore: f.colore, maxW: 450 });
      g.restore();
      y += 46;
    }
    if (banner && t - banner.t < banner.dur) {
      const eta = t - banner.t;
      g.save();
      g.globalAlpha = clamp((banner.dur - eta) / 0.4, 0, 1);
      const s = ease.outBack(clamp(eta / 0.35, 0, 1));
      g.translate(W / 2, 160);
      g.scale(s, s);
      ctx.pannello(g, -580, -38, 1160, 76, { r: 38, colore: 'rgba(15,40,90,0.85)' });
      ctx.testo(g, banner.testo, 0, 0, { dim: 38, colore: banner.colore, maxW: 1120 });
      g.restore();
    }
  }

  function velo(g, a) {
    g.fillStyle = `rgba(15,8,35,${a})`;
    g.fillRect(0, 0, W, H);
  }

  function disegnaFineRound(g) {
    const c = chiusura || { tipo: 'nessuno' };
    const testo =
      c.tipo === 'ultimo'
        ? `🏆 ${c.chi} è l'ultimo rimasto! +${PUNTI.ultimo}`
        : c.tipo === 'tempo'
          ? `⏱ Tempo scaduto! Ancora in piedi: ${c.quanti} (+${PUNTI.vivo} a testa)`
          : "🌊 Nessuno è rimasto in piedi!";
    ctx.pannello(g, W / 2 - 560, 104, 1120, 78, { r: 39, colore: 'rgba(25,12,60,0.88)' });
    ctx.testo(g, testo, W / 2, 143, { dim: 36, colore: '#ffd23f', maxW: 1080 });
    if (fase === 'svela') ctx.testo(g, 'Giù le maschere: ecco chi eravate!', W / 2, 220, { dim: 40 });
  }

  function disegnaTabella(g) {
    velo(g, Math.min(0.6, tf * 2));
    const righe = ids
      .map((id) => {
        const gg = mondo.giocatori.get(id);
        return { id, p: perId.get(id), r: gg.rounds[gg.rounds.length - 1], tot: gg.tot };
      })
      .sort((a, b) => b.tot - a.tot || b.r.punti - a.r.punti);
    const hR = n > 10 ? 44 : 54;
    const hTot = 150 + righe.length * hR;
    const w = 1240;
    const x = W / 2 - w / 2;
    const y = Math.max(20, H / 2 - hTot / 2);
    ctx.pannello(g, x, y, w, hTot, { r: 30, colore: 'rgba(25,12,60,0.92)' });
    ctx.testo(g, `Fine del round ${mondo.round + 1} di ${ROUND}`, W / 2, y + 44, { dim: 42, colore: '#ffd23f' });
    const col = { nome: x + 150, tick: x + 520, monete: x + 610, kill: x + 700, err: x + 790, bonus: x + 880, round: x + 990, tot: x + 1130 };
    const hy = y + 100;
    const head = [
      ['⏱', col.tick],
      ['🪙', col.monete],
      ['👊', col.kill],
      ['❌', col.err],
      ['⭐', col.bonus],
      ['Round', col.round],
      ['Totale', col.tot],
    ];
    for (const [s, cx] of head) ctx.testo(g, s, cx, hy, { dim: 24, colore: '#c9b8ff' });
    righe.forEach((rg, k) => {
      const ry = hy + 46 + k * hR;
      const pos = 1 + righe.filter((o) => o.tot > rg.tot).length;
      ctx.testo(g, `${pos}°`, x + 50, ry, { dim: 28 });
      ctx.testa(g, rg.p.av, x + 104, ry, hR * 0.36);
      ctx.testo(g, rg.p.nome, col.nome, ry, { dim: 28, allinea: 'left', maxW: 300, colore: rg.p.colore === '#475569' ? '#cbd5e1' : '#fff' });
      const r = rg.r;
      const bonus = r.vivo + r.ultimo + r.podio;
      ctx.testo(g, `+${r.tick}`, col.tick, ry, { dim: 26 });
      ctx.testo(g, `+${r.monete}`, col.monete, ry, { dim: 26 });
      ctx.testo(g, `+${r.kill * PUNTI.kill}`, col.kill, ry, { dim: 26 });
      ctx.testo(g, r.errori ? `${r.errori * PUNTI.errore}` : '0', col.err, ry, { dim: 26, colore: r.errori ? '#ff8fa3' : '#fff' });
      ctx.testo(g, bonus ? `+${bonus}` : '0', col.bonus, ry, { dim: 26 });
      ctx.testo(g, `${r.punti}`, col.round, ry, { dim: 30, colore: '#ffd23f' });
      ctx.testo(g, `${rg.tot}`, col.tot, ry, { dim: 34, colore: '#4cd97b' });
    });
  }

  // ---------------------------------------------------------------------------

  mondo.nuovoRound();
  vistaTutti();

  return {
    inizia() {
      vaiA('gioco');
    },

    aggiorna(dt) {
      t += dt;
      frame++;
      tf += dt;
      if (fase === 'gioco') {
        for (const p of ctx.giocatori) {
          if (p.bot || ctx.connesso(p.id)) continue;
          if (mondo.giocatori.get(p.id).ent.vivo) guida(p.id, dt);
        }
        mondo.passo(dt);
        const eventi = mondo.eventi;
        mondo.eventi = [];
        for (const ev of eventi) gestisci(ev);
        tStream -= dt;
        if (tStream <= 0) {
          tStream = 0.12;
          stream();
        }
        if (mondo.fine) vaiA('svela');
      } else if (fase === 'svela') {
        mondo.passo(dt);
        if (tf >= T_SVELA) vaiA('tabella');
      } else if (fase === 'tabella') {
        if (tf >= T_TABELLA) {
          if (mondo.ultimoRound()) termina();
          else {
            mondo.nuovoRound();
            menti.clear();
            portati.clear();
            feed = [];
            banner = null;
            chiusura = null;
            vaiA('pronti');
          }
        }
      } else if (fase === 'pronti') {
        if (tf >= T_PRONTI) vaiA('gioco');
      }
    },

    disegna(g) {
      g.drawImage(sfondo, 0, 0);
      disegnaAcqua(g);
      disegnaMonete(g);
      disegnaPersonaggi(g);
      disegnaHud(g);
      if (fase === 'attesa' || fase === 'pronti') {
        if (fase === 'pronti') {
          velo(g, 0.3);
          const k = T_PRONTI - tf;
          ctx.testo(g, `Round ${mondo.round + 1}`, W / 2, H / 2 - 120, { dim: 110, colore: '#ffd23f' });
          ctx.testo(g, String(Math.max(1, Math.ceil(k))), W / 2, H / 2 + 20, { dim: 150 });
        }
        ctx.pannello(g, W / 2 - 520, H - 130, 1040, 76, { r: 38, colore: 'rgba(25,12,60,0.9)' });
        ctx.testo(g, '📱 Guarda il telefono: il pallino verde sei tu!', W / 2, H - 92, { dim: 36, maxW: 1000 });
      }
      if (fase === 'svela') disegnaFineRound(g);
      if (fase === 'tabella' || finito) disegnaTabella(g);
    },

    input(id, d) {
      if (fase !== 'gioco' || !d) return;
      const r = mondo.input(id, d);
      if (r && r.esito === 'vuoto') ctx.invia(id, { ev: 'vuoto' });
    },

    bot(id, dt) {
      if (fase !== 'gioco') return;
      if (!mondo.giocatori.get(id).ent.vivo) return;
      guida(id, dt);
    },

    rientrato(id) {
      const e = mondo.giocatori.get(id)?.ent;
      if (e) {
        e.jx = 0;
        e.jy = 0;
      }
      menti.delete(id);
      ctx.vista(id, vistaPer(id));
    },

    // Per il banco: quello che si vede sulla TV e quello che il telefono dice a ognuno.
    tv: () => mondo.tv(),
    io,
    fase: () => fase,
    ascolta: (f) => ascoltatori.push(f),
    mondo,
  };
}

