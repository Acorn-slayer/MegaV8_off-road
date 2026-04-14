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
        // Background image — maintain 4:3 aspect ratio with letterboxing
        const bg = this.add.image(640, 360, 'titleBg');
        // 1280x720 is 16:9, but image is 4:3 — fit to width and letterbox
        bg.setDisplaySize(1280, 960);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, 1280, 720);

        // Title
        this.add.text(640, 170, 'MEGA V8\nOFF ROAD', {
            fontSize: '36px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            lineSpacing: 12
        }).setOrigin(0.5);

        this.add.text(640, 280, 'Elliott Edition', {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);

        // Name label (hidden after load)
        this._nameLabel = this.add.text(640, 360, 'ENTER YOUR NAME', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#aaaaaa'
        }).setOrigin(0.5);

        // Welcome text (shown after load)
        this._welcomeText = this.add.text(640, 370, '', {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setVisible(false);

        // Create HTML input for name entry (overlaid on canvas)
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / 1280;
        const scaleY = rect.height / 720;

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 12;
        input.value = GameState.playerName === 'PLAYER' ? '' : GameState.playerName;
        input.placeholder = 'PLAYER';
        input.style.cssText = `
            position: absolute;
            left: ${rect.left + 540 * scaleX}px;
            top: ${rect.top + 380 * scaleY}px;
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
        this._nameInput = input;
        this._playerLoaded = false;

        // START button
        const startGfx = this.add.graphics();
        startGfx.fillStyle(0x33aa33, 1);
        startGfx.fillRoundedRect(540, 450, 200, 45, 10);

        this.add.text(640, 472, '▶ START', {
            fontSize: '16px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const startZone = this.add.zone(640, 472, 200, 45).setInteractive({ useHandCursor: true });
        startZone.on('pointerover', () => {
            startGfx.clear(); startGfx.fillStyle(0x44cc44, 1); startGfx.fillRoundedRect(540, 450, 200, 45, 10);
        });
        startZone.on('pointerout', () => {
            startGfx.clear(); startGfx.fillStyle(0x33aa33, 1); startGfx.fillRoundedRect(540, 450, 200, 45, 10);
        });
        startZone.on('pointerdown', () => {
            if (this._nameInput && this._nameInput.parentNode) {
                const name = (this._nameInput.value.trim() || 'PLAYER').toUpperCase();
                this._nameInput.remove();
                if (!this._playerLoaded) {
                    GameState.reset();
                    GameState.playerName = name;
                }
            }
            soundFX.init();
            // Resume championship if loaded player was in one
            if (this._playerLoaded && GameState.gameMode === 'championship' && GameState.championshipOrder.length > 0) {
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
        });
        this._startZone = startZone;

        // LOAD GAME button
        this._loadGfx = this.add.graphics();
        this._loadGfx.fillStyle(0x0f3460, 1);
        this._loadGfx.fillRoundedRect(540, 510, 200, 40, 10);

        this._loadText = this.add.text(640, 530, '📂 LOAD GAME', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this._loadZone = this.add.zone(640, 530, 200, 40).setInteractive({ useHandCursor: true });
        this._loadZone.on('pointerover', () => {
            this._loadGfx.clear(); this._loadGfx.fillStyle(0x1a5276, 1); this._loadGfx.fillRoundedRect(540, 510, 200, 40, 10);
        });
        this._loadZone.on('pointerout', () => {
            this._loadGfx.clear(); this._loadGfx.fillStyle(0x0f3460, 1); this._loadGfx.fillRoundedRect(540, 510, 200, 40, 10);
        });
        this._loadZone.on('pointerdown', () => {
            this._loadGame();
        });

        // ── Audio toggle buttons ──────────────────────────────────
        this._muteMusic = this._createMuteToggle(510, 580, '🎵', 'MUSIC', 'musicMuted');
        this._muteSfx = this._createMuteToggle(650, 580, '🔊', 'SFX', 'sfxMuted');

        // Enter key starts the game
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                startZone.emit('pointerdown');
            }
        });

        // Clean up input if scene shuts down
        this.events.on('shutdown', () => {
            if (this._nameInput && this._nameInput.parentNode) this._nameInput.remove();
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

        const refresh = () => {
            txt.setText(`${icon} ${label}: ${isMuted() ? 'OFF' : 'ON'}`);
            draw();
        };

        const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            GameState[stateKey] = !GameState[stateKey];
            refresh();
            if (stateKey === 'musicMuted') {
                if (GameState.musicMuted) soundFX.stopMusic();
            }
            if (stateKey === 'sfxMuted') {
                if (GameState.sfxMuted) soundFX.stopEngine();
            }
        });

        return refresh;
    }

    async _loadGame() {
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
            this._playerLoaded = true;

            // Hide name input and load button, show welcome
            if (this._nameInput && this._nameInput.parentNode) {
                this._nameInput.remove();
            }
            this._nameLabel.setVisible(false);
            this._loadGfx.clear();
            this._loadText.setVisible(false);
            this._loadZone.disableInteractive();

            // Show welcome message with player name and money
            this._welcomeText.setText('Hello ' + GameState.playerName + '!  💰 $' + GameState.money);
            this._welcomeText.setVisible(true);

            // Refresh mute toggles to reflect loaded state
            if (this._muteMusic) this._muteMusic();
            if (this._muteSfx) this._muteSfx();
        } catch (e) {
            if (e !== 'No file') console.warn('Load failed:', e);
        }
    }
}
