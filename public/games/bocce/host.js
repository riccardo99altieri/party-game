// Bocce Caotiche: tutti lanciano insieme con la fionda del telefono, 3 ondate.
// Conta la propria boccia più vicina al centro del bersaglio.
// Il campo è rotondo, con il pallino al centro, e i giocatori stanno in cerchio sul
// bordo, alla stessa distanza dal pallino e a distanze uguali tra loro: nessun posto è
// più comodo degli altri. Sul telefono "dritto in su" vuol dire sempre "verso il
// pallino", da qualunque posto.
// (Su un arco aperto, a ventaglio, le bocce di chi sta in mezzo si scontrano in modo
// diverso da quelle di chi sta ai lati, e chi sta in mezzo vinceva più spesso: con il
// cerchio chiuso ogni posto ha gli stessi vicini. Misure in test/bench/azione.mjs.)

import { TAU, clamp, fmtNum, shade } from '../../shared/util.js';

const ONDATE = 3;
const TEMPO_TIRO = 12;
const DECEL = 620;
const V_MIN = 280;
const V_MAX = 1500;
const ANG_MAX = (60 * Math.PI) / 180;
const GRADI = Math.PI / 180;

// Geometria del campo (su 1920×1080): la boccia che esce dal cerchio di sabbia è fuori.
export const CAMPO = { CX: 960, CY: 540, RAGGIO: 400, BORDO: 16 };
// Distanza di tiro, uguale per tutti: il posto è appena dentro il bordo.
export const DISTANZA = CAMPO.RAGGIO - 44;

// Angolo di ogni posto (0 = sotto il pallino, 90° = a destra), in giro come le lancette
// dell'orologio a partire da in basso a sinistra, a distanze uguali.
export function angoliPosti(n) {
  if (n <= 1) return [0];
  const passo = TAU / n;
  return Array.from({ length: n }, (_, i) => -(i + 0.5) * passo);
}

