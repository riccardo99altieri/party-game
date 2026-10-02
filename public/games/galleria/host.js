// Galleria d'Arte: tutti disegnano lo stesso tema buffo sul telefono (in diretta
// sullo schermo grande), poi si vota il disegno preferito.

import { TAU, rand, pick, clamp, randInt, ease } from '../../shared/util.js';
import { COLORI_LAVAGNA, SPESSORI } from '../../phone/widgets.js';

const T_TEMA = 4;
const T_DISEGNO = 75;
const T_VOTO = 25;
const T_ESITO = 7;
const MAX_VALORI = 30000; // limite di coordinate per disegno

export const TEMI = [
  'Un gatto astronauta',
  'La pizza più triste del mondo',
  'Un dinosauro al mare',
  'Un fantasma che ha paura del buio',
  'Una mucca in bicicletta',
  'Il supereroe più inutile',
  'Un robot innamorato',
  'La casa dei tuoi sogni',
  'Un pesce con le gambe',
  'Il mostro sotto il letto',
  'Una giraffa in ascensore',
  'Il re dei calzini',
  'Un vulcano che starnutisce',
  'La tua colazione perfetta',
  'Un alieno in vacanza',
  'Un pinguino nel deserto',
  'Un cane che fa yoga',
  'Una nuvola arrabbiata',
  'Un drago vegetariano',
  'Il lunedì mattina',
  'Una banana supereroe',
  'Un cavaliere su una lumaca',
  'La luna che mangia un gelato',
  'Una torta di compleanno esplosa',
  'Un polpo che suona la batteria',
  'Il nonno rapper',
  'Un unicorno dal dentista',
  'Una patata famosa',
  'Un castello di spaghetti',
  'Il gatto che comanda il mondo',
  'Una festa in fondo al mare',
  'Un orso in pigiama',
  'Il Wi-Fi che non funziona',
  'Un selfie con un T-Rex',
  'Una pianta carnivora affamata',
  'Il sole in vacanza',
  'Un criceto palestrato',
  'Una formica che solleva una macchina',
  'Un tostapane felice',
  'Una sirena al supermercato',
  'Un pirata che ha paura dell’acqua',
  'Un ninja molto goffo',
  'Un’astronave fatta di formaggio',
  'Uno scheletro che balla',
  'Il mostro della pasta',
  'Una lumaca da corsa',
  'Il tuo insegnante da piccolo',
  'Un pupazzo di neve in estate',
  'Una balena in vasca da bagno',
  'Il frigorifero di notte',
];

// ===========================================================================
// Disegni delle CPU
//
// Un disegno è una lista di "parti" (forme piene col bordo, linee, punti) in
// coordinate del foglio 0..1000, scelte in base alle parole del tema. Il livello
// decide quali parti fare e come (scarabocchio, disegnino, scena colorata); poi
// il bot le traccia col "dito", tratto dopo tratto, con gli stessi messaggi del telefono.

const C = {
  nero: '#1b1030',
  bianco: '#ffffff',
  rosso: '#ef4444',
  arancio: '#f97316',
  giallo: '#facc15',
  verde: '#22c55e',
  verdone: '#15803d',
  celeste: '#38bdf8',
  blu: '#2563eb',
  viola: '#a855f7',
  rosa: '#f472b6',
  marrone: '#92400e',
  pelle: '#f5c49c',
  grigio: '#9ca3af',
};
const VIVACI = [C.rosso, C.arancio, C.giallo, C.verde, C.celeste, C.blu, C.viola, C.rosa];

// --- geometria ---------------------------------------------------------------

