export const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10]
};

export function getKeyIndexFromY(y) {
    const keys = document.querySelectorAll('.key');
    if (keys.length === 0) return -1;
    let closestIdx = -1;
    let minDist = Infinity;
    keys.forEach((k, i) => {
        const r = k.getBoundingClientRect();
        const keyY = r.top + r.height / 2;
        const dist = Math.abs(keyY - y);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    });
    return closestIdx;
}

export function getKeyIndexFromValue(value, maxValue, minValue) {
    const keys = document.querySelectorAll('.key');
    const numKeys = keys.length;
    if (numKeys === 0) return -1;
    const normalized = (value - minValue) / (maxValue - minValue);
    const flipped = 1 - normalized;
    let idx = Math.floor(flipped * numKeys);
    if (idx < 0) idx = 0;
    if (idx >= numKeys) idx = numKeys - 1;
    return idx;
}

export function drawVerticalKeyboard() {
    const keyboard = document.createElement('div');
    const container = document.getElementById('keyboardContainer') || document.querySelector('.keyboard-box');
    if (!container) return;
    
    container.innerHTML = '';
    container.appendChild(keyboard);
    keyboard.classList.add('verticalKeyboardContainer');
    keyboard.id = 'verticalKeyboard';
    
    const octaves = 3;
    for (let o = 0; o < octaves; o++) {
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
    
    try {
        const keys = keyboard.children;
        const numKeys = keys.length;
        for (let i = 0; i < numKeys; i++) {
            const midi = 48 + (numKeys - 1 - i);
            keys[i].dataset.midi = String(midi);
        }
    } catch (e) {}
    
    applyScaleToKeyboard();
}

export function createWhiteKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('white');
    key.style.cursor = 'pointer';
    key.onclick = () => { 
        const keys = key.parentNode.children;
        const idx = Array.from(keys).indexOf(key);
        highlightKey(idx);
    };
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
    key.addEventListener('pointerdown', () => { key.classList.add('pressedKey'); });
    key.addEventListener('pointerup', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointercancel', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointerleave', () => { key.classList.remove('pressedKey'); });
    return key;
}

export function createBlackKey() {
    const key = document.createElement('div');
    key.classList.add('key');
    key.classList.add('black');
    key.style.cursor = 'pointer';
    key.onclick = () => { 
        const keys = key.parentNode.children;
        const idx = Array.from(keys).indexOf(key);
        highlightKey(idx);
    };
    key.addEventListener('mouseenter', () => { key.classList.add('hoveredKey'); });
    key.addEventListener('mouseleave', () => { key.classList.remove('hoveredKey'); });
    key.addEventListener('pointerdown', () => { key.classList.add('pressedKey'); });
    key.addEventListener('pointerup', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointercancel', () => { key.classList.remove('pressedKey'); });
    key.addEventListener('pointerleave', () => { key.classList.remove('pressedKey'); });
    return key;
}

export function highlightKey(i) {
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;
    const keys = keyboard.children;
    if (i >= 0 && i < keys.length) {
        keys[i].classList.toggle('selectedKey');
    }
}

export function applyScaleToKeyboard() {
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
        keys[i].style.pointerEvents = 'auto';
    }
    
    if (scaleName && SCALES[scaleName]) {
        const intervals = SCALES[scaleName];
        for (let i = 0; i < numKeys; i++) {
            const midi = parseInt(keys[i].dataset.midi, 10);
            if (isNaN(midi)) continue;
            
            const pcNote = (midi + 12) % 12;
            const pcRoot = rootValue % 12;
            const pcDiff = (pcNote - pcRoot + 12) % 12;
            
            if (intervals.includes(pcDiff)) {
                keys[i].classList.add('selectedKey');
                keys[i].classList.add('scaleKey');
            } else {
                keys[i].style.pointerEvents = 'none';
            }
        }
    } else {
        for (let i = 0; i < numKeys; i++) {
            keys[i].classList.add('selectedKey');
        }
    }
}

export function initKeyboard() {
    drawVerticalKeyboard();
    
    const rootNoteSelect = document.getElementById('rootNoteSelect');
    const scaleSelect = document.getElementById('scaleSelect');
    
    if (rootNoteSelect) {
        rootNoteSelect.addEventListener('change', applyScaleToKeyboard);
    }
    
    if (scaleSelect) {
        scaleSelect.addEventListener('change', applyScaleToKeyboard);
    }
    
    console.log('✅ Keyboard initialized');
}

