export class MusicManager {
    constructor(audioCtx) {
        this.ctx = audioCtx;
        this.isPlaying = false;
        this.tempo = 140; // 140 BPM High Energy
        this.noteLength = 60 / this.tempo;

        this.schedulerTime = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25;
        this.timerID = null;

        this.current16thNote = 0; // Steps counter

        // Mix Levels
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Keep it reasonable
        this.masterGain.connect(this.ctx.destination);
    }

    start(mode = 'BATTLE') {
        if (this.currentMode === mode && this.isPlaying) return;

        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.currentMode = mode;
        if (mode === 'PREP') {
            this.tempo = 90; // Slower, relaxed
        } else {
            this.tempo = 140; // High Energy
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.current16thNote = 0;
            this.schedulerTime = this.ctx.currentTime + 0.05;
            this.scheduler();
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentMode = null;
        clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;

        // Schedule notes ahead
        while (this.schedulerTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.schedulerTime);
            this.nextNote();
        }

        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        // 16th notes = 0.25 beat
        this.schedulerTime += 0.25 * secondsPerBeat;

        this.current16thNote++;
        if (this.current16thNote === 64) { // 4 bars loop (16 * 4)
            this.current16thNote = 0;
        }
    }

    scheduleNote(step, time) {
        if (this.currentMode === 'PREP') {
            this.playPrepMusic(step, time);
        } else {
            this.playBattleMusic(step, time);
        }
    }

    playPrepMusic(step, time) {
        // Simple relaxed beat
        // Light Hi-hat every beat
        if (step % 4 === 0) {
            this.playHiHat(time, 0.05);
        }

        // Soft Sine Pluck Melody (Lo-fi style)
        // Tune: C major 7th feel: C E G B
        const notes = [
            'C4', null, null, null,
            'E4', null, null, null,
            'G4', null, 'B4', null,
            'C5', null, null, null,

            'B4', null, null, null,
            'G4', null, 'E4', null,
            'C4', null, null, null,
            null, null, null, null, // rest
        ];
        // Slower loop (32 steps = 2 bars) repeated
        const note = notes[step % 32];

        if (note) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.masterGain);

            // Quick fake freq map
            const map = { 'C4': 261.63, 'E4': 329.63, 'G4': 392.00, 'B4': 493.88, 'C5': 523.25 };

