// AiTruck � Computer-controlled opponent. Extends BaseTruck with waypoint AI.

class AiTruck extends BaseTruck {
    constructor(scene, x, y, color, difficulty) {
        super(scene, x, y, color);

        this.difficulty = difficulty;

        // Difficulty-specific overrides
        const stats = {
            easy:   { topSpeed: 150, acceleration: 110, handling: 2.2, wobble: 0.5 },
            medium: { topSpeed: 170, acceleration: 125, handling: 2.6, wobble: 0.35 },
            hard:   { topSpeed: 185, acceleration: 140, handling: 2.8, wobble: 0.2 },
        };
        const s = stats[difficulty] || stats.medium;

        this.topSpeed = s.topSpeed;
        this.acceleration = s.acceleration;
        this.handling = s.handling;
        this.wobble = s.wobble;

        // AI navigation state
        this.currentWaypoint = 1;
        this.wobbleTimer = 0;
        this.wobbleOffset = 0;

        // AI lap tracking
        this.lapsCompleted = 0;
        this.totalProgress = 1;   // cumulative waypoint counter (never wraps)
        this.raceFinished = false;

        // AI nitro timing
        this.nitroFuel = 2;
        this.nitroMax = 3;
        this.nitroTimer = 0;
        this.nitroCooldown = 8 + Math.random() * 5;
    }

    // -- Update (called each frame) -----------------------------
    update(delta, waypoints, allTrucks) {
        const dt = delta / 1000;
        const len = waypoints.length;
        const target = waypoints[this.currentWaypoint % len];

        // Direction to target waypoint
        let dx = target[0] - this.x;
        let dy = target[1] - this.y;
        const distToWp = Math.sqrt(dx * dx + dy * dy);
        let targetAngle = Math.atan2(dy, dx);

        // Overtaking offset
        const avoidOffset = this.getOvertakeOffset(allTrucks);

        // Wobble (random steering variation)
        this.wobbleTimer += dt;
        if (this.wobbleTimer > 0.5) {
            this.wobbleTimer = 0;
            this.wobbleOffset = (Math.random() - 0.5) * this.wobble;
        }

        let angleDiff = targetAngle - this.angle + this.wobbleOffset + avoidOffset;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Turn toward target
        const turnAmount = this.handling * dt;
        if (angleDiff > turnAmount) {
            this.angle += turnAmount;
        } else if (angleDiff < -turnAmount) {
            this.angle -= turnAmount;
        } else {
            this.angle = targetAngle + this.wobbleOffset;
        }

        // Advance to next waypoint when close enough
        if (distToWp < 35) {
            const prev = this.currentWaypoint;
            this.currentWaypoint = (this.currentWaypoint + 1) % len;
            this.totalProgress++;
            // Crossed start/finish line (wrapped from last waypoint to 0)
            if (this.currentWaypoint === 0 || (prev > this.currentWaypoint)) {
                this.lapsCompleted++;
            }
        }

        // Stop racing once finished
        if (this.raceFinished) {
            if (this._podiumTarget) {
                // Drive toward podium position
                const dx = this._podiumTarget.x - this.x;
                const dy = this._podiumTarget.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    this.angle = Math.atan2(dy, dx);
                    this.speed = Math.min(this.topSpeed * 0.4, dist * 2);
                } else {
                    this.speed = 0;
                    this.x = this._podiumTarget.x;
                    this.y = this._podiumTarget.y;
                }
            } else {
                this.speed *= 0.95;  // coast to stop (4th place)
            }
            this.applyPhysics(dt);
            return;
        }

        // Acceleration (always accelerating)
        let accel = this.acceleration;

        // AI nitro usage (periodic bursts)
        this.nitroTimer += dt;
        if (this.nitroTimer >= this.nitroCooldown && this.nitroFuel > 0) {
            this.nitroBoosting = true;
        }

        if (this.nitroBoosting && this.nitroFuel > 0) {
            accel *= this.nitroMultiplier;
            this.nitroFuel -= dt;
            if (this.nitroFuel <= 0) {
                this.nitroFuel = 0;
                this.nitroBoosting = false;
                this.nitroTimer = 0;
                this.nitroCooldown = 8 + Math.random() * 5;
            }
        } else {
            this.nitroBoosting = false;
            this.regenNitro(dt);
        }

        // Slow down in turns (less aggressive penalty)
        const turnFactor = 1.0 - Math.abs(angleDiff) * 0.2;
        const effectiveTop = this.topSpeed * Math.max(turnFactor, 0.6);
        this.speed += accel * dt;
        this.speed = Phaser.Math.Clamp(this.speed, 0, effectiveTop);

        // Shared physics (friction, track detection, off-track slowdown, bounds)
        this.applyPhysics(dt);
    }

    // -- Overtaking logic ---------------------------------------
    getOvertakeOffset(allTrucks) {
        if (!allTrucks) return 0;

        const lookAhead = 70;
        const sideThresh = 30;
        const steerAmount = 0.6;

        const fx = Math.cos(this.angle);
        const fy = Math.sin(this.angle);

        for (const other of allTrucks) {
            if (other === this) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;

            const ahead = dx * fx + dy * fy;
            if (ahead < 10 || ahead > lookAhead) continue;

            const side = -dx * fy + dy * fx;
            if (Math.abs(side) < sideThresh) {
                return side >= 0 ? -steerAmount : steerAmount;
            }
        }

        return 0;
    }
}
