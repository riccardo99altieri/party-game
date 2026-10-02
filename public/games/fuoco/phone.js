// Mezzogiorno di Fuoco sul telefono: un pulsante enorme. Si guarda lo schermo grande!

import { fmtNum } from '../../shared/util.js';

export default {
  id: 'fuoco',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="fu">
        <div class="fu-testa"><div class="fu-round"></div><div class="fu-stato">Guarda lo schermo grande! 👀</div></div>
        <div class="fu-btn"></div>
      </div>
      <style>
        .fu { position:absolute; inset:0; display:flex; flex-direction:column; }
        .fu-testa { flex:none; text-align:center; padding:12px 14px 6px; }
        .fu-round { font-size:18px; opacity:.85; }
        .fu-stato { font-size:24px; font-weight:700; min-height:60px; }
        .fu-btn { flex:1; padding:10px 18px calc(22px + env(safe-area-inset-bottom)); min-height:0; }
        .fu-btn .pad-btn { font-size:54px; border-radius:40px; }
      </style>`;
    const round = el.querySelector('.fu-round');
    const stato = el.querySelector('.fu-stato');
    let v = s || {};
    let sparato = false;
    let chiave = null;

    const btn = api.widgets.pulsante(el.querySelector('.fu-btn'), {
      testo: '🔫<br>BANG!',
      colore: '#f97316',
      onPremi: () => {
        if (sparato || v.fase === 'esito') return;
        sparato = true;
        api.invia({ sparo: api.ora() });
        api.vibra(40);
        btn.disabled = true;
        stato.textContent = 'Sparato! 💨';
      },
    });

    function aggiorna(nv) {
      v = nv || v;
      round.textContent = v.round != null ? `Round ${v.round + 1} di ${v.tot}` : '';
      const k = `${v.round}`;
      if (k !== chiave) {
        chiave = k;
        sparato = false;
        btn.disabled = false;
        stato.textContent = 'Guarda lo schermo grande! 👀 Spara al FUOCO!';
      }
      if (v.fase === 'esito') btn.disabled = true;
    }
    aggiorna(v);

    return {
      aggiorna,
      messaggio(d) {
        if (d.presto) {
          stato.textContent = '💥 Troppo presto! Penalità';
          api.vibra([100, 50, 100]);
        } else if (d.lento) stato.textContent = '🐢 Troppo lento!';
        else if (d.ms != null) stato.textContent = `⚡ ${fmtNum(d.ms / 1000, 3)} secondi!`;
      },
      smonta() {},
    };
  },
};
