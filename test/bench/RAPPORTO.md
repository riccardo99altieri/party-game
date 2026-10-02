# Rapporto del Revisore sulle CPU

Controllo indipendente delle CPU degli 11 minigiochi dopo la riscrittura di "Azione", "Precisione" e "Mente".
Cosa ho fatto: ho riletto riga per riga la parte bot di ogni `host.js` confrontandola con il suo `phone.js`,
ho rilanciato i tre banchi e ho usato degli script miei (solo nella cartella di lavoro, non nel progetto) per
questi casi: pausa, persona scollegata, 1/2/16 bot, bot sincronizzati, prestazioni, memoria, posti nelle Bocce.

**Esito di `npm test`: 47/47 superati.**

> **Aggiornamento dopo i ritocchi del comitato** (le tabelle qui sotto sono quelle della revisione):
> - **Risolti**: P4 Unico Facile (ora 28% contro la persona), P5 memoria del Difficile limitata oltre 6 giocatori,
>   P6 Galleria (F 27%, N 47%, D 80%), P8 Sumo (partite sotto 20 s con 3 Normali: 7%, persone 6%; fasce 22/49/77),
>   P12 doppione di Twister tolto. Fuoco: uno sparo in ritardo ora conta al massimo 1000 ms, come non sparare
>   (fasce 25/50/80). Filo: bug dell'avanzamento corretto anche nel telefono. Twister: cerchi condivisi in `regole.js`.
> - **Aperti, da decidere**: P9 input durante la pausa, P10 persone scollegate, P11 `cpu.abilita`.
> - `npm test` 47/47 dopo i ritocchi.
>
> **Bocce, P2 risolto (2026-09-30).** Il campo ora è rotondo, con il pallino al centro, e i giocatori stanno in
> cerchio sul bordo, tutti alla stessa distanza (356 px) e a distanze uguali tra loro. Il telefono non è cambiato:
> il suo angolo si legge rispetto alla direzione del pallino, quindi "dritto in su" porta sempre al pallino.
> - Prima ho provato l'arco proposto qui sotto (±45°): la distanza era la stessa per tutti, ma chi stava in
>   mezzo al ventaglio vinceva ancora di più (3 persone 30/41/29%, 800 partite). Senza urti tra le bocce i posti
>   dell'arco erano pari (26/25/26/25%): la differenza la fanno gli urti, perché chi sta in mezzo ha i vicini da
>   entrambi i lati. Con il cerchio chiuso ogni posto ha gli stessi vicini.
> - Equità dei posti dopo (persone simulate, posti fissi): 3 persone 32/35/36%, 4 persone 26/27/25/24%,
>   5 persone 19/21/20/21/22% (prima 30/46/25%, 16/31/34/20%, 14/20/29/23/16%). La misura ora è nel banco
>   (`node test/bench/azione.mjs 800 bocce`, ultima sezione).
> - Da tutti alla stessa distanza (P3) il Facile saliva al 31% e il Difficile scendeva al 66%: ritoccati gli errori
>   della mano (Facile ×1,25, Difficile ×0,75). Contro la persona, 1500 partite per livello: **F 27%, N 51%, D 70%**.
>   Ordine F/N/D (800 partite): pos. media 2,60 / 1,96 / 1,42. Durata con 3 CPU: F 17 s, N 26 s, D 36 s.

## Verdetto per gioco

| Gioco | Verdetto | In breve |
|---|---|---|
| 🧊 Sumo Glaciale | ✅ | Nessun trucco: velocità stimate dal movimento, pugno carico letto dall'anello bianco. Normale al limite basso (45%). Con 3 Normali ci sono troppe partite cortissime (vedi P8) |
| 🐌 Corsa delle Lumache | ✅ | Pulito. Normale un filo sopra la fascia (57%) |
| 🎳 Bocce Caotiche | ⚠️ | Le CPU sono pulite, ma **il posto sulla linea di tiro è ingiusto anche per le persone** (P2). F e D stanno ai bordi della fascia per colpa della fortuna del gioco (P3) |
| 🪶 Batti le Ali! | ✅ | Pulito, fasce centrate |
| ⚡ Filo Scottante | ✅ | Pulito, fasce centrate (con 600 partite) |
| ✍️ Mano Ferma | ✅ | Pulito: stime a occhio e memoria con rumore, niente coordinate esatte |
| 🌈 Colore Perfetto | ✅ | Pulito: il ricordo del colore si fissa subito con il suo rumore, poi il colore vero non si usa più |
| 🖐️ Twister delle Dita | ✅ | Pulito, anche con la pausa |
| 🤠 Mezzogiorno di Fuoco | ✅ (corretto) | C'era un trucco legato alla pausa (P1): **corretto** |
| 🔢 Il Più Alto Unico | ⚠️ | Facile troppo forte contro la persona (34%). Il Difficile ricorda perfettamente tutte le scelte passate anche con 16 giocatori (P5) |
| 🎨 Galleria d'Arte | ⚠️ | Facile troppo debole contro la persona (14%), Difficile al limite alto (86%) |

