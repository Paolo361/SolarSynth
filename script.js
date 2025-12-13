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
    
    // disegna cerchietti sui punti originali
    ctx.fillStyle = 'rgba(255,193,7,0.7)'; // giallo con trasparenza
    ctx.strokeStyle = 'rgba(255,193,7,1)'; // giallo opaco
    ctx.lineWidth = 1.5;
    const radius = 3.5;
    
    xs.forEach((xTime, idx) => {
      if (ys && ys[idx] !== undefined) {
        const xPx = scale.getPixelForValue(xTime);
        const yPx = yScale.getPixelForValue(ys[idx]);
        
        if (xPx >= chartArea.left && xPx <= chartArea.right &&
            yPx >= chartArea.top && yPx <= chartArea.bottom) {
          ctx.beginPath();
          ctx.arc(xPx, yPx, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    });
    
    ctx.restore();
  }
};

Chart.register(lineShadowPlugin, verticalLinePlugin, horizontalSectionsPlugin, dataPointLinesPlugin);

// --- Tone.js synth setup ---
let toneSynth = null;
let mainLimiter = null;
let mainCompressor = null;
let masterVolume = null;
let toneStarted = false;
let lastPlayedMidi = null;
let lastPlayTime = 0;
const playCooldown = 150; // ms between retriggers of same note
// Optional sample player for oneshot sample mapping
let samplePlayer = null;
let sampleRootMidi = 60; // MIDI note that sample is recorded at (default C4)
let sampleLoadedName = null;
const PRESET_SAMPLES = {
  Airhorn: 'suoni/Airhorn.wav',
  Siren: 'suoni/Siren.wav',
  Subdrop: 'suoni/Subdrop.wav',
  SweepUp: 'suoni/SweepUp.wav'
};


// Audio effects chain
let reverb = null;
let distortion = null;
let chorus = null;
let delay = null;
let effectsChain = null;

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
        if (!toneSynth) toneSynth = new Tone.Synth({ oscillator: { type: 'sine' } }).connect(masterVolume);
        if (!toneStarted && typeof Tone !== 'undefined' && Tone.start) {
            // Tone.start() must be called in a user gesture; try to start silently if possible
            Tone.start();
            toneStarted = true;
        }
    } catch (e) {
        console.warn('Tone.js not available or failed to start', e);
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
                console.log('Old sample disposed');
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
        samplePlayer = new Tone.Player({ onload: () => {
            console.log('Player ready');
        } });
        // Manually set the buffer
        samplePlayer.buffer.set(audioBuffer);
        
        sampleRootMidi = Number(rootMidi) || 60;
        sampleLoadedName = name || url;
        console.log('Sample loaded successfully. Name:', name, 'Root MIDI:', sampleRootMidi, 'Buffer channels:', audioBuffer.numberOfChannels, 'Duration:', audioBuffer.duration);
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
  await loadSampleFromUrl(url, sampleRootMidi || 60, name);

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
function playSampleAtMidi(midi) {
    try {
        if (!samplePlayer || !samplePlayer.buffer) {
            console.warn('No sample loaded or buffer missing');
            return false;
        }
        const root = Number(sampleRootMidi) || 60;
        const semitoneShift = midi - root;

        console.log('Playing sample at MIDI', midi, 'shift:', semitoneShift, 'semitones');

        // Ensure audio context is started
        ensureToneStarted();

        // Clone player from buffer to allow overlapping oneshots
        const temp = new Tone.Player(samplePlayer.buffer);
        
        // Route through effects chain if initialized
        if (effectsChain) {
            temp.connect(effectsChain);
        } else {
            temp.connect(masterVolume);
        }
        
        temp.volume.value = -4; // Reduce individual sample volume to prevent summing overload
        
        // Calculate playback rate for pitch shifting (2^(semitones/12))
        const playbackRate = Math.pow(2, semitoneShift / 12);
        if (temp.playbackRate instanceof Tone.Signal || (temp.playbackRate && typeof temp.playbackRate.value !== 'undefined')) {
            temp.playbackRate.value = playbackRate;
        } else {
            temp.playbackRate = playbackRate;
        }
        
        temp.start();

        // dispose after a short timeout (safe margin based on original duration)
        setTimeout(() => {
            try { temp.stop(); temp.dispose(); } catch (e) {}
        }, (samplePlayer.buffer.duration / playbackRate + 0.5) * 1000);

        return true;
    } catch (e) {
        console.warn('Sample play failed', e);
        return false;
    }
}

function playMidiIfSelected(midi) {
    if (!midi || typeof midi !== 'number') return;
    const now = Date.now();
    if (midi === lastPlayedMidi && (now - lastPlayTime) < playCooldown) return; // throttle

    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    const numKeys = keyboard.children.length;
    if (numKeys <= 0) return;
    // Find the DOM key element that has this midi assigned (data-midi)
    let keyEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === midi) { keyEl = k; break; }
    }
    if (!keyEl) return;

    // play only if key was previously toggled selected by user
    if (!keyEl.classList.contains('selectedKey')) return;

    // Only play if a one-shot sample is loaded (no synth fallback)
    if (!samplePlayer || !samplePlayer.buffer) return;

    try {
        playSampleAtMidi(midi);
        lastPlayedMidi = midi;
        lastPlayTime = now;
        // add transient playing highlight to the DOM key
        try {
            if (keyEl) {
                keyEl.classList.add('playingKey');
                setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 220);
            }
        } catch (e) { /* ignore UI errors */ }
    } catch (e) {
        console.warn('Error playing note', e);
    }
}

