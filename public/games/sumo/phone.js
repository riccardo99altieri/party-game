// Sumo Glaciale sul telefono: joystick a sinistra, PUGNO a destra.

export default {
  id: 'sumo',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="sumo">
        <div class="sumo-stato">Resta sul ghiaccio! 🧊</div>
        <div class="sumo-pad">
          <div class="sumo-joy"></div>
          <div class="sumo-btn"></div>
        </div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .sumo { position:absolute; inset:0; display:flex; flex-direction:column; }
        .sumo-stato { flex:none; padding:14px; text-align:center; font-size:22px; font-weight:700; transition:color .2s; }
        .sumo-stato.bum { color:var(--giallo); }
        .sumo-pad { flex:1; display:flex; gap:10px; padding:0 12px calc(16px + env(safe-area-inset-bottom)); min-height:0; }
        .sumo-joy { flex:1.4; border-radius:28px; background:rgba(255,255,255,0.06); border:3px dashed rgba(255,255,255,0.2); }
        .sumo-btn { flex:1; display:flex; align-items:center; }
        .sumo-btn .pad-btn { width:100%; height:auto; aspect-ratio:1; max-height:100%; border-radius:50%; font-size:26px; line-height:1.15; position:relative; overflow:hidden; }
        .sumo-btn .pad-btn .cd { position:absolute; inset:0; background:rgba(20,10,45,0.6); transform-origin:bottom; transform:scaleY(0); }
      </style>`;
    const stato = el.querySelector('.sumo-stato');
    const msg = el.querySelector('.tel-msg');
    const joy = api.widgets.joystick(el.querySelector('.sumo-joy'), (x, y) => api.invia({ j: [x, y] }), { testo: 'Muoviti qui' });
    el.querySelector('.sumo-joy').style.setProperty('--c', api.io.colore);
    let cdFine = 0;
    let cdDurata = 1;
    let rimasti = 0;
    let tAvviso = 0;
    const btn = api.widgets.pulsante(el.querySelector('.sumo-btn'), {
      testo: '<span style="font-size:48px">🥊</span><br>PUGNO!<div class="cd"></div>',
      colore: '#ff4d8d',
      onPremi: () => {
        const now = performance.now();
        if (now < cdFine) return;
        cdFine = now + cdDurata * 1000;
        api.invia({ s: 1 });
        api.vibra(25);
      },
    });
    const cd = btn.querySelector('.cd');
    let raf = requestAnimationFrame(function f() {
      const k = Math.max(0, cdFine - performance.now()) / (cdDurata * 1000);
      cd.style.transform = `scaleY(${k})`;
      raf = requestAnimationFrame(f);
    });

    function scriviStato() {
      stato.classList.remove('bum');
      stato.textContent = rimasti ? `Resta sul ghiaccio! 🧊 In piedi: ${rimasti}` : 'Resta sul ghiaccio! 🧊';
    }

    function avviso(testo) {
      stato.textContent = testo;
      stato.classList.add('bum');
      clearTimeout(tAvviso);
      tAvviso = setTimeout(scriviStato, 900);
    }

    function aggiorna(v) {
      if (!v) return;
      if (v.cd) cdDurata = v.cd;
      if (v.vivo === false) {
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">💦</div><h1>SPLASH!</h1><p>Sei finito in acqua${v.pos ? ` · ${v.pos}° posto` : ''}.<br>Guarda lo schermo e fai il tifo!</p>`;
      } else {
        msg.hidden = true;
        rimasti = v.rimasti || 0;
        scriviStato();
      }
    }
    aggiorna(s);

    return {
      aggiorna,
      messaggio(d) {
        if (d.colpo) {
          api.vibra(Math.round(30 + d.colpo * 60));
          if (d.colpo >= 1) avviso('😵 Ti hanno colpito!');
        }
        if (d.preso) avviso(d.preso > 1 ? `💥 Colpo doppio!` : '💥 Preso!');
      },
      smonta() {
        cancelAnimationFrame(raf);
        clearTimeout(tAvviso);
        joy.distruggi();
      },
    };
  },
};
