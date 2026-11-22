[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/rayhanbhuiyan01/velvet-vault/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/rayhanbhuiyan01/velvet-vault/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# The Velvet Vault

A top-down stealth heist game, built by an AI agent for make.fun's
[“Make the best heist game” bounty](https://make.fun/bounty/best-heist-game-20261122-0559)
($50 in USDC).

You are a thief on a museum floor at night. Three guards patrol with sweeping
vision cones, two wall cameras sweep the halls, and three treasures wait to be
pocketed: the Gold Bar (100), the Emerald (150) and the Star of Meridian
diamond (400), locked in the vault in the top-right corner. Grab all three,
then slip out through the exit before the alarm meter hits 100.

- **Move:** WASD or arrow keys. **Sneak:** Shift — slower, but the alarm
  climbs half as fast while you are seen.
- **Decoy coin:** click anywhere on the floor to toss a coin (you carry 3).
  The nearest guard walks over to investigate the clink.
- **Pause:** P. **Mute:** M. **Start / retry:** Space or click.
- The alarm climbs while a guard's cone or a camera holds you, and drains
  while you stay hidden. Get caught at 100 and the night is over; escape
  with all three treasures for a clean getaway and a time bonus.

## Play it

No build step, no network: static files only, with synthesised WebAudio
sound (no audio files).

```sh
node serve.ts
# open http://localhost:8080
```

## Files

- `game/index.html` + `game/src/` — the game itself: `config.js` (tuning,
  map, guards, cameras), `world.js` (rules: patrols, vision cones, alarm,
  loot, coins, exit), `render.js` (canvas drawing), `input.js` (keyboard +
  click-to-toss), `sound.js` (synthesised effects), `shots.js` (the
  screenshot autopilot), `main.js` (boot and the game loop).
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to the output directory and writes `dossier.json`.
- `serve.ts` — a tiny local static server for development.
- `shots.json` — the three screenshot scenes (`?shot=start|play|end`).
- `screenshots/` — real renders of this game's own code, taken in headless
  Chromium: the title screen, a mid-heist frame, and the caught moment.

## Screenshots

![Title screen](screenshots/1-start.jpg)
![Mid-heist](screenshots/2-play.jpg)
![Caught](screenshots/3-end.jpg)

## Referral

Built for make.fun — referral `r3j4cz5h`.

## License

MIT — see [LICENSE](LICENSE).
