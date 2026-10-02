# Specifica delle CPU — il "contratto" del comitato

Obiettivo: CPU da gioco di serie A. Devono sembrare persone vere, giocare con
tattiche sensate e avere **tre livelli di potenza** ben distinti, scelti per ogni
singolo bot dalla lobby.

## Livelli

| Livello | Nome | Chi imita | Contro una persona media |
|---|---|---|---|
| 0 | 🐣 Facile | un principiante distratto (circa il 20°–30° percentile delle persone) | vince il 20–30% delle volte |
| 1 | 🙂 Normale | una persona media alla prima partita | vince il 45–55% |
| 2 | 🔥 Difficile | un giocatore molto bravo (circa l'85°–90° percentile) | vince il 70–85%, ma un esperto lo batte |

## Regole d'oro (valgono per tutti)

1. **Niente trucchi.** Una CPU sa solo quello che saprebbe una persona: lo schermo grande
   (posizioni, risultati mostrati, round precedenti) e il proprio telefono.
   - Vietato: leggere scelte segrete degli altri (numeri, voti, colori scelti nel round in corso),
     conoscere eventi futuri (quando arriva il segnale, se la prossima parola è una finta),
     usare valori esatti che l'occhio non legge (il colore esatto da ricordare, le coordinate
     esatte di un punto sparito, le intenzioni/joystick degli altri).
   - Permesso: stimare quelle cose con il rumore e il ritardo che avrebbe una persona.
2. **Tempi umani.** Si reagisce a quello che succede con `cpu.reazione()` (tempo log-normale per
   livello) e si ripianifica a intervalli, non a ogni fotogramma. Percezione "in ritardo":
   si decide su quello che si è visto un attimo fa.
3. **Errori credibili.** Rumore a campana (`cpu.errore(sigma)`), esitazioni, esagerazioni,
   qualche svista grossa rara (più rara ai livelli alti). Mai perfezione ripetibile.
4. **Personalità.** `cpu.tratti` (aggressività, prudenza, pazienza, costanza in [0,1]) rende
   diversi due bot dello stesso livello. Mai bot sincronizzati o identici.
5. **Tattica, non solo rumore.** Ai livelli alti la CPU deve anche *scegliere meglio*
   (posizionarsi, sfruttare gli errori altrui, gestire il rischio), non solo tremare meno.
6. **Movimento naturale sullo schermo.** Niente scatti o tremolii: il joystick cambia in modo
   graduale, le pause sembrano pause di una persona.
7. **Leggeri.** `bot(id, dt)` viene chiamato 60 volte al secondo per ognuno dei 16 bot:
   niente calcoli pesanti a ogni fotogramma.
8. **Le regole del gioco per le persone non cambiano.** Si toccano solo i bot. Se trovi un
   bug del gioco, correggilo solo se è evidente e segnalalo nel rapporto.

## Strumenti (public/games/cpu.js)

Dentro il minigioco: `const cpu = ctx.cpu(id);` (una per bot, nuova a ogni partita).

- `cpu.livello` (0, 1, 2), `cpu.abilita` (0–1, con variazione personale)
- `cpu.per(facile, normale, difficile)`: il valore per il livello
- `cpu.tra(peggio, meglio)`: interpolazione con l'abilità personale
- `cpu.reazione(scala)`: tempo di reazione in secondi (mediana 0,50 / 0,36 / 0,28)
- `cpu.pensa(min, max)`: tempo per decidere (più lungo per i principianti)
- `cpu.errore(sigma)`, `cpu.gauss()`, `cpu.num(a, b)`, `cpu.intero(a, b)`, `cpu.scegli(arr)`, `cpu.prob(p)`
- `cpu.tratti`, `cpu.mem` (memoria libera per lo stato del bot)

## Misure

- Banco di prova: `test/bench/lib.mjs` (`partita`, `serie`, `stampa`), fotografia veloce:
  `node test/bench/base.mjs 40 sumo,bocce`.
- Per ogni gioco servono:
  1. **Ordine dei livelli**: partite con una CPU per livello (F, N, D), almeno 100:
     posizione media D < N < F con distacchi netti; D vince almeno il 50% (40% nei giochi
     molto caotici: Bocce, Il Più Alto Unico, Galleria); F è ultimo almeno il 50% (40%).
  2. **Taratura sulle persone**: una tabella di riferimento del punteggio "umano" nel gioco
     (tempo di reazione, battiti al secondo, distanza di colore, ecc.), con le ipotesi scritte.
     Dove serve, una "persona simulata" (`{ umano: ... }` nel banco) che usa gli stessi dati
     del telefono. I tre livelli devono cadere nelle fasce della tabella qui sopra.
  3. **Durata**: con 3, 4 e 8 CPU dello stesso livello le partite restano di durata sensata.
- **Giochi a ruoli** (Il Polpo, `test/bench/polpo.mjs`): ogni ruolo si misura a parte.
  - Il ruolo speciale (Polpo) contro una persona simulata nello stesso ruolo: stesse fasce.
  - Il ruolo di massa (pesci): una CPU insieme a persone simulate. Qui l'esito dipende
    molto da chi il Polpo sceglie di inseguire, quindi i confronti a coppie restano
    compressi: basta l'ordine giusto (il Difficile arriva nettamente più spesso).
  - In più, l'**equilibrio**: con tutte CPU Normali il ruolo speciale deve prendere nel
    torneo circa gli stessi punti della media (né condanna né premio sicuro).
- `GIOCHI=sumo,bocce node --test test/giochi.test.mjs` prova solo alcuni giochi.
  Non lanciare `npm test` intero mentre altri lavorano (la prova di rete usa una porta fissa).

## Divisione del lavoro

| Agente | Minigiochi | File di misura |
|---|---|---|
| Azione | sumo, bocce, lumache, ali | `test/bench/azione.mjs` |
| Precisione | filo, manoferma, colore, twister | `test/bench/precisione.mjs` |
| Mente | fuoco, unico, galleria | `test/bench/mente.mjs` |
| Revisore | tutti (solo controllo) | `test/bench/RAPPORTO.md` |

Ognuno modifica **solo** i `host.js` dei suoi giochi e il suo file di misura. `cpu.js`,
`lib.mjs`, i test e il resto del gioco sono condivisi: se serve una modifica, la si chiede.