## Tabella comparativa unica

**Ordine dei livelli**: una CPU per livello nella stessa partita, posti mescolati (`serie(..., { mescola: true })`).
Ho giocato 300 partite per gioco, 2000 per Sumo, Bocce e Unico.
**Contro la persona**: quante volte la CPU finisce davanti a una persona simulata; tra parentesi il numero di partite.
**Durata**: media con 3 CPU dello stesso livello F / N / D, presa dai banchi.

| Gioco | pos. media F / N / D | vince F / N / D | F ultimo | vs persona F / N / D (obiettivo 20–30 / 45–55 / 70–85) | durata 3 CPU F / N / D |
|---|---|---|---|---|---|
| 🧊 Sumo | 2,64 / 1,92 / 1,43 | 2% / 34% / 64% | 67% | 21 / **45** / 75 (600) | 44 / 43 / 58 s |
| 🐌 Lumache | 2,95 / 2,01 / 1,04 | 0% / 4% / 96% | 95% | 28 / **57** / 84 (600) | 30 / 24 / 19 s |
| 🎳 Bocce | 2,51 / 1,98 / 1,50 | 12% / 28% / 61% | 64% | **31** / 53 / **68** (600) | 18 / 28 / 38 s |
| 🪶 Ali | 2,98 / 2,02 / 1,00 | 0% / 0% / 100% | 98% | 24 / 48 / 80 (600) | 16 / 17 / 17 s |
| ⚡ Filo | 2,66 / 2,03 / 1,30 | 5% / 22% / 73% | 72% | 29 / 52 / 83 (600, 1 contro 1) | 48 / 36 / 29 s |
| ✍️ Mano Ferma | 2,69 / 2,12 / 1,19 | 3% / 13% / 84% | 73% | 23 / 47 / 78 (200, 1 contro 1) | 45 / 43 / 40 s |
| 🌈 Colore | 2,67 / 2,02 / 1,31 | 5% / 23% / 72% | 72% | 25 / 47 / 77 (200, 1 contro 1) | 52 / 51 / 51 s |
| 🖐️ Twister | 2,75 / 1,99 / 1,22 | 3% / 18% / 83% | 79% | 21 / 54 / 79 (200, 1 contro 1) | 33 / 35 / 36 s |
| 🤠 Fuoco | 2,67 / 1,98 / 1,35 | 6% / 23% / 71% | 73% | 25 / **45** / 74 (200) | 39 / 37 / 37 s |
| 🔢 Unico | 2,53 / 2,16 / 1,28 | 9% / 14% / 78% | 64% | **34** / 52 / 75 (800) | 69 / 66 / 63 s |
| 🎨 Galleria | 2,85 / 1,81 / 1,21 | 5% / 25% / 80% | 90% | **14** / 48 / **86** (400) | 51 / 65 / 90 s |

In grassetto i valori fuori fascia o sul bordo. Il margine statistico è di circa ±2 punti con 600 partite e di ±3 con 200.
L'ordine dei livelli regge ovunque: D < N < F con distacchi netti, D vince almeno il 61% (61–100%), F è ultimo almeno il 58% (58–98%).
Con 16 CPU dello stesso livello nessuna partita ha superato i 95 s (le più lunghe: Galleria 16 D, 91–95 s; Unico 16 F, fino a 93 s; Sumo 16 N, fino a 90 s). Con un bot solo la Galleria arriva a 111 s, perché il bot non ha nessuno da votare e aspetta la fine del tempo.