export async function playMidiIfSelected(midi, time) {
    if (!midi || typeof midi !== 'number') return;
    
    const audioModule = await import('./audio.js');
    const midiModule = await import('./midi.js');
    
    const now = Date.now();
    if ((now - audioModule.lastPlayTime) < 50) return;

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
        if (midiModule.midiEnabled && midiModule.midiOutput) {
            midiModule.playMidiNote(midi);
            audioModule.setLastPlayedMidi(midi);
            audioModule.setLastPlayTime(now);
            
            keyEl.classList.add('playingKey'); 
            setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150);
            return;
        }

        if (!audioModule.samplePlayer || !audioModule.samplePlayer.buffer) return;
        
        audioModule.playSampleAtMidi(midi, time);
        
        audioModule.setLastPlayedMidi(midi);
        audioModule.setLastPlayTime(now);
        
        keyEl.classList.add('playingKey'); 
        setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150);
        
    } catch (e) {
        console.warn('Error playing note', e);
    }
}

export async function triggerPlayWithFallback(requestedMidi, time) {
    if (!requestedMidi || typeof requestedMidi !== 'number') return;
    const keyboard = document.getElementById('verticalKeyboard');
    if (!keyboard) return;

    let directEl = null;
    for (let i = 0; i < keyboard.children.length; i++) {
        const k = keyboard.children[i];
        if (k && k.dataset && Number(k.dataset.midi) === requestedMidi) { directEl = k; break; }
    }

    if (directEl && directEl.classList.contains('selectedKey')) {
        // Play the exact MIDI synchronously
        playSampleNow(requestedMidi);
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
        const midi = Number(nearest.dataset.midi);
        console.log('Playing nearest MIDI:', midi, 'instead of:', requestedMidi);
        playSampleNow(midi);
    } else {
        console.warn('No selected keys available for MIDI:', requestedMidi);
    }
}

// Synchronous version for Transport scheduling
function playSampleNow(midi) {
    try {
        // Access audio module from globals
        if (!window.audioModule) {
            console.warn('Audio module not available on window');
            return;
        }
        
        const audioModule = window.audioModule;
        const now = Date.now();
        
        if ((now - audioModule.lastPlayTime) < 50) {
            console.log('Cooldown active, skipping play');
            return;
        }

        const keyboard = document.getElementById('verticalKeyboard');
        if (!keyboard) return;
        
        // Find the exact MIDI key
        let keyEl = null;
        for (let i = 0; i < keyboard.children.length; i++) {
            const k = keyboard.children[i];
            if (k && k.dataset && Number(k.dataset.midi) === midi) { 
                keyEl = k; 
                break; 
            }
        }
        
        if (!keyEl) {
            console.warn('Key not found for MIDI:', midi);
            return;
        }

        if (!keyEl.classList.contains('selectedKey')) {
            console.log('Key not selected for MIDI:', midi);
            return;
        }

        // Try MIDI output first
        if (audioModule.midiEnabled) {
            if (window.midiModule && window.midiModule.midiOutput) {
                console.log('Playing via MIDI output');
                window.midiModule.playMidiNote(midi);
                audioModule.setLastPlayedMidi(midi);
                audioModule.setLastPlayTime(now);
                
                keyEl.classList.add('playingKey'); 
                setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150);
            } else {
                console.log('MIDI mode active but no device selected');
            }
            return;
        }

        // Fall back to sample (only in Presets mode)
        if (!audioModule.samplePlayer || !audioModule.samplePlayer.buffer) {
            console.log('No sample loaded in Presets mode');
            return;
        }
        
        console.log('Playing sample at MIDI:', midi);
        audioModule.playSampleAtMidi(midi, null);
        
        audioModule.setLastPlayedMidi(midi);
        audioModule.setLastPlayTime(now);
        
        keyEl.classList.add('playingKey'); 
        setTimeout(() => { try { keyEl.classList.remove('playingKey'); } catch(e){} }, 150);
        
    } catch (e) {
        console.warn('Error in playSampleNow:', e);
    }
}
