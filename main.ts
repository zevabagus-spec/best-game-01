// Sunspire's handover: the program that hands the game in. It copies the
// game/ folder and the screenshots/ folder from beside this file into the
// output directory — /output inside the grader, or $MAKEFUN_OUTPUT_DIR
// anywhere else — and writes dossier.json there, the summary the judge reads,
// built with the vendored make.fun library. Node 22+, standard library only.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps, as the gate states them: the dossier text is capped at
// 163,840 bytes, and an entry is refused when it carries more than 4
// screenshots, a screenshot over 256 KiB, more than 993 files in game/,
// more than 48 MiB of game files, or a game path over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Sunspire handed in: dossier.json is ${Buffer.byteLength(dossier)} bytes.`);
