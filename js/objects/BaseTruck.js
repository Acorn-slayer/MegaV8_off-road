// BaseTruck — Shared truck physics, rendering, and track detection.
// Player (Truck) and AI (AiTruck) both extend this class.

class BaseTruck extends Phaser.GameObjects.Container {
    constructor(scene, x, y, color = 0xff0000, vehicleType = 'truck') {
        super(scene, x, y);
        scene.add.existing(this);

        this.truckColor = color;
        this.vehicleType = vehicleType;

        // ── Stats (set by subclass or externally) ──────────────
        this.topSpeed = 200;
        this.acceleration = 150;
        this.braking = 200;
        this.handling = 3.0;
        this.friction = 0.98;
        this.dirtFriction = 0.92;

        // ── State ──────────────────────────────────────────────
        this.speed = 0;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.onTrack = true;

        // ── Drift / slip state ─────────────────────────────────
        this.slipAngle = 0;        // current lateral slip (rad)
        this.driftAmount = 0;      // 0-1 visual drift indicator

        // ── Nitro ──────────────────────────────────────────────
        this.nitroFuel = 3;
        this.nitroMax = 5;
        this.nitroBoosting = false;
        this.nitroMultiplier = 1.8;
        this.nitroRegen = 0.15;

        // ── Truck dimensions ───────────────────────────────────
        this.truckWidth = 10;
        this.truckHeight = 18;

        // ── Draw the truck ─────────────────────────────────────
        this.truckGraphics = this.vehicleType === 'bike'
            ? this.createBikeGraphics(scene, color)
            : this.vehicleType === 'f1'
            ? this.createF1Graphics(scene, color)
            : this.vehicleType === 'tank'
            ? this.createTankGraphics(scene, color)
            : this.createTruckGraphics(scene, color);
        this.add(this.truckGraphics);    }

    // Apply track-based truck scaling
    setTruckScale(s) {
        if (!s || s === 1) return;
        this.truckGraphics.setScale(s);
        this.truckWidth = 10 * s;
        this.truckHeight = 18 * s;    }

    createTruckGraphics(scene, color) {
        const gfx = scene.add.graphics();

        // Truck body
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(-5, -9, 10, 18, 2);

        // Windshield
        gfx.fillStyle(0x88ccff, 0.8);
        gfx.fillRect(-3, -5, 6, 4);

        // Roof detail
        gfx.fillStyle(0x000000, 0.4);
        gfx.fillRect(-2, -8, 4, 2);

        // Rear bumper
        gfx.fillStyle(0x333333, 1);
        gfx.fillRect(-4, 7, 8, 2);

        // Wheels
        gfx.fillStyle(0x222222, 1);
        gfx.fillRect(-7, -7, 3, 5);
        gfx.fillRect(4, -7, 3, 5);
        gfx.fillRect(-7, 3, 3, 5);
        gfx.fillRect(4, 3, 3, 5);

        return gfx;
    }

    createBikeGraphics(scene, color) {
        const gfx = scene.add.graphics();

        // Wheels (top and bottom)
        gfx.fillStyle(0x111111, 1);
        gfx.fillRect(-2, -14, 4, 7);
        gfx.fillRect(-2, 7, 4, 7);
        // Wheel spokes
        gfx.fillStyle(0x777777, 1);
        gfx.fillRect(-1, -12, 2, 3);
        gfx.fillRect(-1, 9, 2, 3);

        // Body frame
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(-4, -8, 8, 16, 3);

        // Seat
        gfx.fillStyle(0x222222, 1);
        gfx.fillRoundedRect(-3, -2, 6, 7, 2);

        // Windshield / fairing
        gfx.fillStyle(0x555555, 1);
        gfx.fillRoundedRect(-3, -10, 6, 5, 2);

        // Handlebars
        gfx.fillStyle(0x333333, 1);
        gfx.fillRect(-6, -10, 3, 1);
        gfx.fillRect(3, -10, 3, 1);
        gfx.fillRect(-5, -10, 1, 3);
        gfx.fillRect(4, -10, 1, 3);

        return gfx;
    }

