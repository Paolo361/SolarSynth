/* ============================================================
   1) FUNZIONE PER INTERPOLAZIONE
============================================================ */
function interpolateLinear(xs, ys, newXs) {
    const out = [];
    for (let i = 0; i < newXs.length; i++) {
        const x = newXs[i];
        let j = 0;
        while (j < xs.length - 2 && x > xs[j + 1]) j++;
        const x0 = xs[j], x1 = xs[j + 1];
        const y0 = ys[j], y1 = ys[j + 1];
        // Linear interpolation
        const t = (x - x0) / (x1 - x0);
        out.push(y0 * (1 - t) + y1 * t);
    }
    return out;
}

/* ============================================================
   2) CREA GRAFICO CON ASSI E TOOLTIPS VISIBILI
============================================================ */
// Utility: risolve un colore CSS e restituisce una stringa rgba con alpha
function resolveColorToRgba(color, alpha = 1) {
    // use canvas to get a normalized color string
    try {
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = color;
        const resolved = ctx.fillStyle; // e.g. 'rgb(r,g,b)' or '#rrggbb'

        // hex -> rgba
        if (resolved[0] === '#') {
            let hex = resolved.slice(1);
            if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
            const r = parseInt(hex.slice(0,2),16);
            const g = parseInt(hex.slice(2,4),16);
            const b = parseInt(hex.slice(4,6),16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        // rgb(...) or rgba(...)
        const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9\.]+))?\)/);
        if (m) {
            const r = m[1], g = m[2], b = m[3];
            return `rgba(${r},${g},${b},${alpha})`;
        }

        // fallback: return original color (may be invalid for alpha)
        return color;
    } catch (e) {
        return color;
    }
}

// Simple map for common named colors (fallbacks if canvas parsing fails)
const COLOR_MAP = { red: '#ef4444', orange: '#fb923c', green: '#34d399' };

/* Plugin per glow/ombra sotto la linea */
const lineShadowPlugin = {
  id: 'lineShadow',
    beforeDatasetDraw(chart, args, options) {
        const {ctx} = chart;
        const datasetIndex = args.index;
        const meta = chart.getDatasetMeta(datasetIndex);
        const ds = chart.data.datasets[datasetIndex];
        if (!meta || !meta.data || meta.data.length === 0) return;
        ctx.save();
        const base = COLOR_MAP[ds.borderColor] || ds.borderColor || '#000';
        ctx.shadowColor = resolveColorToRgba(base, options.alpha ?? 0.18);
        ctx.shadowBlur = options.blur || 10;
        ctx.shadowOffsetY = options.offsetY || 2;
        // draw the line path to produce the shadow
        ctx.beginPath();
        meta.data.forEach((el, i) => {
            const p = el.getProps(['x','y'], true);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.lineWidth = ds.borderWidth || 2;
        ctx.strokeStyle = ds.borderColor || '#000';
        ctx.stroke();
        ctx.restore();
    }
};

/* Plugin minimal crosshair verticale */
const verticalLinePlugin = {
  id: 'verticalLine',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const tooltip = chart.tooltip;
    if (!tooltip || !tooltip._active || tooltip._active.length === 0) return;
    const active = tooltip._active[0];
    const x = active.element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chart.chartArea.top);
    ctx.lineTo(x, chart.chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(2,6,23,0.06)';
    ctx.stroke();
    ctx.restore();
  }
};

/* Plugin per disegnare sezioni orizzontali sincronizzate ai tasti */
const horizontalSectionsPlugin = {
  id: 'horizontalSections',
  afterDraw(chart, args, options) {
    if (!chart.isHorizontalSections) return; // solo per preview chart
    const ctx = chart.ctx;
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    
    const numKeys = keyboard.children.length;
    const chartArea = chart.chartArea;
    const sectionHeight = (chartArea.bottom - chartArea.top) / numKeys;
    
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    // ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    // ctx.font = '10px Space Mono, monospace';
    // ctx.textAlign = 'right';
    // ctx.textBaseline = 'middle';
    
    // disegna linee orizzontali per ogni sezione
    for (let i = 0; i <= numKeys; i++) {
      const y = chartArea.top + i * sectionHeight;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      
      // disegna indice a sinistra della linea
    }
    ctx.restore();
  }
};

/* Plugin per disegnare linee verticali ai punti originali del JSON */
const dataPointLinesPlugin = {
  id: 'dataPointLines',
  afterDraw(chart, args, options) {
        // respect per-chart enable/disable via options.plugins.dataPointLines
        const cfg = chart && chart.options && chart.options.plugins && chart.options.plugins.dataPointLines;
        if (!cfg) return;

        const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;
    
    // store original data points (xs from updateCharts)
    if (!window.originalDataXs || window.originalDataXs.length === 0) return;
    
    const xs = window.originalDataXs;
    let ys = [];
    
    // determina i dati Y in base al grafico
    if (chart === chartTemp && window.originalDataTemp) ys = window.originalDataTemp;
    else if (chart === chartDens && window.originalDataDens) ys = window.originalDataDens;
    else if (chart === chartVel && window.originalDataVel) ys = window.originalDataVel;
    else if (chart.canvas.id === 'chartPreview' && window.originalDataYs) ys = window.originalDataYs;
    const chartArea = chart.chartArea;
    const scale = chart.scales.x;
    const yScale = chart.scales.y;
    
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,193,7,0.05)'; // giallo più opaco
    
    // disegna linee verticali per ogni punto originale
    xs.forEach((xTime, idx) => {
      const xPx = scale.getPixelForValue(xTime);
      if (xPx >= chartArea.left && xPx <= chartArea.right) {
        ctx.beginPath();
        ctx.moveTo(xPx, chartArea.top);
        ctx.lineTo(xPx, chartArea.bottom);
        ctx.stroke();
      }
    });
    
    // Trova il punto più vicino all'highlightIndex corrente
    let closestIdx = -1;
    if (typeof highlightIndex === 'number' && highlightIndex >= 0 && meta.data[highlightIndex]) {
      const highlightXPx = meta.data[highlightIndex].x;
      let minDist = Infinity;
      
      xs.forEach((xTime, idx) => {
        const xPx = scale.getPixelForValue(xTime);
        const dist = Math.abs(xPx - highlightXPx);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });
    }
    
    // disegna cerchietti sui punti originali
    xs.forEach((xTime, idx) => {
      if (ys && ys[idx] !== undefined) {
        const xPx = scale.getPixelForValue(xTime);
        const yPx = yScale.getPixelForValue(ys[idx]);
        
        if (xPx >= chartArea.left && xPx <= chartArea.right &&
            yPx >= chartArea.top && yPx <= chartArea.bottom) {
          
          // Se questo è il punto più vicino, evidenzialo in bianco
          const isClosest = idx === closestIdx;
          const radius = isClosest ? 7 : 3.5;
          const fillAlpha = isClosest ? 1 : 0.7;
          const strokeAlpha = isClosest ? 1 : 1;
          
          if (isClosest) {
            ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Bianco
            ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx.lineWidth = 3;
          } else {
            ctx.fillStyle = `rgba(255,193,7,${fillAlpha})`; // Giallo
            ctx.strokeStyle = `rgba(255,193,7,${strokeAlpha})`;
            ctx.lineWidth = 1.5;
          }
          
          // Aggiungi glow se è il closest
          if (isClosest) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
            ctx.shadowBlur = 15;
          }
          
          ctx.beginPath();
          ctx.arc(xPx, yPx, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Reset shadow
          if (isClosest) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
        }
      }
    });
    
    ctx.restore();
  }
};

Chart.register(lineShadowPlugin, verticalLinePlugin, horizontalSectionsPlugin, dataPointLinesPlugin);

// --- Tone.js synth setup ---
let toneSynth = null;
let fftAnalyser = null;
let spectrumCanvas = null;
let spectrumCtx = null;
let spectrumAnimationId = null;
let spectrumBands = []; // Array per smooth decay
let audioFilter = null; // Filtro audio
let mainLimiter = null;
let mainCompressor = null;
let masterVolume = null;
let toneStarted = false;
let lastPlayedMidi = null;
let lastPlayTime = 0;
const playCooldown = 150; // ms between retriggers of same note
// Optional sample player for oneshot sample mapping
let samplePlayer = null;
let sampleLoadedName = null;
const MAX_POLYPHONY = 8;
const activeSampleVoices = [];
let outputMeter = null;
let meterAnimationId = null;
const VOLUME_MIN = -40;
const VOLUME_MAX = 6;
let currentVolumeDb = 0;
const SNAP_THRESHOLD = 0.3;
// Metronome variables
let metronomeEnabled = false;
let metronomeOsc = null;
let metronomePanner = null;
let metronomeVolume = null;

// Recorder variables
let recorder = null;
let isRecording = false;

// Filter variables
// Filters temporarily disabled

const PRESET_SAMPLES = {
    afterglow: 'suoni/afterglow.wav',
    ember: 'suoni/ember.wav',
    kelvin: 'suoni/kelvin.wav',
    lumen: 'suoni/lumen.wav',
    parsec: 'suoni/parsec.wav',
    photon: 'suoni/photon.wav',
    halo: 'suoni/halo.wav'
};

// MIDI Output variables
let midiOutput = null;
let midiEnabled = false;
let currentMidiNote = null;

// Audio effects chain
let reverb = null;

function ensureToneStarted() {
    try {
        if (!mainLimiter) {
            // Chain: Volume -> Compressor -> Limiter -> Destination
            mainLimiter = new Tone.Limiter(-2).toDestination();
            mainCompressor = new Tone.Compressor({
                threshold: -20,
                ratio: 4,
                attack: 0.01,
                release: 0.1
            }).connect(mainLimiter);
            masterVolume = new Tone.Volume(0).connect(mainCompressor);
        }
        if (!outputMeter && masterVolume) {
            outputMeter = new Tone.Meter({ normalRange: false });
            masterVolume.connect(outputMeter);
            startDbMeterLoop();
        }
        if (!toneSynth) toneSynth = new Tone.Synth({ oscillator: { type: 'sine' } }).connect(masterVolume);
        
        // Initialize FFT Analyser
        if (!fftAnalyser && masterVolume) {
            fftAnalyser = new Tone.FFT(512);
            masterVolume.connect(fftAnalyser);
            initSpectrum();
        }
        
        if (!toneStarted && typeof Tone !== 'undefined' && Tone.start) {
            // Tone.start() must be called in a user gesture; try to start silently if possible
            Tone.start();
            toneStarted = true;
        }
        // Initialize metronome if not already done
        if (!metronomeOsc) {
            initMetronome();
        }
    } catch (e) {
        console.warn('Tone.js not available or failed to start', e);
    }
}

function setMasterVolume(volumeDb) {
    ensureToneStarted();
    const clamped = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volumeDb));
    currentVolumeDb = clamped;
    if (masterVolume) masterVolume.volume.value = clamped;
}

function updateDbReadout(volumeDb) {
    const readout = document.getElementById('dbReadout');
    if (!readout) return;
    const val = volumeDb === 0 ? '0' : volumeDb.toFixed(1);
    readout.textContent = `${val} dB`;
}

function startDbMeterLoop() {
    if (meterAnimationId) return; // already running
    const loop = () => {
        const fill = document.getElementById('dbMeterFill');
        if (!fill || !outputMeter) {
            meterAnimationId = null;
            return;
        }
        let level = outputMeter.getLevel();
        if (!Number.isFinite(level)) level = -60;
        const colorLevel = level;
        const clamped = Math.max(-60, Math.min(0, level));
        const pct = Math.max(0, Math.min(1, (clamped + 60) / 60));
        fill.style.width = `${pct * 100}%`;
        let color = '#22c55e';
        if (colorLevel > -3 && colorLevel <= 0) color = '#fbbf24';
        else if (colorLevel > 0) color = '#ef4444';
        fill.style.background = color;
        meterAnimationId = requestAnimationFrame(loop);
    };
    meterAnimationId = requestAnimationFrame(loop);
}

// ========== FFT Spectrum Visualizer (Equalizer Style) ==========
function initSpectrum() {
    spectrumCanvas = document.getElementById('spectrumCanvas');
    if (!spectrumCanvas) return;
    spectrumCtx = spectrumCanvas.getContext('2d');
    
    // Inizializza le bande con valori zero
    const numBands = 32; // Numero di bande dell'equalizzatore
    spectrumBands = new Array(numBands).fill(0);
    
    // Inizializza i controlli del filtro
    initFilterControls();
    
    startSpectrumLoop();
}

// ========== Parametric EQ (Dual Filter: HighPass + LowPass) ==========
let eqEnabled = false;
let eqHighpassFreq = 20;      // Hz - fully open (no attenuation)
let eqLowpassFreq = 20000;    // Hz - fully open (no attenuation)
let eqHighpassQ = 0.7071;     // Q value (steepness) for highpass
let eqLowpassQ = 0.7071;      // Q value (steepness) for lowpass
let eqHighpassRolloff = -12;  // Rolloff slope for highpass
let eqLowpassRolloff = -12;   // Rolloff slope for lowpass
let eqHighpassFilter = null;
let eqLowpassFilter = null;
let eqDraggingFilter = null;  // 'hp' or 'lp' - which filter is being dragged

const EQ_MIN_FREQ = 20;
const EQ_MAX_FREQ = 20000;
const EQ_MIN_Q = 0.1;         // Minimum Q (gentle slope)
const EQ_MAX_Q = 20;          // Maximum Q (steep slope)
const EQ_VALID_ROLLOFFS = [-12, -24, -48, -96]; // Valid rolloff values for Tone.js

