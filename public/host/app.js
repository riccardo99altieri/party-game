// Schermo principale: lobby con QR, torneo, scelta libera, classifiche, podio.

import { connect } from '../shared/net.js';
import { prepara, disegnaAvatar, canvasAvatar, casuale } from '../shared/avatar.js';
import { coloreGiocatore, MIN_GIOCATORI, MAX_GIOCATORI, shuffle, rand, pick, clamp, ease, TAU } from '../shared/util.js';
import { creaPalco, creaEffetti, W, H, sfondoFesta, testo, etichetta, pannello, scrittaGrande } from './stage.js';
import { sblocca, sfx, musica, setMuto, isMuto } from './audio.js';
import { caricaHost, CONTROLLI } from '../games/index.js';
import { creaPartita } from './runner.js';
import { LIVELLI, LIVELLO_BASE, livelloValido } from '../games/cpu.js';
import { apriEditor } from '../shared/editor.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const stageEl = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const ui = document.getElementById('ui');
const palco = creaPalco(stageEl, canvas);
const fx = creaEffetti();

const giocatori = new Map();
let GIOCHI = [];
let info = { lan: [], port: location.port };
let ipScelto = 0;
let scena = null;
let audioSbloccato = false;
let personaggi = []; // personaggi salvati sul computer: { id, name, avatar, use }
let maxPersonaggi = 80;
let torneo = null; // { totale, doppio, coda, indice, punti, vittorie }
let serata = { punti: {}, vittorie: {} };
let prefs = { n: 10, doppio: true, esclusi: [] };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('pg-torneo') || '{}'));
} catch {}

// Potenza dei bot che si aggiungono (l'ultima scelta resta ricordata).
let livelloNuoviBot = LIVELLO_BASE;
try {
  livelloNuoviBot = livelloValido(Number(localStorage.getItem('pg-livello-bot') ?? LIVELLO_BASE));
} catch {}

const botInArrivo = new Set();
const NOMI_BOT = ['Robottino', 'Bullone', 'Scintilla', 'Pixel', 'Turbo', 'Chip', 'Circuito', 'Byte', 'Ingranaggio', 'Transistor', 'Bip', 'Bop', 'Microchip', 'Vitina', 'Dado', 'Led'];

// ---------------------------------------------------------------------------
// Rete

let net = null; // collegato dopo aver caricato i minigiochi

const app = {
  net: null,
  fx,
  ui,
  giocatori,
  capoId,
  avviso,
};

function daServer(p) {
  const vecchio = giocatori.get(p.id);
  const g = {
    id: p.id,
    nome: p.name,
    av: prepara(p.avatar),
    idx: p.color,
    colore: coloreGiocatore(p.color),
    bot: p.bot,
    livello: p.bot ? livelloValido(p.level) : null,
    connesso: p.connected,
    joinedAt: p.joinedAt,
    lobby: vecchio ? vecchio.lobby : nuovaPosLobby(),
  };
  giocatori.set(p.id, g);
  return { g, nuovo: !vecchio, eraConnesso: vecchio ? vecchio.connesso : false };
}

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome': {
      giocatori.clear();
      for (const p of msg.players) daServer(p);
      info = { lan: msg.lan || [], port: msg.port };
      personaggi = msg.chars || [];
      maxPersonaggi = msg.maxChars || maxPersonaggi;
      if (msg.saved) {
        torneo = msg.saved.torneo || null;
        serata = msg.saved.serata || serata;
      }
      if (!scena) {
        if (torneo && torneo.indice < torneo.totale) vaiA(scenaClassifica({ modo: 'torneo', ripresa: true }));
        else vaiA(scenaLobby());
      } else if (scena.refresh) scena.refresh();
      break;
    }
    case 'player': {
      const { g, nuovo, eraConnesso } = daServer(msg.p);
      if (nuovo) {
        sfx.entra();
        fx.particelle(g.lobby.x, g.lobby.y - 80, { n: 24, colori: [g.colore, '#fff'], grav: 200 });
        if (torneo && torneo.punti[g.id] == null) torneo.punti[g.id] = 0;
      }
      if (!nuovo && !eraConnesso && g.connesso && scena && scena.rientrato) scena.rientrato(g.id);
      if (scena && scena.giocatoreCambiato) scena.giocatoreCambiato(g.id);
      break;
    }
    case 'gone': {
      giocatori.delete(msg.id);
      if (scena && scena.giocatoreCambiato) scena.giocatoreCambiato(msg.id);
      break;
    }
    case 'chars':
      personaggi = msg.list || [];
      if (scena && scena.personaggi) scena.personaggi();
      break;
    case 'in':
      if (scena && scena.input) scena.input(msg.p, msg.d);
      break;
    case 'sys':
      if (msg.d && typeof msg.d === 'object' && scena && scena.sys) scena.sys(msg.p, msg.d, msg.p === capoId());
      break;
    case 'replaced':
      ui.innerHTML = '<div class="avviso-fisso">Lo schermo principale è stato aperto in un\'altra scheda.<br>Chiudi questa.</div>';
      scena = null;
      net.close();
      break;
    case 'notice':
      avviso(msg.text);
      break;
  }
}

