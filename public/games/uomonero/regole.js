// L'Uomo Nero: regole "pure" (niente disegno): labirinto, movimento, luce delle torce,
// ruoli e punti. Le usano lo schermo, i telefoni e i test.
// Coordinate in caselle: la casella (i, j) va da (i, j) a (i + 1, j + 1) e chi sta fermo
// sta al suo centro (i + 0,5, j + 0,5).

import { seeded, clamp } from '../../shared/util.js';

// Passaggi aperti di una casella (bit) e i quattro passi possibili.
export const NORD = 1;
export const SUD = 2;
export const OVEST = 4;
export const EST = 8;
export const PASSI = [
  [NORD, 0, -1, SUD],
  [SUD, 0, 1, NORD],
  [OVEST, -1, 0, EST],
  [EST, 1, 0, OVEST],
];
const bitDi = (dx, dy) => (dx > 0 ? EST : dx < 0 ? OVEST : dy > 0 ? SUD : NORD);

// Velocità in caselle al secondo: il Boss va 1,15 volte i sopravvissuti.
export const VEL = { sopravvissuto: 2.8, boss: 3.2, eco: 2.5 };
// Cono della torcia: lunghezza (caselle) e metà dell'apertura (radianti, ~32°).
export const TORCIA = { raggio: 4.5, apertura: 0.56 };
export const CARICA = 2; // secondi fermi sulla batteria, con la torcia accesa
export const PING = { cd: 8, durata: 3, max: 3 };
// Morsa: dura 2 s se la vittima non si dimena, fino a 3 s se tocca a raffica (6 tocchi al secondo).
// Il Boss deve toccare almeno ogni 0,5 s; si afferra chi è entro 1,3 caselle senza muri in mezzo.
export const MORSA = { breve: 2, lunga: 3, tapsPieni: 6, tapBoss: 0.5, raggio: 1.3, immune: 2.5, mancata: 0.8 };
// Dopo la Morsa il Boss va al 40% della velocità e non può afferrare.
export const RECUPERO = { accecato: 4, preso: 1.5, liberato: 1, lento: 0.4 };
export const POTERI = {
  urlo: { nome: 'Urlo', emoji: '😱', cd: 12, durata: 3, lento: 0.6 },
  marchio: { nome: 'Marchio', emoji: '☠️', cd: 20, durata: 15, raggio: 1.6, letale: 3 },
  blackout: { nome: 'Blackout', emoji: '🌑', cd: 25, durata: 4 },
};
export const ORDINE_POTERI = ['urlo', 'marchio', 'blackout'];
export const BATTITO = 3; // caselle: entro questa distanza dal Boss il telefono pulsa
// Un blip ogni 1,5 s, a turno tra i sopravvissuti; quando ne restano meno di 3 si allunga,
// così ognuno viene "sentito" al massimo ogni 4,5 s.
export const BLIP = { ogni: 1.5, minimo: 4.5, raggio: 2, vita: 3 };
export const RIVELA = 1; // secondi in cui la sagoma colpita dalla luce resta visibile
export const SONAR = 2; // caselle viste dal Boss intorno a sé

// Tutto quello che cambia col numero di giocatori (n = totale, Boss compreso).
export function config(n) {
  const fascia = n <= 5 ? 0 : n <= 10 ? 1 : 2;
  return {
    fascia,
    colonne: [19, 25, 31][fascia],
    righe: [11, 14, 17][fascia],
    batterie: [5, 7, 9][fascia],
    echi: fascia === 0 ? 0 : fascia === 1 ? Math.round(4 + n * 0.4) : Math.round(5.4 + n * 0.6),
    durata: [120, 150, 180][fascia],
    poteri: fascia === 0 ? ['urlo'] : ['urlo', 'marchio', 'blackout'],
    // in pochi un errore costava la partita in mezzo minuto: da 3 a 5 giocatori la prima
    // Morsa ferisce e basta (come le bolle in più del Polpo)
    vite: fascia === 0 ? 2 : 1,
    // con tanta gente da inseguire il Boss ricarica i poteri un po' prima
    cdScala: fascia === 2 ? 0.8 : 1,
  };
}

// ---------------------------------------------------------------------------
// Labirinto

export function creaLab(colonne, righe, celle = new Uint8Array(colonne * righe)) {
  return { col: colonne, rig: righe, celle };
}
export const dentro = (lab, x, y) => x >= 0 && y >= 0 && x < lab.col && y < lab.rig;
export const indice = (lab, x, y) => y * lab.col + x;
export function aperto(lab, x, y, dx, dy) {
  if (!dentro(lab, x, y) || !dentro(lab, x + dx, y + dy)) return false;
  return (lab.celle[indice(lab, x, y)] & bitDi(dx, dy)) !== 0;
}