function initFilterControls() {
    // Create the dual filter chain (always exists, but might be bypassed)
    createEQFilters();
    
    // EQ toggle button
    const eqToggleBtn = document.getElementById('eqToggleBtn');
    if (eqToggleBtn) {
        eqToggleBtn.addEventListener('click', () => {
            eqEnabled = !eqEnabled;
            eqToggleBtn.classList.toggle('active');
            eqToggleBtn.textContent = eqEnabled ? 'ON' : 'OFF';
            
            if (eqEnabled) {
                // Activate EQ: connect filter chain
                if (eqHighpassFilter && eqLowpassFilter && masterVolume) {
                    eqHighpassFilter.disconnect();
                    eqLowpassFilter.disconnect();
                    eqHighpassFilter.connect(eqLowpassFilter);
                    eqLowpassFilter.connect(masterVolume);
                }
                
                // Reconnect toneSynth to EQ if it exists
                if (toneSynth) {
                    toneSynth.disconnect();
                    if (eqHighpassFilter) {
                        toneSynth.connect(eqHighpassFilter);
                    }
                }
            } else {
                // Deactivate EQ: bypass filters
                if (toneSynth && masterVolume) {
                    toneSynth.disconnect();
                    toneSynth.connect(masterVolume);
                }
            }
        });
    }
    
    // Canvas mouse events for EQ interaction
    setupSpectrumCanvasInteraction();
}

function createEQFilters() {
    if (!eqHighpassFilter) {
        eqHighpassFilter = new Tone.Filter({
            type: 'highpass',
            frequency: eqHighpassFreq,
            rolloff: eqHighpassRolloff,
            Q: eqHighpassQ
        });
    }
    
    if (!eqLowpassFilter) {
        eqLowpassFilter = new Tone.Filter({
            type: 'lowpass',
            frequency: eqLowpassFreq,
            rolloff: eqLowpassRolloff,
            Q: eqLowpassQ
        });
    }
}

function setupSpectrumCanvasInteraction() {
    const canvas = document.getElementById('spectrumCanvas');
    if (!canvas) return;
    
    const DRAG_THRESHOLD = 10; // pixels - how close to a line to start dragging
    
    // Map Hz to canvas X position (logarithmic scale)
    const hzToPixel = (hz) => {
        const canvasWidth = canvas.offsetWidth;
        const log20 = Math.log(20);
        const log20k = Math.log(20000);
        const logHz = Math.log(hz);
        return ((logHz - log20) / (log20k - log20)) * canvasWidth;
    };
    
    // Map canvas X position to Hz (logarithmic scale)
    const pixelToHz = (px) => {
        const canvasWidth = canvas.offsetWidth;
        const log20 = Math.log(20);
        const log20k = Math.log(20000);
        const t = px / canvasWidth;
        return Math.exp(log20 + t * (log20k - log20));
    };
    
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Get current line positions
        const hpPixel = hzToPixel(eqHighpassFreq);
        const lpPixel = hzToPixel(eqLowpassFreq);
        
        // Detect which line is being dragged
        if (Math.abs(mouseX - hpPixel) < DRAG_THRESHOLD) {
            eqDraggingFilter = 'hp';
        } else if (Math.abs(mouseX - lpPixel) < DRAG_THRESHOLD) {
            eqDraggingFilter = 'lp';
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        if (eqDraggingFilter) {
            // Update frequency based on mouse position
            const newFreq = Math.max(EQ_MIN_FREQ, Math.min(EQ_MAX_FREQ, pixelToHz(mouseX)));
            
            if (eqDraggingFilter === 'hp') {
                eqHighpassFreq = newFreq;
                // Always update the filter frequency, even if not active
                if (eqHighpassFilter) {
                    eqHighpassFilter.frequency.rampTo(newFreq, 0.05);
                }
            } else if (eqDraggingFilter === 'lp') {
                eqLowpassFreq = newFreq;
                // Always update the filter frequency, even if not active
                if (eqLowpassFilter) {
                    eqLowpassFilter.frequency.rampTo(newFreq, 0.05);
                }
            }
        } else {
            // Change cursor if near a line
            const hpPixel = hzToPixel(eqHighpassFreq);
            const lpPixel = hzToPixel(eqLowpassFreq);
            const CURSOR_THRESHOLD = 15;
            
            if (Math.abs(mouseX - hpPixel) < CURSOR_THRESHOLD || Math.abs(mouseX - lpPixel) < CURSOR_THRESHOLD) {
                canvas.style.cursor = 'ew-resize';
            } else {
                canvas.style.cursor = 'col-resize';
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        eqDraggingFilter = null;
    });
    
    // Mouse wheel per controllo ripidità (rolloff)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // Determina quale filtro modificare in base alla posizione X del mouse
        const hpPixel = hzToPixel(eqHighpassFreq);
        const lpPixel = hzToPixel(eqLowpassFreq);
        const THRESHOLD = 50; // pixels - area di influenza intorno alla linea
        
        let targetFilter = null;
        if (Math.abs(mouseX - hpPixel) < THRESHOLD) {
            targetFilter = 'hp';
        } else if (Math.abs(mouseX - lpPixel) < THRESHOLD) {
            targetFilter = 'lp';
        }
        
        if (targetFilter) {
            // deltaY negativo = scroll up = aumenta ripidità (es. -12 → -24)
            // deltaY positivo = scroll down = diminuisce ripidità (es. -24 → -12)
            
            if (targetFilter === 'hp') {
                const currentIndex = EQ_VALID_ROLLOFFS.indexOf(eqHighpassRolloff);
                let newIndex = currentIndex;
                
                if (e.deltaY < 0 && currentIndex < EQ_VALID_ROLLOFFS.length - 1) {
                    newIndex = currentIndex + 1; // Più ripido
                } else if (e.deltaY > 0 && currentIndex > 0) {
                    newIndex = currentIndex - 1; // Meno ripido
                }
                
                if (newIndex !== currentIndex) {
                    eqHighpassRolloff = EQ_VALID_ROLLOFFS[newIndex];
                    if (eqHighpassFilter) {
                        eqHighpassFilter.rolloff = eqHighpassRolloff;
                    }
                }
            } else if (targetFilter === 'lp') {
                const currentIndex = EQ_VALID_ROLLOFFS.indexOf(eqLowpassRolloff);
                let newIndex = currentIndex;
                
                if (e.deltaY < 0 && currentIndex < EQ_VALID_ROLLOFFS.length - 1) {
                    newIndex = currentIndex + 1; // Più ripido
                } else if (e.deltaY > 0 && currentIndex > 0) {
                    newIndex = currentIndex - 1; // Meno ripido
                }
                
                if (newIndex !== currentIndex) {
                    eqLowpassRolloff = EQ_VALID_ROLLOFFS[newIndex];
                    if (eqLowpassFilter) {
                        eqLowpassFilter.rolloff = eqLowpassRolloff;
                    }
                }
            }
        }
    }, { passive: false });
}

function startSpectrumLoop() {
    if (spectrumAnimationId) return; // already running
    
    // Definisci le bande di frequenza (Hz) in scala logaritmica
    const frequencyBands = [
        20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
        500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000,
        5000, 6300, 8000, 10000, 12500, 16000, 20000
    ];
    
    const loop = () => {
        if (!spectrumCtx || !spectrumCanvas || !fftAnalyser) {
            spectrumAnimationId = null;
            return;
        }
        
        // Aggiorna dimensioni canvas per corrispondere alle dimensioni visuali CSS
        if (spectrumCanvas.width !== spectrumCanvas.clientWidth || spectrumCanvas.height !== spectrumCanvas.clientHeight) {
            spectrumCanvas.width = spectrumCanvas.clientWidth;
            spectrumCanvas.height = spectrumCanvas.clientHeight;
        }
        
        const values = fftAnalyser.getValue();
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;
        const sampleRate = 44100; // Assuming standard sample rate
        const nyquist = sampleRate / 2;
        
        // Clear canvas con sfondo scuro
        spectrumCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        spectrumCtx.fillRect(0, 0, width, height);
        
        // Calcola larghezza barra e gap
        const numBands = spectrumBands.length;
        const totalGap = numBands - 1;
        const gapWidth = 2;
        const barWidth = (width - totalGap * gapWidth) / numBands;
        
        // Raggruppa i bin FFT in bande logaritmiche e calcola i valori
        for (let i = 0; i < numBands; i++) {
            const freqStart = i === 0 ? 20 : frequencyBands[i - 1];
            const freqEnd = i < frequencyBands.length ? frequencyBands[i] : nyquist;
            
            // Trova i bin corrispondenti a questa banda
            const binStart = Math.floor((freqStart / nyquist) * values.length);
            const binEnd = Math.ceil((freqEnd / nyquist) * values.length);
            
            // Calcola il valore medio (in dB) per questa banda
            let sum = 0;
            let count = 0;
            for (let j = binStart; j < binEnd && j < values.length; j++) {
                sum += values[j];
                count++;
            }
            const avgDb = count > 0 ? sum / count : -100;
            
            // Normalizza da dB (-100 a 0) a range 0-1
            const normalizedValue = Math.max(0, Math.min(1, (avgDb + 100) / 100));
            
            // Smooth decay: interpola verso il nuovo valore
            const smoothFactor = 0.3; // Più basso = più fluido
            spectrumBands[i] = spectrumBands[i] * (1 - smoothFactor) + normalizedValue * smoothFactor;
            
            // Applica decay se il segnale diminuisce
            if (normalizedValue < spectrumBands[i]) {
                spectrumBands[i] *= 0.85; // Decay rate
            }
        }
        
        // Disegna area riempita (filled)
        const gradient = spectrumCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#34d399');
        gradient.addColorStop(0.5, '#fbbf24');
        gradient.addColorStop(1, '#ef4444');
        
        spectrumCtx.fillStyle = gradient;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(0, height);
        
        // Disegna il contorno superiore dell'area
        for (let i = 0; i < numBands; i++) {
            const barHeight = spectrumBands[i] * height;
            const x = i * (barWidth + gapWidth) + barWidth / 2;
            const y = height - barHeight;
            
            if (i === 0) {
                spectrumCtx.lineTo(x, y);
            } else {
                // Interpolazione smooth tra i punti
                const prevX = (i - 1) * (barWidth + gapWidth) + barWidth / 2;
                const prevY = height - spectrumBands[i - 1] * height;
                const cpX1 = prevX + (x - prevX) / 2;
                const cpX2 = prevX + (x - prevX) / 2;
                spectrumCtx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
            }
        }
        
        // Chiudi il percorso
        spectrumCtx.lineTo(width, height);
        spectrumCtx.closePath();
        spectrumCtx.fill();
        
        // Aggiungi linea di contorno
        spectrumCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        spectrumCtx.lineWidth = 2;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(0, height);
        for (let i = 0; i < numBands; i++) {
            const barHeight = spectrumBands[i] * height;
            const x = i * (barWidth + gapWidth) + barWidth / 2;
            const y = height - barHeight;
            if (i === 0) {
                spectrumCtx.lineTo(x, y);
            } else {
                const prevX = (i - 1) * (barWidth + gapWidth) + barWidth / 2;
                const prevY = height - spectrumBands[i - 1] * height;
                const cpX1 = prevX + (x - prevX) / 2;
                const cpX2 = prevX + (x - prevX) / 2;
                spectrumCtx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
            }
        }
        spectrumCtx.stroke();
        
        // Disegna griglia di frequenze tratteggiata
        const frequencyMarkings = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        const hzToPixelInGrid = (hz) => {
            const log20 = Math.log(20);
            const log20k = Math.log(20000);
            const logHz = Math.log(hz);
            return ((logHz - log20) / (log20k - log20)) * width;
        };
        
        spectrumCtx.strokeStyle = 'rgba(251, 191, 36, 0.12)';
        spectrumCtx.lineWidth = 1;
        spectrumCtx.setLineDash([4, 3]);
        frequencyMarkings.forEach(freq => {
            const x = hzToPixelInGrid(freq);
            spectrumCtx.beginPath();
            spectrumCtx.moveTo(x, 0);
            spectrumCtx.lineTo(x, height);
            spectrumCtx.stroke();
        });
        spectrumCtx.setLineDash([]);
        
        // Disegna sempre le linee del filtro EQ (anche quando spento)
        // Funzione helper per convertire Hz a pixel (logaritmica)
        const hzToPixelInLoop = (hz) => {
            const log20 = Math.log(20);
            const log20k = Math.log(20000);
            const logHz = Math.log(hz);
            return ((logHz - log20) / (log20k - log20)) * width;
        };
        
        const hpX = hzToPixelInLoop(eqHighpassFreq);
        const lpX = hzToPixelInLoop(eqLowpassFreq);
        
        // Colori dipendenti dallo stato (acceso/spento)
        const lineOpacity = eqEnabled ? 1 : 0.25;
        const curveOpacity = eqEnabled ? 0.7 : 0.2;
        const areaOpacity = eqEnabled ? 0.05 : 0.02;
        const handleOpacity = eqEnabled ? 1 : 0.3;
        
        if (eqEnabled) {
            // Funzione helper per convertire pixel X a Hz (interpolazione logaritmica)
            const pixelToHz = (px) => {
                const t = px / width;
                const log20 = Math.log(20);
                const log20k = Math.log(20000);
                return Math.exp(log20 + t * (log20k - log20));
            };
            
            // Disegna curva di risposta del HighPass (Giallo) - interpolata su ogni pixel
            spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${curveOpacity})`;
            spectrumCtx.lineWidth = 3;
            spectrumCtx.beginPath();
            
            const hpSlopeFactor = Math.abs(eqHighpassRolloff) / 12;
            let isFirstPoint = true;
            
            for (let x = 0; x <= width; x += 2) {
                const freq = pixelToHz(x);
                
                // HighPass response: basse frequenze sono tagliate
                let response = 1;
                if (freq < eqHighpassFreq) {
                    const ratio = freq / eqHighpassFreq;
                    response = Math.max(0, (Math.log10(ratio) * hpSlopeFactor) + 1);
                    response = Math.max(0, Math.min(1, response));
                }
                
                const y = height - (response * height * 0.85);
                
                if (isFirstPoint) {
                    spectrumCtx.moveTo(x, y);
                    isFirstPoint = false;
                } else {
                    spectrumCtx.lineTo(x, y);
                }
            }
            spectrumCtx.stroke();
            
            // Disegna curva di risposta del LowPass (Giallo) - interpolata su ogni pixel
            spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${curveOpacity})`;
            spectrumCtx.lineWidth = 3;
            spectrumCtx.beginPath();
            
            const lpSlopeFactor = Math.abs(eqLowpassRolloff) / 12;
            isFirstPoint = true;
            
            for (let x = 0; x <= width; x += 2) {
                const freq = pixelToHz(x);
                
                // LowPass response: alte frequenze sono tagliate
                let response = 1;
                if (freq > eqLowpassFreq) {
                    const ratio = freq / eqLowpassFreq;
                    response = Math.max(0, 1 - (Math.log10(ratio) * lpSlopeFactor));
                    response = Math.max(0, Math.min(1, response));
                }
                
                const y = height - (response * height * 0.85);
                
                if (isFirstPoint) {
                    spectrumCtx.moveTo(x, y);
                    isFirstPoint = false;
                } else {
                    spectrumCtx.lineTo(x, y);
                }
            }
            spectrumCtx.stroke();
            
            // Disegna area oscurata per il HighPass (sinistra)
            spectrumCtx.fillStyle = `rgba(251, 191, 36, ${areaOpacity})`;
            spectrumCtx.fillRect(0, 0, hpX, height);
            
            // Disegna area oscurata per il LowPass (destra)
            spectrumCtx.fillStyle = `rgba(251, 191, 36, ${areaOpacity})`;
            spectrumCtx.fillRect(lpX, 0, width - lpX, height);
        }
        
        // Disegna linea verticale per HighPass (sempre visibile, opacità variabile)
        spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${lineOpacity})`;
        spectrumCtx.lineWidth = 2.5;
        spectrumCtx.setLineDash([6, 5]);
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(hpX, 0);
        spectrumCtx.lineTo(hpX, height);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
        
        // Disegna indicatore (handle) su HP line
        spectrumCtx.fillStyle = `rgba(251, 191, 36, ${handleOpacity})`;
        spectrumCtx.strokeStyle = `rgba(255, 255, 255, ${handleOpacity * 0.6})`;
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.arc(hpX, 10, 5, 0, 2 * Math.PI);
        spectrumCtx.fill();
        spectrumCtx.stroke();
        
        // Disegna linea verticale per LowPass (sempre visibile, opacità variabile)
        spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${lineOpacity})`;
        spectrumCtx.lineWidth = 2.5;
        spectrumCtx.setLineDash([6, 5]);
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(lpX, 0);
        spectrumCtx.lineTo(lpX, height);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
        
        // Disegna indicatore (handle) su LP line
        spectrumCtx.fillStyle = `rgba(251, 191, 36, ${handleOpacity})`;
        spectrumCtx.strokeStyle = `rgba(255, 255, 255, ${handleOpacity * 0.6})`;
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.arc(lpX, 10, 5, 0, 2 * Math.PI);
        spectrumCtx.fill();
        spectrumCtx.stroke();
        
        // Disegna etichette con frequenze in basso SOLO se il filtro è attivo
        if (eqEnabled) {
            spectrumCtx.font = 'bold 14px "Space Mono", monospace';
            spectrumCtx.textAlign = 'center';
            spectrumCtx.fillStyle = 'rgba(251, 191, 36, 1)';
            const hpLabel = eqHighpassFreq >= 1000 ? (eqHighpassFreq / 1000).toFixed(1) + 'k' : Math.round(eqHighpassFreq) + '';
            spectrumCtx.fillText(hpLabel, hpX, height - 2);
            
            const lpLabel = eqLowpassFreq >= 1000 ? (eqLowpassFreq / 1000).toFixed(1) + 'k' : Math.round(eqLowpassFreq) + '';
            spectrumCtx.fillText(lpLabel, lpX, height - 2);
        }
        
        // Disegna etichette di frequenza sull'asse X
        spectrumCtx.font = '8px "Space Mono", monospace';
        spectrumCtx.fillStyle = '#e2e8f0';
        spectrumCtx.textAlign = 'center';
        
        // Etichette da mostrare (indici selezionati delle frequencyBands)
        const labelIndices = [0, 7, 13, 18, 23, 28, 30]; // 20Hz, 100Hz, 400Hz, 1kHz, 4kHz, 12.5kHz, 20kHz
        
        labelIndices.forEach(index => {
            if (index < numBands) {
                const freq = frequencyBands[index];
                const x = index * (barWidth + gapWidth) + barWidth / 2;
                
                // Formatta la frequenza (Hz o kHz)
                let label;
                if (freq >= 1000) {
                    label = (freq / 1000).toFixed(freq >= 10000 ? 0 : 1) + 'k';
                } else {
                    label = Math.round(freq).toString();
                }
                
                spectrumCtx.fillText(label, x, height - 2);
            }
        });
        
        spectrumAnimationId = requestAnimationFrame(loop);
    };
    
    spectrumAnimationId = requestAnimationFrame(loop);
}

