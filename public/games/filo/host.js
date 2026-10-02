// Filo Scottante: ognuno segue un percorso elettrico sul proprio telefono.
// Sullo schermo grande si vede la gara: chi finisce i 3 livelli prima vince.

import { rand, randInt, clamp, fmtNum, lerp, angDiff } from '../../shared/util.js';
import { creaPercorso, LIVELLI } from './percorso.js';

const DURATA = 100;

// --- CPU ---------------------------------------------------------------------
// La CPU guarda il percorso sul proprio telefono (stesso seme di tutti) e lo segue
// come farebbe un dito vero:
// - velocità da "legge dello steering" (Accot-Zhai): proporzionale alla mezza
//   larghezza del corridoio diviso il margine di sicurezza z che la persona si tiene
//   e il suo errore motorio k (secondi): v = semi / (z * k);
// - rallenta nelle curve che vede arrivare (i bravi le vedono prima, i principianti
//   se ne accorgono quando ci sono dentro);
// - l'errore laterale del dito è a campana e cresce con la velocità: la probabilità
//   di uscire dal corridoio al secondo segue la formula di Rice (superamenti di soglia
//   di un tremolio casuale): h = 2 NU exp(-semi² / 2σ²).
// Scala: 1000 unità del percorso ≈ 6 cm sul telefono (corridoi di 9, 7 e 5,5 mm).
const NU = 1.3; // correzioni laterali "lente" del dito al secondo
const CURVA = 1.2; // una curva stretta moltiplica la difficoltà fino a 1 + CURVA
const FERMO = 6; // imprecisione del dito anche da fermo (unità, ~0,4 mm)
const PAUSA_ZAP = 0.7; // il telefono blocca per 0,7 s dopo la scossa
const PAUSA_LIVELLO = 0.9;

// Geometria di un livello come la vede l'occhio: lunghezza lungo il filo e
// quanto "gira" il filo in ogni punto (0 dritto, 1 tornante).
function geometria(seme, liv) {
  const { punti: P, semi } = creaPercorso(seme, liv);
  const N = P.length;
  const s = new Float64Array(N);
  for (let i = 1; i < N; i++) s[i] = s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const curva = new Float64Array(N);
  for (let i = 1; i < N - 1; i++) {
    let j = i;
    let k = i;
    while (j > 0 && s[i] - s[j] < 45) j--;
    while (k < N - 1 && s[k] - s[i] < 45) k++;
    const a = Math.atan2(P[i][1] - P[j][1], P[i][0] - P[j][0]);
    const b = Math.atan2(P[k][1] - P[i][1], P[k][0] - P[i][0]);
    curva[i] = Math.min(1, Math.abs(angDiff(a, b)) / 2);
  }
  return { P, N, semi, s, curva, cps: [0, Math.floor(N / 3), Math.floor((N * 2) / 3)] };
}

// Tempo per spostare il dito su un punto (legge di Fitts, bersaglio largo ~200 unità).
const spostamento = (d) => 0.12 + 0.13 * Math.log2(1 + d / 200);