**Coerenza dei livelli tra i giochi.** Il significato è lo stesso ovunque:
- tempi: tutti usano `cpu.reazione`/`cpu.pensa` con mediana 0,50 / 0,36 / 0,28 s e un fattore per gioco;
- sviste: F circa 3–16% a occasione, N circa 1,5–5%, D circa 0–1,5%;
- tattica: in tutti i giochi il D sceglie meglio, oltre a sbagliare meno (vedi sotto).

Due avvertenze:
1. i tre banchi misurano "contro la persona" in modo diverso:
   - Azione: 1 CPU + 2 persone prese a caso dalla popolazione;
   - Precisione: 1 contro 1 con la persona mediana, e accetta ±5 punti di tolleranza;
   - Mente: 1 CPU + 2 persone mediane (Fuoco, Galleria) oppure con scelte a caso (Unico).

   Con tanta fortuna nel gioco i tre metodi danno numeri simili, con poca fortuna no;
2. il Facile di `cpu.reazione` (0,50 s) è più lento del 25° percentile della tabella di Fuoco (~0,42 s): Fuoco lo corregge con un fattore 0,82, gli altri giochi no. Ogni gioco è comunque tarato sulla sua tabella umana, quindi in pratica non si vede.

Tattica del Difficile, gioco per gioco:
- Sumo: si mette tra il centro e il bersaglio;
- Bocce: aspetta gli altri, boccia la boccia avversaria, fa da scudo;
- Filo: rischia meno lontano dal checkpoint;
- Mano Ferma: confronta le due metà;
- Colore: sa che la memoria esagera la saturazione;
- Twister: anticipa il movimento;
- Fuoco: gestisce il rischio guardando la classifica;
- Unico: si fa un modello degli avversari;
- Galleria: compone una scena;
- Lumache e Ali: qui quasi tutto è fisica, la tattica si riduce a sprint e "grinta".

## Trucchi (informazioni che una persona non ha)

Ho controllato riga per riga cosa legge ogni bot:
- **Sumo**: posizioni con errore d'occhio, velocità stimate dagli spostamenti, pugno carico dall'anello bianco, chi ha appena tirato dal guantone. Non legge mai joystick o velocità degli altri;
- **Bocce**: bocce con 4–12 px di errore, chi ha già tirato, bocce ferme o in movimento. Corregge il tiro solo guardando la propria boccia;
- **Lumache**: legge le posizioni disegnate (`vista`);
- **Unico**: vede solo i round già svelati e i totali. Le scelte del round in corso non le legge mai;
- **Galleria**: vota guardando i disegni (tratti, colori, superficie) con il suo rumore, senza sapere chi li ha fatti e mai per sé;
- **Colore**: il ricordo si fissa con il suo rumore nel momento in cui il colore compare;
- **Mano Ferma**: i punti si fissano all'ultimo fotogramma visibile, con memoria e sfocatura;
- **Twister**: usa solo i cerchi già apparsi sul proprio telefono; le dita sono assegnate prima di sapere quale cerchio correrà;
- **Fuoco**: reagisce alla parola solo quando compare; non conosce né il momento del segnale né le finte;
- **Filo, Ali**: il bot vede solo il proprio telefono.

Unico trucco vero trovato: **Fuoco con la pausa** (P1, corretto).
Zona grigia: la **memoria perfetta del Difficile di Unico** con tanti giocatori (P5, da decidere).
Accettabile: il Difficile di Fuoco tiene il conto dei tempi mostrati a ogni round, con ±120 ms di approssimazione.

## Comportamento visibile, casi limite, prestazioni

- **Movimento**: nel Sumo il joystick dei bot inverte il verso circa 0,4 volte al secondo (sul ghiaccio bisogna frenare). Non ci sono tremolii o scatti, e il bot resta fermo meno dell'1,2% del tempo. Nessun bot cade da solo (0% N e D, 1% F): cadono tutti per un pugno o, di rado, un urto.
- **Sincronia**: con 16 bot dello stesso livello le mosse di una fase si spargono su 1,7–9 s (Mano Ferma, Colore, Unico, Galleria, Bocce), con al massimo 3–6 mosse negli stessi 100 ms. Solo in Fuoco si ammassano, ma è giusto così: si reagisce tutti allo stesso segnale.
- **Casi limite**: tutti gli 11 giochi girano senza errori, NaN o blocchi in questi casi:
  - 1 bot (F, N, D) e 2 bot D;
  - 16 bot tutti F, tutti N o tutti D;
  - bot insieme a una persona scollegata (1+1, 3+1, 15+1);
  - pausa di 8 s in 7 momenti diversi.
