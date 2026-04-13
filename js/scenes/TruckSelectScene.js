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
        const colors = Object.keys(presets)
            .map(Number)
            .filter(c => GameState.isVehicleUnlocked(c))
            .sort((a, b) => {
                const pa = presets[a].price || 0;
                const pb = presets[b].price || 0;
                if (pa !== pb) return pa - pb;
                return presets[a].name.localeCompare(presets[b].name);
            });

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

        const cols = 4;
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

        this._drawVehiclePreview(cx, y + 65, preset, color, 1.45);

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

    _drawVehiclePreview(cx, cy, preset, color, scale = 1.0) {
        const gfx = this.add.graphics();

        if (preset.type === 'bike') {
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 2 * scale, cy - 14 * scale, 4 * scale, 7 * scale);
            gfx.fillRect(cx - 2 * scale, cy + 7 * scale, 4 * scale, 7 * scale);
            gfx.fillStyle(0x777777, 1);
            gfx.fillRect(cx - 1 * scale, cy - 12 * scale, 2 * scale, 3 * scale);
            gfx.fillRect(cx - 1 * scale, cy + 9 * scale, 2 * scale, 3 * scale);
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 4 * scale, cy - 8 * scale, 8 * scale, 16 * scale, 3 * scale);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 2 * scale, 6 * scale, 7 * scale, 2 * scale);
            gfx.fillStyle(0x555555, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 10 * scale, 6 * scale, 5 * scale, 2 * scale);
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 6 * scale, cy - 10 * scale, 3 * scale, 1 * scale);
            gfx.fillRect(cx + 3 * scale, cy - 10 * scale, 3 * scale, 1 * scale);
        } else if (preset.type === 'f1') {
            gfx.fillStyle(0x444444, 1);
            gfx.fillRect(cx - 7 * scale, cy - 15 * scale, 14 * scale, 2 * scale);
            gfx.fillRect(cx - 8 * scale, cy - 15 * scale, 1 * scale, 4 * scale);
            gfx.fillRect(cx + 7 * scale, cy - 15 * scale, 1 * scale, 4 * scale);

            gfx.fillStyle(color, 1);
            gfx.fillTriangle(cx, cy - 17 * scale, cx - 2 * scale, cy - 11 * scale, cx + 2 * scale, cy - 11 * scale);
            gfx.fillRect(cx - 1 * scale, cy - 11 * scale, 2 * scale, 5 * scale);

            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 8 * scale, cy - 11 * scale, 3 * scale, 6 * scale);
            gfx.fillRect(cx + 5 * scale, cy - 11 * scale, 3 * scale, 6 * scale);

            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 8 * scale, 6 * scale, 18 * scale, 2 * scale);
            gfx.fillRoundedRect(cx - 6 * scale, cy - 2 * scale, 3 * scale, 9 * scale, 1 * scale);
            gfx.fillRoundedRect(cx + 3 * scale, cy - 2 * scale, 3 * scale, 9 * scale, 1 * scale);

            gfx.fillStyle(0x1f1f1f, 0.95);
            gfx.fillRoundedRect(cx - 2 * scale, cy - 3 * scale, 4 * scale, 6 * scale, 2 * scale);
            gfx.fillStyle(0xf2f2f2, 1);
            gfx.fillCircle(cx, cy - 1 * scale, 1.7 * scale);

            gfx.fillStyle(color, 0.9);
            gfx.fillRoundedRect(cx - 4 * scale, cy + 4 * scale, 8 * scale, 6 * scale, 2 * scale);

            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 9 * scale, cy + 3 * scale, 4 * scale, 8 * scale);
            gfx.fillRect(cx + 5 * scale, cy + 3 * scale, 4 * scale, 8 * scale);

            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 8 * scale, cy + 11 * scale, 16 * scale, 2 * scale);
            gfx.fillRect(cx - 1 * scale, cy + 8 * scale, 2 * scale, 4 * scale);
            gfx.fillStyle(0x555555, 1);
            gfx.fillRect(cx - 3 * scale, cy + 9 * scale, 6 * scale, 2 * scale);
        } else if (preset.type === 'tank') {
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 9 * scale, cy - 11 * scale, 4 * scale, 22 * scale);
            gfx.fillRect(cx + 5 * scale, cy - 11 * scale, 4 * scale, 22 * scale);
            gfx.fillStyle(0x555555, 1);
            for (let k = 0; k < 4; k++) {
                gfx.fillRect(cx - 9 * scale, cy + (-9 + k * 5) * scale, 4 * scale, 2 * scale);
                gfx.fillRect(cx + 5 * scale, cy + (-9 + k * 5) * scale, 4 * scale, 2 * scale);
            }
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 5 * scale, cy - 10 * scale, 10 * scale, 20 * scale, 2);
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillCircle(cx, cy - 1 * scale, 6 * scale);
            gfx.fillStyle(color, 1);
            gfx.fillCircle(cx, cy - 1 * scale, 4 * scale);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRect(cx - 1 * scale, cy - 14 * scale, 2 * scale, 10 * scale);
        } else if (preset.type === 'jet') {
            gfx.fillStyle(0x2b2f39, 1);
            gfx.fillTriangle(cx, cy - 17 * scale, cx - 2 * scale, cy - 11 * scale, cx + 2 * scale, cy - 11 * scale);
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 11 * scale, 6 * scale, 24 * scale, 2 * scale);
            gfx.fillTriangle(cx, cy - 18 * scale, cx - 3 * scale, cy - 11 * scale, cx + 3 * scale, cy - 11 * scale);
            gfx.fillTriangle(cx - 12 * scale, cy - 2 * scale, cx - 3 * scale, cy - 6 * scale, cx - 3 * scale, cy + 5 * scale);
            gfx.fillTriangle(cx + 12 * scale, cy - 2 * scale, cx + 3 * scale, cy - 6 * scale, cx + 3 * scale, cy + 5 * scale);
            gfx.fillTriangle(cx - 7 * scale, cy + 11 * scale, cx - 2 * scale, cy + 6 * scale, cx - 2 * scale, cy + 15 * scale);
            gfx.fillTriangle(cx + 7 * scale, cy + 11 * scale, cx + 2 * scale, cy + 6 * scale, cx + 2 * scale, cy + 15 * scale);
            gfx.fillStyle(0x87d7ff, 0.95);
            gfx.fillRoundedRect(cx - 1.5 * scale, cy - 6 * scale, 3 * scale, 8 * scale, 1.5 * scale);
            gfx.fillStyle(0x1e232c, 1);
            gfx.fillRect(cx - 1 * scale, cy + 11 * scale, 2 * scale, 4 * scale);
            gfx.fillRect(cx - 2 * scale, cy + 6 * scale, 4 * scale, 2 * scale);
        } else {
            const tw = 26;
            const th = 42;
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 4);
            gfx.fillStyle(0x88ccff, 0.7);
            gfx.fillRect(cx - tw / 2 + 3, cy - th / 2 + 4, tw - 6, 8);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRect(cx - tw / 2 - 3, cy - th / 2 + 4, 4, 10);
            gfx.fillRect(cx + tw / 2 - 1, cy - th / 2 + 4, 4, 10);
            gfx.fillRect(cx - tw / 2 - 3, cy + th / 2 - 14, 4, 10);
            gfx.fillRect(cx + tw / 2 - 1, cy + th / 2 - 14, 4, 10);
        }

        return gfx;
    }
}
