// Avatar: modello (numeri interi), editor-catalogo e disegno su canvas.
// Lo stesso codice disegna l'avatar sullo schermo grande e sul telefono.
// Coordinate interne: altezza totale 100, piedi in (0,0), testa in alto (y negativa).

import { COLORI_GIOCATORE, shade, TAU, clamp } from './util.js';

// Browser un po' vecchi (per esempio iPhone con iOS 15) non hanno roundRect.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    const rr = Math.max(0, Math.min(Array.isArray(r) ? r[0] : r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

export const PELLE = ['#ffe3cc', '#f8cfa6', '#eeb688', '#d99a66', '#c07f4c', '#9c6236', '#7a4726', '#58311a', '#9ee07e', '#9cc8ff'];
export const CAPELLI = ['#1f1a17', '#4a2c1a', '#7b4a26', '#c8903e', '#f3d27a', '#d2552b', '#e8e4dc', '#ff7ab8', '#4aa8ff', '#7a5cff', '#46c46e'];
export const VESTITI = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f8fafc', '#334155', '#92400e'];
export const PANTALONI = ['#1e3a8a', '#3b82f6', '#334155', '#111827', '#92400e', '#d6c29a', '#15803d', '#be123c', '#f8fafc', '#a855f7'];
export const SCARPE = ['#f8fafc', '#111827', '#ef4444', '#3b82f6', '#92400e', '#facc15', '#22c55e', '#ec4899'];

const LINEA = '#2a1d3d';

// Tutte le voci dell'editor, divise in schede.
export const VOCI = [
  { k: 'testa', nome: 'Forma testa', scheda: 'volto', n: 5, nomi: ['Tonda', 'Ovale', 'Squadrata', 'A pera', 'A uovo'] },
  { k: 'pelle', nome: 'Carnagione', scheda: 'volto', colori: PELLE },
  { k: 'occhi', nome: 'Occhi', scheda: 'volto', n: 8 },
  { k: 'sopracciglia', nome: 'Sopracciglia', scheda: 'volto', n: 6 },
  { k: 'bocca', nome: 'Bocca', scheda: 'volto', n: 8 },
  { k: 'capelli', nome: 'Capelli', scheda: 'volto', n: 12 },
  { k: 'coloreCapelli', nome: 'Colore capelli', scheda: 'volto', colori: CAPELLI },
  { k: 'barba', nome: 'Barba e baffi', scheda: 'volto', n: 6 },
  { k: 'occhiali', nome: 'Occhiali', scheda: 'volto', n: 6 },
  { k: 'cappello', nome: 'Cappello', scheda: 'volto', n: 9 },
  { k: 'fisico', nome: 'Corporatura', scheda: 'corpo', n: 3, nomi: ['Magro', 'Normale', 'Robusto'] },
  { k: 'maglia', nome: 'Maglia', scheda: 'corpo', n: 6 },
  { k: 'coloreMaglia', nome: 'Colore maglia', scheda: 'corpo', colori: VESTITI },
  { k: 'pantaloni', nome: 'Pantaloni', scheda: 'corpo', n: 3, nomi: ['Lunghi', 'Corti', 'Gonna'] },
  { k: 'colorePantaloni', nome: 'Colore pantaloni', scheda: 'corpo', colori: PANTALONI },
  { k: 'scarpe', nome: 'Scarpe', scheda: 'corpo', colori: SCARPE },
  { k: 'colore', nome: 'Il tuo colore', scheda: 'colore', colori: COLORI_GIOCATORE.map((c) => c.hex) },
];

const numOpzioni = (v) => (v.colori ? v.colori.length : v.n);

export function normalizza(av = {}) {
  const out = {};
  for (const v of VOCI) {
    const x = av[v.k];
    out[v.k] = Number.isInteger(x) && x >= 0 && x < numOpzioni(v) ? x : 0;
  }
  return out;
}

export function casuale(colore) {
  const r = (n) => Math.floor(Math.random() * n);
  const chance = (p, n) => (Math.random() < p ? 1 + r(n - 1) : 0);
  return {
    testa: r(5),
    pelle: Math.random() < 0.06 ? 8 + r(2) : r(8),
    occhi: r(8),
    sopracciglia: r(6),
    bocca: r(8),
    capelli: Math.random() < 0.08 ? 0 : 1 + r(11),
    coloreCapelli: Math.random() < 0.2 ? 6 + r(5) : r(6),
    barba: chance(0.25, 6),
    occhiali: chance(0.25, 6),
    cappello: chance(0.3, 9),
    fisico: r(3),
    maglia: r(6),
    coloreMaglia: r(VESTITI.length),
    pantaloni: Math.random() < 0.6 ? 0 : 1 + r(2),
    colorePantaloni: r(PANTALONI.length),
    scarpe: r(SCARPE.length),
    colore: colore ?? r(COLORI_GIOCATORE.length),
  };
}

// Un piccolo numero stabile per avatar (per sfasare le animazioni).
function semeDi(av) {
  let h = 7;
  for (const v of VOCI) h = (h * 31 + (av[v.k] || 0)) % 997;
  return h / 97;
}

// ---------------------------------------------------------------------------
// Forme di base

function path(g, fill, stroke = LINEA, lw = 1.8) {
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

function ellisse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

function cerchio(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, Math.max(0.01, r), 0, TAU);
}

