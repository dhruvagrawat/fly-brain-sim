"""Extract "circuit packs" for the in-browser apps and validate them against the full brain.

A neuron that never spikes has no effect on any other neuron in this model. So if we run
the full brain for every condition an app can produce and keep only the neurons that
responded (plus a margin of strongly-driven neighbours for lesion experiments), the
sub-circuit reproduces the full brain for that app. Each pack is validated below.

    python scripts/build_circuits.py            # -> web/public/data/circuits/<id>.{json,bin}
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from flybrain import data, model, neurons  # noqa: E402
from flybrain.data import Connectome  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "circuits"
OUT.mkdir(parents=True, exist_ok=True)

con = data.load()
ann = data.load_annotations(con)
raw = pd.read_csv(data.DEFAULT_DATA_DIR / data.ANNOTATIONS_FILE, sep="\t", low_memory=False,
                  usecols=["root_id", "cell_class", "cell_sub_class", "cell_type", "side"]).drop_duplicates("root_id")
N = con.n_neurons
idx_of = {int(f): i for i, f in enumerate(con.flywire_ids)}
names = ann["name"].fillna("").to_numpy()
classes = ann["super_class"].fillna("").to_numpy()
sides = ann["side"].fillna("").to_numpy()
full = raw.set_index("root_id").reindex(con.flywire_ids)
cclass = full.cell_class.fillna("").to_numpy()


def gidx(fids):
    return sorted({idx_of[int(f)] for f in fids if int(f) in idx_of})


def by_mask(mask):
    return gidx(raw.loc[mask, "root_id"])


L, R = raw.side == "left", raw.side == "right"
TASTE = {
    "sugar": gidx(neurons.SUGAR_GRN),
    "bitter": by_mask((raw.cell_sub_class == "bitter") & L),
    "salt": by_mask((raw.cell_sub_class == "low-salt") & L),
}
ODORS = {  # glomeruli per odour, from published receptor tuning (approximate)
    "vinegar": ["DM1", "DM4", "DP1m", "VM2", "VA2"],
    "banana": ["DM2", "DM3", "DL1"],
    "mould": ["DA2"],
    "co2": ["V"],
    "pheromone": ["DA1"],
    "ammonia": ["VM1"],
}
ORN = {f"{o}_{s}": by_mask(raw.cell_type.isin([f"ORN_{g}" for g in gl]) & (raw.side == s))
       for o, gl in ODORS.items() for s in ("left", "right")}
LPLC2 = {s: gidx(neurons.by_cell_type(ann, ["LPLC2"], side=s)) for s in ("left", "right")}
WALK = {k: gidx(neurons.resolve(k, ann)) for k in ("forward_walk", "moonwalker", "giant_fiber", "steer")}

DN_L = [i for i in range(N) if classes[i] == "descending" and sides[i] == "left"]
DN_R = [i for i in range(N) if classes[i] == "descending" and sides[i] == "right"]
MN9 = idx_of[neurons.MN9]
GF = {s: gidx(neurons.by_cell_type(ann, ["DNp01"], side=s)) for s in ("left", "right")}
PN_L = [i for i in range(N) if cclass[i] == "ALPN" and sides[i] == "left"]
PN_R = [i for i in range(N) if cclass[i] == "ALPN" and sides[i] == "right"]
FEED_MN = [i for i in range(N) if classes[i] == "motor"]


def simulate(c: Connectome, stim_rates: dict[int, float], t_run: float, n_run: int, seed=1):
    ids = list(stim_rates)
    p = model.Params(t_run=t_run, n_run=n_run, seed=seed)
    return model.simulate(c, [con.flywire_ids[i] for i in ids], params=p,
                          stim_rates=[stim_rates[i] for i in ids], verbose=False)


def rate_of(res, idx, t_run, n_run):
    idx = set(idx)
    if not idx:
        return 0.0
    m = np.isin(res.neuron, list(idx))
    return m.sum() / len(idx) / n_run / (t_run / 1000)


def build(pack_id, label, conditions, groups, outputs, t_run=500, n_run=1, margin_syn=40, extra_margin=True):
    """conditions: list of (name, {global_idx: Hz}, t_run)."""
    t0 = time.time()
    active = set()
    reference = {}
    for name, stim, tr in conditions:
        res = simulate(con, stim, tr, n_run)
        active |= set(np.unique(res.neuron).tolist())
        reference[name] = {k: round(rate_of(res, v, tr, n_run), 1) for k, v in outputs.items()}
    circuit = set(active) | set(i for v in groups.values() for i in v) | set(i for v in outputs.values() for i in v)
    if extra_margin:
        # neurons strongly excited by the active set: they could fire when inhibition is removed
        act = np.zeros(N, bool); act[list(active)] = True
        pre = np.repeat(np.arange(N), np.diff(con.indptr))
        m = act[pre] & (con.weight > 0)
        drive = np.bincount(con.post[m], weights=con.weight[m], minlength=N)
        circuit |= set(np.nonzero(drive >= margin_syn)[0].tolist())
    loc = np.array(sorted(circuit), dtype=np.int64)
    n = len(loc)
    assert n < 65535, n
    g2l = -np.ones(N, np.int64); g2l[loc] = np.arange(n)
    indptr = [0]; post = []; w = []
    for gi in loc:
        s, e = con.indptr[gi], con.indptr[gi + 1]
        p = g2l[con.post[s:e]]; keep = p >= 0
        post.extend(p[keep].tolist()); w.extend(con.weight[s:e][keep].astype(int).tolist())
        indptr.append(len(post))
    # validate: same conditions on the sub-circuit only
    mask = np.zeros(N, bool); mask[loc] = True
    pre_all = np.repeat(np.arange(N), np.diff(con.indptr))
    wsub = np.where(mask[pre_all] & mask[con.post], con.weight, 0).astype(np.float32)
    csub = Connectome(con.flywire_ids, con.indptr, con.post, wsub)
    check = {}
    for name, stim, tr in conditions:
        res = simulate(csub, stim, tr, n_run)
        check[name] = {k: round(rate_of(res, v, tr, n_run), 1) for k, v in outputs.items()}
    # write
    lg = lambda idx: [int(g2l[i]) for i in idx if g2l[i] >= 0]
    meta = {
        "id": pack_id, "label": label, "n": n, "edges": len(post),
        "groups": {k: lg(v) for k, v in {**groups, **outputs}.items()},
        "names": names[loc].tolist(), "classes": classes[loc].tolist(), "sides": sides[loc].tolist(),
        "flywire": [str(con.flywire_ids[i]) for i in loc],
        "validation": {"full_brain": reference, "circuit_only": check},
    }
    (OUT / f"{pack_id}.json").write_text(json.dumps(meta, separators=(",", ":")))
    with open(OUT / f"{pack_id}.bin", "wb") as f:
        f.write(loc.astype("<u4").tobytes())
        f.write(np.array(indptr, dtype="<u4").tobytes())
        f.write(np.array(post, dtype="<u2").tobytes())
        f.write(np.clip(np.array(w), -32767, 32767).astype("<i2").tobytes())
    size = (OUT / f"{pack_id}.bin").stat().st_size / 1e6
    print(f"\n[{pack_id}] {n} neurons, {len(post):,} synapses, {size:.2f} MB, {time.time()-t0:.0f}s")
    for name in reference:
        print(f"  {name:28s} full={reference[name]}  circuit={check[name]}")
    return meta


def stim(idx, hz):
    return {i: hz for i in idx}


if __name__ == "__main__":
    only = set(sys.argv[1:])
    OUTS_TASTE = {"MN9": [MN9], "DN_left": DN_L, "DN_right": DN_R}
    if not only or "taste" in only:
        conds = []
        for hz in (50, 100, 200):
            for k, v in TASTE.items():
                conds.append((f"{k}@{hz}", stim(v, hz), 400))
        conds += [("sugar+bitter@200", {**stim(TASTE["sugar"], 200), **stim(TASTE["bitter"], 200)}, 400),
                  ("sugar+salt@200", {**stim(TASTE["sugar"], 200), **stim(TASTE["salt"], 200)}, 400),
                  ("sugar+bitter@200/60", {**stim(TASTE["sugar"], 200), **stim(TASTE["bitter"], 60)}, 400)]
        build("taste", "Taste to feeding", conds, TASTE, OUTS_TASTE)

    OUTS_LOOM = {"GF_left": GF["left"], "GF_right": GF["right"], "DN_left": DN_L, "DN_right": DN_R}
    if not only or "loom" in only:
        conds = [(f"{s}@{hz}", stim(LPLC2[s], hz), 300) for hz in (20, 60, 150) for s in ("left", "right")]
        conds += [(f"both@{hz}", stim(LPLC2["left"] + LPLC2["right"], hz), 300) for hz in (10, 30, 80, 150)]
        build("loom", "Looming to escape", conds, {"LPLC2_left": LPLC2["left"], "LPLC2_right": LPLC2["right"]}, OUTS_LOOM)

    OUTS_SMELL = {"PN_left": PN_L, "PN_right": PN_R, **{f"PN_{o}": [] for o in ODORS}}
    for o, gl in ODORS.items():
        OUTS_SMELL[f"PN_{o}"] = [i for i in range(N) if cclass[i] == "ALPN" and any(names[i].startswith(g + "_") for g in gl)]
    if not only or "smell" in only:
        conds = [(f"{k}@150", stim(v, 150), 20) for k, v in ORN.items()]
        conds += [(f"{o}_both@150", stim(ORN[f"{o}_left"] + ORN[f"{o}_right"], 150), 20) for o in ODORS]
        build("smell", "Smell (sniffs)", conds, {f"ORN_{k}": v for k, v in ORN.items()}, OUTS_SMELL, extra_margin=False)

    if not only or "sandbox" in only:
        conds = [(f"{k}@200", stim(v, 200), 300) for k, v in TASTE.items()]
        conds += [(f"loom_{s}@100", stim(LPLC2[s], 100), 300) for s in ("left", "right")]
        conds += [(f"{k}@200", stim(v, 200), 300) for k, v in WALK.items()]
        conds += [(f"{o}_both@150", stim(ORN[f"{o}_left"] + ORN[f"{o}_right"], 150), 20) for o in ODORS]
        groups = {**TASTE, **{f"LPLC2_{s}": v for s, v in LPLC2.items()}, **WALK,
                  **{f"ORN_{o}": ORN[f"{o}_left"] + ORN[f"{o}_right"] for o in ODORS}}
        outs = {"MN9": [MN9], "GF_left": GF["left"], "GF_right": GF["right"], "DN_left": DN_L, "DN_right": DN_R}
        build("sandbox", "Sandbox (all senses)", conds, groups, outs, extra_margin=False)
