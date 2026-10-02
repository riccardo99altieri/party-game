// Fight Club sul telefono.
// Pubblico: punta su uno dei due gladiatori, poi tocca a raffica FAI IL TIFO.
// Gladiatori: il cursore del duello. Il telefono decide se il colpo è buono (niente
// ritardi di rete) e lo manda allo schermo; il tifo arriva dallo schermo.

import { clamp } from '../../shared/util.js';
import { MODI, MANCATO, RAFFICA, tri, velocita, larghezza, qualita, prossimaZona, precisione } from './regole.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const AIUTO = {
  colpo: 'Il tifo rallenta il mirino',
  braccio: 'Il tifo allarga il verde e rende i colpi più forti',
  legna: 'Il tifo allarga il verde e rende i colpi più forti',
};

export default {
  id: 'fightclub',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="fc"></div>
      <style>
        .fc { position:absolute; inset:0; display:flex; flex-direction:column; }
        .fc-top { flex:none; display:flex; justify-content:space-between; align-items:center; padding:10px 14px 4px; font-weight:700; font-size:18px; }
        .fc-tempo { font-size:24px; min-width:52px; text-align:right; }
        .fc h2 { margin:6px 0 10px; text-align:center; font-size:30px; }
        .fc-scelte { flex:1; min-height:0; display:flex; gap:10px; padding:0 12px; align-items:stretch; }
        .fc-scelta { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; border-radius:26px;
          border:5px solid var(--scuro); box-shadow:0 8px 0 var(--scuro); background:var(--c); color:#fff; font:700 24px var(--font);
          text-shadow:0 2px 0 rgba(0,0,0,.4); touch-action:none; padding:10px 6px; }
        .fc-scelta span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .fc-scelta.no { filter:grayscale(.85) brightness(.55); }
        .fc-scelta.si { outline:6px solid var(--giallo); outline-offset:-2px; }
        .fc-scelta em { font-style:normal; font-size:18px; color:var(--giallo); min-height:22px; }
        .fc-vs { align-self:center; font-size:26px; font-weight:700; }
        .fc-nota { flex:none; text-align:center; font-size:17px; opacity:.9; padding:12px 14px calc(14px + env(safe-area-inset-bottom)); margin:0; }
        .fc-barre { flex:none; display:flex; gap:10px; padding:4px 14px 8px; }
        .fc-barra { flex:1; }
        .fc-barra small { display:block; font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .fc-barra div { height:16px; border-radius:8px; background:#ffffff22; overflow:hidden; border:2px solid var(--scuro); }
        .fc-barra i { display:block; height:100%; width:0; background:linear-gradient(90deg,#ffd23f,#ff3b5c); transition:width .12s; }
        .fc-tifo { flex:1; min-height:0; display:flex; gap:10px; padding:0 12px calc(16px + env(safe-area-inset-bottom)); }
        .fc-tasto { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border-radius:32px;
          border:6px solid var(--scuro); box-shadow:0 10px 0 var(--scuro); background:radial-gradient(circle at 50% 35%, #ffffff55, transparent 60%), var(--c);
          color:#fff; font:700 30px var(--font); text-align:center; text-shadow:0 3px 0 rgba(0,0,0,.45); touch-action:none; padding:10px; }
        .fc-tasto b { font-size:64px; line-height:1; }
        .fc-tasto.piccolo { font-size:21px; } .fc-tasto.piccolo b { font-size:44px; }
        .fc-tasto.batte { transform:translateY(6px) scale(.98); box-shadow:0 4px 0 var(--scuro); }
        .fc-gioco { flex:1; min-height:0; position:relative; touch-action:none; }
        .fc-esito { flex:1; }
        .fc-esito .delta { font-size:60px; font-weight:700; }
        .fc-esito .su { color:var(--verde); } .fc-esito .giu { color:#ff4d6d; }
        .fc-conta { font-size:72px; font-weight:700; color:var(--giallo); }
        .fc-modo { font-size:30px; font-weight:700; color:#ff8fab; }
      </style>`;
    const box = el.querySelector('.fc');
    let v = s || {};
    let chiave = null;
    let live = null; // ultimo stato del duello mandato dallo schermo
    let ui = null; // la schermata attuale: { frame(ora), vista(), smonta() }
    const restano = () => Math.max(0, Math.ceil(((v.fineFase || 0) - api.ora()) / 1000));
    const nomi = () => [v.a, v.b];

    let raf = requestAnimationFrame(function loop(ora) {
      if (ui && ui.frame) ui.frame(ora);
      raf = requestAnimationFrame(loop);
    });

    function costruisci() {
      if (ui && ui.smonta) ui.smonta();
      ui = null;
      if (!v.fase || v.fase === 'attesa') {
        box.innerHTML = '<div class="centro"><div class="emoji-grande">🥊</div><h1>Fight Club</h1><p>Guarda lo schermo grande!</p></div>';
      } else if (v.fase === 'scommessa') ui = v.ruolo === 'pub' ? punta() : preparati();
      else if (v.fase === 'duello') ui = v.ruolo === 'pub' ? tifo() : duello();
      else if (v.fase === 'esito') ui = esito();
    }

    function aggiorna(nv) {
      v = nv || v;
      const k = `${v.fase}|${v.i}|${v.ruolo}`;
      if (k !== chiave) {
        chiave = k;
        if (v.fase === 'scommessa') live = null;
        costruisci();
      } else if (ui && ui.vista) ui.vista();
    }

    // -------------------------------------------------------------------------
    // Pubblico: scommessa

    function punta() {
      box.innerHTML = `
        <div class="fc-top"><span>Duello ${v.i + 1} di ${v.tot}</span><span class="fc-tempo"></span></div>
        <h2>💰 Chi vince? Punta!</h2>
        <div class="fc-scelte">
          ${nomi()
            .map((g, s) => `<button class="fc-scelta" data-s="${s}" style="--c:${g.colore}"><i></i><span>${esc(g.nome)}</span><em></em></button>${s === 0 ? '<div class="fc-vs">VS</div>' : ''}`)
            .join('')}
        </div>
        <p class="fc-nota">${MODI[v.modo].emoji} ${MODI[v.modo].nome} · se vince +2 punti, +3 se in pochi puntano come te. Puoi cambiare fino allo scadere</p>`;
      const tempo = box.querySelector('.fc-tempo');
      const bottoni = [...box.querySelectorAll('.fc-scelta')];
      bottoni.forEach((b, s) => {
        b.querySelector('i').replaceWith(api.canvasAvatar(nomi()[s].av, 110, 110, { soloTesta: true }));
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (restano() <= 0) return;
          v.scommessa = s;
          api.invia({ k: 'p', s });
          api.vibra(25);
          vista();
        });
      });
      function vista() {
        bottoni.forEach((b, s) => {
          b.classList.toggle('si', v.scommessa === s);
          b.classList.toggle('no', v.scommessa != null && v.scommessa !== s);
          b.querySelector('em').textContent = v.scommessa === s ? '✓ PUNTATO' : '';
        });
      }
      vista();
      return { vista, frame: () => (tempo.textContent = `⏱ ${restano()}`) };
    }

    // -------------------------------------------------------------------------
    // Gladiatori: preparati

    function preparati() {
      const lui = nomi()[1 - v.ruolo];
      const M = MODI[v.modo];
      box.innerHTML = `
        <div class="centro">
          <div class="emoji-grande rotola">⚔️</div>
          <h1>PREPARATI!</h1>
          <p>Sei nell'arena contro <b style="color:${lui.colore}">${esc(lui.nome)}</b></p>
          <div class="fc-modo">${M.emoji} ${M.nome}</div>
          <p>${M.regola}</p>
          <p>Il pubblico sta scommettendo: ${AIUTO[v.modo].toLowerCase()}.</p>
          <div class="fc-conta"></div>
        </div>`;
      const conta = box.querySelector('.fc-conta');
      api.vibra([40, 60, 40]);
      return { frame: () => (conta.textContent = restano()) };
    }

    // -------------------------------------------------------------------------
    // Pubblico: tifo

    function tifo() {
      const lati = v.scommessa != null ? [v.scommessa] : [0, 1];
      box.innerHTML = `
        <div class="fc-top"><span>${v.scommessa != null ? '🔥 Spacca il pollice!' : '🤷 Non hai puntato: tifa chi vuoi'}</span><span class="fc-tempo"></span></div>
        <div class="fc-barre">${nomi()
          .map((g) => `<div class="fc-barra"><small style="color:${g.colore}">${esc(g.nome)}</small><div><i></i></div></div>`)
          .join('')}</div>
        <div class="fc-tifo">${lati
          .map((s) => `<div class="fc-tasto ${lati.length > 1 ? 'piccolo' : ''}" data-s="${s}" style="--c:${nomi()[s].colore}"><b>🔥</b>FAI IL TIFO PER<br>${esc(nomi()[s].nome)}!<small class="n">0</small></div>`)
          .join('')}</div>`;
      const tempo = box.querySelector('.fc-tempo');
      const barre = [...box.querySelectorAll('.fc-barra i')];
      const daMandare = [0, 0];
      const contati = [0, 0];
      let ultimoInvio = 0;
      let timer = 0;
      function manda() {
        timer = 0;
        ultimoInvio = performance.now();
        for (const s of [0, 1]) {
          if (!daMandare[s]) continue;
          api.invia({ k: 't', n: daMandare[s], s });
          daMandare[s] = 0;
        }
      }
      for (const b of box.querySelectorAll('.fc-tasto')) {
        const s = Number(b.dataset.s);
        const n = b.querySelector('.n');
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (restano() <= 0) return;
          daMandare[s]++;
          n.textContent = ++contati[s];
          b.classList.remove('batte');
          void b.offsetWidth;
          b.classList.add('batte');
          setTimeout(() => b.classList.remove('batte'), 70);
          const ora = performance.now();
          if (ora - ultimoInvio >= 60) manda();
          else if (!timer) timer = setTimeout(manda, 60 - (ora - ultimoInvio));
        });
      }
      return {
        frame() {
          tempo.textContent = `⏱ ${restano()}`;
          if (live) barre.forEach((b, s) => (b.style.width = `${Math.round(live.h[s] * 100)}%`));
        },
        smonta() {
          clearTimeout(timer);
          manda();
        },
      };
    }

    // -------------------------------------------------------------------------
    // Gladiatori: il duello

    function duello() {
      const lato = v.ruolo;
      const lui = nomi()[1 - lato];
      const M = MODI[v.modo];
      box.innerHTML = '<div class="fc-gioco"></div>';
      const area = box.querySelector('.fc-gioco');
      const cv = api.widgets.canvasPieno(area, () => {});
      const st = {
        f: v.f0 + M.vel * Math.max(0, api.ora() - v.t0) / 1000,
        k: 0,
        z: prossimaZona(v.seme, 0, tri(v.f0)),
        stun: 0,
        ultimo: -1e9,
        tiro: null,
        flash: 0,
        segno: null, // ultimo tocco: { ok, q, t }
        ultimoT: performance.now(),
        sync: 0,
      };
      const mioTifo = () => (live ? live.h[lato] : 0);
      const attivo = () => api.ora() < v.fineFase && st.tiro == null;
      api.vibra(80);

      area.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!attivo()) return;
        const ora = performance.now();
        const h = mioTifo();
        st.f += velocita(v.modo, h) * Math.min(0.1, (ora - st.ultimoT) / 1000);
        st.ultimoT = ora;
        const x = tri(st.f);
        if (v.modo === 'colpo') {
          st.tiro = x;
          st.segno = { ok: true, q: precisione(x) / 100, t: ora };
          api.invia({ k: 's', x, f: st.f, t: api.ora() });
          api.vibra(70);
          return;
        }
        if (st.stun > 0 || ora - st.ultimo < RAFFICA * 1000) return;
        const q = qualita(x, st.z, larghezza(v.modo, h));
        if (q == null) {
          st.stun = MANCATO;
          st.segno = { ok: false, t: ora };
          api.invia({ k: 'm', f: st.f, t: api.ora() });
          api.vibra([50, 30, 50]);
        } else {
          st.k++;
          st.z = prossimaZona(v.seme, st.k, x);
          st.ultimo = ora;
          st.flash = 1;
          st.segno = { ok: true, q, t: ora };
          api.invia({ k: 'c', q, z: st.z, f: st.f, t: api.ora() });
          api.vibra(25);
        }
      });

      // testo con bordo che si rimpicciolisce se non ci sta nello schermo
      function testo(g, str, x, y, dim, colore = '#fff') {
        g.font = `700 ${Math.round(dim)}px Fredoka, 'Segoe UI', sans-serif`;
        const largo = g.measureText(str).width;
        if (largo > cv.w - 24) {
          dim *= (cv.w - 24) / largo;
          g.font = `700 ${Math.round(dim)}px Fredoka, 'Segoe UI', sans-serif`;
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = Math.max(4, dim * 0.16);
        g.strokeStyle = '#1b1030';
        g.strokeText(str, x, y);
        g.fillStyle = colore;
        g.fillText(str, x, y);
      }
      function barra(g, x, y, w, hh, k, colore) {
        g.beginPath();
        g.roundRect(x, y, w, hh, hh / 2);
        g.fillStyle = '#ffffff22';
        g.fill();
        if (k > 0.01) {
          g.beginPath();
          g.roundRect(x, y, Math.max(hh, w * clamp(k, 0, 1)), hh, hh / 2);
          g.fillStyle = colore;
          g.fill();
        }
        g.lineWidth = 3;
        g.strokeStyle = '#1b1030';
        g.beginPath();
        g.roundRect(x, y, w, hh, hh / 2);
        g.stroke();
      }

      function disegna(ora) {
        const { g, w, h } = cv;
        g.clearRect(0, 0, w, h);
        const m = 18;
        const dim = Math.min(w * 0.075, 30);
        testo(g, `${M.emoji} ${M.nome}`, w / 2, h * 0.05, dim);
        testo(g, `contro ${lui.nome} · ⏱ ${restano()}`, w / 2, h * 0.05 + dim * 1.2, dim * 0.75, lui.colore);

        // tifo
        const ht = mioTifo();
        testo(g, `🔥 TIFO PER TE ${Math.round(ht * 100)}%`, w / 2, h * 0.17, dim * 0.85, '#ffd23f');
        barra(g, m, h * 0.2, w - 2 * m, h * 0.035, ht, '#ff8a3d');
        testo(g, AIUTO[v.modo], w / 2, h * 0.265, dim * 0.6);

        // cursore
        const by = h * 0.31;
        const bh = h * 0.16;
        const bw = w - 2 * m;
        g.beginPath();
        g.roundRect(m, by, bw, bh, 16);
        g.fillStyle = '#2a1830';
        g.fill();
        if (v.modo === 'colpo') {
          for (const [k, c] of [
            [0.5, '#5b2a43'],
            [0.3, '#8b1e3f'],
            [0.14, '#e11d48'],
            [0.04, '#ffd23f'],
          ]) {
            g.fillStyle = c;
            g.fillRect(m + bw * (0.5 - k / 2), by, bw * k, bh);
          }
        } else {
          const lw = larghezza(v.modo, ht);
          const a = clamp(st.z - lw, 0, 1);
          const b = clamp(st.z + lw, 0, 1);
          g.fillStyle = st.flash > 0 ? '#c8ffd9' : '#4cd97b';
          g.fillRect(m + bw * a, by, bw * (b - a), bh);
          g.fillStyle = '#ffffffaa';
          g.fillRect(m + bw * st.z - 2, by, 4, bh);
        }
        const xc = st.tiro ?? tri(st.f);
        g.beginPath();
        g.roundRect(m + bw * xc - 8, by - 14, 16, bh + 28, 8);
        g.fillStyle = st.tiro != null ? '#ffd23f' : '#fff';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#1b1030';
        g.stroke();
        g.lineWidth = 4;
        g.beginPath();
        g.roundRect(m, by, bw, bh, 16);
        g.stroke();
        if (st.stun > 0) {
          g.fillStyle = 'rgba(20,10,30,0.65)';
          g.beginPath();
          g.roundRect(m, by, bw, bh, 16);
          g.fill();
          testo(g, '✗ FUORI! Bloccato…', w / 2, by + bh / 2, dim, '#ff4d6d');
        }

        // esito dell'ultimo tocco
        const ys = h * 0.55;
        const vecchio = st.segno ? (ora - st.segno.t) / 1000 : 9;
        if (v.modo === 'colpo' && st.tiro != null) testo(g, `🎯 ${precisione(st.tiro)}%`, w / 2, ys, dim * 1.8, '#ffd23f');
        else if (st.segno && st.segno.ok && vecchio < 0.6) testo(g, st.segno.q > 0.7 ? '💥 PERFETTO!' : '✓ COLPO!', w / 2, ys, dim * 1.4, '#4cd97b');
        else if (attivo()) testo(g, v.modo === 'colpo' ? 'UN COLPO SOLO: tocca al centro!' : 'TOCCA quando è nel verde!', w / 2, ys, dim * 0.95);

        // come va il duello
        const yp = h * 0.68;
        if (v.modo === 'braccio') {
          const c = live ? live.c : 0;
          const mio = lato === 0 ? -c : c; // > 0: sto vincendo io
          testo(g, mio > 0.05 ? '💪 Stai vincendo!' : mio < -0.05 ? '😬 Stai perdendo!' : '💪 Pari!', w / 2, yp, dim, mio > 0.05 ? '#4cd97b' : mio < -0.05 ? '#ff4d6d' : '#fff');
          const y = yp + dim * 1.1;
          g.beginPath();
          g.roundRect(m, y, bw, 26, 13);
          g.fillStyle = '#ffffff22';
          g.fill();
          g.fillStyle = mio >= 0 ? '#4cd97b' : '#ff4d6d';
          const cx = m + bw / 2;
          g.fillRect(Math.min(cx, cx + (mio * bw) / 2), y, Math.abs((mio * bw) / 2), 26);
          g.fillStyle = '#fff';
          g.fillRect(cx - 2, y - 6, 4, 38);
          testo(g, 'TU →', m + bw - 40, y + 50, dim * 0.6);
          testo(g, `← ${lui.nome}`, m + 60, y + 50, dim * 0.6, lui.colore);
        } else if (v.modo === 'legna') {
          const p = live ? live.p : [0, 0];
          testo(g, `🪓 Tu: ${Math.round(p[lato] * 100)}%`, w / 2, yp, dim);
          barra(g, m, yp + dim * 0.8, bw, 22, p[lato], '#4cd97b');
          testo(g, `${lui.nome}: ${Math.round(p[1 - lato] * 100)}%`, w / 2, yp + dim * 2.4, dim * 0.8, lui.colore);
          barra(g, m, yp + dim * 3.1, bw, 16, p[1 - lato], lui.colore);
        } else {
          const suo = live ? live.s[1 - lato] : null;
          testo(g, suo == null ? `${lui.nome} non ha ancora sparato…` : `${lui.nome}: ${precisione(suo)}%`, w / 2, yp, dim * 0.85, lui.colore);
        }
        testo(g, 'Tocca ovunque sullo schermo', w / 2, h - 30, dim * 0.6);
      }

      return {
        frame(ora) {
          const dt = Math.min(0.1, (ora - st.ultimoT) / 1000);
          st.ultimoT = ora;
          if (attivo()) st.f += velocita(v.modo, mioTifo()) * dt;
          st.stun = Math.max(0, st.stun - dt);
          st.flash = Math.max(0, st.flash - dt * 4);
          st.sync -= dt;
          if (st.sync <= 0 && attivo()) {
            st.sync = 0.15;
            api.invia({ k: 'f', f: st.f, t: api.ora() });
          }
          disegna(ora);
        },
        vista() {
          // dopo un rientro: se lo schermo dice che ho già sparato, niente secondo colpo
          if (v.modo === 'colpo' && live && live.s[lato] != null) st.tiro = live.s[lato];
        },
        smonta() {
          cv.distruggi();
        },
      };
    }

    // -------------------------------------------------------------------------
    // Esito del duello

    function esito() {
      const e = v.esito || {};
      const vince = e.v == null ? null : nomi()[e.v];
      let emoji;
      let titolo;
      let sotto = '';
      if (v.ruolo === 'pub') {
        if (vince == null) [emoji, titolo] = ['🤝', 'Pareggio: nessuno vince'];
        else if (v.scommessa == null) [emoji, titolo] = ['🤷', `Vince ${esc(vince.nome)}. Non avevi puntato`];
        else if (e.delta > 0) {
          [emoji, titolo] = ['💰', 'Scommessa vinta!'];
          if (e.quota === e.v) sotto = 'Quota alta: eravate in pochi a crederci!';
        } else [emoji, titolo] = ['💸', `Scommessa persa: vince ${esc(vince.nome)}`];
      } else if (vince == null) [emoji, titolo] = ['🤝', 'Pareggio!'];
      else if (e.v === v.ruolo) {
        [emoji, titolo] = ['🏆', 'HAI VINTO!'];
        if (e.miracolo) sotto = '✨ MIRACOLO! Hai vinto con meno tifo: +2 extra';
      } else [emoji, titolo] = ['💀', 'Hai perso…'];
      const d = e.delta || 0;
      box.innerHTML = `
        <div class="centro fc-esito">
          <div class="emoji-grande">${emoji}</div>
          <h1>${titolo}</h1>
          <div class="delta ${d > 0 ? 'su' : d < 0 ? 'giu' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}</div>
          ${sotto ? `<p><b>${sotto}</b></p>` : ''}
          <p>Totale: <b>${v.punti}</b> punti</p>
        </div>`;
      if (d > 0) api.vibra([60, 40, 120]);
      return null;
    }

    aggiorna(null);

    return {
      aggiorna,
      messaggio(m) {
        if (!m || m.i !== v.i) return;
        live = m;
        if (ui && ui.vista && v.fase === 'duello') ui.vista();
      },
      smonta() {
        cancelAnimationFrame(raf);
        if (ui && ui.smonta) ui.smonta();
      },
    };
  },
};
