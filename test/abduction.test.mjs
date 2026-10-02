// Regole di Abduction: brucata, raggio, spinte, rapimento, rientro, disco e fine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { config, bottino, bersaglioSpinta, percorso, valoreBrucata, CAMPO, DURATA, T_FURIA, T_BRUCA, T_FUORI, T_RADAR, TOLLERANZA, PUNTI, CD_SPINTA } from '../public/games/abduction/regole.js';
import { creaMondo } from '../public/games/abduction/mondo.js';

const DT = 1 / 30;
const avanti = (mondo, sec) => {
  for (let k = 0; k < Math.round(sec / DT); k++) mondo.passo(DT);
};

// Un campo con il disco fermo (in sosta) in un punto scelto e il giocatore p0 lontano dagli altri.
function campo({ disco = [1300, 800], p0 = [400, 400], n = 3 } = {}) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const mondo = creaMondo({ ids });
  const d = mondo.dischi[0];
  d.x = disco[0];
  d.y = disco[1];
  d.sosta = 1000;
  const io = mondo.giocatori.get('p0').ent;
  io.x = p0[0];
  io.y = p0[1];
  io.ang = 0;
  // niente mucche vere attorno al giocatore e sotto il raggio
  for (const m of mondo.mucche) {
    if (m === io || m.g) continue;
    if (Math.hypot(m.x - io.x, m.y - io.y) < 260 || Math.hypot(m.x - d.x, m.y - d.y) < d.r + 120) m.via = true;
  }
  for (const id of ids.slice(1)) {
    const e = mondo.giocatori.get(id).ent;
    e.x = 900 + Math.random() * 100;
    e.y = 200 + Math.random() * 60;
  }
  return { mondo, d, io, g: mondo.giocatori.get('p0') };
}

test('quante mucche e quanti dischi', () => {
  assert.equal(config(3).mucche, 40);
  assert.equal(config(16).mucche, 80);
  assert.ok(config(8).mucche > 40 && config(8).mucche < 80);
  assert.deepEqual([3, 9, 10, 16].map((n) => config(n).dischi), [1, 1, 2, 2]);
  const m = creaMondo({ ids: ['a', 'b', 'c', 'd'] });
  assert.equal(m.mucche.length, config(4).mucche + 4, 'le mucche dei giocatori si aggiungono a quelle vere');
  assert.equal(m.vere(), config(4).mucche);
});

test('bottino: metà dei punti persi, a multipli di 5', () => {
  assert.deepEqual([0, 10, 30, 80, 90, 210].map(bottino), [0, 5, 15, 40, 45, 105]);
  assert.equal(valoreBrucata(10), PUNTI.bruca);
  assert.equal(valoreBrucata(T_FURIA + 1), PUNTI.furia);
});

test('la testata colpisce solo chi è davanti e vicino', () => {
  const io = { x: 500, y: 500, ang: 0 };
  const davanti = { x: 560, y: 510 };
  const dietro = { x: 440, y: 500 };
  const lontana = { x: 700, y: 500 };
  assert.equal(bersaglioSpinta(io, [io, dietro, lontana]), null);
  const b = bersaglioSpinta(io, [io, dietro, davanti, lontana]);
  assert.equal(b.m, davanti);
  assert.ok(b.dx > 0.9, 'la spinge in avanti');
  assert.equal(bersaglioSpinta(io, [io, { ...davanti, via: true }]), null);
});

test('il giro del disco resta nel campo', () => {
  for (let k = 0; k < 200; k++) {
    const { punti } = percorso({ x: Math.random() * 1600, y: Math.random() * 1000 }, 150);
    assert.ok(punti.length >= 4);
    for (const p of punti) {
      assert.ok(p.x >= CAMPO.x0 && p.x <= CAMPO.x1 && p.y >= CAMPO.y0 && p.y <= CAMPO.y1, `punto fuori: ${p.x}, ${p.y}`);
    }
  }
  const mondo = creaMondo({ ids: ['a', 'b', 'c'] });
  for (let k = 0; k < 60 * 30; k++) {
    mondo.passo(DT);
    if (mondo.t > 3) for (const d of mondo.dischi) assert.ok(d.x >= CAMPO.x0 && d.x <= CAMPO.x1 && d.y >= CAMPO.y0 && d.y <= CAMPO.y1);
  }
});

