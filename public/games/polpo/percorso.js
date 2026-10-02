// Il Polpo: la "strada" verso il traguardo per le CPU dei pesci.
// Una griglia di celle da 16 px: per ogni cella libera si calcola quanto manca al
// traguardo girando attorno agli scogli (e, se richiesto, alle meduse e alle
// controcorrenti). Da ogni cella basta andare verso la vicina con meno strada: una
// delle 8 direzioni del joystick, come farebbe una persona che "vede" il passaggio.

import { ARENA } from './regole.js';

const CELLA = 16;
const COLONNE = Math.ceil(1920 / CELLA);
const RIGHE = Math.ceil((ARENA.y1 - ARENA.y0) / CELLA);
const VICINE = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

// fondale: { corsie, scogli, correnti }; raggio: ingombro del pesce.
// meduse: [{ x, y }] da evitare (raggio rMedusa); furbo: le correnti costano di più.
export function creaPercorso(fondale, { raggio, meduse = [], rMedusa = 0, furbo = false }) {
  const { corsie, scogli, correnti } = fondale;
  const N = COLONNE * RIGHE;
  const libera = new Uint8Array(N);
  const costo = new Float64Array(N).fill(1);
  const dist = new Float64Array(N).fill(Infinity);
  const cx = (i) => (i + 0.5) * CELLA;
  const cy = (j) => ARENA.y0 + (j + 0.5) * CELLA;
  for (let j = 0; j < RIGHE; j++) {
    const y = cy(j);
    const corsia = corsie.findIndex((c) => y >= c.y0 + raggio - CELLA * 0.5 && y <= c.y1 - raggio + CELLA * 0.5);
    if (corsia < 0) continue;
    for (let i = 0; i < COLONNE; i++) {
      const x = cx(i);
      if (scogli.some((s) => s.corsia === corsia && Math.hypot(x - s.x, y - s.y) < s.r + raggio * 0.85 + 2)) continue;
      if (meduse.some((m) => Math.hypot(x - m.x, y - m.y) < rMedusa)) continue;
      const k = j * COLONNE + i;
      libera[k] = 1;
      if (furbo) {
        for (const c of correnti) {
          if (c.corsia !== corsia || x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1) continue;
          costo[k] *= c.vx < 0 ? 1.8 : 1.15;
        }
      }
    }
  }
  // Dijkstra dal traguardo all'indietro (coda con priorità semplice: un mucchio binario)
  const mucchio = [];
  const spingi = (d, k) => {
    mucchio.push([d, k]);
    let i = mucchio.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (mucchio[p][0] <= mucchio[i][0]) break;
      [mucchio[p], mucchio[i]] = [mucchio[i], mucchio[p]];
      i = p;
    }
  };
  const estrai = () => {
    const top = mucchio[0];
    const ult = mucchio.pop();
    if (mucchio.length) {
      mucchio[0] = ult;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < mucchio.length && mucchio[a][0] < mucchio[m][0]) m = a;
        if (b < mucchio.length && mucchio[b][0] < mucchio[m][0]) m = b;
        if (m === i) break;
        [mucchio[m], mucchio[i]] = [mucchio[i], mucchio[m]];
        i = m;
      }
    }
    return top;
  };
  const inizio = Math.ceil((ARENA.traguardo + 8) / CELLA);
  for (let j = 0; j < RIGHE; j++) {
    for (let i = inizio; i < COLONNE; i++) {
      const k = j * COLONNE + i;
      if (!libera[k]) continue;
      dist[k] = 0;
      spingi(0, k);
    }
  }
  const passa = (i, j, di, dj) => {
    // in diagonale solo se non si taglia l'angolo di uno scoglio
    if (di && dj) return libera[j * COLONNE + i + di] && libera[(j + dj) * COLONNE + i];
    return true;
  };
  while (mucchio.length) {
    const [d, k] = estrai();
    if (d > dist[k]) continue;
    const i = k % COLONNE;
    const j = (k - i) / COLONNE;
    for (const [di, dj, c] of VICINE) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= COLONNE || nj >= RIGHE) continue;
      const nk = nj * COLONNE + ni;
      if (!libera[nk] || !passa(i, j, di, dj)) continue;
      const nd = d + c * CELLA * costo[nk];
      if (nd < dist[nk]) {
        dist[nk] = nd;
        spingi(nd, nk);
      }
    }
  }

  const cella = (x, y) => {
    const i = Math.floor(x / CELLA);
    const j = Math.floor((y - ARENA.y0) / CELLA);
    if (i < 0 || j < 0 || i >= COLONNE || j >= RIGHE) return -1;
    return j * COLONNE + i;
  };

  // La cella libera più vicina (con strada) attorno a (x, y).
  function vicina(x, y) {
    const i0 = Math.floor(x / CELLA);
    const j0 = Math.floor((y - ARENA.y0) / CELLA);
    let best = -1;
    let bd = Infinity;
    for (let r = 0; r <= 4 && best < 0; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = i0 + di;
          const j = j0 + dj;
          if (i < 0 || j < 0 || i >= COLONNE || j >= RIGHE) continue;
          const k = j * COLONNE + i;
          if (!libera[k] || dist[k] === Infinity) continue;
          const d = Math.hypot(cx(i) - x, cy(j) - y);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
      }
    }
    return best;
  }

  return {
    // Quanta strada manca (px), o Infinity.
    strada(x, y) {
      const k = cella(x, y);
      if (k >= 0 && libera[k]) return dist[k];
      const v = vicina(x, y);
      return v < 0 ? Infinity : dist[v];
    },
    // Direzione a scatti [dx, dy] (componenti -1, 0, 1) per avvicinarsi al traguardo.
    direzione(x, y) {
      let k = cella(x, y);
      if (k < 0 || !libera[k] || dist[k] === Infinity) {
        const v = vicina(x, y);
        if (v < 0) return [1, 0];
        const i = v % COLONNE;
        const j = (v - i) / COLONNE;
        const dx = cx(i) - x;
        const dy = cy(j) - y;
        return [Math.abs(dx) > 3 ? Math.sign(dx) : 0, Math.abs(dy) > 3 ? Math.sign(dy) : 0];
      }
      const i = k % COLONNE;
      const j = (k - i) / COLONNE;
      let best = null;
      let bd = dist[k];
      for (const [di, dj] of VICINE) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= COLONNE || nj >= RIGHE) continue;
        const nk = nj * COLONNE + ni;
        if (!libera[nk] || !passa(i, j, di, dj)) continue;
        if (dist[nk] < bd - 0.01) {
          bd = dist[nk];
          best = [di, dj];
        }
      }
      return best || [1, 0];
    },
    // Il punto a `quanto` px di strada più avanti partendo da (x, y).
    avanti(x, y, quanto) {
      let px = x;
      let py = y;
      for (let fatti = 0; fatti < quanto; fatti += CELLA) {
        const [dx, dy] = this.direzione(px, py);
        if (!dx && !dy) break;
        const m = Math.hypot(dx, dy);
        px += (dx / m) * CELLA;
        py += (dy / m) * CELLA;
        if (px >= ARENA.traguardo) break;
      }
      return [px, py];
    },
    // Si va dritti da A a B senza toccare scogli (o meduse)?
    dritto(ax, ay, bx, by) {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELLA * 0.5));
      for (let s = 0; s <= n; s++) {
        const k = cella(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n);
        if (k < 0 || !libera[k]) return false;
      }
      return true;
    },
  };
}
