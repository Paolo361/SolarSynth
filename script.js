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

Chart.register(lineShadowPlugin, verticalLinePlugin);

function createChart(canvasId, color) {
    return new Chart(document.getElementById(canvasId), {
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
                verticalLine: {}
            }
        }
    });
}

/* ============================================================
   3) CREA I 3 GRAFICI
============================================================ */
// Stato globale per l'evidenziazione: dichiarato prima della creazione dei grafici
let highlightIndex = -1;
let highlightTimer = null;
let highlightSpeed = 500; // ms di default

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
    chartPreview = createChart('chartPreview', 'green');
    // small initial dataset
    chartPreview.data.datasets[0].data = [];
    chartPreview.update('none');
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
            console.log("Temp: ", chartTemp.data.datasets[0].data[highlightIndex].y);
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
    advanceHighlight(); // mostra subito il primo
}

function stopHighlighting() {
    if (highlightTimer) { clearInterval(highlightTimer); highlightTimer = null; }
    updateHighlightRender();
}

function setHighlightSpeed(ms) {
    const wasRunning = !!highlightTimer;
    stopHighlighting();
    highlightSpeed = ms;
    if (wasRunning) startHighlighting(ms);
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
    
    // quantizzo l'indice highlightIndex alla key più vicina
    let closestKeyIndex = 0;
    let closestDistance = Infinity;
    for (let i = 0; i < keys.length; i++) {
        const keyCenter = i * 5 + 2.5; // centro della key
        const highlightPos = (highlightIndex / (chartTemp.data.datasets[0].data.length - 1)) * (keys.length * 5);
        const distance = Math.abs(highlightPos - keyCenter);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestKeyIndex = i;
        }
    }

    // rimuovo la selezione da tutte le key
    for (let i = 0; i < keys.length; i++) {
        keys[i].classList.remove('selectedKey');
    }

    // evidenzio la key più vicina
    keys[closestKeyIndex].classList.add('selectedKey');
}


// Disegno al load
drawVerticalKeyboard();

// Avviare l'aggiornamento dei grafici ogni 60s (resta manuale l'evidenziazione)
updateCharts();
setInterval(updateCharts, 60_000);


highlightKey(1); // evidenzia la prima nota all'inizio
