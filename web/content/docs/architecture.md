# Architecture

```text
fly-brain-sim/
├── flybrain/                 Python package: the simulator
│   ├── data.py               download + load connectome (CSR) and annotations
│   ├── model.py              LIF model, Numba kernel, Params, Result
│   ├── neurons.py            presets and cell-type lookup
│   ├── viz.py                pack results into compact JSON for the web
│   ├── server.py             local HTTP API + serves the web app
│   ├── cli.py                python -m flybrain …
│   └── web/app.html          fallback single-page lab (no build needed)
├── scripts/
│   └── export_web_data.py    run recorded experiments → web/public/data/
├── web/                      Next.js site (landing, lab, docs)
│   ├── app/                  routes: /, /lab, /docs/[slug]
│   ├── components/           BrainGL (WebGL), lab/, home/ explainers
│   ├── lib/                  data decoding, command parser, playback clock
│   ├── content/docs/         these docs, as Markdown
│   └── public/data/          geometry + recorded runs (static JSON)
├── CHANGELOG.md  ROADMAP.md  NOTEBOOK.md    project tracking (rendered in the docs)
└── vercel.json               deploys web/ as a static site
```

## Data flow

```text
FlyWire parquet/csv ──fetch──▶ data/ ──load──▶ Connectome (CSR) ──simulate──▶ Result
                                                                         │
                         viz.result_payload ◀────────────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
 scripts/export_web_data.py                        server.py /api/run
 → web/public/data/runs/*.json                     → live JSON over HTTP
          └───────────────────────┬───────────────────────┘
                                  ▼
                   web lab: decodeRun() → BrainGL + charts
```

## The simulator kernel

`model._run_trial` is a single Numba-compiled loop over time steps. Per step it:

1. adds the ring-buffer slot for this step into each neuron's `g`
2. applies Poisson kicks to stimulated neurons
3. integrates every non-refractory neuron exactly, checks threshold, resets
4. for each spike, walks that neuron's CSR row and adds weights into the ring-buffer slot `delay` steps ahead (unless silenced)

Spikes are recorded into preallocated arrays, which are returned per trial.

## The web app

- **Static export.** `next build` produces plain files in `web/out/`, so it deploys anywhere (Vercel, GitHub Pages) and `flybrain serve` can host it too.
- **BrainGL** draws all neurons in one WebGL `POINTS` call with additive blending. A per-neuron activity buffer is uploaded each frame, and the vertex shader scales and colours points by activity (magma LUT in the fragment shader). An overlay canvas draws the markers.
- **Clock.** Playback time lives outside React, so 60 fps updates never re-render the page. Components subscribe to it directly.
- **Command parser** (`lib/commands.ts`) turns free text into a list of typed actions that the lab executes in order.
- **Live mode.** The lab pings `/api/presets` on its own origin, then on a saved address. When one answers, runs go through `POST /api/run` and polling `/api/status`.

## HTTP API (`flybrain serve`)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/presets` | `[{name, desc, n}]` |
| GET | `/api/geometry` | positions + classes + cell types |
| POST | `/api/run` | starts a job: `{stim, silence, rate, trials, duration, label}` |
| GET | `/api/status` | `{state: running, trial, n_run}` or `{state: done, result}` or `{state: error, error}` |

CORS is open, and the server answers Chrome's private-network preflight, so the hosted site can talk to a local simulator.
