// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 museum floor is scaled to fit the window and centred, the
// margin filled with the backdrop colour. Canvas shapes and text throughout;
// no images, no network.
import { CASES, COINS, EXIT, FIELD, FONT, PALETTE, THIEF, VAULT, VISION, WALL } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPED = 'escaped';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 640, top: 150, line: 36, bottom: 76 };

function drawCone(context, x, y, dir, halfAngle, range, colour) {
  context.fillStyle = colour;
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  context.closePath();
  context.fill();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Map a pointer position on the canvas back to floor coordinates. */
  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  function drawFloor() {
    // Two-tone marble checker, then the walls with a gold trim line.
    const tile = 80;
    for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
      for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, WALL);
    context.fillRect(0, FIELD.height - WALL, FIELD.width, WALL);
    context.fillRect(0, 0, WALL, FIELD.height);
    context.fillRect(FIELD.width - WALL, 0, WALL, FIELD.height);
    context.strokeStyle = PALETTE.wallTrim;
    context.lineWidth = 2;
    context.strokeRect(WALL + 1, WALL + 1, FIELD.width - WALL * 2 - 2, FIELD.height - WALL * 2 - 2);
  }

  function drawVault(state) {
    // The vault room: gold-outlined walls, and a glowing doorway in the gap.
    context.fillStyle = PALETTE.vaultWall;
    context.fillRect(VAULT.wallV.x, VAULT.wallV.y, VAULT.wallV.w, VAULT.wallV.h);
    context.fillRect(VAULT.wallH.x, VAULT.wallH.y, VAULT.wallH.w, VAULT.wallH.h);
    context.strokeStyle = PALETTE.vaultGlow;
    context.lineWidth = 2;
    context.strokeRect(VAULT.wallV.x, VAULT.wallV.y, VAULT.wallV.w, VAULT.wallV.h);
    context.strokeRect(VAULT.wallH.x, VAULT.wallH.y, VAULT.wallH.w, VAULT.wallH.h);
    context.fillStyle = state.exitOpen ? PALETTE.exitOpen : PALETTE.vaultGlow;
    context.fillRect(VAULT.doorX, VAULT.doorY - 40, VAULT.wallV.w, 80);
    text('VAULT', 1130, 60, 22, PALETTE.vaultGlow, 'center');
  }

  function drawCases() {
    for (const c of CASES) {
      context.fillStyle = PALETTE.caseGlass;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = PALETTE.caseEdge;
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(255,255,255,0.25)';
      context.beginPath();
      context.moveTo(c.x + 6, c.y + 6);
      context.lineTo(c.x + c.w - 6, c.y + 6);
      context.stroke();
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      if (item.id === 'gold') {
        context.fillStyle = PALETTE.gold;
        context.fillRect(item.x - 16, item.y - 8, 32, 16);
        context.fillStyle = 'rgba(255,255,255,0.45)';
        context.fillRect(item.x - 16, item.y - 8, 32, 5);
      } else if (item.id === 'emerald') {
        context.fillStyle = PALETTE.emerald;
        context.beginPath();
        context.moveTo(item.x, item.y - 16);
        context.lineTo(item.x + 13, item.y);
        context.lineTo(item.x, item.y + 16);
        context.lineTo(item.x - 13, item.y);
        context.closePath();
        context.fill();
      } else {
        // The Star of Meridian: a four-pointed star that glints white-blue.
        context.fillStyle = PALETTE.diamond;
        context.beginPath();
        context.moveTo(item.x, item.y - 20);
        context.lineTo(item.x + 6, item.y - 6);
        context.lineTo(item.x + 20, item.y);
        context.lineTo(item.x + 6, item.y + 6);
        context.lineTo(item.x, item.y + 20);
        context.lineTo(item.x - 6, item.y + 6);
        context.lineTo(item.x - 20, item.y);
        context.lineTo(item.x - 6, item.y - 6);
        context.closePath();
        context.fill();
      }
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(item.x, item.y, 24, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawExit(state) {
    context.fillStyle = state.exitOpen ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.fillStyle = '#ffffff';
    text(state.exitOpen ? 'EXIT — OPEN' : 'EXIT — LOCKED', EXIT.x + EXIT.w / 2, EXIT.y + 24, 16, '#ffffff', 'center');
  }

  function drawTossed(state) {
    for (const coin of state.tossed) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(coin.x, coin.y, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(242,201,76,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(coin.x, coin.y, 7 + (COINS.ringSeconds - coin.ttl) * 6, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const alerted = guard.mode !== 'patrol';
      drawCone(
        context, guard.x, guard.y, guard.dir,
        VISION.guardHalfAngle, VISION.guardRange,
        alerted ? PALETTE.coneAlert : PALETTE.cone,
      );
      // The guard: a navy round body, a cap brim pointing where he looks.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.dir) * 10, guard.y + Math.sin(guard.dir) * 10, 7, 0, Math.PI * 2);
      context.fill();
      text(guard.name, guard.x, guard.y - 22, 13, PALETTE.muted, 'center');
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(
        context, camera.x, camera.y, camera.angle,
        VISION.cameraHalfAngle, VISION.cameraRange, PALETTE.cameraCone,
      );
      context.fillStyle = '#5a6b8a';
      context.fillRect(camera.x - 10, camera.y - 8, 20, 16);
      context.fillStyle = '#ff5a4e';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 8, camera.y + Math.sin(camera.angle) * 8, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const radius = thief.sneaking ? 11 : THIEF.radius;
    // A hooded figure: a dark cloak, a pale face, and a short nose of direction.
    context.fillStyle = PALETTE.thiefCloak;
    context.beginPath();
    context.arc(thief.x, thief.y, radius + 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, radius - 4, 0, Math.PI * 2);
    context.fill();
    if (thief.sneaking) {
      context.strokeStyle = 'rgba(232,228,240,0.6)';
      context.setLineDash([4, 4]);
      context.beginPath();
      context.arc(thief.x, thief.y, radius + 8, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(10,8,18,0.72)';
    context.fillRect(0, 0, FIELD.width, 44);
    text(`Score ${state.score}`, 30, 29, 24, PALETTE.hud, 'left');
    text(`Loot ${state.lootTaken}/3`, 300, 29, 24, PALETTE.hud, 'left');
    text(`Coins ${state.coinsLeft}`, 470, 29, 24, PALETTE.hud, 'left');
    // The alarm meter: a bar that fills red as the guards close in.
    const barX = 640;
    const barW = 320;
    context.fillStyle = '#2a2338';
    context.fillRect(barX, 12, barW, 20);
    context.fillStyle = PALETTE.alarm;
    context.fillRect(barX, 12, (barW * state.alarm) / 100, 20);
    context.strokeStyle = state.alarm >= 55 ? PALETTE.alarm : PALETTE.muted;
    context.lineWidth = 2;
    context.strokeRect(barX, 12, barW, 20);
    text('ALARM', barX - 10, 29, 20, state.alarm >= 55 ? PALETTE.alarm : PALETTE.muted, 'right');
    text(`${Math.round(state.alarm)}%`, barX + barW + 12, 29, 20, PALETTE.hud, 'left');
    if (state.seenBy) {
      text(state.seenBy === 'guard' ? 'SPOTTED!' : 'ON CAMERA!', FIELD.width - 30, 29, 24, PALETTE.alarm, 'right');
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10,8,18,0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.wallTrim;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 78, 46, titleColor || PALETTE.hud, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'A museum floor at night. Three guards, two cameras, three treasures.',
    'Pocket the Gold Bar, the Emerald and the Star of Meridian,',
    'then slip out through the exit before the alarm hits 100.',
    'Move: WASD or arrows. Sneak: Shift. Toss a decoy coin: click.',
    'Pause: P.  Mute: M.',
    '',
  ];
  const PAUSED_LINES = ['The guards wait for no one — except right now.'];
  const CAUGHT_LINES = ['', 'The alarm hit 100 and the guards closed in.'];
  const ESCAPED_LINES = ['', 'Every treasure pocketed. Nobody saw a thing.'];

  /** Paint one frame: the floor, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawVault(state);
    drawCases();
    drawExit(state);
    drawLoot(state);
    drawTossed(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = `Best getaway: ${best}`;
      drawPanel('THE VELVET VAULT', TITLE_LINES, 'Press Space or click to begin the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to carry on');
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = `Score ${state.score} — Loot ${state.lootTaken}/3`;
      drawPanel('CAUGHT!', CAUGHT_LINES, 'Press Space or click to try again', PALETTE.alarm);
    } else if (screen === SCREEN_ESCAPED) {
      ESCAPED_LINES[0] = `Score ${state.score} — Loot 3/3`;
      drawPanel('CLEAN GETAWAY!', ESCAPED_LINES, 'Press Space or click to steal again', PALETTE.exitOpen);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
