// Simulazione di rete: avvia il server vero, collega uno schermo e 16 telefoni
// finti (WebSocket integrato in Node), prova ponte, riconnessione e festa piena.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const PORTA = 3199;
const radice = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL_WS = `ws://127.0.0.1:${PORTA}/ws`;
// I test salvano i personaggi in una cartella temporanea, non in quella vera.
const DATI = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-test-'));
process.on('exit', () => fs.rmSync(DATI, { recursive: true, force: true }));

function avviaServer(dati = DATI) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.js'], { cwd: radice, env: { ...process.env, PORT: String(PORTA), PG_DATI: dati } });
    proc.stdout.on('data', (d) => {
      if (String(d).includes('pronto')) resolve(proc);
    });
    proc.on('error', reject);
    setTimeout(() => reject(new Error('il server non parte')), 8000);
  });
}

// Client di prova: tiene la coda dei messaggi e permette di aspettarne uno.
function client() {
  const ws = new WebSocket(URL_WS);
  const coda = [];
  const attese = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    const i = attese.findIndex((a) => a.filtro(m));
    if (i >= 0) attese.splice(i, 1)[0].resolve(m);
    else coda.push(m);
  };
  const aperto = new Promise((r) => (ws.onopen = r));
  return {
    ws,
    aperto,
    manda: (o) => ws.send(JSON.stringify(o)),
    aspetta(filtro, ms = 3000) {
      const i = coda.findIndex(filtro);
      if (i >= 0) return Promise.resolve(coda.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const a = { filtro, resolve };
        attese.push(a);
        setTimeout(() => {
          const k = attese.indexOf(a);
          if (k >= 0) {
            attese.splice(k, 1);
            reject(new Error('messaggio atteso non arrivato'));
          }
        }, ms);
      });
    },
    chiudi: () => ws.close(),
  };
}

test('schermo + 16 telefoni: ingresso, ponte, riconnessione, festa piena', async () => {
  const server = await avviaServer();
  try {
    const schermo = client();
    await schermo.aperto;
    schermo.manda({ t: 'hello', role: 'host' });
    const benvenuto = await schermo.aspetta((m) => m.t === 'welcome');
    assert.equal(benvenuto.role, 'host');
    assert.equal(benvenuto.players.length, 0);

    // 16 telefoni entrano
    const telefoni = [];
    for (let i = 0; i < 16; i++) {
      const c = client();
      await c.aperto;
      c.manda({ t: 'hello', role: 'phone', token: null });
      await c.aspetta((m) => m.t === 'welcome');
      c.manda({ t: 'join', name: `Giocatore ${i}`, avatar: { colore: 0, capelli: 3 } });
      const j = await c.aspetta((m) => m.t === 'joined');
      c.id = j.you.id;
      c.token = j.token;
      c.colore = j.you.color;
      telefoni.push(c);
      await schermo.aspetta((m) => m.t === 'player' && m.p.id === c.id);
    }
    // Colori tutti diversi anche se tutti volevano lo 0
    assert.equal(new Set(telefoni.map((c) => c.colore)).size, 16);

    // Il 17° trova la festa piena
    const extra = client();
    await extra.aperto;
    extra.manda({ t: 'hello', role: 'phone' });
    const w = await extra.aspetta((m) => m.t === 'welcome');
    assert.equal(w.full, true);
    extra.manda({ t: 'join', name: 'Tardi' });
    const err = await extra.aspetta((m) => m.t === 'error');
    assert.match(err.text, /piena/);
    extra.chiudi();

    // Telefono -> schermo
    telefoni[3].manda({ t: 'in', d: { run: 'x', d: { j: [1, 0] } } });
    const inp = await schermo.aspetta((m) => m.t === 'in');
    assert.equal(inp.p, telefoni[3].id);
    assert.deepEqual(inp.d.d.j, [1, 0]);

    // Schermo -> un telefono (vista persistente) e a tutti (messaggio)
    schermo.manda({ t: 'view', to: telefoni[5].id, v: { screen: 'game', run: 'r1', s: { ciao: 5 } } });
    const vista = await telefoni[5].aspetta((m) => m.t === 'view');
    assert.equal(vista.v.s.ciao, 5);
    schermo.manda({ t: 'msg', to: '*', d: { run: 'r1', d: { bip: 1 } } });
    await Promise.all(telefoni.map((c) => c.aspetta((m) => m.t === 'msg' && m.d.d.bip === 1)));

    // Il telefono 5 si disconnette e rientra con il suo token: ritrova la vista
    telefoni[5].chiudi();
    const offline = await schermo.aspetta((m) => m.t === 'player' && m.p.id === telefoni[5].id && !m.p.connected);
    assert.equal(offline.p.connected, false);
    const rientro = client();
    await rientro.aperto;
    rientro.manda({ t: 'hello', role: 'phone', token: telefoni[5].token });
    const wb = await rientro.aspetta((m) => m.t === 'welcome');
    assert.equal(wb.you.id, telefoni[5].id);
    assert.equal(wb.view.s.ciao, 5);
    await schermo.aspetta((m) => m.t === 'player' && m.p.id === telefoni[5].id && m.p.connected);

    // Lo schermo toglie un giocatore
    schermo.manda({ t: 'kick', id: telefoni[0].id });
    await telefoni[0].aspetta((m) => m.t === 'removed');
    await schermo.aspetta((m) => m.t === 'gone' && m.id === telefoni[0].id);

    // Lo schermo si ricarica: ritrova giocatori e salvataggio
    schermo.manda({ t: 'save', s: { torneo: { indice: 2, totale: 5 } } });
    await new Promise((r) => setTimeout(r, 100));
    schermo.chiudi();
    const schermo2 = client();
    await schermo2.aperto;
    schermo2.manda({ t: 'hello', role: 'host' });
    const b2 = await schermo2.aspetta((m) => m.t === 'welcome');
    assert.equal(b2.players.length, 15);
    assert.equal(b2.saved.torneo.indice, 2);

    // Un messaggio grande (disegno) passa intero
    const grande = Array.from({ length: 20000 }, (_, i) => i % 1000);
    telefoni[7].manda({ t: 'in', d: { run: 'g', d: { k: 'p', pts: grande } } });
    const g = await schermo2.aspetta((m) => m.t === 'in' && m.d.run === 'g');
    assert.equal(g.d.d.pts.length, 20000);

    for (const c of [...telefoni, rientro, schermo2]) c.chiudi();
  } finally {
    server.kill();
  }
});

