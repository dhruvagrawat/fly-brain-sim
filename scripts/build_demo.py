"""Run a set of example experiments and bake them into a standalone HTML page.

    python scripts/build_demo.py                 # -> docs/index.html (open in any browser)
    python scripts/build_demo.py --fragment out.html   # body-only variant for embedding
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flybrain import data, model, neurons, viz  # noqa: E402
from flybrain.server import page_html  # noqa: E402

DEMOS = [
    dict(label="Sugar taste → feeding", stim=["sugar"], rate=200, trials=5,
         blurb="20 sugar-taste neurons drive the proboscis motor neuron MN9"),
    dict(label="Forward walking", stim=["forward_walk"], rate=200, trials=3,
         blurb="DNp09 command neurons recruit ~280 neurons, incl. other walking DNs"),
    dict(label="Giant fiber escape", stim=["giant_fiber"], rate=200, trials=3,
         blurb="The escape-jump neurons and the descending network they reach"),
    dict(label="Moonwalker (backward walking)", stim=["moonwalker"], rate=200, trials=3,
         blurb="MDN activation and its sparse downstream partners"),
    dict(label="PPL1 dopamine (punishment)", stim=["ppl1_dopamine"], rate=100, trials=3,
         blurb="Dopamine neurons flood the mushroom body: ~10k neurons respond"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/index.html")
    ap.add_argument("--fragment", help="also write a body-only page here")
    ap.add_argument("--duration", type=float, default=1000.0)
    ap.add_argument("--rewrap", action="store_true",
                    help="reuse the data already baked into --out, only refresh the page code")
    args = ap.parse_args()

    if args.rewrap:
        old = Path(args.out).read_text(encoding="utf-8")
        start = old.index('type="application/json">') + len('type="application/json">')
        embed = old[start:old.index("</script>", start)].replace("<\\/", "</")
        return write(embed, args)

    con = data.load()
    ann = data.load_annotations(con)
    runs = []
    for d in DEMOS:
        stim = [i for s in d["stim"] for i in neurons.resolve(s, ann)]
        p = model.Params(t_run=args.duration, n_run=d["trials"], r_poi=d["rate"])
        t0 = time.time()
        res = model.simulate(con, stim, params=p, verbose=False)
        payload = viz.result_payload(res, ann, stim, [], d["label"], max_replay_spikes=150_000, max_rows=1500)
        payload.update(blurb=d["blurb"], stim_spec=d["stim"], silence_spec=[], elapsed_s=None)
        print(f"{d['label']}: {payload['n_active']:,} active, {payload['n_spikes']:,} spikes ({time.time()-t0:.0f}s)")
        runs.append(payload)

    presets = [{"name": k, "desc": desc, "n": len(neurons.resolve(k, ann))} for k, (desc, _) in neurons.PRESETS.items()]
    embed = json.dumps({"geometry": viz.geometry(ann), "presets": presets, "runs": runs}, separators=(",", ":"))
    write(embed, args)


def write(embed: str, args):
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page_html(embed), encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size/1e6:.1f} MB)")
    if args.fragment:
        Path(args.fragment).write_text(page_html(embed, standalone=False), encoding="utf-8")
        print(f"Wrote {args.fragment}")


if __name__ == "__main__":
    main()
