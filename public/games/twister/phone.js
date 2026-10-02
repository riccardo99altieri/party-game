// Twister delle Dita sul telefono: tieni un dito su ogni cerchio, senza staccarlo.

import { TAU, fmtNum } from '../../shared/util.js';
import { BERSAGLI, appare, scadenza, INIZIO_MOVIMENTO, DURATA, creaCerchi, posizioneCerchio, raggioCerchio } from './regole.js';

const COLORI = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7'];

export default {
  id: 'twister',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="tw">
        <div class="tel-stato"></div>
        <div class="tw-campo"></div>
        <div class="tw-avviso"><div class="emoji-grande">✋</div><h1>Una mano sola!</h1><p>Metti l'altra mano dietro la schiena<br>e appoggia il telefono sul tavolo 📱</p></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .tw { position:absolute; inset:0; }
        .tw-campo { position:absolute; inset:0; touch-action:none; }
        .tw-avviso { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; text-align:center; padding:20px; pointer-events:none; }
        .tw-avviso h1 { margin:0; font-size:34px; color:var(--giallo); }
        .tw-avviso p { margin:0; font-size:20px; }
      </style>`;
    const campo = el.querySelector('.tw-campo');
    const stato = el.querySelector('.tel-stato');
    const msg = el.querySelector('.tel-msg');
    const avviso = el.querySelector('.tw-avviso');

    let v = s || {};
    let bersagli = [];
    let fuori = null;
    let salvo = false;
    let ultimeDita = -1;
    let raf = 0;
    const dita = new Map(); // pointerId -> [x, y]

    const cv = api.widgets.canvasPieno(campo, () => {});

    function prepara() {
      bersagli = creaCerchi(v.seme).map((c) => ({ ...c, dito: null }));
    }
    prepara();

    const tempo = () => (v.inizio != null ? (api.ora() - v.inizio) / 1000 : -1);
    const raggio = () => raggioCerchio(cv.w, cv.h);
    const posizione = (i, t) => posizioneCerchio(bersagli[i], t, cv.w, cv.h, raggio());

    function eliminato(motivo) {
      if (fuori || salvo) return;
      fuori = { motivo, t: Math.max(0, tempo()) };
      api.invia({ fuori: motivo, t: fuori.t });
      api.vibra([200, 80, 200]);
      const testi = { tardi: 'Non hai toccato il cerchio in tempo!', staccato: 'Hai staccato un dito!', scivolato: 'Il dito è scivolato fuori dal cerchio!' };
      msg.hidden = false;
      msg.innerHTML = `<div class="emoji-grande">🙈</div><h1>Fuori!</h1><p>${testi[motivo]}<br>Hai resistito ${fmtNum(fuori.t, 1)} secondi.</p>`;
    }

    campo.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const t = tempo();
      const [x, y] = cv.punto(e);
      dita.set(e.pointerId, [x, y]);
      if (fuori || salvo || t < 0) return;
      const r = raggio();
      for (let i = 0; i < BERSAGLI; i++) {
        const q = bersagli[i];
        if (q.dito != null || t < appare(i)) continue;
        const [bx, by] = posizione(i, t);
        if (Math.hypot(x - bx, y - by) <= r * 1.2) {
          q.dito = e.pointerId;
          api.vibra(25);
          break;
        }
      }
    });
    campo.addEventListener('pointermove', (e) => {
      if (dita.has(e.pointerId)) dita.set(e.pointerId, cv.punto(e));
    });
    const su = (e) => {
      dita.delete(e.pointerId);
      if (bersagli.some((q) => q.dito === e.pointerId)) eliminato('staccato');
    };
    campo.addEventListener('pointerup', su);
    campo.addEventListener('pointercancel', su);

    function controlla(t) {
      if (fuori || salvo || t < 0) return;
      const r = raggio();
      let n = 0;
      for (let i = 0; i < BERSAGLI; i++) {
        const q = bersagli[i];
        if (t < appare(i)) continue;
        if (q.dito == null) {
          if (t > scadenza(i)) return eliminato('tardi');
          continue;
        }
        n++;
        const p = dita.get(q.dito);
        const [bx, by] = posizione(i, t);
        if (p && Math.hypot(p[0] - bx, p[1] - by) > r * 1.45) return eliminato('scivolato');
      }
      if (n !== ultimeDita) {
        ultimeDita = n;
        api.invia({ dita: n });
      }
      if (t >= DURATA) {
        salvo = true;
        api.invia({ salvo: true });
        api.vibra([60, 60, 60]);
        msg.hidden = false;
        msg.innerHTML = '<div class="emoji-grande">🏆</div><h1>Hai resistito!</h1><p>60 secondi senza staccare le dita. Grande!</p>';
      }
    }

    function disegna(t) {
      const { g, w, h } = cv;
      g.clearRect(0, 0, w, h);
      const r = raggio();
      for (let i = 0; i < BERSAGLI; i++) {
        if (t < appare(i)) continue;
        const q = bersagli[i];
        const [x, y] = posizione(i, t);
        const preso = q.dito != null;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fillStyle = COLORI[i];
        g.globalAlpha = preso ? 1 : 0.85;
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = 6;
        g.strokeStyle = preso ? '#fff' : '#1b1030';
        g.stroke();
        if (!preso) {
          const resto = Math.max(0, scadenza(i) - t);
          g.beginPath();
          g.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (resto / 3));
          g.strokeStyle = '#fff';
          g.lineWidth = 6;
          g.stroke();
          const pul = 1 + Math.sin(t * 12) * 0.08;
          g.fillStyle = '#fff';
          g.font = `700 ${Math.round(r * 0.8 * pul)}px Fredoka, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('👆', x, y);
        } else {
          g.fillStyle = '#fff';
          g.font = `700 ${Math.round(r * 0.8)}px Fredoka, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(i + 1), x, y + 2);
        }
      }
    }

    function loop() {
      const t = tempo();
      controlla(t);
      disegna(t);
      avviso.hidden = !(t < appare(0)) || !!fuori;
      if (t < 0) stato.textContent = '';
      else if (!fuori && !salvo) {
        const prossimo = [...Array(BERSAGLI).keys()].find((i) => t < appare(i));
        stato.textContent =
          t >= INIZIO_MOVIMENTO ? `😱 Si muovono! Resisti: ${Math.max(0, Math.ceil(DURATA - t))} s` : prossimo != null ? `✋ Dita: ${ultimeDita < 0 ? 0 : ultimeDita} · arriva il prossimo cerchio!` : 'Tieni tutte le dita giù!';
      } else stato.textContent = '';
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function aggiorna(nv) {
      const nuovo = nv && nv.seme !== v.seme;
      v = nv || v;
      if (nuovo) prepara();
      // utili anche per le prove automatiche
      campo.dataset.seme = v.seme || 1;
      if (v.inizio != null) campo.dataset.inizio = v.inizio;
    }
    aggiorna(null);

    return {
      aggiorna,
      smonta() {
        cancelAnimationFrame(raf);
        cv.distruggi();
      },
    };
  },
};