function rett(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------------------
// Testa

const TESTE = [
  { hw: 25, top: -25, chin: 25, sx: 1, sy: 1 },
  { hw: 22, top: -27, chin: 27, sx: 0.9, sy: 1.08 },
  { hw: 24, top: -24, chin: 24, sx: 1, sy: 0.98 },
  { hw: 21, top: -25, chin: 26, sx: 0.86, sy: 1 },
  { hw: 24.5, top: -26, chin: 25, sx: 1.02, sy: 1.04 },
];

function formaTesta(g, tipo) {
  g.beginPath();
  switch (tipo) {
    case 1:
      g.ellipse(0, 0, 22, 27, 0, 0, TAU);
      break;
    case 2:
      g.roundRect(-24, -24, 48, 48, 14);
      break;
    case 3:
      g.moveTo(0, -25);
      g.bezierCurveTo(13, -25, 17, -12, 20, 2);
      g.bezierCurveTo(24, 17, 14, 26, 0, 26);
      g.bezierCurveTo(-14, 26, -24, 17, -20, 2);
      g.bezierCurveTo(-17, -12, -13, -25, 0, -25);
      break;
    case 4:
      g.moveTo(0, -26);
      g.bezierCurveTo(16, -26, 25, -14, 24.5, -2);
      g.bezierCurveTo(24, 14, 13, 25, 0, 25);
      g.bezierCurveTo(-13, 25, -24, 14, -24.5, -2);
      g.bezierCurveTo(-25, -14, -16, -26, 0, -26);
      break;
    default:
      g.arc(0, 0, 25, 0, TAU);
  }
}

// Capelli: parte dietro (prima della testa) e davanti (dopo il viso).
// Coordinate relative al centro della testa, raggio ~25.
function capelliDietro(g, stile, col) {
  const dark = shade(col, -0.25);
  switch (stile) {
    case 4: // lunghi
      rett(g, -29, -18, 58, 46, 14);
      path(g, col, dark);
      break;
    case 5: // codino
      g.save();
      g.translate(22, 4);
      g.rotate(-0.5);
      ellisse(g, 8, 10, 8, 17);
      path(g, col, dark);
      g.restore();
      break;
    case 7: {
      // afro: una nuvola di riccioli (prima il bordo scuro, poi il colore)
      const bolle = [[0, -6, 27]];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        bolle.push([Math.cos(a) * 28, -6 + Math.sin(a) * 26, 11]);
      }
      for (const [pass, c, extra] of [
        [0, dark, 1.8],
        [1, col, 0],
      ]) {
        g.beginPath();
        for (const [x, y, r] of bolle) {
          g.moveTo(x + r + extra, y);
          g.arc(x, y, r + extra, 0, TAU);
        }
        g.fillStyle = c;
        g.fill();
        if (pass === 1) break;
      }
      break;
    }
    case 8: // caschetto
      g.beginPath();
      g.moveTo(-29, 16);
      g.bezierCurveTo(-34, -20, -20, -32, 0, -32);
      g.bezierCurveTo(20, -32, 34, -20, 29, 16);
      g.quadraticCurveTo(24, 20, 18, 16);
      g.lineTo(-18, 16);
      g.quadraticCurveTo(-24, 20, -29, 16);
      g.closePath();
      path(g, col, dark);
      break;
    case 9: // codini
      for (const s of [-1, 1]) {
        cerchio(g, s * 31, 2, 10);
        path(g, col, dark);
        rett(g, s * 25 - 3, -2, 6, 8, 2);
        path(g, '#ff5d8f', null);
      }
      break;
    case 10: // chignon
      cerchio(g, 0, -31, 11);
      path(g, col, dark);
      break;
  }
}

function calotta(g, col, dark, bordo = -6) {
  g.beginPath();
  g.arc(0, 0, 27, Math.PI * 1.03, Math.PI * 1.97);
  g.lineTo(24, bordo + 4);
  g.quadraticCurveTo(12, bordo - 2, 2, bordo + 1);
  g.quadraticCurveTo(-10, bordo - 4, -24, bordo + 4);
  g.closePath();
  path(g, col, dark);
}