- **Prestazioni** (16 bot a 60 fps, misurate): la media è sotto 0,02 ms a fotogramma per tutti i bot insieme, il 99° percentile sotto 0,3 ms. Il picco è di 2 ms, una volta per round (Unico, Difficile con 16 giocatori), contro i 16,7 ms disponibili.
- **Memoria**: non cresce. La crescita apparente in Galleria, Mano Ferma e Colore veniva dai `setTimeout` dei suoni ancora in attesa nel banco sincrono; lasciandoli scattare, la memoria torna stabile.
- **Stato tra partite**: una CPU nuova a ogni minigioco. L'unico stato a livello di modulo sono le due cache di Unico, che dipendono solo dal numero di giocatori e dal numero massimo.

## Problemi trovati

| # | Gravità | Stato | Problema |
|---|---|---|---|
| P1 | media | **corretto** | **Fuoco, pausa**: se il gioco va in pausa dopo il FUOCO!, alla ripresa il bot sparava con il tempo deciso prima (mediana 318 ms, come se avesse sparato durante la pausa). Una persona in pausa invece non può sparare: se tocca, il telefono disattiva il pulsante e il tocco si perde; se aspetta, prende ≥1,6 s. Adesso lo sparo già deciso slitta della durata della pausa (con 3 s di pausa: 1600 ms, come la persona che aspetta). Senza pause non cambia niente: banco dopo la correzione F/N/D contro la persona 25/45/74 |
| P2 | media (gioco) | **corretto** (posti in cerchio, vedi in alto) | **Bocce, posti ingiusti anche per le persone**: con 3 persone simulate vince chi sta al centro il 43%, chi sta ai lati il 30% e il 27%. Con 4 persone 18/32/33/17%, con 5 persone 14/20/29/23/16%. Chi sta al centro tira da 425 px, chi sta ai lati da 820 px |
| P3 | bassa | **ritarato** (F 27%, D 70%, vedi in alto) | **Bocce, F 31% e D 68% contro la persona**: è un limite del gioco. Un Facile con errori doppi o tripli batte ancora la persona il 19–20% (sotto questo la fortuna non scende). A posti bilanciati: F 32% (sinistra 29, centro 41, destra 27), D 70% (65/76/68) |
| P4 | media | da decidere | **Unico, F 34% contro la persona** (800 partite). Il Facile gioca spesso numeri bassi (1–3, il suo numero preferito), che a 3 giocatori restano unici mentre le persone si scontrano su 8–10 |
| P5 | bassa | da decidere | **Unico, memoria del Difficile**: il modello degli avversari usa tutte le scelte di tutti in tutti i round svelati. Con 3–5 giocatori è plausibile per un giocatore bravo, con 8–16 no: nessuno ricorda 15 persone per 4 round |
| P6 | bassa-media | da decidere | **Galleria, F 14% e D 86%** contro la persona (400 partite). Il disegno del Facile vale 4,6 di "impegno", la persona media 7,4 e la persona pigra 3,5: il Facile è circa al 15° percentile, non al 20°–30° |
| P7 | bassa | osservazione | Lumache N 57%, Sumo N 45%, Fuoco N 45%: ai bordi della fascia, entro 1–2 volte il margine statistico |
| P8 | bassa | da decidere | **Sumo, 3 Normali**: il 18% delle partite finisce sotto i 20 s (con 3 persone simulate il 5%, con 4 persone il 2%). I Normali attaccano presto dal cerchio di partenza e si fanno doppi KO |
| P9 | media (gioco) | da decidere | **Pausa e input**: in pausa il runner scarta gli input, ma Fuoco, Unico, Colore, Mano Ferma, Galleria, Filo e Twister contano il tempo con `ctx.ora()`, che non si ferma. Quello che una persona fa in pausa si perde: in Unico il telefono dice "Hai scelto" ma lo schermo non lo sa; in Filo il "fatto" va perso; in Twister un "fuori" o un cambio di dita va perso. I bot ora sono a posto: Fuoco è corretto, Twister con 5 s di pausa non ha eliminazioni in più |
| P10 | bassa (gioco) | da decidere | **Persona scollegata**: nessun gioco usa `ctx.connesso`. Filo aspetta 100 s; Colore, Mano Ferma, Unico, Galleria e Bocce aspettano sempre tutto il tempo |
| P11 | bassa (codice) | da decidere | `cpu.abilita` e `cpu.tra` quasi mai usati (solo Filo usa `abilita`): la variazione personale viene dai `tratti` e da estrazioni proprie di ogni gioco |
| P12 | minima (codice) | osservazione | Cinque giochi (Unico, Galleria, Filo, Twister, Colore) mandano gli input del bot con `this.input(...)`: funziona perché il runner chiama `gioco.bot(...)`, ma è fragile. Unico calcola tre `cpu.pensa` per usarne uno. Twister ha `cerchiTelefono`, un doppione inutile di `creaCerchi` |