function ovale(cx, cy, rx, ry, n = 22) {
  const p = [];
  for (let i = 0; i < n; i++) p.push([cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry]);
  return p;
}
const rett = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
function arco(cx, cy, rx, ry, a0, a1, n = 10) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return p;
}
function stella(cx, cy, r, k = 5) {
  const p = [];
  for (let i = 0; i < k * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / k;
    p.push([cx + Math.cos(a) * (i % 2 ? r * 0.45 : r), cy + Math.sin(a) * (i % 2 ? r * 0.45 : r)]);
  }
  return p;
}
function cuore(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * TAU;
    p.push([cx + r * 0.06 * 16 * Math.sin(t) ** 3, cy - r * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
  }
  return p;
}
// Curva morbida che passa per i punti di controllo (Catmull-Rom).
function morbida(c, k = 6) {
  if (c.length < 3) return c;
  const out = [];
  for (let i = 0; i < c.length - 1; i++) {
    const p0 = c[i - 1] || c[i];
    const p1 = c[i];
    const p2 = c[i + 1];
    const p3 = c[i + 2] || p2;
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const q = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
      out.push([q(p0[0], p1[0], p2[0], p3[0]), q(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(c[c.length - 1]);
  return out;
}
// Righe orizzontali dentro un poligono, per colorarlo "a zig-zag" come col dito.
function righeDentro(poli, passo, rientro) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of poli) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  const h = y1 - y0 - 2 * rientro;
  const quante = Math.max(1, Math.round(h / passo));
  const righe = [];
  for (let i = 0; i < quante; i++) {
    const y = y0 + rientro + (h > 0 ? ((i + 0.5) * h) / quante : (y1 - y0) / 2 - rientro);
    let a = Infinity;
    let b = -Infinity;
    for (let k = 0; k < poli.length; k++) {
      const [ax, ay] = poli[k];
      const [bx, by] = poli[(k + 1) % poli.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        const x = ax + ((y - ay) * (bx - ax)) / (by - ay);
        a = Math.min(a, x);
        b = Math.max(b, x);
      }
    }
    if (a > b) continue;
    if (b - a > 2 * rientro + 6) righe.push([a + rientro, b - rientro, y]);
    else righe.push([(a + b) / 2 - 3, (a + b) / 2 + 3, y]);
  }
  return righe;
}
const scatola = (pts) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
const lunghezza = (pts) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

// Tratto "a mano": ricampiona il percorso come lo campionerebbe il telefono e
// aggiunge un tremolio morbido. Restituisce i punti piatti [x,y,...] 0..1000.
function aMano(pts, ampiezza, passo) {
  const f1 = TAU / (160 + Math.random() * 240);
  const f2 = TAU / (45 + Math.random() * 60);
  const ph1 = Math.random() * TAU;
  const ph2 = Math.random() * TAU;
  const out = [];
  const metti = (x, y) => {
    x = Math.round(clamp(x, 0, 1000));
    y = Math.round(clamp(y, 0, 1000));
    const n = out.length;
    if (n >= 2 && Math.hypot(x - out[n - 2], y - out[n - 1]) < 4) return;
    out.push(x, y);
  };
  if (pts.length === 1) {
    metti(pts[0][0], pts[0][1]);
    return out;
  }
  let s = 0;
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-6) continue;
    nx = -(by - ay) / L;
    ny = (bx - ax) / L;
    const k = Math.max(1, Math.round(L / passo));
    for (let j = 0; j < k; j++) {
      const q = s + (L * j) / k;
      const o = ampiezza * (0.65 * Math.sin(q * f1 + ph1) + 0.35 * Math.sin(q * f2 + ph2));
      metti(ax + ((bx - ax) * j) / k + nx * o, ay + ((by - ay) * j) / k + ny * o);
    }
    s += L;
  }
  const [lx, ly] = pts[pts.length - 1];
  const o = ampiezza * (0.65 * Math.sin(s * f1 + ph1) + 0.35 * Math.sin(s * f2 + ph2));
  metti(lx + nx * o, ly + ny * o);
  if (out.length < 4) metti(lx + 5, ly);
  return out;
}

// --- il foglio: raccoglie le parti in un sistema di riferimento locale ------

function creaFoglio(liv) {
  const parti = [];
  let ox = 0;
  let oy = 0;
  let s = 1;
  let d = 1;
  const T = ([x, y]) => [ox + x * s * d, oy + y * s];
  const f = {
    liv,
    parti,
    // centro, raggio e verso (1 = guarda a destra) del soggetto
    posa(cx, cy, r, verso = 1) {
      ox = cx;
      oy = cy;
      s = r;
      d = verso;
      return f;
    },
    mondo: (x, y) => T([x, y]),
    scala: (v) => v * s,
    forma(pts, col, o = {}) {
      parti.push({ tipo: 'forma', pts: pts.map(T), col, imp: o.imp ?? 2, riempi: o.riempi !== false, bordo: o.bordo !== false, grande: !!o.grande });
      return f;
    },
    ovale: (x, y, rx, ry, col, o) => f.forma(ovale(x, y, rx, ry), col, o),
    linea(pts, col, w, o = {}) {
      parti.push({ tipo: 'linea', pts: (o.morbida ? morbida(pts) : pts).map(T), col, w, imp: o.imp ?? 1 });
      return f;
    },
    punto(x, y, col, w, o = {}) {
      parti.push({ tipo: 'punto', pts: [T([x, y])], col, w, imp: o.imp ?? 1 });
      return f;
    },
  };
  return f;
}

// Faccia (in coordinate locali): occhi, bocca, e i dettagli dell'umore.
function faccia(f, x, y, r, umore, imp = 2.5) {
  const ex = r * 0.38;
  const ey = y - r * 0.15;
  for (const sx of [-1, 1]) {
    if (umore === 'paura') {
      f.ovale(x + sx * ex, ey, r * 0.2, r * 0.27, C.bianco, { imp });
      f.punto(x + sx * ex, ey + r * 0.05, C.nero, 8, { imp });
    } else if (umore === 'starnuto') {
      f.linea(arco(x + sx * ex, ey, r * 0.15, r * 0.1, Math.PI * 1.1, Math.PI * 1.9, 5), C.nero, 8, { imp });
    } else {
      f.punto(x + sx * ex, ey, C.nero, 18, { imp });
      if (f.liv === 2) f.punto(x + sx * ex + r * 0.04, ey - r * 0.05, C.bianco, 8, { imp: 0.6 });
    }
    if (umore === 'arrabbiato') f.linea([[x + sx * ex * 1.6, ey - r * 0.38], [x + sx * ex * 0.4, ey - r * 0.22]], C.nero, 8, { imp: 1.5 });
    if (umore === 'triste') f.linea([[x + sx * ex * 1.5, ey - r * 0.22], [x + sx * ex * 0.4, ey - r * 0.36]], C.nero, 8, { imp: 1.2 });
    if (umore === 'amore' || (umore === 'felice' && f.liv === 2)) f.punto(x + sx * r * 0.6, y + r * 0.2, C.rosa, 18, { imp: 0.7 });
  }
  const my = y + r * 0.35;
  if (umore === 'triste') {
    f.linea(arco(x, my + r * 0.2, r * 0.3, r * 0.18, Math.PI * 1.15, Math.PI * 1.85, 8), C.nero, 8, { imp });
    f.forma(cuore(x + ex, ey + r * 0.35, r * 0.12).map(([a, b]) => [a, 2 * (ey + r * 0.35) - b]), C.celeste, { imp: 1 });
  } else if (umore === 'paura' || umore === 'starnuto') {
    f.ovale(x, my, r * 0.14, r * 0.18, C.nero, { imp });
  } else if (umore === 'arrabbiato') {
    f.forma([[x - r * 0.35, my], [x + r * 0.35, my], [x + r * 0.28, my + r * 0.2], [x - r * 0.28, my + r * 0.2]], C.bianco, { imp });
    f.linea([[x - r * 0.33, my + r * 0.1], [x + r * 0.33, my + r * 0.1]], C.nero, 8, { imp: 0.8 });
  } else {
    f.linea(arco(x, my - r * 0.1, r * 0.32, r * 0.22, Math.PI * 0.15, Math.PI * 0.85, 8), C.nero, 8, { imp });
    if (umore === 'buffo') f.ovale(x + r * 0.08, my + r * 0.14, r * 0.1, r * 0.12, C.rosa, { imp: 1 });
  }
}

// --- lettura del tema --------------------------------------------------------

const SOGGETTO = [
  ['lumaca', 'lumaca'],
  ['banana', 'banana'],
  ['formica', 'formica'],
  ['polpo', 'polpo'],
  ['balena', 'balena'],
  ['pesce|fondo al mare', 'pesce'],
  ['gatto', 'animale', 'gatto'],
  ['dinosauro|t-rex', 'animale', 'dino'],
  ['drago', 'animale', 'drago'],
  ['mucca', 'animale', 'mucca'],
  ['giraffa', 'animale', 'giraffa'],
  ['cane', 'animale', 'cane'],
  ['unicorno', 'animale', 'unicorno'],
  ['criceto', 'animale', 'criceto'],
  ['orso', 'orso'],
  ['pinguino', 'pinguino'],
  ['robot', 'robot'],
  ['alieno', 'alieno'],
  ['scheletro', 'scheletro'],
  ['pupazzo', 'pupazzo'],
  ['fantasma', 'fantasma'],
  ['sirena', 'persona', 'sirena'],
  ['pirata', 'persona', 'pirata'],
  ['ninja', 'persona', 'ninja'],
  ['supereroe', 'persona', 'eroe'],
  ['nonno', 'persona', 'nonno'],
  ['insegnante', 'persona', 'bimbo'],
  ['pizza', 'pizza'],
  ['patata', 'patata'],
  ['nuvola', 'nuvola'],
  ['sole', 'sole'],
  ['luna', 'luna'],
  ['tostapane', 'scatola', 'tostapane'],
  ['frigorifero', 'scatola', 'frigo'],
  ['torta', 'torta'],
  ['vulcano', 'vulcano'],
  ['calzini', 'calzino'],
  ['pianta', 'pianta'],
  ['casa|castello', 'casa'],
  ['astronave', 'astronave'],
  ['wi-fi', 'wifi'],
  ['lunedi', 'sveglia'],
  ['colazione', 'colazione'],
];

function leggiTema(tema) {
  const t = tema
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const ha = (re) => new RegExp(re).test(t);
  const riga = SOGGETTO.find(([re]) => ha(re)) || ['', 'mostro'];
  let sfondo = 'prato';
  if (ha('fondo al mare|polpo')) sfondo = 'fondale';
  else if (ha('frigorifero|letto')) sfondo = 'notteCasa';
  else if (ha('vasca|ascensore|dentista|supermercato|colazione|tostapane|lunedi|wi-fi|torta|insegnante|nonno|pasta|criceto|calzini|pianta|patata|pizza')) sfondo = 'interno';
  else if (ha('deserto')) sfondo = 'deserto';
  else if (ha('mare|vacanza|pirata|pesce')) sfondo = 'mare';
  else if (ha('astronaut|astronave|comanda il mondo')) sfondo = 'spazio';
  else if (ha('buio|notte|fantasma|scheletro|luna|ninja|pigiama')) sfondo = 'notte';
  let umore = 'felice';
  if (ha('paura')) umore = 'paura';
  else if (ha('trist|lunedi|non funziona|inutile')) umore = 'triste';
  else if (ha('arrabbiat|affamat|mostro')) umore = 'arrabbiato';
  else if (ha('innamorat')) umore = 'amore';
  else if (ha('starnut')) umore = 'starnuto';
  else if (ha('goffo|palestrato')) umore = 'buffo';
  const extra = [];
  const EXTRA_RE = [
    ['astronauta', 'casco'],
    ['bicicletta', 'bici'],
    ['innamorato', 'cuori'],
    ['famosa|festa', 'stelle'],
    ['famosa|vacanza|deserto|rapper', 'occhiali'],
    ['vacanza', 'ombrellone'],
    ['re dei|comanda', 'corona'],
    ['palestrato', 'manubrio'],
    ['selfie', 'selfie'],
    ['gelato', 'gelato'],
    ['vegetariano', 'carota'],
    ['festa', 'palloncini'],
    ['batteria', 'tamburi'],
    ['letto', 'letto'],
    ['vasca', 'vasca'],
    ['corsa', 'corsa'],
    ['cavaliere', 'cavaliere'],
    ['estate', 'caldo'],
    ['dentista', 'dente'],
    ['supermercato', 'carrello'],
    ['yoga', 'tappetino'],
  ];
  for (const [re, e] of EXTRA_RE) if (ha(re)) extra.push(e);
  return { soggetto: riga[1], variante: riga[2], sfondo, umore, extra, spaghetti: ha('spaghetti|pasta'), sogni: ha('sogni'), mondo: ha('comanda il mondo') };
}

// --- sfondi ------------------------------------------------------------------

function sfondo(f, info, cpu) {
  const tipo = info.sfondo;
  const liv = f.liv;
  const conSole = info.soggetto !== 'sole' && !info.extra.includes('caldo');
  const conLuna = info.soggetto !== 'luna';
  if (liv === 0) {
    // il disegno da bambino: spesso una riga verde per terra e il sole in un angolo
    if (cpu.prob(0.5)) {
      const y = cpu.num(820, 900);
      f.posa(0, 0, 1).linea(morbida([[0, y], [350, y - 15], [700, y + 10], [1000, y - 5]]), C.verde, 18, { imp: 2.5 });
    }
    if (conSole && cpu.prob(0.6)) sole(f.posa(cpu.num(120, 880), cpu.num(110, 170), 70), {}, cpu, true);
    return { suolo: 700, terra: true };
  }
  // il Difficile impaziente non riempie lo sfondo: mette tutta la cura nel soggetto
  const pieno = liv === 2 && cpu.tratti.pazienza > 0.5;
  const cielo = { spazio: C.nero, notte: C.blu, notteCasa: C.blu, fondale: C.celeste, interno: cpu.scegli([C.pelle, C.rosa, C.giallo]) }[tipo] || C.celeste;
  const suolo = tipo === 'spazio' ? null : { mare: C.giallo, deserto: C.giallo, interno: C.marrone, notteCasa: C.marrone, notte: C.verdone, fondale: C.giallo }[tipo] || C.verde;
  const y = { mare: 720, deserto: 620, fondale: 860, interno: 700, notteCasa: 700, spazio: 1000 }[tipo] ?? 680;
  f.posa(0, 0, 1);
  if (pieno) {
    f.forma(rett(0, 0, 1000, y + 20), cielo, { imp: 1.3, bordo: false, grande: true });
    if (tipo === 'mare') f.forma(rett(0, 380, 1000, 360), C.blu, { imp: 1.2, bordo: false, grande: true });
    if (suolo) f.forma(rett(0, y, 1000, 1000 - y), suolo, { imp: 1.3, bordo: false, grande: true });
  } else if (suolo) {
    f.linea(morbida([[0, y + 10], [300, y - 10], [650, y + 12], [1000, y - 5]]), suolo === C.giallo ? C.arancio : suolo, 18, { imp: 1.5 });
    if (tipo === 'mare') f.linea(morbida([[0, 390], [250, 375], [500, 395], [750, 378], [1000, 390]]), C.blu, 18, { imp: 1.2 });
  }
  const destra = cpu.prob(0.5);
  const sx = destra ? 850 : 150;
  if (tipo === 'prato' || tipo === 'mare' || tipo === 'deserto') {
    if (conSole) sole(f.posa(sx, 140, tipo === 'deserto' ? 95 : 75), {}, cpu, true);
    f.posa(0, 0, 1);
    if (tipo !== 'deserto') {
      for (const [x, yy] of [[destra ? 280 : 720, 150], [destra ? 520 : 480, 260]]) {
        for (const [dx, dy, r] of [[-45, 10, 42], [0, -10, 55], [48, 8, 40]]) f.ovale(x + dx, yy + dy, r * 1.2, r, C.bianco, { imp: pieno ? 0.6 : 1, bordo: !pieno });
      }
    }
    if (pieno && tipo === 'prato') {
      for (let i = 0; i < 7; i++) {
        const x = cpu.num(40, 960);
        const yy = cpu.num(y + 40, 980);
        if (x > 250 && x < 750 && yy < 930) continue;
        f.linea([[x - 12, yy], [x - 4, yy - 26], [x + 4, yy], [x + 12, yy - 24]], C.verdone, 8, { imp: 0.35 });
        if (cpu.prob(0.5)) f.punto(x, yy - 30, cpu.scegli([C.rosso, C.giallo, C.rosa, C.bianco]), 18, { imp: 0.3 });
      }
    }
    if (tipo === 'mare' && pieno) {
      for (const yy of [470, 560, 650]) f.linea(morbida([[40, yy], [140, yy - 14], [240, yy], [340, yy - 14]]).map(([a, b]) => [a + cpu.num(0, 600), b]), C.bianco, 8, { imp: 0.4 });
    }
    if (tipo === 'deserto') {
      const x = destra ? 150 : 850;
      f.posa(x, y + 60, 1);
      f.forma(rett(-22, -200, 44, 210), C.verde, { imp: 0.9 });
      f.forma(rett(-80, -140, 30, 80), C.verde, { imp: 0.6 });
      f.forma(rett(-80, -80, 60, 24), C.verde, { imp: 0.6 });
    }
  } else if (tipo === 'spazio' || tipo === 'notte' || tipo === 'notteCasa') {
    f.posa(0, 0, 1);
    if (tipo === 'notteCasa') {
      f.forma(rett(destra ? 700 : 80, 110, 220, 200), C.nero, { imp: 1.1 });
      f.posa(destra ? 810 : 190, 210, 60);
    } else f.posa(sx, 150, 70);
    if (conLuna) f.forma([...arco(0, 0, 1, 1, -Math.PI * 0.6, Math.PI * 0.6, 12), ...arco(-0.45, 0, 0.8, 0.85, Math.PI * 0.55, -Math.PI * 0.55, 12)], C.giallo, { imp: 1.2 });
    f.posa(0, 0, 1);
    const stelle = pieno ? 9 : 4;
    for (let i = 0; i < stelle; i++) {
      const x = cpu.num(40, 960);
      const yy = cpu.num(30, tipo === 'spazio' ? 960 : y - 60);
      if (tipo === 'notteCasa' && !(x > (destra ? 700 : 80) && x < (destra ? 920 : 300) && yy > 110 && yy < 310)) continue;
      if (Math.abs(x - 500) < 260 && yy > 300) continue;
      if (pieno && cpu.prob(0.4)) f.forma(stella(x, yy, 22), C.giallo, { imp: 0.5, bordo: false });
      else f.punto(x, yy, cpu.scegli([C.giallo, C.bianco]), 18, { imp: 0.4 });
    }
    if (tipo === 'spazio' && pieno) {
      const x = destra ? 180 : 820;
      f.ovale(x, 820, 80, 80, C.viola, { imp: 0.7 });
      f.linea(arco(x, 820, 130, 30, Math.PI * 0.05, Math.PI * 0.95, 10), C.arancio, 18, { imp: 0.5 });
    }
  } else if (tipo === 'fondale') {
    f.posa(0, 0, 1);
    for (let i = 0; i < (pieno ? 7 : 3); i++) {
      const x = cpu.num(60, 940);
      const yy = cpu.num(80, 700);
      if (Math.abs(x - 500) < 250) continue;
      f.ovale(x, yy, 18, 18, C.bianco, { imp: 0.4, riempi: false });
    }
    for (const x of [cpu.num(60, 200), cpu.num(800, 940)]) f.linea(morbida([[x, 1000], [x - 25, 900], [x + 20, 820], [x - 15, 740]]), C.verdone, 18, { imp: 0.6 });
  } else if (tipo === 'interno' && pieno) {
    f.posa(0, 0, 1);
    const x = destra ? 740 : 80;
    f.forma(rett(x, 120, 180, 180), C.celeste, { imp: 0.8 });
    f.linea([[x + 90, 120], [x + 90, 300]], C.bianco, 8, { imp: 0.4 });
    f.linea([[x, 210], [x + 180, 210]], C.bianco, 8, { imp: 0.4 });
  }
  return { suolo: tipo === 'spazio' ? 880 : Math.max(y + 110, 820), terra: tipo !== 'spazio' };
}

// Tocchi in più del Difficile se il tempo glielo permette (sono i primi a saltare).
function abbellimenti(f, info, cpu, lato) {
  const x = lato > 0 ? cpu.num(850, 900) : cpu.num(100, 150);
  const imp = 0.45;
  f.posa(0, 0, 1);
  switch (info.sfondo) {
    case 'prato':
      f.forma(rett(x - 18, 560, 36, 150), C.marrone, { imp });
      f.ovale(x, 510, 85, 75, C.verdone, { imp });
      for (const [dx, dy] of [[-30, -10], [25, 15], [5, -40]]) f.punto(x + dx, 510 + dy, C.rosso, 18, { imp: 0.4 });
      f.linea([[x - 40 * lato, 300], [x - 25 * lato, 315], [x - 10 * lato, 300]], C.nero, 8, { imp: 0.35 });
      break;
    case 'mare':
      f.forma([[x - 70, 520], [x + 70, 520], [x + 45, 560], [x - 45, 560]], C.marrone, { imp });
      f.linea([[x, 520], [x, 410]], C.nero, 8, { imp });
      f.forma([[x + 5, 415], [x + 5, 510], [x + 70, 510]], C.bianco, { imp });
      break;
    case 'fondale':
      for (const [dx, y, c] of [[0, 420, C.arancio], [lato * -60, 620, C.giallo]]) {
        f.forma([[x + dx - 40, y], [x + dx - 70, y - 22], [x + dx - 70, y + 22]], c, { imp });
        f.ovale(x + dx, y, 45, 28, c, { imp });
        f.punto(x + dx + 22, y - 6, C.nero, 8, { imp: 0.4 });
      }
      break;
    case 'interno':
    case 'notteCasa':
      if (info.sfondo === 'interno') {
        f.forma(rett(x - 75, 360, 150, 115), C.giallo, { imp });
        f.forma(rett(x - 55, 378, 110, 80), C.celeste, { imp: 0.4 });
        f.forma([[x - 50, 455], [x - 10, 400], [x + 30, 455]], C.verde, { imp: 0.4 });
      } else f.forma(rett(x - 60, 500, 120, 200), C.marrone, { imp });
      break;
    case 'deserto':
      f.forma([[x - 110, 640], [x, 500], [x + 110, 640]], C.arancio, { imp });
      break;
    case 'spazio':
      f.ovale(x, 620, 45, 45, C.rosso, { imp });
      f.linea([[x - 40 * lato, 400], [x + 80 * lato, 340]], C.bianco, 18, { imp: 0.4 });
      f.forma(stella(x + 80 * lato, 335, 22), C.giallo, { imp: 0.4 });
      break;
    default:
      for (let i = 0; i < 3; i++) f.forma(stella(x + cpu.num(-50, 50), cpu.num(80, 500), 20), C.giallo, { imp: 0.4, bordo: false });
  }
}

// --- soggetti (coordinate locali: circa [-1,1], i piedi a y = 1) -----------

function animale(f, info, cpu) {
  const liv = f.liv;
  const a = info.variante;
  const o = {
    gatto: { corpo: cpu.scegli([C.arancio, C.grigio, C.arancio, C.nero]), orecchie: 'punta', coda: 'sottile', baffi: true },
    cane: { corpo: cpu.scegli([C.marrone, C.arancio, C.pelle]), orecchie: 'giu', coda: 'sottile', muso: C.pelle },
    mucca: { corpo: C.bianco, macchie: C.nero, orecchie: 'tonde', corna: C.grigio, coda: 'sottile', muso: C.rosa },
    giraffa: { corpo: C.giallo, macchie: C.marrone, orecchie: 'tonde', antenne: true, collo: 1, coda: 'sottile' },
    unicorno: { corpo: C.bianco, criniera: true, corno: true, orecchie: 'punta', coda: 'criniera', collo: 0.35 },
    dino: { corpo: cpu.scegli([C.verde, C.verdone, C.arancio]), creste: C.giallo, coda: 'grossa', grossa: true, collo: 0.3, denti: true },
    drago: { corpo: cpu.scegli([C.verde, C.rosso, C.viola]), creste: C.giallo, ali: true, coda: 'grossa', collo: 0.45, corna: C.giallo },
    criceto: { corpo: C.arancio, pancia: C.pelle, orecchie: 'tonde', corte: true, tondo: true },
  }[a] || { corpo: cpu.scegli(VIVACI), orecchie: 'tonde', coda: 'sottile' };
  const col = o.corpo;
  const collo = o.collo || 0;
  const hr = o.grossa ? 0.34 : o.tondo ? 0.34 : 0.27;
  const hx = o.tondo ? 0.42 : 0.55 + 0.1 * collo;
  const hy = o.tondo ? -0.2 : -0.12 - 0.75 * collo;
  const scuro = col === C.nero ? C.grigio : C.nero;
  if (o.coda === 'sottile') f.linea([[-0.62, 0.1], [-0.88, -0.08], [-0.92, -0.38]], col === C.bianco ? C.grigio : col, 18, { imp: 1.5, morbida: true });
  if (o.coda === 'criniera') f.linea([[-0.62, 0.05], [-0.9, 0.05], [-0.95, 0.4]], C.rosa, 40, { imp: 1.5, morbida: true });
  if (o.coda === 'grossa') f.forma([[-0.5, -0.05], [-1.02, 0.5], [-0.5, 0.38]], col, { imp: 2 });
  if (o.ali) f.forma([[-0.25, -0.1], [-0.6, -0.85], [-0.3, -0.62], [-0.1, -0.9], [0.1, -0.15]], C.viola === col ? C.verde : C.viola, { imp: 1.6 });
  const zampe = o.tondo ? [-0.35, 0.2] : [-0.5, -0.27, 0.13, 0.35];
  const zy = o.corte || o.tondo ? 0.55 : 0.3;
  for (const x of zampe) {
    f.forma(rett(x - 0.08, zy, 0.16, 0.98 - zy), col, { imp: 2 });
    if (!o.tondo && (a === 'mucca' || a === 'giraffa' || a === 'unicorno')) f.forma(rett(x - 0.08, 0.9, 0.16, 0.08), C.nero, { imp: 0.8 });
  }
  if (o.tondo) f.ovale(-0.05, 0.25, 0.62, 0.5, col, { imp: 3 });
  else f.ovale(-0.08, 0.15, 0.62, 0.34, col, { imp: 3 });
  if (o.pancia) f.ovale(0.05, 0.38, 0.38, 0.28, o.pancia, { imp: 1, bordo: false });
  if (o.macchie) {
    for (const [mx, my, mr] of [[-0.4, 0.05, 0.12], [-0.05, 0.25, 0.1], [0.2, 0.02, 0.09], [-0.25, 0.3, 0.07]]) f.ovale(mx + cpu.num(-0.04, 0.04), my + cpu.num(-0.04, 0.04), mr, mr * 0.8, o.macchie, { imp: 1, bordo: false });
  }
  if (o.creste) {
    for (let i = 0; i < 5; i++) {
      const x = -0.5 + i * 0.2;
      const y = -0.16 - Math.sin((i / 4) * Math.PI) * 0.03;
      f.forma([[x - 0.08, y + 0.04], [x, y - 0.15], [x + 0.08, y + 0.04]], o.creste, { imp: 1.2 });
    }
  }
  if (collo) f.forma([[0.25, -0.05], [hx - 0.15, hy + 0.05], [hx + 0.12, hy + 0.1], [0.5, 0.15]], col, { imp: 2.5 });
  if (o.macchie && collo) f.ovale(hx - 0.05, (hy + 0.1) / 2, 0.06, 0.05, o.macchie, { imp: 0.8, bordo: false });
  if (o.criniera) for (const [k, c] of [[0, C.rosa], [1, C.viola], [2, C.celeste]]) f.linea([[hx - 0.1 - k * 0.05, hy - hr * 0.9], [hx - 0.3 - k * 0.07, hy], [0.25 - k * 0.05, 0.0]], c, 18, { imp: 1.3, morbida: true });
  // orecchie dietro la testa
  if (o.orecchie === 'punta') {
    for (const sx of [-1, 1]) f.forma([[hx + sx * hr * 0.75, hy - hr * 0.35], [hx + sx * hr * 0.6, hy - hr * 1.4], [hx + sx * hr * 0.05, hy - hr * 0.85]], col, { imp: 2 });
  } else if (o.orecchie === 'tonde') {
    for (const sx of [-1, 1]) f.ovale(hx + sx * hr * 0.7, hy - hr * 0.75, hr * 0.32, hr * 0.3, col, { imp: 1.8 });
  }
  if (o.antenne) {
    for (const sx of [-1, 1]) {
      f.linea([[hx + sx * hr * 0.3, hy - hr * 0.8], [hx + sx * hr * 0.4, hy - hr * 1.45]], C.marrone, 18, { imp: 1.5 });
      f.punto(hx + sx * hr * 0.4, hy - hr * 1.5, C.marrone, 40, { imp: 1.2 });
    }
  }
  if (o.corna) for (const sx of [-1, 1]) f.forma([[hx + sx * hr * 0.3, hy - hr * 0.75], [hx + sx * hr * 0.75, hy - hr * 1.3], [hx + sx * hr * 0.6, hy - hr * 0.7]], o.corna, { imp: 1.5 });
  f.ovale(hx, hy, hr, hr * 0.9, col, { imp: 3 });
  if (o.orecchie === 'giu') for (const sx of [-1, 1]) f.ovale(hx + sx * hr * 0.9, hy + hr * 0.05, hr * 0.25, hr * 0.5, C.marrone === col ? C.nero : C.marrone, { imp: 1.8 });
  if (o.corno) f.forma([[hx - hr * 0.15, hy - hr * 0.8], [hx + hr * 0.1, hy - hr * 1.9], [hx + hr * 0.3, hy - hr * 0.75]], C.giallo, { imp: 2.2 });
  if (o.muso) {
    f.ovale(hx + hr * 0.1, hy + hr * 0.45, hr * 0.5, hr * 0.33, o.muso, { imp: 1.5 });
    f.punto(hx - hr * 0.08, hy + hr * 0.42, scuro, 8, { imp: 0.8 });
    f.punto(hx + hr * 0.28, hy + hr * 0.42, scuro, 8, { imp: 0.8 });
  }
  faccia(f, hx + hr * 0.1, hy - hr * 0.05, hr * 0.8, info.umore);
  if (o.baffi) for (const sx of [-1, 1]) for (const dy of [-0.05, 0.08]) f.linea([[hx + hr * 0.1 + sx * hr * 0.35, hy + hr * 0.3], [hx + hr * 0.1 + sx * hr * 1.05, hy + hr * (0.25 + dy * 2)]], scuro, 8, { imp: 0.7 });
  if (o.denti) for (const k of [0, 1]) f.forma([[hx + hr * (k * 0.3 - 0.1), hy + hr * 0.62], [hx + hr * (k * 0.3 + 0.05), hy + hr * 0.85], [hx + hr * (k * 0.3 + 0.2), hy + hr * 0.62]], C.bianco, { imp: 0.8 });
  return { testa: f.mondo(hx, hy), rTesta: f.scala(hr), dorso: f.mondo(-0.1, -0.2), mano: f.mondo(0.4, 0.5), piedi: f.mondo(0, 1), alto: f.mondo(0, -1)[1] };
}

function persona(f, info, cpu) {
  const r = info.variante || 'persona';
  const pelle = cpu.prob(0.75) ? C.pelle : C.marrone;
  let maglia = cpu.scegli(VIVACI);
  let pantaloni = cpu.scegli([C.blu, C.nero, C.marrone, C.grigio, C.verdone]);
  let capelli = cpu.scegli([C.nero, C.marrone, C.giallo, C.arancio]);
  if (r === 'ninja') maglia = pantaloni = C.nero;
  if (r === 'nonno') capelli = C.grigio;
  if (r === 'pirata') maglia = C.rosso;
  if (r === 'cavaliere') maglia = pantaloni = C.grigio;
  const su = r === 'eroe' || info.umore === 'buffo';
  const hy = r === 'bimbo' ? -0.5 : -0.55;
  const hr = r === 'bimbo' ? 0.3 : 0.26;
  if (r === 'eroe') f.forma([[-0.26, -0.28], [0.26, -0.28], [0.55, 0.8], [-0.55, 0.8]], C.rosso, { imp: 1.8 });
  if (r === 'sirena') {
    f.forma([[-0.33, 0.25], [0.33, 0.25], [0.12, 0.8], [0.4, 1], [-0.4, 1], [-0.12, 0.8]], cpu.scegli([C.verde, C.celeste, C.viola]), { imp: 2.5 });
  } else {
    for (const sx of [-1, 1]) {
      f.linea([[sx * 0.15, 0.3], [sx * 0.2, 0.9]], pantaloni, 40, { imp: 2 });
      f.ovale(sx * 0.24, 0.94, 0.13, 0.06, r === 'eroe' ? C.rosso : C.nero, { imp: 1 });
    }
  }
  f.forma([[-0.28, -0.28], [0.28, -0.28], [0.34, 0.38], [-0.34, 0.38]], maglia, { imp: 3 });
  if (r === 'pirata') for (const yy of [-0.1, 0.1, 0.28]) f.linea([[-0.3, yy], [0.3, yy]], C.bianco, 18, { imp: 1 });
  if (r === 'eroe') f.forma(stella(0, 0, 0.14), C.giallo, { imp: 1.5 });
  if (r === 'nonno') f.linea(arco(0, -0.25, 0.2, 0.3, Math.PI * 0.1, Math.PI * 0.9, 8), C.giallo, 18, { imp: 1.5 });
  if (r === 'bimbo') f.forma([[-0.1, -0.3], [0.1, -0.2], [0.1, -0.3], [-0.1, -0.2]], C.rosso, { imp: 1.2 });
  const mani = [];
  for (const sx of [-1, 1]) {
    const m = su ? [sx * 0.6, -0.72] : [sx * 0.55, 0.2];
    f.linea([[sx * 0.27, -0.22], m], maglia, 40, { imp: 2 });
    f.ovale(m[0], m[1], 0.07, 0.07, pelle, { imp: 1 });
    mani.push(m);
  }
  if (r === 'sirena') for (const sx of [-1, 1]) f.ovale(sx * 0.12, -0.15, 0.1, 0.08, C.rosa, { imp: 1 });
  // i capelli lunghi della sirena vanno dietro la testa
  if (r === 'sirena') f.forma([[-hr * 1.15, hy], [-hr * 0.9, hy - hr * 1.05], [hr * 0.9, hy - hr * 1.05], [hr * 1.15, hy], [hr * 1.05, 0.12], [-hr * 1.05, 0.12]], capelli, { imp: 1.8 });
  f.ovale(0, hy, hr, hr, r === 'ninja' ? C.nero : pelle, { imp: 3 });
  if (r === 'ninja') f.forma(rett(-hr * 0.85, hy - hr * 0.35, hr * 1.7, hr * 0.45), pelle, { imp: 2.5 });
  else if (r !== 'cavaliere') f.forma([...arco(0, hy, hr * 1.05, hr * 1.05, Math.PI, TAU, 8), [hr * 0.6, hy - hr * 0.5], [-hr * 0.6, hy - hr * 0.5]], capelli, { imp: 1.6 });
  faccia(f, 0, hy + hr * 0.1, hr * 0.85, info.umore);
  if (r === 'eroe' || r === 'bimbo') {
    const col = r === 'eroe' ? C.rosso : C.nero;
    for (const sx of [-1, 1]) f.ovale(sx * hr * 0.33, hy - hr * 0.03, hr * 0.26, hr * 0.22, col, { imp: 1.5, riempi: r === 'eroe' });
  }
  if (r === 'pirata') {
    f.forma([[-hr * 1.4, hy - hr * 0.7], [0, hy - hr * 1.9], [hr * 1.4, hy - hr * 0.7]], C.nero, { imp: 2 });
    f.punto(0, hy - hr * 1.15, C.bianco, 18, { imp: 1 });
    f.ovale(hr * 0.33, hy - hr * 0.05, hr * 0.2, hr * 0.18, C.nero, { imp: 1.5 });
  }
  if (r === 'nonno') {
    f.forma([[-hr * 0.8, hy + hr * 0.3], [hr * 0.8, hy + hr * 0.3], [0, hy + hr * 1.3]], C.bianco, { imp: 1.4 });
    f.forma([[-hr * 1.1, hy - hr * 0.5], [hr * 1.1, hy - hr * 0.5], [hr * 0.9, hy - hr * 1.1], [-hr * 0.9, hy - hr * 1.1]], C.rosso, { imp: 1.6 });
  }
  if (r === 'cavaliere') f.forma([...arco(0, hy, hr * 1.1, hr * 1.1, Math.PI, TAU, 8), [hr * 1.1, hy + hr * 0.2], [-hr * 1.1, hy + hr * 0.2]], C.grigio, { imp: 2 });
  if (info.umore === 'buffo' && r === 'ninja') for (const k of [0, 1, 2]) f.forma(stella(-hr + k * hr, hy - hr * 1.5, 0.07), C.giallo, { imp: 0.8 });
  return { testa: f.mondo(0, hy), rTesta: f.scala(hr), mano: f.mondo(...mani[1]), dorso: f.mondo(0, -0.3), piedi: f.mondo(0, 1), alto: f.mondo(0, hy - hr)[1] };
}

function eretto(f, info, cpu) {
  const s = info.soggetto;
  const u = info.umore;
  let testa = [0, -0.5];
  let hr = 0.3;
  if (s === 'pinguino') {
    for (const sx of [-1, 1]) f.ovale(sx * 0.2, 0.95, 0.16, 0.06, C.arancio, { imp: 1.5 });
    f.ovale(0, 0.15, 0.5, 0.8, C.nero, { imp: 3 });
    f.ovale(0, 0.3, 0.34, 0.55, C.bianco, { imp: 2 });
    for (const sx of [-1, 1]) f.forma([[sx * 0.45, -0.1], [sx * 0.72, 0.35], [sx * 0.42, 0.3]], C.nero, { imp: 2 });
    testa = [0, -0.4];
    hr = 0.35;
    faccia(f, 0, -0.35, 0.3, u);
    f.forma([[-0.1, -0.25], [0.1, -0.25], [0, -0.12]], C.arancio, { imp: 2 });
  } else if (s === 'robot') {
    for (const sx of [-1, 1]) f.linea([[sx * 0.2, 0.35], [sx * 0.22, 0.95]], C.grigio, 40, { imp: 2 });
    f.forma(rett(-0.4, -0.3, 0.8, 0.7), C.grigio, { imp: 3 });
    f.forma(rett(-0.2, -0.15, 0.4, 0.25), C.celeste, { imp: 1.2 });
    for (const k of [0, 1, 2]) f.punto(-0.15 + k * 0.15, 0.25, [C.rosso, C.giallo, C.verde][k], 18, { imp: 0.8 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.4, -0.2], [sx * 0.7, 0.2]], C.grigio, 40, { imp: 2 });
    f.linea([[0, -0.85], [0, -1.02]], C.nero, 8, { imp: 1.5 });
    f.punto(0, -1.02, C.rosso, 40, { imp: 1.5 });
    f.forma(rett(-0.32, -0.85, 0.64, 0.5), C.grigio, { imp: 3 });
    testa = [0, -0.6];
    hr = 0.32;
    faccia(f, 0, -0.58, 0.28, u);
  } else if (s === 'alieno') {
    for (const sx of [-1, 1]) f.linea([[sx * 0.15, 0.4], [sx * 0.25, 0.95]], C.verde, 18, { imp: 2 });
    f.ovale(0, 0.2, 0.28, 0.35, C.verde, { imp: 3 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.22, 0.05], [sx * 0.55, 0.3]], C.verde, 18, { imp: 2 });
    for (const sx of [-1, 1]) {
      f.linea([[sx * 0.15, -0.8], [sx * 0.3, -1.05]], C.verde, 8, { imp: 1.5 });
      f.punto(sx * 0.3, -1.05, C.rosa, 40, { imp: 1.4 });
    }
    f.ovale(0, -0.45, 0.45, 0.38, C.verde, { imp: 3 });
    for (const sx of [-1, 1]) f.ovale(sx * 0.18, -0.5, 0.13, 0.17, C.nero, { imp: 2.5 });
    f.linea(arco(0, -0.3, 0.15, 0.08, Math.PI * 0.15, Math.PI * 0.85, 6), C.nero, 8, { imp: 2 });
    testa = [0, -0.45];
    hr = 0.4;
  } else if (s === 'orso') {
    const pig = C.celeste;
    for (const sx of [-1, 1]) f.ovale(sx * 0.22, 0.85, 0.15, 0.15, C.marrone, { imp: 2 });
    f.ovale(0, 0.3, 0.45, 0.55, pig, { imp: 3 });
    for (const yy of [0, 0.25, 0.5]) f.linea([[-0.4, yy], [0.4, yy]], C.bianco, 18, { imp: 1 });
    for (const sx of [-1, 1]) f.ovale(sx * 0.48, 0.15, 0.13, 0.25, pig, { imp: 2 });
    for (const sx of [-1, 1]) f.ovale(sx * 0.27, -0.72, 0.1, 0.1, C.marrone, { imp: 2 });
    f.ovale(0, -0.45, 0.36, 0.33, C.marrone, { imp: 3 });
    f.ovale(0, -0.32, 0.15, 0.1, C.pelle, { imp: 1.5 });
    faccia(f, 0, -0.5, 0.28, u);
    f.linea([[-0.3, -0.8], [0.05, -0.95], [0.4, -0.7]], C.blu, 40, { imp: 1, morbida: true });
    testa = [0, -0.45];
    hr = 0.35;
  } else if (s === 'scheletro') {
    // ossa bianche col bordo scuro: si vedono sia sul foglio bianco sia sulla notte
    const osso = (pts, w, imp) => {
      f.linea(pts, C.nero, w === 8 ? 18 : 40, { imp: imp - 0.01 });
      f.linea(pts, C.bianco, w, { imp });
    };
    osso([[0, -0.2], [0, 0.35]], 18, 2.5);
    for (const yy of [-0.1, 0.02, 0.14]) osso(arco(0, yy, 0.22, 0.08, Math.PI * 0.05, Math.PI * 0.95, 6), 8, 1.5);
    for (const [a, c] of [[[0, -0.15], [-0.45, -0.55]], [[0, -0.15], [0.5, 0.1]], [[0, 0.35], [-0.35, 0.95]], [[0, 0.35], [0.3, 0.7]], [[0.3, 0.7], [0.55, 0.95]]]) {
      osso([a, c], 18, 2);
      f.punto(c[0], c[1], C.nero, 40, { imp: 0.99 });
      f.punto(c[0], c[1], C.bianco, 18, { imp: 1 });
    }
    f.ovale(0, -0.48, 0.28, 0.26, C.bianco, { imp: 3 });
    for (const sx of [-1, 1]) f.ovale(sx * 0.1, -0.5, 0.07, 0.08, C.nero, { imp: 2.5 });
    f.linea([[-0.1, -0.33], [0.1, -0.33]], C.nero, 8, { imp: 1.5 });
    testa = [0, -0.48];
    hr = 0.28;
  } else if (s === 'pupazzo') {
    f.ovale(0, 0.6, 0.42, 0.4, C.bianco, { imp: 3 });
    f.ovale(0, 0.0, 0.32, 0.3, C.bianco, { imp: 3 });
    for (const yy of [-0.1, 0.1, 0.5]) f.punto(0, yy, C.nero, 18, { imp: 1 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.3, 0], [sx * 0.7, -0.25], [sx * 0.8, -0.4]], C.marrone, 8, { imp: 1.5 });
    f.ovale(0, -0.5, 0.25, 0.23, C.bianco, { imp: 3 });
    faccia(f, 0, -0.52, 0.2, info.extra.includes('caldo') ? 'triste' : u);
    f.forma([[0, -0.47], [0.3, -0.43], [0, -0.4]], C.arancio, { imp: 2 });
    f.forma(rett(-0.18, -0.95, 0.36, 0.25), C.nero, { imp: 1.8 });
    f.forma(rett(-0.28, -0.72, 0.56, 0.05), C.nero, { imp: 1.8 });
    testa = [0, -0.5];
    hr = 0.25;
  } else if (s === 'fantasma') {
    const pts = [...arco(0, -0.3, 0.55, 0.6, Math.PI, TAU, 10)];
    for (let i = 0; i <= 6; i++) pts.push([0.55 - (i * 1.1) / 6, 0.85 + (i % 2 ? -0.12 : 0.05)]);
    f.forma(pts, C.bianco, { imp: 3 });
    faccia(f, 0, -0.35, 0.35, u);
    for (const sx of [-1, 1]) f.linea([[sx * 0.52, -0.05], [sx * 0.8, -0.3]], C.bianco, 40, { imp: 1.5 });
    testa = [0, -0.35];
    hr = 0.4;
  }
  return { testa: f.mondo(...testa), rTesta: f.scala(hr), mano: f.mondo(0.6, 0.1), dorso: f.mondo(0, -0.6), piedi: f.mondo(0, 1), alto: f.mondo(0, -1)[1] };
}

