// Mani Incrociate (Twister per pollici): sul telefono due binari scorrono verso il basso e
// i due pollici devono restarci sopra senza mai staccarsi. I binari si incrociano, si
// allargano, ondeggiano. Sulla TV è una corsa a ostacoli: ognuno avanza quanto i suoi
// binari scorrono; chi stacca un pollice o esce dal binario inciampa e resta fermo 1,5 s.
// Più si resiste senza errori più si corre (fino a ×1,5). Vince chi arriva primo.

import { TAU, randInt, clamp, fmtNum, lerp, seeded } from '../../shared/util.js';
import { prepara } from '../../shared/avatar.js';
import { creaPista, LUNGHEZZA, DURATA, DOPO_PRIMO, PAUSA, COMBO_MAX, velocita } from './pista.js';
import { creaCorridore, parametriCpu } from './mani.js';

const J = 0.32; // mezzo salto sopra un ostacolo (in schermi di percorso)

export default {
  id: 'pollici',
  nome: 'Mani Incrociate',
  emoji: '🤞',
  colore: '#ff4f8b',
  descrizione: 'Twister per pollici: tieni i binari senza mai staccarti!',
  comeSiGioca: [
    '📱 Telefono in verticale, tenuto con DUE mani: si gioca solo con i pollici',
    'Pollice sinistro sul binario ROSSO, destro sul BLU. I binari scorrono, si incrociano e si allargano: non staccare mai i pollici!',
    'Se stacchi un pollice o esci dal binario inciampi: 1,5 secondi fermo, poi si riparte. Più resisti senza errori, più corri veloce',
    'Vince chi arriva primo al traguardo 🏁',
  ],
  controllo: 'pollici',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const seme = randInt(1, 1e9);
  const pista = creaPista(seme);
  const X0 = 290;
  const X1 = W - 190;
  const top = 150;
  const corsiaH = Math.min(185, (H - top - 40) / n);
  const y0 = top + (H - top - 40 - corsiaH * n) / 2;
  const hAv = Math.min(175, corsiaH * (n <= 4 ? 1.02 : 1.15));
  let inizio = null;
  let finito = false;
  let t = 0;
  let primoArrivo = -1;
  let arrivati = 0;
  let ultimaInfo = 0;

  const gioc = ctx.giocatori.map((p, i) => ({
    id: p.id,
    p,
    av: prepara(p.av),
    s: 0,
    vista: 0,
    ultimo: 0, // quando è arrivato l'ultimo avanzamento (t)
    combo: 1,
    errori: 0,
    st: 'attesa', // attesa | corre | giu | fatto
    giu: 0, // secondi dall'ultima caduta
    motivo: null,
    fatto: null,
    pos: 0,
    y: y0 + corsiaH * (i + 0.86), // piedi
    ia: null,
  }));
  const perId = new Map(gioc.map((q) => [q.id, q]));
  const xDi = (s) => X0 + (X1 - X0) * clamp(s / LUNGHEZZA, 0, 1);

  // Tribuna con il pubblico (fissa, dal seme).
  const rngT = seeded(seme);
  const pubblico = Array.from({ length: 220 }, () => ({ x: rngT.range(0, W), y: rngT.next(), c: rngT.int(0, 5), f: rngT.range(0, TAU) }));
  const COLORI_PUBBLICO = ['#ff4d6d', '#ffd23f', '#3ec6ff', '#4cd97b', '#b04dff', '#ffffff'];

  ctx.vista('*', { seme });

  function cade(q, motivo) {
    q.st = 'giu';
    q.giu = 0;
    q.combo = 1;
    q.motivo = motivo;
    const x = xDi(q.vista);
    fx.particelle(x + 10, q.y, { n: 14, colori: ['#c9a27a', '#e7d3b5', '#8d6e56'], vel: 220, velMin: 60, grav: 500, angolo: -Math.PI / 2, apertura: 1.3, vita: 0.7, dim: 8 });
    fx.testo(x + 30, q.y - hAv * 1.05, motivo === 'staccato' ? '✋ Staccato!' : '💥 Fuori!', { colore: '#ff4d6d', dim: Math.max(24, Math.min(40, corsiaH * 0.36)), vita: 1.1 });
    sfx.colpo(0.7);
  }

  function arriva(q, ms) {
    if (q.fatto != null) return;
    q.fatto = ms;
    q.st = 'fatto';
    q.s = LUNGHEZZA;
    q.pos = ++arrivati;
    if (primoArrivo < 0) {
      primoArrivo = ctx.tempo;
      sfx.fanfara();
      fx.coriandoli(70);
    } else sfx.ding();
    fx.particelle(X1, q.y - hAv * 0.4, { n: 30, colori: [q.p.colore, '#fff', '#ffd23f'], vel: 380, grav: 400 });
    fx.testo(X1 - 40, q.y - hAv, `${fmtNum(ms / 1000, 1)} s`, { colore: '#ffd23f', dim: 34 });
    if (!q.p.bot) ctx.invia(q.id, { arrivo: q.pos, tot: n });
  }

  function ordine() {
    return [...gioc].sort((a, b) => {
      if (a.fatto != null && b.fatto != null) return a.fatto - b.fatto;
      if (a.fatto != null) return -1;
      if (b.fatto != null) return 1;
      return b.s - a.s;
    });
  }

  function termina() {
    if (finito) return;
    finito = true;
    ctx.vista('*', { seme, inizio, finito: true });
    const gruppi = [];
    for (const q of ordine()) {
      const ultimo = gruppi[gruppi.length - 1];
      const ref = ultimo && perId.get(ultimo[0]);
      const pari = ref && (ref.fatto != null && q.fatto != null ? Math.abs(ref.fatto - q.fatto) < 50 : ref.fatto == null && q.fatto == null && Math.abs(ref.s - q.s) < 1e-6);
      if (pari) ultimo.push(q.id);
      else gruppi.push([q.id]);
    }
    const dettagli = {};
    for (const q of gioc) {
      const err = `❌ ${q.errori}`;
      dettagli[q.id] = q.fatto != null ? `${fmtNum(q.fatto / 1000, 1)} s · ${err}` : `${Math.round((q.s / LUNGHEZZA) * 100)}% · ${err}`;
    }
    ctx.fine({ gruppi, dettagli });
  }

  // -------------------------------------------------------------------------
  // Disegno

  function sfondo(g) {
    const cielo = g.createLinearGradient(0, 0, 0, H);
    cielo.addColorStop(0, '#5ec2f2');
    cielo.addColorStop(0.35, '#a8e0ff');
    cielo.addColorStop(0.36, '#4fae4a');
    cielo.addColorStop(1, '#3b8f3a');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, H);
    // tribuna sopra la pista, se c'è posto
    const yT = Math.min(y0 - 30, H * 0.36);
    if (yT > 150) {
      g.fillStyle = '#5b5670';
      g.fillRect(0, 120, W, yT - 120);
      for (let r = 0; r < 6; r++) {
        g.fillStyle = r % 2 ? '#6b6680' : '#524d66';
        g.fillRect(0, 120 + ((yT - 120) * r) / 6, W, 4);
      }
      const esulta = arrivati > 0 ? 1 : 0.35;
      for (const f of pubblico) {
        const y = 128 + f.y * (yT - 150) - Math.abs(Math.sin(t * 6 + f.f)) * 6 * esulta;
        g.beginPath();
        g.arc(f.x, y, 7, 0, TAU);
        g.fillStyle = COLORI_PUBBLICO[f.c];
        g.fill();
      }
      g.fillStyle = '#2f2b3d';
      g.fillRect(0, yT - 6, W, 10);
    }
    // pista di atletica
    const yA = y0 - 14;
    const yB = y0 + corsiaH * n + 14;
    g.fillStyle = '#c8553d';
    g.fillRect(X0 - 80, yA, X1 - X0 + 220, yB - yA);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(X0 - 80, y0 + corsiaH * i);
      g.lineTo(X1 + 140, y0 + corsiaH * i);
      g.stroke();
    }
    // partenza, tacche ogni quarto e traguardo a scacchi
    g.fillStyle = '#fff';
    g.fillRect(X0 - 3, y0, 6, corsiaH * n);
    for (const k of [0.25, 0.5, 0.75]) {
      const x = xDi(LUNGHEZZA * k);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x - 2, y0, 4, corsiaH * n);
      ctx.testo(g, `${k * 100}%`, x, yA - 16, { dim: 20, colore: '#fff' });
    }
    const q = 16;
    for (let yy = 0; yy < corsiaH * n; yy += q) {
      for (let k = 0; k < 3; k++) {
        g.fillStyle = (Math.floor(yy / q) + k) % 2 ? '#1b1030' : '#fff';
        g.fillRect(X1 + 20 + k * q, y0 + yy, q, Math.min(q, corsiaH * n - yy));
      }
    }
    ctx.testo(g, '🏁', X1 + 44, yA - 20, { dim: 34, bordo: 0 });
  }

  function ostacolo(g, tipo, x, y, k) {
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    g.lineWidth = 3;
    g.strokeStyle = '#1b1030';
    if (tipo === 'ostacolo') {
      g.fillStyle = '#3a3a4a';
      g.fillRect(-17, -36, 4, 36);
      g.fillRect(13, -36, 4, 36);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? '#ff3b5c' : '#ffffff';
        g.fillRect(-20 + i * 10, -42, 10, 10);
      }
      g.strokeRect(-20, -42, 40, 10);
    } else if (tipo === 'pozza') {
      g.beginPath();
      g.ellipse(0, -4, 34, 9, 0, 0, TAU);
      g.fillStyle = '#3ea2ff';
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(-8, -6, 12, 3, 0, 0, TAU);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fill();
    } else if (tipo === 'coni') {
      for (const dx of [-14, 14]) {
        g.beginPath();
        g.moveTo(dx - 9, 0);
        g.lineTo(dx, -28);
        g.lineTo(dx + 9, 0);
        g.closePath();
        g.fillStyle = '#ff8a3d';
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.fillRect(dx - 5, -16, 10, 4);
      }
    } else if (tipo === 'balla') {
      g.beginPath();
      g.roundRect(-22, -28, 44, 28, 6);
      g.fillStyle = '#e8c15a';
      g.fill();
      g.stroke();
      g.strokeStyle = '#b08a2e';
      g.beginPath();
      g.moveTo(-8, -28);
      g.lineTo(-8, 0);
      g.moveTo(8, -28);
      g.lineTo(8, 0);
      g.stroke();
    } else if (tipo === 'cancello') {
      for (const dx of [-20, 20]) {
        g.fillStyle = '#6b4a2e';
        g.fillRect(dx - 3, -48, 6, 48);
        g.beginPath();
        g.moveTo(dx + 3, -48);
        g.lineTo(dx + 16 * Math.sign(-dx), -42);
        g.lineTo(dx + 3, -36);
        g.fillStyle = '#ffd23f';
        g.fill();
      }
    } else if (tipo === 'gomme') {
      for (const dx of [-13, 13]) {
        g.beginPath();
        g.ellipse(dx, -8, 12, 8, 0, 0, TAU);
        g.fillStyle = '#26232e';
        g.fill();
        g.beginPath();
        g.ellipse(dx, -8, 5, 3, 0, 0, TAU);
        g.fillStyle = '#6b6680';
        g.fill();
      }
    }
    g.restore();
  }

  function corridore(g, q) {
    const x = xDi(q.vista);
    const y = q.y;
    const k = corsiaH / 125;
    if (q.st === 'giu' && q.giu < PAUSA) {
      // inciampa e finisce lungo disteso, con le stelline
      const a = Math.min(1, q.giu / 0.35);
      const giro = (1 - (1 - a) * (1 - a)) * 1.4;
      g.save();
      g.translate(x + a * 14 * k, y);
      g.rotate(giro);
      ctx.avatar(g, q.av, 0, 0, hAv, { pose: 'hit', t, espr: 'stordito', ombra: false });
      g.restore();
      const cx = x + Math.sin(giro) * hAv * 0.8 + a * 14 * k;
      const cy = y - Math.cos(giro) * hAv * 0.8 - hAv * 0.1;
      for (let i = 0; i < 3; i++) {
        const an = t * 5 + (i * TAU) / 3;
        ctx.testo(g, '⭐', cx + Math.cos(an) * hAv * 0.22, cy + Math.sin(an) * hAv * 0.08, { dim: Math.max(12, hAv * 0.14), bordo: 0 });
      }
      return;
    }
    let pose = 'idle';
    let espr = null;
    let salto = 0;
    if (q.st === 'corre') {
      pose = 'run';
      for (const o of pista.ostacoli) {
        const d = q.vista - o.s;
        if (d > -J && d < J) salto = Math.max(salto, Math.sin((Math.PI * (d + J)) / (2 * J)));
      }
      if (salto > 0.25) pose = 'jump';
      espr = q.combo >= 1.35 ? 'felice' : null;
    } else if (q.st === 'giu') espr = 'arrabbiato'; // si rialza e rimette i pollici
    else if (q.st === 'fatto') pose = 'cheer';
    const yy = y - salto * hAv * 0.3;
    // scia della velocità
    if (q.st === 'corre' && q.combo > 1.15) {
      g.save();
      g.globalAlpha = clamp((q.combo - 1.15) * 2.5, 0, 0.8);
      g.strokeStyle = '#fff';
      g.lineCap = 'round';
      g.lineWidth = Math.max(2, 4 * k);
      for (let i = 0; i < 3; i++) {
        const ly = yy - hAv * (0.25 + i * 0.2);
        const lun = hAv * (0.35 + 0.3 * (q.combo - 1)) * (1 + 0.3 * Math.sin(t * 20 + i));
        g.beginPath();
        g.moveTo(x - hAv * 0.3, ly);
        g.lineTo(x - hAv * 0.3 - lun, ly);
        g.stroke();
      }
      g.restore();
    }
    ctx.avatar(g, q.av, x, yy, hAv, { pose, t: t + q.y * 0.01, espr, dir: 1, ombra: salto < 0.1 });
    if (q.st === 'corre' && q.combo >= 1.25) {
      const testo = corsiaH >= 70 ? `🔥×${fmtNum(q.combo, 1)}` : '🔥';
      ctx.testo(g, testo, x + hAv * 0.42, yy - hAv * 0.95, { dim: Math.max(16, Math.min(26, corsiaH * 0.22)), colore: '#ffd23f' });
    }
    if (q.st === 'fatto') ctx.testo(g, ['🥇', '🥈', '🥉'][q.pos - 1] || `${q.pos}°`, x + hAv * 0.45, yy - hAv * 0.9, { dim: Math.max(20, Math.min(36, corsiaH * 0.3)), bordo: q.pos > 3 ? undefined : 0 });
  }

  // -------------------------------------------------------------------------

  return {
    inizia() {
      inizio = ctx.ora() + 150;
      ctx.vista('*', { seme, inizio });
    },

    aggiorna(dt) {
      t += dt;
      for (const q of gioc) {
        q.giu += dt;
        // tra un messaggio e l'altro del telefono si stima dove è arrivato
        const stima = q.st === 'corre' ? q.s + velocita(q.s, q.combo) * Math.min(0.35, t - q.ultimo) : q.s;
        q.vista = Math.min(LUNGHEZZA, Math.max(q.vista, lerp(q.vista, stima, Math.min(1, dt * 8))));
      }
      if (finito || inizio == null) return;
      const tutti = gioc.every((q) => q.fatto != null);
      if (tutti || ctx.tempo >= DURATA || (primoArrivo >= 0 && ctx.tempo - primoArrivo >= DOPO_PRIMO)) return termina();
      // ogni tanto diciamo a ciascuno in che posizione è
      if (ctx.tempo - ultimaInfo > 0.7) {
        ultimaInfo = ctx.tempo;
        ordine().forEach((q, i) => {
          if (q.fatto == null && !q.p.bot) ctx.invia(q.id, { pos: i + 1, tot: n });
        });
      }
    },

    disegna(g) {
      sfondo(g);
      const k = corsiaH / 125;
      gioc.forEach((q, i) => {
        const ym = y0 + corsiaH * (i + 0.5);
        for (const o of pista.ostacoli) ostacolo(g, o.tipo, xDi(o.s), q.y, k);
        corridore(g, q);
        ctx.etichetta(g, q.p.nome, 140, ym, q.p.colore, { dim: Math.max(15, Math.min(22, corsiaH * 0.25)), maxW: 230 });
        const destra = q.fatto != null ? `${fmtNum(q.fatto / 1000, 1)} s` : `❌ ${q.errori}`;
        ctx.testo(g, destra, W - 60, ym, { dim: Math.max(16, Math.min(28, corsiaH * 0.3)), colore: q.fatto != null ? '#4cd97b' : '#fff' });
      });
      // HUD
      ctx.barraTempo(g, DURATA - ctx.tempo, DURATA, { w: 560, x: 60, y: 40 });
      const primo = ordine()[0];
      if (primo && !finito) {
        ctx.pannello(g, W / 2 - 40, 20, 640, 80, { r: 40 });
        ctx.testo(g, `In testa: ${primo.p.nome}`, W / 2 + 280, 60, { dim: 40, colore: primo.p.colore, maxW: 600 });
      }
      if (primoArrivo >= 0 && !finito) ctx.testo(g, `Ultimi ${Math.max(0, Math.ceil(DOPO_PRIMO - (ctx.tempo - primoArrivo)))} s!`, W - 170, 60, { dim: 40, colore: '#ffd23f' });
      else ctx.testo(g, `🏁 ${arrivati}/${n}`, W - 120, 60, { dim: 38 });
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || finito || !d || q.fatto != null) return;
      if (typeof d.e === 'number' && isFinite(d.e)) q.errori = Math.max(q.errori, Math.floor(d.e));
      if (typeof d.s === 'number' && isFinite(d.s) && d.s >= q.s) {
        q.s = Math.min(LUNGHEZZA, d.s);
        q.ultimo = t;
      }
      if (typeof d.c === 'number' && isFinite(d.c)) q.combo = clamp(d.c, 1, COMBO_MAX);
      if (d.cade) cade(q, d.cade === 'staccato' ? 'staccato' : 'fuori');
      else if (d.st === 'corre' && q.st !== 'corre') {
        q.st = 'corre';
        q.ultimo = t;
      }
      if (typeof d.fatto === 'number' && isFinite(d.fatto)) arriva(q, clamp(d.fatto, 0, (DURATA + 5) * 1000));
    },

    // La CPU "tiene in mano" un telefono simulato (mani.js) e manda gli stessi messaggi:
    // { st, s, c, e } mentre corre, { cade, s, e } quando sbaglia, { fatto, e } all'arrivo.
    bot(id, dt) {
      const q = perId.get(id);
      if (finito || inizio == null || q.fatto != null) return;
      const tt = (ctx.ora() - inizio) / 1000;
      if (tt < 0) return;
      const cpu = ctx.cpu(id);
      const r = q.ia || (q.ia = creaCorridore(pista, parametriCpu(cpu), cpu));
      for (const d of r.passo(dt, tt)) this.input(id, d);
    },
  };
}