function capelliDavanti(g, stile, col) {
  const dark = shade(col, -0.25);
  g.lineJoin = 'round';
  switch (stile) {
    case 1: // corti
      calotta(g, col, dark, -8);
      break;
    case 2: {
      // spettinati
      g.beginPath();
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * (1.02 + (0.96 * i) / n);
        const r = i % 2 ? 34 : 25;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineTo(22, -4);
      g.lineTo(12, -10);
      g.lineTo(4, -4);
      g.lineTo(-6, -11);
      g.lineTo(-14, -4);
      g.lineTo(-24, -6);
      g.closePath();
      path(g, col, dark);
      break;
    }
    case 3: // ciuffo
      calotta(g, col, dark, -10);
      g.beginPath();
      g.moveTo(-18, -16);
      g.bezierCurveTo(-24, -40, 10, -46, 22, -30);
      g.bezierCurveTo(12, -34, 2, -30, -2, -18);
      g.closePath();
      path(g, col, dark);
      break;
    case 4: // lunghi
      g.beginPath();
      g.arc(0, 0, 27, Math.PI * 1.03, Math.PI * 1.97);
      g.lineTo(26, 8);
      g.quadraticCurveTo(18, -12, 2, -14);
      g.quadraticCurveTo(-18, -12, -26, 8);
      g.closePath();
      path(g, col, dark);
      break;
    case 5: // codino
      calotta(g, col, dark, -9);
      rett(g, 23, -8, 6, 8, 2);
      path(g, '#ff5d8f', null);
      break;
    case 6: // cresta
      g.beginPath();
      g.moveTo(-7, -22);
      g.lineTo(-9, -34);
      g.lineTo(-4, -30);
      g.lineTo(-3, -44);
      g.lineTo(1, -35);
      g.lineTo(5, -46);
      g.lineTo(6, -33);
      g.lineTo(10, -38);
      g.lineTo(8, -22);
      g.closePath();
      path(g, col, dark);
      break;
    case 7: // afro (frangetta a riccioli)
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.1 + (0.8 * i) / 6);
        cerchio(g, Math.cos(a) * 22, Math.sin(a) * 22 - 2, 7);
        path(g, col, null);
      }
      break;
    case 8: // caschetto: frangia dritta
      g.beginPath();
      g.arc(0, 0, 27, Math.PI * 1.05, Math.PI * 1.95);
      g.lineTo(24, -6);
      g.lineTo(-24, -6);
      g.closePath();
      path(g, col, dark);
      break;
    case 9: // codini
      calotta(g, col, dark, -8);
      break;
    case 10: // chignon
      calotta(g, col, dark, -10);
      break;
    case 11: // ricci
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.0 + i / 8);
        cerchio(g, Math.cos(a) * 25, Math.sin(a) * 24 - 1, 8);
        path(g, col, dark, 1.2);
      }
      for (let i = 0; i < 5; i++) {
        cerchio(g, -16 + i * 8, -18 + (i % 2) * 3, 6.5);
        path(g, col, null);
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Viso

function occhi(g, tipo, pelle, look, chiusi, espr, colIride) {
  const [lx, ly] = look;
  const ex = 9;
  const ey = -1;
  g.lineCap = 'round';
  if (espr === 'stordito') {
    g.strokeStyle = LINEA;
    g.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * ex - 3.5, ey - 3.5);
      g.lineTo(s * ex + 3.5, ey + 3.5);
      g.moveTo(s * ex + 3.5, ey - 3.5);
      g.lineTo(s * ex - 3.5, ey + 3.5);
      g.stroke();
    }
    return;
  }
  if (chiusi || espr === 'felice' || (tipo === 2 && espr !== 'sorpreso')) {
    g.strokeStyle = LINEA;
    g.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      g.beginPath();
      if (chiusi && espr !== 'felice' && tipo !== 2) {
        g.moveTo(s * ex - 4, ey + 1);
        g.lineTo(s * ex + 4, ey + 1);
      } else g.arc(s * ex, ey + 2, 4, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    return;
  }
  if (espr === 'sorpreso') tipo = 0;
  for (const s of [-1, 1]) {
    const x = s * ex;
    switch (tipo) {
      case 1:
        ellisse(g, x + lx * 1.2, ey + ly, 2.6, 3.4);
        path(g, LINEA, null);
        break;
      case 3:
        ellisse(g, x, ey, 6.5, 7.5);
        path(g, '#fff', LINEA, 1.4);
        cerchio(g, x + lx * 2, ey + ly * 2 + 0.5, 4.6);
        path(g, colIride, null);
        cerchio(g, x + lx * 2, ey + ly * 2 + 0.5, 2.3);
        path(g, '#111', null);
        cerchio(g, x + lx * 2 - 1.6, ey + ly * 2 - 1.4, 1.4);
        path(g, '#fff', null);
        break;
      case 4:
        ellisse(g, x, ey, 5, 5.4);
        path(g, '#fff', LINEA, 1.3);
        cerchio(g, x + lx * 1.5, ey + 1.6 + ly, 2.6);
        path(g, '#111', null);
        g.beginPath();
        g.ellipse(x, ey, 5.6, 6, 0, Math.PI, TAU);
        g.closePath();
        path(g, shade(pelle, -0.12), LINEA, 1.3);
        break;
      case 5:
        ellisse(g, x, ey, 4.6, 5.6);
        path(g, '#fff', LINEA, 1.3);
        cerchio(g, x + lx * 1.5, ey + ly * 1.5 + 0.5, 2.8);
        path(g, '#111', null);
        g.strokeStyle = LINEA;
        g.lineWidth = 1.4;
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + s * (0.35 + i * 0.35);
          g.moveTo(x + Math.cos(a) * 5.4, ey + Math.sin(a) * 6.2);
          g.lineTo(x + Math.cos(a) * 8, ey + Math.sin(a) * 8.6);
        }
        g.stroke();
        break;
      case 6:
        g.beginPath();
        g.ellipse(x, ey, 5.4, 3, s * -0.15, 0, TAU);
        path(g, '#fff', LINEA, 1.3);
        cerchio(g, x + lx * 1.5, ey + ly * 0.6, 2.2);
        path(g, '#111', null);
        break;
      case 7: {
        // cuori
        g.save();
        g.translate(x, ey);
        g.scale(0.9, 0.9);
        g.beginPath();
        g.moveTo(0, 4.5);
        g.bezierCurveTo(-7, 0, -5, -6.5, 0, -3);
        g.bezierCurveTo(5, -6.5, 7, 0, 0, 4.5);
        path(g, '#ff3d7f', LINEA, 1.2);
        g.restore();
        break;
      }
      default:
        ellisse(g, x, ey, 4.8, 5.8);
        path(g, '#fff', LINEA, 1.3);
        cerchio(g, x + lx * 1.6, ey + ly * 1.6 + 0.6, 2.9);
        path(g, '#111', null);
        cerchio(g, x + lx * 1.6 - 1, ey + ly * 1.6 - 0.6, 1);
        path(g, '#fff', null);
    }
  }
}