function pesce(f, info, cpu) {
  const s = info.soggetto;
  const u = info.umore;
  if (s === 'polpo') {
    const col = cpu.scegli([C.viola, C.rosa, C.rosso]);
    for (let i = 0; i < 6; i++) {
      const x = -0.5 + i * 0.2;
      f.linea([[x * 0.6, 0.1], [x, 0.45], [x * 1.3 + 0.1, 0.7], [x * 1.4, 0.95]], col, 40, { imp: 2, morbida: true });
    }
    f.ovale(0, -0.3, 0.45, 0.5, col, { imp: 3 });
    faccia(f, 0, -0.25, 0.35, u);
    return { testa: f.mondo(0, -0.3), rTesta: f.scala(0.45), mano: f.mondo(0.7, 0.5), piedi: f.mondo(0, 1), alto: f.mondo(0, -0.8)[1] };
  }
  const balena = s === 'balena';
  const col = balena ? C.blu : cpu.scegli([C.arancio, C.giallo, C.rosso, C.viola]);
  if (!balena && info.extra.length === 0 && !/fondo/.test(info.sfondo)) {
    for (const sx of [-0.25, 0.2]) {
      f.linea([[sx, 0.3], [sx - 0.05, 0.85]], C.pelle, 18, { imp: 2 });
      f.ovale(sx + 0.05, 0.9, 0.12, 0.06, C.rosso, { imp: 1.5 });
    }
  }
  f.forma([[-0.55, 0], [-1, -0.4], [-0.9, 0], [-1, 0.4]], col, { imp: 2 });
  if (!balena) f.forma([[-0.15, -0.3], [0.05, -0.62], [0.25, -0.28]], col, { imp: 1.5 });
  f.ovale(0, 0, balena ? 0.7 : 0.62, balena ? 0.42 : 0.38, col, { imp: 3 });
  if (balena) {
    f.forma([[-0.5, 0.2], [0.55, 0.2], [0.4, 0.38], [-0.4, 0.38]], C.celeste, { imp: 1.2 });
    for (const dx of [-0.15, 0, 0.15]) f.linea([[0.1, -0.45], [0.1 + dx * 2, -0.9]], C.celeste, 18, { imp: 1.2 });
  } else {
    for (const [x, y] of [[-0.25, -0.05], [-0.05, 0.1], [-0.3, 0.15], [-0.1, -0.15]]) f.linea(arco(x, y, 0.1, 0.1, -Math.PI / 2, Math.PI / 2, 5), C.nero, 8, { imp: 0.7 });
  }
  faccia(f, 0.32, -0.08, 0.25, u);
  return { testa: f.mondo(0.3, -0.05), rTesta: f.scala(0.3), mano: f.mondo(0.4, 0.3), dorso: f.mondo(0, -0.4), piedi: f.mondo(0, 1), alto: f.mondo(0, -0.6)[1] };
}

