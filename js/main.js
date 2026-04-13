// Super Off Road — Phaser 3 Game Configuration

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#3a2a1a',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, TrackSelectScene, TruckSelectScene, VehicleShopScene, RaceScene, ShopScene, ChampionshipResultsScene]
};

const game = new Phaser.Game(config);
