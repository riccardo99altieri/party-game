// Palco dello schermo principale: canvas virtuale 1920x1080 ridimensionato alla
// finestra, effetti (particelle, coriandoli, scritte, scossoni) e piccoli
// aiuti di disegno condivisi dai minigiochi.

import { TAU, rand, pick, clamp, ease } from '../shared/util.js';

export const W = 1920;
export const H = 1080;
export const FONT = "'Fredoka', 'Baloo 2', 'Segoe UI', system-ui, sans-serif";

export function creaPalco(stageEl, canvas) {
  const g = canvas.getContext('2d');
  let scala = 1;

  function adatta() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scala = Math.min(vw / W, vh / H);
    stageEl.style.transform = `translate(${(vw - W * scala) / 2}px, ${(vh - H * scala) / 2}px) scale(${scala})`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(1, Math.round(W * scala * dpr));
    const py = Math.max(1, Math.round(H * scala * dpr));
    if (canvas.width !== px || canvas.height !== py) {
      canvas.width = px;
      canvas.height = py;
    }
  }
  window.addEventListener('resize', adatta);
  adatta();

  return {
    g,
    // Prepara il contesto per disegnare in coordinate virtuali.
    inizioFrame() {
      g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      g.clearRect(0, 0, W, H);
    },
    scala: () => scala,
    // Da coordinate della finestra a coordinate virtuali.
    daFinestra(x, y) {
      const r = canvas.getBoundingClientRect();
      return [((x - r.left) / r.width) * W, ((y - r.top) / r.height) * H];
    },
  };
}

// ---------------------------------------------------------------------------
// Effetti

