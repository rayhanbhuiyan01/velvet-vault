// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from
// a fresh world for a fixed number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// - start: the title screen over guards on patrol.
// - play: the thief sneaks toward the nearest loot, backing off when a cone catches it.
// - end: a reckless thief runs straight at the loot and is caught, alarm full.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 12;

/** Unit direction from (x,y) toward (tx,ty), continuous so the thief slides along walls. */
function dirTo(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** The nearest loot the thief has not pocketed yet, or null. */
function nearestLoot(state) {
  let best = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.thief.x, item.y - state.thief.y);
    if (d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

/** The nearest guard, and how far away it is. */
function nearestGuard(state) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y);
    if (d < bestDist) {
      best = guard;
      bestDist = d;
    }
  }
  return { guard: best, dist: bestDist };
}

/**
 * Where the thief is headed: the nearest loot (via the vault door when the diamond is the
 * target and the thief is still outside the vault), or the exit once every piece is pocketed
 * (via the vault door when the thief is still inside the vault).
 */
function currentTarget(state) {
  if (state.lootTaken === state.loot.length) {
    if (state.thief.x > 1040 && state.thief.y < 260) return { x: 1030, y: 210 };
    return { x: 1210, y: 640 };
  }
  const target = nearestLoot(state);
  if (!target) return null;
  if (target.id === 'diamond' && state.thief.y > 280) return { x: 1030, y: 210 };
  return target;
}

/**
 * Cautious autopilot: head for the current target, sneak near a guard, and when a cone catches
 * the thief, step sideways out of it (perpendicular to the line from the guard) for a moment.
 * A stuck counter watches for the classic wedge: pushing straight into a case with the target
 * dead ahead moves nothing, so after half a second of no progress the thief sidesteps.
 */
function cautiousPilot(state, stuck) {
  const target = currentTarget(state);
  if (!target) return { move: { x: 0, y: 0 }, sneak: false };
  const { guard, dist } = nearestGuard(state);
  let move = dirTo(state.thief.x, state.thief.y, target.x, target.y);
  if (stuck.sidestep > 0) {
    stuck.sidestep -= 1;
    move = { x: -move.y * stuck.side, y: move.x * stuck.side };
  } else if (state.spotted && guard) {
    // Step perpendicular to the guard's line of sight, away from the guard.
    const dx = state.thief.x - guard.x;
    const dy = state.thief.y - guard.y;
    const len = Math.hypot(dx, dy) || 1;
    move = { x: -dy / len, y: dx / len };
  }
  return { move, sneak: dist < 200 };
}

/** Reckless autopilot: straight at the nearest loot, never sneaking, never dodging. */
function recklessPilot(state) {
  const target = nearestLoot(state);
  if (!target) return { move: { x: 0, y: 0 }, sneak: false };
  return { move: dirTo(state.thief.x, state.thief.y, target.x, target.y), sneak: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // The thief's last position, checked every half second for the wedge: no progress while a
    // target is still out there means sidestep for a moment.
    const stuck = { sidestep: 0, side: 1, x: world.state.thief.x, y: world.state.thief.y };
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const pilot = cautiousPilot(world.state, stuck);
      const events = world.step(STEP, pilot.move, pilot.sneak, false, null);
      if (index % 30 === 29) {
        const moved = Math.hypot(world.state.thief.x - stuck.x, world.state.thief.y - stuck.y);
        if (moved < 2) {
          // A long sidestep, alternating sides: one side walks the thief clear of a case's
          // top edge, the other walks it back, so a single short step would loop forever.
          stuck.sidestep = 90;
          stuck.side = -stuck.side;
        }
        stuck.x = world.state.thief.x;
        stuck.y = world.state.thief.y;
      }
      if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
    }
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // end: run reckless at the loot for a while; if the thief is still free, walk up ahead of the
  // nearest guard and wait inside its vision cone until the alarm fills.
  for (let index = 0; index < 40 / STEP; index += 1) {
    const pilot = recklessPilot(world.state);
    const events = world.step(STEP, pilot.move, pilot.sneak, false, null);
    if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
  }
  if (!world.state.over && !world.state.escaped) {
    const stuck = { sidestep: 0, side: 1, x: world.state.thief.x, y: world.state.thief.y };
    for (let index = 0; index < 90 / STEP; index += 1) {
      const thief = world.state.thief;
      let dest;
      if (thief.x > 1040 && thief.y < 260) {
        dest = { x: 1030, y: 210 }; // out of the vault first
      } else {
        const { guard } = nearestGuard(world.state);
        dest = { x: guard.x + Math.cos(guard.angle) * 80, y: guard.y + Math.sin(guard.angle) * 80 };
      }
      const dist = Math.hypot(dest.x - thief.x, dest.y - thief.y);
      let move = dist < 12 ? { x: 0, y: 0 } : dirTo(thief.x, thief.y, dest.x, dest.y);
      if (stuck.sidestep > 0) {
        stuck.sidestep -= 1;
        move = { x: -move.y * stuck.side, y: move.x * stuck.side };
      }
      const events = world.step(STEP, move, false, false, null);
      if (index % 30 === 29) {
        // Only when the thief was travelling: standing still at the hover point is not stuck.
        const moved = Math.hypot(thief.x - stuck.x, thief.y - stuck.y);
        if (moved < 2 && dist >= 12) {
          stuck.sidestep = 90;
          stuck.side = -stuck.side;
        }
        stuck.x = thief.x;
        stuck.y = thief.y;
      }
      if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
    }
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
