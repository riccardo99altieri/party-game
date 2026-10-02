// Bocce Caotiche sul telefono: fionda. Trascina la boccia indietro e lascia.

import { clamp, TAU, shade } from '../../shared/util.js';

const ANG_MAX = (60 * Math.PI) / 180;

import { cattura } from '../../phone/widgets.js';

export default {
  id: 'bocce',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="boc">
        <div class="tel-stato"></div>
        <div class="boc-campo"></div>
      </div>
      <style>
        .boc { position:absolute; inset:0; }
        .boc-campo { position:absolute; inset:0; }
      </style>`;
    const stato = el.querySelector('.tel-stato');
    const campo = el.querySelector('.boc-campo');
    let v = s || {};
    let presa = null; // {id, x, y}
    let mostra = null; // {dx, dy} durante il trascinamento
    let lanciata = null; // animazione dopo il lancio
    const col = api.io.colore;

    const cv = api.widgets.canvasPieno(campo, () => disegna());
    const ancora = () => [cv.w / 2, cv.h * 0.42];
    const maxTiro = () => Math.min(cv.h * 0.4, 300);
    const raggio = () => Math.min(cv.w, cv.h) * 0.09;

    function calcola(dx, dy) {
      const L = Math.hypot(dx, dy);
      const pot = clamp(L / maxTiro(), 0, 1);
      const ang = clamp(Math.atan2(-dx, dy), -ANG_MAX, ANG_MAX);
      return { pot, ang };
    }

    function disegna() {
      const { g, w, h } = cv;
      g.clearRect(0, 0, w, h);
      const [ax, ay] = ancora();
      const r = raggio();
      // pista
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.beginPath();
      g.moveTo(ax - r * 1.6, ay + 20);
      g.lineTo(ax - w * 0.45, 0);
      g.lineTo(ax + w * 0.45, 0);
      g.lineTo(ax + r * 1.6, ay + 20);
      g.fill();
      if (!v.puoi && !lanciata) return;
      let bx = ax;
      let by = ay;
      if (mostra) {
        const { pot, ang } = calcola(mostra.dx, mostra.dy);
        const L = pot * maxTiro();
        bx = ax - Math.sin(ang) * L;
        by = ay + Math.cos(ang) * L;
        // elastico
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ax - r * 1.5, ay);
        g.lineTo(bx, by);
        g.lineTo(ax + r * 1.5, ay);
        g.stroke();
        // traiettoria
        const lungh = 60 + pot * (ay - 30);
        g.setLineDash([10, 12]);
        g.strokeStyle = `hsl(${120 - pot * 120}, 90%, 60%)`;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(ax + Math.sin(ang) * lungh, ay - Math.cos(ang) * lungh);
        g.stroke();
        g.setLineDash([]);
        // barra di potenza
        const bw = w * 0.7;
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect((w - bw) / 2, h - 46, bw, 20);
        g.fillStyle = `hsl(${120 - pot * 120}, 90%, 55%)`;
        g.fillRect((w - bw) / 2, h - 46, bw * pot, 20);
      } else if (lanciata) {
        const k = lanciata.k;
        bx = ax + Math.sin(lanciata.ang) * k * h;
        by = ay - Math.cos(lanciata.ang) * k * h;
      }
      // boccia
      g.beginPath();
      g.arc(bx, by, r, 0, TAU);
      const grd = g.createRadialGradient(bx - r * 0.4, by - r * 0.4, r * 0.1, bx, by, r);
      grd.addColorStop(0, shade(col, 0.5));
      grd.addColorStop(1, shade(col, -0.2));
      g.fillStyle = grd;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#1b1030';
      g.stroke();
      g.save();
      g.beginPath();
      g.arc(bx, by, r - 2, 0, TAU);
      g.clip();
      api.disegnaTesta(g, api.io.avatar, bx, by + r * 0.1, r * 0.82, { t: 1 });
      g.restore();
      if (!mostra && !lanciata) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = `700 18px Fredoka, sans-serif`;
        g.textAlign = 'center';
        g.fillText('⬇ Trascina giù e lascia ⬇', ax, ay + r + 34);
      }
    }

    function aggiornaStato() {
      if (lanciata || !v.puoi) stato.textContent = v.ondata ? `Tiro ${v.ondata}/${v.tot} · lanciata! Guarda lo schermo 👀` : 'Guarda lo schermo 👀';
      else stato.textContent = `Tiro ${v.ondata}/${v.tot}: mira al centro! 🎯`;
    }

    campo.addEventListener('pointerdown', (e) => {
      if (!v.puoi || presa || lanciata) return;
      const [x, y] = cv.punto(e);
      const [ax, ay] = ancora();
      if (Math.hypot(x - ax, y - ay) > raggio() * 2.6) return;
      presa = { id: e.pointerId, x, y };
      cattura(campo, e.pointerId);
      mostra = { dx: 0, dy: 0 };
      disegna();
    });
    campo.addEventListener('pointermove', (e) => {
      if (!presa || e.pointerId !== presa.id) return;
      const [x, y] = cv.punto(e);
      mostra = { dx: x - presa.x, dy: y - presa.y };
      disegna();
    });
    const rilascia = (e) => {
      if (!presa || e.pointerId !== presa.id) return;
      const m = mostra;
      const { pot, ang } = calcola(m.dx, m.dy);
      presa = null;
      mostra = null;
      // Se non ha tirato indietro (o ha spinto in avanti) non lanciamo.
      if (pot < 0.06 || m.dy < 8) {
        disegna();
        return;
      }
      api.invia({ l: [ang, pot] });
      api.vibra(30);
      lanciata = { ang, k: 0 };
      aggiornaStato();
      const t0 = performance.now();
      const anima = () => {
        if (!lanciata) return;
        lanciata.k = (performance.now() - t0) / 500;
        disegna();
        if (lanciata.k < 1) requestAnimationFrame(anima);
      };
      requestAnimationFrame(anima);
    };
    campo.addEventListener('pointerup', rilascia);
    campo.addEventListener('pointercancel', rilascia);

    function aggiorna(nv) {
      v = nv || v;
      if (v.puoi) lanciata = null;
      aggiornaStato();
      disegna();
    }
    aggiorna(v);

    return {
      aggiorna,
      smonta() {
        cv.distruggi();
      },
    };
  },
};
