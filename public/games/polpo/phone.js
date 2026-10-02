// Il Polpo sul telefono: due interfacce, scelte dal ruolo.
// Pesce: joystick a 8 direzioni + SCATTO. Polpo: energia, mappa-mirino (senza pesci:
// quelli si guardano sulla TV) e i cinque poteri.

import { clamp, TAU } from '../../shared/util.js';
import { POTERI, ORDINE_POTERI, MAPPA } from './regole.js';

export default {
  id: 'polpo',
  monta(el, api, s) {
    return s && s.ruolo === 'polpo' ? montaPolpo(el, api, s) : montaPesce(el, api, s);
  },
};

// Conto alla rovescia locale a partire dai secondi mandati dallo schermo.
function orologio() {
  let fine = 0;
  return {
    imposta: (resta) => (fine = performance.now() + resta * 1000),
    resta: () => Math.max(0, (fine - performance.now()) / 1000),
  };
}

// ---------------------------------------------------------------------------
// Pesce

function montaPesce(el, api, s) {
  el.innerHTML = `
    <div class="pls">
      <div class="pls-testa"><span class="pls-bolle">🫧🫧🫧</span><span class="pls-coralli">🪸 0</span><span class="pls-tempo">⏱ 60</span></div>
      <div class="pls-stato">🐟 Nuota verso destra ➡️🏁</div>
      <div class="pls-pad">
        <div class="pls-joy"></div>
        <div class="pls-btn"></div>
      </div>
      <div class="tel-msg" hidden></div>
    </div>
    <style>
      .pls { position:absolute; inset:0; display:flex; flex-direction:column; }
      .pls-testa { display:flex; justify-content:space-between; padding:10px 16px 0; font-size:20px; font-weight:700; }
      .pls-stato { flex:none; padding:8px 12px 12px; text-align:center; font-size:22px; font-weight:700; min-height:62px; display:flex; align-items:center; justify-content:center; transition:color .2s, transform .2s; }
      .pls-stato.male { color:#ff8fb3; transform:scale(1.06); }
      .pls-stato.bene { color:var(--verde); }
      .pls-stato.viola { color:#c9a7ff; transform:scale(1.1); }
      .pls-stato.blu { color:#9fe0ff; transform:scale(1.1); }
      .pls-pad { flex:1; display:flex; gap:10px; padding:0 12px calc(16px + env(safe-area-inset-bottom)); min-height:0; }
      .pls-joy { flex:1.4; border-radius:28px; background:rgba(255,255,255,0.06); border:3px dashed rgba(255,255,255,0.2); }
      .pls-btn { flex:1; display:flex; align-items:center; }
      .pls-btn .pad-btn { width:100%; height:auto; aspect-ratio:1; max-height:100%; border-radius:50%; font-size:24px; line-height:1.15; position:relative; overflow:hidden; }
      .pls-btn .pad-btn .cd { position:absolute; inset:0; background:rgba(20,10,45,0.65); transform-origin:bottom; transform:scaleY(0); }
      .pls-btn .pad-btn .va { position:absolute; left:0; right:0; bottom:0; height:100%; background:rgba(255,255,255,0.35); transform-origin:bottom; transform:scaleY(0); }
    </style>`;
  const stato = el.querySelector('.pls-stato');
  const msg = el.querySelector('.tel-msg');
  const tCoralli = el.querySelector('.pls-coralli');
  const tBolle = el.querySelector('.pls-bolle');
  const bolle = (n) => (tBolle.textContent = n > 0 ? '🫧'.repeat(n) : '—');
  const tTempo = el.querySelector('.pls-tempo');
  const zona = el.querySelector('.pls-joy');
  zona.style.setProperty('--c', api.io.colore);
  const joy = api.widgets.joystick(zona, (x, y) => api.invia({ j: [x, y] }), { testo: 'Nuota qui (8 direzioni)', otto: true });
  const tempo = orologio();
  let v = s || {};
  let scattoFine = 0;
  let cdFine = 0;
  let durScatto = 2;
  let durCd = 5;
  let avvisoFino = 0;
  const btn = api.widgets.pulsante(el.querySelector('.pls-btn'), {
    testo: '<span style="font-size:44px">💨</span><br>SCATTO<div class="va"></div><div class="cd"></div>',
    colore: '#3ec6ff',
    onPremi: () => {
      if (performance.now() < cdFine || v.arrivato) return;
      api.invia({ s: 1 });
    },
  });
  const cd = btn.querySelector('.cd');
  const va = btn.querySelector('.va');

  function base() {
    if (v.arrivato) return '🏁 Arrivato! Fai il tifo 🎉';
    const polpi = v.polpi || [];
    return polpi.length ? `🐟 Scappa da ${polpi.join(' e ')}! ➡️🏁` : '🐟 Nuota verso destra ➡️🏁';
  }
  function avviso(testo, classe, durata = 1.2) {
    stato.textContent = testo;
    stato.className = `pls-stato ${classe || ''}`;
    avvisoFino = performance.now() + durata * 1000;
  }

  let raf = requestAnimationFrame(function f() {
    const now = performance.now();
    va.style.transform = `scaleY(${now < scattoFine ? (scattoFine - now) / (durScatto * 1000) : 0})`;
    cd.style.transform = `scaleY(${now >= scattoFine && now < cdFine ? (cdFine - now) / (durCd * 1000) : 0})`;
    if (avvisoFino && now > avvisoFino) {
      avvisoFino = 0;
      stato.textContent = base();
      stato.className = 'pls-stato';
    }
    tTempo.textContent = `⏱ ${Math.ceil(tempo.resta())}`;
    raf = requestAnimationFrame(f);
  });

  function aggiorna(nv) {
    if (!nv) return;
    v = nv;
    tempo.imposta(v.resta ?? 60);
    if (v.cdScatto) durCd = v.cdScatto;
    if (v.durataScatto) durScatto = v.durataScatto;
    tCoralli.textContent = `🪸 ${v.coralli || 0}`;
    bolle(v.bolle ?? 3);
    const coralliTesto = v.coralli ? `Hai preso ${v.coralli} ${v.coralli === 1 ? 'corallo' : 'coralli'} 🪸<br>` : '';
    if (v.finito || v.arrivato || v.catturato) {
      msg.hidden = false;
      msg.innerHTML = v.arrivato
        ? `<div class="emoji-grande">🏁</div><h1>Arrivato!</h1><p>${coralliTesto}Guarda lo schermo e fai il tifo!</p>`
        : v.catturato
          ? `<div class="emoji-grande">🐙</div><h1>Catturato!</h1><p>Il Polpo ti ha preso.<br>${coralliTesto}Fai il tifo per gli altri pesci!</p>`
          : '<div class="emoji-grande">⏱</div><h1>Tempo scaduto!</h1><p>Guarda lo schermo 👀</p>';
    } else msg.hidden = true;
    if (!avvisoFino) stato.textContent = base();
  }
  aggiorna(v);

  return {
    aggiorna,
    messaggio(d) {
      if (!d || !d.ev) return;
      switch (d.ev) {
        case 'scatto':
          scattoFine = performance.now() + (d.dur || 2) * 1000;
          cdFine = scattoFine + (d.cd || 5) * 1000;
          durScatto = d.dur || 2;
          durCd = d.cd || 5;
          api.vibra(20);
          break;
        case 'presa':
          if (d.bolle != null) bolle(d.bolle);
          avviso(d.bolle === 1 ? '🐙 Preso! Ti resta UNA bolla!' : '🐙 Preso dal tentacolo! Aspetta…', 'male', d.dur || 2);
          api.vibra([80, 40, 80]);
          break;
        case 'catturato':
          api.vibra([300, 100, 300]);
          break;
        case 'lento':
          avviso('🪼 Punto dalla medusa: sei lento!', 'male', d.dur || 2);
          api.vibra(60);
          break;
        case 'invertito':
          avviso('🌀 COMANDI INVERTITI!', 'viola', d.dur || 3);
          api.vibra([40, 30, 40, 30, 40]);
          break;
        case 'spinta':
          avviso('💨 Spinto indietro!', 'male', 1.2);
          api.vibra(120);
          break;
        case 'marea':
          avviso('🌊 MAREA! Nasconditi dietro uno scoglio!', 'blu', d.dur || 2.5);
          api.vibra([200, 100, 200]);
          break;
        case 'riparato':
          avviso('🪨 Al riparo! Bravo!', 'bene', 1.5);
          break;
        case 'corallo':
          tCoralli.textContent = `🪸 ${d.n}`;
          avviso(`🪸 +1 punto! (${d.n})`, 'bene', 1);
          api.vibra(30);
          break;
        case 'arrivato':
          api.vibra([60, 60, 60, 60, 200]);
          break;
      }
    },
    smonta() {
      cancelAnimationFrame(raf);
      joy.distruggi();
    },
  };
}

