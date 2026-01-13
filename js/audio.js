export let toneSynth = null;
export let fftAnalyser = null;
export let audioFilter = null;
export let mainLimiter = null;
export let mainCompressor = null;
export let masterVolume = null;
export let toneStarted = false;
export let lastPlayedMidi = null;
export let lastPlayTime = 0;

// Import setupEffectKnob from ui module
import { setupEffectKnob as uiSetupEffectKnob } from './ui.js';
const setupEffectKnob = uiSetupEffectKnob;export function setLastPlayedMidi(midi) {
    lastPlayedMidi = midi;
}

export function setLastPlayTime(time) {
    lastPlayTime = time;
}
export const playCooldown = 150;
export let samplePlayer = null;
export let sampleLoadedName = null;
export const MAX_POLYPHONY = 8;
export const activeSampleVoices = [];
export let outputMeter = null;
export let meterAnimationId = null;
export const VOLUME_MIN = -40;
export const VOLUME_MAX = 6;
export let currentVolumeDb = 0;
export const SNAP_THRESHOLD = 0.3;
export let metronomeEnabled = false;
export let metronomeOsc = null;
export let metronomePanner = null;
export let metronomeVolume = null;

export let reverb = null;
export let distortion = null;
export let chorus = null;
export let delay = null;

export let audioRoutingInitialized = false;
export let effectsInputNode = null;
export let effectsOutputNode = null;

// Audio state object - mutabile per permettere aggiornamenti da spectrum.js
export const audioState = {
    eqEnabled: false,
    eqHighpassFreq: 20,
    eqLowpassFreq: 20000,
    eqHighpassQ: 0.7071,
    eqLowpassQ: 0.7071,
    eqHighpassRolloff: -12,
    eqLowpassRolloff: -12,
    eqHighpassFilter: null,
    eqLowpassFilter: null,
    eqDraggingFilter: null,
    midiEnabled: false
};

// Getter/Setter per compatibilità
export let eqEnabled = false;
export let eqHighpassFreq = 20;
export let eqLowpassFreq = 20000;
export let eqHighpassQ = 0.7071;
export let eqLowpassQ = 0.7071;
export let eqHighpassRolloff = -12;
export let eqLowpassRolloff = -12;
export let eqHighpassFilter = null;
export let eqLowpassFilter = null;
export let eqDraggingFilter = null;

export const EQ_MIN_FREQ = 20;
export const EQ_MAX_FREQ = 20000;
export const EQ_MIN_Q = 0.1;
export const EQ_MAX_Q = 20;
export const EQ_VALID_ROLLOFFS = [-12, -24, -48, -96];

export const PRESET_SAMPLES = {
    afterglow: 'suoni/afterglow.wav',
    ember: 'suoni/ember.wav',
    kelvin: 'suoni/kelvin.wav',
    lumen: 'suoni/lumen.wav',
    parsec: 'suoni/parsec.wav',
    photon: 'suoni/photon.wav',
    halo: 'suoni/halo.wav'
};

// Setter per sincronizzare audioState con variabili locali
export function syncAudioState() {
    audioState.eqEnabled = eqEnabled;
    audioState.eqHighpassFreq = eqHighpassFreq;
    audioState.eqLowpassFreq = eqLowpassFreq;
    audioState.eqHighpassQ = eqHighpassQ;
    audioState.eqLowpassQ = eqLowpassQ;
    audioState.eqHighpassRolloff = eqHighpassRolloff;
    audioState.eqLowpassRolloff = eqLowpassRolloff;
    audioState.eqHighpassFilter = eqHighpassFilter;
    audioState.eqLowpassFilter = eqLowpassFilter;
}

// Functions for spectrum.js to update EQ from drag/scroll
export function setEQHighpassFreq(freq) {
    eqHighpassFreq = freq;
    audioState.eqHighpassFreq = freq;
    if (eqHighpassFilter) {
        eqHighpassFilter.frequency.rampTo(freq, 0.05);
    }
}

export function setEQLowpassFreq(freq) {
    eqLowpassFreq = freq;
    audioState.eqLowpassFreq = freq;
    if (eqLowpassFilter) {
        eqLowpassFilter.frequency.rampTo(freq, 0.05);
    }
}

export function setEQHighpassRolloff(rolloff) {
    eqHighpassRolloff = rolloff;
    audioState.eqHighpassRolloff = rolloff;
    if (eqHighpassFilter) {
        eqHighpassFilter.rolloff = rolloff;
    }
}

export function setEQLowpassRolloff(rolloff) {
    eqLowpassRolloff = rolloff;
    audioState.eqLowpassRolloff = rolloff;
    if (eqLowpassFilter) {
        eqLowpassFilter.rolloff = rolloff;
    }
}