    createF1Graphics(scene, color) {
        const gfx = scene.add.graphics();

        // Rear wing
        gfx.fillStyle(0x333333, 1);
        gfx.fillRect(-7, 7, 14, 2);
        gfx.fillRect(-1, 5, 2, 4);

        // Body — narrow, elongated F1 shape
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(-4, -12, 8, 24, 3);

        // Nose cone (pointed)
        gfx.fillStyle(color, 1);
        gfx.fillTriangle(0, -16, -3, -12, 3, -12);

        // Cockpit opening
        gfx.fillStyle(0x222222, 0.9);
        gfx.fillRoundedRect(-2, -5, 4, 5, 2);

        // Driver helmet
        gfx.fillStyle(0xeeeeee, 1);
        gfx.fillCircle(0, -3, 2);

        // Front wing
        gfx.fillStyle(0x444444, 1);
        gfx.fillRect(-6, -13, 12, 2);

        // Front wheels
        gfx.fillStyle(0x111111, 1);
        gfx.fillRect(-8, -11, 3, 5);
        gfx.fillRect(5, -11, 3, 5);

        // Rear wheels (wider)
        gfx.fillStyle(0x111111, 1);
        gfx.fillRect(-9, 2, 4, 6);
        gfx.fillRect(5, 2, 4, 6);

        // Side pods
        gfx.fillStyle(color, 0.8);
        gfx.fillRect(-6, -3, 2, 8);
        gfx.fillRect(4, -3, 2, 8);

        // Exhaust / diffuser
        gfx.fillStyle(0x555555, 1);
        gfx.fillRect(-3, 8, 6, 2);

        return gfx;
    }

    createTankGraphics(scene, color) {
        const gfx = scene.add.graphics();

        // Treads — wide dark rectangles on both sides
        gfx.fillStyle(0x333333, 1);
        gfx.fillRect(-9, -11, 4, 22);
        gfx.fillRect(5, -11, 4, 22);

        // Tread link detail
        gfx.fillStyle(0x555555, 1);
        for (let i = 0; i < 4; i++) {
            gfx.fillRect(-9, -9 + i * 5, 4, 2);
            gfx.fillRect(5, -9 + i * 5, 4, 2);
        }

        // Hull body
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(-5, -10, 10, 20, 1);

        // Turret shadow ring
        gfx.fillStyle(0x000000, 0.3);
        gfx.fillCircle(0, -1, 6);

        // Turret dome
        gfx.fillStyle(color, 1);
        gfx.fillCircle(0, -1, 4);

        // Barrel (points forward = top in local space)
        gfx.fillStyle(0x222222, 1);
        gfx.fillRect(-1, -14, 2, 10);

        // Exhaust vents at rear
        gfx.fillStyle(0x444444, 1);
        gfx.fillRect(-3, 9, 2, 2);
        gfx.fillRect(1, 9, 2, 2);

        return gfx;
    }

