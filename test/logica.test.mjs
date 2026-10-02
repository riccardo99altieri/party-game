// Test delle regole: punti in classifica, pari merito, punteggi delle prove.

import test from 'node:test';
import assert from 'node:assert/strict';
import { puntiDaGruppi, gruppiDaPunteggi, posizioniDaGruppi, deltaE2000, griglia, seeded, dir8 } from '../public/shared/util.js';
import { punteggioCerchio, punteggioTaglio, punteggioPunti, creaPunti, creaForma, area } from '../public/games/manoferma/logica.js';
import { esitoRound, massimo, BONUS } from '../public/games/unico/logica.js';
import { punteggioColore } from '../public/games/colore/host.js';
import { creaPercorso, LIVELLI } from '../public/games/filo/percorso.js';
import { configPolpo, scegliRuoli, punteggi, generaFondale } from '../public/games/polpo/regole.js';
import { creaPercorso as creaPercorsoPolpo } from '../public/games/polpo/percorso.js';
import { bombePer, vitePer, creaSequenza, inizioDisplay, display, velocita, GESTI, LUNGHEZZA } from '../public/games/bomba/regole.js';
import * as MI from '../public/games/pollici/pista.js';

test('punti: 1 per ogni avversario battuto, +2 al vincitore', () => {
  const p = puntiDaGruppi([['a'], ['b'], ['c'], ['d']]);
  assert.deepEqual(p, { a: 5, b: 2, c: 1, d: 0 });
});

test('punti: i pari merito prendono gli stessi punti', () => {
  const p = puntiDaGruppi([['a', 'b'], ['c'], ['d', 'e']]);
  assert.deepEqual(p, { a: 5, b: 5, c: 2, d: 0, e: 0 });
});

test('punti doppi', () => {
  assert.deepEqual(puntiDaGruppi([['a'], ['b'], ['c']], 2), { a: 8, b: 2, c: 0 });
});

test('classifica da punteggi, con pari merito e ordine crescente', () => {
  assert.deepEqual(gruppiDaPunteggi({ a: 10, b: 30, c: 10 }), [['b'], ['a', 'c']]);
  assert.deepEqual(gruppiDaPunteggi({ a: 3.2, b: 1.1, c: 2 }, false), [['b'], ['c'], ['a']]);
  assert.deepEqual(posizioniDaGruppi([['b'], ['a', 'c'], ['d']]), { b: 1, a: 2, c: 2, d: 4 });
});

test('griglia: n riquadri che non escono dall’area', () => {
  for (const n of [1, 3, 8, 13, 16]) {
    const celle = griglia(n, 0, 0, 1800, 900, { rapporto: 0.8 });
    assert.equal(celle.length, n);
    for (const c of celle) {
      assert.ok(c.x >= -1e-6 && c.y >= -1e-6 && c.x + c.w <= 1800 + 1e-6 && c.y + c.h <= 900 + 1e-6);
    }
  }
});

test('generatore con seme: stessi numeri su schermo e telefoni', () => {
  const a = seeded(42);
  const b = seeded(42);
  for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next());
});

test('CIEDE2000: valore di riferimento (Sharma et al.)', () => {
  const d = deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]);
  assert.ok(Math.abs(d - 2.0425) < 1e-3, `ottenuto ${d}`);
  assert.equal(punteggioColore([120, 40, 200], [120, 40, 200]).punti, 100);
  assert.ok(punteggioColore([255, 0, 0], [0, 0, 255]).punti < 10);
});

test('cerchio perfetto = 100, mezzo cerchio = 0, cerchio tremolante in mezzo', () => {
  const cerchio = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    cerchio.push([500 + Math.cos(a) * 300, 500 + Math.sin(a) * 300]);
  }
  assert.equal(punteggioCerchio(cerchio).punti, 100);
  assert.equal(punteggioCerchio(cerchio.slice(0, 60)).punti, 0);
  const tremolante = cerchio.map(([x, y], i) => [x + Math.sin(i) * 12, y + Math.cos(i * 1.7) * 12]);
  const v = punteggioCerchio(tremolante).punti;
  assert.ok(v > 70 && v < 100, `ottenuto ${v}`);
});

