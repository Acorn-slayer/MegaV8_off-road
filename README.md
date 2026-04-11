# MEGA V8 OFF ROAD — Elliott Edition

**A racing game I made for my Grade 5 science fair!** You drive off-road trucks, collect coins, buy upgrades, and race against AI opponents — all in your browser.

It's inspired by *Super Off Road*, a classic arcade game from 1989. I built it with my dad using an AI coding assistant (GitHub Copilot / Claude) to explore how kids and AI can create real software together.

**[▶ Play it right now!](https://acorn-slayer.github.io/MegaV8_off-road/)** — no download needed, just click and race.

---

## Table of Contents

1. [What is This Project?](#what-is-this-project)
2. [Game Features](#game-features)
3. [How to Play](#how-to-play)
4. [How the Tracks Are Made](#technical-deep-dive-track-geometry) — *for curious readers*
5. [The Wall Problem](#the-wall-problem) — *a tricky bug we had to solve*
6. [Hazard Physics](#hazard-physics) — *math that makes the game feel real*
7. [Working with AI](#ai-assisted-development) — *what we learned*
8. [Architecture Overview](#architecture-overview) — *how the code is organized*
9. [How to Run Locally](#how-to-run-locally)
10. [Credits](#credits)

---

## What is This Project?

Have you ever played a racing game where you look down at the cars from above? That's what *Super Off Road* was — a famous arcade game from 1989 where you raced trucks on dirt tracks, picked up nitro boosts, and upgraded your vehicle between races.

I wanted to build my own version! This game runs in any web browser (Chrome, Edge, Safari...) on computers and iPads. My dad helped me design it, and we used an AI coding assistant to write the code — kind of like having a super-fast programmer teammate who never gets tired but also can't see the screen.

**Why is this a science fair project?** Because we wanted to find out: *what happens when a human and an AI build a real game together?* What's easy? What's hard? Where does the AI mess up? You'll find out in the sections below!

---

## Game Features

Here's what you can do in the game:

- 🏎️ Race 4 trucks on dirt tracks (you + 3 AI opponents)
- 🏁 Pick from multiple tracks — or make your own!
- ✏️ Built-in Track Editor — draw tracks with your finger or mouse
- 🔧 Upgrade shop — make your truck faster, better handling, more nitro
- 🏆 Championship mode — race all tracks and see who wins overall
- 💾 Save and load your game progress
- 🎮 Works on iPad (touch) and desktop (keyboard)
- 🧱 Real-looking track walls with red and white curbs
- 🎵 Engine sounds and background music

---

## How to Play

| Control | Keyboard | Touch |
|---------|----------|-------|
| Accelerate | ↑ | Right pedal |
| Brake | ↓ | Left pedal |
| Steer left | ← | Left arrow |
| Steer right | → | Right arrow |
| Nitro boost | Space | Nitro button |
| Mute music | M | — |

---

## Technical Deep Dive: Track Geometry

> **In simple words:** Tracks are built by telling the computer "go straight, then turn right, then go straight again" — like giving directions to a robot turtle. The computer figures out where to draw the road and put the walls. The tricky part is making sure the walls look smooth on curves!
>
> *The sections below explain the math behind it. Feel free to skip ahead if it gets too technical!*

### How Tracks Are Built — Turtle Graphics

Tracks are defined as a series of **sections** (straights and turns), like giving directions to a turtle:

```
"Go forward 120px, turn right 90° with radius 100, go forward 80px..."
```

The **TrackBuilder** walks these instructions, generating **waypoints** along the center line:

```
    Section 1: Straight        Section 2: Turn 90°
    ─────────────────→        ╮
    • ─── • ─── • ─── •      │  •
    wp0   wp1   wp2   wp3    │    •
                              │      •
                              ╯        • wp7
```

Each waypoint pair generates a road segment. The track surface is drawn as a thick line connecting all waypoints.

### Wall Generation

Walls are placed on both sides of each road segment, offset by half the track width:

```
    Wall (left side)
    ════════════════════
    ─── • ─── • ─── • ───   ← center line (waypoints)
    ════════════════════
    Wall (right side)
```

For each waypoint pair, we compute the **perpendicular normal** and offset in both directions:

```
    Given segment A → B:
    
    Direction:  dx = B.x - A.x,  dy = B.y - A.y
    Normal:     nx = -dy/len,     ny = dx/len
    
    Left wall:   A - normal*halfWidth  →  B - normal*halfWidth
    Right wall:  A + normal*halfWidth  →  B + normal*halfWidth
```

### The Arc Length Problem

Turns are **arcs**, not straight lines. The number of waypoints per turn must account for the **outer wall's arc length**, not just the angle:

```
    Small radius turn          Large radius turn
    (tight, short arc)         (wide, LONG outer arc)
    
       ╭──╮                      ╭─────────────╮
       │  │  Few steps OK        │             │  Needs MANY steps!
       ╰──╯                      │             │
                                  ╰─────────────╯
```

**Formula:** `steps = max(4, round(outerArc / 14))`  
Where `outerArc = |angle| × (radius + halfWidth)`

Too few steps → gaps between wall segments on the outer edge:

```
    ╭── Gap! ──╮
    │ ╲      ╱ │     Straight wall segments can't
    │   ╲  ╱   │     follow a tight curve
    │    ╲╱    │
```

---

## The Wall Problem

> **In simple words:** When a track folds back on itself (like a hairpin turn), the walls from one part of the track can end up *inside* another part. Your truck hits an invisible wall in the middle of what looks like open road! We tried 6 different ways to fix this with code, and none of them worked perfectly. In the end, the best solution was to build a tool that lets you click on the bad walls and delete them by hand.

### A Case Study in Computational Geometry

One of the most challenging problems in this project was **wall overlap at tight turns**. When the track doubles back on itself (like a hairpin or S-curve), walls from different sections can end up **inside the track surface of another section**:

```
    Section A going right →
    ══════════════════════
    ──── • ──── • ──── • ────
    ══════════════════════     ← Wall from section A
              ↕ overlap!
    ══════════════════════     ← Wall from section B  
    ──── • ──── • ──── • ────
    ══════════════════════
    Section B going left ←
```

This creates invisible barriers on the track that trucks bounce off. The player sees an open road but the truck hits a wall that belongs to a different part of the track.

### Six Iterations of Algorithmic Approaches

We tried **six different algorithmic approaches** to automatically cull overlapping walls:

| Attempt | Method | Problem |
|---------|--------|---------|
| 1 | Distance from wall to nearest waypoint | Waypoints are discrete — misses walls between them |
| 2 | Distance from wall to center line segments | Still too coarse, removed valid turn walls |
| 3 | Point-to-line-segment distance | Better, but couldn't distinguish "near because parallel" from "near because overlapping" |
| 4 | Skip ±2 neighbor sections | Too rigid — different track shapes need different skip counts |
| 5 | Section-based tagging (skip same section) | V-shape overlaps span multiple sections |
| 6 | Hybrid section skip + distance threshold | Still removed walls on tight but valid turns |

### The Solution: Give Up on Algorithms, Build Tools

After six failed iterations, we made a key engineering decision: **stop trying to solve it algorithmically and build manual tools instead.**

The Track Editor now includes:
- **🧹 Wall Eraser** — click individual wall segments to remove them
- **Save/Load** — erased wall indices are stored in the track JSON
- **Game runtime** — reads `erasedWalls` from JSON and filters them out

This is a real-world engineering lesson: **sometimes the best solution isn't more code — it's a better tool.**

```
    Algorithm approach:          Tool approach:
    
    Code tries to guess     →   Human SEES the problem
    which walls overlap          and clicks to fix it
    
    ❌ 6 failed attempts         ✅ Works every time
    ❌ Edge cases everywhere      ✅ No edge cases
    ❌ Hard to debug              ✅ Visual and intuitive
```

---

## Hazard Physics

> **In simple words:** The tracks have water puddles, holes, bumps, and oil slicks that affect your truck differently. We used a cool math trick (a sine curve) so that hitting the *edge* of a hole pulls you sideways, but driving right over the *center* doesn't — just like in real life! No complicated `if/else` code needed, just one formula.

### Making Holes and Bumps Feel Real with Math

Off-road tracks aren't smooth — they have **water puddles**, **holes**, **bumps**, and **oil slicks**. Each hazard needed its own physics, and the most interesting math went into how holes and bumps deflect the truck.

### The Singularity Problem

The first approach was simple: the closer you are to the center of a hole or bump, the harder the deflection. But this creates a **singularity** — at dead center, which direction do you push? The truck is perfectly centered, so the "away from center" vector becomes undefined (zero length, infinite angles). Any small rounding error would send the truck in a random direction.

The real world gives us the answer: if you drive *exactly* over the peak of a bump, you don't get pushed sideways at all. And if you fall into the *exact center* of a hole, you sink straight down — no lateral pull. The maximum deflection happens when you clip the **side** of the hazard, not the middle.

### The Bell Curve Solution: sin(π × d/r)

We model the deflection strength as a **sine bell curve**:

```
strength = sin(π × dist / radius)

        1.0 │        ╱╲
            │       ╱  ╲
            │      ╱    ╲
        0.5 │     ╱      ╲
            │    ╱        ╲
            │   ╱          ╲
        0.0 │──╱────────────╲──
            center    ½r    edge
                   dist →
```

| Position | dist / radius | sin(π × d/r) | Effect |
|----------|:---:|:---:|--------|
| Dead center | 0.0 | **0.0** | No deflection — no preferred direction |
| Quarter radius | 0.25 | 0.71 | Strong pull/push |
| Half radius | 0.50 | **1.0** | Maximum deflection |
| Three quarters | 0.75 | 0.71 | Still strong |
| Edge | 1.0 | **0.0** | Barely touching — no effect |

### Direction From Geometry, Not Randomness

One bell curve handles the **magnitude**. The **direction** comes from vector math for free:

```
Bump (pushes AWAY from center):          Hole (pulls TOWARD center):

    truck                                     truck
      ↗  ← pushed away                         ↙  ← pulled in
     /                                           \
   [BUMP center]                             [HOLE center]

   away = atan2(truck.y - bump.y,            toCenter = atan2(hole.y - truck.y,
                truck.x - bump.x)                            hole.x - truck.x)
```

The angle `atan2(dy, dx)` from hazard center to truck **automatically** points in the correct direction:
- Truck is **left** of a bump → pushed further **left**
- Truck is **right** of a bump → pushed further **right**
- Truck is **left** of a hole → pulled **right** toward center
- Truck is **right** of a hole → pulled **left** toward center

No `if/else`, no sign flipping, no two separate curves — one formula handles all cases because the vector math encodes the direction naturally.

### All Four Hazard Types

| Hazard | Speed Effect | Steering Effect | Visual Feedback |
|--------|:---:|-------------|------|
| 💧 **Water** | ×0.96/frame (drag) | None | Blue spray particles from both sides |
| ⚫ **Hole** | ×0.4 (big hit) | Bell-curve pull toward center | Camera shake |
| ⬆ **Bump** | ×0.7 (moderate) | Bell-curve push away from center | Camera shake |
| 🛢 **Oil** | ×0.99 (negligible) | Steering reduced to 30% (you slide) | None — the surprise is the point |

Water behaves like driving through grass — constant drag plus water spray particles shooting sideways (using the perpendicular angle to the truck's heading). Oil doesn't change your direction — it just makes your steering nearly useless, so you drift helplessly through the slick.

### Why This Matters for the Science Fair

This is a great example of how **choosing the right mathematical model** avoids complex branching logic:
- **Bad approach**: `if (left) push left; else if (right) push right; else if (center) do nothing;` — requires special cases, thresholds, sign tracking
- **Good approach**: `strength = sin(π × d/r)` × `vector_direction` — one formula, zero special cases, physically correct behavior everywhere including the edge cases

The sine function naturally gives us the bell shape we need, and `atan2` naturally gives us the correct direction. Math replaces code.

---

## AI-Assisted Development

> **In simple words:** We used an AI assistant to write most of the code. It's *amazingly* fast at writing code, but it can't see the game, so it can't tell if something looks wrong. We had to test everything ourselves and tell it what to fix. Sometimes it tried the same wrong idea over and over, and we had to be the ones to say "stop, let's try something completely different."

### What We Learned About Working with AI

This entire game was built through conversation between a human and an AI coding assistant. Here are honest reflections on what worked, what didn't, and what we learned.

### What the AI Does Well

- **Writes code fast**: Entire game scenes, physics, menus — hundreds of lines in seconds
- **Knows standard algorithms**: Math formulas, known techniques — it gets them right on the first try
- **Handles boring refactoring**: Renaming things, reorganizing files — it does it without mistakes
- **Responds to clear feedback**: "Make the walls thinner" or "change the color" → done instantly

### The Big Limitation: The AI Can't See the Game

The AI has **no visual output**. It cannot see the game running. It cannot see:
- Whether a track looks right or is distorted
- Whether walls are overlapping or have gaps
- Whether a truck is too big or too small for the track
- Whether a freehand drawing closed properly

**Every visual bug requires the human to describe what they see.** This creates a communication bottleneck:

```
    Human sees:  "The wall has a gap on the outer edge of big turns"
    
    AI thinks:   The wall segments are chord approximations of an arc.
                 The outer arc is longer than the center arc.
                 Need more segments → compute steps from outer radius.
    
    AI codes:    outerArc = |angle| × (radius + halfWidth)
                 steps = max(4, round(outerArc / 14))
    
    Human tests: "Still a small gap" → AI adjusts threshold
```

Sometimes the description is ambiguous. "It destroyed part of my drawing" — destroyed from the beginning? The end? The human has to investigate and report back.

### Where the AI Kept Getting It Wrong

**1. Geometry bugs requiring visual feedback**

The wall overlap problem (6 iterations!) is the prime example. Each algorithm *sounded* correct when described in code. The AI couldn't see that:
- Turn walls that *should* be close to the center line were being culled
- The V-shape overlap pattern was different from what the distance check detected
- "Close to the center line" and "overlapping another section" are geometrically different

**2. Freehand loop closing (4 iterations)**

The AI tried increasingly complex approaches:
1. Snap last simplified point → lost points due to simplification order
2. Scan backwards for entry into close zone → trimmed too many points  
3. Just snap the endpoint → still didn't work reliably
4. **Human suggested**: "just draw a line between end and start" → worked immediately

**Key insight**: The human's simple geometric intuition ("connect the dots") beat the AI's complex algorithmic approaches.

**3. AI difficulty balancing (the penalty multiplier)**

When we got feedback that the AI opponents were too weak, the AI tried to fix it by:
1. Adding per-stat bonuses that increased each race (+3 top speed, +2 acceleration...)
2. Capping the bonuses so AI wouldn't exceed the player's max stats
3. Capping against the player's *current* stats instead of max
4. Three different cap formulas — each had edge cases

Then Elliott said: **"Why not just make the AI slower at the start with a percentage penalty, and remove the penalty gradually?"**

One multiplier. One formula. It replaces all the per-stat boost tracking, all the cap logic, all the edge cases:

```
penalty = 1 - 0.25 × (1 - raceNumber / 10)

Race 0:  AI runs at 75% of full strength
Race 5:  AI runs at 87.5%
Race 10: AI runs at 100% — no penalty
```

The AI's approach kept adding complexity (boost values, caps, comparisons). The human's approach *removed* complexity — one number that fades from 0.75 to 1.0. Sometimes the best engineering is deleting code.

**4. Over-engineering before understanding**

The AI's tendency is to write a sophisticated solution. But for visual/spatial problems, the simplest approach — which a human can *see* immediately — often works best.

### What We'd Tell Other Kids

1. **AI is a tool, not a brain.** You still need to think, test, and make decisions. The AI writes code fast but it doesn't understand *why* something looks wrong.

2. **Describe problems clearly.** The better you explain what's happening, the better the AI can help. "It looks weird" doesn't help — "the wall has a gap on the right side of big turns" does.

3. **Don't let the AI go in circles.** When it tried 6 different algorithms for the wall problem and none worked, we should have stopped sooner and tried a completely different approach. Knowing when to say "this isn't working, let's do something else" is a real skill.

4. **Simple ideas often win.** We suggested "just draw a line between the start and end" for the loop-closing problem. The AI had tried 4 complicated solutions. The simple one worked first try.

5. **Play to your strengths.** The AI is great at writing code. Humans are great at looking at things and saying "that's not right." Let each do what they're good at.

---

## Architecture Overview

> **In simple words:** Here's how the game's files are organized. Each file has a specific job — one handles the trucks, one handles the race, one handles the shop, etc. If you want to look at the code or change something, this map tells you where to look.

```
index.html
├── js/
│   ├── GameState.js          — Persistent state (money, upgrades, save/load)
│   ├── objects/
│   │   ├── BaseTruck.js       — Shared truck physics + rendering
│   │   ├── Truck.js           — Player truck (keyboard/touch input)
│   │   ├── AiTruck.js         — AI waypoint following + lap tracking
│   │   ├── Coin.js            — Collectible coins
│   │   ├── TouchControls.js   — On-screen touch buttons
│   │   └── SoundFX.js         — Web Audio API engine + music
│   ├── scenes/
│   │   ├── BootScene.js       — Title screen + name entry + load game
│   │   ├── TrackSelectScene.js — Mode select + track cards + save
│   │   ├── TruckSelectScene.js — Color/truck picker
│   │   ├── ShopScene.js       — Upgrade shop between races
│   │   ├── RaceScene.js       — Main gameplay (~950 lines)
│   │   └── ChampionshipResultsScene.js — Final standings
│   └── tracks/
│       └── TrackBuilder.js    — Turtle-graphics track generator
├── tracks_descriptor/
│   ├── manifest.json          — Track file list
│   └── *.json                 — Track definitions (sections + colors + walls)
├── track_editor.html          — Standalone track editor app
└── assets/
    └── sprites/               — Title background image
```

### Key Technical Decisions

| Decision | Why |
|----------|-----|
| Phaser 3 framework | Handles canvas, input, scenes, tweens — lets us focus on game logic |
| Canvas texture for track | `lineJoin: 'round'` eliminates miter spikes at sharp angles |
| JSON track descriptors | Tracks are data, not code — editable in the track editor |
| Turtle graphics builder | Intuitive: "go forward, turn right" — easy to design tracks |
| File System Access API | Lets the editor overwrite files in-place (Chrome/Edge) |
| Web Audio API | Synthesized engine sound — no audio files needed |
| `.v8t` save files | JSON inside, custom extension for the game's identity |

---

## How to Run Locally

> **Note:** Opening `index.html` directly from your file system (double-click) won't work — browsers block asset loading from `file://` for security reasons. You need a local web server.

**Option A — VS Code + Live Server** (recommended):
1. Clone or download this repository
2. Open the folder in [VS Code](https://code.visualstudio.com/)
3. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
4. Right-click `index.html` → "Open with Live Server"
5. Play at `http://localhost:5500`

**Option B — Python one-liner:**
```bash
cd MegaV8_off-road
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Track Editor

Open `track_editor.html` in a browser. Draw tracks with freehand or build section-by-section. Save as JSON into `tracks_descriptor/` and add to `manifest.json`.

---

## Credits

- Inspired by *Super Off Road* (1989) by Leland Corporation
- Built with [Phaser 3](https://phaser.io) (v3.80.1)
- Created by **Elliott** (Grade 5, age 10) — Science Fair 2026
- With help from dad and an AI coding assistant (GitHub Copilot / Claude)

## License

This is a non-commercial educational project built for a science fair.
