// RaceScene — Main gameplay scene: renders the track and (later) trucks

class RaceScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RaceScene' });
    }

    create() {
        // Use selected track from GameState, default to Track1
        this.track = GameState.selectedTrack || Track1;

        // Draw the scene layers
        this.drawBackground();
        this.drawTrack();
        this.drawWalls();
        this.drawStartLine();
        this.drawTrackDetails();
        this.drawHazards();

        // Debug waypoints disabled (uncomment to show)
        // this.drawWaypoints();

        // ── Player truck ────────────────────────────────────────
        const startWp = this.track.waypoints[this.track.startLineIndex];
        const truckScale = this.track.truckScale || 1;

        // Compute start heading and grid vectors before placing any truck
        const _siNext = (this.track.startLineIndex + 1) % this.track.waypoints.length;
        const _nextWp = this.track.waypoints[_siNext];
        const startAngle = Math.atan2(_nextWp[1] - startWp[1], _nextWp[0] - startWp[0]);
        const _fwdX = Math.cos(startAngle), _fwdY = Math.sin(startAngle);
        const _perpX = -Math.sin(startAngle), _perpY = Math.cos(startAngle);
        const _rowSp = 32 * truckScale;   // row spacing along track
        const _laneSp = 24 * truckScale;  // lane spacing perpendicular to track
        // 4-slot 2×2 staggered grid; slot 0=player, 1-3=AI
        const _gridSlots = [
            { rowsBack: 1, side: -0.5 }, // slot 0 — player  (row 1, left)
            { rowsBack: 1, side:  0.5 }, // slot 1 — AI #0   (row 1, right)
            { rowsBack: 2, side: -0.5 }, // slot 2 — AI #1   (row 2, left)
            { rowsBack: 2, side:  0.5 }, // slot 3 — AI #2   (row 2, right)
        ];
        const _slotPos = (s) => ({
            x: startWp[0] - _fwdX * s.rowsBack * _rowSp + _perpX * s.side * _laneSp,
            y: startWp[1] - _fwdY * s.rowsBack * _rowSp + _perpY * s.side * _laneSp,
        });

        const playerColor = GameState.getPlayerColor();
        const playerPreset = GameState.getBaseStats();
        const playerType = playerPreset.type || 'truck';
        const _p0 = _slotPos(_gridSlots[0]);
        this.playerTruck = new Truck(this, _p0.x, _p0.y, playerColor, playerType);

        // Apply player stats from upgrades + truck preset
        const pStats = GameState.getPlayerStats();
        this.playerTruck.topSpeed = pStats.topSpeed;
        this.playerTruck.acceleration = pStats.acceleration;
        this.playerTruck.handling = pStats.handling;
        this.playerTruck.nitroMax = pStats.nitroMax;
        this.playerTruck.nitroFuel = pStats.nitroMax;

        this.playerTruck.angle = startAngle;

        // ── AI Opponents (with penalty that fades over races + upgrades) ──
        const aiPenalty = GameState.getAiPenaltyMultiplier();
        this.aiTrucks = [];
        // Pick AI colors that differ from the player's truck
        const allAiColors = [0x3388ff, 0xffcc00, 0x33cc33, 0xff66cc, 0xff8800];
        const availColors = allAiColors.filter(c => c !== GameState.playerColor);
        const aiConfigs = [
            { color: availColors[0], difficulty: 'easy',   slot: _gridSlots[1] },
            { color: availColors[1], difficulty: 'medium', slot: _gridSlots[2] },
            { color: availColors[2], difficulty: 'hard',   slot: _gridSlots[3] },
        ];
        // Map color→name for results display
        const colorNames = {
            0x3388ff: 'Blue', 0xffcc00: 'Gold', 0x33cc33: 'Green',
            0xff66cc: 'Pink', 0xff8800: 'Orange', 0xff0000: 'Red',
        };
        for (let ci = 0; ci < aiConfigs.length; ci++) {
            const cfg = aiConfigs[ci];
            const _gp = _slotPos(cfg.slot);
            const ai = new AiTruck(
                this,
                _gp.x,
                _gp.y,
                cfg.color,
                cfg.difficulty
            );
            ai.aiName = colorNames[cfg.color] || ('AI ' + (ci + 1));
            // Apply upgrade bonus from AI purchases
            const upgradeBonus = GameState.getAiUpgradeBonus(ci);
            ai.topSpeed += upgradeBonus.topSpeed;
            ai.acceleration += upgradeBonus.acceleration;
            ai.handling += upgradeBonus.handling;
            // Apply fading penalty (75% at race 0 → 100% at race 10+)
            ai.topSpeed *= aiPenalty;
            ai.acceleration *= aiPenalty;
            ai.handling *= aiPenalty;
            ai.angle = startAngle;
            ai.raceMoney = 0;
            this.aiTrucks.push(ai);
        }

        // Store AI display names in GameState for championship results
        GameState.aiDisplayNames = this.aiTrucks.map(ai => ai.aiName);

        // All trucks for collision checks
        this.allTrucks = [this.playerTruck, ...this.aiTrucks];

        // Apply truck scale from track (if set)
        for (const t of this.allTrucks) {
            const vehicleScale = t.vehicleType === 'bike' ? 0.5 : t.vehicleType === 'f1' ? 0.72 : t.vehicleType === 'jet' ? 0.86 : t.vehicleType === 'tank' ? 1.1 : 1;
            t.setTruckScale(truckScale * vehicleScale);
            // Sync visual rotation to match the assigned heading
            t.truckGraphics.rotation = t.angle + Math.PI / 2;
        }

        // Freeze trucks until countdown finishes
        this._countdownActive = true;
        for (const t of this.allTrucks) {
            t._frozenSpeed = t.speed;
            t.speed = 0;
        }

        // ── Input ───────────────────────────────────────────────
        this.cursors = this.input.keyboard.createCursorKeys();
        this.nitroKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.cKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.musicKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.vKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
        this.touchControls = new TouchControls(this);
        this._pauseMenuActive = false;
        this._pauseMenuStage = null;
        this._pauseMenuContainer = null;
        this._pauseSavedSpeeds = [];

        // ── Race State ──────────────────────────────────────────
        this.currentLap = 0;
        this.totalLaps = this.track.lapCount;
        this.raceTime = 0;
        this.lapTime = 0;
        this.bestLapTime = Infinity;
        this.bestLapBonus = 100;  // $ bonus for setting best lap
        this.raceFinished = false;
        this.money = 0;
        this.lastWaypointIndex = 0;       // track progress around the loop
        this.expectedWaypoint = 1;        // next waypoint we expect (forward only)
        this.waypointsHit = new Set();    // which waypoints were passed this lap
        this.canCrossFinish = false;      // prevent instant lap on start
        this.offTrackTimer = 0;           // seconds spent off-track or going backward
        this.respawnThreshold = 3;        // seconds before auto-respawn
        this.goingWrongWay = false;        // true when player drives backward
        this._podiumNextSlot = 0;          // next podium position to assign (0=1st, 1=2nd, 2=3rd)
        this.cannonShells = [];             // active cannon shells (tank weapon)
        this.guidedMissiles = [];           // active homing missiles (jet weapon)

        // ── Coins & Nitro Pickups ───────────────────────────────
        this.pickups = [];
        this.spawnPickups();

        // ── Skid marks layer (below trucks, above track) ────────
        this.skidGfx = this.add.graphics().setDepth(5);
        this.skidMarks = [];  // array of {x, y, angle, alpha}

        // ── HUD ─────────────────────────────────────────────────
        // HUD elements use setScrollFactor(0) and are laid out after final
        // camera zoom is known so edge anchoring stays correct.
        const hudStyle = {
            fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        };

        this.lapText = this.add.text(0, 10, '', {
            ...hudStyle, fontSize: '18px', color: '#ffcc00'
        }).setOrigin(0.5, 0).setDepth(900).setScrollFactor(0);

        this.timerText = this.add.text(0, 32, '', {
            ...hudStyle, fontSize: '14px', color: '#cccccc'
        }).setOrigin(0.5, 0).setDepth(900).setScrollFactor(0);

        this.speedText = this.add.text(10, 10, '', hudStyle).setDepth(900).setScrollFactor(0);

        this.nitroText = this.add.text(10, 30, '', {
            ...hudStyle, color: '#00ccff'
        }).setDepth(900).setScrollFactor(0);

        this.cannonText = this.add.text(10, 30, '', {
            ...hudStyle, color: '#ffaa00'
        }).setDepth(900).setScrollFactor(0);

        this.moneyText = this.add.text(0, 10, '', {
            ...hudStyle, color: '#ffcc00'
        }).setOrigin(1, 0).setDepth(900).setScrollFactor(0);

        this.offTrackText = this.add.text(0, 55, '', {
            ...hudStyle, fontSize: '16px', color: '#ff4444'
        }).setOrigin(0.5).setDepth(900).setScrollFactor(0);

        this.bestLapText = this.add.text(0, 30, '', {
            ...hudStyle, fontSize: '12px', color: '#00ff88'
        }).setOrigin(1, 0).setDepth(900).setScrollFactor(0);

        this.positionText = this.add.text(10, 50, '', {
            ...hudStyle, fontSize: '16px', color: '#ffcc00'
        }).setDepth(900).setScrollFactor(0);

        this.messageText = this.add.text(0, 0, '', {
            fontSize: '32px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(950).setAlpha(0).setScrollFactor(0);

        this._initDomUi();
        [
            this.lapText,
            this.timerText,
            this.speedText,
            this.nitroText,
            this.cannonText,
            this.moneyText,
            this.offTrackText,
            this.bestLapText,
            this.positionText,
            this.messageText,
        ].forEach(obj => obj && obj.setVisible(false));

        // ── Create dust particle texture ─────────────────────────
        if (!this.textures.exists('dustParticle')) {
            const gfx = this.make.graphics({ add: false });
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(4, 4, 4);
            gfx.generateTexture('dustParticle', 8, 8);
            gfx.destroy();
        }

        // ── Dust particles ──────────────────────────────────────
        this.dustEmitters = [];
        for (const truck of this.allTrucks) {
            const particles = this.add.particles(0, 0, 'dustParticle', {
                speed: { min: 10, max: 40 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.4, end: 0 },
                lifespan: { min: 300, max: 600 },
                tint: 0x8B7355,
                emitting: false,
                quantity: 1,
            });
            particles.setDepth(50);
            this.dustEmitters.push({ truck, particles });
        }

        // ── Water spray particle texture ────────────────────────
        if (!this.textures.exists('waterParticle')) {
            const gfx = this.make.graphics({ add: false });
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(3, 3, 3);
            gfx.generateTexture('waterParticle', 6, 6);
            gfx.destroy();
        }

        // ── Water spray emitters (one per truck) ────────────────
        this.waterEmitters = [];
        for (const truck of this.allTrucks) {
            const particles = this.add.particles(0, 0, 'waterParticle', {
                speed: { min: 30, max: 80 },
                scale: { start: 0.6, end: 0 },
                alpha: { start: 0.6, end: 0 },
                lifespan: { min: 200, max: 500 },
                tint: [0x66bbff, 0x88ddff, 0xaaeeff],
                emitting: false,
                quantity: 2,
            });
            particles.setDepth(55);
            this.waterEmitters.push({ truck, particles });
        }

        // ── Start engine sound ──────────────────────────────────
        soundFX.init();  // ensure audio context is created & resumed
        this._lastBoostState = false;

        // ── Camera follow (Micro Machines style) ────────────────
        const worldW = this.track.worldW || 3200;
        const worldH = this.track.worldH || 1800;
        this.cameras.main.setBounds(0, 0, worldW, worldH);
        this.cameras.main.startFollow(this.playerTruck, true, 0.09, 0.09);

        // Normalize zoom from the straight corridor width after TrackBuilder.centerTrack()
        // has scaled the geometry into world space. This keeps the visible corridor size
        // stable on screen, which is what the player actually sees.
        const scaledWidth = Math.max(this._getScaledStraightTrackWidth(), 1);
        const targetCorridorPx = this._getTrackZoomTargetPx();
        const zoom = Phaser.Math.Clamp(targetCorridorPx / scaledWidth, this._getMinimumCameraZoom(worldW, worldH), 3.5);
        this.cameras.main.setZoom(zoom);
        this._layoutHud();
        this.scale.on('resize', this._layoutHud, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this._layoutHud, this);
        });

        // ── Pre-race countdown with traffic lights ──────────────
        this._startCountdown();
    }

    _startCountdown() {
        if (this._domUi) {
            this._showCountdownDom();
            soundFX.playApplause && soundFX.playApplause();

            this.time.delayedCall(1000, () => {
                this._domUi && (this._domUi.lights[0].style.background = '#ff0000');
                soundFX.playBeep && soundFX.playBeep('high');
            });

            this.time.delayedCall(2000, () => {
                this._domUi && (this._domUi.lights[1].style.background = '#ff0000');
                soundFX.playBeep && soundFX.playBeep('high');
            });

            this.time.delayedCall(3500, () => {
                if (this._domUi) {
                    this._domUi.lights[0].style.background = '#333333';
                    this._domUi.lights[1].style.background = '#333333';
                    this._domUi.lights[2].style.background = '#00ff00';
                }
                soundFX.playBeep && soundFX.playBeep('low');
                this._countdownActive = false;
                for (const t of this.allTrucks) {
                    t.speed = 0;
                }
                this.showMessage('GO!', 1000);
                soundFX.startEngine();
                soundFX.playStartJingle();
                soundFX.startMusic();
            });

            this.time.delayedCall(4500, () => {
                this._hideCountdownDom();
            });
            return;
        }

        const cx = this.scale.width / 2;
        const cy = this.scale.height * 0.28;
        const lightR = 22;
        const lightGap = 55;
        const bgW = 80, bgH = 180;

        // Background box for lights
        const lightBg = this.add.graphics().setDepth(1000).setScrollFactor(0);
        lightBg.fillStyle(0x222222, 0.9);
        lightBg.fillRoundedRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 10);
        lightBg.lineStyle(3, 0x444444, 1);
        lightBg.strokeRoundedRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 10);

        // Three light circles (dim)
        const lights = [];
        for (let i = 0; i < 3; i++) {
            const g = this.add.graphics().setDepth(1001).setScrollFactor(0);
            const ly = cy - lightGap + i * lightGap;
            g.fillStyle(0x333333, 1);
            g.fillCircle(cx, ly, lightR);
            lights.push({ gfx: g, x: cx, y: ly });
        }

        // Applause / crowd ambience
        soundFX.playApplause && soundFX.playApplause();

        // Red light 1 at 1s
        this.time.delayedCall(1000, () => {
            lights[0].gfx.clear();
            lights[0].gfx.fillStyle(0xff0000, 1);
            lights[0].gfx.fillCircle(lights[0].x, lights[0].y, lightR);
            soundFX.playBeep && soundFX.playBeep('high');
        });

        // Red light 2 at 2s
        this.time.delayedCall(2000, () => {
            lights[1].gfx.clear();
            lights[1].gfx.fillStyle(0xff0000, 1);
            lights[1].gfx.fillCircle(lights[1].x, lights[1].y, lightR);
            soundFX.playBeep && soundFX.playBeep('high');
        });

        // Green light at 3.5s — GO!
        this.time.delayedCall(3500, () => {
            // Turn reds off
            lights[0].gfx.clear();
            lights[0].gfx.fillStyle(0x333333, 1);
            lights[0].gfx.fillCircle(lights[0].x, lights[0].y, lightR);
            lights[1].gfx.clear();
            lights[1].gfx.fillStyle(0x333333, 1);
            lights[1].gfx.fillCircle(lights[1].x, lights[1].y, lightR);
            // Green ON
            lights[2].gfx.clear();
            lights[2].gfx.fillStyle(0x00ff00, 1);
            lights[2].gfx.fillCircle(lights[2].x, lights[2].y, lightR);
            soundFX.playBeep && soundFX.playBeep('low');

            // Unfreeze trucks
            this._countdownActive = false;
            for (const t of this.allTrucks) {
                t.speed = 0;
            }

            this.showMessage('GO!', 1000);
            soundFX.startEngine();
            soundFX.playStartJingle();
            soundFX.startMusic();
        });

        // Remove lights at 4.5s
        this.time.delayedCall(4500, () => {
            lightBg.destroy();
            for (const l of lights) l.gfx.destroy();
        });
    }

    // ── Spawn coins and nitro pickups along the track ───────────
    spawnPickups() {
        const { waypoints, trackWidth } = this.track;
        const truckScale = this.track.truckScale || 1;
        const len = waypoints.length;

        // Spawn 12 coins at random positions along the track
        for (let i = 0; i < 12; i++) {
            // Pick a random segment between two waypoints
            const idx = Math.floor(Math.random() * len);
            const nextIdx = (idx + 1) % len;
            const t = Math.random(); // interpolation factor
            const x = waypoints[idx][0] + (waypoints[nextIdx][0] - waypoints[idx][0]) * t;
            const y = waypoints[idx][1] + (waypoints[nextIdx][1] - waypoints[idx][1]) * t;
            // Random offset perpendicular to track
            const offsetX = (Math.random() - 0.5) * trackWidth * 0.6;
            const offsetY = (Math.random() - 0.5) * trackWidth * 0.6;
            const coin = new Coin(this, x + offsetX, y + offsetY, 'money');
            coin.setScale(truckScale * 0.82);
            coin.radius *= truckScale * 1.02;
            this.pickups.push(coin);
        }

        // Spawn 3 nitro canisters at random spots
        for (let i = 0; i < 3; i++) {
            const idx = Math.floor(Math.random() * len);
            const nextIdx = (idx + 1) % len;
            const t = Math.random();
            const x = waypoints[idx][0] + (waypoints[nextIdx][0] - waypoints[idx][0]) * t;
            const y = waypoints[idx][1] + (waypoints[nextIdx][1] - waypoints[idx][1]) * t;
            const offsetX = (Math.random() - 0.5) * trackWidth * 0.4;
            const offsetY = (Math.random() - 0.5) * trackWidth * 0.4;
            const nitro = new Coin(this, x + offsetX, y + offsetY, 'nitro');
            nitro.setScale(truckScale * 0.82);
            nitro.radius *= truckScale * 1.02;
            this.pickups.push(nitro);
        }
    }

    // Estimate corridor width from wall pairs on straight segments.
    _getEffectiveTrackCorridorWidth() {
        const fallback = Math.max(this.track.trackWidth || 70, 1);
        const walls = this.track.walls || [];
        if (walls.length < 2) return fallback;

        const widths = [];
        const maxAngle = Math.PI / 12; // 15° tolerance for parallel walls

        for (let i = 0; i < walls.length; i++) {
            const a = walls[i];
            const adx = a[2] - a[0], ady = a[3] - a[1];
            const alen = Math.sqrt(adx * adx + ady * ady) || 1;
            const aAngle = Math.atan2(ady, adx);
            const acx = (a[0] + a[2]) * 0.5;
            const acy = (a[1] + a[3]) * 0.5;

            for (let j = i + 1; j < walls.length; j++) {
                const b = walls[j];
                const bdx = b[2] - b[0], bdy = b[3] - b[1];
                const blen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
                const bAngle = Math.atan2(bdy, bdx);

                let da = Math.abs(Phaser.Math.Angle.Wrap(aAngle - bAngle));
                da = Math.min(da, Math.abs(Math.PI - da));
                if (da > maxAngle) continue;

                const bcx = (b[0] + b[2]) * 0.5;
                const bcy = (b[1] + b[3]) * 0.5;
                const dist = Math.sqrt((acx - bcx) * (acx - bcx) + (acy - bcy) * (acy - bcy));

                const avgLen = (alen + blen) * 0.5;
                if (dist < avgLen * 0.25 || dist > avgLen * 4.0) continue;
                widths.push(dist);
            }
        }

        if (widths.length === 0) return fallback;
        widths.sort((x, y) => x - y);
        return widths[Math.floor(widths.length * 0.5)] || fallback;
    }

    // Get straight-track corridor width in unscaled track units.
    // Prefer source program width (true design width), fallback to de-scaled runtime width.
    _getScaledStraightTrackWidth() {
        if (Number.isFinite(this.track && this.track.trackWidth) && this.track.trackWidth > 0) {
            return this.track.trackWidth;
        }

        const program = this.track && this.track._program;
        const normalizedWidth = Math.max((program && program.trackWidth) || 70, 1);
        const scaledTruck = Math.max(this.track.truckScale || 1, 0.01);
        const programTruck = Math.max((program && program.truckScale) || 1, 0.01);
        const geometryScale = Math.max(scaledTruck / programTruck, 0.01);
        return normalizedWidth * geometryScale;
    }

    _getTrackZoomTargetPx() {
        const program = this.track && this.track._program;
        const perTrack = Number(program && program.zoomTargetPx);
        if (Number.isFinite(perTrack) && perTrack > 0) return perTrack;
        return 100;
    }

    _getMinimumCameraZoom(worldW, worldH) {
        const minZoomX = this.scale.width / Math.max(worldW || 1, 1);
        const minZoomY = this.scale.height / Math.max(worldH || 1, 1);
        return Math.max(minZoomX, minZoomY, 0.01);
    }

    _initDomUi() {
        const host = document.getElementById('game-container') || document.body;
        if (window.getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }

        const root = document.createElement('div');
        root.style.cssText = [
            'position:fixed',
            'left:0',
            'top:0',
            'width:0',
            'height:0',
            'pointer-events:none',
            'z-index:30',
            'font-family:Arial, sans-serif',
            'color:#ffffff',
            'text-shadow:0 2px 0 #000, 0 0 6px rgba(0,0,0,0.8)',
        ].join(';');

        const make = (styleText) => {
            const el = document.createElement('div');
            el.style.cssText = `position:absolute;${styleText}`;
            root.appendChild(el);
            return el;
        };

        const pause = make('inset:0;display:none;background:rgba(0,0,0,0.75)');
        const pauseCard = document.createElement('div');
        pauseCard.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);text-align:center;min-width:420px;max-width:80vw';
        pause.appendChild(pauseCard);
        const pauseTitle = document.createElement('div');
        pauseTitle.style.cssText = 'font:42px "Press Start 2P", cursive;color:#ffcc00;margin-bottom:34px';
        pauseCard.appendChild(pauseTitle);
        const pauseLines = document.createElement('div');
        pauseLines.style.cssText = 'font:18px "Press Start 2P", cursive;line-height:2.2';
        pauseCard.appendChild(pauseLines);

        const countdown = make('inset:0;display:none');
        const countdownCard = document.createElement('div');
        countdownCard.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);width:80px;height:180px;border-radius:10px;background:rgba(34,34,34,0.9);border:3px solid #444;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px';
        countdown.appendChild(countdownCard);
        const lights = [];
        for (let i = 0; i < 3; i++) {
            const light = document.createElement('div');
            light.style.cssText = 'width:44px;height:44px;border-radius:50%;background:#333';
            countdownCard.appendChild(light);
            lights.push(light);
        }

        const ui = {
            root,
            lap: make('left:50%;top:12px;transform:translateX(-50%);font-size:22px;font-weight:700;color:#ffcc00;text-align:center;min-width:320px'),
            timer: make('left:50%;top:40px;transform:translateX(-50%);font-size:15px;color:#cccccc;text-align:center;min-width:420px'),
            speed: make('left:18px;bottom:86px;font-size:14px;max-width:min(520px, calc(100% - 36px))'),
            nitro: make('left:18px;bottom:62px;font-size:14px;color:#00ccff;max-width:min(520px, calc(100% - 36px))'),
            cannon: make('left:18px;bottom:62px;font-size:14px;color:#ffaa00;max-width:min(520px, calc(100% - 36px))'),
            money: make('right:18px;top:12px;font-size:18px;font-weight:700;color:#ffcc00;text-align:right;min-width:140px'),
            offTrack: make('left:50%;top:55px;transform:translateX(-50%);font-size:16px;color:#ff4444;text-align:center'),
            bestLap: make('right:18px;top:40px;font-size:12px;color:#00ff88;text-align:right;min-width:180px'),
            position: make('left:18px;top:12px;font-size:16px;color:#ffcc00;font-weight:700'),
            controls: make('left:18px;bottom:max(6px, env(safe-area-inset-bottom));font-size:clamp(14px, 1.9vw, 18px);font-weight:700;color:#dddddd;text-align:left;width:min(560px, calc(100% - 36px));white-space:normal;line-height:1.35;padding:8px 12px;background:rgba(0,0,0,0.35);border-radius:10px'),
            message: make('left:50%;top:50%;transform:translate(-50%, -50%);font-size:32px;font-family:Arial Black, Arial, sans-serif;font-weight:900;display:none;text-align:center'),
            results: make('inset:0;display:none;background:rgba(0,0,0,0.76);pointer-events:auto'),
            pause,
            pauseTitle,
            pauseLines,
            countdown,
            lights,
        };

        const resultsCard = document.createElement('div');
        resultsCard.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);width:min(760px, calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:22px 20px 18px;border-radius:16px;background:rgba(16,22,33,0.92);border:1px solid rgba(255,255,255,0.12);box-shadow:0 16px 50px rgba(0,0,0,0.35)';
        ui.results.appendChild(resultsCard);
        const resultsTitle = document.createElement('div');
        resultsTitle.style.cssText = 'font:30px Arial Black, Arial, sans-serif;color:#ffcc00;text-align:center;margin-bottom:12px';
        resultsCard.appendChild(resultsTitle);
        const resultsSummary = document.createElement('div');
        resultsSummary.style.cssText = 'font-size:18px;text-align:center;margin-bottom:10px';
        resultsCard.appendChild(resultsSummary);
        const resultsMeta = document.createElement('div');
        resultsMeta.style.cssText = 'font-size:14px;text-align:center;color:#d8e3f1;line-height:1.7';
        resultsCard.appendChild(resultsMeta);
        const resultsPodium = document.createElement('div');
        resultsPodium.style.cssText = 'display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;margin:16px 0 12px';
        resultsCard.appendChild(resultsPodium);
        const resultsStandings = document.createElement('div');
        resultsStandings.style.cssText = 'font-size:13px;color:#d8e3f1;line-height:1.6;margin-bottom:14px';
        resultsCard.appendChild(resultsStandings);
        const resultsActions = document.createElement('div');
        resultsActions.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:12px';
        resultsCard.appendChild(resultsActions);
        Object.assign(ui, {
            resultsCard,
            resultsTitle,
            resultsSummary,
            resultsMeta,
            resultsPodium,
            resultsStandings,
            resultsActions,
        });

        host.appendChild(root);
        this._domUi = ui;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._destroyDomUi());
    }

    _destroyDomUi() {
        if (this._messageHideCall) {
            this._messageHideCall.remove(false);
            this._messageHideCall = null;
        }
        if (this._domUi && this._domUi.root && this._domUi.root.parentNode) {
            this._domUi.root.parentNode.removeChild(this._domUi.root);
        }
        this._domUi = null;
    }

    _setDomText(key, value) {
        if (!this._domUi || !this._domUi[key]) return;
        this._domUi[key].textContent = value || '';
        this._domUi[key].style.display = value ? 'block' : 'none';
    }

    _showPauseDom(title, lines) {
        if (!this._domUi) return;
        this._domUi.pauseTitle.textContent = title;
        this._domUi.pauseLines.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
        this._domUi.pause.style.display = 'block';
    }

    _hidePauseDom() {
        if (!this._domUi) return;
        this._domUi.pause.style.display = 'none';
    }

    _showCountdownDom() {
        if (!this._domUi) return;
        this._domUi.countdown.style.display = 'block';
        this._domUi.lights.forEach(light => { light.style.background = '#333'; });
    }

    _hideCountdownDom() {
        if (!this._domUi) return;
        this._domUi.countdown.style.display = 'none';
    }

    _hideResultsDom() {
        if (!this._domUi) return;
        this._domUi.results.style.display = 'none';
        this._domUi.resultsActions.innerHTML = '';
    }

    _createResultsDomButton(label, onClick, options = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = [
            'border:none',
            'border-radius:10px',
            `background:${options.background || '#0f3460'}`,
            `color:${options.color || '#ffffff'}`,
            `padding:${options.padding || '10px 16px'}`,
            `font:${options.font || '700 14px Arial, sans-serif'}`,
            'cursor:pointer',
            'pointer-events:auto',
            'box-shadow:0 0 0 1px rgba(255,255,255,0.1) inset'
        ].join(';');
        btn.addEventListener('click', onClick);
        return btn;
    }

    _showResultsDom() {
        if (!this._domUi) return;

        const posLabels = ['1ST', '2ND', '3RD', '4TH'];
        const posColors = ['#ffcc00', '#d9d9d9', '#cd7f32', '#888888'];
        const posBonus = GameState.positionBonus[this.playerPosition - 1] || 0;
        const standings = this.finishPositions || [];
        const podium = standings.slice(0, 3);
        const isChamp = GameState.gameMode === 'championship';
        const isLastChampRace = isChamp && GameState.championshipRaceIndex >= GameState.tracks.length - 1;

        this._domUi.resultsTitle.textContent = 'RACE RESULTS';
        this._domUi.resultsSummary.innerHTML = `You finished <span style="color:${posColors[this.playerPosition - 1]};font-weight:800">${posLabels[this.playerPosition - 1]}</span>${posBonus > 0 ? ` <span style="color:#00ff88">| +$${posBonus} bonus</span>` : ''}`;
        this._domUi.resultsMeta.innerHTML = [
            `Total Time: ${this.formatTime(this.raceTime)}`,
            `Best Lap: ${this.formatTime(this.bestLapTime)}`,
            `Money Earned: $${this.money}`,
            isChamp ? `Championship: Race ${GameState.championshipRaceIndex + 1} / ${GameState.tracks.length}` : ''
        ].filter(Boolean).map(line => `<div>${line}</div>`).join('');

        this._domUi.resultsPodium.innerHTML = podium.map((entry, index) => {
            const colors = ['#ffcc00', '#d9d9d9', '#cd7f32'];
            const height = [116, 92, 72][index];
            return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:140px">
                <div style="font-size:12px;color:#d8e3f1;margin-bottom:8px;text-align:center">${entry.name}</div>
                <div style="width:100%;max-width:160px;height:${height}px;border-radius:12px 12px 6px 6px;background:${colors[index]};color:#111;display:flex;align-items:center;justify-content:center;font:800 18px Arial, sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.3)">${posLabels[index]}</div>
            </div>`;
        }).join('');

        this._domUi.resultsStandings.innerHTML = standings.map((entry, index) => {
            const suffix = posLabels[index] || `${index + 1}TH`;
            const extra = entry.isPlayer ? ' | YOU' : '';
            return `<div>${suffix} - ${entry.name}${extra}</div>`;
        }).join('');

        this._domUi.resultsActions.innerHTML = '';
        if (isChamp) {
            this._domUi.resultsActions.appendChild(this._createResultsDomButton(isLastChampRace ? 'RESULTS' : 'CONTINUE', () => {
                if (isLastChampRace) {
                    this.scene.start('ChampionshipResultsScene');
                } else {
                    GameState.championshipRaceIndex++;
                    const idx = GameState.championshipRaceIndex;
                    const order = GameState.championshipOrder || [];
                    const trackIdx = order[idx] !== undefined ? order[idx] : idx;
                    if (trackIdx < GameState.tracks.length) {
                        GameState.selectedTrack = GameState.tracks[trackIdx];
                    }
                    this.scene.start('RaceScene');
                }
            }));
            this._domUi.resultsActions.appendChild(this._createResultsDomButton('GARAGE', () => {
                GameState._champReturnToResults = true;
                this.scene.start('ShopScene');
            }));
            const saveBtn = this._createResultsDomButton('SAVE', () => this._champSaveGame(saveBtn));
            this._domUi.resultsActions.appendChild(saveBtn);
            this._domUi.resultsActions.appendChild(this._createResultsDomButton('QUIT CHAMPIONSHIP', () => {
                GameState.gameMode = 'single';
                this.scene.start('TrackSelectScene');
            }, { background: '#5a1a1a', color: '#ffdddd' }));
            const pts = GameState.championshipPoints;
            this._domUi.resultsStandings.innerHTML += `<div style="margin-top:10px;color:#aaaaaa">Points: ${GameState.playerName}: ${pts.player} | Blue: ${pts.ai[0]} | Yellow: ${pts.ai[1]} | Green: ${pts.ai[2]}</div>`;
        } else {
            this._domUi.resultsActions.appendChild(this._createResultsDomButton('REPLAY', () => {
                this.scene.start('RaceScene');
            }, { font: '800 16px Arial Black, Arial, sans-serif', padding: '12px 20px' }));
            this._domUi.resultsActions.appendChild(this._createResultsDomButton('MENU', () => {
                this.scene.start('TrackSelectScene');
            }, { font: '800 16px Arial Black, Arial, sans-serif', padding: '12px 20px' }));
        }

        this._domUi.results.style.display = 'block';
    }

    _layoutHud() {
        if (this._domUi && this._domUi.root) {
            const rect = this.game.canvas.getBoundingClientRect();
            this._domUi.root.style.left = `${rect.left}px`;
            this._domUi.root.style.top = `${rect.top}px`;
            this._domUi.root.style.width = `${rect.width}px`;
            this._domUi.root.style.height = `${rect.height}px`;
        }
    }

    // ── Flash a big message ─────────────────────────────────────
    showMessage(text, duration) {
        if (this._domUi) {
            this._setDomText('message', text);
            if (this._messageHideCall) this._messageHideCall.remove(false);
            this._messageHideCall = this.time.delayedCall(duration || 1500, () => {
                this._setDomText('message', '');
                this._messageHideCall = null;
            });
            return;
        }

        this.messageText.setText(text).setAlpha(1);
        this.tweens.add({
            targets: this.messageText,
            alpha: 0,
            duration: duration || 1500,
            ease: 'Power2'
        });
    }

    _openPauseMenu() {
        if (this._pauseMenuActive) return;
        this._pauseMenuActive = true;
        this._pauseMenuStage = 'menu';
        this._pauseSavedSpeeds = this.allTrucks.map(t => ({ truck: t, speed: t.speed, nitroBoosting: t.nitroBoosting }));
        for (const t of this.allTrucks) {
            t.speed = 0;
        }
        soundFX.stopEngine();
        soundFX.updateTireScreech(0);

        if (this._domUi) {
            this._showPauseDom('RACE MENU', [
                'R = Resume',
                'F = Forfeit Race',
                'ESC = Resume',
            ]);
            return;
        }

        const cw = this.scale.width;
        const ch = this.scale.height;
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(0, 0, cw, ch);

        const title = this.add.text(cw / 2, ch * 0.22, 'RACE MENU', {
            fontSize: '42px', fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        const lines = [
            'R = Resume',
            'F = Forfeit Race',
            'ESC = Resume'
        ];

        const texts = [];
        for (let i = 0; i < lines.length; i++) {
            const t = this.add.text(cw / 2, ch * 0.34 + i * 40, lines[i], {
                fontSize: '18px', fontFamily: "'Press Start 2P', cursive",
                color: '#ffffff'
            }).setOrigin(0.5);
            texts.push(t);
        }

        this._pauseMenuContainer = this.add.container(0, 0, [overlay, title, ...texts]).setScrollFactor(0);
    }

    _forfeitRace() {
        // Leave race immediately without rewards.
        this._quitToTrackSelect();
    }

    _closePauseMenu() {
        if (!this._pauseMenuActive) return;
        this._pauseMenuActive = false;
        this._pauseMenuStage = null;
        for (const saved of this._pauseSavedSpeeds) {
            saved.truck.speed = saved.speed;
            saved.truck.nitroBoosting = saved.nitroBoosting;
        }
        this._pauseSavedSpeeds = [];
        this._hidePauseDom();
        if (this._pauseMenuContainer) {
            this._pauseMenuContainer.destroy();
            this._pauseMenuContainer = null;
        }
        if (!GameState.musicMuted && !this.raceFinished && !this._countdownActive) {
            soundFX.startEngine();
        }
    }

    async _saveAndQuit() {
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
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        } else {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        this._quitToMain(true);
    }

    _quitToMain(save) {
        this._hidePauseDom();
        this._hideCountdownDom();
        this._hideResultsDom();
        if (this._pauseMenuContainer) {
            this._pauseMenuContainer.destroy();
            this._pauseMenuContainer = null;
        }
        this._pauseMenuActive = false;
        this._pauseMenuStage = null;
        this._pauseSavedSpeeds = [];
        soundFX.stopEngine();
        soundFX.stopMusic();
        soundFX.updateTireScreech(0);
        this.scene.start('BootScene');
    }

    _quitToTrackSelect() {
        this._hidePauseDom();
        this._hideCountdownDom();
        this._hideResultsDom();
        if (this._pauseMenuContainer) {
            this._pauseMenuContainer.destroy();
            this._pauseMenuContainer = null;
        }
        this._pauseMenuActive = false;
        this._pauseMenuStage = null;
        this._pauseSavedSpeeds = [];
        soundFX.stopEngine();
        soundFX.stopMusic();
        soundFX.updateTireScreech(0);
        this.scene.start('TrackSelectScene');
    }

    // ── Game Loop ───────────────────────────────────────────────
    update(time, delta) {
        // ESC toggles the single in-race pause menu
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            if (this._pauseMenuActive) {
                this._closePauseMenu();
            } else {
                this._openPauseMenu();
            }
            return;
        }

        if (this._pauseMenuActive) {
            if (this._pauseMenuStage === 'menu') {
                if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
                    this._closePauseMenu();
                }
                if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
                    this._forfeitRace();
                }
            }
            return;
        }

        // During countdown, freeze all trucks
        if (this._countdownActive) {
            for (const t of this.allTrucks) {
                t.speed = 0;
            }
            return;
        }

        // After race ends, keep updating trucks so they drive to podiums
        if (this.raceFinished) {
            const dt = delta / 1000;
            for (const ai of this.aiTrucks) {
                if (ai._destroyed) continue;
                if (ai.raceFinished) {
                    ai.update(delta, this.track.waypoints, this.allTrucks);
                }
            }
            // Player truck drives to podium too
            if (!this.playerTruck._destroyed && this.playerTruck._podiumTarget) {
                const dx = this.playerTruck._podiumTarget.x - this.playerTruck.x;
                const dy = this.playerTruck._podiumTarget.y - this.playerTruck.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    this.playerTruck.angle = Math.atan2(dy, dx);
                    this.playerTruck.speed = Math.min(80, dist * 2);
                    this.playerTruck.applyPhysics(dt);
                } else {
                    this.playerTruck.speed = 0;
                    this.playerTruck.x = this.playerTruck._podiumTarget.x;
                    this.playerTruck.y = this.playerTruck._podiumTarget.y;
                }
            }
            return;
        }

        // M → toggle music on/off
        if (Phaser.Input.Keyboard.JustDown(this.musicKey)) {
            GameState.musicMuted = !GameState.musicMuted;
            if (GameState.musicMuted) {
                soundFX.stopMusic();
            } else {
                soundFX.startMusic();
            }
        }

        // V → tank cannon / jet missile
        if (this.playerTruck.vehicleType === 'tank' && Phaser.Input.Keyboard.JustDown(this.vKey)) {
            this._fireCannonShell(this.playerTruck);
        } else if (this.playerTruck.vehicleType === 'jet' && Phaser.Input.Keyboard.JustDown(this.vKey)) {
            this._fireGuidedMissile(this.playerTruck);
        }

        const dt = delta / 1000;

        // Merge keyboard + touch input
        const input = {
            left:  { isDown: this.cursors.left.isDown  || this.touchControls.left.isDown },
            right: { isDown: this.cursors.right.isDown || this.touchControls.right.isDown },
            up:    { isDown: this.cursors.up.isDown    || this.touchControls.up.isDown },
            down:  { isDown: this.cursors.down.isDown  || this.touchControls.down.isDown },
        };

        const nitroInput = {
            isDown: this.nitroKey.isDown || this.touchControls.nitro.isDown
        };

        if (!this.playerTruck._destroyed) {
            this.playerTruck.update(delta, input, nitroInput);
        }

        // ── Engine sound (RPM + pitch scale with upgrade level) ──
        const base = GameState.getBaseStats();
        const maxPossibleSpeed = base.topSpeed + GameState.maxLevel * GameState.perLevel.topSpeed;
        const upgradeRatio = (GameState.getVehicleUpgrades(GameState.getPlayerColor()).topSpeed || 0) / GameState.maxLevel;
        soundFX.updateEngine(this.playerTruck.speed, maxPossibleSpeed, upgradeRatio, this.playerTruck.vehicleType);

        // ── Nitro boost sound (play once on activation) ────────
        if (this.playerTruck.nitroBoosting && !this._lastBoostState) {
            soundFX.playBoost();
        }
        this._lastBoostState = this.playerTruck.nitroBoosting;

        // ── Tire screech sound ─────────────────────────────────
        soundFX.updateTireScreech(this.playerTruck.driftAmount);

        // ── Update AI trucks ───────────────────────────────────
        for (const ai of this.aiTrucks) {
            if (ai._destroyed) continue;
            ai.update(delta, this.track.waypoints, this.allTrucks);
            // Mark AI as finished when they reach the lap count
            if (!ai.raceFinished && ai.lapsCompleted >= this.totalLaps) {
                ai.raceFinished = true;
                ai.finishTime = this.raceTime;
                this._assignPodiumSlot(ai);
            }
        }

        // ── Truck-to-truck collisions (bumping) ────────────────
        this.handleTruckCollisions();

        // ── Wall collisions ────────────────────────────────────
        this.handleWallCollisions();

        // ── Skid marks (all trucks) ────────────────────────────
        this._updateSkidMarks();

        // ── AI respawn: check AFTER wall collisions ────────────
        for (const ai of this.aiTrucks) {
            if (ai._destroyed) continue;
            if (!ai.onTrack) {
                if (!ai._offTrackTime) ai._offTrackTime = 0;
                ai._offTrackTime += dt;
                if (ai._offTrackTime >= this.respawnThreshold) {
                    this.respawnAi(ai);
                }
            } else {
                ai._offTrackTime = 0;
            }
        }

        // ── Timers ─────────────────────────────────────────────
        this.raceTime += dt;
        this.lapTime += dt;

        // ── Waypoint tracking for lap detection ────────────────
        this.updateWaypointTracking();

        // ── Off-track / backward respawn timer ─────────────────
        if (!this.playerTruck.onTrack) {
            this.offTrackTimer += dt;
        } else {
            this.offTrackTimer = 0;
        }
        if (this.offTrackTimer >= this.respawnThreshold) {
            this.respawnPlayer();
        }

        // ── Pickup collection (disabled when going wrong way) ─
        for (const pickup of this.pickups) {
            if (this.playerTruck._destroyed) break;
            if (!this.goingWrongWay && pickup.checkCollect(this.playerTruck)) {
                if (pickup.type === 'money') {
                    this.money += pickup.value;
                    this.showMessage('+$' + pickup.value, 800);
                    soundFX.playCoin();
                } else if (pickup.type === 'nitro') {
                    this.playerTruck.nitroFuel = Math.min(
                        this.playerTruck.nitroFuel + pickup.nitroAmount,
                        this.playerTruck.nitroMax
                    );
                    this.showMessage('+NITRO!', 800);
                    soundFX.playNitroPickup();
                }
            }
        }

        // ── AI pickup collection ───────────────────────────────
        for (const ai of this.aiTrucks) {
            if (ai._destroyed) continue;
            for (const pickup of this.pickups) {
                if (pickup.checkCollect(ai)) {
                    if (pickup.type === 'money') {
                        if (!ai.raceMoney) ai.raceMoney = 0;
                        ai.raceMoney += pickup.value;
                    } else if (pickup.type === 'nitro') {
                        ai.nitroFuel = Math.min(
                            ai.nitroFuel + pickup.nitroAmount,
                            ai.nitroMax
                        );
                    }
                }
            }
        }

        // ── Update HUD ─────────────────────────────────────────
        const speed = Math.abs(Math.round(this.playerTruck._destroyed ? 0 : this.playerTruck.speed));
        this.speedText.setText(`Speed: ${speed} mph`);
        if (this.playerTruck.vehicleType === 'tank') {
            this.nitroText.setText('');
            const elapsed = this.playerTruck._lastShot ? (this.time.now - this.playerTruck._lastShot) / 1000 : 99;
            this.cannonText.setText(elapsed >= 1.5 ? '🎯 [V] FIRE! READY' : `🎯 Cannon: ${(1.5 - elapsed).toFixed(1)}s`);
        } else {
            this.cannonText.setText('');
            this.nitroText.setText(`Nitro: ${'█'.repeat(Math.ceil(this.playerTruck.nitroFuel))}${'░'.repeat(Math.ceil(this.playerTruck.nitroMax - this.playerTruck.nitroFuel))}`);
        }
        const offTrackLabel =
            this.goingWrongWay ? 'WRONG WAY!' :
            !this.playerTruck.onTrack && this.offTrackTimer > 1 ? `OFF TRACK! Respawn in ${Math.ceil(this.respawnThreshold - this.offTrackTimer)}...` :
            !this.playerTruck.onTrack ? 'OFF TRACK!' : '';
        this.offTrackText.setText(offTrackLabel);
        this.lapText.setText(`Lap ${Math.min(this.currentLap + 1, this.totalLaps)} / ${this.totalLaps}`);
        this.timerText.setText(`Time: ${this.formatTime(this.raceTime)}  |  Lap: ${this.formatTime(this.lapTime)}`);
        this.moneyText.setText(`$${this.money}`);
        this.bestLapText.setText(this.bestLapTime < Infinity ? `Best Lap: ${this.formatTime(this.bestLapTime)}` : '');

        // ── Live position ──────────────────────────────────────
        const wpLen = this.track.waypoints.length;
        const playerProg = this.currentLap * wpLen + this.lastWaypointIndex;
        let pos = 1;
        for (const ai of this.aiTrucks) {
            if (ai._destroyed) continue;
            if (ai.totalProgress > playerProg) pos++;
        }
        const posLabelsHUD = ['1ST', '2ND', '3RD', '4TH'];
        this.positionText.setText(posLabelsHUD[pos - 1] || `${pos}TH`);

        if (this._domUi) {
            this._setDomText('speed', `Speed: ${speed} mph`);
            this._setDomText('nitro', this.playerTruck.vehicleType === 'tank' ? '' : this.nitroText.text);
            this._setDomText('cannon', this.playerTruck.vehicleType === 'tank' ? this.cannonText.text : '');
            this._setDomText('offTrack', offTrackLabel);
            this._setDomText('lap', this.lapText.text);
            this._setDomText('timer', this.timerText.text);
            this._setDomText('money', this.moneyText.text);
            this._setDomText('bestLap', this.bestLapText.text);
            this._setDomText('position', this.positionText.text);
            this._setDomText('controls', this.playerTruck.vehicleType === 'tank'
                ? 'ARROWS DRIVE  |  SPACE BOOST  |  V FIRE  |  ESC MENU'
                : this.playerTruck.vehicleType === 'jet'
                ? 'ARROWS FLY  |  SPACE BOOST  |  V MISSILE  |  ESC MENU'
                : 'ARROWS DRIVE  |  SPACE BOOST  |  ESC MENU');
        }

        // ── Hazard effects on all trucks ────────────────────────
        this.applyHazardEffects(dt);

        // ── Cannon shells (tank weapon) ─────────────────────────
        this._updateCannonShells(dt);
        this._updateGuidedMissiles(dt);

        // ── Dust particles behind trucks ───────────────────────
        for (const { truck, particles } of this.dustEmitters) {
            const spd = Math.abs(truck.speed || 0);
            if (spd > 20) {
                // Emit from behind the truck
                const behindX = truck.x - Math.cos(truck.angle) * 10;
                const behindY = truck.y - Math.sin(truck.angle) * 10;
                particles.emitParticleAt(behindX, behindY, 1);
            }
        }
    }

    // ── Waypoint tracking & lap detection (forward only) ──────
    updateWaypointTracking() {
        const truck = this.playerTruck;
        const waypoints = this.track.waypoints;
        const len = waypoints.length;
        const threshold = Math.max(60, (this.track.trackWidth || 70) * 1.05); // corridor-sized hit radius

        // Detect wrong way from the local road direction, not from truck→waypoint line.
        const prevIdx = (this.expectedWaypoint - 1 + len) % len;
        const expWp = waypoints[this.expectedWaypoint];
        const prevWp = waypoints[prevIdx];
        let dirDx = expWp[0] - prevWp[0];
        let dirDy = expWp[1] - prevWp[1];
        if (dirDx === 0 && dirDy === 0) {
            const nextIdx = (this.expectedWaypoint + 1) % len;
            dirDx = waypoints[nextIdx][0] - expWp[0];
            dirDy = waypoints[nextIdx][1] - expWp[1];
        }
        const trackDirAngle = Math.atan2(dirDy, dirDx);
        let angleDiff = truck.angle - trackDirAngle;
        // Normalize to -PI..PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        // Wrong way if facing more than 120° away from expected direction AND moving
        this.goingWrongWay = Math.abs(angleDiff) > (Math.PI * 2 / 3) && Math.abs(truck.speed) > 30;

        let bestHit = null;
        for (let forwardDist = 0; forwardDist <= 8; forwardDist++) {
            const i = (this.expectedWaypoint + forwardDist) % len;
            const wp = waypoints[i];
            const dx = truck.x - wp[0];
            const dy = truck.y - wp[1];
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < threshold) {
                if (!bestHit || forwardDist < bestHit.forwardDist || (forwardDist === bestHit.forwardDist && dist < bestHit.dist)) {
                    bestHit = { index: i, dist, forwardDist };
                }
            }
        }

        if (!bestHit) return;

        const i = bestHit.index;
        this.waypointsHit.add(i);
        this.expectedWaypoint = (i + 1) % len;
        this.lastWaypointIndex = i;

        // If we're at start/finish and have hit enough waypoints
        if (i === this.track.startLineIndex && this.canCrossFinish) {
            if (this.waypointsHit.size >= len * 0.4) {
                this.completeLap();
                return;
            }
        }

        // Once we've moved away from start, allow finish line crossing
        if (((i - this.track.startLineIndex + len) % len) >= 3) {
            this.canCrossFinish = true;
        }
    }

    // ── Respawn player at last known good waypoint ─────────────
    respawnPlayer() {
        if (this.playerTruck._destroyed) {
            this.playerTruck._destroyed = false;
            this.playerTruck.setVisible(true);
            this.playerTruck.truckGraphics.setVisible(true);
        }
        const waypoints = this.track.waypoints;
        const len = waypoints.length;
        const idx = this.lastWaypointIndex;
        const nextIdx = (idx + 1) % len;

        // Place on the waypoint
        this.playerTruck.x = waypoints[idx][0];
        this.playerTruck.y = waypoints[idx][1];

        // Face toward next waypoint
        const dx = waypoints[nextIdx][0] - waypoints[idx][0];
        const dy = waypoints[nextIdx][1] - waypoints[idx][1];
        this.playerTruck.angle = Math.atan2(dy, dx);

        // Kill speed
        this.playerTruck.speed = 0;
        this.playerTruck.vx = 0;
        this.playerTruck.vy = 0;

        // Reset timer
        this.offTrackTimer = 0;

        this.showMessage('RESPAWN!', 1000);
    }

    respawnAi(ai) {
        if (ai._destroyed) {
            ai._destroyed = false;
            ai.setVisible(true);
            ai.truckGraphics.setVisible(true);
        }
        const waypoints = this.track.waypoints;
        const len = waypoints.length;

        // Find the nearest waypoint to the AI's current position
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < len; i++) {
            const dx = ai.x - waypoints[i][0];
            const dy = ai.y - waypoints[i][1];
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        // Place on that waypoint, face toward the next one
        ai.x = waypoints[bestIdx][0];
        ai.y = waypoints[bestIdx][1];
        const nextIdx = (bestIdx + 1) % len;
        const dx = waypoints[nextIdx][0] - waypoints[bestIdx][0];
        const dy = waypoints[nextIdx][1] - waypoints[bestIdx][1];
        ai.angle = Math.atan2(dy, dx);
        ai.currentWaypoint = nextIdx;

        ai.speed = 0;
        ai.vx = 0;
        ai.vy = 0;
        ai._offTrackTime = 0;
    }

    _respawnPlayerBehind() {
        const waypoints = this.track.waypoints;
        const len = waypoints.length;
        const behindIdx = (this.lastWaypointIndex - 1 + len) % len;
        this.lastWaypointIndex = behindIdx;
        this.expectedWaypoint = (behindIdx + 1) % len;
        this.respawnPlayer();
    }

    _respawnAiBehind(ai) {
        const waypoints = this.track.waypoints;
        const len = waypoints.length;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < len; i++) {
            const dx = ai.x - waypoints[i][0];
            const dy = ai.y - waypoints[i][1];
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        const behindIdx = (bestIdx - 1 + len) % len;
        ai.x = waypoints[behindIdx][0];
        ai.y = waypoints[behindIdx][1];
        const nextIdx = (behindIdx + 1) % len;
        const dx = waypoints[nextIdx][0] - waypoints[behindIdx][0];
        const dy = waypoints[nextIdx][1] - waypoints[behindIdx][1];
        ai.angle = Math.atan2(dy, dx);
        ai.currentWaypoint = nextIdx;
        ai._destroyed = false;
        ai.setVisible(true);
        ai.truckGraphics.setVisible(true);
        ai.speed = 0;
        ai.vx = 0;
        ai.vy = 0;
        ai._offTrackTime = 0;
    }

    _explodeTruck(truck) {
        const blast = this.add.graphics().setDepth(260);
        blast.setPosition(truck.x, truck.y);
        blast.fillStyle(0xffaa00, 0.95);
        blast.fillCircle(0, 0, 10);
        blast.fillStyle(0xff5500, 0.9);
        blast.fillCircle(0, 0, 6);
        this.tweens.add({
            targets: blast,
            scaleX: 2.6,
            scaleY: 2.6,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => blast.destroy(),
        });
    }

    _destroyByTank(truck) {
        if (truck._destroyed) return;
        truck._destroyed = true;
        truck.speed = 0;
        truck.vx = 0;
        truck.vy = 0;
        truck.setVisible(false);
        truck.truckGraphics.setVisible(false);
        this._explodeTruck(truck);
        soundFX.playCrash();

        this.time.delayedCall(1000, () => {
            if (!this.scene.isActive()) return;
            if (truck === this.playerTruck) {
                this._respawnPlayerBehind();
            } else {
                this._respawnAiBehind(truck);
            }
        });
    }

    completeLap() {
        this.currentLap++;
        soundFX.playLapComplete();

        // Check for best lap time and award bonus
        const isNewBest = this.lapTime < this.bestLapTime;
        if (isNewBest) {
            this.bestLapTime = this.lapTime;
            this.money += this.bestLapBonus;
            this.showMessage(`LAP ${this.currentLap} — NEW BEST! +$${this.bestLapBonus}`, 2000);
        } else {
            this.showMessage(`Lap ${this.currentLap} — ${this.formatTime(this.lapTime)}`, 1500);
        }

        // Reset for next lap
        this.lapTime = 0;
        this.waypointsHit.clear();
        this.expectedWaypoint = 1;
        this.canCrossFinish = false;

        // Check if race is over
        if (this.currentLap >= this.totalLaps) {
            this.finishRace();
        }
    }

    // ── Skid marks rendering ─────────────────────────────────
    _updateSkidMarks() {
        const MAX_MARKS = 300;
        const truckScale = this.track.truckScale || 1;
        const hw = 5 * truckScale; // half-width between tire tracks

        for (const truck of this.allTrucks) {
            if (truck.driftAmount > 0.15 && Math.abs(truck.speed) > 10) {
                const a = truck.angle;
                const cosA = Math.cos(a), sinA = Math.sin(a);
                // Two tire tracks (rear axle)
                const rearOffset = 5 * truckScale;
                const rx = truck.x - cosA * rearOffset;
                const ry = truck.y - sinA * rearOffset;
                this.skidMarks.push({
                    x1: rx - sinA * hw, y1: ry + cosA * hw,
                    x2: rx + sinA * hw, y2: ry - cosA * hw,
                    alpha: Math.min(truck.driftAmount * 0.6, 0.5)
                });
            }
        }

        // Cap array size
        while (this.skidMarks.length > MAX_MARKS) {
            this.skidMarks.shift();
        }

        // Redraw
        this.skidGfx.clear();
        for (const m of this.skidMarks) {
            this.skidGfx.lineStyle(2, 0x222222, m.alpha);
            this.skidGfx.beginPath();
            this.skidGfx.moveTo(m.x1, m.y1);
            this.skidGfx.lineTo(m.x1, m.y1); // dot
            this.skidGfx.strokePath();
            this.skidGfx.beginPath();
            this.skidGfx.moveTo(m.x2, m.y2);
            this.skidGfx.lineTo(m.x2, m.y2);
            this.skidGfx.strokePath();
        }

        // Fade old marks
        for (let i = 0; i < this.skidMarks.length; i++) {
            this.skidMarks[i].alpha *= 0.998;
            if (this.skidMarks[i].alpha < 0.02) {
                this.skidMarks.splice(i, 1);
                i--;
            }
        }
    }

    // Assign a finished truck to a podium slot off the side of the track
    _assignPodiumSlot(truck) {
        const slot = this._podiumNextSlot++;
        if (slot >= 3) return; // only 3 podium slots; 4th place stays on track

        // Podium position: near the start line so it's visible
        const startWp = this.track.waypoints[this.track.startLineIndex];
        const ts = this.track.truckScale || 1;
        const podiumX = startWp[0] + 120 * ts;
        const podiumY = startWp[1] - 100 * ts + slot * 60 * ts;
        truck._podiumTarget = { x: podiumX, y: podiumY };

        // Draw podium visual for this slot
        this._drawPodiumSlot(slot, truck);
    }

    _drawPodiumSlot(slot, truck) {
        if (this._domUi) return;
        // Draw podium block + position label near start line
        const gfx = this.add.graphics().setDepth(900);
        const startWp = this.track.waypoints[this.track.startLineIndex];
        const ts = this.track.truckScale || 1;
        const px = startWp[0] + 120 * ts, py = startWp[1] - 100 * ts + slot * 60 * ts;
        const heights = [40 * ts, 30 * ts, 22 * ts]; // 1st tallest
        const colors = [0xffd700, 0xc0c0c0, 0xcd7f32]; // gold, silver, bronze
        const labels = ['1st', '2nd', '3rd'];
        const bw = 50 * ts, bh = heights[slot];

        // Podium block
        gfx.fillStyle(colors[slot], 0.9);
        gfx.fillRect(px - bw / 2, py + 10 * ts, bw, bh);
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.strokeRect(px - bw / 2, py + 10 * ts, bw, bh);

        // Position label
        const fontSize = Math.max(8, Math.round(10 * ts));
        this.add.text(px, py + 10 * ts + bh / 2, labels[slot], {
            fontSize: fontSize + 'px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#000000'
        }).setOrigin(0.5).setDepth(901);
    }

    finishRace() {
        this.raceFinished = true;

        // Freeze all AI trucks at their current positions
        for (const ai of this.aiTrucks) {
            if (!ai.raceFinished) {
                ai.raceFinished = true;
                ai.speed = 0;
            }
        }

        // Assign podium to player too if they placed top 3
        // (player always finishes here, so count how many AI finished before)
        const playerSlot = this._podiumNextSlot++;
        if (playerSlot < 3) {
            const startWp = this.track.waypoints[this.track.startLineIndex];
            const ts = this.track.truckScale || 1;
            this.playerTruck._podiumTarget = { x: startWp[0] + 120 * ts, y: startWp[1] - 100 * ts + playerSlot * 60 * ts };
            this._drawPodiumSlot(playerSlot, this.playerTruck);
        }

        soundFX.stopEngine();
        soundFX.stopMusic();
        soundFX.updateTireScreech(0);

        // Determine finish positions based on total progress
        const waypoints = this.track.waypoints;
        const len = waypoints.length;
        // Player just finished all laps
        const playerProgress = this.totalLaps * len;
        const playerFinishTime = this.raceTime;
        const aiNames = ['Blue', 'Yellow', 'Green'];
        const results = [{ name: GameState.playerName, progress: playerProgress, finishTime: playerFinishTime, isPlayer: true, index: -1 }];
        for (let i = 0; i < this.aiTrucks.length; i++) {
            const ai = this.aiTrucks[i];
            // totalProgress is cumulative waypoints hit (never wraps)
            results.push({
                name: ai.aiName || aiNames[i],
                progress: ai.totalProgress,
                finishTime: ai.finishTime || Infinity,
                isPlayer: false,
                index: i,
            });
        }
        // Sort: finished trucks first (by finish time), then by progress
        results.sort((a, b) => {
            const aFinished = a.progress >= this.totalLaps * len;
            const bFinished = b.progress >= this.totalLaps * len;
            if (aFinished && bFinished) return a.finishTime - b.finishTime;
            if (aFinished) return -1;
            if (bFinished) return 1;
            return b.progress - a.progress;
        });

        this.finishPositions = results;
        const playerPos = results.findIndex(r => r.isPlayer); // 0-based
        const posBonus = GameState.positionBonus[playerPos] || 0;
        this.money += posBonus;
        this.playerPosition = playerPos + 1; // 1-based

        // Championship points
        if (GameState.gameMode === 'championship') {
            GameState.championshipPoints.player += GameState.championshipPointsPerPos[playerPos] || 0;
            for (let i = 0; i < results.length; i++) {
                if (!results[i].isPlayer) {
                    GameState.championshipPoints.ai[results[i].index] += GameState.championshipPointsPerPos[i] || 0;
                }
            }
        }

        // Save earned money to GameState
        GameState.money += this.money;
        GameState.raceNumber++;

        // AI earns position bonus + coin money, then spends on upgrades
        for (let i = 0; i < this.aiTrucks.length; i++) {
            const aiResult = results.find(r => !r.isPlayer && r.index === i);
            const aiPos = aiResult ? results.indexOf(aiResult) : 3;
            const posBonus = GameState.positionBonus[aiPos] || 0;
            const coinMoney = this.aiTrucks[i].raceMoney || 0;
            GameState.aiSpendMoney(i, coinMoney + posBonus);
        }

        this.showMessage('RACE COMPLETE!', 3000);

        this.time.delayedCall(3000, () => {
            this.showResults();
        });
    }

    showResults() {
        if (this._domUi) {
            this._showResultsDom();
            return;
        }

        // Dim overlay (covers viewport, not world)
        const vw = this.scale.width;
        const vh = this.scale.height;
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, vw, vh);
        overlay.setDepth(980).setScrollFactor(0);

        const cx = vw / 2, cy = vh / 2;
        const style = {
            fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        };

        this.add.text(cx, cy - 130, 'RACE RESULTS', {
            ...style, fontSize: '32px', color: '#ffcc00',
            fontFamily: 'Arial Black, Arial, sans-serif'
        }).setOrigin(0.5).setDepth(990).setScrollFactor(0);

        // Position
        const posLabels = ['1ST', '2ND', '3RD', '4TH'];
        const posColors = ['#ffcc00', '#cccccc', '#cc8844', '#888888'];
        this.add.text(cx, cy - 80, `You finished ${posLabels[this.playerPosition - 1]}!`, {
            ...style, fontSize: '24px', color: posColors[this.playerPosition - 1]
        }).setOrigin(0.5).setDepth(990).setScrollFactor(0);

        // Position bonus
        const posBonus = GameState.positionBonus[this.playerPosition - 1] || 0;
        if (posBonus > 0) {
            this.add.text(cx, cy - 50, `Position bonus: +$${posBonus}`, {
                ...style, fontSize: '14px', color: '#00ff88'
            }).setOrigin(0.5).setDepth(990).setScrollFactor(0);
        }

        this.add.text(cx, cy - 20, `Total Time: ${this.formatTime(this.raceTime)}`, style)
            .setOrigin(0.5).setDepth(990).setScrollFactor(0);
        this.add.text(cx, cy + 10, `Best Lap: ${this.formatTime(this.bestLapTime)}`, {
            ...style, color: '#00ff88'
        }).setOrigin(0.5).setDepth(990).setScrollFactor(0);
        this.add.text(cx, cy + 40, `Money Earned: $${this.money}`, {
            ...style, color: '#ffcc00'
        }).setOrigin(0.5).setDepth(990).setScrollFactor(0);

        // Championship standings
        if (GameState.gameMode === 'championship') {
            const pts = GameState.championshipPoints;
            const raceIdx = GameState.championshipRaceIndex + 1;
            const totalRaces = GameState.tracks.length;
            this.add.text(cx, cy + 75, `Championship: Race ${raceIdx} / ${totalRaces}`, {
                ...style, fontSize: '14px', color: '#aaaaaa'
            }).setOrigin(0.5).setDepth(990).setScrollFactor(0);
            this.add.text(cx, cy + 95, `Points: ${GameState.playerName}: ${pts.player}  |  Blue: ${pts.ai[0]}  |  Yellow: ${pts.ai[1]}  |  Green: ${pts.ai[2]}`, {
                ...style, fontSize: '11px', color: '#cccccc'
            }).setOrigin(0.5).setDepth(990).setScrollFactor(0);
        }

        const isChamp = GameState.gameMode === 'championship';
        const isLastChampRace = isChamp &&
            GameState.championshipRaceIndex >= GameState.tracks.length - 1;

        if (isChamp) {
            // Championship: intermediate menu with multiple options
            const btnStyle = { fontSize: '14px', fontFamily: "'Press Start 2P', cursive",
                color: '#ffffff', stroke: '#000000', strokeThickness: 3,
                backgroundColor: '#0f3460', padding: { x: 16, y: 8 } };
            const hoverStyle = { backgroundColor: '#1a5276' };
            const outStyle = { backgroundColor: '#0f3460' };

            const continueLabel = isLastChampRace ? '🏆 RESULTS' : '▶ CONTINUE';
            const continueBtn = this.add.text(cx, cy + 120, continueLabel, btnStyle)
                .setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerover', () => continueBtn.setStyle(hoverStyle));
            continueBtn.on('pointerout', () => continueBtn.setStyle(outStyle));
            continueBtn.on('pointerdown', () => {
                if (isLastChampRace) {
                    this.scene.start('ChampionshipResultsScene');
                } else {
                    GameState.championshipRaceIndex++;
                    // Set next championship track
                    const idx = GameState.championshipRaceIndex;
                    const order = GameState.championshipOrder || [];
                    const trackIdx = order[idx] !== undefined ? order[idx] : idx;
                    if (trackIdx < GameState.tracks.length) {
                        GameState.selectedTrack = GameState.tracks[trackIdx];
                    }
                    this.scene.start('RaceScene');
                }
            });

            const garageBtn = this.add.text(cx, cy + 155, '🔧 GARAGE', btnStyle)
                .setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });
            garageBtn.on('pointerover', () => garageBtn.setStyle(hoverStyle));
            garageBtn.on('pointerout', () => garageBtn.setStyle(outStyle));
            garageBtn.on('pointerdown', () => {
                // Save championship state so we return here after garage
                GameState._champReturnToResults = true;
                this.scene.start('ShopScene');
            });

            const saveBtn = this.add.text(cx, cy + 190, '💾 SAVE', btnStyle)
                .setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });
            saveBtn.on('pointerover', () => saveBtn.setStyle(hoverStyle));
            saveBtn.on('pointerout', () => saveBtn.setStyle(outStyle));
            saveBtn.on('pointerdown', () => { this._champSaveGame(saveBtn); });

            const quitBtn = this.add.text(cx, cy + 225, '🚪 QUIT CHAMPIONSHIP', {
                ...btnStyle, color: '#ff6666'
            }).setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });
            quitBtn.on('pointerover', () => quitBtn.setStyle({ backgroundColor: '#5a1a1a' }));
            quitBtn.on('pointerout', () => quitBtn.setStyle(outStyle));
            quitBtn.on('pointerdown', () => {
                GameState.gameMode = 'single';
                this.scene.start('TrackSelectScene');
            });
        } else {
            // Single race: Replay + Menu buttons
            const btnStyle = { fontSize: '18px', fontFamily: 'Arial Black, Arial, sans-serif',
                color: '#ffffff', stroke: '#000000', strokeThickness: 4,
                backgroundColor: '#0f3460', padding: { x: 20, y: 10 } };

            const replayBtn = this.add.text(cx - 110, cy + 130, '🔄 REPLAY', btnStyle)
                .setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });
            const menuBtn = this.add.text(cx + 110, cy + 130, '🏠 MENU', btnStyle)
                .setOrigin(0.5).setDepth(990).setScrollFactor(0).setInteractive({ useHandCursor: true });

            replayBtn.on('pointerover', () => replayBtn.setStyle({ backgroundColor: '#1a5276' }));
            replayBtn.on('pointerout', () => replayBtn.setStyle({ backgroundColor: '#0f3460' }));
            menuBtn.on('pointerover', () => menuBtn.setStyle({ backgroundColor: '#1a5276' }));
            menuBtn.on('pointerout', () => menuBtn.setStyle({ backgroundColor: '#0f3460' }));

            replayBtn.on('pointerdown', () => {
                this.scene.start('RaceScene');
            });
            menuBtn.on('pointerdown', () => {
                this.scene.start('TrackSelectScene');
            });
        }
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    async _champSaveGame(btn) {
        const json = GameState.toSaveJSON();
        const filename = GameState.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.v8t';
        const setSavedState = (label) => {
            if (!btn) return;
            if (typeof btn.setText === 'function') {
                btn.setText(label);
            } else {
                btn.textContent = label;
            }
        };
        if (window.showSaveFilePicker) {
            try {
                const handle = await showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'V8 Save', accept: { 'application/json': ['.v8t'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                setSavedState('SAVED');
                this.time.delayedCall(1500, () => setSavedState('SAVE'));
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSavedState('SAVED');
        this.time.delayedCall(1500, () => setSavedState('SAVE'));
    }

    // ── Truck-to-truck collision / bumping ──────────────────────
    handleTruckCollisions() {
        const trucks = this.allTrucks;

        for (let i = 0; i < trucks.length; i++) {
            for (let j = i + 1; j < trucks.length; j++) {
                const a = trucks[i];
                const b = trucks[j];
                if (a._destroyed || b._destroyed) continue;
                if (a.vehicleType === 'jet' || b.vehicleType === 'jet') continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const aRadius = Math.max(a.truckWidth || 10, a.truckHeight || 18) * 0.55;
                const bRadius = Math.max(b.truckWidth || 10, b.truckHeight || 18) * 0.55;
                const minDist = aRadius + bRadius;

                if (dist < minDist && dist > 0) {
                    // Push apart hard — fully resolve overlap + extra separation
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = (minDist - dist) / 2 + 3;

                    a.x -= nx * overlap;
                    a.y -= ny * overlap;
                    b.x += nx * overlap;
                    b.y += ny * overlap;

                    // ── Tank ramming: rammed truck respawns ──────────────
                    const isTankA = a.vehicleType === 'tank';
                    const isTankB = b.vehicleType === 'tank';
                    if (isTankA || isTankB) {
                        const tank   = isTankA ? a : b;
                        const rammed = isTankA ? b : a;
                        const now = this.time.now;
                        if (rammed._lastRamRespawnTime && now - rammed._lastRamRespawnTime < 600) {
                            continue;
                        }
                        rammed._lastRamRespawnTime = now;
                        tank.speed *= 0.98; // tank barely slows down
                        this._destroyByTank(rammed);
                        if (rammed === this.playerTruck) {
                            this.cameras.main.shake(400, 0.015);
                        }
                    } else {
                        // Normal speed penalty (once per 500ms)
                        const now = this.time.now;
                        if (!a._lastBumpTime || now - a._lastBumpTime > 500) {
                            if (a.speed !== undefined) a.speed *= 0.95;
                            a._lastBumpTime = now;
                        }
                        if (!b._lastBumpTime || now - b._lastBumpTime > 500) {
                            if (b.speed !== undefined) b.speed *= 0.95;
                            b._lastBumpTime = now;
                        }

                        // Screen shake when player is involved
                        if (a === this.playerTruck || b === this.playerTruck) {
                            this.cameras.main.shake(150, 0.005);
                            soundFX.playCrash();
                        }
                    }
                }
            }
        }
    }

    // ── Tank cannon: fire a bouncing shell (Mario-Kart-shell style) ──
    _fireCannonShell(truck) {
        const now = this.time.now;
        if (truck._lastShot && now - truck._lastShot < 1500) return; // 1.5s cooldown
        truck._lastShot = now;

        const offsetDist = 22 * (this.track.truckScale || 1);
        const sx = truck.x + Math.cos(truck.angle) * offsetDist;
        const sy = truck.y + Math.sin(truck.angle) * offsetDist;

        const SHELL_SPEED = 380;

        // Draw a yellow cannonball with inner highlight
        const gfx = this.add.graphics();
        gfx.fillStyle(0xff6600, 1);
        gfx.fillCircle(0, 0, 7);
        gfx.fillStyle(0xffdd00, 1);
        gfx.fillCircle(-2, -2, 3);
        gfx.setPosition(sx, sy).setDepth(200);

        this.cannonShells.push({
            x: sx, y: sy,
            vx: Math.cos(truck.angle) * SHELL_SPEED,
            vy: Math.sin(truck.angle) * SHELL_SPEED,
            bounces: 0,
            maxBounces: 4,
            spawnTime: now,
            gracePeriod: 0.4, // seconds before owner can be hit
            gfx,
            owner: truck,
        });
    }

    _findClosestAiTarget(fromTruck) {
        let bestTarget = null;
        let bestDistSq = Infinity;
        for (const ai of this.aiTrucks) {
            if (ai._destroyed || ai.raceFinished) continue;
            const dx = ai.x - fromTruck.x;
            const dy = ai.y - fromTruck.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestTarget = ai;
            }
        }
        return bestTarget;
    }

    _fireGuidedMissile(truck) {
        const now = this.time.now;
        if (truck._lastMissileShot && now - truck._lastMissileShot < 1100) return;

        const target = this._findClosestAiTarget(truck);
        if (!target) return;

        truck._lastMissileShot = now;

        const offsetDist = 24 * (this.track.truckScale || 1);
        const sx = truck.x + Math.cos(truck.angle) * offsetDist;
        const sy = truck.y + Math.sin(truck.angle) * offsetDist;
        const speed = 350;

        const gfx = this.add.graphics();
        gfx.fillStyle(0xd9edf8, 1);
        gfx.fillTriangle(0, -7, -4, 5, 4, 5);
        gfx.fillStyle(0xff6633, 1);
        gfx.fillRect(-1.5, 4, 3, 4);
        gfx.setPosition(sx, sy).setDepth(210);

        this.guidedMissiles.push({
            x: sx,
            y: sy,
            speed,
            angle: truck.angle,
            turnRate: 5.2,
            spawnTime: now,
            maxAge: 4.5,
            gfx,
            owner: truck,
            target,
        });
    }

    // ── Tank cannon: update bouncing shells ─────────────────────
    _updateCannonShells(dt) {
        const walls = this.track.walls || [];
        const truckHitRadius = 26;
        const wallHitRadius = 8;

        for (let i = this.cannonShells.length - 1; i >= 0; i--) {
            const shell = this.cannonShells[i];
            const age = (this.time.now - shell.spawnTime) / 1000;
            const prevX = shell.x;
            const prevY = shell.y;

            shell.x += shell.vx * dt;
            shell.y += shell.vy * dt;
            shell.gfx.setPosition(shell.x, shell.y);

            if (shell.bounces > shell.maxBounces) {
                this._shellExplode(shell);
                this.cannonShells.splice(i, 1);
                continue;
            }

            let bounced = false;
            for (const wall of walls) {
                const hit = this._segmentToSegmentClosest(
                    prevX, prevY, shell.x, shell.y,
                    wall[0], wall[1], wall[2], wall[3]
                );
                if (!hit || hit.distance > wallHitRadius) continue;

                const normal = hit.distance === 0
                    ? this._wallNormal(wall[0], wall[1], wall[2], wall[3])
                    : { x: hit.dx / hit.distance, y: hit.dy / hit.distance };
                const dot = shell.vx * normal.x + shell.vy * normal.y;
                if (dot >= 0) continue;

                shell.vx -= 2 * dot * normal.x;
                shell.vy -= 2 * dot * normal.y;
                shell.x += normal.x * (wallHitRadius - hit.distance + 1);
                shell.y += normal.y * (wallHitRadius - hit.distance + 1);
                shell.gfx.setPosition(shell.x, shell.y);
                shell.bounces++;
                bounced = true;
                this._flashShell(shell);
                break;
            }
            if (bounced) continue;

            for (const truck of this.allTrucks) {
                if (truck === shell.owner && age < shell.gracePeriod) continue;

                const dist = this._segmentPointDistance(prevX, prevY, shell.x, shell.y, truck.x, truck.y);
                if (dist > truckHitRadius) continue;

                this._applyShellHitEffect(truck);

                this._shellExplode(shell);
                this.cannonShells.splice(i, 1);
                break;
            }
        }
    }

    _updateGuidedMissiles(dt) {
        const hitRadius = 24;

        for (let i = this.guidedMissiles.length - 1; i >= 0; i--) {
            const missile = this.guidedMissiles[i];
            const age = (this.time.now - missile.spawnTime) / 1000;
            if (age > missile.maxAge) {
                this._destroyGuidedMissile(missile, false);
                this.guidedMissiles.splice(i, 1);
                continue;
            }

            if (!missile.target || missile.target._destroyed || missile.target.raceFinished) {
                missile.target = this._findClosestAiTarget(missile.owner);
                if (!missile.target) {
                    this._destroyGuidedMissile(missile, false);
                    this.guidedMissiles.splice(i, 1);
                    continue;
                }
            }

            const desiredAngle = Math.atan2(missile.target.y - missile.y, missile.target.x - missile.x);
            missile.angle = Phaser.Math.Angle.RotateTo(missile.angle, desiredAngle, missile.turnRate * dt);
            missile.x += Math.cos(missile.angle) * missile.speed * dt;
            missile.y += Math.sin(missile.angle) * missile.speed * dt;
            missile.gfx.setPosition(missile.x, missile.y);
            missile.gfx.rotation = missile.angle + Math.PI / 2;

            const dx = missile.target.x - missile.x;
            const dy = missile.target.y - missile.y;
            if ((dx * dx + dy * dy) > hitRadius * hitRadius) continue;

            this._applyShellHitEffect(missile.target);
            this._destroyGuidedMissile(missile, true);
            this.guidedMissiles.splice(i, 1);
        }
    }

    _flashShell(shell) {
        shell.gfx.clear();
        shell.gfx.fillStyle(0xffffff, 1);
        shell.gfx.fillCircle(0, 0, 7);
        this.time.delayedCall(80, () => {
            if (!shell.gfx || !shell.gfx.active) return;
            shell.gfx.clear();
            shell.gfx.fillStyle(0xff6600, 1);
            shell.gfx.fillCircle(0, 0, 7);
            shell.gfx.fillStyle(0xffdd00, 1);
            shell.gfx.fillCircle(-2, -2, 3);
        });
    }

    _segmentPointDistance(ax, ay, bx, by, px, py) {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));

        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx;
        const cy = ay + t * dy;
        const ox = px - cx;
        const oy = py - cy;
        return Math.sqrt(ox * ox + oy * oy);
    }

    _segmentToSegmentClosest(ax, ay, bx, by, cx, cy, dx, dy) {
        const steps = 8;
        let best = null;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = ax + (bx - ax) * t;
            const py = ay + (by - ay) * t;
            const projected = this._projectPointToSegment(px, py, cx, cy, dx, dy);
            if (!best || projected.distance < best.distance) best = projected;
        }
        return best;
    }

    _projectPointToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) {
            const ox = px - ax;
            const oy = py - ay;
            return { distance: Math.sqrt(ox * ox + oy * oy), dx: ox, dy: oy };
        }

        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const qx = ax + t * dx;
        const qy = ay + t * dy;
        const ox = px - qx;
        const oy = py - qy;
        return { distance: Math.sqrt(ox * ox + oy * oy), dx: ox, dy: oy };
    }

    _wallNormal(ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: -dy / len, y: dx / len };
    }

    _applyShellHitEffect(truck) {
        if (!truck._oilCooldown || truck._oilCooldown <= 0) {
            truck._oilSpinning = true;
            truck._oilSpinTotal = 0;
            truck._oilSpinTarget = Math.PI * 2;
            truck._oilExitAngle = truck.angle + (Math.random() - 0.5) * Math.PI;
            truck._oilSpinSpeed = 10;
            truck.speed *= 0.1;
            truck._oilCooldown = 3.0;
        }
        if (truck === this.playerTruck) {
            this.cameras.main.shake(300, 0.012);
            this.showMessage('HIT!', 800);
        }
    }

    _destroyGuidedMissile(missile, explode) {
        if (!missile.gfx || !missile.gfx.active) return;
        if (!explode) {
            missile.gfx.destroy();
            return;
        }
        missile.gfx.clear();
        missile.gfx.fillStyle(0xffffff, 0.95);
        missile.gfx.fillCircle(0, 0, 10);
        this.time.delayedCall(100, () => {
            if (missile.gfx && missile.gfx.active) missile.gfx.destroy();
        });
    }

    _shellExplode(shell) {
        // Flash white then destroy
        shell.gfx.clear();
        shell.gfx.fillStyle(0xffffff, 0.9);
        shell.gfx.fillCircle(0, 0, 12);
        this.time.delayedCall(120, () => { if (shell.gfx && shell.gfx.active) shell.gfx.destroy(); });
    }

    // ── Background ──────────────────────────────────────────────
    drawBackground() {
        const gfx = this.add.graphics();
        const wW = this.track.worldW || 3200;
        const wH = this.track.worldH || 1800;
        // Fill entire world area with grass/dirt surround
        gfx.fillStyle(this.track.grassColor, 1);
        gfx.fillRect(0, 0, wW, wH);
    }

    // ── Walls (defined as line segments in track data) ──────────
    drawWalls() {
        const walls = this.track.walls;
        if (!walls || walls.length === 0) return;
        const gfx = this.add.graphics();
        const wallWidth = this.track.wallWidth || 4;
        // Alternating red/white like a real race track
        for (let i = 0; i < walls.length; i++) {
            const color = (Math.floor(i / 2) % 2 === 0) ? 0xcc0000 : 0xffffff;
            gfx.lineStyle(wallWidth, color, 1);
            gfx.beginPath();
            gfx.moveTo(walls[i][0], walls[i][1]);
            gfx.lineTo(walls[i][2], walls[i][3]);
            gfx.strokePath();
        }
    }

    handleWallCollisions() {
        const walls = this.track.walls;
        if (!walls || walls.length === 0) return;
        const truckScale = this.track.truckScale || 1;
        const wallWidth = (this.track.wallWidth || 6) / 2 + 6 * truckScale; // detection radius scaled to truck size

        for (const truck of this.allTrucks) {
            // Tanks can drive over walls, jets fly over them.
            if (truck.vehicleType === 'tank' || truck.vehicleType === 'jet') continue;
            // Track consecutive wall hits for oscillation damping
            if (!truck._wallHitCount) truck._wallHitCount = 0;
            if (!truck._wallHitTimer) truck._wallHitTimer = 0;
            truck._wallHitTimer += this.game.loop.delta / 1000;
            if (truck._wallHitTimer > 0.3) {
                truck._wallHitCount = 0; // reset after 0.3s of no hits
            }

            let hitWall = false;
            for (const w of walls) {

                // Line segment: (w[0],w[1]) to (w[2],w[3])
                const wx = w[2] - w[0], wy = w[3] - w[1];
                const len2 = wx * wx + wy * wy;
                if (len2 === 0) continue;

                // Project truck position onto wall segment
                let t = ((truck.x - w[0]) * wx + (truck.y - w[1]) * wy) / len2;
                t = Math.max(0, Math.min(1, t));

                const closestX = w[0] + t * wx;
                const closestY = w[1] + t * wy;
                const dx = truck.x - closestX;
                const dy = truck.y - closestY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < wallWidth && dist > 0) {
                    // Push truck away from wall
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const push = wallWidth - dist + 2;
                    truck.x += nx * push;
                    truck.y += ny * push;

                    // Reflect speed — slide along the wall
                    const dot = (truck.vx * nx + truck.vy * ny);
                    if (dot < 0) { // only if moving toward wall
                        // Very gentle speed loss — walls guide, not punish
                        const dampFactor = truck._wallHitCount >= 3 ? 0.8 : 0.9;
                        truck.speed *= dampFactor;
                        // Blend truck angle toward wall tangent (don't snap)
                        const wallAngle = Math.atan2(wy, wx);
                        // Pick the tangent direction closest to current heading
                        let targetAngle = wallAngle;
                        const alt = wallAngle + Math.PI;
                        if (Math.abs(Phaser.Math.Angle.Wrap(alt - truck.angle)) < Math.abs(Phaser.Math.Angle.Wrap(wallAngle - truck.angle))) {
                            targetAngle = alt;
                        }
                        // Blend 40% toward wall tangent — gentle nudge
                        truck.angle = Phaser.Math.Angle.Wrap(truck.angle + Phaser.Math.Angle.Wrap(targetAngle - truck.angle) * 0.4);
                    }

                    hitWall = true;

                    if (truck === this.playerTruck) {
                        this.cameras.main.shake(100, 0.003);
                        soundFX.playCrash();
                    }
                }
            }

            if (hitWall) {
                truck._wallHitCount++;
                truck._wallHitTimer = 0;

                if (truck !== this.playerTruck && typeof truck.triggerWallRecovery === 'function') {
                    const recoveryHeading = this._getTruckRecoveryHeading(truck, 3);
                    const headingError = Math.abs(Phaser.Math.Angle.Wrap(truck.angle - recoveryHeading));
                    const pushingWrongWay = headingError > Math.PI * 0.58;
                    const stuckOnWall = truck._wallHitCount >= 4 && Math.abs(truck.speed) < Math.max(truck.topSpeed * 0.28, 42);
                    if (truck._wallHitCount >= 5 || (truck._wallHitCount >= 3 && pushingWrongWay) || stuckOnWall) {
                        truck.triggerWallRecovery(recoveryHeading);
                    }
                }
            }
        }
    }

    // ── Track Surface ───────────────────────────────────────────
    drawTrack() {
        const { waypoints, trackWidth, borderColor, trackColor } = this.track;
        const len = waypoints.length;
        const borderW = trackWidth + 12;

        // Use a canvas texture with round line joins (same technique as the editor)
        // This avoids the zebra-circle artifacts from Phaser's miter joins
        const W = this.track.worldW || 3200;
        const H = this.track.worldH || 1800;

        // Remove previous track texture if it exists (e.g. restart)
        if (this.textures.exists('_trackSurface')) {
            this.textures.remove('_trackSurface');
        }

        const canvasTex = this.textures.createCanvas('_trackSurface', W, H);
        const ctx = canvasTex.context;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const toCSS = (c) => '#' + c.toString(16).padStart(6, '0');

        // Border pass
        ctx.strokeStyle = toCSS(borderColor);
        ctx.lineWidth = borderW;
        ctx.beginPath();
        ctx.moveTo(waypoints[0][0], waypoints[0][1]);
        for (let i = 1; i < len; i++) {
            ctx.lineTo(waypoints[i][0], waypoints[i][1]);
        }
        ctx.closePath();
        ctx.stroke();

        // Track surface pass
        ctx.strokeStyle = toCSS(trackColor);
        ctx.lineWidth = trackWidth;
        ctx.beginPath();
        ctx.moveTo(waypoints[0][0], waypoints[0][1]);
        for (let i = 1; i < len; i++) {
            ctx.lineTo(waypoints[i][0], waypoints[i][1]);
        }
        ctx.closePath();
        ctx.stroke();

        canvasTex.refresh();
        this.add.image(W / 2, H / 2, '_trackSurface');

        // Store edges as null — we use distance-based detection now
        this.innerEdge = null;
        this.outerEdge = null;
    }

    // ── Start / Finish Line ─────────────────────────────────────
    drawStartLine() {
        const { waypoints, startLineIndex, trackWidth } = this.track;
        const len = waypoints.length;
        const idx = startLineIndex;
        const prev = waypoints[(idx - 1 + len) % len];
        const curr = waypoints[idx];
        const next = waypoints[(idx + 1) % len];

        const dx = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / dist;
        const ny = dx / dist;
        const hw = trackWidth / 2;

        const gfx = this.add.graphics();

        // Checkered pattern — draw alternating black/white squares
        const startX = curr[0] + nx * hw;
        const startY = curr[1] + ny * hw;
        const endX = curr[0] - nx * hw;
        const endY = curr[1] - ny * hw;

        const squares = 8;
        const squareSize = 6;

        for (let row = 0; row < 2; row++) {
            for (let s = 0; s < squares; s++) {
                const t = s / squares;
                const x = startX + (endX - startX) * t;
                const y = startY + (endY - startY) * t;

                // Perpendicular to the start line (along track direction)
                const pdx = dx / dist;
                const pdy = dy / dist;

                const color = (s + row) % 2 === 0 ? 0xffffff : 0x000000;
                gfx.fillStyle(color, 1);
                gfx.fillRect(
                    x + pdx * row * squareSize - squareSize / 2,
                    y + pdy * row * squareSize - squareSize / 2,
                    squareSize,
                    squareSize
                );
            }
        }
    }

    // ── Track Details (bumps, ruts visual hints) ────────────────
    drawTrackDetails() {
        const gfx = this.add.graphics();
        const { waypoints, trackWidth } = this.track;
        const len = waypoints.length;

        // Draw some subtle darker patches to suggest bumps/ruts
        gfx.fillStyle(0x7a6345, 0.5);

        for (let i = 0; i < 20; i++) {
            // Pick a random spot on the track
            const idx = Math.floor(Math.random() * len);
            const wp = waypoints[idx];
            const offsetX = (Math.random() - 0.5) * trackWidth * 0.6;
            const offsetY = (Math.random() - 0.5) * trackWidth * 0.6;
            const size = 8 + Math.random() * 15;
            gfx.fillEllipse(wp[0] + offsetX, wp[1] + offsetY, size, size * 0.6);
        }

        // Draw track edge lines (subtle)
        gfx.lineStyle(1, 0x6a5335, 0.4);
        if (this.innerEdge) {
            gfx.beginPath();
            gfx.moveTo(this.innerEdge[0][0], this.innerEdge[0][1]);
            for (let i = 1; i < this.innerEdge.length; i++) {
                gfx.lineTo(this.innerEdge[i][0], this.innerEdge[i][1]);
            }
            gfx.closePath();
            gfx.strokePath();
        }
        if (this.outerEdge) {
            gfx.beginPath();
            gfx.moveTo(this.outerEdge[0][0], this.outerEdge[0][1]);
            for (let i = 1; i < this.outerEdge.length; i++) {
                gfx.lineTo(this.outerEdge[i][0], this.outerEdge[i][1]);
            }
            gfx.closePath();
            gfx.strokePath();
        }
    }

    // ── Draw hazard zones on the track ────────────────────────
    drawHazards() {
        if (!this.track.hazards || this.track.hazards.length === 0) return;
        const gfx = this.add.graphics();
        const colors = { water: 0x4488ff, hole: 0x332211, bump: 0xaa8855, oil: 0x33aa33 };
        const icons  = { water: '💧', hole: '⚫', bump: '⬆', oil: '🛢' };
        for (const h of this.track.hazards) {
            // Filled circle
            gfx.fillStyle(colors[h.type] || 0xff0000, 0.45);
            gfx.fillCircle(h.x, h.y, h.radius);
            // Border ring
            gfx.lineStyle(2, colors[h.type] || 0xff0000, 0.7);
            gfx.strokeCircle(h.x, h.y, h.radius);
        }
        gfx.setDepth(8);
        // Emoji icons on top
        for (const h of this.track.hazards) {
            const ico = this.add.text(h.x, h.y, icons[h.type] || '?', {
                fontSize: `${Math.max(12, h.radius * 0.8)}px`
            }).setOrigin(0.5).setDepth(9);
        }
    }

    _getTruckRecoveryHeading(truck, lookAhead = 2) {
        const waypoints = this.track?.waypoints;
        if (!waypoints || waypoints.length < 2) return truck.angle;

        if (Number.isFinite(truck.currentWaypoint)) {
            const len = waypoints.length;
            const nextIdx = ((truck.currentWaypoint % len) + len) % len;
            const farIdx = (nextIdx + Math.max(1, lookAhead)) % len;
            const nextWp = waypoints[nextIdx];
            const farWp = waypoints[farIdx];

            const toNextX = nextWp[0] - truck.x;
            const toNextY = nextWp[1] - truck.y;
            const aheadX = farWp[0] - nextWp[0];
            const aheadY = farWp[1] - nextWp[1];
            const dirX = toNextX + aheadX * 0.9;
            const dirY = toNextY + aheadY * 0.9;

            if (dirX !== 0 || dirY !== 0) {
                return Math.atan2(dirY, dirX);
            }
        }

        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < waypoints.length; i++) {
            const dx = truck.x - waypoints[i][0];
            const dy = truck.y - waypoints[i][1];
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
                bestDist = distSq;
                bestIdx = i;
            }
        }

        const nextIdx = (bestIdx + 1) % waypoints.length;
        const farIdx = (bestIdx + 1 + Math.max(1, lookAhead)) % waypoints.length;
        const dx = (waypoints[nextIdx][0] - waypoints[bestIdx][0]) + (waypoints[farIdx][0] - waypoints[nextIdx][0]) * 0.9;
        const dy = (waypoints[nextIdx][1] - waypoints[bestIdx][1]) + (waypoints[farIdx][1] - waypoints[nextIdx][1]) * 0.9;
        return Math.atan2(dy, dx);
    }

    _ejectTruckFromHazard(truck, hazard, exitAngle, minSpeed, extraPadding = 0) {
        const truckSize = Math.max(truck.truckHeight || 18, truck.truckWidth || 10);
        const ejectDist = hazard.radius + truckSize * (1.15 + extraPadding);
        truck.x = hazard.x + Math.cos(exitAngle) * ejectDist;
        truck.y = hazard.y + Math.sin(exitAngle) * ejectDist;

        const recoveryAngle = this._getTruckRecoveryHeading(truck);
        const heading = Phaser.Math.Angle.RotateTo(exitAngle, recoveryAngle, 0.42);
        const launchSpeed = Math.max(Math.abs(truck.speed), minSpeed);

        truck.angle = heading;
        truck.speed = launchSpeed;
        truck.vx = Math.cos(heading) * launchSpeed;
        truck.vy = Math.sin(heading) * launchSpeed;
    }

    // ── Apply hazard effects to all trucks each frame ───────────
    applyHazardEffects(dt) {
        if (!this.track.hazards || this.track.hazards.length === 0) return;
        for (const truck of this.allTrucks) {
            if (truck._destroyed) continue;
            if (truck.vehicleType === 'jet') {
                if (truck._holeCooldown > 0) truck._holeCooldown -= dt;
                if (truck._bumpCooldown > 0) truck._bumpCooldown -= dt;
                if (truck._oilCooldown > 0) truck._oilCooldown -= dt;
                if (truck._hazardRecovery > 0) truck._hazardRecovery -= dt;
                continue;
            }
            for (const h of this.track.hazards) {
                const dx = truck.x - h.x;
                const dy = truck.y - h.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const truckSize = Math.max(truck.truckHeight || 18, truck.truckWidth || 10);
                const activeRadius = Math.max(h.radius * 0.65, h.radius - truckSize * 0.35);
                if (dist > activeRadius) continue;

                const spd = Math.abs(truck.speed);
                const speedFactor = Phaser.Math.Clamp((spd - 8) / 60, 0, 1);
                const strength = 1 - (dist / Math.max(activeRadius, 1));

                if (h.type === 'water') {
                    // Slow down like off-track but milder
                    truck.speed *= 0.96;
                    // Spray particles to the sides
                    if (spd > 15) {
                        const em = this.waterEmitters.find(e => e.truck === truck);
                        if (em) {
                            const perp = truck.angle + Math.PI / 2;
                            // Left side spray
                            em.particles.emitParticleAt(
                                truck.x + Math.cos(perp) * 6,
                                truck.y + Math.sin(perp) * 6, 2
                            );
                            // Right side spray
                            em.particles.emitParticleAt(
                                truck.x - Math.cos(perp) * 6,
                                truck.y - Math.sin(perp) * 6, 2
                            );
                        }
                    }
                } else if (h.type === 'hole') {
                    // Hole pull follows a sine profile: 0 at center/edge, max at half radius.
                    if (!truck._holeCooldown || truck._holeCooldown <= 0) {
                        const t = Phaser.Math.Clamp(dist / Math.max(activeRadius, 1), 0, 1);
                        const speedScale = Phaser.Math.Clamp(spd / 90, 0, 1);
                        const holeMagnitude = Math.sin(Math.PI * t) * speedScale;
                        truck.speed *= (1 - 0.16 * holeMagnitude);

                        const toCenter = Math.atan2(-dy, -dx);
                        let pull = toCenter - truck.angle;
                        while (pull > Math.PI) pull -= Math.PI * 2;
                        while (pull < -Math.PI) pull += Math.PI * 2;
                        truck.angle += pull * holeMagnitude * 0.42;

                        if (truck === this.playerTruck) {
                            this.cameras.main.shake(120, 0.0035 + holeMagnitude * 0.0035);
                        }
                        truck._holeCooldown = 0.22;
                    }
                } else if (h.type === 'bump') {
                    // Bumps should deflect once, then hand control back quickly.
                    if (!truck._bumpCooldown || truck._bumpCooldown <= 0) {
                        const away = Math.atan2(dy, dx);
                        const shove = 10 + strength * 18 + speedFactor * 10;
                        truck.x += Math.cos(away) * shove;
                        truck.y += Math.sin(away) * shove;
                        const recoveryAngle = this._getTruckRecoveryHeading(truck);
                        truck.angle = Phaser.Math.Angle.RotateTo(truck.angle, recoveryAngle, 0.14 + strength * 0.18);
                        truck.speed = Math.max(truck.speed * (1 - 0.06 * strength), 30);
                        truck.vx = Math.cos(truck.angle) * truck.speed;
                        truck.vy = Math.sin(truck.angle) * truck.speed;
                        if (truck === this.playerTruck) {
                            this.cameras.main.shake(90, 0.003 + strength * 0.0025);
                        }
                        truck._bumpCooldown = 0.45;
                        truck._hazardRecovery = Math.max(truck._hazardRecovery || 0, 0.22);
                    }
                } else if (h.type === 'oil') {
                    // Spin the truck 360° + random exit angle, then deactivate for 2s
                    if (!truck._oilCooldown || truck._oilCooldown <= 0) {
                        truck._oilSpinning = true;
                        truck._oilSpinTotal = 0;
                        truck._oilSpinTarget = Math.PI * 2; // full 360°
                        truck._oilExitAngle = truck.angle + (Math.random() - 0.5) * Math.PI; // random exit
                        truck._oilSpinSpeed = 12; // radians per second
                        truck.speed *= 0.5;
                        truck._oilCooldown = 2.5; // immune for 2.5s after hitting oil
                    }
                }
            }
            // Oil spin animation
            if (truck._oilSpinning) {
                const spinStep = truck._oilSpinSpeed * dt;
                truck._oilSpinTotal += spinStep;
                truck.angle += spinStep;
                if (truck._oilSpinTotal >= truck._oilSpinTarget) {
                    truck.angle = truck._oilExitAngle;
                    truck._oilSpinning = false;
                }
            }
            // Decay cooldowns
            if (truck._holeCooldown > 0) truck._holeCooldown -= dt;
            if (truck._bumpCooldown > 0) truck._bumpCooldown -= dt;
            if (truck._oilCooldown > 0) truck._oilCooldown -= dt;
            if (truck._hazardRecovery > 0) truck._hazardRecovery -= dt;
        }
    }

    // ── Debug: show waypoints ───────────────────────────────────
    drawWaypoints() {
        const gfx = this.add.graphics();
        gfx.fillStyle(0xff0000, 0.5);
        for (const wp of this.track.waypoints) {
            gfx.fillCircle(wp[0], wp[1], 3);
        }
    }
}