test('taglio: a metà = 100, fuori dalla forma = 0', () => {
  const quadrato = [
    [200, 200],
    [800, 200],
    [800, 800],
    [200, 800],
  ];
  assert.equal(punteggioTaglio(quadrato, [500, 0, 500, 1000]).punti, 100);
  assert.equal(punteggioTaglio(quadrato, [440, 0, 440, 1000]).punti, 70);
  assert.equal(punteggioTaglio(quadrato, [900, 0, 900, 1000]).punti, 0);
  assert.ok(area(creaForma(7)) > 50000);
});

test('punti a memoria: tocchi esatti = 100, nessun tocco = 0', () => {
  const veri = creaPunti(1234);
  assert.equal(veri.length, 5);
  assert.equal(punteggioPunti(veri, [...veri].reverse()).punti, 100);
  assert.equal(punteggioPunti(veri, []).punti, 0);
});

test('il più alto unico: doppioni a zero, bonus al più alto unico', () => {
  const { punti, migliore } = esitoRound({ a: 10, b: 10, c: 7, d: 3 });
  assert.equal(migliore, 7);
  assert.deepEqual(punti, { a: 0, b: 0, c: 7 + BONUS, d: 3 });
  assert.equal(esitoRound({ a: 2, b: 2 }).migliore, null);
  assert.equal(massimo(4), 10);
  assert.equal(massimo(16), 20);
});

test('filo scottante: percorsi dentro il riquadro e uguali a parità di seme', () => {
  for (let liv = 0; liv < LIVELLI.length; liv++) {
    const a = creaPercorso(99, liv);
    const b = creaPercorso(99, liv);
    assert.deepEqual(a, b);
    for (const [x, y] of a.punti) assert.ok(x >= 0 && x <= 1000 && y >= 0 && y <= 1600);
  }
});

// ---------------------------------------------------------------------------
// Il Polpo

test('joystick a scatti: 8 direzioni e zona morta', () => {
  assert.deepEqual(dir8(0.1, 0.05), [0, 0]);
  assert.deepEqual(dir8(0.9, 0.1), [1, 0]);
  assert.deepEqual(dir8(0.7, 0.7), [1, 1]);
  assert.deepEqual(dir8(-0.2, -0.95), [0, -1]);
  assert.deepEqual(dir8(-0.8, 0.6), [-1, 1]);
});

test('Il Polpo: quanti Polpi, quanto forti e quante bolle', () => {
  assert.deepEqual([3, 6, 7, 9, 10, 12, 13, 16].map((n) => configPolpo(n).polpi), [1, 1, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual([3, 6, 7, 9, 10, 12, 13, 16].map((n) => configPolpo(n).potenziato), [false, false, true, true, false, false, true, true]);
  assert.equal(configPolpo(6).energiaMax, 6);
  assert.equal(configPolpo(8).energiaMax, 8);
  assert.equal(configPolpo(8).ricarica, 2.5);
  assert.equal(configPolpo(8).presiTentacolo, 2);
  assert.equal(configPolpo(12).maxMeduse, 2);
  assert.equal(configPolpo(13).maxMeduse, 3);
  assert.equal(configPolpo(9).corsie, 1);
  assert.equal(configPolpo(10).corsie, 3);
  // più pesci deve inseguire ogni Polpo, meno bolle servono per catturarne uno
  assert.ok(configPolpo(3).bolle > configPolpo(6).bolle);
  for (let n = 3; n <= 16; n++) assert.ok(configPolpo(n).bolle >= 2);
});

test('Il Polpo: chi fa il Polpo', () => {
  const g = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const polpi = (r) => Object.keys(r).filter((id) => r[id] === 'polpo');
  // torneo: tocca a chi ha meno punti
  assert.deepEqual(polpi(scegliRuoli(g, { punti: { a: 9, b: 2, c: 5, d: 7, e: 3 } })), ['b']);
  // a parità di punti, a chi l'ha fatto meno volte
  assert.deepEqual(polpi(scegliRuoli(g, { punti: { a: 1, b: 1, c: 5, d: 7, e: 3 }, volte: { a: 2 } })), ['b']);
  // "Cambia Polpo": chi è escluso non viene scelto
  assert.deepEqual(polpi(scegliRuoli(g, { punti: { a: 9, b: 2, c: 5, d: 7, e: 3 }, escludi: ['b'] })), ['e']);
  // tutti gli altri sono pesci; con 10 o più giocatori i Polpi sono due
  const r = scegliRuoli(g);
  assert.equal(polpi(r).length, 1);
  assert.equal(Object.values(r).filter((x) => x === 'pesce').length, 4);
  const tanti = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));
  assert.equal(polpi(scegliRuoli(tanti)).length, 2);
});