    // ── Shared physics step ────────────────────────────────────
    applyPhysics(dt) {
        const isTank = this.vehicleType === 'tank';
        const isOnTrack = this.isOnTrack(this.x, this.y);
        this.onTrack = isTank ? true : isOnTrack;

        // Tanks ignore grass slowdown and off-track speed limits.
        const fric = this.onTrack ? this.friction : this.dirtFriction;
        this.speed *= fric;

        const maxSpd = this.onTrack ? this.topSpeed : this.topSpeed * 0.5;
        this.speed = Phaser.Math.Clamp(this.speed, -maxSpd * 0.3, maxSpd);

        // ── Slip / drift physics ───────────────────────────────
        // gripSpeed = 8 + topSpeed * 0.09 + handling * 11
        // Easy AI (110/1.8): 8+9.9+19.8 = 38 → slides at 34%
        // Stock Player (200/3.0): 8+18+33 = 59 → slides at 30%
        // Max Upgraded (280/5.0): 8+25.2+55 = 88 → slides at 31%
        const gripSpeed = 8 + this.topSpeed * 0.09 + this.handling * 11;
        const absSpeed = Math.abs(this.speed);
        const speedRatio = absSpeed / Math.max(gripSpeed, 1);

        if (absSpeed > 5 && (this.vx !== 0 || this.vy !== 0)) {
            // Current velocity direction
            const velAngle = Math.atan2(this.vy, this.vx);
            // Slip angle = difference between heading and velocity direction
            let rawSlip = this.angle - velAngle;
            while (rawSlip > Math.PI) rawSlip -= Math.PI * 2;
            while (rawSlip < -Math.PI) rawSlip += Math.PI * 2;

            // How much the tires can correct per frame depends on speed vs grip
            // Oversteer: tires lose grip progressively past gripSpeed
            const tireGrip = Math.max(0.05, 1.0 - (speedRatio - 1.0) * 0.6);
            const correctionRate = Phaser.Math.Clamp(tireGrip, 0.05, 1.0);

            // Blend slip toward zero (tires trying to re-align velocity with heading)
            this.slipAngle = rawSlip * (1.0 - correctionRate);

            // Speed loss from sliding (tire scrub friction)
            const slipMag = Math.abs(this.slipAngle);
            if (slipMag > 0.05) {
                this.speed *= 1.0 - slipMag * 0.15 * dt;
            }
        } else {
            this.slipAngle = 0;
        }

        // Understeer at extreme overspeed — threshold scales with handling
        const handlingNorm = Phaser.Math.Clamp(this.handling / 3.0, 0.4, 1.5);
        const understeerThreshold = 1.15 + handlingNorm * 0.15; // ~1.21 low, ~1.38 high
        if (speedRatio > understeerThreshold) {
            const understeerStrength = Math.min((speedRatio - understeerThreshold) * 0.4, 0.6);
            const velAngle = Math.atan2(this.vy, this.vx);
            let headingErr = this.angle - velAngle;
            while (headingErr > Math.PI) headingErr -= Math.PI * 2;
            while (headingErr < -Math.PI) headingErr += Math.PI * 2;
            this.angle -= headingErr * understeerStrength * dt * 4;
        }

        // Actual movement direction = heading + slip
        const moveAngle = this.angle - this.slipAngle;
        this.vx = Math.cos(moveAngle) * this.speed;
        this.vy = Math.sin(moveAngle) * this.speed;

        // Drift indicator (for visuals like tire marks)
        this.driftAmount = Math.min(Math.abs(this.slipAngle) / 0.4, 1.0);

        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Bounds (use track world dimensions if available)
        const bW = (this.scene && this.scene.track && this.scene.track.worldW) || 3200;
        const bH = (this.scene && this.scene.track && this.scene.track.worldH) || 1800;
        this.x = Phaser.Math.Clamp(this.x, 10, bW - 10);
        this.y = Phaser.Math.Clamp(this.y, 10, bH - 10);

        // Rotate graphic — show truck body rotated by heading (not velocity)
        this.truckGraphics.rotation = this.angle + Math.PI / 2;
    }

    // ── Nitro regen (when not boosting) ────────────────────────
    regenNitro(dt) {
        this.nitroFuel = Math.min(this.nitroFuel + this.nitroRegen * dt, this.nitroMax);
    }

    // ── Track detection (distance to centerline) ───────────────
    isOnTrack(px, py) {
        if (this.scene && this.scene.track) {
            const wps = this.scene.track.waypoints;
            const hw = this.scene.track.trackWidth / 2;
            return this.distToTrackCenter(px, py, wps) <= hw;
        }
        return true;
    }

    distToTrackCenter(px, py, waypoints) {
        let minDist = Infinity;
        const len = waypoints.length;
        for (let i = 0; i < len; i++) {
            const j = (i + 1) % len;
            const ax = waypoints[i][0], ay = waypoints[i][1];
            const bx = waypoints[j][0], by = waypoints[j][1];
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            if (len2 === 0) continue;
            let t = ((px - ax) * dx + (py - ay) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const cx = ax + t * dx, cy = ay + t * dy;
            const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    }
}
