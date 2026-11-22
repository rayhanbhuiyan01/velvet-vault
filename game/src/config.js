// The Velvet Vault — every tuning number, colour and the whole floor plan in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size. The museum floor is one room the thief crosses:
// entry bottom-left, the Star of Meridian diamond in the vault top-right, exit bottom-right.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 14,
  walkSpeed: 210,
  sneakSpeed: 110,
  /** Sneaking halves how fast the alarm climbs while the thief is seen. */
  sneakSpotFactor: 0.5,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  huntSpeed: 135,
  /** Vision cone: how far a guard can see, and half its spread. */
  viewRange: 235,
  viewHalfAngle: Math.PI / 5.2, // ~35 degrees
  /** Alarm points per second while the thief stands in a guard's cone. */
  spotRate: 46,
  /** Above this alarm the nearest guard hunts the thief; below this it gives up. */
  huntAbove: 55,
  giveUpBelow: 38,
};

export const CAMERA = {
  viewRange: 285,
  viewHalfAngle: Math.PI / 6, // 30 degrees
  spotRate: 32,
  sweepSpeed: 0.55, // radians per second
};

export const ALARM = {
  max: 100,
  /** Points per second the alarm falls while nobody sees the thief. */
  decay: 12,
};

export const COIN = {
  /** Decoy coins the thief carries; a mouse click tosses one. */
  count: 3,
  /** How far from the thief a tossed coin may land. */
  throwRange: 320,
  /** A guard this close to where a coin lands walks over to look. */
  lureRadius: 380,
  investigateSeconds: 4,
};

/** Walls block movement and sight. Display cases do the same (low, but solid). */
export const WALLS = [
  // Outer walls (thickness 20).
  { x: 0, y: 0, width: 1280, height: 20 },
  { x: 0, y: 700, width: 1280, height: 20 },
  { x: 0, y: 0, width: 20, height: 720 },
  { x: 1260, y: 0, width: 20, height: 720 },
  // Interior partition, left of centre: two segments with a doorway between them.
  { x: 400, y: 20, width: 20, height: 240 },
  { x: 400, y: 460, width: 20, height: 240 },
  // Interior partition, right of centre: two segments with a doorway between them.
  { x: 860, y: 20, width: 20, height: 240 },
  { x: 860, y: 460, width: 20, height: 240 },
  // The vault's walls (top-right corner): a room with one door at its bottom-left.
  { x: 1020, y: 260, width: 240, height: 20 },
  { x: 1020, y: 20, width: 20, height: 140 },
];

/** Display cases: solid furniture the thief and the guards walk around. */
export const CASES = [
  { x: 520, y: 120, width: 120, height: 60 }, // gold bar rests just below it
  { x: 760, y: 480, width: 120, height: 60 }, // emerald rests just below it
  { x: 180, y: 300, width: 120, height: 60 }, // painting case
  { x: 180, y: 560, width: 140, height: 56 }, // sculpture plinth, by the entry
];

/** Every solid rectangle: walls and cases together. */
export const SOLIDS = [...WALLS, ...CASES];

/** The three loot pieces. The diamond sits inside the vault, behind its door. */
export const LOOT = [
  { id: 'gold', name: 'Gold Bar', x: 580, y: 205, value: 100, radius: 16 },
  { id: 'emerald', name: 'Emerald', x: 760, y: 575, value: 150, radius: 16 },
  { id: 'diamond', name: 'Star of Meridian', x: 1150, y: 120, value: 400, radius: 20 },
];

export const ENTRY = { x: 70, y: 640 };
export const EXIT = { x: 1210, y: 640, width: 50, height: 60 };

/** Guard patrol routes: waypoints each guard walks in a loop. */
export const GUARDS = [
  { name: 'Rook', waypoints: [{ x: 340, y: 200 }, { x: 340, y: 520 }], speed: 72 },
  { name: 'Bishop', waypoints: [{ x: 760, y: 120 }, { x: 760, y: 420 }], speed: 84 },
  {
    name: 'Knight',
    waypoints: [
      { x: 950, y: 330 },
      { x: 1180, y: 330 },
      { x: 1180, y: 560 },
      { x: 950, y: 560 },
    ],
    speed: 78,
  },
];

/** Wall cameras: a fixed mount, a centre angle and how far it sweeps each way. */
export const CAMERAS = [
  { x: 640, y: 26, centre: Math.PI / 2, sweep: 1.05 }, // top wall, looks down
  { x: 1254, y: 420, centre: Math.PI, sweep: 0.9 }, // right wall, looks left
];

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#171a21',
  floorB: '#1c2029',
  wall: '#3a4152',
  wallTop: '#4a5266',
  case: '#2b3242',
  caseGlass: '#5d7290',
  vault: '#241d10',
  vaultDoor: '#8a6d2f',
  exit: '#1f7a44',
  exitGlow: '#2fd06a',
  thief: '#7b5cff',
  thiefCloak: '#4a3499',
  guard: '#e8b13c',
  guardBody: '#2f6fb2',
  coneGuard: 'rgba(232, 177, 60, 0.20)',
  coneCamera: 'rgba(255, 80, 80, 0.16)',
  coneEdge: 'rgba(232, 177, 60, 0.35)',
  lootGold: '#f2c94c',
  lootEmerald: '#37d67a',
  lootDiamond: '#7fe7ff',
  alarm: '#e5534b',
  alarmTrack: '#3a2020',
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: '#20242e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
