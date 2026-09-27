# Presets and cell types

You can target neurons three ways: a **preset**, a **cell type**, or a **FlyWire root ID**. All three work in the lab, the command center, the CLI and the Python API.

## Presets

Defined in `flybrain/neurons.py`. Most resolve by cell type, so they stay valid across connectome versions.

| Preset | Neurons | What they are |
|---|---|---|
| `sugar` | 20 | Sugar-sensing gustatory receptor neurons on one side (Shiu et al. 2024). Drive feeding via MN9. |
| `looming` | 210 | LPLC2 visual projection neurons: detect objects on a collision course |
| `giant_fiber` | 2 | DNp01, the giant fiber descending neurons that trigger the escape jump |
| `moonwalker` | 4 | MDN, moonwalker descending neurons: backward walking |
| `forward_walk` | 2 | DNp09: forward walking |
| `steer` | 2 | DNa02: steering / turning |
| `ppl1_dopamine` | 16 | PPL1 dopamine neurons: punishment signal to the mushroom body |
| `clock_lnv` | 18 | s-LNv and l-LNv clock neurons |

Adding a preset takes one line in `PRESETS`:

```python
"bitter": ("Bitter-taste neurons", {"cell_type": ["GRN_bitter_type"]}),
```

## Cell types

The FlyWire annotations (Schlegel et al. 2024) give **8,839 named cell types**. The lab autocompletes them. A few families worth knowing:

| Prefix | Meaning |
|---|---|
| `DN…` (DNp01, DNa02, DNg12…) | Descending neurons: brain → body commands |
| `MN…` | Motor neurons |
| `KC…` | Kenyon cells, the mushroom body's ~5,000 memory neurons |
| `MBON…` | Mushroom body output neurons |
| `PAM…`, `PPL…` | Dopamine neurons (reward / punishment) |
| `LC…`, `LPLC…` | Visual projection neurons from the optic lobe |
| `T4`, `T5`, `Mi…`, `Tm…` | Optic lobe motion and feature detectors |
| `CB…` | Central brain types without a published name yet |

Explore any type in [FlyWire Codex](https://codex.flywire.ai).

## FlyWire root IDs

Every neuron has an 18-digit root ID like `720575940660219265` (that's MN9). Flybrain uses **materialization v783**, the public release. IDs from older versions (e.g. 630) mostly carry over. For example, 20 of the 21 sugar neurons from the paper still exist unchanged.
