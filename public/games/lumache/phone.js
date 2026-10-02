// Corsa delle Lumache sul telefono: una grande manovella da far girare.

import { fmtNum } from '../../shared/util.js';

export default {
  id: 'lumache',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="lum">
        <div class="lum-testa">
          <div class="lum-pos">Gira! 🐌</div>
          <div class="lum-barra"><div></div></div>
        </div>
        <div class="lum-ruota"></div>
        <div class="lum-aiuto">Fai girare il dito in cerchio ↻</div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .lum { position:absolute; inset:0; display:flex; flex-direction:column; }
        .lum-testa { flex:none; padding:12px 16px 4px; text-align:center; }
        .lum-pos { font-size:26px; font-weight:700; }
        .lum-barra { height:16px; margin-top:8px; background:rgba(0,0,0,0.35); border-radius:8px; overflow:hidden; }
        .lum-barra div { height:100%; width:0; background:${api.io.colore}; border-radius:8px; transition:width .3s; }
        .lum-ruota { flex:1; position:relative; min-height:0; }
        .lum-aiuto { flex:none; text-align:center; padding:6px 0 calc(14px + env(safe-area-inset-bottom)); opacity:.7; }
      </style>`;
    const pos = el.querySelector('.lum-pos');
    const barra = el.querySelector('.lum-barra div');
    const msg = el.querySelector('.tel-msg');
    const ruota = api.widgets.manovella(el.querySelector('.lum-ruota'), (d) => api.invia({ g: d }), {
      colore: api.io.colore,
      onTacca: (k) => {
        if (k % 5 === 0) api.vibra(8);
      },
    });

    function aggiorna(v) {
      if (v && v.arrivato) {
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">🏁</div><h1>Traguardo!</h1><p>Sei arrivato ${v.pos}°${v.tempo ? ` in ${fmtNum(v.tempo, 1)} s` : ''}.<br>Guarda lo schermo!</p>`;
        api.vibra([40, 40, 80]);
      }
    }
    aggiorna(s);

    return {
      aggiorna,
      messaggio(d) {
        if (d.pos) pos.textContent = `${d.pos}° posto su ${d.tot} 🐌`;
        if (d.perc != null) barra.style.width = `${Math.round(d.perc * 100)}%`;
      },
      smonta() {
        ruota.distruggi();
      },
    };
  },
};
