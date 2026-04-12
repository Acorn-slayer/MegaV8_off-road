// Track 1 — Classic Oval
// The track is defined by a series of waypoints along the center line.
// Inner and outer boundaries are computed from the track width at each point.

const Track1 = {
    name: 'Desert Oval',
    // Center-line waypoints [x, y] — forms a closed loop
    // Coordinates are in game-world space (800x600)
    waypoints: [
        [400, 500],  // bottom center (start/finish)
        [300, 490],
        [180, 450],
        [100, 380],
        [70,  280],
        [90,  180],
        [150, 110],
        [250, 70],
        [400, 55],   // top center
        [550, 70],
        [650, 110],
        [710, 180],
        [730, 280],
        [700, 380],
        [620, 450],
        [500, 490],
    ],
    trackWidth: 80,          // total width of the road
    startLineIndex: 0,       // waypoint index for start/finish line
    lapCount: 3,
    // Background color (dirt)
    bgColor: 0x3a2a1a,
    // Track surface color
    trackColor: 0x8B7355,
    // Track border color
    borderColor: 0x5c4033,
    // Grass/off-track color
    grassColor: 0x4a7a3a,
    // Walls: [x1, y1, x2, y2] line segments (empty for this track)
    walls: [],
    wallColor: 0xcccccc,
    wallWidth: 6,
};

// Register track
GameState.tracks.push(Track1);
