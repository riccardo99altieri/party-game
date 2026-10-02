// Regole di Trova l'Intruso: passanti, pugni, monete, acqua alta, curiosi, punti e round.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  config,
  puntiRound,
  nuoveVoci,
  pianoZona,
  raggioZona,
  prossimoRaggio,
  dirVerso,
  spostamento,
  libero,
  R_FINALE,
  LARGA,
  ALTA,
  VEL,
  DURATA,
  T_ERRORE,
  T_MONETA,
  PUNTI,
  ZONA,
} from '../public/games/intruso/regole.js';
import { PAUSA_MAX } from '../public/games/intruso/folla.js';
import { creaMondo } from '../public/games/intruso/mondo.js';

const DT = 1 / 30;

// Un mondo con i giocatori dati e (se serve) senza passanti tra i piedi.
function mondo(ids = ['a', 'b', 'c'], { senzaPassanti = false } = {}) {
  const M = creaMondo({ ids });
  M.nuovoRound();
  if (senzaPassanti) for (const e of M.ents) if (e.tipo === 'npc') e.vivo = false, (e.morte = { t: 0, causa: 'test' });
  return M;
}
const ent = (M, id) => M.giocatori.get(id).ent;
const metti = (e, x, y, face = [1, 0]) => {
  e.x = x;
  e.y = y;
  e.face = face;
  e.ancora = { x, y };
};
const passa = (M, secondi, prima = () => {}) => {
  for (let t = 0; t < secondi && !M.fine; t += DT) {
    prima();
    M.passo(DT);
  }
};

test('passanti e monete secondo i giocatori', () => {
  assert.deepEqual([3, 6, 7, 11, 12, 16].map((n) => config(n).npc), [40, 40, 60, 60, 80, 80]);
  assert.deepEqual([3, 9, 16].map((n) => config(n).monete), [2, 3, 4]);
  assert.deepEqual([3, 9, 16].map((n) => config(n).ogni), [8, 8, 6]);
});

test('punti di un round', () => {
  const v = { ...nuoveVoci(), tick: 9, monete: 2, kill: 2, errori: 1, vivo: 2 };
  assert.equal(puntiRound(v), 9 + 2 + 6 - 1 + 2);
  assert.equal(puntiRound({ ...nuoveVoci(), tick: 4, ultimo: PUNTI.ultimo, podio: PUNTI.podio }), 4 + 5 + 2);
});

test("l'acqua alta: annuncio a 55 s, tre passi, il cerchio finale è circa un quarto della piazza", () => {
  for (let k = 0; k < 20; k++) {
    const p = pianoZona(Math.random);
    assert.equal(raggioZona(p, 0), p.raggi[0]);
    assert.equal(raggioZona(p, 59), p.raggi[0]);
    assert.equal(prossimoRaggio(p, 54), null);
    assert.equal(prossimoRaggio(p, 56), p.raggi[1]);
    assert.ok(raggioZona(p, 62) < p.raggi[0] && raggioZona(p, 62) > p.raggi[1]);
    assert.equal(raggioZona(p, 66), p.raggi[1]);
    assert.equal(prossimoRaggio(p, 66), p.raggi[2]);
    assert.equal(raggioZona(p, 76), p.raggi[2]);
    assert.equal(raggioZona(p, 85), p.raggi[3]);
    assert.equal(prossimoRaggio(p, 85), null);
    // all'inizio non c'è acqua da nessuna parte; il cerchio finale sta dentro la piazza
    for (const [x, y] of [[60, 120], [1860, 120], [60, 1050], [1860, 1050]]) assert.ok(Math.hypot(x - p.cx, y - p.cy) < p.raggi[0]);
    assert.ok(p.cy - R_FINALE >= 120 && p.cy + R_FINALE <= 1050 && p.cx - R_FINALE >= 60 && p.cx + R_FINALE <= 1860);
  }
  const quarto = (Math.PI * R_FINALE * R_FINALE) / (LARGA * ALTA);
  assert.ok(Math.abs(quarto - 0.25) < 0.01, `il cerchio finale copre ${quarto}`);
  assert.equal(ZONA.passi.length, 3);
});

