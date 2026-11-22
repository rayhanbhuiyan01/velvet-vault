// The Velvet Vault — the heist itself, with no drawing and no browser in it.
// A thief, three patrolling guards with vision cones, two sweeping wall
// cameras, three loot pieces, an alarm meter and decoy coins. step() advances
// one fixed step and returns what happened as bit flags, so the caller can
// react (sounds, screens) without the world knowing about any of that.
import {
  ALARM, BONUS, CAMERAS, CASES, COINS, EXIT, FIELD, GUARDS, LOOT, THIEF,
  VAULT, VISION, WALL,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_COIN = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_SEEN = 16;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** Circle (centre + radius) overlapping a rectangle. */
function circleHitsRect(cx, cy, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld(random) {
  // Every solid rectangle sight and feet must respect: the outer walls, the
  // display cases, and the vault's two walls (the door gap stays open).
  const solids = [
    { x: 0, y: 0, w: FIELD.width, h: WALL },
    { x: 0, y: FIELD.height - WALL, w: FIELD.width, h: WALL },
    { x: 0, y: 0, w: WALL, h: FIELD.height },
    { x: FIELD.width - WALL, y: 0, w: WALL, h: FIELD.height },
    ...CASES,
    VAULT.wallV,
    VAULT.wallH,
  ];

  const state = {
    thief: { x: THIEF.startX, y: THIEF.startY, sneaking: false },
    guards: [],
    cameras: [],
    loot: [],
    tossed: [],
    alarm: 0,
    score: 0,
    coinsLeft: COINS.start,
    lootTaken: 0,
    exitOpen: false,
    phase: 'play',
    elapsed: 0,
    seenBy: null,
  };

  function reset() {
    state.thief.x = THIEF.startX;
    state.thief.y = THIEF.startY;
    state.thief.sneaking = false;
    state.guards = GUARDS.map((g) => ({
      name: g.name,
      x: g.x,
      y: g.y,
      dir: 0,
      speed: g.speed,
      waypoints: g.waypoints.map((w) => ({ x: w.x, y: w.y })),
      wpIndex: 1,
      mode: 'patrol',
      paused: false,
      pauseLeft: 0,
      pauseTotal: 0,
      baseDir: 0,
      investigateX: 0,
      investigateY: 0,
    }));
    state.cameras = CAMERAS.map((c) => ({
      x: c.x, y: c.y,
      angle: c.startAngle,
      sweepMin: c.sweepMin, sweepMax: c.sweepMax,
      sweepSpeed: c.sweepSpeed, sweepDir: 1,
    }));
    state.loot = LOOT.map((l) => ({ ...l, taken: false }));
    state.tossed = [];
    state.alarm = 0;
    state.score = 0;
    state.coinsLeft = COINS.start;
    state.lootTaken = 0;
    state.exitOpen = false;
    state.phase = 'play';
    state.elapsed = 0;
    state.seenBy = null;
  }

  /** True when the straight line from (x1,y1) to (x2,y2) crosses no solid rectangle. */
  function lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 7));
    for (let i = 1; i < steps; i += 1) {
      const px = x1 + (dx * i) / steps;
      const py = y1 + (dy * i) / steps;
      for (const solid of solids) {
        if (pointInRect(px, py, solid)) return false;
      }
    }
    return true;
  }

  /** Is the point (x, y) inside any guard's or camera's vision cone right now?
   *  Returns {kind, dist, dir} — kind 'guard' or 'camera', dist how far the
   *  watcher is, dir which way its cone points — or null when nothing sees it. */
  function visibleAt(x, y) {
    for (const guard of state.guards) {
      const dx = x - guard.x;
      const dy = y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > VISION.guardRange) continue;
      if (angleDiff(Math.atan2(dy, dx), guard.dir) > VISION.guardHalfAngle) continue;
      if (lineOfSight(guard.x, guard.y, x, y)) return { kind: 'guard', dist, dir: guard.dir };
    }
    for (const camera of state.cameras) {
      const dx = x - camera.x;
      const dy = y - camera.y;
      const dist = Math.hypot(dx, dy);
      if (dist > VISION.cameraRange) continue;
      if (angleDiff(Math.atan2(dy, dx), camera.angle) > VISION.cameraHalfAngle) continue;
      if (lineOfSight(camera.x, camera.y, x, y)) return { kind: 'camera', dist, dir: camera.angle };
    }
    return null;
  }

  function moveToward(entity, tx, ty, speed, dt) {
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return true;
    const stepLen = Math.min(dist, speed * dt);
    entity.x += (dx / dist) * stepLen;
    entity.y += (dy / dist) * stepLen;
    entity.dir = Math.atan2(dy, dx);
    return dist - stepLen < 3;
  }

  function updateGuard(guard, dt) {
    if (guard.paused) {
      guard.pauseLeft -= dt;
      // A waiting guard looks around, sweeping his gaze side to side.
      const sweep = Math.sin((guard.pauseTotal - guard.pauseLeft) * 2.2);
      guard.dir = guard.baseDir + sweep * (guard.mode === 'investigate' ? 1.1 : 0.55);
      if (guard.pauseLeft <= 0) {
        guard.paused = false;
        if (guard.mode === 'investigate') guard.mode = 'return';
        else if (guard.mode === 'patrol') guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      }
      return;
    }
    if (guard.mode === 'patrol') {
      const target = guard.waypoints[guard.wpIndex];
      if (moveToward(guard, target.x, target.y, guard.speed, dt)) {
        guard.paused = true;
        guard.pauseTotal = 1.2;
        guard.pauseLeft = 1.2;
        guard.baseDir = guard.dir;
      }
    } else if (guard.mode === 'investigate') {
      if (moveToward(guard, guard.investigateX, guard.investigateY, guard.speed * 1.35, dt)) {
        guard.paused = true;
        guard.pauseTotal = 2.5;
        guard.pauseLeft = 2.5;
        guard.baseDir = guard.dir;
      }
    } else {
      // Return to the nearest patrol waypoint, then pick the patrol back up.
      let nearest = 0;
      let nearestDist = Infinity;
      guard.waypoints.forEach((w, i) => {
        const d = Math.hypot(w.x - guard.x, w.y - guard.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      });
      const target = guard.waypoints[nearest];
      if (moveToward(guard, target.x, target.y, guard.speed, dt)) {
        guard.mode = 'patrol';
        guard.wpIndex = (nearest + 1) % guard.waypoints.length;
      }
    }
  }

  function updateCamera(camera, dt) {
    camera.angle += camera.sweepDir * camera.sweepSpeed * dt;
    if (camera.angle >= camera.sweepMax) {
      camera.angle = camera.sweepMax;
      camera.sweepDir = -1;
    } else if (camera.angle <= camera.sweepMin) {
      camera.angle = camera.sweepMin;
      camera.sweepDir = 1;
    }
  }

  function thiefBlocked(x, y) {
    if (x < WALL + THIEF.radius || x > FIELD.width - WALL - THIEF.radius) return true;
    if (y < WALL + THIEF.radius || y > FIELD.height - WALL - THIEF.radius) return true;
    for (const solid of solids) {
      if (circleHitsRect(x, y, THIEF.radius, solid)) return true;
    }
    return false;
  }

  /**
   * One fixed step. `move` is a direction {x, y} (each -1..1); `sneak` slows the
   * thief and halves the alarm's climb. With `harmless` set (the title screen's
   * backdrop) the guards still walk and the cameras still sweep, but nothing
   * is spotted, pocketed or escaped.
   */
  function step(dt, move, sneak, harmless) {
    let events = 0;
    if (state.phase !== 'play') return events;
    state.elapsed += dt;

    for (const guard of state.guards) updateGuard(guard, dt);
    for (const camera of state.cameras) updateCamera(camera, dt);
    for (let i = state.tossed.length - 1; i >= 0; i -= 1) {
      state.tossed[i].ttl -= dt;
      if (state.tossed[i].ttl <= 0) state.tossed.splice(i, 1);
    }

    // Move the thief one axis at a time, so a case edge slides instead of stopping him.
    const speed = sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const thief = state.thief;
    thief.sneaking = sneak;
    const nextX = thief.x + move.x * speed * dt;
    if (!thiefBlocked(nextX, thief.y)) thief.x = nextX;
    const nextY = thief.y + move.y * speed * dt;
    if (!thiefBlocked(thief.x, nextY)) thief.y = nextY;

    if (harmless) return events;

    // Pocket any loot close enough to reach.
    for (const item of state.loot) {
      if (item.taken) continue;
      if (Math.hypot(item.x - thief.x, item.y - thief.y) < 28) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += item.value;
        events |= EVENT_PICKUP;
      }
    }
    state.exitOpen = state.lootTaken === state.loot.length;

    // The alarm climbs while any cone holds the thief, and drains while hidden.
    // Spotted at point-blank range by a guard, it climbs twice as fast.
    const seen = visibleAt(thief.x, thief.y);
    state.seenBy = seen ? seen.kind : null;
    if (seen) {
      let rate = seen.kind === 'guard' ? ALARM.guardRate : ALARM.cameraRate;
      if (seen.kind === 'guard' && seen.dist < 130) rate *= 2;
      if (sneak) rate *= ALARM.sneakFactor;
      state.alarm = Math.min(ALARM.caughtAt, state.alarm + rate * dt);
      events |= EVENT_SEEN;
      if (state.alarm >= ALARM.caughtAt) {
        state.phase = 'caught';
        return events | EVENT_CAUGHT;
      }
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }

    // Slip out through the exit once it stands open.
    if (state.exitOpen && pointInRect(thief.x, thief.y, EXIT)) {
      const timeBonus = Math.max(0, BONUS.timeMax - Math.floor(state.elapsed) * BONUS.timePerSecond);
      state.score += timeBonus + state.coinsLeft * BONUS.perCoin;
      state.phase = 'escaped';
      return events | EVENT_ESCAPED;
    }
    return events;
  }

  /** Toss a decoy coin at (x, y): the nearest guard in range goes to look. */
  function tossCoin(x, y) {
    if (state.phase !== 'play' || state.coinsLeft <= 0) return false;
    state.coinsLeft -= 1;
    state.tossed.push({ x, y, ttl: COINS.ringSeconds });
    let nearest = null;
    let nearestDist = Infinity;
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - x, guard.y - y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = guard;
      }
    }
    if (nearest && nearestDist <= COINS.lureRange) {
      nearest.mode = 'investigate';
      nearest.paused = false;
      nearest.investigateX = x;
      nearest.investigateY = y;
    }
    return true;
  }

  reset();
  return { state, reset, step, tossCoin, visibleAt };
}
