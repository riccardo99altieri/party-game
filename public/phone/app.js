// Telefono: ingresso (nome + avatar), attese, "Pronto!", controller dei
// minigiochi, risultati e comandi del capo. Le schermate le decide lo schermo
// principale mandando delle "viste".

import { connect } from '../shared/net.js';
import { canvasAvatar, disegnaAvatar, disegnaTesta, normalizza, casuale, prepara } from '../shared/avatar.js';
import { coloreGiocatore, COLORI_GIOCATORE } from '../shared/util.js';
import { apriEditor } from '../shared/editor.js';
import { caricaPhone, CONTROLLI } from '../games/index.js';
import * as widgets from './widgets.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const barra = document.getElementById('barra');
const schermo = document.getElementById('schermo');
const velo = document.getElementById('velo');

const LS_TOKEN = 'pg-token';
const LS_PROFILO = 'pg-profilo';

function leggi(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function scrivi(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
}

let token = leggi(LS_TOKEN);
// profilo = il personaggio scelto { nome, avatar, pid } (pid = id del personaggio salvato sul computer)
let profilo = null;
try {
  profilo = JSON.parse(leggi(LS_PROFILO) || 'null');
} catch {}
let pidLocale = profilo?.pid || null; // l'ultimo personaggio usato su questo telefono

let me = null; // giocatore dal server
let lobby = [];
let personaggi = []; // personaggi salvati sul computer
let festaPiena = false;
let ingresso = null; // schermata d'ingresso aperta: scheda | galleria | nome
let hostOnline = true;
let connesso = false;
let vista = null;
let editor = null;
let montato = null; // { run, id, istanza, el, carica }
let animazioni = [];
let prontoRun = null;
let fase = 'avvio'; // avvio | ingresso | editor | dentro | rimosso | piena

const net = connect({
  role: 'phone',
  token: () => token,
  onMessage,
  onStatus: (s) => {
    connesso = s === 'open';
    aggiornaVelo();
  },
});

function inviaSys(d) {
  net.send({ t: 'sys', d });
  widgets.vibra(10);
}

// ---------------------------------------------------------------------------
// Messaggi dal server

function onMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      connesso = true;
      hostOnline = msg.host;
      if (msg.you) {
        me = msg.you;
        token = msg.token;
        scrivi(LS_TOKEN, token);
        if (me.pid && profilo && !profilo.pid) salvaProfilo({ ...profilo, pid: me.pid });
        fase = 'dentro';
        renderBarra();
        mostraVista(msg.view || vista || attesaDefault());
      } else {
        token = null;
        scrivi(LS_TOKEN, null);
        me = null;
        personaggi = msg.chars || personaggi;
        festaPiena = !!msg.full;
        if (fase !== 'editor') {
          if (msg.full && !personaggi.some((c) => c.use === 'off')) mostraPiena();
          else mostraIngresso();
        }
      }
      aggiornaVelo();
      break;
    case 'joined':
      me = msg.you;
      token = msg.token;
      scrivi(LS_TOKEN, token);
      salvaProfilo({ nome: profilo?.nome || me.name, avatar: me.avatar, pid: me.pid });
      fase = 'dentro';
      chiudiEditor();
      renderBarra();
      mostraVista(msg.view || vista || attesaDefault());
      widgets.vibra([30, 40, 30]);
      break;
    case 'you':
      // msg.nome c'è quando il personaggio l'ha cambiato lo schermo
      me = msg.you;
      salvaProfilo({ nome: msg.nome || profilo?.nome || me.name, avatar: me.avatar, pid: me.pid || profilo?.pid });
      renderBarra();
      break;
    case 'chars': {
      const prima = firmaPersonaggi();
      personaggi = msg.list || [];
      if (fase === 'ingresso' && (ingresso === 'galleria' || ingresso === 'scheda') && firmaPersonaggi() !== prima) mostraIngresso(ingresso);
      break;
    }
    case 'lobby':
      lobby = msg.players || [];
      festaPiena = lobby.length >= (msg.max || 16);
      if (editor) editor.aggiornaPresi();
      if (vista && vista.screen === 'lobby' && fase === 'dentro') mostraVista(vista);
      break;
    case 'view':
      vista = msg.v;
      if (fase === 'dentro') mostraVista(vista);
      break;
    case 'msg':
      if (montato && montato.istanza && msg.d && msg.d.run === montato.run && montato.istanza.messaggio) montato.istanza.messaggio(msg.d.d);
      break;
    case 'host':
      hostOnline = msg.online;
      aggiornaVelo();
      break;
    case 'removed':
      me = null;
      token = null;
      scrivi(LS_TOKEN, null);
      smonta();
      fase = 'rimosso';
      renderBarra();
      schermo.innerHTML = `<div class="centro"><div class="emoji-grande">👋</div><h1>Sei fuori dalla festa</h1><p>${esc(msg.reason || '')}</p><button class="btn-tel" id="rientra">Rientra</button></div>`;
      document.getElementById('rientra').onclick = () => mostraIngresso();
      break;
    case 'error': {
      const e = schermo.querySelector('.ed-errore');
      if (e && (editor || fase === 'ingresso')) e.textContent = msg.text;
      else alert(msg.text);
      break;
    }
  }
}

