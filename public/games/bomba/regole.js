// Regole di Detonazione condivise da schermo, telefoni e banco di prova: i gesti,
// le sequenze, quante bombe e quante vite, l'orologio della bomba che accelera.

// I gesti che il telefono riconosce. 'swipe' = un dito che scorre, 'tocco' = un dito
// fermo, 'due' = due dita.
export const GESTI = {
  su: { emoji: '⬆️', nome: 'Swipe su', tipo: 'swipe' },
  giu: { emoji: '⬇️', nome: 'Swipe giù', tipo: 'swipe' },
  sx: { emoji: '⬅️', nome: 'Swipe a sinistra', tipo: 'swipe' },
  dx: { emoji: '➡️', nome: 'Swipe a destra', tipo: 'swipe' },
  doppio: { emoji: '👆', nome: 'Doppio tap', tipo: 'tocco' },
  tieni: { emoji: '✋', nome: 'Tieni premuto', tipo: 'tocco' },
  pizzica: { emoji: '🤏', nome: 'Pizzica', tipo: 'due' },
};

// Ogni bomba ha il suo colore, uguale sulla TV e sui telefoni.
export const BOMBE = [
  { colore: '#ff3b3b', nome: 'rossa' },
  { colore: '#ffc53d', nome: 'gialla' },
  { colore: '#3ee0ff', nome: 'azzurra' },
];

export const LUNGHEZZA = 4; // gesti per passare la bomba
export const TIENI_MS = 500; // quanto tenere premuto
export const ACC = 0.09; // accelerazione del timer: velocità 1 + ACC·secondi
export const DURATA = [10, 17]; // durata vera di una bomba (secondi), a caso
export const PAUSA = 2.5; // secondi tra un'esplosione e la bomba nuova
export const VOLO = 0.35; // secondi di volo della bomba tra due giocatori

// Da 7 giocatori in gioco le bombe sono 2, da 12 sono 3.
export const bombePer = (vivi) => (vivi >= 12 ? 3 : vivi >= 7 ? 2 : 1);

// Vite di ognuno: con pochi giocatori la partita dura di più (non finisce in 2 esplosioni).
export const vitePer = (n) => (n <= 3 ? 3 : n <= 5 ? 2 : 1);

// Quanto spesso esce ogni gesto: i 4 swipe insieme poco meno della metà.
const PESI = { su: 1.2, giu: 1.2, sx: 1.2, dx: 1.2, doppio: 2, tieni: 1.6, pizzica: 1.6 };

// Una sequenza a caso: mai due gesti uguali di fila, al massimo un "tieni premuto"
// e un "pizzica" (sono i più lenti).
export function creaSequenza(rnd = Math.random, n = LUNGHEZZA) {
  const seq = [];
  while (seq.length < n) {
    const pool = Object.keys(PESI).filter((g) => g !== seq[seq.length - 1] && !((g === 'tieni' || g === 'pizzica') && seq.includes(g)));
    let r = rnd() * pool.reduce((s, g) => s + PESI[g], 0);
    let scelto = pool[pool.length - 1];
    for (const g of pool) {
      r -= PESI[g];
      if (r < 0) {
        scelto = g;
        break;
      }
    }
    seq.push(scelto);
  }
  return seq;
}

// Orologio della bomba: il numero sul display scende sempre più in fretta
// (velocità 1 + ACC·τ, τ = secondi veri da quando è comparsa). Una bomba che dura
// T secondi veri parte da inizioDisplay(T) e arriva a 0 esattamente dopo T secondi.
export const inizioDisplay = (T) => T + (ACC * T * T) / 2;
export const display = (B0, tau) => Math.max(0, B0 - tau - (ACC * tau * tau) / 2);
export const velocita = (tau) => 1 + ACC * tau;
