# How the model works

Flybrain doesn't try to simulate every ion channel. It uses the simplest model that still captures what a connectome can tell us: **who talks to whom, how strongly, and with what sign**. Shiu et al. (2024) showed this is surprisingly predictive. Stimulating sugar neurons in their model correctly activates the neurons that trigger feeding, and many of its predictions held up in real flies.

## 1. The wiring

The FlyWire consortium imaged a whole female fly brain with an electron microscope in about 7,000 slices, each 40 nm thick. Automated segmentation plus years of human proofreading traced **138,639 neurons** and **~50 million synapses**. Two neurons connected by five or more synapses count as a connection. That leaves **15.1 million** weighted, directed connections.

Each neuron's neurotransmitter was predicted from the synapses themselves (Eckstein et al. 2024). In the model:

- **acetylcholine** → excitatory (+)
- **GABA** and **glutamate** → inhibitory (−). Glutamate is inhibitory in most of the fly's central brain.
- neuromodulators (dopamine, serotonin, octopamine) → treated as excitatory, a known simplification.

The weight of a connection is `synapse count × sign`.

## 2. The neuron

Every neuron is a leaky integrate-and-fire unit with an exponentially decaying synaptic current:

```text
dv/dt = (v₀ − v + g) / τ_m        membrane voltage
dg/dt = −g / τ_s                  synaptic input
```

When `v` crosses the threshold it emits a spike. `v` and `g` reset, and the neuron stays silent for a refractory period. Each spike adds `w_syn × weight` to the `g` of every target after a short delay.

| Parameter | Value | Source |
|---|---|---|
| Resting / reset potential `v₀` | −52 mV | Kakaria & de Bivort 2017 |
| Threshold `v_th` | −45 mV | Kakaria & de Bivort 2017 |
| Membrane time constant `τ_m` | 20 ms | Kakaria & de Bivort 2017 |
| Synaptic time constant `τ_s` | 5 ms | Jürgensen et al. 2021 |
| Refractory period | 2.2 ms | Lazar et al. 2021 |
| Synaptic delay | 1.8 ms | Paul et al. 2015 |
| Weight per synapse `w_syn` | 0.275 mV | fitted by Shiu et al. |
| Poisson kick for stimulated neurons | 250 × `w_syn` | Shiu et al. |

All of them live in `flybrain/model.py → Params` and can be changed per run.

## 3. Stimulation and silencing

- **Stimulating** a neuron gives it random Poisson input at the chosen rate (e.g. 200 Hz), each input strong enough to make it spike. This mimics optogenetic activation.
- **Silencing** a neuron removes all of its outgoing synapses. It can still fire, but nobody hears it. This mimics genetic silencing.

## 4. The numerics

Shiu et al. used the Brian2 simulator. I rewrote the model from scratch in NumPy + Numba so it runs anywhere with no compiler toolchain:

- Time step 0.1 ms. The linear `v`–`g` system is integrated **exactly** each step (closed-form exponentials) rather than with Euler steps.
- Connections are stored as a CSR matrix indexed by the presynaptic neuron, so a spike touches only its own targets.
- Delays use a ring buffer of pending input, one slot per time step.
- Result: one simulated second of the full brain in about 9 s on a single laptop core. It reproduces the paper's key result: sugar stimulation drives MN9 at ~115 Hz.

## What the model can't do

It's worth being clear about the limits:

- **No learning.** Synapses have fixed weights. Plasticity is on the [roadmap](/docs/roadmap/).
- **No body.** Descending neurons are the model's outputs. There's no ventral nerve cord, muscles or world yet.
- **Point neurons.** Dendrites, gap junctions and neuromodulator dynamics are not modelled.
- **One brain.** The FlyWire brain is from a single female fly. The male brain (MaleCNS, 2026) is coming.
- **Predicted transmitters.** A few percent are wrong, which flips the sign of those connections.

Treat results as **hypotheses to test**, not facts. That is how Shiu et al. used the model too.
