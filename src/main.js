import { InputSystem } from './InputSystem.js';
import { BattleSystem } from './BattleSystem.js';
import { MusicManager } from './MusicManager.js';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

import { FACEMESH_TESSELATION, HAND_CONNECTIONS } from '@mediapipe/holistic';
import './style.css';


const canvasElement = document.getElementById('output_canvas');

// --- Debug Logic ---
function log(msg) {
    console.log(msg);
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.textContent += msg + '\n';
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

function error(msg) {
    console.error(msg);
    const debugLog = document.getElementById('debug-log');
    const statusElement = document.getElementById('status');
    if (debugLog) debugLog.textContent += 'ERROR: ' + msg + '\n';
    if (statusElement) {
        statusElement.textContent = "Error: " + msg;
        statusElement.style.color = "red";
    }
}

window.onerror = function (message, source, lineno, colno, err) {
    error(`${message} at ${source}:${lineno}`);
};

log("Main.js loaded. Initializing...");


const canvasCtx = canvasElement.getContext('2d');

// Create and append video element explicitly
const videoElement = document.createElement('video');
videoElement.style.display = 'none';
videoElement.autoplay = true;
videoElement.playsInline = true;
document.body.appendChild(videoElement);

log("Initializing InputSystem...");
const inputSystem = new InputSystem(videoElement, onResults);

// inputSystem.start() moved to end


// --- Audio Logic ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const musicManager = new MusicManager(audioCtx);

function playSlapSound(pitchMultiplier = 1) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'triangle';
    // Base frequency 150, scales up with pitchMultiplier (e.g., 1.0, 1.1, 1.2...)
    const freq = 150 * pitchMultiplier;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);

    // Noise
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);


    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start();
}

function playWhooshSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Filtered Noise for "Whoosh"
    const bufferSize = audioCtx.sampleRate * 0.2; // 0.2s duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
    filter.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

function playBossSpecialSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;

    // 1. Breath/Exhale Noise ("Hah" sound)
    const bufferSize = audioCtx.sampleRate * 0.8; // 0.8s duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    // Use simple white noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to approximate open vocal formant ("Ah")
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1; // Resonant but wide enough for breath
    filter.frequency.setValueAtTime(1200, t); // Start high (aspiration)
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.5); // Drop pitch like a sigh

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(1.5, t + 0.05); // Sharp attack ("H-")
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5); // Decay ("-aaah")

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(t);

    // 2. Underlying Vocal Tone (Throat Sound)
    const voice = audioCtx.createOscillator();
    voice.type = 'triangle'; // Richer vocal cord buzz
    voice.frequency.setValueAtTime(320, t); // Pitch: roughly E4/F4 (Auntie voice)
    voice.frequency.exponentialRampToValueAtTime(220, t + 0.5); // Pitch faling

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0, t);
    voiceGain.gain.linearRampToValueAtTime(0.4, t + 0.05);
    voiceGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    // Lowpass to muffle the triangle wave (make it less electronic)
    const voiceFilter = audioCtx.createBiquadFilter();
    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.value = 900;

    voice.connect(voiceFilter);
    voiceFilter.connect(voiceGain);
    voiceGain.connect(audioCtx.destination);

    voice.start(t);
    voice.stop(t + 0.6);
}



