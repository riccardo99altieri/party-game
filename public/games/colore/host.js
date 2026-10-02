// Colore Perfetto: ricrea con il telefono il colore mostrato sullo schermo.
// Round 1 il colore resta visibile, poi lo si vede solo per pochi secondi.

import { TAU, rand, clamp, fmtNum, hsvToRgb, rgbToHex, rgbToLab, deltaE2000, rgbToHsv, ease } from '../../shared/util.js';

const ROUND = [
  { vista: null, titolo: 'Copia il colore', sotto: 'Il colore resta sullo schermo' },
  { vista: 3, titolo: 'A memoria!', sotto: 'Lo vedi solo per 3 secondi' },
  { vista: 1.5, titolo: 'Sguardo lampo!', sotto: 'Solo 1,5 secondi!' },
];
const T_SCELTA = 14;
const T_RIVELA = 6;

export const punteggioColore = (a, b) => {
  const d = deltaE2000(rgbToLab(a), rgbToLab(b));
  return { punti: Math.round(Math.max(0, 100 - d * 2) * 10) / 10, delta: d };
};

// --- CPU ---------------------------------------------------------------------
// La CPU non conosce il colore: ne ha una stima (percezione e memoria in CIELab, lo
// spazio "come lo vede l'occhio"), poi la ricrea sul selettore HSV del telefono con il
// dito, confrontando e ritoccando come una persona. Errori tipici:
// - il telefono e lo schermo grande non mostrano gli stessi colori (scarto fisso per CPU);
// - a memoria la tinta scivola verso il colore "tipico" più vicino (rosso, arancio, giallo,
//   verde, azzurro, blu, viola, rosa), il colore si ricorda più saturo e la luminosità
//   va verso il medio; tutto si sfuoca col passare dei secondi;
// - sul selettore la tinta si azzecca meglio di saturazione e luminosità.
// Le funzioni sono esportate per il banco di prova (test/bench/precisione.mjs).

export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116;
  const inv = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
  const X = inv(fy + a / 500) * 0.95047;
  const Y = inv(fy);
  const Z = inv(fy - b / 200) * 1.08883;
  const gamma = (c) => {
    c = clamp(c, 0, 1);
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  };
  return [
    gamma(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z),
    gamma(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z),
    gamma(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z),
  ];
}

const gradi = (lab) => ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;
const diffGradi = (a, b) => ((b - a + 540) % 360) - 180;
// Tinte "tipiche" (categorie di colore) come angoli CIELab.
const TIPICI = [
  [215, 35, 45],
  [250, 140, 20],
  [250, 215, 30],
  [60, 170, 70],
  [20, 175, 200],
  [40, 90, 215],
  [130, 60, 190],
  [235, 105, 170],
].map((c) => gradi(rgbToLab(c)));

function versoTipico(h) {
  let d = 180;
  for (const p of TIPICI) {
    const x = diffGradi(h, p);
    if (Math.abs(x) < Math.abs(d)) d = x;
  }
  return d;
}

// Scarto fisso tra lo schermo grande e il telefono di questa CPU (Lab).
export function scartoSchermo(cpu) {
  return [cpu.errore(3.4), cpu.errore(3.2), cpu.errore(3.2)];
}

// Stima del colore visto per `secondi` (null = visibile adesso, confronto diretto).
export function vediColore(cpu, rgb, secondi, scarto) {
  const [L0, a0, b0] = rgbToLab(rgb);
  const lab = [L0 + scarto[0], a0 + scarto[1], b0 + scarto[2]];
  let C = Math.hypot(lab[1], lab[2]);
  let h = gradi(lab);
  let L = lab[0];
  if (secondi == null) {
    h += cpu.errore(cpu.per(5, 3.5, 2.2));
    C *= Math.exp(cpu.errore(cpu.per(0.12, 0.08, 0.05)));
    L += cpu.errore(cpu.per(3.5, 2.6, 1.6));
  } else {
    // meno tempo per guardare = ricordo più povero
    const k = Math.pow(3 / Math.max(0.8, secondi), 0.35);
    h += cpu.errore(cpu.per(17, 12.5, 8.5) * k) + versoTipico(h) * cpu.per(0.3, 0.22, 0.12);
    // la memoria esagera la saturazione: i bravi lo sanno e ne tengono conto
    C *= Math.exp(cpu.errore(cpu.per(0.28, 0.22, 0.14) * k)) * (1 + cpu.per(0.12, 0.09, 0.03));
    L += cpu.errore(cpu.per(11, 8.5, 5.5) * k) + (55 - L) * cpu.per(0.15, 0.1, 0.05);
  }
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}