export default {
  id: 'filo',
  nome: 'Filo Scottante',
  emoji: '⚡',
  colore: '#5ce1ff',
  descrizione: 'Segui il filo col dito senza prendere la scossa!',
  comeSiGioca: [
    'Sul telefono appare un percorso: tocca il punto giallo per partire',
    'Trascina il dito fino al traguardo 🏁 senza uscire dal filo',
    'Se esci prendi la scossa e torni al checkpoint. 3 livelli!',
  ],
  controllo: 'traccia',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const seme = randInt(1, 1e9);
  const X0 = 300;
  const X1 = W - 200;
  const top = 150;
  const corsiaH = Math.min(118, (H - top - 30) / n);
  const y0 = top + (H - top - 30 - corsiaH * n) / 2;
  let inizio = null;
  let finito = false;
  let t = 0;

  const gioc = ctx.giocatori.map((p, i) => ({
    id: p.id,
    p,
    prog: 0,
    vista: 0,
    zaps: 0,
    liv: 0,
    fatto: null,
    y: y0 + corsiaH * (i + 0.5),
    scossa: 0,
    bot: null,
  }));
  const perId = new Map(gioc.map((g) => [g.id, g]));
  const geo = [];
  const geoLiv = (liv) => geo[liv] || (geo[liv] = geometria(seme, liv));

  function nuovoBot(id) {
    const cpu = ctx.cpu(id);
    const { prudenza, aggressivita, costanza } = cpu.tratti;
    return {
      cpu,
      stato: 'attesa',
      attesa: cpu.reazione() + 0.15,
      liv: 0,
      i: 0,
      s: 0,
      cp: 0,
      v: 0,
      zaps: 0,
      ritmo: 0,
      esita: 0,
      cautela: 0,
      fila: 0, // scosse prese dall'ultimo checkpoint
      invio: 0,
      // errore motorio (s): quanto si allarga il tremolio laterale per ogni unità/s di velocità
      k: cpu.per(0.0265, 0.0255, 0.024) * (1.15 - 0.3 * cpu.abilita) * Math.exp(cpu.errore(0.08)),
      // margine di sicurezza in "sigma": chi è aggressivo corre di più e rischia di più
      z: cpu.per(2.5, 2.4, 2.3) + 0.35 * (prudenza - aggressivita),
      // quanto adatta la velocità alle curve e quanto avanti guarda (in punti del filo)
      adatta: cpu.per(0.72, 0.8, 0.95),
      avanti: cpu.per([-1, 1], [0, 3], [1, 6]),
      // i bravi rischiano meno quando hanno tanta strada da perdere dall'ultimo checkpoint
      posta: cpu.per(0, 0.2, 0.5),
      agita: cpu.per(0.22, 0.15, 0.1) * (1.2 - 0.4 * costanza),
      esitazioni: cpu.per(0.1, 0.05, 0.02),
      // dopo la scossa: il prudente rallenta, l'impulsivo quasi non cambia (o accelera)
      dopoZap: 0.1 + 0.4 * prudenza - 0.25 * aggressivita,
    };
  }

  const progresso = (b) => (b.liv + b.i / (geoLiv(b.liv).N - 1)) / LIVELLI.length;

  ctx.vista('*', { seme });

  function arriva(q, ms) {
    if (q.fatto != null) return;
    q.fatto = ms;
    q.prog = 1;
    sfx.ding();
    fx.particelle(X1, q.y, { n: 30, colori: [q.p.colore, '#fff', '#5ce1ff'], vel: 380, grav: 300 });
    fx.testo(X1 - 60, q.y - 30, `${fmtNum(ms / 1000, 1)} s`, { colore: '#ffd23f', dim: 34 });
  }

  function termina() {
    if (finito) return;
    finito = true;
    ctx.vista('*', { seme, inizio, finito: true });
    const punteggi = {};
    const dettagli = {};
    for (const q of gioc) {
      // Chi ha finito conta per tempo, gli altri per quanta strada hanno fatto.
      punteggi[q.id] = q.fatto != null ? 1e6 - q.fatto : Math.round(q.prog * 1000);
      dettagli[q.id] = q.fatto != null ? `${fmtNum(q.fatto / 1000, 1)} s · ⚡${q.zaps}` : `${Math.round(q.prog * 100)}% · ⚡${q.zaps}`;
    }
    ctx.fine({ punteggi, alto: true, dettagli });
  }

  return {
    inizia() {
      inizio = ctx.ora() + 150;
      ctx.vista('*', { seme, inizio });
    },

    aggiorna(dt) {
      t += dt;
      for (const q of gioc) {
        q.vista = lerp(q.vista, q.prog, Math.min(1, dt * 6));
        q.scossa = Math.max(0, q.scossa - dt);
      }
      if (!finito && (gioc.every((q) => q.fatto != null) || ctx.tempo >= DURATA)) termina();
    },

    disegna(g) {
      // laboratorio buio
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#120a2e');
      grd.addColorStop(1, '#1d0f45');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // traguardi dei livelli
      for (let k = 1; k <= 3; k++) {
        const x = X0 + ((X1 - X0) * k) / 3;
        g.fillStyle = k === 3 ? 'rgba(76,217,123,0.25)' : 'rgba(255,255,255,0.08)';
        g.fillRect(x - 3, y0 - 10, 6, corsiaH * n + 20);
        ctx.testo(g, k === 3 ? '🏁' : `Livello ${k + 1}`, x, y0 - 30, { dim: 24, colore: '#9fe8ff' });
      }
      for (const q of gioc) {
        const y = q.y;
        // filo elettrico a zig-zag
        g.strokeStyle = 'rgba(92,225,255,0.35)';
        g.lineWidth = 4;
        g.beginPath();
        for (let x = X0; x <= X1; x += 30) {
          const yy = y + Math.sin(x / 40 + q.id.length) * corsiaH * 0.12;
          if (x === X0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
        const xp = X0 + (X1 - X0) * q.vista;
        g.strokeStyle = q.p.colore;
        g.lineWidth = 8;
        g.beginPath();
        for (let x = X0; x <= xp; x += 30) {
          const yy = y + Math.sin(x / 40 + q.id.length) * corsiaH * 0.12;
          if (x === X0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
        const r = Math.min(40, corsiaH * 0.38);
        const scuoti = q.scossa > 0 ? rand(-6, 6) : 0;
        if (q.scossa > 0) {
          g.strokeStyle = '#fff';
          g.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            let x = xp;
            let yy = y;
            g.beginPath();
            g.moveTo(x, yy);
            for (let j = 0; j < 4; j++) {
              x += rand(-25, 25);
              yy += rand(-25, 25);
              g.lineTo(x, yy);
            }
            g.stroke();
          }
        }
        ctx.testa(g, q.p.av, xp + scuoti, y + scuoti, r, { t, espr: q.scossa > 0 ? 'stordito' : q.fatto != null ? 'felice' : null });
        ctx.etichetta(g, q.p.nome, 150, y, q.p.colore, { dim: Math.max(15, Math.min(22, corsiaH * 0.25)), maxW: 230 });
        ctx.testo(g, q.fatto != null ? `${fmtNum(q.fatto / 1000, 1)} s` : `⚡${q.zaps}`, W - 90, y, { dim: Math.min(30, corsiaH * 0.35), colore: q.fatto != null ? '#4cd97b' : '#9fe8ff' });
      }
      ctx.barraTempo(g, DURATA - ctx.tempo, DURATA, { w: 700, x: 60, y: 40 });
      const arrivati = gioc.filter((q) => q.fatto != null).length;
      ctx.testo(g, `Arrivati: ${arrivati}/${n}`, W - 250, 55, { dim: 38 });
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || finito) return;
      if (typeof d.z === 'number' && d.z > q.zaps) {
        q.zaps = d.z;
        q.scossa = 0.5;
        sfx.zap();
      }
      if (typeof d.p === 'number' && q.fatto == null) {
        // Al cambio di livello vale il livello finito (le versioni vecchie del telefono
        // mandavano per 0,9 s un avanzamento gonfiato di ~1/3).
        const cambio = typeof d.liv === 'number' && d.liv > q.liv;
        q.prog = clamp(cambio ? d.liv / LIVELLI.length : d.p, 0, 1);
      }
      if (typeof d.liv === 'number') q.liv = Math.max(q.liv, d.liv);
      if (typeof d.fatto === 'number') arriva(q, clamp(d.fatto, 0, DURATA * 1000));
    },

    // Manda gli stessi dati del telefono: { p, z, liv } al massimo ogni 200 ms mentre
    // il dito si muove, subito alla scossa e al cambio di livello, { fatto } alla fine.
    bot(id, dt) {
      const q = perId.get(id);
      if (q.fatto != null || inizio == null || finito || ctx.ora() < inizio) return;
      const b = q.bot || (q.bot = nuovoBot(id));
      const { cpu } = b;
      if (b.stato === 'attesa') {
        b.attesa -= dt;
        if (b.attesa <= 0) b.stato = 'traccia';
        return;
      }
      const G = geoLiv(b.liv);
      // ritmo personale: la velocità ondeggia piano (Ornstein-Uhlenbeck sul logaritmo)
      b.ritmo += (-b.ritmo * dt) / 1.2 + b.agita * Math.sqrt((2 * dt) / 1.2) * cpu.gauss();
      if (b.esita > 0) b.esita -= dt;
      else if (cpu.prob(b.esitazioni * dt)) b.esita = cpu.num(0.25, 0.7);
      b.cautela *= Math.exp(-dt / 8);
      let vista = 0;
      for (let k = b.avanti[0]; k <= b.avanti[1]; k++) vista = Math.max(vista, G.curva[clamp(b.i + k, 0, G.N - 1)]);
      const inGioco = (b.i - b.cp) / (G.N / 3);
      const z = Math.max(1.8, b.z + b.cautela + b.posta * inGioco);
      const meta = ((G.semi / (z * b.k)) * Math.exp(b.ritmo)) / Math.pow(1 + CURVA * vista, b.adatta);
      b.v += ((b.esita > 0 ? meta * 0.15 : meta) - b.v) * Math.min(1, dt * 5);
      // Scossa: il rischio dipende dalla difficoltà vera del punto, non da quella vista.
      const sig = Math.hypot(FERMO, b.k * b.v * (1 + CURVA * G.curva[b.i]));
      if (cpu.prob(2 * NU * Math.exp(-(G.semi * G.semi) / (2 * sig * sig)) * dt)) {
        b.zaps++;
        this.input(id, { p: progresso(b), z: b.zaps, liv: b.liv });
        const [x0, y0] = G.P[b.i];
        const [x1, y1] = G.P[b.cp];
        b.i = b.cp;
        b.s = G.s[b.cp];
        b.v = 0;
        b.esita = 0;
        // dopo due o tre scosse nello stesso tratto anche il più impulsivo rallenta
        b.cautela += b.dopoZap + 0.25 * b.fila++;
        b.stato = 'attesa';
        b.attesa = PAUSA_ZAP + cpu.reazione(0.9) + spostamento(Math.hypot(x1 - x0, y1 - y0)) * Math.exp(cpu.errore(0.15));
        return;
      }
      b.s += b.v * dt;
      while (b.i < G.N - 1 && G.s[b.i + 1] <= b.s) b.i++;
      for (const c of G.cps) {
        if (b.i >= c && c > b.cp) {
          b.cp = c;
          b.fila = 0;
        }
      }
      if (b.i >= G.N - 3) {
        if (b.liv === LIVELLI.length - 1) return this.input(id, { fatto: ctx.ora() - inizio, z: b.zaps, p: 1 });
        b.liv++;
        b.i = 0;
        b.s = 0;
        b.cp = 0;
        b.v = 0;
        b.fila = 0;
        this.input(id, { p: b.liv / LIVELLI.length, z: b.zaps, liv: b.liv });
        // dal traguardo in alto al nuovo punto di partenza in basso
        b.stato = 'attesa';
        b.attesa = PAUSA_LIVELLO + cpu.reazione(0.8) + spostamento(1400) * Math.exp(cpu.errore(0.15));
        return;
      }
      b.invio -= dt;
      if (b.invio <= 0) {
        b.invio = 0.2 + cpu.num(0, 0.03);
        this.input(id, { p: progresso(b), z: b.zaps, liv: b.liv });
      }
    },
  };
}