// Try to play the requested midi. If that key is not user-selected, find the
// nearest user-selected key (by midi distance) and play/highlight that instead.
function triggerPlayWithFallback(requestedMidi) {
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
        playMidiIfSelected(requestedMidi);
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
            // Only play if a one-shot sample is loaded (no synth fallback)
            if (!samplePlayer || !samplePlayer.buffer) return;
            playSampleAtMidi(midi);
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
                pointRadius: (ctx) => (typeof highlightIndex === 'number' && ctx.dataIndex === highlightIndex ? 4 : 0),
                pointBackgroundColor: (ctx) => (typeof highlightIndex === 'number' && ctx.dataIndex === highlightIndex ? (COLOR_MAP[color] || color) : 'rgba(0,0,0,0)'),
                pointBorderColor: (ctx) => (typeof highlightIndex === 'number' && ctx.dataIndex === highlightIndex ? (COLOR_MAP[color] || color) : 'rgba(0,0,0,0)'),
                hoverRadius: 6
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
                    enabled: true,
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
let highlightSpeed = 200; // ms di default
let quantizeTimer = null; // timer per aggiornare evidenziazione tastiera
let highlightIndexTime = -1; // timestamp dell'ultimo highlight

const chartTemp = createChart("chartTemp", "red");
const chartDens = createChart("chartDens", "orange");
const chartVel  = createChart("chartVel",  "green");

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

function updatePreview(param) {
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
    chartPreview.update('none');

    // ensure plugin knows which Y-values to draw dots for the preview
    if (param === 'Temp') window.originalDataYs = window.originalDataTemp || [];
    else if (param === 'Dens') window.originalDataYs = window.originalDataDens || [];
    else if (param === 'Vel')  window.originalDataYs = window.originalDataVel || [];
}

function attachPreviewMouseTracking() {
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;
    // We intentionally do NOT track mouse movement for playback.
    // Mouse-based highlighting and sound have been removed per user request.
    canvas.addEventListener('mouseleave', () => {
        // remove all hover classes
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) {
            for (let i = 0; i < keyboard.children.length; i++) {
                keyboard.children[i].classList.remove('hoveredKey');
            }
        }
    });
    // retain click for potential future interactions (no-op for now)
    canvas.addEventListener('click', (evt) => {});
}

