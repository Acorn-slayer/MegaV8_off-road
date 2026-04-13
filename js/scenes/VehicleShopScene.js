// VehicleShopScene — Buy vehicles ($5 000 each). Shows all vehicles in a grid.

class VehicleShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VehicleShopScene' });
    }

    create() {
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        this.add.text(640, 22, 'VEHICLE SHOP', {
            fontSize: '26px', fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(640, 52, 'Regular trucks: $5 000. Specials: bike $10k, F1 $20k, tank $30k.', {
            fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        this.moneyText = this.add.text(1260, 12, `💰 $${GameState.money}`, {
            fontSize: '14px', fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88', stroke: '#000000', strokeThickness: 3
        }).setOrigin(1, 0);

        // All vehicles in a 3-column grid
        const allItems = Object.entries(GameState.truckPresets).map(([key, preset]) => ({
            color: Number(key), preset, owned: GameState.isVehicleUnlocked(Number(key))
        })).sort((a, b) => {
            const pa = a.preset.price || 0;
            const pb = b.preset.price || 0;
            if (pa !== pb) return pa - pb;
            return a.preset.name.localeCompare(b.preset.name);
        });

        const cols = 3;
        const cardW = 235, cardH = 195, gapX = 18, gapY = 14;
        const totalW = cols * cardW + (cols - 1) * gapX;
        const startX = (1280 - totalW) / 2;
        const startY = 70;

        for (let i = 0; i < allItems.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);
            this._drawVehicleCard(allItems[i], x, y, cardW, cardH);
        }

        // Back button (visible alternative to ESC)
        const backBg = this.add.graphics();
        backBg.fillStyle(0x0f3460, 1);
        backBg.fillRoundedRect(500, 674, 280, 28, 8);
        const backLabel = this.add.text(640, 688, '◄ BACK TO RACE MENU', {
            fontSize: '10px', fontFamily: "'Press Start 2P', cursive", color: '#ffffff'
        }).setOrigin(0.5);
        const backZone = this.add.zone(640, 688, 280, 28).setInteractive({ useHandCursor: true });
        backZone.on('pointerover', () => {
            backBg.clear();
            backBg.fillStyle(0x1a5276, 1);
            backBg.fillRoundedRect(500, 674, 280, 28, 8);
        });
        backZone.on('pointerout', () => {
            backBg.clear();
            backBg.fillStyle(0x0f3460, 1);
            backBg.fillRoundedRect(500, 674, 280, 28, 8);
        });
        backZone.on('pointerdown', () => {
            this.scene.start(GameState.previousScene || 'ShopScene');
        });

        this.add.text(640, 706, 'ESC = Back', {
            fontSize: '9px', fontFamily: "'Press Start 2P', cursive", color: '#555555'
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start(GameState.previousScene || 'ShopScene');
        });
    }

    // x,y = top-left corner of the card (not center)
    _drawVehicleCard(item, x, y, w, h) {
        const { color, preset, owned = false } = item;
        const cx = x + w / 2;
        const canAfford = GameState.money >= (preset.price || 5000);

        const bg = this.add.graphics();
        const bgFill = owned ? 0x1a3a1a : (canAfford ? 0x2a2a4e : 0x2a1a1a);
        bg.fillStyle(bgFill, 0.95);
        bg.fillRoundedRect(x, y, w, h, 8);
        if (owned) {
            bg.lineStyle(2, 0x00ff88, 1);
            bg.strokeRoundedRect(x, y, w, h, 8);
        }

        // Name
        this.add.text(cx, y + 14, preset.name, {
            fontSize: '10px', fontFamily: "'Press Start 2P', cursive", color: '#ffffff'
        }).setOrigin(0.5);

        // Mini preview (scale 1.6)
        this._drawVehiclePreview(cx, y + 58, preset, color, 1.6);

        // Stat bars (compact — 2 rows of 2)
        const statDefs = [
            { label: 'SPD', value: preset.topSpeed, max: 260 },
            { label: 'ACC', value: preset.acceleration, max: 180 },
            { label: 'HND', value: preset.handling, max: 4.5 },
            { label: 'NOS', value: preset.nitro, max: 8 },
        ];
        const barW = 78, barH = 7;
        for (let si = 0; si < 4; si++) {
            const s = statDefs[si];
            const col = si % 2, row = Math.floor(si / 2);
            const bx = x + 10 + col * (w / 2);
            const by = y + 102 + row * 20;
            this.add.text(bx, by, s.label, {
                fontSize: '8px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
            });
            const fillG = this.add.graphics();
            fillG.fillStyle(0x444444, 1);
            fillG.fillRoundedRect(bx + 24, by + 1, barW, barH, 3);
            fillG.fillStyle(color || 0x888888, 1);
            fillG.fillRoundedRect(bx + 24, by + 1, barW * Math.min(s.value / s.max, 1), barH, 3);
        }

        // Type label
        const typeLabel = preset.type === 'bike' ? 'Motorcycle' : preset.type === 'f1' ? 'F1 Car' : preset.type === 'tank' ? 'Battle Tank' : 'Truck';
        this.add.text(cx, y + 148, typeLabel, {
            fontSize: '9px', fontFamily: 'Arial, sans-serif', color: '#888888'
        }).setOrigin(0.5);

        // Price / owned badge
        if (owned) {
            this.add.text(cx, y + h - 18, '✔ OWNED', {
                fontSize: '10px', fontFamily: "'Press Start 2P', cursive", color: '#00ff88'
            }).setOrigin(0.5);
        } else {
            const priceColor = canAfford ? '#00ff88' : '#ff6666';
            this.add.text(cx, y + h - 18, `$${(preset.price || 5000).toLocaleString()}`, {
                fontSize: '11px', fontFamily: "'Press Start 2P', cursive", color: priceColor
            }).setOrigin(0.5);
        }

        const zone = this.add.zone(cx, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(owned ? 0x2a5a2a : (canAfford ? 0x3a3a6e : 0x3a1a1a), 0.95);
            bg.fillRoundedRect(x, y, w, h, 8);
            bg.lineStyle(2, owned ? 0x00ff88 : 0xffcc00, 1);
            bg.strokeRoundedRect(x, y, w, h, 8);
        });
        zone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(bgFill, 0.95);
            bg.fillRoundedRect(x, y, w, h, 8);
            if (owned) { bg.lineStyle(2, 0x00ff88, 1); bg.strokeRoundedRect(x, y, w, h, 8); }
        });
        zone.on('pointerdown', () => {
            if (!owned) {
                if (!canAfford) return;
                if (GameState.purchaseVehicle(color, preset.price || 5000)) {
                    this.scene.restart();
                }
                return;
            }
            // Already owned: just select it and return
            GameState.playerColor = color;
            this.scene.start(GameState.previousScene || 'ShopScene');
        });
    }

    _drawVehiclePreview(cx, cy, preset, color, scale = 2.0) {
        const gfx = this.add.graphics();

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