function aggiornaVelo() {
  let testo = '';
  if (!connesso) testo = '📡 Collegamento perso… riprovo';
  else if (!hostOnline && fase === 'dentro') testo = '🖥️ Lo schermo principale non è collegato';
  velo.textContent = testo;
  velo.classList.toggle('vis', !!testo);
}

function attesaDefault() {
  return { screen: 'attesa', emoji: '👀', titolo: 'Sei dentro!', testo: 'Guarda lo schermo grande: entri dal prossimo minigioco.' };
}

// ---------------------------------------------------------------------------
// Barra in alto

function renderBarra() {
  barra.innerHTML = '';
  if (!me) {
    barra.innerHTML = '<div class="barra-logo">PARTY <b>GAME</b></div>';
    barra.style.removeProperty('--c');
    return;
  }
  barra.style.setProperty('--c', coloreGiocatore(me.color));
  barra.appendChild(canvasAvatar(me.avatar, 40, 40, { soloTesta: true }));
  const n = document.createElement('div');
  n.className = 'barra-nome';
  n.textContent = me.name;
  barra.appendChild(n);
  if (document.fullscreenEnabled) {
    const fs = document.createElement('button');
    fs.className = 'barra-fs';
    fs.textContent = '⛶';
    fs.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    };
    barra.appendChild(fs);
  }
}

// ---------------------------------------------------------------------------
// Ingresso

function coloriPresi() {
  return lobby.filter((p) => !me || p.id !== me.id).map((p) => p.color);
}

function mostraPiena() {
  fase = 'piena';
  smonta();
  schermo.innerHTML = `<div class="centro"><div class="emoji-grande">😅</div><h1>La festa è piena!</h1><p>Siete già in 16. Aspetta che qualcuno esca.</p><button class="btn-tel" id="riprova">Riprova</button></div>`;
  document.getElementById('riprova').onclick = () => location.reload();
}

function salvaProfilo(p) {
  profilo = p;
  if (p.pid) pidLocale = p.pid;
  scrivi(LS_PROFILO, JSON.stringify(p));
}

// Per capire se la lista dei personaggi è cambiata davvero (e ridisegnare solo allora).
function firmaPersonaggi() {
  return personaggi.map((c) => `${c.id}:${c.name}:${c.use || ''}:${JSON.stringify(c.avatar)}`).join('|');
}

// Il personaggio scelto può essere stato modificato o eliminato dallo schermo
// (o da un altro telefono): vale quello salvato sul computer.
function allineaProfilo() {
  if (!profilo?.pid) return;
  const c = personaggi.find((x) => x.id === profilo.pid);
  if (!c) {
    if (profilo.pid === pidLocale) {
      pidLocale = null;
      scrivi(LS_PROFILO, null);
    }
    profilo = null;
    return;
  }
  const nuovo = { nome: c.name, avatar: c.avatar, pid: c.id };
  if (c.id === pidLocale) salvaProfilo(nuovo);
  else profilo = nuovo;
}

