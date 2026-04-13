// AiTruck � Computer-controlled opponent. Extends BaseTruck with waypoint AI.

class AiTruck extends BaseTruck {
    constructor(scene, x, y, color, difficulty) {
        super(scene, x, y, color);

        this.difficulty = difficulty;

        // Difficulty-specific overrides
        const stats = {
            easy:   { topSpeed: 165, acceleration: 121, handling: 2.2, wobble: 0.5 },
            medium: { topSpeed: 187, acceleration: 138, handling: 2.6, wobble: 0.35 },
            hard:   { topSpeed: 204, acceleration: 154, handling: 2.8, wobble: 0.2 },
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
        this.overtakeSide = 0;
        this.overtakeStrength = 0;
        this.overtakeTimer = 0;
        this.overtakeTargetId = null;
        this.wallRecoveryTime = 0;
        this.wallRecoveryHeading = this.angle;

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

        if (this.wallRecoveryTime > 0) {
            this.updateWallRecovery(dt);
            this.applyPhysics(dt);
            return;
        }

        // When drifting, look further ahead to avoid oversteering
        const lookAheadWp = this.driftAmount > 0.3 ? 2 : 0;
        const target = waypoints[(this.currentWaypoint + lookAheadWp) % len];
        const prevTarget = waypoints[(this.currentWaypoint + lookAheadWp - 1 + len) % len] || target;

        let pathDx = target[0] - prevTarget[0];
        let pathDy = target[1] - prevTarget[1];
        if (pathDx === 0 && pathDy === 0) {
            pathDx = Math.cos(this.angle);
            pathDy = Math.sin(this.angle);
        }
        const pathAngle = Math.atan2(pathDy, pathDx);

        // Direction to target waypoint
        const centerDx = target[0] - this.x;
        const centerDy = target[1] - this.y;
        const distToWp = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

        // Commit to a side-pass target so the AI actually drives around blockers.
        const overtake = this.getOvertakePlan(allTrucks, pathAngle, dt);
        const trackWidth = Math.max((this.scene && this.scene.track && this.scene.track.trackWidth) || 70, 40);
        const normalX = -Math.sin(pathAngle);
        const normalY = Math.cos(pathAngle);
        const forwardX = Math.cos(pathAngle);
        const forwardY = Math.sin(pathAngle);
        const lateralOffset = trackWidth * 0.28 * overtake.strength * overtake.side;
        const forwardLead = Math.max(16, this.speed * 0.16) * overtake.strength;
        let dx = (target[0] + normalX * lateralOffset + forwardX * forwardLead) - this.x;
        let dy = (target[1] + normalY * lateralOffset + forwardY * forwardLead) - this.y;
        let targetAngle = Math.atan2(dy, dx);

        // Wobble (random steering variation)
        this.wobbleTimer += dt;
        if (this.wobbleTimer > 0.5) {
            this.wobbleTimer = 0;
            this.wobbleOffset = (Math.random() - 0.5) * this.wobble;
        }

        let angleDiff = targetAngle - this.angle + this.wobbleOffset;
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

        // Slow down when drifting — AI reacts to loss of grip
        const driftPenalty = 1.0 - this.driftAmount * 0.6;
        accel *= driftPenalty;

        // If heavily drifting, actively brake to regain control
        if (this.driftAmount > 0.5) {
            this.speed *= (1.0 - this.driftAmount * 0.3 * dt * 10);
        }

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
        const overtakeBoost = overtake.side !== 0 && overtake.blockedBySlower ? 1.08 : 1.0;
        const effectiveTop = this.topSpeed * Math.max(turnFactor, 0.6) * overtakeBoost;
        this.speed += accel * dt;
        this.speed = Phaser.Math.Clamp(this.speed, 0, effectiveTop);

        // Shared physics (friction, track detection, off-track slowdown, bounds)
        this.applyPhysics(dt);
    }

    updateWallRecovery(dt) {
        this.wallRecoveryTime = Math.max(0, this.wallRecoveryTime - dt);
        this.nitroBoosting = false;
        this.overtakeTimer = 0;
        this.overtakeStrength = 0;
        this.overtakeSide = 0;
        this.overtakeTargetId = null;

        let angleDiff = Phaser.Math.Angle.Wrap(this.wallRecoveryHeading - this.angle);
        const turnAmount = this.handling * dt * 2.6;
        if (angleDiff > turnAmount) {
            this.angle += turnAmount;
        } else if (angleDiff < -turnAmount) {
            this.angle -= turnAmount;
        } else {
            this.angle = this.wallRecoveryHeading;
        }

        const needsMoreRotation = Math.abs(angleDiff) > 0.35;
        if (this.wallRecoveryTime > 0.22 || needsMoreRotation) {
            this.speed = Math.max(this.speed - this.braking * dt * 1.9, -this.topSpeed * 0.22);
        } else {
            this.speed = Math.min(this.speed + this.acceleration * dt * 0.9, this.topSpeed * 0.34);
        }
    }

    triggerWallRecovery(recoveryHeading) {
        this.wallRecoveryHeading = recoveryHeading;
        this.wallRecoveryTime = 0.7;
        this.nitroBoosting = false;
        this._wallHitCount = 0;
        this._wallHitTimer = 0;
    }

    // -- Overtaking logic ---------------------------------------
    getOvertakePlan(allTrucks, pathAngle, dt) {
        if (!allTrucks) {
            this.overtakeTimer = 0;
            this.overtakeStrength = 0;
            this.overtakeSide = 0;
            this.overtakeTargetId = null;
            return { side: 0, strength: 0, blockedBySlower: false };
        }

        const fx = Math.cos(pathAngle);
        const fy = Math.sin(pathAngle);
        let bestCandidate = null;
        let bestScore = 0;

        for (const other of allTrucks) {
            if (other === this || other._destroyed) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const ahead = dx * fx + dy * fy;
            if (ahead < 8) continue;

            const isTank = other.vehicleType === 'tank';
            const lookAhead = isTank ? 150 : 115;
            if (ahead > lookAhead) continue;

            const side = -dx * fy + dy * fx;
            const laneHalfWidth = Math.max(((this.scene && this.scene.track && this.scene.track.trackWidth) || 70) * 0.34, 18);
            if (Math.abs(side) > laneHalfWidth * 1.45) continue;

            const relativeSpeed = this.speed - other.speed;
            const blockedBySlower = relativeSpeed > 4;
            let score = (1 - Phaser.Math.Clamp(ahead / lookAhead, 0, 1)) * 1.1;
            score += Phaser.Math.Clamp(1 - Math.abs(side) / Math.max(laneHalfWidth, 1), 0, 1) * 0.75;
            if (ahead < 34) score += 0.28;
            if (blockedBySlower) score += Phaser.Math.Clamp(relativeSpeed / 90, 0, 0.4);
            if (isTank) score += 0.45;
            if (score <= bestScore) continue;

            const leftCost = this.getLaneCost(allTrucks, pathAngle, -1, ahead, other);
            const rightCost = this.getLaneCost(allTrucks, pathAngle, 1, ahead, other);
            const chosenSide = leftCost <= rightCost ? -1 : 1;
            const chosenCost = Math.min(leftCost, rightCost);

            bestCandidate = {
                id: other._aiId || other.name || `${other.x}:${other.y}`,
                side: chosenSide,
                strength: Phaser.Math.Clamp(score - chosenCost * 0.32, 0, 1),
                blockedBySlower,
            };
            bestScore = score;
        }

        if (bestCandidate && bestCandidate.strength > 0.08) {
            const sameTarget = this.overtakeTargetId === bestCandidate.id;
            if (!sameTarget || this.overtakeTimer <= 0) {
                this.overtakeSide = bestCandidate.side;
                this.overtakeTargetId = bestCandidate.id;
            }
            this.overtakeTimer = 0.75;
            this.overtakeStrength = Phaser.Math.Linear(this.overtakeStrength, bestCandidate.strength, Math.min(dt * 5.5, 1));
            return {
                side: this.overtakeSide,
                strength: this.overtakeStrength,
                blockedBySlower: bestCandidate.blockedBySlower,
            };
        }

        this.overtakeTimer = Math.max(0, this.overtakeTimer - dt);
        if (this.overtakeTimer <= 0) {
            this.overtakeStrength = Phaser.Math.Linear(this.overtakeStrength, 0, Math.min(dt * 4.5, 1));
            if (this.overtakeStrength < 0.05) {
                this.overtakeStrength = 0;
                this.overtakeSide = 0;
                this.overtakeTargetId = null;
            }
        }

        return {
            side: this.overtakeSide,
            strength: this.overtakeStrength,
            blockedBySlower: false,
        };
    }

    getLaneCost(allTrucks, pathAngle, sideSign, blockerAhead, blocker) {
        const fx = Math.cos(pathAngle);
        const fy = Math.sin(pathAngle);
        let cost = blocker && blocker.vehicleType === 'tank' ? 0.4 : 0.18;

        for (const other of allTrucks) {
            if (other === this || other === blocker || other._destroyed) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const ahead = dx * fx + dy * fy;
            if (ahead < -22 || ahead > blockerAhead + 28) continue;

            const side = -dx * fy + dy * fx;
            if (sideSign * side < -10) continue;

            const sideDist = Math.abs(side);
            const forwardFactor = 1 - Phaser.Math.Clamp(Math.abs(ahead - blockerAhead * 0.7) / Math.max(blockerAhead, 1), 0, 1);
            const sideFactor = 1 - Phaser.Math.Clamp(sideDist / Math.max((((this.scene && this.scene.track && this.scene.track.trackWidth) || 70) * 0.4), 1), 0, 1);
            cost += Math.max(0, forwardFactor * 0.8 + sideFactor * 0.7);
            if (other.vehicleType === 'tank') cost += 0.35;
        }

        return cost;
    }
}