Nota sulle modifiche precedenti: le ultime modifiche a `galleria/host.js` e `test/bench/mente.mjs` (voto con `guardaUnQuadro`, soglie 0,35 e 0,22) sono complete. Sintassi a posto, test del gioco superati, il banco Mente gira fino in fondo.

## Raccomandazioni, in ordine di importanza

1. **Bocce: rendere giusti i posti (P2).** È un problema anche per le persone. → **Fatto**, con i posti in cerchio invece che su un arco (vedi in alto).
   - **Correzione consigliata**: mettere i posti di tiro su un arco attorno al pallino, tutti alla stessa distanza (per esempio 600 px, entro ±45°). L'angolo del telefono resta com'è ma viene letto "rispetto alla direzione del pallino"; il telefono non cambia. Vanno adattati il bot e la persona simulata (che oggi usano una linea di tiro fissa).
   - **Alternativa economica**: i posti ruotano a ogni tiro. L'ho provato: con 3 persone 37/37/27% invece di 30/43/27%. Migliora ma non basta, e il Facile sale al 42%, perché ha sempre un tiro dal centro.
2. **Pausa (P9)**: far passare gli input anche in pausa ai giochi che contano il tempo con `ctx.ora()`, oppure dare ai giochi un aggancio `pausa(on)` che sposti le loro scadenze. Tocca il runner, non i bot.
3. **Unico, Facile (P4)**: renderlo più avido, come la tabella umana (il 22% delle persone sceglie il massimo): più M e M−1, meno 1–3. Si scontrerà di più con le persone; mi aspetto un 25–30%. È una ritaratura: la fa "Mente".
4. **Galleria, Facile (P6)**: un po' più di impegno. Per esempio "Ho finito" dopo 25–45 s invece di 18–38 s, oppure un colore in più, puntando a ~5,5 di impegno. Poi ricontrollare il Difficile (86%). Tenere presente che anche il modo di votare della persona simulata è un'ipotesi.
5. **Unico, memoria del Difficile (P5)**: con più di 6 giocatori, ricordare ogni coppia (round, avversario) con probabilità circa 4/(n−1), e sempre chi ha preso il bonus. Con 3–5 giocatori non cambia niente, quindi la taratura attuale resta valida.
6. **Sumo, Normali (P8)**: nei primi ~10 s alzare un poco la soglia d'attacco del Normale, o il margine dal bordo quando si attacca dal cerchio di partenza. Obiettivo: partite cortissime ~5% come con le persone. È una ritaratura per "Azione".
7. **Persone scollegate (P10)**: nei giochi a turni e a tempo considerare "fatto" chi è scollegato (`ctx.connesso`).
8. **Banchi**: misurare "contro la persona" nello stesso modo in tutti e tre, e usare almeno 400–600 partite per le cifre da riportare. Con 100–200 partite il rumore (±3–4 punti) basta a far uscire o entrare un valore dalla fascia.
9. **Pulizia** (P11, P12): decidere se usare `cpu.abilita`/`cpu.tra` o toglierli da `cpu.js` e dalla specifica; togliere il doppione di Twister.
