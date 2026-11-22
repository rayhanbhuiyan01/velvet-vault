// The Velvet Vault — the entry point the grader runs (Node 22, standard
// library only). The game itself is plain static files: game/index.html and
// its ES modules, no library, no network request. This file hands the game in:
// it copies game/ and screenshots/ from beside this file into the output
// directory and writes output/dossier.json, the summary the judge reads,
// using the vendored make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source, dest) {
  if (!existsSync(source)) throw new Error(`missing entry folder: ${source}`);
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, 'game'), join(outDir, 'game'));
copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(
  `The Velvet Vault: dossier written to ${join(outDir, 'dossier.json')} ` +
    `(${statSync(join(outDir, 'dossier.json')).size} bytes)`,
);
