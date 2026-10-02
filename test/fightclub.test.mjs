// Regole di Fight Club: calendario dei duelli, cursore, zone e punti.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroDuelli,
  calendario,
  tri,
  faseVerso,
  qualita,
  prossimaZona,
  velocita,
  larghezza,
  precisione,
  puntiDuello,
  capienza,
  MODI,
  PUNTI,
} from '../public/games/fightclub/regole.js';

test('numero di duelli: vicino a 8 e tutti combattono lo stesso numero di volte', () => {
  for (let n = 3; n <= 16; n++) {
    const d = numeroDuelli(n);
    assert.ok(d >= 6 && d <= 12, `${n} giocatori: ${d} duelli`);
    if (n !== 13 && n !== 15) assert.equal((2 * d) % n, 0, `${n} giocatori: ${d} duelli non si dividono`);
  }
  assert.equal(numeroDuelli(16), 8);
  assert.equal(numeroDuelli(4), 8);
  assert.equal(numeroDuelli(3), 9);
});

test('calendario: tutti in arena, conti pari, niente duelli con sé stessi', () => {
  for (let n = 3; n <= 16; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    for (let prova = 0; prova < 30; prova++) {
      const cal = calendario(ids);
      const volte = Object.fromEntries(ids.map((id) => [id, 0]));
      cal.forEach((d, i) => {
        assert.notEqual(d.a, d.b);
        assert.ok(MODI[d.modo]);
        volte[d.a]++;
        volte[d.b]++;
        // da 4 giocatori nessuno combatte tre duelli di fila
        if (n >= 4 && i > 1) assert.ok(![d.a, d.b].some((x) => [cal[i - 1], cal[i - 2]].every((p) => p.a === x || p.b === x)), `${n} giocatori: tre duelli di fila`);
      });
      const v = Object.values(volte);
      assert.ok(Math.min(...v) >= 1, 'qualcuno non combatte mai');
      assert.ok(Math.max(...v) - Math.min(...v) <= 1, `${n} giocatori: conti ${v}`);
      if ((2 * cal.length) % n === 0) assert.equal(Math.max(...v), Math.min(...v));
      // coppie varie: in 4 si vedono tutte e 6 le sfide possibili
      if (n === 4) assert.equal(new Set(cal.map((d) => [d.a, d.b].sort().join())).size, 6);
    }
  }
});

test('cursore: onda a triangolo e passaggi', () => {
  assert.equal(tri(0), 0);
  assert.equal(tri(0.5), 0.5);
  assert.equal(tri(1), 1);
  assert.equal(tri(1.5), 0.5);
  assert.equal(tri(2.25), 0.25);
  for (let k = 0; k < 200; k++) {
    const f = Math.random() * 10;
    const x = Math.random();
    const df = faseVerso(f, x);
    assert.ok(df >= 0 && df < 2);
    assert.ok(Math.abs(tri(f + df) - x) < 1e-9);
  }
});

test('zone, tifo e precisione', () => {
  assert.equal(qualita(0.5, 0.5, 0.1), 1);
  assert.equal(qualita(0.65, 0.5, 0.1), null);
  assert.ok(Math.abs(qualita(0.55, 0.5, 0.1) - 0.5) < 1e-9);
  for (let k = 0; k < 300; k++) {
    const x = Math.random();
    const z = prossimaZona(12345, k, x);
    assert.ok(z >= 0.1 && z <= 0.9);
  }
  assert.equal(prossimaZona(7, 3, 0.2), prossimaZona(7, 3, 0.2), 'stesso seme, stessa zona');
  assert.ok(velocita('colpo', 1) < velocita('colpo', 0), 'il tifo rallenta il mirino');
  assert.equal(velocita('braccio', 1), velocita('braccio', 0), 'nel Braccio di Ferro il cursore non rallenta');
  assert.ok(larghezza('braccio', 1) > larghezza('braccio', 0));
  assert.ok(larghezza('legna', 1) > larghezza('legna', 0));
  assert.equal(precisione(0.5), 100);
  assert.equal(precisione(0), 0);
  assert.equal(capienza(1), capienza(2));
  assert.ok(capienza(14) > capienza(2));
});

test('punti del duello', () => {
  // A vince, più tifo, scommesse 2 su A e 1 su B
  let r = puntiDuello({ a: 'A', b: 'B', vincitore: 'A', tifo: [50, 20], scommesse: { x: 0, y: 0, z: 1 } });
  assert.deepEqual(r.punti, { A: PUNTI.vittoria, B: PUNTI.sconfitta, x: 2, y: 2, z: 0 });
  assert.equal(r.miracolo, false);
  // B vince con meno tifo: Miracolo, e chi era in minoranza prende la quota alta
  r = puntiDuello({ a: 'A', b: 'B', vincitore: 'B', tifo: [50, 20], scommesse: { x: 0, y: 0, z: 1 } });
  assert.deepEqual(r.punti, { A: -1, B: 4 + 2, x: 0, y: 0, z: 3 });
  assert.equal(r.miracolo, true);
  // stesso tifo: niente Miracolo; scommesse alla pari: niente quota alta
  r = puntiDuello({ a: 'A', b: 'B', vincitore: 'B', tifo: [10, 10], scommesse: { x: 0, z: 1 } });
  assert.deepEqual(r.punti, { A: -1, B: 4, x: 0, z: 2 });
  // pareggio: nessuno prende niente
  r = puntiDuello({ a: 'A', b: 'B', vincitore: null, tifo: [0, 0], scommesse: { x: 1 } });
  assert.deepEqual(r.punti, { A: 0, B: 0, x: 0 });
});
