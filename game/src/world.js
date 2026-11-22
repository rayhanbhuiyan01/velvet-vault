// The game's rules and state, with no drawing and no browser in it: the thief, the guards and
// their vision cones, the sweeping cameras, the loot, the decoy coins and the alarm meter.
// step() advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after createWorld.
import {
  ALARM,
  CAMERA,
  CAMERAS,
  CASES,
  COIN,
  ENTRY,
  EXIT,
  FIELD,
  GUARD,
  GUARDS,
  LOOT,
  SOLIDS,
  THIEF,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_COIN = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_SPOTTED = 16;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** True when the segment from (x1,y1) to (x2,y2) crosses rectangle r. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.width) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.width - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.height) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.height - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when nothing solid stands between the watcher and the thief. */
function hasLineOfSight(x1, y1, x2, y2) {
  for (let i = 0; i < SOLIDS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, SOLIDS[i])) return false;
  }
  return true;
}

/** Smallest absolute difference between two angles, in radians. */
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** True when a watcher at (wx,wy) facing `angle` can see the point (tx,ty). */
function canSee(wx, wy, angle, range, halfAngle, tx, ty) {
  const dx = tx - wx;
  const dy = ty - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && angleDiff(Math.atan2(dy, dx), angle) > halfAngle) return false;
  return hasLineOfSight(wx, wy, tx, ty);
}

/** Move a circle of `radius` by (dx,dy), sliding along solid rectangles, axis by axis. */
function moveCircle(body, dx, dy, radius) {
  const nextX = body.x + dx;
  let blocked = false;
  for (let i = 0; i < SOLIDS.length; i += 1) {
    const r = SOLIDS[i];
    if (
      nextX + radius > r.x &&
      nextX - radius < r.x + r.width &&
      body.y + radius > r.y &&
      body.y - radius < r.y + r.height
    ) {
      blocked = true;
      break;
    }
  }
  if (!blocked) body.x = clamp(nextX, radius, FIELD.width - radius);
  const nextY = body.y + dy;
  blocked = false;
  for (let i = 0; i < SOLIDS.length; i += 1) {
    const r = SOLIDS[i];
    if (
      body.x + radius > r.x &&
      body.x - radius < r.x + r.width &&
      nextY + radius > r.y &&
      nextY - radius < r.y + r.height
    ) {
      blocked = true;
      break;
    }
  }
  if (!blocked) body.y = clamp(nextY, radius, FIELD.height - radius);
}

