"""Run the example experiments and export them as JSON for the web app.

    python scripts/export_web_data.py            # runs every demo (~3 min) -> web/public/data/
    python scripts/export_web_data.py --only lplc2_loom   # re-run a single demo

Output:
    web/public/data/geometry.json      neuron positions + classes + cell-type list
    web/public/data/presets.json       named neuron sets
    web/public/data/runs/index.json    list of recorded runs
    web/public/data/runs/<id>.json     one recorded run each
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flybrain import data, model, neurons, viz  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

DEMOS = [
    dict(id="sugar_feeding", label="Sugar taste → feeding", stim=["sugar"], rate=200, trials=5,
         blurb="20 sugar-taste neurons drive the proboscis motor neuron MN9"),
    dict(id="lplc2_loom", label="Looming threat → escape", stim=["looming"], rate=150, trials=3,
         blurb="LPLC2 looming detectors in the optic lobe reach the giant fiber"),
    dict(id="forward_walk", label="Forward walking", stim=["forward_walk"], rate=200, trials=3,
         blurb="DNp09 command neurons recruit other walking descending neurons"),
    dict(id="giant_fiber", label="Giant fiber escape", stim=["giant_fiber"], rate=200, trials=3,
         blurb="The escape-jump neurons and the descending network they reach"),
    dict(id="moonwalker", label="Moonwalker (backward walking)", stim=["moonwalker"], rate=200, trials=3,
         blurb="MDN activation and its sparse downstream partners"),
    dict(id="ppl1_dopamine", label="PPL1 dopamine (punishment)", stim=["ppl1_dopamine"], rate=100, trials=3,
         blurb="Dopamine neurons flood the mushroom body: ~10k neurons respond"),
]


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {path.relative_to(OUT.parent.parent.parent)} ({path.stat().st_size/1e6:.2f} MB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--duration", type=float, default=1000.0)
    ap.add_argument("--only", nargs="+", help="demo ids to (re)run; others are kept")
    args = ap.parse_args()

    con = data.load()
    ann = data.load_annotations(con)
    dump(OUT / "geometry.json", viz.geometry(ann))
    dump(OUT / "presets.json", [{"name": k, "desc": d, "n": len(neurons.resolve(k, ann))}
                                for k, (d, _) in neurons.PRESETS.items()])

    index = []
    for d in DEMOS:
        path = OUT / "runs" / f"{d['id']}.json"
        if args.only and d["id"] not in args.only and path.exists():
            payload = json.loads(path.read_text())
        else:
            stim = [i for s in d["stim"] for i in neurons.resolve(s, ann)]
            p = model.Params(t_run=args.duration, n_run=d["trials"], r_poi=d["rate"])
            t0 = time.time()
            res = model.simulate(con, stim, params=p, verbose=False)
            payload = viz.result_payload(res, ann, stim, [], d["label"], max_replay_spikes=150_000, max_rows=1500)
            payload.update(id=d["id"], blurb=d["blurb"], stim_spec=d["stim"], silence_spec=[])
            print(f"{d['label']}: {payload['n_active']:,} active, {payload['n_spikes']:,} spikes ({time.time()-t0:.0f}s)")
            dump(path, payload)
        entry = {k: payload[k] for k in ("id", "label", "blurb", "n_active", "n_spikes", "params", "stim_spec")}
        # sparkline: responding (non-stimulated) population, spikes/s per bin
        bins = len(next(iter(payload["series"].values())))
        entry["spark"] = [round(sum(v[j] for k, v in payload["series"].items() if k != "stimulated"), 1) for j in range(bins)]
        index.append(entry)
    dump(OUT / "runs" / "index.json", index)


if __name__ == "__main__":
    main()
