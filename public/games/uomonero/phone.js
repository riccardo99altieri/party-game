// L'Uomo Nero sul telefono: due interfacce, scelte dal ruolo.
// Sopravvissuto: mappa privata (solo tu, i muri già illuminati e quelli che hai toccato),
// D-pad, TORCIA, PING e il battito quando l'Uomo Nero è vicino.
// Uomo Nero: sonar (muri entro 2 caselle), blip "c'è qualcuno lì", D-pad, MORSA e poteri.
// In entrambi, durante la Morsa, un pulsante gigante da toccare a raffica.

import { decodifica, indice, NORD, SUD, OVEST, EST, TORCIA, SONAR, BLIP, PING, POTERI } from './regole.js';

const TAU = Math.PI * 2;

export default {
  id: 'uomonero',
  monta(el, api, s) {
    return s && s.ruolo === 'uomonero' ? montaBoss(el, api, s) : montaSopr(el, api, s);
  },
};

const STILE = `
  .un { position:absolute; inset:0; display:flex; flex-direction:column; background:#0b0814; }
  .un-testa { display:flex; justify-content:space-between; padding:8px 14px 4px; font-size:19px; font-weight:700; }
  .un-mappa { flex:none; align-self:center; border-radius:12px; overflow:hidden; position:relative; box-shadow:0 0 0 3px rgba(255,255,255,0.12); touch-action:none; }
  .un-stato { flex:none; padding:6px 10px; text-align:center; font-size:19px; font-weight:700; min-height:52px; display:flex; align-items:center; justify-content:center; transition:color .2s, transform .2s; }
  .un-stato.male { color:#ff8fb3; transform:scale(1.06); }
  .un-stato.bene { color:var(--verde); transform:scale(1.06); }
  .un-stato.oro { color:#ffd23f; transform:scale(1.06); }
  .un-stato.viola { color:#c9a7ff; transform:scale(1.06); }
  .un-pad { flex:1; display:flex; gap:10px; padding:0 12px calc(14px + env(safe-area-inset-bottom)); min-height:0; }
  .un-joy { flex:1.3; border-radius:28px; background:rgba(255,255,255,0.05); border:3px dashed rgba(255,255,255,0.18); }
  .un-btns { flex:1; display:flex; flex-direction:column; gap:10px; min-height:0; }
  .un-btns > div { display:flex; min-height:0; }
  .un-btns .pad-btn { border-radius:24px; font-size:21px; line-height:1.15; position:relative; overflow:hidden; }
  .un .pad-btn .cd { position:absolute; inset:0; background:rgba(10,6,24,0.7); transform-origin:bottom; transform:scaleY(0); pointer-events:none; }
  .un .pad-btn.spento { filter:grayscale(0.85) brightness(0.55); }
  .un-poteri { display:flex; gap:8px; padding:0 12px 10px; }
  .un-poteri > div { flex:1; display:flex; height:64px; }
  .un-poteri .pad-btn { border-radius:18px; font-size:15px; line-height:1.1; position:relative; overflow:hidden; box-shadow:0 6px 0 var(--scuro); }
  .un.b1 { animation:un-battito 1s infinite; }
  .un.b2 { animation:un-battito .62s infinite; }
  .un.b3 { animation:un-battito .36s infinite; }
  @keyframes un-battito { 0%,100% { box-shadow:inset 0 0 0 0 rgba(255,30,60,0); } 15% { box-shadow:inset 0 0 0 8px #ff2a3d, inset 0 0 70px rgba(255,30,60,0.6); } 35% { box-shadow:inset 0 0 0 3px rgba(255,30,60,0.4); } 50% { box-shadow:inset 0 0 0 7px #ff2a3d, inset 0 0 50px rgba(255,30,60,0.45); } }
  .un.marchio { box-shadow:inset 0 0 0 7px #ff4d6d, inset 0 0 80px rgba(255,40,70,0.6); }
  .un-fuori { flex:1; display:none; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; padding:0 18px calc(14px + env(safe-area-inset-bottom)); }
  .un-fuori h1 { margin:0; font-size:28px; }
  .un-fuori p { margin:0; font-size:17px; opacity:.9; }
  .un.fuori .un-pad { display:none; }
  .un.fuori .un-fuori { display:flex; }
  .un-morsa { position:absolute; inset:0; z-index:4; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:20px; background:rgba(60,4,20,0.92); }
  .un-morsa[hidden] { display:none; }
  .un-morsa h1 { margin:0; font-size:30px; text-align:center; }
  .un-morsa p { margin:0; font-size:17px; text-align:center; opacity:.9; }
  .un-morsa .barra { width:85%; height:22px; border-radius:11px; background:rgba(255,255,255,0.15); overflow:hidden; }
  .un-morsa .barra i { display:block; height:100%; width:0; background:#ff2a3d; }
  .un-morsa .grosso { width:min(70vw, 42vh); aspect-ratio:1; display:flex; }
  .un-morsa .grosso .pad-btn { border-radius:50%; font-size:30px; }
`;

