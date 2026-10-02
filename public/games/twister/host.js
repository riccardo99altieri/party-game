// Twister delle Dita: ognuno tiene le dita sui cerchi del proprio telefono.
// Chi stacca un dito (o non arriva in tempo) è fuori. Vince chi resiste di più.

import { TAU, rand, randInt, clamp, fmtNum } from '../../shared/util.js';
import { BERSAGLI, appare, scadenza, INIZIO_MOVIMENTO, DURATA, creaCerchi, posizioneCerchio, raggioCerchio } from './regole.js';

const COLORI = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7'];

// --- CPU ---------------------------------------------------------------------
// La CPU guarda il proprio telefono: stessi cerchi e stesso movimento di phone.js (dal
// seme), su uno schermo tipico di 390x760 px (~6x12 cm, 1 px ≈ 0,16 mm).
// - Piazzare un dito: tempo di reazione + spostamento (legge di Fitts), più lento e più
//   scomodo a ogni dito in più perché la mano è già "inchiodata"; ogni tanto le ultime
//   dita non ci arrivano (si stacca un dito o si scade il tempo).
// - Tenere le dita quando i cerchi si muovono: ogni dito insegue il suo cerchio (visto con
//   un attimo di ritardo); quello che si sta guardando lo segue bene, gli altri male (visione
//   periferica, dita poco indipendenti, stanchezza). Si esce quando un dito finisce oltre
//   1,45 raggi dal centro del suo cerchio, esattamente come sul telefono.
// Il movimento accelera in fretta: da ~30 s tenere ferme le dita non basta più e ognuno
// "cade" quando la velocità dei cerchi supera quello che riesce a inseguire. I bravi
// cambiano dito più spesso, vedono prima, anticipano dove andrà il cerchio e hanno dita più
// sciolte. Nessun momento di uscita è deciso in anticipo.
const TW = 390;
const TH = 760;
const RAGGIO = raggioCerchio(TW, TH);
const SCIVOLA = RAGGIO * 1.45;
const MM = 0.16;

// Stessi cerchi e stesso movimento del telefono (regole.js), in px del telefono tipico.
const posCerchio = (q, t) => posizioneCerchio(q, t, TW, TH, RAGGIO);

function creaMano(cpu, seme) {
  const { prudenza, costanza, aggressivita, pazienza } = cpu.tratti;
  // Quale dito finisce su quale cerchio si decide mentre compaiono, quando ancora non si
  // sa quale correrà di più: l'anulare è il meno indipendente, l'indice il più libero
  // (Häger-Ross e Schieber 2000). I bravi sanno usare meglio anche le dita deboli.
  const forza = [1.3, 1.15, 1, 0.65, 0.85];
  for (let i = forza.length - 1; i > 0; i--) {
    const j = cpu.intero(0, i);
    [forza[i], forza[j]] = [forza[j], forza[i]];
  }
  return {
    cerchi: creaCerchi(seme),
    dita: [],
    quando: null,
    fallisce: null,
    occhiata: 0,
    guardato: 0,
    umore: 0,
    // posare: chi è impulsivo ci va di slancio, più svelto ma più scomposto
    slancio: 1.15 - 0.3 * aggressivita,
    svista: cpu.per(0.04, 0.015, 0.005), // non si accorge subito del nuovo cerchio
    goffo: cpu.per(0.07, 0.035, 0.015) * (0.8 + 0.4 * aggressivita), // rischio di non arrivare al 5° dito
    // tenere
    ritardo: cpu.per(0.22, 0.17, 0.13), // si vede il cerchio dov'era un attimo fa
    ciclo: cpu.per(0.45, 0.35, 0.28), // quanto resta l'attenzione su un dito
    attento: cpu.per(4, 6, 7), // inseguimento del dito guardato (1/s)
    // e degli altri: l'indipendenza delle dita cambia molto da persona a persona
    periferico: cpu.per(0.95, 1.3, 1.65) * (0.8 + 0.4 * costanza) * Math.exp(cpu.errore(0.2)),
    forza: forza.map((f) => Math.pow(f, cpu.per(1.2, 1, 0.7))),
    anticipa: cpu.per(0, 0.4, 0.7), // quanto prevede dove andrà il cerchio
    resistenza: cpu.per(30, 45, 60) * (0.8 + 0.4 * prudenza), // secondi prima che la mano si stanchi
    sbalzi: cpu.per(0.5, 0.4, 0.3), // la concentrazione va e viene
    tremito: cpu.per(4, 3, 2), // tremolio delle dita (px/√s)
    distrazione: cpu.per(0.2, 0.1, 0.04) * (1.3 - 0.6 * pazienza), // guarda il dito sbagliato
    sbadato: cpu.per(0.004, 0.0025, 0.0015), // un dito si alza mentre la mano si contorce
  };
}