// When the moving marker (highlightIndex) advances, detect original data points
// whose X is close to the marker and highlight/play them accordingly.
function processMovingDotForIndex(idx) {
    try {
        if (!window.originalDataXs || !window.originalDataXs.length) {
            // clear quantized classes
            const keyboard = document.getElementById('verticalKeyboard');
            if (keyboard) for (let k = 0; k < keyboard.children.length; k++) keyboard.children[k].classList.remove('quantizedKey');
            return;
        }

        const interp = chartTemp.data.datasets[0].data || [];
        if (!interp.length || idx < 0 || idx >= interp.length) return;

        const movingX = interp[idx].x;

        // estimate spacing between interpolated points (fallback to reasonable ms value)
        let spacing = null;
        if (interp.length > 1) spacing = Math.abs(interp[1].x - interp[0].x);
        else if (window.originalDataXs.length > 1) spacing = Math.abs(window.originalDataXs[1] - window.originalDataXs[0]) / 2;
        if (!spacing || !isFinite(spacing)) spacing = 1000; // 1s fallback

        const xs = window.originalDataXs;
        const ys = window.originalDataYs || window.originalDataTemp || window.originalDataDens || window.originalDataVel || [];

        // clear previous auto-quantized highlights
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) for (let k = 0; k < keyboard.children.length; k++) keyboard.children[k].classList.remove('quantizedKey');

        // compute min/max for mapping Y->MIDI
        const numericYs = ys.filter(v => Number.isFinite(v));
        const hasNumeric = numericYs.length > 0;
        const minY = hasNumeric ? Math.min(...numericYs) : 0;
        const maxY = hasNumeric ? Math.max(...numericYs) : minY + 1;

        // compute average original spacing to set a robust threshold
        let avgOrigSpacing = null;
        if (xs.length > 1) {
            let sum = 0;
            for (let i = 1; i < xs.length; i++) sum += Math.abs(xs[i] - xs[i-1]);
            avgOrigSpacing = sum / (xs.length - 1);
        }
        if (!avgOrigSpacing || !isFinite(avgOrigSpacing)) avgOrigSpacing = spacing;

        // choose threshold as the larger of (1.5 * interpolated spacing) and (0.6 * average original spacing)
        const threshold = Math.max(spacing * 1.5, avgOrigSpacing * 0.6);

        // find single nearest original point to the moving marker
        let nearestIdx = -1;
        let minDx = Infinity;
        for (let i = 0; i < xs.length; i++) {
            const dx = Math.abs(xs[i] - movingX);
            if (dx < minDx) { minDx = dx; nearestIdx = i; }
        }

        if (nearestIdx >= 0 && minDx <= threshold) {
            const yVal = ys[nearestIdx];
            if (Number.isFinite(yVal)) {
                // compute midi
                let midi = 48;
                if (maxY !== minY) {
                    const ratio = (yVal - minY) / (maxY - minY);
                    midi = Math.round(48 + ratio * (83 - 48));
                    midi = Math.max(48, Math.min(83, midi));
                }

                // highlight corresponding key (visual) regardless of selection
                if (keyboard) {
                    for (let k = 0; k < keyboard.children.length; k++) {
                        const el = keyboard.children[k];
                        if (el && el.dataset && Number(el.dataset.midi) === midi) {
                            el.classList.add('quantizedKey');
                            // attempt to play the requested midi; if not selected, fallback to nearest selected
                            triggerPlayWithFallback(midi);
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {
        // ignore any errors in audio/highlight processing
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
    console.log("Key index from value:", keyIndex);
    return keyIndex;

}

// Wire select change
document.addEventListener('DOMContentLoaded', () => {
    const radios = document.querySelectorAll('input[name="chartSource"]');
    radios.forEach(r => {
        r.addEventListener('change', (e) => updatePreview(e.target.value));
    });
    
    // initialize preview with current selection (default Temp)
    const current = document.querySelector('input[name="chartSource"]:checked');
    if (current) updatePreview(current.value);
    
    // ensure preview height matches keyboard
    syncPreviewHeight();

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
        
        console.log('Effects chain initialized: Delay -> Chorus -> Distortion -> Reverb -> Compressor -> Limiter');
    } catch (e) {
        console.error('Failed to initialize effects:', e);
    }

    // --- Effects knob controls ---
    try {
        // Distortion controls
        setupEffectKnob('distortionDriveKnob', (value) => {
            if (distortion) distortion.distortion = value;
        });
        
        setupEffectKnob('distortionToneKnob', (value) => {
            // Oversample quality: 'none', '2x', '4x'
            // Map 0-1 to quality levels (approximated with distortion curve)
            // For simplicity, we'll just adjust the distortion amount as a "tone" control
            if (distortion) distortion.distortion = Math.max(0, distortion.distortion) * (0.5 + value * 0.5);
        });
        
        setupEffectKnob('distortionMixKnob', (value) => {
            if (distortion) distortion.wet.value = value;
        });

        // Chorus controls
        setupEffectKnob('chorusDepthKnob', (value) => {
            if (chorus) chorus.depth = value;
        });
        
        setupEffectKnob('chorusRateKnob', (value) => {
            // Map to frequency 0.1Hz - 10Hz
            if (chorus) chorus.frequency.value = 0.1 + value * 9.9;
        });
        
        setupEffectKnob('chorusMixKnob', (value) => {
            if (chorus) chorus.wet.value = value;
        });

        // Delay controls
        setupEffectKnob('delayTimeKnob', (value) => {
            // Map to delay time 0.01s - 1s
            if (delay) delay.delayTime.value = 0.01 + value * 0.99;
        });
        
        setupEffectKnob('delayFeedbackKnob', (value) => {
            // Feedback 0 - 0.9 (avoid runaway feedback)
            if (delay) delay.feedback.value = value * 0.9;
        });
        
        setupEffectKnob('delayMixKnob', (value) => {
            if (delay) delay.wet.value = value;
        });

        // Reverb controls
        setupEffectKnob('reverbDecayKnob', (value) => {
            // Decay time 0.1s - 10s
            if (reverb) reverb.decay = 0.1 + value * 9.9;
        });
        
        setupEffectKnob('reverbMixKnob', (value) => {
            if (reverb) reverb.wet.value = value;
        });
        
        setupEffectKnob('reverbSizeKnob', (value) => {
            // PreDelay acts as "size" - map 0-0.1s
            if (reverb) reverb.preDelay = value * 0.1;
        });

        // Toggle buttons
        document.querySelectorAll('.effect-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                this.classList.toggle('active');
                const effectName = this.getAttribute('data-effect');
                const isActive = this.classList.contains('active');
                
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
                }
            });
        });
    } catch (e) {
        console.error('Failed to setup effect knobs:', e);
    }

    // --- Sample UI wiring ---
    try {
        const loadBtn = document.getElementById('loadSampleBtn');
        const fileInput = document.getElementById('sampleFileInput');
        const rootInput = document.getElementById('sampleRoot');
        const status = document.getElementById('sampleStatus');

        if (loadBtn && fileInput) {
            loadBtn.addEventListener('click', (e) => {
                // use the visible root value when opening picker
                const root = rootInput ? Number(rootInput.value) || 60 : 60;
                pickSampleFile(root, fileInput);
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (ev) => {
                const f = ev.target.files && ev.target.files[0];
                if (f) {
                    await loadSampleFromUrl(URL.createObjectURL(f), Number(rootInput ? rootInput.value : 60) || 60, f.name);
                    if (status) status.textContent = `Caricato: ${f.name} (root ${sampleRootMidi})`;
                }
            });
        }

        if (rootInput) {
            rootInput.addEventListener('change', (e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) sampleRootMidi = v;
                if (status && sampleLoadedName) status.textContent = `Caricato: ${sampleLoadedName} (root ${sampleRootMidi})`;
            });
        }
    } catch (e) { /* ignore UI wiring errors */ }
});

window.addEventListener('resize', () => {
    // keep preview height synced when window size changes
    syncPreviewHeight();
});


chartTemp.data.datasets[0].label = "Temperatura";
chartDens.data.datasets[0].label = "Densità";
chartVel.data.datasets[0].label  = "Velocità";

// Sincronizzazione tooltip / hover tra i grafici
function attachSync(master, slaves) {
    const canvas = master.canvas;
    canvas.addEventListener('mousemove', (evt) => {
        const points = master.getElementsAtEventForMode(evt, 'nearest', { intersect: false });
        if (!points.length) return;
        const idx = points[0].index;
        // set active elements on slaves
        slaves.forEach(s => {
            try {
                s.setActiveElements([{datasetIndex: 0, index: idx}]);
                // position event for tooltip - use center x of the element if available
                const el = s.getDatasetMeta(0).data[idx];
                const pos = el ? {x: el.x, y: el.y} : {x: evt.offsetX, y: evt.offsetY};
                if (s.tooltip && typeof s.tooltip.setActiveElements === 'function') {
                    s.tooltip.setActiveElements([{datasetIndex:0, index: idx}], pos);
                }
                s.update('none');
            } catch (e) { /* noop */ }
        });
    });

    canvas.addEventListener('mouseleave', () => {
        slaves.forEach(s => {
            try { s.setActiveElements([]); if (s.tooltip && typeof s.tooltip.setActiveElements === 'function') s.tooltip.setActiveElements([]); s.update('none'); } catch(e){}
        });
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

        chartTemp.update("none");
        chartDens.update("none");
        chartVel.update("none");

        // Aggiorna anche la preview chart se presente, per mantenerla sincronizzata con i nuovi dati
        const radio = document.querySelector('input[name="chartSource"]:checked');
        if (radio) updatePreview(radio.value);

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

function advanceHighlight() {
    const len = chartTemp.data.datasets[0].data.length;
    if (!len) return;

    let next = highlightIndex;
    for (let i = 0; i < len; i++) {
        next = (next + 1) % len;
        if (isValidDataAt(chartTemp, next) || isValidDataAt(chartDens, next) || isValidDataAt(chartVel, next)) {
            highlightIndex = next;
            realHighlightIndex = next;
            currIdxTime = indexToTime(chartTemp, highlightIndex);
            console.log("highlightIndexTime:", currIdxTime, "vs", highlightIndexTime);
            if(currIdxTime !== highlightIndexTime) {
                highlightIndexTime = currIdxTime;
                // process the moving marker: detect original points near it and trigger highlights/notes
                processMovingDotForIndex(highlightIndex);
            }
            updateHighlightRender();
            return;
        }
    }


    // nessun punto valido trovato
    highlightIndex = -1;
    realHighlightIndex = -1;
    updateHighlightRender();
}

 
function startHighlighting(speedMs = 200) {
    highlightSpeed = speedMs;
    if (highlightTimer !== null) clearInterval(highlightTimer);

    // se i dati non sono ancora pronti, aspetta un po' e poi avvia
    if (!chartTemp.data.datasets[0].data.length) {
        realHighlightIndex = -1;
        highlightIndex = -1;
        highlightTimer = setInterval(() => {
            if (chartTemp.data.datasets[0].data.length) {
                clearInterval(highlightTimer);
                highlightTimer = setInterval(advanceHighlight, highlightSpeed);
            }
        }, 200);
        return;
    }

    highlightIndex = realHighlightIndex; // iniziare prima del primo
    highlightTimer = setInterval(advanceHighlight, highlightSpeed);
    console.log(chartTemp.data.datasets[0]);
    advanceHighlight(); // mostra subito il primo
}

function stopHighlighting() {
    if (highlightTimer) { 
        clearInterval(highlightTimer);
        clearInterval(quantizeTimer);
        highlightTimer = null;
        quantizeTimer = null;}
    // clear any auto-quantized highlights
    try {
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) for (let k = 0; k < keyboard.children.length; k++) keyboard.children[k].classList.remove('quantizedKey');
    } catch (e) {}
    updateHighlightRender();
}

function setHighlightSpeed(ms) {
    const wasRunning = !!highlightTimer;
    stopHighlighting();
    highlightSpeed = ms;
    if (wasRunning) startHighlighting(ms);
}

// Restituisce la chart selezionata dal select vicino alla tastiera
function getSelectedChart() {
    const radio = document.querySelector('input[name="chartSource"]:checked');
    const value = radio ? radio.value : 'Temp';
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
function setupEffectKnob(knobId, callback) {
    const knob = document.getElementById(knobId);
    if (!knob) return;
    
    let isDragging = false;
    let startY = 0;
    let startValue = 0; // 0 to 1 range
    
    // Map knob rotation to effect value (0 -> 1)
    const updateKnobRotation = (value) => {
        // value: 0 to 1
        // rotation: -135deg to 135deg
        const angle = -135 + value * 270;
        knob.style.transform = `rotate(${angle}deg)`;
    };
    
    // Initialize at 0 (no effect)
    updateKnobRotation(0);
    
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
        const sensitivity = 0.005; // Adjust sensitivity
        
        let newValue = startValue + (deltaY * sensitivity);
        newValue = Math.max(0, Math.min(1, newValue));
        
        updateKnobRotation(newValue);
        callback(newValue);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });
}

// Wiring dei controlli UI (knob + play/pause)
const speedKnobControl = document.getElementById('speedKnobControl');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
let isPlaying = false;

// Knob logic
if (speedKnobControl) {
    let isDragging = false;
    let startY = 0;
    let startSpeed = highlightSpeed;
    // Min and max speed values (ms) - inverted logic: lower ms = faster
    const minSpeed = 20;
    const maxSpeed = 200;
    
    // Initial rotation based on current speed
    // Map speed (maxSpeed -> minSpeed) to rotation (-135 -> 135 degrees)
    // 200ms (slow) -> -135deg
    // 20ms (fast) -> 135deg
    const updateKnobRotation = (speed) => {
        // Normalize speed to 0-1 range (inverted because lower is faster)
        // 200 -> 0, 20 -> 1
        const t = 1 - (speed - minSpeed) / (maxSpeed - minSpeed);
        const angle = -135 + t * 270;
        speedKnobControl.style.transform = `rotate(${angle}deg)`;
    };

    updateKnobRotation(highlightSpeed);
    if (speedValue) speedValue.textContent = `${highlightSpeed} ms`;

    speedKnobControl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startSpeed = highlightSpeed;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault(); // Prevent text selection
        
        // Show tooltip
        if (speedValue) speedValue.classList.add('visible');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY; // Up is positive
        const sensitivity = 2; // Pixels per ms change
        
        // Calculate new speed
        // Dragging up (positive delta) should decrease ms (faster)
        // Dragging down (negative delta) should increase ms (slower)
        let newSpeed = startSpeed - (deltaY * sensitivity);
        
        // Clamp values
        newSpeed = Math.max(minSpeed, Math.min(maxSpeed, newSpeed));
        newSpeed = Math.round(newSpeed);
        
        if (newSpeed !== highlightSpeed) {
            setHighlightSpeed(newSpeed);
            updateKnobRotation(newSpeed);
            if (speedValue) speedValue.textContent = `${newSpeed} ms`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
            // Hide tooltip
            if (speedValue) speedValue.classList.remove('visible');
        }
    });
}

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (!isPlaying) {
            startHighlighting(highlightSpeed);
            playPauseBtn.textContent = 'Pause';
            isPlaying = true;
        } else {
            stopHighlighting();
            playPauseBtn.textContent = 'Play';
            isPlaying = false;
        }
    });
}