// Labirinto "a treccia": prima uno perfetto (backtracking), poi si aprono quasi tutti i
// vicoli ciechi e qualche muro a caso. In un labirinto perfetto chi è inseguito non ha
// scampo; con gli anelli si può girare intorno ai blocchi e seminare il Boss.
export function generaLab(seme, colonne, righe) {
  const r = seeded(seme);
  const lab = creaLab(colonne, righe);
  const { celle } = lab;
  const visti = new Uint8Array(colonne * righe);
  const pila = [[r.int(0, colonne - 1), r.int(0, righe - 1)]];
  visti[indice(lab, ...pila[0])] = 1;
  const apri = (x, y, bit, nx, ny, opp) => {
    celle[indice(lab, x, y)] |= bit;
    celle[indice(lab, nx, ny)] |= opp;
  };
  while (pila.length) {
    const [x, y] = pila[pila.length - 1];
    const liberi = PASSI.filter(([, dx, dy]) => dentro(lab, x + dx, y + dy) && !visti[indice(lab, x + dx, y + dy)]);
    if (!liberi.length) {
      pila.pop();
      continue;
    }
    const [bit, dx, dy, opp] = r.pick(liberi);
    apri(x, y, bit, x + dx, y + dy, opp);
    visti[indice(lab, x + dx, y + dy)] = 1;
    pila.push([x + dx, y + dy]);
  }
  const uscite = (x, y) => PASSI.filter(([b]) => celle[indice(lab, x, y)] & b).length;
  for (let y = 0; y < righe; y++) {
    for (let x = 0; x < colonne; x++) {
      if (uscite(x, y) !== 1 || r.next() > 0.8) continue;
      const chiusi = PASSI.filter(([b, dx, dy]) => !(celle[indice(lab, x, y)] & b) && dentro(lab, x + dx, y + dy));
      if (!chiusi.length) continue;
      // meglio unire due vicoli ciechi
      const ciechi = chiusi.filter(([, dx, dy]) => uscite(x + dx, y + dy) === 1);
      const [bit, dx, dy, opp] = r.pick(ciechi.length ? ciechi : chiusi);
      apri(x, y, bit, x + dx, y + dy, opp);
    }
  }
  for (let y = 0; y < righe; y++) {
    for (let x = 0; x < colonne; x++) {
      if (x + 1 < colonne && !(celle[indice(lab, x, y)] & EST) && r.next() < 0.05) apri(x, y, EST, x + 1, y, OVEST);
      if (y + 1 < righe && !(celle[indice(lab, x, y)] & SUD) && r.next() < 0.05) apri(x, y, SUD, x, y + 1, NORD);
    }
  }
  return lab;
}

// Codifica compatta per i telefoni: una cifra esadecimale per casella.
export const codifica = (lab) => Array.from(lab.celle, (v) => v.toString(16)).join('');
export const decodifica = (s, colonne, righe) => creaLab(colonne, righe, Uint8Array.from(s, (c) => parseInt(c, 16)));

// Distanza a passi da una casella a tutte le altre (-1 = irraggiungibile).
export function distanze(lab, x0, y0) {
  const d = new Int16Array(lab.col * lab.rig).fill(-1);
  const coda = [indice(lab, x0, y0)];
  d[coda[0]] = 0;
  for (let i = 0; i < coda.length; i++) {
    const c = coda[i];
    const x = c % lab.col;
    const y = (c - x) / lab.col;
    for (const [b, dx, dy] of PASSI) {
      if (!(lab.celle[c] & b)) continue;
      const n = indice(lab, x + dx, y + dy);
      if (d[n] >= 0) continue;
      d[n] = d[c] + 1;
      coda.push(n);
    }
  }
  return d;
}

