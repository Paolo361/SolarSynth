# Solar Synth
### Realtime Solar Wind Sonification Interface

**Solar Synth** è un'applicazione web interattiva che trasforma i dati del vento solare (velocità, densità e temperatura) forniti dalla NOAA in musica in tempo reale. Il progetto combina la visualizzazione dei dati scientifici con la sintesi sonora, permettendo all'utente di "ascoltare" il comportamento della nostra stella.

**Live Demo:** [Inseriere qui il link Netlify]


## Guida Rapida

1.  **Avvio:** Clicca il pulsante **PLAY** (verde lampeggiante) in alto a sinistra.
2.  **Audio:** Il sistema avvierà un *fade-in* automatico per proteggere l'udito.
3.  **Ascolta:** L'arpeggiatore suonerà note basate sui dati del plasma solare.


## Manuale Utente

### 1. Controlli Principali (Top Bar)
* **PLAY / PAUSE:** Avvia o ferma la riproduzione e lo scorrimento dei grafici.
* **RESET:** Riporta il cursore temporale all'inizio e ferma il suono.
* **METRONOMO:** Attiva un click ritmico sincronizzato.
* **REC (o):** Registra l'audio in uscita. Premi di nuovo per scaricare il file `.webm`.
* **dB** Aumenta o diminuisi i dB per regolare il volume.

### 2. Gestione Velocità (BPM)
La manopola **Speed** controlla la velocità di lettura dei dati.
* **Regolazione:** Clicca e trascina la manopola verso l'alto/basso.
* **Reset Rapido:** Fai **doppio click** sulla manopola per tornare a **120 BPM**.
* **Input Manuale:** Fai **doppio click** sul testo dei BPM (es. "120 BPM") per digitare un valore specifico.

### 3. Modalità Suono
* **PRESETS:** Usa i campioni interni (es. *Halo, Photon*).
* **MIDI:** Disabilita l'audio interno e invia segnali MIDI a sintetizzatori esterni.

### 4. Pannello Effetti
Ogni effetto (Delay, Reverb, Chorus, Distortion) ha un pulsante di attivazione e diverse manopole.
* **ON / OFF:** Attiva l'effetto. **Nota:** Se l'effetto è OFF, le modifiche alle manopole non saranno udibili finché non viene attivato.
* **Reset Parametri:** Fai **doppio click** su qualsiasi manopola per riportarla a **0**.

### 5. Equalizzatore (EQ) e Spettro
Il grafico nero in basso a destra mostra le frequenze audio.
* **Filtro Passa-Alto (HP):** Trascina la linea verticale **sinistra** per tagliare i bassi.
* **Filtro Passa-Basso (LP):** Trascina la linea verticale **destra** per tagliare gli alti.
* **Filtro Passa-Banda (BP):** Personalizza le frequenze da tagliare (HP+LP).
* **nb:** Gira la rotella del mouse per incrementare la pendenza della retta che parte dalla frequenza di taglio


## Scorciatoie da Tastiera
| Tasto | Azione |
| :--- | :--- |
| **Spazio** | Play / Pausa |
| **Spazio** | On / Off |

?? da aggiungere


## Tecnologie Usate
* **HTML5 / CSS3** (Flexbox & Responsive Design)
* **JavaScript (ES6+)**
* **Tone.js** (Motore Audio)
* **Chart.js** (Visualizzazione Dati)
* **NOAA API** (Dati Realtime)


## Sviluppo
Per eseguire il progetto in locale:
1.  Clona il repository.
2.  Apri la cartella con VS Code.
3.  Usa l'estensione **Live Server** per avviare `index.html`.

> **Nota:** È necessaria una connessione internet per scaricare i dati dalla NOAA. In caso di offline, il sistema userà dati simulati di backup. (??? da vedere nel javascrips commentato ???)
