// Le cinque schermate dei ruoli sul telefono. Ognuna riceve le sue sfide (dal seme) e
// l'oggetto ui: ui.sbaglia(i, motivo) quando una sfida fallisce (i = indice della sfida,
// -1 se l'errore è solo tuo), ui.bene(testo), ui.vibra(ms), ui.inversione(t), ui.ospite()
// (vero quando si fa il ruolo di un altro per uno scambio).
// Interfaccia comune: entra(t), esci(), passo(t, dt, w, h), giu/muovi/su(id, x, y, t, w, h),
// disegna(g, w, h, t).

import { TAU, clamp } from '../../shared/util.js';
import { GRAZIA_INGRESSO, GIOCOLIERE, SPORCO, SCHIZZI, OPPOSTO, creaSporco, cursore, verde, nelVerde } from './regole.js';

// Il tocco arriva al telefono un attimo dopo il dito: si giudica un po' prima.
export const LATENZA = 0.03;
export const COLORI_PAD = ['#ff3b5c', '#ffd23f', '#3ec6ff'];

export function testoCentro(g, str, x, y, dim, colore = '#fff', alpha = 1) {
  g.globalAlpha = alpha;
  g.font = `700 ${dim}px Fredoka, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, dim * 0.16);
  g.strokeStyle = 'rgba(15,8,32,0.9)';
  g.strokeText(str, x, y);
  g.fillStyle = colore;
  g.fillText(str, x, y);
  g.globalAlpha = 1;
}

// Le sfide di un ruolo, una dopo l'altra. Entrando nel ruolo si saltano quelle già cominciate.
function scorre(lista) {
  let k = 0;
  return {
    salta(t) {
      while (k < lista.length && lista[k].t0 < t + GRAZIA_INGRESSO) k++;
    },
    nuova(t) {
      return k < lista.length && lista[k].t0 <= t ? lista[k++] : null;
    },
  };
}

// Cerchio che si svuota: quanto tempo resta per la sfida.
function anelloTempo(g, x, y, r, k, colore) {
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k, 0, 1));
  g.strokeStyle = colore;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.stroke();
}

// ---------------------------------------------------------------------------
// 🥁 Batterista: chiamata (le luci) e risposta (rifarla a tempo).

// I tre pad in basso (rettangoli in px).
export function padsBatterista(w, h) {
  const m = w * 0.05;
  const gap = w * 0.035;
  const pw = (w - 2 * m - 2 * gap) / 3;
  const ph = Math.min(h * 0.4, pw * 1.9);
  return [0, 1, 2].map((p) => ({ x: m + p * (pw + gap), y: h * 0.52, w: pw, h: ph }));
}

export function creaBatterista(prog, ui) {
  const it = scorre(prog.batterista);
  let c = null;
  let k = 0;
  let chiusa = false;
  let esito = null;
  const tocchi = [-9, -9, -9];

  return {
    entra(t) {
      it.salta(t);
      c = null;
    },
    esci() {
      c = null;
    },
    passo(t) {
      const n = it.nuova(t);
      if (n) {
        c = n;
        k = 0;
        chiusa = false;
        esito = null;
      }
      if (c && !chiusa && t - LATENZA > c.tR + k * c.b + c.tol) {
        chiusa = true;
        esito = { ok: false, t };
        ui.sbaglia(c.i, 'Nota saltata!');
      }
    },
    giu(id, x, y, t, w, h) {
      const p = padsBatterista(w, h).findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (p < 0) return;
      tocchi[p] = t;
      ui.vibra(12);
      if (!c || chiusa) return;
      const tt = t - LATENZA;
      if (tt < c.tR - c.tol) return; // durante la chiamata si può battere il tempo
      const T = c.tR + k * c.b;
      const giusto = p === c.note[k];
      if (Math.abs(tt - T) <= c.tol && giusto) {
        k++;
        if (k >= c.note.length) {
          chiusa = true;
          esito = { ok: true, t };
          ui.bene('Perfetto!');
        }
        return;
      }
      chiusa = true;
      esito = { ok: false, t };
      ui.sbaglia(c.i, Math.abs(tt - T) <= c.tol ? 'Pad sbagliato!' : tt < T ? 'Troppo presto!' : 'Troppo tardi!');
    },
    muovi() {},
    su() {},
    disegna(g, w, h, t) {
      const geo = padsBatterista(w, h);
      const L = c ? c.note.length : 3;
      // le caselle della sequenza e il cursore del tempo
      const sy = h * 0.27;
      const passo = Math.min(w * 0.19, 86);
      const r = Math.min(passo * 0.36, 30);
      const sx = (j) => w / 2 + (j - (L - 1) / 2) * passo;
      let fase = 'pausa';
      if (c) {
        if (t < c.t0 + L * c.b) fase = 'chiamata';
        else if (t < c.tR - c.b * 0.5) fase = 'pronti';
        else if (!esito) fase = 'risposta';
        else fase = esito.ok ? 'bene' : 'male';
      }
      const titolo = { pausa: '🥁 Pronti…', chiamata: '👀 GUARDA LE LUCI', pronti: '🥁 TOCCA A TE…', risposta: '🥁 RIFALLA A TEMPO!', bene: '✨ Perfetto!', male: '❌ Sbagliato!' }[fase];
      testoCentro(g, titolo, w / 2, h * 0.1, Math.round(Math.min(30, w * 0.075)), fase === 'risposta' || fase === 'pronti' ? '#ffd23f' : fase === 'male' ? '#ff6b81' : '#fff');
      for (let j = 0; j < L; j++) {
        let col = null;
        if (c) {
          const d = t - (c.t0 + j * c.b);
          if (d >= 0 && d < c.b * 0.7 && t < c.tR - c.b) col = COLORI_PAD[c.note[j]];
          if (j < k) col = COLORI_PAD[c.note[j]];
          if (esito && !esito.ok && t - esito.t < 1.2) col = COLORI_PAD[c.note[j]]; // dopo l'errore si vede com'era
        }
        g.beginPath();
        g.arc(sx(j), sy, r, 0, TAU);
        g.fillStyle = col || 'rgba(255,255,255,0.08)';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = col ? '#fff' : 'rgba(255,255,255,0.35)';
        g.stroke();
        if (!col && c && t >= c.tR - c.b) testoCentro(g, '?', sx(j), sy + 1, r, 'rgba(255,255,255,0.4)');
      }
      if (c && (fase === 'chiamata' || fase === 'pronti' || fase === 'risposta')) {
        const base = fase === 'chiamata' ? c.t0 : c.tR;
        const pos = (t - base) / c.b;
        const x = w / 2 + (pos - (L - 1) / 2) * passo;
        if (pos > -1.2 && pos < L - 0.4) {
          g.fillStyle = fase === 'chiamata' ? 'rgba(255,255,255,0.8)' : '#ffd23f';
          g.beginPath();
          g.moveTo(x, sy + r + 8);
          g.lineTo(x - 10, sy + r + 24);
          g.lineTo(x + 10, sy + r + 24);
          g.closePath();
          g.fill();
          g.fillRect(x - 2, sy - r - 10, 4, 2 * r + 20);
        }
      }
      // i pad
      geo.forEach((p, j) => {
        let luce = 0;
        if (c && t < c.tR - c.b * 0.6) {
          c.note.forEach((q, i) => {
            const d = t - (c.t0 + i * c.b);
            if (q === j && d >= 0 && d < c.b * 0.6) luce = Math.max(luce, 1 - d / (c.b * 0.6));
          });
        }
        const premuto = clamp(1 - (t - tocchi[j]) / 0.15, 0, 1);
        g.save();
        g.beginPath();
        g.roundRect(p.x, p.y + premuto * 4, p.w, p.h - premuto * 4, 22);
        g.fillStyle = COLORI_PAD[j];
        g.globalAlpha = 0.45 + 0.55 * Math.max(luce, premuto * 0.6);
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = luce > 0 ? 7 : 4;
        g.strokeStyle = luce > 0 ? '#fff' : 'rgba(255,255,255,0.4)';
        g.stroke();
        if (luce > 0) {
          g.shadowColor = COLORI_PAD[j];
          g.shadowBlur = 40 * luce;
          g.stroke();
        }
        g.restore();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 🤹 Giocoliere: tre dita su tre dei quattro cerchi, si sposta quella indicata.

// I quattro cerchi (2 × 2) e il loro raggio, in px.
export function centriGiocoliere(w, h) {
  const dx = Math.min(w * 0.22, 100);
  const dy = Math.min(h * 0.14, 110);
  const cy = h * 0.56;
  return [
    [w / 2 - dx, cy - dy],
    [w / 2 + dx, cy - dy],
    [w / 2 - dx, cy + dy],
    [w / 2 + dx, cy + dy],
  ];
}
export const raggioGiocoliere = (w, h) => Math.min(w * 0.19, h * 0.12, 82);

export function creaGiocoliere(prog, ui) {
  const it = scorre(prog.giocoliere);
  let tiene = [0, 1, 2];
  let stato = 'setup'; // setup | pronto | sfida
  let setupDa = 0;
  let c = null;
  let da = -1;
  let a = -1;
  let fuori = 0;
  let ultimoOk = -9;
  const dita = new Map();
  const centri = centriGiocoliere;
  const raggio = raggioGiocoliere;

  function tenuti(w, h) {
    const C = centri(w, h);
    const R = raggio(w, h) * 1.35;
    return C.map(([x, y]) => [...dita.values()].some(([px, py]) => Math.hypot(px - x, py - y) <= R));
  }

  function errore(t, motivo) {
    ui.sbaglia(stato === 'sfida' && c ? c.i : -1, motivo);
    if (stato === 'sfida') tiene = tiene.filter((i) => i !== da).concat(a);
    stato = 'setup';
    setupDa = t;
    c = null;
    fuori = 0;
  }

  return {
    entra(t) {
      it.salta(t);
      stato = 'setup';
      setupDa = t;
      c = null;
      dita.clear();
    },
    esci() {
      c = null;
      stato = 'setup';
    },
    passo(t, dt, w, h, inGioco) {
      const held = tenuti(w, h);
      if (stato === 'setup') {
        while (it.nuova(t)); // le sfide che arrivano mentre si sistemano le dita saltano
        if (tiene.every((i) => held[i])) {
          stato = 'pronto';
          fuori = 0;
          ui.vibra(25);
        } else if (inGioco && !ui.ospite?.() && t - Math.max(0, setupDa) > GIOCOLIERE.setup) {
          // (chi arriva qui per uno scambio non viene punito se non fa in tempo a sistemarsi)
          ui.sbaglia(-1, 'Metti 3 dita sui cerchi!');
          setupDa = t;
        }
        return;
      }
      if (!inGioco && t < 0) {
        // prima del VIA si possono ancora sistemare le dita
        if (!tiene.every((i) => held[i])) stato = 'setup';
        return;
      }
      if (stato === 'pronto') {
        const n = it.nuova(t);
        if (n) {
          c = n;
          da = [...tiene].sort((x, y) => x - y)[c.j];
          a = [0, 1, 2, 3].find((i) => !tiene.includes(i));
          stato = 'sfida';
          ui.vibra(30);
        }
      }
      const ferme = stato === 'sfida' ? tiene.filter((i) => i !== da) : tiene;
      if (ferme.some((i) => !held[i])) {
        fuori += dt;
        if (fuori > 0.12) return errore(t, 'Dito staccato!');
      } else fuori = 0;
      if (stato === 'sfida') {
        if (held[a] && !held[da]) {
          tiene = tiene.filter((i) => i !== da).concat(a);
          stato = 'pronto';
          c = null;
          ultimoOk = t;
          ui.bene('Bravo!');
        } else if (t > c.fine) errore(t, 'Troppo lento!');
      }
    },
    giu(id, x, y) {
      dita.set(id, [x, y]);
    },
    muovi(id, x, y) {
      if (dita.has(id)) dita.set(id, [x, y]);
    },
    su(id) {
      dita.delete(id);
    },
    disegna(g, w, h, t) {
      const C = centri(w, h);
      const R = raggio(w, h);
      const held = tenuti(w, h);
      const titolo = stato === 'setup' ? '✋ 3 dita sui cerchi BLU!' : stato === 'sfida' ? '➡️ SPOSTA IL DITO!' : t - ultimoOk < 0.6 ? '✨ Bravo!' : '🤹 Tieni fermo…';
      testoCentro(g, titolo, w / 2, h * 0.1, Math.round(Math.min(28, w * 0.072)), stato === 'sfida' ? '#ffd23f' : '#fff');
      if (stato === 'sfida' && da >= 0) {
        // freccia dal cerchio da lasciare a quello nuovo
        const [x0, y0] = C[da];
        const [x1, y1] = C[a];
        g.strokeStyle = 'rgba(255,210,63,0.85)';
        g.lineWidth = 10;
        g.lineCap = 'round';
        g.setLineDash([16, 14]);
        g.lineDashOffset = -t * 60;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
        g.setLineDash([]);
      }
      C.forEach(([x, y], i) => {
        let col = 'rgba(255,255,255,0.12)';
        let scritta = '';
        if (stato === 'setup' && tiene.includes(i)) {
          col = '#3e8bff';
          scritta = 'TIENI';
        } else if (stato !== 'setup' && tiene.includes(i)) {
          col = '#3e8bff';
          scritta = 'TIENI';
          if (stato === 'sfida' && i === da) {
            col = '#ff8a3d';
            scritta = 'LASCIA';
          }
        }
        if (stato === 'sfida' && i === a) {
          col = '#2ecc71';
          scritta = 'VAI!';
        }
        const pul = stato === 'sfida' && i === a ? 1 + Math.sin(t * 14) * 0.05 : 1;
        g.beginPath();
        g.arc(x, y, R * pul, 0, TAU);
        g.fillStyle = col;
        g.globalAlpha = held[i] ? 1 : 0.55;
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = 4;
        g.strokeStyle = held[i] ? '#fff' : 'rgba(255,255,255,0.45)';
        if (!held[i] && scritta) g.setLineDash([10, 8]);
        g.stroke();
        g.setLineDash([]);
        if (scritta) testoCentro(g, scritta, x, y, Math.round(R * 0.32));
        if (stato === 'sfida' && i === a && c) anelloTempo(g, x, y, R + 10, 1 - (t - c.t0) / (c.fine - c.t0), '#ffd23f');
      });
      for (const [x, y] of dita.values()) {
        g.beginPath();
        g.arc(x, y, 22, 0, TAU);
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.fill();
      }
      if (stato === 'setup') testoCentro(g, '📱 Telefono sul tavolo, una mano sola', w / 2, h * 0.92, Math.round(Math.min(18, w * 0.046)), '#ffd23f');
    },
  };
}

// ---------------------------------------------------------------------------
// 🧽 Straccio: strofinare via pomodori, uova e torte prima che la barra si riempia.

const COLORI_SCHIZZI = { pomodoro: [214, 32, 47], uovo: [245, 190, 30], torta: [110, 62, 34] };
const EMOJI_SCHIZZI = { pomodoro: '🍅', uovo: '🥚', torta: '🥧' };
const VOLO = 0.3;

export function creaStraccio(prog, ui) {
  const lista = prog.straccio;
  let k = 0;
  const sporco = creaSporco();
  let tregua = 0;
  let ultimo = -1;
  let volano = [];
  let lampi = [];
  const dita = new Map();
  let bolle = [];
  let mini = null;
  let img = null;

  return {
    entra(t) {
      while (k < lista.length && lista[k].t0 < t) k++;
      volano = [];
      dita.clear();
    },
    esci() {
      dita.clear();
    },
    passo(t, dt, w, h, inGioco) {
      // ogni schizzo si vede arrivare un attimo prima di sporcare
      while (k < lista.length && lista[k].t0 - VOLO <= t) volano.push(lista[k++]);
      for (const s of volano) {
        if (t >= s.t0) {
          sporco.schizza(s, w, h);
          ultimo = s.i;
          lampi.push({ x: s.x * w, y: s.y * h, r: s.r * w, t, tipo: s.tipo });
          ui.vibra(20);
        }
      }
      volano = volano.filter((s) => t < s.t0);
      lampi = lampi.filter((l) => t - l.t < 0.35);
      for (const b of bolle) b.v -= dt;
      bolle = bolle.filter((b) => b.v > 0);
      if (inGioco && sporco.livello() >= 1 && t >= tregua) {
        ui.sbaglia(ultimo, 'Troppo sporco!');
        sporco.salva();
        tregua = t + SPORCO.tregua;
      }
    },
    giu(id, x, y) {
      dita.set(id, [x, y]);
    },
    muovi(id, x, y, t, w, h) {
      const p = dita.get(id);
      if (!p) return;
      const lun = Math.hypot(x - p[0], y - p[1]);
      // il dito pulisce tutto il tratto, anche quando il telefono manda pochi punti
      const passi = Math.max(1, Math.ceil(lun / 12));
      for (let k = 1; k <= passi; k++) sporco.pulisci(p[0] + ((x - p[0]) * k) / passi, p[1] + ((y - p[1]) * k) / passi, lun / passi, w, h);
      dita.set(id, [x, y]);
      if (lun > 6 && bolle.length < 40 && Math.random() < 0.5) bolle.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, r: 4 + Math.random() * 8, v: 0.5 });
    },
    su(id) {
      dita.delete(id);
    },
    disegna(g, w, h, t) {
      // il vetro da pulire
      const vetro = g.createLinearGradient(0, 0, w, h);
      vetro.addColorStop(0, '#d9efff');
      vetro.addColorStop(1, '#a9d4f5');
      g.fillStyle = vetro;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(w * 0.1, h * 0.35);
      g.lineTo(w * 0.35, h * 0.1);
      g.moveTo(w * 0.15, h * 0.45);
      g.lineTo(w * 0.48, h * 0.12);
      g.stroke();
      // lo sporco: una griglia piccola ingrandita con lo sfumato, così sembrano macchie
      const { cols, righe, cella, tipo } = sporco;
      if (!mini) {
        mini = document.createElement('canvas');
        mini.width = cols;
        mini.height = righe;
        img = mini.getContext('2d').createImageData(cols, righe);
      }
      for (let i = 0; i < cols * righe; i++) {
        const c = COLORI_SCHIZZI[SCHIZZI[tipo[i]]] || COLORI_SCHIZZI.pomodoro;
        img.data[i * 4] = c[0];
        img.data[i * 4 + 1] = c[1];
        img.data[i * 4 + 2] = c[2];
        img.data[i * 4 + 3] = Math.round(Math.min(1, cella[i] * 1.4) ** 0.7 * 245);
      }
      mini.getContext('2d').putImageData(img, 0, 0);
      g.save();
      g.imageSmoothingEnabled = true;
      g.drawImage(mini, 0, 0, w, h);
      g.restore();
      // schizzi appena arrivati
      for (const l of lampi) {
        const k = (t - l.t) / 0.35;
        g.globalAlpha = 1 - k;
        g.beginPath();
        g.arc(l.x, l.y, l.r * (0.7 + k * 0.6), 0, TAU);
        g.fillStyle = `rgb(${COLORI_SCHIZZI[l.tipo].join(',')})`;
        g.fill();
        g.globalAlpha = 1;
      }
      // in volo: crescono verso lo schermo
      for (const s of volano) {
        const k = clamp(1 - (s.t0 - t) / VOLO, 0, 1);
        testoCentro(g, EMOJI_SCHIZZI[s.tipo], s.x * w, s.y * h, Math.round(14 + k * k * 70), '#fff', 0.5 + k * 0.5);
      }
      for (const b of bolle) {
        g.beginPath();
        g.arc(b.x, b.y - (0.5 - b.v) * 30, b.r, 0, TAU);
        g.strokeStyle = `rgba(255,255,255,${(b.v * 1.6).toFixed(2)})`;
        g.lineWidth = 2;
        g.stroke();
      }
      for (const [x, y] of dita.values()) testoCentro(g, '🧽', x, y, 44);
      // barra dello sporco, in alto
      const liv = clamp(sporco.livello(), 0, 1);
      const bx = w * 0.08;
      const bw = w * 0.84;
      const by = h * 0.035;
      g.fillStyle = 'rgba(15,8,32,0.8)';
      g.beginPath();
      g.roundRect(bx - 4, by - 4, bw + 8, 30, 15);
      g.fill();
      const pericolo = liv > 0.75;
      g.fillStyle = pericolo ? (Math.floor(t * 8) % 2 ? '#ff2d55' : '#ff8a3d') : liv > 0.5 ? '#ffb020' : '#a3e635';
      g.beginPath();
      g.roundRect(bx, by, Math.max(22, bw * liv), 22, 11);
      g.fill();
      testoCentro(g, `🤢 SPORCO ${Math.round(liv * 100)}%`, w / 2, by + 11, 16);
      if (!dita.size) testoCentro(g, '👆 STROFINA!', w / 2, h * 0.5, Math.round(Math.min(40, w * 0.1)), '#ff8a3d', 0.6 + 0.4 * Math.sin(t * 8));
    },
  };
}

// ---------------------------------------------------------------------------
// 🎯 Cecchino: tocca quando il cursore è nel verde.

export function creaCecchino(prog, ui) {
  const it = scorre(prog.cecchino);
  let c = null;
  let chiusa = false;
  let esito = null;

  return {
    entra(t) {
      it.salta(t);
      c = null;
    },
    esci() {
      c = null;
    },
    passo(t) {
      const n = it.nuova(t);
      if (n) {
        c = n;
        chiusa = false;
        esito = null;
        ui.vibra(20);
      }
      if (c && !chiusa && t > c.fine) {
        chiusa = true;
        esito = { ok: false, t, pos: null };
        ui.sbaglia(c.i, 'Troppo tardi!');
      }
    },
    giu(id, x, y, t) {
      if (!c || chiusa || t < c.t0) return;
      chiusa = true;
      const tt = t - LATENZA;
      esito = { ok: nelVerde(tt), t, pos: cursore(tt) };
      if (esito.ok) ui.bene('Colpito!');
      else ui.sbaglia(c.i, 'Fuori dal verde!');
    },
    muovi() {},
    su() {},
    disegna(g, w, h, t) {
      const tt = Math.max(0, t);
      const bx = w * 0.07;
      const bw = w * 0.86;
      const by = h * 0.5;
      const bh = Math.min(84, h * 0.12);
      const attiva = c && !chiusa && t >= c.t0;
      // bersaglio sopra la barra
      const ty = h * 0.25;
      const scoppio = esito && esito.ok && t - esito.t < 0.5;
      if (scoppio) {
        const k = (t - esito.t) / 0.5;
        testoCentro(g, '💥', w / 2, ty, Math.round(70 + k * 40), '#fff', 1 - k);
      } else {
        testoCentro(g, attiva ? '🎈' : '🎯', w / 2, ty + (attiva ? Math.sin(t * 5) * 6 : 0), Math.round(Math.min(80, w * 0.2)), '#fff', attiva ? 1 : 0.4);
      }
      if (attiva) anelloTempo(g, w / 2, ty, Math.min(64, w * 0.17), 1 - (t - c.t0) / (c.fine - c.t0), '#ffd23f');
      const titolo = attiva ? '🎯 SPARA!' : esito ? (esito.ok ? '💥 Colpito!' : '❌ Mancato!') : '🔄 Ricarica…';
      testoCentro(g, titolo, w / 2, h * 0.1, Math.round(Math.min(34, w * 0.085)), attiva ? '#ffd23f' : esito && !esito.ok ? '#ff6b81' : '#fff');
      // barra
      g.fillStyle = 'rgba(15,8,32,0.85)';
      g.beginPath();
      g.roundRect(bx - 6, by - bh / 2 - 6, bw + 12, bh + 12, 16);
      g.fill();
      g.fillStyle = '#5a2140';
      g.fillRect(bx, by - bh / 2, bw, bh);
      const vz = verde(tt);
      g.fillStyle = attiva ? '#4cd97b' : '#2f8a4f';
      g.fillRect(bx + bw * (0.5 - vz), by - bh / 2, bw * vz * 2, bh);
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.strokeRect(bx + bw * (0.5 - vz), by - bh / 2, bw * vz * 2, bh);
      const cx = bx + bw * cursore(tt);
      g.fillStyle = '#fff';
      g.fillRect(cx - 4, by - bh / 2 - 14, 8, bh + 28);
      g.beginPath();
      g.moveTo(cx, by - bh / 2 - 6);
      g.lineTo(cx - 12, by - bh / 2 - 24);
      g.lineTo(cx + 12, by - bh / 2 - 24);
      g.closePath();
      g.fill();
      // dove è finito il colpo
      if (esito && esito.pos != null && t - esito.t < 1) {
        g.fillStyle = esito.ok ? '#ffd23f' : '#ff2d55';
        g.beginPath();
        g.arc(bx + bw * esito.pos, by, 12, 0, TAU);
        g.fill();
      }
      testoCentro(g, attiva ? '👆 Tocca quando è nel VERDE' : 'Aspetta il prossimo SPARA!', w / 2, h * 0.72, Math.round(Math.min(20, w * 0.05)), 'rgba(255,255,255,0.8)');
    },
  };
}

// ---------------------------------------------------------------------------
// 🧭 Navigatore: swipe nella direzione della freccia (al contrario nell'Inversione).

const ANGOLI = { dx: 0, giu: Math.PI / 2, sx: Math.PI, su: -Math.PI / 2 };

export function creaNavigatore(prog, ui) {
  const it = scorre(prog.navigatore);
  let c = null;
  let chiusa = false;
  let esito = null;
  const partenze = new Map();

  function swipe(dir, t) {
    if (!c || chiusa || t < c.t0) return;
    chiusa = true;
    const inv = ui.inversione(t);
    const giusta = inv ? OPPOSTO[c.dir] : c.dir;
    esito = { ok: dir === giusta, t, dir };
    if (esito.ok) ui.bene('Giusto!');
    else ui.sbaglia(c.i, inv ? 'Era AL CONTRARIO!' : 'Direzione sbagliata!');
  }

  return {
    entra(t) {
      it.salta(t);
      c = null;
      partenze.clear();
    },
    esci() {
      c = null;
      partenze.clear();
    },
    passo(t) {
      const n = it.nuova(t);
      if (n) {
        c = n;
        chiusa = false;
        esito = null;
        ui.vibra(20);
      }
      if (c && !chiusa && t > c.fine) {
        chiusa = true;
        esito = { ok: false, t };
        ui.sbaglia(c.i, 'Troppo lento!');
      }
    },
    giu(id, x, y) {
      partenze.set(id, { x, y, usato: false });
    },
    muovi(id, x, y, t, w) {
      const s = partenze.get(id);
      if (!s || s.usato) return;
      const dx = x - s.x;
      const dy = y - s.y;
      if (Math.hypot(dx, dy) < Math.max(40, w * 0.11)) return;
      s.usato = true;
      swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dx' : 'sx') : dy > 0 ? 'giu' : 'su', t);
    },
    su(id) {
      partenze.delete(id);
    },
    disegna(g, w, h, t) {
      const inv = ui.inversione(t);
      if (inv) {
        g.fillStyle = 'rgba(139,92,246,0.35)';
        g.fillRect(0, 0, w, h);
      }
      const attiva = c && !chiusa && t >= c.t0;
      let titolo = attiva ? '👆 SWIPE!' : esito ? (esito.ok ? '✅ Giusto!' : '❌ Sbagliato!') : '🧭 Pronti…';
      if (inv && (attiva || !esito || esito.ok)) titolo = attiva ? '🔄 AL CONTRARIO!' : '🔄 Inversione…';
      testoCentro(g, titolo, w / 2, h * 0.1, Math.round(Math.min(30, w * 0.075)), inv ? '#e9d5ff' : attiva ? '#ffd23f' : esito && !esito.ok ? '#ff6b81' : '#fff', inv && attiva ? 0.75 + 0.25 * Math.sin(t * 12) : 1);
      const cx = w / 2;
      const cy = h * 0.53;
      const R = Math.min(w * 0.36, h * 0.24);
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.fillStyle = attiva ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
      g.fill();
      if (attiva) anelloTempo(g, cx, cy, R, 1 - (t - c.t0) / (c.fine - c.t0), inv ? '#c4b5fd' : '#ffd23f');
      if (c && (attiva || (esito && t - esito.t < 0.5))) {
        // la freccia
        g.save();
        g.translate(cx, cy);
        g.rotate(ANGOLI[c.dir]);
        const L = R * 0.62;
        g.beginPath();
        g.moveTo(-L, -R * 0.14);
        g.lineTo(L * 0.25, -R * 0.14);
        g.lineTo(L * 0.25, -R * 0.36);
        g.lineTo(L, 0);
        g.lineTo(L * 0.25, R * 0.36);
        g.lineTo(L * 0.25, R * 0.14);
        g.lineTo(-L, R * 0.14);
        g.closePath();
        g.fillStyle = !attiva ? (esito.ok ? '#4cd97b' : '#ff4d6d') : inv ? '#c4b5fd' : '#fff';
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = '#1b1030';
        g.stroke();
        g.restore();
      }
      testoCentro(g, '📱 Telefono in mano, swipe col pollice', w / 2, h * 0.92, Math.round(Math.min(17, w * 0.044)), 'rgba(255,255,255,0.6)');
    },
  };
}

export const CREA = { batterista: creaBatterista, giocoliere: creaGiocoliere, straccio: creaStraccio, cecchino: creaCecchino, navigatore: creaNavigatore };