// Schermate d'ingresso: scheda del personaggio (entra / modifica), galleria dei
// personaggi salvati sul computer, oppure nome per crearne uno nuovo.
function mostraIngresso(sotto) {
  fase = 'ingresso';
  smonta();
  renderBarra();
  allineaProfilo();
  const scelto = profilo && profilo.nome ? profilo : null;
  if (!sotto) sotto = scelto ? 'scheda' : personaggi.length ? 'galleria' : 'nome';
  if (sotto === 'scheda' && !scelto) sotto = personaggi.length ? 'galleria' : 'nome';
  if (sotto === 'galleria' && !personaggi.length) sotto = 'nome';
  ingresso = sotto;
  if (sotto === 'scheda') schedaPersonaggio(scelto);
  else if (sotto === 'galleria') galleria();
  else schermataNome();
}

function schedaPersonaggio(pers) {
  const salvato = pers.pid ? personaggi.find((c) => c.id === pers.pid) : null;
  const uso = salvato?.use || null;
  const bentornato = !pers.pid || pers.pid === pidLocale;
  const altri = personaggi.some((c) => c.id !== pers.pid);
  schermo.innerHTML = `
    <div class="centro ingresso">
      <div class="ing-avatar"></div>
      <h1>${bentornato ? 'Bentornato' : 'Ciao'},<br>${esc(pers.nome)}!</h1>
      ${uso === 'on' ? '<p class="ing-nota">⚠️ Questo personaggio sta già giocando su un altro telefono</p>' : ''}
      ${uso === 'off' ? '<p class="ing-nota">Sei già nella festa: rientri con i tuoi punti!</p>' : ''}
      <button class="btn-tel grande" id="entra" ${uso === 'on' ? 'disabled' : ''}>${uso === 'off' ? 'Rientra nella festa ▶' : 'Entra nella festa ▶'}</button>
      <button class="btn-tel secondario" id="modifica">✏️ Modifica personaggio</button>
      <div class="ed-errore"></div>
      <div class="ing-link">
        ${altri ? '<button class="link-tel" id="cambia">👥 Non sei tu? Scegli un altro personaggio</button>' : ''}
        <button class="link-tel" id="nuovo">➕ Crea un nuovo personaggio</button>
        ${salvato && !uso ? '<button class="link-tel" id="elimina">🗑️ Elimina questo personaggio</button>' : ''}
      </div>
    </div>`;
  avatarVivo(schermo.querySelector('.ing-avatar'), pers.avatar, 'cheer');
  document.getElementById('entra').onclick = () => entra(pers.nome, pers.avatar);
  document.getElementById('modifica').onclick = () => mostraEditor();
  document.getElementById('nuovo').onclick = () => {
    profilo = null;
    mostraIngresso('nome');
  };
  const cambia = document.getElementById('cambia');
  if (cambia) cambia.onclick = () => mostraIngresso('galleria');
  const elimina = document.getElementById('elimina');
  if (elimina) {
    elimina.onclick = () => {
      if (!confirm(`Eliminare ${pers.nome} dai personaggi salvati?`)) return;
      net.send({ t: 'delchar', pid: pers.pid });
      personaggi = personaggi.filter((c) => c.id !== pers.pid);
      if (pers.pid === pidLocale) {
        pidLocale = null;
        scrivi(LS_PROFILO, null);
      }
      profilo = null;
      mostraIngresso();
    };
  }
}

