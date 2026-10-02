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
- **BOT DA CREARE / CALIBRARE** — in questi giochi le CPU sono provvisorie (un cervello unico, le tre potenze giocano uguali): 🔦 L'Uomo Nero, 🥊 Fight Club, 🛸 Abduction.

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
| 🔦 L'Uomo Nero | D-pad + TORCIA / poteri | Uno contro tutti al buio: i sopravvissuti caricano le batterie e scappano, l'Uomo Nero (invisibile, solo la luce lo svela) li afferra. **BOT DA CREARE / CALIBRARE**. Vedi sotto |
| 🥊 Fight Club | scommessa, cursore, tifo a raffica | Duelli 1 contro 1 di tempismo: il pubblico scommette su chi vince e tappa a raffica per rendergli il duello più facile. **BOT DA CREARE / CALIBRARE**. Vedi sotto |
| 🛸 Abduction | joystick + BRUCA (tieni premuto) + SPINGI 💥 | Sei una mucca identica a decine di altre: bruca per fare punti, resta immobile quando passa il raggio del disco volante e spingi gli altri sotto. Round secco da 60 s. **BOT DA CREARE / CALIBRARE**. Vedi sotto |

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

### 🔦 L'Uomo Nero (uno contro tutti al buio)

> ⚠️ **BOT DA CREARE / CALIBRARE** — le CPU di questo gioco sono un cervello unico e semplice, fatto solo per poterlo giocare anche in pochi. **Le tre potenze (🐣 🙂 🔥) per ora giocano tutte uguali.** Da rifare con il banco di prova come negli altri giochi.