// Il ricordo si sfuoca: piccola deriva casuale (Lab) per `dt` secondi.
export function sfuma(cpu, lab, dt) {
  const s = cpu.per(1.6, 1.2, 0.8) * Math.sqrt(dt);
  return [lab[0] + cpu.errore(s), lab[1] + cpu.errore(s), lab[2] + cpu.errore(s)];
}

// Un gesto sul selettore verso il colore creduto: `parte` = 'tinta' (anello) o
// 'quadrato' (saturazione/luminosità). `quanto` < 1: ritocco (si corregge solo una
// parte dell'errore, con meno rumore).
export function gesto(cpu, hsv, lab, parte, quanto = 1) {
  const [h, s, v] = rgbToHsv(labToRgb(lab));
  const [h0, s0, v0] = hsv;
  const k = quanto < 1 ? 0.6 : 1;
  let nh = h0;
  let ns = s0;
  let nv = v0;
  if (parte !== 'quadrato') nh = (h0 + diffGradi(h0, h) * quanto + cpu.errore(cpu.per(6, 4, 2.5) * k) + 360) % 360;
  if (parte !== 'tinta') {
    ns = clamp(s0 + (s - s0) * quanto + cpu.errore(cpu.per(0.09, 0.065, 0.045) * k), 0, 1);
    nv = clamp(v0 + (v - v0) * quanto + cpu.errore(cpu.per(0.08, 0.055, 0.04) * k), 0, 1);
  }
  return [nh, ns, nv];
}

// Piano completo di un round, deciso quando la CPU comincia a scegliere: una lista di
// passi { t, c } (colori mandati mentre muove il dito) e il momento della conferma.
// `vero` serve solo col colore visibile (round 1): lo si riguarda a ogni ritocco.
export function pianoColore(cpu, { ricordo, vero, scarto, tempo }) {
  const { pazienza, aggressivita } = cpu.tratti;
  const passi = [];
  // col colore davanti si osserva con calma; a memoria si parte subito per non dimenticare
  const calma = ricordo ? 1 : 1.25;
  let t = cpu.reazione() + cpu.pensa(0.3, 1.1) * calma;
  // il ricordo si sfuoca anche mentre si muove il dito (per questo i bravi fanno presto)
  const guarda = (dopo) => (ricordo ? (lab = sfuma(cpu, lab, dopo)) : (lab = vediColore(cpu, vero, null, scarto)));
  let lab = ricordo;
  const hsv0 = [cpu.num(0, 360), 0.5, 0.75]; // come parte il selettore del telefono
  let dopo = cpu.num(0.8, 1.6) * calma;
  guarda(t + dopo);
  t += dopo;
  let hsv = gesto(cpu, hsv0, lab, 'tinta');
  passi.push({ t, c: hsvToRgb(...hsv) });
  dopo = cpu.num(0.9, 1.9) * calma;
  guarda(dopo);
  t += dopo;
  hsv = gesto(cpu, hsv, lab, 'quadrato');
  passi.push({ t, c: hsvToRgb(...hsv) });
  // Ritocchi: si confronta e si corregge finché la differenza vista supera la propria
  // soglia (i pazienti guardano meglio e insistono di più), senza sforare il tempo.
  const soglia = cpu.per(11, 7.5, 4.8) * (1.25 - 0.5 * pazienza);
  let ritocchi = Math.round(cpu.per(1, 2, 3) + 2 * pazienza - aggressivita);
  while (ritocchi-- > 0 && t < tempo - 3) {
    dopo = ricordo ? cpu.num(0.6, 1.2) : cpu.num(1, 2);
    guarda(dopo);
    t += dopo;
    const mio = rgbToLab(hsvToRgb(...hsv));
    if (deltaE2000(mio, lab) + cpu.errore(1) < soglia) break;
    const [h1] = rgbToHsv(labToRgb(lab));
    const erroreTinta = (Math.abs(diffGradi(hsv[0], h1)) / 60) * hsv[1];
    hsv = gesto(cpu, hsv, lab, erroreTinta > 0.12 ? 'tinta' : 'quadrato', cpu.num(0.55, 0.85));
    passi.push({ t, c: hsvToRgb(...hsv) });
  }
  // col colore davanti agli occhi si dà un'ultima occhiata prima di confermare
  if (!ricordo) t += cpu.pensa(0.4, 1.4);
  return { passi, conferma: Math.min(tempo - 0.4, t + cpu.reazione(0.9)) };
}