function galleria() {
  // prima l'ultimo personaggio usato su questo telefono, poi gli altri (i più recenti prima)
  const lista = [...personaggi].sort((a, b) => (b.id === pidLocale) - (a.id === pidLocale));
  schermo.innerHTML = `
    <div class="tel-gal">
      <h1>Chi sei? 👀</h1>
      <p>${festaPiena ? 'La festa è piena: puoi solo riprendere un personaggio che è già dentro.' : 'Tocca il tuo personaggio: è salvato sul computer.'}</p>
      <div class="gal-griglia"></div>
      ${festaPiena ? '' : '<button class="btn-tel" id="nuovo">➕ Nuovo personaggio</button>'}
    </div>`;
  const box = schermo.querySelector('.gal-griglia');
  for (const c of lista) {
    const b = document.createElement('button');
    b.className = `gal-card ${c.use || ''}`;
    b.style.setProperty('--c', coloreGiocatore(c.avatar?.colore ?? 0));
    b.disabled = c.use === 'on' || (festaPiena && c.use !== 'off');
    b.appendChild(canvasAvatar(c.avatar, 72, 72, { soloTesta: true }));
    const nome = document.createElement('span');
    nome.className = 'gal-nome';
    nome.textContent = c.name;
    b.appendChild(nome);
    if (c.use) {
      const s = document.createElement('small');
      s.textContent = c.use === 'on' ? 'sta giocando' : 'nella festa';
      b.appendChild(s);
    }
    b.onclick = () => {
      profilo = { nome: c.name, avatar: c.avatar, pid: c.id };
      mostraIngresso('scheda');
    };
    box.appendChild(b);
  }
  const nuovo = document.getElementById('nuovo');
  if (nuovo) {
    nuovo.onclick = () => {
      profilo = null;
      mostraIngresso('nome');
    };
  }
}

function schermataNome() {
  schermo.innerHTML = `
    <div class="centro ingresso">
      <div class="logo-tel"><span>PARTY</span><span>GAME</span></div>
      <h2>Come ti chiami?</h2>
      <input id="nome" class="input-tel" maxlength="16" placeholder="Il tuo nome" autocomplete="off" enterkeyhint="next">
      <button class="btn-tel grande" id="avanti">Crea il tuo avatar ▶</button>
      <div class="ed-errore"></div>
      ${personaggi.length ? '<button class="link-tel" id="salvati">👥 Scegli un personaggio già salvato</button>' : ''}
    </div>`;
  const input = document.getElementById('nome');
  const vai = () => {
    const n = input.value.trim();
    if (!n) {
      schermo.querySelector('.ed-errore').textContent = 'Scrivi il tuo nome ✍️';
      input.focus();
      return;
    }
    profilo = { nome: n, avatar: casuale(primoColoreLibero()) };
    mostraEditor();
  };
  document.getElementById('avanti').onclick = vai;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') vai();
  });
  const salvati = document.getElementById('salvati');
  if (salvati) salvati.onclick = () => mostraIngresso('galleria');
}

function primoColoreLibero() {
  const presi = coloriPresi();
  const liberi = COLORI_GIOCATORE.map((_, i) => i).filter((i) => !presi.includes(i));
  return liberi.length ? liberi[Math.floor(Math.random() * liberi.length)] : 0;
}

function mostraEditor() {
  const giaDentro = !!me;
  if (!giaDentro) fase = 'editor';
  smonta();
  schermo.innerHTML = '';
  const cont = document.createElement('div');
  cont.className = 'editor-cont';
  schermo.appendChild(cont);
  editor = apriEditor(cont, {
    avatar: giaDentro ? me.avatar : profilo?.avatar,
    nome: giaDentro ? me.name : profilo?.nome,
    presi: coloriPresi,
    testoFatto: giaDentro ? 'Salva ✔' : 'Entra nella festa! ▶',
    onFatto: (nome, avatar) => {
      profilo = { nome, avatar, pid: giaDentro ? me.pid || profilo?.pid : profilo?.pid };
      if (giaDentro || profilo.pid === pidLocale) scrivi(LS_PROFILO, JSON.stringify(profilo));
      if (giaDentro) {
        net.send({ t: 'profile', name: nome, avatar });
        chiudiEditor();
        mostraVista(vista || attesaDefault());
      } else entra(nome, avatar);
    },
  });
}

function chiudiEditor() {
  if (editor) editor.chiudi();
  editor = null;
}

function entra(nome, avatar) {
  net.send({ t: 'join', name: nome, avatar: normalizza(avatar), pid: profilo?.pid || undefined });
}

