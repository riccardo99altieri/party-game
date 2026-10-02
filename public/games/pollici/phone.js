// Mani Incrociate sul telefono: due binari scorrono verso il basso e i due pollici devono
// restarci sopra senza mai staccarsi. Se un pollice si stacca o esce dal binario: lampo
// rosso, 1,5 s fermi, poi i binari tornano comodi e si riparte dai due cerchi.

import { TAU, fmtNum, lerp } from '../../shared/util.js';
import { creaPista, LUNGHEZZA, COMODO, RIF, PAUSA, GRAZIA, TOLLERANZA, COLORI, FIGURE, combo, velocita, semiLarghezza, distanza } from './pista.js';
import { cattura } from '../../phone/widgets.js';

const INVIO = 150; // ms tra un avanzamento e l'altro
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export default {
  id: 'pollici',
  monta(el, api, s) {
    el.innerHTML = `
      <div class="mi">
        <div class="mi-campo"></div>
        <div class="mi-hud"><span class="mi-sx"></span><span class="mi-combo"></span><span class="mi-err"></span></div>
        <div class="tel-msg" hidden></div>
      </div>
      <style>
        .mi { position:absolute; inset:0; background:linear-gradient(#1a0d33, #0f0820); overflow:hidden; }
        .mi-campo { position:absolute; inset:0; touch-action:none; }
        .mi-hud { position:absolute; left:0; right:0; top:0; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 14px; font-size:19px; font-weight:700; pointer-events:none; text-shadow:0 2px 0 rgba(0,0,0,.55); z-index:2; }
        .mi-combo { color:#ffd23f; font-size:22px; }
      </style>`;
    const campo = el.querySelector('.mi-campo');
    const hudSx = el.querySelector('.mi-sx');
    const hudCombo = el.querySelector('.mi-combo');
    const hudErr = el.querySelector('.mi-err');
    const msg = el.querySelector('.tel-msg');

    let v = s || {};
    let pista = null;
    let semeCaricato = null;
    let stato = 'attesa'; // attesa | corre | giu | fatto
    let sPos = 0;
    let sReset = 0;
    let sResetPrima = 0;
    let pulito = 0;
    let errori = 0;
    let tGiu = 0;
    let motivo = null;
    let fineMs = null;
    let posGara = null;
    let arrivo = null;
    let ultimoInvio = 0;
    let prima = performance.now();
    let raf = 0;
    const dita = new Map(); // pointerId -> [x, y]
    let presa = [null, null]; // il dito sul binario rosso e quello sul blu
    let fuoriDa = [0, 0];
    let allarme = [0, 0]; // quanto il pollice è vicino al bordo (1 = fuori)

    const cv = api.widgets.canvasPieno(campo, () => {});

    function prepara() {
      semeCaricato = v.seme;
      pista = creaPista(v.seme || 1);
      stato = 'attesa';
      sPos = 0;
      sReset = 0;
      sResetPrima = 0;
      pulito = 0;
      errori = 0;
      fineMs = null;
      arrivo = null;
      presa = [null, null];
      msg.hidden = true;
    }

    const tempo = () => (v.inizio != null ? (api.ora() - v.inizio) / 1000 : -1);
    const yDi = (c) => RIF * cv.h - (c - sPos) * cv.h;
    const cDi = (y) => sPos + (RIF * cv.h - y) / cv.h;
    const raggio = () => Math.max(34, semiLarghezza(sPos) * cv.w * 1.4);
    // Dopo un errore i binari scivolano in mezzo secondo nella posizione comoda.
    function posDisegno(c) {
      const ora = pista.pos(c, sReset);
      if (stato !== 'giu' || tGiu >= 0.45) return ora;
      const k = ss(tGiu / 0.45);
      const vecchi = pista.pos(c, sResetPrima);
      return [lerp(vecchi[0], ora[0], k), lerp(vecchi[1], ora[1], k)];
    }

    // --- dita
    campo.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cattura(campo, e.pointerId);
      dita.set(e.pointerId, cv.punto(e));
    });
    campo.addEventListener('pointermove', (e) => {
      if (dita.has(e.pointerId)) dita.set(e.pointerId, cv.punto(e));
    });
    const su = (e) => {
      dita.delete(e.pointerId);
      const j = presa.indexOf(e.pointerId);
      if (j < 0) return;
      if (stato === 'corre') cade('staccato');
      else presa[j] = null;
    };
    campo.addEventListener('pointerup', su);
    campo.addEventListener('pointercancel', su);

    // --- regole
    function cade(m) {
      if (stato !== 'corre') return;
      stato = 'giu';
      tGiu = 0;
      motivo = m;
      errori++;
      pulito = 0;
      sResetPrima = sReset;
      sReset = sPos;
      presa = [null, null];
      fuoriDa = [0, 0];
      allarme = [0, 0];
      api.vibra([200, 80, 200]);
      api.invia({ cade: m, s: sPos, e: errori });
    }

    function parti() {
      stato = 'corre';
      pulito = 0;
      fuoriDa = [0, 0];
      ultimoInvio = performance.now();
      api.vibra(30);
      api.invia({ st: 'corre', s: sPos, c: 1, e: errori });
    }

    function arriva() {
      stato = 'fatto';
      sPos = LUNGHEZZA;
      fineMs = Math.max(0, Math.round(api.ora() - v.inizio));
      api.invia({ fatto: fineMs, e: errori, s: LUNGHEZZA });
      api.vibra([60, 60, 60]);
      mostraMsg();
    }

    // In attesa: un pollice su ogni cerchio (anche prima del VIA), poi si parte.
    function aggancia(t) {
      const R = raggio();
      for (let j = 0; j < 2; j++) {
        const cx = COMODO[j] * cv.w;
        const cy = RIF * cv.h;
        if (presa[j] != null) {
          const p = dita.get(presa[j]);
          if (!p || Math.hypot(p[0] - cx, p[1] - cy) > R * 1.6) presa[j] = null;
        }
        if (presa[j] != null) continue;
        for (const [id, p] of dita) {
          if (presa.includes(id)) continue;
          if (Math.hypot(p[0] - cx, p[1] - cy) <= R) {
            presa[j] = id;
            api.vibra(20);
            break;
          }
        }
      }
      if (presa[0] != null && presa[1] != null && t >= 0 && !v.finito) parti();
    }

    function controlla(dt) {
      for (let j = 0; j < 2; j++) {
        const p = dita.get(presa[j]);
        if (!p) return cade('staccato');
        const { d, semi } = distanza(pista, j, p[0], p[1], sPos, sReset, cv.w, cv.h);
        allarme[j] = d / (semi * TOLLERANZA);
        if (allarme[j] > 1) {
          fuoriDa[j] += dt;
          if (fuoriDa[j] > GRAZIA) return cade('fuori');
        } else fuoriDa[j] = 0;
      }
    }

    // --- disegno
    function binario(g, j, semi) {
      const { w, h } = cv;
      const punti = [];
      for (let y = h + 12; y >= -12; y -= 6) punti.push([posDisegno(cDi(y))[j] * w, y]);
      const linea = (dx) => {
        g.beginPath();
        punti.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y)));
        g.stroke();
      };
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = COLORI[j];
      g.globalAlpha = 0.16;
      g.lineWidth = semi * 2 + 16;
      linea(0);
      g.globalAlpha = 0.34;
      g.lineWidth = semi * 2;
      linea(0);
      // traversine che scorrono
      g.globalAlpha = 0.28;
      g.strokeStyle = '#fff';
      g.lineWidth = 5;
      const passo = 0.1;
      for (let c = Math.ceil(cDi(h + 12) / passo) * passo; c <= cDi(-12); c += passo) {
        const x = posDisegno(c)[j] * w;
        const y = yDi(c);
        g.beginPath();
        g.moveTo(x - semi * 0.85, y);
        g.lineTo(x + semi * 0.85, y);
        g.stroke();
      }
      // rotaie
      g.globalAlpha = 1;
      g.strokeStyle = COLORI[j];
      g.lineWidth = 3.5;
      linea(-semi * 0.9);
      linea(semi * 0.9);
    }

    function testoCentro(g, str, x, y, dim, colore = '#fff', alpha = 1) {
      g.globalAlpha = alpha;
      g.font = `700 ${dim}px Fredoka, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = Math.max(3, dim * 0.16);
      g.strokeStyle = 'rgba(15,8,32,0.9)';
      g.strokeText(str, x, y);
      g.fillStyle = colore;
      g.fillText(str, x, y);
      g.globalAlpha = 1;
    }

    function disegna(t, ms) {
      const { g, w, h } = cv;
      g.clearRect(0, 0, w, h);
      if (!pista) return;
      const semi = semiLarghezza(sPos + 0.2) * w;
      // righe del terreno che scorrono
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 2;
      for (let c = Math.ceil(cDi(h) / 0.25) * 0.25; c <= cDi(0); c += 0.25) {
        g.beginPath();
        g.moveTo(0, yDi(c));
        g.lineTo(w, yDi(c));
        g.stroke();
      }
      // traguardo a scacchi
      const yF = yDi(LUNGHEZZA);
      if (yF > -30 && yF < h + 30) {
        const q = Math.max(12, w / 24);
        for (let i = 0; i * q < w; i++) {
          for (let k = 0; k < 2; k++) {
            g.fillStyle = (i + k) % 2 ? '#1b1030' : '#fff';
            g.fillRect(i * q, yF - q + k * q, q, q);
          }
        }
      }
      // nomi delle figure che arrivano
      for (const f of pista.figure) {
        const y = yDi(f.s0 - 0.12);
        if (y < 40 || y > h) continue;
        const a = y > RIF * h ? Math.max(0, 1 - (y - RIF * h) / 80) : 0.75;
        testoCentro(g, FIGURE[f.tipo].nome, w / 2, y, Math.round(Math.min(26, w * 0.065)), '#fff', a);
      }
      binario(g, 0, semi);
      binario(g, 1, semi);

      // cerchi di partenza
      if (stato === 'attesa') {
        const R = raggio();
        const pul = 1 + Math.sin(ms / 160) * 0.07;
        for (let j = 0; j < 2; j++) {
          const x = COMODO[j] * w;
          const y = RIF * h;
          const preso = presa[j] != null;
          g.beginPath();
          g.arc(x, y, R * (preso ? 1 : pul), 0, TAU);
          g.fillStyle = COLORI[j];
          g.globalAlpha = preso ? 0.85 : 0.4;
          g.fill();
          g.globalAlpha = 1;
          g.lineWidth = 4;
          g.strokeStyle = '#fff';
          if (!preso) g.setLineDash([10, 8]);
          g.stroke();
          g.setLineDash([]);
          testoCentro(g, preso ? '✓' : '👍', x, y, Math.round(R * 0.8));
          testoCentro(g, j === 0 ? 'SINISTRO' : 'DESTRO', x, y + R + 18, 17, COLORI[j]);
        }
        let riga = t < 0 || v.inizio == null ? 'Metti i pollici sui cerchi!' : errori ? 'Rimetti i pollici per ripartire!' : 'Pollici sui cerchi per partire!';
        if (presa[0] != null && presa[1] != null && (t < 0 || v.inizio == null)) riga = 'Pronti… non staccarli!';
        testoCentro(g, riga, w / 2, h * 0.3, Math.round(Math.min(26, w * 0.066)), '#ffd23f');
        if (t < 0 || v.inizio == null) testoCentro(g, '📱 In verticale, due mani, solo i pollici', w / 2, h * 0.3 + 38, Math.round(Math.min(18, w * 0.046)));
      }

      // pollici
      for (const [id, p] of dita) {
        const j = presa.indexOf(id);
        g.beginPath();
        g.arc(p[0], p[1], j >= 0 ? 30 : 16, 0, TAU);
        if (j < 0) {
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fill();
          continue;
        }
        g.fillStyle = COLORI[j];
        g.globalAlpha = 0.3;
        g.fill();
        g.globalAlpha = 1;
        const a = stato === 'corre' ? allarme[j] : 0;
        g.lineWidth = 5;
        g.strokeStyle = a > 1 ? (Math.floor(ms / 70) % 2 ? '#ff3b5c' : '#fff') : a > 0.7 ? '#ffd23f' : '#fff';
        g.stroke();
      }

      // errore: lampo rosso e pausa
      if (stato === 'giu') {
        const lampo = Math.max(0, 1 - tGiu / 0.5);
        g.fillStyle = `rgba(255,30,60,${(0.18 + 0.5 * lampo).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
        testoCentro(g, motivo === 'staccato' ? '✋ Pollice staccato!' : '💥 Fuori dal binario!', w / 2, h * 0.36, Math.round(Math.min(32, w * 0.08)));
        testoCentro(g, `Fermo: ${fmtNum(Math.max(0, PAUSA - tGiu), 1)} s`, w / 2, h * 0.36 + 44, Math.round(Math.min(24, w * 0.06)), '#ffd23f');
      }
    }

    function mostraMsg() {
      if (stato === 'fatto') {
        msg.hidden = false;
        const pos = arrivo ? `<br>Posizione: ${arrivo}°` : '';
        msg.innerHTML = `<div class="emoji-grande">🏁</div><h1>Traguardo!</h1><p>${fmtNum(fineMs / 1000, 1)} s · ${errori} ${errori === 1 ? 'errore' : 'errori'}${pos}</p>`;
      } else if (v.finito) {
        msg.hidden = false;
        msg.innerHTML = `<div class="emoji-grande">⏰</div><h1>Gara finita!</h1><p>Hai fatto il ${Math.round((sPos / LUNGHEZZA) * 100)}% del percorso.<br>Guarda lo schermo.</p>`;
      }
    }

    function loop() {
      const ms = performance.now();
      const dt = Math.min(0.1, Math.max(0, (ms - prima) / 1000));
      prima = ms;
      const t = tempo();
      if (stato === 'corre' && !v.finito) {
        const c = combo(pulito);
        sPos += velocita(sPos, c) * dt;
        pulito += dt;
        if (sPos >= LUNGHEZZA) arriva();
        else controlla(dt);
        if (stato === 'corre' && ms - ultimoInvio >= INVIO) {
          ultimoInvio = ms;
          api.invia({ s: sPos, c, e: errori, st: 'corre' });
        }
      } else if (stato === 'giu') {
        tGiu += dt;
        if (tGiu >= PAUSA) stato = 'attesa';
      }
      if (stato === 'attesa') aggancia(t);
      disegna(t, ms);
      // HUD
      const perc = `🏁 ${Math.round((Math.min(sPos, LUNGHEZZA) / LUNGHEZZA) * 100)}%`;
      hudSx.textContent = posGara && stato !== 'fatto' ? `${perc} · ${posGara.pos}°/${posGara.tot}` : perc;
      const c = combo(pulito);
      hudCombo.textContent = stato === 'corre' && c >= 1.05 ? `🔥 ×${fmtNum(c, 1)}` : '';
      hudErr.textContent = `❌ ${errori}`;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function aggiorna(nv) {
      v = nv || v;
      if (v.seme !== semeCaricato) prepara();
      if (v.finito) mostraMsg();
    }
    // utile per le prove automatiche nel browser
    campo.statoProva = () => ({ seme: v.seme, stato, s: sPos, sReset, errori, w: cv.w, h: cv.h, presa: [...presa] });
    aggiorna(null);

    return {
      aggiorna,
      messaggio(d) {
        if (!d) return;
        if (d.pos) posGara = { pos: d.pos, tot: d.tot };
        if (d.arrivo) {
          arrivo = d.arrivo;
          mostraMsg();
        }
      },
      smonta() {
        cancelAnimationFrame(raf);
        cv.distruggi();
      },
    };
  },
};