async function telefono(token = null) {
  const c = client();
  await c.aperto;
  c.manda({ t: 'hello', role: 'phone', token });
  c.benvenuto = await c.aspetta((m) => m.t === 'welcome');
  return c;
}

test('personaggi salvati: si ritrovano, si riprendono e si eliminano', async () => {
  const dati = path.join(DATI, 'personaggi');
  let server = await avviaServer(dati);
  try {
    const schermo = client();
    await schermo.aperto;
    schermo.manda({ t: 'hello', role: 'host' });
    await schermo.aspetta((m) => m.t === 'welcome');

    // Anna entra: il suo personaggio viene salvato
    const anna = await telefono();
    assert.deepEqual(anna.benvenuto.chars, []);
    anna.manda({ t: 'join', name: 'Anna', avatar: { colore: 3, capelli: 5 } });
    const ja = await anna.aspetta((m) => m.t === 'joined');
    assert.ok(ja.you.pid, 'il giocatore ha un personaggio salvato');

    // Un altro telefono vede Anna nella galleria, segnata come "sta giocando"
    const altro = await telefono();
    const salvata = altro.benvenuto.chars.find((c) => c.id === ja.you.pid);
    assert.equal(salvata.name, 'Anna');
    assert.equal(salvata.avatar.capelli, 5);
    assert.equal(salvata.use, 'on');

    // Non si può prendere un personaggio che sta giocando
    altro.manda({ t: 'join', name: 'Anna', avatar: salvata.avatar, pid: salvata.id });
    const err = await altro.aspetta((m) => m.t === 'error');
    assert.match(err.text, /sta già giocando/);
    altro.manda({ t: 'delchar', pid: salvata.id });
    await altro.aspetta((m) => m.t === 'error');

    // Anna modifica il personaggio dal telefono: si aggiorna anche quello salvato
    anna.manda({ t: 'profile', name: 'Annina', avatar: { colore: 3, capelli: 7 } });
    await anna.aspetta((m) => m.t === 'you');
    const agg = await altro.aspetta((m) => m.t === 'chars' && m.list.some((c) => c.name === 'Annina'));
    assert.equal(agg.list.find((c) => c.id === ja.you.pid).avatar.capelli, 7);

    // Il telefono di Anna si spegne: dall'altro telefono riprende il suo posto (stesso giocatore)
    anna.chiudi();
    await altro.aspetta((m) => m.t === 'chars' && m.list.some((c) => c.id === ja.you.pid && c.use === 'off'));
    altro.manda({ t: 'join', name: 'Annina', avatar: { colore: 3, capelli: 7 }, pid: ja.you.pid });
    const ripresa = await altro.aspetta((m) => m.t === 'joined');
    assert.equal(ripresa.you.id, ja.you.id);
    assert.notEqual(ripresa.token, ja.token, 'il vecchio token non vale più');
    const vecchio = await telefono(ja.token);
    assert.equal(vecchio.benvenuto.you, null);

    // Un personaggio nuovo e poi eliminato
    const bruno = await telefono();
    bruno.manda({ t: 'join', name: 'Bruno', avatar: { colore: 5 } });
    const jb = await bruno.aspetta((m) => m.t === 'joined');
    bruno.manda({ t: 'leave' });
    await bruno.aspetta((m) => m.t === 'removed');
    bruno.manda({ t: 'delchar', pid: jb.you.pid });
    const dopo = await bruno.aspetta((m) => m.t === 'chars' && !m.list.some((c) => c.id === jb.you.pid));
    assert.ok(dopo.list.some((c) => c.id === ja.you.pid));

    for (const c of [schermo, altro, vecchio, bruno]) c.chiudi();
    await new Promise((r) => setTimeout(r, 500)); // il salvataggio su file è ritardato di poco
  } finally {
    server.kill();
  }

  // Dopo un riavvio del server i personaggi sono ancora lì
  await new Promise((r) => setTimeout(r, 300));
  server = await avviaServer(dati);
  try {
    const t = await telefono();
    assert.deepEqual(
      t.benvenuto.chars.map((c) => c.name),
      ['Annina'],
    );
    t.chiudi();
  } finally {
    server.kill();
  }
});