// Avatar animato in un contenitore (si ferma da solo quando sparisce).
function avatarVivo(el, avatar, pose = 'idle') {
  const c = document.createElement('canvas');
  el.appendChild(c);
  const g = c.getContext('2d');
  const av = prepara(avatar);
  const anim = { attivo: true };
  animazioni.push(anim);
  function f(ms) {
    if (!anim.attivo || !c.isConnected) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    disegnaAvatar(g, av, r.width / 2, r.height * 0.97, Math.min(r.height * 0.92, r.width * 1.2), { pose, t: ms / 1000 });
    requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

function fermaAnimazioni() {
  for (const a of animazioni) a.attivo = false;
  animazioni = [];
}

// ---------------------------------------------------------------------------
// Viste mandate dallo schermo

function smonta() {
  fermaAnimazioni();
  if (montato) {
    if (montato.istanza && montato.istanza.smonta) {
      try {
        montato.istanza.smonta();
      } catch (e) {
        console.error(e);
      }
    }
    montato = null;
  }
}

function mostraVista(v) {
  if (!v || fase !== 'dentro') return;
  if (editor) return; // prima si finisce di modificare l'avatar
  if (v.screen === 'game') return mostraGioco(v);
  smonta();
  const capo = me && v.capo === me.id;
  switch (v.screen) {
    case 'lobby':
      return vistaLobby(v, capo);
    case 'intro':
      return vistaIntro(v);
    case 'result':
      return vistaRisultato(v, capo);
    case 'board':
      return vistaClassifica(v, capo);
    case 'podio':
      return vistaPodio(v, capo);
    case 'catalogo':
      return vistaCatalogo(v, capo);
    default:
      schermo.innerHTML = `<div class="centro"><div class="emoji-grande">${esc(v.emoji || '👀')}</div><h1>${esc(v.titolo || 'Guarda lo schermo!')}</h1><p>${esc(v.testo || '')}</p></div>`;
  }
}

function vistaLobby(v, capo) {
  const nomeCapo = lobby.find((p) => p.id === v.capo)?.name;
  schermo.innerHTML = `
    <div class="tel-lobby">
      <div class="lob-avatar"></div>
      <h1>Ciao ${esc(me.name)}!</h1>
      <p class="lob-sub">Sei dentro 🎉 Guarda lo schermo grande.</p>
      ${
        capo
          ? `<div class="capo-box">
              <h2>👑 Sei il capo!</h2>
              ${v.pochi ? `<p>Servono almeno ${v.min} giocatori per iniziare.</p>` : '<p>Scegli come giocare:</p>'}
              <div class="capo-torneo">
                <div class="capo-label">🏆 Torneo da</div>
                <div class="capo-numeri">${[5, 10, 15, 20].map((n) => `<button data-n="${n}" ${v.pochi ? 'disabled' : ''}>${n}</button>`).join('')}</div>
              </div>
              <button class="btn-tel secondario" data-a="libera" ${v.pochi ? 'disabled' : ''}>🎯 Scelta libera</button>
            </div>`
          : `<p class="lob-attesa">${nomeCapo ? `Il capo 👑 <b>${esc(nomeCapo)}</b> sceglie come giocare…` : 'In attesa…'}</p>`
      }
      <div class="lob-giocatori">${lobby.map((p) => `<span style="--c:${coloreGiocatore(p.color)}" class="${p.connected ? '' : 'off'}">${esc(p.name)}</span>`).join('')}</div>
      <div class="lob-foot">
        <button class="btn-tel secondario piccolo" data-a="modifica">✏️ Modifica avatar</button>
        <button class="link-tel" data-a="esci">Esci dalla festa</button>
      </div>
    </div>`;
  avatarVivo(schermo.querySelector('.lob-avatar'), me.avatar, 'idle');
  schermo.querySelector('.tel-lobby').onclick = (e) => {
    const n = e.target.closest('[data-n]');
    if (n) return inviaSys({ azione: 'torneo', n: Number(n.dataset.n) });
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'libera') inviaSys({ azione: 'libera' });
    else if (a === 'modifica') mostraEditor();
    else if (a === 'esci' && confirm('Vuoi davvero uscire dalla festa?')) net.send({ t: 'leave' });
  };
}

function vistaIntro(v) {
  const gm = v.game;
  const ctrl = CONTROLLI[gm.controllo] || { emoji: '🎮', nome: '' };
  const giaPronto = prontoRun === v.run;
  schermo.innerHTML = `
    <div class="tel-intro">
      ${v.etichetta ? `<div class="intro-etichetta">${esc(v.etichetta)}</div>` : ''}
      ${v.doppio ? '<div class="intro-doppio">⭐ PUNTI DOPPI ⭐</div>' : ''}
      <div class="emoji-grande">${gm.emoji}</div>
      <h1>${esc(gm.nome)}</h1>
      <p>${esc(gm.descrizione)}</p>
      <div class="intro-ctrl">${ctrl.emoji} ${esc(ctrl.nome)}</div>
      ${v.ruolo ? `<div class="intro-ruolo ${v.ruolo.speciale ? 'speciale' : ''}"><span class="ir-emoji">${v.ruolo.emoji}</span><div><small>In questa partita sei</small><b>${esc(v.ruolo.titolo)}</b></div></div>` : ''}
      ${v.nota ? `<p class="intro-nota">${esc(v.nota)}</p>` : ''}
      <ol>${(v.ruolo ? v.ruolo.regole : gm.comeSiGioca).map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
      <button class="btn-tel grande pronto ${giaPronto ? 'fatto' : ''}">${giaPronto ? '✔ Pronto! Aspetta gli altri' : 'PRONTO!'}</button>
    </div>`;
  const b = schermo.querySelector('.pronto');
  b.onclick = () => {
    if (prontoRun === v.run) return;
    prontoRun = v.run;
    inviaSys({ azione: 'pronto', run: v.run });
    b.classList.add('fatto');
    b.textContent = '✔ Pronto! Aspetta gli altri';
    widgets.vibra(40);
  };
  caricaPhone(gm.id).catch(() => {}); // precarica il controller
}

function vistaRisultato(v, capo) {
  const medaglie = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const bene = v.pos <= Math.max(1, Math.ceil(v.tot / 3));
  schermo.innerHTML = `
    <div class="tel-ris ${v.pos === 1 ? 'primo' : ''}">
      <div class="ris-gioco">${v.emoji} ${esc(v.nome)}</div>
      <div class="ris-pos">${medaglie[v.pos] || ''}<span>${v.pos}°</span></div>
      <div class="ris-su">su ${v.tot}</div>
      <div class="ris-avatar"></div>
      ${v.dettaglio ? `<div class="ris-det">${esc(v.dettaglio)}</div>` : ''}
      <div class="ris-punti">+${v.punti} punti</div>
      ${capo ? '<button class="btn-tel grande" data-a="avanti">Avanti ▶</button>' : ''}
    </div>`;
  avatarVivo(schermo.querySelector('.ris-avatar'), me.avatar, v.pos === 1 ? 'cheer' : bene ? 'idle' : 'sad');
  if (v.pos === 1) widgets.vibra([60, 60, 60, 60, 200]);
  bindAvanti();
}

function vistaClassifica(v, capo) {
  schermo.innerHTML = `
    <div class="tel-ris">
      <div class="ris-gioco">${esc(v.titolo)}</div>
      <div class="ris-pos"><span>${v.pos}°</span></div>
      <div class="ris-su">in classifica su ${v.tot}</div>
      <div class="ris-tot">${v.punti} punti ${v.delta ? `<b>+${v.delta}</b>` : ''}</div>
      <p>${v.finale ? 'Tra poco il podio! 🏆' : 'Guarda lo schermo grande 👀'}</p>
      ${capo ? `<button class="btn-tel grande" data-a="avanti">${v.finale ? 'Al podio! 🏆' : 'Avanti ▶'}</button>` : ''}
    </div>`;
  bindAvanti();
}

function vistaPodio(v, capo) {
  const medaglie = { 1: '🏆', 2: '🥈', 3: '🥉' };
  schermo.innerHTML = `
    <div class="tel-ris ${v.pos === 1 ? 'primo' : ''}">
      <div class="ris-gioco">Fine del torneo!</div>
      <div class="ris-pos">${medaglie[v.pos] || ''}<span>${v.pos}°</span></div>
      <div class="ris-su">su ${v.tot} · ${v.punti} punti</div>
      <div class="ris-avatar"></div>
      <p>${v.pos === 1 ? 'Sei il campione! 🎉' : `Ha vinto ${esc((v.vincitori || []).join(' e '))}`}</p>
      ${
        capo
          ? '<button class="btn-tel grande" data-a="ancora">🔁 Un altro torneo</button><button class="btn-tel secondario" data-a="lobby">🏠 Torna alla lobby</button>'
          : ''
      }
    </div>`;
  avatarVivo(schermo.querySelector('.ris-avatar'), me.avatar, v.pos === 1 ? 'cheer' : v.pos <= 3 ? 'idle' : 'sad');
  schermo.querySelector('.tel-ris').onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a) inviaSys({ azione: a });
  };
}