// Mettere il prossimo dito. Restituisce 'dito', 'tardi', 'staccato' o null.
function piazza(m, cpu, t) {
  const k = m.dita.length;
  if (m.quando == null) {
    if (t < appare(k)) return null;
    const [cx, cy] = posCerchio(m.cerchi[k], t);
    let mx = TW / 2;
    let my = TH / 2;
    if (k) {
      mx = m.dita.reduce((s, d) => s + d.x, 0) / k;
      my = m.dita.reduce((s, d) => s + d.y, 0) / k;
    }
    const dist = Math.hypot(cx - mx, cy - my);
    const fitts = (0.2 + 0.1 * Math.log2(1 + dist / (2 * RAGGIO))) * (1 + 0.3 * k) * m.slancio * Math.exp(cpu.errore(0.2));
    m.quando = appare(k) + cpu.reazione() + fitts + (cpu.prob(m.svista) ? cpu.num(1, 2.5) : 0);
    // lontano dalle altre dita (oltre 4,5 cm) è più scomodo
    const scomodo = m.goffo * [0, 0, 0.1, 0.35, 1][k] * (1 + Math.max(0, dist * MM - 45) / 30);
    m.fallisce = cpu.prob(scomodo) ? (cpu.prob(0.5) ? 'staccato' : 'tardi') : null;
  }
  const limite = scadenza(k);
  if (m.fallisce === 'tardi' || m.quando > limite) return t > limite ? 'tardi' : null;
  if (t < m.quando) return null;
  if (m.fallisce === 'staccato') return 'staccato';
  const [cx, cy] = posCerchio(m.cerchi[k], t);
  for (const d of m.dita) {
    d.x += cpu.errore(1.5 + k);
    d.y += cpu.errore(1.5 + k);
  }
  m.dita.push({ x: cx + cpu.errore(9), y: cy + cpu.errore(9) });
  m.quando = null;
  return 'dito';
}

// Tenere le dita: ogni dito insegue il suo cerchio (visto con un attimo di ritardo) come
// in un inseguimento visuo-motorio: forte se è il dito che si sta guardando, debole per
// gli altri (visione periferica e sensazione del dito). L'attenzione passa ogni pochi
// decimi di secondo al dito che sembra più in pericolo. Col tempo la mano si stanca e la
// concentrazione va e viene. Restituisce 'scivolato' o null.
function tieni(m, cpu, t, dt) {
  const D = m.dita;
  if (!D.length) return null;
  const tv = t - m.ritardo;
  if (t >= m.occhiata) {
    let e = -1;
    D.forEach((d, j) => {
      const [cx, cy] = posCerchio(m.cerchi[j], tv);
      const ej = Math.hypot(cx - d.x, cy - d.y) + cpu.errore(5);
      if (ej > e) {
        e = ej;
        m.guardato = j;
      }
    });
    if (cpu.prob(m.distrazione)) m.guardato = cpu.intero(0, D.length - 1);
    m.occhiata = t + m.ciclo * Math.exp(cpu.errore(0.3));
  }
  m.umore += (-m.umore * dt) / 3 + m.sbalzi * Math.sqrt((2 * dt) / 3) * cpu.gauss();
  const stanco = t > INIZIO_MOVIMENTO ? Math.exp(-(t - INIZIO_MOVIMENTO) / m.resistenza) : 1;
  const trem = m.tremito * Math.sqrt(dt);
  for (let j = 0; j < D.length; j++) {
    const d = D[j];
    let [cx, cy] = posCerchio(m.cerchi[j], tv);
    if (m.anticipa > 0 && t > INIZIO_MOVIMENTO) {
      const [px, py] = posCerchio(m.cerchi[j], tv - 0.05);
      cx += ((cx - px) / 0.05) * m.ritardo * m.anticipa;
      cy += ((cy - py) / 0.05) * m.ritardo * m.anticipa;
    }
    const k = (j === m.guardato ? m.attento : m.periferico * m.forza[j] * stanco) * Math.exp(m.umore);
    const a = 1 - Math.exp(-k * dt);
    d.x += (cx - d.x) * a + cpu.errore(trem);
    d.y += (cy - d.y) * a + cpu.errore(trem);
  }
  for (let j = 0; j < D.length; j++) {
    const [cx, cy] = posCerchio(m.cerchi[j], t);
    if (Math.hypot(cx - D[j].x, cy - D[j].y) > SCIVOLA) return 'scivolato';
  }
  const sforzo = t > INIZIO_MOVIMENTO ? Math.min(1, (t - INIZIO_MOVIMENTO) / 20) : 0;
  return cpu.prob(m.sbadato * (0.2 + 2.8 * sforzo) * dt) ? 'staccato' : null;
}

