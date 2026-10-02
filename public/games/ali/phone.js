// Batti le Ali! sul telefono: tutto lo schermo è un pulsante da tempestare di tocchi.
// Il tuo personaggio sbatte le ali a ogni tocco; lo schermo grande mostra il volo.

import { TAU, clamp, fmtNum } from '../../shared/util.js';

export default {
  id: 'ali',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="al">
        <div class="al-top"><span class="al-tempo"></span><span class="al-stato"></span><span class="al-metri"></span></div>
        <div class="al-zona"></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .al { position:absolute; inset:0; display:flex; flex-direction:column; }
        .al-top { flex:none; display:flex; align-items:center; gap:8px; padding:10px 14px 8px; font-weight:700; }
        .al-tempo { min-width:64px; font-size:24px; }
        .al-stato { flex:1; text-align:center; font-size:21px; }
        .al-metri { min-width:64px; text-align:right; font-size:19px; }
        .al-zona { position:relative; flex:1; min-height:0; margin:0 12px calc(14px + env(safe-area-inset-bottom)); border-radius:30px;
          border:5px solid var(--scuro); box-shadow:0 8px 0 var(--scuro); touch-action:none; overflow:hidden;
          background:radial-gradient(circle at 50% 35%, #ffffff55, transparent 60%), var(--c); }
        .al-zona.spenta { filter:grayscale(0.7) brightness(0.75); }
      </style>`;
    const zona = el.querySelector('.al-zona');
    zona.style.setProperty('--c', api.io.colore);
    const tempoEl = el.querySelector('.al-tempo');
    const statoEl = el.querySelector('.al-stato');
    const metriEl = el.querySelector('.al-metri');
    const msg = el.querySelector('.tel-msg');
    const cv = api.widgets.canvasPieno(zona, () => {});

    let v = s || {};
    let conta = 0; // battiti fatti da questo telefono
    let daMandare = 0;
    let ultimoInvio = 0;
    let timer = 0;
    let fine = 0; // performance.now() alla fine dei 12 secondi
    let splash = null;
    let ritmo = 0;
    let fase = 0;
    let pulsa = 0;
    let avvisoFino = 0;
    let ultimo = performance.now();
    const onde = [];

    function manda() {
      timer = 0;
      if (!daMandare) return;
      api.invia({ b: daMandare });
      daMandare = 0;
      ultimoInvio = performance.now();
    }

    const puoi = () => v.fase === 'via' && !splash;

    zona.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const [x, y] = cv.punto(e);
      if (!puoi()) {
        if (v.fase !== 'plana' && !splash) avvisoFino = performance.now() + 900;
        return;
      }
      conta++;
      daMandare++;
      ritmo += 2.5;
      pulsa = 1;
      onde.push({ x, y, k: 0 });
      if (onde.length > 12) onde.shift();
      const ora = performance.now();
      if (ora - ultimoInvio >= 60) manda();
      else if (!timer) timer = setTimeout(manda, 60 - (ora - ultimoInvio));
    });

    function disegna(ora) {
      const dt = Math.min(0.1, (ora - ultimo) / 1000);
      ultimo = ora;
      ritmo *= Math.exp(-2.5 * dt);
      fase += dt * (0.6 + Math.min(ritmo, 9) * 0.8);
      pulsa = Math.max(0, pulsa - dt * 6);
      const { g, w, h } = cv;
      g.clearRect(0, 0, w, h);
      for (const o of onde) {
        o.k += dt * 2.2;
        if (o.k >= 1) continue;
        g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - o.k)})`;
        g.lineWidth = 6 * (1 - o.k) + 1;
        g.beginPath();
        g.arc(o.x, o.y, 20 + o.k * 90, 0, TAU);
        g.stroke();
      }
      while (onde.length && onde[0].k >= 1) onde.shift();

      // il tuo personaggio con le ali
      const hAv = Math.min(h * 0.5, w * 0.62);
      const t = ora / 1000;
      const amp = v.fase === 'via' && !splash ? clamp(ritmo / 4, 0, 1) : 0;
      const bob = v.fase === 'via' ? -Math.sin(fase * TAU) * amp * 8 : 0;
      const o =
        v.fase === 'pronti' || !v.fase
          ? { pose: 'idle', t, ali: true, ombra: false }
          : { pose: 'vola', t, ali: true, battito: -Math.cos(fase * TAU) * amp, espr: splash ? 'felice' : ritmo > 6.5 ? 'arrabbiato' : null, ombra: false };
      api.disegnaAvatar(g, api.io.avatar, w / 2, h * 0.58 + bob, hAv, o);

      // contatore
      const dim = Math.min(w * 0.22, h * 0.16) * (1 + pulsa * 0.18);
      g.font = `700 ${Math.round(dim)}px Fredoka, 'Segoe UI', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(6, dim * 0.14);
      g.strokeStyle = '#1b1030';
      const y = h * 0.78;
      g.strokeText(String(conta), w / 2, y);
      g.fillStyle = '#fff';
      g.fillText(String(conta), w / 2, y);
      g.font = `700 ${Math.round(Math.min(26, w * 0.06))}px Fredoka, 'Segoe UI', sans-serif`;
      g.lineWidth = 5;
      const sotto = v.fase === 'via' && !splash ? 'TOCCA! TOCCA! TOCCA!' : 'battiti';
      g.strokeText(sotto, w / 2, y + dim * 0.62);
      g.fillText(sotto, w / 2, y + dim * 0.62);
    }

    function testi(ora) {
      const resto = fine ? Math.max(0, (fine - ora) / 1000) : v.durata || 12;
      tempoEl.textContent = v.fase === 'plana' || splash ? '' : `⏱ ${Math.ceil(resto)}`;
      let st;
      if (splash) st = '💦 Splash!';
      else if (ora < avvisoFino) st = '✋ Aspetta il VIA!';
      else if (v.fase === 'via') st = '🪶 Sbatti le ali!';
      else if (v.fase === 'plana') st = '🪂 Braccia stanche… planata!';
      else st = 'Pronti… al VIA tocca a raffica!';
      statoEl.textContent = st;
      zona.classList.toggle('spenta', !puoi() && v.fase !== 'pronti');
    }

    let raf = requestAnimationFrame(function f(ora) {
      disegna(ora);
      testi(ora);
      raf = requestAnimationFrame(f);
    });

    function aggiorna(nv) {
      v = nv || v;
      if (v.fase === 'via' && !fine) fine = performance.now() + (v.durata || 12) * 1000;
      if (v.fase === 'plana') manda();
    }
    aggiorna(null);

    return {
      aggiorna,
      messaggio(d) {
        if (typeof d.r === 'number') fine = performance.now() + d.r * 1000;
        if (d.m && d.m[api.io.id] != null) {
          const mio = d.m[api.io.id];
          const pos = 1 + Object.values(d.m).filter((x) => x > mio).length;
          metriEl.textContent = `${fmtNum(mio, 0)} m · ${pos}°`;
        }
        if (d.splash != null) {
          splash = d.splash;
          api.vibra([80, 40, 80]);
          msg.hidden = false;
          msg.innerHTML = `<div class="emoji-grande">💦</div><h1>Splash!</h1><p>Hai volato per <b>${fmtNum(d.splash, 1)} metri</b><br>con ${conta} colpi d'ali.<br>Guarda lo schermo grande!</p>`;
        }
      },
      smonta() {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        cv.distruggi();
      },
    };
  },
};