- **La TV mostra solo quello che vedono i sopravvissuti.** Il labirinto è al buio: si vedono i coni di luce delle torce accese (che svelano muri e batterie), i ping, l'uscita e il **ricordo** dei muri già illuminati (appena visibile, così la mappa si disegna man mano). Chi ha la torcia spenta è invisibile anche sulla TV.
- **L'Uomo Nero è invisibile**: appare solo quando una torcia lo colpisce (il cono diventa **bianco** e la sagoma resta 1 secondo). Le sagome uguali che girano da 6 giocatori in su sono gli **Echi**: innocui, si dissolvono quando ti arrivano addosso. Il battito sul telefono lo dà solo l'Uomo Nero vero.
- **Chi fa l'Uomo Nero**: nel torneo chi è più indietro in classifica, in scelta libera chi l'ha fatto meno volte nella serata. Sulla scheda iniziale c'è **🔄 Cambia Uomo Nero**.
- **Sopravvissuti** (telefono: mappa privata dove ci sei solo tu + D-pad + TORCIA + PING):
  - **D-pad**: ci si muove nei corridoi; tenendo una direzione chiusa si va dritti e si gira appena si può. Da fermi il D-pad gira la torcia (per mirare).
  - **🔦 TORCIA** accesa/spenta: accesa vedi e illumini, ma sulla TV (e quindi per l'Uomo Nero) sei visibile; spenta sei invisibile ma non vedi chi arriva.
  - **🔋 Batterie**: stai fermo **2 secondi** sopra, **con la torcia accesa** (quindi visibile). Brillano piano anche al buio, così si sa dove andare.
  - **🚪 Uscita**: la porta sul lato destro, si apre solo quando **tutte** le batterie sono cariche.
  - **📍 PING** (ogni 8 s): un punto di luce sulla TV per 3 secondi, dove sei tu. Al massimo 3 ping insieme per tutta la squadra (il quarto cancella il più vecchio).
  - **💓 Battito**: se l'Uomo Nero è entro 3 caselle il telefono vibra e il bordo pulsa di rosso, più veloce quando è più vicino. Non dice dove.
  - La mappa del telefono mostra i muri già illuminati da qualcuno e quelli che hai "toccato" passando, le batterie, l'uscita, i Marchi e i ping.
  - **Presi o scappati** non si sta a guardare: si tocca la mappa del telefono per mandare un ping dove serve.
- **Uomo Nero** (telefono: sonar + D-pad + MORSA + poteri). Va **1,15 volte** più veloce. Sul telefono vede solo i **muri entro 2 caselle** (e il ricordo di quelli già visti), ma **chi ha la torcia accesa lo vede esattamente** (pallino giallo con il cono, come sulla TV). Chi ha la torcia spenta compare solo come **cerchio arancione** "qualcuno è lì" (senza nome né direzione), uno ogni 1,5 secondi a turno.

  | Potere | Ricarica | Da quanti giocatori | Effetto |
  |---|---|---|---|
  | ✊ Morsa | — | sempre | afferra chi è attaccato a te (niente muri in mezzo) |
  | 😱 Urlo | 12 s | sempre | per 3 s chi ha la torcia **accesa** è paralizzato: torcia bloccata accesa e passo rallentato (−40%); sul telefono del Boss diventano rossi. Chi ha la torcia spenta è immune |
  | ☠️ Marchio | 20 s | 6+ | un cerchio rosso dove sei, per 15 s: chi ci resta dentro 3 secondi è preso |
  | 🌑 Blackout | 25 s | 6+ | tutte le torce spente per 4 secondi (poi si riaccendono da sole) |

  Da 11 giocatori in su i poteri si ricaricano un po' prima (−20%).
- **Tiro alla fune (Morsa)**: dura 2 secondi, fino a 3 se la vittima tocca a raffica il suo pulsante gigante. L'Uomo Nero deve toccare senza fermarsi: se smette per mezzo secondo la vittima scappa. **Salvataggio**: se un altro sopravvissuto gli punta la torcia addosso, l'Uomo Nero resta **accecato** (4 s al 40% della velocità, senza poter afferrare) e la vittima è libera. Se nessuno arriva la vittima è presa e l'Uomo Nero si riprende in 1,5 s. Chi si libera ha 2,5 s in cui non può essere riafferrato.
- **Fine**: quando tutti sono scappati o presi, oppure allo scadere del tempo (chi resta dentro "resta al buio" e conta come fermato). Alla fine si accende la luce e si vede tutto.

  | Giocatori | Batterie | Echi | Tempo | Vite | Poteri |
  |---|---|---|---|---|---|
  | 3–5 | 5 | 0 | 120 s | 2 | Morsa + Urlo |
  | 6–10 | 7 | 6–8 | 150 s | 1 | + Marchio + Blackout |
  | 11–16 | 9 | 12–15 | 180 s | 1 | tutti, ricarica −20% |

- **Punti**: sopravvissuto +4 se scappa, +1 per ogni batteria caricata, +1 per ogni salvataggio. Uomo Nero: 5 × la parte di sopravvissuti fermati (presi o rimasti dentro), +2 se non scappa nessuno (**Notte eterna**). Così sta sopra chi ha preso e sotto chi è scappato.
- **Cose cambiate rispetto all'idea iniziale** (per renderlo più divertente):
  - L'**Urlo** come scritto ("rivela chi ha la torcia accesa") non serviva: le torce accese si vedono già sulla TV. Ora **paralizza** chi ha la torcia accesa (torcia bloccata accesa + più lento), e chi l'ha spenta resta immune.
  - **2 vite da 3 a 5 giocatori**: provando, in pochi l'Uomo Nero prendeva tutti in mezzo minuto. La prima Morsa persa ferisce soltanto (come le bolle in più del Polpo).
  - Fare l'Uomo Nero era troppo difficile: sulla TV non vedi te stesso e dovevi confrontare due schermi. Ora **sul suo telefono vede esattamente chi ha la torcia accesa** (sono informazioni che tutti vedono già sulla TV). Per questo il **blip** riguarda solo chi ha la torcia spenta, e quando sono 1–2 arriva più di rado (ognuno al massimo ogni 4,5 s), altrimenti l'ultimo nascosto non ha scampo.
  - Il **ricordo dei muri** già illuminati (TV e telefono) e le **batterie che brillano piano** anche al buio: senza, si girava a vuoto in un labirinto tutto nero.
  - Nel **Marchio** il cerchio si vede (chi ci entra ha 3 secondi per uscire), e il **Blackout** riaccende le torce da solo alla fine.
  - **Echi** e **ping dagli eliminati** come descritto sopra; il labirinto ha molti anelli (in un labirinto "perfetto" chi è inseguito non ha vie di fuga).
- Se il telefono di qualcuno si spegne, una CPU gioca al suo posto finché non rientra.

### 🥊 Fight Club (scommesse e duelli)

> ⚠️ **BOT DA CREARE / CALIBRARE** — le CPU di questo gioco sono un cervello unico e semplice, fatto solo per poterlo giocare anche in pochi. **Le tre potenze (🐣 🙂 🔥) per ora giocano tutte uguali.** Da rifare con il banco di prova come negli altri giochi.

- **L'arena (TV)**: a ogni duello due giocatori sono i **Gladiatori**: compaiono giganti ai lati, ognuno con la sua barra del **TIFO** 🔥. Al centro c'è il duello (bersagli, tavolo del braccio di ferro o tronchi) e sotto i due cursori, così tutti vedono quello che succede sui telefoni dei gladiatori. Le teste del pubblico si mettono sotto il gladiatore su cui hanno puntato; in fondo c'è la classifica della partita.
- **Chi combatte**: tutti scendono nell'arena lo stesso numero di volte, le coppie cambiano il più possibile e nessuno combatte tre duelli di fila.
- **1. Scommessa (4 s)**: tutti gli altri (il **Pubblico**) toccano sul telefono il gladiatore su cui puntano (si può cambiare fino allo scadere). I due gladiatori vedono solo **PREPARATI!**, contro chi combattono e la regola del duello.
- **2. Duello e tifo (6–8 s)**:
  - **Gladiatori**: sul telefono un cursore va avanti e indietro su una barra; si tocca ovunque sullo schermo.
  - **Pubblico**: un pulsante gigante **FAI IL TIFO PER …!** da tempestare di tocchi. Chi non ha puntato può fare il tifo per chi vuole (ma non vince punti).
  - **Il tifo** riempie la barra del suo gladiatore e conta il **ritmo** degli ultimi istanti: se smetti di toccare, la barra scende. È piena quando il pubblico è diviso a metà e tutti toccano circa 6 volte al secondo (con un solo spettatore basta lui). Si contano al massimo 14 tocchi al secondo a testa.

  | Duello | Durata | Il gladiatore | Il tifo |
  |---|---|---|---|
  | 🎯 Colpo Secco | 6 s | un colpo solo: vince chi ferma il mirino più vicino al centro (chi non spara perde) | il mirino rallenta (fino al 40%) |
  | 💪 Braccio di Ferro | 8 s | ogni tocco nel verde spinge il braccio; fuori dal verde si resta bloccati 0,6 s; il verde si sposta a ogni colpo. Vince chi schiaccia la mano dell'altro sul tavolo, o chi è in vantaggio allo scadere | il verde si allarga (fino al 35%) e i colpi sono più forti (+10%) |
  | 🪓 Taglio della Legna | 8 s | ogni tocco nel verde è un colpo d'ascia, più profondo se è al centro del verde. Vince chi spacca per primo il tronco, o chi è più avanti allo scadere | come nel Braccio di Ferro |

  I tre duelli si danno il cambio in ordine. I due gladiatori hanno lo stesso cursore e le stesse zone verdi: è una sfida alla pari, cambia solo il tifo.
- **3. Punti**:

  | Chi | Punti |
  |---|---|
  | Gladiatore che vince | +4 |
  | Gladiatore sconfitto | −1 |
  | **Miracolo**: chi vince aveva ricevuto meno tifo (meno tocchi) dell'avversario | +2 in più |
  | Pubblico che ha puntato sul vincitore | +2 |
  | … se sul vincitore avevano puntato meno persone che sull'altro (**quota alta**) | +3 invece di +2 |
  | Pubblico che ha puntato sul perdente, o non ha puntato | 0 |
  | Pareggio (nessuno spara, o parità perfetta: rarissimo) | 0 a tutti |

  Vince chi ha più punti alla fine (a pari punti si è pari merito).
- **Quanti duelli**: circa 8, scelti in modo che tutti combattano lo stesso numero di volte: 9 duelli in 3 (6 a testa), 8 in 4 (4 a testa), 10 in 5, 9 in 6, 6 in 12, 8 in 16 (1 a testa). Solo con 13 e 15 giocatori qualcuno combatte una volta in più. Ogni duello dura circa 15 secondi: una partita dura da 1,5 a 2,5 minuti.
- **Cose cambiate rispetto all'idea iniziale** (per renderlo più divertente):
  - **4 secondi per scommettere** invece di 3: servono per leggere i nomi e scegliere. Si può cambiare idea fino allo scadere e sulla TV si vede chi punta su chi (sfottò garantiti).
  - **Tre duelli diversi** con lo stesso comando (fermare il cursore): niente da imparare di nuovo, ma non è sempre uguale.
  - Nel **Braccio di Ferro** e nella **Legna** il tifo non rallenta il cursore (lì un cursore lento farebbe solo perdere tempo): allarga il verde e rende i colpi più forti.
  - **Quota alta**: chi punta sul gladiatore meno scelto rischia di più (ha anche meno tifo dalla sua), quindi se vince prende +3.
  - **Numero di duelli variabile** (circa 8): con 8 fissi, in 3, 5 o 6 giocatori qualcuno avrebbe combattuto più degli altri.
  - **Il tifo pesa, ma non decide da solo**: in una prova bot contro bot (stessa bravura) chi ha più tifo vince 6 volte su 10, fino a 3 su 4 in 3 giocatori. Con il tifo più forte, in 3 giocatori l'unico spettatore avrebbe deciso il duello quasi sempre e il Miracolo non sarebbe mai capitato.
  - **Pareggio**: niente punti a nessuno.
- Se il telefono di un gladiatore si spegne, una CPU combatte al suo posto finché non rientra; chi è nel pubblico e si scollega semplicemente non punta.

### 🛸 Abduction (mimetizzati nel gregge)

> ⚠️ **BOT DA CREARE / CALIBRARE** — le CPU di questo gioco sono un cervello unico e semplice, fatto solo per poterlo giocare anche in pochi. **Le tre potenze (🐣 🙂 🔥) per ora giocano tutte uguali.** Da rifare con il banco di prova come negli altri giochi.

- **Sulla TV** c'è un campo di notte visto dall'alto, con **40–80 mucche tutte uguali** (40 in 3 giocatori, 80 in 16). **Le mucche dei giocatori sono identiche alle altre**: stesso aspetto, stessa velocità, nessun nome. A destra c'è la classifica dei punti, sempre visibile.
- **Il disco volante** pattuglia il campo a **zig-zag** (a righe o a colonne) o a **spirale** (verso fuori o verso dentro), ogni tanto si ferma qualche secondo a scrutare. Il cerchio verde per terra è il **raggio traente**.
- **Sotto il raggio**: le mucche vere si immobilizzano (testa alta, occhi sgranati) e ripartono un attimo dopo che il raggio se n'è andato. Se ci sei tu e stai **fermo**, hai la stessa posa e il disco ti scambia per una mucca vera. Se ti **muovi** o **bruchi** vieni **rapito**: perdi **tutti** i punti e resti fuori 3 secondi. C'è un attimo (0,3 s) per mollare il joystick o BRUCA se il raggio ti arriva addosso.
- **Telefono**:
  - **📡 Radar**: per i primi 3 secondi (e durante il 3, 2, 1) mostra dove sei, con il disco. Poi si spegne: **la tua mucca te la devi ricordare** guardando la TV.
  - **Joystick** (sinistra): ti muovi alla stessa velocità delle mucche vere, in qualsiasi direzione.
  - **🌿 BRUCA** (destra, tieni premuto): il pulsante si riempie in 3 secondi; arrivato in fondo **+10** (e si continua, se tieni premuto). Se molli prima, niente. Mentre bruchi stai fermo.
  - **💥 SPINGI** (destra, tocco): una testata alla mucca davanti a te (dove guardi, poco più di una mucca di distanza) che la sposta di una casella. Ricarica 4 s. Sulla TV non si vede chi ha dato la testata, solo la mucca che scivola. Se davanti non c'è nessuno non succede niente (e non parte la ricarica).
- **Spinte**:
  - Una mucca spinta **sotto il raggio** (o che è già sotto e viene spostata) si muove, quindi il disco la prende. Se è un giocatore perde tutti i punti e **chi l'ha spinto ne ruba metà**. Se è una mucca vera il disco se la porta via e basta.
  - Una testata **fuori dal raggio** interrompe la brucata di chi la riceve (0 punti, deve ripremere BRUCA).
  - Chi viene rapito vede sul telefono chi l'ha spinto; chi spinge un giocatore lo scopre subito (+ i punti rubati), chi spinge una mucca vera lo sa dal messaggio "era una mucca vera".
- **Rientro**: dopo 3 secondi il disco ti rimette giù di nascosto, **al posto di una mucca vera lontana dal raggio** (sulla TV non si vede nulla). Il radar si riaccende per 3 secondi. Così, rapimento dopo rapimento, il gregge si assottiglia e nascondersi diventa più difficile.
- **Ultimi 15 secondi**: il disco si arrabbia (luci rosse) e va più veloce (+35%), ma **ogni brucata vale +20**.
- **Fine** (60 secondi, round secco): la TV mostra chi era chi (anello colorato, faccia e nome sopra le mucche dei giocatori). Vince chi ha più punti.

  | Azione | Punti |
  |---|---|
  | brucata completa (3 s) | +10 (+20 negli ultimi 15 s) |
  | brucata interrotta o mollata | 0 |
  | rapito dal disco | perdi tutti i punti |
  | spingere nel raggio un giocatore | +metà dei punti che perde |

  | Giocatori | Mucche vere | Dischi | Raggio |
  |---|---|---|---|
  | 3–6 | 40–49 | 1 | normale |
  | 7–9 | 52–58 | 1 | più grande |
  | 10–16 | 62–80 | 2 | normale |

- **Cose cambiate rispetto all'idea iniziale** (per renderlo più divertente):
  - **Le mucche vere sotto il raggio si immobilizzano**: altrimenti chi sta fermo non si potrebbe confondere con loro (anche le mucche vere camminano e brucano). E il disco prende qualsiasi mucca che si muove sotto il raggio, anche quelle vere spinte da qualcuno: una regola sola, uguale per tutti.
  - **Chi spinge un giocatore nel raggio gli ruba metà dei punti**: senza premio spingere serviva solo a far perdere gli altri; così è un vero colpo bastardo, e chi ruba diventa a sua volta il bersaglio.
  - **La testata interrompe anche le brucate** (fuori dal raggio): si può dare fastidio anche quando il disco è lontano.
  - **0,3 secondi di tolleranza** sotto il raggio: senza, bastava un dito che scivola sul joystick per perdere tutto.
  - **Radar anche durante il 3, 2, 1**: 3 secondi per trovare la propria mucca tra 40 erano pochissimi.
  - **Rientro al posto di una mucca vera** (invisibile sulla TV): se il disco ti rimettesse giù davanti a tutti, saprebbero subito chi sei.
  - **Ultimi 15 secondi più veloci ma a +20**: un finale in cui rischiare (push-your-luck) conviene davvero.
  - **Classifica sempre visibile sulla TV**: il +10 che compare accanto a un nome nell'istante in cui una mucca alza la testa… tradisce chi l'ha fatto. Gli occhi attenti lo notano.
  - **Due dischi da 10 giocatori in su**: con un disco solo in un campo così affollato si rischiava troppo poco.
- Se il telefono di qualcuno si spegne, una CPU gioca al suo posto finché non rientra.

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
6. `npm test` fa giocare automaticamente ogni minigioco a 3, 8 e 16 bot (di tutte e tre le potenze) e controlla che finisca con una classifica valida.
 Il test vuole che una partita stia sotto i 5 minuti simulati; un gioco più lungo (come Trova l'Intruso, con 3 round) lo dichiara con `durataMax: secondi` nel suo `host.js`.
7. Giochi a ruoli (come Il Polpo): aggiungi a `host.js` `ruoli(giocatori, { punti, storico, escludi })`, che restituisce `{ id: 'nomeRuolo' }`, e `infoRuoli: { nomeRuolo: { emoji, nome, titolo, regole, speciale, badge } }` (`badge`: un'emoji sul gettone della scheda iniziale anche per i ruoli normali, per esempio la squadra nel Circo). La scheda iniziale mostra il ruolo speciale e il pulsante "Cambia", ogni telefono legge le regole del suo ruolo e il gioco trova i ruoli in `ctx.ruoli`. `punti` è la classifica del torneo (o `null`), `storico` quante volte ognuno ha avuto un ruolo speciale nella serata.

### Test

`npm test` esegue:
- le regole (punti, pari merito, cerchio perfetto, taglio a metà, colori, numero unico, percorsi, ruoli e punti del Polpo, fondale sempre attraversabile, bombe/vite/gesti/timer di Detonazione, binari di Mani Incrociate);
- le regole del Circo dei Disperati (`test/circo.test.mjs`): danni, squadre e ruoli da 3 a 16 giocatori, sfide dal seme, Caos, punti, e dei "robot" che giocano ogni ruolo sul telefono simulato (chi gioca perfetto non sbaglia mai, chi sta fermo sbaglia sempre);
- le regole dell'Uomo Nero (`test/uomonero.test.mjs`): batterie/Echi/tempo/vite per numero di giocatori, labirinto tutto raggiungibile e uguale dallo stesso seme, movimento nei corridoi, luce che non passa i muri, durata della Morsa, ruoli e punti;
- le regole di Fight Club (`test/fightclub.test.mjs`): numero di duelli e calendario (tutti combattono lo stesso numero di volte, coppie varie), cursore e zone, punti (Miracolo, quota alta, pareggio);
- le regole di Abduction (`test/abduction.test.mjs`): mucche e dischi per numero di giocatori, giro del disco sempre nel campo, brucata (3 s = +10, mollata = 0, +20 alla fine), raggio (fermo = salvo, muoversi o brucare = rapito, tolleranza), spinte (nel raggio con furto di metà dei punti, fuori dal raggio interrompe la brucata, mucca vera rapita), rientro al posto di una mucca vera con il radar, mucche vere mai rapite da sole, fine a 60 s;
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
