# Lab notebook

Dated notes from experiments run with Flybrain: what I tried, the numbers, and what I think they mean. Newest first. Numbers are mean firing rates across trials. "Active" means the neuron fired at least once.

---

## 2026-09-28 · Validating the app circuits

**Taste (full brain, 2 × 500 ms).** Sugar 50/100/200 Hz → MN9 9/77/115 Hz. Bitter (32 neurons) → MN9 0. Salt (9) → 7 Hz. Sugar + bitter → **0** (bitter veto). Sugar + salt → 115. Sugar 200 + bitter 60 → 78 Hz, a partial veto.

**Looming.** LPLC2 (both sides) 20/50/100/150 Hz → giant fiber ~70/140/195/230 Hz. Right-side looming drives the right giant fiber harder (60 vs 33 Hz at 20 Hz input).

**Smell: a limitation.** Any odour at any rate (20–100 Hz) ignites ~10,000 neurons, including ~3,870 Kenyon cells. Things I tried: removing KC→KC edges (294k), removing ORN→ORN edges, scaling input onto KCs by 0.2 (KCs become sparse, ~250 or 5%, but ~6,000 neurons stay active) and isolating the olfactory system (all ~560 PNs still fire). None of them fixed it, so the antennal lobe itself runs away in this model. The first 15–20 ms *is* odour-specific (mould → DA2 only, CO₂ → V, pheromone → DA1, banana → DL1/DM2), so the smell app uses 20 ms sniffs with a reset between them.

**Smell steering.** Per-sniff left-vs-right accuracy with baseline normalisation: pheromone 80%, ammonia 72%, banana 63%, CO₂ 60%, vinegar 55%. Plume navigation (12 trials, 250 sniffs, capture radius 40 px): brain **7/12** (pheromone and banana), random walk 3/12, scrambled 3–5/12, upwind-only 2/12.

**Circuit packs** reproduce the full brain exactly (identical rates) in all 12 taste, 10 looming, 18 smell and 18 sandbox conditions.

**Controls (JS, 3 seeds, 300 ms).** Sugar → MN9: real 110–123 Hz, scrambled targets 0, shuffled strengths 0. Looming → giant fiber: real 163–177 Hz, scrambled targets 0, shuffled strengths **47–73 Hz**. The escape path is direct enough that the bare connection map carries about a third of the signal.

**Flappy Fly** (time-to-contact looming: pipe 450 ms, ground 380 ms). Real brain passes 1–13 pipes (mean ~8, ~19 s survival). Scrambled: 0 pipes, 0.7 s.

**Fly Gangs, first rounds.** Mutants with PVLP011 + PVLP017 silenced (looming-circuit types) beat the Wild Types 22.1 vs 20.4. They dodge slightly better (170 vs 157 Hz) and feast about the same.

---

## 2026-09-28 · Recorded experiment set

Six runs exported for the site (1 s trials):

| Run | Stimulus | Active | Spikes | Notable |
|---|---|---|---|---|
| sugar_feeding | 20 sugar GRNs @ 200 Hz × 5 | 436 | 100,697 | MN9 113 Hz; CB0700 motor neurons ~235 Hz |
| lplc2_loom | 210 LPLC2 @ 150 Hz × 3 | 1,107 | 199,771 | Optic lobe + posterior slope, escape-related DNs |
| forward_walk | DNp09 @ 200 Hz × 3 | 309 | 16,623 | Recruits DNge124, DNa06, DNg98 |
| giant_fiber | DNp01 @ 200 Hz × 3 | 65 | 3,669 | DNpe042, DNp70, DNp103, DNg40 |
| moonwalker | MDN @ 200 Hz × 3 | 29 | 4,416 | Very sparse, mostly other DNs |
| ppl1_dopamine | 16 PPL1 @ 100 Hz × 3 | 10,718 | 1,561,223 | Mushroom-body recruitment in waves at ~300/450/550 ms |

**Takeaway:** stimulating descending neurons produces little brain-side activity, as expected, since their targets are in the VNC. PPL1 recruitment is huge because the model treats dopamine as excitatory. That's a known limitation, and a reason to build proper neuromodulation and plasticity.

---

## 2026-09-28 · Is the feeding pathway robust to lesions?

**Question:** which single neurons does sugar → MN9 depend on?

**Setup:** sugar @ 200 Hz, 2 trials × 500 ms, baseline MN9 = 117 Hz. Silenced each of the top 16 non-stimulated central/descending neurons one at a time, then whole cell types.

**Single neurons:** no single neuron dropped MN9 by more than ~10 Hz (CB0192 → 107 Hz). Silencing DNge031 *raised* MN9 to 163 Hz, so it may be inhibitory feedback onto the feeding motor circuit.

**Whole cell types** (both hemispheres):

| Silenced type | Neurons | MN9 (Hz) |
|---|---|---|
| none (baseline) | 0 | 117 |
| CB0616 | 2 | **90** |
| CB0192 | 2 | 111 |
| CB0910 | 2 | 112 |
| CB0248 | 2 | 129 |

**Takeaway:** the pathway is redundant, with many parallel routes from sugar neurons to MN9. The biggest single-type effect is CB0616 (−23%). Next: silence combinations, and build the automated screen on the roadmap.

---

## 2026-09-28 · Validation against Shiu et al. (2024)

**Setup:** 20 of the paper's 21 sugar GRNs (one ID no longer exists in v783) @ 200 Hz, 3 trials × 1 s.

**Result:** ~410 neurons active, MN9 (`720575940660219265`) at ~116 Hz. That matches the paper's result that sugar activates a few hundred neurons and robustly drives MN9. The Numba reimplementation reproduces the Brian2 model.