export default {
  id: 'bocce',
  nome: 'Bocce Caotiche',
  emoji: '🎳',
  colore: '#ff8a3d',
  descrizione: 'Lancia la boccia più vicina al centro… e spazza via le altre!',
  comeSiGioca: [
    'Trascina la boccia indietro e lasciala andare, come una fionda',
    'Più tiri indietro, più va lontano: se esce dal campo non vale',
    'Siete tutti in cerchio, alla stessa distanza: tira dritto in su per andare verso il pallino',
    'Tre tiri a testa: tutti lanciano insieme, le bocce si scontrano!',
  ],
  controllo: 'fionda',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const { CX, CY, RAGGIO: RC, BORDO } = CAMPO;
  const D = DISTANZA;
  const ANELLI = [245, 175, 108, 48];
  const R = n <= 8 ? 26 : 22;
  const H_AV = n > 10 ? 90 : 100;
  let fase = 'mira';
  let ondata = 1;
  let tFase = 0;
  let t = 0;
  let finito = false;
  const bocce = [];

  const angoli = angoliPosti(n);
  const gioc = ctx.giocatori.map((p, i) => {
    const th = angoli[i];
    const s = Math.sin(th);
    const c = Math.cos(th);
    // l'avatar sta fuori dal campo, dietro al suo posto (e alla targhetta col nome sul bordo)
    const rAv = RC + BORDO + 6 + 0.3 * H_AV * Math.abs(s) + 0.54 * H_AV * Math.abs(c);
    return {
      id: p.id,
      p,
      th,
      x: CX + s * D,
      y: CY + c * D,
      // direzione del pallino, vista dal posto
      fx: -s,
      fy: -c,
      ax: CX + s * rAv,
      ay: CY + c * rAv + 0.54 * H_AV,
      // targhetta col nome, sul bordo di legno
      nx: CX + s * (RC + BORDO / 2),
      ny: CY + c * (RC + BORDO / 2),
      tirato: false,
      lancio: 0,
      ia: null,
    };
  });
  const perId = new Map(gioc.map((g) => [g.id, g]));
  const perDisegno = [...gioc].sort((a, b) => a.ay - b.ay);
  const larghezzaNome = n > 1 ? clamp(2 * (RC + BORDO / 2) * Math.sin(Math.PI / n) - 30, 70, 200) : 200;

  function vistaTiro(g) {
    ctx.vista(g.id, { ondata, tot: ONDATE, puoi: fase === 'mira' && !g.tirato });
  }
  gioc.forEach(vistaTiro);

  function lancia(g, ang, pot) {
    if (fase !== 'mira' || g.tirato || finito) return;
    g.tirato = true;
    g.lancio = 0.5;
    // l'angolo del telefono è misurato rispetto alla direzione del pallino
    const a = clamp(ang, -ANG_MAX, ANG_MAX) - g.th;
    const v = V_MIN + clamp(pot, 0, 1) * (V_MAX - V_MIN);
    bocce.push({ id: g.id, p: g.p, x: g.x, y: g.y, vx: Math.sin(a) * v, vy: -Math.cos(a) * v, rot: 0, fuori: false, k: 0 });
    sfx.lancio();
    vistaTiro(g);
  }

  function inMovimento() {
    return bocce.some((b) => !b.fuori && Math.hypot(b.vx, b.vy) > 4);
  }

  function fisica(dt) {
    for (const b of bocce) {
      if (b.fuori) {
        b.k += dt;
        continue;
      }
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) {
        const nv = Math.max(0, v - DECEL * dt);
        b.vx *= nv / v;
        b.vy *= nv / v;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (v * dt) / R;
      const dc = Math.hypot(b.x - CX, b.y - CY);
      if (dc > RC + R * 0.5) {
        b.fuori = true;
        const k = (RC - 40) / dc;
        fx.testo(CX + (b.x - CX) * k, CY + (b.y - CY) * k, 'Fuori!', { colore: '#ff4d6d', dim: 36 });
        sfx.fallimento();
      }
    }
    for (let i = 0; i < bocce.length; i++) {
      const a = bocce[i];
      if (a.fuori) continue;
      for (let j = i + 1; j < bocce.length; j++) {
        const b = bocce[j];
        if (b.fuori) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= R * 2 || d < 1e-6) continue;
        const nx = dx / d;
        const ny = dy / d;
        const s = (R * 2 - d) / 2;
        a.x -= nx * s;
        a.y -= ny * s;
        b.x += nx * s;
        b.y += ny * s;
        const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vrel <= 0) continue;
        const imp = (vrel * 1.92) / 2;
        a.vx -= imp * nx;
        a.vy -= imp * ny;
        b.vx += imp * nx;
        b.vy += imp * ny;
        if (vrel > 80) {
          sfx.colpo(clamp(vrel / 700, 0.2, 1));
          fx.particelle(a.x + nx * R, a.y + ny * R, { n: 8, colori: ['#fff', a.p.colore, b.p.colore], vel: 260, grav: 200, vita: 0.4, dim: 7 });
          if (vrel > 500) fx.scuoti(6);
        }
      }
    }
  }

  function distanze() {
    const best = {};
    for (const g of gioc) best[g.id] = Infinity;
    for (const b of bocce) {
      if (b.fuori) continue;
      const d = Math.hypot(b.x - CX, b.y - CY);
      if (d < best[b.id]) best[b.id] = d;
    }
    return best;
  }

  function termina() {
    if (finito) return;
    finito = true;
    const best = distanze();
    const punteggi = {};
    for (const g of gioc) punteggi[g.id] = best[g.id] === Infinity ? 1e9 : Math.round(best[g.id]);
    ctx.fine({
      punteggi,
      alto: false,
      fmt: (v) => (v >= 1e9 ? 'Tutte fuori! 😅' : `a ${fmtNum(v / 4, 0)} cm dal centro`),
    });
  }

  function nuovaOndata() {
    ondata++;
    fase = 'mira';
    tFase = 0;
    for (const g of gioc) g.tirato = false;
    gioc.forEach(vistaTiro);
    sfx.bip();
  }

  function disegnaBoccia(g, b) {
    const a = b.fuori ? Math.max(0, 1 - b.k * 2) : 1;
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.beginPath();
    g.ellipse(b.x + 4, b.y + R * 0.8, R * 0.9, R * 0.35, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fill();
    g.beginPath();
    g.arc(b.x, b.y, R, 0, TAU);
    const grd = g.createRadialGradient(b.x - R * 0.4, b.y - R * 0.4, R * 0.1, b.x, b.y, R);
    grd.addColorStop(0, shade(b.p.colore, 0.5));
    grd.addColorStop(1, shade(b.p.colore, -0.2));
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#1b1030';
    g.stroke();
    g.save();
    g.beginPath();
    g.arc(b.x, b.y, R - 2, 0, TAU);
    g.clip();
    ctx.testa(g, b.p.av, b.x, b.y + R * 0.1, R * 0.82, { rot: Math.sin(b.rot) * 0.5, t });
    g.restore();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // CPU: tira con la fionda come una persona (taratura in test/bench/azione.mjs).
  // Non conosce la "taratura" della fionda: il primo tiro ha un errore sistematico di
  // forza e di direzione, che corregge guardando dove si ferma la sua boccia (solo se
  // nessuno l'ha toccata). A ogni tiro si aggiungono l'errore nello stimare la distanza,
  // quello del dito sulla barra della forza e sulla direzione e, di rado, un tiro storto.
  // Tattica: il Facile tira appena può e sempre al pallino. Il Normale ogni tanto
  // aspetta gli altri e scansa le bocce in mezzo. Il Difficile aspetta che le bocce
  // degli altri si fermino, poi sceglie: bocciare la boccia avversaria che comanda,
  // accostare al pallino passando di lato, o piazzarsi davanti se comanda già lui;
  // se all'ultimo tiro della partita è già in testa, butta la boccia dove non disturba.
  // Ragiona "dal suo posto", come chi tira: di lato (a destra è positivo) e in avanti.

  // Forza che serve perché la boccia si fermi dopo `d` pixel, e viceversa.
  const potPer = (d) => (Math.sqrt(2 * DECEL * Math.max(0, d)) - V_MIN) / (V_MAX - V_MIN);
  const distPer = (pot) => (V_MIN + clamp(pot, 0, 1) * (V_MAX - V_MIN)) ** 2 / (2 * DECEL);

  // Dal campo al punto di vista di chi tira dal posto di `q`, e ritorno.
  const locale = (q, x, y) => ({ lat: -(x - q.x) * q.fy + (y - q.y) * q.fx, avanti: (x - q.x) * q.fx + (y - q.y) * q.fy });
  const campo = (q, lat, avanti) => ({ x: q.x + avanti * q.fx - lat * q.fy, y: q.y + avanti * q.fy + lat * q.fx });

  function nuovaIa(id) {
    const cpu = ctx.cpu(id);
    return {
      cpu,
      // "non conosco ancora la fionda" (il principiante tende a tirare piano, per paura di uscire)
      biasD: cpu.per(-0.12, 0, 0) + cpu.errore(cpu.per(0.35, 0.17, 0.06)),
      biasA: cpu.errore(cpu.per(4.4, 2, 0.6) * GRADI),
      sD: cpu.per(0.2, 0.09, 0.03), // stima della distanza (relativa)
      sPot: cpu.per(0.062, 0.028, 0.009), // dito sulla barra della forza
      sA: cpu.per(7.5, 3.2, 1.2) * GRADI, // dito sulla direzione
      impara: cpu.per(0.5, 0.55, 0.85), // quanto dell'errore visto corregge al tiro dopo
      storto: cpu.per(0.16, 0.05, 0.015),
      occhio: cpu.per(15, 7, 3), // px di imprecisione nel leggere lo schermo grande
      ondata: 0,
      tiro: null,
      aspetta: false,
      minimo: 0,
      limite: 0,
      quando: Infinity,
    };
  }

  function inizioOndata(q, ia) {
    const { cpu } = ia;
    ia.ondata = ondata;
    if (ia.tiro) impara(q, ia);
    ia.aspetta = cpu.livello === 2 ? cpu.prob(0.95) : cpu.livello === 1 && cpu.prob(0.1 + 0.3 * cpu.tratti.pazienza);
    ia.minimo = cpu.pensa(1.5, 2.5);
    ia.limite = cpu.num(7.5, 9.5);
    ia.quando = ia.aspetta ? Infinity : cpu.livello ? cpu.pensa(1.6, 6) : cpu.pensa(1.2, 3.5);
  }

  // Guarda dove si è fermata la propria boccia e corregge (in parte) l'errore sistematico.
  function impara(q, ia) {
    const { cpu, tiro } = ia;
    ia.tiro = null;
    if (tiro.storto || (cpu.livello === 0 && cpu.prob(0.4))) return;
    const b = tiro.b;
    const o = locale(q, b.x, b.y);
    let eD;
    let eA = 0;
    if (b.fuori) {
      // si capisce solo se è uscita dalla parte opposta, oltre il pallino
      if (o.avanti < D) return;
      eD = 0.3; // "troppo forte, è uscita"
    } else {
      // se l'hanno toccata non se ne ricava niente
      const L = distPer(tiro.pot);
      if (Math.hypot(o.lat - Math.sin(tiro.a) * L, o.avanti - Math.cos(tiro.a) * L) > 12) return;
      const lat = o.lat + cpu.errore(ia.occhio);
      const avanti = o.avanti + cpu.errore(ia.occhio);
      eD = Math.hypot(lat, avanti) / tiro.dInt - 1;
      eA = Math.atan2(lat, avanti) - tiro.aInt;
    }
    // il principiante corregge a casaccio: a volte poco, a volte troppo
    const k = ia.impara * (cpu.livello === 0 ? cpu.num(0.2, 2.5) : 1);
    ia.biasD -= k * eD;
    ia.biasA -= k * eA;
  }

  // La strada dal posto di `q` a (tx, ty) è sgombra? Con `soloLoro` contano solo le bocce
  // avversarie lontane dall'arrivo: una boccia presa in pieno va avanti al posto della
  // nostra, quindi spingere la propria verso il pallino va bene, quella altrui no.
  function libera(viste, q, tx, ty, salvo, soloLoro = false) {
    const dx = tx - q.x;
    const dy = ty - q.y;
    const L2 = dx * dx + dy * dy || 1;
    for (const v of viste) {
      if (v === salvo || (soloLoro && (v.mia || Math.hypot(v.x - tx, v.y - ty) < 2 * R))) continue;
      const k = clamp(((v.x - q.x) * dx + (v.y - q.y) * dy) / L2, 0, 1);
      if (Math.hypot(v.x - q.x - dx * k, v.y - q.y - dy * k) < R * 1.9) return false;
    }
    return true;
  }

  // Dove mirare, guardando il campo: { x, y, oltre } (oltre: forza in più, in px, per bocciare).
  function scegliTiro(q, ia) {
    const { cpu } = ia;
    const pallino = { x: CX, y: CY, oltre: 0 };
    if (cpu.livello === 0) return pallino;
    const viste = [];
    let mia = null;
    let loro = null;
    for (const b of bocce) {
      if (b.fuori) continue;
      const v = { mia: b.id === q.id, x: b.x + cpu.errore(ia.occhio), y: b.y + cpu.errore(ia.occhio) };
      v.d = Math.hypot(v.x - CX, v.y - CY);
      viste.push(v);
      if (v.mia && (!mia || v.d < mia.d)) mia = v;
      if (!v.mia && (!loro || v.d < loro.d)) loro = v;
    }
    const comando = mia && (!loro || mia.d < loro.d);
    // Ultimo tiro della partita e già in testa: una boccia corta, lontana da tutto, per non
    // rovinare niente.
    if (cpu.livello === 2 && comando && ondata === ONDATE && gioc.every((g) => g === q || g.tirato)) {
      for (const k of [0, 1, -1]) {
        const s = { ...campo(q, k * 90, 110), oltre: 0 };
        if (libera(viste, q, s.x, s.y, null)) return s;
      }
    }
    const errPunto = D * cpu.per(0.14, 0.1, 0.07);
    // Bocciare: la boccia avversaria che comanda è troppo vicina per batterla accostando.
    if (loro && !comando && loro.d < errPunto * 1.2 && ondata > 1) {
      const voglia = cpu.livello === 2 ? 0.85 : 0.2 * (0.5 + cpu.tratti.aggressivita);
      if (cpu.prob(voglia) && libera(viste, q, loro.x, loro.y, loro)) return { x: loro.x, y: loro.y, oltre: cpu.num(150, 240) };
    }
    if (cpu.livello === 1 && cpu.prob(0.7)) return pallino;
    // Comanda già con una boccia sul pallino: si piazza davanti, fa da scudo e non la tocca.
    if (comando && mia.d < 2 * R) {
      const davanti = { x: CX - q.fx * 2.6 * R, y: CY - q.fy * 2.6 * R, oltre: 0 };
      if (libera(viste, q, davanti.x, davanti.y, null)) return davanti;
    }
    // Accostare; se una boccia avversaria è in mezzo alla strada, sposta la mira quel tanto che basta.
    if (libera(viste, q, CX, CY, null, true)) return pallino;
    for (const k of [1, -1, 1.8, -1.8, 2.6, -2.6]) {
      const s = { x: CX - q.fy * k * R, y: CY + q.fx * k * R, oltre: 0 };
      if (libera(viste, q, s.x, s.y, null, true)) return s;
    }
    return pallino;
  }

  function tira(q, ia) {
    const { cpu } = ia;
    const piano = scegliTiro(q, ia);
    const o = locale(q, piano.x, piano.y);
    const aInt = Math.atan2(o.lat, o.avanti);
    const dInt = Math.hypot(o.lat, o.avanti) + piano.oltre;
    let a = aInt + ia.biasA + cpu.errore(ia.sA);
    let pot = potPer(dInt * (1 + ia.biasD + cpu.errore(ia.sD))) + cpu.errore(ia.sPot);
    const storto = cpu.prob(ia.storto);
    if (storto) {
      // il dito scappa: lascia troppo presto, tira troppo, o storce la direzione
      const k = cpu.caso();
      if (k < 0.35) pot *= cpu.num(0.55, 0.8);
      else if (k < 0.6) pot *= cpu.num(1.25, 1.5);
      else a += (cpu.prob(0.5) ? 1 : -1) * cpu.num(6, 12) * GRADI;
    }
    // come il telefono: angolo limitato e niente lancio se la fionda è appena tirata
    a = clamp(a, -ANG_MAX, ANG_MAX);
    pot = clamp(pot, 0.07, 1);
    lancia(q, a, pot);
    ia.tiro = { b: bocce[bocce.length - 1], aInt, dInt, a, pot, storto };
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      for (const g of gioc) g.lancio = Math.max(0, g.lancio - dt);
      fisica(dt / 3);
      fisica(dt / 3);
      fisica(dt / 3);
      if (finito) return;
      if (fase === 'mira') {
        if (gioc.every((g) => g.tirato) || tFase >= TEMPO_TIRO) {
          fase = 'rotola';
          tFase = 0;
          gioc.forEach(vistaTiro);
        }
      } else if (fase === 'rotola') {
        if (tFase > 0.6 && !inMovimento()) {
          if (ondata < ONDATE) nuovaOndata();
          else {
            fase = 'misura';
            tFase = 0;
            sfx.rullo(1.5);
          }
        }
      } else if (fase === 'misura' && tFase > 3) termina();
    },

    disegna(g) {
      // erba attorno
      g.fillStyle = '#2f7d32';
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < W; x += 80) g.fillRect(x, 0, 40, H);
      // campo rotondo in sabbia, con il bordo di legno
      g.beginPath();
      g.arc(CX, CY, RC + BORDO, 0, TAU);
      g.fillStyle = '#8b5a2b';
      g.fill();
      g.beginPath();
      g.arc(CX, CY, RC, 0, TAU);
      g.fillStyle = '#e8c98f';
      g.fill();
      // pedana di tiro: il cerchio dei posti, tutti alla stessa distanza dal pallino
      g.beginPath();
      g.arc(CX, CY, D, 0, TAU);
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = 2 * R + 22;
      g.stroke();
      // bersaglio
      ANELLI.forEach((r, i) => {
        g.beginPath();
        g.arc(CX, CY, r, 0, TAU);
        g.fillStyle = ['#ffffff', '#ef4444', '#ffffff', '#ef4444'][i];
        g.globalAlpha = 0.75;
        g.fill();
        g.globalAlpha = 1;
      });
      g.beginPath();
      g.arc(CX, CY, 10, 0, TAU);
      g.fillStyle = '#1b1030';
      g.fill();
      // linea di tiro, davanti ai posti
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 5;
      g.setLineDash([22, 14]);
      g.beginPath();
      g.arc(CX, CY, D - R - 11, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      // targhette con i nomi, sul bordo davanti a ogni posto
      for (const q of gioc) ctx.etichetta(g, q.p.nome, q.nx, q.ny, q.p.colore, { dim: 17, maxW: larghezzaNome });

      if (fase === 'misura') {
        const best = distanze();
        const k = clamp(tFase / 1.2, 0, 1);
        for (const b of bocce) {
          if (b.fuori || Math.hypot(b.x - CX, b.y - CY) !== best[b.id]) continue;
          g.strokeStyle = b.p.colore;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(CX, CY);
          g.lineTo(CX + (b.x - CX) * k, CY + (b.y - CY) * k);
          g.stroke();
        }
      }
      // posti di chi deve ancora tirare
      if (fase === 'mira') {
        g.setLineDash([6, 6]);
        g.lineWidth = 3;
        for (const q of gioc) {
          if (q.tirato) continue;
          g.beginPath();
          g.arc(q.x, q.y, R, 0, TAU);
          g.strokeStyle = q.p.colore;
          g.stroke();
        }
        g.setLineDash([]);
      }
      for (const b of bocce) disegnaBoccia(g, b);

      // giocatori attorno al campo, ognuno dietro al suo posto e girato verso il pallino
      for (const q of perDisegno) {
        const pose = q.lancio > 0 ? 'cheer' : fase === 'mira' && !q.tirato ? 'idle' : 'point';
        ctx.avatar(g, q.p.av, q.ax, q.ay, H_AV, { pose, t, look: [q.fx, q.fy] });
      }

      // HUD
      ctx.pannello(g, 40, 20, 330, 76, { r: 38 });
      ctx.testo(g, `Tiro ${ondata} di ${ONDATE}`, 205, 58, { dim: 40 });
      if (fase === 'mira') {
        ctx.barraTempo(g, TEMPO_TIRO - tFase, TEMPO_TIRO, { w: 250, x: 52, y: 122 });
        const mancano = gioc.filter((q) => !q.tirato).length;
        ctx.testo(g, mancano ? `Mancano ${mancano}` : 'Tutti hanno tirato!', W - 220, 58, { dim: 34 });
      } else if (fase === 'misura') {
        ctx.testo(g, 'Misuriamo! 📏', W - 220, 58, { dim: 44, colore: '#ffd23f' });
      }
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || !Array.isArray(d.l)) return;
      const ang = Number(d.l[0]);
      const pot = Number(d.l[1]);
      if (isFinite(ang) && isFinite(pot)) lancia(q, ang, pot);
    },

    bot(id) {
      const q = perId.get(id);
      if (fase !== 'mira' || q.tirato || finito) return;
      const ia = q.ia || (q.ia = nuovaIa(id));
      if (ia.ondata !== ondata) inizioOndata(q, ia);
      // chi aspetta tira quando gli altri hanno tirato e le bocce sono ferme (o il tempo stringe)
      if (ia.quando === Infinity && tFase >= ia.minimo && (tFase >= ia.limite || (gioc.every((g) => g === q || g.tirato) && !inMovimento()))) {
        ia.quando = tFase + ia.cpu.reazione(1.3) + ia.cpu.num(0.5, 1);
      }
      if (tFase >= Math.min(ia.quando, TEMPO_TIRO - 0.4)) tira(q, ia);
    },
  };
}
