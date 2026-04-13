// GameState — Persistent state across races (player upgrades, AI progression, money)

const GameState = {
    // Audio preferences
    musicMuted: false,
    sfxMuted: false,

    // Player
    money: 5000,
    raceNumber: 0,
    playerName: 'PLAYER',    // set by BootScene name input
    selectedTrack: null,     // set by TrackSelectScene
    playerColor: 0xff0000,   // set by TruckSelectScene
    gameMode: 'single',      // 'single' or 'championship'
    championshipRaceIndex: 0,
    championshipOrder: [],   // shuffled track indices for championship
    championshipPoints: { player: 0, ai: [0, 0, 0] },
    purchasedVehicles: {},

    // Truck color presets — each has different base stat strengths.
    // Regular trucks start at $5 000. Special vehicles are more expensive.
    truckPresets: {
        0xff0000: { name: 'Red Fury',     topSpeed: 211, acceleration: 158, handling: 2.85, nitro: 5, type: 'truck', price: 5000 },
        0x3388ff: { name: 'Blue Thunder',  topSpeed: 197, acceleration: 169, handling: 3.05, nitro: 5, type: 'truck', price: 5000 },
        0xffcc00: { name: 'Gold Rush',     topSpeed: 223, acceleration: 149, handling: 2.65, nitro: 4, type: 'truck', price: 5000 },
        0x33cc33: { name: 'Green Machine', topSpeed: 202, acceleration: 154, handling: 3.25, nitro: 4, type: 'truck', price: 5000 },
        0xff66cc: { name: 'Pink Rocket',   topSpeed: 234, acceleration: 143, handling: 2.45, nitro: 3, type: 'truck', price: 5000 },
        0xff8800: { name: 'Orange Blaze',  topSpeed: 208, acceleration: 165, handling: 2.75, nitro: 6, type: 'truck', price: 5000 },
        0x000000: { name: 'Night Rider',   topSpeed: 237, acceleration: 178, handling: 3.6, nitro: 5, type: 'bike',  price: 10000 },
        0xcc0000: { name: 'F1 Viper',      topSpeed: 273, acceleration: 225, handling: 4.0, nitro: 3, type: 'f1',    price: 20000 },
        0x556B2F: { name: 'Iron Beast',    topSpeed:  97, acceleration:  64, handling: 2.4, nitro: 2, type: 'tank',  price: 30000 },
        0x99d9ea: { name: 'Sky Fury',      topSpeed: 274, acceleration: 214, handling: 3.7, nitro: 4, type: 'jet',   price: 40000 },
    },

    // Per-vehicle upgrade levels — { [colorKey]: { topSpeed, acceleration, handling, nitro } }
    vehicleUpgrades: {},

    // Per-level bonus (applied on top of truck preset base stats)
    perLevel: {
        topSpeed:     13,
        acceleration: 11,
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

    // Check whether a vehicle is owned (purchased)
    isVehicleUnlocked(color) {
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
        // Return selected color if owned, otherwise fallback to first owned vehicle
        if (this.isVehicleUnlocked(this.playerColor)) return this.playerColor;
        const first = Object.keys(this.purchasedVehicles).map(Number).find(c => this.purchasedVehicles[c]);
        return first || 0xff0000;
    },

    // Get base stats for the selected truck color
    getBaseStats() {
        const color = this.getPlayerColor();
        return this.truckPresets[color] || this.truckPresets[0xff0000];
    },

    // Get upgrade levels for a specific vehicle (defaults to all zero)
    getVehicleUpgrades(color) {
        return this.vehicleUpgrades[color] || { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0 };
    },

    // Compute player stats from truck preset base + per-vehicle upgrades
    getPlayerStats() {
        const base = this.getBaseStats();
        const upg  = this.getVehicleUpgrades(this.getPlayerColor());
        return {
            topSpeed:     base.topSpeed     + upg.topSpeed     * this.perLevel.topSpeed,
            acceleration: base.acceleration + upg.acceleration * this.perLevel.acceleration,
            handling:     base.handling     + upg.handling     * this.perLevel.handling,
            nitroMax:     base.nitro        + upg.nitro        * this.perLevel.nitro,
        };
    },

    // Get cost for next level of an upgrade on a given vehicle
    getCost(color, stat) {
        const level = this.getVehicleUpgrades(color)[stat] || 0;
        if (level >= this.maxLevel) return Infinity;
        return this.upgradeCost[stat] + level * 80;
    },

    // Buy an upgrade for a specific vehicle
    buyUpgrade(color, stat) {
        if (!this.vehicleUpgrades[color]) {
            this.vehicleUpgrades[color] = { topSpeed: 0, acceleration: 0, handling: 0, nitro: 0 };
        }
        const cost = this.getCost(color, stat);
        if (this.money >= cost && this.vehicleUpgrades[color][stat] < this.maxLevel) {
            this.money -= cost;
            this.vehicleUpgrades[color][stat]++;
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
        this.money = 5000;
        this.raceNumber = 0;
        this.championshipRaceIndex = 0;
        this.championshipOrder = [];
        this.championshipPoints = { player: 0, ai: [0, 0, 0] };
        this.vehicleUpgrades = {};
        this.purchasedVehicles = {};
        this.playerColor = 0xff0000;
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
            vehicleUpgrades: JSON.parse(JSON.stringify(this.vehicleUpgrades)),
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
            saveVersion: 2,
        }, null, 2);
    },

    // Restore state from parsed save object
    loadSave(s) {
        this.playerName = s.playerName || 'PLAYER';
        this.playerColor = s.playerColor || 0xff0000;
        this.money = s.money != null ? s.money : 5000;
        this.raceNumber = s.raceNumber || 0;
        this.purchasedVehicles = s.purchasedVehicles || {};
        // v2 save: per-vehicle upgrades
        if (s.vehicleUpgrades) {
            this.vehicleUpgrades = s.vehicleUpgrades;
        } else if (s.upgrades) {
            // v1 migration: apply old global upgrades to the saved playerColor vehicle
            const c = s.playerColor || 0xff0000;
            this.vehicleUpgrades = {};
            this.vehicleUpgrades[c] = {
                topSpeed:     s.upgrades.topSpeed     || 0,
                acceleration: s.upgrades.acceleration || 0,
                handling:     s.upgrades.handling     || 0,
                nitro:        s.upgrades.nitro        || 0,
            };
        } else {
            this.vehicleUpgrades = {};
        }
        if (!Object.keys(this.purchasedVehicles).some(color => this.purchasedVehicles[color])) {
            this.purchasedVehicles[this.playerColor] = true;
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
