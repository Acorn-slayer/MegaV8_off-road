// Coin — Collectible item on the track (money or nitro pickup)

class Coin extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type = 'money') {
        super(scene, x, y);
        scene.add.existing(this);

        this.type = type;       // 'money' or 'nitro'
        this.collected = false;
        this.value = type === 'money' ? 25 : 0;
        this.nitroAmount = type === 'nitro' ? 1.0 : 0;

        // Draw the pickup
        this.gfx = scene.add.graphics();
        this.add(this.gfx);
        this.draw();

        // Bobbing animation
        scene.tweens.add({
            targets: this,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.radius = 10; // pickup radius for collision
    }

    draw() {
        this.gfx.clear();
        if (this.type === 'money') {
            // Gold coin
            this.gfx.fillStyle(0xffcc00, 1);
            this.gfx.fillCircle(0, 0, 8);
            this.gfx.fillStyle(0xffaa00, 1);
            this.gfx.fillCircle(0, 0, 5);
            this.gfx.fillStyle(0xffcc00, 1);
            this.gfx.fillCircle(-1, -1, 3);
        } else {
            // Nitro canister — blue
            this.gfx.fillStyle(0x00aaff, 1);
            this.gfx.fillRoundedRect(-6, -8, 12, 16, 3);
            this.gfx.fillStyle(0x00ddff, 1);
            this.gfx.fillRect(-3, -6, 6, 4);
            // "N" label
            this.gfx.fillStyle(0xffffff, 1);
            this.gfx.fillRect(-2, -2, 1, 6);
            this.gfx.fillRect(1, -2, 1, 6);
        }
    }

    // Check if a truck is close enough to collect this item
    checkCollect(truck) {
        if (this.collected) return false;
        const dx = this.x - truck.x;
        const dy = this.y - truck.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + 10) {
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
