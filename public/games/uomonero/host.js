// L'Uomo Nero: uno contro tutti nel buio. I sopravvissuti girano per un labirinto al buio
// con la torcia, caricano le batterie e scappano dall'uscita; l'Uomo Nero è invisibile
// (la luce lo svela) e li afferra con la Morsa. La TV mostra solo quello che vedono i
// sopravvissuti: coni di luce, ping, il ricordo dei muri già illuminati.
// Regole pure (labirinto, luce, punti) in regole.js.
//
// BOT DA CREARE / CALIBRARE: le CPU qui sotto sono un cervello unico e semplice, solo per
// rendere giocabile il gioco anche in pochi. Le tre potenze per ora giocano uguale.

import { TAU, clamp, shade, dir8 } from '../../shared/util.js';
import {
  VEL,
  TORCIA,
  CARICA,
  PING,
  MORSA,
  RECUPERO,
  POTERI,
  BATTITO,
  BLIP,
  RIVELA,
  NORD,
  OVEST,
  EST,
  SUD,
  PASSI,
  config,
  generaMappa,
  codifica,
  distanze,
  indice,
  muovi,
  vede,
  nelCono,
  conoLuce,
  velocitaMorsa,
  scegliRuoli,
  punteggi,
} from './regole.js';

export default {
  id: 'uomonero',
  nome: "L'Uomo Nero",
  emoji: '🔦',
  colore: '#4c4f9e',
  descrizione: "Labirinto al buio: carica le batterie e scappa. L'Uomo Nero è invisibile, solo la luce lo svela!",
  comeSiGioca: [
    "🔦 Sopravvissuti: caricate tutte le batterie 🔋 e scappate dall'uscita 🚪 prima che finisca il tempo",
    '🔋 Per caricare una batteria stai fermo 2 secondi sopra, con la torcia accesa',
    "🌑 Torcia spenta: sei invisibile anche sulla TV, ma l'Uomo Nero non lo vedi arrivare",
    "👤 L'Uomo Nero è invisibile: se afferra qualcuno, puntategli la torcia addosso per salvarlo!",
  ],
  controllo: 'buio',
  ruoli: (giocatori, info = {}) => scegliRuoli(giocatori, { punti: info.punti, volte: (info.storico || {}).uomonero, escludi: info.escludi }),
  infoRuoli: {
    uomonero: {
      speciale: true,
      emoji: '👤',
      nome: 'Uomo Nero',
      articolo: "L'",
      titolo: "L'UOMO NERO",
      regole: [
        'Sulla TV sei invisibile: muoviti col D-pad guardando il telefono, dove vedi solo i muri vicini (sonar)',
        'Sul telefono vedi esattamente chi ha la torcia accesa (pallini gialli); i cerchi arancioni sono "qualcuno al buio è lì"',
        'MORSA quando sei attaccato a qualcuno, poi tocca a raffica: se ti puntano la torcia addosso resti accecato',
        '😱 URLO: chi ha la torcia accesa resta paralizzato dalla paura per 3 secondi (torcia bloccata, va piano)',
        'Più sopravvissuti fermi (presi o rimasti dentro), più sali in classifica!',
      ],
    },
    sopravvissuto: {
      emoji: '🔦',
      nome: 'Sopravvissuto',
      titolo: 'UN SOPRAVVISSUTO',
      regole: [
        "Carica tutte le batterie 🔋 (fermo 2 s sopra, torcia accesa) e poi scappa dall'uscita 🚪",
        "TORCIA accesa: vedi e illumini l'Uomo Nero, ma lui vede te. Spenta: invisibile, anche sulla TV",
        "Bordo rosso e vibrazione = l'Uomo Nero è vicino (non dice dove)",
        'PING: un punto di luce sulla TV per 3 s, per chiamare gli altri (ma svela dove sei)',
        "Se l'Uomo Nero afferra qualcuno, puntategli la torcia addosso: lo accecate e il vostro amico è salvo",
      ],
    },
  },
  crea,
};

