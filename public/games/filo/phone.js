// Filo Scottante sul telefono: segui il percorso col dito senza uscire.

import { creaPercorso, LARGHEZZA, ALTEZZA, LIVELLI } from './percorso.js';
import { TAU, fmtNum } from '../../shared/util.js';

import { cattura, eventiFusi } from '../../phone/widgets.js';

export default {
  id: 'filo',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="filo">
        <div class="filo-hud"><span class="fh-liv"></span><span class="fh-zap"></span><span class="fh-tempo"></span></div>
        <div class="filo-campo"></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .filo { position:absolute; inset:0; display:flex; flex-direction:column; background:#150a30; }
        .filo-hud { flex:none; display:flex; justify-content:space-between; padding:8px 14px; font-size:20px; font-weight:700; }
        .filo-campo { flex:1; position:relative; min-height:0; }
      </style>`;
    const campo = el.querySelector('.filo-campo');
    const hudLiv = el.querySelector('.fh-liv');
    const hudZap = el.querySelector('.fh-zap');
    const hudTempo = el.querySelector('.fh-tempo');
    const msg = el.querySelector('.tel-msg');
    const col = api.io.colore;

    let v = s || {};
    let liv = 0;
    let perc = null;
    let idx = 0;
    let cp = 0;
    let stato = 'start'; // start | traccia | pausa | zap | livello | fatto
    let dito = null;
    let pos = null;
    let zaps = 0;
    let tZap = 0;
    let tLivello = 0;
    let ultimoInvio = 0;
    let fineMs = null;
    let raf = 0;

    const cv = api.widgets.canvasPieno(campo, () => {});
    const geo = () => {
      const k = Math.min(cv.w / LARGHEZZA, cv.h / ALTEZZA) * 0.98;
      return { k, ox: (cv.w - LARGHEZZA * k) / 2, oy: (cv.h - ALTEZZA * k) / 2 };
    };
    const checkpoint = () => [0, Math.floor(perc.punti.length / 3), Math.floor((perc.punti.length * 2) / 3)];

    function caricaLivello() {
      perc = creaPercorso(v.seme || 1, liv);
      campo.dataset.seme = v.seme || 1; // utile anche per le prove automatiche
      campo.dataset.livello = liv;
      idx = 0;
      cp = 0;
      stato = 'start';
    }
    caricaLivello();

    const iniziato = () => v.inizio != null && api.ora() >= v.inizio;
    const trascorso = () => (v.inizio != null ? Math.max(0, api.ora() - v.inizio) : 0);

    function progresso() {
      if (stato === 'fatto') return 1;
      // nella pausa tra un livello e l'altro liv è già avanzato ma idx è ancora in fondo al percorso vecchio
      if (stato === 'livello') return liv / LIVELLI.length;
      return (liv + idx / (perc.punti.length - 1)) / LIVELLI.length;
    }

    function invia(forza) {
      const now = performance.now();
      if (!forza && now - ultimoInvio < 200) return;
      ultimoInvio = now;
      api.invia({ p: progresso(), z: zaps, liv });
    }

    function norm(e) {
      const [x, y] = cv.punto(e);
      const { k, ox, oy } = geo();
      return [(x - ox) / k, (y - oy) / k];
    }

    function vicino(x, y, da, a) {
      let best = -1;
      let bd = Infinity;
      const P = perc.punti;
      for (let i = Math.max(0, da); i <= Math.min(P.length - 1, a); i++) {
        const d = Math.hypot(P[i][0] - x, P[i][1] - y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return [best, bd];
    }

    function zap() {
      stato = 'zap';
      tZap = performance.now();
      zaps++;
      dito = null;
      api.vibra(220);
      invia(true);
      setTimeout(() => {
        if (stato === 'zap') {
          stato = 'start';
          idx = cp;
        }
      }, 700);
    }

    function livelloFatto() {
      liv++;
      api.vibra([30, 30, 60]);
      if (liv >= LIVELLI.length) {
        stato = 'fatto';
        fineMs = trascorso();
        api.invia({ fatto: fineMs, z: zaps, p: 1 });
        aggiorna(null);
        return;
      }
      stato = 'livello';
      tLivello = performance.now();
      dito = null;
      invia(true);
      setTimeout(() => {
        caricaLivello();
        invia(true);
      }, 900);
    }

    campo.addEventListener('pointerdown', (e) => {
      if (dito !== null || !iniziato()) return;
      if (stato !== 'start' && stato !== 'pausa') return;
      const [x, y] = norm(e);
      const rif = stato === 'start' ? perc.punti[cp] : perc.punti[idx];
      if (Math.hypot(x - rif[0], y - rif[1]) > perc.semi * 1.5) return;
      dito = e.pointerId;
      cattura(campo, e.pointerId);
      if (stato === 'start') idx = cp;
      stato = 'traccia';
      pos = [x, y];
    });
    campo.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dito || stato !== 'traccia') return;
      const evs = eventiFusi(e);
      for (const ev of evs) {
        const [x, y] = norm(ev);
        pos = [x, y];
        const [i, d] = vicino(x, y, idx - 20, idx + 60);
        if (d > perc.semi) return zap();
        if (i > idx) idx = i;
        const cps = checkpoint();
        for (const c of cps) if (idx >= c && c > cp) cp = c;
        if (idx >= perc.punti.length - 3) return livelloFatto();
      }
      invia(false);
    });
    const su = (e) => {
      if (e.pointerId !== dito) return;
      dito = null;
      if (stato === 'traccia') stato = 'pausa';
    };
    campo.addEventListener('pointerup', su);
    campo.addEventListener('pointercancel', su);

    function linea(g, P, da, a, k, ox, oy) {
      g.beginPath();
      for (let i = da; i <= a; i++) {
        const x = ox + P[i][0] * k;
        const y = oy + P[i][1] * k;
        if (i === da) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    function disegna(ms) {
      const { g, w, h } = cv;
      const { k, ox, oy } = geo();
      const P = perc.punti;
      g.clearRect(0, 0, w, h);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const larg = perc.semi * 2 * k;
      // bordo elettrico
      g.strokeStyle = `rgba(92,225,255,${0.55 + Math.sin(ms / 90) * 0.15})`;
      g.lineWidth = larg + 8;
      linea(g, P, 0, P.length - 1, k, ox, oy);
      g.strokeStyle = '#241150';
      g.lineWidth = larg;
      linea(g, P, 0, P.length - 1, k, ox, oy);
      // guida centrale
      g.setLineDash([4, 10]);
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 2;
      linea(g, P, 0, P.length - 1, k, ox, oy);
      g.setLineDash([]);
      // strada fatta
      if (idx > 0) {
        g.strokeStyle = col;
        g.globalAlpha = 0.75;
        g.lineWidth = larg * 0.45;
        linea(g, P, 0, idx, k, ox, oy);
        g.globalAlpha = 1;
      }
      // checkpoint
      for (const c of checkpoint().slice(1)) {
        const [x, y] = P[c];
        g.beginPath();
        g.arc(ox + x * k, oy + y * k, 7, 0, TAU);
        g.fillStyle = c <= cp ? '#4cd97b' : 'rgba(255,255,255,0.4)';
        g.fill();
      }
      // traguardo
      const [fx, fy] = P[P.length - 1];
      g.font = `${Math.max(22, larg * 0.9)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🏁', ox + fx * k, oy + fy * k - larg * 0.2);
      // punto da toccare
      if ((stato === 'start' || stato === 'pausa') && iniziato()) {
        const [x, y] = stato === 'start' ? P[cp] : P[idx];
        const pul = 1 + Math.sin(ms / 150) * 0.15;
        g.beginPath();
        g.arc(ox + x * k, oy + y * k, perc.semi * 1.2 * k * pul, 0, TAU);
        g.fillStyle = 'rgba(255,210,63,0.35)';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#ffd23f';
        g.stroke();
        g.fillStyle = '#fff';
        g.font = '700 16px Fredoka, sans-serif';
        g.fillText(stato === 'start' ? 'Tocca qui' : 'Riprendi qui', ox + x * k, oy + y * k + perc.semi * 1.2 * k + 18);
      }
      // dito
      if (stato === 'traccia' && pos) {
        g.beginPath();
        g.arc(ox + pos[0] * k, oy + pos[1] * k, 10, 0, TAU);
        g.fillStyle = '#fff';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = col;
        g.stroke();
      }
      // scossa!
      const dz = ms - tZap;
      if (dz < 600) {
        g.fillStyle = `rgba(255,60,90,${0.5 * (1 - dz / 600)})`;
        g.fillRect(0, 0, w, h);
        if (pos) {
          g.strokeStyle = '#fff';
          g.lineWidth = 3;
          for (let i = 0; i < 5; i++) {
            let x = ox + pos[0] * k;
            let y = oy + pos[1] * k;
            g.beginPath();
            g.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
              x += (Math.random() - 0.5) * 50;
              y += (Math.random() - 0.5) * 50;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        }
        g.fillStyle = '#fff';
        g.font = '700 42px Fredoka, sans-serif';
        g.fillText('⚡ ZAP! ⚡', w / 2, h / 2);
      }
      if (stato === 'livello') {
        g.fillStyle = 'rgba(20,10,45,0.6)';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#4cd97b';
        g.font = '700 36px Fredoka, sans-serif';
        g.fillText(`Livello ${liv + 1}! ⚡`, w / 2, h / 2);
      }
      if (!iniziato()) {
        g.fillStyle = 'rgba(20,10,45,0.55)';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff';
        g.font = '700 30px Fredoka, sans-serif';
        g.fillText('Preparati…', w / 2, h / 2);
      }
    }

    function loop(ms) {
      disegna(ms);
      hudLiv.textContent = `Livello ${Math.min(liv + 1, LIVELLI.length)}/${LIVELLI.length}`;
      hudZap.textContent = `⚡ ${zaps}`;
      const tt = fineMs != null ? fineMs : trascorso();
      hudTempo.textContent = `⏱ ${fmtNum(tt / 1000, 1)} s`;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function aggiorna(nv) {
      const semeCambiato = nv && v.seme !== nv.seme;
      v = nv || v;
      if (semeCambiato) {
        liv = 0;
        caricaLivello();
      }
      if (v.finito && stato !== 'fatto') {
        msg.hidden = false;
        msg.innerHTML = '<div class="emoji-grande">⏰</div><h1>Tempo scaduto!</h1><p>Guarda lo schermo.</p>';
      }
      if (stato === 'fatto') {
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">🏆</div><h1>Ce l'hai fatta!</h1><p>${fmtNum(fineMs / 1000, 1)} s · ${zaps} ${zaps === 1 ? 'scossa' : 'scosse'}</p>`;
      }
    }
    aggiorna(v);

    return {
      aggiorna,
      messaggio(d) {
        if (d.fatto) aggiorna(null);
      },
      smonta() {
        cancelAnimationFrame(raf);
        cv.distruggi();
      },
    };
  },
};
