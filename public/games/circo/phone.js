// Circo dei Disperati sul telefono: il tuo ruolo (le sfide arrivano dal seme, uguali per
// tutti quelli con lo stesso ruolo), la barra della squadra, il tempo e le fasi. Ogni
// errore va allo schermo { err, r, i, t }. Nel Caos: terremoto (lo schermo trema e vibra),
// inversione (Navigatore) e scambio di ruoli (per 5 s fai il numero di un compagno).

import { clamp, fmtNum } from '../../shared/util.js';
import { DURATA, FASI, fase, RUOLI, SQUADRE, attivo, programmi } from './regole.js';
import { CREA, testoCentro } from './ruoli.js';
import { cattura, eventiFusi } from '../../phone/widgets.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default {
  id: 'circo',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="cd">
        <div class="cd-hud">
          <div class="cd-riga"><span class="cd-ruolo"></span><span class="cd-fase"></span><span class="cd-err"></span><span class="cd-tempo"></span></div>
          <div class="cd-barra"><i></i><b></b></div>
        </div>
        <div class="cd-campo"></div>
        <div class="cd-avviso" hidden></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .cd { position:absolute; inset:0; display:flex; flex-direction:column; background:radial-gradient(circle at 50% 30%, #4a1030, #16061e 75%); overflow:hidden; }
        .cd-hud { padding:8px 12px 6px; display:flex; flex-direction:column; gap:6px; z-index:2; }
        .cd-riga { display:flex; align-items:center; gap:8px; font-weight:700; }
        .cd-ruolo { background:#ffd23f; color:#1b1030; border-radius:999px; padding:3px 12px; font-size:17px; white-space:nowrap; }
        .cd-ruolo.scambio { background:#3ec6ff; animation:cd-pulsa .45s infinite alternate; }
        .cd-fase { flex:1; font-size:13px; opacity:.85; text-align:center; line-height:1.1; white-space:pre-line; }
        .cd-err { font-size:16px; color:#ff8fa3; }
        .cd-tempo { font-size:24px; min-width:1.6em; text-align:right; }
        .cd-tempo.poco { color:#ff4d6d; }
        .cd-barra { position:relative; height:18px; border-radius:9px; background:rgba(0,0,0,.5); overflow:hidden; border:2px solid rgba(255,255,255,.3); }
        .cd-barra i { position:absolute; left:0; top:0; bottom:0; background:#4cd97b; transition:width .35s, background .35s; }
        .cd-barra b { position:absolute; inset:0; font-size:12px; line-height:14px; text-align:center; text-shadow:0 1px 1px #000; }
        .cd-barra.colpo { animation:cd-colpo .4s; }
        .cd-campo { position:relative; flex:1; touch-action:none; }
        .cd-avviso { position:absolute; left:0; right:0; top:34%; text-align:center; font-size:30px; font-weight:800; pointer-events:none; z-index:3; text-shadow:0 3px 0 rgba(0,0,0,.7); padding:0 14px; animation:cd-entra .25s; }
        .cd-avviso small { display:block; margin-top:4px; font-size:19px; font-weight:700; color:#ffd23f; }
        .cd .tel-msg p.tag { font-size:22px; font-weight:800; color:#ffd23f; }
        @keyframes cd-pulsa { to { transform:scale(1.07); } }
        @keyframes cd-colpo { 0%,100% { border-color:rgba(255,255,255,.3); } 30% { border-color:#ff2d55; transform:translateX(-4px); } 60% { transform:translateX(4px); } }
        @keyframes cd-entra { from { transform:scale(.6); opacity:0; } }
      </style>`;
    const campo = el.querySelector('.cd-campo');
    const hudRuolo = el.querySelector('.cd-ruolo');
    const hudFase = el.querySelector('.cd-fase');
    const hudErr = el.querySelector('.cd-err');
    const hudTempo = el.querySelector('.cd-tempo');
    const barra = el.querySelector('.cd-barra');
    const barraI = barra.querySelector('i');
    const barraB = barra.querySelector('b');
    const avviso = el.querySelector('.cd-avviso');
    const msg = el.querySelector('.tel-msg');
    const cv = api.widgets.canvasPieno(campo, () => {});

    let v = s || {};
    let semeCaricato = null;
    let prog = null;
    let istanze = {};
    let ruoloAttivo = null;
    let errori = [];
    let lampo = null;
    let avvisoFino = 0;
    let faseVista = -1;
    let eventiVisti = new Set();
    let barraVista = null;
    let msgFatto = '';
    let prima = performance.now();
    let raf = 0;
    const dita = new Map();

    const tempo = () => (v.inizio != null ? (api.ora() - v.inizio) / 1000 : -1);
    const ruoloDi = (t) => (v.scambio && t >= v.scambio.t0 && t < v.scambio.t1 ? v.scambio.ruolo : v.ruolo);
    const inGioco = (t) => v.inizio != null && t >= 0 && t < DURATA && v.crollo == null && !v.finito;
    const eventi = () => v.eventi || [];

    const ui = {
      sbaglia(i, motivo) {
        const t = tempo();
        if (!inGioco(t)) return;
        errori.push(t);
        api.invia({ err: 1, r: ruoloAttivo, i, t: Math.round(t * 1000) / 1000 });
        api.vibra([90, 50, 90]);
        lampo = { ok: false, testo: motivo, ms: performance.now() };
      },
      bene(testo) {
        lampo = { ok: true, testo, ms: performance.now() };
      },
      vibra: (p) => api.vibra(p),
      inversione: (t) => attivo(eventi(), 'inversione', t),
      ospite: () => ruoloAttivo !== v.ruolo, // nel ruolo di un altro, per uno scambio
    };

    function prepara() {
      semeCaricato = v.seme;
      prog = v.seme ? programmi(v.seme) : null;
      istanze = {};
      ruoloAttivo = null;
      errori = [];
      faseVista = -1;
      eventiVisti = new Set();
      msgFatto = '';
      msg.hidden = true;
    }

    function mostraAvviso(testo, sotto = '', durata = 1.2) {
      avviso.hidden = false;
      avviso.innerHTML = `${esc(testo)}${sotto ? `<small>${esc(sotto)}</small>` : ''}`;
      // riparte l'animazione d'entrata
      avviso.style.animation = 'none';
      void avviso.offsetWidth;
      avviso.style.animation = '';
      avvisoFino = performance.now() + durata * 1000;
    }

    function cambiaRuolo(r, t) {
      const vecchio = ruoloAttivo;
      if (vecchio && istanze[vecchio]) istanze[vecchio].esci(t);
      ruoloAttivo = r;
      if (!istanze[r]) istanze[r] = CREA[r](prog, ui);
      const u = istanze[r];
      u.entra(t);
      for (const [id, [x, y]] of dita) u.giu(id, x, y, t, cv.w, cv.h);
      if (vecchio && inGioco(t)) {
        const torna = r === v.ruolo;
        mostraAvviso(torna ? '🔀 Si torna a casa!' : '🔀 SCAMBIO!', `${torna ? 'Di nuovo' : 'Ora sei'} ${RUOLI[r].art} ${RUOLI[r].emoji} ${RUOLI[r].nome.toUpperCase()}`, 1.3);
        api.vibra([70, 40, 70]);
      }
    }

    // fasi e Caos: avvisi sul telefono
    function annunci(t) {
      if (!inGioco(t)) return;
      const f = fase(t);
      if (f !== faseVista) {
        if (faseVista >= 0) mostraAvviso(`FASE ${f + 1} · ${FASI[f].nome.toUpperCase()}`, f === 1 ? 'Più veloce!' : 'Velocità massima!');
        faseVista = f;
      }
      for (const e of eventi()) {
        if (t < e.t || eventiVisti.has(e.t)) continue;
        eventiVisti.add(e.t);
        if (e.tipo === 'terremoto') {
          mostraAvviso('📳 TERREMOTO!', 'Tieni duro!', 1);
          api.vibra([180, 40, 180, 40, 180, 40, 180, 40, 180, 40, 180, 40, 180, 40, 180, 40, 180]);
        } else if (e.tipo === 'inversione' && ruoloDi(t) === 'navigatore') {
          api.vibra([60, 40, 60, 40, 60]); // il Navigatore lo vede già sul suo schermo (viola)
        } else if (e.tipo === 'inversione') mostraAvviso('🔄 Inversione!', 'Tocca al Navigatore…', 0.9);
        else if (e.tipo === 'scambio' && !v.scambio) mostraAvviso('🔀 Scambio di ruoli!', 'Stavolta non tocca a te', 0.9);
      }
    }

    // --- dita
    campo.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cattura(campo, e.pointerId);
      const [x, y] = cv.punto(e);
      dita.set(e.pointerId, [x, y]);
      const u = istanze[ruoloAttivo];
      if (u) u.giu(e.pointerId, x, y, tempo(), cv.w, cv.h);
    });
    campo.addEventListener('pointermove', (e) => {
      if (!dita.has(e.pointerId)) return;
      const u = istanze[ruoloAttivo];
      for (const ev of eventiFusi(e)) {
        const [x, y] = cv.punto(ev);
        dita.set(e.pointerId, [x, y]);
        if (u) u.muovi(e.pointerId, x, y, tempo(), cv.w, cv.h);
      }
    });
    const su = (e) => {
      if (!dita.has(e.pointerId)) return;
      dita.delete(e.pointerId);
      const u = istanze[ruoloAttivo];
      if (u) u.su(e.pointerId, ...cv.punto(e), tempo(), cv.w, cv.h);
    };
    campo.addEventListener('pointerup', su);
    campo.addEventListener('pointercancel', su);

    // --- disegno
    function disegna(t, ms) {
      const { g, w, h } = cv;
      g.clearRect(0, 0, w, h);
      if (!prog || !ruoloAttivo) return;
      g.save();
      if (attivo(eventi(), 'terremoto', t) && inGioco(t)) g.translate((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      istanze[ruoloAttivo].disegna(g, w, h, t);
      g.restore();
      if (lampo) {
        const k = (ms - lampo.ms) / (lampo.ok ? 350 : 750);
        if (k >= 1) lampo = null;
        else if (lampo.ok) {
          g.strokeStyle = `rgba(76,217,123,${(0.9 * (1 - k)).toFixed(3)})`;
          g.lineWidth = 14;
          g.strokeRect(0, 0, w, h);
        } else {
          g.fillStyle = `rgba(255,30,60,${(0.45 * (1 - k)).toFixed(3)})`;
          g.fillRect(0, 0, w, h);
          testoCentro(g, `❌ ${lampo.testo}`, w / 2, h * 0.19, Math.round(Math.min(28, w * 0.07)), '#fff', 1 - k * k);
        }
      }
      if (v.inizio == null || t < 0) {
        // prima del VIA: chi sei e cosa fare
        g.fillStyle = 'rgba(15,6,25,0.9)';
        const gemelli = v.gemelli || [];
        g.fillRect(0, 0, w, h * (gemelli.length ? 0.25 : 0.2));
        const r = RUOLI[v.ruolo];
        testoCentro(g, `Sei ${r.art} ${r.emoji} ${r.nome.toUpperCase()}`, w / 2, h * 0.06, Math.round(Math.min(30, w * 0.075)), '#ffd23f');
        const sq = v.nsq > 1 ? SQUADRE[v.sq] : null;
        testoCentro(g, sq ? `${r.azione}  ·  ${sq.emoji} ${sq.nome}` : r.azione, w / 2, h * 0.14, Math.round(Math.min(20, w * 0.052)));
        // con 6–8 giocatori i ruoli doppi: stesse sfide, e la stessa sfida sbagliata in due conta una volta
        if (gemelli.length) testoCentro(g, `👯 Insieme a ${gemelli.join(' e ')}`, w / 2, h * 0.205, Math.round(Math.min(19, w * 0.05)), '#3ec6ff');
      }
    }

    function hud(t) {
      const r = ruoloAttivo || v.ruolo;
      if (r && RUOLI[r]) {
        const txt = `${RUOLI[r].emoji} ${RUOLI[r].nome}`;
        if (hudRuolo.textContent !== txt) hudRuolo.textContent = txt;
        hudRuolo.classList.toggle('scambio', r !== v.ruolo);
      }
      hudFase.textContent = t < 0 || v.inizio == null ? 'Preparati…' : t >= DURATA ? 'Fine!' : `Fase ${fase(t) + 1}\n${FASI[fase(t)].nome}${t >= 30 ? ' 🔥' : ''}`;
      const resto = Math.max(0, Math.ceil(DURATA - Math.max(0, t)));
      hudTempo.textContent = resto;
      hudTempo.classList.toggle('poco', resto <= 5 && t >= 0);
      hudErr.textContent = errori.length ? `❌ ${errori.length}` : '';
      const b = clamp(v.barra ?? 100, 0, 100);
      if (barraVista !== b) {
        if (barraVista != null && b < barraVista) {
          barra.classList.remove('colpo');
          void barra.offsetWidth;
          barra.classList.add('colpo');
        }
        barraVista = b;
        barraI.style.width = `${b}%`;
        barraI.style.background = b > 50 ? '#4cd97b' : b > 25 ? '#ffd23f' : '#ff4d6d';
        const sq = v.nsq > 1 ? `${SQUADRE[v.sq].emoji} ` : '❤️ ';
        barraB.textContent = `${sq}${Math.round(b)}%`;
      }
      if (avvisoFino && performance.now() > avvisoFino) {
        avviso.hidden = true;
        avvisoFino = 0;
      }
    }

    function mostraMsg(t) {
      let html = '';
      const lista = (arr) => arr.map((x) => `${fmtNum(x, 1)}″`).join(' · ');
      if (v.esito) {
        const e = v.esito;
        const n = e.errori.length;
        const tag = {
          zero: '⭐ Zero errori! +2',
          mvp: '🏅 Sei l’MVP della squadra! +1',
          colpevole: `👉 Sei il COLPEVOLE! (${e.quota}% degli errori) −1`,
          colpevole2: `👉 Sei il COLPEVOLE! (${e.quota}% degli errori) −2`,
        }[e.tag];
        html = `<div class="emoji-grande">${e.salva ? '🏆' : '💀'}</div><h1>${e.salva ? 'SALVI!' : 'CROLLATI!'}</h1>
          <p>${n ? `Hai sbagliato ${n} ${n === 1 ? 'volta' : 'volte'}:<br>${lista(e.errori)}` : 'Non hai sbagliato niente!'}</p>
          ${tag ? `<p class="tag">${tag}</p>` : ''}${e.consolazione ? '<p class="tag">🥈 Siete durati di più: +1</p>' : ''}
          <p>📺 Guarda la Pagella sulla TV</p>`;
      } else if (v.crollo != null) {
        html = `<div class="emoji-grande">💀</div><h1>Il circo è crollato!</h1><p>${v.nsq > 1 ? 'La tua squadra è fuori: tifa (o gufa) l’altra sulla TV' : 'Guarda la TV'}</p>
          <p>${errori.length ? `I tuoi errori: ${lista(errori)}` : 'Tu non hai sbagliato niente!'}</p>`;
      } else if (v.finito || t >= DURATA) {
        html = `<div class="emoji-grande">⏰</div><h1>Tempo!</h1><p>📺 Guarda la TV: arriva la Pagella</p>`;
      }
      if (html !== msgFatto) {
        msgFatto = html;
        msg.hidden = !html;
        msg.innerHTML = html;
        if (html && v.esito) api.vibra(v.esito.salva ? [60, 60, 60, 60, 200] : [300]);
      }
    }

    function loop() {
      const ms = performance.now();
      const dt = clamp((ms - prima) / 1000, 0, 0.1);
      prima = ms;
      const t = tempo();
      if (prog && v.ruolo) {
        const r = ruoloDi(Math.max(0, t));
        if (r !== ruoloAttivo) cambiaRuolo(r, t);
        if (v.crollo == null && !v.finito && t < DURATA) istanze[ruoloAttivo].passo(t, dt, cv.w, cv.h, inGioco(t));
        annunci(t);
      }
      disegna(t, ms);
      hud(t);
      mostraMsg(t);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function aggiorna(nv) {
      const prec = v;
      v = nv || v;
      if (v.seme !== semeCaricato) prepara();
      else if (prec.inizio != null && v.inizio != null && prec.inizio !== v.inizio) {
        // dopo una pausa si riparte da adesso (le sfide in corso non contano)
        istanze = {};
        ruoloAttivo = null;
      }
    }
    // utile per le prove automatiche nel browser
    campo.statoProva = () => ({ seme: v.seme, ruolo: v.ruolo, attivo: ruoloAttivo, t: tempo(), errori: [...errori], barra: v.barra, w: cv.w, h: cv.h });
    aggiorna(null);

    return {
      aggiorna,
      messaggio() {},
      smonta() {
        cancelAnimationFrame(raf);
        cv.distruggi();
      },
    };
  },
};
