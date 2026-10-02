// Colore Perfetto sul telefono: selettore colore + conferma.

import { rgbToHex, fmtNum } from '../../shared/util.js';

export default {
  id: 'colore',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="col">
        <div class="col-testa"><span class="col-titolo"></span><span class="col-tempo"></span></div>
        <div class="col-anteprima"><div class="col-mio"></div><div class="col-info"></div></div>
        <div class="col-ruota"></div>
        <div class="col-piede"><button class="btn-tel grande col-ok">Conferma ✔</button></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .col { position:absolute; inset:0; display:flex; flex-direction:column; }
        .col-testa { flex:none; display:flex; justify-content:space-between; padding:8px 14px 0; font-size:19px; font-weight:700; }
        .col-tempo { color:#ffd23f; }
        .col-anteprima { flex:none; display:flex; align-items:center; gap:12px; padding:8px 14px; }
        .col-mio { width:64px; height:64px; border-radius:50%; border:4px solid #1b1030; box-shadow:0 0 0 3px #fff; }
        .col-info { flex:1; font-size:17px; }
        .col-ruota { flex:1; position:relative; min-height:0; }
        .col-piede { flex:none; padding:8px 14px calc(12px + env(safe-area-inset-bottom)); }
      </style>`;
    const titolo = el.querySelector('.col-titolo');
    const tempo = el.querySelector('.col-tempo');
    const mio = el.querySelector('.col-mio');
    const info = el.querySelector('.col-info');
    const ok = el.querySelector('.col-ok');
    const msg = el.querySelector('.tel-msg');

    let v = s || {};
    let round = -1;
    let confermato = false;
    let ultimoInvio = 0;
    let rgb = [128, 128, 128];

    const ruota = api.widgets.selettoreColore(el.querySelector('.col-ruota'), (c) => {
      rgb = c;
      mio.style.background = rgbToHex(c);
      const now = performance.now();
      if (now - ultimoInvio > 150) {
        ultimoInvio = now;
        api.invia({ c: rgb.map(Math.round) });
      }
    });

    ok.onclick = () => {
      if (v.fase !== 'scelta' || confermato) return;
      confermato = true;
      api.invia({ c: rgb.map(Math.round), ok: 1 });
      api.vibra(30);
      aggiorna(null);
    };

    const timer = setInterval(() => {
      if (v.fase === 'scelta' && v.fine) tempo.textContent = `⏱ ${Math.max(0, Math.ceil((v.fine - api.ora()) / 1000))}`;
      else tempo.textContent = '';
    }, 250);

    function aggiorna(nv) {
      if (nv) v = nv;
      if (v.round !== round) {
        round = v.round;
        confermato = false;
        const h = Math.random() * 360;
        ruota.imposta(h, 0.5, 0.75);
        rgb = [0, 0, 0];
      }
      titolo.textContent = `Round ${v.round + 1}/${v.tot} · ${v.titolo || ''}`;
      const puo = v.fase === 'scelta' && !confermato;
      ruota.blocca(!puo);
      ok.disabled = !puo;
      msg.hidden = true;
      if (v.fase === 'annuncio' || v.fase === 'mostra') {
        info.textContent = v.fase === 'mostra' ? '👀 Guarda il colore sullo schermo!' : v.sotto || '';
        mio.style.background = '#888';
      } else if (v.fase === 'scelta') {
        info.textContent = confermato ? 'Confermato! ✔ Aspetta gli altri' : 'Ricrea il colore e conferma';
        if (!confermato && rgb[0] + rgb[1] + rgb[2] === 0) {
          // anteprima iniziale del selettore
          rgb = ruota.rgb();
          mio.style.background = rgbToHex(rgb);
        }
        ok.textContent = confermato ? 'Confermato ✔' : 'Conferma ✔';
      } else if (v.fase === 'rivela') {
        msg.hidden = false;
        const a = v.mio ? rgbToHex(v.mio) : '#888';
        const b = rgbToHex(v.vero || [0, 0, 0]);
        msg.innerHTML = `
          <div style="display:flex;gap:14px;align-items:center">
            <div style="text-align:center"><div style="width:90px;height:90px;border-radius:50%;background:${a};border:4px solid #fff"></div>Il tuo</div>
            <div style="text-align:center"><div style="width:90px;height:90px;border-radius:50%;background:${b};border:4px solid #fff"></div>Quello vero</div>
          </div>
          <h1>${fmtNum(v.punti || 0, 1)}%</h1><p>Totale: ${fmtNum(v.totale || 0, 1)}</p>`;
      }
    }
    aggiorna(v);

    return {
      aggiorna,
      smonta() {
        clearInterval(timer);
        ruota.distruggi();
      },
    };
  },
};