function piccolo(f, info, cpu) {
  const s = info.soggetto;
  const u = info.umore;
  if (s === 'lumaca') {
    const col = cpu.scegli([C.verde, C.pelle, C.grigio]);
    f.forma([[-0.75, 0.95], [0.6, 0.95], [0.75, 0.55], [0.55, 0.45], [0.45, 0.75], [-0.75, 0.75]], col, { imp: 2.5 });
    for (const sx of [0.52, 0.68]) {
      f.linea([[sx, 0.55], [sx + 0.05, 0.15]], col, 18, { imp: 1.8 });
      f.punto(sx + 0.05, 0.15, C.nero, 18, { imp: 1.8 });
    }
    f.ovale(-0.15, 0.3, 0.52, 0.5, cpu.scegli([C.arancio, C.marrone, C.rosa]), { imp: 3 });
    const sp = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU * 2.2;
      const rr = 0.42 * (1 - i / 28);
      sp.push([-0.15 + Math.cos(a) * rr, 0.3 + Math.sin(a) * rr]);
    }
    f.linea(sp.reverse(), C.nero, 8, { imp: 1.5 });
    faccia(f, 0.62, 0.72, 0.13, u, 1.8);
    return { testa: f.mondo(0.62, 0.7), rTesta: f.scala(0.15), dorso: f.mondo(-0.15, -0.2), mano: f.mondo(0.7, 0.8), piedi: f.mondo(0, 1), alto: f.mondo(0, -0.2)[1] };
  }
  if (s === 'formica') {
    const col = cpu.scegli([C.nero, C.marrone, C.rosso]);
    for (const x of [-0.35, 0, 0.3]) f.linea([[x, 0.6], [x - 0.15, 0.8], [x - 0.05, 0.98]], col, 8, { imp: 2 });
    f.ovale(-0.45, 0.55, 0.3, 0.22, col, { imp: 3 });
    f.ovale(0, 0.5, 0.18, 0.15, col, { imp: 3 });
    f.ovale(0.3, 0.35, 0.18, 0.17, col, { imp: 3 });
    for (const sx of [-1, 1]) f.linea([[0.15, 0.4], [0.15 + sx * 0.12, -0.1]], col, 18, { imp: 2 });
    for (const sx of [-1, 1]) f.linea([[0.35, 0.2], [0.35 + sx * 0.1, 0]], col, 8, { imp: 1.5 });
    f.forma(rett(-0.55, -0.55, 1.2, 0.3), C.rosso, { imp: 2.5 });
    f.forma([[-0.3, -0.55], [-0.2, -0.8], [0.25, -0.8], [0.4, -0.55]], C.rosso, { imp: 2.2 });
    f.forma(rett(-0.18, -0.75, 0.16, 0.15), C.celeste, { imp: 1 });
    f.forma(rett(0.06, -0.75, 0.2, 0.15), C.celeste, { imp: 1 });
    for (const x of [-0.35, 0.45]) f.ovale(x, -0.25, 0.12, 0.12, C.nero, { imp: 2 });
    faccia(f, 0.33, 0.35, 0.15, 'buffo', 1.8);
    return { testa: f.mondo(0.3, 0.35), rTesta: f.scala(0.18), piedi: f.mondo(0, 1), alto: f.mondo(0, -0.8)[1] };
  }
  if (s === 'banana') {
    f.forma([[-0.2, -0.3], [0.2, -0.3], [0.5, 0.75], [-0.5, 0.75]], C.rosso, { imp: 1.8 });
    const pts = [...arco(0.6, 0, 0.95, 0.95, Math.PI * 0.62, Math.PI * 1.38, 12), ...arco(0.95, 0, 1.05, 1.05, Math.PI * 1.3, Math.PI * 0.7, 12)];
    f.forma(pts, C.giallo, { imp: 3 });
    f.linea([[-0.25, -0.88], [-0.2, -0.98]], C.marrone, 18, { imp: 1.2 });
    f.forma(rett(-0.52, -0.25, 0.5, 0.12), C.nero, { imp: 1.5 });
    faccia(f, -0.2, -0.15, 0.25, u);
    return { testa: f.mondo(-0.2, -0.2), rTesta: f.scala(0.3), piedi: f.mondo(0, 1), alto: f.mondo(0, -1)[1] };
  }
  // mostro (anche il tema che non si sa disegnare diventa un mostriciattolo buffo)
  const col = info.spaghetti ? C.giallo : cpu.scegli([C.viola, C.verde, C.blu, C.arancio]);
  for (const sx of [-1, 1]) f.linea([[sx * 0.25, 0.5], [sx * 0.3, 0.95]], col, 40, { imp: 2 });
  const blob = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    blob.push([Math.cos(a) * (0.6 + (i % 2) * 0.06), 0.05 + Math.sin(a) * (0.62 + (i % 3) * 0.04)]);
  }
  f.forma(blob, col, { imp: 3 });
  if (info.spaghetti) for (let i = 0; i < 4; i++) f.linea([[-0.5, -0.4 + i * 0.25], [-0.2, -0.3 + i * 0.25], [0.1, -0.45 + i * 0.25], [0.45, -0.3 + i * 0.25]], C.arancio, 8, { imp: 1, morbida: true });
  for (const sx of [-1, 1]) f.linea([[sx * 0.55, 0], [sx * 0.9, -0.3]], col, 40, { imp: 2 });
  for (const sx of [-1, 1]) f.forma([[sx * 0.25, -0.5], [sx * 0.35, -0.85], [sx * 0.45, -0.45]], info.spaghetti ? C.marrone : C.bianco, { imp: 1.5 });
  faccia(f, 0, -0.05, 0.45, u);
  if (!info.spaghetti) f.ovale(0, -0.3, 0.1, 0.1, C.bianco, { imp: 1.2 });
  return { testa: f.mondo(0, -0.1), rTesta: f.scala(0.5), mano: f.mondo(0.9, -0.3), piedi: f.mondo(0, 1), alto: f.mondo(0, -0.8)[1] };
}

