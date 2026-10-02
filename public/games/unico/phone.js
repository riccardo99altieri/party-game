// Il Più Alto Unico sul telefono: griglia di numeri segreta.

export default {
  id: 'unico',
  monta(el, api, s) {
    let v = null;
    let chiave = null;
    let timer = 0;

    function scelta() {
      el.innerHTML = `
        <div class="un">
          <div class="un-testa"><span class="un-round"></span><span class="un-tempo"></span></div>
          <div class="un-scelto">Scegli un numero! 🤫</div>
          <div class="un-griglia"></div>
          <div class="un-nota">Unico = punti · Doppione = zero · Il più alto unico: +5</div>
        </div>
        <style>
          .un { position:absolute; inset:0; display:flex; flex-direction:column; }
          .un-testa { flex:none; display:flex; justify-content:space-between; padding:10px 14px 0; font-size:18px; font-weight:700; }
          .un-tempo { color:#ffd23f; }
          .un-scelto { flex:none; text-align:center; font-size:24px; font-weight:700; padding:6px; }
          .un-griglia { flex:1; min-height:0; padding:4px 14px; align-content:center; }
          .un-griglia .gn-btn { font-size:clamp(20px, 6vw, 32px); padding:4px 0; aspect-ratio:1.25; }
          .un-nota { flex:none; text-align:center; font-size:14px; opacity:.8; padding:6px 10px calc(12px + env(safe-area-inset-bottom)); }
        </style>`;
      el.querySelector('.un-round').textContent = `Round ${v.round + 1}/${v.tot}`;
      const out = el.querySelector('.un-scelto');
      api.widgets.grigliaNumeri(el.querySelector('.un-griglia'), v.max, (n) => {
        api.invia({ n });
        out.textContent = `Hai scelto ${n} (puoi cambiare)`;
      });
      const tempo = el.querySelector('.un-tempo');
      clearInterval(timer);
      timer = setInterval(() => {
        tempo.textContent = `⏱ ${Math.max(0, Math.ceil((v.fine - api.ora()) / 1000))}`;
      }, 250);
    }

    function esito() {
      clearInterval(timer);
      const titoli = {
        unico: v.bonus ? `👑 ${v.numero} è il più alto unico!` : `✔ ${v.numero} è unico!`,
        doppio: `💥 ${v.numero}: qualcun altro l'ha scelto!`,
        nessuno: '😴 Non hai scelto in tempo',
      };
      el.innerHTML = `<div class="tel-msg" style="background:none"><div class="emoji-grande">${v.tipo === 'unico' ? (v.bonus ? '👑' : '🎉') : v.tipo === 'doppio' ? '💥' : '⏰'}</div>
        <h1>${titoli[v.tipo]}</h1><p style="font-size:26px;font-weight:700;color:#4cd97b">+${v.punti} punti</p><p>Totale: ${v.totale}</p></div>`;
      if (v.tipo === 'unico') api.vibra([40, 40, 40]);
    }

    function aggiorna(nv) {
      if (!nv) return;
      v = nv;
      const k = `${v.round}-${v.fase}`;
      if (k === chiave) return;
      chiave = k;
      if (v.fase === 'scelta') scelta();
      else esito();
    }
    aggiorna(s);

    return {
      aggiorna,
      smonta() {
        clearInterval(timer);
      },
    };
  },
};
