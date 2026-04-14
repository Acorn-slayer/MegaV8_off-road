// TrackBuilder — Procedural track generator using turtle-graphics commands.
// Describe a track as a sequence of sections, and the builder walks the path
// generating waypoints and (optionally) walls along the edges.
//
// Section types:
//   { type: 'straight', length }               — go forward
//   { type: 'straight', length, walls: true }   — with walls on this section
//   { type: 'turn', angle, radius }             — arc (positive = right)
//   { type: 'turn', angle, radius, walls: true }
//
// Hazards (placed on sections):
//   hazards: [{ type: 'water', at: 0.5 }]      — water puddle at 50% through section
//   hazards: [{ type: 'hole', at: 0.3 }]       — hole that pulls trucks in
//   hazards: [{ type: 'bump', at: 0.7 }]       — bump that pushes trucks outward
//   hazards: [{ type: 'oil', at: 0.5 }]        — oil slick, reduces handling
//
// Track-level defaults:
//   walls: 'none' | 'outer'    — default wall mode for all sections
//
// Usage:
//   const track = TrackBuilder.build({ name, startX, startY, startAngle,
//       trackWidth, lapCount, walls, colors, sections });

const TrackBuilder = {

    _getLoopCloseTolerance(trackWidth) {
        return Math.max(15, Math.min(60, (trackWidth || 70) * 0.6));
    },

    build(def) {
        let x = def.startX || 400;
        let y = def.startY || 500;
        let heading = (def.startAngle || 0) * Math.PI / 180;

        const waypoints = [];
        const walls = [];
        const hazards = [];
        const sectionOf = [];             // sectionOf[wpIdx] = section number
        const segmentWallModes = [];      // wall mode for segment wp[i-1] -> wp[i]
        const hw = (def.trackWidth || 70) / 2;
        const closeTolerance = this._getLoopCloseTolerance(def.trackWidth || 70);
        const defaultWalls = def.walls || 'none';
        let secNum = 0;

        for (const sec of def.sections) {
            // Per-section wall override: true/false or inherit default
            const secWalls = sec.walls === true ? 'outer'
                           : sec.walls === false ? 'none'
                           : defaultWalls;

            const sectionStartIdx = waypoints.length;

            if (sec.type === 'straight') {
                if (sec.rotate) heading += (sec.rotate * Math.PI / 180);
                const len = sec.length || 50;
                const numPts = Math.max(2, Math.round(len / 20));
                const stepLen = len / numPts;

                for (let i = 0; i < numPts; i++) {
                    waypoints.push([Math.round(x), Math.round(y)]);
                    sectionOf.push(secNum);
                    if (waypoints.length > 1) {
                        segmentWallModes.push(secWalls);
                    }
                    x += Math.cos(heading) * stepLen;
                    y += Math.sin(heading) * stepLen;
                }

            } else if (sec.type === 'turn') {
                const angleDeg = sec.angle || 90;
                const radius = sec.radius || 80;
                const angleRad = angleDeg * Math.PI / 180;
                const outerArc = Math.abs(angleRad) * (radius + hw);
                const steps = sec.steps || Math.max(4, Math.round(outerArc / 14));
                const stepAngle = angleRad / steps;
                const sign = angleDeg > 0 ? 1 : -1;
                const perpAngle = heading + sign * Math.PI / 2;
                const cx = x + Math.cos(perpAngle) * radius;
                const cy = y + Math.sin(perpAngle) * radius;
                let fromCenter = Math.atan2(y - cy, x - cx);

                for (let i = 0; i < steps; i++) {
                    waypoints.push([Math.round(x), Math.round(y)]);
                    sectionOf.push(secNum);
                    if (waypoints.length > 1) {
                        segmentWallModes.push(secWalls);
                    }
                    fromCenter += sign * Math.abs(stepAngle);
                    x = cx + Math.cos(fromCenter) * radius;
                    y = cy + Math.sin(fromCenter) * radius;
                    heading += stepAngle;
                }
            }

            // Place hazards for this section
            if (sec.hazards) {
                const sectionPts = waypoints.slice(sectionStartIdx);
                for (const h of sec.hazards) {
                    const pos = this._pointAlongSection(sectionPts, h.at || 0.5);
                    if (pos && sectionPts.length >= 2) {
                        // Apply lateral offset perpendicular to track direction
                        const idx = Math.min(Math.floor((h.at || 0.5) * (sectionPts.length - 1)), sectionPts.length - 2);
                        const dx = sectionPts[idx+1][0] - sectionPts[idx][0];
                        const dy = sectionPts[idx+1][1] - sectionPts[idx][1];
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const nx = -dy / len, ny = dx / len;
                        const off = (h.offset || 0) * hw;
                        hazards.push({
                            type: h.type,
                            x: pos[0] + nx * off,
                            y: pos[1] + ny * off,
                            radius: h.radius || hw * 0.6,
                        });
                    } else if (pos) {
                        hazards.push({
                            type: h.type,
                            x: pos[0],
                            y: pos[1],
                            radius: h.radius || hw * 0.6,
                        });
                    }
                }
            }
            secNum++;
        }

        // Auto-close
        const first = waypoints[0];
        const last = [Math.round(x), Math.round(y)];
        const closeDist = Math.sqrt((last[0] - first[0]) ** 2 + (last[1] - first[1]) ** 2);
        const closedLoop = closeDist <= closeTolerance;
        if (!closedLoop) {
            waypoints.push(last);
            sectionOf.push(secNum);  // closing segment gets its own section
        }

        if (waypoints.length > 1) {
            const rawWalls = this._buildContinuousWalls(waypoints, hw, segmentWallModes, closedLoop && defaultWalls !== 'none');
            walls.push(...this._cullOverlappingWalls(rawWalls, waypoints, hw, sectionOf, closedLoop));
        }

        const customWallSegments = (def.customWalls || []).map((wall, idx) => {
            const cx = (wall[0] + wall[2]) / 2;
            const cy = (wall[1] + wall[3]) / 2;
            return [wall[0], wall[1], wall[2], wall[3], cx, cy, -100000 - idx];
        });
        walls.push(...customWallSegments);

        return {
            name: def.name || 'Custom Track',
            waypoints,
            trackWidth: def.trackWidth || 70,
            zoomTargetPx: def.zoomTargetPx,
            startLineIndex: def.startLineIndex || 0,
            lapCount: def.lapCount || 3,
            bgColor:     (def.colors && def.colors.bg)     || 0x3a2a1a,
            trackColor:  (def.colors && def.colors.track)   || 0x8B7355,
            borderColor: (def.colors && def.colors.border)  || 0x5c4033,
            grassColor:  (def.colors && def.colors.grass)   || 0x4a7a3a,
            walls,
            wallColor:   (def.colors && def.colors.wall)    || 0xcccccc,
            wallWidth: 4,
            truckScale: def.truckScale || 1,
            hazards,
            customWallCount: customWallSegments.length,
            _sectionOf: sectionOf,
            _program: def,
        };
    },

    _buildContinuousWalls(waypoints, hw, segmentWallModes, closeLoop) {
        const len = waypoints.length;
        if (len < 2) return [];

        const segCount = closeLoop ? len : len - 1;
        const segNormals = [];
        const segDirs = [];
        const segLengths = [];
        for (let i = 0; i < segCount; i++) {
            const j = (i + 1) % len;
            const dx = waypoints[j][0] - waypoints[i][0];
            const dy = waypoints[j][1] - waypoints[i][1];
            const segLen = Math.sqrt(dx * dx + dy * dy) || 1;
            segLengths.push(segLen);
            segDirs.push({ x: dx / segLen, y: dy / segLen });
            segNormals.push({ x: -dy / segLen, y: dx / segLen });
        }

        function intersectLines(a, b, c, d) {
            const abx = b.x - a.x;
            const aby = b.y - a.y;
            const cdx = d.x - c.x;
            const cdy = d.y - c.y;
            const denom = abx * cdy - aby * cdx;
            if (Math.abs(denom) < 0.0001) return null;
            const acx = c.x - a.x;
            const acy = c.y - a.y;
            const t = (acx * cdy - acy * cdx) / denom;
            return { x: a.x + abx * t, y: a.y + aby * t };
        }

        function offsetVertex(i, side) {
            const prevIdx = closeLoop ? (i - 1 + segCount) % segCount : (i > 0 ? i - 1 : -1);
            const nextIdx = i < segCount ? i : (closeLoop ? 0 : -1);
            const prevNormal = prevIdx >= 0 ? segNormals[prevIdx] : null;
            const nextNormal = nextIdx >= 0 ? segNormals[nextIdx] : null;
            const prevDir = prevIdx >= 0 ? segDirs[prevIdx] : null;
            const nextDir = nextIdx >= 0 ? segDirs[nextIdx] : null;
            const prevLen = prevIdx >= 0 ? segLengths[prevIdx] : 0;
            const nextLen = nextIdx >= 0 ? segLengths[nextIdx] : 0;
            const point = { x: waypoints[i][0], y: waypoints[i][1] };

            if (prevNormal && nextNormal && prevDir && nextDir) {
                const prevStart = {
                    x: point.x - prevDir.x * prevLen + prevNormal.x * hw * side,
                    y: point.y - prevDir.y * prevLen + prevNormal.y * hw * side,
                };
                const prevEnd = {
                    x: point.x + prevNormal.x * hw * side,
                    y: point.y + prevNormal.y * hw * side,
                };
                const nextStart = {
                    x: point.x + nextNormal.x * hw * side,
                    y: point.y + nextNormal.y * hw * side,
                };
                const nextEnd = {
                    x: point.x + nextDir.x * nextLen + nextNormal.x * hw * side,
                    y: point.y + nextDir.y * nextLen + nextNormal.y * hw * side,
                };
                const intersection = intersectLines(prevStart, prevEnd, nextStart, nextEnd);
                if (intersection) {
                    const maxJoin = Math.max(hw * 2.5, Math.min(prevLen, nextLen) * 0.75);
                    const dist = Math.hypot(intersection.x - point.x, intersection.y - point.y);
                    if (dist <= maxJoin) return intersection;
                }
                return {
                    x: point.x + nextNormal.x * hw * side,
                    y: point.y + nextNormal.y * hw * side,
                };
            }

            if (nextNormal) {
                return { x: point.x + nextNormal.x * hw * side, y: point.y + nextNormal.y * hw * side };
            }
            if (prevNormal) {
                return { x: point.x + prevNormal.x * hw * side, y: point.y + prevNormal.y * hw * side };
            }
            return point;
        }

        const leftPts = new Array(len);
        const rightPts = new Array(len);
        for (let i = 0; i < len; i++) {
            leftPts[i] = offsetVertex(i, -1);
            rightPts[i] = offsetVertex(i, 1);
        }

        const walls = [];
        for (let i = 1; i < len; i++) {
            if (segmentWallModes[i - 1] === 'none') continue;
            const a = waypoints[i - 1], b = waypoints[i];
            const leftA = leftPts[i - 1], leftB = leftPts[i];
            const rightA = rightPts[i - 1], rightB = rightPts[i];
            const cx = (a[0] + b[0]) / 2;
            const cy = (a[1] + b[1]) / 2;
            walls.push([
                Math.round(leftA.x), Math.round(leftA.y),
                Math.round(leftB.x), Math.round(leftB.y),
                cx, cy, i - 1
            ]);
            walls.push([
                Math.round(rightA.x), Math.round(rightA.y),
                Math.round(rightB.x), Math.round(rightB.y),
                cx, cy, i - 1
            ]);
        }

        if (closeLoop && segmentWallModes.length) {
            const a = waypoints[len - 1], b = waypoints[0];
            const leftA = leftPts[len - 1], leftB = leftPts[0];
            const rightA = rightPts[len - 1], rightB = rightPts[0];
            const cx = (a[0] + b[0]) / 2;
            const cy = (a[1] + b[1]) / 2;
            walls.push([
                Math.round(leftA.x), Math.round(leftA.y),
                Math.round(leftB.x), Math.round(leftB.y),
                cx, cy, len - 1
            ]);
            walls.push([
                Math.round(rightA.x), Math.round(rightA.y),
                Math.round(rightB.x), Math.round(rightB.y),
                cx, cy, len - 1
            ]);
        }

        return walls;
    },

    // Remove wall fragments that land inside the track surface.
    // Uses sectionOf[] to know which section each segment belongs to.
    // A wall from section X skips all centerline segments also in section X.
    // This means turns keep their inner walls, but V-overlaps get culled.
    _cullOverlappingWalls(walls, waypoints, hw, sectionOf, closedLoop) {
        const SUB_LEN = 8;
        const threshold = hw * 0.85;
        const threshold2 = threshold * threshold;
        const len = waypoints.length;

        // Pre-build centerline segments with section tag
        const segments = [];
        const segCount = closedLoop ? len : len - 1;
        for (let i = 0; i < segCount; i++) {
            const j = (i + 1) % len;
            segments.push([
                waypoints[i][0], waypoints[i][1],
                waypoints[j][0], waypoints[j][1],
                sectionOf ? sectionOf[i] : i   // section number
            ]);
        }

        const result = [];
        for (const w of walls) {
            const wx = w[2] - w[0], wy = w[3] - w[1];
            const wLen = Math.sqrt(wx * wx + wy * wy);
            if (wLen === 0) continue;

            const srcIdx = w[6];
            // Wall's section = section of its source waypoint
            const wallSection = sectionOf ? sectionOf[srcIdx] : -1;
            const numSubs = Math.max(1, Math.ceil(wLen / SUB_LEN));
            const dx = wx / numSubs, dy = wy / numSubs;

            for (let s = 0; s < numSubs; s++) {
                const sx1 = w[0] + dx * s;
                const sy1 = w[1] + dy * s;
                const sx2 = w[0] + dx * (s + 1);
                const sy2 = w[1] + dy * (s + 1);
                const mx = (sx1 + sx2) / 2;
                const my = (sy1 + sy2) / 2;

                let overlaps = false;
                for (const seg of segments) {
                    // Skip all segments from the same section
                    if (seg[4] === wallSection) continue;

                    const ex = seg[2] - seg[0], ey = seg[3] - seg[1];
                    const len2 = ex * ex + ey * ey;
                    if (len2 === 0) continue;
                    let t = ((mx - seg[0]) * ex + (my - seg[1]) * ey) / len2;
                    t = Math.max(0, Math.min(1, t));
                    const px = seg[0] + t * ex - mx;
                    const py = seg[1] + t * ey - my;
                    if (px * px + py * py < threshold2) {
                        overlaps = true;
                        break;
                    }
                }

                if (!overlaps) {
                    result.push([
                        Math.round(sx1), Math.round(sy1),
                        Math.round(sx2), Math.round(sy2),
                        w[4], w[5], srcIdx
                    ]);
                }
            }
        }
        return result;
    },

    // Get a point at fraction `t` (0–1) along a section's waypoints
    _pointAlongSection(pts, t) {
        if (pts.length < 2) return pts[0] || null;
        // Total section length
        let totalLen = 0;
        const segLens = [];
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i][0] - pts[i - 1][0];
            const dy = pts[i][1] - pts[i - 1][1];
            const sl = Math.sqrt(dx * dx + dy * dy);
            segLens.push(sl);
            totalLen += sl;
        }
        let target = t * totalLen;
        for (let i = 0; i < segLens.length; i++) {
            if (target <= segLens[i]) {
                const frac = segLens[i] > 0 ? target / segLens[i] : 0;
                return [
                    Math.round(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * frac),
                    Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * frac),
                ];
            }
            target -= segLens[i];
        }
        return pts[pts.length - 1];
    },

    // Center and scale track to fit a world area (default 3200x1800 for camera follow)
    centerTrack(track, worldW, worldH, padX, padY) {
        worldW = worldW || 3200;
        worldH = worldH || 1800;
        padX = padX || 80;
        padY = padY || 80;
        const wps = track.waypoints;
        const baseTrackWidth = Math.max(track.trackWidth || 70, 1);
        const halfWidth = baseTrackWidth / 2;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const wp of wps) {
            minX = Math.min(minX, wp[0] - halfWidth);
            maxX = Math.max(maxX, wp[0] + halfWidth);
            minY = Math.min(minY, wp[1] - halfWidth);
            maxY = Math.max(maxY, wp[1] + halfWidth);
        }
        if (track.hazards) {
            for (const hazard of track.hazards) {
                minX = Math.min(minX, hazard.x - hazard.radius);
                maxX = Math.max(maxX, hazard.x + hazard.radius);
                minY = Math.min(minY, hazard.y - hazard.radius);
                maxY = Math.max(maxY, hazard.y + hazard.radius);
            }
        }
        if (track.walls && track.walls.length) {
            for (const wall of track.walls) {
                minX = Math.min(minX, wall[0], wall[2]);
                maxX = Math.max(maxX, wall[0], wall[2]);
                minY = Math.min(minY, wall[1], wall[3]);
                maxY = Math.max(maxY, wall[1], wall[3]);
            }
        }
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scaleX = (worldW - padX * 2) / rangeX;
        const scaleY = (worldH - padY * 2) / rangeY;
        const scale = Math.min(scaleX, scaleY);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const centerX = worldW / 2;
        const centerY = worldH / 2;

        for (const wp of wps) {
            wp[0] = Math.round((wp[0] - cx) * scale + centerX);
            wp[1] = Math.round((wp[1] - cy) * scale + centerY);
        }
        // Scale track width and truck scale to match the coordinate scaling
        track.trackWidth = Math.round(track.trackWidth * scale);
        // If truck scale not set, use the track scale factor; if set, scale it proportionally
        if (!track.truckScale) {
            track.truckScale = Math.round(scale * 100) / 100;
        } else {
            track.truckScale = Math.round(track.truckScale * scale * 100) / 100;
        }

        // Store world dimensions on the track for camera/rendering use
        track.worldW = worldW;
        track.worldH = worldH;
        track.geometryScale = scale;

        if (track.walls) {
            for (const w of track.walls) {
                w[0] = Math.round((w[0] - cx) * scale + centerX);
                w[1] = Math.round((w[1] - cy) * scale + centerY);
                w[2] = Math.round((w[2] - cx) * scale + centerX);
                w[3] = Math.round((w[3] - cy) * scale + centerY);
                // Update stored centerline reference too
                if (w.length >= 6) {
                    w[4] = Math.round((w[4] - cx) * scale + centerX);
                    w[5] = Math.round((w[5] - cy) * scale + centerY);
                }
            }
            // Apply erased walls from editor (if any)
            if (track._program && track._program.erasedWalls && track._program.erasedWalls.length) {
                const erased = new Set(track._program.erasedWalls);
                track.walls = track.walls.filter((_, i) => !erased.has(i));
            }
        }
        if (track.hazards) {
            for (const h of track.hazards) {
                h.x = Math.round((h.x - cx) * scale + centerX);
                h.y = Math.round((h.y - cy) * scale + centerY);
                h.radius = Math.round(h.radius * scale);
            }
        }
        return track;
    }
};
