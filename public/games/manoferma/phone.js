// Mano Ferma sul telefono: un foglio quadrato su cui disegnare, tagliare, toccare.

import { TAU, fmtNum } from '../../shared/util.js';

import { cattura, eventiFusi } from '../../phone/widgets.js';

export default {
  id: 'manoferma',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="mf">
        <div class="mf-testa"><div class="mf-titolo"></div><div class="mf-testo"></div><div class="mf-tempo"></div></div>
        <div class="mf-foglio"></div>
        <div class="mf-piede"></div>
      </div>
      <style>
        .mf { position:absolute; inset:0; display:flex; flex-direction:column; }
        .mf-testa { flex:none; text-align:center; padding:8px 14px 4px; }
        .mf-titolo { font-size:24px; font-weight:700; }
        .mf-testo { font-size:16px; opacity:.9; min-height:20px; }
        .mf-tempo { font-size:16px; font-weight:700; color:#ffd23f; min-height:20px; }
        .mf-foglio { flex:1; position:relative; min-height:0; }
        .mf-piede { flex:none; text-align:center; padding:6px 14px calc(12px + env(safe-area-inset-bottom)); font-size:18px; font-weight:700; min-height:44px; }
      </style>`;
    const titolo = el.querySelector('.mf-titolo');
    const testo = el.querySelector('.mf-testo');
    const tempo = el.querySelector('.mf-tempo');
    const piede = el.querySelector('.mf-piede');
    const foglio = el.querySelector('.mf-foglio');
    const col = api.io.colore;

    let v = s || {};
    let chiave = null; // prova corrente
    let tratto = [];
    let linea = null;
    let tocchi = [];
    let inviato = false;
    let dito = null;
    let raf = 0;

    const cv = api.widgets.canvasPieno(foglio, () => {});
    const geo = () => {
      const L = Math.min(cv.w, cv.h) - 16;
      return { L, ox: (cv.w - L) / 2, oy: (cv.h - L) / 2, k: L / 1000 };
    };
    const norm = (e) => {
      const [x, y] = cv.punto(e);
      const { ox, oy, k } = geo();
      return [Math.round((x - ox) / k), Math.round((y - oy) / k)];
    };
    const attiva = () => v.fase === 'prova' && !inviato;
    const memorizza = () => v.tipo === 'punti' && v.mostraFino && api.ora() < v.mostraFino;

    function invia(d) {
      if (inviato) return;
      inviato = true;
      api.invia(d);
      api.vibra(30);
      piede.textContent = 'Inviato! ✔ Guarda lo schermo';
    }

    foglio.addEventListener('pointerdown', (e) => {
      if (!attiva() || dito !== null || memorizza()) return;
      const p = norm(e);
      if (v.tipo === 'punti') {
        if (tocchi.length < 5) {
          tocchi.push(p);
          api.vibra(12);
          if (tocchi.length === 5) invia({ p: tocchi });
          else piede.textContent = `Tocchi: ${tocchi.length}/5`;
        }
        return;
      }
      dito = e.pointerId;
      cattura(foglio, dito);
      if (v.tipo === 'cerchio') tratto = [p];
      else linea = [p[0], p[1], p[0], p[1]];
    });
    foglio.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dito) return;
      const evs = eventiFusi(e);
      for (const ev of evs) {
        const p = norm(ev);
        if (v.tipo === 'cerchio') {
          const u = tratto[tratto.length - 1];
          if (Math.hypot(p[0] - u[0], p[1] - u[1]) >= 5) tratto.push(p);
        } else if (linea) {
          linea[2] = p[0];
          linea[3] = p[1];
        }
      }
    });
    const su = (e) => {
      if (e.pointerId !== dito) return;
      dito = null;
      if (v.tipo === 'cerchio') {
        if (tratto.length < 15) {
          piede.textContent = 'Troppo corto! Riprova con un cerchio intero';
          tratto = [];
          return;
        }
        const passo = Math.max(1, Math.ceil(tratto.length / 250));
        invia({ c: tratto.filter((_, i) => i % passo === 0 || i === tratto.length - 1) });
      } else if (v.tipo === 'taglio' && linea) {
        if (Math.hypot(linea[2] - linea[0], linea[3] - linea[1]) < 80) {
          piede.textContent = 'Fai un colpo più lungo, da parte a parte!';
          linea = null;
          return;
        }
        invia({ t: linea });
      }
    };
    foglio.addEventListener('pointerup', su);
    foglio.addEventListener('pointercancel', su);

    function disegna() {
      const { g, w, h } = cv;
      const { L, ox, oy, k } = geo();
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#fdf8ec';
      g.beginPath();
      g.roundRect(ox, oy, L, L, 16);
      g.fill();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (v.fase !== 'prova') return;
      if (v.tipo === 'taglio' && v.forma) {
        g.beginPath();
        v.forma.forEach(([x, y], i) => (i ? g.lineTo(ox + x * k, oy + y * k) : g.moveTo(ox + x * k, oy + y * k)));
        g.closePath();
        g.fillStyle = '#cfc6e6';
        g.fill();
        g.strokeStyle = '#1b1030';
        g.lineWidth = 3;
        g.stroke();
        if (linea) {
          const [ax, ay, bx, by] = linea;
          const dx = bx - ax;
          const dy = by - ay;
          const d = Math.hypot(dx, dy) || 1;
          g.setLineDash([8, 8]);
          g.strokeStyle = 'rgba(0,0,0,0.3)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(ox + (ax - (dx / d) * 1500) * k, oy + (ay - (dy / d) * 1500) * k);
          g.lineTo(ox + (ax + (dx / d) * 1500) * k, oy + (ay + (dy / d) * 1500) * k);
          g.stroke();
          g.setLineDash([]);
          g.strokeStyle = col;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(ox + ax * k, oy + ay * k);
          g.lineTo(ox + bx * k, oy + by * k);
          g.stroke();
        }
      }
      if (v.tipo === 'cerchio' && tratto.length > 1) {
        g.strokeStyle = col;
        g.lineWidth = 6;
        g.beginPath();
        tratto.forEach(([x, y], i) => (i ? g.lineTo(ox + x * k, oy + y * k) : g.moveTo(ox + x * k, oy + y * k)));
        g.stroke();
      }
      if (v.tipo === 'punti') {
        if (memorizza() && v.punti) {
          for (const [x, y] of v.punti) {
            g.beginPath();
            g.arc(ox + x * k, oy + y * k, 12, 0, TAU);
            g.fillStyle = '#1b1030';
            g.fill();
          }
        }
        for (const [x, y] of tocchi) {
          g.strokeStyle = col;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(ox + x * k - 10, oy + y * k - 10);
          g.lineTo(ox + x * k + 10, oy + y * k + 10);
          g.moveTo(ox + x * k + 10, oy + y * k - 10);
          g.lineTo(ox + x * k - 10, oy + y * k + 10);
          g.stroke();
        }
      }
    }

    function loop() {
      disegna();
      if (v.fase === 'prova' && v.fine) {
        const resto = Math.max(0, (v.fine - api.ora()) / 1000);
        tempo.textContent = memorizza() ? `🧠 Memorizza! ${fmtNum((v.mostraFino - api.ora()) / 1000, 1)} s` : `⏱ ${Math.ceil(resto)} s`;
        if (!inviato && v.tipo === 'punti' && !memorizza() && !tocchi.length) piede.textContent = 'Ora tocca dove erano i 5 punti!';
      } else tempo.textContent = '';
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function aggiorna(nv) {
      v = nv || v;
      const k = `${v.prova}`;
      if (k !== chiave) {
        chiave = k;
        tratto = [];
        linea = null;
        tocchi = [];
        inviato = false;
      }
      titolo.textContent = `Prova ${v.prova + 1}/3 · ${v.titolo || ''}`;
      testo.textContent = v.testo || '';
      if (v.fase === 'annuncio') piede.textContent = 'Preparati…';
      else if (v.fase === 'prova' && !inviato) {
        piede.textContent = v.tipo === 'cerchio' ? 'Un solo tratto, poi stacca il dito' : v.tipo === 'taglio' ? 'Trascina il dito da parte a parte' : '';
      } else if (v.fase === 'rivela') piede.textContent = `Voto: ${fmtNum(v.voto || 0, 1)}% · Totale: ${fmtNum(v.totale || 0, 1)}`;
    }
    aggiorna(v);

    return {
      aggiorna,
      smonta() {
        cancelAnimationFrame(raf);
        cv.distruggi();
      },
    };
  },
};
