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
        const playerColor = GameState.playerColor || 0xff0000;
        this.playerTruck = new Truck(this, startWp[0], startWp[1] - 10 * truckScale, playerColor);

        // Apply player stats from upgrades + truck preset
        const pStats = GameState.getPlayerStats();
        this.playerTruck.topSpeed = pStats.topSpeed;
        this.playerTruck.acceleration = pStats.acceleration;
        this.playerTruck.handling = pStats.handling;
        this.playerTruck.nitroMax = pStats.nitroMax;
        this.playerTruck.nitroFuel = pStats.nitroMax;

        const nextWp = this.track.waypoints[1];
        const startAngle = Math.atan2(
            nextWp[1] - startWp[1],
            nextWp[0] - startWp[0]
        );
        this.playerTruck.angle = startAngle;

        // ── AI Opponents (with progressive boost + upgrades) ────
        const aiBoost = GameState.getAiBoost();
        this.aiTrucks = [];
        // Pick AI colors that differ from the player's truck
        const allAiColors = [0x3388ff, 0xffcc00, 0x33cc33, 0xff66cc, 0xff8800];
        const availColors = allAiColors.filter(c => c !== GameState.playerColor);
        const aiConfigs = [
            { color: availColors[0], difficulty: 'easy',   offset: 20 * truckScale },
            { color: availColors[1], difficulty: 'medium', offset: -20 * truckScale },
            { color: availColors[2], difficulty: 'hard',   offset: 35 * truckScale },
        ];
        // Map color→name for results display
        const colorNames = {
            0x3388ff: 'Blue', 0xffcc00: 'Gold', 0x33cc33: 'Green',
            0xff66cc: 'Pink', 0xff8800: 'Orange', 0xff0000: 'Red',
        };
        for (let ci = 0; ci < aiConfigs.length; ci++) {
            const cfg = aiConfigs[ci];
            const ai = new AiTruck(
                this,
                startWp[0] + cfg.offset,
                startWp[1] + (15 + Math.abs(cfg.offset)) * truckScale,
                cfg.color,
                cfg.difficulty
            );
            ai.aiName = colorNames[cfg.color] || ('AI ' + (ci + 1));
            // Apply AI progressive boost + upgrade bonus
            const upgradeBonus = GameState.getAiUpgradeBonus(ci);
            ai.topSpeed += aiBoost.topSpeed + upgradeBonus.topSpeed;
            ai.acceleration += aiBoost.acceleration + upgradeBonus.acceleration;
            ai.handling += aiBoost.handling + upgradeBonus.handling;
            ai.angle = startAngle;
            ai.raceMoney = 0;
            this.aiTrucks.push(ai);
        }

        // All trucks for collision checks
        this.allTrucks = [this.playerTruck, ...this.aiTrucks];

        // Apply truck scale from track (if set)
        for (const t of this.allTrucks) {
            t.setTruckScale(truckScale);
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
        this.musicKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
        this.touchControls = new TouchControls(this);

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

        // ── Coins & Nitro Pickups ───────────────────────────────
        this.pickups = [];
        this.spawnPickups();

        // ── Skid marks layer (below trucks, above track) ────────
        this.skidGfx = this.add.graphics().setDepth(5);
        this.skidMarks = [];  // array of {x, y, angle, alpha}

        // ── HUD ─────────────────────────────────────────────────
        const hudStyle = {
            fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        };

        this.lapText = this.add.text(400, 10, '', {
            ...hudStyle, fontSize: '18px', color: '#ffcc00'
        }).setOrigin(0.5, 0).setDepth(900);

        this.timerText = this.add.text(400, 32, '', {
            ...hudStyle, fontSize: '14px', color: '#cccccc'
        }).setOrigin(0.5, 0).setDepth(900);

        this.speedText = this.add.text(10, 10, '', hudStyle).setDepth(900);

        this.nitroText = this.add.text(10, 30, '', {
            ...hudStyle, color: '#00ccff'
        }).setDepth(900);

        this.moneyText = this.add.text(790, 10, '', {
            ...hudStyle, color: '#ffcc00'
        }).setOrigin(1, 0).setDepth(900);

        this.offTrackText = this.add.text(400, 55, '', {
            ...hudStyle, fontSize: '16px', color: '#ff4444'
        }).setOrigin(0.5).setDepth(900);

        this.bestLapText = this.add.text(790, 30, '', {
            ...hudStyle, fontSize: '12px', color: '#00ff88'
        }).setOrigin(1, 0).setDepth(900);

        this.positionText = this.add.text(10, 50, '', {
            ...hudStyle, fontSize: '16px', color: '#ffcc00'
        }).setDepth(900);

        this.messageText = this.add.text(400, 300, '', {
            fontSize: '32px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(950).setAlpha(0);

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

        // ── Pre-race countdown with traffic lights ──────────────
        this._startCountdown();
    }

    _startCountdown() {
        const cx = 400, cy = 200;
        const lightR = 22;
        const lightGap = 55;
        const bgW = 80, bgH = 180;

        // Background box for lights
        const lightBg = this.add.graphics().setDepth(1000);
        lightBg.fillStyle(0x222222, 0.9);
        lightBg.fillRoundedRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 10);
        lightBg.lineStyle(3, 0x444444, 1);
        lightBg.strokeRoundedRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 10);

        // Three light circles (dim)
        const lights = [];
        for (let i = 0; i < 3; i++) {
            const g = this.add.graphics().setDepth(1001);
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
            this.pickups.push(nitro);
        }
    }

    // ── Flash a big message ─────────────────────────────────────
    showMessage(text, duration) {
        this.messageText.setText(text).setAlpha(1);
        this.tweens.add({
            targets: this.messageText,
            alpha: 0,
            duration: duration || 1500,
            ease: 'Power2'
        });
    }

    // ── Game Loop ───────────────────────────────────────────────
    update(time, delta) {
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
                if (ai.raceFinished) {
                    ai.update(delta, this.track.waypoints, this.allTrucks);
                }
            }
            // Player truck drives to podium too
            if (this.playerTruck._podiumTarget) {
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

        // ESC → back to title screen
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            soundFX.stopEngine();
            soundFX.stopMusic();
            soundFX.updateTireScreech(0);
            this.scene.start('BootScene');
            return;
        }

        // M → toggle music on/off
        if (Phaser.Input.Keyboard.JustDown(this.musicKey)) {
            if (soundFX.musicPlaying) {
                soundFX.stopMusic();
            } else {
                soundFX.startMusic();
            }
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

        this.playerTruck.update(delta, input, nitroInput);

        // ── Engine sound (RPM + pitch scale with upgrade level) ──
        const base = GameState.getBaseStats();
        const maxPossibleSpeed = base.topSpeed + GameState.maxLevel * GameState.perLevel.topSpeed;
        const upgradeRatio = GameState.upgrades.topSpeed / GameState.maxLevel; // 0 = stock, 1 = maxed
        soundFX.updateEngine(this.playerTruck.speed, maxPossibleSpeed, upgradeRatio);

        // ── Nitro boost sound (play once on activation) ────────
        if (this.playerTruck.nitroBoosting && !this._lastBoostState) {
            soundFX.playBoost();
        }
        this._lastBoostState = this.playerTruck.nitroBoosting;

        // ── Tire screech sound ─────────────────────────────────
        soundFX.updateTireScreech(this.playerTruck.driftAmount);

        // ── Update AI trucks ───────────────────────────────────
        for (const ai of this.aiTrucks) {
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
        const speed = Math.abs(Math.round(this.playerTruck.speed));
        this.speedText.setText(`Speed: ${speed} mph`);
        this.nitroText.setText(`Nitro: ${'█'.repeat(Math.ceil(this.playerTruck.nitroFuel))}${'░'.repeat(Math.ceil(this.playerTruck.nitroMax - this.playerTruck.nitroFuel))}`);
        this.offTrackText.setText(
            this.goingWrongWay ? '⚠ WRONG WAY!' :
            !this.playerTruck.onTrack && this.offTrackTimer > 1 ? `⚠ OFF TRACK! Respawn in ${Math.ceil(this.respawnThreshold - this.offTrackTimer)}...` :
            !this.playerTruck.onTrack ? '⚠ OFF TRACK!' : ''
        );
        this.lapText.setText(`Lap ${Math.min(this.currentLap + 1, this.totalLaps)} / ${this.totalLaps}`);
        this.timerText.setText(`Time: ${this.formatTime(this.raceTime)}  |  Lap: ${this.formatTime(this.lapTime)}`);
        this.moneyText.setText(`$${this.money}`);
        this.bestLapText.setText(this.bestLapTime < Infinity ? `Best Lap: ${this.formatTime(this.bestLapTime)}` : '');

        // ── Live position ──────────────────────────────────────
        const wpLen = this.track.waypoints.length;
        const playerProg = this.currentLap * wpLen + this.lastWaypointIndex;
        let pos = 1;
        for (const ai of this.aiTrucks) {
            if (ai.totalProgress > playerProg) pos++;
        }
        const posLabelsHUD = ['1ST', '2ND', '3RD', '4TH'];
        this.positionText.setText(posLabelsHUD[pos - 1] || `${pos}TH`);

        // ── Hazard effects on all trucks ────────────────────────
        this.applyHazardEffects(dt);

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
        const threshold = 40; // distance to "hit" a waypoint

        // Detect wrong way by comparing truck heading to track direction
        const expWp = waypoints[this.expectedWaypoint];
        const toExpDx = expWp[0] - truck.x;
        const toExpDy = expWp[1] - truck.y;
        const toExpAngle = Math.atan2(toExpDy, toExpDx);
        let angleDiff = truck.angle - toExpAngle;
        // Normalize to -PI..PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        // Wrong way if facing more than 120° away from expected direction AND moving
        this.goingWrongWay = Math.abs(angleDiff) > (Math.PI * 2 / 3) && Math.abs(truck.speed) > 30;

        for (let i = 0; i < len; i++) {
            const wp = waypoints[i];
            const dx = truck.x - wp[0];
            const dy = truck.y - wp[1];
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < threshold) {
                // Accept waypoint if it's within a few steps forward of expected
                const forwardDist = (i - this.expectedWaypoint + len) % len;
                if (forwardDist <= 3) {
                    // Forward progress — accept it
                    this.waypointsHit.add(i);
                    this.expectedWaypoint = (i + 1) % len;
                    this.lastWaypointIndex = i;
                }

                // If we're at start/finish and have hit enough waypoints
                if (i === this.track.startLineIndex && this.canCrossFinish) {
                    if (this.waypointsHit.size >= len * 0.6) {
                        this.completeLap();
                    }
                }

                // Once we've moved away from start, allow finish line crossing
                if (i >= 3) {
                    this.canCrossFinish = true;
                }
            }
        }
    }

    // ── Respawn player at last known good waypoint ─────────────
    respawnPlayer() {
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

        // Podium on the right side of the screen
        const podiumX = 750;
        const podiumY = 80 + slot * 60;
        truck._podiumTarget = { x: podiumX, y: podiumY };

        // Draw podium visual for this slot
        this._drawPodiumSlot(slot, truck);
    }

    _drawPodiumSlot(slot, truck) {
        // Draw podium block + position label
        const gfx = this.add.graphics().setDepth(900);
        const px = 750, py = 80 + slot * 60;
        const heights = [40, 30, 22]; // 1st tallest
        const colors = [0xffd700, 0xc0c0c0, 0xcd7f32]; // gold, silver, bronze
        const labels = ['1st', '2nd', '3rd'];
        const bw = 50, bh = heights[slot];

        // Podium block
        gfx.fillStyle(colors[slot], 0.9);
        gfx.fillRect(px - bw / 2, py + 10, bw, bh);
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.strokeRect(px - bw / 2, py + 10, bw, bh);

        // Position label
        this.add.text(px, py + 10 + bh / 2, labels[slot], {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#000000'
        }).setOrigin(0.5).setDepth(901);
    }

    finishRace() {
        this.raceFinished = true;

        // Assign podium to player too if they placed top 3
        // (player always finishes here, so count how many AI finished before)
        const playerSlot = this._podiumNextSlot++;
        if (playerSlot < 3) {
            this.playerTruck._podiumTarget = { x: 750, y: 80 + playerSlot * 60 };
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
        // Dim overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, 800, 600);
        overlay.setDepth(980);

        const cx = 400, cy = 300;
        const style = {
            fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        };

        this.add.text(cx, cy - 130, 'RACE RESULTS', {
            ...style, fontSize: '32px', color: '#ffcc00',
            fontFamily: 'Arial Black, Arial, sans-serif'
        }).setOrigin(0.5).setDepth(990);

        // Position
        const posLabels = ['1ST', '2ND', '3RD', '4TH'];
        const posColors = ['#ffcc00', '#cccccc', '#cc8844', '#888888'];
        this.add.text(cx, cy - 80, `You finished ${posLabels[this.playerPosition - 1]}!`, {
            ...style, fontSize: '24px', color: posColors[this.playerPosition - 1]
        }).setOrigin(0.5).setDepth(990);

        // Position bonus
        const posBonus = GameState.positionBonus[this.playerPosition - 1] || 0;
        if (posBonus > 0) {
            this.add.text(cx, cy - 50, `Position bonus: +$${posBonus}`, {
                ...style, fontSize: '14px', color: '#00ff88'
            }).setOrigin(0.5).setDepth(990);
        }

        this.add.text(cx, cy - 20, `Total Time: ${this.formatTime(this.raceTime)}`, style)
            .setOrigin(0.5).setDepth(990);
        this.add.text(cx, cy + 10, `Best Lap: ${this.formatTime(this.bestLapTime)}`, {
            ...style, color: '#00ff88'
        }).setOrigin(0.5).setDepth(990);
        this.add.text(cx, cy + 40, `Money Earned: $${this.money}`, {
            ...style, color: '#ffcc00'
        }).setOrigin(0.5).setDepth(990);

        // Championship standings
        if (GameState.gameMode === 'championship') {
            const pts = GameState.championshipPoints;
            const raceIdx = GameState.championshipRaceIndex + 1;
            const totalRaces = GameState.tracks.length;
            this.add.text(cx, cy + 75, `Championship: Race ${raceIdx} / ${totalRaces}`, {
                ...style, fontSize: '14px', color: '#aaaaaa'
            }).setOrigin(0.5).setDepth(990);
            this.add.text(cx, cy + 95, `Points: ${GameState.playerName}: ${pts.player}  |  Blue: ${pts.ai[0]}  |  Yellow: ${pts.ai[1]}  |  Green: ${pts.ai[2]}`, {
                ...style, fontSize: '11px', color: '#cccccc'
            }).setOrigin(0.5).setDepth(990);
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
                .setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerover', () => continueBtn.setStyle(hoverStyle));
            continueBtn.on('pointerout', () => continueBtn.setStyle(outStyle));
            continueBtn.on('pointerdown', () => {
                if (isLastChampRace) {
                    this.scene.start('ChampionshipResultsScene');
                } else {
                    GameState.championshipRaceIndex++;
                    GameState.raceNumber++;
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
                .setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });
            garageBtn.on('pointerover', () => garageBtn.setStyle(hoverStyle));
            garageBtn.on('pointerout', () => garageBtn.setStyle(outStyle));
            garageBtn.on('pointerdown', () => {
                // Save championship state so we return here after garage
                GameState._champReturnToResults = true;
                this.scene.start('ShopScene');
            });

            const saveBtn = this.add.text(cx, cy + 190, '💾 SAVE', btnStyle)
                .setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });
            saveBtn.on('pointerover', () => saveBtn.setStyle(hoverStyle));
            saveBtn.on('pointerout', () => saveBtn.setStyle(outStyle));
            saveBtn.on('pointerdown', () => { this._champSaveGame(saveBtn); });

            const quitBtn = this.add.text(cx, cy + 225, '🚪 QUIT CHAMPIONSHIP', {
                ...btnStyle, color: '#ff6666'
            }).setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });
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
                .setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });
            const menuBtn = this.add.text(cx + 110, cy + 130, '🏠 MENU', btnStyle)
                .setOrigin(0.5).setDepth(990).setInteractive({ useHandCursor: true });

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
        btn.setText('💾 SAVED ✅');
        this.time.delayedCall(1500, () => btn.setText('💾 SAVE'));
    }

    // ── Truck-to-truck collision / bumping ──────────────────────
    handleTruckCollisions() {
        const trucks = this.allTrucks;
        const minDist = 18;

        for (let i = 0; i < trucks.length; i++) {
            for (let j = i + 1; j < trucks.length; j++) {
                const a = trucks[i];
                const b = trucks[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist && dist > 0) {
                    // Push apart hard — fully resolve overlap + extra separation
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = (minDist - dist) / 2 + 3;

                    a.x -= nx * overlap;
                    a.y -= ny * overlap;
                    b.x += nx * overlap;
                    b.y += ny * overlap;

                    // Only penalize speed once per collision (not every frame)
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

    // ── Background ──────────────────────────────────────────────
    drawBackground() {
        const gfx = this.add.graphics();
        // Fill entire area with grass/dirt surround
        gfx.fillStyle(this.track.grassColor, 1);
        gfx.fillRect(0, 0, 800, 600);
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
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;

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

    // Fill the area between outer and inner paths (forming a track ring)
    fillClosedPath(gfx, outer, inner, expand) {
        const len = outer.length;

        // We draw the track as a series of quads between consecutive segments
        for (let i = 0; i < len; i++) {
            const j = (i + 1) % len;

            const o1 = outer[i];
            const o2 = outer[j];
            const i1 = inner[i];
            const i2 = inner[j];

            // Expand outward for border effect
            let eo1 = o1, eo2 = o2, ei1 = i1, ei2 = i2;
            if (expand > 0) {
                eo1 = this.expandPoint(o1, inner[i], expand);
                eo2 = this.expandPoint(o2, inner[j], expand);
                ei1 = this.expandPoint(i1, outer[i], expand);
                ei2 = this.expandPoint(i2, outer[j], expand);
            }

            gfx.beginPath();
            gfx.moveTo(eo1[0], eo1[1]);
            gfx.lineTo(eo2[0], eo2[1]);
            gfx.lineTo(ei2[0], ei2[1]);
            gfx.lineTo(ei1[0], ei1[1]);
            gfx.closePath();
            gfx.fillPath();
        }
    }

    // Push a point away from a reference point by 'amount'
    expandPoint(pt, ref, amount) {
        const dx = pt[0] - ref[0];
        const dy = pt[1] - ref[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return pt;
        return [
            pt[0] + (dx / dist) * amount,
            pt[1] + (dy / dist) * amount,
        ];
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

    // ── Apply hazard effects to all trucks each frame ───────────
    applyHazardEffects(dt) {
        if (!this.track.hazards || this.track.hazards.length === 0) return;
        for (const truck of this.allTrucks) {
            let inWater = false;
            for (const h of this.track.hazards) {
                const dx = truck.x - h.x;
                const dy = truck.y - h.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > h.radius) continue;

                const spd = Math.abs(truck.speed);
                // Strength: strongest at center (1.0), fading to 0 at edge
                const strength = 1 - (dist / h.radius);

                if (h.type === 'water') {
                    // Slow down like off-track but milder
                    inWater = true;
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
                    // Pull TOWARD hole center — strong mid-range, eject at dead center
                    if (!truck._holeCooldown || truck._holeCooldown <= 0) {
                        const t = dist / h.radius; // 0=center, 1=edge
                        if (dist < h.radius * 0.2) {
                            // Near center: eject the truck outward so it doesn't get stuck
                            const ejectAngle = truck.angle;
                            truck.x += Math.cos(ejectAngle) * h.radius * 0.5;
                            truck.y += Math.sin(ejectAngle) * h.radius * 0.5;
                            truck.speed = Math.max(truck.speed, 40);
                            truck._holeCooldown = 1.5;
                        } else {
                            const holeStr = Math.sin(Math.PI * t) * (1 - t * 0.3);
                            truck.speed *= (1 - 0.3 * holeStr);
                            const toCenter = Math.atan2(-dy, -dx);
                            let pull = toCenter - truck.angle;
                            while (pull > Math.PI) pull -= Math.PI * 2;
                            while (pull < -Math.PI) pull += Math.PI * 2;
                            truck.angle += pull * holeStr * 0.7;
                            if (truck === this.playerTruck) {
                                this.cameras.main.shake(150, 0.006 * holeStr);
                            }
                            truck._holeCooldown = 0.4;
                        }
                    }
                } else if (h.type === 'bump') {
                    // Push AWAY from center — moderate effect
                    if (!truck._bumpCooldown || truck._bumpCooldown <= 0) {
                        const t = dist / h.radius;
                        const bumpStr = Math.sin(Math.PI * t) * (1 - t * 0.3);
                        truck.speed *= (1 - 0.25 * bumpStr);
                        const away = Math.atan2(dy, dx);
                        let push = away - truck.angle;
                        while (push > Math.PI) push -= Math.PI * 2;
                        while (push < -Math.PI) push += Math.PI * 2;
                        truck.angle += push * bumpStr * 0.8;
                        if (truck === this.playerTruck) {
                            this.cameras.main.shake(100, 0.004 * bumpStr);
                        }
                        truck._bumpCooldown = 0.3;
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
