// VehicleShopScene — Browse and choose vehicles in a dedicated shop

class VehicleShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VehicleShopScene' });
    }

    create() {
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        this.add.text(640, 40, 'VEHICLE SHOP', {
            fontSize: '32px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(640, 72, 'Choose your ride before you race', {
            fontSize: '12px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#cccccc'
        }).setOrigin(0.5);

        this.add.text(1260, 15, `$${GameState.money}`, {
            fontSize: '14px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0);

        const shopColor = 0x000000;
        const shopPreset = GameState.truckPresets[shopColor];
        const owned = GameState.isVehiclePurchased(shopColor);
        const cardW = 400;
        const cardH = 260;
        const cx = 640;
        const cy = 260;

        if (shopPreset) {
            this._drawVehicleCard({ color: shopColor, preset: shopPreset, owned }, cx, cy, cardW, cardH);
        }

        this.add.text(640, 700, 'ESC = Back', {
            fontSize: '10px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#666666'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-ESC', () => {
            this.scene.start(GameState.previousScene || 'TrackSelectScene');
        });
    }

    _drawVehicleCard(item, cx, cy, w, h) {
        const { color, preset, owned = false } = item;
        const gfx = this.add.graphics();
        gfx.fillStyle(0x2a2a4e, 0.9);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);

        this.add.text(cx, cy - h / 2 + 24, preset.name, {
            fontSize: '12px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);

        const previewY = cy - 14;
        this._drawVehiclePreview(cx, previewY, preset, color);

        const stats = [
            { label: 'SPD', value: preset.topSpeed, max: 240 },
            { label: 'ACC', value: preset.acceleration, max: 180 },
            { label: 'HND', value: preset.handling, max: 4.0 },
            { label: 'NOS', value: preset.nitro, max: 8 },
        ];
        let statX = cx - w / 2 + 20;
        for (const stat of stats) {
            const pct = Math.min(stat.value / stat.max, 1);
            const barW = 140;
            this.add.text(statX, cy + 20, stat.label, {
                fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#cccccc'
            });
            const bar = this.add.graphics();
            bar.fillStyle(0x444444, 1);
            bar.fillRoundedRect(statX + 28, cy + 22, barW, 8, 4);
            bar.fillStyle(color, 1);
            bar.fillRoundedRect(statX + 28, cy + 22, barW * pct, 8, 4);
            statX += 150;
        }

        const descText = preset.type === 'bike' ? 'Motorcycle' : 'Truck';
        this.add.text(cx, cy + 52, descText, {
            fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        if (!owned) {
            this.add.text(cx, cy + 72, `PRICE: $${preset.price}`, {
                fontSize: '14px', fontFamily: "'Press Start 2P', cursive",
                color: '#00ff88'
            }).setOrigin(0.5);
        } else {
            this.add.text(cx, cy + 72, 'OWNED', {
                fontSize: '16px', fontFamily: "'Press Start 2P', cursive",
                color: '#88ff88'
            }).setOrigin(0.5);
        }

        const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            gfx.clear();
            gfx.fillStyle(0x3a3a6e, 0.95);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
            gfx.lineStyle(2, 0xffcc00, 1);
            gfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
        });
        zone.on('pointerout', () => {
            gfx.clear();
            gfx.fillStyle(0x2a2a4e, 0.9);
            gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
        });
        zone.on('pointerdown', () => {
            if (!owned && preset.price && GameState.purchaseVehicle(color, preset.price)) {
                this.scene.restart();
                return;
            }

            if (!GameState.isVehicleUnlocked(color)) return;
            GameState.playerColor = color;
            const next = GameState.previousScene || 'TrackSelectScene';
            if (next === 'TrackSelectScene' && GameState.selectedTrack) {
                this.scene.start('RaceScene');
            } else {
                this.scene.start(next);
            }
        });
    }

    _drawVehiclePreview(cx, cy, preset, color) {
        const gfx = this.add.graphics();
        const isBike = preset.type === 'bike';
        const tw = isBike ? 20 : 26;
        const th = isBike ? 32 : 42;

        if (isBike) {
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 2, cy - 16, 4, 8);
            gfx.fillRect(cx - 2, cy + 8, 4, 8);
            gfx.fillStyle(0x777777, 1);
            gfx.fillRect(cx - 1, cy - 14, 2, 4);
            gfx.fillRect(cx - 1, cy + 10, 2, 4);
            gfx.fillStyle(0x000000, 1);
            gfx.fillRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 3);
            gfx.fillRoundedRect(cx - 6, cy - 8, 12, 16, 5);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRoundedRect(cx - 5, cy - 12, 10, 6, 3);
            gfx.fillStyle(0x555555, 1);
            gfx.fillRoundedRect(cx - 3, cy - 2, 6, 8, 3);
            gfx.fillStyle(0x222222, 0.7);
            gfx.fillRoundedRect(cx - 3, cy - 12, 6, 4, 2);
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 7, cy - 12, 3, 1);
            gfx.fillRect(cx + 4, cy - 12, 3, 1);
            gfx.fillRect(cx - 6, cy - 12, 1, 4);
            gfx.fillRect(cx + 5, cy - 12, 1, 4);
        } else {
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
    }
}