test('brucata: 3 secondi tenendo premuto = +10, mollare prima = niente', () => {
  const { mondo, g } = campo();
  mondo.input('p0', { b: 1 });
  avanti(mondo, T_BRUCA - 0.3);
  mondo.input('p0', { b: 0 });
  avanti(mondo, 0.5);
  assert.equal(g.punti, 0, 'mollata prima: niente');
  mondo.input('p0', { b: 1 });
  avanti(mondo, T_BRUCA + 0.1);
  assert.equal(g.punti, PUNTI.bruca);
  assert.equal(g.ent.posa, 'pascola');
  avanti(mondo, T_BRUCA);
  assert.equal(g.punti, 2 * PUNTI.bruca, 'tenendo premuto si continua a brucare');
  assert.ok(mondo.eventi.some((e) => e.tipo === 'brucata' && e.id === 'p0'));
});

test('sotto il raggio: immobile = salvo, muoversi o brucare = rapito', () => {
  // immobile sotto il raggio
  let c = campo({ p0: [1300, 800] });
  c.g.punti = 50;
  avanti(c.mondo, 3);
  assert.ok(c.g.ent, 'chi sta fermo non viene preso');
  assert.equal(c.g.ent.posa, 'gelo', 'stessa posa delle mucche vere');
  // un movimento brevissimo si può correggere
  c.mondo.input('p0', { j: [1, 0] });
  avanti(c.mondo, TOLLERANZA * 0.5);
  c.mondo.input('p0', { j: [0, 0] });
  avanti(c.mondo, 1);
  assert.ok(c.g.ent, 'tolleranza: si fa in tempo a fermarsi');
  // muoversi
  c.mondo.input('p0', { j: [1, 0] });
  avanti(c.mondo, TOLLERANZA + 0.1);
  assert.equal(c.g.ent, null, 'chi si muove sotto il raggio viene rapito');
  assert.equal(c.g.punti, 0, 'e perde tutti i punti');
  assert.equal(c.g.persi, 50);
  // brucare
  c = campo({ p0: [1300, 800] });
  c.g.punti = 30;
  c.mondo.input('p0', { b: 1 });
  avanti(c.mondo, TOLLERANZA + 0.1);
  assert.equal(c.g.ent, null, 'chi bruca sotto il raggio viene rapito');
  assert.equal(c.g.punti, 0);
});

test('le mucche vere non vengono mai rapite da sole', () => {
  const mondo = creaMondo({ ids: ['a', 'b', 'c', 'd'] });
  const vere = mondo.vere();
  avanti(mondo, DURATA + 1);
  assert.equal(mondo.vere(), vere);
  assert.ok(mondo.fine);
});

test('spinta nel raggio: la vittima è rapita e chi spinge ruba metà dei punti', () => {
  const { mondo, d, g } = campo({ p0: [1300 - 150 - 80, 800] });
  const vittima = mondo.giocatori.get('p1');
  vittima.ent.x = g.ent.x + 60;
  vittima.ent.y = g.ent.y;
  vittima.punti = 80;
  g.punti = 10;
  assert.ok(Math.hypot(vittima.ent.x - d.x, vittima.ent.y - d.y) > d.r, 'la vittima è appena fuori dal raggio');
  const r = mondo.input('p0', { s: 1 });
  assert.equal(r.esito, 'ok');
  assert.equal(g.cd, CD_SPINTA);
  avanti(mondo, 0.5);
  assert.equal(vittima.ent, null, 'spinta sotto il raggio: presa');
  assert.equal(vittima.punti, 0);
  assert.equal(g.punti, 10 + 40, 'metà degli 80 va a chi ha spinto');
  assert.equal(g.prese, 1);
  const ev = mondo.eventi.find((e) => e.tipo === 'rapito');
  assert.equal(ev.da, 'p0');
  assert.equal(ev.persi, 80);
  // ricarica: subito dopo non si può spingere
  assert.equal(mondo.input('p0', { s: 1 }).esito, 'no');
});

