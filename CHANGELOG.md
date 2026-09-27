# Changelog

Every notable change to Flybrain, newest first. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [SemVer](https://semver.org).

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
