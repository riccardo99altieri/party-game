// Mano Ferma: tre prove di precisione sul telefono (cerchio, taglio a metà,
// punti a memoria). Sullo schermo grande si svelano tutti i disegni col voto.

import { TAU, randInt, clamp, fmtNum, ease } from '../../shared/util.js';
import { punteggioCerchio, punteggioTaglio, punteggioPunti, creaForma, creaPunti, taglia, area } from './logica.js';

// --- CPU ---------------------------------------------------------------------
// Le tre prove sono generate come le farebbe una persona, con i difetti tipici:
// niente coordinate esatte, solo stime a occhio e memoria rumorose. Le funzioni sono
// esportate per il banco di prova (test/bench/precisione.mjs).

// Cerchio a mano libera col dito: somma dei difetti tipici di chi disegna.
// - ovale (rapporto tra gli assi 1,04–1,12) inclinato a caso;
// - spirale: il raggio alla fine non è quello dell'inizio;
// - "bozzi" lenti (armoniche 3-5) e tremolio fine;
// - chiusura imperfetta: di solito si va un po' oltre il punto di partenza;
// - velocità a campana (lenta all'inizio e alla fine): più punti agli estremi.
export function tracciaCerchio(cpu) {
  const { pazienza, costanza } = cpu.tratti;
  const cura = 0.85 + 0.3 * pazienza; // chi ha pazienza va più piano e più pulito
  const var_ = 1.2 - 0.4 * costanza;
  const R = cpu.num(230, 370);
  const cx = 500 + cpu.errore(30);
  const cy = 500 + cpu.errore(30);
  const ovale = (Math.abs(cpu.errore(cpu.per(0.044, 0.045, 0.032) * var_)) + cpu.per(0.012, 0.008, 0.005)) / cura;
  const asse = cpu.num(0, Math.PI);
  const spirale = cpu.errore(cpu.per(0.06, 0.042, 0.028) * var_);
  const bozzi = [3, 4, 5].map((k) => [k, cpu.errore(cpu.per(0.013, 0.009, 0.007) * var_) / cura, cpu.num(0, TAU)]);
  const tremolio = cpu.per(0.006, 0.0045, 0.003) / cura;
  let giro = TAU * (1 + cpu.per(0.05, 0.04, 0.03) + cpu.errore(cpu.per(0.07, 0.05, 0.035) * var_));
  let ammacca = 0;
  let dove = 0;
  // svista rara: dito staccato troppo presto o un bozzo grosso (attrito del dito sul vetro)
  if (cpu.prob(cpu.per(0.06, 0.035, 0.012))) {
    if (cpu.prob(0.5)) giro = TAU * cpu.num(0.78, 0.9);
    else {
      ammacca = cpu.num(0.07, 0.14) * (cpu.prob(0.5) ? 1 : -1);
      dove = cpu.num(0, TAU);
    }
  }
  const verso = cpu.prob(0.6) ? -1 : 1;
  const a0 = -Math.PI / 2 + cpu.errore(0.7);
  const n = Math.round(cpu.num(110, 190));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const u = s * s * s * (10 - 15 * s + 6 * s * s); // profilo di minimo "strappo"
    const a = a0 + verso * giro * u;
    let k = 1 + ovale * Math.cos(2 * (a - asse)) + spirale * (u - 0.5);
    for (const [h, amp, f] of bozzi) k += amp * Math.cos(h * a + f);
    if (ammacca) {
      const da = ((a - dove + 9 * Math.PI) % TAU) - Math.PI;
      k += ammacca * Math.exp(-(da * da) / 0.12);
    }
    const r = R * k + cpu.errore(tremolio * R);
    const p = [clamp(Math.round(cx + Math.cos(a) * r), 0, 1000), clamp(Math.round(cy + Math.sin(a) * r), 0, 1000)];
    const u2 = pts[pts.length - 1];
    if (!u2 || Math.hypot(p[0] - u2[0], p[1] - u2[1]) >= 5 || i === n) pts.push(p);
  }
  return { c: pts, durata: cpu.num(0.9, 1.7) * cura };
}

