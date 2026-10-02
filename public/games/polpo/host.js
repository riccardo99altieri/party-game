// Il Polpo: uno (o due) contro tutti. I pesci attraversano il fondale da sinistra a
// destra in 60 secondi; il Polpo, dalla sua tana in basso, mira un punto sullo schermo e
// usa i suoi poteri. Ogni potere si vede arrivare (preavviso), quindi si può schivare.
// Regole pure (ruoli, forza del Polpo, fondale, punti) in regole.js.

import { TAU, clamp, lerp, shade, fmtNum, dir8, ease } from '../../shared/util.js';
import {
  DURATA,
  ARENA,
  LUNGHEZZA,
  POTERI,
  ORDINE_POTERI,
  EFFETTI,
  configPolpo,
  scegliRuoli,
  generaFondale,
  riparato,
  punteggi,
  suMappa,
  daMappa,
} from './regole.js';
import { creaPercorso } from './percorso.js';

// Velocità di nuoto (px/s) per numero di giocatori: la manopola dell'equilibrio
// (misure in test/bench/polpo.mjs).
// (indice = numero di giocatori; la forza del Polpo cambia a 7, 10 e 13 giocatori)
const VELOCITA = [0, 64, 64, 64, 66, 58, 48, 60, 60, 60, 54, 54, 54, 62, 62, 62, 62];
export function velocita(n) {
  return VELOCITA[clamp(n, 1, 16)];
}

const ROCCIA = '#5b4b6b';
const TANA_Y = 962; // il Polpo sta sulla sabbia, sotto la zona dove nuotano i pesci

