// Truck � Player vehicle. Extends BaseTruck with keyboard/touch input.

class Truck extends BaseTruck {
    constructor(scene, x, y, color = 0xff0000, vehicleType = 'truck') {
        super(scene, x, y, color, vehicleType);
    }

    // -- Update (called each frame) -----------------------------
    update(delta, cursors, nitroKey) {
        const dt = delta / 1000;

        // Steering — build wheel input progressively instead of snapping instantly.
        let steerTarget = 0;
        if (cursors.left.isDown) steerTarget -= 1;
        if (cursors.right.isDown) steerTarget += 1;

        const responseRate = 4.5;
        const releaseRate = 6.0;
        const steerRate = this.handling * 0.75;
        const rate = steerTarget === 0 ? releaseRate : responseRate;
        this.steerState = Phaser.Math.Linear(this.steerState, steerTarget, Math.min(rate * dt, 1));
        if (Math.abs(this.steerState) < 0.001 && steerTarget === 0) {
            this.steerState = 0;
        }
        this.angle += this.steerState * steerRate * dt;

        // Acceleration / braking
        if (cursors.up.isDown) {
            let accel = this.acceleration;
            if (this.nitroBoosting) {
                accel *= this.nitroMultiplier;
            }
            this.speed += accel * dt;
        } else if (cursors.down.isDown) {
            this.speed -= this.braking * dt;
        }

        // Nitro boost
        if (nitroKey && nitroKey.isDown && this.nitroFuel > 0) {
            this.nitroBoosting = true;
            this.nitroFuel -= dt;
            if (this.nitroFuel < 0) this.nitroFuel = 0;
        } else {
            this.nitroBoosting = false;
            this.regenNitro(dt);
        }

        // Shared physics (friction, track detection, movement, bounds)
        this.applyPhysics(dt);
    }
}