export function createWorld(random) {
  const thief = { x: ENTRY.x, y: ENTRY.y, radius: THIEF.radius };
  const guards = GUARDS.map((g) => ({
    name: g.name,
    waypoints: g.waypoints,
    speed: g.speed,
    x: g.waypoints[0].x,
    y: g.waypoints[0].y,
    target: 1,
    angle: 0,
    radius: GUARD.radius,
    mode: 'patrol', // patrol | hunt | investigate
    investigateX: 0,
    investigateY: 0,
    investigateTimer: 0,
  }));
  const cameras = CAMERAS.map((c) => ({
    x: c.x,
    y: c.y,
    centre: c.centre,
    sweep: c.sweep,
    angle: c.centre,
    phase: random() * Math.PI * 2,
  }));
  const loot = LOOT.map((l) => ({ ...l, taken: false }));
  const state = {
    thief,
    guards,
    cameras,
    loot,
    alarm: 0,
    score: 0,
    coins: COIN.count,
    elapsed: 0,
    spotted: false,
    lootTaken: 0,
    over: false,
    escaped: false,
  };

  function reset() {
    thief.x = ENTRY.x;
    thief.y = ENTRY.y;
    for (const guard of guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.target = 1;
      guard.angle = 0;
      guard.mode = 'patrol';
      guard.investigateTimer = 0;
    }
    for (const camera of cameras) {
      camera.angle = camera.centre;
      // Re-draw the sweep phase from the world's seed: a fresh load with the same seed
      // stages the same game, a different seed (or a restart) sweeps the cameras differently.
      // (Previously this was reset to 0, so ?seed=N changed nothing at all — every seed
      // staged the identical frame.)
      camera.phase = random() * Math.PI * 2;
    }
    for (const item of loot) item.taken = false;
    state.alarm = 0;
    state.score = 0;
    state.coins = COIN.count;
    state.elapsed = 0;
    state.spotted = false;
    state.lootTaken = 0;
    state.over = false;
    state.escaped = false;
  }

  /** A guard walks toward (tx,ty) at `speed`; true when it arrives. */
  function walkGuard(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    moveCircle(guard, (dx / dist) * step, (dy / dist) * step, guard.radius);
    guard.angle = Math.atan2(dy, dx);
    return dist - step < 4;
  }

  /**
   * One fixed step. `move` is {x, y} (unit-ish direction) and `sneak` halves the thief's speed
   * and the alarm's climb. With `harmless` set (the title screen's backdrop) the alarm never
   * climbs and nothing is caught or won. `coinTarget` is a point to toss a decoy coin at, or null.
   */
  function step(dt, move, sneak, harmless, coinTarget) {
    let events = 0;
    if (state.over || state.escaped) return events;
    state.elapsed += dt;

    // The thief moves; sneaking is slower and quieter.
    const speed = sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    if (len > 0.001) {
      moveCircle(thief, (move.x / len) * speed * dt, (move.y / len) * speed * dt, thief.radius);
    }

    // A tossed coin: the nearest guard in range walks over to look at it.
    if (coinTarget && state.coins > 0) {
      const dx = coinTarget.x - thief.x;
      const dy = coinTarget.y - thief.y;
      if (Math.hypot(dx, dy) <= COIN.throwRange) {
        state.coins -= 1;
        events |= EVENT_COIN;
        let nearest = null;
        let nearestDist = COIN.lureRadius;
        for (const guard of guards) {
          const d = Math.hypot(guard.x - coinTarget.x, guard.y - coinTarget.y);
          if (d < nearestDist) {
            nearest = guard;
            nearestDist = d;
          }
        }
        if (nearest) {
          nearest.mode = 'investigate';
          nearest.investigateX = coinTarget.x;
          nearest.investigateY = coinTarget.y;
          nearest.investigateTimer = COIN.investigateSeconds;
        }
      }
    }

    // Cameras sweep back and forth around their centre angle.
    for (const camera of cameras) {
      camera.phase += CAMERA.sweepSpeed * dt;
      camera.angle = camera.centre + Math.sin(camera.phase) * camera.sweep;
    }

    // Who sees the thief right now?
    let seen = false;
    let rate = 0;
    for (const guard of guards) {
      if (guard.mode === 'investigate') continue;
      if (canSee(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, thief.x, thief.y)) {
        seen = true;
        rate = Math.max(rate, GUARD.spotRate);
      }
    }
    for (const camera of cameras) {
      if (canSee(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, thief.x, thief.y)) {
        seen = true;
        rate = Math.max(rate, CAMERA.spotRate);
      }
    }
    state.spotted = seen;

    if (!harmless) {
      if (seen) {
        state.alarm = Math.min(ALARM.max, state.alarm + rate * (sneak ? THIEF.sneakSpotFactor : 1) * dt);
        events |= EVENT_SPOTTED;
      } else {
        state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
      }
      if (state.alarm >= ALARM.max) {
        state.over = true;
        return events | EVENT_CAUGHT;
      }
    }

    // Guards: patrol their route, hunt the thief while the alarm is high, or investigate a coin.
    for (const guard of guards) {
      if (guard.mode === 'investigate') {
        guard.investigateTimer -= dt;
        const arrived = walkGuard(guard, guard.investigateX, guard.investigateY, GUARD.patrolSpeed, dt);
        if (arrived || guard.investigateTimer <= 0) guard.mode = 'patrol';
        continue;
      }
      if (!harmless && state.alarm >= GUARD.huntAbove) {
        guard.mode = 'hunt';
      } else if (guard.mode === 'hunt' && state.alarm <= GUARD.giveUpBelow) {
        guard.mode = 'patrol';
      }
      if (guard.mode === 'hunt') {
        walkGuard(guard, thief.x, thief.y, GUARD.huntSpeed, dt);
        continue;
      }
      const wp = guard.waypoints[guard.target];
      if (walkGuard(guard, wp.x, wp.y, guard.speed, dt)) {
        guard.target = (guard.target + 1) % guard.waypoints.length;
      }
    }

    // Loot: walk over a piece to pocket it.
    for (const item of loot) {
      if (item.taken) continue;
      if (Math.hypot(thief.x - item.x, thief.y - item.y) < thief.radius + item.radius) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += item.value;
        events |= EVENT_LOOT;
      }
    }

    // Escape: all loot pocketed, then reach the green exit door.
    if (!harmless && state.lootTaken === loot.length) {
      if (
        thief.x + thief.radius > EXIT.x &&
        thief.x - thief.radius < EXIT.x + EXIT.width &&
        thief.y + thief.radius > EXIT.y &&
        thief.y - thief.radius < EXIT.y + EXIT.height
      ) {
        state.escaped = true;
        state.score += Math.max(0, Math.round(300 - state.elapsed * 2));
        return events | EVENT_ESCAPED;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, canSee };
}