function sopracciglia(g, tipo, col, espr) {
  if (tipo === 0 && !espr) return;
  let t = tipo;
  if (espr === 'triste') t = 5;
  else if (espr === 'arrabbiato') t = 4;
  else if (tipo === 0) return;
  g.strokeStyle = shade(col, -0.1);
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const x = s * 9;
    const y = -10;
    g.beginPath();
    switch (t) {
      case 2:
        g.lineWidth = 3.4;
        g.moveTo(x - 4.5, y);
        g.lineTo(x + 4.5, y);
        break;
      case 3:
        g.lineWidth = 1.8;
        g.arc(x, y + 3, 5.5, Math.PI * 1.2, Math.PI * 1.8);
        break;
      case 4:
        g.lineWidth = 2.6;
        g.moveTo(x - s * 4.5, y + 2.5);
        g.lineTo(x + s * 4.5, y - 1.5);
        break;
      case 5:
        g.lineWidth = 2.2;
        g.moveTo(x - s * 4.5, y - 2);
        g.lineTo(x + s * 4.5, y + 1.5);
        break;
      default:
        g.lineWidth = 1.6;
        g.arc(x, y + 5, 5.5, Math.PI * 1.28, Math.PI * 1.72);
    }
    g.stroke();
  }
}

function bocca(g, tipo, espr) {
  const y = 12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (espr === 'triste') tipo = -1;
  else if (espr === 'sorpreso' || espr === 'stordito') tipo = 3;
  else if (espr === 'felice' && (tipo === 0 || tipo === 5 || tipo === 6)) tipo = 1;
  g.strokeStyle = LINEA;
  g.lineWidth = 2;
  switch (tipo) {
    case -1:
      g.beginPath();
      g.arc(0, y + 6, 6, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      break;
    case 1:
      g.beginPath();
      g.moveTo(-7, y - 2);
      g.quadraticCurveTo(0, y - 1, 7, y - 2);
      g.quadraticCurveTo(6, y + 8, 0, y + 8);
      g.quadraticCurveTo(-6, y + 8, -7, y - 2);
      g.closePath();
      path(g, '#7a1f2b', LINEA, 1.6);
      ellisse(g, 0, y + 5.5, 3.6, 2);
      path(g, '#ff7a8a', null);
      break;
    case 2:
      g.beginPath();
      g.arc(0, y - 3, 6.5, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
      rett(g, -2.8, y + 2, 5.6, 6, 2.8);
      path(g, '#ff6b81', LINEA, 1.2);
      break;
    case 3:
      ellisse(g, 0, y + 1.5, 3.2, 4);
      path(g, '#7a1f2b', LINEA, 1.4);
      break;
    case 4:
      g.beginPath();
      g.arc(0, y - 4, 7, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
      rett(g, -3.4, y + 2.4, 3.2, 4.2, 0.8);
      path(g, '#fff', LINEA, 1);
      rett(g, 0.2, y + 2.4, 3.2, 4.2, 0.8);
      path(g, '#fff', LINEA, 1);
      break;
    case 5:
      g.beginPath();
      g.moveTo(-5, y + 1);
      g.lineTo(5, y + 1);
      g.stroke();
      break;
    case 6:
      g.beginPath();
      g.moveTo(-6, y + 1);
      g.quadraticCurveTo(1, y + 3, 7, y - 2);
      g.stroke();
      break;
    case 7:
      g.beginPath();
      g.moveTo(-8, y - 2);
      g.quadraticCurveTo(0, y, 8, y - 2);
      g.quadraticCurveTo(7, y + 7, 0, y + 7);
      g.quadraticCurveTo(-7, y + 7, -8, y - 2);
      g.closePath();
      path(g, '#fff', LINEA, 1.6);
      g.beginPath();
      g.moveTo(-7, y + 2.2);
      g.lineTo(7, y + 2.2);
      g.lineWidth = 1;
      g.stroke();
      break;
    default:
      g.beginPath();
      g.arc(0, y - 3, 6.5, Math.PI * 0.18, Math.PI * 0.82);
      g.stroke();
  }
}

function barba(g, tipo, col) {
  const dark = shade(col, -0.25);
  g.lineJoin = 'round';
  switch (tipo) {
    case 1: // baffi
      g.beginPath();
      g.moveTo(0, 7.5);
      g.bezierCurveTo(-4, 5, -9, 6, -10, 10);
      g.bezierCurveTo(-6, 9, -3, 10, 0, 9);
      g.bezierCurveTo(3, 10, 6, 9, 10, 10);
      g.bezierCurveTo(9, 6, 4, 5, 0, 7.5);
      path(g, col, dark, 1.2);
      break;
    case 2: // baffi a manubrio
      g.beginPath();
      g.moveTo(0, 7.5);
      g.bezierCurveTo(-6, 5, -12, 9, -13, 5);
      g.bezierCurveTo(-15, 8, -12, 12, -6, 10);
      g.quadraticCurveTo(-2, 9.5, 0, 9);
      g.quadraticCurveTo(2, 9.5, 6, 10);
      g.bezierCurveTo(12, 12, 15, 8, 13, 5);
      g.bezierCurveTo(12, 9, 6, 5, 0, 7.5);
      path(g, col, dark, 1.2);
      break;
    case 3: // pizzetto
      g.beginPath();
      g.moveTo(-4, 19);
      g.quadraticCurveTo(0, 30, 4, 19);
      g.closePath();
      path(g, col, dark, 1.2);
      break;
    case 4: // barba corta
      g.beginPath();
      g.moveTo(-23, 2);
      g.quadraticCurveTo(-22, 26, 0, 28);
      g.quadraticCurveTo(22, 26, 23, 2);
      g.quadraticCurveTo(16, 10, 10, 8);
      g.quadraticCurveTo(0, 5, -10, 8);
      g.quadraticCurveTo(-16, 10, -23, 2);
      g.closePath();
      path(g, col, dark, 1.4);
      break;
    case 5: // barbone
      g.beginPath();
      g.moveTo(-23, 2);
      g.quadraticCurveTo(-24, 30, -8, 40);
      g.quadraticCurveTo(0, 48, 8, 40);
      g.quadraticCurveTo(24, 30, 23, 2);
      g.quadraticCurveTo(16, 10, 10, 8);
      g.quadraticCurveTo(0, 5, -10, 8);
      g.quadraticCurveTo(-16, 10, -23, 2);
      g.closePath();
      path(g, col, dark, 1.4);
      break;
  }
}

function occhiali(g, tipo) {
  const y = -1;
  g.lineJoin = 'round';
  switch (tipo) {
    case 1:
      for (const s of [-1, 1]) {
        cerchio(g, s * 9, y, 7.2);
        path(g, 'rgba(200,230,255,0.25)', '#1d1d2b', 2);
      }
      g.beginPath();
      g.moveTo(-2, y - 1);
      g.lineTo(2, y - 1);
      g.stroke();
      break;
    case 2:
      for (const s of [-1, 1]) {
        rett(g, s * 9 - 7.5, y - 5.5, 15, 11, 2.5);
        path(g, 'rgba(200,230,255,0.25)', '#1d1d2b', 2.4);
      }
      g.beginPath();
      g.moveTo(-1.5, y - 1);
      g.lineTo(1.5, y - 1);
      g.stroke();
      break;
    case 3:
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 1.5, y - 5);
        g.lineTo(s * 17, y - 5);
        g.quadraticCurveTo(s * 17, y + 6, s * 9, y + 6);
        g.quadraticCurveTo(s * 1.5, y + 6, s * 1.5, y - 5);
        path(g, '#161622', '#0b0b12', 1.6);
        g.beginPath();
        g.moveTo(s * 5, y - 3);
        g.lineTo(s * 8, y - 3);
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1.2;
        g.stroke();
      }
      break;
    case 4:
      for (const s of [-1, 1]) {
        g.save();
        g.translate(s * 9, y + 1);
        g.beginPath();
        g.moveTo(0, 6);
        g.bezierCurveTo(-10, 0, -7, -9, 0, -4);
        g.bezierCurveTo(7, -9, 10, 0, 0, 6);
        path(g, 'rgba(255,80,150,0.75)', '#b3125a', 1.6);
        g.restore();
      }
      break;
    case 5: // benda da pirata
      g.beginPath();
      g.moveTo(-26, -12);
      g.lineTo(26, 6);
      g.strokeStyle = '#111';
      g.lineWidth = 1.6;
      g.stroke();
      ellisse(g, 9, y, 7, 6.5);
      path(g, '#111', '#000', 1);
      break;
  }
}

function cappello(g, tipo, colMaglia, colCapelli) {
  g.lineJoin = 'round';
  switch (tipo) {
    case 1: {
      // berretto con visiera
      const dark = shade(colMaglia, -0.3);
      g.beginPath();
      g.arc(0, -6, 26, Math.PI, TAU);
      g.closePath();
      path(g, colMaglia, dark);
      g.beginPath();
      g.moveTo(-6, -8);
      g.quadraticCurveTo(20, -14, 36, -6);
      g.quadraticCurveTo(20, -2, -6, -6);
      g.closePath();
      path(g, dark, shade(colMaglia, -0.5));
      cerchio(g, 0, -32, 3);
      path(g, dark, null);
      break;
    }
    case 2: {
      // cuffia
      const dark = shade(colMaglia, -0.3);
      g.beginPath();
      g.arc(0, -4, 27, Math.PI, TAU);
      g.closePath();
      path(g, colMaglia, dark);
      rett(g, -28, -10, 56, 9, 4);
      path(g, shade(colMaglia, -0.12), dark);
      cerchio(g, 0, -33, 6);
      path(g, '#fff', '#ccc');
      break;
    }
    case 3: // cilindro
      ellisse(g, 0, -20, 32, 6);
      path(g, '#1b1b25', '#000');
      rett(g, -19, -58, 38, 40, 3);
      path(g, '#22222e', '#000');
      rett(g, -19, -28, 38, 7, 0);
      path(g, '#d7263d', null);
      break;
    case 4: // corona
      g.beginPath();
      g.moveTo(-20, -16);
      g.lineTo(-22, -40);
      g.lineTo(-11, -28);
      g.lineTo(0, -44);
      g.lineTo(11, -28);
      g.lineTo(22, -40);
      g.lineTo(20, -16);
      g.closePath();
      path(g, '#ffd23f', '#b8860b', 2);
      for (const [x, y, c] of [
        [-11, -21, '#e63946'],
        [0, -21, '#3a86ff'],
        [11, -21, '#2ec4b6'],
      ]) {
        cerchio(g, x, y, 2.6);
        path(g, c, null);
      }
      break;
    case 5: // cowboy
      g.beginPath();
      g.moveTo(-40, -12);
      g.quadraticCurveTo(0, -2, 40, -12);
      g.quadraticCurveTo(38, -22, 30, -16);
      g.quadraticCurveTo(0, -10, -30, -16);
      g.quadraticCurveTo(-38, -22, -40, -12);
      path(g, '#a0622d', '#5c3413');
      g.beginPath();
      g.moveTo(-18, -16);
      g.quadraticCurveTo(-20, -44, -6, -38);
      g.quadraticCurveTo(0, -34, 6, -38);
      g.quadraticCurveTo(20, -44, 18, -16);
      g.closePath();
      path(g, '#b87333', '#5c3413');
      rett(g, -18, -22, 36, 5, 1);
      path(g, '#5c3413', null);
      break;
    case 6: {
      // fiocco
      const c = '#ff4f9a';
      g.save();
      g.translate(14, -22);
      g.rotate(0.3);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(s * 10, -12, s * 14, -4);
        g.quadraticCurveTo(s * 14, 8, 0, 0);
        path(g, c, shade(c, -0.35));
      }
      cerchio(g, 0, 0, 3.5);
      path(g, shade(c, -0.15), shade(c, -0.35));
      g.restore();
      break;
    }
    case 7: {
      // cono da festa
      g.save();
      g.translate(4, -20);
      g.rotate(0.18);
      g.beginPath();
      g.moveTo(-14, 0);
      g.lineTo(0, -40);
      g.lineTo(14, 0);
      g.closePath();
      path(g, colMaglia, shade(colMaglia, -0.35));
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      for (let i = -3; i < 6; i++) {
        g.beginPath();
        g.moveTo(-20, -i * 9);
        g.lineTo(20, -i * 9 - 12);
        g.stroke();
      }
      g.restore();
      cerchio(g, 0, -41, 5);
      path(g, '#ffd23f', '#b8860b', 1.2);
      g.restore();
      break;
    }
    case 8: // orecchie da gatto
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 8, -24);
        g.lineTo(s * 22, -38);
        g.lineTo(s * 24, -14);
        g.closePath();
        path(g, colCapelli, shade(colCapelli, -0.35));
        g.beginPath();
        g.moveTo(s * 12, -22);
        g.lineTo(s * 20, -31);
        g.lineTo(s * 21, -18);
        g.closePath();
        path(g, '#ffadc8', null);
      }
      break;
  }
}

