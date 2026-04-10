// Truck � Player vehicle. Extends BaseTruck with keyboard/touch input.

class Truck extends BaseTruck {
    constructor(scene, x, y, color = 0xff0000) {
        super(scene, x, y, color);
    }

    // -- Update (called each frame) -----------------------------
    update(delta, cursors, nitroKey) {
        const dt = delta / 1000;

        // Steering
        const steer = this.handling * dt;
        if (cursors.left.isDown) {
            this.angle -= steer;
        }
        if (cursors.right.isDown) {
            this.angle += steer;
        }

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