// Labirinto, partenze, tana del Boss, batterie e uscita, tutto dal seme.
// L'uscita è una porta nel muro di destra; i sopravvissuti partono a sinistra.
export function generaMappa(seme, cfg, quanti) {
  const lab = generaLab(seme, cfg.colonne, cfg.righe);
  const r = seeded(seme ^ 0x5bd1e995);
  const { col, rig } = lab;
  const via = [0, Math.floor(rig / 2)];
  const dVia = distanze(lab, ...via);
  const celle = [];
  for (let y = 0; y < rig; y++) for (let x = 0; x < col; x++) celle.push([x, y]);
  // partenze: le caselle più vicine al punto di partenza
  const vicine = [...celle].sort((a, b) => dVia[indice(lab, ...a)] - dVia[indice(lab, ...b)]);
  const partenze = Array.from({ length: quanti }, (_, i) => vicine[i % Math.min(vicine.length, Math.max(4, quanti))]);
  const uscita = [col - 1, r.int(1, rig - 2)];
  // il Boss parte a circa due terzi della mappa, lontano dai sopravvissuti
  const zonaBoss = celle.filter(([x, y]) => x >= Math.floor(col * 0.6) && x <= Math.floor(col * 0.75) && y > 0 && y < rig - 1);
  const tana = r.pick(zonaBoss);
  // batterie sparse: ogni nuova è la più lontana (con un po' di caso) da quelle già messe
  const presi = [via, uscita, tana];
  const batterie = [];
  const candidate = celle.filter((c) => dVia[indice(lab, ...c)] >= 4 && !(c[0] === uscita[0] && c[1] === uscita[1]));
  for (let i = 0; i < cfg.batterie; i++) {
    const voti = candidate
      .filter((c) => !batterie.some((b) => b[0] === c[0] && b[1] === c[1]))
      .map((c) => ({ c, v: Math.min(...[...presi, ...batterie].map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) + r.next() * 1.5 }))
      .sort((a, b) => b.v - a.v);
    batterie.push(voti[Math.min(voti.length - 1, r.int(0, 2))].c);
  }
  return { lab, partenze, tana, uscita, batterie };
}

// ---------------------------------------------------------------------------
// Movimento "alla Pac-Man": ci si gira solo al centro delle caselle; se la direzione voluta
// è chiusa si va dritti finché si può (così si può "prenotare" la svolta), senza comandi ci
// si ferma al centro della casella successiva. L'inversione è immediata.
// e = { cx, cy, dir: [dx, dy] | null, k (0..1 verso la casella dopo), vuole: [dx, dy] }

function scegli(lab, x, y, vuole, dir) {
  const [vx, vy] = vuole || [0, 0];
  if (!vx && !vy) return null;
  let prove;
  if (vx && vy) prove = dir && dir[0] ? [[0, vy], [vx, 0]] : [[vx, 0], [0, vy]];
  else prove = [[vx, vy]];
  for (const p of prove) if (aperto(lab, x, y, p[0], p[1])) return p;
  if (dir && aperto(lab, x, y, dir[0], dir[1])) return dir;
  return null;
}

export function muovi(lab, e, passo) {
  for (let giri = 0; giri < 8 && passo > 1e-9; giri++) {
    if (!e.dir) {
      e.dir = scegli(lab, e.cx, e.cy, e.vuole, null);
      e.k = 0;
      if (!e.dir) break;
    } else if (e.vuole && (e.vuole[0] || e.vuole[1]) && e.vuole[0] === -e.dir[0] && e.vuole[1] === -e.dir[1]) {
      e.cx += e.dir[0];
      e.cy += e.dir[1];
      e.dir = [-e.dir[0], -e.dir[1]];
      e.k = 1 - e.k;
    }
    const resto = 1 - e.k;
    if (passo < resto) {
      e.k += passo;
      passo = 0;
    } else {
      passo -= resto;
      e.cx += e.dir[0];
      e.cy += e.dir[1];
      e.k = 0;
      e.dir = scegli(lab, e.cx, e.cy, e.vuole, e.dir);
    }
  }
  e.x = e.cx + 0.5 + (e.dir ? e.dir[0] * e.k : 0);
  e.y = e.cy + 0.5 + (e.dir ? e.dir[1] * e.k : 0);
  return !!e.dir;
}

// La casella più vicina alla posizione (quella che conta per batterie e uscita).
export const casella = (e) => [Math.floor(e.x), Math.floor(e.y)];

// ---------------------------------------------------------------------------
// Luce: raggio a griglia (DDA) contro i muri sottili tra le caselle.

// Quanto va lontano un raggio che parte da (x, y) in direzione (dx, dy) (versore), fino a max.
export function raggio(lab, x, y, dx, dy, max) {
  let cx = Math.floor(x);
  let cy = Math.floor(y);
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tx = dx > 0 ? (cx + 1 - x) * tdx : dx < 0 ? (x - cx) * tdx : Infinity;
  let ty = dy > 0 ? (cy + 1 - y) * tdy : dy < 0 ? (y - cy) * tdy : Infinity;
  for (let i = 0; i < 200; i++) {
    if (tx < ty) {
      if (tx >= max) return max;
      if (!aperto(lab, cx, cy, sx, 0)) return tx;
      cx += sx;
      tx += tdx;
    } else {
      if (ty >= max) return max;
      if (!aperto(lab, cx, cy, 0, sy)) return ty;
      cy += sy;
      ty += tdy;
    }
  }
  return max;
}