test('8 direzioni: prima in diagonale poi dritto, e la diagonale non è più veloce', () => {
  assert.deepEqual(dirVerso(null, 100, 50), [1, 1]);
  assert.deepEqual(dirVerso(null, 100, 2), [1, 0]);
  assert.deepEqual(dirVerso(null, -3, -80), [0, -1]);
  assert.deepEqual(dirVerso(null, 1, 1), [0, 0]);
  const [dx, dy] = spostamento([1, 1], 1);
  assert.ok(Math.abs(Math.hypot(dx, dy) - VEL) < 1e-9);
  assert.ok(Math.abs(spostamento([1, 0], 1)[0] - VEL) < 1e-9);
});

test('i passanti si muovono solo in 8 direzioni, alla velocità di tutti, e non stanno mai fermi più di 3 s', () => {
  const M = mondo(['a', 'b', 'c']);
  // i giocatori camminano (così nessun passante si incuriosisce)
  const fermi = new Map();
  let massimo = 0;
  passa(M, 50, () => {
    for (const g of M.giocatori.values()) M.input(g.id, { j: [Math.round(Math.sin(M.t)), Math.round(Math.cos(M.t))] });
    for (const e of M.ents) {
      if (e.tipo !== 'npc' || !e.vivo) continue;
      for (const c of e.dir) assert.ok(c === -1 || c === 0 || c === 1, `direzione non valida ${e.dir}`);
      const fermo = !e.dir[0] && !e.dir[1] && e.steso <= 0 && !e.curioso && !e.fuga;
      const f = fermo ? (fermi.get(e) || 0) + DT : 0;
      fermi.set(e, f);
      if (M.t > 3) massimo = Math.max(massimo, f);
    }
  });
  assert.ok(massimo <= PAUSA_MAX + 0.1, `un passante è rimasto fermo ${massimo.toFixed(2)} s`);
  for (const e of M.ents) assert.ok(libero(e.x, e.y, -1), 'nessuno dentro un ostacolo');
});

test('pugno a un giocatore: è fuori e chi colpisce prende +3', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  metti(ent(M, 'a'), 900, 300, [1, 0]);
  metti(ent(M, 'b'), 935, 300);
  metti(ent(M, 'c'), 1500, 700);
  const r = M.input('a', { p: 1 });
  assert.equal(r.esito, 'kill');
  assert.equal(ent(M, 'b').vivo, false);
  assert.equal(M.giocatori.get('b').morte.da, 'a');
  assert.equal(M.giocatori.get('a').voci.kill, 1);
  assert.ok(M.eventi.some((e) => e.tipo === 'kill' && e.id === 'a' && e.chi === 'b'));
  // subito dopo non si può ripetere (ricarica)
  metti(ent(M, 'c'), 935, 300);
  assert.equal(M.input('a', { p: 1 }).esito, 'no');
});

test('pugno a un passante: −1, fermo e rosso per 2 s davanti a tutti; il passante va a terra', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  const npc = M.ents.find((e) => e.tipo === 'npc');
  npc.vivo = true;
  npc.morte = null;
  metti(ent(M, 'a'), 900, 300, [1, 0]);
  metti(npc, 935, 300);
  metti(ent(M, 'b'), 1500, 700);
  metti(ent(M, 'c'), 300, 700);
  assert.equal(M.input('a', { p: 1 }).esito, 'errore');
  const a = ent(M, 'a');
  assert.equal(a.rosso, T_ERRORE);
  assert.ok(npc.steso > 0);
  assert.ok(M.eventi.some((e) => e.tipo === 'errore' && e.id === 'a'));
  // fermo anche se spinge il joystick
  const x0 = a.x;
  passa(M, 1.5, () => M.input('a', { j: [1, 0] }));
  assert.equal(a.x, x0);
  passa(M, 1, () => M.input('a', { j: [1, 0] }));
  assert.ok(a.x > x0, 'dopo 2 s si riparte');
  assert.equal(puntiRound(M.giocatori.get('a').voci) - M.giocatori.get('a').voci.tick, PUNTI.errore);
});

