// Regole dell'Uomo Nero: labirinto, movimento, luce, Morsa e punti.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  config,
  generaMappa,
  distanze,
  indice,
  aperto,
  muovi,
  vede,
  nelCono,
  velocitaMorsa,
  codifica,
  decodifica,
  scegliRuoli,
  punteggi,
  MORSA,
} from '../public/games/uomonero/regole.js';

test('scaling per numero di giocatori', () => {
  assert.deepEqual([3, 5, 6, 10, 11, 16].map((n) => config(n).batterie), [5, 5, 7, 7, 9, 9]);
  assert.deepEqual([3, 5, 6, 10, 11, 16].map((n) => config(n).durata), [120, 120, 150, 150, 180, 180]);
  assert.equal(config(4).echi, 0);
  assert.ok(config(6).echi >= 6 && config(10).echi <= 8);
  assert.ok(config(11).echi >= 12 && config(16).echi <= 15);
  assert.deepEqual(config(4).poteri, ['urlo']);
  assert.deepEqual(config(8).poteri, ['urlo', 'marchio', 'blackout']);
  assert.equal(config(4).vite, 2);
  assert.equal(config(6).vite, 1);
});

test('labirinto: tutto raggiungibile, batterie e uscita al loro posto, stesso seme = stessa mappa', () => {
  for (const n of [3, 8, 16]) {
    for (let seme = 1; seme <= 20; seme++) {
      const cfg = config(n);
      const m = generaMappa(seme * 7919, cfg, n - 1);
      const d = distanze(m.lab, ...m.partenze[0]);
      assert.ok(d.every((v) => v >= 0), 'ogni casella è raggiungibile');
      assert.equal(m.batterie.length, cfg.batterie);
      assert.equal(new Set(m.batterie.map((b) => b.join())).size, cfg.batterie, 'batterie in caselle diverse');
      assert.equal(m.uscita[0], cfg.colonne - 1, "l'uscita è sul muro di destra");
      assert.equal(m.partenze.length, n - 1);
      // i muri sono coerenti dai due lati
      for (let y = 0; y < m.lab.rig; y++) for (let x = 0; x + 1 < m.lab.col; x++) assert.equal(aperto(m.lab, x, y, 1, 0), aperto(m.lab, x + 1, y, -1, 0));
    }
  }
  const a = generaMappa(42, config(8), 7);
  const b = generaMappa(42, config(8), 7);
  assert.equal(codifica(a.lab), codifica(b.lab));
  assert.deepEqual(decodifica(codifica(a.lab), a.lab.col, a.lab.rig).celle, a.lab.celle);
});

test('movimento nei corridoi: niente muri attraversati, ci si ferma al centro', () => {
  const { lab, partenze } = generaMappa(123, config(4), 3);
  const e = { cx: partenze[0][0], cy: partenze[0][1], dir: null, k: 0, vuole: [0, 0], x: 0, y: 0 };
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]];
  for (let i = 0; i < 3000; i++) {
    if (i % 25 === 0) e.vuole = dirs[Math.floor(Math.random() * dirs.length)];
    const prima = [e.cx, e.cy];
    muovi(lab, e, 0.1);
    const passo = [e.cx - prima[0], e.cy - prima[1]];
    if (passo[0] || passo[1]) assert.ok(Math.abs(passo[0]) + Math.abs(passo[1]) === 1 && aperto(lab, prima[0], prima[1], ...passo), 'passo tra caselle collegate');
  }
  e.vuole = [0, 0];
  for (let i = 0; i < 20; i++) muovi(lab, e, 0.1);
  assert.equal(e.dir, null);
  assert.equal(e.x, e.cx + 0.5);
});

test('la luce non passa i muri', () => {
  const { lab } = generaMappa(99, config(4), 3);
  for (let y = 0; y < lab.rig; y++) {
    for (let x = 0; x + 1 < lab.col; x++) {
      assert.equal(vede(lab, x + 0.5, y + 0.5, x + 1.5, y + 0.5), aperto(lab, x, y, 1, 0));
    }
  }
  // cono: dentro solo davanti
  const x = lab.celle.findIndex((v, i) => aperto(lab, i % lab.col, Math.floor(i / lab.col), 1, 0));
  const cx = x % lab.col;
  const cy = Math.floor(x / lab.col);
  assert.ok(nelCono(lab, { x: cx + 0.5, y: cy + 0.5, ang: 0 }, cx + 1.5, cy + 0.5));
  assert.ok(!nelCono(lab, { x: cx + 0.5, y: cy + 0.5, ang: Math.PI }, cx + 1.5, cy + 0.5));
  assert.equal(indice(lab, cx, cy), x);
});

test('Morsa: 2 secondi senza dimenarsi, 3 al massimo', () => {
  assert.equal(1 / velocitaMorsa(0), MORSA.breve);
  assert.equal(1 / velocitaMorsa(100), MORSA.lunga);
  assert.ok(velocitaMorsa(3) < velocitaMorsa(0));
});

test('ruoli: un solo Uomo Nero, nel torneo chi è più indietro', () => {
  const g = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const r = scegliRuoli(g, { punti: { a: 5, b: 1, c: 3, d: 9 } });
  assert.equal(Object.values(r).filter((x) => x === 'uomonero').length, 1);
  assert.equal(r.b, 'uomonero');
  assert.equal(scegliRuoli(g, { escludi: ['a', 'b', 'c'] }).d, 'uomonero');
});

test("punti: l'Uomo Nero sta sotto chi scappa e sopra chi ha preso", () => {
  const sopr = [
    { id: 'a', fuggito: true, preso: false, batterie: 2, salvataggi: 1 },
    { id: 'b', fuggito: false, preso: true, batterie: 1, salvataggi: 0 },
    { id: 'c', fuggito: false, preso: true, batterie: 0, salvataggi: 0 },
  ];
  const r = punteggi({ boss: 'x', sopr });
  assert.equal(r.punti.a, 7);
  assert.ok(r.punti.x < r.punti.a && r.punti.x > r.punti.b);
  const notte = punteggi({ boss: 'x', sopr: sopr.map((s) => ({ ...s, fuggito: false })) });
  assert.ok(notte.notte && notte.punti.x === 7);
  const tutti = punteggi({ boss: 'x', sopr: sopr.map((s) => ({ ...s, fuggito: true })) });
  assert.equal(tutti.punti.x, 0);
});