function sole(f, info, cpu, sfondoSolo = false) {
  const u = info.umore || 'felice';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    f.linea([[Math.cos(a) * 1.2, Math.sin(a) * 1.2], [Math.cos(a) * 1.6, Math.sin(a) * 1.6]], C.arancio, 18, { imp: sfondoSolo ? (f.liv === 0 ? 2.5 : 1.2) : 2 });
  }
  f.ovale(0, 0, 1, 1, C.giallo, { imp: sfondoSolo ? (f.liv === 0 ? 2.5 : 1.9) : 3 });
  if (!sfondoSolo) {
    faccia(f, 0, 0.05, 0.75, u);
    return { testa: f.mondo(0, 0), rTesta: f.scala(1), mano: f.mondo(1.2, 0.8), piedi: f.mondo(0, 1.6), alto: f.mondo(0, -1.6)[1] };
  }
  return null;
}

function oggetto(f, info, cpu) {
  const s = info.soggetto;
  const v = info.variante;
  const u = info.umore;
  let testa = [0, 0];
  let hr = 0.5;
  if (s === 'pizza') {
    f.forma([[-0.75, -0.55], [0.75, -0.55], [0, 0.95]], C.giallo, { imp: 3 });
    f.linea([[-0.78, -0.6], [0, -0.72], [0.78, -0.6]], C.marrone, 40, { imp: 2, morbida: true });
    for (const [x, y] of [[-0.35, -0.3], [0.3, -0.25], [0.05, 0.4]]) f.ovale(x, y, 0.1, 0.1, C.rosso, { imp: 1.5 });
    faccia(f, 0, -0.05, 0.35, u);
    testa = [0, -0.05];
  } else if (s === 'patata') {
    f.forma(ovale(0, 0.1, 0.55, 0.75).map(([x, y], i) => [x * (1 + (i % 3) * 0.04), y]), C.pelle, { imp: 3 });
    for (const [x, y] of [[-0.3, 0.4], [0.25, 0.6], [0.3, -0.4]]) f.punto(x, y, C.marrone, 18, { imp: 1 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.5, 0.1], [sx * 0.8, -0.2]], C.marrone, 18, { imp: 1.8 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.2, 0.8], [sx * 0.25, 0.98]], C.marrone, 18, { imp: 1.8 });
    faccia(f, 0, -0.05, 0.4, u);
    testa = [0, -0.1];
    hr = 0.45;
  } else if (s === 'nuvola') {
    for (const [x, y, r] of [[-0.45, 0.05, 0.35], [0, -0.2, 0.48], [0.45, 0.05, 0.35], [0, 0.2, 0.4]]) f.ovale(x, y, r * 1.1, r, C.grigio, { imp: 3 });
    faccia(f, 0, 0, 0.4, u);
    f.forma([[0.1, 0.45], [-0.1, 0.8], [0.05, 0.8], [-0.1, 1.05], [0.25, 0.7], [0.1, 0.7], [0.25, 0.45]], C.giallo, { imp: 2 });
    for (const x of [-0.5, -0.3, 0.45, 0.6]) f.linea([[x, 0.55], [x - 0.05, 0.75]], C.blu, 8, { imp: 1 });
    testa = [0, 0];
  } else if (s === 'luna') {
    f.forma([...arco(0, 0, 0.9, 0.9, -Math.PI * 0.6, Math.PI * 0.6, 14), ...arco(-0.4, 0, 0.75, 0.8, Math.PI * 0.55, -Math.PI * 0.55, 14)], C.giallo, { imp: 3 });
    faccia(f, 0.55, -0.05, 0.25, u);
    testa = [0.55, 0];
    hr = 0.3;
  } else if (s === 'scatola') {
    const frigo = v === 'frigo';
    const [w, h] = frigo ? [0.8, 1.9] : [1.3, 0.95];
    if (!frigo) {
      f.forma(rett(-0.4, -0.65, 0.3, 0.4), C.pelle, { imp: 1.8 });
      f.forma(rett(0.1, -0.75, 0.3, 0.5), C.pelle, { imp: 1.8 });
    }
    f.forma(rett(-w / 2, 1 - h, w, h), frigo ? C.bianco : C.grigio, { imp: 3 });
    if (frigo) {
      f.linea([[-0.4, 0.05 - 0.4], [0.4, 0.05 - 0.4]], C.nero, 8, { imp: 1.5 });
      f.linea([[0.28, -0.7], [0.28, -0.45]], C.grigio, 18, { imp: 1.2 });
      f.linea([[0.28, -0.2], [0.28, 0.2]], C.grigio, 18, { imp: 1.2 });
    } else {
      f.linea([[-0.45, 1 - h + 0.02], [-0.05, 1 - h + 0.02]], C.nero, 18, { imp: 1.5 });
      f.linea([[0.05, 1 - h + 0.02], [0.45, 1 - h + 0.02]], C.nero, 18, { imp: 1.5 });
      f.linea([[w / 2, 0.4], [w / 2 + 0.12, 0.4]], C.nero, 18, { imp: 1 });
    }
    testa = frigo ? [0, 0.35] : [0, 0.5];
    hr = frigo ? 0.35 : 0.4;
    faccia(f, testa[0], testa[1], hr, u);
  } else if (s === 'torta') {
    f.forma(stella(0, -0.1, 1.05, 9), C.arancio, { imp: 1.5 });
    f.forma(stella(0, -0.1, 0.8, 9), C.giallo, { imp: 1.2 });
    f.forma(rett(-0.65, 0.2, 1.3, 0.75), C.rosa, { imp: 3 });
    f.forma(rett(-0.45, -0.3, 0.9, 0.5), C.marrone, { imp: 3 });
    f.linea([[-0.45, -0.28], [-0.3, -0.18], [-0.15, -0.28], [0, -0.18], [0.15, -0.28], [0.3, -0.18], [0.45, -0.28]], C.bianco, 18, { imp: 1.2 });
    for (const x of [-0.25, 0, 0.25]) {
      f.forma(rett(x - 0.04, -0.55, 0.08, 0.25), C.celeste, { imp: 1.5 });
      f.ovale(x, -0.62, 0.05, 0.08, C.arancio, { imp: 1.2 });
    }
    faccia(f, 0, 0.55, 0.35, 'paura');
    testa = [0, 0.55];
  } else if (s === 'vulcano') {
    f.forma([[-0.95, 1], [-0.25, -0.45], [0.25, -0.45], [0.95, 1]], C.marrone, { imp: 3 });
    f.forma([[-0.25, -0.45], [0.25, -0.45], [0.35, -0.1], [0.1, -0.25], [0, 0], [-0.15, -0.25], [-0.35, -0.1]], C.rosso, { imp: 2.2 });
    for (const [x, y, r] of [[-0.3, -0.75, 0.2], [0.05, -0.85, 0.26], [0.35, -0.72, 0.2]]) f.ovale(x, y, r, r * 0.8, C.grigio, { imp: 1.5 });
    for (const [x, y] of [[-0.6, -0.5], [0.6, -0.45], [-0.45, -0.95], [0.55, -0.95]]) f.punto(x, y, C.arancio, 18, { imp: 1 });
    faccia(f, 0, 0.4, 0.4, u);
    testa = [0, 0.4];
  } else if (s === 'calzino') {
    f.forma([[-0.35, -0.8], [0.15, -0.8], [0.15, 0.4], [0.75, 0.55], [0.75, 0.95], [-0.2, 0.95], [-0.35, 0.6]], cpu.scegli([C.rosso, C.verde, C.viola, C.celeste]), { imp: 3 });
    for (const y of [-0.55, -0.3, -0.05]) f.linea([[-0.35, y], [0.15, y]], C.bianco, 18, { imp: 1 });
    faccia(f, -0.1, 0.35, 0.22, u);
    testa = [-0.1, -0.6];
    hr = 0.25;
  } else if (s === 'pianta') {
    f.forma([[-0.4, 0.45], [0.4, 0.45], [0.3, 0.98], [-0.3, 0.98]], C.arancio, { imp: 2.5 });
    f.linea([[0, 0.45], [-0.1, 0], [0.05, -0.3]], C.verdone, 18, { imp: 2.2, morbida: true });
    for (const sx of [-1, 1]) f.ovale(sx * 0.25, 0.1, 0.22, 0.08, C.verde, { imp: 1.5 });
    f.ovale(0.05, -0.55, 0.5, 0.35, C.verde, { imp: 3 });
    f.forma([[-0.35, -0.55], [0.45, -0.55], [0.3, -0.35], [-0.2, -0.35]], C.rosso, { imp: 2.2 });
    for (let i = 0; i < 4; i++) f.forma([[-0.25 + i * 0.2, -0.55], [-0.18 + i * 0.2, -0.45], [-0.11 + i * 0.2, -0.55]], C.bianco, { imp: 1.2 });
    for (const sx of [-1, 1]) f.punto(0.05 + sx * 0.18, -0.72, C.nero, 18, { imp: 2.2 });
    testa = [0.05, -0.55];
  } else if (s === 'casa') {
    const castello = !!info.spaghetti || /castello/.test(v || '');
    const col = info.spaghetti ? C.giallo : cpu.scegli([C.arancio, C.rosa, C.giallo, C.celeste]);
    if (info.sogni) for (const [k, c] of [[0, C.rosso], [1, C.giallo], [2, C.verde], [3, C.blu]]) f.linea(arco(0, 0.2, 1.25 - k * 0.1, 1.2 - k * 0.1, Math.PI * 1.05, Math.PI * 1.95, 14), c, 40, { imp: 1 });
    if (castello) {
      for (const x of [-0.8, 0.45]) f.forma(rett(x, -0.6, 0.35, 1.6), col, { imp: 2.5 });
      f.forma(rett(-0.5, -0.2, 1, 1.2), col, { imp: 3 });
      for (const x of [-0.8, 0.45]) f.forma([[x - 0.05, -0.6], [x + 0.175, -1], [x + 0.4, -0.6]], C.rosso, { imp: 2 });
      if (info.spaghetti) for (let i = 0; i < 5; i++) f.linea([[-0.5, -0.1 + i * 0.2], [-0.2, 0 + i * 0.2], [0.1, -0.12 + i * 0.2], [0.5, -0.02 + i * 0.2]], C.arancio, 8, { imp: 1, morbida: true });
      f.forma([...arco(0, 0.6, 0.2, 0.25, Math.PI, TAU, 6), [0.2, 1], [-0.2, 1]], C.marrone, { imp: 2 });
    } else {
      f.forma(rett(0.35, -0.75, 0.18, 0.35), C.rosso, { imp: 1.2 });
      f.forma(rett(-0.7, -0.2, 1.4, 1.2), col, { imp: 3 });
      f.forma([[-0.85, -0.2], [0, -0.95], [0.85, -0.2]], C.rosso, { imp: 3 });
      f.forma(rett(-0.15, 0.45, 0.3, 0.55), C.marrone, { imp: 2 });
      for (const x of [-0.55, 0.25]) {
        f.forma(rett(x, 0.05, 0.3, 0.28), C.celeste, { imp: 1.8 });
        f.linea([[x + 0.15, 0.05], [x + 0.15, 0.33]], C.bianco, 8, { imp: 0.6 });
      }
    }
    testa = [0, 0.2];
    hr = 0.6;
  } else if (s === 'astronave') {
    f.ovale(0, -0.25, 0.4, 0.35, C.celeste, { imp: 2.5 });
    f.ovale(0, 0.05, 0.95, 0.3, C.giallo, { imp: 3 });
    for (const [x, y, r] of [[-0.55, 0.05, 0.1], [-0.1, 0.12, 0.08], [0.4, 0.02, 0.12], [0.7, 0.12, 0.06]]) f.ovale(x, y, r, r * 0.8, C.arancio, { imp: 1.2 });
    for (const dx of [-0.3, 0, 0.3]) f.linea([[dx * 0.8, 0.4], [dx * 1.6, 1]], C.giallo, 8, { imp: 0.8 });
    faccia(f, 0, -0.25, 0.25, u);
    testa = [0, -0.25];
    hr = 0.35;
  } else if (s === 'wifi') {
    for (const [k, r] of [[0, 0.95], [1, 0.65], [2, 0.35]]) f.linea(arco(0, 0.1, r, r, Math.PI * 1.25, Math.PI * 1.75, 10), k === 0 ? C.grigio : C.nero, 40, { imp: 2.5 - k * 0.2 });
    f.punto(0, 0.05, C.nero, 40, { imp: 2 });
    f.forma(rett(-0.6, 0.45, 1.2, 0.5), C.nero, { imp: 3 });
    for (const x of [-0.4, 0.4]) f.punto(x, 0.7, C.rosso, 18, { imp: 1.2 });
    f.linea([[-0.9, -0.9], [0.9, 0.2]], C.rosso, 18, { imp: 1.4 });
    testa = [0, 0.7];
    hr = 0.3;
  } else if (s === 'sveglia') {
    for (const sx of [-1, 1]) f.ovale(sx * 0.5, -0.7, 0.22, 0.18, C.giallo, { imp: 2 });
    for (const sx of [-1, 1]) f.linea([[sx * 0.4, 0.55], [sx * 0.55, 0.95]], C.nero, 18, { imp: 1.8 });
    f.ovale(0, 0, 0.75, 0.75, C.rosso, { imp: 3 });
    f.ovale(0, 0, 0.58, 0.58, C.bianco, { imp: 2.5 });
    faccia(f, 0, 0.05, 0.45, u);
    f.linea([[0, 0], [0, -0.45]], C.nero, 8, { imp: 1 });
    testa = [0, 0];
    hr = 0.6;
  } else if (s === 'colazione') {
    f.ovale(-0.1, 0.55, 0.85, 0.35, C.bianco, { imp: 2.5 });
    f.forma(ovale(-0.35, 0.5, 0.35, 0.2).map(([x, y], i) => [x + (i % 2) * 0.04, y]), C.bianco, { imp: 2 });
    f.ovale(-0.35, 0.5, 0.12, 0.1, C.giallo, { imp: 2.2 });
    f.forma(rett(0.05, 0.35, 0.45, 0.35), C.arancio, { imp: 2 });
    f.forma(rett(0.35, -0.5, 0.45, 0.6), C.celeste, { imp: 3 });
    f.linea(arco(0.85, -0.2, 0.15, 0.15, -Math.PI / 2, Math.PI / 2, 6), C.celeste, 18, { imp: 1.5 });
    for (const x of [0.45, 0.6, 0.75]) f.linea([[x, -0.6], [x + 0.05, -0.75], [x - 0.02, -0.9]], C.grigio, 8, { imp: 0.8, morbida: true });
    faccia(f, 0.57, -0.2, 0.2, u);
    testa = [0.57, -0.2];
    hr = 0.25;
  }
  return { testa: f.mondo(...testa), rTesta: f.scala(hr), mano: f.mondo(0.9, 0.3), piedi: f.mondo(0, 1), alto: f.mondo(0, -1)[1] };
}

