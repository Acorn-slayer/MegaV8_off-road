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
        this.aiState = AiTruck.STATES.RACING;
        this.aiStateTargetId = null;
        this.recoveryCooldown = 0;
        this.lastRecoveryReason = 'wall';
        this.lastProgressMetric = 0;
        this.stuckTimer = 0;
        this.wrongWayTimer = 0;
        this.offTrackAssistPoint = null;

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
        this.recoveryCooldown = Math.max(0, this.recoveryCooldown - dt);

        if (this.raceFinished) {
            this.updateFinishState(dt);
            this.applyPhysics(dt);
            return;
        }

        if (this.wallRecoveryTime > 0) {
            this.setAiState(this.lastRecoveryReason === 'stuck' ? AiTruck.STATES.RECOVERING_STUCK : AiTruck.STATES.RECOVERING_WALL);
            this.updateWallRecovery(dt);
            this.applyPhysics(dt);
            return;
        }

        // When drifting, look further ahead to avoid oversteering
        const lookAheadWp = this.driftAmount > 0.3 ? 2 : 0;
        const baseTarget = waypoints[(this.currentWaypoint + lookAheadWp) % len];
        const target = !this.onTrack ? this.getOffTrackTarget(waypoints, baseTarget) : baseTarget;
        const prevTarget = waypoints[(this.currentWaypoint + lookAheadWp - 1 + len) % len] || target;

        let pathDx = target[0] - prevTarget[0];
        let pathDy = target[1] - prevTarget[1];
        if (pathDx === 0 && pathDy === 0) {
            pathDx = Math.cos(this.angle);
            pathDy = Math.sin(this.angle);
        }
        const pathAngle = Math.atan2(pathDy, pathDx);

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

        if (overtake.side < 0 && overtake.strength > 0.08) {
            this.setAiState(AiTruck.STATES.OVERTAKING_LEFT, overtake.targetId);
        } else if (overtake.side > 0 && overtake.strength > 0.08) {
            this.setAiState(AiTruck.STATES.OVERTAKING_RIGHT, overtake.targetId);
        } else if (!this.onTrack) {
            this.setAiState(AiTruck.STATES.RECOVERING_OFFTRACK);
        } else {
            this.setAiState(AiTruck.STATES.RACING);
        }

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

        this.updateWaypointProgress(waypoints);

        // Acceleration (always accelerating)
        let accel = this.acceleration;

        if (!this.onTrack) {
            accel *= 0.72;
        }

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
        this.updateStuckDetection(waypoints, dt, pathAngle);
    }

    updateWaypointProgress(waypoints) {
        const len = waypoints.length;
        const maxAdvancePerFrame = 3;

        for (let steps = 0; steps < maxAdvancePerFrame; steps++) {
            const segment = this.getCurrentSegmentProgress(waypoints);
            if (!segment) return;

            const trackWidth = Math.max((this.scene && this.scene.track && this.scene.track.trackWidth) || 70, 40);
            const speedAbs = Math.abs(this.speed);
            const lateralThreshold = Math.max(trackWidth * 0.44, 20);
            const forwardThreshold = Math.max(trackWidth * 0.32, 16) + speedAbs * 0.12;
            const nearNext = segment.distToNext <= forwardThreshold;
            const passedSegment = segment.t >= 0.9 && segment.lateralDist <= lateralThreshold;

            if (!nearNext && !passedSegment) {
                return;
            }

            const prev = this.currentWaypoint;
            this.currentWaypoint = (this.currentWaypoint + 1) % len;
            this.totalProgress++;
            if (this.currentWaypoint === 0 || prev > this.currentWaypoint) {
                this.lapsCompleted++;
            }
        }
    }

    getCurrentSegmentProgress(waypoints) {
        const len = waypoints.length;
        if (len < 2) return null;

        const nextIdx = ((this.currentWaypoint % len) + len) % len;
        const prevIdx = (nextIdx - 1 + len) % len;
        const ax = waypoints[prevIdx][0];
        const ay = waypoints[prevIdx][1];
        const bx = waypoints[nextIdx][0];
        const by = waypoints[nextIdx][1];
        const segDx = bx - ax;
        const segDy = by - ay;
        const segLen2 = segDx * segDx + segDy * segDy;
        if (segLen2 === 0) {
            return {
                t: 1,
                lateralDist: 0,
                distToNext: Phaser.Math.Distance.Between(this.x, this.y, bx, by),
            };
        }

        const rawT = ((this.x - ax) * segDx + (this.y - ay) * segDy) / segLen2;
        const clampedT = Phaser.Math.Clamp(rawT, 0, 1);
        const closestX = ax + segDx * clampedT;
        const closestY = ay + segDy * clampedT;
        const lateralDist = Phaser.Math.Distance.Between(this.x, this.y, closestX, closestY);
        const distToNext = Phaser.Math.Distance.Between(this.x, this.y, bx, by);

        return {
            t: rawT,
            lateralDist,
            distToNext,
        };
    }

    updateFinishState(dt) {
        if (this._podiumTarget) {
            this.setAiState(AiTruck.STATES.FINISHED_PODIUM);
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
            this.setAiState(AiTruck.STATES.FINISHED_COAST);
            this.speed *= 0.95;
        }
    }

    setAiState(nextState, targetId = null) {
        this.aiState = nextState;
        this.aiStateTargetId = targetId;
    }

    getOffTrackTarget(waypoints, fallbackTarget) {
        const closest = this.getClosestCenterlinePoint(waypoints);
        if (!closest) {
            this.offTrackAssistPoint = null;
            return fallbackTarget;
        }

        const nextIdx = ((closest.nextIdx % waypoints.length) + waypoints.length) % waypoints.length;
        const nextWp = waypoints[nextIdx];
        const forwardX = nextWp[0] - closest.x;
        const forwardY = nextWp[1] - closest.y;
        const forwardLen = Math.sqrt(forwardX * forwardX + forwardY * forwardY) || 1;
        const lead = Math.min(24, forwardLen * 0.35);
        this.offTrackAssistPoint = {
            x: closest.x + (forwardX / forwardLen) * lead,
            y: closest.y + (forwardY / forwardLen) * lead,
        };
        return this.offTrackAssistPoint;
    }

    getClosestCenterlinePoint(waypoints) {
        if (!waypoints || waypoints.length < 2) return null;

        let best = null;
        const len = waypoints.length;
        for (let i = 0; i < len; i++) {
            const j = (i + 1) % len;
            const ax = waypoints[i][0];
            const ay = waypoints[i][1];
            const bx = waypoints[j][0];
            const by = waypoints[j][1];
            const dx = bx - ax;
            const dy = by - ay;
            const segLen2 = dx * dx + dy * dy;
            if (segLen2 === 0) continue;

            let t = ((this.x - ax) * dx + (this.y - ay) * dy) / segLen2;
            t = Phaser.Math.Clamp(t, 0, 1);
            const px = ax + dx * t;
            const py = ay + dy * t;
            const distSq = (this.x - px) * (this.x - px) + (this.y - py) * (this.y - py);
            if (!best || distSq < best.distSq) {
                best = { x: px, y: py, distSq, nextIdx: j };
            }
        }

        return best;
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

    triggerWallRecovery(recoveryHeading, reason = 'wall') {
        this.wallRecoveryHeading = recoveryHeading;
        this.wallRecoveryTime = 0.7;
        this.recoveryCooldown = 0.9;
        this.lastRecoveryReason = reason;
        this.nitroBoosting = false;
        this._wallHitCount = 0;
        this._wallHitTimer = 0;
        this.stuckTimer = 0;
        this.wrongWayTimer = 0;
        this.setAiState(reason === 'stuck' ? AiTruck.STATES.RECOVERING_STUCK : AiTruck.STATES.RECOVERING_WALL);
    }

    updateStuckDetection(waypoints, dt, fallbackHeading) {
        const segment = this.getCurrentSegmentProgress(waypoints);
        if (!segment) return;

        const progressMetric = this.totalProgress + Phaser.Math.Clamp(segment.t, 0, 1);
        const progressDelta = progressMetric - this.lastProgressMetric;
        this.lastProgressMetric = progressMetric;

        const trackWidth = Math.max((this.scene && this.scene.track && this.scene.track.trackWidth) || 70, 40);
        const speedAbs = Math.abs(this.speed);
        const lowSpeed = speedAbs < Math.max(18, this.topSpeed * 0.14);
        const poorProgress = progressDelta < 0.003;
        const farFromLine = segment.lateralDist > Math.max(trackWidth * 0.58, 24);
        const desiredHeading = this.scene && typeof this.scene._getTruckRecoveryHeading === 'function'
            ? this.scene._getTruckRecoveryHeading(this, 3)
            : fallbackHeading;
        const headingError = Math.abs(Phaser.Math.Angle.Wrap(desiredHeading - this.angle));
        const wrongWay = headingError > Math.PI * 0.63;

        if (lowSpeed && poorProgress) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.75);
        }

        if (wrongWay && (poorProgress || lowSpeed || farFromLine)) {
            this.wrongWayTimer += dt;
        } else {
            this.wrongWayTimer = Math.max(0, this.wrongWayTimer - dt);
        }

        if (this.recoveryCooldown <= 0 && (this.stuckTimer > 1.35 || this.wrongWayTimer > 0.95)) {
            this.triggerWallRecovery(desiredHeading, 'stuck');
        }
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
                id: other.truckId,
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
                targetId: this.overtakeTargetId,
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
            targetId: this.overtakeTargetId,
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

AiTruck.STATES = {
    RACING: 'racing',
    OVERTAKING_LEFT: 'overtaking_left',
    OVERTAKING_RIGHT: 'overtaking_right',
    RECOVERING_OFFTRACK: 'recovering_offtrack',
    RECOVERING_WALL: 'recovering_wall',
    RECOVERING_STUCK: 'recovering_stuck',
    FINISHED_PODIUM: 'finished_podium',
    FINISHED_COAST: 'finished_coast',
};
