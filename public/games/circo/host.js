// Circo dei Disperati (cooperativo): ognuno ha un ruolo diverso sul telefono e fa la sua
// micro-azione insieme agli altri. Sulla TV c'è solo la Barra della Sopravvivenza della
// squadra: parte dal 100%, non si ricarica mai e scende a ogni errore. Nessuno vede chi
// sbaglia... fino alla Pagella del Disastro, alla fine. 45 secondi in 3 fasi sempre più
// veloci; nella terza arriva il Caos (inversione, terremoto, scambio di ruoli).
// Da 9 giocatori: due squadre parallele con le stesse sfide (stesso seme) e due barre.
// Le sfide le giudica il telefono; qui arrivano solo gli errori { err, r, i, t }.

import { TAU, clamp, fmtNum, lerp, randInt, rand } from '../../shared/util.js';
import { prepara } from '../../shared/avatar.js';
import { DURATA, FASI, fase, danno, RUOLI, NOMI_RUOLI, SQUADRE, assegna, leggiRuolo, chiaveRuolo, programmi, caos, attivo, punteggi, cursore, verde } from './regole.js';
import { creaArtista, parametriCpu, parametri, ABILITA } from './artisti.js';

const COLORI_PAD = ['#ff3b5c', '#ffd23f', '#3ec6ff'];

const REGOLE = {
  batterista: [
    '📱 Telefono in mano (o sul tavolo): hai 3 pad colorati',
    'Le luci suonano una sequenza: guardala bene',
    'Poi tocca a te: rifalla uguale e A TEMPO, seguendo il cursore che scorre',
    'Pad sbagliato, nota fuori tempo o saltata = errore',
  ],
  giocoliere: [
    '📱 Telefono sul tavolo: 3 dita della stessa mano sui 3 cerchi blu',
    'Quando un cerchio diventa verde (VAI!), sposta lì il dito del cerchio arancione (LASCIA)',
    'Le altre due dita non si staccano mai!',
    'Dito staccato o troppo lento = errore (poi rimetti 3 dita sui cerchi)',
  ],
  straccio: [
    '📱 Il pubblico tira pomodori, uova e torte sul tuo schermo!',
    'Strofina col dito sopra le macchie: ogni passata ne toglie un po’',
    'Se la barra dello sporco si riempie = errore. Non fermarti mai!',
  ],
  cecchino: [
    '📱 Un cursore va avanti e indietro sulla barra',
    'Quando compare SPARA!, tocca lo schermo mentre il cursore è nel VERDE',
    'Il verde si restringe e il cursore accelera',
    'Tocco fuori dal verde o tempo scaduto = errore',
  ],
  navigatore: [
    '📱 Compare una freccia: swipe in quella direzione prima che finisca il tempo',
    '🔄 Se lo schermo diventa viola (Inversione) vale il contrario!',
    'Direzione sbagliata o troppo lento = errore',
  ],
};
const AVVISO = '⚠️ Ogni errore abbassa la barra della squadra. Nel Caos puoi ritrovarti per 5 s nel ruolo di un altro!';

// Schede dei ruoli per il telefono: una per ruolo, e con due squadre una per ruolo e squadra.
const INFO = {};
for (const r of NOMI_RUOLI) {
  const base = { emoji: RUOLI[r].emoji, nome: RUOLI[r].nome, regole: [...REGOLE[r], AVVISO] };
  const titolo = `${RUOLI[r].art} ${RUOLI[r].nome}`.toUpperCase();
  INFO[chiaveRuolo(r, 0, 1)] = { ...base, titolo };
  SQUADRE.forEach((s, k) => {
    INFO[chiaveRuolo(r, k, 2)] = { ...base, titolo: `${titolo} · ${s.emoji} ${s.nome.toUpperCase()}`, badge: s.emoji };
  });
}

const PAGELLA = { banner: 1.5, entra: 2, scansione: 3.4, verdetto: 6, durata: 12.5 };

export default {
  id: 'circo',
  nome: 'Circo dei Disperati',
  emoji: '🎪',
  colore: '#d62845',
  descrizione: 'Cooperativo: ognuno il suo numero, una barra sola per tutti!',
  comeSiGioca: [
    '🤝 Tutti nella stessa squadra, un ruolo a testa sul telefono: 🥁 Batterista · 🤹 Giocoliere · 🧽 Straccio · 🎯 Cecchino · 🧭 Navigatore',
    '❤️ Ogni errore fa scendere la Barra della Sopravvivenza, che non si ricarica. Chi ha sbagliato? Lo dice la Pagella del Disastro, alla fine!',
    '⏱ 45 secondi in 3 fasi sempre più veloci. Nel Caos: comandi invertiti, terremoto e scambi di ruolo a sorpresa',
    '🏆 Barra salva: bonus a chi non sbaglia mai. Barra a zero: il Colpevole finisce sul maxischermo! (Da 9 giocatori: due squadre, stesse sfide)',
  ],
  controllo: 'cooperativo',
  ruoli: (giocatori) => assegna(giocatori),
  infoRuoli: INFO,
  crea,
};