// Testa completa, centrata in (0,0) con raggio ~25.
function disegnaTestaLocale(g, av, st) {
  const pelle = PELLE[av.pelle] || PELLE[0];
  const colCap = CAPELLI[av.coloreCapelli] || CAPELLI[0];
  const T = TESTE[av.testa] || TESTE[0];

  g.save();
  g.scale(T.sx, T.sy);
  capelliDietro(g, av.capelli, colCap);
  g.restore();

  // Orecchie
  for (const s of [-1, 1]) {
    ellisse(g, s * (T.hw + 1), 2, 5, 6);
    path(g, pelle, LINEA, 1.6);
    ellisse(g, s * (T.hw + 1), 2, 2.2, 3);
    path(g, shade(pelle, -0.15), null);
  }

  formaTesta(g, av.testa);
  path(g, pelle, LINEA, 2);

  // Guance
  g.globalAlpha = 0.35;
  for (const s of [-1, 1]) {
    ellisse(g, s * 14.5, 8, 4.5, 3);
    path(g, '#ff7a8a', null);
  }
  g.globalAlpha = 1;

  occhi(g, av.occhi, pelle, st.look, st.chiusi, st.espr, ['#6b4226', '#2f7ae5', '#2e9e5b', '#6b4226', '#8a5cf6'][av.occhi % 5]);
  sopracciglia(g, av.sopracciglia, colCap, st.espr);

  // Naso
  ellisse(g, 0, 5, 2.4, 1.8);
  path(g, shade(pelle, -0.14), null);

  barba(g, av.barba, colCap);
  bocca(g, av.bocca, st.espr);

  g.save();
  g.scale(T.sx, T.sy);
  capelliDavanti(g, av.capelli, colCap);
  g.restore();

  occhiali(g, av.occhiali);

  g.save();
  g.translate(0, T.top + 25);
  g.scale(T.sx, 1);
  cappello(g, av.cappello, VESTITI[av.coloreMaglia] || VESTITI[0], colCap);
  g.restore();
}

