"""Command line interface: python -m flybrain <command> ..."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def _targets(items, ann):
    from . import neurons

    ids = []
    for item in items or []:
        if item.isdigit():
            ids.extend(neurons.resolve([int(item)], ann))
        else:
            found = neurons.resolve(item, ann)
            if not found:
                raise SystemExit(f"No neurons found for '{item}' (not a preset or cell type)")
            ids.extend(found)
    return list(dict.fromkeys(ids))


def cmd_fetch(args):
    from . import data

    data.fetch(args.data_dir, force=args.force)
    con = data.load(args.data_dir)
    data.load_annotations(con, args.data_dir)
    print(f"Ready: {con.n_neurons:,} neurons, {con.n_connections:,} connections")


def cmd_presets(args):
    from .neurons import PRESETS

    for name, (desc, _) in PRESETS.items():
        print(f"{name:16s} {desc}")


def cmd_run(args):
    from . import data, model

    con = data.load(args.data_dir)
    ann = data.load_annotations(con, args.data_dir)
    stim = _targets(args.stim, ann)
    silence = _targets(args.silence, ann)
    print(f"Stimulating {len(stim)} neurons at {args.rate} Hz, silencing {len(silence)}")

    p = model.Params(t_run=args.duration, n_run=args.trials, r_poi=args.rate, seed=args.seed)
    res = model.simulate(con, stim, silence, params=p)
    rates = res.rates().merge(ann[["flywire_id", "name", "super_class", "side", "top_nt"]],
                              on="flywire_id", how="left")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rates.to_csv(out / "rates.csv", index=False)
    pd.DataFrame({"flywire_id": con.flywire_ids[res.neuron], "t_ms": res.time,
                  "trial": res.trial}).to_parquet(out / "spikes.parquet")
    if res.truncated:
        print("WARNING: spike buffer filled up, recording was truncated")

    print(f"\n{len(rates):,} neurons fired. Top {args.top}:")
    with pd.option_context("display.width", 140):
        print(rates.head(args.top).to_string(index=False))
    print(f"\nSaved {out/'rates.csv'} and {out/'spikes.parquet'}")


def main(argv=None):
    from .data import DEFAULT_DATA_DIR

    ap = argparse.ArgumentParser(prog="flybrain", description="Whole-brain fruit fly connectome simulator")
    ap.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("fetch", help="download connectome + annotations")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("presets", help="list named neuron sets")
    p.set_defaults(func=cmd_presets)

    p = sub.add_parser("run", help="run a simulation")
    p.add_argument("--stim", nargs="+", help="preset name, cell type, or FlyWire ID(s)")
    p.add_argument("--silence", nargs="+", help="preset name, cell type, or FlyWire ID(s)")
    p.add_argument("--rate", type=float, default=150.0, help="stimulation rate in Hz (default 150)")
    p.add_argument("--trials", type=int, default=10)
    p.add_argument("--duration", type=float, default=1000.0, help="trial length in ms")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--top", type=int, default=30)
    p.add_argument("--out", default="results/latest")
    p.set_defaults(func=cmd_run)

    args = ap.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
