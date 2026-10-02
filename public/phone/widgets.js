// Controlli riutilizzabili per i telefoni: joystick, pulsanti, manovella,
// lavagna da disegno, selettore colore, griglia di numeri, canvas a tutto schermo.
// Tutti usano i Pointer Events (multi-touch) e non fanno scorrere la pagina.

import { clamp, hsvToRgb, rgbToHex, TAU, dir8 } from '../shared/util.js';

// Tutti i punti del movimento del dito (anche quelli tra un evento e l'altro).
export function eventiFusi(e) {
  const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  return lista && lista.length ? lista : [e];
}

// Cattura il dito sull'elemento (se il browser non ci riesce, pazienza).
export function cattura(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {}
}

export const vibra = (p) => {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch {}
};

function crea(tag, cls, parent) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}

// Canvas che riempie il suo contenitore, nitido sui display ad alta densità.
// ridisegna(g, w, h) viene chiamata a ogni ridimensionamento.
export function canvasPieno(el, ridisegna) {
  const c = crea('canvas', 'canvas-pieno', el);
  const g = c.getContext('2d');
  const stato = { c, g, w: 1, h: 1, dpr: 1 };
  function adatta(prima) {
    const r = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    stato.w = Math.max(1, r.width);
    stato.h = Math.max(1, r.height);
    stato.dpr = dpr;
    c.width = Math.round(stato.w * dpr);
    c.height = Math.round(stato.h * dpr);
    c.style.width = `${stato.w}px`;
    c.style.height = `${stato.h}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ridisegna && !prima) ridisegna(g, stato.w, stato.h);
  }
  const ro = new ResizeObserver(() => adatta());
  ro.observe(el);
  // Prima misura subito; il primo disegno arriva appena chi ci chiama ha finito di prepararsi.
  adatta(true);
  queueMicrotask(() => {
    if (c.isConnected) adatta();
  });
  stato.punto = (e) => {
    const r = c.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  stato.distruggi = () => {
    ro.disconnect();
    c.remove();
  };
  stato.adatta = adatta;
  return stato;
}

// Joystick "fluttuante": appare dove appoggi il pollice.
// onCambio(x, y) con x, y in [-1, 1]. Con { otto: true } è a scatti: solo 8 direzioni
// (componenti -1, 0, 1), il pomello si aggancia e il telefono vibra a ogni cambio.
export function joystick(el, onCambio, o = {}) {
  el.classList.add('joy-zona');
  const base = crea('div', 'joy-base', el);
  const pomo = crea('div', 'joy-pomo', base);
  const hint = crea('div', 'joy-hint', el);
  hint.textContent = o.testo || 'Trascina il pollice';
  let id = null;
  let cx = 0;
  let cy = 0;
  let ultimo = 0;
  let pend = null;
  let ultimaDir = [0, 0];
  const R = o.raggio || 70;

  function manda(x, y, forza) {
    const now = performance.now();
    pend = [x, y];
    if (forza || now - ultimo > 40) {
      ultimo = now;
      onCambio(pend[0], pend[1]);
      pend = null;
    }
  }
  const timer = setInterval(() => {
    if (pend) manda(pend[0], pend[1], true);
  }, 50);

  function posiziona(x, y) {
    base.style.left = `${x}px`;
    base.style.top = `${y}px`;
  }
  function centro() {
    const r = el.getBoundingClientRect();
    cx = r.width / 2;
    cy = r.height / 2;
    posiziona(cx, cy);
  }
  centro();

  el.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    cattura(el, id);
    const r = el.getBoundingClientRect();
    cx = e.clientX - r.left;
    cy = e.clientY - r.top;
    posiziona(cx, cy);
    base.classList.add('attivo');
    hint.style.opacity = 0;
    muovi(e);
  });
  function muovi(e) {
    if (e.pointerId !== id) return;
    const r = el.getBoundingClientRect();
    let dx = e.clientX - r.left - cx;
    let dy = e.clientY - r.top - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    if (o.otto) {
      const [sx, sy] = dir8(dx / R, dy / R);
      const m = Math.hypot(sx, sy) || 1;
      pomo.style.transform = `translate(${(sx / m) * R * 0.8}px, ${(sy / m) * R * 0.8}px)`;
      if (sx !== ultimaDir[0] || sy !== ultimaDir[1]) {
        ultimaDir = [sx, sy];
        if (sx || sy) vibra(8);
        manda(sx, sy, true);
      }
      return;
    }
    pomo.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.hypot(dx, dy) / R;
    const vx = k < 0.12 ? 0 : dx / R;
    const vy = k < 0.12 ? 0 : dy / R;
    manda(vx, vy);
  }
  el.addEventListener('pointermove', muovi);
  const fine = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    pomo.style.transform = '';
    base.classList.remove('attivo');
    ultimaDir = [0, 0];
    manda(0, 0, true);
  };
  el.addEventListener('pointerup', fine);
  el.addEventListener('pointercancel', fine);
  return {
    distruggi() {
      clearInterval(timer);
    },
  };
}

// Pulsante grande: reagisce al tocco (pointerdown), non al clic.
export function pulsante(el, { testo, colore, onPremi, onRilascia, classe }) {
  const b = crea('button', `pad-btn ${classe || ''}`, el);
  b.innerHTML = testo;
  if (colore) b.style.setProperty('--c', colore);
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('premuto');
    if (onPremi) onPremi(e);
  });
  const su = () => {
    if (!b.classList.contains('premuto')) return;
    b.classList.remove('premuto');
    if (onRilascia) onRilascia();
  };
  b.addEventListener('pointerup', su);
  b.addEventListener('pointercancel', su);
  b.addEventListener('pointerleave', su);
  return b;
}

// Manovella: fai girare il dito intorno al centro. onGiro(deltaGiri) solo in senso orario.
export function manovella(el, onGiro, o = {}) {
  let angolo = 0;
  let prec = null;
  let id = null;
  let accumulo = 0;
  let giriTot = 0;
  const colore = o.colore || '#ffd23f';

  const cv = canvasPieno(el, disegna);

  function disegna() {
    const { g, w, h } = cv;
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.42;
    // ruota
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fill();
    g.lineWidth = R * 0.12;
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.stroke();
    // freccia del verso
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, R * 0.62, -Math.PI * 0.9, -Math.PI * 0.2);
    g.stroke();
    const a = -Math.PI * 0.2;
    g.translate(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(-12, -4);
    g.lineTo(0, 12);
    g.lineTo(12, -4);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    g.restore();
    // raggi
    g.save();
    g.translate(cx, cy);
    g.rotate(angolo);
    g.strokeStyle = colore;
    g.lineWidth = 10;
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.rotate(TAU / 6);
      g.beginPath();
      g.moveTo(R * 0.18, 0);
      g.lineTo(R * 0.86, 0);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, R * 0.18, 0, TAU);
    g.fillStyle = colore;
    g.fill();
    // maniglia
    g.beginPath();
    g.arc(R * 0.86, 0, R * 0.16, 0, TAU);
    g.fillStyle = '#fff';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = colore;
    g.stroke();
    g.restore();
  }

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    cattura(el, id);
    const [x, y] = cv.punto(e);
    prec = Math.atan2(y - cv.h / 2, x - cv.w / 2);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const [x, y] = cv.punto(e);
    const dx = x - cv.w / 2;
    const dy = y - cv.h / 2;
    if (Math.hypot(dx, dy) < Math.min(cv.w, cv.h) * 0.08) return; // troppo vicino al centro
    const a = Math.atan2(dy, dx);
    let d = a - prec;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    prec = a;
    if (d > 0) {
      angolo += d;
      accumulo += d / TAU;
      giriTot += d / TAU;
      disegna();
      if (o.onTacca && Math.floor(giriTot) !== Math.floor(giriTot - d / TAU)) o.onTacca(Math.floor(giriTot));
    }
  });
  const fine = (e) => {
    if (e.pointerId === id) id = null;
  };
  el.addEventListener('pointerup', fine);
  el.addEventListener('pointercancel', fine);
  const timer = setInterval(() => {
    if (accumulo > 0) {
      onGiro(accumulo);
      accumulo = 0;
    }
  }, 60);
  return {
    giri: () => giriTot,
    distruggi() {
      clearInterval(timer);
      cv.distruggi();
    },
  };
}

// Lavagna da disegno. Coordinate normalizzate 0..1000 nel quadrato di disegno.
// onEvento riceve: {k:'p', id, c, w, pts:[x,y,...]} (punti nuovi di un tratto),
// {k:'u'} (annulla), {k:'x'} (cancella tutto).
export const COLORI_LAVAGNA = ['#1b1030', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#15803d', '#38bdf8', '#2563eb', '#a855f7', '#f472b6', '#92400e', '#f5c49c', '#9ca3af'];
export const SPESSORI = [8, 18, 40];

export function lavagna(el, { onEvento }) {
  el.classList.add('lavagna');
  const foglio = crea('div', 'lav-foglio', el);
  const barra = crea('div', 'lav-barra', el);
  const colori = crea('div', 'lav-colori', barra);
  const attrezzi = crea('div', 'lav-attrezzi', barra);

  let colore = COLORI_LAVAGNA[0];
  let spessore = SPESSORI[1];
  const tratti = [];
  let corrente = null;
  let inviati = 0;
  let contatore = 0;
  const sessione = Math.random().toString(36).slice(2, 6); // id dei tratti unici anche dopo una riconnessione

  const cv = canvasPieno(foglio, () => ridisegna());
  const lato = () => Math.min(cv.w, cv.h);
  const off = () => [(cv.w - lato()) / 2, (cv.h - lato()) / 2];

  function ridisegna() {
    const { g, w, h } = cv;
    g.clearRect(0, 0, w, h);
    const L = lato();
    const [ox, oy] = off();
    g.fillStyle = '#fff';
    g.fillRect(ox, oy, L, L);
    for (const t of tratti) disegnaTratto(g, t, ox, oy, L / 1000);
  }

  for (const c of COLORI_LAVAGNA) {
    const b = crea('button', 'lav-col', colori);
    b.style.background = c;
    b.onclick = () => {
      colore = c;
      for (const x of colori.children) x.classList.toggle('on', x === b);
    };
    if (c === colore) b.classList.add('on');
  }
  SPESSORI.forEach((s) => {
    const b = crea('button', 'lav-spess', attrezzi);
    b.innerHTML = `<i style="width:${6 + s / 2.5}px;height:${6 + s / 2.5}px"></i>`;
    b.onclick = () => {
      spessore = s;
      for (const x of attrezzi.querySelectorAll('.lav-spess')) x.classList.toggle('on', x === b);
    };
    if (s === spessore) b.classList.add('on');
  });
  const annulla = crea('button', 'lav-att', attrezzi);
  annulla.textContent = '↩️';
  annulla.onclick = () => {
    if (!tratti.length) return;
    tratti.pop();
    ridisegna();
    onEvento({ k: 'u' });
  };
  const cancella = crea('button', 'lav-att', attrezzi);
  cancella.textContent = '🗑️';
  let conferma = 0;
  cancella.onclick = () => {
    if (!tratti.length) return;
    const now = performance.now();
    if (now - conferma > 2000) {
      conferma = now;
      cancella.textContent = '❓';
      setTimeout(() => (cancella.textContent = '🗑️'), 2000);
      return;
    }
    tratti.length = 0;
    ridisegna();
    onEvento({ k: 'x' });
    cancella.textContent = '🗑️';
  };

  function norm(e) {
    const [x, y] = cv.punto(e);
    const [ox, oy] = off();
    const L = lato();
    return [Math.round(clamp(((x - ox) / L) * 1000, 0, 1000)), Math.round(clamp(((y - oy) / L) * 1000, 0, 1000))];
  }

  let attivo = true;
  foglio.addEventListener('pointerdown', (e) => {
    if (!attivo || corrente) return;
    cattura(foglio, e.pointerId);
    corrente = { id: `${sessione}${++contatore}`, c: colore, w: spessore, pts: norm(e), pid: e.pointerId };
    tratti.push(corrente);
    inviati = 0;
    ridisegna();
  });
  foglio.addEventListener('pointermove', (e) => {
    if (!corrente || e.pointerId !== corrente.pid) return;
    const evs = eventiFusi(e);
    for (const ev of evs) {
      const [x, y] = norm(ev);
      const n = corrente.pts.length;
      if (Math.hypot(x - corrente.pts[n - 2], y - corrente.pts[n - 1]) >= 4) corrente.pts.push(x, y);
    }
    const [ox, oy] = off();
    disegnaTratto(cv.g, { ...corrente, pts: corrente.pts.slice(-6) }, ox, oy, lato() / 1000);
  });
  const su = (e) => {
    if (!corrente || e.pointerId !== corrente.pid) return;
    svuota();
    corrente = null;
  };
  foglio.addEventListener('pointerup', su);
  foglio.addEventListener('pointercancel', su);

  function svuota() {
    if (!corrente || corrente.pts.length <= inviati) return;
    const da = Math.max(0, inviati - 2); // ripeti l'ultimo punto per unire i pezzi
    onEvento({ k: 'p', id: corrente.id, c: corrente.c, w: corrente.w, pts: corrente.pts.slice(da) });
    inviati = corrente.pts.length;
  }
  const timer = setInterval(svuota, 120);

  return {
    tratti,
    blocca(v) {
      attivo = !v;
      el.classList.toggle('bloccata', v);
      if (v && corrente) {
        svuota();
        corrente = null;
      }
    },
    distruggi() {
      clearInterval(timer);
      cv.distruggi();
    },
  };
}

// Disegna un tratto (coordinate 0..1000) con origine ox, oy e scala k.
export function disegnaTratto(g, t, ox, oy, k) {
  const p = t.pts;
  if (!p || p.length < 2) return;
  g.strokeStyle = t.c;
  g.fillStyle = t.c;
  g.lineWidth = Math.max(1, t.w * k);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (p.length === 2) {
    g.beginPath();
    g.arc(ox + p[0] * k, oy + p[1] * k, g.lineWidth / 2, 0, TAU);
    g.fill();
    return;
  }
  g.beginPath();
  g.moveTo(ox + p[0] * k, oy + p[1] * k);
  for (let i = 2; i < p.length; i += 2) g.lineTo(ox + p[i] * k, oy + p[i + 1] * k);
  g.stroke();
}

// Selettore colore: anello della tinta + quadrato saturazione/luminosità.
// onCambio([r,g,b])
export function selettoreColore(el, onCambio, iniziale = [200, 0.6, 0.8]) {
  let [h, s, v] = iniziale;
  let attivo = true;
  let presa = null; // 'anello' | 'quadrato'
  const cv = canvasPieno(el, disegna);
  let cacheQ = null;

  function geo() {
    const L = Math.min(cv.w, cv.h);
    const cx = cv.w / 2;
    const cy = cv.h / 2;
    const Ro = L * 0.48;
    const Ri = L * 0.36;
    const q = Ri * 1.3; // lato del quadrato inscritto
    return { cx, cy, Ro, Ri, q };
  }

  function disegna() {
    const { g, w, h: hh } = cv;
    const { cx, cy, Ro, Ri, q } = geo();
    g.clearRect(0, 0, w, hh);
    // anello
    const passi = 90;
    for (let i = 0; i < passi; i++) {
      const a0 = (i / passi) * TAU - Math.PI / 2;
      const a1 = ((i + 1.5) / passi) * TAU - Math.PI / 2;
      g.beginPath();
      g.arc(cx, cy, Ro, a0, a1);
      g.arc(cx, cy, Ri, a1, a0, true);
      g.closePath();
      g.fillStyle = rgbToHex(hsvToRgb((i / passi) * 360, 1, 1));
      g.fill();
    }
    // quadrato
    const x0 = cx - q / 2;
    const y0 = cy - q / 2;
    const gs = g.createLinearGradient(x0, 0, x0 + q, 0);
    gs.addColorStop(0, '#fff');
    gs.addColorStop(1, rgbToHex(hsvToRgb(h, 1, 1)));
    g.fillStyle = gs;
    g.fillRect(x0, y0, q, q);
    const gv = g.createLinearGradient(0, y0, 0, y0 + q);
    gv.addColorStop(0, 'rgba(0,0,0,0)');
    gv.addColorStop(1, '#000');
    g.fillStyle = gv;
    g.fillRect(x0, y0, q, q);
    // cursori
    const a = (h / 360) * TAU - Math.PI / 2;
    const rm = (Ro + Ri) / 2;
    cursore(g, cx + Math.cos(a) * rm, cy + Math.sin(a) * rm, (Ro - Ri) * 0.45, rgbToHex(hsvToRgb(h, 1, 1)));
    cursore(g, x0 + s * q, y0 + (1 - v) * q, 14, rgbToHex(hsvToRgb(h, s, v)));
    if (!attivo) {
      g.fillStyle = 'rgba(20,10,45,0.6)';
      g.fillRect(0, 0, w, hh);
    }
  }

  function cursore(g, x, y, r, c) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = c;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = '#1b1030';
    g.beginPath();
    g.arc(x, y, r + 3, 0, TAU);
    g.stroke();
  }

  function applica(e) {
    const [x, y] = cv.punto(e);
    const { cx, cy, q } = geo();
    if (presa === 'anello') {
      h = ((Math.atan2(y - cy, x - cx) + Math.PI / 2 + TAU) % TAU) * (360 / TAU);
    } else {
      s = clamp((x - (cx - q / 2)) / q, 0, 1);
      v = clamp(1 - (y - (cy - q / 2)) / q, 0, 1);
    }
    disegna();
    onCambio(hsvToRgb(h, s, v));
  }

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (!attivo) return;
    const [x, y] = cv.punto(e);
    const { cx, cy, Ri, q } = geo();
    const d = Math.hypot(x - cx, y - cy);
    if (d > Ri * 0.98) presa = 'anello';
    else if (Math.abs(x - cx) <= q / 2 + 20 && Math.abs(y - cy) <= q / 2 + 20) presa = 'quadrato';
    else return;
    cattura(el, e.pointerId);
    applica(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (presa) applica(e);
  });
  const fine = () => (presa = null);
  el.addEventListener('pointerup', fine);
  el.addEventListener('pointercancel', fine);

  return {
    rgb: () => hsvToRgb(h, s, v),
    blocca(b) {
      attivo = !b;
      disegna();
    },
    imposta(nh, ns, nv) {
      h = nh;
      s = ns;
      v = nv;
      disegna();
    },
    distruggi: () => cv.distruggi(),
  };
}

// Griglia di numeri da 1 a max. onScelta(n)
export function grigliaNumeri(el, max, onScelta) {
  el.classList.add('griglia-num');
  const cols = max <= 12 ? 3 : 4;
  el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  let scelto = null;
  const bottoni = [];
  for (let n = 1; n <= max; n++) {
    const b = crea('button', 'gn-btn', el);
    b.textContent = n;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (el.classList.contains('bloccata')) return;
      scelto = n;
      for (const x of bottoni) x.classList.toggle('on', x === b);
      vibra(15);
      onScelta(n);
    });
    bottoni.push(b);
  }
  return {
    blocca(v) {
      el.classList.toggle('bloccata', v);
    },
    scelto: () => scelto,
  };
}
