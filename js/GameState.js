// GameState — Persistent state across races (player upgrades, AI progression, money)

const GameState = {
    // Audio preferences
    musicMuted: false,
    sfxMuted: false,

    // Player
    money: 0,
    raceNumber: 0,
    playerName: 'PLAYER',    // set by BootScene name input
    selectedTrack: null,     // set by TrackSelectScene
    playerColor: 0xff0000,   // set by TruckSelectScene
    gameMode: 'single',      // 'single' or 'championship'
    championshipRaceIndex: 0,
    championshipOrder: [],   // shuffled track indices for championship
    championshipPoints: { player: 0, ai: [0, 0, 0] },
    purchasedVehicles: {},

    // Truck color presets — each has different base stat strengths
    truckPresets: {
        0xff0000: { name: 'Red Fury',      topSpeed: 200, acceleration: 150, handling: 3.0, nitro: 5 },
        0x3388ff: { name: 'Blue Thunder',   topSpeed: 185, acceleration: 160, handling: 3.2, nitro: 6 },
        0xffcc00: { name: 'Gold Rush',      topSpeed: 210, acceleration: 140, handling: 2.8, nitro: 5 },
        0x33cc33: { name: 'Green Machine',  topSpeed: 190, acceleration: 145, handling: 3.4, nitro: 5 },
        0xff66cc: { name: 'Pink Rocket',    topSpeed: 220, acceleration: 135, handling: 2.6, nitro: 4 },
        0xff8800: { name: 'Orange Blaze',   topSpeed: 195, acceleration: 155, handling: 2.9, nitro: 7 },
        0x000000: { name: 'Night Rider',    topSpeed: 225, acceleration: 170, handling: 3.8, nitro: 6, type: 'bike', shopOnly: true, price: 10000 },
    },

    // Player upgrade levels (0-10 each)
    upgrades: {
        topSpeed:     0,
        acceleration: 0,
        handling:     0,
        nitro:        0,
    },

    // Per-level bonus (applied on top of truck preset base stats)
    perLevel: {
        topSpeed:     12,
        acceleration: 10,
        handling:     0.20,
        nitro:        0.8,
    },
    upgradeCost: {
        topSpeed:     200,
        acceleration: 200,
        handling:     250,
        nitro:        150,
    },
    maxLevel: 10,

    // AI penalty: starts at 25%, gradually fades to 0% over 10 races
    aiStartPenalty: 0.25,
    aiPenaltyFadeRaces: 10,

    // Get AI penalty multiplier (0.75 at race 0, 1.0 at race 10+)
    getAiPenaltyMultiplier() {
        const fade = Math.min(this.raceNumber / this.aiPenaltyFadeRaces, 1);
        return 1 - this.aiStartPenalty * (1 - fade);
    },

    // Check whether a vehicle is available for selection
    isVehicleUnlocked(color) {
        const preset = this.truckPresets[color];
        if (!preset) return false;
        if (!preset.shopOnly) return true;
        return !!this.purchasedVehicles[color];
    },

    isVehiclePurchased(color) {
        return !!this.purchasedVehicles[color];
    },

    purchaseVehicle(color, cost) {
        if (!this.truckPresets[color] || this.isVehicleUnlocked(color)) return false;
        if (this.money < cost) return false;
        this.money -= cost;
        this.purchasedVehicles[color] = true;
        return true;
    },

    getPlayerColor() {
        return this.isVehicleUnlocked(this.playerColor) ? this.playerColor : 0xff0000;
    },

    // Get base stats for the selected truck color
    getBaseStats() {
        const color = this.getPlayerColor();
        return this.truckPresets[color] || this.truckPresets[0xff0000];
    },

    // Compute player stats from truck preset base + upgrades
    getPlayerStats() {
        const base = this.getBaseStats();
        return {
            topSpeed:     base.topSpeed     + this.upgrades.topSpeed     * this.perLevel.topSpeed,
            acceleration: base.acceleration + this.upgrades.acceleration * this.perLevel.acceleration,
            handling:     base.handling     + this.upgrades.handling     * this.perLevel.handling,
            nitroMax:     base.nitro        + this.upgrades.nitro        * this.perLevel.nitro,
        };
    },

    // Get cost for next level of an upgrade
    getCost(stat) {
        const level = this.upgrades[stat];
        if (level >= this.maxLevel) return Infinity;
        // Price ramps steeply over 10 levels
        return this.upgradeCost[stat] + level * 80;
    },

    // Buy an upgrade
    buyUpgrade(stat) {
        const cost = this.getCost(stat);
        if (this.money >= cost && this.upgrades[stat] < this.maxLevel) {
            this.money -= cost;
            this.upgrades[stat]++;
            return true;
        }
        return false;
    },

    // AI upgrade state (one per AI truck: easy, medium, hard)
    aiUpgrades: [
        { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
        { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
        { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
    ],

    // AI spends its race earnings on random upgrades
    aiSpendMoney(aiIndex, raceMoney) {
        const ai = this.aiUpgrades[aiIndex];
        ai.money += raceMoney;
        const stats = ['topSpeed', 'acceleration', 'handling', 'nitro'];

        // Keep buying random upgrades while affordable
        let attempts = 0;
        while (attempts < 10) {
            const stat = stats[Math.floor(Math.random() * stats.length)];
            const level = ai[stat];
            if (level >= this.maxLevel) { attempts++; continue; }
            const cost = this.upgradeCost[stat] + level * 80;
            if (ai.money >= cost) {
                ai.money -= cost;
                ai[stat]++;
            } else {
                break;
            }
            attempts++;
        }
    },

    // Get AI upgrade bonus for a specific AI truck
    getAiUpgradeBonus(aiIndex) {
        const ai = this.aiUpgrades[aiIndex];
        return {
            topSpeed:     ai.topSpeed     * this.perLevel.topSpeed,
            acceleration: ai.acceleration * this.perLevel.acceleration,
            handling:     ai.handling     * this.perLevel.handling,
        };
    },

    // Position bonuses: 1st=$150, 2nd=$75, 3rd=$30, 4th=$0
    positionBonus: [150, 75, 30, 0],

    // Championship points per position: 1st=10, 2nd=5, 3rd=2, 4th=0
    championshipPointsPerPos: [10, 5, 2, 0],

    // Reset for new game (keeps selectedTrack and playerColor)
    reset() {
        this.money = 0;
        this.raceNumber = 0;
        this.championshipRaceIndex = 0;
        this.championshipOrder = [];
        this.championshipPoints = { player: 0, ai: [0, 0, 0] };
        this.upgrades.topSpeed = 0;
        this.upgrades.acceleration = 0;
        this.upgrades.handling = 0;
        this.upgrades.nitro = 0;
        this.purchasedVehicles = {};
        this.aiUpgrades = [
            { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
            { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
            { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0, money: 0 },
        ];
    },

    // Available tracks registry
    tracks: [],

    // Serialize saveable state to JSON string
    toSaveJSON() {
        return JSON.stringify({
            playerName: this.playerName,
            playerColor: this.playerColor,
            money: this.money,
            raceNumber: this.raceNumber,
            upgrades: { ...this.upgrades },
            purchasedVehicles: { ...this.purchasedVehicles },
            aiUpgrades: this.aiUpgrades.map(a => ({ ...a })),
            gameMode: this.gameMode,
            championshipRaceIndex: this.championshipRaceIndex,
            championshipOrder: this.championshipOrder,
            championshipPoints: {
                player: this.championshipPoints.player,
                ai: [...this.championshipPoints.ai]
            },
            musicMuted: this.musicMuted,
            sfxMuted: this.sfxMuted,
        }, null, 2);
    },

    // Restore state from parsed save object
    loadSave(s) {
        this.playerName = s.playerName || 'PLAYER';
        this.playerColor = s.playerColor || 0xff0000;
        this.money = s.money || 0;
        this.raceNumber = s.raceNumber || 0;
        this.purchasedVehicles = s.purchasedVehicles || {};
        if (s.upgrades) {
            this.upgrades.topSpeed = s.upgrades.topSpeed || 0;
            this.upgrades.acceleration = s.upgrades.acceleration || 0;
            this.upgrades.handling = s.upgrades.handling || 0;
            this.upgrades.nitro = s.upgrades.nitro || 0;
        }
        if (s.aiUpgrades) this.aiUpgrades = s.aiUpgrades;
        this.gameMode = s.gameMode || 'single';
        this.championshipRaceIndex = s.championshipRaceIndex || 0;
        this.championshipOrder = s.championshipOrder || [];
        if (s.championshipPoints) {
            this.championshipPoints = s.championshipPoints;
        }
        this.musicMuted = s.musicMuted || false;
        this.sfxMuted = s.sfxMuted || false;
    },
};
