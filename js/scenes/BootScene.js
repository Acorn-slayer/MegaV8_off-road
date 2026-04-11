// BootScene — Title screen with player name entry and load game option

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.load.image('titleBg', 'assets/sprites/title_bg.jpg');
    }

    create() {
        // Wait for Google Font to load before rendering text
        document.fonts.load("36px 'Press Start 2P'").then(() => {
            this._buildScreen();
        }).catch(() => {
            this._buildScreen();
        });
    }

    _buildScreen() {
        // Background image
        const bg = this.add.image(400, 300, 'titleBg');
        bg.setDisplaySize(800, 600);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, 800, 600);

        // Title
        this.add.text(400, 140, 'MEGA V8\nOFF ROAD', {
            fontSize: '36px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            lineSpacing: 12
        }).setOrigin(0.5);

        this.add.text(400, 240, 'Elliott Edition', {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);

        // Name label
        this.add.text(400, 310, 'ENTER YOUR NAME', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#aaaaaa'
        }).setOrigin(0.5);

        // Create HTML input for name entry (overlaid on canvas)
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / 800;
        const scaleY = rect.height / 600;

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 12;
        input.value = GameState.playerName === 'PLAYER' ? '' : GameState.playerName;
        input.placeholder = 'PLAYER';
        input.style.cssText = `
            position: absolute;
            left: ${rect.left + 300 * scaleX}px;
            top: ${rect.top + 330 * scaleY}px;
            width: ${200 * scaleX}px;
            height: ${30 * scaleY}px;
            font-family: 'Press Start 2P', cursive;
            font-size: ${12 * scaleX}px;
            text-align: center;
            background: #1a1a2e;
            color: #ffcc00;
            border: 2px solid #ffcc00;
            border-radius: 4px;
            outline: none;
            z-index: 1000;
            text-transform: uppercase;
        `;
        document.body.appendChild(input);
        input.focus();

        // START button
        const startGfx = this.add.graphics();
        startGfx.fillStyle(0x33aa33, 1);
        startGfx.fillRoundedRect(300, 400, 200, 45, 10);

        this.add.text(400, 422, '▶ START', {
            fontSize: '16px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const startZone = this.add.zone(400, 422, 200, 45).setInteractive({ useHandCursor: true });
        startZone.on('pointerover', () => {
            startGfx.clear(); startGfx.fillStyle(0x44cc44, 1); startGfx.fillRoundedRect(300, 400, 200, 45, 10);
        });
        startZone.on('pointerout', () => {
            startGfx.clear(); startGfx.fillStyle(0x33aa33, 1); startGfx.fillRoundedRect(300, 400, 200, 45, 10);
        });
        startZone.on('pointerdown', () => {
            const name = (input.value.trim() || 'PLAYER').toUpperCase();
            input.remove();
            GameState.reset();
            GameState.playerName = name;
            soundFX.init();
            this.scene.start('TrackSelectScene');
        });

        // LOAD GAME button
        const loadGfx = this.add.graphics();
        loadGfx.fillStyle(0x0f3460, 1);
        loadGfx.fillRoundedRect(300, 460, 200, 40, 10);

        this.add.text(400, 480, '📂 LOAD GAME', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const loadZone = this.add.zone(400, 480, 200, 40).setInteractive({ useHandCursor: true });
        loadZone.on('pointerover', () => {
            loadGfx.clear(); loadGfx.fillStyle(0x1a5276, 1); loadGfx.fillRoundedRect(300, 460, 200, 40, 10);
        });
        loadZone.on('pointerout', () => {
            loadGfx.clear(); loadGfx.fillStyle(0x0f3460, 1); loadGfx.fillRoundedRect(300, 460, 200, 40, 10);
        });
        loadZone.on('pointerdown', () => {
            this._loadGame(input);
        });

        // ── Audio toggle buttons ──────────────────────────────────
        this._createMuteToggle(290, 530, '🎵', 'MUSIC', 'musicMuted');
        this._createMuteToggle(430, 530, '🔊', 'SFX', 'sfxMuted');

        // Enter key starts the game
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                startZone.emit('pointerdown');
            }
        });

        // Clean up input if scene shuts down
        this.events.on('shutdown', () => {
            if (input.parentNode) input.remove();
        });
    }

    _createMuteToggle(x, y, icon, label, stateKey) {
        const isMuted = () => GameState[stateKey];
        const gfx = this.add.graphics();
        const w = 120, h = 32, r = 8;

        const draw = () => {
            gfx.clear();
            gfx.fillStyle(isMuted() ? 0x662222 : 0x226622, 1);
            gfx.fillRoundedRect(x, y, w, h, r);
        };
        draw();

        const txt = this.add.text(x + w / 2, y + h / 2,
            `${icon} ${label}: ${isMuted() ? 'OFF' : 'ON'}`, {
            fontSize: '8px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            GameState[stateKey] = !GameState[stateKey];
            txt.setText(`${icon} ${label}: ${isMuted() ? 'OFF' : 'ON'}`);
            draw();
            // If music was just muted, stop it; if unmuted and engine running, restart
            if (stateKey === 'musicMuted') {
                if (GameState.musicMuted) soundFX.stopMusic();
            }
            if (stateKey === 'sfxMuted') {
                if (GameState.sfxMuted) soundFX.stopEngine();
            }
        });
    }

    async _loadGame(nameInput) {
        try {
            let text;
            if (window.showOpenFilePicker) {
                const [handle] = await showOpenFilePicker({
                    types: [{ description: 'V8 Save', accept: { 'application/json': ['.v8t'] } }]
                });
                const file = await handle.getFile();
                text = await file.text();
            } else {
                // Fallback for browsers without File System Access API
                text = await new Promise((resolve, reject) => {
                    const fi = document.createElement('input');
                    fi.type = 'file';
                    fi.accept = '.v8t';
                    fi.onchange = () => {
                        if (!fi.files[0]) { reject('No file'); return; }
                        const r = new FileReader();
                        r.onload = () => resolve(r.result);
                        r.readAsText(fi.files[0]);
                    };
                    fi.click();
                });
            }
            const save = JSON.parse(text);
            GameState.loadSave(save);
            if (nameInput && nameInput.parentNode) nameInput.remove();
            soundFX.init();
            // Resume championship if in progress
            if (GameState.gameMode === 'championship' && GameState.championshipOrder.length > 0) {
                const idx = GameState.championshipRaceIndex;
                const order = GameState.championshipOrder;
                const trackIdx = order[idx] !== undefined ? order[idx] : idx;
                if (trackIdx < GameState.tracks.length) {
                    GameState.selectedTrack = GameState.tracks[trackIdx];
                }
                this.scene.start('RaceScene');
            } else {
                this.scene.start('TrackSelectScene');
            }
        } catch (e) {
            if (e !== 'No file') console.warn('Load failed:', e);
        }
    }
}
