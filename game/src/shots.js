// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by an autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. The careful pilot plans a route through the loot, creeps at the edge
// of every vision cone, flees when it is spotted and sidesteps when it wedges
// against a case; the reckless one (the end scene) walks straight at the
// nearest treasure and pays for it.
import { FIELD, STEP, THIEF } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { SCREEN_CAUGHT, SCREEN_ESCAPED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 6;
const END_LIMIT_SECONDS = 600;
/** How long the reckless thief stops to admire each treasure he pockets. */
const LOOT_LINGER_SECONDS = 1.4;

/** The heist route, rebuilt from what is still on the floor. */
function routeFor(state) {
  const points = [];
  const byId = {};
  for (const item of state.loot) byId[item.id] = item;
  if (byId.gold && !byId.gold.taken) points.push({ x: 380, y: 285 });
  if (byId.emerald && !byId.emerald.taken) {
    // Swing wide of the emerald case instead of clipping its corner.
    points.push({ x: 560, y: 560 });
    points.push({ x: 720, y: 545 });
  }
  if (byId.diamond && !byId.diamond.taken) {
    points.push({ x: 992, y: 340 });
    points.push({ x: 1130, y: 200 });
  }
  points.push({ x: 992, y: 340 });
  points.push({ x: 640, y: 678 });
  return points;
}

function unit(x, y) {
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

function rotate(dir, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos };
}

/** A careful pilot that keeps its own route index, stuck counter and wait clock. */
export function createPilot(world) {
  let routeIndex = 0;
  let lastX = null;
  let lastY = null;
  let stuckSteps = 0;
  let sidestepLeft = 0;
  let sidestepSign = 1;
  let waitSteps = 0;
  let retreating = false;
  let calmSteps = 0;

  /** Longest the pilot waits for a watched path to clear, in steps, before going anyway. */
  const MAX_WAIT_STEPS = 240;
  /** The crossing point of Vesper's patrol column on the way to the vault door. */
  const VAULT_CROSS = { x: 880, y: 410 };

  function move() {
    const state = world.state;
    const thief = state.thief;
    const route = routeFor(state);
    if (routeIndex >= route.length) routeIndex = route.length - 1;
    let target = route[routeIndex];
    while (routeIndex < route.length && Math.hypot(target.x - thief.x, target.y - thief.y) < 24) {
      routeIndex += 1;
      target = route[Math.min(routeIndex, route.length - 1)];
    }
    const toward = unit(target.x - thief.x, target.y - thief.y);

    // Stuck against a case edge: sidestep sideways for a while, alternating sides.
    const moved = lastX === null ? 99 : Math.hypot(thief.x - lastX, thief.y - lastY);
    lastX = thief.x;
    lastY = thief.y;
    if (moved < 1.2) stuckSteps += 1;
    else stuckSteps = 0;
    if (stuckSteps > 45 && sidestepLeft <= 0) {
      sidestepLeft = 40;
      sidestepSign = -sidestepSign;
    }
    if (sidestepLeft > 0) {
      sidestepLeft -= 1;
      stuckSteps = 0;
      return { move: rotate(toward, (Math.PI / 2) * sidestepSign), sneak: false };
    }

    // From the thief's current spot, how long (seconds) until stepping in
    // `dir` leaves every cone — Infinity when still seen after 2 s.
    const timeToHidden = (dir) => {
      let x = thief.x;
      let y = thief.y;
      for (let t = 0.25; t <= 2; t += 0.25) {
        x += dir.x * THIEF.walkSpeed * 0.25;
        y += dir.y * THIEF.walkSpeed * 0.25;
        if (!world.visibleAt(x, y)) return t;
      }
      return Infinity;
    };
    // From the thief's current spot, how long until stepping in `dir` walks
    // into a cone — Infinity when still hidden after 1.5 s.
    const timeToSeen = (dir) => {
      let x = thief.x;
      let y = thief.y;
      for (let t = 0.25; t <= 1.5; t += 0.25) {
        x += dir.x * THIEF.walkSpeed * 0.25;
        y += dir.y * THIEF.walkSpeed * 0.25;
        if (world.visibleAt(x, y)) return t;
      }
      return Infinity;
    };

    const sneak = state.alarm > 35;

    // Spotted right now: run from the nearest watcher, not toward the loot.
    // Spotted right now: slip out of the cone sideways, not straight away —
    // a guard walking your way keeps you in his cone if you run ahead of him.
    // Run at full speed: getting out matters more than the sneak discount.
    // If every way out is watched, still run — standing in a cone is worse.
    // Once spotted, keep retreating until the alarm has drained and the coast
    // is clear for a while: darting back toward the loot the moment a cone
    // blinks off just walks back into it.
    if (state.seenBy) retreating = true;
    if (retreating) {
      if (!state.seenBy && state.alarm < 15) calmSteps += 1;
      else calmSteps = 0;
      if (calmSteps > 30) retreating = false;
    }
    if (state.seenBy || retreating) {
      waitSteps = 0;
      let threat = null;
      let threatDist = Infinity;
      const consider = (x, y) => {
        const d = Math.hypot(thief.x - x, thief.y - y);
        if (d < threatDist) {
          threatDist = d;
          threat = { x, y };
        }
      };
      for (const guard of state.guards) consider(guard.x, guard.y);
      for (const camera of state.cameras) consider(camera.x, camera.y);
      const away = threat
        ? unit(thief.x - threat.x, thief.y - threat.y)
        : unit(thief.x - FIELD.width / 2, thief.y - FIELD.height / 2);
      // The cone's axis: sideways out of it is the shortest way to darkness.
      const seen = world.visibleAt(thief.x, thief.y);
      const axis = seen ? { x: Math.cos(seen.dir), y: Math.sin(seen.dir) } : away;
      const perpA = rotate(axis, Math.PI / 2);
      const perpB = rotate(axis, -Math.PI / 2);
      const awayFromThreat = (dir) => (threat ? dir.x * (thief.x - threat.x) + dir.y * (thief.y - threat.y) : 0);
      const sideways = awayFromThreat(perpA) >= awayFromThreat(perpB) ? [perpA, perpB] : [perpB, perpA];
      const tries = [...sideways, away, rotate(away, 0.6), rotate(away, -0.6), rotate(away, 1.4), rotate(away, -1.4)];
      // Take the way out of the cone soonest; if none gets out within 2 s,
      // take the one that puts the most distance between thief and watcher.
      let bestDir = tries[0];
      let bestHidden = Infinity;
      let bestGap = -Infinity;
      for (const dir of tries) {
        const hidden = timeToHidden(dir);
        const gap = threat
          ? Math.hypot(thief.x + dir.x * THIEF.walkSpeed - threat.x, thief.y + dir.y * THIEF.walkSpeed - threat.y)
          : 0;
        if (hidden < bestHidden || (hidden === bestHidden && gap > bestGap)) {
          bestHidden = hidden;
          bestGap = gap;
          bestDir = dir;
        }
      }
      return { move: bestDir, sneak: false };
    }

    // The way ahead is watched: wait where it is safe for the cone to sweep
    // past, unless the wait has already run long — then sneak through anyway.
    const distToTarget = Math.hypot(target.x - thief.x, target.y - thief.y);
    if (distToTarget > 120) {
      let watched = false;
      const samples = Math.ceil(distToTarget / 40);
      for (let i = 1; i <= samples; i += 1) {
        const px = thief.x + ((target.x - thief.x) * i) / samples;
        const py = thief.y + ((target.y - thief.y) * i) / samples;
        if (world.visibleAt(px, py)) {
          watched = true;
          break;
        }
      }
      // Crossing to the vault door means stepping across Vesper's patrol
      // column: only go when he is well away from the crossing point, not
      // merely when his cone happens to point elsewhere this instant.
      if (!watched && target.x === 992 && target.y === 340 && thief.x < 880) {
        const vesper = state.guards.find((g) => g.name === 'Vesper');
        if (vesper && Math.hypot(vesper.x - VAULT_CROSS.x, vesper.y - VAULT_CROSS.y) < 200) {
          watched = true;
        }
      }
      if (watched) {
        waitSteps += 1;
        if (waitSteps <= MAX_WAIT_STEPS) {
          // Waiting is only safe if no guard is closing in on this spot.
          let near = null;
          let nearDist = Infinity;
          for (const guard of state.guards) {
            const d = Math.hypot(thief.x - guard.x, thief.y - guard.y);
            if (d < nearDist) {
              nearDist = d;
              near = guard;
            }
          }
          if (near && nearDist < 220) {
            return { move: unit(thief.x - near.x, thief.y - near.y), sneak: false };
          }
          return { move: { x: 0, y: 0 }, sneak: true };
        }
      }
    }
    waitSteps = 0;

    // Creep toward the target, trying wider and wider turns when the direct
    // line walks into a cone soon; prefer a line that stays hidden for the
    // next second and a half, and stand still if every way is watched.
    const turns = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, Math.PI];
    let bestDir = null;
    let bestSeen = -Infinity;
    for (const turn of turns) {
      const dir = rotate(toward, turn);
      const seenIn = timeToSeen(dir);
      if (seenIn === Infinity) return { move: dir, sneak };
      if (seenIn > bestSeen) {
        bestSeen = seenIn;
        bestDir = dir;
      }
    }
    if (bestSeen >= 0.5) return { move: bestDir, sneak };
    return { move: { x: 0, y: 0 }, sneak: true };
  }

  return { move };
}