export function creaEffetti() {
  let parts = [];
  let testi = [];
  let anelli = [];
  let scossa = 0;
  let flash = null;

  return {
    particelle(x, y, o = {}) {
      const n = o.n ?? 16;
      const colori = o.colori || [o.colore || '#fff'];
      for (let i = 0; i < n; i++) {
        const a = o.angolo != null ? o.angolo + rand(-(o.apertura ?? 0.6), o.apertura ?? 0.6) : rand(0, TAU);
        const v = rand(o.velMin ?? 120, o.vel ?? 420);
        parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          g: o.grav ?? 600,
          vita: rand(0.5, 1) * (o.vita ?? 0.9),
          max: o.vita ?? 0.9,
          dim: rand(0.6, 1.2) * (o.dim ?? 9),
          colore: pick(colori),
          forma: o.forma || 'cerchio',
          rot: rand(0, TAU),
          vr: rand(-8, 8),
          attrito: o.attrito ?? 0.98,
        });
      }
    },
    coriandoli(n = 160) {
      const colori = ['#ff4d6d', '#ffd23f', '#3ec6ff', '#4cd97b', '#b04dff', '#ff8a3d', '#ffffff'];
      for (let i = 0; i < n; i++) {
        parts.push({
          x: rand(0, W),
          y: rand(-400, -20),
          vx: rand(-80, 80),
          vy: rand(80, 260),
          g: 60,
          vita: rand(3.5, 6),
          max: 6,
          dim: rand(8, 15),
          colore: pick(colori),
          forma: 'coriandolo',
          rot: rand(0, TAU),
          vr: rand(-6, 6),
          attrito: 0.995,
        });
      }
    },
    testo(x, y, str, o = {}) {
      testi.push({ x, y, str, vita: o.vita ?? 1.2, max: o.vita ?? 1.2, colore: o.colore || '#fff', dim: o.dim ?? 48, vy: o.vy ?? -90 });
    },
    anello(x, y, o = {}) {
      anelli.push({ x, y, r: o.r ?? 10, max: o.max ?? 120, vita: o.vita ?? 0.5, t: 0, colore: o.colore || '#fff', lw: o.lw ?? 8 });
    },
    scuoti(forza = 12) {
      scossa = Math.max(scossa, forza);
    },
    lampo(colore = '#fff', durata = 0.25) {
      flash = { colore, t: durata, max: durata };
    },
    pulisci() {
      parts = [];
      testi = [];
      anelli = [];
      scossa = 0;
      flash = null;
    },
    aggiorna(dt) {
      for (const p of parts) {
        p.vx *= p.attrito;
        p.vy = p.vy * p.attrito + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.vita -= dt;
      }
      parts = parts.filter((p) => p.vita > 0 && p.y < H + 60);
      for (const t of testi) {
        t.y += t.vy * dt;
        t.vita -= dt;
      }
      testi = testi.filter((t) => t.vita > 0);
      for (const a of anelli) a.t += dt;
      anelli = anelli.filter((a) => a.t < a.vita);
      scossa = Math.max(0, scossa - dt * 40);
      if (flash) {
        flash.t -= dt;
        if (flash.t <= 0) flash = null;
      }
    },
    // Spostamento della telecamera per lo scossone.
    offset() {
      return scossa > 0 ? [rand(-scossa, scossa), rand(-scossa, scossa)] : [0, 0];
    },
    disegna(g) {
      for (const a of anelli) {
        const k = a.t / a.vita;
        g.globalAlpha = 1 - k;
        g.strokeStyle = a.colore;
        g.lineWidth = a.lw * (1 - k) + 1;
        g.beginPath();
        g.arc(a.x, a.y, a.r + (a.max - a.r) * ease.outCubic(k), 0, TAU);
        g.stroke();
      }
      for (const p of parts) {
        g.globalAlpha = clamp(p.vita / (p.max * 0.4), 0, 1);
        g.fillStyle = p.colore;
        if (p.forma === 'cerchio') {
          g.beginPath();
          g.arc(p.x, p.y, p.dim / 2, 0, TAU);
          g.fill();
        } else {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          if (p.forma === 'coriandolo') g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) + 0.15);
          if (p.forma === 'stella') {
            g.beginPath();
            for (let i = 0; i < 10; i++) {
              const r = i % 2 ? p.dim * 0.25 : p.dim * 0.6;
              g.lineTo(Math.cos((i * Math.PI) / 5) * r, Math.sin((i * Math.PI) / 5) * r);
            }
            g.fill();
          } else g.fillRect(-p.dim / 2, -p.dim / 3, p.dim, (p.dim * 2) / 3);
          g.restore();
        }
      }
      g.globalAlpha = 1;
      for (const t of testi) {
        const k = 1 - t.vita / t.max;
        g.globalAlpha = clamp(t.vita / (t.max * 0.35), 0, 1);
        const s = k < 0.15 ? ease.outBack(k / 0.15) : 1;
        testo(g, t.str, t.x, t.y, { dim: t.dim * s, colore: t.colore });
      }
      g.globalAlpha = 1;
      if (flash) {
        g.globalAlpha = clamp(flash.t / flash.max, 0, 1) * 0.85;
        g.fillStyle = flash.colore;
        g.fillRect(-50, -50, W + 100, H + 100);
        g.globalAlpha = 1;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Aiuti di disegno

// Testo con bordo scuro, stile cartone.
export function testo(g, str, x, y, o = {}) {
  const dim = o.dim ?? 40;
  g.font = `${o.peso ?? 700} ${dim}px ${FONT}`;
  g.textAlign = o.allinea || 'center';
  g.textBaseline = o.base || 'middle';
  let s = String(str);
  if (o.maxW) {
    while (s.length > 1 && g.measureText(s).width > o.maxW) s = s.slice(0, -2) + '…';
  }
  if (o.bordo !== 0) {
    g.lineJoin = 'round';
    g.strokeStyle = o.bordoColore || 'rgba(20,10,45,0.9)';
    g.lineWidth = o.bordo ?? Math.max(3, dim * 0.16);
    g.strokeText(s, x, y);
  }
  g.fillStyle = o.colore || '#fff';
  g.fillText(s, x, y);
  return g.measureText(s).width;
}

export function pannello(g, x, y, w, h, o = {}) {
  g.beginPath();
  g.roundRect(x, y, w, h, o.r ?? 24);
  g.fillStyle = o.colore || 'rgba(25,12,60,0.72)';
  g.fill();
  if (o.bordo !== false) {
    g.strokeStyle = o.bordo || 'rgba(255,255,255,0.18)';
    g.lineWidth = o.lw ?? 3;
    g.stroke();
  }
}

// Sfondo "festa": gradiente e forme che fluttuano.
const FORME = Array.from({ length: 26 }, (_, i) => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: 20 + Math.random() * 60,
  v: 10 + Math.random() * 25,
  tipo: i % 3,
  rot: Math.random() * TAU,
}));

