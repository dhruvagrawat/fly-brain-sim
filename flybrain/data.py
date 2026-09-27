"""Download and load the FlyWire whole-brain connectome (materialization v783).

Data files come from the public repository accompanying Shiu et al. (2024),
"A Drosophila computational brain model reveals sensorimotor processing",
Nature 634, 210-219. https://github.com/philshiu/Drosophila_brain_model (MIT).
"""
from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

BASE_URL = "https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/main/"
FILES = {
    "completeness": "Completeness_783.csv",
    "connectivity": "Connectivity_783.parquet",
}
#: Neuron annotations (cell type, class, neurotransmitter, 3D position) from
#: Schlegel et al. (2024) Nature 634, 139-152. https://github.com/flyconnectome/flywire_annotations
ANNOTATIONS_URL = ("https://raw.githubusercontent.com/flyconnectome/flywire_annotations/main/"
                   "supplemental_files/Supplemental_file1_neuron_annotations.tsv")
ANNOTATIONS_FILE = "neuron_annotations.tsv"
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _download(url: str, dest: Path, force: bool = False) -> Path:
    if force or not dest.exists():
        print(f"Downloading {dest.name} ...", flush=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(dest)
    return dest


def fetch(data_dir: Path | str = DEFAULT_DATA_DIR, force: bool = False) -> dict[str, Path]:
    """Download connectome + annotations (~140 MB total) if not already present."""
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    paths = {key: _download(BASE_URL + name, data_dir / name, force) for key, name in FILES.items()}
    paths["annotations"] = _download(ANNOTATIONS_URL, data_dir / ANNOTATIONS_FILE, force)
    return paths


ANNOTATION_COLUMNS = ["root_id", "pos_x", "pos_y", "pos_z", "super_class", "cell_class",
                      "cell_type", "hemibrain_type", "top_nt", "side", "flow"]


def load_annotations(con: "Connectome", data_dir: Path | str = DEFAULT_DATA_DIR) -> pd.DataFrame:
    """One row per model neuron (same order as con.flywire_ids).

    Adds `name` (best available type label) and x/y/z in micrometres.
    """
    data_dir = Path(data_dir)
    cache = data_dir / "annotations_783.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    path = _download(ANNOTATIONS_URL, data_dir / ANNOTATIONS_FILE)
    ann = pd.read_csv(path, sep="\t", usecols=ANNOTATION_COLUMNS, low_memory=False)
    ann = ann.drop_duplicates("root_id").set_index("root_id")
    ann = ann.reindex(con.flywire_ids)
    ann.index.name = "flywire_id"
    # FlyWire positions are in 4x4x40 nm voxels -> micrometres
    ann["x"] = ann.pop("pos_x") * 4 / 1000
    ann["y"] = ann.pop("pos_y") * 4 / 1000
    ann["z"] = ann.pop("pos_z") * 40 / 1000
    ann["name"] = ann["cell_type"].fillna(ann["hemibrain_type"]).fillna("")
    for col in ["super_class", "cell_class", "cell_type", "hemibrain_type", "top_nt", "side", "flow"]:
        ann[col] = ann[col].fillna("").astype(str)
    ann = ann.reset_index()
    ann.to_parquet(cache)
    return ann


@dataclass
class Connectome:
    """Neurons plus signed synapse counts, stored as CSR indexed by presynaptic neuron."""

    flywire_ids: np.ndarray  # (N,) int64 FlyWire root IDs, index = model neuron index
    indptr: np.ndarray       # (N+1,) int64 CSR row pointers (rows = presynaptic neurons)
    post: np.ndarray         # (E,) int32 postsynaptic neuron index
    weight: np.ndarray       # (E,) float32 signed synapse count (+ excitatory, - inhibitory)

    @property
    def n_neurons(self) -> int:
        return len(self.flywire_ids)

    @property
    def n_connections(self) -> int:
        return len(self.post)

    def index_of(self, ids) -> np.ndarray:
        """Map FlyWire root IDs to model indices. Raises KeyError for unknown IDs."""
        lookup = {int(f): i for i, f in enumerate(self.flywire_ids)}
        missing = [int(i) for i in ids if int(i) not in lookup]
        if missing:
            raise KeyError(f"{len(missing)} FlyWire IDs not in connectome, e.g. {missing[:3]}")
        return np.array([lookup[int(i)] for i in ids], dtype=np.int64)

    def known(self, ids) -> list[int]:
        """Return the subset of IDs present in this connectome."""
        s = set(int(f) for f in self.flywire_ids)
        return [int(i) for i in ids if int(i) in s]


def load(data_dir: Path | str = DEFAULT_DATA_DIR) -> Connectome:
    """Load the connectome, downloading it first if needed. Caches a compact .npz."""
    data_dir = Path(data_dir)
    cache = data_dir / "connectome_783.npz"
    if cache.exists():
        z = np.load(cache)
        return Connectome(z["flywire_ids"], z["indptr"], z["post"], z["weight"])

    paths = fetch(data_dir)
    comp = pd.read_csv(paths["completeness"], index_col=0)
    flywire_ids = comp.index.to_numpy(dtype=np.int64)
    con = pd.read_parquet(
        paths["connectivity"],
        columns=["Presynaptic_Index", "Postsynaptic_Index", "Excitatory x Connectivity"],
    )
    pre = con["Presynaptic_Index"].to_numpy(np.int64)
    order = np.argsort(pre, kind="stable")
    pre = pre[order]
    post = con["Postsynaptic_Index"].to_numpy(np.int32)[order]
    weight = con["Excitatory x Connectivity"].to_numpy(np.float32)[order]
    indptr = np.zeros(len(flywire_ids) + 1, dtype=np.int64)
    np.add.at(indptr, pre + 1, 1)
    indptr = np.cumsum(indptr)

    np.savez(cache, flywire_ids=flywire_ids, indptr=indptr, post=post, weight=weight)
    return Connectome(flywire_ids, indptr, post, weight)