export default {
  id: 'polpo',
  nome: 'Il Polpo',
  emoji: '🐙',
  colore: '#8b5cf6',
  descrizione: 'Uno contro tutti: i pesci scappano, il Polpo li acchiappa!',
  comeSiGioca: [
    '🐟 Pesci: arrivate a destra entro 60 secondi, occhio al mirino!',
    '🐙 Il Polpo guarda la TV, mira col dito e usa i suoi poteri',
    '🫧 Ogni tentacolo ruba una bolla: senza bolle sei catturato',
    '🪸 Corallo = 1 punto (ma ti ferma). 🌊 Marea: nasconditi dietro uno scoglio',
  ],
  controllo: 'ruoli',
  // Chi fa il Polpo (vedi regole.js): info = { punti, storico }.
  ruoli: (giocatori, info = {}) => scegliRuoli(giocatori, { punti: info.punti, volte: (info.storico || {}).polpo, escludi: info.escludi }),
  infoRuoli: {
    polpo: {
      speciale: true,
      emoji: '🐙',
      nome: 'Polpo',
      titolo: 'IL POLPO',
      regole: [
        'Guarda la TV: trascina il dito sulla mappa per muovere il mirino',
        'Tocca un potere mentre tieni il mirino, oppure tocca il potere e poi il punto',
        'Ogni potere costa energia; la Marea si usa una volta sola',
        'Ogni tentacolo ruba una bolla al pesce: senza bolle è catturato!',
        'Più pesci fermi (catturati o in ritardo), più sali in classifica!',
      ],
    },
    pesce: {
      emoji: '🐟',
      nome: 'Pesce',
      titolo: 'UN PESCE',
      regole: [
        'Nuota verso destra col joystick e arriva al traguardo entro 60 secondi',
        'SCATTO: velocità doppia per 2 secondi (poi si ricarica)',
        'Guarda la TV: dove mira il Polpo arriva l’attacco, scappa in tempo!',
        'Le bolle 🫧 sopra il tuo pesce: ogni tentacolo te ne ruba una, senza bolle sei catturato',
        'Un corallo vale 1 punto ma ti ferma 1 secondo. Con la Marea, nasconditi dietro uno scoglio',
      ],
    },
  },
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const cfg = configPolpo(n);
  const S = cfg.scala;
  const RP = 26 * S; // ingombro di un pesce
  const RC = 20 * S; // corallo
  const V = velocita(n);
  const ruoli = ctx.ruoli || scegliRuoli(ctx.giocatori);
  const fondale = generaFondale(Math.floor(Math.random() * 1e9), cfg.corsie);
  const { scogli, correnti } = fondale;
  const listaCorsie = fondale.corsie;

  let t = 0;
  let finito = false;
  let fineTra = -1;
  let esito = null;
  let marea = null; // { t, o } durante il preavviso
  let onda = -1; // animazione dell'onda dopo la Marea
  let mareaUsata = false;
  const attacchi = []; // preavvisi in corso
  const meduse = []; // trappole attive
  const tentacoli = []; // tentacoli che si ritirano dopo un colpo a vuoto
  const bolle = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 40, r: 2 + Math.random() * 5 }));

  // ---------------------------------------------------------------------------
  // Giocatori

  const idPolpi = ctx.giocatori.filter((p) => ruoli[p.id] === 'polpo').map((p) => p.id);
  const pesciGiocatori = ctx.giocatori.filter((p) => ruoli[p.id] !== 'polpo');
  const perCorsia = listaCorsie.map(() => 0);
  const pesci = pesciGiocatori.map((p, i) => {
    const corsia = i % listaCorsie.length;
    perCorsia[corsia]++;
    return {
      id: p.id,
      p,
      corsia,
      posto: perCorsia[corsia] - 1,
      x: ARENA.partenza - 55,
      y: 0,
      vx: 0,
      vy: 0,
      jx: 0,
      jy: 0,
      dir: 1,
      presa: 0,
      presaDa: null,
      immune: 0,
      lento: 0,
      invertito: 0,
      scatto: 0,
      cdScatto: 0,
      corallo: 0,
      coralli: 0,
      volo: null,
      arrivato: false,
      catturato: null, // { o, t } quando il Polpo lo porta nella tana
      bolle: cfg.bolle,
      tArrivo: 0,
      parcheggio: null,
      lampo: 0,
      ia: null,
    };
  });
  for (const q of pesci) {
    const c = listaCorsie[q.corsia];
    const k = perCorsia[q.corsia];
    q.y = c.y0 + ((q.posto + 0.5) / k) * (c.y1 - c.y0);
  }
  const tane = idPolpi.length === 2 ? [700, 1220] : [960];
  const polpi = idPolpi.map((id, i) => ({
    id,
    p: ctx.giocatore(id),
    idx: i,
    tana: tane[i],
    mx: tane[i],
    my: (ARENA.y0 + ARENA.y1) / 2,
    energia: cfg.energiaMax,
    tRic: 0,
    cd: Object.fromEntries(ORDINE_POTERI.map((k) => [k, 0])),
    piega: 0,
    braccio: 0,
    ia: null,
  }));
  const perId = new Map([...pesci, ...polpi].map((g) => [g.id, g]));
  const isPolpo = (id) => ruoli[id] === 'polpo';

  // ---------------------------------------------------------------------------
  // Coralli: ceil(pesci / 5) alla volta; quando uno viene preso rinasce altrove.

  const coralli = Array.from({ length: Math.max(1, Math.ceil(pesci.length / 5)) }, () => ({ x: 0, y: 0, corsia: 0, attivo: false, tra: 0 }));
  function libero(x, y, corsia, r) {
    return !scogli.some((s) => s.corsia === corsia && Math.hypot(s.x - x, s.y - y) < s.r + r + 20);
  }
  function piazzaCorallo(c) {
    for (let tent = 0; tent < 40; tent++) {
      const corsia = Math.floor(Math.random() * listaCorsie.length);
      const L = listaCorsie[corsia];
      const x = ARENA.partenza + 220 + Math.random() * (LUNGHEZZA - 400);
      const y = L.y0 + RC + 10 + Math.random() * (L.y1 - L.y0 - 2 * RC - 20);
      if (!libero(x, y, corsia, RC) || coralli.some((o) => o !== c && o.attivo && Math.hypot(o.x - x, o.y - y) < 200)) continue;
      Object.assign(c, { x, y, corsia, attivo: true, tra: 0 });
      return;
    }
    c.tra = 0.5;
  }
  coralli.forEach(piazzaCorallo);

  // ---------------------------------------------------------------------------
  // Telefoni

  const nomiPolpi = polpi.map((o) => o.p.nome);
  function vistaPesce(q) {
    ctx.vista(q.id, {
      ruolo: 'pesce',
      arrivato: q.arrivato,
      catturato: !!q.catturato,
      bolle: q.bolle,
      coralli: q.coralli,
      durataScatto: EFFETTI.scatto,
      cdScatto: EFFETTI.cdScatto,
      resta: Math.max(0, DURATA - t),
      polpi: nomiPolpi,
      finito,
    });
  }
  const mappaTelefono = {
    corsie: listaCorsie.map((c) => [suMappa(0, c.y0)[1], suMappa(0, c.y1)[1]]),
    scogli: scogli.map((s) => [...suMappa(s.x, s.y), s.r]),
    correnti: correnti.map((c) => [...suMappa(c.x0, c.y0), ...suMappa(c.x1, c.y1), c.vx, c.vy]),
    partenza: suMappa(ARENA.partenza, 0)[0],
    traguardo: suMappa(ARENA.traguardo, 0)[0],
  };
  function vistaPolpo(o) {
    const altro = polpi.find((x) => x !== o);
    ctx.vista(o.id, {
      ruolo: 'polpo',
      energia: o.energia,
      max: cfg.energiaMax,
      ricarica: cfg.ricarica,
      tRic: o.tRic,
      cd: { ...o.cd },
      mareaUsata: mareaUsata || !!marea,
      meduse: meduse.map((m) => suMappa(m.x, m.y)),
      maxMeduse: cfg.maxMeduse,
      presi: cfg.presiTentacolo,
      compagno: altro ? altro.p.nome : null,
      mappa: mappaTelefono,
      mira: suMappa(o.mx, o.my),
      resta: Math.max(0, DURATA - t),
      finito,
    });
  }
  const vistaTutti = () => {
    pesci.forEach(vistaPesce);
    polpi.forEach(vistaPolpo);
  };
  vistaTutti();
  const avvisa = (q, ev, extra = {}) => ctx.invia(q.id, { ev, ...extra });

  // ---------------------------------------------------------------------------
  // Poteri del Polpo

  const corsiaDi = (y) => {
    let best = 0;
    let bd = Infinity;
    listaCorsie.forEach((c, i) => {
      const d = y < c.y0 ? c.y0 - y : y > c.y1 ? y - c.y1 : 0;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  function lancia(o, tipo, px, py) {
    const P = POTERI[tipo];
    if (!P || finito || o.energia < P.costo || o.cd[tipo] > 0) return false;
    if (P.unaVolta && (mareaUsata || marea)) return false;
    o.energia -= P.costo;
    o.cd[tipo] = P.cd;
    o.braccio = 0.45;
    if (tipo === 'marea') {
      mareaUsata = true;
      marea = { t: 0, o };
      sfx.rullo(P.tell);
      fx.lampo('rgba(40,120,255,0.35)', 0.4);
      for (const q of pesci) if (inGioco(q)) avvisa(q, 'marea', { dur: P.tell });
    } else {
      let x = clamp(px ?? o.mx, ARENA.partenza - 90, ARENA.traguardo + 60);
      let y = clamp(py ?? o.my, ARENA.y0, ARENA.y1);
      if (tipo === 'medusa') {
        // la medusa si posa dentro una corsia, non sul muro
        const c = listaCorsie[corsiaDi(y)];
        y = clamp(y, c.y0 + 30 * S, c.y1 - 30 * S);
      }
      attacchi.push({ tipo, o, x, y, t: 0, tell: P.tell });
      sfx.tic();
    }
    polpi.forEach(vistaPolpo);
    return true;
  }

  // il tentacolo potenziato afferra due pesci vicini: per questo è un po' più largo
  const raggioColpo = (tipo) => (POTERI[tipo].raggio || 60) * S * (tipo === 'tentacolo' && cfg.presiTentacolo > 1 ? 1.35 : 1);

  function vicini(a, raggio) {
    return pesci
      .filter((q) => inGioco(q) && !q.volo && Math.hypot(q.x - a.x, q.y - a.y) < raggio + RP * 0.35)
      .sort((p1, p2) => Math.hypot(p1.x - a.x, p1.y - a.y) - Math.hypot(p2.x - a.x, p2.y - a.y));
  }

  function spingi(q, frazione) {
    if (q.presa > 0) q.immune = EFFETTI.immune;
    q.presa = 0;
    q.presaDa = null;
    q.corallo = 0;
    q.vx = 0;
    q.vy = 0;
    q.volo = { da: q.x, a: Math.max(ARENA.partenza - 60, q.x - frazione * LUNGHEZZA), t: 0, dur: 0.45 };
    avvisa(q, 'spinta');
  }

  function risolvi(a) {
    const P = POTERI[a.tipo];
    const R = raggioColpo(a.tipo);
    if (a.tipo === 'tentacolo') {
      const presi = vicini(a, R)
        .filter((q) => q.immune <= 0 && q.presa <= 0)
        .slice(0, cfg.presiTentacolo);
      for (const q of presi) {
        q.bolle--;
        q.corallo = 0;
        q.vx = 0;
        q.vy = 0;
        q.lampo = 0.3;
        fx.particelle(q.x, q.y - 30 * S, { n: 10, colori: ['#e6f7ff', '#9fe0ff'], vel: 160, grav: -120, vita: 0.6, dim: 7 });
        if (q.bolle <= 0) {
          cattura(q, a.o);
          continue;
        }
        q.presa = EFFETTI.presa;
        q.presaDa = a.o;
        avvisa(q, 'presa', { dur: EFFETTI.presa, bolle: q.bolle });
        fx.testo(q.x, q.y - 40 * S, q.bolle === 1 ? 'Ultima bolla!' : 'Preso!', { colore: '#ff4d8d', dim: 38 });
        vistaPesce(q);
      }
      if (presi.length) {
        sfx.colpo(0.7);
        sfx.splash();
      } else {
        tentacoli.push({ o: a.o, x: a.x, y: a.y, t: 0 });
        fx.testo(a.x, a.y - 30, 'Mancato!', { colore: '#cfe8ff', dim: 30 });
      }
    } else if (a.tipo === 'spinta') {
      const q = vicini(a, R)[0];
      fx.anello(a.x, a.y, { r: 20, max: R * 1.6, colore: '#bfe9ff', lw: 10, vita: 0.4 });
      sfx.whoosh();
      if (q) {
        spingi(q, EFFETTI.spinta);
        fx.testo(q.x, q.y - 40 * S, 'Via!', { colore: '#bfe9ff', dim: 38 });
      }
    } else if (a.tipo === 'inversione') {
      const q = vicini(a, R)[0];
      fx.particelle(a.x, a.y, { n: 18, colori: ['#2b1846', '#5b2a86', '#1b1030'], vel: 200, grav: -40, vita: 0.8, dim: 14 });
      if (q) {
        q.invertito = EFFETTI.invertito;
        avvisa(q, 'invertito', { dur: EFFETTI.invertito });
        sfx.zap();
        fx.testo(q.x, q.y - 40 * S, 'Al contrario!', { colore: '#c9a7ff', dim: 34 });
      }
    } else if (a.tipo === 'medusa') {
      if (meduse.length >= cfg.maxMeduse) meduse.shift();
      meduse.push({ x: a.x, y: a.y, o: a.o, t: 0 });
      aggiornaStrade();
      sfx.pop();
      polpi.forEach(vistaPolpo);
    }
  }

  function risolviMarea() {
    fx.scuoti(12);
    sfx.boom();
    sfx.whoosh();
    onda = 0;
    for (const q of pesci) {
      if (!inGioco(q)) continue;
      const scogliCorsia = scogli.filter((s) => s.corsia === q.corsia);
      if (!q.volo && riparato(q.x, q.y, scogliCorsia, S)) {
        fx.testo(q.x, q.y - 40 * S, 'Al riparo!', { colore: '#4cd97b', dim: 32 });
        avvisa(q, 'riparato');
      } else spingi(q, EFFETTI.marea);
    }
  }

  // ---------------------------------------------------------------------------
  // Movimento dei pesci

  function spingiFuoriDagliScogli(q) {
    for (const s of scogli) {
      if (s.corsia !== q.corsia) continue;
      const dx = q.x - s.x;
      const dy = q.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = s.r + RP * 0.85;
      if (d < min) {
        q.x = s.x + (dx / d) * min;
        q.y = s.y + (dy / d) * min;
      }
    }
    const c = listaCorsie[q.corsia];
    q.y = clamp(q.y, c.y0 + RP, c.y1 - RP);
    q.x = Math.max(q.x, ARENA.partenza - 100);
  }

  const inGioco = (q) => !q.arrivato && !q.catturato;

  function cattura(q, o) {
    q.catturato = { o, t: 0, x: q.x, y: q.y };
    q.presa = 0;
    q.presaDa = null;
    q.volo = null;
    q.scatto = 0;
    sfx.colpo(1);
    sfx.fallimento();
    fx.scuoti(8);
    fx.testo(q.x, q.y - 44 * S, 'Catturato! 🐙', { colore: '#ff4d8d', dim: 44 });
    avvisa(q, 'catturato');
    vistaPesce(q);
  }

  function arriva(q) {
    q.arrivato = true;
    q.tArrivo = t;
    q.presa = 0;
    q.lento = 0;
    q.invertito = 0;
    q.scatto = 0;
    const gia = pesci.filter((x) => x.arrivato).length;
    const c = listaCorsie[q.corsia];
    q.parcheggio = { x: ARENA.traguardo + 45 + (gia % 3) * 34 * S, y: clamp(q.y, c.y0 + RP, c.y1 - RP) };
    sfx.ding();
    sfx.punto(gia);
    fx.particelle(ARENA.traguardo, q.y, { n: 22, colori: ['#ffd23f', '#fff', q.p.colore], vel: 320, grav: 200, vita: 0.8 });
    fx.testo(q.x, q.y - 44 * S, 'Arrivato! 🏁', { colore: '#ffd23f', dim: 40 });
    avvisa(q, 'arrivato');
    vistaPesce(q);
  }

  function aggiornaPesce(q, dt) {
    q.lampo = Math.max(0, q.lampo - dt);
    if (q.catturato) {
      // il tentacolo lo porta nella tana
      const c = q.catturato;
      c.t += dt;
      const k = ease.inOutQuad(Math.min(1, c.t / 1.2));
      q.x = lerp(c.x, c.o.tana + c.o.piega, k);
      q.y = lerp(c.y, TANA_Y - 60, k);
      return;
    }
    if (q.arrivato) {
      q.x += (q.parcheggio.x - q.x) * Math.min(1, dt * 3);
      q.y += (q.parcheggio.y - q.y) * Math.min(1, dt * 3);
      q.dir = 1;
      return;
    }
    if (q.presa > 0) {
      q.presa -= dt;
      if (q.presa <= 0) {
        q.presa = 0;
        q.presaDa = null;
        q.immune = EFFETTI.immune;
      }
    } else q.immune = Math.max(0, q.immune - dt);
    q.lento = Math.max(0, q.lento - dt);
    q.invertito = Math.max(0, q.invertito - dt);
    if (q.scatto > 0) {
      q.scatto -= dt;
      if (q.scatto <= 0) {
        q.scatto = 0;
        q.cdScatto = EFFETTI.cdScatto;
      }
    } else q.cdScatto = Math.max(0, q.cdScatto - dt);
    if (q.corallo > 0) q.corallo = Math.max(0, q.corallo - dt);
    if (q.volo) {
      q.volo.t += dt;
      const k = ease.outCubic(Math.min(1, q.volo.t / q.volo.dur));
      q.x = lerp(q.volo.da, q.volo.a, k);
      if (q.volo.t >= q.volo.dur) {
        q.volo = null;
        spingiFuoriDagliScogli(q);
      }
      return;
    }
    let dx = q.jx;
    let dy = q.jy;
    if (q.invertito > 0) {
      dx = -dx;
      dy = -dy;
    }
    const m = Math.hypot(dx, dy);
    if (m) {
      dx /= m;
      dy /= m;
    }
    const fermo = q.presa > 0 || q.corallo > 0;
    const vel = fermo ? 0 : V * (q.scatto > 0 ? 2 : 1) * (q.lento > 0 ? EFFETTI.rallenta : 1);
    const k = Math.min(1, dt * 9);
    q.vx += (dx * vel - q.vx) * k;
    q.vy += (dy * vel - q.vy) * k;
    if (fermo) {
      q.vx = 0;
      q.vy = 0;
    }
    let cx = 0;
    let cy = 0;
    if (!fermo) {
      for (const c of correnti) {
        if (c.corsia === q.corsia && q.x > c.x0 && q.x < c.x1 && q.y > c.y0 && q.y < c.y1) {
          cx += c.vx;
          cy += c.vy;
        }
      }
    }
    q.x += (q.vx + cx) * dt;
    q.y += (q.vy + cy) * dt;
    if (Math.abs(q.vx) > 8) q.dir = q.vx > 0 ? 1 : -1;
    spingiFuoriDagliScogli(q);
    if (q.x >= ARENA.traguardo) return arriva(q);
    // coralli
    if (!fermo) {
      for (const c of coralli) {
        if (!c.attivo || c.corsia !== q.corsia || Math.hypot(c.x - q.x, c.y - q.y) > RP + RC) continue;
        c.attivo = false;
        c.tra = 3;
        q.coralli++;
        q.corallo = EFFETTI.corallo;
        q.vx = 0;
        q.vy = 0;
        sfx.moneta();
        fx.testo(q.x, q.y - 44 * S, '+1 🪸', { colore: '#ff9ecb', dim: 38 });
        fx.particelle(c.x, c.y, { n: 14, colori: ['#ff7aa8', '#ffd1e3', '#ffd23f'], vel: 220, grav: 60, vita: 0.6 });
        avvisa(q, 'corallo', { n: q.coralli });
        vistaPesce(q);
        break;
      }
    }
  }

  function separaPesci() {
    for (let i = 0; i < pesci.length; i++) {
      const a = pesci[i];
      if (!inGioco(a) || a.volo) continue;
      for (let j = i + 1; j < pesci.length; j++) {
        const b = pesci[j];
        if (!inGioco(b) || b.volo || b.corsia !== a.corsia) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = RP * 1.6;
        if (d >= min || d < 1e-6) continue;
        const s = (min - d) / 2;
        const af = a.presa > 0 || a.corallo > 0;
        const bf = b.presa > 0 || b.corallo > 0;
        const ka = af ? 0 : bf ? 2 : 1;
        const kb = bf ? 0 : af ? 2 : 1;
        a.x -= (dx / d) * s * ka;
        a.y -= (dy / d) * s * ka;
        b.x += (dx / d) * s * kb;
        b.y += (dy / d) * s * kb;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fine del round

  function termina() {
    if (finito) return;
    finito = true;
    for (const q of pesci) {
      q.jx = 0;
      q.jy = 0;
    }
    esito = punteggi({ polpi: idPolpi, pesci: pesci.map((q) => ({ id: q.id, arrivato: q.arrivato, catturato: !!q.catturato, coralli: q.coralli })) });
    if (esito.fuga) {
      sfx.fanfara();
      fx.coriandoli(140);
    } else if (esito.schiaccia) {
      sfx.boom();
      fx.scuoti(14);
    } else sfx.rullo(0.8);
    fineTra = 2.6;
    vistaTutti();
  }

  // ---------------------------------------------------------------------------
  // CPU dei pesci: nuota verso il traguardo aggirando scogli (e meduse), scappa dai
  // preavvisi che nota, si ripara dalla Marea, prende coralli secondo il carattere.
  // Vede solo la TV: posizioni, preavvisi, mirino ed energia del Polpo.

  function nuovaIaPesce(q) {
    const cpu = ctx.cpu(q.id);
    return {
      cpu,
      passo: cpu.per(0.3, 0.22, 0.15),
      tDecidi: 0,
      tInvio: 0,
      rotta: [1, 0],
      fuga: null, // { dx, dy, fino }
      visti: new Map(), // attacco -> { vede, quando }
      marea: null, // { vede, quando, meta }
      zig: 1,
      tZig: 0,
      bersaglio: null, // corallo inseguito
      mirato: null, // il mirino del Polpo è addosso: { o, vede, quando }
      coralliValutati: new WeakSet(),
      adatta: -1,
      fineInv: -1,
      eraInvertito: false,
      scattoCasuale: cpu.per(0.25, 0, 0),
      attenzione: cpu.per(0.3, 0.7, 0.95),
      riparo: cpu.per(0.2, 0.55, 0.9),
      evitaMeduse: cpu.per(0.5, 0.85, 1),
      sbaglia: cpu.per(0.14, 0.03, 0),
      // il principiante ogni tanto si distrae (guarda il telefono) e si ferma un attimo
      distrazione: cpu.per(0.1, 0.02, 0),
      distratto: 0,
      tempoAdatta: () => cpu.per(cpu.num(1.5, 2.5), cpu.num(0.8, 1.3), cpu.num(0.4, 0.7)),
    };
  }

  // Strade verso il traguardo (vedi percorso.js): una che ignora le meduse, una che le
  // evita e una "furba" che evita anche le controcorrenti (per il Difficile).
  const strade = { base: creaPercorso(fondale, { raggio: RP }) };
  function aggiornaStrade() {
    const opz = { raggio: RP, meduse, rMedusa: (POTERI.medusa.raggio + 26) * S + 12 };
    strade.meduse = meduse.length ? creaPercorso(fondale, opz) : strade.base;
    strade.furba = creaPercorso(fondale, { ...opz, furbo: true });
  }
  aggiornaStrade();

  function minacciaVicina(q, a) {
    const R = raggioColpo(a.tipo);
    return Math.hypot(q.x - a.x, q.y - a.y) < R + RP + 18 * S;
  }

  function energiaPolpi() {
    return polpi.reduce((m, o) => Math.max(m, o.energia), 0);
  }

  function botPesce(q, dt) {
    if (!inGioco(q) || finito) return;
    const ia = q.ia || (q.ia = nuovaIaPesce(q));
    const { cpu } = ia;
    // preavvisi: ognuno viene notato (o no) una volta, dopo il tempo di reazione
    for (const a of attacchi) {
      if (!ia.visti.has(a)) ia.visti.set(a, { vede: cpu.prob(ia.attenzione), quando: t + cpu.reazione() });
      const v = ia.visti.get(a);
      if (!v.vede || t < v.quando || v.fatto || !minacciaVicina(q, a)) continue;
      v.fatto = true;
      let ex = q.x - a.x;
      let ey = q.y - a.y;
      const d = Math.hypot(ex, ey);
      if (d < 6) {
        const L = listaCorsie[q.corsia];
        ex = 0.6;
        ey = q.y < (L.y0 + L.y1) / 2 ? 1 : -1;
      }
      // meglio scappare anche un po' in avanti
      ex = ex / (d || 1) + 0.5;
      ey = ey / (d || 1);
      const resta = a.tell - a.t;
      const R = raggioColpo(a.tipo) + RP + 18 * S - d;
      const serve = R / V > resta;
      const scatta = q.cdScatto <= 0 && q.scatto <= 0 && (cpu.livello === 2 ? serve : cpu.prob(cpu.per(0.3, 0.5, 0)));
      if (scatta) botScatto(q);
      ia.fuga = { dx: ex, dy: ey, fino: t + resta + 0.15 };
      ia.bersaglio = null;
    }
    for (const a of ia.visti.keys()) if (!attacchi.includes(a)) ia.visti.delete(a);
    // Marea: riparo dietro uno scoglio
    if (marea && !ia.marea) ia.marea = { vede: cpu.prob(ia.riparo), quando: t + cpu.reazione(1.2) };
    if (!marea) ia.marea = null;
    if (ia.marea && ia.marea.vede && t >= ia.marea.quando && !ia.marea.meta) {
      const resta = POTERI.marea.tell - marea.t;
      let meta = null;
      let md = Infinity;
      for (const s of scogli) {
        if (s.corsia !== q.corsia) continue;
        const mx = s.x - s.r - 40 * S;
        const d = Math.hypot(mx - q.x, s.y - q.y);
        const vel = V * (q.cdScatto <= 0 ? 1.6 : 1);
        if (d / vel < resta - 0.15 && d < md && strade.base.dritto(q.x, q.y, mx, s.y)) {
          md = d;
          meta = { x: mx, y: s.y };
        }
      }
      ia.marea.meta = meta || { nessuna: true };
      if (meta && md / V > resta - 0.3 && q.cdScatto <= 0 && q.scatto <= 0 && cpu.livello) botScatto(q);
    }
    // il mirino del Polpo: ci si accorge (o no) quando arriva vicino
    const mirino = polpi.find((o) => Math.hypot(o.mx - q.x, o.my - q.y) < 150 * S);
    if (!mirino) ia.mirato = null;
    else if (!ia.mirato) {
      ia.mirato = { o: mirino, vede: cpu.prob(cpu.per(0.05, 0.45, 0.95)), quando: t + cpu.reazione(), da: t, scattato: false };
    } else if (ia.mirato.vede && !ia.mirato.scattato && t >= ia.mirato.quando && q.cdScatto <= 0 && q.scatto <= 0) {
      // col mirino addosso (e l'ultima bolla, o da un po') il Difficile scatta via; il Normale a volte
      if ((q.bolle <= 1 || t - ia.mirato.da > 0.8) && cpu.prob(cpu.per(0, 0.35, 0.9))) botScatto(q);
      ia.mirato.scattato = true;
    }
    // inversione dei comandi: ci vuole un po' a capirla (e a smettere di correggere)
    if (q.invertito > 0 && !ia.eraInvertito) ia.adatta = t + ia.tempoAdatta();
    if (q.invertito <= 0 && ia.eraInvertito) ia.fineInv = t + cpu.reazione();
    ia.eraInvertito = q.invertito > 0;

    if (t < ia.distratto) {
      if (q.jx || q.jy) input(q.id, { j: [0, 0] });
      return;
    }
    if (t >= ia.tDecidi) {
      ia.tDecidi = t + ia.passo * cpu.num(0.8, 1.25);
      if (!ia.fuga && cpu.prob(ia.distrazione * ia.passo)) {
        ia.distratto = t + cpu.num(0.4, 1);
        return;
      }
      let d;
      if (ia.fuga && t < ia.fuga.fino) d = [ia.fuga.dx, ia.fuga.dy];
      else if (ia.marea && ia.marea.meta && !ia.marea.meta.nessuna) {
        const m = ia.marea.meta;
        d = Math.hypot(m.x - q.x, m.y - q.y) < 12 ? [0, 0] : [m.x - q.x, m.y - q.y];
      } else {
        ia.fuga = null;
        // coralli (spingi la fortuna)
        for (const c of coralli) {
          if (!c.attivo || c.corsia !== q.corsia || ia.coralliValutati.has(c)) continue;
          const dc = Math.hypot(c.x - q.x, c.y - q.y);
          const avanti = c.x > q.x - 60;
          let voglia = 0;
          if (cpu.livello === 0 && dc < 300) voglia = 0.35;
          else if (cpu.livello === 1 && dc < 230 && avanti) voglia = 0.5;
          else if (cpu.livello === 2 && dc < 330 && avanti && q.bolle > 1) {
            const sguardoLontano = polpi.every((o) => Math.hypot(o.mx - c.x, o.my - c.y) > 320);
            const tempo = (ARENA.traguardo - q.x) / V + 10 < DURATA - t;
            voglia = tempo && (energiaPolpi() <= 1 || sguardoLontano) ? 0.9 : 0;
          }
          if (voglia === 0 && dc > 430) continue;
          ia.coralliValutati.add(c);
          if (cpu.prob(voglia)) ia.bersaglio = c;
        }
        if (ia.bersaglio && !ia.bersaglio.attivo) ia.bersaglio = null;
        let strada = cpu.livello === 2 ? strade.furba : cpu.prob(ia.evitaMeduse) ? strade.meduse : strade.base;
        if (strada.strada(q.x, q.y) === Infinity) strada = strade.base;
        d = strada.direzione(q.x, q.y);
        if (ia.bersaglio) {
          const c = ia.bersaglio;
          if (strada.dritto(q.x, q.y, c.x, c.y)) d = [c.x - q.x, c.y - q.y];
          else ia.bersaglio = null;
        }
        // il mirino del Polpo addosso: chi se ne accorge cambia direzione (zig-zag)
        if (ia.mirato && ia.mirato.vede && t >= ia.mirato.quando && !ia.bersaglio) {
          if (t >= ia.tZig) {
            const o = ia.mirato.o;
            ia.zig = Math.abs(o.my - q.y) > 10 * S && cpu.prob(0.7) ? Math.sign(q.y - o.my) : -ia.zig;
            ia.tZig = t + cpu.per(0.6, cpu.num(0.4, 0.65), cpu.num(0.25, 0.45));
          }
          const zx = d[0] >= 0 ? 1 : -1;
          if (strade.base.dritto(q.x, q.y, q.x + zx * 28 * S, q.y + ia.zig * 28 * S)) d = [zx, ia.zig];
        }
        if (cpu.prob(ia.sbaglia)) d = [cpu.num(-1, 1), cpu.num(-1, 1)];
      }
      ia.rotta = dir8(d[0], d[1], 0.01);
      // scatto (come le persone, lo si usa spesso): il Facile a caso, il Normale appena può
      // quando va avanti, il Difficile lo tiene per schivare se il Polpo lo guarda e ha energia
      if (q.cdScatto <= 0 && q.scatto <= 0 && ia.rotta[0] > 0 && !ia.fuga) {
        const aSecco = energiaPolpi() <= 1;
        const guardato = polpi.some((o) => Math.hypot(o.mx - q.x, o.my - q.y) < 380);
        const voglia = cpu.livello === 2 ? (aSecco || !guardato || DURATA - t < 12 ? 0.8 : 0) : cpu.livello === 1 ? 0.35 : ia.scattoCasuale;
        if (cpu.prob(voglia)) botScatto(q);
      }
    }
    let [ux, uy] = ia.rotta;
    const compensa = (q.invertito > 0 && ia.adatta >= 0 && t >= ia.adatta) || (q.invertito <= 0 && t < ia.fineInv);
    if (compensa) {
      ux = -ux;
      uy = -uy;
    }
    if (ux !== q.jx || uy !== q.jy) input(q.id, { j: [ux, uy] });
  }

  function botScatto(q) {
    input(q.id, { s: 1 });
  }

  // ---------------------------------------------------------------------------
  // CPU del Polpo: muove il mirino come un dito (e così si tradisce), sceglie chi
  // colpire (chi è avanti, chi è fermo su un corallo, chi ha appena usato lo scatto,
  // chi è tenuto dal tentacolo), anticipa il movimento secondo il livello.

  function nuovaIaPolpo(o) {
    const cpu = ctx.cpu(o.id);
    return {
      cpu,
      passo: cpu.per(0.6, 0.5, 0.34),
      tDecidi: cpu.pensa(0.8, 1.6),
      piano: null, // { tipo, q, x, y, scade, pronto }
      visti: new Map(), // id -> { x, y, t, vx, vy }
      presaVista: new Map(), // id -> t in cui l'ha visto afferrato
      scattoVisto: new Map(), // id -> t in cui l'ha visto scattare
      occhio: cpu.per(16, 10, 5),
      anticipo: cpu.per(0, 0.25, 0.5),
      mira: cpu.per(40, 32, 20),
      vel: cpu.per(900, 1200, 1600),
      tolleranza: cpu.per(55, 36, 22),
      tInvio: 0,
      tUltimo: 0,
    };
  }

  function osserva(ia) {
    const { cpu } = ia;
    for (const q of pesci) {
      if (!inGioco(q)) {
        ia.visti.delete(q.id);
        continue;
      }
      const x = q.x + cpu.errore(ia.occhio);
      const y = q.y + cpu.errore(ia.occhio);
      const v = ia.visti.get(q.id);
      if (v && t - v.t > 0.05) {
        const k = Math.min(1, (t - v.t) / 0.4);
        v.vx = lerp(v.vx, (x - v.x) / (t - v.t), k);
        v.vy = lerp(v.vy, (y - v.y) / (t - v.t), k);
        v.x = x;
        v.y = y;
        v.t = t;
      } else if (!v) ia.visti.set(q.id, { x, y, t, vx: 0, vy: 0 });
      if (q.presa > 0 && !ia.presaVista.has(q.id)) ia.presaVista.set(q.id, t);
      if (q.presa <= 0) ia.presaVista.delete(q.id);
      if (q.scatto > 0) ia.scattoVisto.set(q.id, t);
    }
  }

  function puo(o, tipo, riserva = 0) {
    const P = POTERI[tipo];
    return o.cd[tipo] <= 0 && o.energia >= P.costo + riserva && !(P.unaVolta && (mareaUsata || marea));
  }

  function progresso(q) {
    return (q.x - ARENA.partenza) / LUNGHEZZA;
  }

  // Quanto conviene inseguire un pesce: chi è "al limite" (con qualche ritardo in più non
  // arriva in tempo), chi ha poche bolle (catturarlo lo toglie di mezzo), chi è fermo su un
  // corallo. Il Normale stima a occhio e guarda anche chi è avanti; il Difficile stima
  // meglio e punisce chi ha appena usato lo scatto (per un po' non può scappare).
  function valore(ia, x) {
    const { cpu } = ia;
    const stima = (ARENA.traguardo - x.x) / (V * 1.1) + cpu.errore(cpu.per(0, 6, 2));
    const margine = DURATA - t - stima;
    if (margine < -3) return -Infinity;
    let v = 1 / (1 + Math.max(0, margine) / 6) + progresso(x) * cpu.per(0, 0.6, 0.15) + cpu.num(0, 0.15);
    if (x.corallo > 0) v += 0.3;
    if (x.lento > 0) v += 0.15;
    v += (cfg.bolle - x.bolle) * cpu.per(0, 0.1, 0.45);
    if (cpu.livello === 2) {
      const sc = ia.scattoVisto.get(x.id);
      if (sc != null && t - sc < EFFETTI.scatto + EFFETTI.cdScatto - 0.5) v += 0.3;
    }
    return v;
  }

  // Il potere principale è il tentacolo (le catture tolgono pesci per sempre): si lancia
  // appena è pronto. Spinta sul pesce tenuto (combo) o su chi sta per arrivare, medusa
  // davanti ai primi, Marea verso la fine quando tanti pesci sono allo scoperto.
  function pianifica(o, ia) {
    const { cpu } = ia;
    const vivi = pesci.filter((q) => inGioco(q) && ia.visti.has(q.id));
    if (!vivi.length) return null;
    const tardi = DURATA - t < 15;
    // il Difficile, da metà partita, tiene da parte l'energia per la Marea
    const riserva = cpu.livello === 2 && !mareaUsata && !marea && t > 28 && !tardi ? POTERI.marea.costo : 0;
    if (puo(o, 'marea')) {
      const esposti = vivi.filter((q) => progresso(q) > 0.3 && !riparato(q.x, q.y, scogli.filter((s) => s.corsia === q.corsia), S));
      let voglia = 0;
      if (cpu.livello === 0) voglia = t > 4 ? 0.12 : 0;
      else if (cpu.livello === 1) voglia = t > 36 && esposti.length >= vivi.length / 2 ? 0.5 : 0;
      else voglia = (t > 30 && esposti.length >= Math.max(2, vivi.length * 0.5)) || (tardi && esposti.some((q) => progresso(q) > 0.6)) ? 1 : 0;
      if (cpu.prob(voglia)) return { tipo: 'marea', pronto: t + cpu.reazione(0.8) };
    }
    // Combo: un pesce tenuto dal tentacolo non può scappare dalla spinta
    for (const q of vivi) {
      const da = ia.presaVista.get(q.id);
      if (da == null) continue;
      const resta = EFFETTI.presa - (t - da);
      if (resta > POTERI.spinta.tell + 0.25 && puo(o, 'spinta', riserva) && o.energia >= 3 && cpu.prob(cpu.per(0.25, 0.5, 0.9))) return { tipo: 'spinta', q, anticipo: 0 };
    }
    // Tentacolo sul pesce che conviene di più (tra quelli che si possono afferrare)
    const afferrabili = vivi.filter((x) => x.immune <= 0 && x.presa <= 0);
    let q = null;
    if (cpu.livello === 0) {
      const vicino = afferrabili.filter((x) => Math.hypot(x.x - o.mx, x.y - o.my) < 500);
      q = vicino.length ? cpu.scegli(vicino) : afferrabili.length ? cpu.scegli(afferrabili) : null;
    } else {
      let best = -Infinity;
      for (const x of afferrabili) {
        const v = valore(ia, x);
        if (v > best) {
          best = v;
          q = x;
        }
      }
    }
    if (q && puo(o, 'tentacolo', riserva)) return { tipo: 'tentacolo', q, anticipo: ia.anticipo };
    // Mentre il tentacolo si ricarica: spinta su chi sta per arrivare, medusa davanti
    const primo = vivi.reduce((m, x) => (x.x > m.x ? x : m));
    const ricarica = o.cd.tentacolo > 0.8;
    if (ricarica && progresso(primo) > 0.72 && puo(o, 'spinta', riserva + 1) && cpu.prob(cpu.per(0.3, 0.6, 0.9))) return { tipo: 'spinta', q: primo, anticipo: ia.anticipo };
    if (ricarica && puo(o, 'medusa', riserva + 1) && meduse.length < cfg.maxMeduse && cpu.prob(cpu.per(0.15, 0.25, 0.35))) {
      const bersaglio = cpu.livello === 0 ? cpu.scegli(vivi) : primo;
      if (cpu.livello === 0) return { tipo: 'medusa', q: bersaglio, anticipo: 0 };
      // il Difficile la mette sulla strada che il pesce dovrà fare; il Normale dritta davanti
      const [x, y] = cpu.livello === 2 ? strade.base.avanti(bersaglio.x, bersaglio.y, V * 2.2) : [bersaglio.x + V * 1.8, bersaglio.y];
      return { tipo: 'medusa', q: bersaglio, x, y, fisso: true };
    }
    if (cpu.livello === 0 && puo(o, 'inversione') && cpu.prob(0.15)) return { tipo: 'inversione', q: cpu.scegli(vivi), anticipo: 0 };
    return null;
  }

  function puntoDelPiano(o, ia) {
    const pl = ia.piano;
    if (pl.fisso) return [pl.x, pl.y];
    const v = ia.visti.get(pl.q.id);
    if (!v) return null;
    const lead = pl.anticipo * (POTERI[pl.tipo].tell + 0.15);
    return [v.x + v.vx * lead + pl.ex, v.y + v.vy * lead + pl.ey];
  }

  function botPolpo(o, dt) {
    if (finito) return;
    const ia = o.ia || (o.ia = nuovaIaPolpo(o));
    const { cpu } = ia;
    osserva(ia);
    if (ia.piano && (t > ia.piano.scade || (ia.piano.q && (!inGioco(ia.piano.q) || !ia.visti.has(ia.piano.q.id))))) ia.piano = null;
    if (!ia.piano && t >= ia.tDecidi) {
      ia.tDecidi = t + ia.passo * cpu.num(0.8, 1.3);
      const pl = pianifica(o, ia);
      if (pl) {
        pl.scade = t + 2.5;
        pl.ex = cpu.errore(ia.mira * S);
        pl.ey = cpu.errore(ia.mira * S);
        ia.piano = pl;
      }
    }
    const pl = ia.piano;
    if (!pl) return;
    if (pl.tipo === 'marea') {
      if (t >= pl.pronto) {
        input(o.id, { p: 'marea' });
        ia.piano = null;
      }
      return;
    }
    const punto = puntoDelPiano(o, ia);
    if (!punto) return (ia.piano = null);
    // il mirino si muove come un dito, con la sua velocità (e il telefono lo manda ogni 40 ms)
    const dx = punto[0] - o.mx;
    const dy = punto[1] - o.my;
    const d = Math.hypot(dx, dy);
    if (d > 1 && t >= ia.tInvio) {
      const passo = Math.min(d, ia.vel * Math.max(dt, t - ia.tUltimo));
      ia.tUltimo = t;
      ia.tInvio = t + 0.04;
      input(o.id, { m: suMappa(o.mx + (dx / d) * passo, o.my + (dy / d) * passo) });
    }
    if (d < ia.tolleranza * S) {
      if (pl.pronto == null) pl.pronto = t + cpu.reazione(0.45);
      if (t >= pl.pronto) {
        input(o.id, { p: pl.tipo });
        ia.piano = null;
        ia.tDecidi = t + ia.passo * cpu.num(0.5, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Input (telefoni e CPU passano di qui)

  function input(id, d) {
    const g = perId.get(id);
    if (!g || !d || finito) return;
    if (isPolpo(id)) {
      if (Array.isArray(d.m)) {
        const u = Number(d.m[0]);
        const v = Number(d.m[1]);
        if (isFinite(u) && isFinite(v)) [g.mx, g.my] = daMappa(u, v);
      }
      if (typeof d.p === 'string' && POTERI[d.p]) {
        let x;
        let y;
        if (Array.isArray(d.a) && isFinite(Number(d.a[0])) && isFinite(Number(d.a[1]))) {
          [x, y] = daMappa(Number(d.a[0]), Number(d.a[1]));
          g.mx = x;
          g.my = y;
        }
        lancia(g, d.p, x, y);
      }
      return;
    }
    if (Array.isArray(d.j)) {
      const x = Number(d.j[0]);
      const y = Number(d.j[1]);
      if (isFinite(x) && isFinite(y)) [g.jx, g.jy] = dir8(x, y);
    }
    if (d.s && inGioco(g) && g.scatto <= 0 && g.cdScatto <= 0 && g.presa <= 0 && !g.volo) {
      g.scatto = EFFETTI.scatto;
      sfx.whoosh();
      avvisa(g, 'scatto', { dur: EFFETTI.scatto, cd: EFFETTI.cdScatto });
    }
  }

  // ---------------------------------------------------------------------------
  // Disegno

  function tentacolo(g, o, x, y, k, colore, spesso = 16) {
    const x0 = o.tana + o.piega;
    const y0 = TANA_Y - 50;
    const cx = lerp(x0, x, 0.5) + Math.sin(t * 3 + o.idx) * 40;
    const cy = lerp(y0, y, 0.2) + 60;
    const n = 18;
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let i = 0; i <= n * k; i++) {
        const s = i / n;
        const px = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x;
        const py = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokeStyle = pass ? colore : 'rgba(20,10,45,0.8)';
      g.lineWidth = pass ? spesso * S : (spesso + 6) * S;
      g.stroke();
    }
  }

  function anello(g, x, y, r, colore, k) {
    g.save();
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 18);
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = colore;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 5;
    g.setLineDash([14, 10]);
    g.strokeStyle = '#fff';
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    g.lineWidth = 8;
    g.strokeStyle = '#ff4d6d';
    g.stroke();
    g.restore();
  }

  function disegnaSfondo(g) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#2a8fd6');
    grd.addColorStop(0.55, '#135a9e');
    grd.addColorStop(1, '#0a2e5c');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // raggi di luce
    g.save();
    g.globalAlpha = 0.07;
    g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 380 + t * 12) % (W + 400)) - 200;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 140, 0);
      g.lineTo(x - 60, H);
      g.lineTo(x - 260, H);
      g.fill();
    }
    g.restore();
    // bolle
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (const b of bolle) {
      g.beginPath();
      g.arc(b.x + Math.sin(t * 2 + b.y * 0.01) * 6, b.y, b.r, 0, TAU);
      g.fill();
    }
    // sabbia e alghe
    g.fillStyle = '#d9b77a';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, 862 + Math.sin(x * 0.012) * 10);
    g.lineTo(W, H);
    g.fill();
    g.fillStyle = '#c9a466';
    for (let x = 30; x < W; x += 97) {
      g.beginPath();
      g.ellipse(x, 900 + (x % 5) * 20, 22, 7, 0, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#2f9e5b';
    g.lineWidth = 9;
    g.lineCap = 'round';
    for (let x = 60; x < W; x += 230) {
      g.beginPath();
      g.moveTo(x, 870);
      for (let k = 1; k <= 6; k++) g.lineTo(x + Math.sin(t * 1.5 + k + x) * 12, 870 - k * 22);
      g.stroke();
    }
  }

  function disegnaCampo(g) {
    // partenza e traguardo
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, ARENA.y0, ARENA.partenza, ARENA.y1 - ARENA.y0);
    g.save();
    g.setLineDash([18, 12]);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.moveTo(ARENA.partenza, ARENA.y0);
    g.lineTo(ARENA.partenza, ARENA.y1);
    g.stroke();
    g.restore();
    for (let y = ARENA.y0, i = 0; y < ARENA.y1; y += 24, i++) {
      g.fillStyle = i % 2 ? '#1b1030' : '#fff';
      g.fillRect(ARENA.traguardo - 6, y, 12, 24);
    }
    g.fillStyle = 'rgba(255,210,63,0.12)';
    g.fillRect(ARENA.traguardo + 6, ARENA.y0, W - ARENA.traguardo, ARENA.y1 - ARENA.y0);
    ctx.testo(g, '🏁', ARENA.traguardo + 75, ARENA.y1 - 26, { dim: 44, bordo: 0 });
    // muri tra le corsie
    for (let i = 1; i < listaCorsie.length; i++) {
      const y0 = listaCorsie[i - 1].y1;
      const y1 = listaCorsie[i].y0;
      g.fillStyle = ROCCIA;
      g.beginPath();
      g.roundRect(ARENA.partenza - 120, y0, LUNGHEZZA + 240, y1 - y0, 12);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let x = ARENA.partenza - 100; x < ARENA.traguardo + 100; x += 60) g.fillRect(x, y0 + 4, 30, 4);
    }
    // correnti
    for (const c of correnti) {
      g.fillStyle = c.vx < 0 ? 'rgba(255,120,120,0.10)' : 'rgba(160,230,255,0.12)';
      g.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
      g.strokeStyle = c.vx < 0 ? 'rgba(255,190,190,0.5)' : 'rgba(220,245,255,0.55)';
      g.lineWidth = 3;
      const vx = Math.sign(c.vx);
      const vy = Math.sign(c.vy);
      for (let i = 0; i < 7; i++) {
        const fase = (t * 0.6 + i / 7) % 1;
        const x = c.vx ? c.x1 - fase * (c.x1 - c.x0) : c.x0 + ((i + 0.5) / 7) * (c.x1 - c.x0);
        const y = c.vy ? (c.vy > 0 ? c.y0 + fase * (c.y1 - c.y0) : c.y1 - fase * (c.y1 - c.y0)) : c.y0 + ((i + 0.5) / 7) * (c.y1 - c.y0);
        g.beginPath();
        g.moveTo(x - vx * 22, y - vy * 22);
        g.lineTo(x + vx * 22, y + vy * 22);
        g.lineTo(x + vx * 10 - vy * 8, y + vy * 10 + vx * 8);
        g.stroke();
      }
    }
    // scogli
    for (const s of scogli) {
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(s.x + 8, s.y + s.r * 0.75, s.r, s.r * 0.35, 0, 0, TAU);
      g.fill();
      g.fillStyle = ROCCIA;
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * TAU;
        const rr = s.r * (0.9 + 0.1 * Math.sin(i * 2.3 + s.x));
        if (i === 0) g.moveTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
        else g.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#2e2440';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.35, s.r * 0.35, s.r * 0.2, -0.4, 0, TAU);
      g.fill();
    }
    // durante la Marea: le zone riparate dietro gli scogli
    if (marea) {
      g.fillStyle = `rgba(76,217,123,${0.18 + 0.1 * Math.sin(t * 10)})`;
      for (const s of scogli) {
        g.beginPath();
        g.roundRect(s.x - s.r - 95 * S, s.y - s.r * 0.85, 95 * S + s.r * 0.3, s.r * 1.7, 14);
        g.fill();
      }
    }
  }

  function disegnaCorallo(g, c) {
    const k = 1 + Math.sin(t * 4 + c.x) * 0.06;
    g.save();
    g.translate(c.x, c.y + RC * 0.8);
    g.scale(S * k, S * k);
    g.strokeStyle = '#ff7aa8';
    g.lineCap = 'round';
    g.lineWidth = 7;
    const rami = [[0, -34], [-14, -26], [14, -28], [-22, -12], [22, -14]];
    for (const [x, y] of rami) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(x * 0.3, y * 0.6, x, y);
      g.stroke();
    }
    g.fillStyle = '#ffd1e3';
    for (const [x, y] of rami) {
      g.beginPath();
      g.arc(x, y, 5, 0, TAU);
      g.fill();
    }
    g.restore();
    g.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 6 + c.y)})`;
    g.beginPath();
    g.arc(c.x + 16 * S, c.y - 18 * S, 3, 0, TAU);
    g.fill();
  }

  function disegnaMedusa(g, x, y, alfa = 1) {
    g.save();
    g.globalAlpha = alfa;
    const b = Math.sin(t * 3 + x) * 4;
    g.translate(x, y + b);
    g.scale(S, S);
    g.strokeStyle = 'rgba(255,170,220,0.8)';
    g.lineWidth = 4;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * 9, 4);
      for (let k = 1; k <= 4; k++) g.lineTo(i * 9 + Math.sin(t * 5 + k + i) * 5, 4 + k * 10);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,120,200,0.75)';
    g.beginPath();
    g.ellipse(0, 0, 30, 24, 0, Math.PI, 0);
    g.closePath();
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#fff';
    g.stroke();
    g.fillStyle = '#1b1030';
    g.beginPath();
    g.arc(-9, -8, 3, 0, TAU);
    g.arc(9, -8, 3, 0, TAU);
    g.fill();
    g.restore();
  }

  function disegnaPesce(g, q) {
    if (q.catturato && q.catturato.t > 1.3) return;
    const bob = Math.sin(t * 5 + q.x * 0.01) * 3;
    const x = q.x;
    const y = q.y + bob;
    const r = RP;
    const d = q.dir;
    // scia dello scatto
    if (q.scatto > 0) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 1; i <= 5; i++) {
        g.beginPath();
        g.arc(x - d * (r + i * 14), y + Math.sin(t * 20 + i) * 6, 7 - i, 0, TAU);
        g.fill();
      }
    }
    if (q.immune > 0 || q.corallo > 0) {
      g.beginPath();
      g.arc(x, y, r * 1.45, 0, TAU);
      g.fillStyle = q.corallo > 0 ? 'rgba(255,122,168,0.35)' : `rgba(255,255,255,${0.2 + 0.15 * Math.sin(t * 20)})`;
      g.fill();
    }
    g.save();
    g.translate(x, y);
    if (q.volo) g.rotate(d * -0.5);
    // coda
    g.fillStyle = shade(q.p.colore, -0.25);
    g.beginPath();
    const sv = Math.sin(t * 12) * 0.25;
    g.moveTo(-d * r * 0.8, 0);
    g.lineTo(-d * r * 1.55, -r * (0.6 + sv));
    g.lineTo(-d * r * 1.55, r * (0.6 - sv));
    g.closePath();
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#1b1030';
    g.stroke();
    // corpo
    g.beginPath();
    g.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, TAU);
    g.fillStyle = q.p.colore;
    g.fill();
    g.stroke();
    // pinna
    g.fillStyle = shade(q.p.colore, -0.15);
    g.beginPath();
    g.moveTo(-d * r * 0.2, -r * 0.75);
    g.lineTo(-d * r * 0.65, -r * 1.2);
    g.lineTo(d * r * 0.25, -r * 0.8);
    g.fill();
    g.restore();
    // la faccia del giocatore davanti
    ctx.testa(g, q.p.av, x + d * r * 0.25, y + r * 0.05, r * 0.66, { t, look: [d, 0] });
    if (q.lampo > 0) {
      g.fillStyle = `rgba(255,255,255,${q.lampo * 2})`;
      g.beginPath();
      g.arc(x, y, r * 1.1, 0, TAU);
      g.fill();
    }
    // stati
    if (q.lento > 0) {
      g.fillStyle = '#ff9ee0';
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * TAU) / 3;
        g.beginPath();
        g.arc(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 0.9, 4, 0, TAU);
        g.fill();
      }
    }
    if (q.invertito > 0) {
      g.strokeStyle = '#c9a7ff';
      g.lineWidth = 4;
      g.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = t * 8 + i * 0.5;
        const rr = 3 + i * 0.8;
        const px = x + Math.cos(a) * rr;
        const py = y - r * 1.5 + Math.sin(a) * rr * 0.5;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    if (q.presa > 0) {
      g.strokeStyle = shade(q.presaDa ? q.presaDa.p.colore : '#8b5cf6', -0.1);
      g.lineWidth = 7 * S;
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.ellipse(x, y + (i - 0.5) * r * 0.6, r * 1.15, r * 0.35, 0.2, 0, TAU);
        g.stroke();
      }
    }
    const pilota = !q.p.bot && !ctx.connesso(q.id);
    ctx.etichetta(g, `${pilota ? '🤖 ' : ''}${q.p.nome}${q.coralli ? ` 🪸${q.coralli}` : ''}`, x, y - r * 1.75, q.p.colore, { dim: Math.round(15 * Math.max(0.85, S)), maxW: 150 });
    // bolle: quante prese di tentacolo può ancora subire
    if (!q.arrivato && !q.catturato) {
      for (let i = 0; i < cfg.bolle; i++) {
        const bx = x + (i - (cfg.bolle - 1) / 2) * 15 * Math.max(0.8, S);
        const by = y - r * 1.15;
        g.beginPath();
        g.arc(bx, by, 5.5 * Math.max(0.8, S), 0, TAU);
        g.fillStyle = i < q.bolle ? 'rgba(210,240,255,0.95)' : 'rgba(20,10,45,0.35)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = i < q.bolle ? '#3ec6ff' : 'rgba(255,255,255,0.35)';
        g.stroke();
      }
    }
  }

  function disegnaPolpo(g, o) {
    const tx = clamp((o.mx - o.tana) / 700, -1, 1);
    o.piega = lerp(o.piega, tx * 60, 0.08);
    const x = o.tana + o.piega;
    const y = TANA_Y;
    const col = o.p.colore;
    // tentacoli che ondeggiano
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.9 + Math.PI;
      const bx = x + Math.cos(a) * 60;
      const by = y + 40;
      g.strokeStyle = shade(col, -0.35);
      g.lineWidth = 22;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(a) * 60 + Math.sin(t * 3 + i) * 20, by + 40, bx + Math.cos(a) * 110 + Math.sin(t * 2 + i) * 25, by + 70);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 14;
      g.stroke();
    }
    // mantello (il "cappuccio" del polpo) e la faccia del giocatore
    g.fillStyle = col;
    g.strokeStyle = '#1b1030';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(x, y - 40, 86, 96, tx * 0.15, Math.PI, 0);
    g.lineTo(x + 86, y + 20);
    g.quadraticCurveTo(x, y + 60, x - 86, y + 20);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = shade(col, 0.35);
    for (const [dx, dy, r] of [[-40, -90, 12], [30, -105, 9], [55, -60, 11], [-60, -45, 8]]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, TAU);
      g.fill();
    }
    const ly = clamp((o.my - (y - 20)) / 400, -1, 1);
    ctx.testa(g, o.p.av, x, y - 10, 52, { t, look: [tx, ly] });
    const pilota = !o.p.bot && !ctx.connesso(o.id);
    ctx.etichetta(g, `${pilota ? '🤖 ' : '🐙 '}${o.p.nome}`, x, y + 58, col, { dim: 20, maxW: 220 });
    // energia (barra da boss)
    const n = cfg.energiaMax;
    const w = 22;
    const x0 = x - (n * (w + 5)) / 2;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.roundRect(x0 + i * (w + 5), y + 84, w, 16, 5);
      g.fillStyle = i < o.energia ? '#ffd23f' : i === o.energia ? `rgba(255,210,63,${0.25 + (0.6 * o.tRic) / cfg.ricarica})` : 'rgba(20,10,45,0.6)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#1b1030';
      g.stroke();
    }
  }

  function disegnaMirino(g, o) {
    const x = o.mx;
    const y = o.my;
    const col = o.p.colore;
    // linea dello sguardo dal Polpo al mirino
    g.save();
    g.setLineDash([6, 12]);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(o.tana + o.piega, TANA_Y - 70);
    g.lineTo(x, y);
    g.stroke();
    g.setLineDash([]);
    const r = 34 * S + Math.sin(t * 6) * 3;
    g.lineWidth = 5;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + t;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
      g.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
      g.stroke();
    }
    g.restore();
  }

  function disegnaAttacco(g, a) {
    const P = POTERI[a.tipo];
    const k = clamp(a.t / a.tell, 0, 1);
    const R = raggioColpo(a.tipo);
    const col = a.o.p.colore;
    if (a.tipo === 'tentacolo') {
      anello(g, a.x, a.y, R, 'rgba(20,10,45,0.35)', k);
      tentacolo(g, a.o, a.x, a.y, k, shade(col, -0.1));
    } else if (a.tipo === 'medusa') {
      anello(g, a.x, a.y, R + RP, 'rgba(255,120,200,0.25)', k);
      disegnaMedusa(g, a.x, lerp(ARENA.y0 - 40, a.y, ease.outCubic(k)), 0.5 + 0.5 * k);
    } else if (a.tipo === 'spinta') {
      anello(g, a.x, a.y, R, 'rgba(190,233,255,0.3)', k);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(a.x, a.y, R * (0.3 + 0.2 * i) * k, t * 10 + i * 2, t * 10 + i * 2 + 3.5);
        g.stroke();
      }
    } else if (a.tipo === 'inversione') {
      anello(g, a.x, a.y, R, 'rgba(60,20,90,0.35)', k);
      g.fillStyle = 'rgba(30,10,50,0.55)';
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * TAU + t;
        g.beginPath();
        g.arc(a.x + Math.cos(an) * R * 0.45 * k, a.y + Math.sin(an) * R * 0.45 * k, R * 0.3 * k, 0, TAU);
        g.fill();
      }
    }
    ctx.testo(g, P.emoji, a.x, a.y, { dim: 34, bordo: 0 });
  }

  function disegnaMarea(g) {
    if (marea) {
      const k = marea.t / POTERI.marea.tell;
      g.fillStyle = `rgba(20,60,160,${0.15 + 0.15 * k})`;
      g.fillRect(0, 0, W, H);
      const x = W - k * 150;
      g.fillStyle = 'rgba(220,245,255,0.8)';
      g.beginPath();
      g.moveTo(W, ARENA.y0 - 20);
      for (let y = ARENA.y0 - 20; y <= ARENA.y1 + 20; y += 30) g.lineTo(x + Math.sin(y * 0.05 + t * 8) * 25, y);
      g.lineTo(W, ARENA.y1 + 20);
      g.fill();
      ctx.pannello(g, W / 2 - 330, 150, 660, 110, { colore: 'rgba(20,60,160,0.85)' });
      ctx.testo(g, `🌊 MAREA! ${fmtNum(Math.max(0, POTERI.marea.tell - marea.t), 1)}`, W / 2, 190, { dim: 58, colore: '#dff4ff' });
      ctx.testo(g, 'Nascondetevi dietro uno scoglio!', W / 2, 238, { dim: 30 });
    }
    if (onda >= 0) {
      const x = W - (onda / 0.7) * (W + 300);
      g.fillStyle = 'rgba(220,245,255,0.55)';
      g.beginPath();
      g.moveTo(x + 300, ARENA.y0 - 20);
      for (let y = ARENA.y0 - 20; y <= ARENA.y1 + 20; y += 30) g.lineTo(x + Math.sin(y * 0.05 + t * 8) * 30, y);
      g.lineTo(x + 300, ARENA.y1 + 20);
      g.fill();
    }
  }

  function disegnaFine(g) {
    // il cartello resta finché il gioco non passa la mano alla scritta "FINE!"
    if (!esito || fineTra <= 0) return;
    const titolo = esito.fuga ? 'FUGA PERFETTA! 🐟✨' : esito.schiaccia ? 'SCHIACCIAMENTO! 🐙💥' : `🏁 Arrivati ${esito.arrivati} su ${pesci.length}`;
    ctx.pannello(g, W / 2 - 520, 380, 1040, 180, { colore: 'rgba(25,12,60,0.88)', r: 40 });
    ctx.testo(g, titolo, W / 2, 440, { dim: 70, colore: esito.fuga ? '#4cd97b' : esito.schiaccia ? '#ff4d8d' : '#ffd23f' });
    const presi = pesci.filter((q) => q.catturato).length;
    ctx.testo(g, `🐙 ${esito.fermati} ${esito.fermati === 1 ? 'pesce fermato' : 'pesci fermati'}${presi ? ` (${presi} ${presi === 1 ? 'catturato' : 'catturati'})` : ''}`, W / 2, 515, { dim: 38 });
  }

  // ---------------------------------------------------------------------------

  return {
    aggiorna(dt) {
      t += dt;
      for (const b of bolle) {
        b.y -= b.v * dt;
        if (b.y < -10) {
          b.y = H + 10;
          b.x = Math.random() * W;
        }
      }
      for (const q of tentacoli) q.t += dt;
      while (tentacoli.length && tentacoli[0].t > 0.35) tentacoli.shift();
      if (onda >= 0) {
        onda += dt;
        if (onda > 0.7) onda = -1;
      }
      for (const m of meduse) m.t += dt;
      if (finito) {
        for (const q of pesci) if (!inGioco(q)) aggiornaPesce(q, dt);
        if (fineTra > 0) {
          fineTra -= dt;
          if (fineTra <= 0) ctx.fine({ punteggi: esito.punti, alto: true, dettagli: esito.dettagli });
        }
        return;
      }
      // pilota automatico per chi ha il telefono spento
      for (const g of [...pesci, ...polpi]) {
        if (g.p.bot || ctx.connesso(g.id)) continue;
        if (isPolpo(g.id)) botPolpo(g, dt);
        else botPesce(g, dt);
      }
      // Polpi: energia e ricariche
      for (const o of polpi) {
        for (const k of ORDINE_POTERI) o.cd[k] = Math.max(0, o.cd[k] - dt);
        o.braccio = Math.max(0, o.braccio - dt);
        if (o.energia < cfg.energiaMax) {
          o.tRic += dt;
          if (o.tRic >= cfg.ricarica) {
            o.tRic -= cfg.ricarica;
            o.energia++;
            if (o.energia >= cfg.energiaMax) o.tRic = 0;
            vistaPolpo(o);
          }
        } else o.tRic = 0;
      }
      // preavvisi
      for (let i = attacchi.length - 1; i >= 0; i--) {
        const a = attacchi[i];
        a.t += dt;
        if (a.t >= a.tell) {
          attacchi.splice(i, 1);
          risolvi(a);
        }
      }
      if (marea) {
        marea.t += dt;
        if (marea.t >= POTERI.marea.tell) {
          marea = null;
          risolviMarea();
        }
      }
      for (const q of pesci) aggiornaPesce(q, dt);
      separaPesci();
      // meduse: chi le tocca rallenta
      for (let i = meduse.length - 1; i >= 0; i--) {
        const m = meduse[i];
        const q = pesci.find((x) => inGioco(x) && !x.volo && Math.hypot(x.x - m.x, x.y - m.y) < POTERI.medusa.raggio * S + RP);
        if (!q) continue;
        meduse.splice(i, 1);
        aggiornaStrade();
        q.lento = EFFETTI.lento;
        avvisa(q, 'lento', { dur: EFFETTI.lento });
        sfx.zap();
        fx.particelle(m.x, m.y, { n: 16, colori: ['#ff9ee0', '#fff'], vel: 200, grav: 0, vita: 0.5 });
        fx.testo(q.x, q.y - 40 * S, 'Punto!', { colore: '#ff9ee0', dim: 34 });
        polpi.forEach(vistaPolpo);
      }
      for (const c of coralli) {
        if (c.attivo) continue;
        c.tra -= dt;
        if (c.tra <= 0) piazzaCorallo(c);
      }
      if (Math.floor(t / 5) !== Math.floor((t - dt) / 5)) vistaTutti();
      if (t >= DURATA || !pesci.some(inGioco)) termina();
    },

    disegna(g) {
      disegnaSfondo(g);
      disegnaCampo(g);
      for (const c of coralli) if (c.attivo) disegnaCorallo(g, c);
      for (const m of meduse) disegnaMedusa(g, m.x, m.y);
      for (const q of pesci) if (q.presa > 0 && q.presaDa) tentacolo(g, q.presaDa, q.x, q.y, 1, shade(q.presaDa.p.colore, -0.1));
      for (const q of pesci) if (q.catturato && q.catturato.t < 1.3) tentacolo(g, q.catturato.o, q.x, q.y, 1, shade(q.catturato.o.p.colore, -0.1), 20);
      for (const r of tentacoli) tentacolo(g, r.o, r.x, r.y, 1 - r.t / 0.35, shade(r.o.p.colore, -0.1));
      for (const o of polpi) disegnaPolpo(g, o);
      for (const a of attacchi) disegnaAttacco(g, a);
      for (const q of [...pesci].sort((a, b) => a.y - b.y)) disegnaPesce(g, q);
      if (!finito) for (const o of polpi) disegnaMirino(g, o);
      disegnaMarea(g);
      // HUD
      if (!finito) ctx.barraTempo(g, DURATA - t, DURATA, { w: 760, x: W / 2 - 380, y: 30 });
      const arrivati = pesci.filter((q) => q.arrivato).length;
      const presi = pesci.filter((q) => q.catturato).length;
      ctx.pannello(g, 30, 20, 470, 72, { r: 36 });
      ctx.testo(g, `🏁 ${arrivati}/${pesci.length}   🐙 Catturati ${presi}`, 265, 56, { dim: 32 });
      ctx.pannello(g, W - 360, 20, 330, 72, { r: 36 });
      ctx.testo(g, mareaUsata ? '🌊 Marea usata' : '🌊 Marea pronta', W - 195, 56, { dim: 32, colore: mareaUsata ? '#9fb6d9' : '#dff4ff' });
      disegnaFine(g);
    },

    input,

    bot(id, dt) {
      const g = perId.get(id);
      if (!g) return;
      if (isPolpo(id)) botPolpo(g, dt);
      else botPesce(g, dt);
    },

    rientrato(id) {
      const g = perId.get(id);
      if (!g) return;
      if (isPolpo(id)) vistaPolpo(g);
      else vistaPesce(g);
    },

    // Quello che chiunque vede sullo schermo grande (lo usano le persone simulate del banco).
    tv() {
      return {
        t,
        V,
        scala: S,
        raggio: RP,
        bolle: cfg.bolle,
        fondale,
        pesci: pesci.map((q) => ({
          id: q.id,
          x: q.x,
          y: q.y,
          corsia: q.corsia,
          inGioco: inGioco(q),
          bolle: q.bolle,
          presa: q.presa > 0,
          immune: q.immune > 0,
          lento: q.lento > 0,
          invertito: q.invertito > 0,
          scatto: q.scatto > 0,
          corallo: q.corallo > 0,
        })),
        polpi: polpi.map((o) => ({ id: o.id, mx: o.mx, my: o.my, energia: o.energia })),
        attacchi: attacchi.map((a) => ({ tipo: a.tipo, x: a.x, y: a.y, resta: a.tell - a.t, raggio: raggioColpo(a.tipo) })),
        meduse: meduse.map((m) => ({ x: m.x, y: m.y })),
        marea: marea ? POTERI.marea.tell - marea.t : null,
        mareaUsata,
        coralli: coralli.filter((c) => c.attivo).map((c) => ({ x: c.x, y: c.y, corsia: c.corsia })),
      };
    },
  };
}
