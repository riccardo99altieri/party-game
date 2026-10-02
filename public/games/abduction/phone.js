// Abduction sul telefono: il radar (solo per 3 secondi: poi la tua mucca te la devi
// ricordare), il joystick, BRUCA da tenere premuto 3 s e SPINGI (testata, ricarica 4 s).

import { CAMPO } from './regole.js';

const TAU = Math.PI * 2;
const LARGA = CAMPO.x1 - CAMPO.x0;
const ALTA = CAMPO.y1 - CAMPO.y0;

export default {
  id: 'abduction',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="abd">
        <div class="abd-testa"><span class="abd-punti">⭐ 0</span><span class="abd-tempo">⏱ 60</span></div>
        <div class="abd-schermo">
          <div class="abd-radar"></div>
          <div class="abd-info">
            <div class="abd-icona">🐄</div>
            <div class="abd-frase">Ricordati quale mucca sei!</div>
          </div>
        </div>
        <div class="abd-stato"></div>
        <div class="abd-pad">
          <div class="abd-joy"></div>
          <div class="abd-btns"><div class="abd-b1"></div><div class="abd-b2"></div></div>
        </div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .abd { position:absolute; inset:0; display:flex; flex-direction:column; transition:box-shadow .15s; }
        .abd.rapito { box-shadow:inset 0 0 0 6px #4cd97b, inset 0 0 70px rgba(76,217,123,0.55); }
        .abd.furia .abd-testa { color:#ffb3c1; }
        .abd-testa { display:flex; justify-content:space-between; padding:8px 14px 4px; font-size:21px; font-weight:700; }
        .abd-schermo { flex:none; align-self:center; position:relative; width:min(calc(100% - 20px), calc(30vh * ${LARGA} / ${ALTA})); aspect-ratio:${LARGA} / ${ALTA}; border-radius:14px; overflow:hidden; box-shadow:0 0 0 3px rgba(255,255,255,0.15); background:#16233f; }
        .abd-radar { position:absolute; inset:0; }
        .abd-info { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:10px; text-align:center; }
        .abd-icona { font-size:44px; line-height:1; }
        .abd-frase { font-size:18px; font-weight:700; opacity:0.9; }
        .abd-stato { flex:none; padding:6px 10px; text-align:center; font-size:20px; font-weight:700; min-height:54px; display:flex; align-items:center; justify-content:center; transition:color .2s, transform .2s; }
        .abd-stato.male { color:#ff8fb3; transform:scale(1.06); }
        .abd-stato.bene { color:var(--verde); transform:scale(1.06); }
        .abd-stato.oro { color:#ffd23f; transform:scale(1.08); }
        .abd-pad { flex:1; display:flex; gap:10px; padding:0 12px calc(14px + env(safe-area-inset-bottom)); min-height:0; }
        .abd-joy { flex:1.25; border-radius:28px; background:rgba(255,255,255,0.06); border:3px dashed rgba(255,255,255,0.2); }
        .abd-btns { flex:1; display:flex; flex-direction:column; gap:12px; min-height:0; }
        .abd-b1 { flex:1.5; min-height:0; }
        .abd-b2 { flex:1; min-height:0; }
        .abd-btns .pad-btn { position:relative; overflow:hidden; font-size:24px; line-height:1.15; }
        .abd-btns .pad-btn small { font-size:14px; opacity:0.85; }
        .abd-btns .pad-btn .riempi { position:absolute; inset:0; background:rgba(190,255,120,0.55); transform-origin:bottom; transform:scaleY(0); pointer-events:none; }
        .abd-btns .pad-btn .cd { position:absolute; inset:0; background:rgba(20,10,45,0.65); transform-origin:bottom; transform:scaleY(0); pointer-events:none; }
        .abd-btns .pad-btn span { position:relative; }
        .abd .tel-msg .righe { font-size:18px; line-height:1.5; opacity:0.95; }
      </style>`;
    const radice = el.querySelector('.abd');
    const tPunti = el.querySelector('.abd-punti');
    const tTempo = el.querySelector('.abd-tempo');
    const boxRadar = el.querySelector('.abd-radar');
    const info = el.querySelector('.abd-info');
    const icona = el.querySelector('.abd-icona');
    const frase = el.querySelector('.abd-frase');
    const stato = el.querySelector('.abd-stato');
    const msg = el.querySelector('.tel-msg');
    const zona = el.querySelector('.abd-joy');
    zona.style.setProperty('--c', api.io.colore);
    const joy = api.widgets.joystick(zona, (x, y) => api.invia({ j: [x, y] }), { testo: 'Muoviti qui' });

    let v = s || {};
    let punti = v.punti || 0;
    let resta = v.resta ?? 60;
    let tResta = performance.now();
    let radarFine = 0; // fino a quando si vede il radar (orologio del telefono)
    let pos = v.pos ? { x: v.pos[0], y: v.pos[1] } : null;
    let prima = pos ? { ...pos } : null;
    let tPos = performance.now();
    let dischi = v.dischi || [];
    let premuto = false;
    let brBase = 0;
    let brT = 0;
    let cdFine = 0;
    let fuoriFine = 0;
    let avvisoFino = 0;
    let tVuoto = 0;
    let radarAcceso = false;

    const bruca = api.widgets.pulsante(el.querySelector('.abd-b1'), {
      testo: '<div class="riempi"></div><span><span style="font-size:40px">🌿</span><br>BRUCA<br><small>tieni premuto 3 s</small></span>',
      colore: '#22a35a',
      onPremi: () => {
        if (v.fase !== 'gioco' || performance.now() < fuoriFine) return;
        premuto = true;
        brBase = 0;
        brT = performance.now();
        api.invia({ b: 1 });
        api.vibra(15);
        scriviStato();
      },
      onRilascia: () => {
        const k = premuto ? brBase + (performance.now() - brT) / ((v.tb || 3) * 1000) : 0;
        premuto = false;
        api.invia({ b: 0 });
        if (k > 0.2 && v.fase === 'gioco') avviso('Mollato: questa brucata non vale', '', 1.1);
        else scriviStato();
      },
    });
    const riempi = bruca.querySelector('.riempi');
    const spingi = api.widgets.pulsante(el.querySelector('.abd-b2'), {
      testo: '<div class="cd"></div><span><span style="font-size:30px">💥</span> SPINGI</span>',
      colore: '#ff4d6d',
      onPremi: () => {
        const now = performance.now();
        if (now < cdFine || now < fuoriFine || v.fase !== 'gioco') return;
        api.invia({ s: 1 });
        api.vibra(20);
      },
    });
    const cd = spingi.querySelector('.cd');

    // ---- radar
    const tela = api.widgets.canvasPieno(boxRadar, () => {});

    function disegnaRadar(now) {
      const { g, w, h } = tela;
      const k = w / LARGA;
      const X = (x) => (x - CAMPO.x0) * k;
      const Y = (y) => (y - CAMPO.y0) * k;
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#2f6a30';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(160,255,190,0.18)';
      g.lineWidth = 1;
      for (let x = 0; x < w; x += w / 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let y = 0; y < h; y += h / 5) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      // il disco e il suo raggio
      for (const [dx, dy, r] of dischi) {
        g.beginPath();
        g.arc(X(dx), Y(dy), r * k, 0, TAU);
        g.fillStyle = 'rgba(150,255,190,0.3)';
        g.fill();
        g.strokeStyle = 'rgba(200,255,215,0.9)';
        g.lineWidth = 2;
        g.stroke();
        g.font = `${Math.max(14, 34 * k)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🛸', X(dx), Y(dy));
      }
      // tu
      if (pos) {
        const a = Math.min(1, (now - tPos) / 120);
        const px = X(prima.x + (pos.x - prima.x) * a);
        const py = Y(prima.y + (pos.y - prima.y) * a);
        const pulsa = (now / 650) % 1;
        g.beginPath();
        g.arc(px, py, 8 + pulsa * 22, 0, TAU);
        g.strokeStyle = `rgba(255,210,63,${1 - pulsa})`;
        g.lineWidth = 3;
        g.stroke();
        g.beginPath();
        g.arc(px, py, 8, 0, TAU);
        g.fillStyle = '#ffd23f';
        g.fill();
        g.lineWidth = 2.5;
        g.strokeStyle = '#3d2a00';
        g.stroke();
        const ty = py > 34 ? py - 24 : py + 26;
        const tx = Math.min(w - 18, Math.max(18, px));
        g.font = '800 16px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 4;
        g.strokeStyle = '#3d2a00';
        g.strokeText('TU', tx, ty);
        g.fillStyle = '#ffffff';
        g.fillText('TU', tx, ty);
      }
      // quanto dura ancora
      if (v.fase === 'gioco') {
        const r = Math.max(0, (radarFine - now) / 1000);
        g.font = '800 15px system-ui, sans-serif';
        g.textAlign = 'right';
        g.textBaseline = 'top';
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.strokeText(`📡 ${Math.ceil(r)}`, w - 8, 6);
        g.fillStyle = '#fff';
        g.fillText(`📡 ${Math.ceil(r)}`, w - 8, 6);
      }
    }

    // ---- stato
    function base() {
      if (v.fase === 'pronti') return '📡 Il pallino giallo sei tu: trova la tua mucca sulla TV!';
      if (performance.now() < fuoriFine) return '🛸 Sei sul disco volante…';
      if (premuto) return '🌿 Bruchi… non mollare!';
      if (radarAcceso) return '📡 Il pallino giallo sei tu: trovati sulla TV!';
      return '🛸 Quando passa il raggio: immobile!';
    }
    function avviso(testo, classe, durata = 1.6) {
      stato.textContent = testo;
      stato.className = `abd-stato ${classe || ''}`;
      avvisoFino = performance.now() + durata * 1000;
    }
    function scriviStato() {
      if (avvisoFino) return;
      stato.textContent = base();
      stato.className = `abd-stato ${v.fase === 'pronti' ? 'oro' : ''}`;
    }
    function scriviPunti() {
      tPunti.textContent = `⭐ ${punti}`;
    }

    let raf = requestAnimationFrame(function f(now) {
      const radar = v.fase === 'pronti' || (v.fase === 'gioco' && now < radarFine && !!pos);
      if (radar !== radarAcceso) {
        radarAcceso = radar;
        scriviStato();
      }
      boxRadar.style.visibility = radar ? 'visible' : 'hidden';
      info.style.visibility = radar ? 'hidden' : 'visible';
      if (radar) disegnaRadar(now);
      else if (now < fuoriFine) {
        icona.textContent = '🛸';
        frase.textContent = `Rientri tra ${Math.ceil((fuoriFine - now) / 1000)}…`;
      } else {
        icona.textContent = premuto ? '🌿' : '🐄';
        frase.textContent = premuto ? 'Bruchi… (la TV non deve capire chi sei)' : 'Ricordati quale mucca sei!';
      }
      const kbr = premuto ? Math.min(1, brBase + (now - brT) / ((v.tb || 3) * 1000)) : 0;
      riempi.style.transform = `scaleY(${kbr})`;
      const kcd = Math.max(0, cdFine - now) / ((v.cd || 4) * 1000);
      cd.style.transform = `scaleY(${kcd})`;
      radice.classList.toggle('rapito', now < fuoriFine);
      if (avvisoFino && now > avvisoFino) {
        avvisoFino = 0;
        scriviStato();
      }
      const r = v.fase === 'gioco' ? Math.max(0, resta - (now - tResta) / 1000) : resta;
      tTempo.textContent = `⏱ ${Math.ceil(r)}`;
      raf = requestAnimationFrame(f);
    });

    function mostraMsg() {
      if (v.fase === 'svela') {
        const r = v.ris || {};
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">🐄</div><h1>Tempo scaduto!</h1>
          <div class="righe">🌿 Brucate: ${r.brucate || 0}<br>🛸 Rapimenti: ${r.rapito || 0}${r.persi ? ` (−${r.persi})` : ''}${r.prese ? `<br>💥 Spinti nel raggio: ${r.prese} (+${r.rubati})` : ''}</div>
          <h1>${v.punti} punti</h1><p>Sei ${r.pos || '?'}° su ${r.totale || '?'}</p><p>Guarda la TV: ecco chi era chi!</p>`;
        return;
      }
      msg.hidden = true;
    }

    function aggiorna(nv) {
      if (!nv) return;
      v = nv;
      punti = v.punti ?? punti;
      resta = v.resta ?? resta;
      tResta = performance.now();
      if (v.dischi) dischi = v.dischi;
      if (v.pos) {
        pos = { x: v.pos[0], y: v.pos[1] };
        prima = { ...pos };
        tPos = performance.now();
      } else pos = null;
      radarFine = v.radar > 0 ? performance.now() + v.radar * 1000 : 0;
      fuoriFine = v.fuori > 0 ? performance.now() + v.fuori * 1000 : 0;
      if (v.fase !== 'gioco') premuto = false;
      radice.classList.toggle('furia', v.valore > 10);
      if (v.fase === 'pronti') api.vibra([60, 60, 60]);
      scriviPunti();
      mostraMsg();
      scriviStato();
    }
    aggiorna(v);

    return {
      aggiorna,
      messaggio(d) {
        if (!d) return;
        const now = performance.now();
        if (d.s != null) {
          resta = d.s;
          tResta = now;
        }
        if (d.pt != null) {
          punti = d.pt;
          scriviPunti();
        }
        if (d.br != null && premuto) {
          brBase = d.br;
          brT = now;
        }
        if (d.cd != null) cdFine = d.cd > 0 ? Math.max(cdFine, now + d.cd * 1000 - 150) : Math.min(cdFine, now);
        if (d.r) {
          prima = pos ? { x: pos.x, y: pos.y } : { x: d.r[0], y: d.r[1] };
          pos = { x: d.r[0], y: d.r[1] };
          tPos = now;
          radarFine = now + d.r[2] * 1000;
          if (d.u) dischi = d.u;
        } else if (d.s != null) radarFine = Math.min(radarFine, now);
        switch (d.ev) {
          case 'brucata':
            brBase = 0;
            brT = now;
            avviso(`🌿 Gnam! +${d.v}`, 'bene', 1.3);
            api.vibra([25, 40, 25]);
            break;
          case 'interrotta':
            premuto = false;
            avviso('💥 Ti hanno dato una testata: brucata persa!', 'male', 2.2);
            api.vibra([80, 50, 80]);
            break;
          case 'rapito':
            premuto = false;
            fuoriFine = now + 3000;
            avviso(d.da ? `🛸 Rapito! −${d.persi} · ti ha spinto ${d.da}` : `🛸 Rapito! Hai perso ${d.persi} punti`, 'male', 3.2);
            api.vibra([300, 100, 300]);
            break;
          case 'rientro':
            avviso('📡 Sei di nuovo giù: guarda il radar!', 'oro', 2.5);
            api.vibra([60, 60, 60]);
            break;
          case 'spinta':
            cdFine = now + (d.cd || 4) * 1000;
            avviso('💥 Testata!', '', 1);
            break;
          case 'vuoto':
            if (now - tVuoto > 600) avviso('Nessuna mucca davanti a te', '', 1);
            tVuoto = now;
            break;
          case 'presa':
            avviso(`😈 Hai spinto ${d.chi} nel raggio! +${d.rubati}`, 'oro', 2.6);
            api.vibra([40, 40, 120]);
            break;
          case 'mucca':
            avviso('🐄 Era una mucca vera: il disco se l\'è presa', '', 2);
            break;
          case 'furia':
            radice.classList.add('furia');
            avviso(`⚡ Ultimi 15 s: ogni brucata vale +${d.valore}!`, 'oro', 2.6);
            api.vibra([50, 50, 50]);
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
