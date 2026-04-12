// VehicleShopScene ΓÇö Browse and choose vehicles in a dedicated shop

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

        // Collect all shop-only vehicles
        const shopItems = [];
        for (const [colorKey, preset] of Object.entries(GameState.truckPresets)) {
            if (preset.shopOnly) {
                shopItems.push({ color: Number(colorKey), preset, owned: GameState.isVehiclePurchased(Number(colorKey)) });
            }
        }

        const cardW = 360;
        const cardH = 280;
        const gap = 30;
        const totalW = shopItems.length * cardW + (shopItems.length - 1) * gap;
        const startX = (1280 - totalW) / 2 + cardW / 2;
        const cy = 280;

        for (let i = 0; i < shopItems.length; i++) {
            const item = shopItems[i];
            this._drawVehicleCard(item, startX + i * (cardW + gap), cy, cardW, cardH);
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

        const descText = preset.type === 'bike' ? 'Motorcycle' : preset.type === 'f1' ? 'Formula 1 Car' : preset.type === 'tank' ? 'Battle Tank' : 'Truck';
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
        const scale = 2.5; // larger preview in shop

        if (preset.type === 'bike') {
            // Wheels
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 2 * scale, cy - 14 * scale, 4 * scale, 7 * scale);
            gfx.fillRect(cx - 2 * scale, cy + 7 * scale, 4 * scale, 7 * scale);
            gfx.fillStyle(0x777777, 1);
            gfx.fillRect(cx - 1 * scale, cy - 12 * scale, 2 * scale, 3 * scale);
            gfx.fillRect(cx - 1 * scale, cy + 9 * scale, 2 * scale, 3 * scale);
            // Body
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 4 * scale, cy - 8 * scale, 8 * scale, 16 * scale, 3 * scale);
            // Seat
            gfx.fillStyle(0x222222, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 2 * scale, 6 * scale, 7 * scale, 2 * scale);
            // Windshield
            gfx.fillStyle(0x555555, 1);
            gfx.fillRoundedRect(cx - 3 * scale, cy - 10 * scale, 6 * scale, 5 * scale, 2 * scale);
            // Handlebars
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 6 * scale, cy - 10 * scale, 3 * scale, 1 * scale);
            gfx.fillRect(cx + 3 * scale, cy - 10 * scale, 3 * scale, 1 * scale);
        } else if (preset.type === 'f1') {
            // Rear wing
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 7 * scale, cy + 7 * scale, 14 * scale, 2 * scale);
            gfx.fillRect(cx - 1 * scale, cy + 5 * scale, 2 * scale, 4 * scale);
            // Body
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 4 * scale, cy - 12 * scale, 8 * scale, 24 * scale, 3 * scale);
            // Nose cone
            gfx.fillTriangle(cx, cy - 16 * scale, cx - 3 * scale, cy - 12 * scale, cx + 3 * scale, cy - 12 * scale);
            // Cockpit
            gfx.fillStyle(0x222222, 0.9);
            gfx.fillRoundedRect(cx - 2 * scale, cy - 5 * scale, 4 * scale, 5 * scale, 2 * scale);
            // Helmet
            gfx.fillStyle(0xeeeeee, 1);
            gfx.fillCircle(cx, cy - 3 * scale, 2 * scale);
            // Front wing
            gfx.fillStyle(0x444444, 1);
            gfx.fillRect(cx - 6 * scale, cy - 13 * scale, 12 * scale, 2 * scale);
            // Front wheels
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 8 * scale, cy - 11 * scale, 3 * scale, 5 * scale);
            gfx.fillRect(cx + 5 * scale, cy - 11 * scale, 3 * scale, 5 * scale);
            // Rear wheels
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 9 * scale, cy + 2 * scale, 4 * scale, 6 * scale);
            gfx.fillRect(cx + 5 * scale, cy + 2 * scale, 4 * scale, 6 * scale);
            // Side pods
            gfx.fillStyle(color, 0.8);
            gfx.fillRect(cx - 6 * scale, cy - 3 * scale, 2 * scale, 8 * scale);
            gfx.fillRect(cx + 4 * scale, cy - 3 * scale, 2 * scale, 8 * scale);
        } else if (preset.type === 'tank') {
            // Treads
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 9 * scale, cy - 11 * scale, 4 * scale, 22 * scale);
            gfx.fillRect(cx + 5 * scale, cy - 11 * scale, 4 * scale, 22 * scale);
            // Tread links
            gfx.fillStyle(0x555555, 1);
            for (let k = 0; k < 4; k++) {
                gfx.fillRect(cx - 9 * scale, cy + (-9 + k * 5) * scale, 4 * scale, 2 * scale);
                gfx.fillRect(cx + 5 * scale, cy + (-9 + k * 5) * scale, 4 * scale, 2 * scale);
            }
            // Hull
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 5 * scale, cy - 10 * scale, 10 * scale, 20 * scale, 2);
            // Turret shadow
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillCircle(cx, cy - 1 * scale, 6 * scale);
            // Turret
            gfx.fillStyle(color, 1);
            gfx.fillCircle(cx, cy - 1 * scale, 4 * scale);
            // Barrel
            gfx.fillStyle(0x222222, 1);
            gfx.fillRect(cx - 1 * scale, cy - 14 * scale, 2 * scale, 10 * scale);
        } else {
            const tw = 26, th = 42;
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