export default {
  id: 'twister',
  nome: 'Twister delle Dita',
  emoji: '🖐️',
  colore: '#ef4444',
  descrizione: 'Un dito su ogni cerchio… con UNA mano sola!',
  comeSiGioca: [
    "✋ Si gioca con UNA mano sola: metti l'altra dietro la schiena!",
    'Appoggia il telefono sul tavolo',
    'Quando compare un cerchio, mettici sopra un dito della stessa mano (hai 3 secondi)',
    'Non staccare mai le dita: alla fine i cerchi si muovono!',
  ],
  controllo: 'multitouch',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const seme = randInt(1, 1e9);
  let inizio = null;
  let finito = false;
  let t = 0;
  let ultimoAppare = -1;
  let fineTra = -1;

  const gioc = ctx.giocatori.map((p) => ({
    id: p.id,
    p,
    dita: 0,
    fuori: null,
    motivo: null,
    salvo: false,
    colpo: 0,
    mano: null,
  }));
  const perId = new Map(gioc.map((g) => [g.id, g]));

  ctx.vista('*', { seme });

  const tempo = () => (inizio == null ? -1 : (ctx.ora() - inizio) / 1000);

  function esce(q, motivo, tt) {
    if (q.fuori != null || q.salvo) return;
    q.fuori = clamp(tt, 0, DURATA);
    q.motivo = motivo;
    q.colpo = 0.8;
    sfx.fallimento();
    const vivi = gioc.filter((x) => x.fuori == null).length;
    fx.testo(W / 2, 170, `${q.p.nome} è fuori!`, { colore: q.p.colore, dim: 50, vita: 1.6 });
    if (vivi > 0) sfx.pop();
  }

  function termina() {
    if (finito) return;
    finito = true;
    const vivi = gioc.filter((q) => q.fuori == null).map((q) => q.id);
    const morti = gioc.filter((q) => q.fuori != null).sort((a, b) => b.fuori - a.fuori);
    const gruppi = vivi.length ? [vivi] : [];
    for (const q of morti) {
      const last = gruppi[gruppi.length - 1];
      const ref = last && perId.get(last[0]);
      if (ref && ref.fuori != null && Math.abs(ref.fuori - q.fuori) < 0.05) last.push(q.id);
      else gruppi.push([q.id]);
    }
    const dettagli = {};
    for (const q of gioc) dettagli[q.id] = q.fuori == null ? 'Ha resistito fino alla fine! 💪' : `Fuori dopo ${fmtNum(q.fuori, 1)} s`;
    ctx.fine({ gruppi, dettagli });
  }

  function mano(g, x, y, s, dita, colore, spento) {
    // palmo
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.globalAlpha = spento ? 0.35 : 1;
    const lung = [34, 44, 48, 44, 36];
    const ang = [-1.0, -0.42, -0.1, 0.22, 0.55];
    for (let i = 0; i < 5; i++) {
      g.save();
      g.rotate(ang[i]);
      g.beginPath();
      g.roundRect(-9, -lung[i] - 26, 18, lung[i] + 10, 9);
      g.fillStyle = i < dita ? COLORI[i] : '#ffe0c7';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#1b1030';
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.roundRect(-30, -26, 60, 58, 20);
    g.fillStyle = colore;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#1b1030';
    g.stroke();
    g.restore();
  }

  return {
    inizia() {
      inizio = ctx.ora() + 200;
      ctx.vista('*', { seme, inizio });
    },

    aggiorna(dt) {
      t += dt;
      for (const q of gioc) q.colpo = Math.max(0, q.colpo - dt);
      const tt = tempo();
      if (tt < 0 || finito) return;
      const k = [...Array(BERSAGLI).keys()].filter((i) => tt >= appare(i)).length - 1;
      if (k > ultimoAppare) {
        ultimoAppare = k;
        sfx.ding();
      }
      // Controllo di sicurezza: chi non ha le dita che dovrebbe avere (telefono
      // spento o scollegato) viene eliminato anche se il telefono non lo dice.
      const attesi = [...Array(BERSAGLI).keys()].filter((i) => tt > scadenza(i) + 1.5).length;
      for (const q of gioc) if (q.fuori == null && !q.salvo && q.dita < attesi) esce(q, 'tardi', tt);
      const vivi = gioc.filter((q) => q.fuori == null).length;
      if (fineTra < 0 && (vivi === 0 || (n >= 2 && vivi <= 1) || tt >= DURATA + 1)) fineTra = 1.2;
      if (fineTra >= 0) {
        fineTra -= dt;
        if (fineTra <= 0) termina();
      }
    },

    disegna(g) {
      const grd = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
      grd.addColorStop(0, '#fef3c7');
      grd.addColorStop(1, '#fbbf24');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // pallini alla Twister
      for (let i = 0; i < 24; i++) {
        g.beginPath();
        g.arc(((i * 331) % W) + 40, ((i * 173) % H) + 20, 50, 0, TAU);
        g.fillStyle = COLORI[i % 5];
        g.globalAlpha = 0.18;
        g.fill();
      }
      g.globalAlpha = 1;

      const tt = tempo();
      const vivi = gioc.filter((q) => q.fuori == null).length;
      // intestazione
      ctx.pannello(g, 40, 20, 420, 80, { r: 40 });
      ctx.testo(g, tt < 0 ? 'Pronti…' : `⏱ ${fmtNum(Math.max(0, Math.min(DURATA, tt)), 1)} s`, 250, 60, { dim: 44 });
      let frase = "✋ Una mano sola! L'altra dietro la schiena";
      if (tt >= 0) {
        const prossimo = [...Array(BERSAGLI).keys()].find((i) => tt < appare(i));
        if (tt >= INIZIO_MOVIMENTO) frase = '😱 I cerchi si muovono!';
        else if (prossimo === 0) frase = '✋ Una mano sola · arriva il primo cerchio…';
        else if (prossimo != null) frase = `✋ Una mano sola · cerchi: ${prossimo} di ${BERSAGLI}`;
        else frase = 'Tutte e 5 le dita giù!';
      }
      ctx.testo(g, frase, W / 2 + 130, 60, { dim: 46, colore: '#fff', maxW: 1080 });
      ctx.testo(g, `In gara: ${vivi}`, W - 150, 60, { dim: 38 });

      const celle = ctx.griglia(n, 60, 130, W - 120, H - 160, { rapporto: 1.25, spazio: 20 });
      gioc.forEach((q, i) => {
        const c = celle[i];
        const out = q.fuori != null;
        ctx.pannello(g, c.x, c.y, c.w, c.h, { colore: out ? 'rgba(60,40,80,0.55)' : 'rgba(255,255,255,0.9)', bordo: q.p.colore, lw: 6, r: 22 });
        const hAv = c.h * 0.7;
        const scuoti = q.colpo > 0 ? rand(-5, 5) : 0;
        g.globalAlpha = out ? 0.55 : 1;
        ctx.avatar(g, q.p.av, c.x + c.w * 0.27 + scuoti, c.y + c.h * 0.8, hAv, { pose: out ? 'sad' : q.dita >= 4 ? 'hit' : 'idle', t, espr: out ? 'triste' : q.dita >= 3 ? 'sorpreso' : null });
        g.globalAlpha = 1;
        mano(g, c.x + c.w * 0.72, c.y + c.h * 0.52, Math.min(c.w, c.h) / 190, q.dita, q.p.colore, out);
        ctx.etichetta(g, q.p.nome, c.x + c.w / 2, c.y + c.h - 18, q.p.colore, { dim: Math.min(22, c.h * 0.1), maxW: c.w - 20 });
        if (out) {
          const testi = { tardi: 'Troppo lento!', staccato: 'Dito staccato!', scivolato: 'Scivolato!' };
          ctx.testo(g, testi[q.motivo] || 'Fuori!', c.x + c.w / 2, c.y + c.h * 0.22, { dim: Math.min(34, c.h * 0.14), colore: '#ff4d6d' });
          ctx.testo(g, `${fmtNum(q.fuori, 1)} s`, c.x + c.w / 2, c.y + c.h * 0.4, { dim: Math.min(30, c.h * 0.12) });
        }
      });
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || finito || !d) return;
      if (typeof d.dita === 'number') q.dita = clamp(Math.round(d.dita), 0, BERSAGLI);
      if (d.fuori && q.fuori == null) esce(q, ['tardi', 'staccato', 'scivolato'].includes(d.fuori) ? d.fuori : 'staccato', Number(d.t) || Math.max(0, tempo()));
      if (d.salvo) q.salvo = true;
    },

    // Stessi dati del telefono: { dita } quando cambia il numero di dita giù,
    // { fuori, t } quando si esce, { salvo } a fine tempo.
    bot(id, dt) {
      const q = perId.get(id);
      const tt = tempo();
      if (tt < 0 || q.fuori != null || q.salvo || finito) return;
      const cpu = ctx.cpu(id);
      const m = q.mano || (q.mano = creaMano(cpu, seme));
      let esito = m.dita.length < BERSAGLI ? piazza(m, cpu, tt) : null;
      if (esito === 'dito') {
        this.input(id, { dita: m.dita.length });
        esito = null;
      }
      if (!esito) esito = tieni(m, cpu, tt, dt);
      if (esito) this.input(id, { fuori: esito, t: tt });
      else if (tt >= DURATA) this.input(id, { salvo: true });
    },
  };
}