// Taglio a occhio: la linea passa per il "centro" percepito della forma. L'occhio
// sbaglia di qualche percento della grandezza ed è attirato dal centro del riquadro
// che contiene la forma. I più bravi poi confrontano a occhio le due metà (legge di
// Weber: si notano differenze di area del 7–12%) e spostano la linea per pareggiarle.
export function tagliaAOcchio(cpu, forma) {
  const { pazienza, aggressivita } = cpu.tratti;
  const A = area(forma);
  let gx = 0;
  let gy = 0;
  let s2 = 0;
  for (let i = 0; i < forma.length; i++) {
    const [x1, y1] = forma[i];
    const [x2, y2] = forma[(i + 1) % forma.length];
    const c = x1 * y2 - x2 * y1;
    gx += (x1 + x2) * c;
    gy += (y1 + y2) * c;
    s2 += c;
  }
  gx /= 3 * s2;
  gy /= 3 * s2;
  const xs = forma.map((p) => p[0]);
  const ys = forma.map((p) => p[1]);
  const bx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const by = (Math.min(...ys) + Math.max(...ys)) / 2;
  const attrazione = cpu.per(0.4, 0.3, 0.18);
  const sbaglio = cpu.per(0.065, 0.05, 0.042) * Math.sqrt(A);
  let px = gx + attrazione * (bx - gx) + cpu.errore(sbaglio);
  let py = gy + attrazione * (by - gy) + cpu.errore(sbaglio);
  if (cpu.prob(cpu.per(0.05, 0.025, 0.01) * (0.7 + 0.6 * aggressivita))) {
    // svista: taglio frettoloso che passa lontano dal centro
    px += cpu.errore(0.12 * Math.sqrt(A));
    py += cpu.errore(0.12 * Math.sqrt(A));
  }
  // Direzione: molti tagliano dritto (su-giù o destra-sinistra), altri seguono la forma.
  const ang = cpu.prob(0.55) ? (cpu.prob(0.6) ? Math.PI / 2 : 0) + cpu.errore(0.07) : cpu.num(0, Math.PI);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const ripensa = Math.min(1, cpu.per(0, 0.2, 0.5) * (0.7 + 0.6 * pazienza));
  if (ripensa > 0) {
    const linea = [px - ux * 100, py - uy * 100, px + ux * 100, py + uy * 100];
    const a1 = area(taglia(forma, linea));
    const weber = cpu.per(0.12, 0.1, 0.075);
    const d1 = a1 * Math.exp(cpu.errore(weber));
    const d2 = (A - a1) * Math.exp(cpu.errore(weber));
    // si sposta verso la parte che sembra più grande di metà della differenza stimata
    const sposta = (ripensa * (d1 - d2)) / (2 * corda(forma, px, py, ux, uy));
    px += -uy * sposta;
    py += ux * sposta;
  }
  // il colpo attraversa tutta la forma ma resta sul foglio
  const L = cpu.num(380, 520);
  const avanti = Math.min(L, bordo(px, ux), bordo(py, uy));
  const indietro = Math.min(L, bordo(px, -ux), bordo(py, -uy));
  const m = cpu.per(12, 9, 6);
  const linea = [px - ux * indietro + cpu.errore(m), py - uy * indietro + cpu.errore(m), px + ux * avanti + cpu.errore(m), py + uy * avanti + cpu.errore(m)];
  return { t: linea.map(Math.round), pensa: cpu.pensa(1.4, 3.6) * (0.8 + 0.5 * pazienza) * (1.2 - 0.4 * aggressivita) };
}

// Quanto si può andare da p lungo u prima di uscire dal foglio (con 15 unità di margine).
const bordo = (p, u) => (u > 1e-6 ? (985 - p) / u : u < -1e-6 ? (p - 15) / -u : Infinity);

