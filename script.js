function interpolateLinear(xs, ys, newXs) {
    const out = [];
    for (let i = 0; i < newXs.length; i++) {
        const x = newXs[i];
        let j = 0;
        while (j < xs.length - 2 && x > xs[j + 1]) j++;
        const x0 = xs[j], x1 = xs[j + 1];
        const y0 = ys[j], y1 = ys[j + 1];
        const t = (x - x0) / (x1 - x0);
        out.push(y0 * (1 - t) + y1 * t);
    }
    return out;
}

function resolveColorToRgba(color, alpha = 1) {
    try {
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = color;
        const resolved = ctx.fillStyle;

        if (resolved[0] === '#') {
            let hex = resolved.slice(1);
            if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
            const r = parseInt(hex.slice(0,2),16);
            const g = parseInt(hex.slice(2,4),16);
            const b = parseInt(hex.slice(4,6),16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9\.]+))?\)/);
        if (m) {
            const r = m[1], g = m[2], b = m[3];
            return `rgba(${r},${g},${b},${alpha})`;
        }

        return color;
    } catch (e) {
        return color;
    }
}

const COLOR_MAP = { red: '#ef4444', orange: '#fb923c', green: '#34d399' };

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

const dataPointLinesPlugin = {
  id: 'dataPointLines',
  afterDraw(chart, args, options) {
        const cfg = chart && chart.options && chart.options.plugins && chart.options.plugins.dataPointLines;
        if (!cfg) return;

        const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;
    
    if (!window.originalDataXs || window.originalDataXs.length === 0) return;
    
    const xs = window.originalDataXs;
    let ys = [];
    
    if (chart === chartTemp && window.originalDataTemp) ys = window.originalDataTemp;
    else if (chart === chartDens && window.originalDataDens) ys = window.originalDataDens;
    else if (chart === chartVel && window.originalDataVel) ys = window.originalDataVel;
    else if (chart.canvas.id === 'chartPreview' && window.originalDataYs) ys = window.originalDataYs;
    const chartArea = chart.chartArea;
    const scale = chart.scales.x;
    const yScale = chart.scales.y;
    
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,193,7,0.05)';
    
    xs.forEach((xTime, idx) => {
      const xPx = scale.getPixelForValue(xTime);
      if (xPx >= chartArea.left && xPx <= chartArea.right) {
        ctx.beginPath();
        ctx.moveTo(xPx, chartArea.top);
        ctx.lineTo(xPx, chartArea.bottom);
        ctx.stroke();
      }
    });
    
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
    
    xs.forEach((xTime, idx) => {
      if (ys && ys[idx] !== undefined) {
        const xPx = scale.getPixelForValue(xTime);
        const yPx = yScale.getPixelForValue(ys[idx]);
        
        if (xPx >= chartArea.left && xPx <= chartArea.right &&
            yPx >= chartArea.top && yPx <= chartArea.bottom) {
          
          const isClosest = idx === closestIdx;
          const radius = isClosest ? 7 : 3.5;
          const fillAlpha = isClosest ? 1 : 0.7;
          const strokeAlpha = isClosest ? 1 : 1;
          
          if (isClosest) {
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx.lineWidth = 3;
          } else {
            ctx.fillStyle = `rgba(255,193,7,${fillAlpha})`;
            ctx.strokeStyle = `rgba(255,193,7,${strokeAlpha})`;
            ctx.lineWidth = 1.5;
          }
          
          if (isClosest) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
            ctx.shadowBlur = 15;
          }
          
          ctx.beginPath();
          ctx.arc(xPx, yPx, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
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

const horizontalSectionsPlugin = {
    id: 'horizontalSections',
    afterDraw(chart, args, options) {
        if (!chart.isHorizontalSections) return;
        const ctx = chart.ctx;
        const keyboard = document.getElementById('keyboardContainer');
        if (!keyboard) return;
        
        const keys = keyboard.querySelectorAll('.key');
        const numKeys = keys.length;
        const chartArea = chart.chartArea;
        const sectionHeight = (chartArea.bottom - chartArea.top) / numKeys;
        
        ctx.save();
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        
        for (let i = 0; i <= numKeys; i++) {
            const y = chartArea.top + i * sectionHeight;
            ctx.beginPath();
            ctx.moveTo(chartArea.left, y);
            ctx.lineTo(chartArea.right, y);
            ctx.stroke();
        }
        ctx.restore();
    }
};

Chart.register(lineShadowPlugin, verticalLinePlugin, horizontalSectionsPlugin, dataPointLinesPlugin);

let toneSynth = null;
let fftAnalyser = null;
let spectrumCanvas = null;
let spectrumCtx = null;
let spectrumAnimationId = null;
let spectrumBands = [];
let audioFilter = null;
let mainLimiter = null;
let mainCompressor = null;
let masterVolume = null;
let toneStarted = false;
let lastPlayedMidi = null;
let lastPlayTime = 0;
const playCooldown = 150;
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
let metronomeEnabled = false;
let metronomeOsc = null;
let metronomePanner = null;
let metronomeVolume = null;

let recorder = null;
let isRecording = false;
let recordingStartTime = null;
let recordingDuration = 0;
let recordingTimerInterval = null;


const PRESET_SAMPLES = {
    afterglow: 'suoni/afterglow.wav',
    ember: 'suoni/ember.wav',
    kelvin: 'suoni/kelvin.wav',
    lumen: 'suoni/lumen.wav',
    parsec: 'suoni/parsec.wav',
    photon: 'suoni/photon.wav',
    halo: 'suoni/halo.wav'
};

let midiOutput = null;
let midiEnabled = false;
let currentMidiNote = null;

let reverb = null;
let distortion = null;
let chorus = null;
let delay = null;

function ensureToneStarted() {
    try {
        if (!mainLimiter) {
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
        
        if (!fftAnalyser && masterVolume) {
            fftAnalyser = new Tone.FFT(512);
            masterVolume.connect(fftAnalyser);
            initSpectrum();
        }
        
        if (!toneStarted && typeof Tone !== 'undefined' && Tone.start) {
            Tone.start();
            toneStarted = true;
        }
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
    if (meterAnimationId) return;
    const loop = () => {
        const fill = document.getElementById('dbMeterFill');
        if (!fill || !outputMeter) {
            meterAnimationId = null;
            return;
        }
        let level = outputMeter.getValue();
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

function initSpectrum() {
    spectrumCanvas = document.getElementById('spectrumCanvas');
    if (!spectrumCanvas) return;
    spectrumCtx = spectrumCanvas.getContext('2d');
    
    const numBands = 32;
    spectrumBands = new Array(numBands).fill(0);
    
    initFilterControls();
    
    startSpectrumLoop();
}

let eqEnabled = false;
let eqHighpassFreq = 20;
let eqLowpassFreq = 20000;
let eqHighpassQ = 0.7071;
let eqLowpassQ = 0.7071;
let eqHighpassRolloff = -12;
let eqLowpassRolloff = -12;
let eqHighpassFilter = null;
let eqLowpassFilter = null;
let eqDraggingFilter = null;

const EQ_MIN_FREQ = 20;
const EQ_MAX_FREQ = 20000;
const EQ_MIN_Q = 0.1;
const EQ_MAX_Q = 20;
const EQ_VALID_ROLLOFFS = [-12, -24, -48, -96];

function initFilterControls() {
    createEQFilters();
    
    const eqToggleBtn = document.getElementById('eqToggleBtn');
    if (eqToggleBtn) {
        eqToggleBtn.addEventListener('click', () => {
            setEQEnabled(!eqEnabled);
            eqToggleBtn.classList.toggle('active');
            eqToggleBtn.textContent = eqEnabled ? 'ON' : 'OFF';
        });
    }
    
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
    
    const DRAG_THRESHOLD = 10;
    
    const hzToPixel = (hz) => {
        const canvasWidth = canvas.offsetWidth;
        const log20 = Math.log(20);
        const log20k = Math.log(20000);
        const logHz = Math.log(hz);
        return ((logHz - log20) / (log20k - log20)) * canvasWidth;
    };
    
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
        
        const hpPixel = hzToPixel(eqHighpassFreq);
        const lpPixel = hzToPixel(eqLowpassFreq);
        
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
            const newFreq = Math.max(EQ_MIN_FREQ, Math.min(EQ_MAX_FREQ, pixelToHz(mouseX)));
            
            if (eqDraggingFilter === 'hp') {
                eqHighpassFreq = newFreq;
                if (eqHighpassFilter) {
                    eqHighpassFilter.frequency.rampTo(newFreq, 0.05);
                }
            } else if (eqDraggingFilter === 'lp') {
                eqLowpassFreq = newFreq;
                if (eqLowpassFilter) {
                    eqLowpassFilter.frequency.rampTo(newFreq, 0.05);
                }
            }
        } else {
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
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        const hpPixel = hzToPixel(eqHighpassFreq);
        const lpPixel = hzToPixel(eqLowpassFreq);
        const THRESHOLD = 50;
        
        let targetFilter = null;
        if (Math.abs(mouseX - hpPixel) < THRESHOLD) {
            targetFilter = 'hp';
        } else if (Math.abs(mouseX - lpPixel) < THRESHOLD) {
            targetFilter = 'lp';
        }
        
        if (targetFilter) {
            
            if (targetFilter === 'hp') {
                const currentIndex = EQ_VALID_ROLLOFFS.indexOf(eqHighpassRolloff);
                let newIndex = currentIndex;
                
                if (e.deltaY < 0 && currentIndex < EQ_VALID_ROLLOFFS.length - 1) {
                    newIndex = currentIndex + 1;
                } else if (e.deltaY > 0 && currentIndex > 0) {
                    newIndex = currentIndex - 1;
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
                    newIndex = currentIndex + 1;
                } else if (e.deltaY > 0 && currentIndex > 0) {
                    newIndex = currentIndex - 1;
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
    if (spectrumAnimationId) return;
    
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
        
        if (spectrumCanvas.width !== spectrumCanvas.clientWidth || spectrumCanvas.height !== spectrumCanvas.clientHeight) {
            spectrumCanvas.width = spectrumCanvas.clientWidth;
            spectrumCanvas.height = spectrumCanvas.clientHeight;
        }
        
        const values = fftAnalyser.getValue();
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;
        const sampleRate = 44100;
        const nyquist = sampleRate / 2;
        
        spectrumCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        spectrumCtx.fillRect(0, 0, width, height);
        
        const numBands = spectrumBands.length;
        const totalGap = numBands - 1;
        const gapWidth = 2;
        const barWidth = (width - totalGap * gapWidth) / numBands;
        
        for (let i = 0; i < numBands; i++) {
            const freqStart = i === 0 ? 20 : frequencyBands[i - 1];
            const freqEnd = i < frequencyBands.length ? frequencyBands[i] : nyquist;
            
            const binStart = Math.floor((freqStart / nyquist) * values.length);
            const binEnd = Math.ceil((freqEnd / nyquist) * values.length);
            
            let sum = 0;
            let count = 0;
            for (let j = binStart; j < binEnd && j < values.length; j++) {
                sum += values[j];
                count++;
            }
            const avgDb = count > 0 ? sum / count : -100;
            
            const normalizedValue = Math.max(0, Math.min(1, (avgDb + 100) / 100));
            
            const smoothFactor = 0.3;
            spectrumBands[i] = spectrumBands[i] * (1 - smoothFactor) + normalizedValue * smoothFactor;
            
            if (normalizedValue < spectrumBands[i]) {
                spectrumBands[i] *= 0.85;
            }
        }
        
        const gradient = spectrumCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#34d399');
        gradient.addColorStop(0.5, '#fbbf24');
        gradient.addColorStop(1, '#ef4444');
        
        spectrumCtx.fillStyle = gradient;
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
        
        spectrumCtx.lineTo(width, height);
        spectrumCtx.closePath();
        spectrumCtx.fill();
        
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
        
        const hzToPixelInLoop = (hz) => {
            const log20 = Math.log(20);
            const log20k = Math.log(20000);
            const logHz = Math.log(hz);
            return ((logHz - log20) / (log20k - log20)) * width;
        };
        
        const hpX = hzToPixelInLoop(eqHighpassFreq);
        const lpX = hzToPixelInLoop(eqLowpassFreq);
        
        const lineOpacity = eqEnabled ? 1 : 0.25;
        const curveOpacity = eqEnabled ? 0.7 : 0.2;
        const areaOpacity = eqEnabled ? 0.05 : 0.02;
        const handleOpacity = eqEnabled ? 1 : 0.3;
        
        if (eqEnabled) {
            const pixelToHz = (px) => {
                const t = px / width;
                const log20 = Math.log(20);
                const log20k = Math.log(20000);
                return Math.exp(log20 + t * (log20k - log20));
            };
            
            spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${curveOpacity})`;
            spectrumCtx.lineWidth = 3;
            spectrumCtx.beginPath();
            
            const hpSlopeFactor = Math.abs(eqHighpassRolloff) / 12;
            let isFirstPoint = true;
            
            for (let x = 0; x <= width; x += 2) {
                const freq = pixelToHz(x);
                
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
            
            spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${curveOpacity})`;
            spectrumCtx.lineWidth = 3;
            spectrumCtx.beginPath();
            
            const lpSlopeFactor = Math.abs(eqLowpassRolloff) / 12;
            isFirstPoint = true;
            
            for (let x = 0; x <= width; x += 2) {
                const freq = pixelToHz(x);
                
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
            
            spectrumCtx.fillStyle = `rgba(251, 191, 36, ${areaOpacity})`;
            spectrumCtx.fillRect(0, 0, hpX, height);
            
            spectrumCtx.fillStyle = `rgba(251, 191, 36, ${areaOpacity})`;
            spectrumCtx.fillRect(lpX, 0, width - lpX, height);
        }
        
        spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${lineOpacity})`;
        spectrumCtx.lineWidth = 2.5;
        spectrumCtx.setLineDash([6, 5]);
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(hpX, 0);
        spectrumCtx.lineTo(hpX, height);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
        
        spectrumCtx.fillStyle = `rgba(251, 191, 36, ${handleOpacity})`;
        spectrumCtx.strokeStyle = `rgba(255, 255, 255, ${handleOpacity * 0.6})`;
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.arc(hpX, 10, 5, 0, 2 * Math.PI);
        spectrumCtx.fill();
        spectrumCtx.stroke();
        
        spectrumCtx.strokeStyle = `rgba(251, 191, 36, ${lineOpacity})`;
        spectrumCtx.lineWidth = 2.5;
        spectrumCtx.setLineDash([6, 5]);
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(lpX, 0);
        spectrumCtx.lineTo(lpX, height);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
        
        spectrumCtx.fillStyle = `rgba(251, 191, 36, ${handleOpacity})`;
        spectrumCtx.strokeStyle = `rgba(255, 255, 255, ${handleOpacity * 0.6})`;
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.arc(lpX, 10, 5, 0, 2 * Math.PI);
        spectrumCtx.fill();
        spectrumCtx.stroke();
        
        if (eqEnabled) {
            spectrumCtx.font = 'bold 14px "Space Mono", monospace';
            spectrumCtx.textAlign = 'center';
            spectrumCtx.fillStyle = 'rgba(251, 191, 36, 1)';
            const hpLabel = eqHighpassFreq >= 1000 ? (eqHighpassFreq / 1000).toFixed(1) + 'k' : Math.round(eqHighpassFreq) + '';
            spectrumCtx.fillText(hpLabel, hpX, height - 2);
            
            const lpLabel = eqLowpassFreq >= 1000 ? (eqLowpassFreq / 1000).toFixed(1) + 'k' : Math.round(eqLowpassFreq) + '';
            spectrumCtx.fillText(lpLabel, lpX, height - 2);
        }
        
        spectrumCtx.font = '8px "Space Mono", monospace';
        spectrumCtx.fillStyle = '#e2e8f0';
        spectrumCtx.textAlign = 'center';
        
        const labelIndices = [0, 7, 13, 18, 23, 28, 30];
        
        labelIndices.forEach(index => {
            if (index < numBands) {
                const freq = frequencyBands[index];
                const x = index * (barWidth + gapWidth) + barWidth / 2;
                
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
        metronomeVolume = new Tone.Volume(-10).toDestination();
        metronomePanner = new Tone.Panner(0).connect(metronomeVolume);

        metronomeOsc = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 1,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1
            }
        }).connect(metronomePanner);
        
        Tone.Transport.scheduleRepeat((time) => {
            if (metronomeEnabled) {
                const position = Tone.Transport.position.split(':');
                const quarter = parseInt(position[1]);

                if (quarter % 2 === 0) {
                    metronomeOsc.triggerAttackRelease('G6', '32n', time, 1); 
                } else {
                    metronomeOsc.triggerAttackRelease('C6', '32n', time, 0.6);
                }
            }
        }, '4n');
        
        transportLoopId = Tone.Transport.scheduleRepeat((time) => {
            advanceHighlight(time);
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


async function initMidiAccess() {
    try {
        const access = await navigator.requestMIDIAccess();
        const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
        
        const selectEl = document.getElementById('midiOutputSelect');
        const toggleBtn = document.getElementById('midiToggleBtn');
        const statusEl = document.getElementById('midiStatus');

        const updateMidiList = () => {
            const currentSelection = selectEl.value;
            
            selectEl.innerHTML = '<option value="">-- Nessuno --</option>';
            
            const outputs = midiAccess.outputs.values();
            let hasOutputs = false;
            let deviceFoundAgain = false;

            for (let output of outputs) {
                hasOutputs = true;

                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name;
                selectEl.appendChild(option);

                if (output.id === currentSelection) {
                    option.selected = true;
                    deviceFoundAgain = true;
                }
            }

            if (hasOutputs) {
                toggleBtn.style.display = 'inline-block';
                if (!deviceFoundAgain && currentSelection !== "") {
                     if (statusEl) statusEl.textContent = 'MIDI: Dispositivo scollegato';
                     midiOutput = null;
                }
            } else {
                if (statusEl) statusEl.textContent = 'MIDI: nessun dispositivo trovato';
            }
        };

        updateMidiList();

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

function sendMidiNoteOn(noteNumber, velocity = 100, channel = 0) {
    if (!midiOutput) return;
    
    const noteOnMessage = [0x90 + channel, noteNumber, velocity];
    try {
        midiOutput.send(noteOnMessage);
        currentMidiNote = noteNumber;
    } catch (e) {
        console.error('Failed to send MIDI Note On:', e);
    }
}

function sendMidiNoteOff(noteNumber, channel = 0) {
    if (!midiOutput) return;
    
    const noteOffMessage = [0x80 + channel, noteNumber, 0];
    try {
        midiOutput.send(noteOffMessage);
    } catch (e) {
        console.error('Failed to send MIDI Note Off:', e);
    }
}

function playMidiNote(midiNumber) {
    if (!midiEnabled || !midiOutput) return;
    
    if (currentMidiNote !== null && currentMidiNote !== midiNumber) {
        sendMidiNoteOff(currentMidiNote);
    }
    
    sendMidiNoteOn(midiNumber, 100);
}

function stopMidiNote() {
    if (currentMidiNote !== null) {
        sendMidiNoteOff(currentMidiNote);
        currentMidiNote = null;
    }
}

async function loadSampleFromUrl(url, rootMidi = 60, name = null) {
    try {
        if (typeof Tone === 'undefined') throw new Error('Tone.js required');
        ensureToneStarted();
        
        if (samplePlayer) {
            try {
                samplePlayer.dispose();
            } catch (e) { /* ignore disposal errors */ }
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = Tone.getContext().rawContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        samplePlayer = new Tone.Player({ onload: () => {} });
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

async function loadPresetSample(name) {
  const url = PRESET_SAMPLES[name];
  if (!url) return;

  const rootMidi = 60;
  await loadSampleFromUrl(url, rootMidi, name);

  const status = document.getElementById('sampleStatus');
  if (status && name) {
    status.textContent = `Sample mode: Preset (${name})`;
  }
}


function pickSampleFile(rootMidi = 60, fileInputEl = null) {
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
        fileInputEl.value = '';
        
        const file = fileInputEl.files && fileInputEl.files[0];
        if (file) return handleFile(file);

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

function playSampleAtMidi(midi, time) {
    try {
        if (!samplePlayer || !samplePlayer.buffer) {
            console.warn('No sample loaded or buffer missing');
            return false;
        }
        
        if (!audioRoutingInitialized) {
            initializeAudioChain();
        }
        
        const root = 60;
        const semitoneShift = midi - root;
        
        console.log('Playing sample at MIDI', midi, 'shift:', semitoneShift, 'semitones');
        
        ensureToneStarted();
        pruneSampleVoices();
        
        const temp = new Tone.Player(samplePlayer.buffer);
        const cleanup = trackSampleVoice(temp);
        
        temp.connect(effectsInputNode);
        
        temp.volume.value = -4;
        
        const playbackRate = Math.pow(2, semitoneShift / 12);
        if (temp.playbackRate instanceof Tone.Signal || 
            (temp.playbackRate && typeof temp.playbackRate.value !== 'undefined')) {
            temp.playbackRate.value = playbackRate;
        } else {
            temp.playbackRate = playbackRate;
        }
        
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



function playMidiIfSelected(midi, time) {
    if (!midi || typeof midi !== 'number') return;
    
    const now = Date.now();
    if ((now - lastPlayTime) < 50) return; 

    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    
    let keyEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === midi) { keyEl = k; break; }
    }
    if (!keyEl) return;

    if (!keyEl.classList.contains('selectedKey')) return;

    try {
        if (midiEnabled && midiOutput) {
            playMidiNote(midi);
            
            lastPlayedMidi = midi;
            lastPlayTime = now;
            
            try { 
                keyEl.classList.add('playingKey'); 
                setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150); 
            } catch(e){}
            return;
        }

        if (!samplePlayer || !samplePlayer.buffer) return;
        
        playSampleAtMidi(midi, time);
        
        lastPlayedMidi = midi;
        lastPlayTime = now;
        
        try { 
            keyEl.classList.add('playingKey'); 
            setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150); 
        } catch(e){}
        
    } catch (e) {
        console.warn('Error playing note', e);
    }
}

function triggerPlayWithFallback(requestedMidi, time) {
    if (!requestedMidi || typeof requestedMidi !== 'number') return;
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;

    let directEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === requestedMidi) { directEl = k; break; }
    }

    if (directEl && directEl.classList.contains('selectedKey')) {
        playMidiIfSelected(requestedMidi, time);
        return;
    }

    let nearest = null;
    let nearestDiff = Infinity;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (!k || !k.dataset) continue;
        if (!k.classList.contains('selectedKey')) continue;
        const m = Number(k.dataset.midi);
        if (!Number.isFinite(m)) continue;
        const diff = Math.abs(m - requestedMidi);
        if (diff < nearestDiff) { nearestDiff = diff; nearest = k; }
    }

    if (nearest) {
        try {
            const midi = Number(nearest.dataset.midi);
            if (midiEnabled && midiOutput) {
                playMidiNote(midi);
                try { nearest.classList.add('playingKey'); setTimeout(() => { try { nearest.classList.remove('playingKey'); } catch(e){} }, 220); } catch(e){}
                lastPlayedMidi = midi;
                lastPlayTime = Date.now();
                return;
            }

            if (!samplePlayer || !samplePlayer.buffer) return;
            playSampleAtMidi(midi, time);
            nearest.classList.add('playingKey');
            setTimeout(() => { try { nearest.classList.remove('playingKey'); } catch(e){} }, 220);
            lastPlayedMidi = midi;
            lastPlayTime = Date.now();
        } catch (e) { /* ignore */ }
    } else {
    }
}

let xSpacing = 5;

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
                pointRadius: 0,
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

                lineShadow: { blur: 8, offsetY: 2 },
                verticalLine: {},
                horizontalSections: isPreview ? {} : false,
                dataPointLines: isPreview ? {} : false
            }
        }
    });


    
    if (isPreview) chart.isHorizontalSections = true;
    
    return chart;
}

let highlightIndex = -1;
let highlightTimer = null;
let highlightSpeed = 750;
let quantizeTimer = null;
let highlightIndexTime = -1;
let transportLoopId = null;
let originalPointIndices = [];
let currentOriginalPointIndex = -1;
let lastProcessedOriginalPointIndex = -1;

const chartTemp = createChart("chartTemp", "red");
const chartDens = createChart("chartDens", "orange");
const chartVel  = createChart("chartVel",  "green");
let selectedChartSource = 'Temp';

let chartPreview = null;
function ensurePreviewChart() {
    if (chartPreview) return;
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;
    syncPreviewHeight();
    chartPreview = createChart('chartPreview', 'green', true);
    chartPreview.data.datasets[0].data = [];
    chartPreview.update('none');
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

    const srcDs = src.data.datasets[0];
    chartPreview.data.datasets[0].data = srcDs.data.slice();
    chartPreview.data.datasets[0].borderColor = srcDs.borderColor;
    chartPreview.data.datasets[0].backgroundColor = srcDs.backgroundColor;
    chartPreview.data.datasets[0].label = srcDs.label;

    if (param === 'Temp') window.originalDataYs = window.originalDataTemp || [];
    else if (param === 'Dens') window.originalDataYs = window.originalDataDens || [];
    else if (param === 'Vel')  window.originalDataYs = window.originalDataVel || [];

    chartPreview.options.plugins.dataPointLines = {};
    try { chartPreview.update('none'); } catch (e) {}
}

function attachPreviewMouseTracking() {
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;

    canvas.addEventListener('click', (evt) => {});
}

function processMovingDotForIndex(idx, time) {
    try {
        if (!window.originalDataXs || !window.originalDataXs.length) return;
        
        if (originalPointIndices && originalPointIndices.length > 0) {
            
            const ys = window.originalDataYs || window.originalDataTemp || [];
            
            const dataIndex = currentOriginalPointIndex; 
            
            if (dataIndex >= 0 && dataIndex < ys.length) {
                if (dataIndex !== lastProcessedOriginalPointIndex) {
                    
                    const yVal = ys[dataIndex];
                    
                    if (Number.isFinite(yVal)) {
                        lastProcessedOriginalPointIndex = dataIndex;

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

                        const keyboard = document.getElementById('verticalKeyboard');
                        if (keyboard) {
                            for (let k = 0; k < keyboard.children.length; k++) {
                                keyboard.children[k].classList.remove('quantizedKey');
                            }
                            
                            for (let k = 0; k < keyboard.children.length; k++) {
                                const el = keyboard.children[k];
                                if (el && el.dataset && Number(el.dataset.midi) === midi) {
                                    el.classList.add('quantizedKey');
                                    
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
            return;
        }

        
    } catch (e) {
        console.warn("Errore process audio:", e);
    }
}

function getKeyIndexFromY(y) {
    const canvas = document.getElementById('chartPreview');
    const rect = canvas.getBoundingClientRect();
    const canvasHeight = rect.height;
    
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return -1;
    const numKeys = keyboard.children.length;
    
    const sectionHeight = canvasHeight / numKeys;
    let keyIndex = Math.floor(y / sectionHeight);
    
    keyIndex = Math.max(0, Math.min(numKeys - 1, keyIndex));
    return keyIndex;
}

function getKeyIndexFromValue(value, maxValue, minValue) {
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return -1;
    const numKeys = keyboard.children.length;
    const clampedValue = Math.max(minValue, Math.min(maxValue, value));
    const ratio = (clampedValue - minValue) / (maxValue - minValue);
    let keyIndex = Math.floor(ratio * numKeys);
    keyIndex = Math.max(0, Math.min(numKeys - 1, keyIndex));
    return keyIndex;

}


let audioRoutingInitialized = false;
let effectsInputNode = null;
let effectsOutputNode = null;

function initializeAudioChain() {
    if (audioRoutingInitialized) return;
    
    try {
        ensureToneStarted();
        
        reverb = new Tone.Reverb({ decay: 1.5, wet: 0 });
        distortion = new Tone.Distortion({ distortion: 0, wet: 0 });
        chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.5, wet: 0 });
        
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
        
        delay.chain(chorus, distortion, reverb, eqHighpassFilter, eqLowpassFilter, masterVolume);
        
        effectsInputNode = delay;
        effectsOutputNode = masterVolume;
        
        audioRoutingInitialized = true;
        console.log('✅ Audio chain initialized:');
        console.log('   Source → Delay → Chorus → Distortion → Reverb → HP Filter → LP Filter → Volume → Destination');
        
    } catch (e) {
        console.error('❌ Failed to initialize audio chain:', e);
    }
}

function setEQEnabled(enabled) {
    eqEnabled = enabled;
    
    if (eqHighpassFilter && eqLowpassFilter) {
        if (enabled) {
            eqHighpassFilter.frequency.rampTo(eqHighpassFreq, 0.05);
            eqLowpassFilter.frequency.rampTo(eqLowpassFreq, 0.05);
        } else {
            eqHighpassFilter.frequency.rampTo(20, 0.05);
            eqLowpassFilter.frequency.rampTo(20000, 0.05);
        }
    }
    
    console.log(`EQ ${enabled ? 'enabled' : 'disabled'}`);
}


function initRecorder() {
    try {
        if (recorder) {
            try { recorder.dispose(); } catch (e) {}
            recorder = null;
        }
        
        recorder = new Tone.Recorder({
            mimeType: 'audio/webM'
        });
        
        if (mainLimiter) {
            mainLimiter.connect(recorder);
            console.log('✅ Recorder connected to mainLimiter');
        } else if (mainCompressor) {
            mainCompressor.connect(recorder);
            console.log('✅ Recorder connected to mainCompressor');
        } else if (masterVolume) {
            masterVolume.connect(recorder);
            console.log('✅ Recorder connected to masterVolume');
        } else {
            console.error('❌ No audio node found to connect recorder');
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('❌ Failed to initialize recorder:', e);
        return false;
    }
}

async function startRecording() {
    try {
        await ensureToneStarted();
        
        if (!initRecorder()) {
            throw new Error('Failed to initialize recorder');
        }
        
        await recorder.start();
        
        isRecording = true;
        recordingStartTime = Date.now();
        recordingDuration = 0;
        
        recordingTimerInterval = setInterval(() => {
            recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
            updateRecordingUI();
        }, 100);
        
        console.log('✅ Recording started');
        return true;
        
    } catch (e) {
        console.error('❌ Failed to start recording:', e);
        isRecording = false;
        return false;
    }
}

async function stopRecording() {
    try {
        if (!recorder || !isRecording) {
            console.warn('No active recording to stop');
            return false;
        }
        
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }
        
        const recording = await recorder.stop();
        
        if (!recording || recording.size === 0) {
            throw new Error('Recording is empty or corrupted');
        }
        
        console.log(`✅ Recording stopped (${recordingDuration}s, ${(recording.size / 1024).toFixed(2)} KB)`);
        console.log(`📦 MIME type: ${recording.type}`);
        
        let extension = 'webm';
        if (recording.type.includes('wav')) extension = 'wav';
        else if (recording.type.includes('ogg')) extension = 'ogg';
        else if (recording.type.includes('mp3')) extension = 'mp3';
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `sun-synth-${timestamp}.${extension}`;
        
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement('a');
        anchor.download = filename;
        anchor.href = url;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        
        setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            console.log('✅ Download completed, URL cleaned up');
        }, 1000);
        
        isRecording = false;
        
        if (recorder) {
            try { recorder.dispose(); } catch (e) {}
            recorder = null;
        }
        
        return true;
        
    } catch (e) {
        console.error('❌ Failed to stop recording:', e);
        isRecording = false;
        
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }
        
        return false;
    }
}

function updateRecordingUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (!recordBtn) return;
    
    if (isRecording) {
        const minutes = Math.floor(recordingDuration / 60);
        const seconds = recordingDuration % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        
        recordBtn.style.animation = 'pulse 1s ease-in-out infinite';
    } else {
        recordBtn.style.animation = 'none';
    }
}

function setupRecordButton() {
    const recordBtn = document.getElementById('recordBtn');
    if (!recordBtn) return;
    
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            recordBtn.classList.add('recording');
            const success = await startRecording();
            
            if (!success) {
                recordBtn.classList.remove('recording');
                alert('Errore durante l\'avvio della registrazione. Verifica la console.');
            } else {
                updateRecordingUI();
            }
        } else {
            recordBtn.classList.remove('recording');
            const success = await stopRecording();
            
            if (!success) {
                alert('Errore durante il salvataggio della registrazione. Verifica la console.');
            }
            
            updateRecordingUI();
        }
    });
    
    console.log('✅ Record button setup complete');
}

const recordButtonStyle = `
<style>
@keyframes pulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        background: rgba(239, 68, 68, 0.2);
    }
    50% {
        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
        background: rgba(239, 68, 68, 0.4);
    }
}

#recordBtn.recording {
    border-color: #ef4444;
    color: #ef4444;
}
</style>
`;

if (!document.getElementById('record-button-style')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'record-button-style';
    styleEl.innerHTML = recordButtonStyle;
    document.head.appendChild(styleEl);
}

document.addEventListener('DOMContentLoaded', () => {
    const chartBoxes = document.querySelectorAll('.chart-box');
    chartBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const src = box.getAttribute('data-chart-source');
            if (src) setSelectedChart(src);
        });
    });

    setSelectedChart(selectedChartSource);
    
    syncPreviewHeight();
    setupPreviewKeyboardSync();

    
    const knobAssignments = {};
    window.knobAssignments = knobAssignments;
    let draggedChart = null;

    function updateKnobVisual(knobElement, chartSource) {
        const effectParam = knobElement.closest('.effect-param');
        if (!effectParam) return;
        
        effectParam.classList.remove('assigned-temp', 'assigned-dens', 'assigned-vel');
        
        if (chartSource === 'Temp') {
            effectParam.classList.add('assigned-temp');
        } else if (chartSource === 'Dens') {
            effectParam.classList.add('assigned-dens');
        } else if (chartSource === 'Vel') {
            effectParam.classList.add('assigned-vel');
        }
    }

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

        const values = data.map(d => d.y).filter(v => Number.isFinite(v));
        if (values.length === 0) return null;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        const currentValue = data[index].y;
        if (!Number.isFinite(currentValue)) return null;
        
        if (max === min) return 50;
        return ((currentValue - min) / (max - min)) * 100;
    }

    function updateKnobFromChart(knobId, chartSource, index) {
        if (typeof index === 'undefined' || index === null) index = highlightIndex;
        if (index < 0) return;

        const normalizedValue = getNormalizedChartValue(chartSource, index);
        if (normalizedValue === null) return;

        const knobElement = document.getElementById(knobId);
        if (!knobElement) return;

        window.knobAngles = window.knobAngles || {};
        const minAngle = -135;
        const maxAngle = 135;
        const targetAngle = minAngle + (normalizedValue / 100) * (maxAngle - minAngle);

        if (typeof window.knobAngles[knobId] !== 'number') {
            const m = (knobElement.style.transform || '').match(/-?\d+\.?\d*/);
            window.knobAngles[knobId] = m ? parseFloat(m[0]) : targetAngle;
        }

        animateKnobRotation(knobId, knobElement, targetAngle, 150);
        animateEffectParameter(knobId, normalizedValue, 150);
    }

    function animateKnobRotation(knobId, knobElement, targetAngle, duration = 150) {
        const startAngle = window.knobAngles && typeof window.knobAngles[knobId] === 'number'
            ? window.knobAngles[knobId]
            : targetAngle;
        const startTime = performance.now();

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const p = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const current = startAngle + (targetAngle - startAngle) * p;
            knobElement.style.transform = `rotate(${current}deg)`;
            window.knobAngles[knobId] = current;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

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

    function updateEffectParameter(knobId, value) {
        const paramMap = {
            'reverbDecayKnob': () => reverb.decay = (value / 100) * 10,
            'reverbWetKnob': () => reverb.wet.value = value / 100,
        };

        if (paramMap[knobId]) {
            paramMap[knobId]();
        }
    }

    chartBoxes.forEach(box => {
        box.addEventListener('dragstart', (e) => {
            draggedChart = box.getAttribute('data-chart-source');
            box.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', draggedChart);
            
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
            
            const allKnobs = document.querySelectorAll('.effect-knob, .knob');
            allKnobs.forEach(knob => {
                knob.classList.remove('glow-available');
                knob.classList.remove('glow-assigned');
            });
        });
    });

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
                knobAssignments[knobId] = chartSource;
                
                updateKnobVisual(knob, chartSource);
                
                updateKnobFromChart(knobId, chartSource);
            }
        });
    });

    function updateAllAssignedKnobs(index) {
        if (typeof index === 'undefined' || index === null) {
            index = highlightIndex;
        }
        
        Object.keys(knobAssignments).forEach(knobId => {
            const chartSource = knobAssignments[knobId];
            updateKnobFromChart(knobId, chartSource, index);
        });
    }

    window.updateAllAssignedKnobs = updateAllAssignedKnobs;

    const modePresetsBtn = document.getElementById('modePresetsBtn');
    const modeMidiBtn = document.getElementById('modeMidiBtn');
    const modePresetsPanel = document.getElementById('modePresetsPanel');
    const modeMidiPanel = document.getElementById('modeMidiPanel');

    function setMode(mode) {
        const isPresets = mode === 'presets';

        modePresetsBtn.classList.toggle('active', isPresets);
        modePresetsBtn.setAttribute('aria-selected', String(isPresets));
        modeMidiBtn.classList.toggle('active', !isPresets);
        modeMidiBtn.setAttribute('aria-selected', String(!isPresets));

        modePresetsPanel.style.display = isPresets ? 'block' : 'none';
        modeMidiPanel.style.display = isPresets ? 'none' : 'block';

        try {
            if (isPresets) {
                if (typeof midiEnabled !== 'undefined') midiEnabled = false;
                const statusEl = document.getElementById('midiStatus');
                if (statusEl) statusEl.textContent = 'MIDI: inattivo';
            } else {
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
        setMode('presets');
    }

    
    const contextMenu = document.getElementById('knobContextMenu');
    const removeControlItem = document.getElementById('removeControl');
    let contextMenuKnob = null;

    function removeKnobAssignment(knobId) {
        if (!knobId || !knobAssignments[knobId]) return;
        
        delete knobAssignments[knobId];
        
        const knobElement = document.getElementById(knobId);
        if (knobElement) {
            const effectParam = knobElement.closest('.effect-param');
            if (effectParam) {
                effectParam.classList.remove('assigned-temp', 'assigned-dens', 'assigned-vel');
            }
        }
    }

    allKnobs.forEach(knob => {
        knob.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            const knobId = knob.id;
            
            if (knobId && knobAssignments[knobId]) {
                contextMenuKnob = knobId;
                
                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.style.display = 'block';
            }
        });
    });

    removeControlItem.addEventListener('click', () => {
        if (contextMenuKnob) {
            removeKnobAssignment(contextMenuKnob);
            contextMenuKnob = null;
        }
        contextMenu.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            contextMenuKnob = null;
        }
    });

    document.addEventListener('scroll', () => {
        contextMenu.style.display = 'none';
        contextMenuKnob = null;
    });



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

    try {
        initializeAudioChain();
    } catch (e) {
        console.error('Failed to initialize effects:', e);
    }
    

    try {
        setupEffectKnob('distortionDriveKnob', (value) => {
            if (distortion) distortion.distortion = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('distortionToneKnob', (value) => {
            if (distortion) distortion.distortion = Math.max(0, distortion.distortion) * (0.5 + value * 0.5);
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('distortionMixKnob', (value) => {
            if (distortion) distortion.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        setupEffectKnob('chorusDepthKnob', (value) => {
            if (chorus) chorus.depth = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('chorusRateKnob', (value) => {
            if (chorus) chorus.frequency.value = 0.1 + value * 9.9;
        }, 0, (v) => `${(0.1 + v * 9.9).toFixed(1)} Hz`);
        
        setupEffectKnob('chorusMixKnob', (value) => {
            if (chorus) chorus.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        setupEffectKnob('delayTimeKnob', (value) => {
            if (delay) delay.delayTime.value = 0.01 + value * 0.99;
        }, 0, (v) => `${((0.01 + v * 0.99) * 1000).toFixed(0)} ms`);
        
        setupEffectKnob('delayFeedbackKnob', (value) => {
            if (delay) delay.feedback.value = value * 0.9;
        }, 0, (v) => `${Math.round(v * 90)}%`);
        
        setupEffectKnob('delayMixKnob', (value) => {
            if (delay) delay.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        setupEffectKnob('reverbDecayKnob', (value) => {
            if (reverb) reverb.decay = 0.1 + value * 9.9;
        }, 0, (v) => `${(0.1 + v * 9.9).toFixed(1)} s`);
        
        setupEffectKnob('reverbMixKnob', (value) => {
            if (reverb) reverb.wet.value = value;
        }, 0, (v) => `${Math.round(v * 100)}%`);
        
        setupEffectKnob('reverbSizeKnob', (value) => {
            if (reverb) reverb.preDelay = value * 0.1;
        }, 0, (v) => `${Math.round(v * 100)}%`);

        document.querySelectorAll('.effect-toggle').forEach(toggle => {
            if (toggle.id === 'eqToggleBtn') return;
            
            toggle.addEventListener('click', function() {
                this.classList.toggle('active');
                const effectName = this.getAttribute('data-effect');
                const isActive = this.classList.contains('active');
                
                this.textContent = isActive ? 'ON' : 'OFF';
                
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

});

window.addEventListener('resize', () => {
    syncPreviewHeight();
});


chartTemp.data.datasets[0].label = "Temperatura";
        chartDens.data.datasets[0].label = "Densità (protons/cm^3)";
        chartVel.data.datasets[0].label  = "Velocità (km/s)";
function attachSync(master, slaves) {
    const canvas = master.canvas;
    canvas.addEventListener('mousemove', (evt) => {
        const points = master.getElementsAtEventForMode(evt, 'nearest', { intersect: false });
        if (!points.length) return;
        const idx = points[0].index;


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



        const ONE_HOUR = 60 * 60 * 1000;
        const maxTime = pts.length ? pts[pts.length - 1].t.getTime() : Date.now();
        const ptsUsed = pts.filter(p => p.t.getTime() >= maxTime - ONE_HOUR);



        const xs   = ptsUsed.map(p => p.t.getTime());
        const dens = ptsUsed.map(p => p.dens);
        const vel  = ptsUsed.map(p => p.vel);
        const temp = ptsUsed.map(p => p.temp);
        
        window.originalDataXs = xs;
        window.originalDataTemp = temp;
        window.originalDataDens = dens;
        window.originalDataVel = vel;
        window.originalDataYs = temp;

        const NUM = 300;
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        if (minX === maxX) maxX = minX + 1;
        const newXs = Array.from({length: NUM}, (_, i) =>
            minX + (i / (NUM - 1)) * (maxX - minX)
        ).filter(x => x >= minX && x <= maxX);

        const tempInterp = interpolateLinear(xs, temp, newXs);
        const densInterp = interpolateLinear(xs, dens, newXs);
        const velInterp  = interpolateLinear(xs, vel,  newXs);

        chartTemp.data.datasets[0].data = newXs.map((x, i) => ({ x, y: tempInterp[i] }));
        chartDens.data.datasets[0].data = newXs.map((x, i) => ({ x, y: densInterp[i] }));
        chartVel.data.datasets[0].data  = newXs.map((x, i) => ({ x, y: velInterp[i] }));

        originalPointIndices = [];
        for (let i = 0; i < xs.length; i++) {
            const originalX = xs[i];
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

        updatePreview(selectedChartSource);

        if (typeof window.updateAllAssignedKnobs === 'function') {
            window.updateAllAssignedKnobs();
        }

        realHighlightIndex = realHighlightIndex - xSpacing - 1;
        highlightIndex = realHighlightIndex;
        advanceHighlight();

    } catch (e) {
        console.error("Errore fetching NOAA:", e);
    }
}



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

    if (originalPointIndices && originalPointIndices.length > 0) {
        const prevIndex = currentOriginalPointIndex;
        currentOriginalPointIndex = (currentOriginalPointIndex + 1) % originalPointIndices.length;
        
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
            lastProcessedOriginalPointIndex = -1;
        }
        highlightIndex = next;
        realHighlightIndex = next;
    }
    
    currIdxTime = indexToTime(chartTemp, highlightIndex);
    
    if(currIdxTime !== highlightIndexTime) {
        highlightIndexTime = currIdxTime;
        processMovingDotForIndex(highlightIndex, time);
        
        if (typeof window.updateAllAssignedKnobs === 'function') {
            window.updateAllAssignedKnobs(highlightIndex);
        }
    }

    Tone.Draw.schedule(() => {
        updateHighlightRender();
    }, time);
}

 
function startHighlighting(speedMs = 200) {
    highlightSpeed = speedMs;
    ensureToneStarted();
    
    if (!chartTemp.data.datasets[0].data.length) {
        realHighlightIndex = -1;
        highlightIndex = -1;
        if (highlightTimer !== null) clearInterval(highlightTimer);
        highlightTimer = setInterval(() => {
            if (chartTemp.data.datasets[0].data.length) {
                clearInterval(highlightTimer);
                highlightTimer = 'transport';
                if (Tone.Transport.state !== 'started') {
                    Tone.Transport.start();
                }
            }
        }, 200);
        return;
    }

    if (highlightIndex === -1 || realHighlightIndex === -1) {
        currentOriginalPointIndex = -1;
        highlightIndex = -1;
        realHighlightIndex = -1;
        lastProcessedOriginalPointIndex = -1;
    }
    
    highlightTimer = 'transport';
    
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }
    
    console.log('Transport started, BPM:', Tone.Transport.bpm.value, 'Will start from first point');
}

function stopHighlighting() {
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
    
    lastProcessedOriginalPointIndex = -1;
    
    try {
        const keyboard = document.getElementById('verticalKeyboard');
        if (keyboard) for (let k = 0; k < keyboard.children.length; k++) keyboard.children[k].classList.remove('quantizedKey');
    } catch (e) {}
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

function getSelectedChart() {
    const value = selectedChartSource || 'Temp';
    if (value === 'Temp') return { chart: chartTemp, label: 'Temperatura' };
    if (value === 'Dens') return { chart: chartDens, label: 'Densità' };
    return { chart: chartVel, label: 'Velocità' };
}

    function logCurrentSelectedValue() {
        const q = quantizeCurrentSelectedValueToRange(35);
        if (q < 0) {
            console.log('Nessun punto evidenziato o quantizzazione non disponibile');
            return null;
        }
        console.log(`Quantizzato (0..34): ${q}`);
        return q;
}

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

function setupEffectKnob(knobId, callback, defaultValue = 0, valueFormatter = null) {
    const knob = document.getElementById(knobId);
    if (!knob) return;
    
    let isDragging = false;
    let startY = 0;
    let startValue = 0;
    
    const effectParam = knob.closest('.effect-param');
    const paramLabel = effectParam ? effectParam.querySelector('.param-label') : null;
    let originalLabelText = paramLabel ? paramLabel.textContent : '';
    
    const updateKnobRotation = (value) => {
        const angle = -135 + value * 270;
        knob.style.transform = `rotate(${angle}deg)`;
    };
    
    updateKnobRotation(0);
    
    knob.addEventListener('dblclick', (e) => {
        updateKnobRotation(defaultValue);
        callback(defaultValue);
        e.preventDefault();
    });
    
    knob.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        const transform = knob.style.transform;
        const match = transform.match(/rotate\(([^)]+)deg\)/);
        if (match) {
            const angle = parseFloat(match[1]);
            startValue = (angle + 135) / 270;
        } else {
            startValue = 0;
        }
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY;
        
        const hasChartAssigned = window.knobAssignments && window.knobAssignments[knobId];
        const sensitivity = hasChartAssigned ? 0.002 : 0.005;
        
        let newValue = startValue + (deltaY * sensitivity);
        newValue = Math.max(0, Math.min(1, newValue));
        
        updateKnobRotation(newValue);
        callback(newValue);
        
        if (!hasChartAssigned && paramLabel && valueFormatter) {
            paramLabel.textContent = valueFormatter(newValue);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
            const hasChartAssigned = window.knobAssignments && window.knobAssignments[knobId];
            if (!hasChartAssigned && paramLabel) {
                paramLabel.textContent = originalLabelText;
            }
        }
    });
}

const speedKnobControl = document.getElementById('speedKnobControl');
const speedValue = document.getElementById('speedValue');
const playPauseBtn = document.getElementById('playPauseBtn');
let isPlaying = false;

function msToBpm(ms) {
    return Math.round(60000 / ms);
}

function bpmToMs(bpm) {
    return Math.round(60000 / bpm);
}

if (speedKnobControl) {
    let isDragging = false;
    let startY = 0;
    let startSpeed = highlightSpeed;
    const minBpm = 80;
    const maxBpm = 190;
    const minSpeed = bpmToMs(maxBpm);
    const maxSpeed = bpmToMs(minBpm);
    

    const updateKnobRotation = (speed) => {
        const t = 1 - (speed - minSpeed) / (maxSpeed - minSpeed);
        const angle = -135 + t * 270;
        speedKnobControl.style.transform = `rotate(${angle}deg)`;
    };

    if (speedValue) {
        speedValue.style.cursor = "pointer";
        speedValue.title = "Doppio click per inserire BPM";

        speedValue.addEventListener('dblclick', () => {
            const currentText = speedValue.textContent;
            const currentBpm = parseInt(currentText) || 120;

            const input = document.createElement('input');
            input.type = 'number';
            input.value = currentBpm;
            
            input.style.width = '50px';
            input.style.background = 'transparent';
            input.style.color = '#fbbf24';
            input.style.border = '1px solid #fbbf24';
            input.style.borderRadius = '4px';
            input.style.fontFamily = '"Space Mono", monospace';
            input.style.fontSize = '11px';
            input.style.textAlign = 'center';
            input.style.outline = 'none';

            speedValue.textContent = ''; 
            speedValue.appendChild(input);
            input.focus();
            input.select();

            const commitBpm = () => {
                let newVal = parseInt(input.value);

                if (isNaN(newVal)) newVal = currentBpm;
                newVal = Math.max(minBpm, Math.min(maxBpm, newVal));

                const newMs = bpmToMs(newVal);

                setHighlightSpeed(newMs);
                updateKnobRotation(newMs);
                updateMetronomeBPM(newVal);
                
                speedValue.textContent = `${newVal} BPM`;
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    commitBpm();
                }
                if (e.key === 'Escape') {
                    speedValue.textContent = `${currentBpm} BPM`;
                }
            });

            input.addEventListener('blur', () => {
                commitBpm();
            });
        });
    }
    
    speedKnobControl.addEventListener('dblclick', (e) => {
        const defaultSpeed = 500; 
        
        setHighlightSpeed(defaultSpeed);
        updateKnobRotation(defaultSpeed);
        
        const bpm = msToBpm(defaultSpeed);
        
        if (speedValue) speedValue.textContent = `${bpm} BPM`;
        
        updateMetronomeBPM(bpm);
        
        e.preventDefault();
    });

    speedKnobControl.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startSpeed = highlightSpeed;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
        
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = startY - e.clientY;
        const sensitivity = 5;
        
        let newSpeed = startSpeed - (deltaY * sensitivity);
        
        newSpeed = Math.max(minSpeed, Math.min(maxSpeed, newSpeed));
        newSpeed = Math.round(newSpeed);
        
        if (newSpeed !== highlightSpeed) {
            setHighlightSpeed(newSpeed);
            updateKnobRotation(newSpeed);
            const bpm = msToBpm(newSpeed);
            if (speedValue) speedValue.textContent = `${bpm} BPM`;
            updateMetronomeBPM(bpm);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            
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

const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopHighlighting();
            playPauseBtn.classList.remove('playing');
            isPlaying = false;
        }
        highlightIndex = -1;
        realHighlightIndex = -1;
        highlightIndexTime = null;
        currIdxTime = null;
        currentOriginalPointIndex = -1;
        lastProcessedOriginalPointIndex = -1;
        
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            console.log('Transport position reset to 0');
        }
        
        updateHighlightRender();
        console.log('Cursor reset to initial position');
    });
}

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
    });
}

setupRecordButton();

attachVolumeSlider();


const SCALES = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:    [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian:          [0, 2, 3, 5, 7, 9, 10]
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
    syncPreviewHeight();

    try {
        const keys = keyboard.children;
        const numKeys = keys.length;
        for (let i = 0; i < numKeys; i++) {
            const midi = 48 + (numKeys - 1 - i);
            keys[i].dataset.midi = String(midi);
        }
    } catch (e) { /* noop */ }
}

function syncPreviewHeight() {
    const canvas = document.getElementById('chartPreview');
    if (!canvas) return;

    const previewBox = canvas.closest('.preview-box');
    if (!previewBox) return;

    const kbCont = document.getElementById('keyboardContainer');
    const devicePR = window.devicePixelRatio || 1;

    let keyboardHeight = 0;
    if (kbCont) {
        keyboardHeight = Math.max(kbCont.offsetHeight || 0, kbCont.scrollHeight || 0);
    } else {
        keyboardHeight = previewBox.clientHeight;
    }

    try { previewBox.style.height = keyboardHeight + 'px'; } catch (e) {}

    const padding = 30;
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
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
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
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
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

    const scaleSelect = document.getElementById('scaleSelect');
    const scaleName = scaleSelect ? scaleSelect.value : '';

    const rootNoteSelect = document.getElementById('rootNoteSelect');
    const rootValue = rootNoteSelect ? parseInt(rootNoteSelect.value) : 0; 

    for (let i = 0; i < numKeys; i++) {
        keys[i].classList.remove('scaleKey');
        keys[i].classList.remove('selectedKey');
    }

    if (!scaleName || !SCALES[scaleName]) return;

    const intervals = SCALES[scaleName];

    for (let i = 0; i < numKeys; i++) {
        const keyEl = keys[i];
        const midi = Number(keyEl.dataset.midi);
        
        if (!Number.isFinite(midi)) continue;

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

    maxValue = getSelectedChartMax();
    minValue = getSelectedChartMin();
    if (maxValue === null || minValue === null) return;
    const key = getKeyIndexFromValue(chart.data.datasets[0].data[highlightIndex] ? chart.data.datasets[0].data[highlightIndex].y : 0, maxValue, minValue);

    for (let k = 0; k < keys.length; k++) {
        keys[k].classList.remove('quantizedKey');
    }

    if (key >= 0 && key < numKeys) {
        const target = keys[numKeys - 1 - key];
        if (target) {
            target.classList.add('quantizedKey');
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

    if (point) {
        const date = new Date(point.x);
        const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return timeStr;
    }

}



drawVerticalKeyboard();

applyScaleToKeyboard();

updateCharts();
setInterval(updateCharts, 60_000);

const presetSelect = document.getElementById('presetSampleSelect');
if (presetSelect) {
  presetSelect.addEventListener('change', (e) => {
    const name = e.target.value;
    const status = document.getElementById('sampleStatus');

    if (!name) {
      samplePlayer = null;
      sampleLoadedName = null;
            if (status) status.textContent = 'Sample mode: no sample';
      return;
    }

    loadPresetSample(name);
  });

    if (presetSelect.value) {
        try { loadPresetSample(presetSelect.value); } catch (e) { console.warn('Preset autoload failed', e); }
    }
}


const scaleSelectEl = document.getElementById('scaleSelect');
if (scaleSelectEl) {
    scaleSelectEl.addEventListener('change', () => {
        applyScaleToKeyboard();
    });
}

const rootNoteSelectEl = document.getElementById('rootNoteSelect');
if (rootNoteSelectEl) {
    rootNoteSelectEl.addEventListener('change', () => {
        applyScaleToKeyboard();
    });
}


