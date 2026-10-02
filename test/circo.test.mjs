// Test del Circo dei Disperati: regole (danni, squadre, sfide, Caos, punti, sporco) e
// "robot" che giocano i ruoli sul telefono: chi gioca perfetto non sbaglia mai.

import test from 'node:test';
import assert from 'node:assert/strict';
import { posizioniDaGruppi } from '../public/shared/util.js';
import * as CD from '../public/games/circo/regole.js';
import * as CR from '../public/games/circo/ruoli.js';

test('Circo: danno per errore secondo la fase e i giocatori della squadra', () => {
  assert.equal(CD.danno(5, 5), 8);
  assert.equal(CD.danno(20, 5), 12);
  assert.equal(CD.danno(40, 5), 18);
  // più giocatori, meno danno a testa (un po' meno che in proporzione)
  assert.ok(Math.abs(CD.danno(40, 3) - 25.1) < 0.1, `3 giocatori: ${CD.danno(40, 3)}`);
  assert.ok(Math.abs(CD.danno(40, 8) - 13.3) < 0.1, `8 giocatori: ${CD.danno(40, 8)}`);
  assert.ok(CD.danno(40, 3) > CD.danno(40, 5) && CD.danno(40, 5) > CD.danno(40, 8));
  assert.deepEqual([0, 14.9, 15, 29.9, 30, 44.9].map(CD.fase), [0, 0, 1, 1, 2, 2]);
});

test('Circo: squadre e ruoli da 3 a 16 giocatori', () => {
  for (let n = 3; n <= 16; n++) {
    for (let prova = 0; prova < 20; prova++) {
      const gioc = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, bot: i % 3 !== 0, livello: i % 3 }));
      const ruoli = CD.assegna(gioc);
      const nsq = CD.quanteSquadre(n);
      const squadre = Array.from({ length: nsq }, () => []);
      for (const p of gioc) {
        const { ruolo, sq } = CD.leggiRuolo(ruoli[p.id]);
        assert.ok(ruolo, `ruolo mancante (${n} giocatori)`);
        assert.ok(sq < nsq);
        squadre[sq].push({ ...p, ruolo });
      }
      if (nsq === 2) {
        assert.ok(Math.abs(squadre[0].length - squadre[1].length) <= 1, 'squadre della stessa grandezza');
        const umani = squadre.map((s) => s.filter((p) => !p.bot).length);
        assert.ok(Math.abs(umani[0] - umani[1]) <= 1, 'persone divise a metà');
      }
      for (const s of squadre) {
        const conta = {};
        for (const p of s) conta[p.ruolo] = (conta[p.ruolo] || 0) + 1;
        if (s.length <= 5) assert.equal(Object.keys(conta).length, s.length, 'ruoli tutti diversi fino a 5');
        else {
          assert.equal(Object.keys(conta).length, 5, 'tutti i ruoli da 6 in su');
          assert.ok(Object.values(conta).every((v) => v <= 2), 'al massimo due per ruolo');
        }
      }
      if (nsq === 2) {
        // la squadra più piccola ha gli stessi ruoli dell'altra, meno uno
        const [a, b] = [...squadre].sort((x, y) => x.length - y.length);
        const resto = b.map((p) => p.ruolo);
        for (const p of a) resto.splice(resto.indexOf(p.ruolo), 1);
        assert.equal(resto.length, b.length - a.length);
      }
    }
  }
});

test('Circo: le sfide sono sempre uguali dal seme e stanno nei 45 secondi', () => {
  for (const seme of [1, 99, 123456, 987654321]) {
    const a = CD.programmi(seme);
    assert.deepEqual(a, CD.programmi(seme));
    for (const r of CD.NOMI_RUOLI) {
      assert.ok(a[r].length >= 10, `${r}: poche sfide (${a[r].length})`);
      a[r].forEach((c, i) => {
        assert.equal(c.i, i);
        assert.ok(c.t0 >= 0 && c.t0 < CD.DURATA);
        if (c.fine != null) assert.ok(c.fine <= CD.DURATA && c.fine > c.t0);
        if (i) assert.ok(c.t0 > a[r][i - 1].t0);
      });
    }
    // le sfide accelerano: nella fase 3 ce ne sono più che nella 1
    for (const r of ['giocoliere', 'cecchino', 'navigatore']) {
      const quante = (f) => a[r].filter((c) => CD.fase(c.t0) === f).length;
      assert.ok(quante(2) > quante(0), `${r}: la fase 3 non è più fitta`);
    }
  }
});