function attachVolumeSlider() {
    const thumb = document.getElementById('volumeThumb');
    const slider = document.querySelector('.volume-slider');
    if (!thumb || !slider) return;

    const updateThumb = (volumeDb) => {
        const t = (volumeDb - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN);
        const pct = Math.max(0, Math.min(1, t));
        thumb.style.left = `${pct * 100}%`;
        thumb.setAttribute('aria-valuenow', volumeDb.toFixed(1));
    };

    const applyVolumeFromEvent = (evt) => {
        const rect = slider.getBoundingClientRect();
        const x = Math.min(Math.max(evt.clientX - rect.left, 0), rect.width);
        const t = rect.width > 0 ? x / rect.width : 0;
        const volumeDb = VOLUME_MIN + t * (VOLUME_MAX - VOLUME_MIN);
        let rounded = Math.round(volumeDb * 10) / 10;
        if (Math.abs(rounded) < SNAP_THRESHOLD) rounded = 0;
        setMasterVolume(rounded);
        updateThumb(rounded);
        updateDbReadout(rounded);
    };

    updateThumb(currentVolumeDb);
    setMasterVolume(currentVolumeDb);
    updateDbReadout(currentVolumeDb);

    let dragging = false;

    // Double-click to reset to 0 dB
    const resetToZero = (evt) => {
        setMasterVolume(0);
        updateThumb(0);
        updateDbReadout(0);
        evt.preventDefault();
    };

    thumb.addEventListener('dblclick', resetToZero);
    slider.addEventListener('dblclick', resetToZero);

    const startDrag = (evt) => {
        dragging = true;
        document.body.style.cursor = 'ew-resize';
        applyVolumeFromEvent(evt);
        evt.preventDefault();
    };

    const moveDrag = (evt) => {
        if (!dragging) return;
        applyVolumeFromEvent(evt);
    };

    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = 'default';
    };

    slider.addEventListener('mousedown', startDrag);
    thumb.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
}

function initMetronome() {
    try {
        // 1. VOLUME: Abbassiamo un po' il volume per non renderlo fastidioso
        metronomeVolume = new Tone.Volume(-10).toDestination();
        metronomePanner = new Tone.Panner(0).connect(metronomeVolume);

        // 2. SUONO: Configuriamo il synth per sembrare un Woodblock/Click secco
        // Usiamo un attacco velocissimo e un decadimento breve
        metronomeOsc = new Tone.MembraneSynth({
            pitchDecay: 0.01,  // Molto veloce per l'effetto "click"
            octaves: 1,        // Meno estensione sulle basse frequenze
            oscillator: { type: 'sine' }, // Onda sinusoidale pura per pulizia
            envelope: {
                attack: 0.001, // Attacco immediato
                decay: 0.1,    // Coda molto corta (secco)
                sustain: 0,
                release: 0.1
            }
        }).connect(metronomePanner);
        
        // 3. LOGICA DEL LOOP (SCHEDULING)
        // Impostiamo la ripetizione su '4n' (semiminima/quarto).
        // Dato che il tuo cursore si muove a '2n' (minima), questo farà 2 battiti per ogni spostamento.
        Tone.Transport.scheduleRepeat((time) => {
            if (metronomeEnabled) {
                // Otteniamo la posizione corrente nel formato "bars:quarters:sixteenths"
                // Esempio: "0:0:0", "0:1:0", "0:2:0"
                const position = Tone.Transport.position.split(':');
                const quarter = parseInt(position[1]);

                // 4. ACCENTO:
                // Se siamo sui quarti pari (0, 2), siamo allineati con il cursore (Downbeat) -> Nota Alta
                // Se siamo sui quarti dispari (1, 3), siamo nel mezzo (Upbeat) -> Nota Bassa
                if (quarter % 2 === 0) {
                    // Click Alto (Suono primario) - Più acuto (G5)
                    metronomeOsc.triggerAttackRelease('G6', '32n', time, 1); 
                } else {
                    // Click Basso (Suddivisione) - Meno acuto (C6) e leggermente più piano (velocity 0.6)
                    metronomeOsc.triggerAttackRelease('C6', '32n', time, 0.6);
                }
            }
        }, '4n'); // <--- Qui sta la magia: '4n' è il doppio della velocità del cursore ('2n')
        
        // --- LOOP DEL CURSORE (RIMANE INVARIATO A '2n') ---
        // Questo assicura che il cursore continui a muoversi lentamente mentre il metronomo batte il doppio
        // Rimuoviamo Tone.Draw da qui. La logica deve scattare PRECISA col metronomo.
        transportLoopId = Tone.Transport.scheduleRepeat((time) => {
            advanceHighlight(time); // Passiamo 'time' alla funzione
        }, '2n');
        
        console.log('Metronome initialized: Woodblock style, 2 clicks per data step.');
    } catch (e) {
        console.warn('Failed to initialize metronome', e);
    }
}

function updateMetronomeBPM(bpm) {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.bpm.value = bpm;
        }
    } catch (e) {
        console.warn('Failed to update metronome BPM', e);
    }
}

// ============================================================
// MIDI OUTPUT FUNCTIONS
// ============================================================

// Request MIDI access and populate output devices
async function initMidiAccess() {
    try {
        const access = await navigator.requestMIDIAccess();
        // Richiediamo anche sysex: true per massima compatibilità
        const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
        
        const selectEl = document.getElementById('midiOutputSelect');
        const toggleBtn = document.getElementById('midiToggleBtn');
        const statusEl = document.getElementById('midiStatus');

        // Funzione interna per aggiornare la lista (da chiamare all'avvio e ai cambiamenti)
        const updateMidiList = () => {
            // Salva la selezione corrente se c'è
            const currentSelection = selectEl.value;
            
            // Pulisci la lista mantenendo l'opzione di default
            selectEl.innerHTML = '<option value="">-- Nessuno --</option>';
            
            const outputs = midiAccess.outputs.values();
            let hasOutputs = false;
            let deviceFoundAgain = false;

            for (let output of outputs) {
                hasOutputs = true;
                // Filtra per non mostrare porte inutili (opzionale, rimuovi if se vuoi vedere tutto)
                // if (output.name.includes("CTRL")) continue; 

                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name;
                selectEl.appendChild(option);

                // Se la porta che avevamo selezionato esiste ancora, riselezionala
                if (output.id === currentSelection) {
                    option.selected = true;
                    deviceFoundAgain = true;
                }
            }

            if (hasOutputs) {
                toggleBtn.style.display = 'inline-block';
                if (!deviceFoundAgain && currentSelection !== "") {
                     // Il dispositivo selezionato è stato scollegato
                     if (statusEl) statusEl.textContent = 'MIDI: Dispositivo scollegato';
                     midiOutput = null; // Reset variabile globale
                }
            } else {
                if (statusEl) statusEl.textContent = 'MIDI: nessun dispositivo trovato';
            }
        };

        // 1. Popola la lista subito
        updateMidiList();

        // 2. Ascolta i cambiamenti (Hot-plugging)
        // Se accendi il synth DOPO aver aperto il sito, questo lo rileverà
        midiAccess.onstatechange = (e) => {
            updateMidiList();
        };
        
        return midiAccess;

    } catch (e) {
        console.error('Web MIDI API not supported or access denied:', e);
        const statusEl = document.getElementById('midiStatus');
        if(statusEl) statusEl.textContent = 'MIDI: Errore o accesso negato';
        return null;
    }
}

// Send MIDI Note On message
function sendMidiNoteOn(noteNumber, velocity = 100, channel = 0) {
    if (!midiOutput) return;
    
    const noteOnMessage = [0x90 + channel, noteNumber, velocity]; // Note On
    try {
        midiOutput.send(noteOnMessage);
        currentMidiNote = noteNumber;
    } catch (e) {
        console.error('Failed to send MIDI Note On:', e);
    }
}

// Send MIDI Note Off message
function sendMidiNoteOff(noteNumber, channel = 0) {
    if (!midiOutput) return;
    
    const noteOffMessage = [0x80 + channel, noteNumber, 0]; // Note Off
    try {
        midiOutput.send(noteOffMessage);
    } catch (e) {
        console.error('Failed to send MIDI Note Off:', e);
    }
}

// Play MIDI note on Minilogue XD
function playMidiNote(midiNumber) {
    if (!midiEnabled || !midiOutput) return;
    
    // Stop previous note if different
    if (currentMidiNote !== null && currentMidiNote !== midiNumber) {
        sendMidiNoteOff(currentMidiNote);
    }
    
    // Play new note
    sendMidiNoteOn(midiNumber, 100);
}

// Stop MIDI note
function stopMidiNote() {
    if (currentMidiNote !== null) {
        sendMidiNoteOff(currentMidiNote);
        currentMidiNote = null;
    }
}

// Load a sample from a remote URL and set its root MIDI (e.g., 60 for C4)
async function loadSampleFromUrl(url, rootMidi = 60, name = null) {
    try {
        if (typeof Tone === 'undefined') throw new Error('Tone.js required');
        // Ensure Tone audio context is started (requires user gesture on some browsers)
        ensureToneStarted();
        
        // Dispose old sample player if it exists (allow replacing sample)
        if (samplePlayer) {
            try {
                samplePlayer.dispose();
            } catch (e) { /* ignore disposal errors */ }
        }
        
        // Fetch the audio file as an ArrayBuffer
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode using Web Audio API directly
        const audioContext = Tone.getContext().rawContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create a Tone.Player from the decoded buffer
        samplePlayer = new Tone.Player({ onload: () => {} });
        // Manually set the buffer
        samplePlayer.buffer.set(audioBuffer);
        
        const sampleRootMidi = Number(rootMidi) || 60;
        sampleLoadedName = name || url;
        return true;
    } catch (e) {
        console.warn('Failed to load sample', e);
        samplePlayer = null;
        sampleLoadedName = null;
        return false;
    }
}

