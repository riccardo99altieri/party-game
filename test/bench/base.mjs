// Fotografia veloce di tutti i minigiochi: una CPU per livello (Facile, Normale,
// Difficile) nella stessa partita. Uso: node test/bench/base.mjs [volte] [id,id,...]

import { ELENCO } from '../../public/games/index.js';
import { carica, serie, stampa } from './lib.mjs';

const volte = Number(process.argv[2]) || 40;
const solo = process.argv[3] ? process.argv[3].split(',') : ELENCO;

for (const id of solo) {
  const def = await carica(id);
  const s = serie(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte, { mescola: true });
  stampa(`${def.emoji} ${def.nome} — 3 CPU, ${volte} partite`, s);
}
