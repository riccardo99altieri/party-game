// Il Più Alto Unico: ognuno sceglie in segreto un numero. I numeri scelti da una
// sola persona valgono punti, i doppioni zero, il più alto unico prende il bonus.

import { TAU, rand, randInt, clamp, ease } from '../../shared/util.js';
import { esitoRound, massimo, BONUS } from './logica.js';

const ROUND = 5;
const T_SCELTA = 12;
const T_RIVELA = 6.5;

export default {
  id: 'unico',
  nome: 'Il Più Alto Unico',
  emoji: '🔢',
  colore: '#22d3ee',
  descrizione: 'Scegli un numero alto… ma che nessun altro abbia scelto!',
  comeSiGioca: [
    'Scegli in segreto un numero sul telefono',
    'Se sei l’unico ad averlo scelto, prendi quei punti. Doppioni = zero!',
    `Il numero unico più alto prende anche +${BONUS} di bonus. 5 round`,
  ],
  controllo: 'scelta',
  crea,
};

// ---------------------------------------------------------------------------
// Strumenti delle CPU

// Come sceglie una persona alla prima partita (tabella in test/bench/mente.mjs):
// il massimo e i numeri subito sotto, più i numeri "salienti" 7, 1, 3 e 5.
const cachePrior = new Map();
function priorUmano(M) {
  if (cachePrior.has(M)) return cachePrior.get(M);
  const p = new Float64Array(M + 1);
  let s = 0;
  for (let v = 1; v <= M; v++) {
    p[v] = 0.25 * 0.72 ** (M - v) + 0.02 + (v === 7 ? 0.05 : 0) + (v === 1 ? 0.04 : 0) + (v === 3 || v === 5 ? 0.02 : 0);
    s += p[v];
  }
  for (let v = 1; v <= M; v++) p[v] /= s;
  cachePrior.set(M, p);
  return p;
}

// Equilibrio "a razionalità limitata" (risposta logit) tra n giocatori tutti furbi:
// è come giocherebbe una tavolata di esperti. Il Difficile lo usa come ipotesi di
// partenza per chi non conosce ancora, così non dà per scontato che gli altri siano ingenui.
const cacheEq = new Map();
function equilibrio(n, M) {
  const k = `${n}-${M}`;
  if (cacheEq.has(k)) return cacheEq.get(k);
  const p = new Float64Array(M + 1).fill(1 / M);
  p[0] = 0;
  const ev = new Float64Array(M + 1);
  for (let giro = 0; giro < 80; giro++) {
    let nessunoSopra = 1;
    for (let v = M; v >= 1; v--) {
      ev[v] = (1 - p[v]) ** (n - 1) * (v + BONUS * nessunoSopra);
      nessunoSopra *= 1 - (n - 1) * p[v] * (1 - p[v]) ** Math.max(0, n - 2);
    }
    let s = 0;
    const q = new Float64Array(M + 1);
    for (let v = 1; v <= M; v++) s += q[v] = Math.exp(ev[v] / 1.2);
    for (let v = 1; v <= M; v++) p[v] = 0.8 * p[v] + (0.2 * q[v]) / s;
  }
  cacheEq.set(k, p);
  return p;
}