test('spinta fuori dal raggio: interrompe la brucata (0 punti) ma nessuno viene rapito', () => {
  const { mondo, g } = campo({ p0: [400, 400] });
  const vittima = mondo.giocatori.get('p1');
  vittima.ent.x = g.ent.x + 60;
  vittima.ent.y = g.ent.y;
  mondo.input('p1', { b: 1 });
  avanti(mondo, T_BRUCA - 0.5);
  mondo.input('p0', { s: 1 });
  avanti(mondo, 1);
  assert.ok(vittima.ent, 'nessun raggio: nessun rapimento');
  assert.equal(vittima.punti, 0, 'brucata interrotta');
  assert.equal(vittima.bruca, false, 'bisogna ripremere BRUCA');
  assert.ok(Math.abs(vittima.ent.x - (g.ent.x + 60 + 72)) < 3, 'spostata di una casella');
  // a vuoto: nessuna ricarica
  const solo = campo({ p0: [400, 400] });
  assert.equal(solo.mondo.input('p0', { s: 1 }).esito, 'vuoto');
  assert.equal(solo.g.cd, 0);
});

test('spingere una mucca vera nel raggio: se la prende il disco', () => {
  const { mondo, d, g } = campo({ p0: [1300 - 150 - 60, 800] });
  const vera = mondo.mucche.find((m) => m.via && !m.g);
  Object.assign(vera, { via: false, x: g.ent.x + 60, y: g.ent.y, stato: 'fermo', timer: 5, gelo: 0 });
  const prima = mondo.vere();
  mondo.input('p0', { s: 1 });
  avanti(mondo, 2);
  assert.equal(mondo.vere(), prima - 1);
  assert.ok(Math.hypot(vera.x - d.x, vera.y - d.y) <= d.r + 5);
  assert.equal(g.punti, 0, 'nessun bottino');
});

test('rientro: dopo 3 s prendi il posto di una mucca vera lontana dal raggio, con il radar', () => {
  const { mondo, d, g } = campo({ p0: [1300, 800] });
  const vere = mondo.vere();
  mondo.input('p0', { j: [1, 0] });
  avanti(mondo, TOLLERANZA + 0.1);
  assert.equal(g.ent, null);
  assert.ok(g.fuori > 0);
  mondo.input('p0', { b: 1, j: [1, 0] });
  assert.equal(g.bruca, false, 'da fuori non si bruca');
  avanti(mondo, T_FUORI);
  assert.ok(g.ent, 'è rientrato');
  assert.equal(g.ent.g, 'p0');
  assert.equal(mondo.vere(), vere - 1, 'una mucca vera in meno');
  assert.ok(Math.hypot(g.ent.x - d.x, g.ent.y - d.y) > d.r + 200, 'lontano dal raggio');
  assert.ok(g.radar > T_RADAR - 0.5, 'il radar si riaccende');
});

test('ultimi 15 secondi: il disco si arrabbia e la brucata vale di più; fine a 60 s', () => {
  const { mondo, g } = campo();
  avanti(mondo, T_FURIA + 0.1);
  assert.ok(mondo.furia);
  mondo.input('p0', { b: 1 });
  avanti(mondo, T_BRUCA + 0.1);
  assert.equal(g.punti, PUNTI.furia);
  avanti(mondo, DURATA);
  assert.ok(mondo.fine);
  assert.ok(Math.abs(mondo.t - DURATA) < 0.1);
  const punti = g.punti;
  mondo.input('p0', { b: 1 });
  avanti(mondo, 5);
  assert.equal(g.punti, punti, 'a tempo scaduto non si fanno più punti');
});