// Lunghezza del tratto di retta (per p con direzione u) dentro la forma.
function corda(forma, px, py, ux, uy) {
  const ts = [];
  for (let i = 0; i < forma.length; i++) {
    const [x1, y1] = forma[i];
    const [x2, y2] = forma[(i + 1) % forma.length];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const s = ((x1 - px) * ey - (y1 - py) * ex) / den;
    const w = ((x1 - px) * uy - (y1 - py) * ux) / den;
    if (w >= 0 && w <= 1) ts.push(s);
  }
  return ts.length >= 2 ? Math.max(40, Math.max(...ts) - Math.min(...ts)) : 300;
}

// Memoria dei punti: la memoria visiva tiene bene 3–4 oggetti; gli altri restano solo
// come "zona". Tutto il gruppo si ricorda un po' spostato e un po' più stretto verso il
// suo centro (tendenza centrale), e ogni ricordo si sfuoca col passare dei secondi.
export function memorizzaPunti(cpu, punti, secondiVisti) {
  const posti = Math.max(2, Math.min(5, cpu.per(3.5, 3.6, 3.8) + cpu.errore(0.5) + (secondiVisti - 2.5) * 0.6));
  const forti = Math.floor(posti) + (cpu.prob(posti % 1) ? 1 : 0);
  const ordine = punti.map((_, i) => i);
  for (let i = ordine.length - 1; i > 0; i--) {
    const j = cpu.intero(0, i);
    [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
  }
  let mx = 0;
  let my = 0;
  for (const [x, y] of punti) {
    mx += x / punti.length;
    my += y / punti.length;
  }
  const stringe = cpu.per(0.12, 0.08, 0.05);
  const gx = cpu.errore(cpu.per(28, 20, 13));
  const gy = cpu.errore(cpu.per(28, 20, 13));
  return ordine.map((i, k) => {
    const forte = k < forti;
    const s = forte ? cpu.per(34, 32, 28) : cpu.per(150, 130, 115);
    const [x, y] = punti[i];
    return { x: x + (mx - x) * stringe + gx + cpu.errore(s), y: y + (my - y) * stringe + gy + cpu.errore(s), forte };
  });
}

// Tocchi dal ricordo: prima quelli sicuri, poi quelli incerti (con un'esitazione).
// Restituisce i tocchi e il secondo (dopo la sparizione) in cui arriva il quinto.
export function toccaPunti(cpu, ricordo) {
  // chi è impulsivo tocca più in fretta (e il ricordo ha meno tempo per sfumare)
  const ritmo = 1.15 - 0.3 * cpu.tratti.aggressivita;
  let t = cpu.reazione() + cpu.pensa(0.25, 0.7) * ritmo;
  const sfuma = cpu.per(15, 12, 9);
  const tocchi = [];
  ricordo.forEach((r, i) => {
    if (i) t += cpu.per(0.7, 0.52, 0.4) * ritmo * Math.exp(cpu.errore(0.25)) + (r.forte ? 0 : cpu.num(0.25, 0.8));
    const s = sfuma * Math.sqrt(t) + 5;
    tocchi.push([Math.round(clamp(r.x + cpu.errore(s), 0, 1000)), Math.round(clamp(r.y + cpu.errore(s), 0, 1000))]);
  });
  return { p: tocchi, fine: t };
}

const T_ANNUNCIO = 2.8;
const T_PROVA = 15;
const T_RIVELA = 6.5;
const MEMORIA = 2.5; // secondi in cui si vedono i punti

const PROVE = [
  { tipo: 'cerchio', titolo: 'Cerchio perfetto', emoji: '⭕', testo: 'Disegna un cerchio perfetto con un solo tratto!' },
  { tipo: 'taglio', titolo: 'Taglia a metà', emoji: '🔪', testo: 'Taglia la forma in due parti uguali con un colpo dritto!' },
  { tipo: 'punti', titolo: 'Punti a memoria', emoji: '🧠', testo: 'Memorizza i 5 punti, poi tocca dove erano!' },
];

export default {
  id: 'manoferma',
  nome: 'Mano Ferma',
  emoji: '✍️',
  colore: '#f472b6',
  descrizione: 'Tre prove di precisione: chi ha la mano più ferma?',
  comeSiGioca: ['Prova 1: disegna un cerchio perfetto', 'Prova 2: taglia una forma in due metà uguali', 'Prova 3: ricorda dove erano i punti e toccali'],
  controllo: 'precisione',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const seme = randInt(1, 1e9);
  const forma = creaForma(seme);
  const puntiVeri = creaPunti(seme);
  let prova = 0;
  let fase = 'annuncio';
  let tFase = 0;
  let t = 0;
  let finito = false;
  let fineProva = 0;
  let mostraFino = 0;
  const risposte = PROVE.map(() => ({})); // [prova][id] = { dati, punti, extra }
  const totali = Object.fromEntries(ctx.giocatori.map((p) => [p.id, 0]));
  const perId = new Map(ctx.giocatori.map((p) => [p.id, p]));
  const piani = {}; // id -> piano della CPU per la prova in corso
  let inizioProva = 0;

  function mandaVista() {
    const P = PROVE[prova];
    const base = { prova, tipo: P.tipo, titolo: P.titolo, testo: P.testo, fase };
    if (fase === 'prova') {
      base.fine = fineProva;
      if (P.tipo === 'taglio') base.forma = forma.map(([x, y]) => [Math.round(x), Math.round(y)]);
      if (P.tipo === 'punti') {
        base.punti = puntiVeri.map(([x, y]) => [Math.round(x), Math.round(y)]);
        base.mostraFino = mostraFino;
      }
    }
    if (fase === 'rivela') {
      for (const p of ctx.giocatori) {
        const r = risposte[prova][p.id];
        ctx.vista(p.id, { ...base, voto: r ? r.punti : 0, totale: totali[p.id] });
      }
      return;
    }
    ctx.vista('*', base);
  }

  function valuta(id, d) {
    const P = PROVE[prova];
    if (fase !== 'prova' || risposte[prova][id]) return;
    let r = null;
    if (P.tipo === 'cerchio' && Array.isArray(d.c)) {
      const pts = d.c.filter((q) => Array.isArray(q) && q.length === 2 && q.every(isFinite)).slice(0, 400);
      const v = punteggioCerchio(pts);
      r = { dati: pts, punti: v.punti, fit: v.fit };
    } else if (P.tipo === 'taglio' && Array.isArray(d.t)) {
      const v = punteggioTaglio(forma, d.t.map(Number));
      r = { dati: d.t.map(Number), punti: v.punti, perc: v.perc };
    } else if (P.tipo === 'punti' && Array.isArray(d.p)) {
      const v = punteggioPunti(puntiVeri, d.p);
      r = { dati: d.p.slice(0, 5), punti: v.punti, abb: v.abbinamento };
    }
    if (!r) return;
    risposte[prova][id] = r;
    sfx.pop();
  }

  function vaiA(f) {
    fase = f;
    tFase = 0;
    if (f === 'prova') {
      fineProva = ctx.ora() + T_PROVA * 1000 + (PROVE[prova].tipo === 'punti' ? MEMORIA * 1000 : 0);
      mostraFino = ctx.ora() + MEMORIA * 1000 + 300;
      inizioProva = ctx.ora();
    }
    if (f === 'rivela') {
      for (const p of ctx.giocatori) {
        const r = risposte[prova][p.id];
        totali[p.id] += r ? r.punti : 0;
      }
      sfx.rullo(1);
      setTimeout(() => sfx.ding(), 1000);
    }
    if (f === 'annuncio') sfx.whoosh();
    mandaVista();
  }

  function termina() {
    finito = true;
    const punteggi = {};
    for (const p of ctx.giocatori) punteggi[p.id] = Math.round(totali[p.id] * 10) / 10;
    ctx.fine({ punteggi, alto: true, fmt: (v) => `${fmtNum(v / 3, 1)}% di media` });
  }

  vaiA('annuncio');

  // --- disegno -------------------------------------------------------------

  function quaderno(g) {
    g.fillStyle = '#fdf8ec';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,140,220,0.25)';
    g.lineWidth = 2;
    for (let y = 60; y < H; y += 44) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(230,80,80,0.35)';
    g.beginPath();
    g.moveTo(110, 0);
    g.lineTo(110, H);
    g.stroke();
  }

  function disegnaRisposta(g, tipo, r, x, y, L, colore, k) {
    const s = L / 1000;
    g.save();
    g.beginPath();
    g.rect(x, y, L, L);
    g.clip();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (tipo === 'cerchio') {
      if (r && r.fit) {
        g.setLineDash([6, 6]);
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x + r.fit.cx * s, y + r.fit.cy * s, r.fit.r * s, 0, TAU);
        g.stroke();
        g.setLineDash([]);
      }
      if (r && r.dati.length) {
        const m = Math.max(2, Math.floor(r.dati.length * k));
        g.strokeStyle = colore;
        g.lineWidth = Math.max(3, L / 60);
        g.beginPath();
        r.dati.slice(0, m).forEach(([px, py], i) => (i ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s)));
        g.stroke();
      }
    } else if (tipo === 'taglio') {
      g.beginPath();
      forma.forEach(([px, py], i) => (i ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s)));
      g.closePath();
      g.fillStyle = '#cfc6e6';
      g.fill();
      if (r && k > 0.3) {
        const parte = taglia(forma, r.dati);
        if (parte.length > 2) {
          g.beginPath();
          parte.forEach(([px, py], i) => (i ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s)));
          g.closePath();
          g.fillStyle = colore;
          g.globalAlpha = 0.75;
          g.fill();
          g.globalAlpha = 1;
        }
        const [ax, ay, bx, by] = r.dati;
        const dx = bx - ax;
        const dy = by - ay;
        const d = Math.hypot(dx, dy) || 1;
        g.strokeStyle = '#1b1030';
        g.lineWidth = Math.max(2, L / 90);
        g.beginPath();
        g.moveTo(x + (ax - (dx / d) * 2000) * s, y + (ay - (dy / d) * 2000) * s);
        g.lineTo(x + (ax + (dx / d) * 2000) * s, y + (ay + (dy / d) * 2000) * s);
        g.stroke();
      }
      g.strokeStyle = '#1b1030';
      g.lineWidth = 2;
      g.beginPath();
      forma.forEach(([px, py], i) => (i ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s)));
      g.closePath();
      g.stroke();
    } else if (tipo === 'punti') {
      for (const [px, py] of puntiVeri) {
        g.beginPath();
        g.arc(x + px * s, y + py * s, Math.max(5, L / 40), 0, TAU);
        g.fillStyle = '#1b1030';
        g.fill();
      }
      if (r && k > 0.2) {
        r.dati.forEach(([px, py], i) => {
          const v = puntiVeri[r.abb[i]];
          if (v) {
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x + px * s, y + py * s);
            g.lineTo(x + v[0] * s, y + v[1] * s);
            g.stroke();
          }
          const c = Math.max(6, L / 30);
          g.strokeStyle = colore;
          g.lineWidth = Math.max(3, L / 70);
          g.beginPath();
          g.moveTo(x + px * s - c, y + py * s - c);
          g.lineTo(x + px * s + c, y + py * s + c);
          g.moveTo(x + px * s + c, y + py * s - c);
          g.lineTo(x + px * s - c, y + py * s + c);
          g.stroke();
        });
      }
    }
    g.restore();
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      if (finito) return;
      if (fase === 'annuncio' && tFase >= T_ANNUNCIO) vaiA('prova');
      else if (fase === 'prova') {
        const tutti = ctx.giocatori.every((p) => risposte[prova][p.id]);
        if ((tutti && tFase > 1) || ctx.ora() >= fineProva) vaiA('rivela');
      } else if (fase === 'rivela' && tFase >= T_RIVELA) {
        if (prova < PROVE.length - 1) {
          prova++;
          vaiA('annuncio');
        } else termina();
      }
    },

    disegna(g) {
      quaderno(g);
      const P = PROVE[prova];
      ctx.pannello(g, 40, 20, 330, 76, { r: 38 });
      ctx.testo(g, `Prova ${prova + 1} di ${PROVE.length}`, 205, 58, { dim: 38 });

      if (fase === 'annuncio') {
        const k = Math.min(1, tFase / 0.5);
        g.save();
        g.translate(W / 2, H / 2 - 40);
        g.scale(ease.outBack(k), ease.outBack(k));
        ctx.testo(g, P.emoji, 0, -150, { dim: 170, bordo: 0 });
        ctx.testo(g, P.titolo, 0, 20, { dim: 120, colore: '#f472b6', bordo: 14 });
        ctx.testo(g, P.testo, 0, 140, { dim: 46 });
        g.restore();
        return;
      }

      if (fase === 'prova') {
        const resto = Math.max(0, (fineProva - ctx.ora()) / 1000);
        ctx.barraTempo(g, resto, T_PROVA + (P.tipo === 'punti' ? MEMORIA : 0), { w: 700, x: W / 2 - 350, y: 40 });
        ctx.testo(g, `${P.emoji} ${P.titolo}`, W / 2, 160, { dim: 80, colore: '#f472b6', bordo: 12 });
        ctx.testo(g, 'Guarda il tuo telefono! 📱', W / 2, 250, { dim: 48 });
        if (P.tipo === 'taglio') disegnaRisposta(g, 'taglio', null, W / 2 - 230, 300, 460, '#000', 0);
        if (P.tipo === 'cerchio') {
          g.setLineDash([14, 14]);
          g.strokeStyle = 'rgba(0,0,0,0.2)';
          g.lineWidth = 8;
          g.beginPath();
          g.arc(W / 2, 530, 200 + Math.sin(t * 3) * 10, 0, TAU);
          g.stroke();
          g.setLineDash([]);
        }
        if (P.tipo === 'punti') ctx.testo(g, ctx.ora() < mostraFino ? '🧠 Memorizza!' : '👆 Tocca dove erano!', W / 2, 530, { dim: 90, colore: '#ffd23f' });
        // chi ha già risposto
        const celle = ctx.griglia(n, 200, 800, W - 400, 230, { rapporto: 0.9, spazio: 12 });
        ctx.giocatori.forEach((p, i) => {
          const c = celle[i];
          const r = Math.min(c.w, c.h) * 0.36;
          const fatto = !!risposte[prova][p.id];
          g.globalAlpha = fatto ? 1 : 0.4;
          ctx.testa(g, p.av, c.x + c.w / 2, c.y + c.h * 0.42, r, { t });
          g.globalAlpha = 1;
          if (fatto) ctx.testo(g, '✔', c.x + c.w / 2 + r, c.y + c.h * 0.42 - r, { dim: r * 0.8, colore: '#4cd97b' });
          ctx.testo(g, p.nome, c.x + c.w / 2, c.y + c.h * 0.9, { dim: Math.min(24, c.h * 0.16), maxW: c.w });
        });
        return;
      }

      // rivela
      ctx.testo(g, `${P.emoji} ${P.titolo}: i risultati!`, W / 2, 58, { dim: 56, colore: '#f472b6', bordo: 10 });
      const celle = ctx.griglia(n, 60, 120, W - 120, H - 150, { rapporto: 0.82, spazio: 18 });
      const k = clamp(tFase / 1.6, 0, 1);
      let migliore = -1;
      for (const p of ctx.giocatori) migliore = Math.max(migliore, risposte[prova][p.id]?.punti ?? 0);
      ctx.giocatori.forEach((p, i) => {
        const c = celle[i];
        const r = risposte[prova][p.id];
        const L = Math.min(c.w - 16, c.h * 0.78);
        const x = c.x + (c.w - L) / 2;
        ctx.pannello(g, c.x, c.y, c.w, c.h, { colore: '#ffffff', bordo: p.colore, lw: 5, r: 18 });
        disegnaRisposta(g, P.tipo, r, x, c.y + 8, L, p.colore, k);
        const voto = (r ? r.punti : 0) * ease.outCubic(k);
        const yT = c.y + 8 + L + (c.h - L - 8) / 2;
        const dim = Math.min(30, (c.h - L) * 0.55);
        ctx.testa(g, p.av, c.x + dim, yT, dim * 0.7, { t });
        ctx.testo(g, p.nome, c.x + dim * 2, yT, { dim: dim * 0.8, allinea: 'left', maxW: c.w * 0.5 });
        ctx.testo(g, r ? `${fmtNum(voto, 1)}%` : '—', c.x + c.w - 10, yT, { dim, allinea: 'right', colore: k >= 1 && r && r.punti === migliore ? '#ffd23f' : '#fff' });
        if (k >= 1 && r && r.punti === migliore && migliore > 0) ctx.testo(g, '👑', c.x + c.w - 24, c.y + 26, { dim: 40, bordo: 0 });
        if (P.tipo === 'taglio' && r && k >= 1) ctx.testo(g, `${fmtNum(Math.min(r.perc, 100 - r.perc), 1)} / ${fmtNum(Math.max(r.perc, 100 - r.perc), 1)}`, c.x + c.w / 2, c.y + 8 + L - 20, { dim: dim * 0.75 });
      });
    },

    input(id, d) {
      if (!d || !perId.has(id)) return;
      valuta(id, d);
    },

    // La CPU decide il gesto una volta sola, poi aspetta il tempo che ci metterebbe una
    // persona (guardare il telefono, pensare, disegnare) e manda gli stessi dati del telefono.
    bot(id, dt) {
      if (fase !== 'prova' || risposte[prova][id]) return;
      const cpu = ctx.cpu(id);
      const { tipo } = PROVE[prova];
      let b = piani[id];
      if (!b || b.prova !== prova) {
        b = piani[id] = { prova, attesa: cpu.reazione(1.3) + cpu.pensa(0.3, 0.9), dati: null };
        if (tipo === 'cerchio') {
          const c = tracciaCerchio(cpu);
          b.dati = { c: c.c };
          b.attesa += c.durata;
        } else if (tipo === 'taglio') {
          const t = tagliaAOcchio(cpu, forma);
          b.dati = { t: t.t };
          b.attesa += t.pensa + cpu.num(0.25, 0.5);
        } else b.guarda = cpu.reazione(1.3); // quanto ci mette ad alzare gli occhi sui punti
      }
      if (tipo === 'punti' && !b.dati) {
        // I punti si vedono fino a mostraFino: la CPU li "fissa" in memoria nell'ultimo
        // fotogramma in cui sono visibili, con il tempo di osservazione che ha avuto
        // davvero; da lì in poi ha solo il suo ricordo.
        if (ctx.ora() + dt * 1000 < mostraFino) return;
        const ricordo = memorizzaPunti(cpu, puntiVeri, (mostraFino - inizioProva) / 1000 - b.guarda);
        const t = toccaPunti(cpu, ricordo);
        b.dati = { p: t.p };
        b.attesa = t.fine + (mostraFino - ctx.ora()) / 1000;
      }
      b.attesa -= dt;
      // chi vede il tempo quasi finito sul telefono si sbriga
      if (b.attesa <= 0 || ctx.ora() > fineProva - 400) valuta(id, b.dati);
    },
  };
}