test('Il Polpo: punteggi, Fuga perfetta e Schiacciamento', () => {
  const p = (id, arrivato, coralli = 0, catturato = false) => ({ id, arrivato, coralli, catturato });
  // metà arrivati: il Polpo sta sopra chi ha fermato e sotto chi è arrivato
  let e = punteggi({ polpi: ['P'], pesci: [p('a', true), p('b', true, 1), p('c', false), p('d', false, 0, true)] });
  assert.equal(e.arrivati, 2);
  assert.equal(e.fermati, 2);
  assert.deepEqual([e.punti.a, e.punti.b, e.punti.c, e.punti.d], [1, 2, 0, 0]);
  assert.equal(e.punti.P, 0.5);
  assert.deepEqual(gruppiDaPunteggi(e.punti), [['b'], ['a'], ['P'], ['c', 'd']]);
  assert.match(e.dettagli.d, /Catturato/);
  // un corallo vale anche per chi non arriva: batte il Polpo che non ha fermato tutti
  e = punteggi({ polpi: ['P'], pesci: [p('a', true), p('b', false, 1)] });
  assert.ok(e.punti.b > e.punti.P);
  // Fuga perfetta: +2 a tutti i pesci, −1 al Polpo
  e = punteggi({ polpi: ['P'], pesci: [p('a', true), p('b', true, 2)] });
  assert.ok(e.fuga);
  assert.deepEqual([e.punti.a, e.punti.b, e.punti.P], [3, 5, -1]);
  // Schiacciamento: +2 al Polpo (a testa, se sono due)
  e = punteggi({ polpi: ['P', 'Q'], pesci: [p('a', false), p('b', false, 0, true), p('c', false, 1)] });
  assert.ok(e.schiaccia);
  assert.equal(e.punti.P, 3);
  assert.equal(e.punti.Q, 3);
  assert.equal(gruppiDaPunteggi(e.punti)[0].sort().join(), 'P,Q');
});

test('Il Polpo: il fondale lascia sempre passare i pesci', () => {
  for (const corsie of [1, 3]) {
    for (let seme = 1; seme <= 25; seme++) {
      const f = generaFondale(seme * 7919, corsie);
      const strada = creaPercorsoPolpo(f, { raggio: 26 * (corsie === 3 ? 0.72 : 1) });
      for (const c of f.corsie) {
        for (let y = c.y0 + 30; y < c.y1 - 30; y += 30) assert.ok(strada.strada(100, y) < Infinity, `corsie ${corsie}, seme ${seme}, y ${y}`);
      }
    }
  }
});