// Si vedono due punti senza muri in mezzo?
export function vede(lab, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  if (d < 1e-6) return true;
  return raggio(lab, ax, ay, (bx - ax) / d, (by - ay) / d, d) >= d - 1e-6;
}

const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Il punto (px, py) è dentro il cono della torcia t = { x, y, ang }?
export function nelCono(lab, t, px, py, margine = 0) {
  const dx = px - t.x;
  const dy = py - t.y;
  const d = Math.hypot(dx, dy);
  if (d > TORCIA.raggio + margine) return false;
  if (d > 0.35 && Math.abs(angDiff(t.ang, Math.atan2(dy, dx))) > TORCIA.apertura + Math.atan2(margine, d)) return false;
  return vede(lab, t.x, t.y, px, py);
}

// Poligono della luce (per il disegno): punti [x, y] in caselle, a partire dalla torcia.
export function conoLuce(lab, t, raggi = 22) {
  const punti = [[t.x, t.y]];
  for (let i = 0; i <= raggi; i++) {
    const a = t.ang - TORCIA.apertura + (2 * TORCIA.apertura * i) / raggi;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const l = raggio(lab, t.x, t.y, dx, dy, TORCIA.raggio);
    punti.push([t.x + dx * l, t.y + dy * l]);
  }
  return punti;
}

// Morsa: più la vittima tocca (tocchi nell'ultimo secondo), più la barra sale piano.
export function velocitaMorsa(tocchi) {
  const k = clamp(tocchi / MORSA.tapsPieni, 0, 1);
  return 1 / (MORSA.breve + (MORSA.lunga - MORSA.breve) * k);
}

// ---------------------------------------------------------------------------
// Ruoli e punti

// Chi fa l'Uomo Nero: nel torneo chi ha meno punti (la rivincita), poi chi l'ha fatto meno
// volte nella serata, poi a caso. `escludi` serve a "Cambia Uomo Nero".
export function scegliRuoli(giocatori, { punti = null, volte = {}, escludi = [], caso = Math.random } = {}) {
  const via = new Set(escludi);
  let candidati = giocatori.filter((p) => !via.has(p.id));
  if (!candidati.length) candidati = [...giocatori];
  const sorte = new Map(candidati.map((p) => [p.id, caso()]));
  candidati.sort(
    (a, b) =>
      (punti ? (punti[a.id] || 0) - (punti[b.id] || 0) : 0) ||
      (volte[a.id] || 0) - (volte[b.id] || 0) ||
      sorte.get(a.id) - sorte.get(b.id),
  );
  const ruoli = {};
  for (const p of giocatori) ruoli[p.id] = p.id === candidati[0].id ? 'uomonero' : 'sopravvissuto';
  return ruoli;
}

const conta = (v, uno, tanti) => `${v} ${v === 1 ? uno : tanti}`;

// Punteggio (decide la classifica del minigioco).
// Sopravvissuto: +4 se esce, +1 per ogni batteria caricata, +1 per ogni salvataggio.
// Uomo Nero: 5 × la parte di sopravvissuti fermati (presi o rimasti dentro), +2 se non
// esce nessuno. Così sta sopra chi ha preso e sotto chi è scappato.
// sopr: [{ id, fuggito, preso, batterie, salvataggi }]
export function punteggi({ boss, sopr }) {
  const fuggiti = sopr.filter((s) => s.fuggito).length;
  const fermati = sopr.length - fuggiti;
  const notte = sopr.length > 0 && fuggiti === 0;
  const punti = {};
  const dettagli = {};
  for (const s of sopr) {
    const v = (s.fuggito ? 4 : 0) + s.batterie + s.salvataggi;
    punti[s.id] = v;
    const parti = [s.fuggito ? '🚪 Scappato' : s.preso ? '👤 Preso' : '🌑 Rimasto al buio'];
    if (s.batterie) parti.push(`🔋×${s.batterie}`);
    if (s.salvataggi) parti.push(`🔦 ${conta(s.salvataggi, 'salvataggio', 'salvataggi')}`);
    dettagli[s.id] = `${parti.join(' · ')} = ${conta(v, 'punto', 'punti')}`;
  }
  if (boss) {
    punti[boss] = Math.round((sopr.length ? (5 * fermati) / sopr.length : 0) * 10) / 10 + (notte ? 2 : 0);
    dettagli[boss] = `👤 ${fermati} su ${sopr.length} ${fermati === 1 ? 'fermato' : 'fermati'}${notte ? ' · Notte eterna!' : ''}`;
  }
  return { punti, dettagli, fuggiti, fermati, notte };
}