function orologio() {
  let fine = 0;
  return {
    imposta: (resta) => (fine = performance.now() + resta * 1000),
    resta: () => Math.max(0, (fine - performance.now()) / 1000),
  };
}

// Mappa sul telefono: dimensioni prese dal labirinto, conversione da caselle a pixel.
function creaMappa(api, box, v, toccata) {
  box.style.width = `min(calc(100% - 20px), calc(40vh * ${v.col} / ${v.rig}))`;
  box.style.aspectRatio = `${v.col} / ${v.rig}`;
  const tela = api.widgets.canvasPieno(box, () => {});
  if (toccata) {
    box.addEventListener('pointerdown', (e) => {
      const [x, y] = tela.punto(e);
      toccata((x / tela.w) * v.col, (y / tela.h) * v.rig);
    });
  }
  return tela;
}

function muri(g, lab, x, y, k) {
  const c = lab.celle[indice(lab, x, y)];
  if (!(c & NORD)) {
    g.moveTo(x * k, y * k);
    g.lineTo((x + 1) * k, y * k);
  }
  if (!(c & SUD)) {
    g.moveTo(x * k, (y + 1) * k);
    g.lineTo((x + 1) * k, (y + 1) * k);
  }
  if (!(c & OVEST)) {
    g.moveTo(x * k, y * k);
    g.lineTo(x * k, (y + 1) * k);
  }
  if (!(c & EST)) {
    g.moveTo((x + 1) * k, y * k);
    g.lineTo((x + 1) * k, (y + 1) * k);
  }
}

// Batterie, uscita, Marchi e ping: le cose che si vedono sulla TV anche al buio.
function segnali(g, v, k, now, { batt, bt, ap, mk, pg }) {
  batt.forEach(([x, y], i) => {
    if (bt[i] === '1') return;
    g.fillStyle = `rgba(255,210,63,${0.6 + 0.3 * Math.sin(now / 300 + i)})`;
    g.fillRect((x + 0.32) * k, (y + 0.2) * k, k * 0.36, k * 0.6);
  });
  const [ux, uy] = v.uscita;
  g.fillStyle = ap ? '#4cd97b' : '#ff4d6d';
  g.fillRect((ux + 1) * k - Math.max(3, k * 0.18), (uy + 0.1) * k, Math.max(3, k * 0.18), k * 0.8);
  for (const [x, y] of mk || []) {
    g.beginPath();
    g.arc(x * k, y * k, POTERI.marchio.raggio * k, 0, TAU);
    g.fillStyle = 'rgba(220,30,60,0.25)';
    g.fill();
    g.strokeStyle = '#ff4d6d';
    g.lineWidth = 2;
    g.stroke();
  }
  for (const [x, y, c] of pg || []) {
    const f = (now / 900) % 1;
    g.strokeStyle = c;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x * k, y * k, k * (0.2 + f), 0, TAU);
    g.stroke();
    g.fillStyle = c;
    g.beginPath();
    g.arc(x * k, y * k, Math.max(3, k * 0.18), 0, TAU);
    g.fill();
  }
}

function etichetta(g, testo, x, y, w) {
  g.font = '800 14px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const ty = y > 30 ? y - 20 : y + 22;
  const tx = Math.min(w - 16, Math.max(16, x));
  g.lineWidth = 4;
  g.strokeStyle = '#0b0814';
  g.strokeText(testo, tx, ty);
  g.fillStyle = '#fff';
  g.fillText(testo, tx, ty);
}

