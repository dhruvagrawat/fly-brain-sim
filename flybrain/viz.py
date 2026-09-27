"""Pack connectome geometry and simulation results into compact JSON for the web UI."""
from __future__ import annotations

import base64

import numpy as np
import pandas as pd

from .model import Result

CLASS_ORDER = ["optic", "central", "sensory", "visual_projection", "ascending", "descending",
               "sensory_ascending", "visual_centrifugal", "motor", "endocrine", ""]


def _b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode("ascii")


def geometry(ann: pd.DataFrame) -> dict:
    """Neuron positions (int16, 0.1 um steps relative to the centre) and class index (uint8)."""
    xyz = ann[["x", "y", "z"]].to_numpy(dtype=np.float64)
    missing = np.isnan(xyz).any(1)
    centre = np.nanmean(xyz, axis=0)
    xyz = np.where(missing[:, None], centre, xyz) - centre
    q = np.clip(np.round(xyz * 10), -32767, 32767).astype("<i2")
    cls = ann["super_class"].map({c: i for i, c in enumerate(CLASS_ORDER)}).fillna(len(CLASS_ORDER) - 1)
    cls = np.where(missing, 255, cls).astype(np.uint8)
    names = ann["name"].to_numpy()
    types = pd.Series(names[names != ""]).value_counts()
    return {
        "n": int(len(ann)),
        "xyz": _b64(q),            # interleaved x,y,z
        "cls": _b64(cls),
        "classes": CLASS_ORDER,
        "cell_types": [[t, int(c)] for t, c in types.items()],
    }


def result_payload(res: Result, ann: pd.DataFrame, stim_ids, silence_ids, label: str,
                   bin_ms: float = 10.0, max_replay_spikes: int = 400_000, raster_n: int = 80, max_rows: int = 3000) -> dict:
    p = res.params
    idx_of = {int(f): i for i, f in enumerate(res.flywire_ids)}
    stim_idx = np.array([idx_of[int(i)] for i in stim_ids], dtype=np.int64)
    sil_idx = np.array([idx_of[int(i)] for i in silence_ids], dtype=np.int64)

    # per-neuron rates
    n = len(res.flywire_ids)
    counts = np.zeros((n, p.n_run), dtype=np.int32)
    np.add.at(counts, (res.neuron, res.trial), 1)
    hz = counts / (p.t_run / 1000.0)
    mean, std = hz.mean(1), hz.std(1)
    active = np.nonzero(mean > 0)[0]
    active = active[np.argsort(-mean[active], kind="stable")]
    stim_set = set(stim_idx.tolist())
    rows = []
    for i in active[:max_rows]:
        a = ann.iloc[i]
        rows.append([int(i), str(res.flywire_ids[i]), a["name"], a["super_class"], a["side"],
                     a["top_nt"], round(float(mean[i]), 2), round(float(std[i]), 2), int(i in stim_set)])

    # population activity over time, grouped by class (+ stimulated neurons separately)
    nbins = int(np.ceil(p.t_run / bin_ms))
    b = np.minimum((res.time / bin_ms).astype(np.int64), nbins - 1)
    group = ann["super_class"].to_numpy()[res.neuron].astype(object)
    is_stim = np.isin(res.neuron, stim_idx)
    group[is_stim] = "stimulated"
    series = {}
    norm = p.n_run * bin_ms / 1000.0
    for g in pd.Series(group).value_counts().index:
        h = np.bincount(b[group == g], minlength=nbins) / norm
        series[g or "unlabelled"] = np.round(h, 1).tolist()

    # replay: spikes of trial 0, time-sorted
    m = res.trial == 0
    order = np.argsort(res.time[m], kind="stable")
    rn = res.neuron[m][order][:max_replay_spikes].astype("<u4")
    rt = np.round(res.time[m][order][:max_replay_spikes] * 10).astype("<u4")  # 0.1 ms units

    # raster: top non-stimulated neurons + a few stimulated ones
    top_non = [i for i in active if i not in stim_set][: raster_n - min(10, len(stim_idx))]
    top = list(stim_idx[:10]) + top_non
    raster = []
    for i in top:
        t = res.time[(res.neuron == i) & (res.trial == 0)]
        raster.append({"i": int(i), "t": np.round(t, 1).tolist()})

    return {
        "label": label,
        "params": {"t_run": p.t_run, "n_run": p.n_run, "rate": p.r_poi, "dt": p.dt, "bin_ms": bin_ms},
        "stim": stim_idx.tolist(),
        "silence": sil_idx.tolist(),
        "n_spikes": int(res.neuron.size),
        "truncated": bool(res.truncated or m.sum() > max_replay_spikes),
        "columns": ["i", "flywire_id", "name", "class", "side", "nt", "rate", "std", "stim"],
        "n_active": int(active.size),
        "active": rows,
        "rates": {"i": _b64(active.astype("<u4")), "r": _b64(mean[active].astype("<f4"))},
        "series": series,
        "replay": {"n": _b64(rn), "t": _b64(rt)},
        "raster": raster,
    }
