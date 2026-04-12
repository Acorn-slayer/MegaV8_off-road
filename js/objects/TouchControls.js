// TouchControls — On-screen buttons for iPad / mobile play

class TouchControls {
    constructor(scene) {
        this.scene = scene;

        // Virtual button states (mimics cursor keys)
        this.left = { isDown: false };
        this.right = { isDown: false };
        this.up = { isDown: false };
        this.down = { isDown: false };
        this.nitro = { isDown: false };

        // Only show on touch devices
        if (!scene.sys.game.device.input.touch) return;

        this.buttons = [];
        this.createButtons();
    }

    createButtons() {
        const scene = this.scene;
        const btnAlpha = 0.35;
        const btnSize = 50;
        const padding = 10;

        // Left side: steering (left / right)
        this.addButton(padding + btnSize / 2, 660, btnSize, '◄', btnAlpha, this.left);
        this.addButton(padding + btnSize * 1.5 + 10, 660, btnSize, '►', btnAlpha, this.right);

        // Right side: gas / brake
        this.addButton(1280 - padding - btnSize * 1.5 - 10, 660, btnSize, '▼', btnAlpha, this.down);
        this.addButton(1280 - padding - btnSize / 2, 660, btnSize, '▲', btnAlpha, this.up);

        // Nitro button (center bottom)
        this.addButton(640, 670, btnSize * 1.2, 'N₂O', btnAlpha, this.nitro);
    }

    addButton(x, y, size, label, alpha, state) {
        const scene = this.scene;
        const depth = 1000; // always on top

        // Button background
        const bg = scene.add.graphics();
        bg.fillStyle(0xffffff, alpha);
        bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 8);
        bg.setDepth(depth).setScrollFactor(0);

        // Label
        const txt = scene.add.text(x, y, label, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);

        // Interactive zone
        const zone = scene.add.zone(x, y, size, size).setInteractive().setDepth(depth + 2).setScrollFactor(0);

        zone.on('pointerdown', () => { state.isDown = true; });
        zone.on('pointerup', () => { state.isDown = false; });
        zone.on('pointerout', () => { state.isDown = false; });

        this.buttons.push({ bg, txt, zone });
    }
}