function vistaCatalogo(v, capo) {
  if (!capo) {
    schermo.innerHTML = `<div class="centro"><div class="emoji-grande">🎯</div><h1>Scelta libera</h1><p>Il capo 👑 sta scegliendo il minigioco…</p></div>`;
    return;
  }
  schermo.innerHTML = `
    <div class="tel-cat">
      <h1>👑 Scegli il minigioco</h1>
      <div class="cat-lista">${v.giochi
        .map((g) => `<button data-id="${g.id}"><span class="ce">${g.emoji}</span><span class="cn"><b>${esc(g.nome)}</b><small>${esc(g.descrizione)}</small></span></button>`)
        .join('')}</div>
      <button class="btn-tel secondario" data-a="lobby">🏠 Torna alla lobby</button>
    </div>`;
  schermo.querySelector('.tel-cat').onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (b) return inviaSys({ azione: 'gioca', id: b.dataset.id });
    if (e.target.closest('[data-a="lobby"]')) inviaSys({ azione: 'lobby' });
  };
}

function bindAvanti() {
  const b = schermo.querySelector('[data-a="avanti"]');
  if (b) b.onclick = () => inviaSys({ azione: 'avanti' });
}

// ---------------------------------------------------------------------------
// Minigiochi

async function mostraGioco(v) {
  if (montato && montato.run === v.run) {
    montato.ultima = v.s;
    if (montato.istanza && montato.istanza.aggiorna) montato.istanza.aggiorna(v.s);
    return;
  }
  smonta();
  schermo.innerHTML = '<div class="gioco-area"></div>';
  const el = schermo.querySelector('.gioco-area');
  const m = { run: v.run, id: v.game, istanza: null, el, ultima: v.s };
  montato = m;
  let mod;
  try {
    mod = await caricaPhone(v.game);
  } catch (err) {
    console.error(err);
    el.innerHTML = '<div class="centro"><h1>Ops!</h1><p>Non riesco a caricare questo minigioco.</p></div>';
    return;
  }
  if (montato !== m) return; // nel frattempo è cambiato tutto
  const api = {
    io: { id: me.id, nome: me.name, colore: coloreGiocatore(me.color), avatar: me.avatar },
    invia: (d) => net.send({ t: 'in', d: { run: m.run, d } }),
    vibra: widgets.vibra,
    ora: () => net.now(),
    widgets,
    canvasAvatar,
    disegnaAvatar,
    disegnaTesta,
  };
  try {
    m.istanza = mod.monta(el, api, m.ultima);
  } catch (err) {
    console.error(err);
    el.innerHTML = '<div class="centro"><h1>Ops!</h1><p>Errore nel minigioco.</p></div>';
  }
}

// ---------------------------------------------------------------------------
// Protezioni contro zoom, scorrimento e menu del tocco prolungato

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (!e.target.closest('.scorre, .ed-voci, .ed-opzioni, .cat-lista, .tel-lobby, .tel-intro, .tel-ris, .tel-gal, .ingresso')) e.preventDefault();
  },
  { passive: false },
);
let ultimoTocco = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - ultimoTocco < 300 && !e.target.closest('input, button')) e.preventDefault();
    ultimoTocco = now;
  },
  { passive: false },
);

renderBarra();
schermo.innerHTML = '<div class="centro"><div class="emoji-grande rotola">🎉</div><p>Mi collego alla festa…</p></div>';