// UI Helpers
const ui = {
    feedback: document.getElementById('feedback'),
    enemyHP: document.getElementById('enemy-hp'),
    playerHP: document.getElementById('player-hp'),
    bossContainer: document.getElementById('boss-container'),
    prepScreen: document.getElementById('prep-screen'),
    startScreen: document.getElementById('start-screen'),
    levelSelectScreen: document.getElementById('level-select-screen'),
    battleUI: document.getElementById('battle-ui'),
    prepUI: document.getElementById('prep-ui'),
    loadingContainer: document.getElementById('loading-container'),
    loadingBar: document.getElementById('loading-bar'),
    loadingText: document.getElementById('loading-text'),
    cutsceneLayer: document.getElementById('cutscene-layer'),

    currentLevel: 'STREET',
    currentDifficulty: 'EASY', // Default

    enterLevelSelect: () => {
        ui.startScreen.classList.add('hidden');
        ui.levelSelectScreen.classList.remove('hidden');
    },

    enterPrepMode: (level = 'STREET') => {
        ui.currentLevel = level;
        // Update BG
        const app = document.getElementById('app');
        if (level === 'STREET') {
            app.style.backgroundImage = "url('./assets/street_day_bg.png')";
            ui.cutsceneLayer.style.backgroundImage = "url('./assets/character/intro.png')";
        } else if (level === 'OFFICE') {
            app.style.backgroundImage = "url('./assets/office_scene_bg.png')";
            ui.cutsceneLayer.style.backgroundImage = "url('./assets/character/boss_intro.png')";
        } else {
            // Default
            app.style.backgroundImage = "url('./assets/street_day_bg.png')";
            ui.cutsceneLayer.style.backgroundImage = "url('./assets/character/intro.png')";
        }

        ui.startScreen.classList.add('hidden');
        ui.levelSelectScreen.classList.add('hidden');
        ui.prepScreen.classList.remove('hidden');
        battle.state = 'PREP';

        // Initial state: Show Cutscene + Loading Indicator. Hide Prep UI (Camera view)
        ui.cutsceneLayer.classList.remove('hidden');
        ui.prepUI.classList.add('hidden'); // Hide the buttons until ready

        ui.loadingContainer.classList.remove('hidden');
        ui.loadingText.textContent = "Adjusting Camera...";
        ui.loadingBar.style.width = '0%';

        // Fake Progress Simulation
        let progress = 0;
        window.loadingInterval = setInterval(() => {
            progress += Math.random() * 5;
            if (progress > 90) progress = 90; // Stall at 90% until actually ready
            ui.loadingBar.style.width = `${progress}%`;
        }, 100);

        const btn = document.getElementById('btn-start-fight');
        const status = document.getElementById('prep-status');
        btn.classList.add('disabled');

        musicManager.start('PREP');
    },

    startGame: (mode) => {
        ui.prepScreen.classList.add('hidden');
        ui.battleUI.classList.remove('hidden');
        musicManager.start('BATTLE');
        battle.start(mode, ui.currentLevel, ui.currentDifficulty);
    },


    updateHealth: (p, e, maxE = 500) => {
        const pPercent = Math.max(0, p);
        const ePercent = Math.max(0, (e / maxE) * 100);
        document.getElementById('player-hp').style.width = `${pPercent}%`;
        document.getElementById('enemy-hp').style.width = `${ePercent}%`;

        document.getElementById('player-hp-text').textContent = `${pPercent}/100`;
        document.getElementById('enemy-hp-text').textContent = `${e}/${maxE}`;

        // Shake boss on damage (if enemy HP dropped)
        if (e < 100) {
            document.getElementById('boss-container').classList.add('shaking');
            setTimeout(() => document.getElementById('boss-container').classList.remove('shaking'), 500);
        }
    },
    showFeedback: (text, color) => {
        const el = document.getElementById('feedback');
        el.textContent = text;
        el.style.color = color;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 1000);
    },

    playSlapSound: () => {
        playSlapSound(); // Call the existing sound function
    },


    setBossImage: (src) => {
        document.getElementById('boss-container').style.backgroundImage = `url('${src}')`;
    },
    updateCombo: (count) => {
        const el = document.getElementById('combo-counter');
        if (count > 1) {
            el.textContent = `COMBO x${count}`;
            el.classList.remove('hidden');
            el.classList.add('pulse');
            setTimeout(() => el.classList.remove('pulse'), 100);
        } else {
            el.classList.add('hidden');
        }
    },
    showVictoryScreen: () => {
        musicManager.stop();
        document.getElementById('victory-screen').classList.remove('hidden');
        document.getElementById('battle-ui').classList.add('hidden');
    },


    hideVictoryScreen: () => {
        document.getElementById('victory-screen').classList.add('hidden');
    },
    showDefeatScreen: () => {
        musicManager.stop();
        document.getElementById('defeat-screen').classList.remove('hidden');
        document.getElementById('battle-ui').classList.add('hidden');
    },
    hideDefeatScreen: () => {
        document.getElementById('defeat-screen').classList.add('hidden');
    },
    playBossSlapAnimation: (showHand = true) => {
        playBossSpecialSound();
        const boss = document.getElementById('boss-container');
        boss.classList.add('boss-zoom'); // Trigger Zoom

        if (showHand) {
            const hand = document.getElementById('boss-hand');
            hand.classList.remove('hidden');
            hand.classList.add('boss-slap-animation');

            // Animation Frames - Slowed down (Existing Auntie logic)
            const frames = [
                './assets/character/aunt/skill1.png',
                './assets/character/aunt/skill2.png',
                './assets/character/aunt/skill3.png'
            ];
            let frameIndex = 0;

            // Preload images to ensure smoothness
            frames.forEach(src => {
                const img = new Image();
                img.src = src;
            });

            // Initial Frame
            hand.style.backgroundImage = `url('${frames[0]}')`;

            // Loop Frames
            const interval = setInterval(() => {
                frameIndex = (frameIndex + 1) % frames.length;
                hand.style.backgroundImage = `url('${frames[frameIndex]}')`;
            }, 100); // 100ms per frame (Faster/Smoother)

            // Reset animation
            setTimeout(() => {
                clearInterval(interval);
                hand.classList.remove('boss-slap-animation');
                hand.classList.add('hidden');
                boss.classList.remove('boss-zoom'); // Reset Zoom
            }, 1500);
        } else {
            // Just Zoom reset for Boss
            setTimeout(() => {
                boss.classList.remove('boss-zoom');
            }, 1500);
        }
    },
    playBossDodgeAnimation: (side) => {
        const boss = document.getElementById('boss-container');
        const animClass = side === 'left' ? 'boss-dodge-left' : 'boss-dodge-right';
        boss.classList.add(animClass);

        setTimeout(() => boss.classList.remove(animClass), 500);
    },
    triggerFlash: () => {
        const el = document.getElementById('flash-overlay');
        el.classList.remove('hidden');
        el.classList.add('flash-active');
        setTimeout(() => {
            el.classList.remove('flash-active');
            setTimeout(() => el.classList.add('hidden'), 100);
        }, 50);
    },

    triggerScreenShake: () => {
        const app = document.getElementById('app'); // Or battle-ui
        app.classList.add('screen-shake');
        setTimeout(() => app.classList.remove('screen-shake'), 200);
    },
    spawnParticles: (x, y, color = '#f1c40f') => {
        const container = document.getElementById('battle-ui'); // Spawn relative to battle UI
        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            p.style.backgroundColor = color;
            p.style.left = x + 'px'; // Center roughly
            p.style.top = y + 'px';

            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const velocity = 50 + Math.random() * 100;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);


            container.appendChild(p);
            setTimeout(() => p.remove(), 500);
        }
    },
    spawnShockwave: (x, y) => {
        const container = document.getElementById('shockwave-container');
        const sw = document.createElement('div');
        sw.classList.add('shockwave');
        sw.style.left = x + 'px';
        sw.style.top = y + 'px';
        container.appendChild(sw);
        setTimeout(() => sw.remove(), 1000);
    },
    spawnTyphoon: () => {
        const container = document.getElementById('battle-ui');
        const t = document.createElement('div');
        t.classList.add('typhoon');
        container.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    },
    triggerUltimateVisuals: () => {
        const overlay = document.getElementById('ultimate-overlay');
        overlay.classList.remove('hidden');

        // Hide after animation (e.g., 2 seconds)
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 1500);
    },
    showDamageText: (text, x, y, color = '#fff') => {
        const container = document.getElementById('battle-ui');
        const el = document.createElement('div');
        el.className = 'damage-text';
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.color = color;
        container.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },
    playSlapSound: (pitchMultiplier = 1) => {
        playSlapSound(pitchMultiplier);
    },
    updateBossName: (name) => {
        const el = document.getElementById('boss-name');
        if (el) el.textContent = name;
    }
};