test('Circo: il Caos arriva nella fase 3 e lo scambio è tra due ruoli diversi', () => {
  for (const seme of [3, 77, 4242]) {
    const squadra = ['batterista', 'navigatore', 'straccio'];
    const tutti = CD.caos(seme, [squadra, squadra]);
    assert.equal(tutti.eventi.length, 3);
    assert.deepEqual(tutti.eventi.map((e) => e.tipo).sort(), ['inversione', 'scambio', 'terremoto']);
    for (const e of tutti.eventi) assert.ok(e.t >= 30 && e.t + e.durata <= 47.5);
    const [s0, s1] = tutti.scambi;
    assert.notEqual(s0[0], s0[1]);
    assert.deepEqual(s0, s1, 'squadre uguali, stesso scambio');
    const senzaNav = CD.caos(seme, [['batterista', 'giocoliere', 'straccio']]);
    assert.ok(!senzaNav.eventi.some((e) => e.tipo === 'inversione'), 'senza Navigatore niente inversione');
  }
});

test('Circo: cursore del Cecchino e zona verde', () => {
  for (let t = 0; t <= CD.DURATA; t += 0.37) {
    const c = CD.cursore(t);
    assert.ok(c >= 0 && c <= 1);
  }
  assert.ok(CD.verde(45) < CD.verde(0), 'il verde si restringe');
  assert.ok(CD.velCursore(40) > CD.velCursore(5), 'il cursore accelera');
});

test('Circo: punti, MVP, Colpevole e consolazione', () => {
  const m = (id, errori, danni = errori * 10) => ({ id, errori, danni });
  // salvi: zero errori +2, gli altri 2
  let r = CD.punteggi([{ membri: [m('a', 0), m('b', 1), m('c', 3)], barra: 40, crollo: null }]);
  assert.deepEqual(r.punti, { a: 4, b: 2, c: 2 });
  assert.deepEqual(r.gruppi, [['a'], ['b'], ['c']]);
  // salvi senza zero: l'MVP (meno errori, a pari errori meno danni) +1
  r = CD.punteggi([{ membri: [m('a', 1, 8), m('b', 1, 18), m('c', 2)], barra: 10, crollo: null }]);
  assert.deepEqual(r.punti, { a: 3, b: 2, c: 2 });
  // crollati: il Colpevole −1, −2 se ha fatto almeno il 40% degli errori
  r = CD.punteggi([{ membri: [m('a', 1), m('b', 2), m('c', 2), m('d', 3)], barra: 0, crollo: 40 }]);
  assert.equal(r.punti.d, -1);
  r = CD.punteggi([{ membri: [m('a', 1), m('b', 1), m('c', 4)], barra: 0, crollo: 40 }]);
  assert.equal(r.punti.c, -2);
  assert.equal(r.esiti[0].colpevoli[0], 'c');
  assert.deepEqual(r.gruppi, [['a', 'b'], ['c']]);
  // due squadre crollate: chi dura di più prende la consolazione
  r = CD.punteggi([
    { membri: [m('a', 1), m('b', 1), m('e', 2), m('f', 1), m('g', 1)], barra: 0, crollo: 38 },
    { membri: [m('c', 2), m('d', 1)], barra: 0, crollo: 33 },
  ]);
  assert.equal(r.punti.e, -1 + 1, 'Colpevole con il 33%: −1, più la consolazione');
  assert.equal(r.punti.b, 0 + 1);
  assert.equal(r.punti.c, -2, 'due errori su tre: −2');
  assert.equal(r.punti.d, 0);
  // la squadra salva sta sopra quella crollata
  r = CD.punteggi([
    { membri: [m('a', 5), m('b', 4)], barra: 3, crollo: null },
    { membri: [m('c', 0), m('d', 1)], barra: 0, crollo: 44 },
  ]);
  const pos = posizioniDaGruppi(r.gruppi);
  assert.ok(pos.a < pos.c && pos.b < pos.c);
});

test('Circo: lo sporco dello Straccio sale con gli schizzi e scende strofinando', () => {
  const s = CD.creaSporco();
  const w = 390;
  const h = 640;
  s.schizza({ x: 0.5, y: 0.5, r: 0.2, q: 1, tipo: 'pomodoro' }, w, h);
  const pieno = s.livello();
  assert.ok(pieno > 0.1 && pieno < 0.5, `uno schizzo vale ${pieno}`);
  for (const y of [h / 2 - 45, h / 2, h / 2 + 45]) {
    let x = w / 2 - 70;
    for (let k = 0; k < 30; k++) {
      const nx = k % 2 ? w / 2 - 70 : w / 2 + 70;
      s.pulisci(nx, y, Math.abs(nx - x), w, h);
      x = nx;
    }
  }
  assert.ok(s.livello() < pieno * 0.15, 'strofinando si pulisce');
  s.schizza({ x: 0.3, y: 0.3, r: 0.2, q: 1, tipo: 'uovo' }, w, h);
  const prima = s.livello();
  s.salva();
  assert.ok(s.livello() < prima * 0.5);
});