function crea(ctx) {
  const { W, H, fx, sfx } = ctx;
  const seme = randInt(1, 1e9);
  const prog = programmi(seme);

  // Ruoli e squadre: quelli scelti prima della scheda iniziale, oppure a caso.
  let chiavi = ctx.ruoli;
  if (!chiavi || ctx.giocatori.some((p) => !leggiRuolo(chiavi[p.id]).ruolo)) chiavi = assegna(ctx.giocatori);
  const gioc = ctx.giocatori.map((p) => {
    const { ruolo, sq } = leggiRuolo(chiavi[p.id]);
    return { id: p.id, p, av: prepara(p.av), ruolo, sq, errori: [], chiavi: new Set(), danni: 0, artista: null, pilota: null, x: 0, y: 0, h: 0, xv: null };
  });
  const nsq = gioc.some((q) => q.sq === 1) ? 2 : 1;
  const perId = new Map(gioc.map((q) => [q.id, q]));
  const squadre = Array.from({ length: nsq }, (_, k) => ({
    k,
    info: SQUADRE[k],
    membri: gioc.filter((q) => q.sq === k),
    barra: 100,
    vista: 100,
    fantasma: 100,
    attesaFantasma: 0,
    pagati: new Set(),
    crollo: null,
    colpo: 0,
    pomodori: [],
    macchie: [],
  }));
  const { eventi, scambi } = caos(
    seme,
    squadre.map((s) => s.membri.map((q) => q.ruolo)),
  );
  const evScambio = eventi.find((e) => e.tipo === 'scambio');
  squadre.forEach((s, k) => {
    const c = scambi[k];
    if (!evScambio || !c) return;
    const a = s.membri[c[0]];
    const b = s.membri[c[1]];
    a.scambio = { t0: evScambio.t, t1: evScambio.t + evScambio.durata, ruolo: b.ruolo, con: b.id };
    b.scambio = { t0: evScambio.t, t1: evScambio.t + evScambio.durata, ruolo: a.ruolo, con: a.id };
  });
  const ruoloDi = (q, t) => (q.scambio && t >= q.scambio.t0 && t < q.scambio.t1 ? q.scambio.ruolo : q.ruolo);

  // Posti sulla pista (uno o due anelli).
  const PISTE = nsq === 1 ? [{ cx: W / 2, cy: 832, rx: 880, ry: 215 }] : [{ cx: 480, cy: 846, rx: 445, ry: 190 }, { cx: 1440, cy: 846, rx: 445, ry: 190 }];
  for (const s of squadre) {
    const m = s.membri.length;
    const pista = PISTE[s.k];
    const passo = nsq === 1 ? Math.min(330, 1640 / Math.max(1, m)) : Math.min(205, 860 / Math.max(1, m));
    const h = nsq === 1 ? (m <= 5 ? 265 : 215) : m <= 5 ? 200 : 168;
    s.membri.forEach((q, i) => {
      q.x = pista.cx + (i - (m - 1) / 2) * passo;
      q.y = pista.cy + 40 + (i % 2 ? -18 : 0) * (m > 5 ? 1 : 0);
      q.h = h;
      q.xv = q.x;
    });
  }

  let inizio = null;
  let stato = 'attesa'; // attesa | gioco | pagella | fine
  let t = 0; // secondi di gioco (orologio comune con i telefoni)
  let anim = 0;
  let tPag = 0;
  let oraPrima = null;
  let faseVista = 0;
  let annunci = []; // scritte grandi a centro schermo
  const eventiVisti = new Set();
  let esito = null;
  let risultato = null;
  let ultimoBattito = 0;
  let ultimoSecondo = 99;

  // Pubblico sulle gradinate (fisso).
  const pubblico = [];
  for (let r = 0; r < 5; r++) {
    for (let x = 20 + (r % 2) * 19; x < W; x += 38) pubblico.push({ x: x + rand(-6, 6), y: 368 + r * 50, c: randInt(0, 6), f: rand(0, TAU), r });
  }
  const COLORI_PUBBLICO = ['#ff4d6d', '#ffd23f', '#3ec6ff', '#4cd97b', '#b04dff', '#ffffff', '#ff8a3d'];
  let umore = 0; // >0 esulta, <0 fischia

  // -------------------------------------------------------------------------
  // Telefoni

  function esitoDi(q) {
    if (!esito) return null;
    const i = esito.info[q.id];
    const s = squadre[q.sq];
    return {
      salva: i.salva,
      errori: q.errori.map((e) => Math.round(e.t * 10) / 10),
      tag: i.tag,
      quota: Math.round(i.quota * 100),
      consolazione: !!i.consolazione,
      crollo: s.crollo,
      barra: Math.round(s.barra),
    };
  }

  function vistaDi(q) {
    const s = squadre[q.sq];
    return {
      seme,
      inizio,
      ruolo: q.ruolo,
      sq: q.sq,
      nsq,
      eventi,
      scambio: q.scambio ? { t0: q.scambio.t0, t1: q.scambio.t1, ruolo: q.scambio.ruolo } : null,
      gemelli: s.membri.filter((m) => m !== q && m.ruolo === q.ruolo).map((m) => m.p.nome),
      barra: Math.round(s.barra * 10) / 10,
      crollo: s.crollo,
      finito: stato === 'pagella' || stato === 'fine',
      esito: esitoDi(q),
    };
  }

  function mandaViste(lista = gioc) {
    for (const q of lista) ctx.vista(q.id, vistaDi(q));
  }

  // -------------------------------------------------------------------------
  // Errori e danni

  function registra(q, r, i, tt) {
    if (stato !== 'gioco' || !q || !RUOLI[r]) return;
    const s = squadre[q.sq];
    if (s.crollo != null || !(tt >= 0 && tt < DURATA)) return;
    tt = Math.min(tt, t + 0.5);
    const chiave = i >= 0 ? `${r}:${i}` : `${r}:p${q.chiavi.size}`;
    if (q.chiavi.has(chiave)) return;
    q.chiavi.add(chiave);
    // un doppione che sbaglia la stessa sfida del compagno non fa altro danno
    const d = s.pagati.has(chiave) ? 0 : danno(tt, s.membri.length);
    if (i >= 0) s.pagati.add(chiave);
    q.errori.push({ t: tt, r, d });
    q.danni += d;
    if (d > 0) colpisci(s, d, tt);
  }

  function colpisci(s, d, tt) {
    s.barra = Math.max(0, s.barra - d);
    s.colpo = 0.4;
    s.attesaFantasma = 0.5;
    umore = -1;
    const b = posBarra(s);
    fx.testo(b.x + b.w * (s.barra / 100), b.y + b.h + 34, `−${fmtNum(d, d < 10 ? 1 : 0)}%`, { colore: '#ff4d6d', dim: 44, vita: 1.1 });
    fx.scuoti(Math.min(22, 6 + d * 0.7));
    sfx.colpo(1);
    // un pomodoro dal pubblico, su un punto a caso della pista (non si sa chi è stato!)
    const pista = PISTE[s.k];
    const da = { x: pista.cx + rand(-pista.rx, pista.rx) * 0.9, y: 470 };
    const a = { x: pista.cx + rand(-pista.rx, pista.rx) * 0.7, y: pista.cy + rand(-0.4, 0.6) * pista.ry };
    s.pomodori.push({ da, a, v: 0 });
    if (s.barra <= 0) {
      s.crollo = tt;
      sfx.boom();
      fx.scuoti(34);
      fx.lampo('#ff2d55', 0.45);
      annuncia(nsq > 1 ? `💀 ${s.info.nome.toUpperCase()} CROLLATI!` : '💀 IL CIRCO CROLLA!', nsq > 1 ? 'L’altra squadra resiste?' : '', '#ff4d6d');
    }
    mandaViste(s.membri);
  }

  function annuncia(testo, sotto, colore = '#ffd23f') {
    annunci.push({ testo, sotto, colore, t: 0 });
  }

  // -------------------------------------------------------------------------
  // Fine e Pagella

  function termina() {
    if (stato !== 'gioco') return;
    stato = 'pagella';
    tPag = 0;
    const r = punteggi(
      squadre.map((s) => ({
        membri: s.membri.map((q) => ({ id: q.id, errori: q.errori.length, danni: q.danni })),
        barra: s.barra,
        crollo: s.crollo,
      })),
    );
    esito = r;
    const dettagli = {};
    for (const q of gioc) {
      const i = r.info[q.id];
      const n = q.errori.length;
      // corto: con tanti giocatori i risultati vanno su due colonne
      let det = `${i.salva ? '✅' : '💀'} ${n} ${n === 1 ? 'errore' : 'errori'}`;
      if (i.tag === 'zero') det += ' · ⭐';
      else if (i.tag === 'mvp') det += ' · 🏅 MVP';
      else if (i.tag === 'colpevole' || i.tag === 'colpevole2') det += ' · 👉 Colpevole';
      if (i.consolazione) det += ' · 🥈';
      dettagli[q.id] = det;
    }
    risultato = { gruppi: r.gruppi, dettagli };
    const salve = squadre.filter((s) => s.barra > 0);
    if (salve.length) {
      annuncia(nsq > 1 && salve.length === 1 ? `🏆 VINCONO I ${salve[0].info.nome.toUpperCase()}!` : '🏆 SALVI!', 'Tempo scaduto: lo spettacolo continua', '#4cd97b');
      sfx.fanfara();
      fx.coriandoli(140);
      umore = 1;
    } else {
      sfx.fallimento();
      umore = -1;
    }
    mandaViste();
  }

  // -------------------------------------------------------------------------
  // Disegno: tendone, pubblico, pista

  function tendone(g) {
    const cx = W / 2;
    const cy = -420;
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a0 = Math.PI * (0.18 + (0.64 * i) / N);
      const a1 = Math.PI * (0.18 + (0.64 * (i + 1)) / N);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * 1900, cy + Math.sin(a0) * 1900);
      g.lineTo(cx + Math.cos(a1) * 1900, cy + Math.sin(a1) * 1900);
      g.closePath();
      g.fillStyle = i % 2 ? '#f3dfb8' : '#c8102e';
      g.fill();
    }
    const ombra = g.createLinearGradient(0, 0, 0, 330);
    ombra.addColorStop(0, 'rgba(20,5,25,0.55)');
    ombra.addColorStop(1, 'rgba(20,5,25,0.15)');
    g.fillStyle = ombra;
    g.fillRect(0, 0, W, 330);
    // gradinate
    const grd = g.createLinearGradient(0, 300, 0, 640);
    grd.addColorStop(0, '#2a1630');
    grd.addColorStop(1, '#3d2140');
    g.fillStyle = grd;
    g.fillRect(0, 300, W, 340);
    for (let r = 0; r < 6; r++) {
      g.fillStyle = r % 2 ? '#4a2a4c' : '#36203c';
      g.fillRect(0, 340 + r * 50, W, 6);
    }
    // festone con le stelline
    g.fillStyle = '#7a0b1f';
    g.fillRect(0, 300, W, 18);
    for (let x = 0; x < W + 60; x += 64) {
      g.beginPath();
      g.arc(x + 32, 318, 32, 0, Math.PI);
      g.fillStyle = (x / 64) % 2 ? '#c8102e' : '#ffd23f';
      g.fill();
      g.strokeStyle = '#5a0716';
      g.lineWidth = 3;
      g.stroke();
    }
  }

  function gradinate(g) {
    const fischia = umore < -0.2;
    const esulta = umore > 0.2;
    for (const f of pubblico) {
      const salto = esulta ? Math.abs(Math.sin(anim * 7 + f.f)) * 10 : fischia ? Math.sin(anim * 18 + f.f) * 3 : Math.sin(anim * 2 + f.f) * 1.5;
      const y = f.y - salto;
      g.beginPath();
      g.arc(f.x, y, 11, 0, TAU);
      g.fillStyle = COLORI_PUBBLICO[f.c];
      g.fill();
      g.beginPath();
      g.ellipse(f.x, y + 22, 15, 11, 0, Math.PI, 0);
      g.fill();
      if (esulta && f.c % 3 === 0) {
        g.strokeStyle = COLORI_PUBBLICO[f.c];
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(f.x - 10, y + 16);
        g.lineTo(f.x - 18, y - 8 - salto);
        g.moveTo(f.x + 10, y + 16);
        g.lineTo(f.x + 18, y - 8 - salto);
        g.stroke();
      }
    }
    if (fischia) {
      g.save();
      g.globalAlpha = clamp(-umore, 0, 1);
      for (let i = 0; i < 4; i++) {
        const x = ((i * 523 + Math.floor(anim * 2) * 211) % (W - 300)) + 150;
        ctx.testo(g, i % 2 ? 'BUUU!' : 'FIUUU!', x, 400 + (i % 3) * 70, { dim: 34, colore: '#ffd23f' });
      }
      g.restore();
    }
  }

  function pista(g, P, s) {
    const buio = s && s.crollo != null;
    // ombra e bordo rosso con le stelle
    g.beginPath();
    g.ellipse(P.cx, P.cy, P.rx + 26, P.ry + 22, 0, 0, TAU);
    g.fillStyle = '#7a0b1f';
    g.fill();
    g.beginPath();
    g.ellipse(P.cx, P.cy, P.rx + 14, P.ry + 12, 0, 0, TAU);
    g.fillStyle = '#c8102e';
    g.fill();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      g.beginPath();
      g.arc(P.cx + Math.cos(a) * (P.rx + 14), P.cy + Math.sin(a) * (P.ry + 12), 4, 0, TAU);
      g.fillStyle = '#ffd23f';
      g.fill();
    }
    const seg = g.createRadialGradient(P.cx, P.cy - P.ry * 0.3, 20, P.cx, P.cy, P.rx);
    seg.addColorStop(0, buio ? '#5a4636' : '#e8b878');
    seg.addColorStop(1, buio ? '#3a2c22' : '#b9783e');
    g.beginPath();
    g.ellipse(P.cx, P.cy, P.rx, P.ry, 0, 0, TAU);
    g.fillStyle = seg;
    g.fill();
    // macchie di pomodoro sulla pista
    if (s) {
      for (const m of s.macchie) {
        g.globalAlpha = clamp(m.vita / 1.5, 0, 0.85);
        g.beginPath();
        g.ellipse(m.x, m.y, 26, 11, 0, 0, TAU);
        g.fillStyle = '#d4202f';
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  function riflettori(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      const x = W / 2 + Math.sin(anim * 0.6 + k * 2.4) * 620;
      const y = 820 + Math.cos(anim * 0.8 + k) * 70;
      const sx = k ? W - 120 : 120;
      g.beginPath();
      g.moveTo(sx - 20, 0);
      g.lineTo(sx + 20, 0);
      g.lineTo(x + 230, y);
      g.lineTo(x - 230, y);
      g.closePath();
      g.fillStyle = 'rgba(255,240,200,0.05)';
      g.fill();
      const c = g.createRadialGradient(x, y, 10, x, y, 260);
      c.addColorStop(0, 'rgba(255,240,200,0.18)');
      c.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(x, y, 260, 90, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  // -------------------------------------------------------------------------
  // Gli artisti con i loro attrezzi

  function sfidaAttuale(lista, tt) {
    for (const c of lista) if (tt >= c.t0 && tt <= c.fine) return c;
    return null;
  }

  function attrezzo(g, q, ruolo, x, y, h) {
    const k = h / 100;
    const tt = t;
    if (ruolo === 'batterista') {
      // tamburo davanti, che si illumina con le note della chiamata
      const c = sfidaAttuale(prog.batterista, tt);
      let luce = null;
      let colpo = 0;
      if (c && stato === 'gioco') {
        c.note.forEach((p, j) => {
          const d = tt - (c.t0 + j * c.b);
          if (d >= 0 && d < c.b * 0.6) {
            luce = COLORI_PAD[p];
            colpo = 1 - d / (c.b * 0.6);
          }
        });
        c.note.forEach((p, j) => {
          const d = tt - (c.tR + j * c.b);
          if (d >= -0.05 && d < c.b * 0.5) colpo = Math.max(colpo, 0.6 * (1 - d / (c.b * 0.5)));
        });
      }
      const ty = y - 38 * k;
      g.fillStyle = '#c8102e';
      g.fillRect(x - 26 * k, ty, 52 * k, 26 * k);
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 3 * k;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(x - 26 * k + i * 17 * k, ty);
        g.lineTo(x - 17 * k + i * 17 * k, ty + 26 * k);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(x, ty, 26 * k, 8 * k, 0, 0, TAU);
      g.fillStyle = luce || '#f3ead8';
      g.fill();
      g.strokeStyle = '#1b1030';
      g.lineWidth = 2.5 * k;
      g.stroke();
      // bacchette
      g.strokeStyle = '#8d5a2b';
      g.lineWidth = 4 * k;
      g.lineCap = 'round';
      for (const lato of [-1, 1]) {
        const su = (lato < 0 ? colpo : colpo * 0.7) * 14 * k;
        g.beginPath();
        g.moveTo(x + lato * 30 * k, y - 58 * k);
        g.lineTo(x + lato * 8 * k, ty - 4 * k - su);
        g.stroke();
      }
    } else if (ruolo === 'giocoliere') {
      const cols = ['#ff3b5c', '#ffd23f', '#3ec6ff'];
      for (let i = 0; i < 3; i++) {
        const f = anim * 3.2 + (i * TAU) / 3;
        const bx = x + Math.cos(f) * 26 * k;
        const by = y - 118 * k - Math.abs(Math.sin(f)) * 34 * k;
        g.beginPath();
        g.arc(bx, by, 7 * k, 0, TAU);
        g.fillStyle = cols[i];
        g.fill();
        g.strokeStyle = '#1b1030';
        g.lineWidth = 2;
        g.stroke();
      }
    } else if (ruolo === 'straccio') {
      // secchio e spugna che gira
      g.fillStyle = '#9aa3b5';
      g.beginPath();
      g.moveTo(x + 30 * k, y - 22 * k);
      g.lineTo(x + 52 * k, y - 22 * k);
      g.lineTo(x + 48 * k, y);
      g.lineTo(x + 34 * k, y);
      g.closePath();
      g.fill();
      g.strokeStyle = '#1b1030';
      g.lineWidth = 2;
      g.stroke();
      const f = anim * 9;
      ctx.testo(g, '🧽', x - 6 * k + Math.cos(f) * 16 * k, y - 62 * k + Math.sin(f) * 9 * k, { dim: 26 * k, bordo: 0 });
    } else if (ruolo === 'cecchino') {
      // bersaglio sul cavalletto e la barra col cursore (la stessa dei telefoni)
      const bx = x + 46 * k;
      const by = y - 52 * k;
      g.strokeStyle = '#6b4a2e';
      g.lineWidth = 3 * k;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx - 8 * k, y);
      g.moveTo(bx, by);
      g.lineTo(bx + 8 * k, y);
      g.stroke();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(bx, by, (16 - i * 4) * k, 0, TAU);
        g.fillStyle = i % 2 ? '#fff' : '#ff3b5c';
        g.fill();
      }
      const lw = 70 * k;
      const ly = y - 150 * k;
      g.fillStyle = 'rgba(20,10,45,0.8)';
      g.fillRect(x - lw / 2 - 3, ly - 6 * k, lw + 6, 12 * k);
      const vz = verde(Math.max(0, tt));
      g.fillStyle = '#4cd97b';
      g.fillRect(x - lw * vz, ly - 4 * k, lw * vz * 2, 8 * k);
      g.fillStyle = '#fff';
      g.fillRect(x - lw / 2 + cursore(Math.max(0, tt)) * lw - 2, ly - 7 * k, 4, 14 * k);
    } else if (ruolo === 'navigatore') {
      // cartello con la freccia di adesso
      const c = stato === 'gioco' ? sfidaAttuale(prog.navigatore, tt) : null;
      const sx = x + 40 * k;
      const sy = y - 120 * k;
      g.strokeStyle = '#6b4a2e';
      g.lineWidth = 4 * k;
      g.beginPath();
      g.moveTo(sx, sy + 20 * k);
      g.lineTo(sx, y - 50 * k);
      g.stroke();
      g.beginPath();
      g.roundRect(sx - 22 * k, sy - 20 * k, 44 * k, 40 * k, 6 * k);
      g.fillStyle = attivo(eventi, 'inversione', tt) ? '#8b5cf6' : '#f3ead8';
      g.fill();
      g.strokeStyle = '#1b1030';
      g.lineWidth = 2.5;
      g.stroke();
      const freccia = c ? { su: '⬆', giu: '⬇', sx: '⬅', dx: '➡' }[c.dir] : '?';
      ctx.testo(g, freccia, sx, sy + 2 * k, { dim: 28 * k, colore: '#1b1030', bordo: 0 });
    }
  }

  function artista(g, q, s) {
    const ruolo = stato === 'gioco' ? ruoloDi(q, t) : q.ruolo;
    // nello scambio i due si scambiano anche il posto sulla pista
    let xd = q.x;
    if (q.scambio && stato === 'gioco') {
      const altro = perId.get(q.scambio.con);
      const dentro = clamp((t - q.scambio.t0) / 0.5, 0, 1) * clamp((q.scambio.t1 - t) / 0.5, 0, 1);
      xd = lerp(q.x, altro.x, dentro * dentro * (3 - 2 * dentro));
    }
    q.xv = xd;
    const crollata = s.crollo != null;
    let pose = 'idle';
    let espr = null;
    if (crollata) {
      pose = 'sad';
      espr = 'triste';
    } else if (s.colpo > 0) {
      pose = 'hit';
      espr = 'sorpreso';
    } else if ((stato === 'pagella' || stato === 'fine') && s.barra > 0) {
      pose = 'cheer';
      espr = 'felice';
    } else if (attivo(eventi, 'terremoto', t) && stato === 'gioco') pose = 'jump';
    else if (q.scambio && t >= q.scambio.t0 && t < q.scambio.t0 + 0.5) pose = 'walk';
    const tremo = attivo(eventi, 'terremoto', t) && stato === 'gioco' ? Math.sin(anim * 50 + q.x) * 4 : 0;
    const x = xd + tremo;
    ctx.avatar(g, q.av, x, q.y, q.h, { pose, t: anim + q.x * 0.01, espr, dir: 1 });
    if (!crollata) attrezzo(g, q, ruolo, x, q.y, q.h);
    const pilota = !q.p.bot && !ctx.connesso(q.id);
    ctx.etichetta(g, `${pilota ? '🤖 ' : ''}${q.p.nome}`, x, q.y + 30, q.p.colore, { dim: nsq > 1 ? 18 : 22, maxW: nsq > 1 ? 150 : 210 });
    ctx.testo(g, RUOLI[ruolo].emoji, x - q.h * 0.36, q.y - q.h * 0.95, { dim: Math.round(q.h * 0.17), bordo: 0 });
  }

  // -------------------------------------------------------------------------
  // Barra della Sopravvivenza, tempo e fasi

  function posBarra(s) {
    if (nsq === 1) return { x: 380, y: 52, w: 1160, h: 62 };
    return s.k === 0 ? { x: 70, y: 70, w: 700, h: 52 } : { x: 1150, y: 70, w: 700, h: 52 };
  }

  function disegnaBarra(g, s) {
    const { x, y, w, h } = posBarra(s);
    ctx.pannello(g, x - 24, y - 38, w + 48, h + 62, { r: 26, colore: 'rgba(25,8,30,0.85)', bordo: s.info.colore + 'aa', lw: 4 });
    const titolo = nsq === 1 ? '❤️ BARRA DELLA SOPRAVVIVENZA' : `${s.info.emoji} ${s.info.nome.toUpperCase()}`;
    ctx.testo(g, titolo, x, y - 16, { dim: 24, allinea: 'left', colore: nsq === 1 ? '#ffd23f' : s.info.colore });
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fillStyle = '#12081c';
    g.fill();
    const v = clamp(s.vista / 100, 0, 1);
    const f = clamp(s.fantasma / 100, 0, 1);
    if (f > v) {
      g.beginPath();
      g.roundRect(x, y, Math.max(h, w * f), h, h / 2);
      g.fillStyle = '#ffffffcc';
      g.fill();
    }
    if (v > 0) {
      const col = v > 0.5 ? '#4cd97b' : v > 0.25 ? '#ffd23f' : '#ff4d6d';
      g.save();
      g.beginPath();
      g.roundRect(x, y, Math.max(h * 0.6, w * v), h, h / 2);
      g.clip();
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
      // strisce da circo che scorrono
      g.fillStyle = 'rgba(255,255,255,0.18)';
      const o = (anim * 40) % 48;
      for (let sx = x - 60 + o; sx < x + w; sx += 48) {
        g.beginPath();
        g.moveTo(sx, y + h);
        g.lineTo(sx + 24, y + h);
        g.lineTo(sx + 48, y);
        g.lineTo(sx + 24, y);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    g.lineWidth = 4;
    g.strokeStyle = s.colpo > 0 ? '#ff4d6d' : 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.stroke();
    const pct = s.barra > 0 ? `${Math.max(1, Math.round(s.vista))}%` : '💀 0%';
    ctx.testo(g, pct, x + w - 16, y - 16, { dim: 30, allinea: 'right', colore: s.barra > 25 ? '#fff' : '#ff4d6d' });
    if (s.crollo != null) ctx.testo(g, `💀 CROLLATI al ${fmtNum(s.crollo, 1)}″`, x + w / 2, y + h / 2 + 2, { dim: 30, colore: '#fff' });
  }

  function disegnaTempo(g) {
    const resto = Math.max(0, DURATA - t);
    if (nsq === 1) {
      const x0 = 520;
      const x1 = 1400;
      const y = 168;
      disegnaFasi(g, x0, x1, y);
      ctx.testo(g, `${Math.ceil(resto)}`, 1640, 84, { dim: 64, colore: resto <= 5 ? '#ff4d6d' : '#fff' });
      ctx.testo(g, 'secondi', 1640, 128, { dim: 20, colore: '#ffd23f' });
    } else {
      ctx.pannello(g, 820, 22, 280, 150, { r: 26, colore: 'rgba(25,8,30,0.85)' });
      ctx.testo(g, `${Math.ceil(resto)}`, 960, 78, { dim: 66, colore: resto <= 5 ? '#ff4d6d' : '#fff' });
      ctx.testo(g, FASI[fase(Math.min(t, DURATA - 0.01))].nome, 960, 136, { dim: 24, colore: '#ffd23f' });
      disegnaFasi(g, 560, 1360, 212);
    }
  }

  function disegnaFasi(g, x0, x1, y) {
    const tot = x1 - x0;
    const colori = ['#4cd97b', '#ffd23f', '#ff4d6d'];
    FASI.forEach((f, i) => {
      const a = x0 + (f.da / DURATA) * tot;
      const b = x0 + (f.a / DURATA) * tot;
      const qui = fase(Math.min(t, DURATA - 0.01)) === i;
      g.beginPath();
      g.roundRect(a + 3, y - 12, b - a - 6, 24, 12);
      g.fillStyle = qui ? colori[i] : colori[i] + '55';
      g.fill();
      ctx.testo(g, `${i + 1} · ${f.nome}`, (a + b) / 2, y + 30, { dim: qui ? 22 : 18, colore: qui ? '#fff' : 'rgba(255,255,255,0.6)' });
    });
    const xm = x0 + clamp(t / DURATA, 0, 1) * tot;
    g.beginPath();
    g.moveTo(xm, y - 18);
    g.lineTo(xm - 10, y - 32);
    g.lineTo(xm + 10, y - 32);
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
  }

  function disegnaAnnunci(g) {
    for (const a of annunci) {
      const k = a.t / 1.7;
      const s = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
      const al = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      g.save();
      g.globalAlpha = clamp(al, 0, 1);
      g.translate(W / 2, H * 0.47);
      g.scale(s, s);
      g.rotate(-0.03);
      ctx.testo(g, a.testo, 0, 0, { dim: 92, colore: a.colore, bordo: 14 });
      if (a.sotto) ctx.testo(g, a.sotto, 0, 78, { dim: 36, colore: '#fff' });
      g.restore();
    }
  }

  // -------------------------------------------------------------------------
  // La Pagella del Disastro

  function disegnaPagella(g) {
    const k = clamp((tPag - PAGELLA.banner) / 0.5, 0, 1);
    if (k <= 0) return;
    g.save();
    g.globalAlpha = k;
    g.fillStyle = 'rgba(12,4,22,0.88)';
    g.fillRect(0, 0, W, H);
    ctx.testo(g, '📋 LA PAGELLA DEL DISASTRO', W / 2, 62, { dim: 58, colore: '#ffd23f' });
    // il tempo della pagella scorre da 0 a 45 secondi e accende gli errori man mano
    const scan = clamp((tPag - PAGELLA.entra) / PAGELLA.scansione, 0, 1) * DURATA;
    const larghe = nsq === 1;
    squadre.forEach((s) => {
      const x0 = larghe ? 120 : s.k === 0 ? 40 : 980;
      const w = larghe ? 1680 : 900;
      pannelloSquadra(g, s, x0, 112, w, H - 140, scan);
    });
    g.restore();
    if (tPag >= PAGELLA.verdetto) disegnaVerdetto(g, clamp((tPag - PAGELLA.verdetto) / 0.45, 0, 1));
  }

  function pannelloSquadra(g, s, x0, y0, w, hTot, scan) {
    const salva = s.barra > 0;
    ctx.pannello(g, x0, y0, w, hTot, { r: 28, colore: 'rgba(40,14,50,0.92)', bordo: salva ? '#4cd97b' : '#ff4d6d', lw: 5 });
    const nome = nsq > 1 ? `${s.info.emoji} ${s.info.nome}` : 'La squadra';
    const stato = salva ? `✅ SALVI con il ${Math.max(1, Math.round(s.barra))}%` : `💀 CROLLATI al ${fmtNum(s.crollo ?? DURATA, 1)}″`;
    ctx.testo(g, `${nome} · ${stato}`, x0 + 30, y0 + 42, { dim: 34, allinea: 'left', colore: salva ? '#4cd97b' : '#ff6b81', maxW: w - 60 });
    const ordinati = [...s.membri].sort((a, b) => a.errori.length - b.errori.length || a.danni - b.danni);
    const top = y0 + 86;
    // le righe finiscono prima del riquadro del verdetto (che arriva sotto)
    const rh = Math.min(96, ((nsq === 1 ? 600 : 650) - top) / Math.max(1, ordinati.length));
    const tl0 = x0 + (nsq > 1 ? 300 : 430);
    const tl1 = x0 + w - (nsq > 1 ? 140 : 180);
    // righe delle fasi
    FASI.forEach((f, i) => {
      const a = tl0 + (f.da / DURATA) * (tl1 - tl0);
      const b = tl0 + (f.a / DURATA) * (tl1 - tl0);
      g.fillStyle = ['rgba(76,217,123,0.1)', 'rgba(255,210,63,0.1)', 'rgba(255,77,109,0.14)'][i];
      g.fillRect(a, top - 8, b - a, rh * ordinati.length + 8);
      ctx.testo(g, `${f.da}″`, a, top - 22, { dim: 16, colore: 'rgba(255,255,255,0.6)' });
    });
    ctx.testo(g, `${DURATA}″`, tl1, top - 22, { dim: 16, colore: 'rgba(255,255,255,0.6)' });
    const xs = tl0 + (scan / DURATA) * (tl1 - tl0);
    if (scan > 0 && scan < DURATA) {
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(xs - 2, top - 8, 4, rh * ordinati.length + 8);
    }
    const tag = esito ? esito.info : {};
    ordinati.forEach((q, i) => {
      const y = top + rh * i + rh / 2;
      const r = Math.min(30, rh * 0.36);
      ctx.testa(g, q.av, x0 + 30 + r, y, r, { espr: !esito ? null : tag[q.id]?.tag?.startsWith('colpevole') ? 'stordito' : tag[q.id]?.tag ? 'felice' : null });
      ctx.testo(g, `${RUOLI[q.ruolo].emoji} ${q.p.nome}`, x0 + 40 + r * 2, y, { dim: Math.min(28, rh * 0.34), allinea: 'left', maxW: tl0 - x0 - 70 - r * 2 });
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(tl0, y);
      g.lineTo(tl1, y);
      g.stroke();
      if (s.crollo != null) {
        const xc = tl0 + (s.crollo / DURATA) * (tl1 - tl0);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(xc, y - rh / 2 + 4, tl1 - xc, rh - 8);
      }
      let visti = 0;
      q.errori.forEach((e, j) => {
        if (e.t > scan) return;
        visti++;
        const xe = tl0 + (e.t / DURATA) * (tl1 - tl0);
        const nuovo = scan - e.t < 1.5;
        const rr = Math.min(15, rh * 0.2) * (nuovo ? 1 + (1.5 - (scan - e.t)) * 0.25 : 1);
        g.beginPath();
        g.arc(xe, y, rr, 0, TAU);
        g.fillStyle = e.d > 0 ? '#ff2d55' : '#ff8fa3';
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.stroke();
        ctx.testo(g, '✖', xe, y + 1, { dim: rr * 1.3, bordo: 0 });
        if (rh >= 44) ctx.testo(g, `${fmtNum(e.t, 1)}″`, xe, y + (j % 2 ? rr + 13 : -rr - 12), { dim: Math.min(18, rh * 0.22), colore: '#ffd0d8' });
      });
      const fatto = scan >= DURATA;
      ctx.testo(g, `❌ ${visti}`, tl1 + (nsq > 1 ? 48 : 62), y, { dim: Math.min(32, rh * 0.4), colore: visti ? '#ff6b81' : '#4cd97b' });
      if (fatto && tag[q.id]?.tag) {
        const tg = tag[q.id].tag;
        const t2 = tg === 'zero' ? '⭐' : tg === 'mvp' ? '🏅' : '👉';
        ctx.testo(g, t2, tl1 + (nsq > 1 ? 112 : 138), y, { dim: Math.min(34, rh * 0.42), bordo: 0 });
      }
    });
    // in fondo: quanti errori in tutto
    const tot = s.membri.reduce((a, q) => a + q.errori.length, 0);
    ctx.testo(g, `Errori della squadra: ${tot}`, x0 + 30, y0 + hTot - 40, { dim: 26, allinea: 'left', colore: 'rgba(255,255,255,0.75)' });
  }

  function disegnaVerdetto(g, k) {
    if (!esito) return;
    const e = k < 1 ? 0.5 + 0.5 * Math.sin((k * Math.PI) / 2) : 1;
    squadre.forEach((s, i) => {
      const es = esito.esiti[i];
      const cx = nsq === 1 ? W / 2 : s.k === 0 ? 490 : 1430;
      const cy = nsq === 1 ? 780 : 820;
      const lw = nsq === 1 ? 1100 : 860;
      g.save();
      g.globalAlpha = k;
      g.translate(cx, cy);
      g.scale(e, e);
      ctx.pannello(g, -lw / 2, -150, lw, 300, { r: 34, colore: es.salva ? 'rgba(20,70,40,0.96)' : 'rgba(90,10,30,0.96)', bordo: '#ffd23f', lw: 6 });
      if (!es.salva && es.colpevoli.length) {
        // il faccione del Colpevole
        const ids = es.colpevoli.slice(0, 2);
        const R = nsq === 1 ? 118 : 96;
        ids.forEach((id, j) => {
          const q = perId.get(id);
          const fx0 = -lw / 2 + 40 + R + j * (R * 2.15);
          const oscilla = Math.sin(anim * 3 + j) * 0.08;
          g.beginPath();
          g.arc(fx0, 0, R + 10, 0, TAU);
          g.fillStyle = q.p.colore;
          g.fill();
          ctx.testa(g, q.av, fx0, 6, R, { espr: 'stordito', rot: oscilla });
        });
        const q0 = perId.get(ids[0]);
        const info = esito.info[ids[0]];
        const xt = -lw / 2 + 60 + R * 2 + (ids.length - 1) * R * 2.15;
        ctx.testo(g, '👉 IL COLPEVOLE', xt, -86, { dim: nsq === 1 ? 46 : 36, allinea: 'left', colore: '#ffd23f' });
        ctx.testo(g, ids.length > 1 ? ids.map((id) => perId.get(id).p.nome).join(' e ') : q0.p.nome, xt, -24, { dim: nsq === 1 ? 62 : 44, allinea: 'left', colore: '#fff', maxW: lw / 2 - xt - 30 });
        const pen = info.tag === 'colpevole2' ? '−2 (40% o più degli errori!)' : '−1';
        ctx.testo(g, `${info.errori} errori su ${es.tot} (${Math.round(info.quota * 100)}%) · ${pen}`, xt, 40, { dim: nsq === 1 ? 32 : 24, allinea: 'left', colore: '#ffd0d8', maxW: lw / 2 - xt - 20 });
        if (es.consolazione) ctx.testo(g, '🥈 Durati di più: +1 di consolazione a tutta la squadra', xt, 92, { dim: nsq === 1 ? 26 : 20, allinea: 'left', colore: '#ffd23f', maxW: lw / 2 - xt - 20 });
      } else if (es.salva) {
        const eroi = es.zero.length ? es.zero : es.mvp;
        const titolo = es.zero.length ? '⭐ ZERO ERRORI (+2)' : '🏅 MVP (+1)';
        ctx.testo(g, '🏆 SALVI! +2 a tutti', 0, -92, { dim: nsq === 1 ? 50 : 38, colore: '#4cd97b' });
        ctx.testo(g, titolo, 0, -28, { dim: nsq === 1 ? 38 : 30, colore: '#ffd23f' });
        const R = nsq === 1 ? 46 : 36;
        const mostra = eroi.slice(0, nsq === 1 ? 6 : 4);
        mostra.forEach((id, j) => {
          const q = perId.get(id);
          const xx = (j - (mostra.length - 1) / 2) * (R * 2 + 120);
          ctx.testa(g, q.av, xx, 52, R, { espr: 'felice' });
          ctx.etichetta(g, q.p.nome, xx, 52 + R + 22, q.p.colore, { dim: 20, maxW: R * 2 + 100 });
        });
      } else {
        ctx.testo(g, '💀 Crollati… ma senza un colpevole?!', 0, 0, { dim: 36 });
      }
      g.restore();
    });
  }

  // -------------------------------------------------------------------------

  // i telefoni montano subito il gioco: il Giocoliere sistema le dita già durante il 3, 2, 1
  mandaViste();

  return {
    inizia() {
      inizio = ctx.ora() + 150;
      stato = 'gioco';
      t = -0.15;
      mandaViste();
    },

    aggiorna(dt) {
      anim += dt;
      umore *= Math.exp(-dt * 0.9);
      // dopo una pausa (Esc) l'orologio comune va spostato avanti, anche sui telefoni
      const ora = ctx.ora();
      if (stato === 'gioco' && oraPrima != null && ora - oraPrima > dt * 1000 + 500) {
        inizio += ora - oraPrima - dt * 1000;
        mandaViste();
      }
      oraPrima = ora;
      for (const s of squadre) {
        s.colpo = Math.max(0, s.colpo - dt);
        s.vista += (s.barra - s.vista) * Math.min(1, dt * 7);
        s.attesaFantasma -= dt;
        if (s.attesaFantasma <= 0) s.fantasma += (s.vista - s.fantasma) * Math.min(1, dt * 3);
        if (s.fantasma < s.vista) s.fantasma = s.vista;
        for (const p of s.pomodori) {
          p.v += dt / 0.55;
          if (p.v >= 1 && !p.fatto) {
            p.fatto = true;
            fx.particelle(p.a.x, p.a.y, { n: 18, colori: ['#ff2d3a', '#d4202f', '#ff8a8a'], vel: 300, grav: 700, vita: 0.6, dim: 9 });
            s.macchie.push({ x: p.a.x, y: p.a.y, vita: 3 });
          }
        }
        s.pomodori = s.pomodori.filter((p) => !p.fatto);
        for (const m of s.macchie) m.vita -= dt;
        s.macchie = s.macchie.filter((m) => m.vita > 0);
      }
      for (const a of annunci) a.t += dt;
      annunci = annunci.filter((a) => a.t < 1.7);

      if (stato === 'gioco') {
        t = (ora - inizio) / 1000;
        // fasi e Caos
        const f = fase(Math.max(0, Math.min(t, DURATA - 0.01)));
        if (f !== faseVista && t < DURATA) {
          faseVista = f;
          annuncia(`FASE ${f + 1} · ${FASI[f].nome.toUpperCase()}`, f === 1 ? 'Velocità +40%, errori più pesanti' : 'Velocità massima! Arriva il Caos…', f === 2 ? '#ff4d6d' : '#ffd23f');
          sfx.via();
        }
        for (const e of eventi) {
          if (t >= e.t && !eventiVisti.has(e)) {
            eventiVisti.add(e);
            if (e.tipo === 'inversione') annuncia('🔄 INVERSIONE!', 'Navigatori: frecce al contrario per 3 secondi', '#b388ff');
            else if (e.tipo === 'terremoto') annuncia('📳 TERREMOTO!', 'Telefoni impazziti per 2 secondi', '#ffb020');
            else annuncia('🔀 SCAMBIO DI RUOLI!', 'Due di voi si scambiano il numero per 5 secondi', '#3ec6ff');
            sfx.whoosh();
          }
        }
        if (attivo(eventi, 'terremoto', t)) fx.scuoti(5);
        // battito del cuore con la barra bassa, e gli ultimi secondi
        if (squadre.some((s) => s.crollo == null && s.barra < 30) && anim - ultimoBattito > 0.75) {
          ultimoBattito = anim;
          sfx.colpo(0.35);
        }
        const sec = Math.ceil(DURATA - t);
        if (sec !== ultimoSecondo && sec <= 5 && sec >= 1) sfx.tic();
        ultimoSecondo = sec;
        // pilota automatico per chi ha il telefono spento (un nuovo pilota a ogni distacco)
        for (const q of gioc) {
          if (q.p.bot || squadre[q.sq].crollo != null || t < 0) continue;
          if (ctx.connesso(q.id)) {
            q.pilota = null;
            continue;
          }
          if (!q.pilota) q.pilota = creaArtista(parametri(ABILITA.normale), prog, eventi, { da: t });
          for (const e of q.pilota.passo(dt, t, ruoloDi(q, t))) registra(q, e.r, e.i, e.t);
        }
        if (t >= DURATA + 0.35 || squadre.every((s) => s.crollo != null)) termina();
      } else if (stato === 'pagella') {
        const prima = tPag;
        tPag += dt;
        // un "tic" per ogni errore che si accende nella pagella
        const s0 = clamp((prima - PAGELLA.entra) / PAGELLA.scansione, 0, 1) * DURATA;
        const s1 = clamp((tPag - PAGELLA.entra) / PAGELLA.scansione, 0, 1) * DURATA;
        if (s1 > s0 && gioc.some((q) => q.errori.some((e) => e.t > s0 && e.t <= s1))) sfx.tic();
        if (prima < PAGELLA.verdetto && tPag >= PAGELLA.verdetto) {
          if (esito.esiti.some((e) => !e.salva && e.colpevoli.length)) {
            sfx.boom();
            fx.scuoti(18);
          } else sfx.fanfara();
          if (esito.esiti.some((e) => e.salva)) fx.coriandoli(90);
        }
        if (tPag >= PAGELLA.durata) {
          stato = 'fine';
          ctx.fine(risultato);
        }
      }
    },

    disegna(g) {
      tendone(g);
      gradinate(g);
      squadre.forEach((s) => pista(g, PISTE[s.k], s));
      riflettori(g);
      // pomodori in volo
      for (const s of squadre) {
        for (const p of s.pomodori) {
          const x = lerp(p.da.x, p.a.x, p.v);
          const y = lerp(p.da.y, p.a.y, p.v) - Math.sin(p.v * Math.PI) * 180;
          ctx.testo(g, '🍅', x, y, { dim: 40, bordo: 0 });
        }
      }
      // artisti dal fondo verso il davanti
      const tutti = [...gioc].sort((a, b) => a.y - b.y);
      for (const q of tutti) artista(g, q, squadre[q.sq]);
      for (const s of squadre) {
        if (s.crollo != null && stato === 'gioco') {
          const P = PISTE[s.k];
          ctx.testo(g, '💀 CROLLATI!', P.cx, P.cy - P.ry - 40, { dim: nsq > 1 ? 64 : 90, colore: '#ff4d6d' });
        }
      }
      // allarme rosso con la barra bassa
      const bassa = squadre.some((s) => s.crollo == null && s.barra < 30) && stato === 'gioco';
      if (bassa) {
        const a = 0.18 + 0.12 * Math.sin(anim * 8);
        const vig = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        vig.addColorStop(0, 'rgba(255,0,40,0)');
        vig.addColorStop(1, `rgba(255,0,40,${a.toFixed(3)})`);
        g.fillStyle = vig;
        g.fillRect(0, 0, W, H);
      }
      for (const s of squadre) disegnaBarra(g, s);
      if (stato === 'gioco' || stato === 'attesa') disegnaTempo(g);
      if (stato === 'gioco' && t >= 30 && nsq === 1) ctx.testo(g, '🔥 CAOS', 200, 90, { dim: 40, colore: '#ff4d6d' });
      disegnaAnnunci(g);
      if (stato === 'pagella' || stato === 'fine') {
        if (tPag < PAGELLA.banner + 0.5) {
          const salve = squadre.some((s) => s.barra > 0);
          const k = clamp(tPag / PAGELLA.banner, 0, 1);
          g.save();
          g.globalAlpha = tPag > PAGELLA.banner ? clamp(1 - (tPag - PAGELLA.banner) / 0.5, 0, 1) : 1;
          ctx.testo(g, salve ? '⏰ TEMPO!' : '💥 CROLLO TOTALE!', W / 2, H * 0.45, { dim: 130 + 20 * Math.sin(k * Math.PI), colore: salve ? '#ffd23f' : '#ff4d6d', bordo: 16 });
          g.restore();
        }
        disegnaPagella(g);
      }
    },

    input(id, d) {
      const q = perId.get(id);
      if (!q || !d || !d.err) return;
      registra(q, String(d.r), Number.isInteger(d.i) ? d.i : -1, Number(d.t));
    },

    // Le CPU "giocano" il loro ruolo con mani simulate (artisti.js) e mandano gli stessi
    // errori del telefono.
    bot(id, dt) {
      const q = perId.get(id);
      if (!q || stato !== 'gioco' || t < 0 || squadre[q.sq].crollo != null) return;
      if (!q.artista) q.artista = creaArtista(parametriCpu(ctx.cpu(id)), prog, eventi);
      for (const e of q.artista.passo(dt, t, ruoloDi(q, t))) registra(q, e.r, e.i, e.t);
    },

    rientrato(id) {
      const q = perId.get(id);
      if (q) mandaViste([q]);
    },

    // Per il banco di prova.
    statistiche() {
      return {
        squadre: squadre.map((s) => ({ barra: s.barra, crollo: s.crollo, membri: s.membri.map((q) => q.id) })),
        giocatori: Object.fromEntries(gioc.map((q) => [q.id, { ruolo: q.ruolo, sq: q.sq, errori: q.errori.map((e) => ({ ...e })) }])),
        esito,
      };
    },
  };
}
