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
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
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
    ctx.strokeStyle = 'rgba(255,193,7,0.4)'; // giallo con trasparenza
    
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
let highlightSpeed = 500; // ms di default
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
    // wire mouse events to track which key section is hovered
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
    
    canvas.addEventListener('mousemove', (evt) => {
        const rect = canvas.getBoundingClientRect();
        const y = evt.clientY - rect.top;
        const keyIndex = getKeyIndexFromY(y);
        if (keyIndex !== -1) {
            const keyboard = document.getElementById('verticalKeyboard');
            const keys = keyboard.children;
            // remove hover from all keys, then add hover to the hovered key
            for (let i = 0; i < keys.length; i++) {
                keys[i].classList.remove('hoveredKey');
            }
            keys[keyIndex].classList.add('hoveredKey');
            //console.log(`Hovering key ${keyIndex}`);
        }
    });
    
    canvas.addEventListener('mouseleave', () => {
        // remove all hover classes
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) {
            for (let i = 0; i < keyboard.children.length; i++) {
                keyboard.children[i].classList.remove('hoveredKey');
            }
        }
    });
    
    canvas.addEventListener('click', (evt) => {
        const rect = canvas.getBoundingClientRect();
        const y = evt.clientY - rect.top;
        const keyIndex = getKeyIndexFromY(y);
        if (keyIndex !== -1) {
            console.log(`Clicked key ${keyIndex}`);
            // you can emit a sound or trigger MIDI note here
        }
    });
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
    const sel = document.getElementById('chartSelector');
    if (!sel) return;
    sel.addEventListener('change', (e) => updatePreview(e.target.value));
    // initialize preview with current selection
    updatePreview(sel.value);
    // ensure preview height matches keyboard
    syncPreviewHeight();
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
        const sel = document.getElementById('chartSelector');
        if (sel) updatePreview(sel.value);

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
                quantizeHighlightToKey();
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

 
function startHighlighting(speedMs = 500) {
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
    const sel = document.getElementById('chartSelector');
    const value = sel ? sel.value : 'Vel';
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

// Wiring dei controlli UI (slider + play/pause)
const speedKnob = document.getElementById('speedKnob');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
let isPlaying = false;

if (speedKnob) {
    speedKnob.value = String(highlightSpeed);
    speedValue.textContent = `${highlightSpeed} ms`;
    speedKnob.addEventListener('input', (e) => {
        const v = Number(e.target.value);
        speedValue.textContent = `${v} ms`;
        setHighlightSpeed(v);
    });
}

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (!isPlaying) {
            startHighlighting(Number(speedKnob.value || highlightSpeed));
            playPauseBtn.textContent = 'Pause';
            isPlaying = true;
        } else {
            stopHighlighting();
            playPauseBtn.textContent = 'Play';
            isPlaying = false;
        }
    });
}

/* ============================================================
   6) TASTIERA VERTICALE – 2 OTTAVE
============================================================ */

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

    // Rimuovi selezione da tutte le chiavi
    for (let k = 0; k < keys.length; k++) {
        keys[k].classList.remove('selectedKey');
    }

    // Aggiungi selezione alla chiave calcolata
    if (key >= 0 && key < numKeys) {
        keys[numKeys-key].classList.add('selectedKey');
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


highlightKey(1); // evidenzia la prima nota all'inizio
