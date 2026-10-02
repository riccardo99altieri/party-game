// Detonazione: la bomba passa di mano in mano. Chi ce l'ha fa sul telefono una
// sequenza di gesti (swipe, doppio tap, tieni premuto, pizzica): se la completa
// esatta, la bomba vola da un avversario a caso (la linea sulla TV mostra già da chi).
// Il timer accelera: quando arriva a zero chi ha la bomba perde una vita.
// Vince l'ultimo che resta in piedi. Da 7 giocatori le bombe sono 2, da 12 sono 3.

import { TAU, rand, clamp, pick, lerp } from '../../shared/util.js';
import { prepara } from '../../shared/avatar.js';
import { GESTI, BOMBE, LUNGHEZZA, TIENI_MS, DURATA, PAUSA, VOLO, bombePer, vitePer, creaSequenza, inizioDisplay, display } from './regole.js';

// Posti delle bombe grandi al centro, secondo quante sono.
const POSTI = [
  [{ x: 960, y: 560, r: 135 }],
  [
    { x: 785, y: 580, r: 105 },
    { x: 1135, y: 580, r: 105 },
  ],
  [
    { x: 960, y: 470, r: 88 },
    { x: 800, y: 660, r: 88 },
    { x: 1120, y: 660, r: 88 },
  ],
];

const FUOCO = ['#fff3a0', '#ffd23f', '#ff8a3d', '#ff4d2d', '#ff2d55'];
const FUMO = ['#3b3346', '#554b63', '#6f6680', '#2a2433'];

// Tempi "umani" di esecuzione di ogni gesto (secondi, persona media, senza la lettura).
// Il tieni premuto dura per forza TIENI_MS più il tempo di appoggiare il dito.
export const ESEGUI = { su: 0.26, giu: 0.26, sx: 0.26, dx: 0.26, doppio: 0.3, tieni: 0.12, pizzica: 0.55 };

