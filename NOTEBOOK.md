# Lab notebook

Dated notes from experiments run with Flybrain: what I tried, the numbers, and what I think they mean. Newest first. Numbers are mean firing rates across trials. "Active" means the neuron fired at least once.

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
