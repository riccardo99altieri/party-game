// Banco di prova di Mani Incrociate: livelli delle CPU, confronto con le persone simulate, durata.
// Uso: node test/bench/pollici.mjs [volte]
//
// ============================================================================
// TABELLA DI RIFERIMENTO "UMANA" (persona media alla prima partita)
// ============================================================================
//
// Telefono tipico 390 x 760 px (~6 x 12 cm, 1 px ≈ 0,16 mm), tenuto in verticale con due mani.
//
// | grandezza                              | persona media | perché |
// |----------------------------------------|---------------|--------|
// | ritardo visivo sul binario             | 0,18 s        | occhio → pollice su un bersaglio che si muove (inseguimento manuale) |
// | quanto compensa guardando avanti       | 52%           | il pezzo che arriva si vede, ma lo si usa solo in parte |
// | inseguimento del pollice guardato      | 7,4 /s        | correzioni "a colpo d'occhio"; l'altro pollice: 4 /s (visione periferica) |
// | segue la pendenza del binario          | 70% / 45%     | pollice guardato / l'altro |
// | mani che vanno a specchio              | 17%           | accoppiamento bimanuale: muovere le mani dalla stessa parte o a ritmi diversi è difficile |
// | tremolio del pollice                   | 5,8 px (~1 mm)| |
// | attenzione su un pollice               | 0,39 s        | poi guarda l'altro (quello più in difficoltà) |
// | distrazioni                            | 0,18 /s       | 0,25–0,7 s in cui nessun pollice è guardato bene |
// | vede arrivare un incrocio              | 0,34 schermi  | ~0,8 s prima: alza un pollice e abbassa l'altro di ~46 px (7 mm) |
// | pollici che si toccano                 | < 85 px       | ~14 mm tra i centri: si spingono via |
// | pollice che si solleva da solo         | 0,014 /s      | molto di più con le mani incrociate o larghe (crampi) |
// | rimettere i pollici sui cerchi         | ~0,9 s        | accorgersi + spostare le mani, dopo la pausa di 1,5 s |
//
// Risultato: una persona media sbaglia 4–6 volte a gara e arriva in ~65–70 s (un robot
// perfetto in ~48 s). Nel modello (public/games/pollici/mani.js) è l'abilità 0,35 sulla scala
// principiante (0) – campione (1). La persona esperta (ci ha giocato parecchio) è 0,6.
//
// Livelli CPU: Facile 0,27 · Normale 0,35 (= la persona media) · Difficile 0,45, con una
// piccola variazione personale e il carattere. Il gioco non ha scelte tattiche vere: contano
// le mani, guardare avanti e alzare/abbassare i pollici prima degli incroci.

import { carica, partita, stampa, serie } from './lib.mjs';
import { gauss } from '../../public/games/cpu.js';
import { creaPista } from '../../public/games/pollici/pista.js';
import { creaCorridore, parametri, ABILITA } from '../../public/games/pollici/mani.js';

const volte = Number(process.argv[2]) || 200;
const def = await carica('pollici');
const pct = (v) => `${(v * 100).toFixed(0).padStart(3)}%`;

// Persona simulata: legge dal suo telefono (la vista) seme e partenza, e "tiene" il telefono
// con le stesse mani simulate delle CPU ma con l'abilità di una persona.
function persona(a = ABILITA.persona, nome = 'persona') {
  const rnd = {
    gauss,
    prob: (p) => Math.random() < p,
    num: (x, y) => x + Math.random() * (y - x),
    errore: (s) => gauss() * s,
    reazione: (k = 1) => Math.min(2.5, 0.36 * Math.exp(gauss() * 0.2) * k),
  };
  const tratti = { prudenza: Math.random(), aggressivita: Math.random(), costanza: Math.random(), pazienza: Math.random() };
  const f = (io) => {
    let r = null;
    return {
      aggiorna(dt) {
        const v = io.vista();
        if (!v || v.inizio == null) return;
        const t = (io.ora() - v.inizio) / 1000;
        if (t < 0) return;
        if (!r) r = creaCorridore(creaPista(v.seme), parametri(a, tratti), rnd);
        for (const d of r.passo(dt, t)) io.input(d);
      },
    };
  };
  return { umano: f, nome };
}

const errori = (dett) => Number((/❌ (\d+)/.exec(dett || '') || [])[1] || 0);

// 1) Ordine dei livelli: una CPU per livello
{
  const s = serie(def, [{ livello: 0 }, { livello: 1 }, { livello: 2 }], volte);
  stampa('Ordine dei livelli (F, N, D insieme)', s);
}

// 2) Ogni livello contro una persona media, testa a testa
console.log('\nCPU contro una persona media (testa a testa)   obiettivo: F 20–30%, N 45–55%, D 70–85%');
for (const liv of [0, 1, 2]) {
  const s = serie(def, [{ livello: liv }, persona()], volte);
  console.log(`  ${['Facile   ', 'Normale  ', 'Difficile'][liv]}  vince ${pct(s.giocatori[0].vittorie)}   (durata ${s.durata.toFixed(1)} s)`);
}

// 3) Il Difficile contro una persona esperta: l'esperto deve vincere
{
  const s = serie(def, [{ livello: 2 }, persona(ABILITA.esperto, 'esperto')], volte);
  console.log(`\nDifficile contro una persona esperta: la CPU vince ${pct(s.giocatori[0].vittorie)} (deve stare sotto il 50%)`);
}

// 4) Errori e tempi di ogni livello (da soli contro altre due CPU dello stesso livello)
console.log('\nErrori e tempi per livello (3 CPU uguali)');
for (const liv of [0, 1, 2]) {
  let err = 0;
  let tempo = 0;
  let arrivati = 0;
  let giri = 0;
  const N = Math.max(20, Math.floor(volte / 4));
  for (let k = 0; k < N; k++) {
    const r = partita(def, [{ livello: liv }, { livello: liv }, { livello: liv }]);
    for (const id of r.ids) {
      giri++;
      err += errori(r.dettagli[id]);
      const m = /^([\d,]+) s/.exec(r.dettagli[id]);
      if (m) {
        arrivati++;
        tempo += Number(m[1].replace(',', '.'));
      }
    }
  }
  console.log(`  ${['Facile   ', 'Normale  ', 'Difficile'][liv]}  errori a gara ${(err / giri).toFixed(1)}   arrivati ${pct(arrivati / giri)}   tempo medio ${(tempo / Math.max(1, arrivati)).toFixed(1)} s`);
}

// 5) Durata con pochi e tanti giocatori
console.log('\nDurata della gara (CPU Normali)');
for (const n of [3, 4, 8, 16]) {
  let d = 0;
  const N = Math.max(10, Math.floor(volte / 10));
  for (let k = 0; k < N; k++) d += partita(def, Array.from({ length: n }, () => ({ livello: 1 }))).secondi;
  console.log(`  ${String(n).padStart(2)} giocatori: ${(d / N).toFixed(1)} s`);
}