test('pugno senza nessuno vicino: non succede niente (niente ricarica, niente animazione)', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  metti(ent(M, 'a'), 900, 300);
  metti(ent(M, 'b'), 1500, 700);
  assert.equal(M.input('a', { p: 1 }).esito, 'vuoto');
  assert.equal(ent(M, 'a').cd, 0);
  assert.equal(ent(M, 'a').pugno, 0);
});

test('il pugno va a chi sta davanti', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  metti(ent(M, 'a'), 900, 400, [-1, 0]);
  metti(ent(M, 'b'), 935, 400); // dietro, un po' più vicino
  metti(ent(M, 'c'), 862, 400); // davanti
  assert.equal(M.input('a', { p: 1 }).chi, 'c');
});

test('le monete le prendono solo i giocatori e spariscono dopo 5 s', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  for (const g of M.giocatori.values()) metti(g.ent, 300 + 400 * ['a', 'b', 'c'].indexOf(g.id), 600);
  passa(M, 4.05);
  assert.equal(M.monete.length, 2, 'a 4 s compaiono le prime monete (2 con 3 giocatori)');
  const [m1, m2] = M.monete;
  // un passante ci passa sopra: resta
  const npc = M.ents.find((e) => e.tipo === 'npc');
  npc.vivo = true;
  metti(npc, m2.x, m2.y);
  metti(ent(M, 'a'), m1.x, m1.y);
  M.passo(DT);
  assert.equal(M.giocatori.get('a').voci.monete, 1);
  assert.ok(!M.monete.includes(m1));
  assert.ok(M.monete.includes(m2));
  npc.vivo = false;
  passa(M, T_MONETA);
  assert.ok(!M.monete.includes(m2), 'scaduta');
});

test("chi resta nell'acqua per 3 s viene portato via", () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  const c = { x: M.piano.cx, y: M.piano.cy };
  metti(ent(M, 'a'), c.x + 30, c.y);
  metti(ent(M, 'b'), c.x - 30, c.y);
  M.t = 85; // il cerchio è quello finale
  // un punto libero appena fuori dal cerchio
  let a = 0;
  while (!libero(c.x + Math.cos(a) * (M.raggio() + 15), c.y + Math.sin(a) * (M.raggio() + 15), 2)) a += 0.2;
  const fuori = () => {
    const e = ent(M, 'c');
    e.x = c.x + Math.cos(a) * (M.raggio() + 15);
    e.y = c.y + Math.sin(a) * (M.raggio() + 15);
  };
  passa(M, 2.9, fuori);
  assert.equal(ent(M, 'c').vivo, true);
  passa(M, 0.3, fuori);
  assert.equal(ent(M, 'c').vivo, false);
  assert.equal(M.giocatori.get('c').morte.causa, 'acqua');
});

test('chi sta fermo più di 3 s si ritrova i passanti incuriositi intorno', () => {
  const M = mondo(['a', 'b', 'c']);
  const a = ent(M, 'a');
  // qualche passante vicino a lui
  const vicini = M.ents.filter((e) => e.tipo === 'npc').slice(0, 6);
  vicini.forEach((e, k) => metti(e, a.x + Math.cos(k) * 90, a.y + Math.sin(k) * 90));
  for (const e of M.ents) if (!libero(e.x, e.y)) metti(e, 960, 300 + e.i);
  M.t = 6; // dopo la grazia iniziale
  passa(M, 2.5);
  assert.equal(M.ents.filter((e) => e.curioso && e.curioso.ent === a).length, 0, 'prima dei 3 s nessuno');
  passa(M, 2);
  assert.ok(M.ents.filter((e) => e.curioso && e.curioso.ent === a).length >= 2, 'dopo 3 s arrivano i curiosi');
  assert.ok(M.tv().anelli.length >= 1, 'sulla TV si vede l\'anello');
  // si rimette a camminare: i curiosi se ne vanno
  passa(M, 3, () => M.input('a', { j: [1, 0] }));
  assert.equal(M.ents.filter((e) => e.curioso && e.curioso.ent === a).length, 0);
});