// ---------------------------------------------------------------------------
// Corpo

const FISICI = [
  { spalle: 24, vita: 21, gamba: 8, gx: 5.5 },
  { spalle: 30, vita: 28, gamba: 9.5, gx: 7 },
  { spalle: 36, vita: 42, gamba: 11, gx: 9 },
];

function braccio(g, lato, sx, sy, ang, len, manica, colManica, pelle) {
  const hx = sx + lato * Math.sin(ang) * len;
  const hy = sy + Math.cos(ang) * len;
  const mx = sx + (hx - sx) * 0.5;
  const my = sy + (hy - sy) * 0.5;
  g.lineCap = 'round';
  // contorno
  g.strokeStyle = LINEA;
  g.lineWidth = 9.6;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(hx, hy);
  g.stroke();
  g.lineWidth = 6.4;
  g.strokeStyle = pelle;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(hx, hy);
  g.stroke();
  if (manica > 0) {
    g.strokeStyle = colManica;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(manica >= 1 ? hx : mx, manica >= 1 ? hy : my);
    g.stroke();
  }
  cerchio(g, hx, hy, 4.4);
  path(g, pelle, LINEA, 1.6);
}

// Ala attaccata al braccio: la punta va oltre la mano, le piume pendono dal lato
// opposto al movimento. Si disegna prima del corpo, così resta dietro.
function ala(g, lato, sx, sy, ang, len, col) {
  const ux = lato * Math.sin(ang);
  const uy = Math.cos(ang);
  g.save();
  g.transform(ux, uy, -lato * uy, lato * ux, sx, sy);
  const L = len + 16;
  g.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    const lung = 18 - i * 1.7;
    g.save();
    g.translate(L - 4 - i * 7.4, 2);
    g.rotate(-0.55 + i * 0.13);
    ellisse(g, 0, lung * 0.5, 4.8, lung * 0.55);
    path(g, i % 2 ? col : shade(col, 0.18), LINEA, 1.4);
    g.restore();
  }
  g.beginPath();
  g.moveTo(-2, -2.5);
  g.quadraticCurveTo(L * 0.6, -4.5, L + 1, -0.5);
  g.quadraticCurveTo(L * 0.55, 13, -1, 9);
  g.closePath();
  path(g, shade(col, 0.5), LINEA, 1.5);
  g.restore();
}