function lista() {
  return [...giocatori.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

function attivi() {
  return lista().filter((p) => p.bot || p.connesso);
}

// Il "capo" è il primo giocatore (umano e collegato) entrato: comanda i menu dal telefono.
function capoId() {
  const p = lista().find((x) => !x.bot && x.connesso);
  return p ? p.id : null;
}

function vista(to, v) {
  net.send({ t: 'view', to, v });
}

function salva() {
  net.send({ t: 'save', s: { torneo, serata } });
}

function avviso(testoAvviso) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = testoAvviso;
  document.getElementById('stage').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------------------------------------------------------------------------
// Ciclo principale

function vaiA(nuova) {
  if (scena && scena.esci) scena.esci();
  ui.innerHTML = '';
  scena = nuova;
  if (scena.entra) scena.entra();
}

let ultimo = performance.now();
let ultimoRaf = 0;

function frame() {
  ultimoRaf = performance.now();
  passo(ultimoRaf);
  requestAnimationFrame(frame);
}

// Motore di riserva: se il browser smette di disegnare (finestra coperta o
// ridotta a icona) il gioco va avanti lo stesso, così nessuno resta bloccato.
setInterval(() => {
  const now = performance.now();
  if (now - ultimoRaf > 150) passo(now);
}, 33);

function passo(ms) {
  // Se sono passati tanti millisecondi (browser rallentato), recuperiamo a
  // piccoli passi così fisica e tempi restano giusti.
  let resto = Math.min(1, Math.max(0, ms - ultimo) / 1000);
  ultimo = ms;
  const t = ms / 1000;
  do {
    const dt = Math.min(0.05, resto);
    resto -= dt;
    fx.aggiorna(dt);
    if (scena && scena.aggiorna) scena.aggiorna(dt, t);
  } while (resto > 1e-6);
  palco.inizioFrame();
  const g = palco.g;
  const [ox, oy] = fx.offset();
  g.save();
  g.translate(ox, oy);
  if (scena && scena.disegna) scena.disegna(g, t);
  else sfondoFesta(g, t);
  fx.disegna(g);
  g.restore();
}

window.addEventListener('keydown', (e) => {
  sbloccaAudio();
  // mentre si scrive i tasti non sono scorciatoie (tranne Esc, che chiude)
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') && e.key !== 'Escape') return;
  if (scena && scena.tasto && scena.tasto(e)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'm' || e.key === 'M') alternaMuto();
  else if (e.key === 'f' || e.key === 'F') schermoIntero();
});

window.addEventListener('pointerdown', sbloccaAudio);

function sbloccaAudio() {
  sblocca();
  if (!audioSbloccato) {
    audioSbloccato = true;
    document.body.classList.add('audio-ok');
  }
}

function alternaMuto() {
  setMuto(!isMuto());
  document.body.classList.toggle('muto', isMuto());
  avviso(isMuto() ? '🔇 Audio disattivato' : '🔊 Audio attivo');
}

function schermoIntero() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

// ---------------------------------------------------------------------------
// Lobby

function nuovaPosLobby() {
  return { x: rand(800, 1800), y: rand(690, 1000), tx: rand(800, 1800), ty: rand(690, 1000), attesa: rand(0, 2), dir: 1, salto: 0 };
}

function aggiornaCamminata(p, dt, area) {
  const L = p.lobby;
  if (L.attesa > 0) {
    L.attesa -= dt;
    L.pose = 'idle';
    return;
  }
  const dx = L.tx - L.x;
  const dy = L.ty - L.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) {
    L.attesa = rand(1, 4);
    L.tx = rand(area.x0, area.x1);
    L.ty = rand(area.y0, area.y1);
    return;
  }
  const v = 110;
  L.x += (dx / d) * v * dt;
  L.y += (dy / d) * v * dt;
  L.dir = dx >= 0 ? 1 : -1;
  L.pose = 'walk';
}

function disegnaFolla(g, t, gente, altezza = 150) {
  const ordinati = [...gente].sort((a, b) => a.lobby.y - b.lobby.y);
  for (const p of ordinati) {
    const L = p.lobby;
    g.globalAlpha = p.bot || p.connesso ? 1 : 0.45;
    disegnaAvatar(g, p.av, L.x, L.y, altezza, { pose: L.pose || 'idle', t, dir: L.dir, look: [L.dir * 0.6, 0] });
    etichetta(g, p.nome + (p.bot ? ` 🤖${LIVELLI[p.livello].emoji}` : '') + (p.id === capoId() ? ' 👑' : ''), L.x, L.y + 22, p.colore, { dim: 22 });
    g.globalAlpha = 1;
  }
}

function urlGioco() {
  const lan = info.lan[ipScelto] || info.lan[0];
  const host = lan ? lan.address : location.hostname;
  const port = info.port || location.port;
  return `http://${host}${port && String(port) !== '80' ? ':' + port : ''}/gioca`;
}

function scenaLobby() {
  const area = { x0: 780, x1: 1820, y0: 690, y1: 1010 };
  let modale = null;
  let gestione = null; // pannello dei personaggi salvati

  function render() {
    const url = urlGioco();
    ui.innerHTML = `
      <div class="lobby schermo-entra">
        <div class="lobby-qr">
          <div class="qr-titolo">Inquadra e gioca!</div>
          <div class="qr-box"></div>
          <div class="qr-url">${esc(url.replace('http://', ''))}</div>
          ${
            info.lan.length > 1
              ? `<select class="qr-ip">${info.lan.map((a, i) => `<option value="${i}" ${i === ipScelto ? 'selected' : ''}>${esc(a.address)} (${esc(a.name)})</option>`).join('')}</select>`
              : ''
          }
          ${info.lan.length === 0 ? '<div class="qr-avviso">Nessuna rete trovata: collega il computer al Wi-Fi.</div>' : ''}
          <div class="qr-nota">Telefoni sulla stessa Wi-Fi del computer</div>
        </div>
        <div class="lobby-dx">
          <div class="logo"><span>PARTY</span><span>GAME</span></div>
          <div class="lobby-bottoni">
            <button class="btn btn-grande" data-a="torneo">🏆 Torneo</button>
            <button class="btn btn-grande btn-2" data-a="libera">🎯 Scelta libera</button>
          </div>
          <div class="lobby-info">
            <span class="conta"></span>
            <span class="a-capo"></span>
            <button class="btn btn-piccolo btn-3" data-a="bot">🤖 Aggiungi bot</button>
            <button class="btn btn-piccolo btn-3" data-a="personaggi" title="Crea, modifica ed elimina i personaggi salvati su questo computer">👥 Personaggi</button>
            <button class="btn btn-piccolo btn-3" data-a="schermo">⛶ Schermo intero</button>
            <button class="btn btn-piccolo btn-3" data-a="muto">🔊</button>
          </div>
          <div class="lobby-cpu">
            <span>🤖 Potenza dei bot:</span>
            ${LIVELLI.map((l) => `<button class="cpu-liv" data-a="tutti" data-l="${l.id}" title="${esc(l.descrizione)}">${l.emoji} ${l.nome}</button>`).join('')}
          </div>
          <div class="lobby-cpu-nota">Vale per tutti i bot. Per cambiarne uno solo, clicca la sua icona qui sotto.</div>
        </div>
        <div class="lobby-chips"></div>
        <div class="audio-hint">🔈 Clicca ovunque per attivare l'audio</div>
      </div>`;
    ui.querySelector('.qr-box').innerHTML = window.QR ? window.QR.toSvg(url, { border: 2 }) : '';
    const sel = ui.querySelector('.qr-ip');
    if (sel) sel.onchange = () => {
      ipScelto = Number(sel.value);
      render();
    };
    ui.querySelector('.lobby').onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      sfx.click();
      const a = b.dataset.a;
      if (a === 'torneo') apriTorneo();
      else if (a === 'libera') vaiLibera();
      else if (a === 'bot') aggiungiBot();
      else if (a === 'personaggi') apriPersonaggi();
      else if (a === 'schermo') schermoIntero();
      else if (a === 'muto') {
        alternaMuto();
        b.textContent = isMuto() ? '🔇' : '🔊';
      } else if (a === 'kick') net.send({ t: 'kick', id: b.dataset.id });
      else if (a === 'liv') {
        const p = giocatori.get(b.dataset.id);
        if (p && p.bot) net.send({ t: 'botlevel', id: p.id, level: (p.livello + 1) % LIVELLI.length });
      } else if (a === 'tutti') {
        livelloNuoviBot = livelloValido(Number(b.dataset.l));
        try {
          localStorage.setItem('pg-livello-bot', String(livelloNuoviBot));
        } catch {}
        for (const p of lista()) if (p.bot) net.send({ t: 'botlevel', id: p.id, level: livelloNuoviBot });
        aggiornaChips();
      }
    };
    ui.querySelector('[data-a="muto"]').textContent = isMuto() ? '🔇' : '🔊';
    aggiornaChips();
    // ridisegnando la lobby le finestre aperte restano sopra
    if (modale) ui.appendChild(modale);
    if (gestione) ui.appendChild(gestione.el);
  }

  function aggiornaChips() {
    const box = ui.querySelector('.lobby-chips');
    if (!box) return;
    const gente = lista();
    const n = gente.length;
    ui.querySelector('.conta').innerHTML = `<b>${n}</b>/${MAX_GIOCATORI} giocatori${n < MIN_GIOCATORI ? ` · ne servono almeno ${MIN_GIOCATORI}` : ''}`;
    box.innerHTML = gente
      .map((p) => {
        const liv = p.bot ? LIVELLI[p.livello] : null;
        return `<span class="chip ${p.bot || p.connesso ? '' : 'off'}" style="--c:${p.colore}">${esc(p.nome)}${
          liv ? ` <button class="chip-liv" data-a="liv" data-id="${p.id}" title="${esc(`${liv.nome}: ${liv.descrizione}. Clicca per cambiare`)}">🤖${liv.emoji}</button>` : ''
        }${p.id === capoId() ? ' 👑' : ''}<button class="chip-via" data-a="kick" data-id="${p.id}" title="Togli dalla festa">✕</button></span>`;
      })
      .join('');
    for (const b of ui.querySelectorAll('.lobby-bottoni .btn')) b.disabled = n < MIN_GIOCATORI;
    // Il selettore "tutti" è acceso solo se tutti i bot hanno la stessa potenza.
    const bots = gente.filter((p) => p.bot);
    const comune = bots.length && bots.every((p) => p.livello === bots[0].livello) ? bots[0].livello : bots.length ? -1 : livelloNuoviBot;
    for (const b of ui.querySelectorAll('.cpu-liv')) b.classList.toggle('on', Number(b.dataset.l) === comune);
  }

  function vistaLobby() {
    if (gestione) return vistaGestione();
    vista('*', { screen: 'lobby', capo: capoId(), pochi: attivi().length < MIN_GIOCATORI, min: MIN_GIOCATORI, nGiochi: GIOCHI.length });
  }

  // Mentre sullo schermo si sistemano i personaggi, i telefoni aspettano
  // (così nessuno fa partire un torneo o modifica lo stesso personaggio).
  function vistaGestione() {
    vista('*', { screen: 'attesa', emoji: '👥', titolo: 'Un attimo…', testo: 'Sullo schermo si stanno sistemando i personaggi salvati.' });
  }

  function apriPersonaggi() {
    if (gestione || modale) return;
    gestione = creaGestione(() => {
      gestione = null;
      vistaLobby();
    });
    ui.appendChild(gestione.el);
    vistaGestione();
  }

  function apriTorneo() {
    if (gestione) return;
    if (attivi().length < MIN_GIOCATORI) return avviso(`Servono almeno ${MIN_GIOCATORI} giocatori (anche bot)`);
    modale = document.createElement('div');
    modale.className = 'modale schermo-entra';
    const inclusi = (id) => !prefs.esclusi.includes(id);
    modale.innerHTML = `
      <div class="modale-card">
        <h1>🏆 Nuovo torneo</h1>
        <div class="mod-sez">Quanti minigiochi?</div>
        <div class="mod-numeri">${[5, 10, 15, 20].map((n) => `<button class="num ${n === prefs.n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
        <label class="mod-toggle"><input type="checkbox" class="doppio" ${prefs.doppio ? 'checked' : ''}> ⭐ L'ultimo minigioco vale doppio</label>
        <div class="mod-sez">Minigiochi in gioco</div>
        <div class="mod-giochi">${GIOCHI.map(
          (d) => `<label class="mod-gioco ${inclusi(d.id) ? 'on' : ''}"><input type="checkbox" data-id="${d.id}" ${inclusi(d.id) ? 'checked' : ''}>${d.emoji} ${esc(d.nome)}</label>`,
        ).join('')}</div>
        <div class="mod-foot">
          <button class="btn btn-3" data-m="annulla">Annulla</button>
          <button class="btn btn-grande" data-m="via">Inizia! ▶</button>
        </div>
      </div>`;
    modale.onclick = (e) => {
      const num = e.target.closest('[data-n]');
      if (num) {
        prefs.n = Number(num.dataset.n);
        for (const b of modale.querySelectorAll('[data-n]')) b.classList.toggle('on', b === num);
        sfx.click();
      }
      const cb = e.target.closest('.mod-gioco input');
      if (cb) cb.parentElement.classList.toggle('on', cb.checked);
      const m = e.target.closest('[data-m]');
      if (m) {
        sfx.click();
        if (m.dataset.m === 'annulla') chiudiModale();
        else confermaTorneo();
      }
    };
    ui.appendChild(modale);
    vista('*', { screen: 'attesa', emoji: '🏆', titolo: 'Si prepara il torneo', testo: 'Lo schermo sta scegliendo le regole…' });
  }

  function chiudiModale() {
    if (modale) modale.remove();
    modale = null;
    vistaLobby();
  }

  function confermaTorneo() {
    prefs.doppio = modale.querySelector('.doppio').checked;
    prefs.esclusi = [...modale.querySelectorAll('.mod-gioco input')].filter((c) => !c.checked).map((c) => c.dataset.id);
    if (prefs.esclusi.length >= GIOCHI.length) return avviso('Scegli almeno un minigioco');
    try {
      localStorage.setItem('pg-torneo', JSON.stringify(prefs));
    } catch {}
    iniziaTorneo(prefs.n, prefs.doppio, GIOCHI.map((d) => d.id).filter((id) => !prefs.esclusi.includes(id)));
  }

  function aggiungiBot() {
    if (lista().length + botInArrivo.size >= MAX_GIOCATORI) return avviso('La festa è piena');
    const usati = new Set([...lista().map((p) => p.nome), ...botInArrivo]);
    const nome = NOMI_BOT.find((n) => !usati.has(n)) || 'Bot';
    botInArrivo.add(nome);
    setTimeout(() => botInArrivo.delete(nome), 1500);
    net.send({ t: 'addbot', name: nome, avatar: casuale(null), level: livelloNuoviBot });
  }

  return {
    entra() {
      musica(true);
      render();
      vistaLobby();
    },
    refresh() {
      render();
      vistaLobby();
      if (gestione) gestione.aggiorna();
    },
    esci() {
      if (gestione) gestione.chiudi(false);
    },
    personaggi() {
      if (gestione) gestione.aggiorna();
    },
    aggiorna(dt) {
      for (const p of giocatori.values()) aggiornaCamminata(p, dt, area);
    },
    disegna(g, t) {
      sfondoFesta(g, t);
      disegnaFolla(g, t, lista());
    },
    giocatoreCambiato() {
      aggiornaChips();
      if (!modale) vistaLobby();
    },
    sys(pid, d, capo) {
      if (!capo || gestione) return;
      if (d.azione === 'torneo') {
        if (attivi().length < MIN_GIOCATORI) return;
        const n = [5, 10, 15, 20].includes(d.n) ? d.n : prefs.n;
        iniziaTorneo(n, prefs.doppio, GIOCHI.map((x) => x.id).filter((id) => !prefs.esclusi.includes(id)));
      } else if (d.azione === 'libera') {
        if (attivi().length >= MIN_GIOCATORI) vaiLibera();
      }
    },
    tasto(e) {
      if (gestione) return gestione.tasto(e);
      if (e.key === 'Escape' && modale) {
        chiudiModale();
        return true;
      }
      if (e.key === 'Enter') {
        if (modale) confermaTorneo();
        else apriTorneo();
        return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Personaggi salvati sul computer: elenco, nuovo, modifica, elimina.
// Le modifiche le fa il server, che poi rimanda l'elenco aggiornato a tutti.

function firmaPersonaggi() {
  return personaggi.map((c) => `${c.id}:${c.name}:${c.use || ''}:${JSON.stringify(c.avatar)}`).join('|');
}

function creaGestione(onChiudi) {
  const el = document.createElement('div');
  el.className = 'modale gestione schermo-entra';
  let editor = null;
  let daEliminare = null; // id in attesa di conferma
  let appena = null; // nome (minuscolo) appena salvato, da far brillare
  let timerAppena = 0;
  let firma = '';

  function chiudiEditor() {
    if (editor) editor.chiudi();
    editor = null;
  }

  function renderLista() {
    chiudiEditor();
    firma = firmaPersonaggi();
    const elenco = [...personaggi].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
    const pieno = elenco.length >= maxPersonaggi;
    el.innerHTML = `
      <div class="modale-card gest-card">
        <div class="gest-testa">
          <h1>👥 Personaggi salvati</h1>
          <span class="gest-conta">${elenco.length} / ${maxPersonaggi}</span>
        </div>
        <p class="gest-sotto">Sono salvati su questo computer: chi entra col telefono li ritrova nella galleria “Chi sei?”.</p>
        <div class="gest-griglia">
          <button class="gest-nuovo" data-g="nuovo" ${pieno ? 'disabled title="Hai raggiunto il massimo: eliminane qualcuno"' : ''}><span>➕</span>Nuovo personaggio</button>
        </div>
        <div class="mod-foot"><span class="gest-tasti">Esc per chiudere</span><button class="btn" data-g="chiudi">Fatto ✔</button></div>
      </div>`;
    const griglia = el.querySelector('.gest-griglia');
    for (const c of elenco) {
      const card = document.createElement('div');
      card.className = `gest-pg${c.use ? ' in-festa' : ''}${appena === c.name.toLowerCase() ? ' appena' : ''}`;
      card.style.setProperty('--c', coloreGiocatore(c.avatar?.colore ?? 0));
      const fig = document.createElement('div');
      fig.className = 'gp-av';
      fig.appendChild(canvasAvatar(c.avatar, 170, 190));
      card.appendChild(fig);
      const stato = c.use === 'on' ? '🎮 Sta giocando' : c.use === 'off' ? '💤 Nella festa (telefono spento)' : '';
      card.insertAdjacentHTML(
        'beforeend',
        `<div class="gp-nome">${esc(c.name)}</div>
        <div class="gp-stato">${stato}</div>
        <div class="gp-azioni">
          <button class="btn btn-piccolo btn-3" data-g="modifica" data-id="${c.id}">✏️ Modifica</button>
          <button class="btn btn-piccolo btn-3" data-g="elimina" data-id="${c.id}" ${
            c.use ? 'disabled title="È nella festa: per eliminarlo prima toglilo dalla festa"' : 'title="Elimina"'
          }>🗑️</button>
        </div>
        ${
          daEliminare === c.id
            ? `<div class="gp-conferma"><b>Eliminare ${esc(c.name)}?</b><span>Non si torna indietro</span>
                <button class="btn btn-piccolo btn-2" data-g="si" data-id="${c.id}">Sì, elimina</button>
                <button class="btn btn-piccolo btn-3" data-g="no">No</button></div>`
            : ''
        }`,
      );
      griglia.appendChild(card);
    }
    if (!elenco.length) {
      griglia.insertAdjacentHTML(
        'beforeend',
        '<div class="gest-vuota">Non c\'è ancora nessun personaggio. Si salvano da soli quando qualcuno entra col telefono, oppure puoi crearli da qui.</div>',
      );
    }
    const brilla = griglia.querySelector('.appena');
    if (brilla) brilla.scrollIntoView({ block: 'nearest' });
  }

  function apriModifica(c) {
    daEliminare = null;
    el.innerHTML = `
      <div class="modale-card gest-card gest-modifica">
        <div class="gest-testa">
          <h1>${c ? `✏️ Modifica ${esc(c.name)}` : '➕ Nuovo personaggio'}</h1>
          ${c && c.use ? '<span class="gest-conta">è nella festa: le modifiche si vedono subito</span>' : ''}
        </div>
        <div class="gest-editor"></div>
      </div>`;
    editor = apriEditor(el.querySelector('.gest-editor'), {
      avatar: c ? c.avatar : casuale(),
      nome: c ? c.name : '',
      classeBottone: 'btn',
      testoFatto: 'Salva ✔',
      segnaposto: 'Nome del personaggio',
      erroreNome: 'Scrivi il nome ✍️',
      miniatura: 88,
      notaColore: 'Il colore fa riconoscere il personaggio sullo schermo grande. Se quando entra è già preso da qualcun altro, gliene tocca uno libero.',
      controllaNome: (nome) =>
        personaggi.some((x) => x.id !== c?.id && x.name.toLowerCase() === nome.toLowerCase()) ? `C'è già un personaggio che si chiama ${nome}` : null,
      onAnnulla: () => {
        sfx.click();
        renderLista();
      },
      onFatto: (nome, avatar) => {
        sfx.click();
        net.send({ t: 'charsave', pid: c ? c.id : undefined, name: nome, avatar });
        appena = nome.toLowerCase();
        clearTimeout(timerAppena);
        timerAppena = setTimeout(() => (appena = null), 3000);
        renderLista();
      },
    });
    if (!c) el.querySelector('.ed-nome').focus();
  }

  function chiudi(avvisa = true) {
    chiudiEditor();
    clearTimeout(timerAppena);
    el.remove();
    if (avvisa) onChiudi();
  }

  el.onclick = (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    sfx.click();
    const azione = b.dataset.g;
    const c = personaggi.find((x) => x.id === b.dataset.id);
    if (azione === 'chiudi') chiudi();
    else if (azione === 'nuovo') apriModifica(null);
    else if (azione === 'modifica' && c) apriModifica(c);
    else if (azione === 'elimina' && c) {
      daEliminare = c.id;
      renderLista();
    } else if (azione === 'no') {
      daEliminare = null;
      renderLista();
    } else if (azione === 'si' && c) {
      net.send({ t: 'chardel', pid: c.id });
      daEliminare = null;
    }
  };

  renderLista();

  return {
    el,
    chiudi,
    // Elenco cambiato sul server: si ridisegna, ma mai mentre si modifica un personaggio.
    aggiorna() {
      if (editor || firmaPersonaggi() === firma) return;
      if (daEliminare && !personaggi.some((c) => c.id === daEliminare && !c.use)) daEliminare = null;
      renderLista();
    },
    tasto(e) {
      if (e.key !== 'Escape') return false;
      if (editor) renderLista();
      else if (daEliminare) {
        daEliminare = null;
        renderLista();
      } else chiudi();
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Torneo

function iniziaTorneo(n, doppio, inclusi) {
  const coda = [];
  let ultimoId = null;
  while (coda.length < n) {
    const giro = shuffle([...inclusi]);
    // Evita lo stesso minigioco due volte di fila a cavallo tra un giro e l'altro.
    if (giro.length > 1 && giro[0] === ultimoId) giro.push(giro.shift());
    for (const id of giro) if (coda.length < n) coda.push(id);
    ultimoId = coda[coda.length - 1];
  }
  const punti = {};
  const vittorie = {};
  for (const p of giocatori.values()) {
    punti[p.id] = 0;
    vittorie[p.id] = 0;
  }
  torneo = { totale: n, doppio, coda, indice: 0, punti, vittorie };
  salva();
  vaiA(scenaRoulette());
}

function giocoDef(id) {
  return GIOCHI.find((d) => d.id === id);
}

function scenaRoulette() {
  const idScelto = torneo.coda[torneo.indice];
  const def = giocoDef(idScelto);
  const voci = [];
  for (let i = 0; i < 30; i++) voci.push(pick(GIOCHI));
  voci.push(def);
  let t = 0;
  let ultimoIdx = -1;
  const durata = 3.2;
  const numero = torneo.indice + 1;

  return {
    entra() {
      musica(true);
      vista('*', { screen: 'attesa', emoji: '🎰', titolo: `Minigioco ${numero} di ${torneo.totale}`, testo: 'Si pesca il prossimo minigioco… guarda lo schermo!' });
      ui.innerHTML = `<div class="roulette-top schermo-entra"><div class="rt-etichetta">Minigioco ${numero} di ${torneo.totale}</div></div>`;
    },
    aggiorna(dt) {
      t += dt;
      if (t > durata + 1.6) avviaMinigioco(def, 'torneo');
    },
    disegna(g, tt) {
      sfondoFesta(g, tt, '#1d0f4a', '#5a189a');
      const k = Math.min(1, t / durata);
      const pos = ease.outCubic(k) * (voci.length - 1);
      const idx = Math.round(pos);
      if (idx !== ultimoIdx) {
        ultimoIdx = idx;
        if (k < 1) sfx.tic();
        else sfx.ding();
      }
      const cx = W / 2;
      const cy = H / 2 + 40;
      pannello(g, cx - 560, cy - 260, 1120, 520, { r: 40, colore: 'rgba(15,5,40,0.8)', bordo: '#ffd23f', lw: 8 });
      g.save();
      g.beginPath();
      g.roundRect(cx - 550, cy - 250, 1100, 500, 34);
      g.clip();
      for (let i = Math.max(0, idx - 2); i <= Math.min(voci.length - 1, idx + 2); i++) {
        const off = (i - pos) * 230;
        const d = voci[i];
        const a = 1 - Math.min(1, Math.abs(off) / 400);
        g.globalAlpha = 0.25 + a * 0.75;
        const s = 0.6 + a * 0.4;
        g.save();
        g.translate(cx, cy + off);
        g.scale(s, s);
        g.font = `150px ${"'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif"}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(d.emoji, -330, 0);
        testo(g, d.nome, 90, 0, { dim: 96, colore: i === voci.length - 1 && k >= 1 ? '#ffd23f' : '#fff', maxW: 780 });
        g.restore();
      }
      g.restore();
      g.globalAlpha = 1;
      if (k >= 1) {
        const kk = Math.min(1, (t - durata) / 0.4);
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 10 * (1 - kk) + 2;
        g.beginPath();
        g.roundRect(cx - 560 - kk * 30, cy - 130 - kk * 20, 1120 + kk * 60, 260 + kk * 40, 30);
        g.stroke();
      }
    },
    tasto(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        avviaMinigioco(def, 'torneo');
        return true;
      }
      return false;
    },
  };
}

// Chi ha fatto un ruolo speciale (es. il Polpo) nella serata: la prossima volta tocca ad altri.
function registraRuoli(def, ris) {
  if (!ris || !ris.ruoli || ris.ricomincia || !ris.punti) return;
  serata.ruoli = serata.ruoli || {};
  for (const [id, r] of Object.entries(ris.ruoli)) {
    if (!def.infoRuoli || !def.infoRuoli[r] || !def.infoRuoli[r].speciale) continue;
    const m = (serata.ruoli[r] = serata.ruoli[r] || {});
    m[id] = (m[id] || 0) + 1;
  }
}

function avviaMinigioco(def, modo) {
  const gente = attivi();
  const inTorneo = modo === 'torneo' && torneo;
  const moltiplicatore = inTorneo && torneo.doppio && torneo.indice === torneo.totale - 1 ? 2 : 1;
  const partita = creaPartita({
    def,
    giocatori: gente,
    app,
    etichettaTorneo: inTorneo ? `Minigioco ${torneo.indice + 1} di ${torneo.totale}` : 'Scelta libera',
    moltiplicatore,
    // giochi a ruoli: nel torneo il ruolo speciale va a chi è più indietro
    classifica: inTorneo ? { ...torneo.punti } : null,
    storico: serata.ruoli || {},
    onFine: (ris) => {
      if (ris && ris.ricomincia) return avviaMinigioco(def, modo);
      registraRuoli(def, ris);
      if (inTorneo) {
        if (!ris) {
          // Uscita senza punti: al suo posto si pesca un altro minigioco.
          const altri = GIOCHI.filter((d) => d.id !== def.id);
          if (altri.length) torneo.coda[torneo.indice] = pick(altri).id;
          salva();
          return vaiA(scenaClassifica({ modo: 'torneo' }));
        }
        for (const [id, pt] of Object.entries(ris.punti)) torneo.punti[id] = (torneo.punti[id] || 0) + pt;
        for (const id of ris.gruppi[0] || []) torneo.vittorie[id] = (torneo.vittorie[id] || 0) + 1;
        torneo.indice++;
        salva();
        vaiA(scenaClassifica({ modo: 'torneo', delta: ris.punti }));
      } else {
        if (ris) {
          for (const [id, pt] of Object.entries(ris.punti)) serata.punti[id] = (serata.punti[id] || 0) + pt;
          for (const id of ris.gruppi[0] || []) serata.vittorie[id] = (serata.vittorie[id] || 0) + 1;
          salva();
        }
        vaiA(scenaCatalogo());
      }
    },
  });
  vaiA(partita);
}

// ---------------------------------------------------------------------------
// Classifica generale (torneo o serata)

function scenaClassifica({ modo, delta = null, ripresa = false }) {
  const dati = modo === 'torneo' ? torneo : serata;
  const finale = modo === 'torneo' && torneo.indice >= torneo.totale;
  let righe = [];
  let timers = [];

  function totali() {
    const out = {};
    for (const p of lista()) out[p.id] = dati.punti[p.id] || 0;
    return out;
  }

  function ordina(punti) {
    return lista()
      .map((p) => p.id)
      .sort((a, b) => punti[b] - punti[a] || (dati.vittorie[b] || 0) - (dati.vittorie[a] || 0));
  }

  function posizioni(ordine, punti) {
    const pos = {};
    ordine.forEach((id, i) => {
      pos[id] = i > 0 && punti[id] === punti[ordine[i - 1]] ? pos[ordine[i - 1]] : i + 1;
    });
    return pos;
  }

  function avanti() {
    if (modo === 'serata') return vaiA(scenaCatalogo());
    if (finale) return vaiA(scenaPodio());
    vaiA(scenaRoulette());
  }

  function mandaViste(punti) {
    const ordine = ordina(punti);
    const pos = posizioni(ordine, punti);
    const capo = capoId();
    for (const p of lista()) {
      if (p.bot) continue;
      vista(p.id, {
        screen: 'board',
        pos: pos[p.id],
        tot: ordine.length,
        punti: punti[p.id],
        delta: delta ? delta[p.id] || 0 : null,
        capo,
        titolo: modo === 'torneo' ? `Dopo ${torneo.indice} di ${torneo.totale}` : 'Classifica della serata',
        finale,
        modo,
      });
    }
  }

  return {
    entra() {
      musica(true);
      const dopo = totali();
      const prima = {};
      for (const [id, v] of Object.entries(dopo)) prima[id] = v - (delta ? delta[id] || 0 : 0);
      const ordine0 = ordina(prima);
      const ordine1 = ordina(dopo);
      const n = ordine0.length;
      const hRiga = Math.min(78, Math.floor(760 / Math.max(1, n)));
      const max = Math.max(1, ...Object.values(dopo));
      const titolo =
        modo === 'torneo'
          ? finale
            ? 'Classifica finale!'
            : `Dopo ${torneo.indice} ${torneo.indice === 1 ? 'minigioco' : 'minigiochi'} su ${torneo.totale}`
          : 'Classifica della serata';
      const prossimo =
        modo === 'torneo'
          ? finale
            ? 'Avanti: il podio! 🏆'
            : `Prossimo: minigioco ${torneo.indice + 1} di ${torneo.totale}${torneo.doppio && torneo.indice === torneo.totale - 1 ? ' · ⭐ punti doppi!' : ''}`
          : 'Avanti: torna ai minigiochi';
      ui.innerHTML = `
        <div class="classifica schermo-entra">
          <h1>${modo === 'torneo' ? '🏆' : '📊'} Classifica</h1>
          <h2>${esc(titolo)}${ripresa ? ' · torneo ripreso' : ''}</h2>
          <div class="cl-lista" style="height:${n * hRiga}px"></div>
          <div class="cl-foot"><span>${esc(prossimo)}</span>
            ${modo === 'torneo' ? '<button class="btn btn-3 btn-piccolo" data-a="stop">✖ Chiudi torneo</button>' : ''}
            <button class="btn" data-a="avanti">Avanti ▶</button></div>
        </div>`;
      const box = ui.querySelector('.cl-lista');
      const pos0 = posizioni(ordine0, prima);
      righe = ordine0.map((id, i) => {
        const p = giocatori.get(id);
        const el = document.createElement('div');
        el.className = 'cl-riga';
        el.style.height = `${hRiga - 8}px`;
        el.style.transform = `translateY(${i * hRiga}px)`;
        el.style.setProperty('--c', p.colore);
        el.innerHTML = `<div class="cl-pos">${pos0[id]}°</div>`;
        el.appendChild(canvasAvatar(p.av, hRiga - 10, hRiga - 10, { soloTesta: true }));
        el.insertAdjacentHTML(
          'beforeend',
          `<div class="cl-nome">${esc(p.nome)}</div><div class="cl-barra"><div style="width:${(prima[id] / max) * 100}%"></div></div><div class="cl-delta"></div><div class="cl-tot">${prima[id]}</div>`,
        );
        box.appendChild(el);
        return { id, el };
      });
      ui.querySelector('.classifica').onclick = (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'avanti') avanti();
        else if (a === 'stop') {
          torneo = null;
          salva();
          vaiA(scenaLobby());
        }
      };
      mandaViste(dopo);

      if (!delta) return;
      timers.push(
        setTimeout(() => {
          righe.forEach(({ id, el }, i) => {
            const d = delta[id] || 0;
            const b = el.querySelector('.cl-delta');
            b.textContent = d ? `+${d}` : '+0';
            b.classList.add('vis');
            if (d) setTimeout(() => sfx.punto(i), i * 40);
            el.querySelector('.cl-tot').textContent = dopo[id];
            el.querySelector('.cl-barra div').style.width = `${(dopo[id] / max) * 100}%`;
          });
        }, 700),
      );
      timers.push(
        setTimeout(() => {
          const pos1 = posizioni(ordine1, dopo);
          for (const { id, el } of righe) {
            const i = ordine1.indexOf(id);
            const prima0 = ordine0.indexOf(id);
            el.style.transform = `translateY(${i * hRiga}px)`;
            el.querySelector('.cl-pos').textContent = `${pos1[id]}°`;
            el.classList.toggle('su', i < prima0);
            el.classList.toggle('giu', i > prima0);
          }
          sfx.whoosh();
        }, 2000),
      );
    },
    esci() {
      timers.forEach(clearTimeout);
    },
    disegna(g, t) {
      sfondoFesta(g, t, '#1d0f4a', '#3c1a78');
    },
    sys(pid, d, capo) {
      if (capo && d.azione === 'avanti') avanti();
    },
    tasto(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        avanti();
        return true;
      }
      if (e.key === 'Escape' && modo === 'serata') {
        vaiA(scenaCatalogo());
        return true;
      }
      return false;
    },
    giocatoreCambiato() {},
  };
}

// ---------------------------------------------------------------------------
// Podio

function scenaPodio() {
  const punti = {};
  for (const p of lista()) punti[p.id] = torneo.punti[p.id] || 0;
  const ordine = lista()
    .map((p) => p.id)
    .sort((a, b) => punti[b] - punti[a] || (torneo.vittorie[b] || 0) - (torneo.vittorie[a] || 0));
  const pos = {};
  ordine.forEach((id, i) => {
    pos[id] = i > 0 && punti[id] === punti[ordine[i - 1]] && (torneo.vittorie[id] || 0) === (torneo.vittorie[ordine[i - 1]] || 0) ? pos[ordine[i - 1]] : i + 1;
  });
  const gradini = [1, 2, 3].map((n) => ordine.filter((id) => pos[id] === n));
  let t = 0;
  let prossimiCoriandoli = 0;
  const vincitori = gradini[0].map((id) => giocatori.get(id)?.nome).filter(Boolean);
  const storico = { ...torneo };

  function fine(azione) {
    torneo = null;
    salva();
    if (azione === 'ancora') iniziaTorneo(storico.totale, storico.doppio, GIOCHI.map((d) => d.id).filter((id) => !prefs.esclusi.includes(id)));
    else vaiA(scenaLobby());
  }

  return {
    entra() {
      musica(false);
      sfx.rullo(1.6);
      setTimeout(() => {
        sfx.fanfara();
        fx.coriandoli(260);
      }, 1700);
      const piuVittorie = Math.max(0, ...ordine.map((id) => storico.vittorie[id] || 0));
      const re = ordine.filter((id) => piuVittorie > 0 && (storico.vittorie[id] || 0) === piuVittorie).map((id) => giocatori.get(id).nome);
      ui.innerHTML = `
        <div class="podio schermo-entra">
          <div class="podio-titolo">🏆 ${vincitori.length > 1 ? 'Campioni' : 'Campione'}: ${esc(vincitori.join(' e '))}!</div>
          ${re.length && re.length <= 3 ? `<div class="podio-premio">🎯 Più minigiochi vinti: ${esc(re.join(', '))} (${piuVittorie})</div>` : ''}
          <div class="podio-foot">
            <button class="btn btn-3" data-a="lobby">🏠 Lobby</button>
            <button class="btn" data-a="ancora">🔁 Un altro torneo</button>
          </div>
        </div>`;
      ui.querySelector('.podio').onclick = (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a) fine(a);
      };
      const capo = capoId();
      for (const p of lista()) {
        if (p.bot) continue;
        vista(p.id, { screen: 'podio', pos: pos[p.id], tot: ordine.length, punti: punti[p.id], capo, vincitori });
      }
    },
    aggiorna(dt) {
      t += dt;
      if (t > 3 && t > prossimiCoriandoli) {
        prossimiCoriandoli = t + 4;
        fx.coriandoli(80);
      }
    },
    disegna(g, tt) {
      sfondoFesta(g, tt, '#2a0f5c', '#b5179e');
      // Raggi di luce
      g.save();
      g.translate(W / 2, 1000);
      g.globalAlpha = 0.08;
      g.fillStyle = '#fff';
      for (let i = 0; i < 12; i++) {
        g.rotate(TAU / 12);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-90, -1400);
        g.lineTo(90, -1400);
        g.fill();
      }
      g.restore();
      g.globalAlpha = 1;
      const salita = ease.outCubic(clamp(t / 1.5, 0, 1));
      const blocchi = [
        { n: 2, x: W / 2 - 330, h: 240, c: '#c0c7d6' },
        { n: 1, x: W / 2, h: 340, c: '#ffd23f' },
        { n: 3, x: W / 2 + 330, h: 170, c: '#e3985b' },
      ];
      const base = 1010;
      for (const b of blocchi) {
        const h = b.h * salita;
        g.beginPath();
        g.roundRect(b.x - 150, base - h, 300, h + 40, 18);
        g.fillStyle = b.c;
        g.fill();
        g.strokeStyle = 'rgba(20,10,45,0.8)';
        g.lineWidth = 6;
        g.stroke();
        testo(g, `${b.n}°`, b.x, base - h + 115, { dim: 90 });
        const chi = gradini[b.n - 1].map((id) => giocatori.get(id)).filter(Boolean);
        const mostra = t > (b.n === 1 ? 1.7 : b.n === 2 ? 1.2 : 0.8);
        if (!mostra) continue;
        const hAv = chi.length > 2 ? 150 : chi.length > 1 ? 190 : b.n === 1 ? 280 : 230;
        chi.forEach((p, i) => {
          const x = b.x + (i - (chi.length - 1) / 2) * Math.min(150, 300 / Math.max(1, chi.length - 1 || 1));
          disegnaAvatar(g, p.av, x, base - h, hAv, { pose: b.n === 1 ? 'cheer' : 'idle', t: tt, espr: 'felice' });
          etichetta(g, `${p.nome} · ${punti[p.id]}`, x, base - h + 26, p.colore, { dim: 26 });
        });
      }
      if (t > 2) {
        const altri = ordine.filter((id) => pos[id] > 3).map((id) => giocatori.get(id)).filter(Boolean);
        const meta = Math.ceil(altri.length / 2);
        altri.forEach((p, i) => {
          const sinistra = i < meta;
          const x = sinistra ? 80 : W - 80;
          const y = 290 + (sinistra ? i : i - meta) * 68;
          testo(g, `${pos[p.id]}° ${p.nome} · ${punti[p.id]}`, x, y, { dim: 32, allinea: sinistra ? 'left' : 'right', colore: p.colore, maxW: 440 });
        });
      }
    },
    sys(pid, d, capo) {
      if (!capo) return;
      if (d.azione === 'ancora' || d.azione === 'lobby') fine(d.azione);
    },
    tasto(e) {
      if (e.key === 'Enter') {
        fine('lobby');
        return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Scelta libera: catalogo dei minigiochi

function vaiLibera() {
  if (attivi().length < MIN_GIOCATORI) return avviso(`Servono almeno ${MIN_GIOCATORI} giocatori (anche bot)`);
  vaiA(scenaCatalogo());
}

function scenaCatalogo() {
  function vistaCatalogo() {
    vista('*', {
      screen: 'catalogo',
      capo: capoId(),
      giochi: GIOCHI.map((d) => ({ id: d.id, nome: d.nome, emoji: d.emoji, descrizione: d.descrizione })),
    });
  }

  function scegli(id) {
    const def = giocoDef(id);
    if (!def) return;
    if (attivi().length < MIN_GIOCATORI) return avviso(`Servono almeno ${MIN_GIOCATORI} giocatori`);
    sfx.click();
    avviaMinigioco(def, 'libera');
  }

  return {
    entra() {
      musica(true);
      ui.innerHTML = `
        <div class="catalogo schermo-entra">
          <div class="cat-testa">
            <h1>🎯 Scelta libera</h1>
            <div class="cat-bottoni">
              <button class="btn btn-2 btn-piccolo" data-a="serata">📊 Classifica della serata</button>
              <button class="btn btn-3 btn-piccolo" data-a="lobby">🏠 Lobby</button>
            </div>
          </div>
          <div class="cat-griglia">
            ${GIOCHI.map((d) => {
              const c = CONTROLLI[d.controllo] || { emoji: '🎮', nome: '' };
              return `<button class="cat-card" data-id="${d.id}" style="--c:${d.colore}">
                <div class="cat-emoji">${d.emoji}</div>
                <div class="cat-nome">${esc(d.nome)}</div>
                <div class="cat-desc">${esc(d.descrizione)}</div>
                <div class="cat-ctrl">${c.emoji} ${esc(c.nome)}</div>
              </button>`;
            }).join('')}
          </div>
          <div class="cat-nota">Clicca un minigioco · oppure lo sceglie il capo 👑 dal telefono</div>
        </div>`;
      ui.querySelector('.catalogo').onclick = (e) => {
        const card = e.target.closest('.cat-card');
        if (card) return scegli(card.dataset.id);
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'lobby') vaiA(scenaLobby());
        else if (a === 'serata') vaiA(scenaClassifica({ modo: 'serata' }));
      };
      vistaCatalogo();
    },
    disegna(g, t) {
      sfondoFesta(g, t, '#12305c', '#5a189a');
    },
    giocatoreCambiato() {
      vistaCatalogo();
    },
    sys(pid, d, capo) {
      if (!capo) return;
      if (d.azione === 'gioca') scegli(d.id);
      else if (d.azione === 'lobby') vaiA(scenaLobby());
    },
    tasto(e) {
      if (e.key === 'Escape') {
        vaiA(scenaLobby());
        return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Avvio

(async () => {
  try {
    await document.fonts.load(`700 40px Fredoka`);
  } catch {}
  GIOCHI = await caricaHost();
  net = connect({
    role: 'host',
    onMessage,
    onStatus: (s) => document.body.classList.toggle('offline', s !== 'open'),
  });
  app.net = net;
  requestAnimationFrame(frame);
})();