const COSTRUTTORI = {
  animale,
  persona,
  pesce,
  balena: pesce,
  polpo: pesce,
  lumaca: piccolo,
  formica: piccolo,
  banana: piccolo,
  mostro: piccolo,
  sole,
};
for (const s of ['pinguino', 'robot', 'alieno', 'orso', 'scheletro', 'pupazzo', 'fantasma']) COSTRUTTORI[s] = eretto;
for (const s of ['pizza', 'patata', 'nuvola', 'luna', 'scatola', 'torta', 'vulcano', 'calzino', 'pianta', 'casa', 'astronave', 'wifi', 'sveglia', 'colazione']) COSTRUTTORI[s] = oggetto;

// Oggetti legati al tema, attaccati ai punti del soggetto (testa, mano, piedi).
function extra(f, e, a, info, cpu) {
  const [tx, ty] = a.testa;
  const r = a.rTesta;
  const [mx, my] = a.mano || [tx + r * 2, ty + r * 2];
  const [px, py] = a.piedi;
  f.posa(0, 0, 1);
  switch (e) {
    case 'casco':
      f.forma(ovale(tx, ty, r * 1.55, r * 1.45), C.celeste, { imp: 1.6, riempi: false });
      f.linea(arco(tx, ty, r * 1.3, r * 1.2, Math.PI * 1.15, Math.PI * 1.45, 5), C.bianco, 18, { imp: 0.8 });
      break;
    case 'cuori':
      for (const [dx, dy, k] of [[1.6, -1.4, 0.5], [-1.7, -1, 0.4], [2.2, -0.2, 0.35]]) f.forma(cuore(tx + dx * r, ty + dy * r, r * k), cpu.scegli([C.rosso, C.rosa]), { imp: 1.6 });
      break;
    case 'stelle':
      for (const [dx, dy] of [[-2, -1.5], [2, -1.3], [2.4, 0.6]]) f.forma(stella(tx + dx * r, ty + dy * r, r * 0.35), C.giallo, { imp: 1.3 });
      break;
    case 'occhiali':
      for (const sx of [-1, 1]) f.ovale(tx + sx * r * 0.35, ty - r * 0.12, r * 0.28, r * 0.2, C.nero, { imp: 1.6 });
      f.linea([[tx - r * 0.1, ty - r * 0.15], [tx + r * 0.1, ty - r * 0.15]], C.nero, 8, { imp: 1.2 });
      break;
    case 'corona':
      f.forma([[tx - r * 0.6, ty - r * 0.8], [tx - r * 0.7, ty - r * 1.6], [tx - r * 0.3, ty - r * 1.2], [tx, ty - r * 1.75], [tx + r * 0.3, ty - r * 1.2], [tx + r * 0.7, ty - r * 1.6], [tx + r * 0.6, ty - r * 0.8]], C.giallo, { imp: 2 });
      f.punto(tx, ty - r * 1.1, C.rosso, 18, { imp: 0.8 });
      if (info.mondo) {
        f.ovale(tx - r * 2.8, ty - r * 1.5, r * 0.9, r * 0.9, C.blu, { imp: 1.2 });
        f.ovale(tx - r * 2.9, ty - r * 1.6, r * 0.4, r * 0.3, C.verde, { imp: 0.8, bordo: false });
      }
      break;
    case 'ombrellone': {
      const x = px < 500 ? px + 330 : px - 330;
      f.linea([[x, py], [x + 20, py - 470]], C.marrone, 18, { imp: 1.4 });
      f.forma([...arco(x + 20, py - 430, 190, 150, Math.PI, TAU, 10)], C.rosso, { imp: 1.5 });
      f.linea(arco(x + 20, py - 430, 70, 150, Math.PI * 1.1, Math.PI * 1.9, 6), C.bianco, 18, { imp: 0.7 });
      break;
    }
    case 'manubrio':
      f.linea([[mx - 110, my], [mx + 110, my]], C.grigio, 18, { imp: 1.8 });
      for (const sx of [-1, 1]) f.forma(rett(mx + sx * 110 - 25, my - 60, 50, 120), C.nero, { imp: 1.8 });
      break;
    case 'selfie': {
      const x = px < 500 ? px + 330 : px - 330;
      f.posa(x, py - 170, 170, px < 500 ? -1 : 1);
      persona(f, { ...info, variante: 'persona', umore: 'felice' }, cpu);
      f.posa(0, 0, 1);
      break;
    }
    case 'gelato':
      f.forma([[mx - 40, my - 20], [mx + 40, my - 20], [mx, my + 110]], C.arancio, { imp: 1.8 });
      f.ovale(mx, my - 45, 48, 42, C.rosa, { imp: 1.8 });
      break;
    case 'carota':
      f.forma([[mx - 25, my - 60], [mx + 25, my - 60], [mx, my + 90]], C.arancio, { imp: 1.8 });
      f.linea([[mx, my - 60], [mx - 15, my - 110]], C.verde, 18, { imp: 1.2 });
      f.linea([[mx, my - 60], [mx + 20, my - 105]], C.verde, 18, { imp: 1.2 });
      break;
    case 'palloncini':
      for (const [dx, c] of [[-330, C.rosso], [330, C.giallo], [-260, C.viola]]) {
        const x = clamp(px + dx, 90, 910);
        f.linea([[x, 420], [x + 15, 330]], C.nero, 8, { imp: 0.8 });
        f.ovale(x + 15, 270, 55, 65, c, { imp: 1.3 });
      }
      break;
    case 'tamburi':
      for (const [dx, rr] of [[-0.5, 1], [0.6, 0.8]]) {
        const x = px + dx * 330;
        f.forma(rett(x - 80 * rr, py - 150 * rr, 160 * rr, 150 * rr), C.rosso, { imp: 1.8 });
        f.ovale(x, py - 150 * rr, 80 * rr, 25 * rr, C.bianco, { imp: 1.6 });
      }
      break;
    case 'letto':
      // il letto sopra il mostro, che sbuca da sotto
      f.forma(rett(60, a.alto - 110, 880, 90), C.viola, { imp: 1.8 });
      f.forma(rett(60, a.alto - 20, 40, py - a.alto + 20), C.marrone, { imp: 1.4 });
      f.forma(rett(900, a.alto - 20, 40, py - a.alto + 20), C.marrone, { imp: 1.4 });
      f.ovale(190, a.alto - 135, 90, 40, C.bianco, { imp: 1.3 });
      break;
    case 'vasca':
      f.forma([...arco(500, py - 180, 420, 200, 0, Math.PI, 12)], C.bianco, { imp: 2.2 });
      for (const [dx, dy] of [[-300, -200], [-200, -260], [260, -230], [330, -180]]) f.ovale(500 + dx, py + dy, 30, 30, C.celeste, { imp: 1, riempi: false });
      break;
    case 'corsa':
      for (const y of [-0.2, 0, 0.2]) f.linea([[px - 420, py - 200 + y * 300], [px - 300, py - 200 + y * 300]], C.grigio, 18, { imp: 1.3 });
      f.ovale(a.dorso[0], a.dorso[1] + 150, 55, 55, C.bianco, { imp: 1.5 });
      f.linea([[a.dorso[0], a.dorso[1] + 120], [a.dorso[0], a.dorso[1] + 180]], C.nero, 18, { imp: 1.2 });
      break;
    case 'cavaliere':
      f.posa(a.dorso[0], a.dorso[1] - 20, 120, 1);
      persona(f, { ...info, variante: 'cavaliere', umore: 'felice' }, cpu);
      f.posa(0, 0, 1);
      f.linea([[a.dorso[0] + 60, a.dorso[1] - 40], [a.dorso[0] + 260, a.dorso[1] - 200]], C.grigio, 18, { imp: 1.4 });
      break;
    case 'caldo':
      f.posa(830, 150, 70);
      sole(f, {}, cpu, true);
      f.posa(0, 0, 1);
      f.ovale(px, py + 10, 260, 40, C.celeste, { imp: 1.5 });
      break;
    case 'dente':
      f.posa(tx + (tx < 500 ? 2.4 : -2.4) * r, ty - r, r * 0.8);
      f.forma([[-0.5, -0.6], [0.5, -0.6], [0.45, 0.2], [0.2, 0.7], [0, 0.2], [-0.2, 0.7], [-0.45, 0.2]], C.bianco, { imp: 1.8 });
      f.punto(-0.15, -0.2, C.nero, 8, { imp: 1 }).punto(0.15, -0.2, C.nero, 8, { imp: 1 });
      f.posa(0, 0, 1);
      break;
    case 'carrello':
      f.forma([[mx + 20, my - 60], [mx + 260, my - 60], [mx + 230, my + 90], [mx + 50, my + 90]], C.grigio, { imp: 1.8, riempi: false });
      for (const dx of [70, 210]) f.ovale(mx + dx, my + 120, 22, 22, C.nero, { imp: 1.5 });
      f.ovale(mx + 110, my - 80, 40, 30, C.rosso, { imp: 1 });
      f.ovale(mx + 180, my - 85, 30, 35, C.verde, { imp: 1 });
      break;
    case 'tappetino':
      f.forma(rett(px - 380, py - 25, 760, 50), C.viola, { imp: 1.6 });
      break;
    case 'bici':
      for (const dx of [-230, 230]) f.ovale(px + dx, py - 60, 110, 110, C.nero, { imp: 2, riempi: false });
      f.linea([[px - 230, py - 60], [px, py - 150], [px + 230, py - 60]], C.rosso, 18, { imp: 1.8 });
      break;
    default:
      break;
  }
}