test("fine round: l'ultimo rimasto prende +5; allo scadere i vivi prendono +2", () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  metti(ent(M, 'a'), 900, 300, [1, 0]);
  metti(ent(M, 'b'), 935, 300);
  metti(ent(M, 'c'), 1500, 700);
  M.input('a', { p: 1 });
  ent(M, 'a').cd = 0;
  ent(M, 'a').blocco = 0;
  metti(ent(M, 'c'), 865, 300);
  ent(M, 'a').face = [-1, 0];
  M.input('a', { p: 1 });
  M.passo(DT);
  assert.equal(M.fine.motivo, 'ultimo');
  const r = M.giocatori.get('a').rounds[0];
  assert.equal(r.ultimo, PUNTI.ultimo);
  assert.equal(r.kill, 2);
  assert.equal(M.giocatori.get('a').tot, r.punti);

  const T = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  passa(T, DURATA + 1, () => {
    // tutti al centro, camminando avanti e indietro
    for (const g of T.giocatori.values()) T.input(g.id, { j: [Math.sin(T.t * 2) > 0 ? 1 : -1, 0] });
    if (T.t > 50) for (const g of T.giocatori.values()) metti(g.ent, T.piano.cx + ['a', 'b', 'c'].indexOf(g.id) * 60 - 60, T.piano.cy, g.ent.face);
  });
  assert.equal(T.fine.motivo, 'tempo');
  for (const g of T.giocatori.values()) {
    assert.equal(g.rounds[0].vivo, PUNTI.vivo);
    assert.equal(g.rounds[0].tick, 9, '+1 ogni 10 s per 90 s');
  }
});

test('bonus "ultimi 3" solo da 6 giocatori in su', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const M = mondo(ids, { senzaPassanti: true });
  ids.forEach((id, k) => metti(ent(M, id), 200 + k * 250, 600));
  for (const id of ['d', 'e', 'f']) {
    ent(M, id).vivo = false;
    ent(M, id).morte = { t: 0, causa: 'test' };
  }
  M.passo(DT);
  for (const id of ['a', 'b', 'c']) assert.equal(M.giocatori.get(id).voci.podio, PUNTI.podio);
  const P = mondo(['a', 'b', 'c', 'd', 'e'], { senzaPassanti: true });
  P.passo(DT);
  assert.ok([...P.giocatori.values()].every((g) => g.voci.podio === 0));
});

test('la TV non dice chi è un giocatore: niente nomi né tipi, e gli indici sono mescolati', () => {
  const M = mondo(['a', 'b', 'c']);
  const v = M.tv();
  for (const e of v.ents) {
    assert.ok(!('tipo' in e) && !('id' in e));
  }
  // in 30 round i giocatori non stanno sempre nelle prime posizioni
  let primi = 0;
  for (let k = 0; k < 30; k++) {
    M.nuovoRound();
    if (M.ents.slice(0, 3).every((e) => e.tipo === 'g')) primi++;
  }
  assert.ok(primi < 3);
});

test('a ogni round si riparte: tutti vivi, voci azzerate, totale che si somma', () => {
  const M = mondo(['a', 'b', 'c'], { senzaPassanti: true });
  metti(ent(M, 'a'), 900, 300, [1, 0]);
  metti(ent(M, 'b'), 935, 300);
  M.input('a', { p: 1 });
  M.t = DURATA;
  M.passo(DT);
  assert.ok(M.fine);
  const tot = M.giocatori.get('a').tot;
  assert.ok(tot > 0);
  M.nuovoRound();
  assert.equal(M.round, 1);
  assert.ok(!M.fine);
  assert.ok([...M.giocatori.values()].every((g) => g.ent.vivo && g.voci.kill === 0));
  assert.equal(M.giocatori.get('a').tot, tot);
});