function busto(g, F) {
  const top = -47;
  const bot = -21;
  const s = F.spalle / 2;
  const v = F.vita / 2;
  g.beginPath();
  g.moveTo(-s + 5, top);
  g.lineTo(s - 5, top);
  g.quadraticCurveTo(s + 1, top, s + 1, top + 7);
  g.bezierCurveTo(s + 2, top + 16, v + 2, bot - 8, v, bot);
  g.lineTo(-v, bot);
  g.bezierCurveTo(-v - 2, bot - 8, -s - 2, top + 16, -s - 1, top + 7);
  g.quadraticCurveTo(-s - 1, top, -s + 5, top);
  g.closePath();
}

function disegnaCorpo(g, av, st) {
  const F = FISICI[av.fisico] || FISICI[1];
  const pelle = PELLE[av.pelle] || PELLE[0];
  const colMaglia = VESTITI[av.coloreMaglia] || VESTITI[0];
  const colPant = PANTALONI[av.colorePantaloni] || PANTALONI[0];
  const colScarpe = SCARPE[av.scarpe] || SCARPE[0];
  const lift = st.gambe; // [sinistra, destra] sollevamento piedi
  const sy = -43;
  const sx = F.spalle / 2 - 1.5;
  const len = 22;
  const [aL, aR] = st.braccia;

  if (st.ali) {
    ala(g, -1, -sx, sy, aL, len, st.ali);
    ala(g, 1, sx, sy, aR, len, st.ali);
  }

  // Gambe
  for (const [i, s] of [
    [0, -1],
    [1, 1],
  ]) {
    const hx = s * F.gx;
    const fx = s * (F.gx + st.divarica);
    const fy = -lift[i];
    g.lineCap = 'round';
    g.strokeStyle = LINEA;
    g.lineWidth = F.gamba + 3;
    g.beginPath();
    g.moveTo(hx, -24);
    g.lineTo(fx, fy - 4);
    g.stroke();
    g.lineWidth = F.gamba;
    g.strokeStyle = av.pantaloni === 0 ? colPant : pelle;
    g.beginPath();
    g.moveTo(hx, -24);
    g.lineTo(fx, fy - 4);
    g.stroke();
    if (av.pantaloni === 1) {
      g.strokeStyle = colPant;
      g.beginPath();
      g.moveTo(hx, -24);
      g.lineTo(hx + (fx - hx) * 0.45, -24 + (fy - 4 + 24) * 0.45);
      g.stroke();
    }
    // scarpa
    ellisse(g, fx + s * 2, fy - 2.5, 7.5, 4.6);
    path(g, colScarpe, LINEA, 1.6);
  }

  // Gonna
  if (av.pantaloni === 2) {
    g.beginPath();
    g.moveTo(-F.vita / 2 + 1, -24);
    g.lineTo(F.vita / 2 - 1, -24);
    g.lineTo(F.vita / 2 + 6, -11);
    g.quadraticCurveTo(0, -8, -F.vita / 2 - 6, -11);
    g.closePath();
    path(g, colPant, LINEA);
  }

  const manica = av.maglia === 4 ? 0 : av.maglia === 2 || av.maglia === 3 ? 1 : 0.5;

  // Braccio dietro quando esulta non serve: disegniamo le braccia dopo il busto.
  busto(g, F);
  path(g, colMaglia, LINEA, 2);

  g.save();
  busto(g, F);
  g.clip();
  // Cintura / pantaloni sul fianco
  if (av.pantaloni !== 2) {
    g.fillStyle = colPant;
    g.fillRect(-30, -27, 60, 8);
  }
  switch (av.maglia) {
    case 1: // righe
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = -44; y < -27; y += 6) g.fillRect(-30, y, 60, 3);
      break;
    case 2: // felpa
      g.fillStyle = shade(colMaglia, -0.15);
      rett(g, -9, -35, 18, 8, 3);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-3, -46);
      g.lineTo(-4, -38);
      g.moveTo(3, -46);
      g.lineTo(4, -38);
      g.stroke();
      break;
    case 3: // camicia e cravatta
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(-8, -48);
      g.lineTo(0, -41);
      g.lineTo(8, -48);
      g.lineTo(5, -38);
      g.lineTo(-5, -38);
      g.closePath();
      g.fill();
      g.fillStyle = colMaglia === VESTITI[0] ? '#1e3a8a' : '#d7263d';
      g.beginPath();
      g.moveTo(0, -42);
      g.lineTo(3, -39);
      g.lineTo(2, -30);
      g.lineTo(0, -27);
      g.lineTo(-2, -30);
      g.lineTo(-3, -39);
      g.closePath();
      g.fill();
      break;
    case 4: // canotta
      g.fillStyle = pelle;
      g.beginPath();
      g.moveTo(-9, -48);
      g.quadraticCurveTo(0, -36, 9, -48);
      g.closePath();
      g.fill();
      break;
    case 5: {
      // stella
      g.fillStyle = colMaglia === VESTITI[2] ? '#fff' : '#ffd23f';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 3 : 7;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(Math.cos(a) * r, -36 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      break;
    }
  }
  g.restore();
  busto(g, F);
  path(g, null, LINEA, 2);

  braccio(g, -1, -sx, sy, aL, len, manica, colMaglia, pelle);
  braccio(g, 1, sx, sy, aR, len, manica, colMaglia, pelle);
}