// --- dal foglio ai tratti del dito, secondo il livello -----------------------

function stileDi(cpu) {
  const liv = cpu.livello;
  const t = cpu.tratti;
  const svelto = 0.85 + 0.3 * t.aggressivita;
  return {
    liv,
    tremolio: cpu.per(12, 5, 2.2) * (1.3 - 0.6 * t.costanza),
    velBordo: cpu.per(650, 850, 1050) * svelto,
    velRiempi: cpu.per(1500, 2000, 2600) * svelto,
    penna: liv === 0 ? cpu.scegli([8, 18, 18]) : 8,
    inchiostro: liv === 0 ? (cpu.prob(0.5) ? C.nero : cpu.scegli(VIVACI)) : C.nero,
    mono: liv === 0 && cpu.prob(0.35),
    pastello: cpu.scegli(VIVACI),
  };
}

// Le forme del Facile vengono storte e sproporzionate, come nei disegni di un bimbo.
function storpia(pts, cpu, k) {
  const b = scatola(pts);
  const sx = 1 + cpu.errore(0.12 * k);
  const sy = 1 + cpu.errore(0.12 * k);
  const dx = cpu.errore(12 * k);
  const dy = cpu.errore(12 * k);
  return pts.map(([x, y]) => [b.cx + (x - b.cx) * sx + dx, b.cy + (y - b.cy) * sy + dy]);
}

function traduci(parti, st, cpu) {
  const out = [];
  const impMin = st.liv === 0 ? 1.5 : st.liv === 1 ? 1 : 0;
  // quante forme il Facile colora (a scarabocchio): nessuna, una o due
  let daColorare = st.liv === 0 && cpu.prob(0.65) ? (cpu.prob(0.35) ? 2 : 1) : 0;
  for (const p of parti) {
    if (p.imp < impMin) continue;
    if (st.liv === 0 && p.imp < 3 && cpu.prob(0.18)) continue; // lo scarabocchio dimentica pezzi
    if (st.liv === 1 && p.imp < 1.5 && cpu.prob(0.15)) continue;
    let pts = p.pts;
    if (st.liv < 2 && p.tipo !== 'punto') pts = storpia(pts, cpu, st.liv === 0 ? 1.5 : 0.35);
    const col = st.mono ? st.inchiostro : p.col;
    if (p.tipo === 'forma') {
      const b = scatola(pts);
      let riempi = false;
      if (p.riempi) {
        if (st.liv === 2) riempi = true;
        else if (st.liv === 1) riempi = p.imp >= 1.6 || p.grande;
        else if (daColorare > 0 && p.imp >= 2.5) {
          riempi = true;
          daColorare--;
        }
      }
      if (riempi) {
        const w = st.liv > 0 && (p.grande || Math.min(b.w, b.h) > (st.liv === 2 ? 90 : 160)) ? 40 : 18;
        const passo = w * [1.7, 1.25, 0.7][st.liv];
        const rientro = p.grande ? -0.3 * w : w * [-0.2, 0.3, 0.12][st.liv];
        const righe = righeDentro(pts, passo, rientro);
        const perTratto = w === 40 ? 6 : 8;
        for (let i = 0; i < righe.length; i += perTratto) {
          const path = [];
          righe.slice(i, i + perTratto).forEach(([a, bb, y], k) => (k % 2 ? path.push([bb, y], [a, y]) : path.push([a, y], [bb, y])));
          // lo scarabocchio colora sempre con un pennarello colorato, anche chi fa i contorni neri
          const cf = st.liv === 0 ? (!st.mono ? p.col : st.inchiostro === C.nero ? st.pastello : st.inchiostro) : col;
          out.push({ c: cf, w, pts: path, vel: st.velRiempi, imp: p.imp, riempi: true });
        }
      }
      if (p.bordo || st.liv === 0) {
        const c = st.liv === 0 ? (st.mono || riempi || p.col === C.bianco ? st.inchiostro : p.col) : C.nero;
        const giro = st.liv === 0 ? cpu.num(0.85, 1.08) : st.liv === 1 ? cpu.num(0.97, 1.06) : cpu.num(1, 1.04);
        const k = Math.max(2, Math.round(pts.length * giro));
        const inizio = cpu.intero(0, pts.length - 1);
        const path = [];
        for (let i = 0; i <= k; i++) path.push(pts[(inizio + i) % pts.length]);
        out.push({ c, w: st.penna, pts: path, vel: st.velBordo, imp: p.imp });
      }
    } else if (p.tipo === 'linea') {
      // il Difficile ripassa braccia e gambe grosse col contorno scuro, come nei cartoni
      if (st.liv === 2 && p.w === 40 && col !== C.nero) out.push({ c: C.nero, w: 40, pts, vel: st.velBordo * 1.3, imp: p.imp - 0.01 });
      out.push({ c: col, w: st.liv === 0 ? st.penna : st.liv === 2 && p.w === 40 && col !== C.nero ? 18 : p.w, pts, vel: st.velBordo * (p.w >= 18 ? 1.3 : 1), imp: p.imp });
    } else {
      out.push({ c: col, w: st.liv === 0 && p.w === 40 ? 18 : p.w, pts, vel: 1, imp: p.imp, punto: true });
    }
  }
  return out;
}

// Pausa (secondi) prima di un tratto: alzare il dito, scegliere colore e pennello.
function pausaPrima(s, prima, cpu) {
  let p = cpu.per(0.35, 0.25, 0.18) + cpu.num(0, cpu.per(0.5, 0.35, 0.25));
  if (!prima || prima.c !== s.c) p += cpu.per(0.9, 0.65, 0.45) * cpu.num(0.7, 1.3);
  if (!prima || prima.w !== s.w) p += 0.35 * cpu.num(0.7, 1.3);
  return p;
}
const durataTratto = (s) => (s.punto ? 0.08 : lunghezza(s.pts) / s.vel);

function progetta(tema, cpu) {
  const st = stileDi(cpu);
  const info = leggiTema(tema);
  const f = creaFoglio(st.liv);
  const { suolo, terra } = sfondo(f, info, cpu);
  const verso = cpu.prob(0.5) ? 1 : -1;
  const k = info.soggetto === 'sole' ? 0.5 : 1;
  const R = k * (st.liv === 0 ? cpu.num(170, 300) : cpu.num(250, 300));
  const cx = st.liv === 0 ? cpu.num(320, 680) : 500 + cpu.num(-40, 40);
  const cy = st.liv === 0 || k < 1 ? cpu.num(420, 560) : Math.min(suolo, 980) - R;
  const volante = /sole|luna|nuvola|astronave/.test(info.soggetto);
  if (st.liv === 2 && terra && !volante && /prato|mare|deserto|interno/.test(info.sfondo)) {
    // ombra (o tappeto, in casa) sotto il soggetto: prima del soggetto, così resta sotto
    const tappeto = info.sfondo === 'interno';
    f.posa(0, 0, 1).ovale(cx, cy + R - 5, R * (tappeto ? 1.05 : 0.8), tappeto ? 40 : 26, tappeto ? cpu.scegli([C.viola, C.rosso, C.verde]) : info.sfondo === 'prato' ? C.verdone : C.arancio, { imp: 0.5, bordo: false });
  }
  const costruttore = COSTRUTTORI[info.soggetto] || piccolo;
  const ancore = costruttore(f.posa(cx, cy, R, info.soggetto === 'sole' ? 1 : verso), info, cpu) || { testa: [cx, cy], rTesta: R * 0.4, piedi: [cx, cy + R], alto: cy - R };
  for (const e of info.extra) extra(f, e, ancore, info, cpu);
  if (st.liv === 2) abbellimenti(f, info, cpu, cx > 500 ? -1 : 1);
  let tratti = traduci(f.parti, st, cpu);
  // Budget di tempo: il Facile si stufa presto, il Difficile usa quasi tutti i 75 s.
  const t = cpu.tratti;
  const budget = st.liv === 0 ? cpu.num(25, 45) * (0.8 + 0.4 * t.pazienza) : st.liv === 1 ? cpu.num(44, 62) * (0.9 + 0.2 * t.pazienza) : cpu.num(55, 66);
  const stima = (lista) => lista.reduce((a, s, i) => a + durataTratto(s) + pausaPrima(s, lista[i - 1], cpu) * 0.9, 0);
  let tempo = stima(tratti);
  while (tempo > budget) {
    let peggiore = -1;
    for (let i = tratti.length - 1; i >= 0; i--) if (tratti[i].imp < 3 && (peggiore < 0 || tratti[i].imp < tratti[peggiore].imp)) peggiore = i;
    if (peggiore < 0) break;
    tratti.splice(peggiore, 1);
    tempo = stima(tratti);
  }
  // Se avanza tempo Normale e Difficile disegnano con più calma (il Facile invece si stufa).
  if (st.liv > 0 && tempo < budget * 0.9) {
    const k = Math.max(0.7, tempo / (budget * 0.9));
    for (const s of tratti) s.vel *= k;
  }
  return { tratti, st };
}