export default {
  id: 'bomba',
  nome: 'Detonazione',
  emoji: '💣',
  colore: '#ff4d2d',
  descrizione: 'Passa la bomba prima che esploda!',
  comeSiGioca: [
    'Chi ha la bomba vede sul telefono 4 gesti: swipe, doppio tap, tieni premuto, pizzica. Telefono in una mano, gesti con l’altra (il pizzico vuole due dita)',
    'Falli giusti e in ordine: la bomba vola da un avversario a caso (la linea sulla TV mostra da chi). Se sbagli, si ricomincia',
    'Il timer accelera: a zero chi ha la bomba perde una vita. Vince l’ultimo che resta in piedi',
  ],
  controllo: 'gesti',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const VITE = vitePer(n);
  let t = 0;
  let finito = false;
  let fineTra = 0;
  let quadro = 0; // fotogramma (per le eliminazioni nello stesso istante)
  let contaBombe = 0;
  let bombe = [];
  let prossime = []; // quando far comparire le bombe nuove (tempo t)
  let tracce = []; // linee dei passaggi appena fatti
  let ultimaVittima = null;
  let ultimoBoom = null;
  let oraPrima = null;
  let vincitori = [];

  // Tutti in cerchio (un'ellisse) attorno alle bombe, alla stessa distanza dal centro.
  const h = n <= 4 ? 190 : n <= 6 ? 175 : n <= 9 ? 160 : n <= 12 ? 145 : 130;
  const gioc = ctx.giocatori.map((p, i) => {
    const a = Math.PI / 2 + (i * TAU) / n;
    return {
      id: p.id,
      p,
      av: prepara(p.av),
      x: 960 + Math.cos(a) * 790,
      y: 610 + Math.sin(a) * 360,
      vite: VITE,
      vivo: true,
      ordine: 0, // fotogramma dell'eliminazione
      fuori: 0, // secondo dell'eliminazione
      pos: 0,
      passaggi: 0,
      errori: 0,
      tenuta: 0,
      tenutaPassata: 0, // secondi con in mano le bombe poi passate (per il banco)
      colpo: 0,
      sbaglio: 0,
      cuore: 0,
    };
  });
  const perId = new Map(gioc.map((q) => [q.id, q]));

  const bombaDi = (id) => bombe.find((b) => b.chi === id) || null;
  const vivi = () => gioc.filter((q) => q.vivo);
  const mani = (q) => ({ x: q.x, y: q.y - h * 1.1 - 18 });

  // -------------------------------------------------------------------------
  // Telefoni

  function infoBomba(b) {
    return {
      col: b.col,
      chi: perId.get(b.chi).p.nome,
      verso: b.verso ? perId.get(b.verso).p.nome : null,
      scade: Math.round(ctx.ora() + Math.max(0, b.T - b.tau) * 1000),
      T: b.T,
      B0: b.B0,
    };
  }

  function vistaDi(q) {
    const s = { fase: finito ? 'fine' : 'gioco', vite: q.vite, viteMax: VITE, vivo: q.vivo, vivi: vivi().length, tot: n, bombe: bombe.map(infoBomba) };
    if (!q.vivo) s.pos = q.pos;
    if (finito) s.vinto = vincitori.includes(q.id);
    const b = bombaDi(q.id);
    if (b && !finito) s.bomba = { k: b.k, seq: b.seq, ...infoBomba(b) };
    const m = bombe.find((x) => x.verso === q.id);
    if (m && !finito) s.mira = infoBomba(m);
    if (ultimoBoom) s.boom = { ...ultimoBoom, io: ultimoBoom.id === q.id };
    return s;
  }

  function mandaViste(solo) {
    for (const q of solo ? [solo] : gioc) ctx.vista(q.id, vistaDi(q));
  }

  // -------------------------------------------------------------------------
  // Bombe

  // Da chi andrà la bomba: un avversario a caso, ancora in gioco e senza bomba.
  function scegliBersaglio(b) {
    const liberi = gioc.filter((q) => q.vivo && q.id !== b.chi && !bombaDi(q.id));
    return liberi.length ? pick(liberi).id : null;
  }

  // Le altre bombe che puntavano a chi ora ha una bomba (o è fuori) cambiano bersaglio.
  function ricontrollaBersagli() {
    for (const b of bombe) {
      const q = b.verso && perId.get(b.verso);
      if (!q || !q.vivo || bombaDi(q.id)) b.verso = scegliBersaglio(b);
    }
  }

  function nuovaBomba() {
    let liberi = gioc.filter((q) => q.vivo && !bombaDi(q.id));
    if (liberi.length > 1) liberi = liberi.filter((q) => q.id !== ultimaVittima);
    if (!liberi.length) return;
    const chi = pick(liberi).id;
    const usati = new Set(bombe.map((b) => b.col));
    const col = [0, 1, 2].find((c) => !usati.has(c)) ?? 0;
    const T = rand(DURATA[0], DURATA[1]);
    const posto = POSTI[Math.min(2, bombe.length)][bombe.length];
    const b = {
      id: ++contaBombe,
      col,
      chi,
      verso: null,
      giri: 0,
      k: '',
      seq: creaSequenza(),
      prog: 0,
      tau: 0,
      presa: 0,
      T,
      B0: inizioDisplay(T),
      num: 0,
      batti: 0,
      volo: { da: null, t: 0 },
      x: posto.x,
      y: posto.y,
      r: posto.r,
      nasce: 0,
    };
    b.k = `${b.id}.0`;
    b.num = Math.ceil(b.B0);
    bombe.push(b);
    b.verso = scegliBersaglio(b);
    ricontrollaBersagli();
    fx.anello(b.x, b.y, { r: 30, max: 220, colore: BOMBE[col].colore, vita: 0.5 });
    sfx.pop();
  }

  function passa(b) {
    const da = perId.get(b.chi);
    let a = b.verso && perId.get(b.verso);
    if (!a || !a.vivo || bombaDi(a.id)) {
      b.verso = scegliBersaglio(b);
      a = b.verso && perId.get(b.verso);
    }
    if (!a) return;
    da.passaggi++;
    da.tenutaPassata += b.tau - b.presa;
    b.presa = b.tau;
    b.chi = a.id;
    b.giri++;
    b.k = `${b.id}.${b.giri}`;
    b.seq = creaSequenza();
    b.prog = 0;
    b.volo = { da: da.id, t: 0 };
    b.verso = scegliBersaglio(b);
    ricontrollaBersagli();
    tracce.push({ da: da.id, a: a.id, col: BOMBE[b.col].colore, vita: 1.3 });
    sfx.whoosh();
    mandaViste();
  }

  function avanza(b, passo) {
    const p = clamp(Math.floor(Number(passo) || 0), 0, LUNGHEZZA - 1);
    if (p > b.prog) sfx.click();
    b.prog = p;
  }

  function sbaglia(b) {
    const q = perId.get(b.chi);
    b.prog = 0;
    q.errori++;
    q.sbaglio = 0.6;
    sfx.zap();
  }

  function esplodi(b) {
    bombe = bombe.filter((x) => x !== b);
    const q = perId.get(b.chi);
    const m = mani(q);
    q.vite--;
    q.colpo = 1.8;
    q.cuore = 1;
    ultimaVittima = q.id;
    fx.particelle(q.x, q.y - h * 0.6, { n: 70, colori: FUOCO, vel: 900, velMin: 200, grav: 250, vita: 1.1, dim: 16 });
    fx.particelle(q.x, q.y - h * 0.6, { n: 26, colori: FUMO, vel: 260, grav: -120, vita: 2, dim: 30, attrito: 0.95 });
    fx.anello(q.x, q.y - h * 0.5, { r: 30, max: 320, colore: '#ffb020', lw: 14, vita: 0.6 });
    fx.particelle(b.x, b.y, { n: 24, colori: ['#1b1b24', '#3a3a4a', BOMBE[b.col].colore], vel: 500, grav: 700, vita: 0.9, dim: 12, forma: 'coriandolo' });
    fx.lampo('#ffe2b0', 0.35);
    fx.scuoti(30);
    sfx.boom();
    if (q.vite <= 0) {
      q.vivo = false;
      q.ordine = quadro;
      q.fuori = t;
      fx.testo(m.x, m.y - 20, '💀 FUORI!', { colore: '#ff4d6d', dim: 50, vita: 1.8 });
    } else {
      fx.testo(m.x, m.y - 20, `💔 −1 vita`, { colore: '#ffd23f', dim: 42, vita: 1.6 });
    }
    // posizione di chi esce adesso (chi esce insieme è pari merito)
    const restano = vivi().length;
    for (const x of gioc) if (!x.vivo && x.ordine === quadro) x.pos = restano + 1;
    ultimoBoom = { id: q.id, chi: q.p.nome, fuori: !q.vivo, n: (ultimoBoom?.n || 0) + 1 };
    ricontrollaBersagli();
    if (restano <= 1) return termina();
    const mancano = bombePer(restano) - bombe.length - prossime.length;
    for (let i = 0; i < mancano; i++) prossime.push(t + PAUSA + i * 0.4);
    mandaViste();
  }

  function termina() {
    if (finito) return;
    finito = true;
    fineTra = 3;
    vincitori = vivi().map((q) => q.id);
    for (const id of vincitori) perId.get(id).pos = 1;
    bombe = [];
    prossime = [];
    ctx.dopo(0.9, () => {
      fx.coriandoli(140);
      sfx.ding();
    });
    mandaViste();
  }

  function risultato() {
    const fuori = gioc.filter((q) => !q.vivo).sort((a, b) => b.ordine - a.ordine);
    const gruppi = [vincitori.slice()];
    let ultimo = null;
    for (const q of fuori) {
      if (ultimo && ultimo.ordine === q.ordine) gruppi[gruppi.length - 1].push(q.id);
      else gruppi.push([q.id]);
      ultimo = q;
    }
    const dettagli = {};
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    for (const q of gioc) {
      const pass = `${q.passaggi} ${q.passaggi === 1 ? 'passaggio' : 'passaggi'}`;
      if (q.vivo) dettagli[q.id] = VITE > 1 ? `🏆 ${'❤️'.repeat(q.vite)} · ${pass}` : `🏆 in piedi · ${pass}`;
      else dettagli[q.id] = `💥 fuori al ${mmss(q.fuori)} · ${pass}`;
    }
    return { gruppi, dettagli };
  }

  // -------------------------------------------------------------------------
  // CPU. Una persona con la bomba in mano: si accorge che è arrivata (il telefono
  // vibra), legge un gesto alla volta e lo fa con i suoi tempi. A volte sbaglia gesto
  // (si ricomincia) o il gesto non viene riconosciuto (lo rifà); col timer quasi a zero
  // va nel panico e sbaglia di più. Vede solo la sua sequenza (è sul suo telefono).
  // Il gioco non ha scelte da fare: la differenza tra i livelli sta nella velocità,
  // negli errori e nei nervi saldi.

  function cervello(id) {
    const cpu = ctx.cpu(id);
    const m = cpu.mem;
    if (!m.pronto) {
      const { aggressivita: ag, prudenza: pr, costanza: co } = cpu.tratti;
      m.pronto = true;
      m.k = null;
      // chi ha fretta è un filo più veloce ma sbaglia di più; il prudente il contrario
      m.vel = cpu.per(1.45, 1, 0.68) * (1 + 0.1 * (pr - ag)) * Math.exp(cpu.gauss() * 0.05);
      m.varia = cpu.per(0.3, 0.22, 0.15) * (1.2 - 0.4 * co);
      m.pSbaglia = cpu.per(0.07, 0.04, 0.012) * (0.75 + 0.5 * ag) * (1.2 - 0.4 * pr);
      m.pManca = cpu.per(0.14, 0.08, 0.03) * (1.2 - 0.4 * co);
      m.pDistratto = cpu.per(0.15, 0.06, 0.02) * (1.3 - 0.6 * co);
      m.panico = cpu.per(1.8, 1.4, 1.1);
    }
    return cpu;
  }

  function durata(cpu, g, b) {
    const m = cpu.mem;
    const fretta = display(b.B0, b.tau) <= 4 ? 0.92 : 1;
    const esegui = ESEGUI[g] * m.vel * Math.exp(cpu.gauss() * m.varia) * fretta;
    return cpu.reazione(0.55) + esegui + (g === 'tieni' ? TIENI_MS / 1000 : 0);
  }

  function pilota(q, dt) {
    const cpu = cervello(q.id);
    const m = cpu.mem;
    const b = bombaDi(q.id);
    if (!b) {
      m.k = null;
      return;
    }
    if (m.k !== b.k) {
      m.k = b.k;
      m.i = 0;
      const distratto = cpu.prob(m.pDistratto) ? cpu.num(0.4, cpu.per(1.4, 0.9, 0.6)) : 0;
      m.t = cpu.reazione(1.3) + distratto + durata(cpu, b.seq[0], b);
      return;
    }
    m.t -= dt;
    if (m.t > 0) return;
    const g = b.seq[m.i];
    const panico = display(b.B0, b.tau) <= 4 ? m.panico : 1;
    if (cpu.prob(m.pSbaglia * panico)) {
      // gesto sbagliato: da capo
      sbaglia(b);
      m.i = 0;
      m.t = cpu.num(0.25, 0.55) * cpu.per(1.3, 1, 0.8) + durata(cpu, b.seq[0], b);
      return;
    }
    if (GESTI[g].tipo !== 'swipe' && cpu.prob(m.pManca)) {
      // doppio tap troppo lento, dito sollevato presto, pizzico troppo corto: si rifà
      m.t = cpu.num(0.12, 0.3) + durata(cpu, g, b);
      return;
    }
    m.i++;
    if (m.i >= LUNGHEZZA) passa(b);
    else {
      avanza(b, m.i);
      m.t = durata(cpu, b.seq[m.i], b);
    }
  }

  // -------------------------------------------------------------------------
  // Disegno

  function sfondo(g, pericolo) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#1d1233');
    grd.addColorStop(1, '#2d1024');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // pedana rotonda con le strisce di pericolo
    g.save();
    g.beginPath();
    g.ellipse(960, 610, 660, 300, 0, 0, TAU);
    g.fillStyle = '#2a2140';
    g.fill();
    g.lineWidth = 26;
    g.strokeStyle = '#15101f';
    g.stroke();
    g.setLineDash([34, 34]);
    g.strokeStyle = '#ffc53d';
    g.lineWidth = 18;
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.ellipse(960, 610, 420, 190, 0, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fill();
    g.restore();
    // allarme rosso ai bordi quando una bomba sta per scoppiare
    if (pericolo > 0.01) {
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
      v.addColorStop(0, 'rgba(255,0,40,0)');
      v.addColorStop(1, `rgba(255,20,40,${(0.5 * pericolo).toFixed(3)})`);
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
  }

  // Una bomba: corpo nero, fascia del suo colore, miccia che si accorcia, display.
  function disegnaBomba(g, x, y, r, o = {}) {
    const col = o.colore || '#ff3b3b';
    g.save();
    g.translate(x, y);
    if (o.giro) g.rotate(o.giro);
    const s = 1 + (o.batti || 0) * 0.07;
    g.scale(s, s);
    // miccia
    const lung = r * 0.95 * clamp(o.miccia ?? 1, 0, 1);
    const ax = r * 0.55;
    const ay = -r * 0.78;
    g.lineCap = 'round';
    g.strokeStyle = '#1b1030';
    g.lineWidth = Math.max(4, r * 0.13);
    g.beginPath();
    g.moveTo(ax, ay);
    g.quadraticCurveTo(ax + lung * 0.2, ay - lung * 0.9, ax + lung * 0.75, ay - lung * 0.7);
    g.stroke();
    g.strokeStyle = '#d9b27a';
    g.lineWidth = Math.max(2, r * 0.07);
    g.stroke();
    if (o.scintilla !== false) {
      const sx = ax + lung * 0.75;
      const sy = ay - lung * 0.7;
      const k = r * 0.28 * (0.8 + Math.random() * 0.5);
      g.fillStyle = '#ffd23f';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + Math.random() * 0.4;
        const rr = i % 2 ? k * 0.45 : k;
        g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(sx, sy, k * 0.25, 0, TAU);
      g.fill();
    }
    // tappo
    g.save();
    g.translate(r * 0.5, -r * 0.7);
    g.rotate(0.62);
    g.fillStyle = '#4a4a5c';
    g.strokeStyle = '#1b1030';
    g.lineWidth = Math.max(3, r * 0.05);
    g.beginPath();
    g.roundRect(-r * 0.24, -r * 0.14, r * 0.48, r * 0.28, r * 0.06);
    g.fill();
    g.stroke();
    g.restore();
    // corpo
    const grd = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    grd.addColorStop(0, '#5b5b70');
    grd.addColorStop(0.5, '#23232e');
    grd.addColorStop(1, '#0c0c12');
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = Math.max(3, r * 0.06);
    g.strokeStyle = '#1b1030';
    g.stroke();
    // fascia colorata
    g.save();
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.clip();
    g.fillStyle = col;
    g.globalAlpha = 0.9;
    g.fillRect(-r, r * 0.42, r * 2, r * 0.2);
    g.restore();
    // riflesso
    g.beginPath();
    g.ellipse(-r * 0.4, -r * 0.42, r * 0.22, r * 0.12, -0.7, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    // display
    if (o.num != null) {
      const w = r * 1.05;
      const hh = r * 0.62;
      g.beginPath();
      g.roundRect(-w / 2, -hh / 2 - r * 0.02, w, hh, r * 0.1);
      g.fillStyle = '#12060a';
      g.fill();
      g.lineWidth = Math.max(2, r * 0.04);
      g.strokeStyle = col;
      g.stroke();
      const rosso = o.num <= 3;
      ctx.testo(g, String(o.num), 0, 0, { dim: Math.round(r * 0.52), colore: rosso && Math.floor(t * 8) % 2 ? '#ffffff' : '#ff3b3b', bordo: 0, peso: 800 });
    }
    g.restore();
  }

  function puntoVolo(b) {
    const a = mani(perId.get(b.chi));
    if (!b.volo) return { ...a, giro: 0 };
    const k = clamp(b.volo.t / (b.volo.da ? VOLO : VOLO * 1.6), 0, 1);
    const e = 1 - (1 - k) * (1 - k);
    const da = b.volo.da ? mani(perId.get(b.volo.da)) : { x: b.x, y: b.y };
    return { x: lerp(da.x, a.x, e), y: lerp(da.y, a.y, e) - Math.sin(k * Math.PI) * 140, giro: k * TAU };
  }

  function freccia(g, x1, y1, x2, y2, col, k) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    // tratteggio per tutta la strada, pieno fin dove è arrivato con i gesti
    g.save();
    g.lineCap = 'round';
    g.setLineDash([14, 16]);
    g.lineDashOffset = -t * 60;
    g.strokeStyle = col;
    g.globalAlpha = 0.45;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    if (k > 0) {
      const ex = x1 + dx * k;
      const ey = y1 + dy * k;
      g.strokeStyle = '#1b1030';
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(ex, ey);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 10;
      g.stroke();
      g.beginPath();
      g.moveTo(ex + ux * 22, ey + uy * 22);
      g.lineTo(ex - uy * 17 - ux * 6, ey + ux * 17 - uy * 6);
      g.lineTo(ex + uy * 17 - ux * 6, ey - ux * 17 - uy * 6);
      g.closePath();
      g.fillStyle = col;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#1b1030';
      g.stroke();
    }
    g.restore();
  }

  function disegnaGiocatore(g, q) {
    const b = bombaDi(q.id);
    const mira = bombe.find((x) => x.verso === q.id);
    const pilota = !q.p.bot && !ctx.connesso(q.id);
    if (!q.vivo) {
      g.save();
      g.globalAlpha = 0.5;
      g.filter = 'grayscale(1) brightness(0.6)';
      ctx.avatar(g, q.av, q.x, q.y, h, { pose: q.colpo > 0 ? 'hit' : 'sad', t, espr: 'stordito' });
      g.restore();
      g.filter = 'none';
      ctx.etichetta(g, `💀 ${q.p.nome}`, q.x, q.y + 24, '#5b5566', { dim: 19, maxW: 150 });
      return;
    }
    // faretto sotto chi ha la bomba, mirino sotto chi è il prossimo bersaglio
    if (b) {
      g.beginPath();
      g.ellipse(q.x, q.y, h * 0.42, h * 0.12, 0, 0, TAU);
      g.fillStyle = BOMBE[b.col].colore;
      g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 10);
      g.fill();
      g.globalAlpha = 1;
    } else if (mira) {
      const k = 0.5 + 0.5 * Math.sin(t * 9);
      g.beginPath();
      g.ellipse(q.x, q.y, h * (0.36 + 0.06 * k), h * (0.1 + 0.02 * k), 0, 0, TAU);
      g.lineWidth = 5;
      g.strokeStyle = BOMBE[mira.col].colore;
      g.globalAlpha = 0.5 + 0.4 * k;
      g.stroke();
      g.globalAlpha = 1;
    }
    // guarda la bomba più vicina
    let look = [0, 0];
    if (!b && bombe.length) {
      let best = null;
      let dm = Infinity;
      for (const x of bombe) {
        const o = perId.get(x.chi);
        const d = Math.hypot(o.x - q.x, o.y - q.y);
        if (d < dm) {
          dm = d;
          best = o;
        }
      }
      if (best) look = [clamp((best.x - q.x) / 400, -1, 1), clamp((best.y - q.y) / 400, -1, 1)];
    }
    let pose = 'idle';
    let espr = null;
    if (q.colpo > 0) {
      pose = 'hit';
      espr = 'stordito';
    } else if (b) {
      pose = 'cheer';
      espr = q.sbaglio > 0 ? 'arrabbiato' : 'sorpreso';
    } else if (mira) espr = 'sorpreso';
    const trema = mira && !b ? Math.sin(t * 50) * 2 : 0;
    ctx.avatar(g, q.av, q.x + trema, q.y, h, { pose, t: t + q.x * 0.01, espr, look });
    // fuliggine dopo lo scoppio
    if (q.colpo > 0) {
      g.fillStyle = `rgba(30,20,30,${Math.min(0.5, q.colpo * 0.3).toFixed(3)})`;
      g.beginPath();
      g.arc(q.x, q.y - h * 0.75, h * 0.26, 0, TAU);
      g.fill();
    }
    if (q.sbaglio > 0) ctx.testo(g, '❌', q.x + h * 0.32, q.y - h * 0.95, { dim: 40, bordo: 0 });
    ctx.etichetta(g, `${pilota ? '🤖 ' : ''}${q.p.nome}`, q.x, q.y + 24, q.p.colore, { dim: 19, maxW: 150 });
    let riga = q.y + 52;
    if (VITE > 1) {
      const cw = 28;
      const x0 = q.x - ((VITE - 1) * cw) / 2;
      for (let i = 0; i < VITE; i++) {
        const pieno = i < q.vite;
        const perso = i === q.vite && q.cuore > 0;
        const s = perso ? 1 + (1 - q.cuore) * 0.8 : 1;
        g.globalAlpha = pieno ? 1 : perso ? q.cuore : 0.3;
        ctx.testo(g, pieno || perso ? '❤️' : '🖤', x0 + i * cw, riga - (perso ? (1 - q.cuore) * 20 : 0), { dim: Math.round(22 * s), bordo: 0 });
        g.globalAlpha = 1;
      }
      riga += 28;
    }
    // avanzamento dei gesti di chi ha la bomba
    if (b) {
      const pw = 22;
      const x0 = q.x - ((LUNGHEZZA - 1) * pw) / 2;
      for (let i = 0; i < LUNGHEZZA; i++) {
        g.beginPath();
        g.arc(x0 + i * pw, riga, 8, 0, TAU);
        g.fillStyle = i < b.prog ? BOMBE[b.col].colore : 'rgba(255,255,255,0.18)';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#1b1030';
        g.stroke();
      }
    }
  }

  // -------------------------------------------------------------------------

  mandaViste();

  return {
    inizia() {
      const quante = bombePer(n);
      for (let i = 0; i < quante; i++) prossime.push(0.7 + i * 0.35);
    },

    aggiorna(dt) {
      t += dt;
      quadro++;
      // dopo una pausa l'orologio del telefono va rimesso a posto
      const ora = ctx.ora();
      if (oraPrima != null && ora - oraPrima > dt * 1000 + 500) mandaViste();
      oraPrima = ora;
      for (const q of gioc) {
        q.colpo = Math.max(0, q.colpo - dt);
        q.sbaglio = Math.max(0, q.sbaglio - dt);
        q.cuore = Math.max(0, q.cuore - dt);
      }
      for (const tr of tracce) tr.vita -= dt;
      tracce = tracce.filter((tr) => tr.vita > 0);
      // le bombe grandi scivolano al loro posto al centro
      const posti = POSTI[Math.max(0, Math.min(2, bombe.length - 1))];
      bombe.forEach((b, i) => {
        const p = posti[i] || posti[0];
        const k = 1 - Math.exp(-dt * 5);
        b.x += (p.x - b.x) * k;
        b.y += (p.y - b.y) * k;
        b.r += (p.r - b.r) * k;
      });
      if (finito) {
        fineTra -= dt;
        if (fineTra <= 0 && fineTra > -1) {
          fineTra = -2;
          ctx.fine(risultato());
        }
        return;
      }
      // bombe nuove
      if (prossime.length && prossime[0] <= t) {
        prossime.shift();
        if (bombe.length < bombePer(vivi().length)) {
          nuovaBomba();
          mandaViste();
        }
      }
      // pilota automatico per chi ha il telefono spento
      for (const q of gioc) if (!q.p.bot && q.vivo && !ctx.connesso(q.id)) pilota(q, dt);
      for (const b of [...bombe]) {
        b.tau += dt;
        b.nasce = Math.min(1, b.nasce + dt * 3);
        perId.get(b.chi).tenuta += dt;
        if (b.volo) {
          b.volo.t += dt;
          if (b.volo.t >= (b.volo.da ? VOLO : VOLO * 1.6)) b.volo = null;
        }
        const num = Math.ceil(display(b.B0, b.tau));
        if (num !== b.num) {
          b.num = num;
          b.batti = 1;
          if (num <= 3) sfx.bip();
          else sfx.tic();
        }
        b.batti = Math.max(0, b.batti - dt * 5);
        if (b.tau >= b.T) esplodi(b);
        if (finito) break;
      }
    },

    disegna(g) {
      let pericolo = 0;
      for (const b of bombe) pericolo = Math.max(pericolo, clamp(1 - display(b.B0, b.tau) / 6, 0, 1));
      sfondo(g, pericolo * (0.65 + 0.35 * Math.max(...bombe.map((b) => b.batti), 0)));

      // cavi dalle bombe grandi a chi le tiene
      for (const b of bombe) {
        const p = puntoVolo(b);
        g.save();
        g.lineCap = 'round';
        g.globalAlpha = 0.55;
        g.strokeStyle = '#1b1030';
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(b.x, b.y + b.r * 0.9);
        g.quadraticCurveTo((b.x + p.x) / 2, Math.max(b.y, p.y) + 120, p.x, p.y);
        g.stroke();
        g.strokeStyle = BOMBE[b.col].colore;
        g.lineWidth = 4;
        g.stroke();
        g.restore();
      }
      // scie dei passaggi appena fatti
      for (const tr of tracce) {
        const a = mani(perId.get(tr.da));
        const c = mani(perId.get(tr.a));
        g.save();
        g.globalAlpha = clamp(tr.vita / 1.3, 0, 1);
        g.strokeStyle = tr.col;
        g.lineWidth = 12 * g.globalAlpha + 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.quadraticCurveTo((a.x + c.x) / 2, (a.y + c.y) / 2 - 140, c.x, c.y);
        g.stroke();
        g.restore();
      }
      // giocatori (dall'alto in basso, così chi è davanti copre chi è dietro)
      for (const q of [...gioc].sort((a, b) => a.y - b.y)) disegnaGiocatore(g, q);
      // linee: da chi ha la bomba a chi la riceverà
      for (const b of bombe) {
        if (!b.verso || b.volo) continue;
        const a = mani(perId.get(b.chi));
        const v = perId.get(b.verso);
        freccia(g, a.x, a.y, v.x, v.y - h * 0.55, BOMBE[b.col].colore, b.prog / LUNGHEZZA);
      }
      // bombe grandi al centro
      for (const b of bombe) {
        const num = Math.ceil(display(b.B0, b.tau));
        const scossa = num <= 3 ? 4 : 0;
        const s = 0.4 + 0.6 * (1 - Math.pow(1 - b.nasce, 3));
        disegnaBomba(g, b.x + rand(-scossa, scossa), b.y + rand(-scossa, scossa), b.r * s, {
          colore: BOMBE[b.col].colore,
          num,
          miccia: 1 - b.tau / b.T,
          batti: b.batti,
        });
      }
      // bombe in mano (o in volo)
      for (const b of bombe) {
        const p = puntoVolo(b);
        disegnaBomba(g, p.x, p.y, h * 0.19, { colore: BOMBE[b.col].colore, miccia: 1 - b.tau / b.T, batti: b.batti, giro: p.giro });
      }

      // in alto a sinistra: bombe e giocatori in gioco
      ctx.pannello(g, 30, 20, 400, 70, { r: 35 });
      ctx.testo(g, `💣 ×${bombe.length || bombePer(vivi().length)}   ·   in piedi ${vivi().length}/${n}`, 230, 56, { dim: 32 });
      if (finito) {
        const nomi = vincitori.map((id) => perId.get(id).p.nome).join(' e ');
        ctx.pannello(g, W / 2 - 520, 20, 1040, 96, { r: 48, colore: 'rgba(25,12,60,0.85)' });
        ctx.testo(g, `🏆 ${nomi} resta in piedi!`, W / 2, 68, { dim: 52, colore: '#ffd23f', maxW: 980 });
      }
    },

    input(id, d) {
      if (!d || finito) return;
      const b = bombaDi(id);
      if (!b || d.k !== b.k) return;
      if (d.fatto) passa(b);
      else if (d.errore) sbaglia(b);
      else if (d.passo != null) avanza(b, d.passo);
    },

    bot(id, dt) {
      const q = perId.get(id);
      if (q && q.vivo && !finito) pilota(q, dt);
    },

    rientrato(id) {
      const q = perId.get(id);
      if (q) mandaViste(q);
    },

    // Per il banco di prova.
    statistiche() {
      return Object.fromEntries(gioc.map((q) => [q.id, { passaggi: q.passaggi, errori: q.errori, tenuta: q.tenuta, tenutaPassata: q.tenutaPassata }]));
    },
  };
}