// Carica uno dei preset interni dalla cartella "suoni"
async function loadPresetSample(name) {
  const url = PRESET_SAMPLES[name];
  if (!url) return;

  // Usa la stessa pipeline di loadSampleFromUrl,
  // ma passando il nome leggibile come "name"
  const rootMidi = 60; // Fixed root MIDI (C4) for all samples
  await loadSampleFromUrl(url, rootMidi, name);

  const status = document.getElementById('sampleStatus');
  if (status && name) {
    status.textContent = `Sample mode: Preset (${name})`;
  }
}


// Prompt the user to pick a local audio file and load it as the sample.
function pickSampleFile(rootMidi = 60, fileInputEl = null) {
    // If a file input element is provided, use it (our UI adds one). Otherwise create temporary.
    const handleFile = async (f) => {
        if (!f) return;
        const url = URL.createObjectURL(f);
        const ok = await loadSampleFromUrl(url, rootMidi, f.name);
        if (ok) {
            const status = document.getElementById('sampleStatus');
            if (status) {
                status.textContent = `Sample mode: Manuale (${f.name})`;
            }
        }

    };

    if (fileInputEl) {
        // Reset the input value to allow selecting the same file again (or a new one)
        fileInputEl.value = '';
        
        const file = fileInputEl.files && fileInputEl.files[0];
        if (file) return handleFile(file);

        // attach change listener
        fileInputEl.onchange = (ev) => {
            const f = ev.target.files && ev.target.files[0];
            handleFile(f);
        };
        fileInputEl.click();
        return;
    }

    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'audio/*';
    inp.onchange = async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        await handleFile(f);
    };
    inp.click();
}

// Play loaded sample transposed to the requested MIDI note (oneshot) using playbackRate
function pruneSampleVoices() {
    while (activeSampleVoices.length >= MAX_POLYPHONY) {
        const old = activeSampleVoices.shift();
        try { old.stop(); } catch (e) {}
        try { old.dispose(); } catch (e) {}
    }
}

function trackSampleVoice(player) {
    if (!player) return () => {};
    const cleanup = () => {
        const idx = activeSampleVoices.indexOf(player);
        if (idx !== -1) activeSampleVoices.splice(idx, 1);
    };
    player.onstop = cleanup;
    activeSampleVoices.push(player);
    return cleanup;
}

function playSampleAtMidi(midi, time) { // Aggiungi parametro time
    try {
        if (!samplePlayer || !samplePlayer.buffer) {
            console.warn('No sample loaded or buffer missing');
            return false;
        }
        const root = 60; 
        const semitoneShift = midi - root;

        console.log('Playing sample at MIDI', midi, 'shift:', semitoneShift, 'semitones');

        // Ensure audio context is started
        ensureToneStarted();
        pruneSampleVoices();

        const temp = new Tone.Player(samplePlayer.buffer);
        const cleanup = trackSampleVoice(temp);
        
        // Connect to EQ filters if enabled, otherwise to masterVolume
        if (eqEnabled && eqHighpassFilter) {
            temp.connect(eqHighpassFilter);
        } else {
            temp.connect(masterVolume);
        }
        
        temp.volume.value = -4; 
        
        const playbackRate = Math.pow(2, semitoneShift / 12);
        if (temp.playbackRate instanceof Tone.Signal || (temp.playbackRate && typeof temp.playbackRate.value !== 'undefined')) {
            temp.playbackRate.value = playbackRate;
        } else {
            temp.playbackRate = playbackRate;
        }
        
        // QUI È IL TRUCCO: Se c'è 'time', usalo per schedulare il suono nel futuro preciso
        if (time) {
            temp.start(time);
        } else {
            temp.start();
        }

        setTimeout(() => {
            try { temp.stop(); } catch (e) {}
            try { temp.dispose(); } catch (e) {}
            cleanup();
        }, (samplePlayer.buffer.duration / playbackRate + 0.5) * 1000);

        return true;
    } catch (e) {
        console.warn('Sample play failed', e);
        return false;
    }
}

/* ============================================================
   MODIFICA 1: Rimuovere il blocco sulle note ripetute
   e ridurre il cooldown per permettere note veloci
============================================================ */
// Riduci il cooldown globale (dichiaralo in cima se non lo trovi, o modificalo)
// const playCooldown = 50; // Mettilo a 50ms o anche 30ms invece di 150

/* ============================================================
   MODIFICA 1: Rimuovere il blocco sulle note ripetute
   e ridurre il cooldown per permettere note veloci
============================================================ */
// Riduci il cooldown globale (dichiaralo in cima se non lo trovi, o modificalo)
// const playCooldown = 50; // Mettilo a 50ms o anche 30ms invece di 150

function playMidiIfSelected(midi, time) {
    if (!midi || typeof midi !== 'number') return;
    
    // Rimuoviamo il controllo "midi === lastPlayedMidi" per permettere
    // ribattuti (stessa nota suonata due volte di fila)
    const now = Date.now();
    // Usa un cooldown molto breve (es. 50ms) solo per evitare glitch audio estremi,
    // ma permetti di suonare tutto.
    if ((now - lastPlayTime) < 50) return; 

    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    
    // Trova l'elemento tasto
    let keyEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === midi) { keyEl = k; break; }
    }
    if (!keyEl) return;

    // Se il tasto non è selezionato (non fa parte della scala o non è attivo), usciamo.
    // NOTA: Se vuoi che suoni SEMPRE anche se non evidenziato, commenta questa riga:
    if (!keyEl.classList.contains('selectedKey')) return;

    try {
        // Logica MIDI Out
        if (midiEnabled && midiOutput) {
            // Nota: Se è la STESSA nota di prima, il synth potrebbe aver bisogno
            // di un NoteOff prima del nuovo NoteOn se è monofonico, 
            // ma per ora mandiamo il NoteOn diretto per ribattere.
            playMidiNote(midi);
            
            lastPlayedMidi = midi;
            lastPlayTime = now;
            
            // Highlight visivo transitorio
            try { 
                keyEl.classList.add('playingKey'); 
                setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150); 
            } catch(e){}
            return;
        }

        // Logica Sample (Audio interno)
        if (!samplePlayer || !samplePlayer.buffer) return;
        
        // Qui forziamo il play anche se la nota è la stessa
        playSampleAtMidi(midi, time);
        
        lastPlayedMidi = midi;
        lastPlayTime = now;
        
        // Highlight visivo
        try { 
            keyEl.classList.add('playingKey'); 
            setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150); 
        } catch(e){}
        
    } catch (e) {
        console.warn('Error playing note', e);
    }
}

// Try to play the requested midi. If that key is not user-selected, find the
// nearest user-selected key (by midi distance) and play/highlight that instead.
function triggerPlayWithFallback(requestedMidi, time) {
    if (!requestedMidi || typeof requestedMidi !== 'number') return;
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;

    // find the direct key element
    let directEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === requestedMidi) { directEl = k; break; }
    }

    // if direct exists and is selected, play it
    if (directEl && directEl.classList.contains('selectedKey')) {
        playMidiIfSelected(requestedMidi, time);
        return;
    }

    // otherwise find nearest selected key by midi distance
    let nearest = null;
    let nearestDiff = Infinity;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (!k || !k.dataset) continue;
        if (!k.classList.contains('selectedKey')) continue; // must be user-selected
        const m = Number(k.dataset.midi);
        if (!Number.isFinite(m)) continue;
        const diff = Math.abs(m - requestedMidi);
        if (diff < nearestDiff) { nearestDiff = diff; nearest = k; }
    }

    if (nearest) {
        // play nearest selected
        try {
            const midi = Number(nearest.dataset.midi);
            // If MIDI output is enabled, send MIDI instead of playing sample
            if (midiEnabled && midiOutput) {
                playMidiNote(midi);
                // transient highlight
                try { nearest.classList.add('playingKey'); setTimeout(() => { try { nearest.classList.remove('playingKey'); } catch(e){} }, 220); } catch(e){}
                lastPlayedMidi = midi;
                lastPlayTime = Date.now();
                return;
            }

            // Otherwise only play if a one-shot sample is loaded (no synth fallback)
            if (!samplePlayer || !samplePlayer.buffer) return;
            playSampleAtMidi(midi, time);
            // transient highlight
            nearest.classList.add('playingKey');
            setTimeout(() => { try { nearest.classList.remove('playingKey'); } catch(e){} }, 220);
            lastPlayedMidi = midi;
            lastPlayTime = Date.now();
        } catch (e) { /* ignore */ }
    } else {
        // no selected key found — do nothing
    }
}

let xSpacing = 5; // global spacing for advanceHighlight