const battle = new BattleSystem(ui);

// Menu Handlers
document.getElementById('btn-story').addEventListener('click', () => {
    console.log("Button Story Clicked");
    log("Button Story Clicked");
    // Go to Level Select instead of straight to Prep
    try {
        ui.enterLevelSelect();
        log("Entered Level Select");
    } catch (e) {
        error("Error entering level select: " + e.message);
    }
});

document.getElementById('btn-level-street').addEventListener('click', () => {
    ui.enterPrepMode('STREET');
});

document.getElementById('btn-level-office').addEventListener('click', () => {
    ui.enterPrepMode('OFFICE');
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    ui.levelSelectScreen.classList.add('hidden');
    ui.startScreen.classList.remove('hidden');
});


// Difficulty Handlers
document.getElementById('btn-diff-easy').addEventListener('click', () => {
    ui.currentDifficulty = 'EASY';
    document.getElementById('btn-diff-easy').classList.add('selected');
    document.getElementById('btn-diff-hard').classList.remove('selected');
});

document.getElementById('btn-diff-hard').addEventListener('click', () => {
    ui.currentDifficulty = 'HARD';
    document.getElementById('btn-diff-hard').classList.add('selected');
    document.getElementById('btn-diff-easy').classList.remove('selected');
});

document.getElementById('btn-start-fight').addEventListener('click', () => {
    ui.startGame('STORY');
});



