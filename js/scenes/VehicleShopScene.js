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

        this.add.text(640, 52, 'Each vehicle costs $5 000. You start with $5 000 — buy your first one!', {
            fontSize: '10px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        this.moneyText = this.add.text(1260, 12, `💰 $${GameState.money}`, {
            fontSize: '14px', fontFamily: "'Press Start 2P', cursive",
            color: '#00ff88', stroke: '#000000', strokeThickness: 3
        }).setOrigin(1, 0);

        // All vehicles in a 3-column grid
        const allItems = Object.entries(GameState.truckPresets).map(([key, preset]) => ({
            color: Number(key), preset, owned: GameState.isVehicleUnlocked(Number(key))
        }));

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