// Pesca un numero 1..M con probabilità proporzionali a w[1..M].
function pesca(w, M) {
  let s = 0;
  for (let v = 1; v <= M; v++) s += w[v];
  let r = Math.random() * s;
  for (let v = 1; v <= M; v++) if ((r -= w[v]) <= 0) return v;
  return M;
}

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const M = massimo(n);
  let round = 0;
  let fase = 'scelta';
  let tFase = 0;
  let t = 0;
  let fineScelta = 0;
  let finito = false;
  let scelte = {};
  let esito = null;
  let suoniFatti = 0;
  const totali = Object.fromEntries(ctx.giocatori.map((p) => [p.id, 0]));
  const perId = new Map(ctx.giocatori.map((p) => [p.id, p]));
  // Round già svelati sullo schermo (chi ha scelto cosa): è l'unica cosa che i bot
  // possono ricordare degli avversari. Le scelte del round in corso restano segrete.
  const storia = [];

  function nuovoRound() {
    fase = 'scelta';
    tFase = 0;
    scelte = {};
    esito = null;
    fineScelta = ctx.ora() + T_SCELTA * 1000;
    ctx.vista('*', { fase, round, tot: ROUND, max: M, fine: fineScelta });
    sfx.bip();
  }
  nuovoRound();

  function rivela() {
    fase = 'rivela';
    tFase = 0;
    suoniFatti = 0;
    esito = esitoRound(scelte);
    for (const p of ctx.giocatori) totali[p.id] += esito.punti[p.id] || 0;
    storia.push({ scelte: { ...scelte }, quanti: esito.quanti, migliore: esito.migliore, totali: { ...totali } });
    for (const p of ctx.giocatori) {
      const v = scelte[p.id];
      const tipo = v == null ? 'nessuno' : esito.quanti[v] === 1 ? 'unico' : 'doppio';
      ctx.vista(p.id, { fase, round, tot: ROUND, max: M, numero: v ?? null, tipo, punti: esito.punti[p.id] || 0, totale: totali[p.id], migliore: esito.migliore, bonus: v != null && v === esito.migliore });
    }
    sfx.rullo(1.2);
  }

  function termina() {
    finito = true;
    ctx.fine({ punteggi: { ...totali }, alto: true, fmt: (v) => `${v} punti` });
  }

  const xNum = (v) => 140 + ((W - 280) * (v - 1)) / Math.max(1, M - 1);

  // -------------------------------------------------------------------------
  // CPU. Tutti e tre i livelli sanno solo quello che è apparso sullo schermo nei
  // round già svelati (storia) e i totali; il round in corso è segreto.

  // Facile: nessuna strategia e nessun modello degli altri. Ogni tanto il massimo,
  // spesso imita il numero che ha appena vinto (vuole il bonus anche lui, e così fa
  // doppione con chi lo ripete), ha un numero portafortuna fisso e l'errore classico
  // del principiante: i numeri bassi "tanto non li prende nessuno" (unici, ma valgono poco).
  // Nota: con la tabella umana il massimo rende bene (le persone non lo "puniscono"),
  // quindi un Facile più avido sarebbe più forte, non più debole: si è misurato.
  function sceltaFacile(cpu) {
    const m = cpu.mem;
    if (m.preferito == null) m.preferito = pesca([0, 10, 6, 20, 8, 15, 6, 30], 7);
    if (cpu.prob(0.06 + 0.06 * cpu.tratti.aggressivita)) return M;
    const u = storia[storia.length - 1];
    if (u && u.migliore && cpu.prob(0.35)) return u.migliore;
    if (cpu.prob(0.55)) return m.preferito;
    if (cpu.prob(0.7)) return cpu.intero(1, 3);
    return cpu.intero(1, M);
  }

  // Normale: euristiche da persona. Il massimo "è troppo ovvio", i numeri che
  // hanno fatto doppione sono "gettonati", dopo un doppione si scende un po',
  // dopo un bonus si tende a riprovare. Ricorda solo il round appena svelato.
  function sceltaNormale(cpu, id) {
    const w = Float64Array.from(priorUmano(M));
    w[M] *= 0.35 + 0.4 * cpu.tratti.aggressivita;
    const u = storia[storia.length - 1];
    if (u) {
      for (let v = 1; v <= M; v++) {
        if (u.quanti[v] > 1) w[v] *= 0.45;
        else if (!u.quanti[v] && v > M - 5) w[v] *= 1.3; // "lì non c'era nessuno"
      }
      if (u.migliore) w[u.migliore] *= 0.6;
      const mio = u.scelte[id];
      if (mio != null) {
        if (u.quanti[mio] > 1) {
          w[mio] *= 0.3;
          if (mio > 1) w[mio - 1] *= 1.7;
          if (mio > 2) w[mio - 2] *= 1.4;
        } else if (mio === u.migliore) {
          w[mio] *= 2.2;
          if (mio < M) w[mio + 1] *= 1.3;
        } else if (mio < M) w[mio + 1] *= 1.4; // "era unico, provo un po' più su"
      }
    }
    return pesca(w, M);
  }

  // Difficile: modello di ogni avversario dalla storia (abitudini viste sullo
  // schermo), poi valore atteso di ogni numero stimato simulando le scelte
  // altrui; sceglie con una strategia mista (softmax) per non essere prevedibile
  // e per non finire sempre sullo stesso numero di un altro bot furbo.
  // Abitudine di chi reagisce al proprio esito: dopo un doppione di solito scende
  // di 1–2, dopo il bonus ripete o sale, dopo un unico semplice spesso ripete.
  function abitudine(s, c) {
    const umano = priorUmano(M);
    const p = new Float64Array(M + 1);
    for (let v = 1; v <= M; v++) p[v] = 0.25 * umano[v];
    const k = s.quanti[c] > 1 ? [0.28, 0.24, 0.15, 0.08] : c === s.migliore ? [0.5, 0.1, 0.05, 0.2] : [0.45, 0.12, 0.06, 0.12];
    const tot = k[0] + k[1] + k[2] + k[3];
    p[c] += (0.75 * k[0]) / tot;
    p[c > 1 ? c - 1 : c] += (0.75 * k[1]) / tot;
    p[c > 2 ? c - 2 : c] += (0.75 * k[2]) / tot;
    p[c < M ? c + 1 : c] += (0.75 * k[3]) / tot;
    return p;
  }

  // Ogni avversario è spiegato come un miscuglio di "tipi" (ingenuo, esperto,
  // abitudinario, a caso) pesati da quanto spiegano le sue scelte già svelate.
  // Così chi ripete sempre lo stesso numero viene sfruttato, e un altro giocatore
  // furbo viene trattato da giocatore furbo (niente inseguimenti a vuoto).
  function modelloAvversario(j, umano, eq, furbo, ricorda) {
    const lw = [Math.log(0.4), Math.log(0.3), Math.log(0.2), Math.log(0.1)];
    let prima = null;
    for (let r = 0; r < storia.length; r++) {
      const s = storia[r];
      const c = ricorda(r, j) ? s.scelte[j] : null;
      if (c != null) {
        const pAb = prima ? abitudine(prima.s, prima.c)[c] : umano[c];
        lw[0] += Math.log(umano[c]);
        lw[1] += Math.log(eq[c] + 1e-4);
        lw[2] += Math.log(pAb);
        lw[3] += Math.log(1 / M);
      }
      prima = c != null ? { s, c } : null;
    }
    const mx = Math.max(...lw);
    const w = lw.map((x) => Math.max(0.04, Math.exp(x - mx)));
    const sw = w[0] + w[1] + w[2] + w[3];
    const ab = prima ? abitudine(prima.s, prima.c) : umano;
    const p = new Float64Array(M + 1);
    let acc = 0;
    for (let v = 1; v <= M; v++) p[v] = acc += (w[0] * umano[v] + w[1] * furbo[v] + w[2] * ab[v] + w[3] / M) / sw; // cumulata
    for (let v = 1; v <= M; v++) p[v] /= acc;
    return p;
  }

  function softmax(u, tau, gusto = 0) {
    let max = -Infinity;
    for (let v = 1; v <= M; v++) max = Math.max(max, u[v] + gusto * v);
    const w = new Float64Array(M + 1);
    for (let v = 1; v <= M; v++) w[v] = Math.exp((u[v] + gusto * v - max) / tau);
    return w;
  }

  function sceltaDifficile(cpu, id) {
    const umano = priorUmano(M);
    const eq = equilibrio(n, M);
    const altri = ctx.giocatori.filter((p) => p.id !== id).map((p) => p.id);
    // Primo passo: cosa sceglierebbe un giocatore furbo con queste informazioni.
    // Secondo passo: si suppone che gli altri furbi ragionino allo stesso modo,
    // così i Difficili non si ammassano tutti sul numero che "sembra" migliore.
    // Memoria umana: fino a 6 giocatori si ricorda tutto; oltre, ogni scelta altrui
    // resta in mente con probabilità ~4/(n-1), tranne chi ha preso il bonus (si nota sempre).
    // Quello che si è scordato resta scordato per tutta la partita.
    const m = cpu.mem;
    if (!m.ricordi) m.ricordi = new Map();
    const pRicordo = n > 6 ? 4 / (n - 1) : 1;
    const ricorda = (r, j) => {
      const s = storia[r];
      if (pRicordo >= 1 || (s.migliore != null && s.scelte[j] === s.migliore)) return true;
      const k = `${r}:${j}`;
      if (!m.ricordi.has(k)) m.ricordi.set(k, cpu.prob(pRicordo));
      return m.ricordi.get(k);
    };
    const q = softmax(valuta(id, altri, altri.map((j) => modelloAvversario(j, umano, eq, eq, ricorda)), false), 1);
    let sq = 0;
    for (let v = 1; v <= M; v++) sq += q[v];
    const furbo = new Float64Array(M + 1);
    for (let v = 1; v <= M; v++) furbo[v] = 0.5 * eq[v] + (0.5 * q[v]) / sq;
    const u = valuta(id, altri, altri.map((j) => modelloAvversario(j, umano, eq, furbo, ricorda)), round === ROUND - 1);
    // gusto personale per il rischio: l'aggressivo sale un po' di più
    const gusto = (cpu.tratti.aggressivita - 0.5) * 0.08;
    const tau = 0.7 + 0.5 * (1 - cpu.tratti.costanza);
    return pesca(softmax(u, tau, gusto), M);
  }

  // Valore medio di ogni numero (o, all'ultimo round, soprattutto la probabilità di
  // finire primi) simulando S volte le scelte degli avversari secondo i loro modelli.
  function valuta(id, altri, cum, ultimo) {
    const S = n > 8 ? 200 : 300;
    const u = new Float64Array(M + 1);
    const cnt = new Int16Array(M + 1);
    const sc = new Int16Array(altri.length);
    for (let s = 0; s < S; s++) {
      cnt.fill(0);
      for (let j = 0; j < altri.length; j++) {
        const r = Math.random();
        const c = cum[j];
        let v = 1;
        while (v < M && c[v] < r) v++;
        sc[j] = v;
        cnt[v]++;
      }
      let hu = 0;
      let hu2 = 0; // il secondo unico più alto (se il mio numero rovina il primo)
      for (let v = M; v >= 1; v--) {
        if (cnt[v] !== 1) continue;
        if (!hu) hu = v;
        else {
          hu2 = v;
          break;
        }
      }
      for (let v = 1; v <= M; v++) {
        const pts = cnt[v] === 0 ? v + (v > hu ? BONUS : 0) : 0;
        if (!ultimo) {
          u[v] += pts;
          continue;
        }
        // Ultimo round: conta finire primi, non i punti. Chi è avanti copre gli
        // avversari, chi è indietro rischia sul bonus.
        const top = cnt[v] === 0 ? Math.max(v, hu) : v === hu ? hu2 : hu;
        const mio = totali[id] + pts;
        let esito = 1;
        for (let j = 0; j < altri.length && esito > 0; j++) {
          const c = sc[j];
          const pj = cnt[c] === 1 && c !== v ? c + (c === top ? BONUS : 0) : 0;
          const lui = totali[altri[j]] + pj;
          if (lui > mio) esito = 0;
          else if (lui === mio) esito = 0.6;
        }
        u[v] += 12 * esito + 0.2 * pts;
      }
    }
    for (let v = 1; v <= M; v++) u[v] /= S;
    return u;
  }

  function sceltaBot(cpu, id) {
    return cpu.livello === 0 ? sceltaFacile(cpu) : cpu.livello === 1 ? sceltaNormale(cpu, id) : sceltaDifficile(cpu, id);
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      if (finito) return;
      if (fase === 'scelta') {
        const tutti = ctx.giocatori.every((p) => scelte[p.id] != null);
        if ((tutti && tFase > 1.5) || ctx.ora() >= fineScelta) rivela();
      } else if (fase === 'rivela') {
        // i numeri si svelano dal più alto al più basso
        const k = Math.floor(clamp((tFase - 1.2) / 2.4, 0, 1) * M);
        while (suoniFatti < k) {
          suoniFatti++;
          const v = M - suoniFatti + 1;
          const q = esito.quanti[v] || 0;
          if (q === 1) {
            sfx.moneta();
            if (v === esito.migliore) {
              sfx.fanfara();
              fx.particelle(xNum(v), 700, { n: 30, colori: ['#ffd23f', '#fff'], forma: 'stella', vel: 400, grav: 300, dim: 20 });
            }
          } else if (q > 1) {
            sfx.boom();
            fx.particelle(xNum(v), 700, { n: 20, colori: ['#ff4d6d', '#ffb3c1', '#fff'], vel: 300, grav: 400 });
            fx.scuoti(5);
          }
        }
        if (tFase >= T_RIVELA) {
          round++;
          if (round >= ROUND) termina();
          else nuovoRound();
        }
      }
    },

    disegna(g) {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#0e3a5c');
      grd.addColorStop(1, '#0a1f3d');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      ctx.pannello(g, 40, 20, 330, 76, { r: 38 });
      ctx.testo(g, `Round ${round + 1} di ${ROUND}`, 205, 58, { dim: 38 });

      if (fase === 'scelta') {
        ctx.barraTempo(g, (fineScelta - ctx.ora()) / 1000, T_SCELTA, { w: 700, x: W / 2 - 350, y: 40 });
        ctx.testo(g, `Scegli un numero da 1 a ${M}`, W / 2, 190, { dim: 90, colore: '#22d3ee', bordo: 12 });
        ctx.testo(g, '✔ Unico = prendi quei punti     ✖ Doppione = zero', W / 2, 300, { dim: 44 });
        ctx.testo(g, `👑 Il più alto tra gli unici: +${BONUS} bonus`, W / 2, 370, { dim: 44, colore: '#ffd23f' });
        const celle = ctx.griglia(n, 120, 440, W - 240, 560, { rapporto: 0.8, spazio: 44 });
        ctx.giocatori.forEach((p, i) => {
          const c = celle[i];
          const r = Math.min(c.w, c.h) * 0.36;
          const ok = scelte[p.id] != null;
          g.globalAlpha = ok ? 1 : 0.45;
          ctx.testa(g, p.av, c.x + c.w / 2, c.y + c.h * 0.42, r, { t, espr: ok ? 'felice' : null });
          g.globalAlpha = 1;
          if (ok) ctx.testo(g, '🤫', c.x + c.w / 2 + r * 0.9, c.y + c.h * 0.42 - r * 0.8, { dim: r * 0.7, bordo: 0 });
          ctx.testo(g, p.nome, c.x + c.w / 2, c.y + c.h * 0.92, { dim: Math.min(26, c.h * 0.15), maxW: c.w });
        });
        return;
      }

      // Rivelazione
      ctx.testo(g, 'Chi ha il più alto unico?', W / 2, 60, { dim: 60, colore: '#22d3ee' });
      const base = 760;
      const svelati = clamp((tFase - 1.2) / 2.4, 0, 1) * M;
      const perNumero = {};
      for (const [id, v] of Object.entries(scelte)) (perNumero[v] = perNumero[v] || []).push(id);
      for (let v = 1; v <= M; v++) {
        const x = xNum(v);
        const visibile = M - v + 1 <= svelati;
        const chi = perNumero[v] || [];
        const unico = chi.length === 1;
        const col = !visibile ? '#3b5b7a' : unico ? (v === esito.migliore ? '#ffd23f' : '#4cd97b') : chi.length ? '#ff4d6d' : '#3b5b7a';
        g.beginPath();
        g.arc(x, base + 70, Math.min(38, (W - 280) / M / 2 - 4), 0, TAU);
        g.fillStyle = col;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#0a1f3d';
        g.stroke();
        ctx.testo(g, String(v), x, base + 72, { dim: 34, bordo: 0, colore: '#0a1f3d' });
        if (!visibile || !chi.length) continue;
        const passo = Math.min(96, 560 / chi.length);
        const r = Math.min(48, (W - 280) / M / 2 - 4, passo * 0.55);
        chi.forEach((id, j) => {
          const p = perId.get(id);
          const kk = ease.outBack(clamp((svelati - (M - v)) * 1.5, 0, 1));
          const y = base - r - j * passo - (1 - kk) * 200;
          ctx.testa(g, p.av, x, y, r, { t, espr: unico ? 'felice' : 'stordito' });
        });
        const top = base - r * 2.9 - (chi.length - 1) * passo - 24; // sopra anche ai cappelli
        if (unico) ctx.testo(g, v === esito.migliore ? `👑 +${v + BONUS}` : `+${v}`, x, top, { dim: 34, colore: v === esito.migliore ? '#ffd23f' : '#4cd97b' });
        else ctx.testo(g, '💥', x, top, { dim: 40, bordo: 0 });
      }
      // totali
      if (tFase > 3.8) {
        const ordinati = [...ctx.giocatori].sort((a, b) => totali[b.id] - totali[a.id]);
        const celle = ctx.griglia(n, 80, 900, W - 160, 150, { rapporto: 1.6, spazio: 10 });
        ordinati.forEach((p, i) => {
          const c = celle[i];
          const r = Math.min(c.h * 0.3, 30);
          ctx.testa(g, p.av, c.x + r + 6, c.y + c.h / 2, r, { t });
          ctx.testo(g, String(totali[p.id]), c.x + r * 2 + 16, c.y + c.h / 2, { dim: Math.min(36, c.h * 0.4), allinea: 'left', colore: i === 0 ? '#ffd23f' : '#fff' });
        });
      }
    },

    input(id, d) {
      if (fase !== 'scelta' || !perId.has(id) || !d) return;
      const v = Math.round(Number(d.n));
      if (v >= 1 && v <= M) {
        if (scelte[id] == null) sfx.pop();
        scelte[id] = v;
      }
    },

    bot(id, dt) {
      if (fase !== 'scelta' || finito || !perId.has(id)) return;
      const cpu = ctx.cpu(id);
      const m = cpu.mem;
      if (m.round !== round) {
        // legge, ci pensa, tocca il numero; a volte poi cambia idea
        m.round = round;
        m.t = cpu.per(cpu.pensa(1.5, 7), cpu.pensa(2.5, 8), cpu.pensa(3.5, 9));
        m.fatto = false;
        // svista rara del principiante distratto: si scorda di scegliere in tempo
        if (cpu.livello === 0 && cpu.prob(0.06)) m.t = Infinity;
      }
      m.t -= dt;
      if (m.t > 0) return;
      if (!m.fatto) {
        m.fatto = true;
        this.input(id, { n: sceltaBot(cpu, id) });
        m.t = cpu.livello < 2 && cpu.prob(0.12) ? cpu.num(1, 3) : Infinity;
      } else if (m.t > -1 && fineScelta - ctx.ora() > 1000) {
        m.t = Infinity;
        this.input(id, { n: sceltaBot(cpu, id) });
      }
    },
  };
}
