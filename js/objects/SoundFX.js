// SoundFX — Procedural sound effects using Web Audio API (no files needed)

class SoundFX {
    constructor() {
        this.ctx = null;
        this.engineNode = null;
        this.engineGain = null;
        this.enabled = false;
        this.musicPlaying = false;
        this._musicTimeout = null;
    }

    // Must be called after a user gesture (click/tap) to unlock audio
    init() {
        if (this.ctx) {
            // Already created — just make sure it's resumed
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Resume in case browser auto-suspends
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.enabled = true;
            console.log('SoundFX: AudioContext created, state=' + this.ctx.state);
        } catch (e) {
            console.warn('SoundFX: failed to create AudioContext', e);
            this.enabled = false;
        }
    }

    // Ensure context is running (browsers suspend it)
    _ensureResumed() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ── Coin pickup: bright chirp ──────────────────────────────
    playCoin() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }

    // ── Nitro pickup: deeper rising tone ───────────────────────
    playNitroPickup() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    }

    // ── Crash / bump: short noise burst ────────────────────────
    playCrash() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(ctx.currentTime);
    }

    // ── Nitro boost: whoosh ────────────────────────────────────
    playBoost() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 2;
        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(ctx.currentTime);
    }

    // ── Tire screech (continuous while drifting) ───────────────
    updateTireScreech(driftAmount) {
        if (!this.enabled || GameState.sfxMuted) {
            if (this._screechNode) {
                this._screechNode.stop();
                this._screechNode = null;
                this._screechGain = null;
                this._screechFilter = null;
            }
            return;
        }
        if (driftAmount > 0.2) {
            if (!this._screechNode) {
                this._ensureResumed();
                const ctx = this.ctx;
                // High-pitched filtered noise for tire squeal
                const bufSize = ctx.sampleRate * 2;
                const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.loop = true;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 3000;
                filter.Q.value = 8;
                const gain = ctx.createGain();
                gain.gain.value = 0;
                src.connect(filter).connect(gain).connect(ctx.destination);
                src.start();
                this._screechNode = src;
                this._screechGain = gain;
                this._screechFilter = filter;
            }
            // Scale volume and pitch with drift intensity
            const vol = Math.min(driftAmount * 0.08, 0.06);
            this._screechGain.gain.value = vol;
            this._screechFilter.frequency.value = 2500 + driftAmount * 1500;
        } else if (this._screechNode) {
            this._screechNode.stop();
            this._screechNode = null;
            this._screechGain = null;
            this._screechFilter = null;
        }
    }

    // ── Engine loop: real V8 sample with pitch shifting ───────
    // Uses a looped recording, playbackRate controls RPM
    async startEngine() {
        if (!this.enabled || GameState.sfxMuted || this.engineNode) return;
        this._ensureResumed();
        const ctx = this.ctx;

        try {
            // Load the V8 idle sample
            const response = await fetch('assets/audio/engine_idle.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.engineBuffer = await ctx.decodeAudioData(arrayBuffer);

            this.engineGain = ctx.createGain();
            this.engineGain.gain.value = 0.3;
            this.engineGain.connect(ctx.destination);

            // Create looping buffer source
            this.engineNode = ctx.createBufferSource();
            this.engineNode.buffer = this.engineBuffer;
            this.engineNode.loop = true;
            this.engineNode.playbackRate.value = 0.8; // idle pitch
            this.engineNode.connect(this.engineGain);
            this.engineNode.start();
            console.log('SoundFX: V8 sample engine started');
        } catch (e) {
            console.warn('SoundFX: failed to load engine sample', e);
            this.engineNode = null;
        }
    }

    updateEngine(speed, topSpeed, upgradeRatio) {
        if (!this.engineNode || !this.engineGain) return;
        const ratio = Math.abs(speed) / topSpeed;

        // ── 5-speed gearbox simulation ─────────────────────────
        // Each gear covers a speed range. RPM climbs within gear, drops on shift.
        const numGears = 3;
        const gearRatio = ratio * numGears;          // 0→5 across speed range
        const gear = Math.min(Math.floor(gearRatio), numGears - 1); // 0-4
        const inGear = gearRatio - gear;             // 0→1 within current gear

        // RPM within gear: subtle pitch shift, more volume-driven
        // Tight pitch range keeps the sound natural (no chipmunk effect)
        const lowRPM  = 0.4 + upgradeRatio * 0.05;   // idle pitch
        const highRPM = 3 + upgradeRatio * 0.2;     // redline pitch

        // Each higher gear starts at a slightly higher base pitch
        const gearBase = lowRPM + (gear / numGears) * (highRPM - lowRPM) * 0.5;
        const gearTop  = gearBase + (highRPM - lowRPM) / numGears;

        // RPM sweeps from gearBase to gearTop within current gear
        const rpm = gearBase + inGear * (gearTop - gearBase);
        this.engineNode.playbackRate.value = rpm;

        // Detect gear shift (thump disabled — too noticeable with subtle pitch range)
        // if (this._lastGear !== undefined && gear > this._lastGear && ratio > 0.05) {
        //     this._playShiftThump();
        // }
        this._lastGear = gear;

        // Volume does the heavy lifting for RPM feel
        const baseVol = 0.10 + upgradeRatio * 0.05;
        this.engineGain.gain.value = baseVol + ratio * (0.60 + upgradeRatio * 0.1);

        // Update music tempo (disabled – constant tempo sounds better)
        // this.musicSpeedRatio = ratio;
    }

    // Brief exhaust pop on gear shift
    _playShiftThump() {
        if (!this.enabled || !this.ctx) return;
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.8;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start();
    }

    stopEngine() {
        if (this.engineNode) {
            try { this.engineNode.stop(); } catch (e) {}
        }
        this.engineNode = null;
        this.engineGain = null;
        this.engineBuffer = null;
    }

    // ── Lap complete: victory ding ─────────────────────────────
    playLapComplete() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const notes = [523, 659, 784]; // C5, E5, G5
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
    }

    // ── Race start: Mario-style jingle ─────────────────────────
    playStartJingle() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;

        // Classic Mario start-level fanfare (approximation)
        // E5 E5 rest E5 rest C5 E5 rest G5 rest rest G4
        const melody = [
            { freq: 659, time: 0.00,  dur: 0.10 },  // E5
            { freq: 659, time: 0.15,  dur: 0.10 },  // E5
            { freq: 659, time: 0.40,  dur: 0.10 },  // E5
            { freq: 523, time: 0.55,  dur: 0.10 },  // C5
            { freq: 659, time: 0.70,  dur: 0.15 },  // E5
            { freq: 784, time: 0.95,  dur: 0.25 },  // G5
            { freq: 392, time: 1.40,  dur: 0.25 },  // G4
        ];

        melody.forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12, ctx.currentTime + time);
            gain.gain.setValueAtTime(0.12, ctx.currentTime + time + dur * 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + time);
            osc.stop(ctx.currentTime + time + dur);
        });
    }

    // ── Background music: Korobeiniki (Tetris Theme) ───────────
    // Traditional Russian folk song — public domain
    startMusic() {
        if (!this.enabled || this.musicPlaying || GameState.musicMuted) return;
        this._ensureResumed();
        this.musicPlaying = true;
        this.musicSpeedRatio = 0;
        this._musicOscillators = []; // track all active nodes for instant stop
        this._playMusicLoop();
    }

    stopMusic() {
        this.musicPlaying = false;
        this._melodyData = null;
        this._melodyIndex = 0;
        if (this._musicTimeout) {
            clearTimeout(this._musicTimeout);
            this._musicTimeout = null;
        }
        if (this._musicOscillators) {
            this._musicOscillators.forEach(osc => {
                try { osc.stop(0); } catch (e) {}
            });
            this._musicOscillators = [];
        }
    }

    _playMusicLoop() {
        if (!this.musicPlaying || !this.enabled) return;

        // Note frequencies (0 = rest)
        const N = {
            E4: 330, B3: 247, C4: 262, D4: 294, F4: 349, A3: 220,
            G3: 196, E3: 165, A4: 440, C5: 523, B4: 494, G4: 392,
            D5: 587, F5: 698, E5: 659,
        };

        // Korobeiniki melody — [note, duration in beats]
        const lineA = [
            [N.E4, 1], [N.B3, 0.5], [N.C4, 0.5], [N.D4, 1], [N.C4, 0.5], [N.B3, 0.5],
            [N.A3, 1], [N.A3, 0.5], [N.C4, 0.5], [N.E4, 1], [N.D4, 0.5], [N.C4, 0.5],
            [N.B3, 1], [N.B3, 0.5], [N.C4, 0.5], [N.D4, 1], [N.E4, 1],
            [N.C4, 1], [N.A3, 1], [N.A3, 1], [0, 1],
        ];
        const lineB = [
            [N.D4, 1.5], [N.F4, 0.5], [N.A4, 1], [N.G4, 0.5], [N.F4, 0.5],
            [N.E4, 1.5], [N.C4, 0.5], [N.E4, 1], [N.D4, 0.5], [N.C4, 0.5],
            [N.B3, 1], [N.B3, 0.5], [N.C4, 0.5], [N.D4, 1], [N.E4, 1],
            [N.C4, 1], [N.A3, 1], [N.A3, 1], [0, 1],
        ];

        // Store full melody if not already, and track position
        if (!this._melodyData) {
            this._melodyData = [...lineA, ...lineA, ...lineB];
            this._melodyIndex = 0;
        }

        this._scheduleNextNotes();
    }

    _scheduleNextNotes() {
        if (!this.musicPlaying || !this.enabled) return;
        const ctx = this.ctx;

        // Schedule 4 notes at a time, then re-check speed
        const chunkSize = 4;
        const melody = this._melodyData;
        this._musicOscillators = this._musicOscillators || [];

        // Current BPM (speed-based scaling disabled)
        // const speedRatio = this.musicSpeedRatio || 0;
        // const bpm = 120 + speedRatio * 160;
        const bpm = 120;
        const beat = 60 / bpm;

        let time = ctx.currentTime + 0.02;
        let totalChunkDur = 0;

        for (let c = 0; c < chunkSize; c++) {
            const [freq, dur] = melody[this._melodyIndex];
            const noteDur = dur * beat;

            if (freq > 0) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.06, time);
                gain.gain.setValueAtTime(0.06, time + noteDur * 0.75);
                gain.gain.exponentialRampToValueAtTime(0.001, time + noteDur * 0.95);
                osc.connect(gain).connect(ctx.destination);
                osc.start(time);
                osc.stop(time + noteDur);
                this._musicOscillators.push(osc);

                const bass = ctx.createOscillator();
                const bassGain = ctx.createGain();
                bass.type = 'triangle';
                bass.frequency.value = freq / 2;
                bassGain.gain.setValueAtTime(0.04, time);
                bassGain.gain.setValueAtTime(0.04, time + noteDur * 0.6);
                bassGain.gain.exponentialRampToValueAtTime(0.001, time + noteDur * 0.9);
                bass.connect(bassGain).connect(ctx.destination);
                bass.start(time);
                bass.stop(time + noteDur);
                this._musicOscillators.push(bass);
            }

            time += noteDur;
            totalChunkDur += noteDur;
            this._melodyIndex = (this._melodyIndex + 1) % melody.length;
        }

        // Clean up old refs periodically
        if (this._musicOscillators.length > 50) {
            this._musicOscillators = this._musicOscillators.slice(-20);
        }

        // Schedule next chunk right when this one ends
        this._musicTimeout = setTimeout(() => {
            this._scheduleNextNotes();
        }, totalChunkDur * 1000);
    }

    // ── Countdown beep (high = red light, low = green light) ───
    playBeep(pitch) {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const freq = pitch === 'low' ? 880 : 440;
        const dur = pitch === 'low' ? 0.4 : 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
    }

    // ── Pre-race crowd applause (white noise burst) ────────────
    playApplause() {
        if (!this.enabled || GameState.sfxMuted) return;
        this._ensureResumed();
        const ctx = this.ctx;
        const dur = 3;
        const bufferSize = ctx.sampleRate * dur;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        // Bandpass to sound more like crowd noise
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 0.5;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(ctx.currentTime);
        source.stop(ctx.currentTime + dur);
    }
}

// Global instance
const soundFX = new SoundFX();
