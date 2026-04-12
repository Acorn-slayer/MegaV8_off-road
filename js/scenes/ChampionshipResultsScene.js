// ChampionshipResultsScene — Final standings after all championship races

class ChampionshipResultsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ChampionshipResultsScene' });
    }

    create() {
        this.add.graphics().fillStyle(0x0a0a1a, 1).fillRect(0, 0, 1280, 720);

        const pts = GameState.championshipPoints;
        const style = {
            fontSize: '20px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        };

        this.add.text(640, 50, 'CHAMPIONSHIP', {
            fontSize: '28px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(640, 100, 'FINAL STANDINGS', {
            fontSize: '16px',
            fontFamily: "'Press Start 2P', cursive",
            color: '#ffffff'
        }).setOrigin(0.5);

        // Build standings
        const aiNames = GameState.aiDisplayNames || ['Blue Thunder', 'Gold Rush', 'Green Machine'];
        const standings = [
            { name: GameState.playerName, points: pts.player, color: '#ff6666' },
            { name: aiNames[0] || 'AI 1', points: pts.ai[0], color: '#3388ff' },
            { name: aiNames[1] || 'AI 2', points: pts.ai[1], color: '#ffcc00' },
            { name: aiNames[2] || 'AI 3', points: pts.ai[2], color: '#33cc33' },
        ];
        standings.sort((a, b) => b.points - a.points);

        const isWinner = standings[0].name === GameState.playerName;
        const playerPos = standings.findIndex(s => s.name === GameState.playerName);

        // Championship bonus money: 1st=$500, 2nd=$250, 3rd=$100, 4th=$0
        const champBonus = [500, 250, 100, 0];
        const bonus = champBonus[playerPos] || 0;
        GameState.money += bonus;

        // Trophy / result
        if (isWinner) {
            this.add.text(640, 155, '🏆 CHAMPION! 🏆', {
                fontSize: '24px',
                fontFamily: "'Press Start 2P', cursive",
                color: '#ffcc00'
            }).setOrigin(0.5);
            this.add.text(640, 190, `+$${bonus} Championship Bonus!`, {
                ...style, fontSize: '16px', color: '#00ff88'
            }).setOrigin(0.5);
        } else {
            const labels = ['1st', '2nd', '3rd', '4th'];
            this.add.text(640, 155, `You finished ${labels[playerPos]} overall`, {
                ...style, fontSize: '18px', color: '#aaaaaa'
            }).setOrigin(0.5);
            if (bonus > 0) {
                this.add.text(640, 190, `+$${bonus} Championship Bonus`, {
                    ...style, fontSize: '14px', color: '#00ff88'
                }).setOrigin(0.5);
            }
        }

        // Standings table
        const startY = 220;
        const posLabels = ['1ST', '2ND', '3RD', '4TH'];
        for (let i = 0; i < standings.length; i++) {
            const s = standings[i];
            const y = startY + i * 55;
            const isPlayer = s.name === GameState.playerName;

            // Position badge
            this.add.text(390, y, posLabels[i], {
                ...style, fontSize: '22px', color: i === 0 ? '#ffcc00' : '#888888'
            }).setOrigin(0.5);

            // Name
            this.add.text(540, y, s.name, {
                ...style, fontSize: '18px', color: isPlayer ? s.color : '#cccccc',
                fontStyle: isPlayer ? 'bold' : ''
            }).setOrigin(0, 0.5);

            // Points
            this.add.text(840, y, `${s.points} pts`, {
                ...style, fontSize: '18px', color: s.color
            }).setOrigin(0.5);
        }

        // Back to title
        this.add.text(640, 580, 'Click to Return to Title', {
            ...style, fontSize: '16px', color: '#aaaaaa'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('BootScene');
        });
    }
}