            osc.frequency.setValueAtTime(map[note] || 0, time);
            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5); // Soft decay

            osc.start(time);
            osc.stop(time + 0.5);
        }
    }

    playBattleMusic(step, time) {
        // --- DRUMS ---
        // Kick: 4-on-the-floor (Steps 0, 4, 8, 12...)
        if (step % 4 === 0) {
            this.playKick(time);
        }

        // Snare: Steps 4, 12 (Backbeat)
        if (step % 8 === 4) {
            this.playSnare(time);
        }

        // Hi-hats: Every even step (off-beats) or fast 16ths
        if (step % 2 === 0) {
            this.playHiHat(time, step % 4 === 2 ? 0.3 : 0.1); // Accent off-beats
        }

        // --- BASS ---
        // Driving bass line (C Minor Pentatonic)
        this.playBassLine(step, time);

        // --- MELODY ---
        // Bright Lead
        this.playMelody(step, time);
    }

    // --- Sound Generators (Retro Synth) ---

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        const bufferSize = this.ctx.sampleRate * 0.1; // Short burst
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
    }

    playHiHat(time, vol = 0.1) {
        // High frequency noise or square wave blip
        // Let's use 6 noise for retro metal sound
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(time);
    }

    playBassLine(step, time) {
        // Pattern: 4 Bars
        // Bar 1 & 2: C (Root)
        // Bar 3: F (Subdominant)
        // Bar 4: G (Dominant)

        // Notes in Hz
        const C2 = 65.41;
        const F2 = 87.31;
        const G2 = 98.00;
        const Eb2 = 77.78; // Minor 3rd

        let freq = C2;
        if (step >= 32 && step < 48) freq = F2;
        if (step >= 48) freq = G2;

        // Rhythm: play on most 16ths effectively for driving feel, or syncopated
        // Let's do simple driving: 1, 0, 1, 0 (8th notes)
        if (step % 2 === 0) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth'; // Gritty bass
            const gain = this.ctx.createGain();

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, time);
            filter.frequency.exponentialRampToValueAtTime(100, time + 0.2); // Plucky filter

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2); // Short decay

            osc.start(time);
            osc.stop(time + 0.2);
        }
    }

    playMelody(step, time) {
        // C Minor Blues/Dorian feel for Fighting Game
        // Scale: C, D, Eb, F, G, A, Bb

        // Frequencies
        const notes = {
            'C4': 261.63, 'D4': 293.66, 'Eb4': 311.13, 'F4': 349.23, 'G4': 392.00, 'Bb4': 466.16, 'C5': 523.25,
            'G3': 196.00, 'Bb3': 233.08
        };

        // Arpeggiated line pattern loops every 16 steps (1 bar)
        // We'll vary it slightly over the 4 bars

        let note = null;

        // Phrase 1 (Bar 1 & 2)
        const sequence1 = [
            'C4', null, 'Eb4', null, 'G4', null, 'F4', 'Eb4',
            'C4', 'G3', 'Bb3', 'C4', null, 'C4', 'Eb4', 'G4'
        ];

        // Phrase 2 (Bar 3 - IV Chord F)
        // Shift up
        const sequence2 = [
            'F4', null, 'Ab4', null, 'C5', null, 'Bb4', 'Ab4', // Wait, strict parallel
            'F4', 'C4', 'Eb4', 'F4', null, 'F4', 'Ab4', 'C5'
        ];

        // Actually let's stick to the key center C for melody to allow tension against bass changes
        // "Guile Theme" style energy

        // 4-Bar Melody Map
        const fullMelody = [
            // Bar 1
            'C4', null, 'G4', null, 'Eb4', null, 'C4', null,
            'Bb3', 'C4', null, 'Eb4', 'F4', 'G4', 'Bb4', 'C5',
            // Bar 2
            'G4', null, 'F4', 'Eb4', 'C4', null, 'G3', null,
            'C4', 'Eb4', 'F4', 'G4', null, 'G4', 'Bb4', 'C5',
            // Bar 3 (Bass is F)
            'C5', 'Bb4', 'G4', 'F4', 'Eb4', 'F4', 'G4', 'Bb4',
            'C5', null, null, 'C5', 'Eb5', null, 'C5', null,
            // Bar 4 (Bass is G) - Climax
            'D5', null, 'C5', 'Bb4', 'G4', 'F4', 'Eb4', 'D4',
            'C4', 'D4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5', 'D5'
        ];

        // Just using C4 scale references for simplicity mapping
        // Correction: We need accurate freqs for the sequence above

        // Helper to get freq
        const getFreq = (n) => {
            if (!n) return 0;
            // Simple mapping for this specific song
            const map = {
                'G3': 196.00, 'Bb3': 233.08,
                'C4': 261.63, 'D4': 293.66, 'Eb4': 311.13, 'F4': 349.23, 'G4': 392.00, 'Ab4': 415.30, 'Bb4': 466.16, 'B4': 493.88,
                'C5': 523.25, 'D5': 587.33, 'Eb5': 622.25
            };
            return map[n] || 0;
        };

        const noteName = fullMelody[step % 64];
        if (noteName) {
            const freq = getFreq(noteName);
            if (freq > 0) {
                const osc = this.ctx.createOscillator();
                osc.type = 'square'; // 8-bit lead
                const gain = this.ctx.createGain();

                // Slight Vibrato
                // const vib = this.ctx.createOscillator();
                // vib.frequency.value = 5;
                // const vibGain = this.ctx.createGain();
                // vibGain.gain.value = 5;
                // vib.connect(vibGain);
                // vibGain.connect(osc.frequency);
                // vib.start(time);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.frequency.setValueAtTime(freq, time);
                gain.gain.setValueAtTime(0.25, time);
                gain.gain.linearRampToValueAtTime(0.01, time + 0.3); // Staccato-ish

                osc.start(time);
                osc.stop(time + 0.3);
            }
        }
    }
}
