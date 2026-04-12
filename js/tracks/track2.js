// Track 2 — Figure-8 with walls and a jump at the crossing
// The track forms a figure-8 that crosses in the center.

const Track2 = {
    name: 'Canyon Eight',
    // Center-line waypoints forming a figure-8.
    // Start at center, go right loop clockwise, cross center, left loop clockwise.
    waypoints: [
        // Start/finish at center, heading right and down
        [400, 300],  // 0: center crossing

        // Right loop (going down-right, around, back up to center)
        [480, 350],  // 1
        [560, 420],  // 2
        [620, 480],  // 3: bottom-right corner
        [680, 440],  // 4
        [720, 360],  // 5
        [720, 280],  // 6: right side
        [690, 200],  // 7
        [630, 140],  // 8: top-right corner
        [550, 120],  // 9
        [480, 160],  // 10
        [430, 230],  // 11: approaching center from top-right

        // Cross through center, heading left and down
        [400, 300],  // 12: center crossing again

        // Left loop (going down-left, around, back up to center)
        [320, 350],  // 13
        [240, 420],  // 14
        [180, 480],  // 15: bottom-left corner
        [120, 440],  // 16
        [80,  360],  // 17
        [80,  280],  // 18: left side
        [110, 200],  // 19
        [170, 140],  // 20: top-left corner
        [250, 120],  // 21
        [320, 160],  // 22
        [370, 230],  // 23: approaching center from top-left
    ],
    trackWidth: 55,
    startLineIndex: 0,
    lapCount: 3,
    bgColor: 0x2a1a0a,
    trackColor: 0x7a6345,
    borderColor: 0x4a3020,
    grassColor: 0x3a5a2a,
    // Wall segments [x1, y1, x2, y2]
    walls: [
        // Right loop — outer walls
        [520, 390, 590, 455],
        [590, 455, 655, 510],
        [655, 510, 715, 470],
        [715, 470, 755, 380],
        [755, 380, 755, 260],
        [755, 260, 720, 175],
        [720, 175, 650, 110],
        [650, 110, 555, 90],
        [555, 90,  470, 120],

        // Left loop — outer walls
        [280, 390, 210, 455],
        [210, 455, 145, 510],
        [145, 510, 85,  470],
        [85,  470, 45,  380],
        [45,  380, 45,  260],
        [45,  260, 80,  175],
        [80,  175, 150, 110],
        [150, 110, 245, 90],
        [245, 90,  330, 120],
    ],
    wallColor: 0xaa8866,
    wallWidth: 6,
};

// Register track
GameState.tracks.push(Track2);
