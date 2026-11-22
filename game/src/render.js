// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop colour.
// Flat shapes and canvas text for the HUD and the panels. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.
import { CASES, EXIT, FIELD, FONT, GUARD, LOOT, PALETTE, WALLS } from './config.js';
import { CAMERA } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 140, line: 34, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');
  const timeLabel = cachedLabel('');

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

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    // Checkerboard marble tiles.
    const tile = 80;
    for (let y = 0; y < FIELD.height / tile; y += 1) {
      for (let x = 0; x < FIELD.width / tile; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x * tile, y * tile, tile, tile);
      }
    }
    // The vault corner gets a darker carpet.
    context.fillStyle = PALETTE.vault;
    context.fillRect(1040, 20, 220, 240);
    // Walls, with a lighter top edge so they read as raised.
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
      context.fillStyle = PALETTE.wallTop;
      if (wall.height <= 20) context.fillRect(wall.x, wall.y, wall.width, 4);
      else context.fillRect(wall.x, wall.y, 4, wall.height);
    }
    // Display cases: dark plinths with a glassy top.
    for (const box of CASES) {
      context.fillStyle = PALETTE.case;
      context.fillRect(box.x, box.y, box.width, box.height);
      context.fillStyle = PALETTE.caseGlass;
      context.fillRect(box.x + 6, box.y + 6, box.width - 12, box.height - 12);
    }
    // The vault door, bottom-left of the vault room.
    context.fillStyle = PALETTE.vaultDoor;
    context.fillRect(1020, 160, 20, 100);
    text('VAULT', 1150, 250, 20, PALETTE.vaultDoor, 'center');
  }

  function drawExit(open) {
    context.fillStyle = open ? PALETTE.exitGlow : PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height);
    context.fillStyle = '#0b0d12';
    text('EXIT', EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height / 2 + 7, 18, '#0b0d12', 'center');
    if (open) {
      context.strokeStyle = PALETTE.exitGlow;
      context.lineWidth = 3;
      context.strokeRect(EXIT.x - 4, EXIT.y - 4, EXIT.width + 8, EXIT.height + 8);
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 4 + item.x);
      if (item.id === 'gold') {
        context.fillStyle = PALETTE.lootGold;
        context.globalAlpha = pulse;
        context.fillRect(item.x - 14, item.y - 8, 28, 16);
        context.globalAlpha = 1;
      } else if (item.id === 'emerald') {
        context.fillStyle = PALETTE.lootEmerald;
        context.globalAlpha = pulse;
        context.beginPath();
        context.moveTo(item.x, item.y - 16);
        context.lineTo(item.x + 13, item.y);
        context.lineTo(item.x, item.y + 16);
        context.lineTo(item.x - 13, item.y);
        context.closePath();
        context.fill();
        context.globalAlpha = 1;
      } else {
        // The Star of Meridian: a big faceted diamond.
        context.fillStyle = PALETTE.lootDiamond;
        context.globalAlpha = pulse;
        context.beginPath();
        context.moveTo(item.x, item.y - 22);
        context.lineTo(item.x + 18, item.y - 4);
        context.lineTo(item.x, item.y + 22);
        context.lineTo(item.x - 18, item.y - 4);
        context.closePath();
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = '#dff8ff';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(item.x - 18, item.y - 4);
        context.lineTo(item.x + 18, item.y - 4);
        context.stroke();
      }
    }
  }

  function drawCone(x, y, angle, range, halfAngle, fill, edge) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, PALETTE.coneGuard, PALETTE.coneEdge);
    }
    for (const guard of state.guards) {
      // Body, cap and the torch in the facing direction.
      context.fillStyle = PALETTE.guardBody;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(
        guard.x + Math.cos(guard.angle) * (guard.radius + 3),
        guard.y + Math.sin(guard.angle) * (guard.radius + 3),
        3.5,
        0,
        Math.PI * 2,
      );
      context.fill();
      if (guard.mode === 'hunt') {
        text('!', guard.x, guard.y - guard.radius - 8, 22, PALETTE.alarm, 'center');
      } else if (guard.mode === 'investigate') {
        text('?', guard.x, guard.y - guard.radius - 8, 22, PALETTE.lootGold, 'center');
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, PALETTE.coneCamera, 'rgba(255,80,80,0.35)');
      context.fillStyle = '#22262e';
      context.fillRect(camera.x - 11, camera.y - 8, 22, 16);
      context.fillStyle = state.spotted ? PALETTE.alarm : PALETTE.lootGold;
      context.beginPath();
      context.arc(camera.x, camera.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    // Hooded cloak: a triangle with a round head, in violet.
    context.fillStyle = PALETTE.thiefCloak;
    context.beginPath();
    context.moveTo(thief.x, thief.y - thief.radius - 2);
    context.lineTo(thief.x - thief.radius, thief.y + thief.radius);
    context.lineTo(thief.x + thief.radius, thief.y + thief.radius);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y - 4, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b0d12';
    context.beginPath();
    context.arc(thief.x, thief.y - 4, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 28, 30, 26, PALETTE.text, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(timeLabel(`${minutes}:${String(seconds).padStart(2, '0')}`), FIELD.width / 2, 30, 26, PALETTE.text, 'center');
    text(`Loot ${state.lootTaken}/${state.loot.length}`, FIELD.width - 28, 30, 26, PALETTE.text, 'right');
    // Alarm meter: a labelled bar under the timer.
    const barWidth = 320;
    const barX = (FIELD.width - barWidth) / 2;
    const barY = 64;
    text('ALARM', barX - 10, barY + 2, 18, state.spotted ? PALETTE.alarm : PALETTE.muted, 'right');
    context.fillStyle = PALETTE.alarmTrack;
    context.fillRect(barX, barY, barWidth, 16);
    context.fillStyle = state.alarm > 70 ? PALETTE.alarm : PALETTE.lootGold;
    context.fillRect(barX, barY, barWidth * (state.alarm / 100), 16);
    context.strokeStyle = PALETTE.muted;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barWidth, 16);
    if (state.spotted) text('SPOTTED!', FIELD.width / 2, barY + 24, 20, PALETTE.alarm, 'center');
    // Decoy coins, bottom-left.
    text(`Coins ${state.coins} — click to toss one`, 28, FIELD.height - 34, 20, PALETTE.muted, 'left');
    if (state.lootTaken === state.loot.length) {
      text('All loot pocketed — reach the EXIT!', FIELD.width / 2, FIELD.height - 34, 20, PALETTE.exitGlow, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.wallTop;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 23, PALETTE.lootGold, 'center');
  }

  const TITLE_LINES = [
    'One thief. Three guards. Two cameras. One diamond.',
    'Pocket the gold, the emerald and the Star of Meridian,',
    'then slip out the green EXIT — without tripping the alarm.',
    'Move with WASD or arrows. Hold Shift to sneak.',
    'Click to toss a decoy coin and lure a guard away.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the floor, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawExit(state.lootTaken === state.loot.length);
    drawLoot(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('The Velvet Vault', TITLE_LINES, 'Press Space or click to start the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Caught!', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      drawPanel('Clean getaway!', WIN_LINES, 'Press Space or click to run it again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