export default {
  id: 'colore',
  nome: 'Colore Perfetto',
  emoji: '🌈',
  colore: '#facc15',
  descrizione: 'Ricrea il colore identico con la ruota dei colori!',
  comeSiGioca: [
    'Sullo schermo appare un colore',
    "Ricrealo sul telefono: tinta sull'anello, chiaro/scuro nel quadrato",
    '3 round: nel secondo e nel terzo il colore sparisce presto!',
  ],
  controllo: 'colore',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  let round = 0;
  let fase = 'annuncio'; // annuncio | mostra | scelta | rivela
  let tFase = 0;
  let t = 0;
  let finito = false;
  let fineScelta = 0;
  const bersagli = ROUND.map(() => hsvToRgb(rand(0, 360), rand(0.45, 0.95), rand(0.45, 0.95)).map(Math.round));
  const scelte = ROUND.map(() => ({})); // [round][id] = { rgb, ok, punti, delta }
  const totali = Object.fromEntries(ctx.giocatori.map((p) => [p.id, 0]));
  const perId = new Map(ctx.giocatori.map((p) => [p.id, p]));
  const cpuStato = {}; // id -> { scarto, ricordo, piano } della CPU

  function vista() {
    const R = ROUND[round];
    const base = { round, tot: ROUND.length, titolo: R.titolo, sotto: R.sotto, fase };
    if (fase === 'scelta') base.fine = fineScelta;
    if (fase === 'rivela') {
      for (const p of ctx.giocatori) {
        const s = scelte[round][p.id];
        ctx.vista(p.id, { ...base, punti: s ? s.punti : 0, totale: totali[p.id], mio: s ? s.rgb : null, vero: bersagli[round] });
      }
      return;
    }
    ctx.vista('*', base);
  }

  function vaiA(f) {
    fase = f;
    tFase = 0;
    if (f === 'scelta') {
      fineScelta = ctx.ora() + T_SCELTA * 1000;
      sfx.via();
    }
    if (f === 'mostra') sfx.ding();
    if (f === 'annuncio') sfx.whoosh();
    if (f === 'rivela') {
      for (const p of ctx.giocatori) {
        const s = scelte[round][p.id];
        if (s && s.rgb) Object.assign(s, punteggioColore(s.rgb, bersagli[round]));
        totali[p.id] += s && s.punti ? s.punti : 0;
      }
      sfx.rullo(1);
      setTimeout(() => sfx.ding(), 1000);
    }
    vista();
  }
  vaiA('annuncio');

  function termina() {
    finito = true;
    const punteggi = {};
    for (const p of ctx.giocatori) punteggi[p.id] = Math.round(totali[p.id] * 10) / 10;
    ctx.fine({ punteggi, alto: true, fmt: (v) => `${fmtNum(v / ROUND.length, 1)}% di media` });
  }

  const visibile = () => {
    const R = ROUND[round];
    if (fase === 'mostra') return true;
    if (fase === 'scelta') return R.vista == null;
    return fase === 'rivela';
  };

  function blob(g, x, y, r, rgb, wob = 1) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      const rr = r * (1 + Math.sin(a * 3 + t * 2) * 0.04 * wob + Math.sin(a * 5 - t * 1.5) * 0.03 * wob);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = rgbToHex(rgb);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#1b1030';
    g.stroke();
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      if (finito) return;
      const R = ROUND[round];
      if (fase === 'annuncio' && tFase >= 2.5) vaiA(R.vista ? 'mostra' : 'scelta');
      else if (fase === 'mostra' && tFase >= R.vista) vaiA('scelta');
      else if (fase === 'scelta') {
        const tutti = ctx.giocatori.every((p) => scelte[round][p.id]?.ok);
        if ((tutti && tFase > 1) || ctx.ora() >= fineScelta) vaiA('rivela');
      } else if (fase === 'rivela' && tFase >= T_RIVELA) {
        if (round < ROUND.length - 1) {
          round++;
          vaiA('annuncio');
        } else termina();
      }
    },

    disegna(g) {
      // Sfondo neutro: altri colori intorno ingannerebbero l'occhio.
      g.fillStyle = '#e8e6ee';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.06;
      g.fillStyle = '#1b1030';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc((i * 263) % W, (i * 397) % H, 120 + (i % 3) * 40, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      const R = ROUND[round];
      ctx.pannello(g, 40, 20, 330, 76, { r: 38 });
      ctx.testo(g, `Round ${round + 1} di ${ROUND.length}`, 205, 58, { dim: 38 });

      if (fase === 'annuncio') {
        const k = ease.outBack(clamp(tFase / 0.5, 0, 1));
        g.save();
        g.translate(W / 2, H / 2);
        g.scale(k, k);
        ctx.testo(g, R.titolo, 0, -40, { dim: 130, colore: '#facc15', bordo: 16 });
        ctx.testo(g, R.sotto, 0, 90, { dim: 54 });
        g.restore();
        return;
      }

      if (fase === 'mostra' || fase === 'scelta') {
        if (visibile()) blob(g, W / 2, H / 2 - 20, 300, bersagli[round]);
        else {
          blob(g, W / 2, H / 2 - 20, 300, [200, 196, 214], 0.3);
          ctx.testo(g, '?', W / 2, H / 2 - 20, { dim: 300, colore: '#fff', bordo: 18 });
        }
        if (fase === 'mostra') {
          ctx.testo(g, `Memorizza! ${fmtNum(Math.max(0, R.vista - tFase), 1)}`, W / 2, 110, { dim: 64, colore: '#ffd23f' });
        } else {
          ctx.barraTempo(g, (fineScelta - ctx.ora()) / 1000, T_SCELTA, { w: 700, x: W / 2 - 350, y: 40 });
          const fatti = ctx.giocatori.filter((p) => scelte[round][p.id]?.ok).length;
          ctx.testo(g, `Scegli sul telefono! (${fatti}/${n})`, W / 2, H - 60, { dim: 44 });
        }
        return;
      }

      // rivela: il colore vero a sinistra, i tentativi a destra
      const vero = bersagli[round];
      blob(g, 330, 560, 230, vero, 0.5);
      ctx.testo(g, 'Il colore era', 330, 270, { dim: 46 });
      const celle = ctx.griglia(n, 640, 140, W - 690, H - 180, { rapporto: 1.5, spazio: 16 });
      const k = clamp(tFase / 1.4, 0, 1);
      let migliore = -1;
      for (const p of ctx.giocatori) migliore = Math.max(migliore, scelte[round][p.id]?.punti ?? 0);
      ctx.giocatori.forEach((p, i) => {
        const c = celle[i];
        const s = scelte[round][p.id];
        ctx.pannello(g, c.x, c.y, c.w, c.h, { colore: '#fff', bordo: p.colore, lw: 5, r: 18 });
        const sw = Math.min(c.h * 0.62, c.w * 0.45);
        // metà vero, metà scelto
        g.save();
        g.beginPath();
        g.arc(c.x + 16 + sw / 2, c.y + c.h / 2, sw / 2, Math.PI / 2, Math.PI * 1.5);
        g.fillStyle = rgbToHex(vero);
        g.fill();
        g.beginPath();
        g.arc(c.x + 16 + sw / 2, c.y + c.h / 2, sw / 2, -Math.PI / 2, Math.PI / 2);
        g.fillStyle = s && s.rgb ? rgbToHex(s.rgb) : '#ddd';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#1b1030';
        g.beginPath();
        g.arc(c.x + 16 + sw / 2, c.y + c.h / 2, sw / 2, 0, TAU);
        g.stroke();
        g.restore();
        const tx = c.x + 30 + sw;
        const dim = Math.min(34, c.h * 0.22);
        ctx.testo(g, p.nome, tx, c.y + c.h * 0.32, { dim: dim * 0.85, allinea: 'left', maxW: c.w - sw - 44 });
        const val = (s ? s.punti : 0) * ease.outCubic(k);
        const top = k >= 1 && s && s.punti === migliore && migliore > 0;
        ctx.testo(g, s && s.rgb ? `${fmtNum(val, 1)}%` : 'nessuna scelta', tx, c.y + c.h * 0.68, { dim: dim * (s && s.rgb ? 1.2 : 0.7), allinea: 'left', colore: top ? '#ffd23f' : '#fff' });
        if (top) ctx.testo(g, '👑', c.x + c.w - 26, c.y + 24, { dim: 36, bordo: 0 });
      });
    },

    input(id, d) {
      if (fase !== 'scelta' || !perId.has(id) || !d) return;
      const s = scelte[round][id] || (scelte[round][id] = { rgb: null, ok: false });
      if (s.ok) return;
      if (Array.isArray(d.c) && d.c.length === 3 && d.c.every((x) => isFinite(x))) s.rgb = d.c.map((x) => clamp(Math.round(x), 0, 255));
      if (d.ok && s.rgb) {
        s.ok = true;
        sfx.pop();
      }
    },

    // Stessi dati del telefono: { c } mentre il dito si muove sul selettore, { c, ok } alla conferma.
    bot(id, dt) {
      const cpu = ctx.cpu(id);
      const b = cpuStato[id] || (cpuStato[id] = { scarto: scartoSchermo(cpu), visto: -1, round: -1 });
      const R = ROUND[round];
      if (fase === 'mostra' && b.visto !== round) {
        // Guarda il colore finché resta sullo schermo (alza gli occhi un attimo dopo il "ding"):
        // da qui in poi la CPU ha solo il suo ricordo, non il colore vero.
        b.visto = round;
        b.ricordo = vediColore(cpu, bersagli[round], R.vista - cpu.reazione(0.8), b.scarto);
      }
      if (fase !== 'scelta' || scelte[round][id]?.ok) return;
      if (b.round !== round) {
        b.round = round;
        b.t = 0;
        b.i = 0;
        b.ultimo = null;
        const ricordo = R.vista ? (b.visto === round ? b.ricordo : vediColore(cpu, bersagli[round], 0.8, b.scarto)) : null;
        b.piano = pianoColore(cpu, { ricordo, vero: ricordo ? null : bersagli[round], scarto: b.scarto, tempo: (fineScelta - ctx.ora()) / 1000 });
      }
      b.t += dt;
      const { passi, conferma } = b.piano;
      while (b.i < passi.length && passi[b.i].t <= b.t) {
        b.ultimo = passi[b.i++].c;
        this.input(id, { c: b.ultimo });
      }
      if (b.t >= conferma && b.ultimo) this.input(id, { c: b.ultimo, ok: 1 });
    },
  };
}