const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const r2 = (v) => Math.round(v * 100) / 100;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const cfg = config(n);
  const DURATA = cfg.durata;
  const ruoli = ctx.ruoli || scegliRuoli(ctx.giocatori);
  const idBoss = (ctx.giocatori.find((p) => ruoli[p.id] === 'uomonero') || ctx.giocatori[0]).id;
  const soprG = ctx.giocatori.filter((p) => p.id !== idBoss);
  const mappa = generaMappa(Math.floor(Math.random() * 1e9), cfg, soprG.length);
  const { lab, uscita } = mappa;
  const labTxt = codifica(lab);

  // Disegno: una casella = C pixel.
  const C = Math.floor(Math.min((W - 80) / lab.col, (H - 150) / lab.rig));
  const OX = Math.round((W - lab.col * C) / 2);
  const OY = Math.round(118 + (H - 134 - lab.rig * C) / 2);
  const X = (x) => OX + x * C;
  const Y = (y) => OY + y * C;

  // ---------------------------------------------------------------------------
  // Entità

  const nuovaEnt = ([x, y]) => ({ cx: x, cy: y, dir: null, k: 0, vuole: [0, 0], x: x + 0.5, y: y + 0.5 });
  const sopr = soprG.map((p, i) => ({
    id: p.id,
    p,
    ...nuovaEnt(mappa.partenze[i]),
    ang: 0,
    torcia: true,
    vivo: true,
    fuggito: false,
    preso: false,
    causa: null,
    batterie: 0,
    salvataggi: 0,
    carica: 0,
    cdPing: 0,
    immune: 0,
    terrore: 0,
    marchio: 0,
    vite: cfg.vite,
    battito: 0,
    tocchi: [],
    passo: 0,
  }));
  const perId = new Map(sopr.map((s) => [s.id, s]));
  const boss = {
    id: idBoss,
    p: ctx.giocatore(idBoss),
    ...nuovaEnt(mappa.tana),
    ang: Math.PI,
    luce: 0,
    recupero: 0,
    accecato: 0,
    cd: { urlo: 0, marchio: 0, blackout: 0 },
    cdMorsa: 0,
    passo: 0,
  };
  const batterie = mappa.batterie.map(([x, y]) => ({ x, y, presa: false, luce: 0 }));
  const inGioco = (s) => s.vivo && !s.fuggito;

  function cellaLontana() {
    for (let tent = 0; tent < 60; tent++) {
      const c = [Math.floor(Math.random() * lab.col), Math.floor(Math.random() * lab.rig)];
      if (sopr.every((s) => !inGioco(s) || Math.hypot(s.x - c[0] - 0.5, s.y - c[1] - 0.5) > 6)) return c;
    }
    return [lab.col - 1, 0];
  }
  const echi = Array.from({ length: cfg.echi }, () => ({ ...nuovaEnt(cellaLontana()), luce: 0, via: 0, tCambio: 0, passo: 0 }));

  let t = 0;
  let finito = false;
  let fineTra = -1;
  let esito = null;
  let luceFinale = 0;
  let aperta = false;
  let blackout = 0;
  let lampoUrlo = 0;
  const pings = []; // { x, y, colore, t }
  const marchi = []; // { x, y, t }
  let morsa = null; // { v, t, prog, ultimoBoss }
  let banner = null; // { testo, colore, t }
  let tBlip = 0;
  let codaBlip = [];
  let ultimoBlip = null;
  let tStream = 0;
  let tLuce = 0;
  let tBattito = 0;
  let torce = [];
  const esplorato = new Uint8Array(lab.col * lab.rig);
  let nuovi = [];

  const nome = (s) => s.p.nome;
  const torciaAccesa = (s) => inGioco(s) && s.torcia && blackout <= 0;
  const prese = () => batterie.filter((b) => b.presa).length;
  const avvisa = (id, ev, extra = {}) => {
    const p = ctx.giocatore(id);
    if (p && !p.bot) ctx.invia(id, { ev, ...extra });
  };
  function annuncia(testo, colore = '#fff') {
    banner = { testo, colore, t: 0 };
  }

  // ---------------------------------------------------------------------------
  // Strati del disegno: labirinto (pronto una volta), ricordo dei muri visti, buio.

  const strato = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const fondo = strato();
  const memoria = strato();
  const buio = strato();
  const gm = memoria.getContext('2d');
  const LW = Math.max(4, Math.round(C * 0.14));

  function muriCella(g, x, y) {
    const v = lab.celle[indice(lab, x, y)];
    g.beginPath();
    if (!(v & NORD)) {
      g.moveTo(X(x), Y(y));
      g.lineTo(X(x + 1), Y(y));
    }
    if (!(v & SUD)) {
      g.moveTo(X(x), Y(y + 1));
      g.lineTo(X(x + 1), Y(y + 1));
    }
    if (!(v & OVEST)) {
      g.moveTo(X(x), Y(y));
      g.lineTo(X(x), Y(y + 1));
    }
    if (!(v & EST)) {
      g.moveTo(X(x + 1), Y(y));
      g.lineTo(X(x + 1), Y(y + 1));
    }
    g.stroke();
  }

  (function disegnaFondo() {
    const g = fondo.getContext('2d');
    g.fillStyle = '#08070e';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < lab.rig; y++) {
      for (let x = 0; x < lab.col; x++) {
        g.fillStyle = (x + y) % 2 ? '#2a2638' : '#2f2b3f';
        g.fillRect(X(x), Y(y), C, C);
        // crepe e polvere a caso, per dare l'idea di un posto abbandonato
        if (Math.random() < 0.18) {
          g.strokeStyle = 'rgba(0,0,0,0.25)';
          g.lineWidth = 2;
          g.beginPath();
          const a = Math.random() * C;
          g.moveTo(X(x) + a, Y(y) + C * 0.2);
          g.lineTo(X(x) + a + C * 0.15, Y(y) + C * 0.5);
          g.lineTo(X(x) + a - C * 0.05, Y(y) + C * 0.8);
          g.stroke();
        }
      }
    }
    g.lineCap = 'round';
    g.lineWidth = LW + 4;
    g.strokeStyle = '#120f1c';
    for (let y = 0; y < lab.rig; y++) for (let x = 0; x < lab.col; x++) muriCella(g, x, y);
    g.lineWidth = LW;
    g.strokeStyle = '#a99cd0';
    for (let y = 0; y < lab.rig; y++) for (let x = 0; x < lab.col; x++) muriCella(g, x, y);
    gm.lineCap = 'round';
    gm.lineWidth = LW * 0.7;
    gm.strokeStyle = '#8f86b3';
  })();

  function esplora(i) {
    if (esplorato[i]) return;
    esplorato[i] = 1;
    nuovi.push(i);
    const x = i % lab.col;
    muriCella(gm, x, (i - x) / lab.col);
  }

  // ---------------------------------------------------------------------------
  // Telefoni

  const base = { lab: labTxt, col: lab.col, rig: lab.rig, uscita, batt: batterie.map((b) => [b.x, b.y]), durata: DURATA, boss: boss.p.nome };
  const btTxt = () => batterie.map((b) => (b.presa ? 1 : 0)).join('');
  const espTxt = () => Array.from(esplorato).join('');
  const resta = () => Math.round(Math.max(0, DURATA - t) * 10) / 10;
  const risultato = (id) => (esito ? { punti: esito.punti[id], det: esito.dettagli[id], notte: esito.notte, fuggiti: esito.fuggiti, tot: sopr.length } : null);

  function vistaSopr(s) {
    ctx.vista(s.id, {
      ...base,
      ruolo: 'sopravvissuto',
      esp: espTxt(),
      bt: btTxt(),
      ap: aperta ? 1 : 0,
      p: [r2(s.x), r2(s.y)],
      a: r2(s.ang),
      tr: s.torcia ? 1 : 0,
      vite: s.vite,
      vivo: s.vivo,
      fuggito: s.fuggito,
      causa: s.causa,
      morsa: morsa && morsa.v === s ? 1 : 0,
      resta: resta(),
      finito,
      ris: risultato(s.id),
    });
  }
  function vistaBoss() {
    ctx.vista(boss.id, {
      ...base,
      ruolo: 'uomonero',
      poteri: cfg.poteri,
      cdMax: Object.fromEntries(cfg.poteri.map((k) => [k, POTERI[k].cd * cfg.cdScala])),
      bt: btTxt(),
      ap: aperta ? 1 : 0,
      p: [r2(boss.x), r2(boss.y)],
      morsa: morsa ? nome(morsa.v) : null,
      presi: sopr.filter((s) => s.preso).length,
      tot: sopr.length,
      resta: resta(),
      finito,
      ris: risultato(boss.id),
    });
  }
  const vistaTutti = () => {
    sopr.forEach(vistaSopr);
    vistaBoss();
  };
  vistaTutti();

  function stream() {
    const bt = btTxt();
    const pg = pings.map((p) => [r2(p.x), r2(p.y), p.colore]);
    const mk = marchi.map((m) => [m.x, m.y]);
    const x = nuovi.length ? nuovi : null;
    nuovi = [];
    for (const s of sopr) {
      if (s.p.bot) continue;
      const d = { s: resta(), bt, pg, mk, bo: blackout > 0 ? 1 : 0, ap: aperta ? 1 : 0 };
      if (x) d.x = x;
      if (inGioco(s)) {
        d.p = [r2(s.x), r2(s.y)];
        d.a = r2(s.ang);
        d.tr = s.torcia ? 1 : 0;
        d.b = s.battito;
        d.c = s.carica > 0 ? r2(s.carica / CARICA) : 0;
        d.te = s.terrore > 0 ? 1 : 0;
        d.mz = s.marchio > 0 ? r2(s.marchio / POTERI.marchio.letale) : 0;
        if (morsa && morsa.v === s) d.pr = r2(morsa.prog);
      }
      ctx.invia(s.id, d);
    }
    if (!boss.p.bot) {
      ctx.invia(boss.id, {
        p: [r2(boss.x), r2(boss.y)],
        s: resta(),
        bt,
        mk,
        cd: Object.fromEntries(cfg.poteri.map((k) => [k, r2(boss.cd[k])])),
        rec: boss.recupero > 0 ? r2(boss.recupero) : 0,
        cm: boss.cdMorsa > 0 ? 1 : 0,
        // chi ha la torcia accesa: posizione esatta, verso della torcia, paralizzato dall'Urlo
        vs: sopr.filter(torciaAccesa).map((s) => [r2(s.x), r2(s.y), r2(s.ang), s.terrore > 0 ? 1 : 0]),
        pr: morsa ? r2(morsa.prog) : null,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Azioni

  function cambiaTorcia(s) {
    if (!inGioco(s)) return;
    if (blackout > 0) return avvisa(s.id, 'nobuio');
    if (s.terrore > 0 && s.torcia) return avvisa(s.id, 'noterrore');
    s.torcia = !s.torcia;
    if (!s.torcia) s.carica = 0;
    sfx.click();
  }

  function ping(s, x, y) {
    if (s.cdPing > 0) return;
    s.cdPing = PING.cd;
    pings.push({ x: clamp(x, 0.3, lab.col - 0.3), y: clamp(y, 0.3, lab.rig - 0.3), colore: s.p.colore, t: 0 });
    while (pings.length > PING.max) pings.shift();
    sfx.pop();
    avvisa(s.id, 'ping', { cd: PING.cd });
  }

  function tentaMorsa() {
    if (morsa || boss.recupero > 0 || boss.cdMorsa > 0 || finito) return;
    let preda = null;
    let bd = MORSA.raggio;
    for (const s of sopr) {
      if (!inGioco(s) || s.immune > 0) continue;
      const d = dist(s, boss);
      if (d <= bd && vede(lab, boss.x, boss.y, s.x, s.y)) {
        bd = d;
        preda = s;
      }
    }
    if (!preda) {
      boss.cdMorsa = MORSA.mancata;
      avvisa(boss.id, 'vuoto');
      return;
    }
    morsa = { v: preda, t: 0, prog: 0, ultimoBoss: t };
    preda.tocchi = [];
    preda.carica = 0;
    sfx.colpo();
    fx.scuoti(8);
    annuncia(`😱 ${nome(preda)} è nella MORSA! Puntate la torcia sull'Uomo Nero!`, '#ff8fb3');
    for (const s of sopr) if (s !== preda && inGioco(s)) avvisa(s.id, 'morsa', { chi: nome(preda) });
    vistaSopr(preda);
    vistaBoss();
  }

  function fineMorsa(come, eroe = null) {
    const v = morsa.v;
    morsa = null;
    if (come === 'preso' && v.vite > 1) {
      v.vite--;
      v.immune = 3;
      boss.recupero = RECUPERO.preso;
      sfx.colpo(1.5);
      fx.scuoti(10);
      annuncia(`🩸 ${nome(v)} è ferito! Gli resta una vita sola`, '#ff8fb3');
      avvisa(v.id, 'ferito', { vite: v.vite });
      avvisa(boss.id, 'ferito', { chi: nome(v) });
    } else if (come === 'preso') {
      v.vivo = false;
      v.preso = true;
      v.causa = 'morsa';
      boss.recupero = RECUPERO.preso;
      sfx.boom();
      fx.scuoti(14);
      fx.particelle(X(v.x), Y(v.y), { n: 30, colori: ['#1b1030', '#4c1d95', '#000'], vel: 260, vita: 0.9 });
      annuncia(`💀 L'Uomo Nero ha preso ${nome(v)}!`, '#ff4d6d');
      avvisa(boss.id, 'preso', { chi: nome(v) });
    } else {
      v.immune = MORSA.immune;
      if (come === 'salvato') {
        boss.recupero = RECUPERO.accecato;
        boss.accecato = RECUPERO.accecato;
        boss.luce = 1.5;
        eroe.salvataggi++;
        sfx.ding();
        fx.lampo('#ffffff', 0.35);
        fx.particelle(X(boss.x), Y(boss.y), { n: 26, colori: ['#fff', '#ffe08a'], vel: 300, vita: 0.6 });
        annuncia(`🔦 ${nome(eroe)} ha accecato l'Uomo Nero! ${nome(v)} è salvo!`, '#ffe08a');
        avvisa(eroe.id, 'eroe', { chi: nome(v) });
        avvisa(v.id, 'salvato', { da: nome(eroe) });
        avvisa(boss.id, 'accecato', { da: nome(eroe) });
      } else {
        boss.recupero = RECUPERO.liberato;
        sfx.whoosh();
        annuncia(`💨 ${nome(v)} è sgusciato via!`, '#9fe0ff');
        avvisa(v.id, 'libero');
      }
    }
    vistaSopr(v);
    vistaBoss();
  }

  function potere(k) {
    if (!cfg.poteri.includes(k) || boss.cd[k] > 0 || morsa || finito) return;
    const P = POTERI[k];
    boss.cd[k] = P.cd * cfg.cdScala;
    if (k === 'urlo') {
      lampoUrlo = 0.6;
      sfx.boom();
      fx.scuoti(10);
      let colpiti = 0;
      for (const s of sopr) {
        if (!torciaAccesa(s)) continue;
        s.terrore = P.durata;
        colpiti++;
        avvisa(s.id, 'urlo', { dur: P.durata });
      }
      annuncia(colpiti ? `😱 URLO! ${colpiti === 1 ? 'Chi aveva la torcia accesa è paralizzato' : `${colpiti} sopravvissuti paralizzati dalla paura`}` : '😱 URLO! …ma tutte le torce erano spente', '#ff8fb3');
    } else if (k === 'marchio') {
      marchi.push({ x: boss.cx + 0.5, y: boss.cy + 0.5, t: 0 });
      sfx.zap();
      annuncia("☠️ L'Uomo Nero ha lasciato un Marchio: state fuori dal cerchio!", '#ff6b6b');
    } else if (k === 'blackout') {
      blackout = P.durata;
      for (const s of sopr) {
        s.carica = 0;
        if (inGioco(s)) avvisa(s.id, 'blackout', { dur: P.durata });
      }
      sfx.fallimento();
      annuncia('🌑 BLACKOUT! Tutte le torce spente per 4 secondi', '#c9a7ff');
    }
    vistaBoss();
  }

  function input(id, d) {
    if (!d || finito) return;
    if (id === boss.id) {
      if (Array.isArray(d.j)) boss.vuole = dir8(Number(d.j[0]) || 0, Number(d.j[1]) || 0);
      if (d.m) tentaMorsa();
      if (d.tap && morsa) morsa.ultimoBoss = t;
      if (typeof d.k === 'string') potere(d.k);
      return;
    }
    const s = perId.get(id);
    if (!s) return;
    if (!inGioco(s)) {
      // da fuori (presi o scappati) si può ancora aiutare: ping dove si tocca la mappa
      if (Array.isArray(d.pg) && isFinite(Number(d.pg[0])) && isFinite(Number(d.pg[1]))) ping(s, Number(d.pg[0]), Number(d.pg[1]));
      return;
    }
    if (Array.isArray(d.j)) s.vuole = dir8(Number(d.j[0]) || 0, Number(d.j[1]) || 0);
    if (d.to) cambiaTorcia(s);
    if (d.pg) ping(s, s.x, s.y);
    if (d.tap && morsa && morsa.v === s) s.tocchi.push(t);
  }

  // ---------------------------------------------------------------------------
  // Fine

  function termina() {
    if (finito) return;
    finito = true;
    morsa = null;
    blackout = 0;
    for (const s of sopr) s.vuole = [0, 0];
    boss.vuole = [0, 0];
    esito = punteggi({ boss: boss.id, sopr: sopr.map((s) => ({ id: s.id, fuggito: s.fuggito, preso: s.preso, batterie: s.batterie, salvataggi: s.salvataggi })) });
    if (esito.notte) {
      sfx.boom();
      fx.scuoti(14);
    } else if (esito.fuggiti === sopr.length) {
      sfx.fanfara();
      fx.coriandoli(140);
    } else sfx.rullo(0.8);
    fineTra = 3.2;
    vistaTutti();
  }

  // ---------------------------------------------------------------------------
  // Simulazione

  function aggiornaSopr(s, dt) {
    s.cdPing = Math.max(0, s.cdPing - dt);
    s.immune = Math.max(0, s.immune - dt);
    s.terrore = Math.max(0, s.terrore - dt);
    if (!inGioco(s)) return;
    const preso = morsa && morsa.v === s;
    if (!preso) {
      const v = VEL.sopravvissuto * (s.terrore > 0 ? POTERI.urlo.lento : 1);
      const prima = [s.x, s.y];
      muovi(lab, s, v * dt);
      s.passo += Math.hypot(s.x - prima[0], s.y - prima[1]);
    }
    // la torcia guarda dove vai; da fermo il D-pad la gira (così si mira anche contro un muro)
    const vx = s.dir ? s.dir[0] : s.vuole[0];
    const vy = s.dir ? s.dir[1] : s.vuole[1];
    if (!preso && (vx || vy)) s.ang += clamp(angDiff(s.ang, Math.atan2(vy, vx)), -14 * dt, 14 * dt);
    // batteria: fermo al centro della casella, torcia accesa
    const b = !s.dir && !preso && torciaAccesa(s) ? batterie.find((q) => !q.presa && q.x === s.cx && q.y === s.cy) : null;
    if (b) {
      s.carica += dt;
      if (s.carica >= CARICA) carica(s, b);
    } else s.carica = 0;
    // uscita
    if (aperta && Math.floor(s.x) === uscita[0] && Math.floor(s.y) === uscita[1]) {
      s.fuggito = true;
      s.torcia = false;
      sfx.fanfara();
      fx.coriandoli(40);
      annuncia(`🚪 ${nome(s)} è scappato!`, '#4cd97b');
      vistaSopr(s);
      vistaBoss();
      return;
    }
    // Marchio: 3 secondi dentro e sei preso
    const dentro = marchi.some((m) => Math.hypot(m.x - s.x, m.y - s.y) <= POTERI.marchio.raggio);
    s.marchio = dentro ? s.marchio + dt : 0;
    if (s.marchio >= POTERI.marchio.letale) {
      s.vivo = false;
      s.preso = true;
      s.causa = 'marchio';
      sfx.boom();
      fx.particelle(X(s.x), Y(s.y), { n: 26, colori: ['#ff4d6d', '#1b1030'], vel: 240, vita: 0.8 });
      annuncia(`☠️ ${nome(s)} è rimasto nel Marchio!`, '#ff4d6d');
      vistaSopr(s);
      vistaBoss();
    }
  }

  function carica(s, b) {
    b.presa = true;
    s.batterie++;
    s.carica = 0;
    sfx.moneta();
    fx.particelle(X(b.x + 0.5), Y(b.y + 0.5), { n: 22, colori: ['#ffd23f', '#4cd97b', '#fff'], vel: 220, vita: 0.7 });
    avvisa(s.id, 'batteria', { n: prese(), tot: batterie.length });
    if (prese() === batterie.length) {
      aperta = true;
      sfx.fanfara();
      annuncia("🚪 TUTTE LE BATTERIE! L'USCITA È APERTA: SCAPPATE!", '#4cd97b');
      for (const q of sopr) if (inGioco(q)) avvisa(q.id, 'aperta');
      vistaTutti();
    } else annuncia(`🔋 ${nome(s)} ha caricato una batteria (${prese()}/${batterie.length})`, '#ffd23f');
  }

  function aggiornaBoss(dt) {
    boss.recupero = Math.max(0, boss.recupero - dt);
    boss.accecato = Math.max(0, boss.accecato - dt);
    boss.cdMorsa = Math.max(0, boss.cdMorsa - dt);
    boss.luce = Math.max(0, boss.luce - dt);
    for (const k of Object.keys(boss.cd)) boss.cd[k] = Math.max(0, boss.cd[k] - dt);
    if (morsa) return;
    const prima = [boss.x, boss.y];
    muovi(lab, boss, VEL.boss * (boss.recupero > 0 ? RECUPERO.lento : 1) * dt);
    boss.passo += Math.hypot(boss.x - prima[0], boss.y - prima[1]);
    if (boss.dir) boss.ang = Math.atan2(boss.dir[1], boss.dir[0]);
  }

  function aggiornaEco(e, dt) {
    e.luce = Math.max(0, e.luce - dt);
    if (e.via > 0) {
      e.via -= dt;
      if (e.via <= 0) Object.assign(e, nuovaEnt(cellaLontana()));
      return;
    }
    e.tCambio -= dt;
    if (e.tCambio <= 0 || !e.dir) {
      // gira a caso, senza tornare indietro se si può
      const op = PASSI.filter(([b, dx, dy]) => lab.celle[indice(lab, e.cx, e.cy)] & b && !(e.dir && dx === -e.dir[0] && dy === -e.dir[1]));
      const p = op.length ? op[Math.floor(Math.random() * op.length)] : PASSI[Math.floor(Math.random() * 4)];
      e.vuole = [p[1], p[2]];
      e.tCambio = 0.6 + Math.random() * 1.2;
    }
    const prima = [e.x, e.y];
    muovi(lab, e, VEL.eco * dt);
    e.passo += Math.hypot(e.x - prima[0], e.y - prima[1]);
    // addosso a qualcuno si dissolve: era solo un Eco
    const s = sopr.find((q) => inGioco(q) && dist(q, e) < 1);
    if (s) {
      e.via = 4;
      fx.particelle(X(e.x), Y(e.y), { n: 18, colori: ['#3b3355', '#6b5f8f', '#000'], vel: 160, vita: 0.8, grav: -60 });
      avvisa(s.id, 'eco');
    }
  }

  // Luce: chi è nel cono (Boss, Echi, batterie) e quali caselle restano "ricordate".
  function aggiornaLuce(dt) {
    torce = blackout > 0 || finito ? [] : sopr.filter(torciaAccesa).map((s) => ({ s, x: s.x, y: s.y, ang: s.ang, bianca: false }));
    for (const tc of torce) {
      if (nelCono(lab, tc, boss.x, boss.y, 0.3)) {
        tc.bianca = true;
        boss.luce = RIVELA;
      }
      for (const e of echi) {
        if (e.via <= 0 && nelCono(lab, tc, e.x, e.y, 0.3)) {
          tc.bianca = true;
          e.luce = RIVELA;
        }
      }
    }
    tLuce -= dt;
    if (tLuce > 0) return;
    tLuce = 0.1;
    for (const b of batterie) b.luce = 0;
    const R = Math.ceil(TORCIA.raggio);
    for (const tc of torce) {
      esplora(indice(lab, Math.floor(tc.x), Math.floor(tc.y)));
      for (let y = Math.max(0, Math.floor(tc.y) - R); y <= Math.min(lab.rig - 1, Math.floor(tc.y) + R); y++) {
        for (let x = Math.max(0, Math.floor(tc.x) - R); x <= Math.min(lab.col - 1, Math.floor(tc.x) + R); x++) {
          if (!nelCono(lab, tc, x + 0.5, y + 0.5)) continue;
          esplora(indice(lab, x, y));
          for (const b of batterie) if (b.x === x && b.y === y) b.luce = 1;
        }
      }
    }
    // anche un ping illumina un po' intorno
    for (const p of pings) {
      for (let y = Math.max(0, Math.floor(p.y) - 1); y <= Math.min(lab.rig - 1, Math.floor(p.y) + 1); y++) {
        for (let x = Math.max(0, Math.floor(p.x) - 1); x <= Math.min(lab.col - 1, Math.floor(p.x) + 1); x++) {
          if (vede(lab, p.x, p.y, x + 0.5, y + 0.5)) esplora(indice(lab, x, y));
        }
      }
    }
  }

  function aggiornaMorsa(dt) {
    if (!morsa) return;
    const v = morsa.v;
    morsa.t += dt;
    v.tocchi = v.tocchi.filter((x) => t - x < 1);
    morsa.prog += dt * velocitaMorsa(v.tocchi.length);
    const eroe = torce.find((tc) => tc.s !== v && nelCono(lab, tc, boss.x, boss.y, 0.3));
    if (eroe) return fineMorsa('salvato', eroe.s);
    if (t - morsa.ultimoBoss > MORSA.tapBoss) return fineMorsa('liberato');
    if (morsa.prog >= 1) fineMorsa('preso');
  }

  function blip() {
    // solo chi è al buio: chi ha la torcia accesa l'Uomo Nero lo vede già sul telefono
    const nascosti = sopr.filter((s) => inGioco(s) && !torciaAccesa(s));
    if (!nascosti.length) return;
    codaBlip = codaBlip.filter((s) => nascosti.includes(s));
    if (!codaBlip.length) codaBlip = [...nascosti].sort(() => Math.random() - 0.5);
    const s = codaBlip.shift();
    // il cerchio (raggio 2) contiene il sopravvissuto, ma non è centrato su di lui
    const a = Math.random() * TAU;
    const r = Math.sqrt(Math.random()) * (BLIP.raggio - 0.5);
    const x = clamp(s.x + Math.cos(a) * r, 0.5, lab.col - 0.5);
    const y = clamp(s.y + Math.sin(a) * r, 0.5, lab.rig - 0.5);
    ultimoBlip = { x, y, t };
    if (!boss.p.bot) ctx.invia(boss.id, { bl: [r2(x), r2(y)] });
  }

  // ---------------------------------------------------------------------------
  // CPU (BOT DA CREARE / CALIBRARE): conoscono il labirinto e vedono quello che mostra
  // la TV (torce accese, sagome illuminate, ping) più il proprio telefono (battito, blip).

  const cacheD = new Map();
  function dDa(x, y) {
    const k = indice(lab, x, y);
    let d = cacheD.get(k);
    if (!d) {
      d = distanze(lab, x, y);
      cacheD.set(k, d);
    }
    return d;
  }
  // la casella dove l'entità decide la prossima svolta
  const prossima = (e) => (e.dir ? [e.cx + e.dir[0], e.cy + e.dir[1]] : [e.cx, e.cy]);
  function verso(e, tx, ty) {
    const d = dDa(tx, ty);
    const [x, y] = prossima(e);
    const qui = d[indice(lab, x, y)];
    if (qui <= 0) return [0, 0];
    for (const [b, dx, dy] of PASSI) {
      if (!(lab.celle[indice(lab, x, y)] & b)) continue;
      const v = d[indice(lab, x + dx, y + dy)];
      if (v >= 0 && v < qui) return [dx, dy];
    }
    return [0, 0];
  }
  function lontanoDa(e, px, py) {
    const d = dDa(clamp(Math.floor(px), 0, lab.col - 1), clamp(Math.floor(py), 0, lab.rig - 1));
    const [x, y] = prossima(e);
    let best = null;
    let bv = -1;
    for (const [b, dx, dy] of PASSI) {
      if (!(lab.celle[indice(lab, x, y)] & b)) continue;
      const v = d[indice(lab, x + dx, y + dy)] + Math.random() * 0.5;
      if (v > bv) {
        bv = v;
        best = [dx, dy];
      }
    }
    return best || [0, 0];
  }
  const passi = (e, x, y) => dDa(x, y)[indice(lab, ...prossima(e))];

  function botSopr(s, dt) {
    const cpu = ctx.cpu(s.id);
    const m = cpu.mem;
    if (!m.pronto) {
      m.pronto = true;
      m.tDec = cpu.num(0, 0.5);
      m.tTap = 0;
      m.fuga = 0;
      m.pausa = 0;
      m.bersaglio = null;
      m.coraggio = cpu.tratti.aggressivita;
      m.prudenza = cpu.tratti.prudenza;
      m.torciaViaggio = true;
    }
    if (!inGioco(s)) return;
    if (morsa && morsa.v === s) {
      m.tTap -= dt;
      if (m.tTap <= 0) {
        input(s.id, { tap: 1 });
        m.tTap = cpu.num(0.12, 0.3);
      }
      return;
    }
    m.tDec -= dt;
    if (m.tDec > 0) return;
    m.tDec = cpu.num(0.15, 0.35);
    // sagome illuminate vicine (Boss o Eco, non si distinguono) o battito forte: scappa
    const sagoma = [boss, ...echi.filter((e) => e.via <= 0)].find((e) => e.luce > 0 && dist(e, s) < 5);
    if (sagoma && t > m.fuga) {
      m.fuga = t + cpu.num(1.5, 3);
      m.da = [sagoma.x, sagoma.y];
      m.torciaFuga = cpu.prob(0.5 + 0.4 * m.prudenza);
      if (cpu.prob(0.25)) input(s.id, { pg: 1 });
    }
    let vuole;
    let vuoleTorcia = m.torciaViaggio;
    const vittima = morsa && morsa.v !== s ? morsa.v : null;
    if (t < m.fuga && m.da) {
      vuole = lontanoDa(s, ...m.da);
      vuoleTorcia = !m.torciaFuga;
    } else if (vittima && m.coraggio > 0.2 && passi(s, vittima.cx, vittima.cy) < 12) {
      vuole = verso(s, vittima.cx, vittima.cy);
      vuoleTorcia = true;
    } else {
      if (cpu.prob(0.04)) m.pausa = t + cpu.num(0.3, 0.9);
      const libere = batterie.filter((b) => !b.presa);
      if (libere.length) {
        if (!m.bersaglio || m.bersaglio.presa) {
          const altri = sopr.filter((q) => q !== s && inGioco(q)).map((q) => ctx.cpu(q.id).mem.bersaglio);
          m.bersaglio = libere
            .map((b) => ({ b, v: passi(s, b.x, b.y) + 6 * altri.filter((x) => x === b).length + cpu.num(0, 3) }))
            .sort((a, b) => a.v - b.v)[0].b;
          m.torciaViaggio = cpu.prob(0.45 + 0.4 * m.coraggio - 0.3 * m.prudenza);
        }
        vuole = verso(s, m.bersaglio.x, m.bersaglio.y);
        if (!s.dir && s.cx === m.bersaglio.x && s.cy === m.bersaglio.y) vuoleTorcia = true;
      } else vuole = verso(s, uscita[0], uscita[1]);
      if (t < m.pausa) vuole = [0, 0];
    }
    // battito forte senza sapere da dove: a volte torna indietro
    if (s.battito >= 2 && !vittima && t >= m.fuga && cpu.prob(0.35 + 0.3 * m.prudenza)) {
      m.fuga = t + cpu.num(1, 2);
      m.da = [s.x + (s.dir ? s.dir[0] * 2 : 0), s.y + (s.dir ? s.dir[1] * 2 : 0)];
      m.torciaFuga = true;
    }
    // col battito spegne la torcia (a meno che stia caricando quasi tutta la batteria)
    if (s.battito >= 1 && !(s.carica > 1.2) && !vittima && cpu.prob(0.5 + 0.4 * m.prudenza)) vuoleTorcia = false;
    if (!!vuoleTorcia !== s.torcia && blackout <= 0 && !(s.terrore > 0)) input(s.id, { to: 1 });
    input(s.id, { j: vuole });
  }

  function botBoss(dt) {
    const cpu = ctx.cpu(boss.id);
    const m = cpu.mem;
    if (!m.pronto) {
      m.pronto = true;
      m.tDec = 0;
      m.tTap = 0;
      m.giro = null;
      m.ultimo = null;
    }
    if (morsa) {
      m.tTap -= dt;
      if (m.tTap <= 0) {
        input(boss.id, { tap: 1 });
        m.tTap = cpu.num(0.15, 0.32);
      }
      return;
    }
    m.tDec -= dt;
    if (m.tDec > 0) return;
    m.tDec = cpu.num(0.3, 0.55);
    // afferra chi è attaccato (se ha la torcia spenta tira a indovinare)
    if (boss.recupero <= 0 && boss.cdMorsa <= 0) {
      const vicini = sopr.filter((s) => inGioco(s) && s.immune <= 0 && dist(s, boss) <= MORSA.raggio && vede(lab, boss.x, boss.y, s.x, s.y));
      if (vicini.length && (vicini.some(torciaAccesa) || cpu.prob(0.15))) {
        input(boss.id, { m: 1 });
        return;
      }
    }
    const da = prossima(boss);
    // non guarda la TV di continuo: a volte non si accorge di una torcia
    const visti = cpu.prob(0.85) ? sopr.filter(torciaAccesa) : [];
    let meta = null;
    if (visti.length) {
      const d = dDa(...da);
      const s = visti.sort((a, b) => d[indice(lab, a.cx, a.cy)] - d[indice(lab, b.cx, b.cy)])[0];
      meta = [s.cx, s.cy];
      m.ultimo = { meta, t };
    } else if (pings.length) {
      const p = pings[pings.length - 1];
      meta = [Math.floor(p.x), Math.floor(p.y)];
    } else if (ultimoBlip && t - ultimoBlip.t < 3) {
      meta = [Math.floor(ultimoBlip.x), Math.floor(ultimoBlip.y)];
    } else if (m.ultimo && t - m.ultimo.t < 5) {
      meta = m.ultimo.meta;
    } else {
      if (!m.giro || (boss.cx === m.giro[0] && boss.cy === m.giro[1])) {
        const libere = batterie.filter((b) => !b.presa);
        const b = libere.length ? cpu.scegli(libere) : null;
        m.giro = aperta || !b ? [...uscita] : [b.x, b.y];
        if (aperta && cpu.prob(0.5)) m.giro = cellaLontana();
      }
      meta = m.giro;
    }
    // poteri
    const vicino = (s, r) => dist(s, boss) <= r;
    if (cfg.poteri.includes('urlo') && boss.cd.urlo <= 0 && visti.some((s) => vicino(s, 6))) input(boss.id, { k: 'urlo' });
    else if (cfg.poteri.includes('blackout') && boss.cd.blackout <= 0 && visti.some((s) => vicino(s, 2.5)) && cpu.prob(0.5)) input(boss.id, { k: 'blackout' });
    else if (cfg.poteri.includes('marchio') && boss.cd.marchio <= 0 && cpu.prob(0.3)) {
      const vicinoBatteria = batterie.some((b) => !b.presa && Math.hypot(b.x + 0.5 - boss.x, b.y + 0.5 - boss.y) <= 1.5);
      const vicinoUscita = aperta && Math.hypot(uscita[0] + 0.5 - boss.x, uscita[1] + 0.5 - boss.y) <= 2;
      if (vicinoBatteria || vicinoUscita) input(boss.id, { k: 'marchio' });
    }
    // al buio sbaglia strada ogni tanto (una persona vede solo i muri vicini)
    const lontano = Math.hypot(meta[0] + 0.5 - boss.x, meta[1] + 0.5 - boss.y) > 3;
    let j = verso(boss, ...meta);
    if (lontano && cpu.prob(0.15)) {
      const [x, y] = prossima(boss);
      const op = PASSI.filter(([b]) => lab.celle[indice(lab, x, y)] & b);
      if (op.length) j = (([, dx, dy]) => [dx, dy])(cpu.scegli(op));
    }
    input(boss.id, { j });
  }

  // ---------------------------------------------------------------------------
  // Disegno

  function sagoma(g, x, y, alfa, h) {
    // ombra alta col mantello, occhi rossi: uguale per Uomo Nero ed Echi
    g.save();
    g.globalAlpha = alfa;
    const px = X(x);
    const py = Y(y) + h * 0.35;
    const ondeggia = Math.sin(t * 6 + x) * h * 0.04;
    const alone = g.createRadialGradient(px, py - h * 0.5, h * 0.1, px, py - h * 0.5, h * 0.9);
    alone.addColorStop(0, 'rgba(120,60,200,0.35)');
    alone.addColorStop(1, 'rgba(120,60,200,0)');
    g.fillStyle = alone;
    g.beginPath();
    g.arc(px, py - h * 0.5, h * 0.9, 0, TAU);
    g.fill();
    g.fillStyle = '#05030a';
    g.beginPath();
    g.moveTo(px - h * 0.32, py);
    g.quadraticCurveTo(px - h * 0.3 + ondeggia, py - h * 0.6, px - h * 0.16, py - h * 0.72);
    g.lineTo(px + h * 0.16, py - h * 0.72);
    g.quadraticCurveTo(px + h * 0.3 + ondeggia, py - h * 0.6, px + h * 0.32, py);
    for (let i = 4; i >= 0; i--) g.lineTo(px - h * 0.32 + (i * h * 0.64) / 4, py - (i % 2) * h * 0.08);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(px, py - h * 0.82, h * 0.2, 0, TAU);
    g.fill();
    g.fillStyle = '#ff2a3d';
    g.shadowColor = '#ff2a3d';
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(px - h * 0.075, py - h * 0.84, h * 0.04, 0, TAU);
    g.arc(px + h * 0.075, py - h * 0.84, h * 0.04, 0, TAU);
    g.fill();
    g.restore();
  }

  function disegnaBatteria(g, b, forte) {
    const px = X(b.x + 0.5);
    const py = Y(b.y + 0.5);
    const puls = 0.5 + 0.5 * Math.sin(t * 3 + b.x * 1.7 + b.y);
    const r = C * (forte ? 0.9 : 0.55);
    const alone = g.createRadialGradient(px, py, 2, px, py, r);
    alone.addColorStop(0, `rgba(255,220,80,${forte ? 0.55 : 0.18 + 0.14 * puls})`);
    alone.addColorStop(1, 'rgba(255,220,80,0)');
    g.fillStyle = alone;
    g.beginPath();
    g.arc(px, py, r, 0, TAU);
    g.fill();
    g.save();
    g.globalAlpha = forte ? 1 : 0.35 + 0.25 * puls;
    const w = C * 0.26;
    const h = C * 0.44;
    g.fillStyle = '#1b1030';
    g.beginPath();
    g.roundRect(px - w / 2 - 3, py - h / 2 - 3, w + 6, h + 6, 6);
    g.fill();
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.roundRect(px - w / 2, py - h / 2, w, h, 4);
    g.fill();
    g.fillStyle = '#4cd97b';
    g.fillRect(px - w / 2 + 3, py, w - 6, h / 2 - 3);
    g.fillStyle = '#1b1030';
    g.fillRect(px - w * 0.2, py - h / 2 - 7, w * 0.4, 5);
    g.restore();
  }

  function disegnaUscita(g) {
    const px = X(uscita[0] + 1);
    const py = Y(uscita[1]);
    const col = aperta ? '#4cd97b' : '#ff4d6d';
    const puls = 0.5 + 0.5 * Math.sin(t * (aperta ? 6 : 2));
    g.save();
    g.shadowColor = col;
    g.shadowBlur = aperta ? 30 + 20 * puls : 14;
    g.fillStyle = aperta ? `rgba(76,217,123,${0.6 + 0.4 * puls})` : '#5a1424';
    g.fillRect(px - LW, py + C * 0.08, LW * 2.2, C * 0.84);
    g.restore();
    ctx.pannello(g, px - C * 0.95, py - 36, C * 0.95 + 8, 30, { r: 8, colore: aperta ? '#14532d' : '#4c0519', bordo: col, lw: 2 });
    ctx.testo(g, aperta ? 'USCITA' : '🔒', px - C * 0.45, py - 21, { dim: 18, colore: aperta ? '#bbf7d0' : '#fecdd3', bordo: 0 });
  }

  function disegnaSopr(g, s) {
    const preso = morsa && morsa.v === s;
    const h = C * 0.95;
    const px = X(s.x);
    const py = Y(s.y) + h * 0.38;
    g.save();
    g.fillStyle = shade(s.p.colore, -0.1);
    g.globalAlpha = 0.7;
    g.beginPath();
    g.ellipse(px, py, C * 0.32, C * 0.12, 0, 0, TAU);
    g.fill();
    g.restore();
    const moto = s.dir && !preso;
    ctx.avatar(g, s.p.av, px, py, h, {
      pose: preso ? 'hit' : !s.vivo ? 'sad' : moto ? 'run' : 'idle',
      t: moto ? s.passo * 0.5 : t,
      look: [Math.cos(s.ang), Math.sin(s.ang) * 0.5],
      espr: preso || s.terrore > 0 ? 'sorpreso' : null,
      ombra: false,
    });
    // la torcia in mano
    if (torciaAccesa(s)) {
      g.fillStyle = '#fff2b0';
      g.beginPath();
      g.arc(px + Math.cos(s.ang) * C * 0.28, py - h * 0.45 + Math.sin(s.ang) * C * 0.2, C * 0.07, 0, TAU);
      g.fill();
    }
  }

  function luci(g, conCarica) {
    // poligoni di luce, in pixel: torce, alone di chi la tiene, ping
    for (const tc of torce) {
      const pts = conoLuce(lab, tc);
      const gr = g.createRadialGradient(X(tc.x), Y(tc.y), C * 0.2, X(tc.x), Y(tc.y), TORCIA.raggio * C);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.7, 'rgba(0,0,0,0.88)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = conCarica ? (tc.bianca ? 'rgba(255,255,255,0.32)' : 'rgba(255,205,120,0.16)') : gr;
      g.beginPath();
      g.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (const [x, y] of pts) g.lineTo(X(x), Y(y));
      g.closePath();
      g.fill();
      if (!conCarica) {
        g.beginPath();
        g.arc(X(tc.x), Y(tc.y), C * 0.75, 0, TAU);
        g.fillStyle = 'rgba(0,0,0,0.85)';
        g.fill();
      }
    }
    if (conCarica) return;
    for (const p of pings) {
      const k = 1 - p.t / PING.durata;
      const gr = g.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), C * 1.6);
      gr.addColorStop(0, `rgba(0,0,0,${0.9 * k})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(X(p.x), Y(p.y), C * 1.6, 0, TAU);
      g.fill();
    }
  }

  function disegnaBuio(g) {
    const b = buio.getContext('2d');
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, W, H);
    b.fillStyle = `rgba(3,2,8,${0.975 * (1 - luceFinale * 0.75)})`;
    b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'destination-out';
    luci(b, false);
    b.globalCompositeOperation = 'source-over';
    g.drawImage(buio, 0, 0);
    g.save();
    g.globalCompositeOperation = 'lighter';
    luci(g, true);
    g.restore();
  }

  function disegnaMarchio(g, m) {
    const k = m.t / POTERI.marchio.durata;
    const r = POTERI.marchio.raggio * C;
    g.save();
    g.translate(X(m.x), Y(m.y));
    g.globalAlpha = (k > 0.85 ? (1 - k) / 0.15 : 1) * (0.55 + 0.2 * Math.sin(t * 5));
    g.fillStyle = 'rgba(200,20,50,0.18)';
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    g.strokeStyle = '#ff4d6d';
    g.lineWidth = 4;
    g.setLineDash([14, 10]);
    g.rotate(t * 0.8);
    g.stroke();
    g.setLineDash([]);
    g.restore();
    ctx.testo(g, '☠️', X(m.x), Y(m.y), { dim: C * 0.5, bordo: 0 });
  }

  function disegnaMorsa(g) {
    if (!morsa) return;
    const v = morsa.v;
    const px = X(v.x);
    const py = Y(v.y);
    const puls = 0.5 + 0.5 * Math.sin(t * 14);
    g.save();
    g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * puls})`;
    g.lineWidth = 5;
    g.shadowColor = '#fff';
    g.shadowBlur = 20;
    g.beginPath();
    g.arc(px, py, C * (0.85 + 0.2 * puls), 0, TAU);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = '#ff2a3d';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(px, py, C * 1.15, -Math.PI / 2, -Math.PI / 2 + TAU * morsa.prog);
    g.stroke();
    g.restore();
    disegnaSopr(g, v);
    ctx.etichetta(g, `AIUTO! ${nome(v)}`, px, py - C * 1.35, '#ff4d6d', { dim: 22 });
  }

  function disegnaPing(g, p) {
    const k = p.t / PING.durata;
    const px = X(p.x);
    const py = Y(p.y);
    g.save();
    g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    for (let i = 0; i < 2; i++) {
      const f = (t * 1.2 + i * 0.5) % 1;
      g.strokeStyle = p.colore;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(px, py, C * (0.25 + f * 1.1), 0, TAU);
      g.stroke();
    }
    g.fillStyle = p.colore;
    g.shadowColor = p.colore;
    g.shadowBlur = 24;
    g.beginPath();
    g.arc(px, py, C * 0.2, 0, TAU);
    g.fill();
    g.restore();
  }

  function disegnaHud(g) {
    if (!finito) ctx.barraTempo(g, DURATA - t, DURATA, { w: 640, x: W / 2 - 320, y: 34 });
    ctx.pannello(g, 30, 20, 380, 72, { r: 36, colore: aperta ? 'rgba(20,83,45,0.9)' : undefined });
    ctx.testo(g, aperta ? '🚪 USCITA APERTA!' : `🔋 Batterie ${prese()}/${batterie.length}`, 220, 56, { dim: 32, colore: aperta ? '#bbf7d0' : '#ffe08a' });
    const vivi = sopr.filter(inGioco).length;
    const fuori = sopr.filter((s) => s.fuggito).length;
    const presi = sopr.filter((s) => s.preso).length;
    ctx.pannello(g, W - 420, 20, 390, 72, { r: 36 });
    ctx.testo(g, `🔦 ${vivi}   🚪 ${fuori}   💀 ${presi}`, W - 225, 56, { dim: 32 });
    if (banner && banner.t < 3) {
      const a = banner.t < 2.5 ? 1 : (3 - banner.t) / 0.5;
      g.save();
      g.globalAlpha = a;
      ctx.pannello(g, W / 2 - 640, 76, 1280, 52, { r: 26, colore: 'rgba(10,6,24,0.85)' });
      ctx.testo(g, banner.testo, W / 2, 103, { dim: 28, colore: banner.colore, maxW: 1240 });
      g.restore();
    }
  }

  function disegnaFine(g) {
    if (!esito || fineTra <= 0) return;
    const tutti = esito.fuggiti === sopr.length;
    const titolo = esito.notte ? "NOTTE ETERNA! 👤" : tutti ? 'TUTTI IN SALVO! 🔦✨' : `🚪 Scappati ${esito.fuggiti} su ${sopr.length}`;
    ctx.pannello(g, W / 2 - 520, 400, 1040, 170, { colore: 'rgba(10,6,24,0.9)', r: 40 });
    ctx.testo(g, titolo, W / 2, 458, { dim: 66, colore: esito.notte ? '#ff4d8d' : tutti ? '#4cd97b' : '#ffd23f' });
    ctx.testo(g, `👤 L'Uomo Nero era ${boss.p.nome}: ${esito.fermati} ${esito.fermati === 1 ? 'fermato' : 'fermati'}`, W / 2, 528, { dim: 34 });
  }

  // ---------------------------------------------------------------------------

  return {
    inizia() {
      annuncia("🔦 Trovate le batterie! L'Uomo Nero è da qualche parte nel buio…", '#ffe08a');
    },

    aggiorna(dt) {
      if (banner) banner.t += dt;
      lampoUrlo = Math.max(0, lampoUrlo - dt);
      for (const p of pings) p.t += dt;
      while (pings.length && pings[0].t >= PING.durata) pings.shift();
      if (finito) {
        luceFinale = Math.min(1, luceFinale + dt);
        if (fineTra > 0) {
          fineTra -= dt;
          if (fineTra <= 0) ctx.fine({ punteggi: esito.punti, alto: true, dettagli: esito.dettagli });
        }
        return;
      }
      t += dt;
      // pilota automatico per chi ha il telefono spento
      for (const s of sopr) if (!s.p.bot && !ctx.connesso(s.id)) botSopr(s, dt);
      if (!boss.p.bot && !ctx.connesso(boss.id)) botBoss(dt);
      if (blackout > 0) {
        blackout -= dt;
        if (blackout <= 0) annuncia('🔦 Le torce si riaccendono…', '#ffe08a');
      }
      for (let i = marchi.length - 1; i >= 0; i--) {
        marchi[i].t += dt;
        if (marchi[i].t >= POTERI.marchio.durata) marchi.splice(i, 1);
      }
      aggiornaBoss(dt);
      for (const s of sopr) aggiornaSopr(s, dt);
      for (const e of echi) aggiornaEco(e, dt);
      aggiornaLuce(dt);
      aggiornaMorsa(dt);
      tBattito -= dt;
      if (tBattito <= 0) {
        tBattito = 0.2;
        for (const s of sopr) {
          const d = inGioco(s) ? dist(s, boss) : 99;
          s.battito = d <= 1.5 ? 3 : d <= 2.25 ? 2 : d <= BATTITO ? 1 : 0;
        }
      }
      tBlip += dt;
      const ogni = Math.max(BLIP.ogni, BLIP.minimo / Math.max(1, sopr.filter((s) => inGioco(s) && !torciaAccesa(s)).length));
      if (tBlip >= ogni) {
        tBlip = 0;
        blip();
      }
      tStream -= dt;
      if (tStream <= 0) {
        tStream = 0.12;
        stream();
      }
      if (t >= DURATA || !sopr.some(inGioco)) termina();
    },

    disegna(g) {
      g.drawImage(fondo, 0, 0);
      for (const b of batterie) if (!b.presa) disegnaBatteria(g, b, true);
      // sotto il buio: si vede solo ciò che è illuminato
      for (const s of [...sopr].sort((a, b) => a.y - b.y)) if (inGioco(s) && !(morsa && morsa.v === s)) disegnaSopr(g, s);
      if (luceFinale > 0) {
        for (const e of echi) if (e.via <= 0) sagoma(g, e.x, e.y, 0.7, C * 1.15);
        sagoma(g, boss.x, boss.y, 1, C * 1.25);
      }
      disegnaBuio(g);
      // sopra il buio: ricordo dei muri, batterie che brillano, uscita, segnali
      g.save();
      g.globalAlpha = 0.3 * (1 - luceFinale);
      g.drawImage(memoria, 0, 0);
      g.restore();
      for (const b of batterie) if (!b.presa && luceFinale < 1) disegnaBatteria(g, b, b.luce > 0);
      disegnaUscita(g);
      for (const m of marchi) disegnaMarchio(g, m);
      for (const p of pings) disegnaPing(g, p);
      for (const s of sopr) {
        if (!inGioco(s)) continue;
        if (s.carica > 0) {
          g.strokeStyle = '#4cd97b';
          g.lineWidth = 7;
          g.beginPath();
          g.arc(X(s.cx + 0.5), Y(s.cy + 0.5), C * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * (s.carica / CARICA));
          g.stroke();
        }
        if (torciaAccesa(s) || t < 4 || luceFinale > 0) ctx.etichetta(g, nome(s), X(s.x), Y(s.y) - C * 0.78, s.p.colore, { dim: Math.max(15, C * 0.26), maxW: C * 2.2 });
        if (s.terrore > 0) ctx.testo(g, '😱', X(s.x) + C * 0.45, Y(s.y) - C * 0.4, { dim: C * 0.4, bordo: 0 });
      }
      for (const e of echi) if (e.via <= 0 && e.luce > 0 && luceFinale === 0) sagoma(g, e.x, e.y, Math.min(1, e.luce * 1.5), C * 1.25);
      if (boss.luce > 0 && luceFinale === 0) sagoma(g, boss.x, boss.y, Math.min(1, boss.luce * 1.5), C * 1.25);
      if (boss.accecato > 0) ctx.testo(g, '💫', X(boss.x), Y(boss.y) - C * 1.1, { dim: C * 0.5, bordo: 0 });
      if (luceFinale > 0) ctx.etichetta(g, `👤 ${boss.p.nome}`, X(boss.x), Y(boss.y) - C * 1.3, '#1b1030', { dim: 24 });
      disegnaMorsa(g);
      if (lampoUrlo > 0) {
        g.fillStyle = `rgba(255,30,60,${lampoUrlo * 0.3})`;
        g.fillRect(0, 0, W, H);
      }
      disegnaHud(g);
      disegnaFine(g);
    },

    input,

    bot(id, dt) {
      if (id === boss.id) botBoss(dt);
      else {
        const s = perId.get(id);
        if (s) botSopr(s, dt);
      }
    },

    rientrato(id) {
      if (id === boss.id) vistaBoss();
      else if (perId.has(id)) vistaSopr(perId.get(id));
    },
  };
}
