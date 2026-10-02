// Ciclo di vita di un minigioco sullo schermo: scheda introduttiva con i
// "Pronto!" dei telefoni -> 3, 2, 1, VIA! -> gioco -> FINE! -> risultati.

import { W, H, testo, scrittaGrande, pannello, etichetta, barraTempo, sfondoFesta, testoSu } from './stage.js';
import { sfx, musica } from './audio.js';
import { disegnaAvatar, disegnaTesta, canvasAvatar } from '../shared/avatar.js';
import { gruppiDaPunteggi, puntiDaGruppi, posizioniDaGruppi, griglia, shade } from '../shared/util.js';
import { CONTROLLI } from '../games/index.js';
import { creaCpu, LIVELLI } from '../games/cpu.js';

let contatore = 0;
const ATTESA_INTRO = 25;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// classifica: { id: punti } del torneo (o null); storico: { ruolo: { id: volte } } della serata,
// servono ai giochi a ruoli (def.ruoli) per scegliere chi fa cosa.
export function creaPartita({ def, giocatori, app, etichettaTorneo = '', moltiplicatore = 1, classifica = null, storico = {}, onFine }) {
  const run = `${def.id}-${Date.now().toString(36)}-${++contatore}`;
  const lista = giocatori.map((p) => ({ ...p }));
  const mappa = new Map(lista.map((p) => [p.id, p]));
  const pronti = new Set(lista.filter((p) => p.bot).map((p) => p.id));
  const cervelli = new Map(); // id -> CPU (una per bot, nuova a ogni minigioco)

  // Giochi a ruoli (es. Il Polpo): i ruoli si decidono prima della scheda iniziale,
  // così ognuno legge sul telefono le regole del suo ruolo. "Cambia" esclude chi c'era.
  const infoRuoli = def.infoRuoli || {};
  let esclusi = [];
  const scegliRuoli = () => (def.ruoli ? def.ruoli(lista, { punti: classifica, storico, escludi: esclusi }) : null);
  let ruoli = scegliRuoli();
  const speciali = () => (ruoli ? lista.filter((p) => infoRuoli[ruoli[p.id]]?.speciale) : []);

  let fase = 'intro';
  let tFase = 0;
  let gioco = null;
  let timers = [];
  let risultato = null;
  let inPausa = false;
  let finito = false;
  let domIntro = null;

  const ctx = {
    run,
    giocatori: lista,
    W,
    H,
    tempo: 0,
    fx: app.fx,
    sfx,
    vista(chi, s) {
      app.net.send({ t: 'view', to: chi, v: { screen: 'game', run, game: def.id, s } });
    },
    invia(chi, d) {
      app.net.send({ t: 'msg', to: chi, d: { run, d } });
    },
    fine(ris) {
      if (fase !== 'gioco') return;
      risultato = normalizza(ris);
      risultato.ruoli = ruoli;
      fase = 'finito';
      tFase = 0;
      sfx.via();
    },
    dopo(sec, fn) {
      timers.push({ t: ctx.tempo + sec, fn });
    },
    ora: () => app.net.now(),
    giocatore: (id) => mappa.get(id),
    cpu(id) {
      if (!cervelli.has(id)) cervelli.set(id, creaCpu(mappa.get(id)));
      return cervelli.get(id);
    },
    connesso: (id) => {
      const p = app.giocatori.get(id);
      return !!p && (p.bot || p.connesso);
    },
    ruoli,
    avatar: disegnaAvatar,
    testa: disegnaTesta,
    testo,
    pannello,
    etichetta,
    barraTempo,
    griglia,
    testoSu,
  };

  function normalizza(ris) {
    const dettagli = { ...(ris.dettagli || {}) };
    let gruppi;
    if (ris.gruppi) {
      gruppi = ris.gruppi.map((g) => g.filter((id) => mappa.has(id))).filter((g) => g.length);
    } else {
      gruppi = gruppiDaPunteggi(ris.punteggi || {}, ris.alto !== false);
      if (ris.fmt) for (const id of Object.keys(ris.punteggi)) if (dettagli[id] == null) dettagli[id] = ris.fmt(ris.punteggi[id], id);
    }
    const presenti = new Set(gruppi.flat());
    const mancanti = lista.filter((p) => !presenti.has(p.id)).map((p) => p.id);
    if (mancanti.length) gruppi.push(mancanti);
    return { gruppi, dettagli };
  }

  // -------------------------------------------------------------------------
  // Introduzione

  function vistaIntro() {
    const v = {
      screen: 'intro',
      run,
      doppio: moltiplicatore > 1,
      etichetta: etichettaTorneo,
      game: { id: def.id, nome: def.nome, emoji: def.emoji, descrizione: def.descrizione, comeSiGioca: def.comeSiGioca, controllo: def.controllo },
    };
    app.net.send({ t: 'view', to: '*', v });
    if (!ruoli) return;
    // ognuno riceve le regole del suo ruolo
    const sp = speciali();
    for (const p of lista) {
      if (p.bot) continue;
      const r = infoRuoli[ruoli[p.id]];
      const altri = sp.filter((x) => x.id !== p.id).map((x) => x.nome);
      const capo = sp[0] ? infoRuoli[ruoli[sp[0].id]] : null;
      let nota = '';
      if (r && r.speciale) nota = altri.length ? `Insieme a ${altri.join(' e ')}` : '';
      else if (capo) nota = `${capo.emoji} ${capo.nome}: ${sp.map((x) => x.nome).join(' e ')}`;
      app.net.send({ t: 'view', to: p.id, v: { ...v, ruolo: r ? { emoji: r.emoji, titolo: r.titolo, regole: r.regole, speciale: !!r.speciale } : null, nota } });
    }
  }

  // Riga dei ruoli sulla scheda iniziale + gettoni con l'emoji del ruolo speciale.
  function mostraRuoli() {
    if (!domIntro || !ruoli) return;
    const sp = speciali();
    const r = sp[0] ? infoRuoli[ruoli[sp[0].id]] : null;
    const box = domIntro.querySelector('.intro-ruoli');
    box.innerHTML = r
      ? `<span>${r.emoji} ${sp.length > 1 ? `I ${esc(r.nome)}` : `Il ${esc(r.nome)}`}: <b>${sp.map((p) => esc(p.nome)).join('</b> e <b>')}</b></span><button class="btn btn-2 btn-piccolo" data-a="cambia">🔄 Cambia ${esc(r.nome)}</button>`
      : '';
    for (const el of domIntro.querySelectorAll('.pronto-chip')) {
      const info = infoRuoli[ruoli[el.dataset.id]];
      el.classList.toggle('speciale', !!info?.speciale);
      el.querySelector('.ruolo-badge').textContent = info?.speciale ? info.emoji : info?.badge || '';
    }
  }

  function cambiaRuoli() {
    if (!ruoli || fase !== 'intro') return;
    const prima = speciali().map((p) => p.id);
    esclusi.push(...prima);
    ruoli = scegliRuoli();
    // finiti i candidati si ricomincia il giro (escludendo solo chi c'era adesso)
    if (speciali().every((p) => prima.includes(p.id))) {
      esclusi = [...prima];
      ruoli = scegliRuoli();
    }
    ctx.ruoli = ruoli;
    sfx.pop();
    mostraRuoli();
    vistaIntro();
  }

  function mostraIntro() {
    const ctrl = CONTROLLI[def.controllo] || { emoji: '🎮', nome: def.controllo };
    app.ui.innerHTML = `
      <div class="intro schermo-entra" style="--c:${def.colore || '#ffd23f'}">
        <div class="intro-card ${ruoli ? 'con-ruoli' : ''}">
          ${etichettaTorneo ? `<div class="intro-etichetta">${esc(etichettaTorneo)}</div>` : ''}
          ${moltiplicatore > 1 ? '<div class="intro-doppio">⭐ PUNTI DOPPI! ⭐</div>' : ''}
          <div class="intro-emoji">${def.emoji}</div>
          <h1>${esc(def.nome)}</h1>
          <p class="intro-desc">${esc(def.descrizione)}</p>
          <div class="intro-controllo">${ctrl.emoji} ${esc(ctrl.nome)}</div>
          ${ruoli ? '<div class="intro-ruoli"></div>' : ''}
          <ol class="intro-regole">${def.comeSiGioca.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
          <div class="intro-pronti"></div>
          <div class="intro-foot">
            <span class="intro-stato"></span>
            <button class="btn btn-via">Via! ▶</button>
          </div>
        </div>
      </div>`;
    domIntro = app.ui.querySelector('.intro');
    const box = domIntro.querySelector('.intro-pronti');
    for (const p of lista) {
      const el = document.createElement('div');
      el.className = 'pronto-chip';
      el.dataset.id = p.id;
      el.style.setProperty('--c', p.colore);
      el.appendChild(canvasAvatar(p.av, 64, 64, { soloTesta: true }));
      const badge = document.createElement('i');
      badge.className = 'ruolo-badge';
      el.appendChild(badge);
      const n = document.createElement('span');
      n.textContent = p.bot ? `${p.nome} ${(LIVELLI[p.livello] || LIVELLI[1]).emoji}` : p.nome;
      el.appendChild(n);
      box.appendChild(el);
    }
    domIntro.querySelector('.btn-via').onclick = () => avviaConto();
    domIntro.addEventListener('click', (e) => {
      if (e.target.closest('[data-a="cambia"]')) cambiaRuoli();
    });
    mostraRuoli();
    aggiornaPronti();
  }

  function umaniAttivi() {
    return lista.filter((p) => !p.bot && ctx.connesso(p.id));
  }

  function aggiornaPronti() {
    if (!domIntro) return;
    for (const el of domIntro.querySelectorAll('.pronto-chip')) {
      const id = el.dataset.id;
      el.classList.toggle('ok', pronti.has(id));
      el.classList.toggle('off', !ctx.connesso(id));
    }
    const umani = umaniAttivi();
    const ok = umani.filter((p) => pronti.has(p.id)).length;
    const resto = Math.max(0, Math.ceil(ATTESA_INTRO - tFase));
    domIntro.querySelector('.intro-stato').textContent = `Pronti: ${ok}/${umani.length} · si parte tra ${resto} s`;
  }

  // -------------------------------------------------------------------------
  // Gioco

  function avviaConto() {
    if (fase !== 'intro') return;
    musica(false);
    app.ui.innerHTML = '';
    domIntro = null;
    fase = 'conto';
    tFase = 0;
    try {
      gioco = def.crea(ctx);
    } catch (err) {
      console.error(err);
      app.avviso(`Errore nel minigioco ${def.nome}`);
      return chiudi(null);
    }
    sfx.bip();
  }

  function aggiornaGioco(dt) {
    ctx.tempo += dt;
    const scaduti = timers.filter((t) => t.t <= ctx.tempo);
    if (scaduti.length) {
      timers = timers.filter((t) => t.t > ctx.tempo);
      for (const t of scaduti) t.fn();
    }
    if (gioco.bot && fase === 'gioco') {
      for (const p of lista) if (p.bot) gioco.bot(p.id, dt);
    }
    gioco.aggiorna(dt);
  }

  // -------------------------------------------------------------------------
  // Risultati

  function mostraRisultati() {
    fase = 'risultati';
    tFase = 0;
    musica(true);
    const { gruppi, dettagli } = risultato;
    const punti = puntiDaGruppi(gruppi, moltiplicatore);
    const pos = posizioniDaGruppi(gruppi);
    risultato.punti = punti;
    risultato.posizioni = pos;
    const ordine = gruppi.flat();
    const medaglie = { 1: '🥇', 2: '🥈', 3: '🥉' };

    app.ui.innerHTML = `
      <div class="risultati schermo-entra">
        <div class="ris-testa">
          <div class="ris-emoji">${def.emoji}</div>
          <div><h1>Risultati</h1><h2>${esc(def.nome)}${moltiplicatore > 1 ? ' · punti doppi' : ''}</h2></div>
        </div>
        <div class="ris-lista ${ordine.length > 8 ? 'due' : ''}"></div>
        <div class="ris-foot"><button class="btn btn-avanti">Avanti ▶</button><span class="suggerimento">Invio · oppure il capo dal telefono</span></div>
      </div>`;
    const box = app.ui.querySelector('.ris-lista');
    const n = ordine.length;
    ordine.forEach((id, i) => {
      const p = mappa.get(id);
      const riga = document.createElement('div');
      riga.className = 'ris-riga';
      riga.style.setProperty('--c', p.colore);
      riga.style.animationDelay = `${(n - 1 - i) * 0.12}s`;
      if (pos[id] === 1) riga.classList.add('vince');
      riga.innerHTML = `<div class="ris-pos">${medaglie[pos[id]] || pos[id] + '°'}</div>`;
      riga.appendChild(canvasAvatar(p.av, 62, 62, { soloTesta: true, espr: pos[id] === 1 ? 'felice' : null }));
      const nome = document.createElement('div');
      nome.className = 'ris-nome';
      nome.textContent = p.nome;
      riga.appendChild(nome);
      const det = document.createElement('div');
      det.className = 'ris-det';
      det.textContent = dettagli[id] ?? '';
      riga.appendChild(det);
      const pt = document.createElement('div');
      pt.className = 'ris-punti';
      pt.textContent = `+${punti[id]}`;
      riga.appendChild(pt);
      box.appendChild(riga);
    });
    app.ui.querySelector('.btn-avanti').onclick = () => chiudi(risultato);
    setTimeout(() => {
      if (fase === 'risultati') {
        sfx.fanfara();
        app.fx.coriandoli(120);
      }
    }, (n - 1) * 120 + 300);

    for (const p of lista) {
      if (p.bot) continue;
      app.net.send({
        t: 'view',
        to: p.id,
        v: { screen: 'result', run, pos: pos[p.id], tot: n, punti: punti[p.id], dettaglio: dettagli[p.id] ?? '', nome: def.nome, emoji: def.emoji, capo: app.capoId() },
      });
    }
  }

  function chiudi(ris) {
    if (finito) return;
    finito = true;
    app.ui.innerHTML = '';
    if (gioco && gioco.chiudi) gioco.chiudi();
    onFine(ris);
  }

  // -------------------------------------------------------------------------
  // Pausa

  function pausa(on) {
    if (fase !== 'gioco' && fase !== 'conto') return;
    inPausa = on;
    const el = app.ui.querySelector('.pausa');
    if (!on) {
      if (el) el.remove();
      return;
    }
    const div = document.createElement('div');
    div.className = 'pausa schermo-entra';
    div.innerHTML = `
      <div class="pausa-card">
        <h1>⏸ Pausa</h1>
        <button class="btn" data-a="riprendi">▶ Riprendi</button>
        <button class="btn btn-2" data-a="ricomincia">🔁 Ricomincia il minigioco</button>
        <button class="btn btn-3" data-a="esci">✖ Esci senza punti</button>
      </div>`;
    div.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'riprendi') pausa(false);
      else if (a === 'ricomincia') chiudi({ ricomincia: true });
      else if (a === 'esci') chiudi(null);
    };
    app.ui.appendChild(div);
  }

  // -------------------------------------------------------------------------
  // Scena

  return {
    run,
    entra() {
      musica(true);
      mostraIntro();
      vistaIntro();
      sfx.entra();
    },
    esci() {
      app.ui.innerHTML = '';
    },
    aggiorna(dt) {
      if (inPausa) return;
      tFase += dt;
      if (fase === 'intro') {
        aggiornaPronti();
        const umani = umaniAttivi();
        const tutti = umani.every((p) => pronti.has(p.id));
        if ((tutti && tFase > 1.2) || tFase > ATTESA_INTRO) avviaConto();
      } else if (fase === 'conto') {
        const prima = Math.floor(tFase / 0.8 - dt / 0.8);
        const ora = Math.floor(tFase / 0.8);
        if (ora !== prima && ora < 3) sfx.bip();
        if (tFase >= 2.4) {
          fase = 'gioco';
          tFase = 0;
          sfx.via();
          if (gioco.inizia) gioco.inizia();
        }
      } else if (fase === 'gioco') {
        aggiornaGioco(dt);
      } else if (fase === 'finito') {
        ctx.tempo += dt;
        gioco.aggiorna(dt);
        if (tFase > 1.8) mostraRisultati();
      }
    },
    disegna(g, t) {
      if (fase === 'intro' || fase === 'risultati') {
        sfondoFesta(g, t, shade(def.colore || '#7b2cbf', -0.55), shade(def.colore || '#7b2cbf', -0.25));
        return;
      }
      gioco.disegna(g);
      if (fase === 'conto') {
        g.fillStyle = 'rgba(10,5,30,0.35)';
        g.fillRect(0, 0, W, H);
        const n = 3 - Math.floor(tFase / 0.8);
        scrittaGrande(g, String(n), (tFase % 0.8) / 0.8, { dim: 260 });
      } else if (fase === 'gioco' && tFase < 0.9) {
        scrittaGrande(g, 'VIA!', tFase / 0.9, { dim: 240, colore: '#4cd97b' });
      } else if (fase === 'finito') {
        scrittaGrande(g, 'FINE!', Math.min(1, tFase / 1.8), { dim: 220, colore: '#ff4d6d' });
      }
      if (inPausa) {
        g.fillStyle = 'rgba(10,5,30,0.5)';
        g.fillRect(0, 0, W, H);
      }
    },
    input(pid, d) {
      if (!d || d.run !== run) return;
      if (fase === 'gioco' && !inPausa && gioco && mappa.has(pid)) gioco.input(pid, d.d);
      else if (fase === 'conto' && gioco && gioco.inputPrima && mappa.has(pid)) gioco.inputPrima(pid, d.d);
    },
    sys(pid, d, capo) {
      if (d.azione === 'pronto' && fase === 'intro' && (!d.run || d.run === run)) {
        pronti.add(pid);
        sfx.pop();
        aggiornaPronti();
      } else if (d.azione === 'avanti' && capo && fase === 'risultati') {
        chiudi(risultato);
      }
    },
    tasto(e) {
      if (e.key === 'Escape') {
        if (fase === 'gioco' || fase === 'conto') pausa(!inPausa);
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (fase === 'intro') avviaConto();
        else if (fase === 'risultati') chiudi(risultato);
        else if (inPausa) pausa(false);
        return true;
      }
      return false;
    },
    giocatoreCambiato() {
      aggiornaPronti();
    },
    // Chi rientra durante il gioco ritrova la sua schermata dal server;
    // il gioco può comunque reagire (es. rimandare dati).
    rientrato(id) {
      if (gioco && gioco.rientrato && mappa.has(id)) gioco.rientrato(id);
    },
  };
}