export function sfondoFesta(g, t, c1 = '#3a1c7a', c2 = '#7b2cbf') {
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.save();
  g.globalAlpha = 0.09;
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  for (const f of FORME) {
    const y = ((f.y - t * f.v) % (H + 200) + H + 200) % (H + 200) - 100;
    g.save();
    g.translate(f.x, y);
    g.rotate(f.rot + t * 0.2);
    g.beginPath();
    if (f.tipo === 0) g.arc(0, 0, f.r, 0, TAU);
    else if (f.tipo === 1) g.rect(-f.r * 0.7, -f.r * 0.7, f.r * 1.4, f.r * 1.4);
    else {
      g.moveTo(0, -f.r);
      g.lineTo(f.r * 0.87, f.r * 0.5);
      g.lineTo(-f.r * 0.87, f.r * 0.5);
      g.closePath();
    }
    if (f.tipo === 1) g.stroke();
    else g.fill();
    g.restore();
  }
  g.restore();
}

// Barra del tempo in alto.
export function barraTempo(g, restante, totale, o = {}) {
  const w = o.w ?? 900;
  const x = o.x ?? (W - w) / 2;
  const y = o.y ?? 28;
  const h = o.h ?? 26;
  const k = clamp(restante / totale, 0, 1);
  g.beginPath();
  g.roundRect(x - 4, y - 4, w + 8, h + 8, (h + 8) / 2);
  g.fillStyle = 'rgba(20,10,45,0.75)';
  g.fill();
  g.beginPath();
  g.roundRect(x, y, Math.max(h, w * k), h, h / 2);
  g.fillStyle = k > 0.5 ? '#4cd97b' : k > 0.2 ? '#ffd23f' : '#ff4d6d';
  g.fill();
  testo(g, Math.ceil(Math.max(0, restante)), x + w + 50, y + h / 2, { dim: 44 });
}

// Etichetta con il nome sotto un avatar.
export function etichetta(g, nome, x, y, colore, o = {}) {
  const dim = o.dim ?? 24;
  g.font = `700 ${dim}px ${FONT}`;
  let s = nome;
  const maxW = o.maxW ?? 220;
  while (s.length > 1 && g.measureText(s).width > maxW) s = s.slice(0, -2) + '…';
  const w = g.measureText(s).width + dim * 0.9;
  const h = dim * 1.35;
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  g.fillStyle = colore;
  g.fill();
  g.strokeStyle = 'rgba(20,10,45,0.85)';
  g.lineWidth = 3;
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = testoSu(colore);
  g.fillText(s, x, y + 1);
}

// Nero o bianco, quello che si legge meglio sopra un colore.
export function testoSu(hex) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255;
  const gg = (v >> 8) & 255;
  const b = v & 255;
  return r * 0.299 + gg * 0.587 + b * 0.114 > 160 ? '#1b1030' : '#fff';
}

// Scritta gigante al centro (per "VIA!", "FINE!"...) con entrata elastica.
export function scrittaGrande(g, str, k, o = {}) {
  const s = k < 0.25 ? ease.outBack(k / 0.25) : 1;
  const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  g.save();
  g.globalAlpha = clamp(a, 0, 1);
  g.translate(o.x ?? W / 2, o.y ?? H / 2);
  g.scale(s, s);
  g.rotate(o.rot ?? -0.04);
  testo(g, str, 0, 0, { dim: o.dim ?? 180, colore: o.colore || '#ffd23f', bordo: 18 });
  g.restore();
}
