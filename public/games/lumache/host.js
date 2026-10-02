// Corsa delle Lumache: ogni giro di dito sulla manovella fa avanzare la lumaca.

import { TAU, clamp, fmtNum, shade, lerp } from '../../shared/util.js';

const GIRI = 45; // giri di manovella per arrivare al traguardo
const DURATA = 90;
const DOPO_PRIMO = 20; // secondi concessi dopo il primo arrivo
const VEL_MAX = 4.5; // giri al secondo (oltre non conta)

export default {
  id: 'lumache',
  nome: 'Corsa delle Lumache',
  emoji: '🐌',
  colore: '#7bd93b',
  descrizione: 'Gira la manovella più veloce che puoi!',
  comeSiGioca: [
    'Fai girare il dito in cerchio sul telefono, in senso orario',
    'Ogni giro fa avanzare la tua lumaca',
    'Vince chi arriva per primo al traguardo 🏁',
  ],
  controllo: 'manovella',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const X0 = 250;
  const X1 = W - 170;
  const top = 150;
  const corsiaH = Math.min(118, (H - top - 30) / n);
  const y0 = top + (H - top - 30 - corsiaH * n) / 2;
  let t = 0;
  let finito = false;
  let primoArrivo = -1;
  let ultimaInfo = 0;
  let classificaViva = [];

  const lum = ctx.giocatori.map((p, i) => ({
    id: p.id,
    p,
    giri: 0,
    vista: 0,
    budget: 1.5,
    arrivo: null,
    vel: 0,
    y: y0 + corsiaH * (i + 0.5),
    ia: null,
    ultimoMezzo: 0,
  }));
  const perId = new Map(lum.map((l) => [l.id, l]));

  for (const l of lum) ctx.vista(l.id, { giri: GIRI, arrivato: false });

  function avanza(l, delta) {
    if (l.arrivo != null || finito) return;
    const d = Math.min(clamp(delta, 0, 0.8), l.budget);
    l.budget -= d;
    l.giri = Math.min(GIRI, l.giri + d);
    if (Math.floor(l.giri * 2) !== l.ultimoMezzo) {
      l.ultimoMezzo = Math.floor(l.giri * 2);
      if (Math.random() < 0.25) fx.particelle(xDi(l.vista) - 40, l.y + corsiaH * 0.2, { n: 2, colore: shade(l.p.colore, 0.4), vel: 60, grav: 50, vita: 0.5, dim: 6 });
    }
    if (l.giri >= GIRI) {
      l.arrivo = ctx.tempo;
      if (primoArrivo < 0) {
        primoArrivo = ctx.tempo;
        sfx.fanfara();
        fx.coriandoli(60);
      } else sfx.ding();
      fx.particelle(X1, l.y, { n: 30, colori: [l.p.colore, '#fff', '#ffd23f'], vel: 380, grav: 400 });
      const pos = lum.filter((x) => x.arrivo != null).length;
      ctx.vista(l.id, { giri: GIRI, arrivato: true, pos, tempo: l.arrivo });
    }
  }

  const xDi = (giri) => X0 + (X1 - X0) * (giri / GIRI);

  function ordinaVivi() {
    return [...lum].sort((a, b) => {
      if (a.arrivo != null && b.arrivo != null) return a.arrivo - b.arrivo;
      if (a.arrivo != null) return -1;
      if (b.arrivo != null) return 1;
      return b.giri - a.giri;
    });
  }

  function termina() {
    if (finito) return;
    finito = true;
    const ordinati = ordinaVivi();
    const gruppi = [];
    for (const l of ordinati) {
      const last = gruppi[gruppi.length - 1];
      const ref = last && perId.get(last[0]);
      const pari = ref && ref.arrivo == null && l.arrivo == null && Math.abs(ref.giri - l.giri) < 1e-6;
      if (pari) last.push(l.id);
      else gruppi.push([l.id]);
    }
    const dettagli = {};
    for (const l of lum) dettagli[l.id] = l.arrivo != null ? `Arrivata in ${fmtNum(l.arrivo, 1)} s` : `${Math.round((l.giri / GIRI) * 100)}% del percorso`;
    ctx.fine({ gruppi, dettagli });
  }

  function disegnaLumaca(g, l, x, y, s) {
    const col = l.p.colore;
    const mov = clamp(l.vel / 3, 0, 1);
    const onda = Math.sin(t * 12) * mov;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    // corpo
    g.beginPath();
    g.moveTo(-58, 18);
    g.quadraticCurveTo(-60, 4, -40, 2);
    g.lineTo(34 + onda * 4, 0);
    g.quadraticCurveTo(58 + onda * 6, -2, 60 + onda * 6, 12);
    g.quadraticCurveTo(58, 22, 40, 22);
    g.closePath();
    g.fillStyle = '#e9d8a6';
    g.fill();
    g.strokeStyle = '#2a1d3d';
    g.lineWidth = 3;
    g.stroke();
    // antenne
    for (const dx of [0, 10]) {
      g.beginPath();
      g.moveTo(46 + dx * 0.3 + onda * 5, 2);
      g.quadraticCurveTo(52 + dx, -18, 50 + dx + onda * 3, -30);
      g.stroke();
      g.beginPath();
      g.arc(50 + dx + onda * 3, -32, 5, 0, TAU);
      g.fillStyle = '#fff';
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(52 + dx + onda * 3, -32, 2.2, 0, TAU);
      g.fillStyle = '#2a1d3d';
      g.fill();
    }
    // guscio
    g.beginPath();
    g.arc(-8, -18, 34, 0, TAU);
    g.fillStyle = col;
    g.fill();
    g.stroke();
    g.strokeStyle = shade(col, -0.35);
    g.lineWidth = 5;
    g.beginPath();
    for (let a = 0; a < TAU * 2.3; a += 0.2) {
      const r = 4 + a * 3.6;
      const px = -8 + Math.cos(a + t * mov * 3) * r;
      const py = -18 + Math.sin(a + t * mov * 3) * r;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // CPU: gira la manovella come un dito vero (taratura in test/bench/azione.mjs).
  // Parte dopo il tempo di reazione e accelera; nel giro il dito rallenta dove il
  // polso fa fatica; si stanca (e recupera un poco quando stacca il dito per
  // riprendere la presa). Guarda la corsa sullo schermo grande: sprint quando vede il
  // traguardo, grinta nel testa a testa; il principiante si scoraggia se resta
  // indietro e si rilassa se è davanti. Spedisce i giri ogni 60 ms, come il telefono.

  function nuovaIa(id) {
    const cpu = ctx.cpu(id);
    return {
      cpu,
      w0: clamp(cpu.per(2.15, 2.45, 2.9) * Math.exp(cpu.errore(0.07)), 1.4, 3.8), // giri/s a dito fresco
      kf: cpu.per(0.0095, 0.009, 0.008) * (1.3 - 0.6 * cpu.tratti.costanza), // quanto in fretta si stanca
      pPausa: cpu.per(0.16, 0.12, 0.08), // stacchi del dito al secondo (a dito fresco)
      pausaMax: cpu.per(0.8, 0.6, 0.45),
      polso: cpu.num(0.12, 0.25),
      variabile: cpu.per(0.07, 0.06, 0.05) * (1.3 - 0.6 * cpu.tratti.costanza), // quanto oscilla il ritmo
      inizio: cpu.reazione(1.4), // vedere il via e appoggiare il dito
      fat: 0,
      w: 0,
      giro: Math.random(),
      pausa: 0,
      spinta: 1,
      deriva: 0,
      tGuarda: 0,
      acc: 0,
      tInvio: 0,
    };
  }

  // Quanto spingere, guardando le lumache disegnate sullo schermo grande.
  function intenzione(l, ia) {
    const { cpu } = ia;
    const tr = cpu.tratti;
    let testa = 0;
    let vicino = false;
    for (const o of lum) {
      if (o === l) continue;
      if (o.vista > testa) testa = o.vista;
      if (Math.abs(o.vista - l.vista) < 2) vicino = true;
    }
    let s = 1;
    if (GIRI - l.vista < cpu.per(3, 5, 7)) s += cpu.per(0.04, 0.1, 0.14);
    else if (vicino) s += cpu.per(0.03, 0.06, 0.08) * (0.5 + tr.aggressivita);
    if (cpu.livello === 0) {
      if (testa - l.vista > 6) s -= 0.15 * (1 - tr.costanza);
      else if (l.vista > testa + 3) s -= 0.08 * tr.pazienza;
    }
    return s;
  }

  return {
    aggiorna(dt) {
      t += dt;
      for (const l of lum) {
        l.budget = Math.min(1.5, l.budget + VEL_MAX * dt);
        const prima = l.vista;
        l.vista = lerp(l.vista, l.giri, Math.min(1, dt * 8));
        l.vel = lerp(l.vel, (l.vista - prima) / Math.max(dt, 1e-3), Math.min(1, dt * 5));
      }
      if (!finito) {
        const tutti = lum.every((l) => l.arrivo != null);
        if (tutti || ctx.tempo >= DURATA || (primoArrivo >= 0 && ctx.tempo - primoArrivo >= DOPO_PRIMO)) termina();
        // Ogni tanto diciamo a ciascuno a che punto è.
        if (ctx.tempo - ultimaInfo > 0.7) {
          ultimaInfo = ctx.tempo;
          classificaViva = ordinaVivi();
          classificaViva.forEach((l, i) => {
            if (l.arrivo == null && !l.p.bot) ctx.invia(l.id, { perc: l.giri / GIRI, pos: i + 1, tot: n });
          });
        }
      }
    },

    disegna(g) {
      // prato
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#5fbf4a');
      grd.addColorStop(1, '#3e9a3a');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // corsie
      lum.forEach((l, i) => {
        g.fillStyle = i % 2 ? '#c89f6a' : '#d4ad78';
        g.fillRect(X0 - 40, y0 + corsiaH * i, X1 - X0 + 120, corsiaH);
      });
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      g.setLineDash([20, 18]);
      for (let i = 1; i < n; i++) {
        g.beginPath();
        g.moveTo(X0 - 40, y0 + corsiaH * i);
        g.lineTo(X1 + 80, y0 + corsiaH * i);
        g.stroke();
      }
      g.setLineDash([]);
      // partenza e traguardo a scacchi
      g.fillStyle = '#fff';
      g.fillRect(X0 - 4, y0, 8, corsiaH * n);
      const q = 16;
      for (let yy = 0; yy < corsiaH * n; yy += q) {
        for (let k = 0; k < 3; k++) {
          g.fillStyle = (Math.floor(yy / q) + k) % 2 ? '#1b1030' : '#fff';
          g.fillRect(X1 + 30 + k * q, y0 + yy, q, Math.min(q, corsiaH * n - yy));
        }
      }
      // scie di bava e lumache
      const s = Math.min(1, corsiaH / 118);
      for (const l of lum) {
        const x = xDi(l.vista);
        g.strokeStyle = l.p.colore;
        g.globalAlpha = 0.35;
        g.lineWidth = corsiaH * 0.18;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(X0, l.y + corsiaH * 0.28);
        g.lineTo(x - 30 * s, l.y + corsiaH * 0.28);
        g.stroke();
        g.globalAlpha = 1;
        disegnaLumaca(g, l, x, l.y + corsiaH * 0.12, s * 0.95);
        ctx.testa(g, l.p.av, x - 8 * s, l.y - corsiaH * 0.2 - 12 * s, 26 * s, { t });
        if (l.arrivo != null) ctx.testo(g, '🏁', x + 70 * s, l.y - 10, { dim: 34 * s + 10, bordo: 0 });
      }
      // nomi a sinistra
      for (const l of lum) ctx.etichetta(g, l.p.nome, 130, l.y, l.p.colore, { dim: Math.max(15, Math.min(22, corsiaH * 0.25)), maxW: 210 });

      // HUD
      const primo = ordinaVivi()[0];
      ctx.barraTempo(g, DURATA - ctx.tempo, DURATA, { w: 600, x: 60, y: 40 });
      if (primo && !finito) {
        ctx.pannello(g, W / 2 - 60, 20, 700, 80, { r: 40 });
        ctx.testo(g, `In testa: ${primo.p.nome}`, W / 2 + 290, 60, { dim: 40, colore: primo.p.colore, maxW: 660 });
      }
      if (primoArrivo >= 0 && !finito) {
        ctx.testo(g, `Ultimi ${Math.ceil(DOPO_PRIMO - (ctx.tempo - primoArrivo))} s!`, W - 200, 60, { dim: 40, colore: '#ffd23f' });
      }
    },

    input(id, d) {
      const l = perId.get(id);
      if (!l) return;
      if (typeof d.g === 'number' && isFinite(d.g)) avanza(l, d.g);
    },

    bot(id, dt) {
      const l = perId.get(id);
      if (l.arrivo != null || finito) return;
      const ia = l.ia || (l.ia = nuovaIa(id));
      const { cpu } = ia;
      if (ctx.tempo < ia.inizio) return;
      ia.tGuarda -= dt;
      if (ia.tGuarda <= 0) {
        ia.tGuarda = cpu.num(0.5, 1.2);
        ia.spinta = intenzione(l, ia);
        ia.deriva = ia.deriva * 0.7 + cpu.errore(ia.variabile);
      }
      if (ia.pausa > 0) {
        ia.pausa -= dt;
        ia.w *= Math.exp(-14 * dt); // dito staccato: la ruota si ferma
        ia.fat = Math.max(0, ia.fat - 0.04 * dt);
      } else {
        const obiettivo = ia.w0 * (1 - ia.fat) * ia.spinta * (1 + ia.deriva);
        ia.w += (obiettivo - ia.w) * Math.min(1, 2.5 * dt);
        if (cpu.prob((ia.pPausa + ia.fat * 0.6) * dt)) ia.pausa = cpu.num(0.2, ia.pausaMax);
      }
      const u = ia.w / ia.w0;
      ia.fat = Math.min(0.6, ia.fat + ia.kf * u * u * dt);
      const d = ia.w * (1 + ia.polso * Math.sin(TAU * ia.giro)) * dt;
      ia.giro += d;
      ia.acc += d;
      ia.tInvio -= dt;
      if (ia.tInvio <= 0) {
        ia.tInvio += 0.06;
        if (ia.acc > 0) avanza(l, ia.acc);
        ia.acc = 0;
      }
    },
  };
}