// Victory Handlers
document.getElementById('btn-restart').addEventListener('click', () => {
    ui.hideVictoryScreen();
    ui.startGame('STORY');
});

document.getElementById('btn-menu').addEventListener('click', () => {
    ui.hideVictoryScreen();
    ui.startScreen.classList.remove('hidden');
    // We need to ensure logic stops or resets.
    // Since UI state is handled, we just need to make sure BattleSystem behaves.
    // BattleSystem.start() resets everything, but passing to Menu means IDLE->MENU transition or similar.
    // For simplicity, just reloading page is nuclear option, but let's do it gracefully.
    musicManager.stop();
    battle.state = 'MENU';
});

document.getElementById('btn-retry').addEventListener('click', () => {
    ui.hideDefeatScreen();
    ui.startGame('STORY');
});

document.getElementById('btn-giveup').addEventListener('click', () => {
    ui.hideDefeatScreen();
    ui.startScreen.classList.remove('hidden');
    musicManager.stop();
    battle.state = 'MENU';
});

// Game Loop / Input Handler

// Game Loop / Input Handler
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw BG (Office) -> Video (Face) -> Foreground (Boss) logic?
    // Actually, usually: Video BG -> AR mask.
    // For this game: Video is the player. Office is the context.
    // Maybe draw Office BG on canvas, then Video semi-transparent? 
    // OR just Video as usual.



    // Draw Video (Mirrored by CSS)
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Draw Overlay Logic
    // Draw Overlay Logic
    if (battle.state === 'PREP' && results.faceLandmarks) {
        // Face found!
        // Transition: Hide cutscene, show camera/Prep UI
        if (!ui.cutsceneLayer.classList.contains('hidden')) {
            ui.cutsceneLayer.classList.add('hidden');
            ui.loadingContainer.classList.add('hidden');
            clearInterval(window.loadingInterval); // Stop fake loading
            ui.prepUI.classList.remove('hidden');
        }

        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
        const btn = document.getElementById('btn-start-fight');
        const status = document.getElementById('prep-status');
        if (btn.classList.contains('disabled')) {
            btn.classList.remove('disabled');
            status.textContent = "FACE DETECTED! READY!";
            status.style.color = "#2ecc71";
        }
    } else if (battle.state === 'PREP' && !results.faceLandmarks) {
        // Lost face? If we already showed UI, maybe keep it?
        // Or if we strictly follow "Cutscene stays if preparing", implies revert?
        // Let's assume once found, we stay in UI mode to let user adjust.
        // It's annoying if cutscene flickers back.
        // So we only hide cutscene once. 
        // Logic handled by the 'hidden' check above.
    }

    if (battle.isActive && results.faceLandmarks) {
        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
        detectBlock(results.faceLandmarks, results.leftHandLandmarks, results.rightHandLandmarks);
    }

    // Check Clap (Requires both hands)
    if (battle.isActive && results.leftHandLandmarks && results.rightHandLandmarks) {
        detectClap(results.leftHandLandmarks, results.rightHandLandmarks);
    }

    if (battle.isActive) {
        if (results.leftHandLandmarks) {
            drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#CC0000', lineWidth: 5 });
            drawLandmarks(canvasCtx, results.leftHandLandmarks, { color: '#00FF00', lineWidth: 2 });
            detectHand(results.leftHandLandmarks, 'left');
        }

        if (results.rightHandLandmarks) {
            drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#00CC00', lineWidth: 5 });
            drawLandmarks(canvasCtx, results.rightHandLandmarks, { color: '#FF0000', lineWidth: 2 });
            detectHand(results.rightHandLandmarks, 'right');
        }

        // Draw Trails
        const now = Date.now();
        ['left', 'right'].forEach(hand => {
            const trail = handTrails[hand];
            if (trail.length < 2) return;

            canvasCtx.beginPath();
            const trailLength = trail.length;

            // Draw segments with fading opacity
            for (let i = 0; i < trailLength - 1; i++) {
                const p1 = trail[i];
                const p2 = trail[i + 1];

                // Calculate opacity based on index (newer = more opaque)
                const alpha = (i / trailLength);

                canvasCtx.beginPath();
                canvasCtx.moveTo(p1.x * canvasElement.width, p1.y * canvasElement.height);
                canvasCtx.lineTo(p2.x * canvasElement.width, p2.y * canvasElement.height);

                canvasCtx.lineWidth = 15 * alpha; // Tapering width
                canvasCtx.lineCap = 'round';
                // Neon Cyan Glow
                canvasCtx.shadowBlur = 10;
                canvasCtx.shadowColor = '#00FFFF';
                canvasCtx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                canvasCtx.stroke();
            }

            // Reset Shadow
            canvasCtx.shadowBlur = 0;
        });
    }

    canvasCtx.restore();

    battle.update(Date.now());
}


