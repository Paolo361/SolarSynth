export let recorder = null;
export let isRecording = false;
export let recordingStartTime = null;
export let recordingDuration = 0;
export let recordingTimerInterval = null;

export function initRecorder() {
    try {
        if (recorder) {
            try { recorder.dispose(); } catch (e) {}
            recorder = null;
        }
        
        recorder = new Tone.Recorder({
            mimeType: 'audio/webM'
        });
        
        if (window.mainLimiter) {
            window.mainLimiter.connect(recorder);
            console.log('Recorder connected to mainLimiter');
        } else if (window.mainCompressor) {
            window.mainCompressor.connect(recorder);
            console.log('Recorder connected to mainCompressor');
        } else if (window.masterVolume) {
            window.masterVolume.connect(recorder);
            console.log('Recorder connected to masterVolume');
        } else {
            console.error('No audio node found to connect recorder');
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('Failed to initialize recorder:', e);
        return false;
    }
}

export async function startRecording() {
    try {
        if (window.ensureToneStarted) {
            await window.ensureToneStarted();
        }
        
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
        
        console.log('Recording started');
        return true;
        
    } catch (e) {
        console.error('Failed to start recording:', e);
        isRecording = false;
        return false;
    }
}

export async function stopRecording() {
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
        
        console.log(`Recording stopped (${recordingDuration}s, ${(recording.size / 1024).toFixed(2)} KB)`);
        
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
            console.log('Download completed, URL cleaned up');
        }, 1000);
        
        isRecording = false;
        
        if (recorder) {
            try { recorder.dispose(); } catch (e) {}
            recorder = null;
        }
        
        return true;
        
    } catch (e) {
        console.error('Failed to stop recording:', e);
        isRecording = false;
        
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }
        
        return false;
    }
}

export function updateRecordingUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (!recordBtn) return;
    
    if (isRecording) {
        const minutes = Math.floor(recordingDuration / 60);
        const seconds = recordingDuration % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        recordBtn.textContent = `⏺ ${timeStr}`;
    } else {
        recordBtn.textContent = '⏺';
    }
}

export function initRecorderUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (!recordBtn) return;
    
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            recordBtn.classList.add('recording');
            const success = await startRecording();
            
            if (!success) {
                recordBtn.classList.remove('recording');
                alert('Errore durante l\'avvio della registrazione. Verifica la console.');
            }
            
            updateRecordingUI();
        } else {
            recordBtn.classList.remove('recording');
            const success = await stopRecording();
            
            if (!success) {
                alert('Errore durante il salvataggio della registrazione. Verifica la console.');
            }
            
            updateRecordingUI();
        }
    });
    
    console.log('✅ Recorder UI initialized');
}
