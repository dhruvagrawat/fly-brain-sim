# Apps and autopilot

Flybrain has eight [apps](/apps/). Each runs a slice of the real fruit fly connectome live in your browser. Every app has an **autopilot**, where the fly's own simulated neurons make the decisions, and most have a **Scrambled** switch that rewires the same neurons at random, to show the behaviour comes from the real wiring.

| App | Circuit | What the brain controls in autopilot |
|---|---|---|
| [Fly Food Critic](/apps/food-critic/) | taste, 5,164 neurons | How far the proboscis extends, set by MN9. The score is MN9's rate. |
| [Smell-o-vision](/apps/smell-o-vision/) | smell, 4,061 neurons | Steering in an odour plume, from left vs right projection-neuron spikes |
| [Fly Brain Surgeon](/apps/brain-surgeon/) | taste, 5,164 neurons | The auto-surgeon's lesion search, scored on MN9 |
| [Flappy Fly](/apps/flappy-fly/) | looming, 5,804 neurons | Every flap is a giant fiber (DNp01) spike |
| [Twitch Plays Fly Brain](/apps/twitch-plays/) | sandbox, 6,861 neurons | Its next stimulus when chat is quiet, chosen from its own outputs |
| [Fly Brain Radio](/apps/brain-radio/) | sandbox, 6,861 neurons | Station choice, filter and panning |
| [Is It Really the Fly?](/apps/real-or-fake/) | taste + looming | Runs and grades the real-vs-control battery |
| [Fly Gangs](/apps/fly-gangs/) | taste + looming | Every event score. Winners breed mutant children. |

## Circuit packs: a full brain's behaviour in a few MB

The full model has 138,639 neurons and 15 million connections. That's about 100 MB of data and roughly 9 s of CPU per simulated second, too much for a browser. But in a leaky integrate-and-fire network, a neuron that never spikes has no influence on anything. So for each app, `scripts/build_circuits.py`:

1. runs the **full brain** in Python for every condition the app can produce (every taste mix and rate, every looming side and rate, every odour on each antenna)
2. keeps every neuron that fired in any condition, plus the input and output neurons, plus (for lesion apps) every neuron receiving 40+ excitatory synapses from that set, since those could fire once inhibition is removed
3. exports the connections among those neurons as a compact binary (`web/public/data/circuits/<pack>.bin`)
4. re-simulates every condition **on the circuit alone** and records the result next to the full-brain result

| Pack | Neurons | Synapse connections | Size | Full brain vs circuit |
|---|---|---|---|---|
| taste | 5,164 | 532,887 | 2.2 MB | identical in all 12 conditions |
| loom | 5,804 | 742,466 | 3.0 MB | identical in all 10 conditions |
| smell | 4,061 | 351,281 | 1.4 MB | identical in all 18 conditions |
| sandbox | 6,861 | 565,342 | 2.3 MB | identical in all 18 conditions |

The browser simulator (`web/lib/sim.ts`) is a line-by-line port of the Numba kernel: same equations, constants, update order and 0.1 ms step. It runs at roughly real time on a laptop. Checked against Python: sugar at 200 Hz gives MN9 117 Hz in JS vs 122 Hz in Python (different random numbers), and looming at 10/30/80/150 Hz gives the giant fiber 34/102/177/230 Hz in JS vs 25/105/177/230 Hz in Python.

## Controls

| Control | What changes | Sugar → MN9 | Looming → giant fiber |
|---|---|---|---|
| Real wiring | nothing | 110–123 Hz | 163–177 Hz |
| Scrambled targets | each synapse gets a random target | 0 Hz | 0 Hz |
| Shuffled strengths | same connections, weights and signs shuffled | 0 Hz | 47–73 Hz |

(3 seeds each, 300 ms.) The escape pathway is direct enough that the bare connection map carries part of the signal, but only at about a third of the strength.

## App notes

### Food Critic
Taste profiles are rough, and sour/umami/fat/water sensors aren't modelled. Dish intensities map linearly to 0–200 Hz on 20 sugar, 32 bitter and 9 low-salt neurons (all one side). Full-brain results: sugar 50/100/200 Hz → MN9 15/82/122 Hz, bitter → 0, sugar + bitter → 0, sugar + a little bitter (60 Hz) → 78 Hz, salt → under 10 Hz.

### Smell-o-vision
In this model the smell centre over-excites after about 20 ms and lights most projection neurons whatever the odour. The olfactory system wasn't tuned in the published model. Things I tried and ruled out: removing Kenyon-cell-to-Kenyon-cell connections, removing receptor-to-receptor connections, weakening input onto Kenyon cells (that makes Kenyon cells sparse, about 5%, but the rest still runs away), and isolating the olfactory system. The first 15–20 ms **is** odour-specific, so the app works in 20 ms sniffs (15 ms of input), resetting between sniffs. Receptor input is log-compressed (`0.3 + 0.7·log(1+60c)/log(61)`), as real receptor neurons respond roughly logarithmically.

Steering compares each side's projection-neuron spikes to that side's baseline, a simple form of sensory adaptation. Per-sniff accuracy on which side had more odour: pheromone 80%, ammonia 72%, banana 63%, CO₂ 60%, vinegar 55%. The fly surges upwind while it smells something and casts when it loses the plume, as real flies do. In 12 headless trials per condition it found the source **7/12** times with its brain, versus 3/12 walking randomly, 3–5/12 with scrambled wiring and 2/12 surging upwind without the left/right comparison.

### Flappy Fly
LPLC2 input grows as time-to-contact shrinks: lower pipe within 450 ms if the fly is on a collision course, ground within 380 ms while falling. It's capped at 150 Hz on all 210 LPLC2 neurons. A giant fiber spike triggers a flap (170 ms refractory). The ceiling is soft. Headless, 6 runs: real brain passed 1–13 pipes (mean ~8, ~19 s survival). Scrambled: 0 pipes, under 1 s.

### Twitch Plays
Chat is read anonymously over Twitch's public IRC WebSocket (`justinfan` login), so no token is needed. Per-user cooldown 2.5 s. Sniff commands pulse 20 ms every 300 ms. Autopilot triggers after 5 s of quiet and picks from recent MN9, giant fiber and descending activity, with a boredom counter. Overlay: `/apps/twitch-plays/?overlay=1&channel=<name>`.

### Brain Radio
Up to 7 spikes per frame become notes. The instrument is set by the neuron's class, the pitch by its dorsal–ventral position on a minor pentatonic scale, and the pan by its left–right position. In DJ mode the station changes every 4 bars based on peak MN9 and giant fiber activity. MN9 drives the low-pass filter and the left/right descending balance drives the master pan. Recording uses `MediaRecorder` on the Web Audio output.

### Fly Gangs
Score = MN9 on sugar ÷ 10 + giant fiber on looming ÷ 15 − MN9 on sugar + bitter ÷ 5. The mutation pool is the 40 most active cell types in each circuit. Each round the lowest scorer is replaced by a child of the winner with one change: add a cut, remove one, or swap one.
