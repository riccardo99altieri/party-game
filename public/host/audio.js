// Effetti sonori e musichetta generati con WebAudio: nessun file audio.

let ac = null;
let master = null;
let busMusica = null;
let muto = false;
let musicaAttiva = false;
let prossimaNota = 0;
let passo = 0;
let timerMusica = null;

try {
  muto = localStorage.getItem('pg-muto') === '1';
} catch {}

export function sblocca() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muto ? 0 : 0.55;
    master.connect(ac.destination);
    busMusica = ac.createGain();
    busMusica.gain.value = 0.16;
    busMusica.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
}

export function isMuto() {
  return muto;
}

export function setMuto(v) {
  muto = v;
  try {
    localStorage.setItem('pg-muto', v ? '1' : '0');
  } catch {}
  if (master) master.gain.setTargetAtTime(v ? 0 : 0.55, ac.currentTime, 0.05);
}

function pronto() {
  return ac && ac.state === 'running';
}

function tono(freq, dur, o = {}) {
  if (!pronto()) return;
  const t0 = ac.currentTime + (o.ritardo || 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = o.tipo || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.a) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.a), t0 + dur);
  const vol = o.vol ?? 0.25;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + (o.attacco ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(o.bus || master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

let bufRumore = null;
function rumore(dur, o = {}) {
  if (!pronto()) return;
  if (!bufRumore) {
    bufRumore = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = bufRumore.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + (o.ritardo || 0);
  const src = ac.createBufferSource();
  src.buffer = bufRumore;
  const filtro = ac.createBiquadFilter();
  filtro.type = o.filtro || 'lowpass';
  filtro.frequency.setValueAtTime(o.freq ?? 1200, t0);
  if (o.a) filtro.frequency.exponentialRampToValueAtTime(o.a, t0 + dur);
  filtro.Q.value = o.q ?? 1;
  const gain = ac.createGain();
  const vol = o.vol ?? 0.3;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filtro);
  filtro.connect(gain);
  gain.connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

// Limita gli effetti ripetuti (es. tanti urti nello stesso istante).
const ultimi = {};
function limita(nome, ms) {
  const now = performance.now();
  if (ultimi[nome] && now - ultimi[nome] < ms) return false;
  ultimi[nome] = now;
  return true;
}

export const sfx = {
  click: () => tono(880, 0.06, { tipo: 'square', vol: 0.08 }),
  bip: () => tono(660, 0.14, { tipo: 'square', vol: 0.12 }),
  via: () => {
    tono(990, 0.35, { tipo: 'square', vol: 0.13 });
    tono(1320, 0.35, { tipo: 'square', vol: 0.08, ritardo: 0.02 });
  },
  pop: () => limita('pop', 40) && tono(420, 0.12, { a: 900, vol: 0.2 }),
  entra: () => {
    tono(523, 0.1, { tipo: 'triangle', vol: 0.2 });
    tono(784, 0.16, { tipo: 'triangle', vol: 0.2, ritardo: 0.08 });
  },
  colpo: (forza = 1) => {
    if (!limita('colpo', 50)) return;
    tono(160, 0.16, { a: 60, tipo: 'triangle', vol: 0.3 * Math.min(1, forza) });
    rumore(0.08, { freq: 900, vol: 0.18 * Math.min(1, forza) });
  },
  splash: () => {
    rumore(0.6, { freq: 2500, a: 300, vol: 0.35 });
    tono(300, 0.25, { a: 80, vol: 0.15 });
  },
  zap: () => {
    if (!limita('zap', 60)) return;
    tono(1200, 0.18, { a: 120, tipo: 'sawtooth', vol: 0.09 });
    rumore(0.15, { filtro: 'highpass', freq: 3000, vol: 0.12 });
  },
  sparo: () => {
    rumore(0.35, { freq: 4000, a: 200, vol: 0.55 });
    tono(110, 0.3, { a: 40, tipo: 'triangle', vol: 0.4 });
  },
  moneta: () => {
    if (!limita('moneta', 40)) return;
    tono(988, 0.07, { tipo: 'square', vol: 0.08 });
    tono(1319, 0.2, { tipo: 'square', vol: 0.08, ritardo: 0.07 });
  },
  ding: () => {
    tono(1568, 0.5, { vol: 0.15 });
    tono(2093, 0.4, { vol: 0.07, ritardo: 0.01 });
  },
  whoosh: () => rumore(0.35, { filtro: 'bandpass', freq: 400, a: 2400, q: 2, vol: 0.25 }),
  lancio: () => rumore(0.25, { filtro: 'bandpass', freq: 800, a: 300, q: 1.5, vol: 0.2 }),
  tic: () => limita('tic', 30) && tono(1800, 0.03, { tipo: 'square', vol: 0.05 }),
  fallimento: () => {
    tono(392, 0.2, { tipo: 'triangle', vol: 0.2 });
    tono(330, 0.2, { tipo: 'triangle', vol: 0.2, ritardo: 0.18 });
    tono(262, 0.45, { tipo: 'triangle', vol: 0.2, ritardo: 0.36 });
  },
  fanfara: () => {
    const note = [523, 659, 784, 1047, 784, 1047];
    const tempi = [0, 0.12, 0.24, 0.36, 0.52, 0.64];
    note.forEach((f, i) => tono(f, i === note.length - 1 ? 0.7 : 0.16, { tipo: 'square', vol: 0.1, ritardo: tempi[i] }));
    note.forEach((f, i) => tono(f / 2, i === note.length - 1 ? 0.7 : 0.16, { tipo: 'triangle', vol: 0.15, ritardo: tempi[i] }));
  },
  rullo: (durata = 1.5) => {
    for (let t = 0; t < durata; t += 0.05) rumore(0.05, { freq: 1500, vol: 0.06 + (t / durata) * 0.1, ritardo: t });
  },
  boom: () => {
    rumore(0.7, { freq: 800, a: 60, vol: 0.5 });
    tono(90, 0.5, { a: 30, tipo: 'triangle', vol: 0.4 });
  },
  punto: (i = 0) => tono(523 * Math.pow(2, (i % 12) / 12), 0.12, { tipo: 'triangle', vol: 0.15 }),
};

// ---------------------------------------------------------------------------
// Musichetta: giro di accordi allegro, programmato con un po' di anticipo.

const BPM = 116;
const ACCORDI = [
  [262, 330, 392], // Do
  [220, 262, 330], // La-
  [175, 220, 262], // Fa
  [196, 247, 294], // Sol
];

function programma() {
  if (!pronto() || !musicaAttiva) return;
  const ottavo = 60 / BPM / 2;
  while (prossimaNota < ac.currentTime + 0.3) {
    const accordo = ACCORDI[Math.floor(passo / 8) % 4];
    const p = passo % 8;
    const t = prossimaNota - ac.currentTime;
    if (p % 4 === 0) tono(accordo[0] / 2, ottavo * 1.8, { tipo: 'triangle', vol: 0.5, ritardo: t, bus: busMusica });
    if (p % 4 === 2) tono(accordo[2] / 2, ottavo * 1.2, { tipo: 'triangle', vol: 0.35, ritardo: t, bus: busMusica });
    const arp = [0, 1, 2, 1, 0, 2, 1, 2][p];
    tono(accordo[arp] * 2, ottavo * 0.9, { tipo: 'square', vol: 0.09, ritardo: t, bus: busMusica });
    if (p === 7 && Math.floor(passo / 8) % 2 === 1) tono(accordo[2] * 4, ottavo * 0.6, { tipo: 'sine', vol: 0.1, ritardo: t, bus: busMusica });
    prossimaNota += ottavo;
    passo++;
  }
}

export function musica(on) {
  if (on === musicaAttiva) return;
  musicaAttiva = on;
  clearInterval(timerMusica);
  if (on) {
    if (ac) prossimaNota = ac.currentTime + 0.1;
    passo = 0;
    timerMusica = setInterval(() => {
      if (ac && prossimaNota < ac.currentTime) prossimaNota = ac.currentTime + 0.05;
      programma();
    }, 100);
  }
}