function morsaOverlay(el, api, titolo, sotto, testo, colore) {
  const box = document.createElement('div');
  box.className = 'un-morsa';
  box.hidden = true;
  box.innerHTML = `<h1>${titolo}</h1><p>${sotto}</p><div class="barra"><i></i></div><div class="grosso"></div>`;
  el.appendChild(box);
  api.widgets.pulsante(box.querySelector('.grosso'), {
    testo,
    colore,
    onPremi: () => {
      api.invia({ tap: 1 });
      api.vibra(12);
    },
  });
  return { box, barra: box.querySelector('.barra i') };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------------------------------------------------------------------------
// Sopravvissuto

function montaSopr(el, api, s) {
  let v = s || {};
  el.innerHTML = `
    <div class="un">
      <div class="un-testa"><span class="un-batt">🔋 0/0</span><span class="un-tempo">⏱ 0</span></div>
      <div class="un-mappa"></div>
      <div class="un-stato">🔦 Trova le batterie</div>
      <div class="un-pad">
        <div class="un-joy"></div>
        <div class="un-btns"><div class="b-torcia" style="flex:2"></div><div class="b-ping" style="flex:1"></div></div>
      </div>
      <div class="un-fuori"></div>
      <div class="tel-msg" hidden></div>
    </div>
    <style>${STILE}</style>`;
  const radice = el.querySelector('.un');
  const tBatt = el.querySelector('.un-batt');
  const tTempo = el.querySelector('.un-tempo');
  const stato = el.querySelector('.un-stato');
  const fuori = el.querySelector('.un-fuori');
  const msg = el.querySelector('.tel-msg');
  const zona = el.querySelector('.un-joy');
  zona.style.setProperty('--c', api.io.colore);
  const joy = api.widgets.joystick(zona, (x, y) => api.invia({ j: [x, y] }), { testo: 'Muoviti qui', otto: true });
  const tempo = orologio();
  let lab = decodifica(v.lab, v.col, v.rig);
  let esp = new Uint8Array(v.col * v.rig);
  let pos = { x: v.p ? v.p[0] : 0.5, y: v.p ? v.p[1] : 0.5 };
  let vista = { ...pos };
  let ang = v.a || 0;
  let torcia = !!v.tr;
  let mondo = { batt: v.batt || [], bt: v.bt || '', ap: v.ap, mk: [], pg: [] };
  let battito = 0;
  let carica = 0;
  let terrore = false;
  let buio = false;
  let marchio = 0;
  let cdPing = 0;
  let avvisoFino = 0;
  let prossimoBattito = 0;

  const bTorcia = api.widgets.pulsante(el.querySelector('.b-torcia'), {
    testo: '<span class="ico" style="font-size:40px">🔦</span><br><span class="lbl">TORCIA</span>',
    colore: '#f2b33d',
    onPremi: () => {
      api.invia({ to: 1 });
      api.vibra(15);
    },
  });
  const bPing = api.widgets.pulsante(el.querySelector('.b-ping'), {
    testo: '📍 PING<div class="cd"></div>',
    colore: '#3ec6ff',
    onPremi: () => {
      if (performance.now() < cdPing) return;
      api.invia({ pg: 1 });
    },
  });
  const cdBox = bPing.querySelector('.cd');
  const m = morsaOverlay(radice, api, "👤 L'UOMO NERO TI HA PRESO!", 'Dimenati! Gli altri ti salvano puntandogli la torcia addosso', '👋<br>DIMENATI!', '#ff4d6d');

  const tela = creaMappa(api, el.querySelector('.un-mappa'), v, (x, y) => {
    // da fuori (preso o scappato) si tocca la mappa per mandare un ping
    if (v.vivo !== false && !v.fuggito) return;
    if (performance.now() < cdPing || v.finito) return;
    api.invia({ pg: [Math.round(x * 100) / 100, Math.round(y * 100) / 100] });
  });

  function caricaEsp(txt) {
    esp = new Uint8Array(v.col * v.rig);
    if (txt) for (let i = 0; i < txt.length; i++) if (txt[i] === '1') esp[i] = 1;
  }
  caricaEsp(v.esp);

  function disegna(now, dt) {
    const { g, w } = tela;
    const k = w / v.col;
    vista.x += (pos.x - vista.x) * Math.min(1, dt * 14);
    vista.y += (pos.y - vista.y) * Math.min(1, dt * 14);
    // al tatto: la casella dove sei la conosci sempre
    const cx = Math.floor(vista.x);
    const cy = Math.floor(vista.y);
    if (cx >= 0 && cy >= 0 && cx < v.col && cy < v.rig) esp[indice(lab, cx, cy)] = 1;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, w, tela.h);
    g.fillStyle = '#1d1a2b';
    for (let y = 0; y < v.rig; y++) for (let x = 0; x < v.col; x++) if (esp[y * v.col + x]) g.fillRect(x * k, y * k, k, k);
    g.strokeStyle = '#b8acdf';
    g.lineWidth = Math.max(1.5, k * 0.12);
    g.lineCap = 'round';
    g.beginPath();
    for (let y = 0; y < v.rig; y++) for (let x = 0; x < v.col; x++) if (esp[y * v.col + x]) muri(g, lab, x, y, k);
    g.stroke();
    segnali(g, v, k, now, mondo);
    if (v.vivo === false || v.fuggito) return;
    const px = vista.x * k;
    const py = vista.y * k;
    if (torcia && !buio) {
      g.beginPath();
      g.moveTo(px, py);
      g.arc(px, py, TORCIA.raggio * k, ang - TORCIA.apertura, ang + TORCIA.apertura);
      g.closePath();
      g.fillStyle = 'rgba(255,214,120,0.22)';
      g.fill();
    }
    const puls = (now / 700) % 1;
    g.beginPath();
    g.arc(px, py, k * 0.3 + puls * k * 0.6, 0, TAU);
    g.strokeStyle = `rgba(76,217,123,${1 - puls})`;
    g.lineWidth = 2.5;
    g.stroke();
    g.beginPath();
    g.arc(px, py, Math.max(4, k * 0.28), 0, TAU);
    g.fillStyle = '#4cd97b';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#0b3d1d';
    g.stroke();
    if (carica > 0) {
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px, py, k * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * carica);
      g.stroke();
    }
    etichetta(g, 'TU', px, py, w);
  }

  function base() {
    if (v.finito) return '🏁 Fine!';
    if (buio) return '🌑 BLACKOUT! Torce spente…';
    if (marchio > 0) return '☠️ Sei nel Marchio! ESCI SUBITO!';
    if (terrore) return '😱 Paralizzato dalla paura!';
    if (carica > 0) return `🔋 Carico… ${Math.round(carica * 100)}%`;
    if (battito >= 2) return "💓 L'Uomo Nero è VICINISSIMO!";
    if (battito === 1) return "💓 L'Uomo Nero è vicino…";
    if (mondo.ap) return "🚪 L'uscita è aperta: scappa! (a destra)";
    return torcia ? '🔦 Cerca le batterie 🔋' : '🌑 Torcia spenta: sei invisibile';
  }
  function avviso(testo, classe, durata = 1.8) {
    stato.textContent = testo;
    stato.className = `un-stato ${classe || ''}`;
    avvisoFino = performance.now() + durata * 1000;
  }
  function scriviStato() {
    if (avvisoFino) return;
    stato.textContent = base();
    stato.className = `un-stato ${buio ? 'viola' : marchio > 0 || terrore || battito >= 2 ? 'male' : carica > 0 || mondo.ap ? 'oro' : ''}`;
  }
  function scriviTorcia() {
    bTorcia.querySelector('.lbl').textContent = buio ? 'BLACKOUT' : torcia ? 'ACCESA' : 'SPENTA';
    bTorcia.querySelector('.ico').textContent = torcia && !buio ? '🔦' : '🌑';
    bTorcia.classList.toggle('spento', !torcia || buio);
  }
  function scriviTesta() {
    const tot = mondo.batt.length;
    const prese = [...(mondo.bt || '')].filter((c) => c === '1').length;
    tBatt.textContent = `${'❤️'.repeat(Math.max(0, v.vite ?? 1))} ${mondo.ap ? '🚪 USCITA APERTA' : `🔋 ${prese}/${tot}`}`;
  }

  let ultimo = performance.now();
  let raf = requestAnimationFrame(function f(now) {
    const dt = Math.min(0.1, (now - ultimo) / 1000);
    ultimo = now;
    tTempo.textContent = `⏱ ${Math.ceil(tempo.resta())}`;
    cdBox.style.transform = `scaleY(${Math.max(0, cdPing - now) / (PING.cd * 1000)})`;
    if (avvisoFino && now > avvisoFino) {
      avvisoFino = 0;
      scriviStato();
    }
    const vivo = v.vivo !== false && !v.fuggito && !v.finito;
    radice.classList.toggle('b1', vivo && battito === 1);
    radice.classList.toggle('b2', vivo && battito === 2);
    radice.classList.toggle('b3', vivo && battito === 3);
    radice.classList.toggle('marchio', vivo && marchio > 0);
    if (vivo && battito > 0 && now > prossimoBattito) {
      api.vibra(battito === 3 ? [60, 60, 60] : [45, 90, 45]);
      prossimoBattito = now + [0, 1000, 620, 360][battito];
    }
    disegna(now, dt);
    raf = requestAnimationFrame(f);
  });

  function aggiorna(nv) {
    if (!nv) return;
    const nuovoLab = nv.lab !== v.lab;
    v = nv;
    if (nuovoLab) lab = decodifica(v.lab, v.col, v.rig);
    if (v.esp) caricaEsp(v.esp);
    if (v.p) {
      pos = { x: v.p[0], y: v.p[1] };
      if (nuovoLab) vista = { ...pos };
    }
    ang = v.a ?? ang;
    torcia = !!v.tr;
    mondo.batt = v.batt || mondo.batt;
    mondo.bt = v.bt ?? mondo.bt;
    mondo.ap = v.ap;
    tempo.imposta(v.resta ?? 0);
    radice.classList.toggle('fuori', v.vivo === false || !!v.fuggito);
    m.box.hidden = !v.morsa || v.finito;
    if (v.vivo === false || v.fuggito) {
      battito = 0;
      fuori.innerHTML = v.fuggito
        ? `<h1>🚪 Sei scappato!</h1><p>Sei in salvo. Puoi ancora aiutare: <b>tocca la mappa</b> per mandare un ping sulla TV (ogni ${PING.cd} s).</p>`
        : `<h1>${v.causa === 'marchio' ? '☠️ Preso dal Marchio' : "👤 L'Uomo Nero ti ha preso"}</h1><p>Non è finita: <b>tocca la mappa</b> per mandare un ping agli altri (ogni ${PING.cd} s). L'Uomo Nero era <b>${esc(v.boss)}</b>.</p>`;
    }
    if (v.finito && v.ris) {
      msg.hidden = false;
      msg.innerHTML = `<div class="emoji-grande">${v.fuggito ? '🚪' : v.ris.notte ? '👤' : '🔦'}</div><h1>${v.ris.punti} punti</h1><p>${esc(v.ris.det)}</p><p>Scappati ${v.ris.fuggiti} su ${v.ris.tot} · l'Uomo Nero era <b>${esc(v.boss)}</b></p>`;
    } else msg.hidden = true;
    scriviTorcia();
    scriviTesta();
    scriviStato();
  }
  aggiorna(v);

  return {
    aggiorna,
    messaggio(d) {
      if (!d) return;
      if (d.p) pos = { x: d.p[0], y: d.p[1] };
      if (d.a != null) ang = d.a;
      if (d.s != null) tempo.imposta(d.s);
      if (d.x) for (const i of d.x) esp[i] = 1;
      if (d.bt != null) mondo.bt = d.bt;
      if (d.pg) mondo.pg = d.pg;
      if (d.mk) mondo.mk = d.mk;
      if (d.ap != null) mondo.ap = !!d.ap;
      if (d.tr != null) torcia = !!d.tr;
      if (d.bo != null) buio = !!d.bo;
      if (d.pr != null) m.barra.style.width = `${Math.round(d.pr * 100)}%`;
      if (d.s != null) {
        // messaggio periodico dello schermo (gli eventi arrivano a parte)
        battito = d.b || 0;
        carica = d.c || 0;
        terrore = !!d.te;
        marchio = d.mz || 0;
        scriviTorcia();
        scriviTesta();
        scriviStato();
      }
      switch (d.ev) {
        case 'batteria':
          avviso(`🔋 Batteria carica! ${d.n}/${d.tot}`, 'oro', 2);
          api.vibra([30, 30, 90]);
          break;
        case 'aperta':
          avviso("🚪 L'USCITA È APERTA! Corri a destra!", 'bene', 3);
          api.vibra([80, 50, 80, 50, 160]);
          break;
        case 'morsa':
          avviso(`😱 ${d.chi} è nella Morsa! Puntagli la torcia vicino!`, 'male', 2.5);
          api.vibra([100, 50, 100]);
          break;
        case 'eroe':
          avviso(`🔦 Hai salvato ${d.chi}! +1`, 'bene', 2.5);
          api.vibra([30, 30, 120]);
          break;
        case 'salvato':
          avviso(`🙏 ${d.da} ti ha salvato! Scappa!`, 'bene', 2.5);
          break;
        case 'libero':
          avviso('💨 Sei sgusciato via! Scappa!', 'bene', 2);
          break;
        case 'urlo':
          avviso('😱 URLO! Torcia bloccata, gambe di piombo!', 'male', d.dur || 3);
          api.vibra([200, 60, 200]);
          break;
        case 'blackout':
          avviso('🌑 BLACKOUT! Tutte le torce spente!', 'viola', d.dur || 4);
          api.vibra([300]);
          break;
        case 'nobuio':
          avviso('🌑 Durante il blackout la torcia non si accende', 'viola', 1.4);
          break;
        case 'noterrore':
          avviso('😱 Hai troppa paura per spegnerla!', 'male', 1.4);
          break;
        case 'ferito':
          avviso('🩸 Ferito! Ti resta una vita sola: scappa!', 'male', 2.5);
          api.vibra([150, 60, 150]);
          break;
        case 'eco':
          avviso('👻 Era solo un Eco… (sparito)', 'viola', 2);
          api.vibra(40);
          break;
        case 'ping':
          cdPing = performance.now() + (d.cd || PING.cd) * 1000;
          break;
      }
    },
    smonta() {
      cancelAnimationFrame(raf);
      joy.distruggi();
      tela.distruggi();
    },
  };
}

