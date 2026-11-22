// The Velvet Vault — every number that tunes the heist, in one place.
// The museum floor is a fixed 1280x720 logical space; the renderer scales it
// to the window, so nothing below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

// Outer wall thickness; the playable floor is the rectangle inside it.
export const WALL = 24;

/** Fixed simulation step, in seconds: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 14,
  walkSpeed: 205,
  sneakSpeed: 115,
  startX: 90,
  startY: 620,
};

/** Vision: how far a guard or a camera can spot the thief, and how wide its cone is. */
export const VISION = {
  guardRange: 250,
  guardHalfAngle: 0.62,
  cameraRange: 300,
  cameraHalfAngle: 0.55,
};

/** Alarm 0..100. Seen by a guard it climbs fast; a camera is a little slower.
 *  Sneaking halves the climb. Hidden, it drains at ALARM_DECAY per second. */
export const ALARM = {
  guardRate: 65,
  cameraRate: 55,
  decay: 12,
  caughtAt: 100,
  sneakFactor: 0.5,
  warnAt: 55,
};

export const COINS = { start: 3, lureRange: 430, ringSeconds: 6 };

/** The three loot pieces, in the order a careful thief pockets them. */
export const LOOT = [
  { id: 'gold', name: 'Gold Bar', value: 100, x: 380, y: 285 },
  { id: 'emerald', name: 'Emerald', value: 150, x: 720, y: 545 },
  { id: 'diamond', name: 'Star of Meridian', value: 400, x: 1130, y: 200 },
];

/** Solid display cases and plinths the thief (and a tossed coin's lure) must walk around. */
export const CASES = [
  { x: 300, y: 150, w: 160, h: 70, label: 'Gold Room case' },
  { x: 640, y: 420, w: 160, h: 70, label: 'Emerald case' },
  { x: 180, y: 480, w: 120, h: 60, label: 'Marble plinth' },
  { x: 520, y: 120, w: 90, h: 90, label: 'Sculpture' },
];

/** The vault in the top-right corner: two walls with a single door gap between them. */
export const VAULT = {
  // Vertical wall: x 980..1004, y 24..300. Horizontal wall: y 380..404, x 980..1256.
  wallV: { x: 980, y: 24, w: 24, h: 276 },
  wallH: { x: 980, y: 380, w: 276, h: 24 },
  // The gap the thief slips through, and the doorway's centre.
  doorX: 992,
  doorY: 340,
};

/** The exit doorway in the bottom wall; it only opens once every loot piece is pocketed. */
export const EXIT = { x: 580, y: 660, w: 120, h: 36 };

export const GUARDS = [
  {
    name: 'Marlowe',
    x: 180, y: 330,
    waypoints: [{ x: 180, y: 330 }, { x: 860, y: 330 }],
    speed: 92,
  },
  {
    name: 'Vesper',
    x: 880, y: 110,
    waypoints: [{ x: 880, y: 110 }, { x: 880, y: 600 }],
    speed: 80,
  },
  {
    name: 'Otto',
    x: 320, y: 585,
    waypoints: [{ x: 320, y: 585 }, { x: 1020, y: 585 }],
    speed: 102,
  },
];

export const CAMERAS = [
  { x: 500, y: 24, sweepMin: 0.7, sweepMax: 2.44, sweepSpeed: 0.55, startAngle: 1.57 },
  { x: 1256, y: 500, sweepMin: 2.24, sweepMax: 4.04, sweepSpeed: 0.45, startAngle: Math.PI },
];

/** Escape bonus: up to 400 for speed, plus 25 per unthrown decoy coin. */
export const BONUS = { timeMax: 400, timePerSecond: 8, perCoin: 25 };

export const PALETTE = {
  backdrop: '#0a0812',
  floorA: '#1c1626',
  floorB: '#221a30',
  wall: '#171221',
  wallTrim: '#8a6d2f',
  vaultWall: '#2c2338',
  vaultGlow: '#c9a227',
  caseGlass: '#3a4a63',
  caseEdge: '#7d90b5',
  thief: '#e8e4f0',
  thiefCloak: '#4a3a6e',
  guard: '#2e4a7a',
  guardCap: '#1c2f52',
  cone: 'rgba(242, 201, 76, 0.16)',
  coneAlert: 'rgba(229, 83, 75, 0.28)',
  cameraCone: 'rgba(120, 180, 255, 0.13)',
  gold: '#f2c94c',
  emerald: '#3ecf6e',
  diamond: '#bfe9ff',
  exitLocked: '#7a2e2e',
  exitOpen: '#2fae5f',
  hud: '#eef1f5',
  muted: '#9a93ad',
  alarm: '#e5534b',
  panel: '#171221',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best getaway score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
