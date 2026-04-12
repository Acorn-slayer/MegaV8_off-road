// Coin — Collectible item on the track (money or nitro pickup)

class Coin extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type = 'money', scale = 1) {
        super(scene, x, y);
        scene.add.existing(this);

        this.type = type;       // 'money' or 'nitro'
        this.collected = false;
        this.value = type === 'money' ? 25 : 0;
        this.nitroAmount = type === 'nitro' ? 1.0 : 0;
        this.drawScale = Math.max(0.8, scale);

        // Draw the pickup
        this.gfx = scene.add.graphics();
        this.add(this.gfx);
        this.draw();
        this.setScale(this.drawScale);

        // Bobbing animation
        scene.tweens.add({
            targets: this,
            scaleX: this.drawScale * 0.9,
            scaleY: this.drawScale * 0.9,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.radius = Math.round(18 * this.drawScale); // pickup radius for collision
    }

    draw() {
        this.gfx.clear();
        if (this.type === 'money') {
            // Gold coin
            this.gfx.fillStyle(0xffcc00, 1);
            this.gfx.fillCircle(0, 0, 12);
            this.gfx.fillStyle(0xffaa00, 1);
            this.gfx.fillCircle(0, 0, 8);
            this.gfx.fillStyle(0xffcc00, 1);
            this.gfx.fillCircle(-1, -1, 5);
        } else {
            // Nitro canister — blue
            this.gfx.fillStyle(0x00aaff, 1);
            this.gfx.fillRoundedRect(-8, -10, 16, 20, 4);
            this.gfx.fillStyle(0x00ddff, 1);
            this.gfx.fillRect(-4, -7, 8, 5);
            // "N" label
            this.gfx.fillStyle(0xffffff, 1);
            this.gfx.fillRect(-2, -2, 1, 8);
            this.gfx.fillRect(1, -2, 1, 8);
        }
    }

    // Check if a truck is close enough to collect this item
    checkCollect(truck) {
        if (this.collected) return false;
        const dx = this.x - truck.x;
        const dy = this.y - truck.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const truckRadius = Math.max(10, truck.truckWidth * 0.6);
        if (dist < this.radius + truckRadius) {
            this.collect();
            return true;
        }
        return false;
    }

    collect() {
        this.collected = true;
        this.setVisible(false);

        // Respawn after a random delay (1-4 seconds)
        const delay = 1000 + Math.random() * 3000;
        this.scene.time.delayedCall(delay, () => {
            this.collected = false;
            this.setVisible(true);
        });
    }
}