/** The end scene's pilot: straight at the nearest loot, cones be damned. */
function recklessMove(world) {
  const state = world.state;
  const thief = state.thief;
  let target = { x: 640, y: 678 };
  let best = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - thief.x, item.y - thief.y);
    if (d < best) {
      best = d;
      target = item;
    }
  }
  return { move: unit(target.x - thief.x, target.y - thief.y), sneak: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    const pilot = createPilot(world);
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const order = pilot.move();
      const events = world.step(STEP, order.move, order.sneak, false);
      if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
    }
    if (world.state.phase === 'caught') return { screen: SCREEN_CAUGHT, best: world.state.score };
    if (world.state.phase === 'escaped') return { screen: SCREEN_ESCAPED, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // The end scene: the reckless pilot keeps walking until the alarm catches
  // him — and he cannot resist stopping to admire every treasure he pockets,
  // standing in the open while the guards close in.
  let lingerUntil = 0;
  let lastLoot = 0;
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    let order = recklessMove(world);
    if (world.state.elapsed < lingerUntil) order = { move: { x: 0, y: 0 }, sneak: false };
    const events = world.step(STEP, order.move, order.sneak, false);
    if (world.state.lootTaken > lastLoot) {
      lastLoot = world.state.lootTaken;
      lingerUntil = world.state.elapsed + LOOT_LINGER_SECONDS;
    }
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_ESCAPED) break;
  }
  if (world.state.phase === 'caught') return { screen: SCREEN_CAUGHT, best: world.state.score };
  if (world.state.phase === 'escaped') return { screen: SCREEN_ESCAPED, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
