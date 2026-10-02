// Trova l'Intruso sul telefono: la mini-mappa privata (solo tu, in verde, più monete e
// acqua alta: gli altri giocatori qui non esistono), il D-pad a 8 direzioni e PUGNO.

import { MAPPA, LARGA, ALTA, FONTANA, GIOSTRA, BANCHI, VICOLO, PALCO, LAMPIONI } from './regole.js';

const TAU = Math.PI * 2;

export default {
  id: 'intruso',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="itr">
        <div class="itr-testa"><span class="itr-round">Round 1/3</span><span class="itr-tempo">⏱ 90</span><span class="itr-punti">⭐ 0</span></div>
        <div class="itr-mappa"></div>
        <div class="itr-stato">🎭 Cammina come i passanti</div>
        <div class="itr-pad">
          <div class="itr-joy"></div>
          <div class="itr-btn"></div>
        </div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .itr { position:absolute; inset:0; display:flex; flex-direction:column; transition:box-shadow .15s; }
        .itr.rosso { box-shadow:inset 0 0 0 6px #ff3355, inset 0 0 60px rgba(255,40,70,0.55); }
        .itr.acqua { box-shadow:inset 0 0 0 5px #3ec6ff, inset 0 0 50px rgba(62,198,255,0.45); }
        .itr-testa { display:flex; justify-content:space-between; padding:8px 14px 4px; font-size:19px; font-weight:700; }
        .itr-mappa { flex:none; align-self:center; width:min(calc(100% - 20px), calc(38vh * ${LARGA} / ${ALTA})); aspect-ratio:${LARGA} / ${ALTA}; border-radius:14px; overflow:hidden; position:relative; box-shadow:0 0 0 3px rgba(255,255,255,0.15); }
        .itr-stato { flex:none; padding:6px 10px; text-align:center; font-size:20px; font-weight:700; min-height:54px; display:flex; align-items:center; justify-content:center; transition:color .2s, transform .2s; }
        .itr-stato.male { color:#ff8fb3; transform:scale(1.06); }
        .itr-stato.bene { color:var(--verde); transform:scale(1.06); }
        .itr-stato.oro { color:#ffd23f; transform:scale(1.08); }
        .itr-stato.blu { color:#9fe0ff; transform:scale(1.06); }
        .itr-pad { flex:1; display:flex; gap:10px; padding:0 12px calc(14px + env(safe-area-inset-bottom)); min-height:0; }
        .itr-joy { flex:1.4; border-radius:28px; background:rgba(255,255,255,0.06); border:3px dashed rgba(255,255,255,0.2); }
        .itr-btn { flex:1; display:flex; align-items:center; }
        .itr-btn .pad-btn { width:100%; height:auto; aspect-ratio:1; max-height:100%; border-radius:50%; font-size:24px; line-height:1.15; position:relative; overflow:hidden; }
        .itr-btn .pad-btn .cd { position:absolute; inset:0; background:rgba(20,10,45,0.65); transform-origin:bottom; transform:scaleY(0); }
        .itr-btn .pad-btn .fermo { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(160,20,45,0.8); font-size:22px; }
        .itr-btn .pad-btn.bloccato .fermo { display:flex; }
        .itr .tel-msg .righe { font-size:18px; line-height:1.5; opacity:0.95; }
      </style>`;
    const radice = el.querySelector('.itr');
    const tRound = el.querySelector('.itr-round');
    const tTempo = el.querySelector('.itr-tempo');
    const tPunti = el.querySelector('.itr-punti');
    const stato = el.querySelector('.itr-stato');
    const msg = el.querySelector('.tel-msg');
    const zona = el.querySelector('.itr-joy');
    zona.style.setProperty('--c', api.io.colore);
    const joy = api.widgets.joystick(zona, (x, y) => api.invia({ j: [x, y] }), { testo: 'Muoviti qui (8 direzioni)', otto: true });

    let v = s || {};
    let pos = { x: v.x || 960, y: v.y || 600 };
    let prima = { ...pos };
    let tPos = performance.now();
    let zonaV = v.zona || [960, 600, 5000, 0];
    let monete = v.monete || [];
    let resta = v.resta ?? 90;
    let tResta = performance.now();
    let acqua = 0;
    let cdFine = 0;
    let bloccoFine = 0;
    let avvisoFino = 0;
    let tVuoto = 0;

    const btn = api.widgets.pulsante(el.querySelector('.itr-btn'), {
      testo: '<span style="font-size:46px">👊</span><br>PUGNO<div class="cd"></div><div class="fermo">😱 Fermo!</div>',
      colore: '#ff4d6d',
      onPremi: () => {
        const now = performance.now();
        if (now < cdFine || now < bloccoFine || v.fase !== 'gioco' || !v.vivo) return;
        api.invia({ p: 1 });
        api.vibra(20);
      },
    });
    const cd = btn.querySelector('.cd');

    // ---- mini-mappa
    const tela = api.widgets.canvasPieno(el.querySelector('.itr-mappa'), () => {});

    function disegna(now) {
      const { g, w, h } = tela;
      const k = w / LARGA;
      const X = (x) => (x - MAPPA.x0) * k;
      const Y = (y) => (y - MAPPA.y0) * k;
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#d9c49b';
      g.fillRect(0, 0, w, h);
      // posti della piazza
      g.fillStyle = '#5ec8f0';
      g.beginPath();
      g.arc(X(FONTANA.x), Y(FONTANA.y), FONTANA.r * k, 0, TAU);
      g.fill();
      g.fillStyle = '#ef4444';
      g.beginPath();
      g.arc(X(GIOSTRA.x), Y(GIOSTRA.y), GIOSTRA.r * k, 0, TAU);
      g.fill();
      for (const b of BANCHI) {
        g.fillStyle = b.colore;
        g.fillRect(X(b.x), Y(b.y), b.w * k, b.h * k);
      }
      g.fillStyle = '#9a4a2c';
      for (const m of VICOLO.muri) g.fillRect(X(m.x), Y(m.y), m.w * k, m.h * k);
      g.fillStyle = '#7c4a1e';
      g.fillRect(X(PALCO.x), Y(PALCO.y), PALCO.w * k, PALCO.h * k);
      g.fillStyle = '#2b2b38';
      for (const l of LAMPIONI) {
        g.beginPath();
        g.arc(X(l.x), Y(l.y), Math.max(2, l.r * k), 0, TAU);
        g.fill();
      }
      // acqua alta e cerchi
      const [cx, cy, r, pr] = zonaV;
      if (r < 2000) {
        g.save();
        g.beginPath();
        g.rect(0, 0, w, h);
        g.arc(X(cx), Y(cy), r * k, 0, TAU, true);
        g.fillStyle = 'rgba(38,120,210,0.6)';
        g.fill('evenodd');
        g.restore();
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(X(cx), Y(cy), r * k, 0, TAU);
        g.stroke();
      }
      if (pr && pr < r - 1) {
        g.save();
        g.setLineDash([6, 5]);
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(X(cx), Y(cy), pr * k, 0, TAU);
        g.stroke();
        g.restore();
      }
      // monete
      for (const [mx, my] of monete) {
        g.beginPath();
        g.arc(X(mx), Y(my), Math.max(3.5, 9 * k), 0, TAU);
        g.fillStyle = '#ffd23f';
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = '#a16207';
        g.stroke();
      }
      // tu
      const a = Math.min(1, (now - tPos) / 120);
      const px = X(prima.x + (pos.x - prima.x) * a);
      const py = Y(prima.y + (pos.y - prima.y) * a);
      const pulsa = (now / 700) % 1;
      if (v.vivo !== false) {
        g.beginPath();
        g.arc(px, py, 8 + pulsa * 18, 0, TAU);
        g.strokeStyle = `rgba(76,217,123,${1 - pulsa})`;
        g.lineWidth = 3;
        g.stroke();
      }
      g.beginPath();
      g.arc(px, py, 7, 0, TAU);
      g.fillStyle = v.vivo === false ? '#64748b' : '#4cd97b';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = '#0b3d1d';
      g.stroke();
      // "TU" con la freccina, dalla parte dove c'è spazio
      const su = py > 34;
      const ty = su ? py - 22 : py + 24;
      const tx = Math.min(w - 16, Math.max(16, px));
      g.font = '800 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.strokeStyle = '#0b3d1d';
      g.strokeText('TU', tx, ty);
      g.fillStyle = '#ffffff';
      g.fillText('TU', tx, ty);
    }

    // ---- stato e testa
    function base() {
      if (v.fase === 'pronti') return '📱 Il pallino verde sei tu: trovati sulla TV!';
      if (v.vivo === false) return '💀 Sei fuori: fai il tifo!';
      if (acqua > 0) return "🌊 Sei nell'acqua! Torna nel cerchio";
      return '🎭 Cammina come i passanti';
    }
    function avviso(testo, classe, durata = 1.6) {
      stato.textContent = testo;
      stato.className = `itr-stato ${classe || ''}`;
      avvisoFino = performance.now() + durata * 1000;
    }
    function scriviStato() {
      if (avvisoFino) return;
      stato.textContent = base();
      stato.className = `itr-stato ${acqua > 0 && v.vivo !== false ? 'blu' : v.fase === 'pronti' ? 'oro' : ''}`;
    }

    let raf = requestAnimationFrame(function f(now) {
      const kcd = Math.max(0, cdFine - now) / ((v.cd || 1) * 1000);
      cd.style.transform = `scaleY(${kcd})`;
      btn.classList.toggle('bloccato', now < bloccoFine);
      radice.classList.toggle('rosso', now < bloccoFine);
      radice.classList.toggle('acqua', acqua > 0 && v.vivo !== false && now >= bloccoFine);
      if (avvisoFino && now > avvisoFino) {
        avvisoFino = 0;
        scriviStato();
      }
      const r = v.fase === 'gioco' ? Math.max(0, resta - (now - tResta) / 1000) : resta;
      tTempo.textContent = `⏱ ${Math.ceil(r)}`;
      disegna(now);
      raf = requestAnimationFrame(f);
    });

    function mostraMsg() {
      if (v.fase === 'svela' || v.fase === 'tabella') {
        const r = v.ris || {};
        const bonus = (r.vivo || 0) + (r.ultimo || 0) + (r.podio || 0);
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">🎭</div><h1>Fine del round ${v.round}</h1>
          <div class="righe">⏱ In vita: +${r.tick || 0}<br>🪙 Monete: +${r.monete || 0}<br>👊 Eliminati: +${(r.kill || 0) * 3}${r.errori ? `<br>❌ Passanti colpiti: −${r.errori}` : ''}${bonus ? `<br>⭐ Bonus: +${bonus}` : ''}</div>
          <h1>${r.punti ?? 0} punti</h1><p>Totale: ${v.tot} · sei ${r.pos || '?'}° su ${r.totale || '?'}</p>`;
        return;
      }
      if (v.vivo === false && v.fase === 'gioco') {
        const m = v.morte || {};
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">${m.causa === 'acqua' ? '🌊' : '💀'}</div><h1>${m.causa === 'acqua' ? "Portato via dall'acqua!" : 'Eliminato!'}</h1>
          <p>${m.da ? `Ti ha steso <b>${esc(m.da)}</b>` : m.causa === 'acqua' ? 'Sei rimasto fuori dal cerchio' : ''}</p>
          <p>Punti di questo round: ${v.punti || 0}</p><p>Guarda la TV: riesci a capire chi sono gli altri?</p>`;
        return;
      }
      msg.hidden = true;
    }

    function aggiorna(nv) {
      if (!nv) return;
      v = nv;
      if (v.x != null) {
        pos = { x: v.x, y: v.y };
        prima = { ...pos };
        tPos = performance.now();
      }
      if (v.zona) zonaV = v.zona;
      if (v.monete) monete = v.monete;
      resta = v.resta ?? resta;
      tResta = performance.now();
      if (v.fase !== 'gioco') {
        acqua = 0;
        bloccoFine = 0;
      }
      tRound.textContent = `Round ${v.round || 1}/${v.rounds || 3}`;
      tPunti.textContent = `⭐ ${v.tot + (v.fase === 'gioco' || v.fase === 'pronti' ? v.punti || 0 : 0)}`;
      if (v.fase === 'pronti') api.vibra([60, 60, 60]);
      mostraMsg();
      scriviStato();
    }
    aggiorna(v);

    return {
      aggiorna,
      messaggio(d) {
        if (!d) return;
        if (d.p) {
          prima = { x: pos.x, y: pos.y };
          pos = { x: d.p[0], y: d.p[1] };
          tPos = performance.now();
          if (d.z) zonaV = [zonaV[0], zonaV[1], d.z[0], d.z[1]];
          if (d.s != null) {
            resta = d.s;
            tResta = performance.now();
          }
          if (d.pt != null) tPunti.textContent = `⭐ ${(v.tot || 0) + d.pt}`;
          const primaAcqua = acqua;
          acqua = d.a || 0;
          if (acqua > 0 && !primaAcqua) api.vibra([40, 40, 40]);
          if (acqua > 0.6 && Math.floor(performance.now() / 400) % 2 === 0) api.vibra(25);
          if (!!acqua !== !!primaAcqua) scriviStato();
        }
        if (d.m) monete = d.m;
        switch (d.ev) {
          case 'errore':
            bloccoFine = performance.now() + (d.dur || 2) * 1000;
            cdFine = bloccoFine;
            avviso('😱 Era un passante! Ora tutti sanno chi sei: scappa!', 'male', (d.dur || 2) + 1);
            api.vibra([120, 60, 120]);
            break;
          case 'kill':
            cdFine = performance.now() + (v.cd || 1) * 1000;
            avviso(`👊 Hai steso ${d.chi}! +3`, 'bene', 2);
            api.vibra([30, 30, 80]);
            break;
          case 'moneta':
            avviso('🪙 Moneta! +1 (ma ti hanno visto…)', 'oro', 1.6);
            api.vibra(30);
            break;
          case 'vuoto':
            if (performance.now() - tVuoto > 600) avviso('Nessuno a portata di pugno', '', 1);
            tVuoto = performance.now();
            break;
          case 'zona':
            avviso(d.passo === 0 ? "🌊 Arriva l'acqua alta: entra nel cerchio tratteggiato!" : "🌊 L'acqua salirà ancora: stai nel tratteggiato!", 'blu', 2.5);
            api.vibra([50, 50, 50]);
            break;
          case 'morto':
            api.vibra([200, 80, 200]);
            break;
        }
      },
      smonta() {
        cancelAnimationFrame(raf);
        joy.distruggi();
        tela.distruggi();
      },
    };
  },
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