function createChart(canvasId, color, isPreview = false) {
    const chart = new Chart(document.getElementById(canvasId), {
        type: "line",
        data: {
            datasets: [{
                borderColor: color,
                borderWidth: 1.5,
                tension: 0.43,
                fill: true,
                backgroundColor: (ctx) => {
                    const chart = ctx.chart;
                    const {ctx: c, chartArea} = chart;
                    if (!chartArea) return resolveColorToRgba(COLOR_MAP[color] || color, 0.13);
                    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    const base = COLOR_MAP[color] || color;
                    g.addColorStop(0, resolveColorToRgba(base, 0.2));
                    g.addColorStop(0.6, resolveColorToRgba(base, 0.1));
                    g.addColorStop(1, resolveColorToRgba(base, 0));
                    return g;
                },
                // pointRadius is scriptable so we can highlight the current index
                pointRadius: 0, // Nascosto - usiamo solo i pallini originali
                pointBackgroundColor: 'rgba(0,0,0,0)',
                pointBorderColor: 'rgba(0,0,0,0)',
                hoverRadius: 0
            }]  
        },
        options: {
            animation: false,
            interaction: { mode: 'nearest', intersect: false },
            maintainAspectRatio: false,
            layout: { padding: 10 },

            scales: {
                x: {
                    type: "time",
                    time: {
                        tooltipFormat: "yyyy-MM-dd HH:mm",
                        displayFormats: {
                            hour: "HH:mm",
                            minute: "HH:mm"
                        }
                    },
                    display: false,
                    ticks: {
                        maxTicksLimit: 5,
                        color: '#64748b',
                        font: { family: 'Space Mono, monospace', size: 11 }
                    },
                    grid: { display: false, color: 'transparent' }
                },

                y: {
                    display: false,
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Space Mono, monospace', size: 11 }
                    },
                    grid: { display: false, color: 'rgba(2,6,23,0.04)', borderDash: [4,4] }
                }
            },

            plugins: {
                legend: { display: false },

                tooltip: {
                    // Enable tooltips only for the preview chart (isPreview === true)
                    enabled: !!isPreview,
                    mode: 'nearest',
                    intersect: false,
                    backgroundColor: 'rgba(2,6,23,0.85)',
                    titleFont: { family: 'Space Mono, monospace', size: 12, weight: '700' },
                    bodyFont: { family: 'Space Mono, monospace', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label || ''}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(2) : '-'}`
                    }
                },

                // enable our custom plugins with light options
                lineShadow: { blur: 8, offsetY: 2 },
                verticalLine: {},
                horizontalSections: isPreview ? {} : false,
                dataPointLines: isPreview ? {} : false
            }
        }
    });


    
    // mark preview chart for horizontal sections rendering
    if (isPreview) chart.isHorizontalSections = true;
    
    return chart;
}

/* ============================================================
   3) CREA I 3 GRAFICI
============================================================ */
// Stato globale per l'evidenziazione: dichiarato prima della creazione dei grafici
let highlightIndex = -1;
let highlightTimer = null;
let highlightSpeed = 750; // ms di default (80 BPM = 750ms)
let quantizeTimer = null; // timer per aggiornare evidenziazione tastiera
let highlightIndexTime = -1; // timestamp dell'ultimo highlight
let transportLoopId = null; // ID del loop schedulato su Transport per il cursore
let originalPointIndices = []; // Indici interpolati che corrispondono ai punti originali
let currentOriginalPointIndex = -1; // Indice corrente nell'array originalPointIndices
let lastProcessedOriginalPointIndex = -1; // Track last original point that was actually played

const chartTemp = createChart("chartTemp", "red");
const chartDens = createChart("chartDens", "orange");
const chartVel  = createChart("chartVel",  "green");
let selectedChartSource = 'Temp';

// Preview chart (mostrato a destra della keyboard-box)
let chartPreview = null;
function ensurePreviewChart() {
    if (chartPreview) return;
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;
    // ensure canvas dimensions match keyboard before creating the Chart instance
    syncPreviewHeight();
    chartPreview = createChart('chartPreview', 'green', true);
    // small initial dataset
    chartPreview.data.datasets[0].data = [];
    chartPreview.update('none');
    // wire mouse events (minimal) for preview canvas
    attachPreviewMouseTracking();
}

function updateChartSelectionUI() {
    const boxes = document.querySelectorAll('.chart-box');
    boxes.forEach(box => {
        const src = box.getAttribute('data-chart-source');
        if (src === selectedChartSource) box.classList.add('chart-selected');
        else box.classList.remove('chart-selected');
    });
}

function setSelectedChart(source) {
    selectedChartSource = source || 'Temp';
    updateChartSelectionUI();
    updatePreview(selectedChartSource);


}

function updatePreview(param = selectedChartSource) {
    ensurePreviewChart();
    if (!chartPreview) return;
    let src = chartVel;
    if (param === 'Temp') src = chartTemp;
    else if (param === 'Dens') src = chartDens;
    else if (param === 'Vel') src = chartVel;

    // copy dataset (shallow copy is fine)
    const srcDs = src.data.datasets[0];
    chartPreview.data.datasets[0].data = srcDs.data.slice();
    chartPreview.data.datasets[0].borderColor = srcDs.borderColor;
    chartPreview.data.datasets[0].backgroundColor = srcDs.backgroundColor;
    chartPreview.data.datasets[0].label = srcDs.label;

    // ensure plugin knows which Y-values to draw dots for the preview
    if (param === 'Temp') window.originalDataYs = window.originalDataTemp || [];
    else if (param === 'Dens') window.originalDataYs = window.originalDataDens || [];
    else if (param === 'Vel')  window.originalDataYs = window.originalDataVel || [];

    // Enable preview drawing of original points (so points are already at their place when you select)
    chartPreview.options.plugins.dataPointLines = {};
    try { chartPreview.update('none'); } catch (e) {}
}

function attachPreviewMouseTracking() {
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;
    // We intentionally do NOT track mouse movement for playback.
    // Mouse-based highlighting and sound have been removed per user request.

    // retain click for potential future interactions (no-op for now)
    canvas.addEventListener('click', (evt) => {});
}

// When the moving marker (highlightIndex) advances, detect original data points
// whose X is close to the marker and highlight/play them accordingly.
/* ============================================================
   MODIFICA 2: Logica deterministica basata sugli indici originali
============================================================ */
function processMovingDotForIndex(idx, time) {
    try {
        // Se non abbiamo dati o indici mappati, esci
        if (!window.originalDataXs || !window.originalDataXs.length) return;
        
        // Se stiamo usando la modalità "Precisa" (originalPointIndices esiste),
        // allora 'idx' È GIÀ l'indice esatto del punto. Non serve calcolare distanze.
        if (originalPointIndices && originalPointIndices.length > 0) {
            
            // Recupera il dato Y (Temp, Dens o Vel a seconda di cosa visualizzi)
            // Nota: window.originalDataYs viene settato in updateCharts/updatePreview
            const ys = window.originalDataYs || window.originalDataTemp || [];
            
            // Dobbiamo trovare a QUALE punto originale corrisponde questo indice interpolato 'idx'.
            // Poiché in advanceHighlight usiamo 'currentOriginalPointIndex', possiamo usare quello
            // se è sincronizzato, oppure cercare l'indice.
            // Per sicurezza, usiamo l'indice corrente tracciato in advanceHighlight:
            const dataIndex = currentOriginalPointIndex; 
            
            if (dataIndex >= 0 && dataIndex < ys.length) {
                // Controllo anti-doppione: suona solo se è un punto nuovo rispetto all'ultimo processato
                if (dataIndex !== lastProcessedOriginalPointIndex) {
                    
                    const yVal = ys[dataIndex];
                    
                    if (Number.isFinite(yVal)) {
                        lastProcessedOriginalPointIndex = dataIndex; // Segna come suonato

                        // --- Calcolo MIDI (Copied from original logic) ---
                        let minY, maxY;
                        if (chartPreview && chartPreview.scales && chartPreview.scales.y) {
                            minY = chartPreview.scales.y.min;
                            maxY = chartPreview.scales.y.max;
                        } else {
                            const numericYs = ys.filter(v => Number.isFinite(v));
                            minY = numericYs.length ? Math.min(...numericYs) : 0;
                            maxY = numericYs.length ? Math.max(...numericYs) : 100;
                        }

                        let midi = 48;
                        if (maxY !== minY) {
                            const ratio = (yVal - minY) / (maxY - minY);
                            midi = Math.round(48 + ratio * (83 - 48));
                            midi = Math.max(48, Math.min(83, midi));
                        }

                        // --- Highlight e Play ---
                        const keyboard = document.getElementById('verticalKeyboard');
                        if (keyboard) {
                            // Rimuovi vecchi highlight quantizzati
                            for (let k = 0; k < keyboard.children.length; k++) {
                                keyboard.children[k].classList.remove('quantizedKey');
                            }
                            
                            // Trova e attiva il tasto
                            for (let k = 0; k < keyboard.children.length; k++) {
                                const el = keyboard.children[k];
                                if (el && el.dataset && Number(el.dataset.midi) === midi) {
                                    el.classList.add('quantizedKey');
                                    
                                    // SUONA ORA SOLO SE LA RIPRODUZIONE È ATTIVA
                                    // Usa triggerPlayWithFallback che gestisce la logica 
                                    // "suona solo se selezionato" o "trova il più vicino"
                                    try {
                                        if (isPlaying) triggerPlayWithFallback(midi, time);
                                    } catch(e) { /* noop */ }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            return; // Fine logica precisa
        }

        // ... Qui sotto rimarrebbe la logica vecchia "fallback" per interpolazione pura
        // se originalPointIndices non fosse disponibile, ma nel tuo caso lo è sempre dopo il fetch.
        
    } catch (e) {
        console.warn("Errore process audio:", e);
    }
}

function getKeyIndexFromY(y) {
    // map Y position in preview canvas to a key index
    const canvas = document.getElementById('chartPreview');
    const rect = canvas.getBoundingClientRect();
    const canvasHeight = rect.height;
    
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return -1;
    const numKeys = keyboard.children.length;
    
    const sectionHeight = canvasHeight / numKeys;
    let keyIndex = Math.floor(y / sectionHeight);
    
    // clamp to valid range
    keyIndex = Math.max(0, Math.min(numKeys - 1, keyIndex));
    return keyIndex;
}

function getKeyIndexFromValue(value, maxValue, minValue) {
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return -1;
    const numKeys = keyboard.children.length;
    // map value range to key index
    const clampedValue = Math.max(minValue, Math.min(maxValue, value));
    const ratio = (clampedValue - minValue) / (maxValue - minValue);
    let keyIndex = Math.floor(ratio * numKeys);
    // clamp to valid range
    keyIndex = Math.max(0, Math.min(numKeys - 1, keyIndex));
    return keyIndex;

}

// Wire select change
document.addEventListener('DOMContentLoaded', () => {
    const chartBoxes = document.querySelectorAll('.chart-box');
    chartBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const src = box.getAttribute('data-chart-source');
            if (src) setSelectedChart(src);
        });
    });

    // initialize preview and selection (default Temp)
    setSelectedChart(selectedChartSource);
    
    // ensure preview height matches keyboard
    syncPreviewHeight();
    setupPreviewKeyboardSync();

    // ============================================================
    // DRAG AND DROP SYSTEM FOR CHARTS TO KNOBS
    // ============================================================
    
    // Oggetto per tracciare le assegnazioni knob -> grafico
    const knobAssignments = {};
    window.knobAssignments = knobAssignments; // Esponi globalmente
    let draggedChart = null;

    // Funzione per aggiornare la corona colorata della knob
    function updateKnobVisual(knobElement, chartSource) {
        // Trova il parent effect-param
        const effectParam = knobElement.closest('.effect-param');
        if (!effectParam) return;
        
        // Rimuovi tutte le classi di assegnazione precedenti
        effectParam.classList.remove('assigned-temp', 'assigned-dens', 'assigned-vel');
        
        // Aggiungi la classe appropriata in base al grafico
        if (chartSource === 'Temp') {
            effectParam.classList.add('assigned-temp');
        } else if (chartSource === 'Dens') {
            effectParam.classList.add('assigned-dens');
        } else if (chartSource === 'Vel') {
            effectParam.classList.add('assigned-vel');
        }
    }

    // Funzione per ottenere il valore normalizzato (0-100%) di un grafico a un indice specifico
    function getNormalizedChartValue(chartSource, index) {
        let chart;
        if (chartSource === 'Temp') {
            chart = chartTemp;
        } else if (chartSource === 'Dens') {
            chart = chartDens;
        } else if (chartSource === 'Vel') {
            chart = chartVel;
        } else {
            return null;
        }

        const data = chart.data.datasets[0].data;
        if (!data || data.length === 0 || index < 0 || index >= data.length) {
            return null;
        }

        // Trova min e max dell'intero dataset per normalizzare
        const values = data.map(d => d.y).filter(v => Number.isFinite(v));
        if (values.length === 0) return null;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Ottieni il valore corrente all'indice
        const currentValue = data[index].y;
        if (!Number.isFinite(currentValue)) return null;
        
        // Normalizza tra 0 e 100%
        if (max === min) return 50; // Se tutti i valori sono uguali, ritorna 50%
        return ((currentValue - min) / (max - min)) * 100;
    }

    // Funzione per aggiornare il valore di una knob in base al grafico assegnato e all'indice corrente
    function updateKnobFromChart(knobId, chartSource, index) {
        if (typeof index === 'undefined' || index === null) index = highlightIndex;
        if (index < 0) return;

        const normalizedValue = getNormalizedChartValue(chartSource, index);
        if (normalizedValue === null) return;

        const knobElement = document.getElementById(knobId);
        if (!knobElement) return;

        // Mappa globale per tenere traccia dell'angolo corrente delle knob (evita salti)
        window.knobAngles = window.knobAngles || {};
        const minAngle = -135;
        const maxAngle = 135;
        const targetAngle = minAngle + (normalizedValue / 100) * (maxAngle - minAngle);

        // Se non presente, inizializza l'angolo corrente vicino al target per evitare "salti"
        if (typeof window.knobAngles[knobId] !== 'number') {
            // prova a leggere dal transform inline, altrimenti usa target
            const m = (knobElement.style.transform || '').match(/-?\d+\.?\d*/);
            window.knobAngles[knobId] = m ? parseFloat(m[0]) : targetAngle;
        }

        animateKnobRotation(knobId, knobElement, targetAngle, 150);
        animateEffectParameter(knobId, normalizedValue, 150);
    }

    // Anima la rotazione della knob con easing morbido
    function animateKnobRotation(knobId, knobElement, targetAngle, duration = 150) {
        const startAngle = window.knobAngles && typeof window.knobAngles[knobId] === 'number'
            ? window.knobAngles[knobId]
            : targetAngle;
        const startTime = performance.now();

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            // easing: easeInOutCubic
            const p = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const current = startAngle + (targetAngle - startAngle) * p;
            knobElement.style.transform = `rotate(${current}deg)`;
            window.knobAngles[knobId] = current;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // Anima il parametro dell'effetto per evitare step bruschi
    function animateEffectParameter(knobId, targetValue, duration = 150) {
        window.effectParamValues = window.effectParamValues || {};
        const startValue = (typeof window.effectParamValues[knobId] === 'number')
            ? window.effectParamValues[knobId]
            : targetValue;
        const startTime = performance.now();

        const tick = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const p = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const current = startValue + (targetValue - startValue) * p;
            window.effectParamValues[knobId] = current;
            updateEffectParameter(knobId, current);
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // Funzione per aggiornare i parametri degli effetti
    function updateEffectParameter(knobId, value) {
        // Mappa dei knobId ai parametri degli effetti
        const paramMap = {
            'reverbDecayKnob': () => reverb.decay = (value / 100) * 10,
            'reverbWetKnob': () => reverb.wet.value = value / 100,
        };

        if (paramMap[knobId]) {
            paramMap[knobId]();
        }
    }

    // Setup drag events sui chart-box
    chartBoxes.forEach(box => {
        box.addEventListener('dragstart', (e) => {
            draggedChart = box.getAttribute('data-chart-source');
            box.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', draggedChart);
            
            // Illumina tutte le knob non assegnate a questo grafico
            const allKnobs = document.querySelectorAll('.effect-knob, .knob');
            allKnobs.forEach(knob => {
                const knobId = knob.id;
                if (!knobAssignments[knobId] || knobAssignments[knobId] !== draggedChart) {
                    knob.classList.add('glow-available');
                } else {
                    knob.classList.add('glow-assigned');
                }
            });
        });

        box.addEventListener('dragend', (e) => {
            box.classList.remove('dragging');
            draggedChart = null;
            
            // Rimuovi glow da tutte le knob
            const allKnobs = document.querySelectorAll('.effect-knob, .knob');
            allKnobs.forEach(knob => {
                knob.classList.remove('glow-available');
                knob.classList.remove('glow-assigned');
            });
        });
    });

    // Setup drop zone su tutte le knobs
    const allKnobs = document.querySelectorAll('.effect-knob, .knob');
    allKnobs.forEach(knob => {
        knob.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            knob.classList.add('drag-over');
        });

        knob.addEventListener('dragleave', (e) => {
            knob.classList.remove('drag-over');
        });

        knob.addEventListener('drop', (e) => {
            e.preventDefault();
            knob.classList.remove('drag-over');
            knob.classList.remove('glow-available');
            knob.classList.remove('glow-assigned');
            
            const chartSource = e.dataTransfer.getData('text/plain');
            const knobId = knob.id;
            
            if (chartSource && knobId) {
                // Salva l'assegnazione
                knobAssignments[knobId] = chartSource;
                
                // Aggiorna la visualizzazione della knob
                updateKnobVisual(knob, chartSource);
                
                // Aggiorna il valore della knob
                updateKnobFromChart(knobId, chartSource);
            }
        });
    });

    // Funzione per aggiornare tutte le knob assegnate quando i dati cambiano o l'indice avanza
    function updateAllAssignedKnobs(index) {
        // Se non è specificato un indice, usa highlightIndex globale
        if (typeof index === 'undefined' || index === null) {
            index = highlightIndex;
        }
        
        Object.keys(knobAssignments).forEach(knobId => {
            const chartSource = knobAssignments[knobId];
            updateKnobFromChart(knobId, chartSource, index);
        });
    }

    // Aggiungi l'aggiornamento al ciclo di fetch dei dati
    // Questa funzione verrà chiamata ogni volta che i dati vengono aggiornati
    window.updateAllAssignedKnobs = updateAllAssignedKnobs;

    // ============================================================
    // MODE SWITCH: PRESETS vs MIDI (mutually exclusive)
    // ============================================================
    const modePresetsBtn = document.getElementById('modePresetsBtn');
    const modeMidiBtn = document.getElementById('modeMidiBtn');
    const modePresetsPanel = document.getElementById('modePresetsPanel');
    const modeMidiPanel = document.getElementById('modeMidiPanel');

    function setMode(mode) {
        const isPresets = mode === 'presets';

        // Toggle button active state
        modePresetsBtn.classList.toggle('active', isPresets);
        modePresetsBtn.setAttribute('aria-selected', String(isPresets));
        modeMidiBtn.classList.toggle('active', !isPresets);
        modeMidiBtn.setAttribute('aria-selected', String(!isPresets));

        // Show/hide panels
        modePresetsPanel.style.display = isPresets ? 'block' : 'none';
        modeMidiPanel.style.display = isPresets ? 'none' : 'block';

        // Mutual exclusivity: deactivate the other function
        try {
            if (isPresets) {
                // Disable MIDI
                if (typeof midiEnabled !== 'undefined') midiEnabled = false;
                const statusEl = document.getElementById('midiStatus');
                if (statusEl) statusEl.textContent = 'MIDI: inattivo';
            } else {
                // Disable Sample Presets
                if (typeof samplePlayer !== 'undefined') samplePlayer = null;
                if (typeof sampleLoadedName !== 'undefined') sampleLoadedName = null;
                const status = document.getElementById('sampleStatus');
                if (status) status.textContent = 'Sample Mode: no sample';
            }
        } catch (e) {
            console.warn('Mode exclusivity update warning:', e);
        }
    }

    if (modePresetsBtn && modeMidiBtn) {
        modePresetsBtn.addEventListener('click', () => setMode('presets'));
        modeMidiBtn.addEventListener('click', () => setMode('midi'));
        // default to presets
        setMode('presets');
    }

    // ============================================================
    // CONTEXT MENU per rimuovere l'assegnazione grafico-knob
    // ============================================================
    
    const contextMenu = document.getElementById('knobContextMenu');
    const removeControlItem = document.getElementById('removeControl');
    let contextMenuKnob = null;

    // Funzione per rimuovere l'assegnazione di un grafico da una knob
    function removeKnobAssignment(knobId) {
        if (!knobId || !knobAssignments[knobId]) return;
        
        // Rimuovi l'assegnazione
        delete knobAssignments[knobId];
        
        // Rimuovi la classe colorata dalla label
        const knobElement = document.getElementById(knobId);
        if (knobElement) {
            const effectParam = knobElement.closest('.effect-param');
            if (effectParam) {
                effectParam.classList.remove('assigned-temp', 'assigned-dens', 'assigned-vel');
            }
        }
    }

    // Aggiungi event listener per click destro su tutte le knob
    allKnobs.forEach(knob => {
        knob.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            const knobId = knob.id;
            
            // Mostra il menu solo se la knob ha un'assegnazione
            if (knobId && knobAssignments[knobId]) {
                contextMenuKnob = knobId;
                
                // Posiziona il menu alla posizione del mouse
                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.style.display = 'block';
            }
        });
    });

    // Click sul menu item "Remove Control"
    removeControlItem.addEventListener('click', () => {
        if (contextMenuKnob) {
            removeKnobAssignment(contextMenuKnob);
            contextMenuKnob = null;
        }
        contextMenu.style.display = 'none';
    });

    // Chiudi il menu quando si clicca altrove
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            contextMenuKnob = null;
        }
    });

    // Chiudi il menu quando si scorre
    document.addEventListener('scroll', () => {
        contextMenu.style.display = 'none';
        contextMenuKnob = null;
    });

    // ============================================================
    // END CONTEXT MENU
    // ============================================================

    // ============================================================
    // END DRAG AND DROP SYSTEM
    // ============================================================

    // --- Initialize MIDI Output ---
    try {
        initMidiAccess().then(midiAccess => {
            const selectEl = document.getElementById('midiOutputSelect');
            const toggleBtn = document.getElementById('midiToggleBtn');
            const statusEl = document.getElementById('midiStatus');
            
            if (selectEl && toggleBtn) {
                selectEl.addEventListener('change', (e) => {
                    const selectedId = e.target.value;
                    if (selectedId && midiAccess) {
                        midiOutput = midiAccess.outputs.get(selectedId);
                        if (midiOutput) {
                            if (statusEl) statusEl.textContent = `MIDI: ${midiOutput.name} selezionato`;
                            toggleBtn.disabled = false;
                        }
                    } else {
                        midiOutput = null;
                        midiEnabled = false;
                        toggleBtn.textContent = 'Attiva MIDI';
                        toggleBtn.disabled = true;
                        if (statusEl) statusEl.textContent = 'MIDI: nessun dispositivo selezionato';
                    }
                });
                
                toggleBtn.addEventListener('click', () => {
                    if (!midiOutput) return;
                    
                    midiEnabled = !midiEnabled;
                    if (midiEnabled) {
                        toggleBtn.textContent = 'Disattiva MIDI';
                        if (statusEl) statusEl.textContent = `MIDI: attivo → ${midiOutput.name}`;
                        toggleBtn.style.background = 'rgba(52, 211, 153, 0.2)';
                        toggleBtn.style.color = '#34d399';
                        toggleBtn.style.borderColor = 'rgba(52, 211, 153, 0.6)';
                    } else {
                        toggleBtn.textContent = 'Attiva MIDI';
                        if (statusEl) statusEl.textContent = 'MIDI: disattivo';
                        toggleBtn.style.background = '';
                        toggleBtn.style.color = '';
                        toggleBtn.style.borderColor = '';
                        stopMidiNote();
                    }
                });
            }
        });
    } catch (e) {
        console.error('Failed to initialize MIDI:', e);
    }

    // --- Initialize audio effects ---
    try {
        // Ensure compressor/limiter exist first
        ensureToneStarted();
        
        // Create effects chain: Delay -> Chorus -> Distortion -> Reverb -> Volume -> Compressor -> Limiter -> Destination
        reverb = new Tone.Reverb({ decay: 1.5, wet: 0 }).connect(masterVolume);
        distortion = new Tone.Distortion({ distortion: 0, wet: 0 }).connect(reverb);
        chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).connect(distortion);
        delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.5, wet: 0 }).connect(chorus);
        
        // Set effects chain entry point
        effectsChain = delay;
    } catch (e) {
        console.error('Failed to initialize effects:', e);
    }

    // --- Effects knob controls ---
    try {
        // Distortion controls
        setupEffectKnob('distortionDriveKnob', (value) => {
            if (distortion) distortion.distortion = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('distortionToneKnob', (value) => {
            // Oversample quality: 'none', '2x', '4x'
            // Map 0-1 to quality levels (approximated with distortion curve)
            // For simplicity, we'll just adjust the distortion amount as a "tone" control
            if (distortion) distortion.distortion = Math.max(0, distortion.distortion) * (0.5 + value * 0.5);
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('distortionMixKnob', (value) => {
            if (distortion) distortion.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        // Chorus controls
        setupEffectKnob('chorusDepthKnob', (value) => {
            if (chorus) chorus.depth = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('chorusRateKnob', (value) => {
            // Map to frequency 0.1Hz - 10Hz
            if (chorus) chorus.frequency.value = 0.1 + value * 9.9;
        }, 0, (v) => `${(0.1 + v * 9.9).toFixed(1)} Hz`);
        
        setupEffectKnob('chorusMixKnob', (value) => {
            if (chorus) chorus.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        // Delay controls
        setupEffectKnob('delayTimeKnob', (value) => {
            // Map to delay time 0.01s - 1s
            if (delay) delay.delayTime.value = 0.01 + value * 0.99;
        }, 0, (v) => `${((0.01 + v * 0.99) * 1000).toFixed(0)} ms`);
        
        setupEffectKnob('delayFeedbackKnob', (value) => {
            // Feedback 0 - 0.9 (avoid runaway feedback)
            if (delay) delay.feedback.value = value * 0.9;
        }, 0, (v) => `${Math.round(v * 90)}%`);
        
        setupEffectKnob('delayMixKnob', (value) => {
            if (delay) delay.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        // Reverb controls
        setupEffectKnob('reverbDecayKnob', (value) => {
            // Decay time 0.1s - 10s
            if (reverb) reverb.decay = 0.1 + value * 9.9;
        }, 0, (v) => `${(0.1 + v * 9.9).toFixed(1)} s`);
        
        setupEffectKnob('reverbMixKnob', (value) => {
            if (reverb) reverb.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('reverbSizeKnob', (value) => {
            // PreDelay acts as "size" - map 0-0.1s
            if (reverb) reverb.preDelay = value * 0.1;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        // Toggle buttons (escludi il tasto EQ che è gestito separatamente)
        document.querySelectorAll('.effect-toggle').forEach(toggle => {
            // Salta il tasto eqToggleBtn poiché è gestito in initFilterControls
            if (toggle.id === 'eqToggleBtn') return;
            
            toggle.addEventListener('click', function() {
                this.classList.toggle('active');
                const effectName = this.getAttribute('data-effect');
                const isActive = this.classList.contains('active');
                
                // Update button text and state
                this.textContent = isActive ? 'ON' : 'OFF';
                
                // Enable/disable effect by setting wet to 0 or restoring last value
                switch(effectName) {
                    case 'distortion':
                        if (distortion) {
                            if (!isActive) {
                                distortion._lastWet = distortion.wet.value;
                                distortion.wet.value = 0;
                            } else {
                                distortion.wet.value = distortion._lastWet || 0.5;
                            }
                        }
                        break;
                    case 'chorus':
                        if (chorus) {
                            if (!isActive) {
                                chorus._lastWet = chorus.wet.value;
                                chorus.wet.value = 0;
                            } else {
                                chorus.wet.value = chorus._lastWet || 0.5;
                            }
                        }
                        break;
                    case 'delay':
                        if (delay) {
                            if (!isActive) {
                                delay._lastWet = delay.wet.value;
                                delay.wet.value = 0;
                            } else {
                                delay.wet.value = delay._lastWet || 0.5;
                            }
                        }
                        break;
                    case 'reverb':
                        if (reverb) {
                            if (!isActive) {
                                reverb._lastWet = reverb.wet.value;
                                reverb.wet.value = 0;
                            } else {
                                reverb.wet.value = reverb._lastWet || 0.5;
                            }
                        }
                        break;
                    // filters temporarily disabled
                }
            });
        });
    } catch (e) {
        console.error('Failed to setup effect knobs:', e);
    }

    // --- Sample UI wiring removed (one-shot loading from PC removed) ---
});

window.addEventListener('resize', () => {
    // keep preview height synced when window size changes
    syncPreviewHeight();
});


chartTemp.data.datasets[0].label = "Temperatura";
        chartDens.data.datasets[0].label = "Densità (protons/cm^3)";
        chartVel.data.datasets[0].label  = "Velocità (km/s)";
// Sincronizzazione tooltip / hover: solo verso il chart di preview abilitato (per evitare pallini sui mini-chart)
function attachSync(master, slaves) {
    const canvas = master.canvas;
    canvas.addEventListener('mousemove', (evt) => {
        const points = master.getElementsAtEventForMode(evt, 'nearest', { intersect: false });
        if (!points.length) return;
        const idx = points[0].index;

        // Non sincronizziamo il tooltip del preview quando si passa con il mouse sui mini-chart
        // (Vogliamo che il preview mostri data/ora solo quando si scorre direttamente sul preview stesso.)

        // Non impostiamo active elements sugli altri mini-chart per evitare effetti di hover che mostrano i pallini
    });

    canvas.addEventListener('mouseleave', () => {
        if (typeof chartPreview !== 'undefined' && chartPreview && chartPreview.tooltip && typeof chartPreview.tooltip.setActiveElements === 'function') {
            try { chartPreview.setActiveElements([]); chartPreview.tooltip.setActiveElements([]); chartPreview.update('none'); } catch(e){}
        }
    });
}

attachSync(chartTemp, [chartDens, chartVel]);
attachSync(chartDens, [chartTemp, chartVel]);
attachSync(chartVel, [chartTemp, chartDens]);

/* ============================================================
   4) FETCH + INTERPOLAZIONE + UPDATE
============================================================ */
async function updateCharts() {
    try {
        const url = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
        const raw = await (await fetch(url, { cache: "no-store" })).json();

        if (typeof raw[0][0] === "string") raw.shift();

        const pts = raw.map(r => ({
            t: new Date(r[0]),
            dens: Number(r[1]),
            vel:  Number(r[2]),
            temp: Number(r[3])
        })).filter(p => !isNaN(p.t));

        pts.sort((a,b) => a.t - b.t);



        // --- FILTRA SOLO GLI ULTIMI 60 MINUTI DEI DATI DISPONIBILI ---
        const ONE_HOUR = 60 * 60 * 1000;
        const maxTime = pts.length ? pts[pts.length - 1].t.getTime() : Date.now();
        const ptsUsed = pts.filter(p => p.t.getTime() >= maxTime - ONE_HOUR);



        const xs   = ptsUsed.map(p => p.t.getTime());
        const dens = ptsUsed.map(p => p.dens);
        const vel  = ptsUsed.map(p => p.vel);
        const temp = ptsUsed.map(p => p.temp);
        
        // store original data points for lines and dots in all charts
        window.originalDataXs = xs;
        window.originalDataTemp = temp;
        window.originalDataDens = dens;
        window.originalDataVel = vel;
        window.originalDataYs = temp; // default per preview

        // Interpolazione su 300 punti, clamp minX/maxX ai valori validi
        const NUM = 300;
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        // Evita minX == maxX (singolo punto)
        if (minX === maxX) maxX = minX + 1;
        // Genera newXs solo nel range dei dati
        const newXs = Array.from({length: NUM}, (_, i) =>
            minX + (i / (NUM - 1)) * (maxX - minX)
        ).filter(x => x >= minX && x <= maxX);

        // Interpolazione lineare
        const tempInterp = interpolateLinear(xs, temp, newXs);
        const densInterp = interpolateLinear(xs, dens, newXs);
        const velInterp  = interpolateLinear(xs, vel,  newXs);

        chartTemp.data.datasets[0].data = newXs.map((x, i) => ({ x, y: tempInterp[i] }));
        chartDens.data.datasets[0].data = newXs.map((x, i) => ({ x, y: densInterp[i] }));
        chartVel.data.datasets[0].data  = newXs.map((x, i) => ({ x, y: velInterp[i] }));

        // Trova gli indici interpolati più vicini ai punti originali
        originalPointIndices = [];
        for (let i = 0; i < xs.length; i++) {
            const originalX = xs[i];
            // Trova l'indice interpolato più vicino
            let closestIdx = 0;
            let minDist = Math.abs(newXs[0] - originalX);
            for (let j = 1; j < newXs.length; j++) {
                const dist = Math.abs(newXs[j] - originalX);
                if (dist < minDist) {
                    minDist = dist;
                    closestIdx = j;
                }
            }
            originalPointIndices.push(closestIdx);
        }

        chartTemp.update("none");
        chartDens.update("none");
        chartVel.update("none");

        // Aggiorna anche la preview chart se presente, per mantenerla sincronizzata con i nuovi dati
        updatePreview(selectedChartSource);

        // Aggiorna tutte le knob assegnate con i nuovi dati
        if (typeof window.updateAllAssignedKnobs === 'function') {
            window.updateAllAssignedKnobs();
        }

        realHighlightIndex = realHighlightIndex - xSpacing - 1;
        highlightIndex = realHighlightIndex;
        advanceHighlight(); // riavanza l'highlight alla nuova posizione

    } catch (e) {
        console.error("Errore fetching NOAA:", e);
    }
}


/* ============================================================
   5) AVVIO + AGGIORNA OGNI 60 SECONDI
============================================================ */
// ---------- Highlighting: stato e controlli ----------
// `highlightIndex` indica l'indice corrente evidenziato (o -1 nessuno)
    // `highlightIndex` indica l'indice corrente evidenziato (o -1 nessuno)

function isValidDataAt(chart, idx) {
    const d = chart.data.datasets[0].data[idx];
    return d && Number.isFinite(d.y);
}

function updateHighlightRender() {
    chartTemp.update("none");
    chartDens.update("none");
    chartVel.update("none");
    if (typeof chartPreview !== 'undefined' && chartPreview) {
        try { chartPreview.update("none"); } catch (e) {}
    }
}

let realHighlightIndex = -1;

function advanceHighlight(time) {
    const len = chartTemp.data.datasets[0].data.length;
    if (!len) return;

    // --- LOGICA (Calcolo indici) ---
    if (originalPointIndices && originalPointIndices.length > 0) {
        const prevIndex = currentOriginalPointIndex;
        currentOriginalPointIndex = (currentOriginalPointIndex + 1) % originalPointIndices.length;
        
        // If we wrapped around to the beginning, reset the processed points tracker
        if (prevIndex >= 0 && currentOriginalPointIndex === 0) {
            lastProcessedOriginalPointIndex = -1;
        }
        
        highlightIndex = originalPointIndices[currentOriginalPointIndex];
        realHighlightIndex = highlightIndex;
    } else {
        const originalCount = window.originalDataXs ? window.originalDataXs.length : 60;
        const skipPoints = Math.max(1, Math.round(len / originalCount));
        let next = highlightIndex + skipPoints;
        if (next >= len) {
            next = 0;
            // Reset when wrapping around
            lastProcessedOriginalPointIndex = -1;
        }
        highlightIndex = next;
        realHighlightIndex = next;
    }
    
    // --- AUDIO (Suona esattamente al 'time' previsto) ---
    currIdxTime = indexToTime(chartTemp, highlightIndex);
    
    if(currIdxTime !== highlightIndexTime) {
        highlightIndexTime = currIdxTime;
        // Passiamo 'time' alla catena di funzioni che generano il suono
        processMovingDotForIndex(highlightIndex, time);
        
        if (typeof window.updateAllAssignedKnobs === 'function') {
            window.updateAllAssignedKnobs(highlightIndex);
        }
    }

    // --- GRAFICA (Questa parte la avvolgiamo in Tone.Draw per fluidità video) ---
    Tone.Draw.schedule(() => {
        updateHighlightRender();
        // Log solo per debug grafico
        // console.log("realHighlightIndex:", realHighlightIndex); 
    }, time);
}

 
function startHighlighting(speedMs = 200) {
    highlightSpeed = speedMs;
    ensureToneStarted();
    
    // se i dati non sono ancora pronti, aspetta un po' e poi avvia
    if (!chartTemp.data.datasets[0].data.length) {
        realHighlightIndex = -1;
        highlightIndex = -1;
        // Use a simple timer to wait for data, then start Transport
        if (highlightTimer !== null) clearInterval(highlightTimer);
        highlightTimer = setInterval(() => {
            if (chartTemp.data.datasets[0].data.length) {
                clearInterval(highlightTimer);
                highlightTimer = 'transport'; // marker that we're using transport
                if (Tone.Transport.state !== 'started') {
                    Tone.Transport.start();
                }
            }
        }, 200);
        return;
    }

    // Start from -1 so first advance goes to 0 (first point)
    if (highlightIndex === -1 || realHighlightIndex === -1) {
        // Imposta a -1 così il primo tick del Transport porterà al primo punto
        currentOriginalPointIndex = -1;
        highlightIndex = -1;
        realHighlightIndex = -1;
        lastProcessedOriginalPointIndex = -1; // Reset processed points when starting fresh
    }
    
    // Mark that we're using Transport instead of setInterval
    highlightTimer = 'transport';
    
    // Start Tone.Transport (this will trigger both metronome and cursor)
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }
    
    console.log('Transport started, BPM:', Tone.Transport.bpm.value, 'Will start from first point');
}

function stopHighlighting() {
    // Stop Transport if it's running (pauses both metronome and cursor)
    if (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.state === 'started') {
        Tone.Transport.pause();
        console.log('Transport paused at position:', Tone.Transport.seconds);
    }
    
    if (highlightTimer && highlightTimer !== 'transport') { 
        clearInterval(highlightTimer);
    }
    if (quantizeTimer) {
        clearInterval(quantizeTimer);
        quantizeTimer = null;
    }
    highlightTimer = null;
    
    // Reset last processed point to allow replaying from start
    lastProcessedOriginalPointIndex = -1;
    
    // clear any auto-quantized highlights
    try {
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) for (let k = 0; k < keyboard.children.length; k++) keyboard.children[k].classList.remove('quantizedKey');
    } catch (e) {}
    // If MIDI is enabled, ensure last held note is turned off
    try {
        if (midiEnabled) stopMidiNote();
    } catch (e) {}
    updateHighlightRender();
}

function setHighlightSpeed(ms) {
    const wasRunning = (highlightTimer !== null);
    if (wasRunning) {
        stopHighlighting();
    }
    highlightSpeed = ms;
    if (wasRunning) {
        startHighlighting(ms);
    }
}

// Restituisce la chart selezionata (clic sulla chart)
function getSelectedChart() {
    const value = selectedChartSource || 'Temp';
    if (value === 'Temp') return { chart: chartTemp, label: 'Temperatura' };
    if (value === 'Dens') return { chart: chartDens, label: 'Densità' };
    return { chart: chartVel, label: 'Velocità' };
}

// Stampa in console il valore quantizzato (0..34) della chart selezionata
    // Stampa in console l'indice quantizzato (0..34) corrente della chart selezionata
    function logCurrentSelectedValue() {
        const q = quantizeCurrentSelectedValueToRange(35);
        if (q < 0) {
            console.log('Nessun punto evidenziato o quantizzazione non disponibile');
            return null;
        }
        console.log(`Quantizzato (0..34): ${q}`);
        return q;
}

// Ritorna solo il valore (numero) corrente della chart selezionata, o null
function getCurrentSelectedValue() {
    const { chart } = getSelectedChart();
    const idx = typeof highlightIndex === 'number' ? highlightIndex : -1;
    const ds = chart && chart.data && chart.data.datasets && chart.data.datasets[0];
    const data = ds ? ds.data : [];
    if (idx < 0 || !data || data.length === 0 || idx >= data.length) return null;
    const p = data[idx];
    if (!p || !Number.isFinite(p.y)) return null;
        const min = getSelectedChartMin();
        const max = getSelectedChartMax();
        return { value: p.y, min, max };
}

    // Minimo corrente (scala o dati) della chart selezionata
    function getSelectedChartMin() {
        const { chart } = getSelectedChart();
        if (!chart) return null;
        if (chart.scales && chart.scales.y && Number.isFinite(chart.scales.y.min)) return chart.scales.y.min;
        try {
            const ds = chart.data.datasets[0];
            const ys = (ds.data || []).map(p => (p && Number.isFinite(p.y)) ? p.y : null).filter(v => v != null);
            if (!ys.length) return null;
            return Math.min(...ys);
        } catch (e) { return null; }
    }

    // Massimo corrente (scala o dati) della chart selezionata
    function getSelectedChartMax() {
        const { chart } = getSelectedChart();
        if (!chart) return null;
        if (chart.scales && chart.scales.y && Number.isFinite(chart.scales.y.max)) return chart.scales.y.max;
        try {
            const ds = chart.data.datasets[0];
            const ys = (ds.data || []).map(p => (p && Number.isFinite(p.y)) ? p.y : null).filter(v => v != null);
            if (!ys.length) return null;
            return Math.max(...ys);
        } catch (e) { return null; }
    }

// Setup generic effect knob with drag interaction
function setupEffectKnob(knobId, callback, defaultValue = 0, valueFormatter = null) {
    const knob = document.getElementById(knobId);
    if (!knob) return;
    
    let isDragging = false;
    let startY = 0;
    let startValue = 0; // 0 to 1 range
    
    // Find the param-label element
    const effectParam = knob.closest('.effect-param');
    const paramLabel = effectParam ? effectParam.querySelector('.param-label') : null;
    let originalLabelText = paramLabel ? paramLabel.textContent : '';
    
    // Map knob rotation to effect value (0 -> 1)
    const updateKnobRotation = (value) => {
        // value: 0 to 1
        // rotation: -135deg to 135deg
        const angle = -135 + value * 270;
        knob.style.transform = `rotate(${angle}deg)`;
    };
    
    // Initialize at 0 (no effect)
    updateKnobRotation(0);
    
    // Double-click to reset to default
    knob.addEventListener('dblclick', (e) => {
        updateKnobRotation(defaultValue);
        callback(defaultValue);
        e.preventDefault();
    });
    
    knob.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        // Get current rotation to determine start value
        const transform = knob.style.transform;
        const match = transform.match(/rotate\(([^)]+)deg\)/);
        if (match) {
            const angle = parseFloat(match[1]);
            // Convert angle (-135 to 135) back to value (0 to 1)
            startValue = (angle + 135) / 270;
        } else {
            startValue = 0;
        }
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY; // Up is positive
        
        // Check if this knob has a chart assigned - use different sensitivity
        const hasChartAssigned = window.knobAssignments && window.knobAssignments[knobId];
        const sensitivity = hasChartAssigned ? 0.002 : 0.005; // More sensitive when chart assigned
        
        let newValue = startValue + (deltaY * sensitivity);
        newValue = Math.max(0, Math.min(1, newValue));
        
        updateKnobRotation(newValue);
        callback(newValue);
        
        // Update label with value only if no chart is assigned and formatter is provided
        if (!hasChartAssigned && paramLabel && valueFormatter) {
            paramLabel.textContent = valueFormatter(newValue);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
            // Restore original label text if no chart is assigned
            const hasChartAssigned = window.knobAssignments && window.knobAssignments[knobId];
            if (!hasChartAssigned && paramLabel) {
                paramLabel.textContent = originalLabelText;
            }
        }
    });
}

// Wiring dei controlli UI (knob + play/pause)
const speedKnobControl = document.getElementById('speedKnobControl');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
let isPlaying = false;

// Utility functions for BPM conversion
// BPM = 60000 / (ms per beat)
// ms per beat = 60000 / BPM
function msToBpm(ms) {
    return Math.round(60000 / ms);
}

function bpmToMs(bpm) {
    return Math.round(60000 / bpm);
}

// Knob logic
if (speedKnobControl) {
    let isDragging = false;
    let startY = 0;
    let startSpeed = highlightSpeed;
    // Min and max BPM: 80 - 190 BPM
    // 80 BPM = 750 ms per beat
    // 190 BPM = 316 ms per beat
    const minBpm = 80;
    const maxBpm = 190;
    const minSpeed = bpmToMs(maxBpm); // 190 BPM = ~316 ms (fastest)
    const maxSpeed = bpmToMs(minBpm); // 80 BPM = 750 ms (slowest)
    
    // Initial rotation based on current speed
    // Map speed (maxSpeed -> minSpeed) to rotation (-135 -> 135 degrees)

    const updateKnobRotation = (speed) => {
        const t = 1 - (speed - minSpeed) / (maxSpeed - minSpeed);
        const angle = -135 + t * 270;
        speedKnobControl.style.transform = `rotate(${angle}deg)`;
    };

    // --- NUOVO CODICE: EDITING MANUALE BPM ---
    if (speedValue) {
        speedValue.style.cursor = "pointer"; // Indica che è cliccabile
        speedValue.title = "Doppio click per inserire BPM";

        speedValue.addEventListener('dblclick', () => {
            // 1. Prendi il valore attuale (es. "120" da "120 BPM")
            const currentText = speedValue.textContent;
            const currentBpm = parseInt(currentText) || 120;

            // 2. Crea l'input al volo
            const input = document.createElement('input');
            input.type = 'number';
            input.value = currentBpm;
            
            // Stile inline per farlo sembrare integrato
            input.style.width = '50px';
            input.style.background = 'transparent';
            input.style.color = '#fbbf24'; // Stesso giallo del testo
            input.style.border = '1px solid #fbbf24';
            input.style.borderRadius = '4px';
            input.style.fontFamily = '"Space Mono", monospace';
            input.style.fontSize = '11px';
            input.style.textAlign = 'center';
            input.style.outline = 'none';

            // 3. Sostituisci il testo con l'input
            speedValue.textContent = ''; 
            speedValue.appendChild(input);
            input.focus();
            input.select(); // Seleziona tutto il numero per sovrascrittura rapida

            // Funzione per salvare e chiudere
            const commitBpm = () => {
                let newVal = parseInt(input.value);

                // Validazione: se non è un numero o è fuori range, usa i limiti
                if (isNaN(newVal)) newVal = currentBpm;
                newVal = Math.max(minBpm, Math.min(maxBpm, newVal));

                // Converti in millisecondi (logica inversa di msToBpm)
                const newMs = bpmToMs(newVal);

                // Aggiorna TUTTO il sistema (velocità, manopola, metronomo)
                setHighlightSpeed(newMs);
                updateKnobRotation(newMs); // Ruota la manopola visivamente
                updateMetronomeBPM(newVal);
                
                // Ripristina il testo
                speedValue.textContent = `${newVal} BPM`;
            };

            // Salva se premo invio
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    commitBpm();
                }
                // Annulla se premo Esc
                if (e.key === 'Escape') {
                    speedValue.textContent = `${currentBpm} BPM`;
                }
            });

            // Salva se clicco fuori (blur)
            input.addEventListener('blur', () => {
                commitBpm(); // Puoi commentare questa riga se preferisci che il blur annulli invece di salvare
            });
        });
    }
    
// Double-click to reset to default (120 BPM)
    speedKnobControl.addEventListener('dblclick', (e) => {
        // 500ms corrisponde esattamente a 120 BPM (60000 / 120 = 500)
        const defaultSpeed = 500; 
        
        setHighlightSpeed(defaultSpeed);
        updateKnobRotation(defaultSpeed);
        
        const bpm = msToBpm(defaultSpeed);
        
        // Aggiorna subito la scritta sotto la manopola
        if (speedValue) speedValue.textContent = `${bpm} BPM`;
        
        // Aggiorna il metronomo
        updateMetronomeBPM(bpm);
        
        e.preventDefault();
    });

    speedKnobControl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startSpeed = highlightSpeed;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        
        // Show tooltip
        //if (speedValue) speedValue.classList.add('visible');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY; // Up is positive
        const sensitivity = 2; // Pixels per ms change
        
        // Calculate new speed
        // Dragging up (positive delta) should decrease ms (faster = higher BPM)
        // Dragging down (negative delta) should increase ms (slower = lower BPM)
        let newSpeed = startSpeed - (deltaY * sensitivity);
        
        // Clamp values
        newSpeed = Math.max(minSpeed, Math.min(maxSpeed, newSpeed));
        newSpeed = Math.round(newSpeed);
        
        if (newSpeed !== highlightSpeed) {
            setHighlightSpeed(newSpeed);
            updateKnobRotation(newSpeed);
            const bpm = msToBpm(newSpeed);
            if (speedValue) speedValue.textContent = `${bpm} BPM`;
            // Update metronome BPM
            updateMetronomeBPM(bpm);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
            // Hide tooltip
            //if (speedValue) speedValue.classList.remove('visible');
        }
    });
}

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (!isPlaying) {
            startHighlighting(highlightSpeed);
            playPauseBtn.classList.add('playing');
            isPlaying = true;
        } else {
            stopHighlighting();
            playPauseBtn.classList.remove('playing');
            isPlaying = false;
        }
    });
}

// Reset button control
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        // Stop playback if playing
        if (isPlaying) {
            stopHighlighting();
            playPauseBtn.classList.remove('playing');
            isPlaying = false;
        }
        // Reset cursor to initial position
        highlightIndex = -1;
        realHighlightIndex = -1;
        highlightIndexTime = null;
        currIdxTime = null;
        currentOriginalPointIndex = -1;
        lastProcessedOriginalPointIndex = -1; // Reset processed points tracker
        
        // Reset Transport position to start
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            console.log('Transport position reset to 0');
        }
        
        updateHighlightRender();
        console.log('Cursor reset to initial position');
    });
}

// Metronome button control
const metronomeBtn = document.getElementById('metronomeBtn');
if (metronomeBtn) {
    metronomeBtn.addEventListener('click', () => {
        ensureToneStarted();
        metronomeEnabled = !metronomeEnabled;
        
        if (metronomeEnabled) {
            metronomeBtn.classList.add('active');
            console.log('Metronome enabled');
        } else {
            metronomeBtn.classList.remove('active');
            console.log('Metronome disabled');
        }
        // Il metronomo si attiva/disattiva solo, non avvia il Transport
        // Il Transport (e quindi il synth) parte solo con il pulsante Play
    });
}

// Record button control
const recordBtn = document.getElementById('recordBtn');
if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
        await ensureToneStarted();
        
        if (!isRecording) {
            // Start recording
            try {
                if (!recorder) {
                    recorder = new Tone.Recorder();
                    Tone.Destination.connect(recorder);
                }
                recorder.start();
                isRecording = true;
                recordBtn.classList.add('recording');
                console.log('Recording started');
            } catch (e) {
                console.error('Failed to start recording:', e);
            }
        } else {
            // Stop recording and download
            try {
                const recording = await recorder.stop();
                const url = URL.createObjectURL(recording);
                const anchor = document.createElement('a');
                anchor.download = 'sun-synth-recording.wav';
                anchor.href = url;
                anchor.click();
                URL.revokeObjectURL(url);
                
                isRecording = false;
                recordBtn.classList.remove('recording');
                console.log('Recording stopped and downloaded');
            } catch (e) {
                console.error('Failed to stop recording:', e);
            }
        }
    });
}

attachVolumeSlider();

/* ============================================================
   6) TASTIERA VERTICALE – 2 OTTAVE
============================================================ */

// Scale musicali di base (intervalli in semitoni dalla tonica)
const SCALES = {
  major:           [0, 2, 4, 5, 7, 9, 11],        // maggiore
  naturalMinor:    [0, 2, 3, 5, 7, 8, 10],        // minore naturale
  majorPentatonic: [0, 2, 4, 7, 9],               // pentatonica maggiore
  minorPentatonic: [0, 3, 5, 7, 10],              // pentatonica minore
  dorian:          [0, 2, 3, 5, 7, 9, 10]         // dorica
};


function drawVerticalKeyboard() {
    const keyboard = document.createElement('div');
    const container = document.getElementById('keyboardContainer') || document.querySelector('.keyboard-box');
    container.appendChild(keyboard);
    keyboard.classList.add('verticalKeyboardContainer');
    keyboard.id = 'verticalKeyboard';
    
    const whiteKeyHeight = 5;
    const blackKeyHeight = whiteKeyHeight * 0.6;

    const octaves = 3;
    for(let o = 0; o < octaves ; o++) {
        let key = createWhiteKey();
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createBlackKey());
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createBlackKey());
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createBlackKey());
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createBlackKey());
        keyboard.appendChild(createWhiteKey());
        keyboard.appendChild(createBlackKey());
        keyboard.appendChild(createWhiteKey());
    }
    // after building keyboard, sync preview height
    syncPreviewHeight();

    // assign MIDI numbers to keys: bottom -> C3 (48), top -> B5 (83)
    try {
        const keys = keyboard.children;
        const numKeys = keys.length;
        for (let i = 0; i < numKeys; i++) {
            // DOM order: 0 is top, last is bottom. We want bottom -> 48
            const midi = 48 + (numKeys - 1 - i);
            keys[i].dataset.midi = String(midi);
        }
    } catch (e) { /* noop */ }
}

function syncPreviewHeight() {
    // Match preview chart height to keyboard height, and width to container
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;

    const previewBox = canvas.closest('.preview-box');
    if (!previewBox) return;

    const kbCont = document.getElementById('keyboardContainer');
    const devicePR = window.devicePixelRatio || 1;

    // Determine keyboard rendered height
    let keyboardHeight = 0;
    if (kbCont) {
        // Use offsetHeight (rendered height). If empty, fallback to scrollHeight
        keyboardHeight = Math.max(kbCont.offsetHeight || 0, kbCont.scrollHeight || 0);
    } else {
        // Fallback to current preview height
        keyboardHeight = previewBox.clientHeight;
    }

    // Force preview box to the keyboard height
    try { previewBox.style.height = keyboardHeight + 'px'; } catch (e) {}

    // Compute canvas size inside the preview box padding
    const padding = 30; // total vertical padding (15 top + 15 bottom)
    const cssWidth = Math.max(200, Math.floor(previewBox.clientWidth - padding));
    const cssHeight = Math.max(100, Math.floor(previewBox.clientHeight - padding));

    try {
        canvas.width = Math.round(cssWidth * devicePR);
        canvas.height = Math.round(cssHeight * devicePR);
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
    } catch (e) {}

    if (chartPreview) {
        try { chartPreview.resize(); chartPreview.update('none'); } catch (e) {}
    }
}

// Observe keyboard/container size changes and resync preview
let __kbPreviewRO;
function setupPreviewKeyboardSync() {
    try {
        const kbCont = document.getElementById('keyboardContainer');
        if (!kbCont || typeof ResizeObserver === 'undefined') return;
        if (__kbPreviewRO) { try { __kbPreviewRO.disconnect(); } catch (_) {} }
        __kbPreviewRO = new ResizeObserver(() => {
            syncPreviewHeight();
        });
        __kbPreviewRO.observe(kbCont);
    } catch (e) { /* noop */ }
}

function createWhiteKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('white');
    key.style.cursor = 'pointer';
    key.onclick = () => { highlightKey(Array.from(key.parentNode.children).indexOf(key)); };
    // Visual hover: add/remove hoveredKey when mouse enters/leaves
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
    // Press feedback for mouse and touch (pointer events)
    key.addEventListener('pointerdown', () => { key.classList.add('pressedKey'); });
    key.addEventListener('pointerup', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointercancel', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointerleave', () => { key.classList.remove('pressedKey'); });
    return key;
}  

function createBlackKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('black');
    key.style.cursor = 'pointer';
    key.onclick = () => { highlightKey(Array.from(key.parentNode.children).indexOf(key)); };
    // Visual hover: add/remove hoveredKey when mouse enters/leaves
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
    // Press feedback for mouse and touch (pointer events)
    key.addEventListener('pointerdown', () => { key.classList.add('pressedKey'); });
    key.addEventListener('pointerup', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointercancel', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointerleave', () => { key.classList.remove('pressedKey'); });
    return key;
}  

function highlightKey(i) {
    const keyboard = document.getElementById('verticalKeyboard');
    const keys = keyboard.children;
    keys[i].classList.toggle('selectedKey');
}

function applyScaleToKeyboard() {
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    
    const keys = keyboard.children;
    const numKeys = keys.length;

    // 1. Recupera la scala scelta
    const scaleSelect = document.getElementById('scaleSelect');
    const scaleName = scaleSelect ? scaleSelect.value : '';

    // 2. Recupera la nota fondamentale (Root) scelta (0=C, 1=C#, ecc.)
    const rootNoteSelect = document.getElementById('rootNoteSelect');
    // Se non esiste ancora il selettore, usa 0 (Do) come default
    const rootValue = rootNoteSelect ? parseInt(rootNoteSelect.value) : 0; 

    // Pulisce le vecchie evidenziazioni
    for (let i = 0; i < numKeys; i++) {
        keys[i].classList.remove('scaleKey');
        keys[i].classList.remove('selectedKey');
    }

    // Se non è selezionata nessuna scala valida, esci
    if (!scaleName || !SCALES[scaleName]) return;

    const intervals = SCALES[scaleName];

    // Evidenzia le note corrette
    for (let i = 0; i < numKeys; i++) {
        const keyEl = keys[i];
        const midi = Number(keyEl.dataset.midi);
        
        if (!Number.isFinite(midi)) continue;

        // Calcolo: (NotaMidi - RootScelta + 12) % 12 ci dice l'intervallo relativo
        const noteClass = midi % 12;
        const intervalFromRoot = (noteClass - rootValue + 12) % 12;

        if (intervals.includes(intervalFromRoot)) {
            keyEl.classList.add('scaleKey');
            keyEl.classList.add('selectedKey');
        }
    }
}


function quantizeHighlightToKey() {
    const keyboard = document.getElementById('verticalKeyboard');
    const keys = keyboard.children;
    
    const numKeys = keys.length;
    if (numKeys === 0) return;

    const { chart } = getSelectedChart();
    const dataLen = chart.data.datasets[0].data.length;
    if (dataLen === 0) return;

    // Ottengo il valore Y corrente evidenziato
    maxValue = getSelectedChartMax();
    minValue = getSelectedChartMin();
    if (maxValue === null || minValue === null) return;
    const key = getKeyIndexFromValue(chart.data.datasets[0].data[highlightIndex] ? chart.data.datasets[0].data[highlightIndex].y : 0, maxValue, minValue);

    // rimuovi solo la classe di quantizzazione precedente (non rimuovere le selezioni utente)
    for (let k = 0; k < keys.length; k++) {
        keys[k].classList.remove('quantizedKey');
    }

    // Aggiungi indicazione di quantizzazione (classe separata) alla chiave calcolata
    if (key >= 0 && key < numKeys) {
        // DOM order: 0 is top, last is bottom. getKeyIndexFromValue returns 0..numKeys-1 with 0=minimum value (bottom),
        // so convert to DOM index by mirroring
        const target = keys[numKeys - 1 - key];
        if (target) {
            target.classList.add('quantizedKey');
            // se la key è stata selezionata dall'utente, suona la nota corrispondente
            try {
                if (target.classList.contains('selectedKey')) {
                    const midi = Number(target.dataset.midi);
                    if (Number.isFinite(midi)) playMidiIfSelected(midi, time);
                }
            } catch (e) { console.log("Error triggering quantized play:", e);}
        }
    }


}

function indexToTime(chart, idx) {
    const point = chart.data.datasets[0].data[idx];

    // --- ACCESSO AL TEMPO (X) ---
    if (point) {
        const date = new Date(point.x);
        // Formatta in HH:mm
        const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return timeStr;
    }

}



// Disegno al load
drawVerticalKeyboard();

// Avviare l'aggiornamento dei grafici ogni 60s (resta manuale l'evidenziazione)
updateCharts();
setInterval(updateCharts, 60_000);

// Select dei preset di one-shot
const presetSelect = document.getElementById('presetSampleSelect');
if (presetSelect) {
  presetSelect.addEventListener('change', (e) => {
    const name = e.target.value;
    const status = document.getElementById('sampleStatus');

    if (!name) {
      // torna a "nessun sample"
      samplePlayer = null;
      sampleLoadedName = null;
            if (status) status.textContent = 'Sample mode: no sample';
      return;
    }

    loadPresetSample(name);
  });

    // Se al load c'è già una selezione (es. default Halo), caricala
    if (presetSelect.value) {
        try { loadPresetSample(presetSelect.value); } catch (e) { console.warn('Preset autoload failed', e); }
    }
}


// Listener cambio SCALA
const scaleSelectEl = document.getElementById('scaleSelect');
if (scaleSelectEl) {
    scaleSelectEl.addEventListener('change', () => {
        applyScaleToKeyboard();
    });
}

// Listener cambio NOTA (Root)
const rootNoteSelectEl = document.getElementById('rootNoteSelect');
if (rootNoteSelectEl) {
    rootNoteSelectEl.addEventListener('change', () => {
        applyScaleToKeyboard();
    });
}


// No default sample autoload; remain in "No Sample" state until user picks a preset