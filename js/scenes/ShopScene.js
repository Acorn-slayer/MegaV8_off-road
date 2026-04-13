// ShopScene - Garage: owned vehicle selector plus per-vehicle upgrades.

class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        const ownedColors = Object.keys(GameState.purchasedVehicles)
            .map(Number)
            .filter(color => GameState.purchasedVehicles[color]);

        this._selectedColor = GameState.isVehicleUnlocked(GameState.playerColor)
            ? GameState.playerColor
            : (ownedColors[0] || null);

        this._buildUI();
    }

    _buildUI() {
        if (this._uiContainer) this._uiContainer.destroy();

        const items = [];
        this._uiContainer = this.add.container(0, 0);

        items.push(this.add.text(640, 18, 'GARAGE', {
            fontSize: '28px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5));

        items.push(this.add.text(640, 50, `Race ${GameState.raceNumber} Complete`, {
            fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#888888'
        }).setOrigin(0.5));

        this.moneyLabel = this.add.text(640, 72, `$${GameState.money}`, {
            fontSize: '20px', fontFamily: 'Arial, sans-serif',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);
        items.push(this.moneyLabel);

        items.push(this.add.text(30, 98, 'MY VEHICLES', {
            fontSize: '11px', fontFamily: "'Press Start 2P', cursive", color: '#aaaaaa'
        }));

        const owned = Object.keys(GameState.purchasedVehicles)
            .map(Number)
            .filter(color => GameState.purchasedVehicles[color])
            .sort((a, b) => {
                const pa = (GameState.truckPresets[a] && GameState.truckPresets[a].price) || 0;
                const pb = (GameState.truckPresets[b] && GameState.truckPresets[b].price) || 0;
                if (pa !== pb) return pa - pb;
                const na = (GameState.truckPresets[a] && GameState.truckPresets[a].name) || '';
                const nb = (GameState.truckPresets[b] && GameState.truckPresets[b].name) || '';
                return na.localeCompare(nb);
            });
        const cardW = 140;
        const cardH = 110;
        const gap = 10;
        const cols = 3;
        const panelX = 20;
        const panelY = 115;

        for (let index = 0; index < owned.length; index++) {
            const color = owned[index];
            const col = index % cols;
            const row = Math.floor(index / cols);
            const cx = panelX + col * (cardW + gap) + cardW / 2;
            const cy = panelY + row * (cardH + gap);
            this._drawVehicleCard(cx, cy, cardW, cardH, color, items);
        }

        this._drawUpgradePanel(items);
        this._drawBottomButtons(items);

        this._cheatSeq = [];
        this.input.keyboard.removeAllListeners('keydown');
        this.input.keyboard.on('keydown', (event) => {
            if (event.key === 'ArrowUp') this._cheatSeq.push('U');
            else if (event.key === 'ArrowDown') this._cheatSeq.push('D');
            else {
                this._cheatSeq = [];
                return;
            }

            if (this._cheatSeq.length > 13) this._cheatSeq.shift();
            if (this._cheatSeq.slice(-13).join('') !== 'UUUUUUUUUUDDD') return;

            GameState.money += 100;
            this._cheatSeq = [];
            const flash = this.add.text(640, 68, '+$100', {
                fontSize: '18px', fontFamily: "'Press Start 2P', cursive",
                color: '#00ff88', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(200);
            this.tweens.add({
                targets: flash,
                alpha: 0,
                y: 48,
                duration: 800,
                ease: 'Power2',
                onComplete: () => {
                    flash.destroy();
                    this._rebuildUI();
                }
            });
        });

        this._uiContainer.add(items);
    }

    _rebuildUI() {
        if (this._uiContainer) this._uiContainer.destroy();
        this._buildUI();
    }

    _drawVehicleCard(cx, cy, width, height, color, items) {
        const preset = GameState.truckPresets[color];
        if (!preset) return;

        const isSelected = color === this._selectedColor;
        const bg = this.add.graphics();
        bg.fillStyle(isSelected ? 0x2a4a7a : 0x1e1e3e, 1);
        bg.fillRoundedRect(cx - width / 2, cy, width, height, 8);
        if (isSelected) {
            bg.lineStyle(3, 0xffcc00, 1);
            bg.strokeRoundedRect(cx - width / 2, cy, width, height, 8);
        }
        items.push(bg);

        items.push(this.add.text(cx, cy + 12, preset.name, {
            fontSize: '9px', fontFamily: "'Press Start 2P', cursive", color: '#ffffff'
        }).setOrigin(0.5));

        items.push(this._miniPreview(cx, cy + 55, color, preset));

        const upgrades = GameState.getVehicleUpgrades(color);
        const totalLevel = upgrades.topSpeed + upgrades.acceleration + upgrades.handling + upgrades.nitro;
        items.push(this.add.text(cx, cy + height - 12, totalLevel > 0 ? `UP ${totalLevel}` : 'STOCK', {
            fontSize: '8px', fontFamily: 'Arial, sans-serif',
            color: totalLevel > 0 ? '#ffcc00' : '#666666'
        }).setOrigin(0.5));

        const zone = this.add.zone(cx, cy + height / 2, width, height).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            this._selectedColor = color;
            GameState.playerColor = color;
            this._rebuildUI();
        });
        items.push(zone);
    }

    _miniPreview(cx, cy, color, preset) {
        const gfx = this.add.graphics();
        const type = preset.type || 'truck';

        if (type === 'bike') {
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 3, cy - 13, 6, 7);
            gfx.fillRect(cx - 3, cy + 6, 6, 7);
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 5, cy - 7, 10, 14, 3);
        } else if (type === 'f1') {
            gfx.fillStyle(0x444444, 1);
            gfx.fillRect(cx - 7, cy - 14, 14, 2);
            gfx.fillRect(cx - 8, cy - 14, 1, 3);
            gfx.fillRect(cx + 7, cy - 14, 1, 3);
            gfx.fillStyle(color, 1);
            gfx.fillTriangle(cx, cy - 16, cx - 2, cy - 10, cx + 2, cy - 10);
            gfx.fillRect(cx - 1, cy - 10, 2, 4);
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 8, cy - 10, 3, 5);
            gfx.fillRect(cx + 5, cy - 10, 3, 5);
            gfx.fillRoundedRect(cx - 3, cy - 7, 6, 16, 2);
            gfx.fillRect(cx - 6, cy - 1, 3, 8);
            gfx.fillRect(cx + 3, cy - 1, 3, 8);
            gfx.fillStyle(0x1f1f1f, 1);
            gfx.fillRoundedRect(cx - 2, cy - 2, 4, 5, 2);
            gfx.fillStyle(0xf2f2f2, 1);
            gfx.fillCircle(cx, cy, 1);
            gfx.fillStyle(color, 0.9);
            gfx.fillRoundedRect(cx - 4, cy + 4, 8, 5, 2);
            gfx.fillStyle(0x111111, 1);
            gfx.fillRect(cx - 9, cy + 3, 4, 7);
            gfx.fillRect(cx + 5, cy + 3, 4, 7);
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 8, cy + 10, 16, 2);
        } else if (type === 'tank') {
            gfx.fillStyle(0x333333, 1);
            gfx.fillRect(cx - 9, cy - 10, 4, 20);
            gfx.fillRect(cx + 5, cy - 10, 4, 20);
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 5, cy - 9, 10, 18, 1);
            gfx.fillCircle(cx, cy, 4);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRect(cx - 1, cy - 12, 2, 9);
        } else {
            gfx.fillStyle(color, 1);
            gfx.fillRoundedRect(cx - 6, cy - 11, 12, 22, 3);
            gfx.fillStyle(0x88ccff, 0.7);
            gfx.fillRect(cx - 4, cy - 7, 8, 5);
            gfx.fillStyle(0x222222, 1);
            gfx.fillRect(cx - 8, cy - 7, 3, 6);
            gfx.fillRect(cx + 5, cy - 7, 3, 6);
            gfx.fillRect(cx - 8, cy + 3, 3, 6);
            gfx.fillRect(cx + 5, cy + 3, 3, 6);
        }

        return gfx;
    }

    _drawUpgradePanel(items) {
        const color = this._selectedColor;
        const panelX = 490;
        const panelY = 95;

        if (!color) {
            items.push(this.add.text(panelX + 300, 360, 'No vehicle selected.\nVisit the Vehicle Shop to buy one.', {
                fontSize: '16px', fontFamily: 'Arial, sans-serif', color: '#888888', align: 'center'
            }).setOrigin(0.5));
            return;
        }

        const preset = GameState.truckPresets[color];
        items.push(this.add.text(panelX + 10, panelY, `UPGRADES - ${preset.name}`, {
            fontSize: '13px', fontFamily: "'Press Start 2P', cursive", color: '#ffcc00'
        }));

        const statDefs = [
            { key: 'topSpeed', label: 'Top Speed', barColor: '#ff6666' },
            { key: 'acceleration', label: 'Acceleration', barColor: '#66ff66' },
            { key: 'handling', label: 'Handling', barColor: '#6699ff' },
            { key: 'nitro', label: 'Nitro', barColor: '#00ccff' },
        ];
        const rowHeight = 100;
        const startY = panelY + 35;

        for (let index = 0; index < statDefs.length; index++) {
            this._drawUpgradeRow(statDefs[index], startY + index * rowHeight, color, panelX, items);
        }

        const stats = GameState.getPlayerStats();
        items.push(this.add.text(panelX + 10, startY + statDefs.length * rowHeight,
            `Stats: SPD ${stats.topSpeed} | ACC ${stats.acceleration} | HND ${stats.handling.toFixed(1)} | NOS ${stats.nitroMax}`,
            { fontSize: '11px', fontFamily: 'Arial, sans-serif', color: '#888888' }
        ));
    }

    _drawUpgradeRow(stat, y, color, panelX, items) {
        const upgrades = GameState.getVehicleUpgrades(color);
        const level = upgrades[stat.key] || 0;
        const maxed = level >= GameState.maxLevel;
        const cost = GameState.getCost(color, stat.key);
        const canAfford = GameState.money >= cost;

        const rowBg = this.add.graphics();
        rowBg.fillStyle(0x2a2a4e, 0.8);
        rowBg.fillRoundedRect(panelX, y, 760, 88, 8);
        items.push(rowBg);

        items.push(this.add.text(panelX + 16, y + 10, stat.label, {
            fontSize: '18px', fontFamily: 'Arial, sans-serif', color: stat.barColor,
            stroke: '#000000', strokeThickness: 3
        }));

        for (let pipIndex = 0; pipIndex < GameState.maxLevel; pipIndex++) {
            const pip = this.add.graphics();
            pip.fillStyle(
                pipIndex < level ? Phaser.Display.Color.HexStringToColor(stat.barColor).color : 0x444444,
                1
            );
            pip.fillRoundedRect(panelX + 16 + pipIndex * 19, y + 46, 15, 12, 3);
            items.push(pip);
        }

        items.push(this.add.text(panelX + 215, y + 46, `Lv ${level}/${GameState.maxLevel}`, {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#cccccc'
        }));

        const stats = GameState.getPlayerStats();
        const valueMap = {
            topSpeed: `${stats.topSpeed} mph`,
            acceleration: `${stats.acceleration}`,
            handling: `${stats.handling.toFixed(2)}`,
            nitro: `${stats.nitroMax} tanks`,
        };
        items.push(this.add.text(panelX + 300, y + 46, valueMap[stat.key], {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#999999'
        }));

        if (maxed) {
            items.push(this.add.text(panelX + 650, y + 44, 'MAXED', {
                fontSize: '16px', fontFamily: 'Arial Black, Arial, sans-serif', color: '#888888'
            }).setOrigin(0.5));
            return;
        }

        const buttonColor = canAfford ? 0xcc8800 : 0x555555;
        const buttonX = panelX + 585;
        const button = this.add.graphics();
        button.fillStyle(buttonColor, 1);
        button.fillRoundedRect(buttonX, y + 16, 160, 56, 8);
        items.push(button);

        items.push(this.add.text(buttonX + 80, y + 32, `$${cost}`, {
            fontSize: '17px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: canAfford ? '#ffffff' : '#777777',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5));
        items.push(this.add.text(buttonX + 80, y + 54, 'UPGRADE', {
            fontSize: '10px', fontFamily: 'Arial, sans-serif',
            color: canAfford ? '#ffcc00' : '#555555'
        }).setOrigin(0.5));

        if (!canAfford) return;

        const zone = this.add.zone(buttonX + 80, y + 44, 160, 56).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
            if (GameState.buyUpgrade(color, stat.key)) this._rebuildUI();
        });
        zone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0xeeaa00, 1);
            button.fillRoundedRect(buttonX, y + 16, 160, 56, 8);
        });
        zone.on('pointerout', () => {
            button.clear();
            button.fillStyle(buttonColor, 1);
            button.fillRoundedRect(buttonX, y + 16, 160, 56, 8);
        });
        items.push(zone);
    }

    _drawBottomButtons(items) {
        const isSingle = GameState.gameMode !== 'championship';
        const isChampGarage = GameState._champReturnToResults;
        GameState._champReturnToResults = false;

        const shopBg = this.add.graphics();
        shopBg.fillStyle(0x884400, 1);
        shopBg.fillRoundedRect(310, 655, 260, 48, 10);
        items.push(shopBg);
        items.push(this.add.text(440, 679, 'VEHICLE SHOP', {
            fontSize: '12px', fontFamily: "'Press Start 2P', cursive", color: '#ffcc00'
        }).setOrigin(0.5));

        const shopZone = this.add.zone(440, 679, 260, 48).setInteractive({ useHandCursor: true });
        shopZone.on('pointerover', () => {
            shopBg.clear();
            shopBg.fillStyle(0xaa5500, 1);
            shopBg.fillRoundedRect(310, 655, 260, 48, 10);
            shopBg.lineStyle(2, 0xffcc00, 1);
            shopBg.strokeRoundedRect(310, 655, 260, 48, 10);
        });
        shopZone.on('pointerout', () => {
            shopBg.clear();
            shopBg.fillStyle(0x884400, 1);
            shopBg.fillRoundedRect(310, 655, 260, 48, 10);
        });
        shopZone.on('pointerdown', () => {
            GameState.previousScene = 'ShopScene';
            this.scene.start('VehicleShopScene');
        });
        items.push(shopZone);

        const nextLabel = isChampGarage ? 'DONE' : (isSingle ? 'BACK TO TRACKS' : 'NEXT RACE');
        const nextBg = this.add.graphics();
        nextBg.fillStyle(0x33aa33, 1);
        nextBg.fillRoundedRect(710, 655, 260, 48, 10);
        items.push(nextBg);
        items.push(this.add.text(840, 679, nextLabel, {
            fontSize: '14px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5));

        const nextZone = this.add.zone(840, 679, 260, 48).setInteractive({ useHandCursor: true });
        nextZone.on('pointerover', () => {
            nextBg.clear();
            nextBg.fillStyle(0x44cc44, 1);
            nextBg.fillRoundedRect(710, 655, 260, 48, 10);
        });
        nextZone.on('pointerout', () => {
            nextBg.clear();
            nextBg.fillStyle(0x33aa33, 1);
            nextBg.fillRoundedRect(710, 655, 260, 48, 10);
        });
        nextZone.on('pointerdown', () => {
            if (isChampGarage || isSingle) {
                this.scene.start('TrackSelectScene');
                return;
            }

            const idx = GameState.championshipRaceIndex;
            const order = GameState.championshipOrder || [];
            const trackIdx = order[idx] !== undefined ? order[idx] : idx;
            if (trackIdx < GameState.tracks.length) {
                GameState.selectedTrack = GameState.tracks[trackIdx];
            }
            this.scene.start('RaceScene');
        });
        items.push(nextZone);
    }
}