function initCanvas() {
    canvasElement.width = 640;
    canvasElement.height = 480;
    log(`Canvas initialized to: ${canvasElement.width}x${canvasElement.height}`);
}
initCanvas();
// Removed resize event listener for PIP mode


// Input Processing Logic

// Head
// Block Detection (Hands covering Face)
function detectBlock(faceLandmarks, leftHand, rightHand) {
    // Nose is usually index 1 or 4
    const nose = faceLandmarks[1];
    if (!nose) return;

    let blocking = false;
    const BLOCK_DIST = 0.15; // Tuning

    if (leftHand) {
        const handCenter = leftHand[9]; // Middle Finger MCP
        const dist = Math.hypot(handCenter.x - nose.x, handCenter.y - nose.y);
        if (dist < BLOCK_DIST) blocking = true;
    }

    if (rightHand) {
        const handCenter = rightHand[9];
        const dist = Math.hypot(handCenter.x - nose.x, handCenter.y - nose.y);
        if (dist < BLOCK_DIST) blocking = true;
    }

    battle.setBlocking(blocking);

    // Optional Feedback (Debug)
    // if (blocking) log("Blocking...");
}

// Clap Detection (Hands touching)
function detectClap(leftHand, rightHand) {
    if (!leftHand || !rightHand) return;

    const left = leftHand[9]; // Middle Finger MCP
    const right = rightHand[9];

    // Distance between hands
    const dist = Math.hypot(left.x - right.x, left.y - right.y);
    // Threshold for clapping (hands very close)
    const CLAP_DIST = 0.08;

    if (dist < CLAP_DIST) {
        const now = Date.now();
        // Debounce (2s to prevent accidental double trigger)
        if (now - (window.lastUltimateTime || 0) > 2000) {
            // Additional check: maybe require speed? 
            // Ideally clap is an instant event.
            // For now, just proximity is enough for "Prayer/Clap" gesture.
            battle.onUltimate();
            window.lastUltimateTime = now;
        }
    }
}



