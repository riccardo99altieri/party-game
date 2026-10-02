// Detonazione sul telefono. Con la bomba in mano: la sequenza di gesti da fare,
// riconosciuti qui (subito, con la vibrazione) e comunicati allo schermo.
// Senza bomba: lo schermo rosso d'attesa, sperando che non tocchi a te.

import { GESTI, BOMBE, TIENI_MS, display } from './regole.js';

const AIUTO = {
  su: 'Scorri il dito verso l’alto',
  giu: 'Scorri il dito verso il basso',
  sx: 'Scorri il dito verso sinistra',
  dx: 'Scorri il dito verso destra',
  doppio: 'Tocca due volte, veloce',
  tieni: 'Dito fermo finché si riempie il cerchio',
  pizzica: 'Due dita che si avvicinano',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const chip = (g) => (g === 'doppio' ? '👆<sup>2</sup>' : GESTI[g].emoji);

// Il numero sul display di una bomba (stesso orologio della TV).
function numero(b, ora) {
  if (!b) return '';
  const resto = (b.scade - ora) / 1000;
  return Math.ceil(display(b.B0, Math.max(0, b.T - resto)));
}

export default {
  id: 'bomba',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="dt">
        <div class="dt-pan dt-mano" hidden>
          <div class="dt-top"><span class="dt-tit">💣 HAI LA BOMBA!</span><span class="dt-num"></span></div>
          <div class="dt-seq"></div>
          <div class="dt-zona">
            <div class="dt-anello"></div>
            <div class="dt-g-emoji"></div>
            <div class="dt-g-nome"></div>
            <div class="dt-aiuto"></div>
          </div>
          <div class="dt-verso"></div>
        </div>
        <div class="dt-pan dt-attesa" hidden>
          <div class="dt-vite"></div>
          <div class="dt-prega">🙏</div>
          <div class="dt-att-tit">Speriamo non tocchi a te…</div>
          <div class="dt-mira" hidden></div>
          <div class="dt-lista"></div>
        </div>
        <div class="dt-pan dt-fuori" hidden>
          <div class="dt-prega dt-teschio"></div>
          <div class="dt-att-tit dt-fuori-tit"></div>
          <div class="dt-fuori-sub"></div>
        </div>
        <div class="dt-avviso" hidden></div>
      </div>
      <style>
        .dt { position:absolute; inset:0; display:flex; flex-direction:column; overflow:hidden; }
        .dt-pan { position:absolute; inset:0; display:flex; flex-direction:column; }
        .dt [hidden] { display:none !important; }
        .dt-mano { background:radial-gradient(circle at 50% 30%, #ff7a3d, #b3122e 70%, #5c0718); --b:#ff3b3b; }
        .dt-mano.batte { animation:dt-batte .18s ease-out; }
        @keyframes dt-batte { from { filter:brightness(1.35); } to { filter:none; } }
        .dt-top { flex:none; display:flex; align-items:center; gap:10px; padding:10px 16px 4px; }
        .dt-tit { flex:1; font-size:22px; font-weight:800; letter-spacing:.5px; }
        .dt-num { min-width:78px; text-align:center; font-size:38px; font-weight:800; background:#12060a; color:#ff3b3b;
          border:3px solid var(--b); border-radius:14px; padding:0 10px; font-variant-numeric:tabular-nums; }
        .dt-num.rosso { color:#fff; background:#ff1f3d; }
        .dt-seq { flex:none; display:flex; justify-content:center; gap:10px; padding:8px 12px; }
        .dt-seq span { position:relative; width:58px; height:58px; display:grid; place-items:center; font-size:32px; border-radius:16px;
          background:rgba(0,0,0,.28); border:3px solid rgba(255,255,255,.25); opacity:.7; transition:transform .12s; }
        .dt-seq sup { position:absolute; right:5px; top:3px; font-size:15px; font-weight:800; }
        .dt-seq span.ora { opacity:1; transform:scale(1.18); border-color:#fff; background:rgba(0,0,0,.45); box-shadow:0 0 0 4px var(--b); }
        .dt-seq span.ok { opacity:1; background:#2fbf63; border-color:#1b1030; }
        .dt-seq span.ok::after { content:'✓'; position:absolute; right:-6px; top:-8px; font-size:18px; font-weight:800; color:#fff;
          background:#1b1030; border-radius:50%; width:22px; height:22px; display:grid; place-items:center; }
        .dt-zona { position:relative; flex:1; min-height:0; margin:6px 12px 8px; border-radius:30px; touch-action:none;
          border:5px solid var(--scuro); box-shadow:0 8px 0 var(--scuro); background:rgba(20,6,20,.45);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; overflow:hidden; user-select:none; -webkit-user-select:none; }
        .dt-zona > * { pointer-events:none; }
        .dt-zona.ok { animation:dt-ok .3s ease-out; }
        .dt-zona.no { animation:dt-no .35s ease-out; }
        @keyframes dt-ok { from { background:rgba(47,191,99,.75); } }
        @keyframes dt-no { 0% { background:rgba(255,40,60,.85); transform:translateX(0); } 25% { transform:translateX(-12px); } 50% { transform:translateX(10px); } 75% { transform:translateX(-6px); } }
        .dt-g-emoji { font-size:min(30vw, 150px); line-height:1.1; }
        .dt-g-emoji sup { font-size:.4em; font-weight:800; }
        .dt-g-nome { font-size:30px; font-weight:800; text-transform:uppercase; text-align:center; -webkit-text-stroke:1px var(--scuro); }
        .dt-aiuto { font-size:17px; opacity:.9; text-align:center; padding:0 16px; }
        .dt-anello { position:absolute; left:50%; top:50%; width:220px; height:220px; margin:-110px 0 0 -110px; border-radius:50%; opacity:0;
          background:conic-gradient(#fff calc(var(--p, 0) * 360deg), rgba(255,255,255,.12) 0);
          -webkit-mask:radial-gradient(circle, transparent 58%, #000 60%); mask:radial-gradient(circle, transparent 58%, #000 60%); }
        .a-su { animation:a-su .7s ease-in-out infinite; }
        .a-giu { animation:a-giu .7s ease-in-out infinite; }
        .a-sx { animation:a-sx .7s ease-in-out infinite; }
        .a-dx { animation:a-dx .7s ease-in-out infinite; }
        .a-doppio { animation:a-doppio .9s ease-out infinite; }
        .a-pizzica { animation:a-pizzica .9s ease-in-out infinite; }
        @keyframes a-su { from { transform:translateY(22px); } to { transform:translateY(-22px); } }
        @keyframes a-giu { from { transform:translateY(-22px); } to { transform:translateY(22px); } }
        @keyframes a-sx { from { transform:translateX(22px); } to { transform:translateX(-22px); } }
        @keyframes a-dx { from { transform:translateX(-22px); } to { transform:translateX(22px); } }
        @keyframes a-doppio { 0%, 40%, 100% { transform:scale(1); } 15%, 55% { transform:scale(.8); } }
        @keyframes a-pizzica { 0%, 100% { transform:scale(1.12); } 50% { transform:scale(.78); } }
        .dt-verso { flex:none; text-align:center; font-size:19px; padding:0 12px calc(12px + env(safe-area-inset-bottom)); }
        .dt-attesa { background:#4a0a18; align-items:center; justify-content:center; gap:10px; padding:16px; text-align:center; }
        .dt-attesa::before { content:''; position:absolute; inset:0; background:radial-gradient(circle, transparent 35%, #ff1f3d 120%);
          opacity:var(--pulsa, .3); pointer-events:none; }
        .dt-attesa.mirato { background:#7a0a1e; }
        .dt-attesa > * { position:relative; }
        .dt-prega { font-size:96px; line-height:1; animation:dt-prega 1.6s ease-in-out infinite; }
        @keyframes dt-prega { 50% { transform:scale(1.08); } }
        .dt-att-tit { font-size:25px; font-weight:800; }
        .dt-vite { font-size:30px; letter-spacing:4px; min-height:36px; }
        .dt-mira { font-size:21px; font-weight:800; background:#ffd23f; color:var(--scuro); border:4px solid var(--scuro);
          border-radius:18px; padding:10px 14px; animation:dt-mira .5s ease-in-out infinite alternate; }
        @keyframes dt-mira { to { transform:scale(1.05); } }
        .dt-lista { display:flex; flex-direction:column; gap:6px; font-size:17px; opacity:.95; }
        .dt-lista div { display:flex; align-items:center; gap:8px; justify-content:center; }
        .dt-lista b.n { min-width:44px; padding:0 6px; border-radius:8px; background:#12060a; color:#ff3b3b; font-variant-numeric:tabular-nums; }
        .dt-pallino { width:16px; height:16px; border-radius:50%; border:2px solid var(--scuro); flex:none; }
        .dt-fuori { background:#2b2733; align-items:center; justify-content:center; gap:10px; padding:20px; text-align:center; }
        .dt-fuori-sub { font-size:18px; opacity:.85; }
        .dt-avviso { position:absolute; left:12px; right:12px; bottom:calc(16px + env(safe-area-inset-bottom)); z-index:3;
          text-align:center; font-size:20px; font-weight:800; padding:12px; border-radius:18px;
          background:#1b1030; border:3px solid #ffd23f; pointer-events:none; animation:dt-avviso .25s ease-out; }
        @keyframes dt-avviso { from { transform:translateY(30px); opacity:0; } }
      </style>`;

    const $ = (q) => el.querySelector(q);
    const mano = $('.dt-mano');
    const attesa = $('.dt-attesa');
    const fuori = $('.dt-fuori');
    const avviso = $('.dt-avviso');
    const numEl = $('.dt-num');
    const seqEl = $('.dt-seq');
    const zona = $('.dt-zona');
    const anello = $('.dt-anello');
    const gEmoji = $('.dt-g-emoji');
    const gNome = $('.dt-g-nome');
    const gAiuto = $('.dt-aiuto');
    const versoEl = $('.dt-verso');
    const viteEl = $('.dt-vite');
    const miraEl = $('.dt-mira');
    const listaEl = $('.dt-lista');

    let v = s || {};
    let bomba = null; // la bomba che ho in mano (dalla vista)
    let prog = 0; // gesti giusti fatti
    let fatto = false;
    let ultimoNum = null;
    let pulsa = 0;
    let chiaveMira = null;
    let ultimoBoom = v.boom ? v.boom.n : 0;
    let timerAvviso = 0;
    let raf = 0;

    function mostraAvviso(testo, ms = 1800) {
      avviso.textContent = testo;
      avviso.hidden = false;
      clearTimeout(timerAvviso);
      timerAvviso = setTimeout(() => (avviso.hidden = true), ms);
    }

    function lampo(cls) {
      zona.classList.remove('ok', 'no');
      void zona.offsetWidth;
      zona.classList.add(cls);
    }

    function disegnaSeq() {
      if (!bomba) return;
      seqEl.innerHTML = bomba.seq.map((g, i) => `<span class="${i < prog ? 'ok' : i === prog && !fatto ? 'ora' : ''}">${chip(g)}</span>`).join('');
      const g = bomba.seq[Math.min(prog, bomba.seq.length - 1)];
      if (fatto) {
        gEmoji.className = 'dt-g-emoji';
        gEmoji.textContent = '🚀';
        gNome.textContent = 'Lanciata!';
        gAiuto.textContent = '';
        return;
      }
      gEmoji.className = `dt-g-emoji a-${g}`;
      gEmoji.innerHTML = chip(g);
      gNome.textContent = GESTI[g].nome;
      gAiuto.textContent = AIUTO[g];
    }

    // ---------------------------------------------------------------------
    // Riconoscimento dei gesti

    const dita = new Map(); // pointerId -> { x0, y0, x, y, t0 }
    let multi = false; // due dita insieme: vale solo il pizzico
    let usato = false; // il gesto di questo appoggio è già stato riconosciuto
    let d0 = 1;
    let tieniDa = 0;
    let timerTieni = 0;
    let ultimoTap = null;
    let blocco = 0;

    const distanza = () => {
      const [a, b] = [...dita.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    function annullaTieni() {
      clearTimeout(timerTieni);
      timerTieni = 0;
      tieniDa = 0;
      anello.style.opacity = 0;
    }

    function riconosci(g) {
      usato = true;
      annullaTieni();
      ultimoTap = null;
      if (!bomba || fatto || performance.now() < blocco) return;
      if (g === bomba.seq[prog]) {
        prog++;
        api.vibra(25);
        lampo('ok');
        if (prog >= bomba.seq.length) {
          fatto = true;
          api.invia({ k: bomba.k, fatto: true });
        } else api.invia({ k: bomba.k, passo: prog });
      } else {
        prog = 0;
        blocco = performance.now() + 250;
        api.vibra([90, 40, 90]);
        lampo('no');
        mostraAvviso(`❌ ${GESTI[g].nome}? Sbagliato! Da capo`, 1200);
        api.invia({ k: bomba.k, errore: true });
      }
      disegnaSeq();
    }

    zona.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        zona.setPointerCapture(e.pointerId);
      } catch {}
      const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now() };
      dita.set(e.pointerId, p);
      if (dita.size === 1) {
        multi = false;
        usato = false;
        tieniDa = p.t0;
        timerTieni = setTimeout(() => {
          if (dita.size === 1 && !multi && !usato) riconosci('tieni');
        }, TIENI_MS);
      } else if (dita.size === 2 && !usato) {
        multi = true;
        annullaTieni();
        ultimoTap = null;
        d0 = distanza();
      }
    });

    zona.addEventListener('pointermove', (e) => {
      const p = dita.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (usato) return;
      if (multi) {
        if (dita.size >= 2 && distanza() / d0 < 0.62) riconosci('pizzica');
        return;
      }
      const dx = p.x - p.x0;
      const dy = p.y - p.y0;
      const d = Math.hypot(dx, dy);
      const r = zona.getBoundingClientRect();
      if (d > Math.max(40, Math.min(r.width, r.height) * 0.1)) riconosci(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dx' : 'sx') : dy > 0 ? 'giu' : 'su');
      else if (d > 22) annullaTieni();
    });

    function alzato(e) {
      const p = dita.get(e.pointerId);
      if (!p) return;
      dita.delete(e.pointerId);
      if (!usato && !multi && e.type === 'pointerup') {
        const ora = performance.now();
        if (ora - p.t0 < 350 && Math.hypot(p.x - p.x0, p.y - p.y0) < 24) {
          if (ultimoTap && ora - ultimoTap.t < 380 && Math.hypot(p.x - ultimoTap.x, p.y - ultimoTap.y) < 90) riconosci('doppio');
          else ultimoTap = { t: ora, x: p.x, y: p.y };
        }
      }
      annullaTieni();
      if (!dita.size) {
        multi = false;
        usato = false;
      }
    }
    zona.addEventListener('pointerup', alzato);
    zona.addEventListener('pointercancel', alzato);

    // ---------------------------------------------------------------------
    // Schermate

    function aggiorna(nv) {
      v = nv || v;
      const b = v.fase === 'gioco' && v.vivo ? v.bomba : null;
      if (b && (!bomba || b.k !== bomba.k)) {
        // è arrivata la bomba!
        prog = 0;
        fatto = false;
        blocco = 0;
        api.vibra([180, 60, 180]);
        mostraAvviso('💣 Ti è arrivata la bomba! Veloce!', 1300);
      }
      bomba = b;
      mano.hidden = !bomba;
      attesa.hidden = !!bomba || !v.vivo || v.fase !== 'gioco';
      fuori.hidden = !(v.fase === 'fine' || !v.vivo);
      if (bomba) {
        mano.style.setProperty('--b', BOMBE[bomba.col].colore);
        versoEl.innerHTML = bomba.verso ? `Poi vola da: <b>${esc(bomba.verso)}</b>` : '';
        disegnaSeq();
      } else {
        dita.clear();
        annullaTieni();
      }
      // attesa
      viteEl.textContent = v.viteMax > 1 ? '❤️'.repeat(Math.max(0, v.vite)) + '🖤'.repeat(Math.max(0, v.viteMax - v.vite)) : '';
      const mira = !bomba && v.vivo && v.fase === 'gioco' ? v.mira : null;
      attesa.classList.toggle('mirato', !!mira);
      miraEl.hidden = !mira;
      if (mira) {
        miraEl.textContent = `⚠️ La bomba ${BOMBE[mira.col].nome} di ${mira.chi} punta verso di te!`;
        const k = `${mira.col}.${mira.chi}`;
        if (k !== chiaveMira) api.vibra(60);
        chiaveMira = k;
      } else chiaveMira = null;
      listaEl.innerHTML = (v.bombe || [])
        .map((x, i) => `<div><span class="dt-pallino" style="background:${BOMBE[x.col].colore}"></span>💣 ce l'ha <b>${esc(x.chi)}</b>${x.verso ? ` → ${x.verso === api.io.nome ? '<b>te!</b>' : esc(x.verso)}` : ''} <b class="n" data-i="${i}"></b></div>`)
        .join('');
      // fuori o finita
      if (v.fase === 'fine') {
        $('.dt-teschio').textContent = v.vinto ? '🏆' : v.vivo ? '😅' : '💀';
        $('.dt-fuori-tit').textContent = v.vinto ? 'Hai resistito fino alla fine!' : 'Fine!';
        $('.dt-fuori-sub').textContent = 'Guarda lo schermo grande';
      } else if (!v.vivo) {
        $('.dt-teschio').textContent = '💀';
        $('.dt-fuori-tit').textContent = 'BOOM! Sei fuori!';
        $('.dt-fuori-sub').textContent = `${v.pos ? `${v.pos}° posto su ${v.tot}. ` : ''}Guarda lo schermo: ne restano ${v.vivi}.`;
      }
      // esplosioni
      if (v.boom && v.boom.n !== ultimoBoom) {
        ultimoBoom = v.boom.n;
        if (v.boom.io) {
          api.vibra([400, 80, 250]);
          if (v.vivo) mostraAvviso(`💥 BOOM! Hai perso una vita`, 2200);
        } else mostraAvviso(v.boom.fuori ? `💀 BOOM! ${v.boom.chi} è fuori!` : `💥 BOOM! ${v.boom.chi} perde una vita`, 2000);
      }
    }

    // Numeri che scendono (sempre più in fretta) e battito del telefono.
    function anima() {
      raf = requestAnimationFrame(anima);
      const ora = api.ora();
      if (bomba) {
        const n = numero(bomba, ora);
        numEl.textContent = n;
        numEl.classList.toggle('rosso', n <= 3);
        if (n !== ultimoNum && ultimoNum != null) {
          api.vibra(n <= 3 ? 35 : 10);
          mano.classList.remove('batte');
          void mano.offsetWidth;
          mano.classList.add('batte');
        }
        ultimoNum = n;
        if (tieniDa && !usato && !multi) {
          const k = Math.min(1, (performance.now() - tieniDa) / TIENI_MS);
          anello.style.opacity = k > 0.15 ? 1 : 0;
          anello.style.setProperty('--p', k.toFixed(3));
        }
      } else {
        ultimoNum = null;
        let min = 99;
        for (const x of listaEl.querySelectorAll('.n')) {
          const b = (v.bombe || [])[Number(x.dataset.i)];
          const n = numero(b, ora);
          x.textContent = n;
          if (n < min) min = n;
        }
        pulsa = Math.max(0.2, Math.min(0.95, 1 - min / 12)) * (0.75 + 0.25 * Math.sin(ora / (min <= 4 ? 70 : 160)));
        attesa.style.setProperty('--pulsa', pulsa.toFixed(3));
      }
    }

    aggiorna(v);
    anima();

    return {
      aggiorna,
      messaggio() {},
      smonta() {
        cancelAnimationFrame(raf);
        clearTimeout(timerAvviso);
        annullaTieni();
      },
    };
  },
};