// ---------------------------------------------------------------------------
// Pose

function stato(av, o) {
  const t = (o.t ?? performance.now() / 1000) + semeDi(av);
  const pose = o.pose || 'idle';
  const st = {
    y: 0, // salto dell'intero corpo
    bob: 0, // ondeggio di busto e testa
    tilt: 0,
    headDy: 0,
    braccia: [0.22, 0.22],
    gambe: [0, 0],
    divarica: 0,
    look: o.look || [0, 0],
    espr: o.espr || null,
    chiusi: t % 4.3 < 0.13,
    // ali sulle braccia: true = nel colore del giocatore, oppure un colore
    ali: o.ali ? (typeof o.ali === 'string' ? o.ali : (COLORI_GIOCATORE[av.colore] || COLORI_GIOCATORE[0]).hex) : null,
  };
  switch (pose) {
    case 'walk':
    case 'run': {
      const f = pose === 'run' ? 11 : 7;
      const ph = t * f;
      const a = pose === 'run' ? 7 : 5;
      st.gambe = [Math.max(0, Math.sin(ph)) * a, Math.max(0, -Math.sin(ph)) * a];
      st.bob = -Math.abs(Math.sin(ph)) * 1.6;
      st.braccia = [0.35 + Math.sin(ph) * 0.35, 0.35 - Math.sin(ph) * 0.35];
      st.tilt = pose === 'run' ? 0.05 * (o.dir || 1) : 0;
      break;
    }
    case 'cheer': {
      const j = Math.abs(Math.sin(t * 5));
      st.y = -j * 9;
      st.braccia = [2.5 + Math.sin(t * 10) * 0.25, 2.5 - Math.sin(t * 10) * 0.25];
      st.divarica = 2;
      st.espr = st.espr || 'felice';
      break;
    }
    case 'jump':
      st.braccia = [2.3, 2.3];
      st.gambe = [3, 3];
      st.divarica = 3;
      break;
    case 'sad':
      st.braccia = [0.05, 0.05];
      st.headDy = 2;
      st.bob = Math.sin(t * 1.5) * 0.5;
      st.espr = st.espr || 'triste';
      break;
    case 'hit':
      st.braccia = [1.4 + Math.sin(t * 20) * 0.4, 1.4 - Math.sin(t * 20) * 0.4];
      st.tilt = Math.sin(t * 25) * 0.08;
      st.espr = st.espr || 'stordito';
      st.divarica = 3;
      break;
    case 'point':
      st.braccia = [0.2, 1.6];
      break;
    case 'pugno': {
      // braccio teso verso dir (1 = destra, -1 = sinistra)
      const d = (o.dir ?? 1) >= 0 ? 1 : -1;
      st.braccia = d > 0 ? [0.5, 1.62] : [1.62, 0.5];
      st.tilt = 0.12 * d;
      st.divarica = 3;
      st.espr = st.espr || 'arrabbiato';
      break;
    }
    case 'vola': {
      // battito: -1 ali in alto, 0 ali aperte (planata), +1 ali in basso
      const b = clamp(o.battito ?? 0, -1, 1);
      const a = Math.PI / 2 - 0.8 * b;
      st.braccia = [a, a];
      const k = Math.sin(t * 7);
      st.gambe = [4 + k * 2.5, 4 - k * 2.5];
      st.divarica = 1.5;
      st.tilt = o.inclina ?? 0;
      st.y = -b * 2;
      break;
    }
    default:
      st.bob = Math.sin(t * 2.4) * 0.9;
      st.braccia = [0.22 + Math.sin(t * 2.4) * 0.04, 0.22 + Math.sin(t * 2.4) * 0.04];
  }
  return st;
}

// ---------------------------------------------------------------------------
// API di disegno

// Avatar intero con i piedi in (x, y), alto h pixel.
// o: { pose, t, look:[dx,dy], espr, ombra, dir, ali, battito, inclina }
export function disegnaAvatar(g, avRaw, x, y, h, o = {}) {
  const av = avRaw && avRaw.__ok ? avRaw : normalizza(avRaw);
  const st = stato(av, o);
  const k = h / 100;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (o.ombra !== false) {
    const s = 1 + st.y / 40;
    ellisse(g, 0, 0, 24 * s, 5.5 * s);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fill();
  }
  g.translate(0, st.y);
  g.rotate(st.tilt);
  g.save();
  g.translate(0, st.bob * 0.5);
  disegnaCorpo(g, av, st);
  g.restore();
  g.translate(0, -71 + st.bob + st.headDy);
  disegnaTestaLocale(g, av, st);
  g.restore();
}

// Solo la testa, centrata in (x, y), raggio r pixel (per pedine e miniature).
export function disegnaTesta(g, avRaw, x, y, r, o = {}) {
  const av = avRaw && avRaw.__ok ? avRaw : normalizza(avRaw);
  const st = stato(av, { ...o, pose: 'idle' });
  const k = r / 27;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  if (o.rot) g.rotate(o.rot);
  disegnaTestaLocale(g, av, st);
  g.restore();
}

// Avatar pronto all'uso (normalizzato una volta sola, per disegnarlo spesso).
export function prepara(av) {
  return Object.assign(normalizza(av), { __ok: true });
}

// Canvas con l'avatar disegnato (per l'interfaccia HTML).
export function canvasAvatar(av, w, h, o = {}) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (o.soloTesta) disegnaTesta(g, av, w / 2, h / 2 + h * 0.06, Math.min(w, h) * 0.36, o);
  else disegnaAvatar(g, av, w / 2, h * 0.96, h * 0.86, { t: 0.5, ...o });
  return c;
}
