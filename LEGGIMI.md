# Party Game — la festa dei minigiochi

Un party game da giocare in casa, stile Mario Party: **il computer è lo schermo principale** (meglio se collegato alla TV) e **ognuno usa il proprio telefono** come controller e secondo schermo. Si entra inquadrando un QR code, si sceglie il nome e si crea il proprio avatar. Da 3 a 16 giocatori.

## Avvio

Serve [Node.js](https://nodejs.org) 18 o più recente. Non ci sono dipendenze da installare e non serve internet.

- **Windows:** doppio clic su `avvia.bat`. Il browser si apre da solo sullo schermo principale.
- **Da terminale:** `npm start` (oppure `node server.js --open` per aprire anche il browser).

Il terminale mostra due indirizzi: quello per lo schermo (`http://localhost:3100/schermo`) e quello per i telefoni (per esempio `http://192.168.1.20:3100/gioca`). Per chiudere: `Ctrl+C`.

> La prima volta Windows chiede se consentire a Node.js l'accesso alla rete: scegli **Consenti** (almeno sulle reti private), altrimenti i telefoni non riescono a collegarsi.

## Come si gioca

1. Sul computer si apre lo **schermo**: c'è un QR code grande.
2. Ognuno inquadra il QR col telefono (stessa Wi-Fi del computer), scrive il nome e crea il suo **avatar**: volto (forma, carnagione, occhi, sopracciglia, bocca, capelli, barba, occhiali, cappello), corpo (corporatura, maglia, pantaloni, scarpe) e il suo **colore**. C'è anche il dado 🎲 per un avatar a caso.
   - **I personaggi restano salvati sul computer** (nel file `dati/personaggi.json`). La volta dopo, all'ingresso compare la galleria **"Chi sei?"**: si tocca il proprio personaggio e si entra, senza rifarlo da zero. Funziona anche da un altro telefono.
   - Dalla scheda del personaggio lo si può modificare, crearne uno nuovo o eliminarlo.
   - Se il telefono di qualcuno si spegne a partita in corso, può riprendere il suo personaggio da qualsiasi telefono: rientra al suo posto, con i suoi punti.
   - **Si gestiscono anche dal computer**: vedi [Personaggi salvati dal computer](#personaggi-salvati-dal-computer).
3. Il primo che entra è il **capo 👑**: dal telefono sceglie come giocare. Si può comandare anche dal computer con il mouse.
4. Prima di ogni minigioco lo schermo spiega le regole e ognuno preme **PRONTO!** sul telefono.

### Due modalità

- **🏆 Torneo** (la principale): si sceglie quanti minigiochi (5, 10, 15 o 20). Vengono pescati a caso, senza ripetizioni finché non finiscono. Dopo ogni minigioco si vede la classifica generale, alla fine c'è il podio. Si possono escludere dei minigiochi e far valere doppio l'ultimo.
- **🎯 Scelta libera**: si sceglie il minigioco da un catalogo. I punti vanno nella "classifica della serata".

### Punti

In ogni minigioco prendi **1 punto per ogni avversario che batti**, più **2 punti bonus se vinci**. I pari merito prendono gli stessi punti. Esempio con 6 giocatori: 1° = 7 punti, 2° = 4, 3° = 3, 4° = 2, 5° = 1, 6° = 0.

### Personaggi salvati dal computer

Nella lobby, sullo schermo, c'è il pulsante **👥 Personaggi**: apre l'elenco dei personaggi salvati (in ordine alfabetico), con il mouse.

- **➕ Nuovo personaggio**: si sceglie il nome e si crea l'avatar con lo stesso editor del telefono (Volto, Corpo, Colore e il dado 🎲). Utile per preparare i personaggi prima della festa: chi arriva lo trova già pronto nella galleria "Chi sei?".
- **✏️ Modifica**: cambia nome e avatar. Se il personaggio è nella festa, il cambio si vede subito, anche sul suo telefono.
- **🗑️ Elimina**: chiede conferma. Non si può eliminare chi è nella festa (prima lo si toglie con la ✕ accanto al suo nome). Il telefono che lo usava non lo propone più: mostra la galleria.
- Due personaggi non possono avere lo stesso nome. Al massimo se ne salvano 80.
- Il colore è quello preferito: se quando il personaggio entra è già preso da un altro, gliene tocca uno libero.
- Mentre il pannello è aperto i telefoni mostrano "Un attimo…" (così nessuno fa partire un torneo o modifica lo stesso personaggio). **Esc** chiude l'editor o il pannello.

### Scorciatoie sullo schermo

| Tasto | Cosa fa |
|---|---|
| Invio / Spazio | Avanti (o "Via!" nella scheda del minigioco) |
| Esc | Pausa durante un minigioco (riprendi, ricomincia, esci senza punti) |
| M | Audio sì/no |
| F | Schermo intero |

### Le CPU (bot)

Nella lobby c'è **🤖 Aggiungi bot**: utile se siete in pochi o per provare il gioco da soli. Ogni bot ha la sua **potenza**:

| Potenza | Come gioca |
|---|---|
| 🐣 Facile | Un principiante: lento, distratto, sbaglia spesso. Una persona media lo batte circa 3 volte su 4 |
| 🙂 Normale | Come una persona alla prima partita: vince più o meno metà delle volte |
| 🔥 Difficile | Un giocatore molto bravo: veloce e furbo, vince circa 3 volte su 4, ma chi è esperto lo batte |

- Sotto "🤖 Potenza dei bot" si cambia la potenza di **tutti** i bot con un clic (e vale anche per quelli che aggiungi dopo).
- Per cambiarne **uno solo**, clicca l'icona 🐣 / 🙂 / 🔥 accanto al suo nome, in basso a sinistra: gira tra le tre potenze.
- Le CPU giocano pulito: sanno solo quello che saprebbe una persona (lo schermo grande e il proprio telefono), reagiscono con tempi umani e hanno ognuna un carattere un po' diverso (più aggressiva, più prudente, più costante…).

## I minigiochi

| Gioco | Telefono | In breve |
|---|---|---|
| 🧊 Sumo Glaciale | joystick + PUGNO 🥊 | A suon di pugni (guantone a molla) butta gli altri giù dall'arena di ghiaccio, che col tempo si restringe |
| 🐌 Corsa delle Lumache | manovella | Fai girare il dito in cerchio: ogni giro la lumaca avanza |
| 🎳 Bocce Caotiche | fionda | Tutti in cerchio attorno al pallino, alla stessa distanza (nessun posto è avvantaggiato): 3 tiri insieme, le bocce si scontrano |
| ⚡ Filo Scottante | percorso | Segui il filo col dito senza uscire, 3 livelli |
| ✍️ Mano Ferma | precisione | Cerchio perfetto, taglio a metà, punti a memoria |
| 🎨 Galleria d'Arte | disegno | Disegna il tema buffo, poi si vota il più bello |
| 🌈 Colore Perfetto | selettore colore | Ricrea il colore mostrato (anche a memoria) |
| 🖐️ Twister delle Dita | multi-touch | Un dito su ogni cerchio, senza staccarlo: telefono sul tavolo e **una mano sola** (l'altra dietro la schiena) |
| 🤠 Mezzogiorno di Fuoco | pulsante | Spara al "FUOCO!" sullo schermo, attento alle finte |
| 🔢 Il Più Alto Unico | numeri | Scegli un numero alto che nessun altro ha scelto |
| 🪶 Batti le Ali! | tocca a raffica | Salto dalla scogliera con le ali sulle braccia: ogni tocco è un colpo d'ali. Dopo 12 secondi si plana: vince chi arriva più lontano |
| 🐙 Il Polpo | uno contro tutti | Uno (o due) fa il Polpo, gli altri sono pesci che devono attraversare il fondale in 60 secondi. Vedi sotto |
| 💣 Detonazione | gesti | Passa la bomba prima che esploda: con la bomba in mano fai 4 gesti giusti e vola da un altro. Vedi sotto |
| 🤞 Mani Incrociate | due pollici | Twister per pollici: tieni i due pollici sui binari che scorrono, si incrociano e si allargano. Corsa a ostacoli sulla TV. Vedi sotto |
| 🎪 Circo dei Disperati | un ruolo a testa | Cooperativo: 5 ruoli diversi sui telefoni, una sola barra per tutta la squadra. Chi ha sbagliato lo dice la Pagella del Disastro. Vedi sotto |
| 🎭 Trova l'Intruso | D-pad a 8 direzioni + PUGNO 👊 | Tutti contro tutti, di nascosto: sei un personaggio identico a decine di passanti, solo il tuo telefono sa qual è. Mimetizzati e stendi gli altri. 3 round. Vedi sotto |

### 🐙 Il Polpo (uno contro tutti)

- **Chi fa il Polpo**: nel torneo chi è più indietro in classifica; in scelta libera chi l'ha fatto meno volte nella serata. Sulla scheda iniziale c'è **🔄 Cambia Polpo** per decidere voi. Da 10 giocatori in su i Polpi sono due.
- **Pesci** (joystick a 8 direzioni + **SCATTO**: velocità doppia per 2 s, poi 5 s di ricarica): arrivate a destra entro 60 secondi. Sopra ogni pesce ci sono le **bolle** 🫧: ogni tentacolo ne ruba una, senza bolle il pesce è **catturato**. Le bolle sono 3 quando i pesci sono solo 2 (partita a 3), altrimenti 2.
- **Coralli** 🪸: toccarne uno vale 1 punto sicuro, ma ti ferma 1 secondo (e il Polpo lo vede).
- **Polpo**: guarda la TV e muove il **mirino** trascinando il dito sulla mappa del telefono (i pesci non ci sono: si guardano sulla TV). Poi tocca un potere mentre tiene il mirino, oppure tocca il potere e poi il punto. Ogni potere costa energia e si vede arrivare (preavviso sulla TV), quindi i pesci possono scappare:

  | Potere | Costo | Ricarica | Preavviso | Effetto |
  |---|---|---|---|---|
  | 🐙 Tentacolo | 1 | 3 s | 0,5 s | blocca 2 s e ruba una bolla (Polpo potenziato: fino a 2 pesci vicini) |
  | 🪼 Medusa | 2 | 5 s | 1 s | trappola: chi la tocca va a metà velocità per 2 s (max 2, 3 con più di 12 giocatori) |
  | 💨 Spinta | 2 | 6 s | 1 s | indietro del 20% del percorso |
  | 🌀 Inversione | 3 | 10 s | 1,5 s | comandi al contrario per 3 s |
  | 🌊 Marea | 4 | una volta | 2,5 s | tutti indietro del 15%, tranne chi si **nasconde dietro uno scoglio** |

  Energia: 6 (ricarica 1 ogni 3 s); da 7 a 9 e da 13 a 16 giocatori il Polpo è **potenziato**: 8 di energia, ricarica 1 ogni 2,5 s.
- **Punti**: pesce +1 se arriva, +1 per corallo, +2 a tutti se arrivano tutti (Fuga perfetta). Il Polpo vale quanto la parte di pesci che ha fermato, +2 se non arriva nessuno (Schiacciamento), −1 se arrivano tutti. In pratica sta sopra i pesci che ha fermato e sotto quelli arrivati: nel torneo prende circa un punto per ogni pesce fermato.
- Se il telefono di qualcuno si spegne, una CPU gioca al suo posto finché non rientra (🤖 sul suo nome).

### 💣 Detonazione (passa la bomba)

- Sulla TV ci sono le bombe al centro, con un **timer che accelera** (il numero scende sempre più in fretta), e tutti i giocatori in cerchio. Un cavo collega ogni bomba a chi ce l'ha in mano.
- **Chi ha la bomba** vede sul telefono **4 gesti** in fila: swipe (su, giù, sinistra, destra), doppio tap, tieni premuto, pizzica (due dita che si avvicinano). Telefono in una mano, gesti con l'altra. Se li fai tutti giusti la bomba vola da un avversario a caso; se sbagli un gesto si ricomincia da capo.
- Il bersaglio si decide appena arriva la bomba: sulla TV una **freccia** va da chi ha la bomba a chi la riceverà e si riempie a ogni gesto giusto. Chi è nel mirino lo vede anche sul suo telefono.
- **Gli altri** hanno lo schermo rosso d'attesa (più acceso quando il timer è basso).
- Quando il timer arriva a zero, chi ha la bomba perde una vita; dopo 2,5 secondi arriva una bomba nuova. Vince l'ultimo che resta in piedi.

  | Giocatori | Vite | Bombe insieme |
  |---|---|---|
  | 3 | 3 | 1 |
  | 4–5 | 2 | 1 |
  | 6 | 1 | 1 |
  | 7–11 | 1 | 2 |
  | 12–16 | 1 | 3 |

  Le bombe calano man mano che i giocatori escono (da 11 in gioco si passa a 2, da 6 a 1). Una partita dura circa 1,5–2,5 minuti.
- Se il telefono di qualcuno si spegne, una CPU gioca al suo posto finché non rientra (🤖 sul suo nome).

### 🤞 Mani Incrociate (Twister per pollici)

- **Telefono in verticale, tenuto con due mani: si gioca solo con i pollici.** Sul telefono scorrono verso il basso due binari: il pollice sinistro sta sul **rosso**, il destro sul **blu**, e non si staccano mai.
- Prima del via si appoggiano i pollici sui due cerchi (SINISTRO e DESTRO): al via si parte subito.
- I binari fanno delle figure, e il nome di ognuna scorre sul telefono prima che arrivi: 🦋 specchio, ↔ allarga, →← stringi, 〰 onda (tutti e due dalla stessa parte), ⚡ zig-zag (uno solo), ✖ incrocio (il pollice sinistro va a destra e viceversa), 🤞 super incrocio (incrociati e larghi), 🌀 caos (ognuno a un ritmo diverso). Il percorso diventa più stretto e più veloce verso la fine e l'ultima figura, sempre cattiva, finisce proprio sul traguardo.
- **Trucco per gli incroci**: alza un pollice e abbassa l'altro, così passano uno sopra l'altro senza toccarsi.
- **Errore** (pollice staccato o fuori dal binario): lo schermo lampeggia di rosso, si resta fermi 1,5 secondi, poi i binari tornano nella posizione comoda e si riparte rimettendo i pollici sui cerchi (se sono già lì si riparte da soli).
- **Serie**: più si resiste senza errori più si corre, fino a ×1,5 dopo 12,5 secondi puliti (🔥 sul telefono e sulla TV). Un errore la azzera.
- **Sulla TV** è una corsa a ostacoli: gli ostacoli nelle corsie sono le figure del percorso (tutti hanno lo stesso), gli avatar le saltano e chi sbaglia inciampa e resta lungo disteso. A destra di ogni corsia ci sono gli errori.
- Vince chi arriva primo; dopo il primo arrivo restano 15 secondi, poi conta la strada fatta. Una gara dura circa 1 minuto e 10 (un giocatore perfetto ci mette 48 secondi).

### 🎪 Circo dei Disperati (cooperativo)

- **Tutti nella stessa squadra.** Ognuno ha un ruolo diverso sul telefono (lo vede già sulla scheda iniziale, con le sue regole) e fa la sua micro-azione insieme agli altri. Sulla TV c'è il tendone del circo con gli artisti e una sola **Barra della Sopravvivenza**: parte dal 100%, non si ricarica mai e scende a ogni errore. Mentre si gioca **non si vede chi sbaglia** (il pubblico fischia e tira pomodori a caso sulla pista): lo dice la Pagella, alla fine.
- **I 5 ruoli**:

  | Ruolo | Sul telefono | Errore |
  |---|---|---|
  | 🥁 Batterista | 3 pad colorati: le luci suonano una sequenza (3 o 4 note), poi la si rifà uguale e a tempo, seguendo il cursore | pad sbagliato, nota fuori tempo o saltata |
  | 🤹 Giocoliere | telefono sul tavolo, 3 dita della stessa mano su 3 dei 4 cerchi; quando un cerchio diventa verde ci si sposta il dito del cerchio arancione | un dito fermo che si stacca, o troppo lento (poi si rimettono 3 dita sui cerchi blu) |
  | 🧽 Straccio | il pubblico tira pomodori, uova e torte sul vetro: si strofina per pulire | la barra dello sporco si riempie |
  | 🎯 Cecchino | un cursore va avanti e indietro; a ogni SPARA! si tocca quando è nel verde (che si restringe) | tocco fuori dal verde o tempo scaduto |
  | 🧭 Navigatore | swipe nella direzione della freccia prima che finisca il tempo | direzione sbagliata o troppo lento |

- **45 secondi in 3 fasi**: Riscaldamento (0–15 s, 8% a errore), Il Ritmo (15–30 s, sfide più veloci del 40%, 12%), Il Caos (30–45 s, velocità massima, 18%). Il danno dipende dalla grandezza della squadra (con 5 giocatori è quello base): con 3 giocatori un errore nel Caos toglie il 25%, con 8 il 13%. Non è proprio “5 diviso i giocatori”: così una squadra da 8 si salverebbe 3 volte su 4 e una da 3 meno di una su 2; con questa regola si salvano più o meno allo stesso modo.
- **Il Caos** (fase 3): arrivano tre sorprese, una per tipo, in ordine a caso: 🔄 **Inversione** (3 s: il Navigatore deve fare lo swipe al contrario, il suo schermo diventa viola), 📳 **Terremoto** (2 s: i telefoni vibrano e gli schermi tremano), 🔀 **Scambio di ruoli** (5 s: due giocatori si ritrovano il ruolo dell'altro, senza preavviso). Senza Navigatore l'inversione non c'è.
- **Squadre**: da 3 a 5 giocatori un ruolo a testa; da 6 a 8 tutti i ruoli più dei doppioni (per esempio 2 Batteristi): i doppioni ricevono le stesse sfide, e se sbagliano tutti e due la stessa sfida il danno conta una volta sola (scatta col primo). Da 9 giocatori si gioca in **due squadre** (🦁 Leoni ed 🐘 Elefanti, persone divise a metà) con due barre e **le stesse identiche sfide**.
- **La Pagella del Disastro**: alla fine (45 secondi, o barra a zero) la TV mostra per ognuno quanti errori ha fatto e **in che secondo**, poi il verdetto.
- **Punti** (decidono la classifica del minigioco; a pari punti sta sopra chi ha sbagliato meno, poi chi ha fatto meno danni):
  - barra salva: +2 a tutti; chi ha fatto **0 errori** +2, altrimenti l'**MVP** (meno errori) +1;
  - barra a zero: il **Colpevole** (più errori; a pari errori, più danni) finisce col faccione sulla TV: −1, oppure −2 se da solo ha fatto almeno il 40% degli errori della squadra;
  - se crollano tutte e due le squadre, quella durata di più prende +1 di consolazione.

  Nel torneo resta la regola di sempre: 1 punto per ogni avversario battuto, +2 al primo.
- Le CPU sbagliano come persone vere, più o meno secondo la potenza. Se il telefono di qualcuno si spegne, una CPU Normale fa il suo ruolo finché non rientra (🤖 sul suo nome).
- Una partita dura circa un minuto (45 secondi più la Pagella). Una squadra di 5 persone alla prima partita si salva più o meno una volta su due.

### 🎭 Trova l'Intruso (nascondino tra la folla)

- **Sulla TV** c'è una piazza in festa (fontana, mercato, giostra, vicolo cieco, palco) piena di **passanti tutti uguali**: mantello grigio e maschera bianca. **I giocatori sono identici ai passanti**: stesso aspetto, stessa velocità, nessun nome. Nemmeno il tuo personaggio è segnato.
- **Sul telefono** c'è una mini-mappa privata dove ci sei **solo tu** (pallino verde "TU"), più monete e acqua alta: si guarda il telefono, ci si ritrova sulla TV e si cammina **come un passante**. Tienilo nascosto: chi sbircia ti trova!
- **Comandi**: joystick a 8 direzioni (come un D-pad: i passanti si muovono nelle stesse 8 direzioni e alla stessa velocità, quindi si possono imitare alla perfezione) e **PUGNO 👊**, che colpisce chi ti sta accanto (preferendo chi hai davanti). Senza nessuno vicino non succede niente.
  - Colpisci un **giocatore**: è fuori, +3. Il pugno però si vede: chi guardava sa dov'eri.
  - Colpisci un **passante**: −1, resti **fermo e rosso per 2 secondi** e in alto compare "*Nome* ha colpito un passante!". Tutti sanno chi sei e dove sei.
- **I passanti** passeggiano, girano intorno alla fontana (nei due versi), fanno la coda alla giostra (tutti nello stesso verso), si fermano ai banchi del mercato, entrano nel vicolo e tornano indietro, guardano il palco. Non si fermano mai più di 2,6 secondi e non attaccano mai: se li urti si spostano e basta. Dopo un pugno lì vicino a volte scappano per un attimo.
- **Mai fermi più di 3 secondi** (vale dopo i primi 5 secondi del round): i passanti vicini si incuriosiscono e ti girano intorno guardandoti, con un "?" sopra la testa. Chi è attento lo nota subito.
- **Monete 🪙**: compaiono ogni tanto e restano 5 secondi; le raccolgono solo i giocatori (i passanti ci passano sopra). +1, ma la moneta che sparisce sotto i tuoi piedi ti tradisce.
- **Acqua alta 🌊**: a 55 secondi compare il cerchio sicuro (tratteggiato); da 60 secondi l'acqua sale tre volte (a 60, 70 e 80 s) fino a un cerchio grande un quarto della piazza. Chi resta nell'acqua per 3 secondi viene portato via. Molti passanti curiosi vanno a vedere l'acqua e ci restano: la folla si dirada e alla fine si resta in pochi (resa dei conti).
- **In alto a destra** compaiono solo gli eliminati e gli errori, **mai chi ha colpito**. Chi viene eliminato vede sul telefono chi l'ha steso.
- **Fine del round** (90 secondi, oppure quando resta un solo giocatore): giù le maschere, la TV mostra chi era chi e la tabella dei punti del round. Si giocano **3 round** (circa 5 minuti in tutto); vince chi fa più punti sommando i tre round.

  | Azione | Punti |
  |---|---|
  | ogni 10 secondi in vita | +1 |
  | moneta | +1 |
  | eliminare un giocatore | +3 |
  | vivo allo scadere del tempo | +2 |
  | ultimo rimasto | +5 |
  | tra gli ultimi 3 in vita (da 6 giocatori in su) | +2 |
  | pugno a un passante | −1 |

  | Giocatori | Passanti | Monete |
  |---|---|---|
  | 3–6 | 40 | 2 ogni 8 s |
  | 7–11 | 60 | 3 ogni 8 s |
  | 12–16 | 80 | 4 ogni 6 s |

- Le CPU giocano pulito: vedono solo la TV, si accorgono dei pugni e delle monete prese (più facilmente se sono vicini), notano chi sta fermo troppo, chi si muove a scatti o chi gli viene dritto addosso, e nella folla possono perdere di vista o scambiare chi stavano seguendo (così a volte colpiscono un passante). Il 🐣 Facile si fa notare (pause lunghe, scatti, pugni a caso), il 🔥 Difficile si mimetizza alla perfezione e colpisce solo quando è abbastanza sicuro. Se il telefono di qualcuno si spegne, una CPU cammina al suo posto finché non rientra.

## Cose da sapere

- Se un telefono si spegne o perde la connessione, basta riaprire la pagina: si rientra al proprio posto con la propria schermata.
- Se si ricarica la pagina dello schermo, giocatori e torneo in corso vengono ripresi (il minigioco in corso ricomincia dalla classifica).
- Alcune reti (ospiti, aziendali, hotspot pubblici) non lasciano parlare i dispositivi tra loro: in quel caso i telefoni non si collegano. Usa la Wi-Fi di casa o l'hotspot del telefono.
- Se il computer ha più reti, sotto il QR c'è un menu per scegliere l'indirizzo giusto.
- I sensori di movimento del telefono (inclinazione, scossa) per ora non si usano: il browser li permette solo in HTTPS. Arriveranno come modalità facoltativa.

## Per chi sviluppa

### File

| File | Cosa fa |
|---|---|
| `server.js` | File statici, WebSocket (scritto a mano, senza librerie), elenco giocatori, personaggi salvati, ponte schermo ↔ telefoni |
| `dati/personaggi.json` | I personaggi salvati (si crea da solo; cancellalo per ripartire da zero) |
| `public/schermo.html`, `public/host/` | Schermo principale: lobby, torneo, classifiche, podio (`app.js`), ciclo dei minigiochi (`runner.js`), canvas ed effetti (`stage.js`), suoni (`audio.js`) |
| `public/gioca.html`, `public/phone/` | Telefono: ingresso e schermate (`app.js`), controlli riutilizzabili (`widgets.js`) |
| `public/shared/` | Codice comune: rete con orologio sincronizzato (`net.js`), avatar (`avatar.js`), editor dell'avatar usato da telefono e schermo (`editor.js`), utilità (`util.js`), QR code (`qr.js`) |
| `public/games/` | Un minigioco per cartella + il registro `index.js` |
| `test/` | Test automatici (`npm test`) |

### Come aggiungere un minigioco

1. Crea la cartella `public/games/<id>/` con due file.
2. `host.js` (gira sullo schermo) esporta:

   ```js
   export default {
     id: 'mioGioco',
     nome: 'Il mio gioco',
     emoji: '🎲',
     colore: '#ff8a3d',          // colore della scheda
     descrizione: 'Una riga che spiega lo scopo',
     comeSiGioca: ['Regola 1', 'Regola 2', 'Regola 3'],
     controllo: 'pulsante',      // una delle chiavi di CONTROLLI in games/index.js
     crea(ctx) {
       // ctx.giocatori: [{ id, nome, av, colore, bot }]
       // ctx.vista(id | '*' | [id...], stato)  -> schermata persistente del telefono
       // ctx.invia(id | '*', dati)             -> messaggio al volo
       // ctx.fine({ punteggi, alto, fmt }) oppure ctx.fine({ gruppi, dettagli })
       // ctx.ora() orologio sincronizzato, ctx.tempo secondi di gioco
       // ctx.fx (particelle, coriandoli, testo, scuoti, lampo), ctx.sfx (suoni)
       // ctx.ruoli: { id: ruolo } nei giochi a ruoli (vedi sotto)
       // ctx.avatar / ctx.testa (disegna gli avatar), ctx.testo, ctx.pannello,
       // ctx.etichetta, ctx.barraTempo, ctx.griglia
       // pose dell'avatar: idle, walk, run, cheer, sad, hit, jump, point,
       // pugno (con dir), vola (con battito -1..1); { ali: true } aggiunge le ali
       return {
         inizia() {},            // facoltativo: al "VIA!"
         aggiorna(dt) {},        // ogni fotogramma
         disegna(g) {},          // canvas 1920x1080
         input(id, dati) {},     // dati mandati dal telefono
         bot(id, dt) {},         // comportamento dei bot
       };
     },
   };
   ```

3. `phone.js` (gira sul telefono) esporta:

   ```js
   export default {
     id: 'mioGioco',
     monta(el, api, stato) {
       // api.invia(dati), api.vibra(ms), api.ora(), api.io (nome, colore, avatar)
       // api.widgets: joystick, pulsante, manovella, lavagna, selettoreColore,
       //              grigliaNumeri, canvasPieno
       return { aggiorna(stato) {}, messaggio(dati) {}, smonta() {} };
     },
   };
   ```

4. Aggiungi l'id in `ELENCO` dentro `public/games/index.js`.
5. Le CPU: dentro `bot(id, dt)` usa `const cpu = ctx.cpu(id)` (vedi `public/games/cpu.js`): `cpu.livello`, `cpu.per(facile, normale, difficile)`, `cpu.reazione()` (tempi di reazione umani), `cpu.errore(sigma)`, `cpu.tratti` (carattere), `cpu.mem` (memoria del bot). Le regole da rispettare e gli obiettivi di bilanciamento sono in `test/bench/SPECIFICA.md`.
6. `npm test` fa giocare automaticamente ogni minigioco a 3, 8 e 16 bot (di tutte e tre le potenze) e controlla che finisca con una classifica valida. Il test vuole che una partita stia sotto i 5 minuti simulati; un gioco più lungo (come Trova l'Intruso, con 3 round) lo dichiara con `durataMax: secondi` nel suo `host.js`.
7. Giochi a ruoli (come Il Polpo): aggiungi a `host.js` `ruoli(giocatori, { punti, storico, escludi })`, che restituisce `{ id: 'nomeRuolo' }`, e `infoRuoli: { nomeRuolo: { emoji, nome, titolo, regole, speciale, badge } }` (`badge`: un'emoji sul gettone della scheda iniziale anche per i ruoli normali, per esempio la squadra nel Circo). La scheda iniziale mostra il ruolo speciale e il pulsante "Cambia", ogni telefono legge le regole del suo ruolo e il gioco trova i ruoli in `ctx.ruoli`. `punti` è la classifica del torneo (o `null`), `storico` quante volte ognuno ha avuto un ruolo speciale nella serata.

### Test

`npm test` esegue:
- le regole (punti, pari merito, cerchio perfetto, taglio a metà, colori, numero unico, percorsi, ruoli e punti del Polpo, fondale sempre attraversabile, bombe/vite/gesti/timer di Detonazione, binari di Mani Incrociate);
- le regole del Circo dei Disperati (`test/circo.test.mjs`): danni, squadre e ruoli da 3 a 16 giocatori, sfide dal seme, Caos, punti, e dei "robot" che giocano ogni ruolo sul telefono simulato (chi gioca perfetto non sbaglia mai, chi sta fermo sbaglia sempre);
- le regole di Trova l'Intruso (`test/intruso.test.mjs`): passanti solo a 8 direzioni e mai fermi più di 3 s, pugni (giocatore, passante, a vuoto, a chi si guarda), monete, acqua alta, curiosi, punti e bonus, fine round, round successivi, e che la TV non dica mai chi è un giocatore;
- una partita simulata di ogni minigioco con bot;
- una simulazione di rete con il server vero, uno schermo e 16 telefoni finti (ingresso, riconnessione, festa piena);
- i personaggi salvati (galleria, ripresa del posto da un altro telefono, modifica, eliminazione, riavvio del server) e la loro gestione dallo schermo (nuovo, modifica anche di chi è nella festa, niente eliminazione di chi è dentro). I test usano una cartella temporanea, quindi non toccano i tuoi personaggi.

La pagina `/dev/avatar.html` mostra tanti avatar a caso con tutte le pose: utile per provare modifiche all'avatar.

### Banco di prova delle CPU

Non fa parte di `npm test` (ci mette qualche minuto): si lancia a mano da `test/bench/`.
- `node test/bench/base.mjs 40` — fotografia veloce: in ogni minigioco una CPU per potenza, 40 partite.
- `node test/bench/azione.mjs`, `precisione.mjs`, `mente.mjs` — misure complete per gruppo di giochi, con le tabelle di riferimento "umane" e delle persone simulate.
- `node test/bench/polpo.mjs` — Il Polpo: equilibrio per numero di giocatori (quanti pesci arrivano, quanti punti prende il Polpo), pesci e Polpi CPU contro le persone simulate.
- `node test/bench/bomba.mjs` — Detonazione: tempo per passare la bomba, ordine dei livelli, CPU contro persone simulate (media ed esperta), durata per numero di giocatori.
- `node test/bench/pollici.mjs` — Mani Incrociate: ordine dei livelli, CPU contro persone simulate (media ed esperta), errori e tempi per livello, durata per numero di giocatori. Le mani simulate (CPU e persone) sono in `public/games/pollici/mani.js`.
- `node test/bench/circo.mjs` — Circo dei Disperati: quante volte la squadra si salva (da 3 a 16 giocatori, persone e CPU), equilibrio tra i ruoli (errori e Colpevoli per ruolo), CPU contro persone simulate, ordine dei livelli. Le mani simulate sono in `public/games/circo/artisti.js`.
- `node test/bench/intruso.mjs` — Trova l'Intruso: ordine dei livelli, CPU contro persone simulate (4 e 8 giocatori), durata dei round, quanti passanti restano alla fine, eliminazioni ed errori per round. Si può lanciare una parte sola: `node test/bench/intruso.mjs 100 persone4` (oppure `ordine`, `persone8`, `durata`). La mente dei bot è in `public/games/intruso/mente.js`, i passanti in `folla.js`, la simulazione in `mondo.js`.
- `test/bench/SPECIFICA.md` — le regole delle CPU; `test/bench/RAPPORTO.md` — l'ultima revisione.
