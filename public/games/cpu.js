// Cervello comune delle CPU: livelli di "potenza" e strumenti per comportarsi
// come persone vere (tempi di reazione, errori, distrazioni, personalità).
// Ogni minigioco lo usa dentro bot(id, dt) con:  const cpu = ctx.cpu(id);
//
// Regole d'oro (valgono per tutti i minigiochi):
// - una CPU sa solo quello che saprebbe una persona (schermo grande + il suo telefono):
//   niente scelte segrete degli altri, niente eventi futuri, niente valori esatti
//   che un occhio umano non può leggere;
// - reagisce con un ritardo umano e sbaglia in modo credibile;
// - Facile < Normale < Difficile, sempre, ma anche Difficile si può battere.

export const LIVELLI = [
  { id: 0, nome: 'Facile', emoji: '🐣', descrizione: 'Principiante: lento, distratto, sbaglia spesso' },
  { id: 1, nome: 'Normale', emoji: '🙂', descrizione: 'Come una persona che gioca per la prima volta' },
  { id: 2, nome: 'Difficile', emoji: '🔥', descrizione: 'Un osso duro: veloce e furbo, ma si può battere' },
];

export const LIVELLO_BASE = 1;

export const livelloValido = (v) => (v === 0 || v === 1 || v === 2 ? v : LIVELLO_BASE);

// Abilità media di ogni livello (0 = pessimo, 1 = perfetto). Ogni CPU ha una
// piccola variazione personale, così due bot dello stesso livello non sono gemelli.
const ABILITA = [0.25, 0.55, 0.85];

// Tempo di reazione a un segnale visivo, in secondi: mediana e dispersione
// (distribuzione log-normale, come quella delle persone). Include il ritardo
// del tocco sul telefono. Riferimento: una persona media sta intorno a 0,33 s.
const REAZIONE = [
  { mediana: 0.5, sigma: 0.28 },
  { mediana: 0.36, sigma: 0.2 },
  { mediana: 0.28, sigma: 0.14 },
];

// Numero casuale "a campana" (media 0, deviazione 1), metodo di Box-Muller.
export function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Crea il "cervello" di una CPU a partire dal giocatore ({ livello }).
export function creaCpu(giocatore = {}) {
  const livello = livelloValido(giocatore.livello);
  const abilita = clamp01(ABILITA[livello] + gauss() * 0.04);
  const R = REAZIONE[livello];
  const cpu = {
    livello,
    abilita,
    // Tratti di carattere in [0, 1]: ogni minigioco li usa come vuole.
    tratti: {
      aggressivita: Math.random(),
      prudenza: Math.random(),
      pazienza: Math.random(),
      costanza: Math.random(),
    },
    // Memoria libera per il minigioco (stato della CPU tra un fotogramma e l'altro).
    mem: {},

    // Il valore giusto per il livello: cpu.per(facile, normale, difficile).
    per: (facile, normale, difficile) => [facile, normale, difficile][livello],
    // Interpola tra "come giocherebbe un pessimo giocatore" e "uno perfetto"
    // usando l'abilità personale (utile per i parametri continui).
    tra: (peggio, meglio) => peggio + (meglio - peggio) * abilita,

    caso: () => Math.random(),
    num: (a, b) => a + Math.random() * (b - a),
    intero: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    scegli: (arr) => arr[Math.floor(Math.random() * arr.length)],
    prob: (p) => Math.random() < p,
    gauss,
    // Errore a campana con deviazione sigma (già scalata dal chiamante per il livello).
    errore: (sigma) => gauss() * sigma,

    // Tempo di reazione umano (secondi) a un evento che si vede sullo schermo.
    reazione(scala = 1) {
      return Math.min(2.5, R.mediana * Math.exp(gauss() * R.sigma) * scala);
    },
    // Tempo per "pensare" a una scelta (secondi), più lungo per i principianti.
    pensa(minimo, massimo) {
      const k = [1.25, 1, 0.8][livello];
      return (minimo + Math.random() * (massimo - minimo)) * k;
    },
  };
  return cpu;
}
