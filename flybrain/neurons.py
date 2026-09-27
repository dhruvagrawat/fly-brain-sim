"""Named neuron sets to stimulate or silence.

Presets are resolved by FlyWire cell type (via the annotations) where possible,
so they stay valid across connectome versions. A few are explicit ID lists taken
from Shiu et al. (2024).
"""
from __future__ import annotations

import pandas as pd

#: One-side sugar-sensing gustatory receptor neurons (Shiu et al. 2024, v630 IDs;
#: 20 of 21 exist in v783).
SUGAR_GRN = [
    720575940624963786, 720575940630233916, 720575940637568838, 720575940638202345,
    720575940617000768, 720575940630797113, 720575940632889389, 720575940621754367,
    720575940621502051, 720575940640649691, 720575940639332736, 720575940616885538,
    720575940639198653, 720575940620900446, 720575940617937543, 720575940632425919,
    720575940633143833, 720575940612670570, 720575940628853239, 720575940629176663,
    720575940611875570,
]

#: MN9: proboscis motor neuron, readout of feeding initiation (Shiu et al. 2024).
MN9 = 720575940660219265

#: preset name -> (description, spec). spec is a list of IDs or {"cell_type": [...]}.
PRESETS: dict[str, tuple[str, object]] = {
    "sugar": ("Sugar-taste neurons, one side (drives feeding / MN9)", SUGAR_GRN),
    "giant_fiber": ("Giant fiber descending neurons: escape jump", {"cell_type": ["DNp01"]}),
    "moonwalker": ("Moonwalker descending neurons (MDN): backward walking", {"cell_type": ["MDN"]}),
    "forward_walk": ("DNp09 descending neurons: forward walking", {"cell_type": ["DNp09"]}),
    "steer": ("DNa02 descending neurons: steering / turning", {"cell_type": ["DNa02"]}),
    "ppl1_dopamine": ("PPL1 dopamine neurons: punishment signal", {"cell_type": ["PPL101", "PPL102", "PPL103", "PPL104", "PPL105", "PPL106", "PPL107", "PPL108"]}),
    "clock_lnv": ("Clock LNv neurons (s-LNv / l-LNv)", {"cell_type": ["s-LNv", "l-LNv"]}),
}


def resolve(spec, ann: pd.DataFrame) -> list[int]:
    """Turn a preset name, cell type, or list of IDs into FlyWire IDs present in the model."""
    if isinstance(spec, str):
        if spec in PRESETS:
            return resolve(PRESETS[spec][1], ann)
        return by_cell_type(ann, [spec])
    if isinstance(spec, dict):
        return by_cell_type(ann, spec["cell_type"])
    present = set(ann["flywire_id"].tolist())
    return [int(i) for i in spec if int(i) in present]


def by_cell_type(ann: pd.DataFrame, types, side: str | None = None) -> list[int]:
    mask = ann["cell_type"].isin(types) | ann["hemibrain_type"].isin(types)
    if side:
        mask &= ann["side"] == side
    return ann.loc[mask, "flywire_id"].astype("int64").tolist()