test('Detonazione: quante bombe e quante vite', () => {
  assert.deepEqual([3, 6, 7, 11, 12, 16].map(bombePer), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual([3, 4, 5, 6, 16].map(vitePer), [3, 2, 2, 1, 1]);
  // c'è sempre almeno un giocatore libero a cui passare la bomba
  for (let v = 2; v <= 16; v++) assert.ok(bombePer(v) < v);
});

test('Detonazione: sequenze di gesti valide', () => {
  for (let i = 0; i < 500; i++) {
    const seq = creaSequenza();
    assert.equal(seq.length, LUNGHEZZA);
    for (let k = 0; k < seq.length; k++) {
      assert.ok(GESTI[seq[k]], `gesto sconosciuto ${seq[k]}`);
      if (k) assert.notEqual(seq[k], seq[k - 1], 'due gesti uguali di fila');
    }
    assert.ok(seq.filter((g) => g === 'tieni').length <= 1);
    assert.ok(seq.filter((g) => g === 'pizzica').length <= 1);
  }
});

test('Detonazione: il timer accelera e arriva a zero esattamente alla fine', () => {
  for (const T of [10, 13.5, 17]) {
    const B0 = inizioDisplay(T);
    assert.ok(B0 > T);
    assert.ok(Math.abs(display(B0, T)) < 1e-9);
    assert.ok(display(B0, T / 2) > 0);
    assert.ok(velocita(T) > velocita(0));
  }
});

test('Mani Incrociate: percorso sempre uguale dal seme, dentro lo schermo, con gli incroci', () => {
  for (const seme of [1, 7, 42, 1234, 99999, 500000000]) {
    const a = MI.creaPista(seme);
    const b = MI.creaPista(seme);
    let incroci = 0;
    let prima = 0;
    for (let k = 0; k <= (MI.LUNGHEZZA + 1) * 100; k++) {
      const c = k / 100;
      const [r, bl] = a.pos(c);
      assert.deepEqual([r, bl], b.pos(c));
      assert.ok(r >= 0.1 && r <= 0.9 && bl >= 0.1 && bl <= 0.9, `binario troppo vicino al bordo a ${c}`);
      // fuori dagli incroci i binari restano lontani, così i pollici non si urtano
      const fig = a.figure.find((f) => c >= f.s0 && c <= f.s1);
      if (!fig || !MI.INCROCI.includes(fig.tipo)) assert.ok(bl - r >= MI.MIN_SEP - 1e-9, `binari troppo vicini a ${c}`);
      const segno = Math.sign(bl - r);
      if (segno && prima && segno !== prima) incroci++;
      if (segno) prima = segno;
    }
    assert.ok(incroci >= 4, `solo ${incroci} incroci`);
    assert.deepEqual(a.pos(0.5), MI.COMODO, 'si parte comodi');
    assert.ok(a.figure.at(-1).s1 <= MI.LUNGHEZZA, "l'ultima figura finisce prima del traguardo");
    assert.ok(a.fine >= MI.LUNGHEZZA + 1, 'il percorso continua oltre il traguardo (si vede sul telefono)');
    for (const o of a.ostacoli) assert.ok(o.s > 0 && o.s < MI.LUNGHEZZA);
  }
});

test('Mani Incrociate: dopo un errore i binari ripartono comodi', () => {
  const p = MI.creaPista(77);
  for (const sR of [3.3, 10.1, 20.7]) {
    for (let k = 0; k <= 14; k++) assert.deepEqual(p.pos(sR - 0.3 + k * 0.05, sR), MI.COMODO);
    assert.deepEqual(p.pos(sR + 2, sR), p.pos(sR + 2));
  }
});

test('Mani Incrociate: combo, velocità e distanza dal binario', () => {
  assert.equal(MI.combo(0), 1);
  assert.equal(MI.combo(100), MI.COMBO_MAX);
  assert.ok(MI.combo(5) > 1 && MI.combo(5) < MI.COMBO_MAX);
  assert.ok(MI.velocita(MI.LUNGHEZZA) > MI.velocita(0));
  assert.ok(MI.semiLarghezza(MI.LUNGHEZZA) < MI.semiLarghezza(0));
  const p = MI.creaPista(5);
  const w = 390;
  const h = 760;
  const y = MI.RIF * h;
  const [r] = p.pos(0.5);
  const centro = MI.distanza(p, 0, r * w, y, 0.5, 0, w, h);
  assert.ok(centro.d < 1);
  const lato = MI.distanza(p, 0, r * w + centro.semi * 2, y, 0.5, 0, w, h);
  assert.ok(lato.d > centro.semi * MI.TOLLERANZA, 'a due mezze larghezze di lato si è fuori');
});