// Slap
let previousX = { left: null, right: null };
let previousY = { left: null, right: null }; // Track Y for Hurricane
let lastSlapTime = { left: 0, right: 0 }; // Store time per hand
let lastFastSlapTime = { left: 0, right: 0 }; // For Ultimate
let lastHurricaneTime = 0;
let lastWhooshTime = 0;
const SLAP_THRESHOLD = 0.05;
const ULTIMATE_VELOCITY_THRESHOLD = 0.15; // Requires very fast movement

// Warning: HandTrails need to store {x,y,time}
const handTrails = { left: [], right: [] };

function detectHand(landmarks, hand) {
    const currentX = landmarks[9].x; // Middle finger MCP
    const currentY = landmarks[9].y;
    const now = Date.now();


    // Update Trail
    handTrails[hand].push({ x: currentX, y: currentY, time: now });
    // Remove old trails (> 1000ms) for gesture detection
    handTrails[hand] = handTrails[hand].filter(p => now - p.time < 500); // Shorter trail needed now

    if (previousX[hand] !== null) {
        const deltaX = currentX - previousX[hand];
        const deltaY = currentY - previousY[hand]; // Check vertical

        // Whoosh Logic (Visual/Audio feedback ONLY, no game logic)
        if (Math.abs(deltaX) > 0.03 && (now - lastWhooshTime > 200)) {
            playWhooshSound();
            lastWhooshTime = now;
        }

        const speed = Math.abs(deltaX);
        if (speed > SLAP_THRESHOLD && (now - lastSlapTime[hand] > 150)) {
            const direction = deltaX > 0 ? 'right' : 'left';
            battle.onSlap(direction);
            lastSlapTime[hand] = now;
        }

        // Hurricane Detection (Downward Swipe)
        // Y increases downwards. So deltaY > 0 is down.
        if (deltaY > 0.1) { // 10% screen height fast swipe
            const otherHand = hand === 'left' ? 'right' : 'left';
            // We need a way to check if other hand also swiped down recently
            // Let's store lastDownSwipeTime
            window.lastDownSwipeTime = window.lastDownSwipeTime || { left: 0, right: 0 };
            window.lastDownSwipeTime[hand] = now;

            if (now - window.lastDownSwipeTime[otherHand] < 200) {
                if (now - (lastHurricaneTime || 0) > 3000) { // 3s Cooldown
                    battle.onHurricane();
                    lastHurricaneTime = now;
                }
            }
        }
    }

    previousX[hand] = currentX;
    previousY[hand] = currentY;
}


// Geometric Helper Functions

// Asset Check
const bgImg = new Image();
bgImg.onload = () => log("Office BG loaded successfully");
bgImg.onerror = () => error("Failed to load Office BG at ./assets/office_bg.png");
bgImg.src = './assets/office_bg.png';

const bossImg = new Image();
bossImg.onload = () => log("Boss Idle loaded successfully");
bossImg.onerror = () => error("Failed to load Boss Idle at ./assets/character/aunt/level1-character-normal.png");
bossImg.src = './assets/character/aunt/level1-character-normal.png';


log("Initializing InputSystem start...");
inputSystem.start()
    .then(() => {
        log("Camera started. Game Loop Active.");
        // Hide debug info after successful init
        setTimeout(() => {
            const statusEl = document.getElementById('status');
            const debugEl = document.getElementById('debug-log');
            if (statusEl) statusEl.classList.add('hidden');
            if (debugEl) debugEl.classList.add('hidden');
        }, 1000);
    })

    .catch(err => {
        error("Camera Failed: " + err);
        alert("Camera Error: " + err + "\nPlease check permissions.");
    });

// Add error handling to battle for safety
try {
    battle.update(Date.now());
    log("Battle system initialized correctly.");
} catch (e) {
    error("Battle System Error: " + e);
}
