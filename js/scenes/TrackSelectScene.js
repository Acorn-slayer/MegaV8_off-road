// TrackSelectScene — Pick a track before racing.
// Loads JSON tracks from tracks_descriptor/manifest.json on first visit.

class TrackSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TrackSelectScene' });
        this._jsonLoaded = false;
    }

    create() {
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        this._loadingText = this.add.text(640, 360, 'Loading tracks...', {
            fontSize: '12px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#888888'
        }).setOrigin(0.5);

        if (this._jsonLoaded) {
            this._buildUI();
        } else {
            this._loadJsonTracks().then(() => {
                this._jsonLoaded = true;
                this._buildUI();
            });
        }
    }

    async _loadJsonTracks() {
        try {
            const resp = await fetch('tracks_descriptor/manifest.json?_=' + Date.now());
            if (!resp.ok) return;
            const manifest = await resp.json();
            const files = manifest.tracks || [];

            for (const file of files) {
                const r = await fetch('tracks_descriptor/' + file);
                if (!r.ok) continue;
                const def = await r.json();
                // Skip if already loaded by name
                if (GameState.tracks.some(t => t.name === def.name)) continue;
                const track = TrackBuilder.build(def);
                TrackBuilder.centerTrack(track);
                GameState.tracks.push(track);
            }
        } catch (e) {
            console.log('No JSON tracks loaded:', e.message);
        }
    }

    _buildUI() {
        if (this._loadingText) this._loadingText.destroy();

        this.add.text(640, 40, 'SELECT MODE', {
            fontSize: '28px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Money display (top right)
        this.add.text(1260, 15, `$${GameState.money}`, {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0);

        // Garage button (top right, below money)
        const garageBtn = this.add.text(1260, 42, '🔧 GARAGE', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            backgroundColor: '#0f3460',
            padding: { x: 8, y: 4 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        garageBtn.on('pointerover', () => garageBtn.setStyle({ backgroundColor: '#1a5276' }));
        garageBtn.on('pointerout', () => garageBtn.setStyle({ backgroundColor: '#0f3460' }));
        garageBtn.on('pointerdown', () => {
            GameState.gameMode = 'single';
            this.scene.start('ShopScene');
        });

        // Save game button (top left, below player name)
        this.add.text(20, 15, GameState.playerName, {
            fontSize: '12px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });

        const saveBtn = this.add.text(20, 42, '💾 SAVE', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88',
            backgroundColor: '#0f3460',
            padding: { x: 8, y: 4 }
        }).setInteractive({ useHandCursor: true });
        saveBtn.on('pointerover', () => saveBtn.setStyle({ backgroundColor: '#1a5276' }));
        saveBtn.on('pointerout', () => saveBtn.setStyle({ backgroundColor: '#0f3460' }));
        saveBtn.on('pointerdown', () => { this._saveGame(saveBtn); });

        this._drawChampionshipButton();

        this.add.text(640, 145, 'or pick a single track:', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#888888'
        }).setOrigin(0.5);

        // Track cards — scrollable 2-column grid
        const tracks = GameState.tracks;
        const cardW = 310, cardH = 130, gap = 20, cols = 3;
        const totalW = cols * cardW + (cols - 1) * gap;
        const startX = (1280 - totalW) / 2 + cardW / 2;
        const startY = 170;

        const rows = Math.ceil(tracks.length / cols);
        const contentH = rows * (cardH + gap);
        const viewH = 490;
        this._scrollY = 0;
        this._maxScroll = Math.max(0, contentH - viewH);

        this._cardContainer = this.add.container(0, 0);

        for (let i = 0; i < tracks.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = startX + col * (cardW + gap);
            const cy = startY + row * (cardH + gap) + cardH / 2;
            this._drawTrackCard(tracks[i], cx, cy, cardW, cardH);
        }

        // Clip mask so cards don't overflow into header/footer
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, startY - 10, 1280, viewH + 20);
        const mask = maskShape.createGeometryMask();
        this._cardContainer.setMask(mask);

        // Mouse wheel scroll
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this._scrollY = Phaser.Math.Clamp(this._scrollY + deltaY * 0.5, 0, this._maxScroll);
            this._cardContainer.y = -this._scrollY;
        });

        // Arrow key scroll
        this.input.keyboard.on('keydown-UP', () => {
            this._scrollY = Phaser.Math.Clamp(this._scrollY - 40, 0, this._maxScroll);
            this._cardContainer.y = -this._scrollY;
        });
        this.input.keyboard.on('keydown-DOWN', () => {
            this._scrollY = Phaser.Math.Clamp(this._scrollY + 40, 0, this._maxScroll);
            this._cardContainer.y = -this._scrollY;
        });

        if (this._maxScroll > 0) {
            this.add.text(640, 675, String.fromCharCode(8597) + ' Scroll for more tracks', {
                fontSize: '8px',
                fontFamily: "'Press Start 2P', cursive",
                color: '#555555'
            }).setOrigin(0.5);
        }

        this.add.text(640, 695, 'ESC = Back', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#666666'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-ESC', () => {
            this.scene.start('BootScene');
        });
    }

    _drawTrackCard(track, cx, cy, w, h) {
        const gfx = this.add.graphics();
        this._cardContainer.add(gfx);

        // Card background
        gfx.fillStyle(0x2a2a4e, 0.9);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);

        // Track name
        const nameText = this.add.text(cx, cy - h / 2 + 25, track.name, {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);
        this._cardContainer.add(nameText);

        // Mini track preview
        this._drawMiniTrack(gfx, track, cx, cy + 10, w - 40, h - 60);

        // Clickable zone
        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        this._cardContainer.add(zone);
        zone.on('pointerover', () => {
            gfx.clear();
            gfx.fillStyle(0x3a3a6e, 0.9);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
            gfx.lineStyle(2, 0xffcc00, 1);
            gfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
            this._drawMiniTrack(gfx, track, cx, cy + 10, w - 40, h - 60);
        });
        zone.on('pointerout', () => {
            gfx.clear();
            gfx.fillStyle(0x2a2a4e, 0.9);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
            this._drawMiniTrack(gfx, track, cx, cy + 10, w - 40, h - 60);
        });
        zone.on('pointerdown', () => {
            GameState.gameMode = 'single';
            GameState.selectedTrack = track;
            this.scene.start('TruckSelectScene');
        });
    }

    _drawMiniTrack(gfx, track, cx, cy, maxW, maxH) {
        const wps = track.waypoints;
        if (!wps || wps.length < 2) return;

        // Find bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const wp of wps) {
            minX = Math.min(minX, wp[0]);
            maxX = Math.max(maxX, wp[0]);
            minY = Math.min(minY, wp[1]);
            maxY = Math.max(maxY, wp[1]);
        }
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scale = Math.min(maxW / rangeX, maxH / rangeY) * 0.85;
        const offX = cx - (minX + rangeX / 2) * scale;
        const offY = cy - (minY + rangeY / 2) * scale;

        // Draw track path
        gfx.lineStyle(3, track.trackColor, 0.8);
        gfx.beginPath();
        gfx.moveTo(wps[0][0] * scale + offX, wps[0][1] * scale + offY);
        for (let i = 1; i < wps.length; i++) {
            gfx.lineTo(wps[i][0] * scale + offX, wps[i][1] * scale + offY);
        }
        gfx.closePath();
        gfx.strokePath();

        // Draw walls if any
        if (track.walls && track.walls.length > 0) {
            gfx.lineStyle(1, track.wallColor || 0xcccccc, 0.5);
            for (const w of track.walls) {
                gfx.beginPath();
                gfx.moveTo(w[0] * scale + offX, w[1] * scale + offY);
                gfx.lineTo(w[2] * scale + offX, w[3] * scale + offY);
                gfx.strokePath();
            }
        }

        // Draw a mini truck at the start to show truck scale
        if (wps.length >= 2) {
            const ts = (track.truckScale || 1) * scale;
            const sx = wps[0][0] * scale + offX;
            const sy = wps[0][1] * scale + offY;
            // Heading from wp0 → wp1
            const dx = wps[1][0] - wps[0][0], dy = wps[1][1] - wps[0][1];
            const ang = Math.atan2(dy, dx);

            // Body
            gfx.fillStyle(0xff0000, 1);
            const bw = 5 * ts, bh = 9 * ts;
            // Draw an oriented rectangle manually (no save/restore in Phaser Graphics)
            const cosA = Math.cos(ang), sinA = Math.sin(ang);
            const hw = bw / 2, hh = bh / 2;
            const corners = [
                [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]
            ].map(([lx, ly]) => [sx + lx * cosA - ly * sinA, sy + lx * sinA + ly * cosA]);
            gfx.fillStyle(0xff0000, 1);
            gfx.fillPoints(corners.map(c => ({ x: c[0], y: c[1] })), true);

            // Wheels (4 small dark rectangles)
            const wheelW = 1.5 * ts, wheelH = 2.5 * ts;
            const wheelPositions = [
                [-hw - wheelW/2, -hh + wheelH], [hw + wheelW/2, -hh + wheelH],
                [-hw - wheelW/2, hh - wheelH], [hw + wheelW/2, hh - wheelH]
            ];
            gfx.fillStyle(0x222222, 1);
            for (const [lx, ly] of wheelPositions) {
                const wc = [
                    [-wheelW/2, -wheelH/2], [wheelW/2, -wheelH/2],
                    [wheelW/2, wheelH/2], [-wheelW/2, wheelH/2]
                ].map(([wx, wy]) => [
                    sx + (lx + wx) * cosA - (ly + wy) * sinA,
                    sy + (lx + wx) * sinA + (ly + wy) * cosA
                ]);
                gfx.fillPoints(wc.map(c => ({ x: c[0], y: c[1] })), true);
            }
        }
    }

    _drawChampionshipButton() {
        const cx = 640, cy = 100, w = 360, h = 40;
        const gfx = this.add.graphics();
        gfx.fillStyle(0x884400, 0.9);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);

        this.add.text(cx, cy, '🏆 CHAMPIONSHIP', {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00'
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            gfx.clear();
            gfx.fillStyle(0xaa5500, 0.9);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
            gfx.lineStyle(2, 0xffcc00, 1);
            gfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
        });
        zone.on('pointerout', () => {
            gfx.clear();
            gfx.fillStyle(0x884400, 0.9);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
        });
        zone.on('pointerdown', () => {
            GameState.gameMode = 'championship';
            GameState.championshipRaceIndex = 0;
            GameState.championshipPoints = { player: 0, ai: [0, 0, 0] };
            // Shuffle track order for championship
            GameState.championshipOrder = Phaser.Utils.Array.Shuffle(
                GameState.tracks.map((_, i) => i)
            );
            GameState.selectedTrack = GameState.tracks[GameState.championshipOrder[0]];
            this.scene.start('TruckSelectScene');
        });
    }

    async _saveGame(btn) {
        const json = GameState.toSaveJSON();
        const filename = GameState.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.v8t';

        if (window.showSaveFilePicker) {
            try {
                const handle = await showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'V8 Save', accept: { 'application/json': ['.v8t'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                btn.setText('💾 SAVED ✅');
                this.time.delayedCall(1500, () => btn.setText('💾 SAVE'));
                return;
            } catch (e) {
                if (e.name === 'AbortError') return; // user cancelled
            }
        }
        // Fallback: download
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        btn.setText('💾 SAVED ✅');
        this.time.delayedCall(1500, () => btn.setText('💾 SAVE'));
    }
}