// Volume knob control
const volumeKnobControl = document.getElementById('volumeKnobControl');
const volumeValue = document.getElementById('volumeValue');

if (volumeKnobControl) {
    let isDragging = false;
    let startY = 0;
    let startVolume = 0; // dB value
    // Min and max volume (dB)
    const minVolume = -40;
    const maxVolume = 6;
    
    const updateKnobRotation = (volumeDb) => {
        // Normalize volume to 0-1 range
        const t = (volumeDb - minVolume) / (maxVolume - minVolume);
        const angle = -135 + t * 270;
        volumeKnobControl.style.transform = `rotate(${angle}deg)`;
    };
    
    const setMasterVolume = (volumeDb) => {
        ensureToneStarted();
        if (masterVolume) {
            masterVolume.volume.value = volumeDb;
        }
    };
    
    // Initialize at 0 dB
    updateKnobRotation(0);
    setMasterVolume(0);
    if (volumeValue) volumeValue.textContent = '0 dB';
    
    volumeKnobControl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startVolume = masterVolume ? masterVolume.volume.value : 0;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        
        if (volumeValue) volumeValue.classList.add('visible');
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY;
        const sensitivity = 0.2; // dB per pixel
        
        let newVolume = startVolume + (deltaY * sensitivity);
        newVolume = Math.max(minVolume, Math.min(maxVolume, newVolume));
        newVolume = Math.round(newVolume * 10) / 10; // Round to 0.1 dB
        
        setMasterVolume(newVolume);
        updateKnobRotation(newVolume);
        if (volumeValue) volumeValue.textContent = `${newVolume >= 0 ? '+' : ''}${newVolume.toFixed(1)} dB`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
            if (volumeValue) volumeValue.classList.remove('visible');
        }
    });
}

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
    // Force a fixed preview size (do not follow window/keyboard resizing)
    const FIXED_W_CSS = 300; // CSS pixels for canvas width
    const FIXED_H_CSS = 320; // CSS pixels for canvas height
    const PREVIEW_BOX_W = 320; // container width
    const PREVIEW_BOX_H = 360; // container height (including margins)

    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;
    const devicePR = window.devicePixelRatio || 1;

    // set the parent keyboard container height to match the preview so they align
    try {
        const kbCont = document.getElementById('keyboardContainer');
        if (kbCont) {
            kbCont.style.height = PREVIEW_BOX_H + 'px';
            kbCont.style.overflowY = 'auto';
        }
    } catch (e) { /* noop */ }

    // Backing store size (physical pixels) to avoid blurriness on HiDPI
    try {
        canvas.width = Math.round(FIXED_W_CSS * devicePR);
        canvas.height = Math.round(FIXED_H_CSS * devicePR);
        canvas.style.width = FIXED_W_CSS + 'px';
        canvas.style.height = FIXED_H_CSS + 'px';
    } catch (e) { /* ignore DOM write errors */ }

    if (chartPreview) {
        try { chartPreview.resize(); chartPreview.update('none'); } catch (e) { /* noop */ }
    }
}

function createWhiteKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('white');
    key.onclick = () => { highlightKey(Array.from(key.parentNode.children).indexOf(key));
    }
    return key;    
}

function createBlackKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('black');
    key.onclick = () => { highlightKey(Array.from(key.parentNode.children).indexOf(key));
    }
    return key;    
}

function highlightKey(i) {
    const keyboard = document.getElementById('verticalKeyboard');
    const keys = keyboard.children;
    keys[i].classList.toggle('selectedKey');
}

// Applica una scala alla tastiera, in base alla root MIDI
function applyScaleToKeyboard(scaleName) {
  const keyboard = document.getElementById('verticalKeyboard');
  if (!keyboard) return;

  const keys = keyboard.children;
  const numKeys = keys.length;
  if (numKeys === 0) return;

  // Pulisce le vecchie evidenziazioni di scala ma lascia la logica del playback
  for (let i = 0; i < numKeys; i++) {
    keys[i].classList.remove('scaleKey');
    // opzionale: rimuovere le selezioni automatiche precedenti
    keys[i].classList.remove('selectedKey');
  }

  if (!scaleName || !SCALES[scaleName]) {
    // Nessuna scala → nessun vincolo
    return;
  }

  // Legge la root MIDI dall'input (default 60 se vuoto o non valido)
  const rootInput = document.getElementById('rootMidiInput');
  let rootMidi = 60;
  if (rootInput) {
    const v = Number(rootInput.value);
    if (Number.isFinite(v)) rootMidi = v;
  }

  const intervals = SCALES[scaleName];

  // Costruisce un set di note consentite (MIDI) su tutta la tastiera
  const allowed = new Set();
  for (let i = 0; i < numKeys; i++) {
    const keyEl = keys[i];
    const midi = Number(keyEl.dataset.midi);
    if (!Number.isFinite(midi)) continue;

    const diff = midi - rootMidi;
    const mod12 = ((diff % 12) + 12) % 12; // 0..11
    if (intervals.includes(mod12)) {
      allowed.add(midi);
    }
  }

  // Evidenzia e seleziona automaticamente le note di scala
  for (let i = 0; i < numKeys; i++) {
    const keyEl = keys[i];
    const midi = Number(keyEl.dataset.midi);
    if (!Number.isFinite(midi)) continue;

    if (allowed.has(midi)) {
      keyEl.classList.add('scaleKey');
      keyEl.classList.add('selectedKey'); // così sono subito attive
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
    console.log("Key index from Y:", key);

    // rimuovi solo la classe di quantizzazione precedente (non rimuovere le selezioni utente)
    for (let k = 0; k < keys.length; k++) {
        keys[k].classList.remove('selectedKey');
    }

    // Aggiungi indicazione di quantizzazione (classe separata) alla chiave calcolata
    if (key >= 0 && key < numKeys) {
        const target = keys[numKeys - key];
        if (target) {
            target.classList.add('selectedKey');
            // se la key è stata selezionata dall'utente, suona la nota corrispondente
            try {
                if (target.classList.contains('selectedKey')) {
                    const midi = Number(target.dataset.midi);
                    console.log("Triggering quantized play for midi:", midi);
                    if (Number.isFinite(midi)) playMidiIfSelected(midi);
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
        console.log("Orario corrente:", timeStr);
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
      if (status) status.textContent = 'Sample mode: nessun sample';
      return;
    }

    loadPresetSample(name);
  });
}


// Select delle scale
const scaleSelect = document.getElementById('scaleSelect');
if (scaleSelect) {
  scaleSelect.addEventListener('change', (e) => {
    const value = e.target.value || '';
    applyScaleToKeyboard(value);
  });
}


// Carica il sample di default
loadSampleFromUrl('prova.wav', 60, 'prova.wav');