export function ensureToneStarted() {
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
        }
        if (!toneSynth) toneSynth = new Tone.Synth({ oscillator: { type: 'sine' } }).connect(masterVolume);
        
        if (!fftAnalyser && masterVolume) {
            fftAnalyser = new Tone.FFT(512);
            masterVolume.connect(fftAnalyser);
            
            // Initialize spectrum visualization
            import('./spectrum.js').then(spectrumModule => {
                spectrumModule.initSpectrum(fftAnalyser);
                // setupSpectrumCanvasInteraction is called from main.js after window.setEQ* functions are set
            }).catch(e => console.warn('Failed to init spectrum:', e));
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

export function setMasterVolume(volumeDb) {
    ensureToneStarted();
    const clamped = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, volumeDb));
    currentVolumeDb = clamped;
    if (masterVolume) masterVolume.volume.value = clamped;
}

export function initMetronome() {
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
        
        console.log('Metronome initialized');
    } catch (e) {
        console.warn('Failed to initialize metronome', e);
    }
}

export function updateMetronomeBPM(bpm) {
    try {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.bpm.value = bpm;
        }
    } catch (e) {
        console.warn('Failed to update metronome BPM', e);
    }
}

export async function loadSampleFromUrl(url, rootMidi = 60, name = null) {
    try {
        if (typeof Tone === 'undefined') throw new Error('Tone.js required');
        ensureToneStarted();
        
        if (samplePlayer) {
            try {
                samplePlayer.dispose();
            } catch (e) {}
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

export async function loadPresetSample(name) {
    const url = PRESET_SAMPLES[name];
    if (!url) return;

    const rootMidi = 60;
    await loadSampleFromUrl(url, rootMidi, name);

    const status = document.getElementById('sampleStatus');
    if (status && name) {
        status.textContent = `Sample mode: Preset (${name})`;
    }
}

export function pickSampleFile(rootMidi = 60, fileInputEl = null) {
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

export function pruneSampleVoices() {
    while (activeSampleVoices.length >= MAX_POLYPHONY) {
        const old = activeSampleVoices.shift();
        try { old.stop(); } catch (e) {}
        try { old.dispose(); } catch (e) {}
    }
}

export function trackSampleVoice(player) {
    if (!player) return () => {};
    const cleanup = () => {
        const idx = activeSampleVoices.indexOf(player);
        if (idx !== -1) activeSampleVoices.splice(idx, 1);
    };
    player.onstop = cleanup;
    activeSampleVoices.push(player);
    return cleanup;
}

export function playSampleAtMidi(midi, time) {
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

export function initializeAudioChain() {
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
        console.log('Audio chain initialized');
        
    } catch (e) {
        console.error('Failed to initialize audio chain:', e);
    }
}

export function setEQEnabled(enabled) {
    eqEnabled = enabled;
    audioState.eqEnabled = enabled;
    
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

export function setMetronomeEnabled(enabled) {
    metronomeEnabled = enabled;
}

export function createEQFilters() {
    if (!eqHighpassFilter) {
        eqHighpassFilter = new Tone.Filter({
            type: 'highpass',
            frequency: eqHighpassFreq,
            rolloff: eqHighpassRolloff,
            Q: eqHighpassQ
        });
        if (masterVolume) eqHighpassFilter.connect(masterVolume);
        audioState.eqHighpassFilter = eqHighpassFilter;
    }
    
    if (!eqLowpassFilter) {
        eqLowpassFilter = new Tone.Filter({
            type: 'lowpass',
            frequency: eqLowpassFreq,
            rolloff: eqLowpassRolloff,
            Q: eqLowpassQ
        });
        if (eqHighpassFilter) eqLowpassFilter.connect(eqHighpassFilter);
        audioState.eqLowpassFilter = eqLowpassFilter;
    }
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

function updateDbReadout(volumeDb) {
    const readout = document.getElementById('dbReadout');
    if (!readout) return;
    const val = volumeDb === 0 ? '0' : volumeDb.toFixed(1);
    readout.textContent = `${val} dB`;
}

function attachVolumeSlider() {
    const thumb = document.getElementById('volumeThumb');
    const slider = document.querySelector('.volume-slider');
    if (!thumb || !slider) return;

    const updateThumb = (volumeDb) => {
        const pct = (volumeDb - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN);
        thumb.style.left = `${pct * 100}%`;
    };

    const applyVolumeFromEvent = (evt) => {
        const rect = slider.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        let volumeDb = VOLUME_MIN + pct * (VOLUME_MAX - VOLUME_MIN);
        if (Math.abs(volumeDb) < SNAP_THRESHOLD) volumeDb = 0;
        const rounded = Math.round(volumeDb * 10) / 10;
        updateThumb(rounded);
        setMasterVolume(rounded);
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


function setupEffectToggle(effectName) {
    const toggleBtns = document.querySelectorAll(`[data-effect="${effectName}"]`);
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (effectName === 'eq') {
                // Special handling for EQ
                eqEnabled = !eqEnabled;
                audioState.eqEnabled = eqEnabled;
                
                if (eqEnabled) {
                    btn.classList.add('active');
                    btn.textContent = 'ON';
                } else {
                    btn.classList.remove('active');
                    btn.textContent = 'OFF';
                }
                
                // Update filter frequencies based on eqEnabled state
                if (eqHighpassFilter && eqLowpassFilter) {
                    if (eqEnabled) {
                        eqHighpassFilter.frequency.rampTo(eqHighpassFreq, 0.05);
                        eqLowpassFilter.frequency.rampTo(eqLowpassFreq, 0.05);
                    } else {
                        eqHighpassFilter.frequency.rampTo(20, 0.05);
                        eqLowpassFilter.frequency.rampTo(20000, 0.05);
                    }
                }
                
                return;
            }
            
            const effectNode = getEffectNode(effectName);
            if (!effectNode) return;
            
            const isActive = btn.classList.contains('active');
            
            if (isActive) {
                btn.classList.remove('active');
                btn.textContent = 'OFF';
                if (effectNode._lastWet !== undefined) {
                    effectNode._lastWet = effectNode.wet.value;
                }
                effectNode.wet.value = 0;
            } else {
                btn.classList.add('active');
                btn.textContent = 'ON';
                const lastWet = effectNode._lastWet !== undefined ? effectNode._lastWet : 0.5;
                effectNode.wet.value = lastWet;
            }
        });
    });
}

function getEffectNode(effectName) {
    switch(effectName) {
        case 'distortion': return distortion;
        case 'chorus': return chorus;
        case 'delay': return delay;
        case 'reverb': return reverb;
        default: return null;
    }
}

export async function initAudioUI() {
    ensureToneStarted();
    initializeAudioChain();
    syncAudioState();
    
    if (outputMeter) {
        startDbMeterLoop();
    }
    
    attachVolumeSlider();
    
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
    }, 0.7, (v) => `${Math.round(v * 100)}%`);
    
    setupEffectKnob('chorusRateKnob', (value) => {
        if (chorus) chorus.frequency.value = 0.5 + value * 4.5;
    }, 0.2, (v) => `${(0.5 + v * 4.5).toFixed(2)} Hz`);
    
    setupEffectKnob('chorusMixKnob', (value) => {
        if (chorus) chorus.wet.value = value;
    }, 0, (v) => `${Math.round(v * 100)}%`);

    setupEffectKnob('delayTimeKnob', (value) => {
        if (delay) delay.delayTime.value = 0.01 + value * 0.99;
    }, 0.25, (v) => `${((0.01 + v * 0.99) * 1000).toFixed(0)} ms`);
    
    setupEffectKnob('delayFeedbackKnob', (value) => {
        if (delay) delay.feedback.value = value * 0.95;
    }, 0.5, (v) => `${Math.round(v * 100)}%`);
    
    setupEffectKnob('delayMixKnob', (value) => {
        if (delay) delay.wet.value = value;
    }, 0, (v) => `${Math.round(v * 100)}%`);

    setupEffectKnob('reverbDecayKnob', (value) => {
        if (reverb) reverb.decay = 0.1 + value * 9.9;
    }, 0.15, (v) => `${(0.1 + v * 9.9).toFixed(1)}s`);
    
    setupEffectKnob('reverbMixKnob', (value) => {
        if (reverb) reverb.wet.value = value;
    }, 0, (v) => `${Math.round(v * 100)}%`);
    
    setupEffectKnob('reverbSizeKnob', (value) => {
        if (reverb) reverb.preDelay = value * 0.1;
    }, 0, (v) => `${Math.round(v * 100)}%`);    
    setupEffectToggle('distortion');
    setupEffectToggle('chorus');
    setupEffectToggle('delay');
    setupEffectToggle('reverb');
    setupEffectToggle('eq');
    
    // Setup preset sample selector
    const presetSelect = document.getElementById('presetSampleSelect');
    if (presetSelect) {
        presetSelect.addEventListener('change', async (e) => {
            const preset = e.target.value;
            console.log('Loading preset:', preset);
            await loadPresetSample(preset);
        });
        
        // Load default preset (halo)
        if (presetSelect.value) {
            loadPresetSample(presetSelect.value).catch(e => console.warn('Failed to load default preset:', e));
        }
    }
    
    console.log('✅ Audio UI initialized');
}
