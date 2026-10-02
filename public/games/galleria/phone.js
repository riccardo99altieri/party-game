// Galleria d'Arte sul telefono: lavagna per disegnare, poi griglia per votare.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default {
  id: 'galleria',
  monta(el, api, s) {
    let v = null;
    let fase = null;
    let lav = null;
    let finito = false;
    let votato = null;
    let timer = 0;

    function pulisci() {
      if (lav) lav.distruggi();
      lav = null;
      clearInterval(timer);
    }

    function orologio(sel) {
      clearInterval(timer);
      const out = el.querySelector(sel);
      const f = () => {
        if (!v || !v.fine || !out) return;
        out.textContent = `⏱ ${Math.max(0, Math.ceil((v.fine - api.ora()) / 1000))}`;
      };
      f();
      timer = setInterval(f, 250);
    }

    function mostraTema() {
      pulisci();
      el.innerHTML = `<div class="tel-msg" style="background:none"><div class="emoji-grande">🎨</div><p>Il tema è…</p><h1>“${esc(v.tema)}”</h1><p>Preparati a disegnare!</p></div>`;
    }

    function mostraDisegno() {
      pulisci();
      finito = false;
      el.innerHTML = `
        <div class="gal">
          <div class="gal-testa"><div class="gal-tema">“${esc(v.tema)}”</div><div class="gal-tempo"></div><button class="gal-fine">Ho finito ✔</button></div>
          <div class="gal-lav"></div>
        </div>
        <style>
          .gal { position:absolute; inset:0; display:flex; flex-direction:column; }
          .gal-testa { flex:none; display:flex; align-items:center; gap:8px; padding:6px 10px; }
          .gal-tema { flex:1; font-size:17px; font-weight:700; line-height:1.1; }
          .gal-tempo { font-size:18px; font-weight:700; color:#ffd23f; }
          .gal-fine { font-family:inherit; font-size:15px; font-weight:700; padding:8px 10px; border-radius:12px; border:3px solid #1b1030; background:#4cd97b; color:#1b1030; }
          .gal-fine.on { background:#fff; }
          .gal-lav { flex:1; min-height:0; }
        </style>`;
      lav = api.widgets.lavagna(el.querySelector('.gal-lav'), { onEvento: (d) => api.invia(d) });
      const b = el.querySelector('.gal-fine');
      b.onclick = () => {
        finito = !finito;
        api.invia({ finito });
        lav.blocca(finito);
        b.classList.toggle('on', finito);
        b.textContent = finito ? '✏️ Modifica' : 'Ho finito ✔';
        api.vibra(20);
      };
      orologio('.gal-tempo');
    }

    function mostraVoto() {
      pulisci();
      votato = null;
      el.innerHTML = `
        <div class="gal-voto">
          <div class="gv-testa"><b>Vota il disegno più bello!</b><span class="gv-tempo"></span></div>
          <div class="gv-griglia scorre">${(v.opere || [])
            .map((o) => `<button data-id="${esc(o.id)}"><img src="${o.img}" alt=""><span>n° ${o.n}</span></button>`)
            .join('')}</div>
          <div class="gv-nota">Tocca un disegno per votarlo (puoi cambiare idea)</div>
        </div>
        <style>
          .gal-voto { position:absolute; inset:0; display:flex; flex-direction:column; }
          .gv-testa { flex:none; display:flex; justify-content:space-between; align-items:center; padding:10px 14px; font-size:19px; }
          .gv-tempo { color:#ffd23f; font-weight:700; }
          .gv-griglia { flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; padding:4px 12px 12px; align-content:start; touch-action:pan-y; }
          .gv-griglia button { position:relative; padding:0; border:5px solid transparent; border-radius:16px; background:#fff; overflow:hidden; }
          .gv-griglia img { display:block; width:100%; aspect-ratio:1; }
          .gv-griglia span { position:absolute; left:6px; top:6px; background:#1b1030; color:#fff; font-weight:700; padding:2px 8px; border-radius:10px; font-size:14px; }
          .gv-griglia button.on { border-color:#ffd23f; box-shadow:0 0 0 4px #1b1030; }
          .gv-griglia button.on::after { content:'⭐'; position:absolute; right:6px; top:4px; font-size:28px; }
          .gv-nota { flex:none; text-align:center; padding:6px 10px calc(12px + env(safe-area-inset-bottom)); opacity:.8; }
        </style>`;
      el.querySelector('.gv-griglia').onclick = (e) => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        votato = b.dataset.id;
        for (const x of el.querySelectorAll('.gv-griglia button')) x.classList.toggle('on', x === b);
        api.invia({ voto: votato });
        api.vibra(20);
      };
      orologio('.gv-tempo');
    }

    function mostraEsito() {
      pulisci();
      const n = v.voti || 0;
      el.innerHTML = `<div class="tel-msg" style="background:none"><div class="emoji-grande">${n ? '⭐' : '🖼️'}</div><h1>${n === 1 ? 'Hai ricevuto 1 voto!' : `Hai ricevuto ${n} voti!`}</h1><p>Guarda la galleria sullo schermo grande.</p></div>`;
    }

    function aggiorna(nv) {
      if (!nv) return;
      v = nv;
      if (v.fase === fase && fase !== 'voto') return;
      if (v.fase === fase && fase === 'voto') return;
      fase = v.fase;
      if (fase === 'tema') mostraTema();
      else if (fase === 'disegno') mostraDisegno();
      else if (fase === 'voto') mostraVoto();
      else if (fase === 'esito') mostraEsito();
    }
    aggiorna(s);

    return {
      aggiorna,
      smonta: pulisci,
    };
  },
};
