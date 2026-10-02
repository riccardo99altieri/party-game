// Mezzogiorno di Fuoco: al "FUOCO!" sullo schermo, tocca il telefono il prima
// possibile. Chi spara prima del segnale ha la penalità. 5 round, vince il più rapido.

import { TAU, rand, randInt, pick, clamp, fmtNum, ease } from '../../shared/util.js';
import { prepara } from '../../shared/avatar.js';

const ROUND = 5;
const PENALITA = 1000; // ms
const FINESTRA = 1.6; // secondi per sparare dopo il segnale
const FINTE = ['FUNGO!', 'FUOCHI?', 'FOCA!', 'FUMO!', 'FUORI!', 'FUSO!', 'FIOCCO!'];

export default {
  id: 'fuoco',
  nome: 'Mezzogiorno di Fuoco',
  emoji: '🤠',
  colore: '#f97316',
  descrizione: 'Il duello più veloce del West: spara al segnale!',
  comeSiGioca: [
    'Guarda lo schermo grande, non il telefono',
    'Quando compare FUOCO! tocca il pulsante il più in fretta possibile',
    'Se spari prima del tempo: penalità! Attento alle finte…',
  ],
  controllo: 'pulsante',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  let round = 0;
  let fase = 'pronti';
  let tFase = 0;
  let t = 0;
  let attesa = 0;
  let finte = [];
  let finta = null;
  let oraSegnale = 0;
  let finito = false;
  const tempi = Object.fromEntries(ctx.giocatori.map((p) => [p.id, 0]));
  let spari = {};

  const gioc = ctx.giocatori.map((p, i) => ({ id: p.id, p, av: prepara({ ...p.av, cappello: 5 }), sparo: 0, fumo: 0 }));
  const perId = new Map(gioc.map((q) => [q.id, q]));

  // posizioni in una o due file
  const file = n > 8 ? 2 : 1;
  const perFila = Math.ceil(n / file);
  gioc.forEach((q, i) => {
    const fila = Math.floor(i / perFila);
    const inFila = fila === file - 1 ? n - fila * perFila : perFila;
    const k = i - fila * perFila;
    const passo = Math.min(210, (W - 200) / Math.max(1, inFila));
    q.x = W / 2 + (k - (inFila - 1) / 2) * passo + (fila % 2 ? passo / 2 : 0) * (file > 1 ? 0.5 : 0);
    q.y = file === 1 ? 960 : fila === 0 ? 770 : 1035;
    q.h = file === 1 ? 250 : 185;
  });

  function nuovoRound() {
    fase = 'pronti';
    tFase = 0;
    spari = {};
    attesa = rand(2.2, 5);
    finte = [];
    if (round >= 2) {
      const quante = round >= 4 ? 2 : 1;
      for (let i = 0; i < quante; i++) finte.push({ t: rand(1, attesa - 0.3), parola: pick(FINTE) });
      attesa += 0.6;
    }
    ctx.vista('*', { round, tot: ROUND, fase });
    sfx.bip();
  }
  nuovoRound();

  function spara(q, quando) {
    if (spari[q.id] || finito) return;
    if (fase === 'pronti' || (fase === 'fuoco' && quando < oraSegnale)) {
      spari[q.id] = { ms: PENALITA, presto: true };
      q.sparo = 0.6;
      sfx.sparo();
      fx.testo(q.x, q.y - q.h - 40, 'Troppo presto!', { colore: '#ff4d6d', dim: 34 });
      ctx.invia(q.id, { presto: true });
    } else if (fase === 'fuoco') {
      const ms = clamp(quando - oraSegnale, 0, FINESTRA * 1000);
      spari[q.id] = { ms, presto: false };
      q.sparo = 0.6;
      q.fumo = 1.2;
      sfx.sparo();
      fx.particelle(q.x + 40, q.y - q.h * 0.55, { n: 12, colori: ['#fff5c0', '#ffd23f', '#ff8a3d'], vel: 300, grav: -50, vita: 0.4, dim: 10 });
      ctx.invia(q.id, { ms });
    }
  }

  function chiudiRound() {
    for (const q of gioc) {
      if (!spari[q.id]) spari[q.id] = { ms: PENALITA, lento: true };
      // uno sparo in ritardo non può costare più che non sparare affatto
      tempi[q.id] += Math.min(spari[q.id].ms, PENALITA);
      if (spari[q.id].lento) ctx.invia(q.id, { lento: true });
    }
    fase = 'esito';
    tFase = 0;
    const migliore = Math.min(...gioc.map((q) => spari[q.id].ms));
    for (const q of gioc) if (spari[q.id].ms === migliore && migliore < PENALITA) fx.particelle(q.x, q.y - q.h - 30, { n: 20, colori: ['#ffd23f', '#fff'], vel: 250, grav: 200, forma: 'stella', dim: 18 });
    ctx.vista('*', { round, tot: ROUND, fase });
  }

  function termina() {
    finito = true;
    const punteggi = { ...tempi };
    ctx.fine({ punteggi, alto: false, fmt: (v) => `media ${fmtNum(v / ROUND / 1000, 3)} s` });
  }

  function paesaggio(g) {
    const cielo = g.createLinearGradient(0, 0, 0, 700);
    cielo.addColorStop(0, '#3b1d5e');
    cielo.addColorStop(0.5, '#e8566c');
    cielo.addColorStop(1, '#ffb347');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, 700);
    g.beginPath();
    g.arc(W * 0.72, 560, 150, 0, TAU);
    g.fillStyle = '#ffe08a';
    g.fill();
    // mesas
    g.fillStyle = '#7a3b3b';
    g.beginPath();
    g.moveTo(0, 700);
    g.lineTo(0, 520);
    g.lineTo(120, 520);
    g.lineTo(170, 470);
    g.lineTo(420, 470);
    g.lineTo(470, 560);
    g.lineTo(760, 560);
    g.lineTo(800, 610);
    g.lineTo(1300, 610);
    g.lineTo(1340, 500);
    g.lineTo(1600, 500);
    g.lineTo(1650, 580);
    g.lineTo(W, 580);
    g.lineTo(W, 700);
    g.fill();
    const terra = g.createLinearGradient(0, 680, 0, H);
    terra.addColorStop(0, '#e9b872');
    terra.addColorStop(1, '#c98b4b');
    g.fillStyle = terra;
    g.fillRect(0, 680, W, H - 680);
    // cactus
    for (const [x, s] of [
      [140, 1],
      [W - 160, 0.8],
    ]) {
      g.save();
      g.translate(x, 740);
      g.scale(s, s);
      g.fillStyle = '#3e8e41';
      g.strokeStyle = '#1b1030';
      g.lineWidth = 4;
      for (const [rx, ry, rw, rh] of [
        [-18, -170, 36, 180],
        [-62, -120, 26, 60],
        [-62, -80, 60, 22],
        [36, -140, 26, 70],
        [10, -90, 52, 22],
      ]) {
        g.beginPath();
        g.roundRect(rx, ry, rw, rh, 12);
        g.fill();
        g.stroke();
      }
      g.restore();
    }
  }

  // -------------------------------------------------------------------------
  // CPU. Il bot guarda il cartello come una persona: reagisce a quello che vede
  // (FUOCO! o una parola finta) un tempo di reazione dopo che è comparso, senza
  // sapere quando arriverà il segnale né se la prossima parola è vera.

  function cervello(id) {
    const cpu = ctx.cpu(id);
    const m = cpu.mem;
    if (!m.pronto) {
      const { aggressivita: ag, prudenza: pr, pazienza: pz, costanza: co } = cpu.tratti;
      m.pronto = true;
      m.round = -1;
      // Compromesso velocità/precisione: chi ha il grilletto facile è un filo più
      // rapido ma casca di più nelle finte; il prudente controlla la parola e perde qualche ms.
      m.scala = cpu.per(0.82, 0.93, 1.02) * (1 + 0.07 * (pr - ag));
      m.pFinta = Math.min(0.42, cpu.per(0.21, 0.15, 0.1) * (0.7 + 0.6 * ag) * (1.25 - 0.5 * pr));
      m.pDistratto = cpu.per(0.08, 0.04, 0.015) * (1.4 - 0.8 * co);
      m.nervi = cpu.per(0.0065, 0.003, 0.001) * (1.5 - pz);
      m.fintaNota = false; // ha già visto una finta in questa partita
      m.bruciato = false; // ha sparato troppo presto nel round prima
    }
    return cpu;
  }

  function inizioRound(cpu, id) {
    const m = cpu.mem;
    m.round = round;
    m.tSparo = null;
    m.finta = null;
    m.visto = false;
    m.kFinta = m.fintaNota ? 0.85 : cpu.per(1.3, 1.3, 1.1); // la prima finta sorprende di più
    m.kNervi = 1;
    m.kLento = 1;
    if (m.bruciato) {
      // dopo una falsa partenza si sta più attenti (e si rallenta un poco)
      m.kFinta *= 0.7;
      m.kNervi *= 0.5;
      m.kLento *= 1.04;
      m.bruciato = false;
    }
    // Tattica: il Difficile tiene il conto dei tempi mostrati a fine round (con
    // un po' di approssimazione) e gestisce il rischio. Se è avanti gioca sul
    // sicuro; se è indietro negli ultimi round rischia col grilletto facile.
    if (cpu.livello === 2 && round > 0) {
      const sigma = 120;
      const mio = tempi[id] + cpu.errore(sigma);
      let rivale = Infinity;
      for (const q of gioc) if (q.id !== id) rivale = Math.min(rivale, tempi[q.id] + cpu.errore(sigma));
      const margine = rivale - mio;
      if (margine > 600) {
        m.kFinta *= 0.5;
        m.kNervi *= 0.3;
        m.kLento *= 1.04;
      } else if (margine < -500 && ROUND - round <= 2) {
        m.kFinta *= 1.6;
        m.kNervi *= 1.5;
        m.kLento *= 0.95;
      }
    }
  }

  function reazioneBot(cpu) {
    const m = cpu.mem;
    let r = cpu.reazione(m.scala * m.kLento);
    if (cpu.prob(m.pDistratto)) r += cpu.num(0.15, cpu.per(0.9, 0.7, 0.5)); // distrazione: coda lunga
    // sotto 0,2 s una persona che guarda la TV e tocca il telefono non ci arriva
    return r < 0.2 ? 0.2 + cpu.num(0, 0.04) : r;
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      for (const q of gioc) {
        q.sparo = Math.max(0, q.sparo - dt);
        q.fumo = Math.max(0, q.fumo - dt);
      }
      if (finito) return;
      if (fase === 'pronti') {
        finta = finte.find((f) => tFase >= f.t && tFase < f.t + 0.9) || null;
        if (tFase >= attesa) {
          fase = 'fuoco';
          tFase = 0;
          oraSegnale = ctx.ora();
          finta = null;
          fx.lampo('#fff', 0.2);
          fx.scuoti(10);
          sfx.boom();
        }
      } else if (fase === 'fuoco') {
        if (gioc.every((q) => spari[q.id]) || tFase >= FINESTRA) chiudiRound();
      } else if (fase === 'esito' && tFase >= 3) {
        round++;
        if (round >= ROUND) termina();
        else nuovoRound();
      }
    },

    disegna(g) {
      paesaggio(g);
      // cartello
      const cx = W / 2;
      g.fillStyle = '#6b3f1d';
      g.fillRect(cx - 12, 270, 24, 200);
      g.beginPath();
      g.roundRect(cx - 430, 90, 860, 200, 20);
      g.fillStyle = '#a0622d';
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#4a2a10';
      g.stroke();
      let scritta = 'Pronti…';
      let colore = '#fff3d6';
      let dim = 110;
      if (fase === 'pronti' && finta) {
        scritta = finta.parola;
        colore = '#ffd23f';
      } else if (fase === 'fuoco') {
        scritta = 'FUOCO!';
        colore = '#ff3b3b';
        dim = 150 + Math.sin(t * 40) * 6;
      } else if (fase === 'esito') {
        const validi = gioc.filter((q) => spari[q.id] && !spari[q.id].presto && !spari[q.id].lento);
        const primo = validi.sort((a, b) => spari[a.id].ms - spari[b.id].ms)[0];
        scritta = primo ? `🏆 ${primo.p.nome}` : 'Tutti lenti! 🐢';
        colore = '#ffd23f';
        dim = 90;
      }
      ctx.testo(g, scritta, cx + (fase === 'fuoco' ? rand(-4, 4) : 0), 192, { dim, colore, bordo: 14, maxW: 800 });
      ctx.pannello(g, 40, 20, 330, 76, { r: 38 });
      ctx.testo(g, `Round ${round + 1} di ${ROUND}`, 205, 58, { dim: 38 });

      const migliore = fase === 'esito' ? Math.min(...gioc.map((q) => spari[q.id]?.ms ?? PENALITA)) : -1;
      for (const q of gioc) {
        const s = spari[q.id];
        const pose = s && s.presto ? 'hit' : s ? 'point' : fase === 'fuoco' ? 'idle' : 'idle';
        ctx.avatar(g, q.av, q.x, q.y, q.h, { pose, t, espr: s && s.presto ? 'stordito' : s && !s.lento ? 'arrabbiato' : null });
        if (q.sparo > 0 && s && !s.presto) {
          g.beginPath();
          g.arc(q.x + q.h * 0.3, q.y - q.h * 0.5, 22 * (q.sparo / 0.6) + 6, 0, TAU);
          g.fillStyle = '#fff3a0';
          g.fill();
        }
        if (q.fumo > 0) {
          g.globalAlpha = q.fumo / 1.2;
          g.fillStyle = '#e5e5e5';
          g.beginPath();
          g.arc(q.x + q.h * 0.32, q.y - q.h * 0.6 - (1.2 - q.fumo) * 60, 16 + (1.2 - q.fumo) * 20, 0, TAU);
          g.fill();
          g.globalAlpha = 1;
        }
        ctx.etichetta(g, q.p.nome, q.x, q.y + 26, q.p.colore, { dim: 20, maxW: 180 });
        if (fase === 'esito' && s) {
          const txt = s.presto ? '💥 presto!' : s.lento ? '🐢 lento' : `${fmtNum(s.ms / 1000, 3)} s`;
          ctx.testo(g, txt, q.x, q.y - q.h - 26, { dim: 30, colore: s.ms === migliore && !s.presto ? '#ffd23f' : '#fff' });
          if (s.ms === migliore && migliore < PENALITA) ctx.testo(g, '🏆', q.x, q.y - q.h - 70, { dim: 44, bordo: 0 });
        }
      }
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || !d || d.sparo == null) return;
      const quando = Number(d.sparo);
      if (!isFinite(quando)) return;
      spara(q, quando);
    },

    bot(id, dt) {
      const q = perId.get(id);
      if (!q || finito || spari[id] || fase === 'esito') return;
      const cpu = cervello(id);
      const m = cpu.mem;
      if (m.round !== round) inizioRound(cpu, id);
      const ora = ctx.ora();
      // In pausa ctx.ora() va avanti ma il bot è fermo (e i tocchi delle persone non arrivano):
      // lo sparo già deciso slitta della durata della pausa, non "scatta" nel passato.
      const salto = m.oraVista == null ? 0 : ora - m.oraVista - (ctx.tempo - m.tempoVisto) * 1000;
      if (m.tSparo != null && salto > 250) m.tSparo += salto;
      m.oraVista = ora;
      m.tempoVisto = ctx.tempo;
      if (fase === 'pronti') {
        if (finta && finta !== m.finta) {
          // una parola nuova sul cartello: a volte il dito parte prima del cervello
          m.finta = finta;
          if (m.tSparo == null && cpu.prob(m.pFinta * m.kFinta)) {
            const comparsa = ora - (tFase - finta.t) * 1000;
            m.tSparo = comparsa + reazioneBot(cpu) * 1000;
            m.bruciato = true;
          }
          m.fintaNota = true;
          m.kFinta *= 0.7; // dopo una finta si sta più in guardia
        } else if (m.tSparo == null && cpu.prob(m.nervi * m.kNervi * (0.4 + tFase / 2.5) * dt)) {
          m.tSparo = ora; // sparo nervoso: più probabile quando l'attesa si allunga
          m.bruciato = true;
        }
      } else if (fase === 'fuoco' && !m.visto) {
        m.visto = true;
        const quando = oraSegnale + reazioneBot(cpu) * 1000;
        if (m.tSparo == null || quando < m.tSparo) {
          m.tSparo = quando;
          m.bruciato = false;
        }
      }
      if (m.tSparo != null && ora >= m.tSparo) spara(q, m.tSparo);
    },
  };
}