test('personaggi salvati gestiti dallo schermo: nuovo, modifica, elimina', async () => {
  const dati = path.join(DATI, 'gestione');
  let server = await avviaServer(dati);
  let pidCarla;
  try {
    const schermo = client();
    await schermo.aperto;
    schermo.manda({ t: 'hello', role: 'host' });
    const benvenuto = await schermo.aspetta((m) => m.t === 'welcome');
    assert.deepEqual(benvenuto.chars, []);
    assert.equal(benvenuto.maxChars, 80);

    // Lo schermo crea un personaggio: lo vedono lo schermo e il telefono che sta entrando
    const tel = await telefono();
    schermo.manda({ t: 'charsave', name: '  Carla  ', avatar: { colore: 4, capelli: 2, x: 'no' } });
    const creato = await schermo.aspetta((m) => m.t === 'chars' && m.list.length === 1);
    const carla = creato.list[0];
    pidCarla = carla.id;
    assert.equal(carla.name, 'Carla');
    assert.deepEqual(carla.avatar, { colore: 4, capelli: 2 });
    await tel.aspetta((m) => m.t === 'chars' && m.list.some((c) => c.id === carla.id));

    // Senza nome non si salva
    schermo.manda({ t: 'charsave', name: '   ', avatar: {} });
    await schermo.aspetta((m) => m.t === 'notice' && /nome/.test(m.text));

    // Modifica: stesso personaggio, dati nuovi
    schermo.manda({ t: 'charsave', pid: carla.id, name: 'Carlotta', avatar: { colore: 4, capelli: 9 } });
    const mod = await schermo.aspetta((m) => m.t === 'chars' && m.list.some((c) => c.name === 'Carlotta'));
    assert.equal(mod.list.length, 1);
    assert.equal(mod.list[0].id, carla.id);
    assert.equal(mod.list[0].avatar.capelli, 9);

    // Carlotta entra col telefono: ora lo schermo non la può eliminare...
    tel.manda({ t: 'join', name: 'Carlotta', avatar: mod.list[0].avatar, pid: carla.id });
    const j = await tel.aspetta((m) => m.t === 'joined');
    assert.equal(j.you.pid, carla.id);
    schermo.manda({ t: 'chardel', pid: carla.id });
    await schermo.aspetta((m) => m.t === 'notice' && /sta giocando/.test(m.text));

    // ...ma la può modificare: cambiano il giocatore e il telefono
    schermo.manda({ t: 'charsave', pid: carla.id, name: 'Carla', avatar: { colore: 4, capelli: 1 } });
    const tu = await tel.aspetta((m) => m.t === 'you');
    assert.equal(tu.you.name, 'Carla');
    assert.equal(tu.nome, 'Carla');
    assert.equal(tu.you.avatar.capelli, 1);
    await schermo.aspetta((m) => m.t === 'player' && m.p.id === j.you.id && m.p.name === 'Carla');

    // Con il telefono spento è ancora nella festa: non si elimina finché non la si toglie
    tel.chiudi();
    await schermo.aspetta((m) => m.t === 'chars' && m.list.some((c) => c.id === carla.id && c.use === 'off'));
    schermo.manda({ t: 'chardel', pid: carla.id });
    await schermo.aspetta((m) => m.t === 'notice' && /nella festa/.test(m.text));
    schermo.manda({ t: 'kick', id: j.you.id });
    await schermo.aspetta((m) => m.t === 'gone');

    // Un secondo personaggio, poi via quello di prima
    schermo.manda({ t: 'charsave', name: 'Dario', avatar: { colore: 1 } });
    await schermo.aspetta((m) => m.t === 'chars' && m.list.length === 2);
    schermo.manda({ t: 'chardel', pid: carla.id });
    const dopo = await schermo.aspetta((m) => m.t === 'chars' && !m.list.some((c) => c.id === carla.id));
    assert.deepEqual(dopo.list.map((c) => c.name), ['Dario']);

    // Un telefono che ricorda il personaggio eliminato non lo trova più nella galleria
    const ricorda = await telefono();
    assert.ok(!ricorda.benvenuto.chars.some((c) => c.id === pidCarla));

    for (const c of [schermo, ricorda]) c.chiudi();
    await new Promise((r) => setTimeout(r, 500)); // il salvataggio su file è ritardato di poco
  } finally {
    server.kill();
  }

  // Le modifiche fatte dallo schermo restano dopo il riavvio
  await new Promise((r) => setTimeout(r, 300));
  server = await avviaServer(dati);
  try {
    const t = await telefono();
    assert.deepEqual(
      t.benvenuto.chars.map((c) => c.name),
      ['Dario'],
    );
    t.chiudi();
  } finally {
    server.kill();
  }
});
