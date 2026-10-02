// Il Più Alto Unico: un numero scelto da una sola persona vale quei punti,
// i doppioni valgono zero, il più alto tra gli unici prende un bonus.

export const BONUS = 5;

export const massimo = (giocatori) => Math.min(20, giocatori <= 6 ? 10 : giocatori + 4);

// scelte: { id: numero } (chi non ha scelto non compare)
export function esitoRound(scelte) {
  const quanti = {};
  for (const v of Object.values(scelte)) quanti[v] = (quanti[v] || 0) + 1;
  const unici = Object.keys(quanti)
    .map(Number)
    .filter((v) => quanti[v] === 1);
  const migliore = unici.length ? Math.max(...unici) : null;
  const punti = {};
  for (const [id, v] of Object.entries(scelte)) {
    punti[id] = quanti[v] === 1 ? v + (v === migliore ? BONUS : 0) : 0;
  }
  return { punti, quanti, unici, migliore };
}