export default {
  id: 'galleria',
  nome: "Galleria d'Arte",
  emoji: '🎨',
  colore: '#a855f7',
  descrizione: 'Disegna il tema a sorpresa e conquista i voti degli altri!',
  comeSiGioca: [
    'Sullo schermo esce un tema buffo: disegnalo sul telefono',
    'Hai 75 secondi: colori, pennelli, gomma e annulla',
    'Poi si vota il disegno più bello (non puoi votare il tuo!)',
  ],
  controllo: 'disegno',
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const n = ctx.giocatori.length;
  const tema = pick(TEMI);
  let fase = 'tema';
  let tFase = 0;
  let t = 0;
  let fineFase = 0;
  let finito = false;
  let conteggio = {};
  const voti = {};

  const opere = ctx.giocatori.map((p, i) => {
    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 500;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 500, 500);
    return { id: p.id, p, num: i + 1, c, g, tratti: new Map(), ordine: [], valori: 0, finito: false, bot: null };
  });
  const perId = new Map(opere.map((o) => [o.id, o]));

  function segmento(o, pts, c, w) {
    const k = 0.5;
    const g = o.g;
    g.strokeStyle = c;
    g.fillStyle = c;
    g.lineWidth = Math.max(1, w * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (pts.length === 2) {
      g.beginPath();
      g.arc(pts[0] * k, pts[1] * k, g.lineWidth / 2, 0, TAU);
      g.fill();
      return;
    }
    g.beginPath();
    g.moveTo(pts[0] * k, pts[1] * k);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * k, pts[i + 1] * k);
    g.stroke();
  }

  function ridisegna(o) {
    o.g.fillStyle = '#fff';
    o.g.fillRect(0, 0, 500, 500);
    for (const id of o.ordine) {
      const tr = o.tratti.get(id);
      segmento(o, tr.pts, tr.c, tr.w);
    }
  }

  function evento(o, d) {
    if (d.k === 'p') {
      if (typeof d.id !== 'string' && typeof d.id !== 'number') return;
      if (!COLORI_LAVAGNA.includes(d.c) || !SPESSORI.includes(d.w)) return;
      if (!Array.isArray(d.pts) || d.pts.length < 2 || d.pts.length % 2) return;
      const pts = d.pts.map((x) => clamp(Math.round(Number(x) || 0), 0, 1000));
      if (o.valori + pts.length > MAX_VALORI) return;
      o.valori += pts.length;
      const id = String(d.id);
      let tr = o.tratti.get(id);
      if (!tr) {
        tr = { c: d.c, w: d.w, pts: [] };
        o.tratti.set(id, tr);
        o.ordine.push(id);
        tr.pts = pts;
      } else tr.pts = tr.pts.concat(pts.slice(2));
      segmento(o, pts, tr.c, tr.w);
    } else if (d.k === 'u') {
      const id = o.ordine.pop();
      if (id != null) o.tratti.delete(id);
      ridisegna(o);
    } else if (d.k === 'x') {
      o.tratti.clear();
      o.ordine = [];
      ridisegna(o);
    }
  }

  function miniatura(o) {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 200;
    c.getContext('2d').drawImage(o.c, 0, 0, 200, 200);
    return c.toDataURL('image/jpeg', 0.72);
  }

  function vaiA(f) {
    fase = f;
    tFase = 0;
    if (f === 'tema') {
      ctx.vista('*', { fase, tema });
      sfx.rullo(1.2);
    } else if (f === 'disegno') {
      fineFase = ctx.ora() + T_DISEGNO * 1000;
      ctx.vista('*', { fase, tema, fine: fineFase });
      sfx.via();
    } else if (f === 'voto') {
      fineFase = ctx.ora() + T_VOTO * 1000;
      const mini = opere.map((o) => ({ id: o.id, n: o.num, img: miniatura(o) }));
      for (const o of opere) ctx.vista(o.id, { fase, tema, fine: fineFase, opere: mini.filter((m) => m.id !== o.id) });
      sfx.ding();
    } else if (f === 'esito') {
      conteggio = Object.fromEntries(opere.map((o) => [o.id, 0]));
      for (const v of Object.values(voti)) if (conteggio[v] != null) conteggio[v]++;
      for (const o of opere) ctx.vista(o.id, { fase, tema, voti: conteggio[o.id] });
      sfx.rullo(1.5);
      setTimeout(() => {
        sfx.fanfara();
        fx.coriandoli(100);
      }, 1800);
    }
  }
  vaiA('tema');

  function termina() {
    finito = true;
    ctx.fine({ punteggi: conteggio, alto: true, fmt: (v) => (v === 1 ? '1 voto' : `${v} voti`) });
  }

  // -------------------------------------------------------------------------
  // CPU: disegno tratto dopo tratto (in diretta sullo schermo) e voto "da persona".

  function avviaDisegno(cpu) {
    const { tratti, st } = progetta(tema, cpu);
    // tempo stimato che resta dal tratto i in poi: se si è in ritardo si saltano i dettagli
    const resto = new Float64Array(tratti.length + 1);
    for (let i = tratti.length - 1; i >= 0; i--) resto[i] = resto[i + 1] + durataTratto(tratti[i]) + 0.45;
    return {
      tratti,
      st,
      resto,
      i: 0,
      pausa: cpu.per(cpu.num(2, 5), cpu.num(1.2, 3), cpu.num(0.8, 2)),
      corrente: null,
      prima: null,
      pronto: false,
      annulla: false,
      fatto: false,
      contatore: 0,
      sessione: Math.random().toString(36).slice(2, 6),
      pAnnulla: cpu.per(0.03, 0.05, 0.04),
    };
  }

  // invia(d): gli stessi messaggi del telefono ({k:'p'|'u', ...} e {finito}), passano da input().
  function passoDisegno(o, cpu, dt, invia) {
    const b = o.bot;
    if (b.pausa > 0) {
      b.pausa -= dt;
      return;
    }
    if (b.annulla) {
      // "no, così non mi piace": annulla l'ultimo tratto e lo rifà
      b.annulla = false;
      invia({ k: 'u' });
      b.pausa = cpu.num(0.3, 0.6);
      return;
    }
    if (!b.corrente) {
      const rimasti = (fineFase - ctx.ora()) / 1000;
      while (b.i < b.tratti.length && b.tratti[b.i].imp < 2 && rimasti < b.resto[b.i]) b.i++;
      if (b.i >= b.tratti.length) {
        if (!b.fatto) {
          b.fatto = true;
          b.pausa = cpu.num(0.6, 2);
        } else invia({ finito: true }); // "Ho finito ✔"
        return;
      }
      const s = b.tratti[b.i];
      if (!b.pronto) {
        b.pronto = true;
        b.pausa = pausaPrima(s, b.prima, cpu);
        if (cpu.prob(cpu.per(0.07, 0.03, 0.01))) b.pausa += cpu.num(1, cpu.per(4, 2.5, 1.5)); // distrazione
        return;
      }
      b.pronto = false;
      const passo = clamp(s.vel / 60, 5, 45);
      const amp = s.punto ? 0 : b.st.tremolio * (s.riempi ? 0.6 : 1);
      b.corrente = { s, pts: aMano(s.pts, amp, passo), passo, t: 0, inviati: 0, ultimo: 0, id: `${b.sessione}${++b.contatore}` };
    }
    const k = b.corrente;
    k.t += dt;
    const n = k.pts.length / 2;
    const fatti = k.s.punto ? n : Math.min(n, 1 + Math.floor((k.t * k.s.vel) / k.passo));
    const fine = fatti >= n;
    // come il telefono: un pacchetto di punti nuovi ogni 120 ms, ripetendo l'ultimo già mandato
    if (fatti > k.inviati && (k.t - k.ultimo >= 0.12 || fine)) {
      const da = Math.max(0, k.inviati - 1);
      invia({ k: 'p', id: k.id, c: k.s.c, w: k.s.w, pts: k.pts.slice(da * 2, fatti * 2) });
      k.inviati = fatti;
      k.ultimo = k.t;
    }
    if (!fine) return;
    b.corrente = null;
    b.prima = k.s;
    if (!k.s.riempi && !k.s.punto && !k.s.rifatto && k.s.imp >= 1 && cpu.prob(b.pAnnulla)) {
      k.s.rifatto = true;
      b.annulla = true;
      b.pausa = cpu.num(0.3, 0.7);
    } else b.i++;
  }

  // Quello che l'occhio coglie di un disegno: quanti tratti, quanti colori, quanto
  // foglio è colorato. È uguale per tutti (è lo stesso quadro): ogni bot poi lo
  // guarda col suo gusto e il suo rumore. Non conta chi l'ha fatto.
  function impegno(o) {
    if (o.impegno) return o.impegno;
    const N = 40;
    const cella = 1000 / N;
    const griglia = new Uint8Array(N * N);
    const colori = new Set();
    let bianchi = 0;
    const timbra = (x, y, r) => {
      const c0 = Math.max(0, Math.floor((x - r) / cella));
      const c1 = Math.min(N - 1, Math.floor((x + r) / cella));
      const r0 = Math.max(0, Math.floor((y - r) / cella));
      const r1 = Math.min(N - 1, Math.floor((y + r) / cella));
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          if (((cc + 0.5) * cella - x) ** 2 + ((rr + 0.5) * cella - y) ** 2 <= r * r) griglia[rr * N + cc] = 1;
        }
      }
    };
    for (const id of o.ordine) {
      const t = o.tratti.get(id);
      if (t.c === C.bianco) {
        bianchi++;
        continue;
      }
      colori.add(t.c);
      const r = t.w / 2 + cella / 2;
      const p = t.pts;
      for (let i = 0; i < p.length; i += 2) {
        const x0 = p[i];
        const y0 = p[i + 1];
        const x1 = i + 2 < p.length ? p[i + 2] : x0;
        const y1 = i + 2 < p.length ? p[i + 3] : y0;
        const passi = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20));
        for (let j = 0; j < passi; j++) timbra(x0 + ((x1 - x0) * j) / passi, y0 + ((y1 - y0) * j) / passi, r);
      }
    }
    let piene = 0;
    for (const v of griglia) piene += v;
    const copertura = piene / (N * N);
    // il bianco si vede solo sopra qualcosa di colorato
    const nColori = colori.size + (bianchi && copertura > 0.3 ? 1 : 0);
    o.impegno = { tratti: o.ordine.length, colori: nColori, copertura };
    return o.impegno;
  }

  // Si guarda un quadro per fotogramma (tutti i bot insieme), così la misura non
  // pesa su un solo fotogramma: i bot votano comunque dopo qualche secondo.
  let ultimoSguardo = -1;
  function guardaUnQuadro() {
    if (ultimoSguardo === t) return;
    ultimoSguardo = t;
    const o = opere.find((x) => !x.impegno);
    if (o) impegno(o);
  }

  function sceltaVoto(id, cpu) {
    const altri = opere.filter((x) => x.id !== id);
    if (!altri.length) return null;
    if (cpu.prob(cpu.per(0.12, 0.06, 0.03))) return cpu.scegli(altri).id; // "questo mi fa ridere"
    const { pazienza, aggressivita, prudenza } = cpu.tratti;
    const occhio = cpu.per(0.35, 0.2, 0.12);
    const gusto = cpu.per(1.6, 1, 0.7);
    let meglio = null;
    let max = -Infinity;
    for (const o of altri) {
      const e = impegno(o);
      const v =
        (0.8 + 0.4 * pazienza) * 1.1 * Math.log1p(e.tratti) * (1 + cpu.errore(occhio)) +
        (0.8 + 0.4 * aggressivita) * 0.5 * Math.min(e.colori, 9) * (1 + cpu.errore(occhio)) +
        (0.8 + 0.4 * prudenza) * 3.5 * Math.sqrt(e.copertura) * (1 + cpu.errore(occhio)) +
        cpu.errore(gusto);
      if (v > max) {
        max = v;
        meglio = o;
      }
    }
    return meglio.id;
  }

  return {
    aggiorna(dt) {
      t += dt;
      tFase += dt;
      if (finito) return;
      if (fase === 'tema' && tFase >= T_TEMA) vaiA('disegno');
      else if (fase === 'disegno') {
        const tutti = opere.every((o) => o.finito);
        if ((tutti && tFase > 3) || ctx.ora() >= fineFase) vaiA('voto');
      } else if (fase === 'voto') {
        const tutti = opere.every((o) => voti[o.id] != null);
        if ((tutti && tFase > 1.5) || ctx.ora() >= fineFase) vaiA('esito');
      } else if (fase === 'esito' && tFase >= T_ESITO) termina();
    },

    disegna(g) {
      // parete della galleria
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#3b1d5e');
      grd.addColorStop(1, '#241040');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = 0; x < W; x += 120) g.fillRect(x, 0, 60, H);

      if (fase === 'tema') {
        const k = clamp(tFase / 0.6, 0, 1);
        ctx.testo(g, 'Il tema è…', W / 2, 330, { dim: 70 });
        if (tFase > 1.2) {
          const kk = ease.outBack(clamp((tFase - 1.2) / 0.5, 0, 1));
          g.save();
          g.translate(W / 2, 520);
          g.scale(kk, kk);
          ctx.testo(g, `“${tema}”`, 0, 0, { dim: 110, colore: '#ffd23f', bordo: 14, maxW: W - 120 });
          g.restore();
        }
        ctx.testo(g, '🎨', W / 2, 180 - (1 - k) * 100, { dim: 130, bordo: 0 });
        return;
      }

      const titoloY = 56;
      ctx.testo(g, `🎨 “${tema}”`, W / 2 - 150, titoloY, { dim: 50, colore: '#ffd23f', maxW: 1200 });
      if (fase === 'disegno' || fase === 'voto') {
        const tot = fase === 'disegno' ? T_DISEGNO : T_VOTO;
        ctx.barraTempo(g, (fineFase - ctx.ora()) / 1000, tot, { w: 380, x: W - 520, y: 40 });
      }
      const celle = ctx.griglia(n, 50, 115, W - 100, H - 140, { rapporto: 0.86, spazio: 22 });
      const maxVoti = Math.max(1, ...Object.values(conteggio));
      opere.forEach((o, i) => {
        const c = celle[i];
        const L = Math.min(c.w - 20, c.h - 50);
        const x = c.x + (c.w - L) / 2;
        const y = c.y + 8;
        // cornice dorata
        g.beginPath();
        g.roundRect(x - 10, y - 10, L + 20, L + 20, 8);
        g.fillStyle = '#c8962e';
        g.fill();
        g.strokeStyle = '#7a5410';
        g.lineWidth = 4;
        g.stroke();
        g.drawImage(o.c, x, y, L, L);
        if (fase === 'disegno' && o.finito) ctx.testo(g, '✔', x + L - 16, y + 22, { dim: 36, colore: '#4cd97b' });
        if (fase === 'voto' || fase === 'esito') {
          g.beginPath();
          g.arc(x + 4, y + 4, 26, 0, TAU);
          g.fillStyle = '#1b1030';
          g.fill();
          ctx.testo(g, String(o.num), x + 4, y + 5, { dim: 30, bordo: 0 });
        }
        const mostraNome = fase !== 'voto';
        if (mostraNome) ctx.etichetta(g, o.p.nome, c.x + c.w / 2, y + L + 30, o.p.colore, { dim: 22, maxW: c.w - 10 });
        else ctx.testo(g, `Opera n° ${o.num}`, c.x + c.w / 2, y + L + 30, { dim: 24 });
        if (fase === 'esito' && tFase > 1.8) {
          const v = conteggio[o.id];
          const kk = ease.outBack(clamp((tFase - 1.8 - i * 0.05) / 0.4, 0, 1));
          if (v > 0) {
            g.save();
            g.translate(x + L - 50, y + 36);
            g.scale(kk, kk);
            ctx.testo(g, `⭐${v}`, 0, 0, { dim: 44, colore: '#ffd23f' });
            g.restore();
          }
          if (v === maxVoti && v > 0) ctx.testo(g, '👑', c.x + c.w / 2, y - 6, { dim: 54, bordo: 0 });
        }
      });
      if (fase === 'voto') {
        const fatti = Object.keys(voti).length;
        ctx.testo(g, `Votate dal telefono! (${fatti}/${n})`, W / 2, H - 22, { dim: 30 });
      }
    },

    input(id, d) {
      const o = perId.get(id);
      if (!o || !d) return;
      if (fase === 'disegno') {
        if (d.k) evento(o, d);
        if (typeof d.finito === 'boolean') o.finito = d.finito;
      } else if (fase === 'voto' && d.voto != null && d.voto !== id && perId.has(d.voto)) {
        voti[id] = d.voto;
        sfx.pop();
      }
    },

    bot(id, dt) {
      const o = perId.get(id);
      if (!o || finito) return;
      const cpu = ctx.cpu(id);
      const m = cpu.mem;
      if (fase === 'tema' || fase === 'disegno') {
        if (!o.bot) {
          // legge il tema e pensa a cosa disegnare (e i calcoli dei bot non cadono tutti insieme)
          if (m.leggi == null) m.leggi = cpu.num(1, 3.5);
          m.leggi -= dt;
          if (m.leggi > 0 && fase === 'tema') return;
          o.bot = avviaDisegno(cpu);
        }
        if (fase === 'disegno' && !o.finito) passoDisegno(o, cpu, dt, (d) => this.input(id, d));
      } else if (fase === 'voto') {
        // guarda le miniature, ci pensa, tocca la preferita; a volte cambia idea
        guardaUnQuadro();
        if (m.tVoto == null) {
          m.tVoto = cpu.pensa(3, 11);
          m.ripensa = cpu.livello < 2 && cpu.prob(0.1);
        }
        if (tFase < m.tVoto) return;
        if (voti[id] == null) {
          const v = sceltaVoto(id, cpu);
          if (v) this.input(id, { voto: v });
          if (m.ripensa) m.tVoto = tFase + cpu.num(2, 4);
        } else if (m.ripensa) {
          m.ripensa = false;
          const v = sceltaVoto(id, cpu);
          if (v) this.input(id, { voto: v });
        }
      }
    },
  };
}
