# Roadmap

Where Flybrain is heading. I keep this file current: when something ships it moves to the [changelog](/docs/changelog/) with a date. Ideas and requests are welcome as GitHub issues.

**Status key:** ✅ shipped · 🔨 building · ⏭ next · 🔭 exploring

## ✅ Shipped

- **Whole-brain simulator.** 138,639 LIF neurons, 15.1M connections, ~9 s per simulated second on one core.
- **Lab.** WebGL brain, replay, outputs, charts, neuron table.
- **Command center.** Plain-language commands with autocomplete.
- **Experiment log and comparison.**
- **Docs site, changelog, lab notebook.**
- **Vercel deployment** of the static site.
- **Eight apps with autopilot**, running circuit packs live in the browser: Food Critic, Smell-o-vision, Brain Surgeon, Flappy Fly, Twitch Plays, Brain Radio, Is It Really the Fly?, Fly Gangs.
- **Real vs scrambled controls** built into the apps.

## 🔨 Building: a virtual body

Close the sensorimotor loop. A simple 2D (then 3D) fly in an arena:

- **Senses in.** Visual looming → LPLC2/LC neurons. Taste zones → gustatory neurons. Wind → antennal neurons.
- **Commands out.** Descending neuron rates map to walking speed, turning (DNa02 left vs right), backing up (MDN), escape (DNp01) and feeding (MN9).
- **Real time.** Stream brain state in short windows so the fly reacts while you watch.
- Later: hook into [NeuroMechFly](https://neuromechfly.org) for a physics-based body.

## ⏭ Next: training the brain

The fly learns through dopamine in the mushroom body. The plan:

- **Plasticity rule.** Kenyon cell → MBON synapses weaken when a PPL1 (punishment) or PAM (reward) dopamine neuron fires shortly after the Kenyon cell. This is the standard three-factor rule from the fly literature.
- **Conditioning protocol.** Pair an "odour" (a set of Kenyon cells) with punishment, then test whether the odour alone now shifts MBON output from approach to avoidance.
- **Training UI.** A training tab in the lab: define stimulus, reward and trials, then watch weights change and compare before and after.
- **Save and load trained brains** as weight deltas.

## ⏭ Next: the male brain

- Add **MaleCNS v1.0** (HHMI Janelia + Google Research, September 2026) as a second connectome.
- A dataset switch in the lab, with cross-matched cell types.
- Compare sex-specific circuits: courtship (P1, fru+ neurons) vs the female brain.

## ⏭ Next: circuit screens

- **Automated silencing screens.** For a stimulus and a readout neuron, silence every candidate cell type and rank them by effect. This is the experiment in the lab notebook, done at scale.
- **Path finder.** The strongest connection paths from stimulus to readout, overlaid on the brain.

## ⏭ Next: better smell

The olfactory system over-excites in this model after ~20 ms. The plan: add per-cell-type thresholds and APL/LN inhibition fitted to published odour responses, then let Smell-o-vision use continuous odour instead of sniffs.

## 🔭 Exploring

- **In-browser simulation** with WebGPU, so anyone can run experiments with no install.
- **Public live simulator** on a long-running host, with a job queue.
- **Record-and-share experiments**: saved runs with permalinks.
- **Neuron morphology**: show real neuron skeletons for selected cells.
- **Richer biology**: gap junctions, neuromodulator dynamics, spike-frequency adaptation.
