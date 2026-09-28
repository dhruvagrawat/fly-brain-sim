"""Full-brain validation of the input -> output mappings used by the Flybrain apps.

Runs the whole-brain model for each condition and reports the output neurons each
app reads. Results feed NOTEBOOK.md and the app designs.

    python scripts/validate_apps.py > results/validate_apps.txt
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

con = data.load()
ann = data.load_annotations(con)
raw = pd.read_csv(data.DEFAULT_DATA_DIR / data.ANNOTATIONS_FILE, sep="\t", low_memory=False,
                  usecols=["root_id", "cell_class", "cell_sub_class", "cell_type", "side"])

def ids(mask):
    return raw.loc[mask, "root_id"].astype("int64").tolist()

L = raw.side == "left"
R = raw.side == "right"
TASTE = {
    "sugar": neurons.SUGAR_GRN,
    "bitter": ids((raw.cell_sub_class == "bitter") & L),
    "salt": ids((raw.cell_sub_class == "low-salt") & L),
}
ORN = lambda glom, side: ids((raw.cell_type == f"ORN_{glom}") & (raw.side == side))
ODORS = {
    "vinegar": ["DM1", "DM4", "DP1m", "VM2", "VA2"],
    "banana": ["DM2", "DM3"],
    "mould": ["DA2"],
    "co2": ["V"],
    "pheromone": ["DA1"],
    "ammonia": ["VM1"],
}
DN = ann[ann.super_class == "descending"]
DN_L = DN[DN.side == "left"].flywire_id.tolist()
DN_R = DN[DN.side == "right"].flywire_id.tolist()
MN9 = neurons.MN9
GF = neurons.by_cell_type(ann, ["DNp01"])
LPLC2_L = neurons.by_cell_type(ann, ["LPLC2"], side="left")
LPLC2_R = neurons.by_cell_type(ann, ["LPLC2"], side="right")

def run(stim, rate=150, silence=(), t=500, n=2, rates=None):
    stim = con.known(stim); silence = con.known(silence)
    p = model.Params(t_run=t, n_run=n, r_poi=rate, seed=1)
    res = model.simulate(con, stim, silence, params=p, stim_rates=rates, verbose=False)
    r = res.rates().set_index("flywire_id").rate_hz
    return r

def show(name, r):
    dl = r.reindex(DN_L).fillna(0).sum(); dr = r.reindex(DN_R).fillna(0).sum()
    gf = r.reindex(GF).fillna(0).tolist()
    print(f"{name:34s} active={len(r):6d} MN9={r.get(MN9,0):6.1f} GF={[round(x) for x in gf]} DN_L={dl:7.0f} DN_R={dr:7.0f}", flush=True)

t0 = time.time()
print("== taste ==")
for k, v in TASTE.items():
    show(f"{k} ({len(v)})", run(v, 200))
show("sugar+bitter", run(TASTE["sugar"] + TASTE["bitter"], 200))
show("sugar+salt", run(TASTE["sugar"] + TASTE["salt"], 200))
show("sugar 50Hz", run(TASTE["sugar"], 50))
show("sugar 100Hz", run(TASTE["sugar"], 100))

print("== smell (left side only) ==")
for k, gl in ODORS.items():
    st = [i for g in gl for i in ORN(g, "left")]
    show(f"{k} L ({len(st)})", run(st, 100))
print("== smell (right side only) ==")
for k, gl in list(ODORS.items())[:3]:
    st = [i for g in gl for i in ORN(g, "right")]
    show(f"{k} R ({len(st)})", run(st, 100))

print("== looming ==")
for rate in (20, 50, 100, 150):
    show(f"LPLC2 both {rate}Hz", run(LPLC2_L + LPLC2_R, rate))
show("LPLC2 left 100Hz", run(LPLC2_L, 100))
show("LPLC2 right 100Hz", run(LPLC2_R, 100))
print(f"done in {time.time()-t0:.0f}s")