// ---------------------------------------------------------------------------
// Uomo Nero

function montaBoss(el, api, s) {
  let v = s || {};
  const poteri = v.poteri || ['urlo'];
  el.innerHTML = `
    <div class="un boss">
      <div class="un-testa"><span>👤 Uomo Nero</span><span class="un-tempo">⏱ 0</span><span class="un-presi">💀 0/0</span></div>
      <div class="un-mappa"></div>
      <div class="un-stato">👤 Caccia!</div>
      <div class="un-poteri">${poteri.map((k) => `<div data-k="${k}"></div>`).join('')}</div>
      <div class="un-pad">
        <div class="un-joy"></div>
        <div class="un-btns"><div class="b-morsa" style="flex:1"></div></div>
      </div>
      <div class="tel-msg" hidden></div>
    </div>
    <style>${STILE}</style>`;
  const radice = el.querySelector('.un');
  const tTempo = el.querySelector('.un-tempo');
  const tPresi = el.querySelector('.un-presi');
  const stato = el.querySelector('.un-stato');
  const msg = el.querySelector('.tel-msg');
  const zona = el.querySelector('.un-joy');
  zona.style.setProperty('--c', '#7c3aed');
  const joy = api.widgets.joystick(zona, (x, y) => api.invia({ j: [x, y] }), { testo: 'Muoviti qui', otto: true });
  const tempo = orologio();
  let lab = decodifica(v.lab, v.col, v.rig);
  const ricordo = new Uint8Array(v.col * v.rig);
  let pos = { x: v.p ? v.p[0] : 0.5, y: v.p ? v.p[1] : 0.5 };
  let vista = { ...pos };
  let mondo = { batt: v.batt || [], bt: v.bt || '', ap: v.ap, mk: [], pg: [] };
  const blips = []; // { x, y, t }
  let accese = []; // [x, y, verso, paralizzato] di chi ha la torcia accesa
  let cd = {};
  let rec = 0;
  let mancata = false;
  let avvisoFino = 0;

  const bMorsa = api.widgets.pulsante(el.querySelector('.b-morsa'), {
    testo: '<span style="font-size:44px">✊</span><br>MORSA',
    colore: '#7c3aed',
    onPremi: () => {
      api.invia({ m: 1 });
      api.vibra(20);
    },
  });
  const bottoni = {};
  for (const k of poteri) {
    const P = POTERI[k];
    bottoni[k] = api.widgets.pulsante(el.querySelector(`[data-k="${k}"]`), {
      testo: `${P.emoji} ${P.nome.toUpperCase()}<div class="cd"></div>`,
      colore: k === 'urlo' ? '#e11d48' : k === 'marchio' ? '#9f1239' : '#4338ca',
      onPremi: () => {
        if ((cd[k] || 0) > 0) return;
        api.invia({ k });
        api.vibra(25);
      },
    });
  }
  const m = morsaOverlay(radice, api, '✊ MORSA!', 'Tocca a raffica senza fermarti! Se ti puntano la torcia addosso resti accecato', '👊<br>STRINGI!', '#7c3aed');
  const tela = creaMappa(api, el.querySelector('.un-mappa'), v, null);

  function disegna(now, dt) {
    const { g, w } = tela;
    const k = w / v.col;
    vista.x += (pos.x - vista.x) * Math.min(1, dt * 14);
    vista.y += (pos.y - vista.y) * Math.min(1, dt * 14);
    g.fillStyle = '#040308';
    g.fillRect(0, 0, w, tela.h);
    // sonar: le caselle entro 2 si vedono bene e restano nel ricordo
    const vicine = [];
    for (let y = Math.max(0, Math.floor(vista.y - SONAR)); y <= Math.min(v.rig - 1, Math.floor(vista.y + SONAR)); y++) {
      for (let x = Math.max(0, Math.floor(vista.x - SONAR)); x <= Math.min(v.col - 1, Math.floor(vista.x + SONAR)); x++) {
        if (Math.hypot(x + 0.5 - vista.x, y + 0.5 - vista.y) > SONAR + 0.5) continue;
        vicine.push([x, y]);
        ricordo[y * v.col + x] = 1;
      }
    }
    g.lineCap = 'round';
    g.strokeStyle = '#3d365a';
    g.lineWidth = Math.max(1.5, k * 0.1);
    g.beginPath();
    for (let y = 0; y < v.rig; y++) for (let x = 0; x < v.col; x++) if (ricordo[y * v.col + x]) muri(g, lab, x, y, k);
    g.stroke();
    const px = vista.x * k;
    const py = vista.y * k;
    const alone = g.createRadialGradient(px, py, 0, px, py, (SONAR + 0.6) * k);
    alone.addColorStop(0, 'rgba(124,58,237,0.35)');
    alone.addColorStop(1, 'rgba(124,58,237,0)');
    g.fillStyle = alone;
    g.fillRect(px - (SONAR + 1) * k, py - (SONAR + 1) * k, (SONAR + 1) * 2 * k, (SONAR + 1) * 2 * k);
    g.strokeStyle = '#d6ccff';
    g.lineWidth = Math.max(2, k * 0.14);
    g.beginPath();
    for (const [x, y] of vicine) muri(g, lab, x, y, k);
    g.stroke();
    const onda = (now / 1200) % 1;
    g.strokeStyle = `rgba(214,204,255,${0.5 * (1 - onda)})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px, py, onda * (SONAR + 0.5) * k, 0, TAU);
    g.stroke();
    segnali(g, v, k, now, mondo);
    // blip: "qualcuno è lì"
    for (let i = blips.length - 1; i >= 0; i--) {
      const b = blips[i];
      const a = 1 - (now - b.t) / (BLIP.vita * 1000);
      if (a <= 0) {
        blips.splice(i, 1);
        continue;
      }
      g.beginPath();
      g.arc(b.x * k, b.y * k, BLIP.raggio * k, 0, TAU);
      g.fillStyle = `rgba(255,140,40,${0.22 * a})`;
      g.fill();
      g.strokeStyle = `rgba(255,160,60,${0.8 * a})`;
      g.lineWidth = 2;
      g.stroke();
    }
    // le torce accese: posizione esatta (pallino giallo, rosso se paralizzato dall'Urlo)
    const puls = 0.5 + 0.5 * Math.sin(now / 140);
    for (const [x, y, a, te] of accese) {
      const lx = x * k;
      const ly = y * k;
      g.beginPath();
      g.moveTo(lx, ly);
      g.arc(lx, ly, TORCIA.raggio * k, a - TORCIA.apertura, a + TORCIA.apertura);
      g.closePath();
      g.fillStyle = 'rgba(255,214,120,0.14)';
      g.fill();
      g.beginPath();
      g.arc(lx, ly, Math.max(4, k * 0.28) * (te ? 1 + 0.25 * puls : 1), 0, TAU);
      g.fillStyle = te ? '#ff4d6d' : '#ffd23f';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#1b1030';
      g.stroke();
    }
    g.save();
    g.shadowColor = '#ff2a3d';
    g.shadowBlur = 12;
    g.beginPath();
    g.arc(px, py, Math.max(4, k * 0.3), 0, TAU);
    g.fillStyle = rec > 0 ? '#9f8fbf' : '#ff2a3d';
    g.fill();
    g.restore();
    etichetta(g, 'TU', px, py, w);
  }

  function base() {
    if (v.finito) return '🏁 Fine!';
    if (rec > 0) return '💫 Stordito… un attimo';
    return accese.length ? '👤 I pallini gialli hanno la torcia accesa: prendili!' : '👤 Tutti al buio: segui i cerchi arancioni';
  }
  function avviso(testo, classe, durata = 1.8) {
    stato.textContent = testo;
    stato.className = `un-stato ${classe || ''}`;
    avvisoFino = performance.now() + durata * 1000;
  }
  function scriviStato() {
    if (avvisoFino) return;
    stato.textContent = base();
    stato.className = `un-stato ${rec > 0 ? 'viola' : ''}`;
  }

  let ultimo = performance.now();
  let raf = requestAnimationFrame(function f(now) {
    const dt = Math.min(0.1, (now - ultimo) / 1000);
    ultimo = now;
    tTempo.textContent = `⏱ ${Math.ceil(tempo.resta())}`;
    for (const k of poteri) {
      const max = (v.cdMax && v.cdMax[k]) || POTERI[k].cd;
      bottoni[k].querySelector('.cd').style.transform = `scaleY(${Math.min(1, (cd[k] || 0) / max)})`;
    }
    bMorsa.classList.toggle('spento', rec > 0 || mancata);
    if (avvisoFino && now > avvisoFino) {
      avvisoFino = 0;
      scriviStato();
    }
    disegna(now, dt);
    raf = requestAnimationFrame(f);
  });

  function aggiorna(nv) {
    if (!nv) return;
    const nuovoLab = nv.lab !== v.lab;
    v = nv;
    if (nuovoLab) lab = decodifica(v.lab, v.col, v.rig);
    if (v.p) {
      pos = { x: v.p[0], y: v.p[1] };
      if (nuovoLab) vista = { ...pos };
    }
    mondo.batt = v.batt || mondo.batt;
    mondo.bt = v.bt ?? mondo.bt;
    mondo.ap = v.ap;
    tempo.imposta(v.resta ?? 0);
    tPresi.textContent = `💀 ${v.presi || 0}/${v.tot || 0}`;
    m.box.hidden = !v.morsa || v.finito;
    if (v.morsa) m.box.querySelector('h1').textContent = `✊ HAI PRESO ${String(v.morsa).toUpperCase()}!`;
    if (v.finito && v.ris) {
      msg.hidden = false;
      msg.innerHTML = `<div class="emoji-grande">👤</div><h1>${v.ris.punti} punti</h1><p>${esc(v.ris.det)}</p><p>Scappati ${v.ris.fuggiti} su ${v.ris.tot}</p>`;
    } else msg.hidden = true;
    scriviStato();
  }
  aggiorna(v);

  return {
    aggiorna,
    messaggio(d) {
      if (!d) return;
      if (d.p) pos = { x: d.p[0], y: d.p[1] };
      if (d.s != null) tempo.imposta(d.s);
      if (d.bt != null) mondo.bt = d.bt;
      if (d.mk) mondo.mk = d.mk;
      if (d.cd) cd = d.cd;
      if (d.rec != null) {
        const prima = rec;
        rec = d.rec;
        if (!!prima !== !!rec) scriviStato();
      }
      if (d.cm != null) mancata = !!d.cm;
      if (d.vs) {
        const prima = accese.length;
        accese = d.vs;
        if (!prima !== !accese.length) scriviStato();
      }
      if (d.pr != null) m.barra.style.width = `${Math.round(d.pr * 100)}%`;
      if (d.bl) {
        blips.push({ x: d.bl[0], y: d.bl[1], t: performance.now() });
        api.vibra(15);
      }
      switch (d.ev) {
        case 'vuoto':
          avviso('✊ Nessuno a portata…', '', 1);
          break;
        case 'preso':
          avviso(`💀 Preso ${d.chi}!`, 'bene', 2.2);
          api.vibra([40, 40, 160]);
          break;
        case 'ferito':
          avviso(`🩸 Hai ferito ${d.chi}: la prossima volta è tuo!`, 'bene', 2.2);
          break;
        case 'accecato':
          avviso(`🔦 ${d.da} ti ha accecato!`, 'male', 2.5);
          api.vibra([250]);
          break;
      }
    },
    smonta() {
      cancelAnimationFrame(raf);
      joy.distruggi();
      tela.distruggi();
    },
  };
}
