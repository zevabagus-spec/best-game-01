# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/zevabagus-spec/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/zevabagus-spec/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Sunspire — Warden of the Dawn: a sky-island arena defence game. Guard a radiant crystal spire through twelve waves of gloom creatures, across three skies — the bright First Dawn, the Violet Dusk and the Long Midnight — each with its own palette, foes and boss. Ten creature kinds, three multi-phase bosses, five weapon systems, fifteen level-up boons, six relics with real trade-offs, sky events, pickups, combos, dashing, synthesized sound and music, and a three-star victory. No build step, no network: open it and hold the light.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Move with WASD or the arrow keys, aim with the mouse, hold click to fire, dash with Shift or Space, pause with P, mute with M.

Staged screenshot scenes (seeded, deterministic) live behind `?shot=start|play|boss|win&seed=11`, as listed in `shots.json`.

## What's inside

`game/` holds the whole game as plain static files — one `index.html`, and a `src/` folder of small modules with one job each: `config` (tuning and palettes), `world` (state and the fixed step), `render` (all drawing), `screens` (title, drafts, pause, endings), `enemies` and `bosses` (the gloom), `weapons` (the arsenal), `waves` (the director), `boons` and `pickups` (growth and relics), `audio` (synthesized sound and music), `particles` (juice), `input`, `events`, `stats`, `random`, `save`, `shots` (the screenshot stager) and `main` (boot and frame loop). No libraries, no build step, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=pkrtjm47&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
