# Flybrain

Flybrain is a simulator for the entire adult fruit fly brain. It loads all **138,639 neurons** and **15.1 million connections** of the FlyWire connectome, turns every neuron into a simple spiking unit, and lets you stimulate or silence any of them to see what the rest of the brain does.

I built it because the fly connectome became public and I wanted to *play* with it: see a taste signal travel to the neurons that open the fly's mouth, watch a looming shadow reach the escape circuit, and ask what happens when a single cell type is switched off. Flybrain is my attempt to make that fast, visual and easy to share.

## What you can do

- **Replay experiments in 3D.** Every neuron is drawn at its real position. The ones that fire glow, spike by spike, while the brain rotates under your mouse.
- **Run your own.** Stimulate presets like `sugar` or `looming`, any of 8,839 cell types, or individual FlyWire IDs. Silence others. One simulated second takes about 9 seconds on one CPU core.
- **Read the brain's output.** The lab lists the descending and motor neurons that fired, which are the brain's commands to the body, and labels the known ones (feeding, escape, walking…).
- **Talk to it.** Press <kbd>⌘K</kbd> and type what you want: `stimulate sugar at 200 hz, silence CB0248, run`.
- **Keep track.** Every run goes into an experiment log. Tick two runs to compare them neuron by neuron. Export CSVs, copy the equivalent terminal command, or share a link.

## Where to start

1. Open the [lab](/lab/) and replay **Sugar taste → feeding**.
2. Read [How the model works](/docs/how-it-works/) for the science in plain language.
3. Follow [Install and run](/docs/getting-started/) to run new experiments on your own machine.
4. Check the [roadmap](/docs/roadmap/) to see what's coming next: a virtual body, learning, and the male brain.

## Standing on shoulders

The connectome was mapped by the [FlyWire consortium](https://flywire.ai). The neuron model and the packaged connectivity data come from Philip Shiu, Nico Spiller and colleagues ([Shiu et al., *Nature* 2024](https://www.nature.com/articles/s41586-024-07763-9)). Flybrain reimplements their model from scratch and builds the lab, visualisation and tooling around it. See [Credits](/docs/credits/) for full citations.
