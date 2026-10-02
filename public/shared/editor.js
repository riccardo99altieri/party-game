// Editor dell'avatar: anteprima animata, schede Volto / Corpo / Colore,
// opzioni in righe con miniature, pulsante casuale. Lo usano il telefono
// (entrata nella festa) e lo schermo (gestione dei personaggi salvati).

import { VOCI, normalizza, casuale, disegnaAvatar, disegnaTesta, prepara } from './avatar.js';
import { COLORI_GIOCATORE } from './util.js';

const SCHEDE = [
  { k: 'volto', nome: '😀 Volto' },
  { k: 'corpo', nome: '👕 Corpo' },
  { k: 'colore', nome: '🎨 Colore' },
];

// Per le voci del viso ingrandiamo la miniatura sulla parte che conta.
const ZOOM = {
  occhi: { r: 44, dy: 2 },
  sopracciglia: { r: 44, dy: 14 },
  bocca: { r: 44, dy: -18 },
  barba: { r: 32, dy: -14 },
  occhiali: { r: 42, dy: 2 },
  cappello: { r: 19, dy: 12 },
  capelli: { r: 21, dy: 5 },
  testa: { r: 22, dy: 2 },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function apriEditor(
  root,
  {
    avatar,
    nome,
    presi = () => [],
    onFatto,
    testoFatto = 'Fatto! ✔',
    onAnnulla = null,
    testoAnnulla = 'Annulla',
    classeBottone = 'btn-tel',
    segnaposto = 'Il tuo nome',
    erroreNome = 'Scrivi il tuo nome ✍️',
    controllaNome = null, // (nome) => messaggio d'errore oppure null
    notaColore = 'Il tuo colore ti fa riconoscere sullo schermo grande. I colori già presi sono barrati.',
    miniatura: MINI = 64, // lato delle miniature in pixel
  },
) {
  let av = normalizza(avatar || casuale());
  let scheda = 'volto';
  let raf = 0;
  let festa = 0;

  root.innerHTML = `
    <div class="editor">
      <div class="ed-anteprima">
        <canvas class="ed-canvas"></canvas>
        <button class="ed-dado" title="Casuale">🎲</button>
      </div>
      <input class="ed-nome" maxlength="16" placeholder="${esc(segnaposto)}" value="${esc(nome || '')}" autocomplete="off" enterkeyhint="done">
      <div class="ed-schede">${SCHEDE.map((s) => `<button data-s="${s.k}">${s.nome}</button>`).join('')}</div>
      <div class="ed-voci"></div>
      <div class="ed-foot"><div class="ed-errore"></div>${
        onAnnulla ? `<button class="${classeBottone} ed-annulla">${esc(testoAnnulla)}</button>` : ''
      }<button class="${classeBottone} ed-fatto">${testoFatto}</button></div>
    </div>`;

  const cv = root.querySelector('.ed-canvas');
  const g = cv.getContext('2d');
  const voci = root.querySelector('.ed-voci');
  const inputNome = root.querySelector('.ed-nome');
  const errore = root.querySelector('.ed-errore');

  function dimensionaAnteprima() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }

  function anima(ms) {
    const t = ms / 1000;
    const r = cv.getBoundingClientRect();
    const dpr = cv.width / Math.max(1, r.width);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    // spazio sopra la testa per i cappelli alti (quello a punta usciva dal riquadro)
    const h = Math.min(r.height * 0.84, r.width);
    disegnaAvatar(g, av, r.width / 2, r.height * 0.97, h, { pose: t < festa ? 'cheer' : 'idle', t });
    raf = requestAnimationFrame(anima);
  }

  // presi() restituisce i colori degli ALTRI giocatori.
  const colorePreso = (i) => presi().includes(i);

  function miniatura(voce, valore) {
    const c = document.createElement('canvas');
    const faccia = voce.scheda === 'volto';
    const k = MINI / 64;
    const W = MINI;
    const H = faccia ? MINI : Math.round(84 * k);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const gg = c.getContext('2d');
    gg.scale(dpr, dpr);
    const prova = prepara({ ...av, [voce.k]: valore });
    if (faccia) {
      const z = ZOOM[voce.k] || { r: 24, dy: 4 };
      disegnaTesta(gg, prova, W / 2, H / 2 + z.dy * k, z.r * k, { t: 1 });
    } else {
      disegnaAvatar(gg, prova, W / 2, H - 3 * k, 118 * k, { t: 1, ombra: false });
    }
    return c;
  }

  function renderVoci() {
    voci.innerHTML = '';
    for (const voce of VOCI.filter((v) => v.scheda === scheda)) {
      const riga = document.createElement('div');
      riga.className = 'ed-riga';
      riga.innerHTML = `<div class="ed-etichetta">${voce.nome}</div>`;
      const scorri = document.createElement('div');
      scorri.className = 'ed-opzioni';
      const n = voce.colori ? voce.colori.length : voce.n;
      for (let i = 0; i < n; i++) {
        const b = document.createElement('button');
        b.className = voce.colori ? 'ed-colore' : 'ed-opz';
        if (av[voce.k] === i) b.classList.add('on');
        if (voce.colori) {
          b.style.background = voce.colori[i];
          if (voce.k === 'colore') {
            b.classList.add('grande');
            b.title = COLORI_GIOCATORE[i].nome;
            if (colorePreso(i)) {
              b.classList.add('preso');
              b.disabled = true;
            }
          }
        } else {
          b.appendChild(miniatura(voce, i));
          if (voce.nomi) {
            const s = document.createElement('span');
            s.textContent = voce.nomi[i];
            b.appendChild(s);
          }
        }
        b.onclick = () => {
          av = { ...av, [voce.k]: i };
          festa = performance.now() / 1000 + 0.8;
          renderVoci();
        };
        scorri.appendChild(b);
      }
      riga.appendChild(scorri);
      voci.appendChild(riga);
      const on = scorri.querySelector('.on');
      if (on) scorri.scrollLeft = Math.max(0, on.offsetLeft - scorri.clientWidth / 2 + on.clientWidth / 2);
    }
    if (scheda === 'colore') {
      const nota = document.createElement('p');
      nota.className = 'ed-nota';
      nota.textContent = notaColore;
      voci.appendChild(nota);
    }
  }

  function mostraScheda(k) {
    scheda = k;
    for (const b of root.querySelectorAll('.ed-schede button')) b.classList.toggle('on', b.dataset.s === k);
    renderVoci();
    voci.scrollTop = 0;
  }

  root.querySelector('.ed-schede').onclick = (e) => {
    const b = e.target.closest('[data-s]');
    if (b) mostraScheda(b.dataset.s);
  };
  root.querySelector('.ed-dado').onclick = () => {
    const col = av.colore;
    av = normalizza(casuale(col));
    festa = performance.now() / 1000 + 0.8;
    renderVoci();
  };
  root.querySelector('.ed-fatto').onclick = () => {
    const n = inputNome.value.trim();
    const problema = !n ? erroreNome : controllaNome ? controllaNome(n) : null;
    if (problema) {
      errore.textContent = problema;
      inputNome.focus();
      return;
    }
    cancelAnimationFrame(raf);
    onFatto(n, av);
  };
  if (onAnnulla) {
    root.querySelector('.ed-annulla').onclick = () => {
      cancelAnimationFrame(raf);
      onAnnulla();
    };
  }
  inputNome.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inputNome.blur();
  });

  // Se il colore scelto è già preso, proponiamo il primo libero.
  if (colorePreso(av.colore)) {
    const libero = COLORI_GIOCATORE.findIndex((_, i) => !presi().includes(i));
    if (libero >= 0) av.colore = libero;
  }

  dimensionaAnteprima();
  window.addEventListener('resize', dimensionaAnteprima);
  mostraScheda('volto');
  raf = requestAnimationFrame(anima);

  return {
    aggiornaPresi() {
      if (scheda === 'colore') renderVoci();
    },
    chiudi() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', dimensionaAnteprima);
    },
  };
}
