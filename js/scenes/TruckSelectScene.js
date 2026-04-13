// TruckSelectScene — Pick a truck color/type before racing

class TruckSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TruckSelectScene' });
    }

    create() {
        // Background
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        // Title
        this.add.text(640, 40, 'CHOOSE YOUR VEHICLE', {
            fontSize: '22px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        const presets = GameState.truckPresets;
        // Only show owned vehicles
        const colors = Object.keys(presets).map(Number).filter(c => GameState.isVehicleUnlocked(c));

        if (colors.length === 0) {
            // No vehicles at all — send to shop
            this.add.text(640, 360, 'No vehicles!\nVisit the Vehicle Shop to buy one.', {
                fontSize: '18px', fontFamily: 'Arial, sans-serif', color: '#ff6666', align: 'center'
            }).setOrigin(0.5);
            this.time.delayedCall(2000, () => {
                GameState.previousScene = 'TrackSelectScene';
                this.scene.start('VehicleShopScene');
            });
            return;
        }

        const cols = 3;
        const rows = Math.ceil(colors.length / cols);
        const cardW = 220;
        const cardH = 200;
        const gapX = 20;
        const gapY = 20;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = (1280 - totalW) / 2;
        const startY = 90;

        for (let i = 0; i < colors.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);
            this._drawTruckCard(colors[i], presets[colors[i]], x, y, cardW, cardH);
        }

        // Back hint
        this.add.text(640, 690, 'Click a vehicle to race • ESC = Back', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#666666'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-ESC', () => {
            this.scene.start('TrackSelectScene');
        });
    }

    _drawTruckCard(color, preset, x, y, w, h) {
        const cx = x + w / 2;
        const gfx = this.add.graphics();

        const isActive = (color === GameState.getPlayerColor());
        // Card bg
        gfx.fillStyle(isActive ? 0x2a4a2a : 0x2a2a4e, 0.9);
        gfx.fillRoundedRect(x, y, w, h, 10);
        if (isActive) {
            gfx.lineStyle(3, 0x00ff88, 1);
            gfx.strokeRoundedRect(x, y, w, h, 10);
            this.add.text(cx, y + h - 14, '✔ SELECTED', {
                fontSize: '9px', fontFamily: "'Press Start 2P', cursive", color: '#00ff88'
            }).setOrigin(0.5);
        }

        // Truck name
        this.add.text(cx, y + 20, preset.name, {
            fontSize: '11px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);

        // Draw truck preview (bigger version of the game truck)
        const truckGfx = this.add.graphics();
        const tw = 24, th = 40;
        const tcx = cx, tcy = y + 65;

        // Body
        truckGfx.fillStyle(color, 1);
        truckGfx.fillRoundedRect(tcx - tw / 2, tcy - th / 2, tw, th, 4);
        // Windshield
        truckGfx.fillStyle(0x88ccff, 0.7);
        truckGfx.fillRect(tcx - tw / 2 + 3, tcy - th / 2 + 4, tw - 6, 8);
        // Wheels
        truckGfx.fillStyle(0x222222, 1);
        truckGfx.fillRect(tcx - tw / 2 - 3, tcy - th / 2 + 4, 4, 10);
        truckGfx.fillRect(tcx + tw / 2 - 1, tcy - th / 2 + 4, 4, 10);
        truckGfx.fillRect(tcx - tw / 2 - 3, tcy + th / 2 - 14, 4, 10);
        truckGfx.fillRect(tcx + tw / 2 - 1, tcy + th / 2 - 14, 4, 10);

        // Stats bars
        const stats = [
            { label: 'SPD', value: preset.topSpeed, max: 240 },
            { label: 'ACC', value: preset.acceleration, max: 180 },
            { label: 'HND', value: preset.handling, max: 4.0 },
            { label: 'NOS', value: preset.nitro, max: 8 },
        ];
        const barX = x + 15;
        const barW = w - 30;
        let barY = y + 100;

        for (const s of stats) {
            this.add.text(barX, barY, s.label, {
                fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
            });
            const fillGfx = this.add.graphics();
            fillGfx.fillStyle(0x444444, 1);
            fillGfx.fillRoundedRect(barX + 35, barY + 2, barW - 40, 10, 3);
            const pct = Math.min(s.value / s.max, 1);
            fillGfx.fillStyle(color, 1);
            fillGfx.fillRoundedRect(barX + 35, barY + 2, (barW - 40) * pct, 10, 3);
            barY += 20;
        }

        // Clickable zone
        const zone = this.add.zone(cx, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            gfx.clear();
            gfx.fillStyle(0x3a3a6e, 0.9);
            gfx.fillRoundedRect(x, y, w, h, 10);
            gfx.lineStyle(2, 0xffcc00, 1);
            gfx.strokeRoundedRect(x, y, w, h, 10);
        });
        zone.on('pointerout', () => {
            gfx.clear();
            gfx.fillStyle(0x2a2a4e, 0.9);
            gfx.fillRoundedRect(x, y, w, h, 10);
        });
        zone.on('pointerdown', () => {
            GameState.playerColor = color;
            this.scene.start('RaceScene');
        });
    }
}
