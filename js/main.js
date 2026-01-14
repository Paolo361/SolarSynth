console.log('Solar Synth - Inizializzazione...');

import { initCharts, startTransport, stopTransport, resetTransport, registerChartPlugins } from './charts.js';
import { ensureToneStarted, initAudioUI, metronomeEnabled, audioState } from './audio.js';
import { initKeyboard, triggerPlayWithFallback } from './keyboard.js';
import { initMidiUI } from './midi.js';
import { initRecorderUI } from './recorder.js';
import { initUI } from './ui.js';
import './spectrum.js';

console.log('Moduli caricati con successo');

registerChartPlugins();

window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Pronto - Solar Synth attivo');
    
    try {
        initKeyboard();
        initCharts();
        await initAudioUI();
        await initMidiUI();
        initRecorderUI();
        initUI();
        
        // Export functions and modules to window for Transport callbacks
        window.startTransport = startTransport;
        window.stopTransport = stopTransport;
        window.resetTransport = resetTransport;
        window.triggerPlayWithFallback = triggerPlayWithFallback;
        
        // Import audio module and create mutable proxy
        const audioModule = await import('./audio.js');
        
        // Create a proxy that reads from audioState first, then from audioModule
        window.audioModule = new Proxy(audioState, {
            get(target, prop) {
                // If property is in audioState, return from there
                if (prop in target) return target[prop];
                // Otherwise return from audioModule
                return audioModule[prop];
            }
        });
        
        // Export MIDI module
        window.midiModule = await import('./midi.js');
        
        // Export EQ setter functions for spectrum.js
        window.setEQHighpassFreq = audioModule.setEQHighpassFreq;
        window.setEQLowpassFreq = audioModule.setEQLowpassFreq;
        window.setEQHighpassRolloff = audioModule.setEQHighpassRolloff;
        window.setEQLowpassRolloff = audioModule.setEQLowpassRolloff;
        
        window.setMetronomeEnabled = async (enabled) => {
            const audio = await import('./audio.js');
            audio.metronomeEnabled = enabled;
        };
        
        // Setup spectrum canvas interaction after window.setEQ* functions are ready
        const spectrumModule = await import('./spectrum.js');
        spectrumModule.setupSpectrumCanvasInteraction();
        
        // Export spectrum module for filter handle color control
        window.spectrumModule = spectrumModule;
        
        console.log('✅ Inizializzazione completata');
    } catch (e) {
        console.error('❌ Errore durante l\'inizializzazione:', e);
    }
});