// Un ruolo giocato sul telefono simulato (60 fotogrammi al secondo) da un robot.
function giocaRuolo(ruolo, seme, robot, eventi = []) {
  const prog = CD.programmi(seme);
  const errori = [];
  const w = 390;
  const h = 640;
  let ora = -1;
  const ui = { sbaglia: (i, motivo) => errori.push({ i, motivo, t: ora }), bene() {}, vibra() {}, inversione: (t) => CD.attivo(eventi, 'inversione', t) };
  const u = CR.CREA[ruolo](prog, ui);
  u.entra(-1);
  const dt = 1 / 60;
  for (let k = 0; ; k++) {
    const t = -0.5 + k * dt;
    if (t >= CD.DURATA) break;
    ora = t;
    if (robot) robot(u, t, w, h, prog);
    u.passo(t, dt, w, h, t >= 0);
  }
  return errori;
}

const ROBOT = {
  batterista() {
    const fatti = new Set();
    return (u, t, w, h, prog) => {
      const pads = CR.padsBatterista(w, h);
      for (const c of prog.batterista) {
        c.note.forEach((p, k) => {
          const chiave = `${c.i}.${k}`;
          if (fatti.has(chiave) || t < c.tR + k * c.b + CR.LATENZA) return;
          fatti.add(chiave);
          u.giu(1, pads[p].x + pads[p].w / 2, pads[p].y + pads[p].h / 2, t, w, h);
          u.su(1);
        });
      }
    };
  },
  cecchino() {
    const fatti = new Set();
    return (u, t, w, h, prog) => {
      const c = prog.cecchino.find((s) => t >= s.t0 + 0.15 && t <= s.fine);
      if (!c || fatti.has(c.i)) return;
      const tt = t - CR.LATENZA;
      if (Math.abs(CD.cursore(tt) - 0.5) > CD.verde(tt) * 0.6) return;
      fatti.add(c.i);
      u.giu(1, w / 2, h / 2, t, w, h);
      u.su(1);
    };
  },
  navigatore(eventi) {
    const fatti = new Set();
    const V = { su: [0, -1], giu: [0, 1], sx: [-1, 0], dx: [1, 0] };
    return (u, t, w, h, prog) => {
      const c = prog.navigatore.find((s) => t >= s.t0 + 0.25 && t <= s.fine);
      if (!c || fatti.has(c.i)) return;
      fatti.add(c.i);
      const dir = CD.attivo(eventi, 'inversione', t) ? CD.OPPOSTO[c.dir] : c.dir;
      u.giu(1, w / 2, h / 2, t, w, h);
      u.muovi(1, w / 2 + V[dir][0] * 90, h / 2 + V[dir][1] * 90, t, w, h);
      u.su(1);
    };
  },
  giocoliere() {
    const dove = new Map(); // cerchio -> dito
    const fatti = new Set();
    return (u, t, w, h, prog) => {
      const C = CR.centriGiocoliere(w, h);
      if (!dove.size) {
        [0, 1, 2].forEach((i) => {
          dove.set(i, i + 1);
          u.giu(i + 1, C[i][0], C[i][1], t, w, h);
        });
      }
      const c = prog.giocoliere.find((s) => t >= s.t0 + 0.2 && t <= s.fine);
      if (!c || fatti.has(c.i)) return;
      fatti.add(c.i);
      const tenuti = [...dove.keys()].sort((a, b) => a - b);
      const da = tenuti[c.j];
      const a = [0, 1, 2, 3].find((i) => !dove.has(i));
      const dito = dove.get(da);
      dove.delete(da);
      dove.set(a, dito);
      u.muovi(dito, C[a][0], C[a][1], t, w, h);
    };
  },
  straccio() {
    // due dita che strofinano veloci sopra gli ultimi schizzi
    let fi = 0;
    let giu = false;
    return (u, t, w, h, prog) => {
      const ultimi = prog.straccio.filter((s) => s.t0 <= t).slice(-2);
      if (!ultimi.length) return;
      fi += (3 * w) / 60 / (0.15 * w);
      ultimi.forEach((s, k) => {
        const x = s.x * w + Math.sin(fi + k) * 0.15 * w;
        const y = s.y * h + Math.sin(fi * 1.7 + k) * 0.1 * w;
        if (!giu) u.giu(k + 1, x, y, t, w, h);
        u.muovi(k + 1, x, y, t, w, h);
      });
      giu = ultimi.length === 2;
    };
  },
};

test('Circo: un robot perfetto non sbaglia mai, uno fermo sbaglia sempre', () => {
  for (const seme of [11, 2024, 31337]) {
    const eventi = [{ t: 32, tipo: 'inversione', durata: 3 }];
    for (const ruolo of CD.NOMI_RUOLI) {
      const errori = giocaRuolo(ruolo, seme, ROBOT[ruolo](eventi), eventi);
      assert.deepEqual(errori, [], `${ruolo} (seme ${seme}): il robot perfetto ha sbagliato`);
      const fermo = giocaRuolo(ruolo, seme, null, eventi);
      assert.ok(fermo.length >= (ruolo === 'straccio' ? 3 : 8), `${ruolo}: chi non fa niente sbaglia solo ${fermo.length} volte`);
    }
  }
});
