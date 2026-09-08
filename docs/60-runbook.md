# Runbook

Status: Draft

## Start

### Local development

```bash
npm install
npm run dev        # http://localhost:5310
```

| Command | What it does | URL |
| :--- | :--- | :--- |
| `npm run dev` | Dev server with hot reload | `http://localhost:5310` |
| `npm run preview` | Serves the production build | `http://localhost:5311` |
| `npm test` | Full test suite (Vitest) | — |
| `npm run build` | Compiles to `dist/` | — |

### Reserved ports

This project owns **5310** (dev) and **5311** (preview), pinned in
[`vite.config.ts`](../vite.config.ts) with `strictPort: true`. The cross-project
allocation table lives outside this repository, at `D:\Development\PORTS.md`.

**Always use `localhost`, never `127.0.0.1`.** They resolve to the same machine but they
are different *origins* for the browser, so `localStorage`, cookies, IndexedDB and service
workers do not carry across. A session saved under one hostname is invisible under the
other.

<details>
<summary>Why <code>strictPort</code> matters — the failure it prevents</summary>

Vite's default behaviour on finding its port taken is to silently increment. So:

1. Project A starts on 5173.
2. Project B starts, finds 5173 busy, and quietly serves on **5174** — while every
   bookmark, README and mental model still says 5173.
3. A stops. B restarts and now takes **5173**.
4. B inherits everything the browser stored for the origin `http://localhost:5173`:
   A's `localStorage`, A's cookies, A's service worker.

The symptom is a session or a saved state from one project appearing inside another, or
disappearing from the one that owned it. The cause is not the code; it is two projects
sharing an origin.

`strictPort: true` turns step 2 into a hard failure with a clear message, which is the
only point at which the problem is cheap to fix.

</details>

### Production

`https://orbe.naindev.com/` — static files on GitHub Pages.

Deployment is automatic: every push to `main` runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which installs, **runs
the test suite**, builds, and publishes `dist/`. A red suite stops the deployment.

## Recovery

### The dev server refuses to start

```
Port 5310 is already in use
```

That is `strictPort` doing its job. Something else holds the port — most likely a previous
`npm run dev` that was not shut down.

```bash
# Windows: find and kill whatever holds the port
netstat -ano | findstr :5310
taskkill /PID <pid> /F
```

Do **not** work around it by letting Vite pick another port. See the note above.

### The deployment failed

Check the run under **Actions → Deploy to GitHub Pages**. The two failure modes are:

| Failure | Meaning | Action |
| :--- | :--- | :--- |
| `npm test` red | A regression reached `main` | Fix forward, or revert the merge commit. The previous deployment stays live. |
| Build error | Usually a bad import path | Reproduce with `npm run build` locally |

The previous version stays served until a new deployment succeeds, so a red pipeline is
never an outage.

### Rollback

```bash
git revert <merge-commit-sha>
git push origin main
```

The push redeploys the reverted state. There is no database and no migration, so a revert
is complete by itself.

### The game loads but nothing moves

The loop is driven by `requestAnimationFrame`, which browsers throttle to zero in a
background or hidden tab. `world.state.status` will read `playing` while
`engine.time` does not advance. This is expected; it is not a bug.

```js
// In the console:
GAME.engine.fps          // 0 while the tab is hidden
document.hidden          // true
```

## Known limits

| Limit | Value | Note |
| :--- | :--- | :--- |
| Bundle size | ~675 kB (173 kB gzipped) | Almost entirely Three.js. Flagged as a follow-up in `specs/024-flow-and-feel/checklist.md` §4. |
| Sombras per Ciclo | 30 | Hard cap. The contact solver is O(n²). |
| Physics sub-steps | 4 per frame | Cap, so a stalled tab cannot spiral. |
| Persistence | 5 `localStorage` keys | No backend, no accounts, no saved runs. |
| Type checking | Not a CI gate | 451 pre-existing errors; see `docs/11-open-questions.md` OQ-002. |
| Committed `dist/` | Tracked in git | Redundant now that CI builds it. Removing it is a separate decision. |

## Console access

The running game is exposed as `GAME` for debugging and modding:

```js
GAME.CONFIG.player.jump = 20;      // retune live
GAME.world.removeSystem('enemy');  // walk the level in peace
GAME.world.state;                  // everything the HUD reads
GAME.engine.fps;
```
