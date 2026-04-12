// ShopScene — Between-race upgrade shop

class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        // Background
        this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, 1280, 720);

        // Title
        this.add.text(640, 30, 'UPGRADE SHOP', {
            fontSize: '36px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        // Race number
        this.add.text(640, 70, `Race ${GameState.raceNumber} Complete — Next Race: ${GameState.raceNumber + 1}`, {
            fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
        }).setOrigin(0.5);

        // Money display
        this.moneyText = this.add.text(640, 105, '', {
            fontSize: '24px', fontFamily: 'Arial, sans-serif',
            color: '#ffcc00', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.updateMoneyText();

        // Upgrade buttons
        this.buttons = [];
        const stats = [
            { key: 'topSpeed',     label: 'Top Speed',     icon: '🏎️', color: '#ff6666' },
            { key: 'acceleration', label: 'Acceleration',  icon: '⚡', color: '#66ff66' },
            { key: 'handling',     label: 'Handling',       icon: '🔄', color: '#6699ff' },
            { key: 'nitro',        label: 'Nitro Capacity', icon: '🔥', color: '#00ccff' },
        ];

        const startY = 160;
        const rowH = 95;

        for (let i = 0; i < stats.length; i++) {
            this.createUpgradeRow(stats[i], startY + i * rowH);
        }

        // Player stats preview
        this.statsText = this.add.text(640, 665, '', {
            fontSize: '12px', fontFamily: 'Arial, sans-serif', color: '#888888'
        }).setOrigin(0.5);
        this.updateStatsPreview();

        // ── Cheat code: ↑×10 then ↓×3 = +$100 ────────────────
        this._cheatSeq = [];  // track arrow key sequence
        this.input.keyboard.on('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                this._cheatSeq.push('U');
            } else if (e.key === 'ArrowDown') {
                this._cheatSeq.push('D');
            } else {
                this._cheatSeq = [];
                return;
            }
            // Keep only last 13 keys
            if (this._cheatSeq.length > 13) this._cheatSeq.shift();
            // Check for 10 ups then 3 downs
            if (this._cheatSeq.length >= 13) {
                const seq = this._cheatSeq.slice(-13).join('');
                if (seq === 'UUUUUUUUUUDDD') {
                    GameState.money += 100;
                    this._cheatSeq = [];
                    // Flash feedback then refresh
                    const flash = this.add.text(640, 140, '💰 +$100!', {
                        fontSize: '20px', fontFamily: "'Press Start 2P', cursive",
                        color: '#00ff88', stroke: '#000000', strokeThickness: 4
                    }).setOrigin(0.5).setDepth(100);
                    this.tweens.add({
                        targets: flash, alpha: 0, y: 110,
                        duration: 800, ease: 'Power2',
                        onComplete: () => this.scene.restart()
                    });
                    this._cheatSeq = [];
                }
            }
        });

        // "Next Race" button
        const nextBtn = this.add.graphics();
        nextBtn.fillStyle(0x33aa33, 1);
        nextBtn.fillRoundedRect(540, 590, 200, 50, 10);
        nextBtn.setDepth(10);

        const isSingle = GameState.gameMode === 'single' || GameState.gameMode !== 'championship';
        const isChampGarage = GameState._champReturnToResults;
        GameState._champReturnToResults = false;
        const btnLabel = isChampGarage ? '◄ DONE' : (isSingle ? '◄ BACK TO TRACKS' : 'NEXT RACE ►');

        this.add.text(640, 615, btnLabel, {
            fontSize: '22px', fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(11);

        const nextZone = this.add.zone(640, 615, 200, 50).setInteractive().setDepth(12);
        nextZone.on('pointerdown', () => {
            if (isChampGarage) {
                // Return to track select — championship state preserved
                this.scene.start('TrackSelectScene');
            } else if (isSingle) {
                this.scene.start('TrackSelectScene');
            } else {
                // Set the next championship track
                const idx = GameState.championshipRaceIndex;
                const order = GameState.championshipOrder || [];
                const trackIdx = order[idx] !== undefined ? order[idx] : idx;
                if (trackIdx < GameState.tracks.length) {
                    GameState.selectedTrack = GameState.tracks[trackIdx];
                }
                this.scene.start('RaceScene');
            }
        });

        // Hover effect
        nextZone.on('pointerover', () => nextBtn.clear().fillStyle(0x44cc44, 1).fillRoundedRect(540, 590, 200, 50, 10));
        nextZone.on('pointerout', () => nextBtn.clear().fillStyle(0x33aa33, 1).fillRoundedRect(540, 590, 200, 50, 10));
    }

    createUpgradeRow(stat, y) {
        const level = GameState.upgrades[stat.key];
        const maxed = level >= GameState.maxLevel;
        const cost = GameState.getCost(stat.key);
        const canAfford = GameState.money >= cost;

        // Row background
        const rowBg = this.add.graphics();
        rowBg.fillStyle(0x2a2a4e, 0.8);
        rowBg.fillRoundedRect(300, y, 680, 80, 8);

        // Icon + label
        this.add.text(330, y + 12, `${stat.icon} ${stat.label}`, {
            fontSize: '20px', fontFamily: 'Arial, sans-serif', color: stat.color,
            stroke: '#000000', strokeThickness: 3
        });

        // Level pips (10 levels, smaller to fit)
        const pipsX = 330;
        const pipsY = y + 48;
        for (let i = 0; i < GameState.maxLevel; i++) {
            const pip = this.add.graphics();
            if (i < level) {
                pip.fillStyle(Phaser.Display.Color.HexStringToColor(stat.color).color, 1);
            } else {
                pip.fillStyle(0x444444, 1);
            }
            pip.fillRoundedRect(pipsX + i * 18, pipsY, 14, 12, 3);
        }

        // Level text
        this.add.text(520, y + 48, `Lv ${level}/${GameState.maxLevel}`, {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#cccccc'
        });

        // Current value
        const stats = GameState.getPlayerStats();
        const valMap = {
            topSpeed: `${stats.topSpeed} mph`,
            acceleration: `${stats.acceleration}`,
            handling: `${stats.handling.toFixed(2)}`,
            nitro: `${stats.nitroMax} tanks`,
        };
        this.add.text(620, y + 48, valMap[stat.key], {
            fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#999999'
        });

        // Buy button
        if (maxed) {
            this.add.text(890, y + 30, 'MAXED', {
                fontSize: '18px', fontFamily: 'Arial Black, Arial, sans-serif',
                color: '#888888'
            }).setOrigin(0.5);
        } else {
            const btnColor = canAfford ? 0xcc8800 : 0x555555;
            const btn = this.add.graphics();
            btn.fillStyle(btnColor, 1);
            btn.fillRoundedRect(820, y + 12, 140, 55, 8);

            const btnText = this.add.text(890, y + 28, `$${cost}`, {
                fontSize: '18px', fontFamily: 'Arial Black, Arial, sans-serif',
                color: canAfford ? '#ffffff' : '#777777',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);

            this.add.text(890, y + 50, 'UPGRADE', {
                fontSize: '11px', fontFamily: 'Arial, sans-serif',
                color: canAfford ? '#ffcc00' : '#555555'
            }).setOrigin(0.5);

            if (canAfford) {
                const zone = this.add.zone(890, y + 39, 140, 55).setInteractive();
                zone.on('pointerdown', () => {
                    if (GameState.buyUpgrade(stat.key)) {
                        // Refresh the shop
                        this.scene.restart();
                    }
                });
                zone.on('pointerover', () => {
                    btn.clear().fillStyle(0xeeaa00, 1).fillRoundedRect(820, y + 12, 140, 55, 8);
                });
                zone.on('pointerout', () => {
                    btn.clear().fillStyle(btnColor, 1).fillRoundedRect(820, y + 12, 140, 55, 8);
                });
            }
        }
    }

    updateMoneyText() {
        this.moneyText.setText(`💰 $${GameState.money}`);
    }

    updateStatsPreview() {
        const s = GameState.getPlayerStats();
        const aiMult = GameState.getAiPenaltyMultiplier ? GameState.getAiPenaltyMultiplier() : 1;
        const aiPct = Math.round(aiMult * 100);
        this.statsText.setText(
            `Your stats: Speed ${s.topSpeed} | Accel ${s.acceleration} | Handling ${s.handling.toFixed(1)} | Nitro ${s.nitroMax}   •   AI power this race: ${aiPct}%`
        );
    }
}
