# Changelog

Every notable change to Flybrain, newest first. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [SemVer](https://semver.org).

## [0.4.0] – 2026-09-28

Eight apps where a real fly brain takes control, running live in the browser.

### Added
- **In-browser simulator** (`web/lib/sim.ts`): a line-by-line port of the Numba LIF kernel, validated against Python (sugar → MN9 117 vs 122 Hz, looming → giant fiber within a few Hz).
- **Circuit packs** (`scripts/build_circuits.py`): per-app sub-circuits (taste 5,164 neurons, loom 5,804, smell 4,061, sandbox 6,861) that reproduce the full 138,639-neuron brain exactly for every tested condition. 1.4–3 MB each.
- **Apps hub** (`/apps`) and eight apps, each with an autopilot where the brain decides:
  - **Fly Food Critic**: dishes → sugar/bitter/salt neurons, and MN9 extends an animated proboscis and scores the dish.
  - **Smell-o-vision**: odour fingerprints in 20 ms sniffs, plus brain-steered plume tracking (7/12 sources found vs 3/12 random).
  - **Fly Brain Surgeon**: silence cell types to stop feeding or break the bitter veto, with a greedy auto-surgeon.
  - **Flappy Fly**: looming → LPLC2 → giant fiber spikes → flaps (mean ~8 pipes; scrambled 0).
  - **Twitch Plays Fly Brain**: anonymous Twitch chat → stimuli, demo bots, OBS overlay, self-directed autopilot.
  - **Fly Brain Radio**: spikes → Web Audio notes, 5 stations, fly-DJ autopilot, recording.
  - **Is It Really the Fly?**: real wiring vs scrambled targets vs shuffled strengths, with a graded battery.
  - **Fly Gangs**: mutant brains compete at feast, poison and dodge, and the winners breed.
- **Scrambled wiring** switch in most apps, and a shuffled-weights control in the simulator.
- Live mode for the WebGL brain (`LiveSource`), so any simulation can light up the 3D map.
- **SEO**: per-page titles, descriptions, keywords and canonicals; Open Graph and Twitter cards with rendered 1200×630 images (`scripts/make_og.py`); WebApplication, FAQPage, BreadcrumbList and ItemList JSON-LD; `sitemap.xml` and `robots.txt`.
- Docs: "Apps and autopilot" page with methods and validation numbers. `scripts/validate_apps.py` for the full-brain checks.

## [0.3.0] – 2026-09-28

The Next.js release: a proper home for the project.

### Added
- **New website** (`web/`), built with Next.js and statically exported, deployable to Vercel:
  - **Landing page** with a live rotating 3D brain replaying a real experiment, animated explainers (a live neuron you can drive with sliders, a toy circuit you can lesion by clicking), the experiment gallery, a guide, the roadmap and credits.
  - **Lab**: a WebGL renderer that draws all 138,639 neurons at 60 fps with glow, plus brain output readout, population chart, spike raster and sortable neuron table.
  - **Command center** (⌘K): plain-language commands such as `stimulate sugar at 200 hz, silence CB0248, run`. Autocompletes cell types, presets, recorded runs and active neurons.
  - **Experiment log and run comparison**: tick two runs and see which neurons gained or lost activity.
  - Share links (`?run=` / `?cmd=`), CSV export, copy-as-CLI.
  - **Connect a simulator**: the hosted lab can drive a local `flybrain serve` for live runs.
  - **Documentation site** with 14 pages, including this changelog, the roadmap and the lab notebook.
- **Looming threat → escape** experiment (`looming` preset: 210 LPLC2 neurons).
- `scripts/export_web_data.py` exports geometry and recorded runs as static JSON, with sparklines.
- Server: CORS and private-network headers, and it serves the built web app when present.

### Changed
- Replaced the single-file `docs/index.html` demo with the Next.js site.
- Vercel config now builds `web/`.

## [0.2.0] – 2026-09-28

### Added
- Local web interface (`python -m flybrain serve`): 3D brain map with spike replay, brain output, population chart, raster and neuron table.
- Neuron annotations (cell type, class, side, transmitter, 3D position) from FlyWire.
- Presets: `giant_fiber`, `moonwalker`, `forward_walk`, `steer`, `ppl1_dopamine`, `clock_lnv`.
- Standalone recorded-runs page and first Vercel config.

## [0.1.0] – 2026-09-28

### Added
- Whole-brain leaky integrate-and-fire simulator in NumPy + Numba, reimplementing Shiu et al. (2024) over the FlyWire v783 connectome (138,639 neurons, 15.1M connections).
- `flybrain fetch`, `flybrain presets` and `flybrain run` CLI, plus a Python API.
- Validated against the paper: sugar-neuron stimulation drives MN9 at ~115 Hz.