// ---------------------------------------------------------------------------
// Polpo

function montaPolpo(el, api, s) {
  el.innerHTML = `
    <div class="plp">
      <div class="plp-testa">
        <div class="plp-energia"></div>
        <div class="plp-info"><span class="plp-tempo">⏱ 60</span></div>
      </div>
      <div class="plp-mappa"></div>
      <div class="plp-lato">
        <div class="plp-hint">Guarda la TV 📺 Trascina il dito sulla mappa per mirare</div>
        <div class="plp-poteri"></div>
      </div>
      <div class="tel-msg" hidden></div>
    </div>
    <style>
      .plp { position:absolute; inset:0; display:flex; flex-direction:column; gap:8px; padding:10px 10px calc(12px + env(safe-area-inset-bottom)); }
      .plp-testa { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .plp-energia { display:flex; gap:4px; align-items:center; font-weight:700; }
      .plp-energia i { width:22px; height:22px; border-radius:6px; border:2px solid var(--scuro); background:rgba(20,10,45,0.6); position:relative; overflow:hidden; }
      .plp-energia i.on { background:var(--giallo); }
      .plp-energia i b { position:absolute; left:0; bottom:0; right:0; background:rgba(255,210,63,0.55); }
      .plp-info { font-size:20px; font-weight:700; text-align:right; }
      .plp-mappa { flex:none; width:100%; aspect-ratio:1.15; max-height:48vh; border-radius:18px; overflow:hidden; border:3px solid rgba(255,255,255,0.35); touch-action:none; position:relative; }
      .plp-lato { flex:1; display:flex; flex-direction:column; justify-content:space-evenly; gap:8px; }
      .plp-poteri button { min-height:96px; font-size:16px; }
      .plp-hint { text-align:center; font-size:16px; font-weight:600; min-height:22px; }
      .plp-hint.armato { color:var(--giallo); }
      .plp-poteri { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
      .plp-poteri button { position:relative; overflow:hidden; border:4px solid var(--scuro); border-radius:18px; background:#6d4bd8; color:#fff; font-weight:700; font-size:15px; padding:6px 2px 8px; box-shadow:0 5px 0 var(--scuro); touch-action:none; line-height:1.15; }
      .plp-poteri button .e { display:block; font-size:30px; }
      .plp-poteri button .c { display:block; font-size:12px; letter-spacing:1px; color:var(--giallo); }
      .plp-poteri button .cd { position:absolute; inset:0; background:rgba(20,10,45,0.7); transform-origin:bottom; transform:scaleY(0); }
      .plp-poteri button.no { filter:grayscale(0.8) brightness(0.6); }
      .plp-poteri button.armato { background:#ff4d8d; transform:translateY(3px); box-shadow:0 2px 0 var(--scuro), 0 0 0 4px var(--giallo); }
      .plp-poteri button.via { transform:translateY(4px); box-shadow:0 1px 0 var(--scuro); }
      .plp-poteri button[data-p="marea"] { grid-column: span 2; background:#2f7ae5; }
      @media (orientation: landscape) {
        .plp { display:grid; grid-template-columns: 1.6fr 1fr; grid-template-rows: auto 1fr; }
        .plp-testa { grid-column: 1 / 3; }
        .plp-mappa { grid-row: 2; width:auto; height:100%; max-height:none; aspect-ratio:auto; }
        .plp-poteri button { min-height:0; }
        .plp-lato { grid-row: 2; justify-content:center; }
      }
    </style>`;
  const energiaEl = el.querySelector('.plp-energia');
  const tTempo = el.querySelector('.plp-tempo');
  const hint = el.querySelector('.plp-hint');
  const box = el.querySelector('.plp-poteri');
  const zona = el.querySelector('.plp-mappa');
  const msg = el.querySelector('.tel-msg');
  const tempo = orologio();
  let v = s || {};
  let ricevuto = performance.now();
  let armato = null;
  let dito = null;
  let mira = (v.mira || [0.5, 0.5]).slice();
  let ultimoInvio = 0;
  let pend = false;

  const bottoni = {};
  for (const k of ORDINE_POTERI) {
    const P = POTERI[k];
    const b = document.createElement('button');
    b.dataset.p = k;
    b.innerHTML = `<span class="e">${P.emoji}</span>${P.nome}<span class="c">${'⚡'.repeat(P.costo)}${P.unaVolta ? ' · 1 volta' : ''}</span><div class="cd"></div>`;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      premi(k, b);
    });
    box.appendChild(b);
    bottoni[k] = b;
  }

  // secondi di ricarica rimasti, contati da quando è arrivata l'ultima vista
  const cdResta = (k) => Math.max(0, ((v.cd && v.cd[k]) || 0) - (performance.now() - ricevuto) / 1000);
  const disponibile = (k) => {
    const P = POTERI[k];
    if (P.unaVolta && v.mareaUsata) return false;
    return (v.energia || 0) >= P.costo && cdResta(k) <= 0;
  };

  function premi(k, b) {
    if (!disponibile(k)) {
      api.vibra(15);
      hint.textContent = POTERI[k].unaVolta && v.mareaUsata ? 'La Marea è già stata usata' : cdResta(k) > 0 ? `${POTERI[k].nome}: si sta ricaricando…` : 'Non hai abbastanza energia ⚡';
      hint.className = 'plp-hint';
      return;
    }
    if (k === 'marea') {
      // la Marea colpisce tutti: non serve mirare
      api.invia({ p: k });
      lampo(b);
      armato = null;
      return aggiornaArmato();
    }
    if (dito !== null) {
      api.invia({ p: k, a: mira });
      lampo(b);
      armato = null;
    } else armato = armato === k ? null : k;
    aggiornaArmato();
  }
  function lampo(b) {
    api.vibra(25);
    b.classList.add('via');
    setTimeout(() => b.classList.remove('via'), 150);
  }
  function aggiornaArmato() {
    for (const [k, b] of Object.entries(bottoni)) b.classList.toggle('armato', k === armato);
    hint.className = `plp-hint ${armato ? 'armato' : ''}`;
    hint.textContent = armato ? `${POTERI[armato].emoji} Ora tocca la mappa e lascia il dito dove colpire` : 'Guarda la TV 📺 Trascina il dito sulla mappa per mirare';
  }

  // Mappa-mirino
  const cv = api.widgets.canvasPieno(zona, () => disegna());
  function puntoMappa(e) {
    const [x, y] = cv.punto(e);
    return [clamp(x / cv.w, 0, 1), clamp(y / cv.h, 0, 1)];
  }
  function mandaMira(forza) {
    const now = performance.now();
    if (!forza && now - ultimoInvio < 40) {
      pend = true;
      return;
    }
    ultimoInvio = now;
    pend = false;
    api.invia({ m: mira });
  }
  zona.addEventListener('pointerdown', (e) => {
    if (dito !== null) return;
    dito = e.pointerId;
    try {
      zona.setPointerCapture(e.pointerId);
    } catch {}
    mira = puntoMappa(e);
    mandaMira(true);
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dito) return;
    mira = puntoMappa(e);
    mandaMira(false);
  });
  const su = (e) => {
    if (e.pointerId !== dito) return;
    dito = null;
    mira = puntoMappa(e);
    mandaMira(true);
    if (armato && disponibile(armato)) {
      api.invia({ p: armato, a: mira });
      lampo(bottoni[armato]);
    }
    armato = null;
    aggiornaArmato();
  };
  zona.addEventListener('pointerup', su);
  zona.addEventListener('pointercancel', su);

  function disegna() {
    const { g, w, h } = cv;
    const m = v.mappa;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2a8fd6');
    grd.addColorStop(1, '#0d3f7a');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    if (m) {
      // corsie: fuori dalle corsie c'è roccia
      g.fillStyle = '#5b4b6b';
      let prima = 0;
      for (const [a, b] of m.corsie) {
        if (a > prima) g.fillRect(0, prima * h, w, (a - prima) * h);
        prima = b;
      }
      if (prima < 1) g.fillRect(0, prima * h, w, (1 - prima) * h);
      for (const c of m.correnti) {
        g.fillStyle = c[4] < 0 ? 'rgba(255,120,120,0.2)' : 'rgba(200,240,255,0.2)';
        g.fillRect(c[0] * w, c[1] * h, (c[2] - c[0]) * w, (c[3] - c[1]) * h);
      }
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.moveTo(m.partenza * w, 0);
      g.lineTo(m.partenza * w, h);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#fff';
      g.fillRect(m.traguardo * w - 2, 0, 4, h);
      g.fillStyle = '#6f5c82';
      const kx = w / (MAPPA.x1 - MAPPA.x0);
      const ky = h / (MAPPA.y1 - MAPPA.y0);
      for (const [u, vv, r] of m.scogli) {
        g.beginPath();
        g.ellipse(u * w, vv * h, r * kx, r * ky, 0, 0, TAU);
        g.fill();
      }
    }
    for (const [u, vv] of v.meduse || []) {
      g.fillStyle = '#ff78c8';
      g.beginPath();
      g.arc(u * w, vv * h, 6, 0, TAU);
      g.fill();
    }
    // mirino
    const x = mira[0] * w;
    const y = mira[1] * h;
    g.strokeStyle = armato ? '#ffd23f' : '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 14, 0, TAU);
    g.moveTo(x - 22, y);
    g.lineTo(x - 8, y);
    g.moveTo(x + 8, y);
    g.lineTo(x + 22, y);
    g.moveTo(x, y - 22);
    g.lineTo(x, y - 8);
    g.moveTo(x, y + 8);
    g.lineTo(x, y + 22);
    g.stroke();
    if (armato) {
      g.font = '22px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(POTERI[armato].emoji, x + 24, y - 20);
    }
    if (!dito && !armato) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = '600 14px sans-serif';
      g.textAlign = 'center';
      g.fillText('i pesci sono sulla TV 📺', w / 2, h - 10);
    }
  }

  function aggiornaEnergia() {
    const max = v.max || 6;
    if (energiaEl.children.length !== max) energiaEl.innerHTML = Array.from({ length: max }, () => '<i><b></b></i>').join('');
    const k = v.energia < max ? clamp(((v.tRic || 0) + (performance.now() - ricevuto) / 1000) / (v.ricarica || 3), 0, 1) : 0;
    [...energiaEl.children].forEach((pip, i) => {
      pip.classList.toggle('on', i < v.energia);
      pip.firstChild.style.height = i === v.energia ? `${k * 100}%` : '0';
    });
  }

  let raf = requestAnimationFrame(function f() {
    for (const k of ORDINE_POTERI) {
      const b = bottoni[k];
      b.classList.toggle('no', !disponibile(k));
      const P = POTERI[k];
      b.querySelector('.cd').style.transform = `scaleY(${P.cd ? cdResta(k) / P.cd : 0})`;
    }
    aggiornaEnergia();
    tTempo.textContent = `${v.compagno ? `con ${v.compagno} · ` : ''}⏱ ${Math.ceil(tempo.resta())}`;
    if (pend) mandaMira(false);
    disegna();
    raf = requestAnimationFrame(f);
  });

  function aggiorna(nv) {
    if (!nv) return;
    v = nv;
    ricevuto = performance.now();
    tempo.imposta(v.resta ?? 60);
    if (dito === null && v.mira) mira = v.mira.slice();
    if (v.finito) {
      msg.hidden = false;
      msg.innerHTML = '<div class="emoji-grande">🐙</div><h1>Fine!</h1><p>Guarda lo schermo 👀</p>';
    } else msg.hidden = true;
  }
  aggiorna(v);

  return {
    aggiorna,
    smonta() {
      cancelAnimationFrame(raf);
      cv.distruggi();
    },
  };
}
