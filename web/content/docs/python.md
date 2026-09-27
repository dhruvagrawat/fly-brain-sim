# Python API and CLI

## Command line

```bash
python -m flybrain fetch                          # download data (once)
python -m flybrain presets                        # list presets
python -m flybrain run --stim sugar --rate 200    # run an experiment
python -m flybrain serve                          # start the lab on :8050
```

### `run` options

| Option | Default | Meaning |
|---|---|---|
| `--stim …` | | Presets, cell types or FlyWire IDs to stimulate (one or more) |
| `--silence …` | | Presets, cell types or IDs to silence |
| `--rate` | 150 | Stimulation rate in Hz |
| `--trials` | 10 | Number of trials |
| `--duration` | 1000 | Trial length in ms |
| `--seed` | 0 | Random seed |
| `--out` | `results/latest` | Output folder |
| `--top` | 30 | Neurons to print |

### `serve` options

| Option | Default | Meaning |
|---|---|---|
| `--host` | 127.0.0.1 | Address to bind |
| `--port` | 8050 | Port |
| `--no-browser` | off | Don't open a browser tab |

## Python

```python
from flybrain import data, model, neurons

con = data.load()                     # Connectome: 138,639 neurons, CSR by presynaptic neuron
ann = data.load_annotations(con)      # DataFrame: flywire_id, name, super_class, side, top_nt, x, y, z

stim = neurons.resolve("sugar", ann)  # -> list of FlyWire IDs
off  = neurons.by_cell_type(ann, ["CB0616"])

p = model.Params(n_run=10, r_poi=200, t_run=1000)
res = model.simulate(con, stim, silence=off, params=p)

rates = res.rates()                   # flywire_id, rate_hz, std_hz (only neurons that fired)
print(rates.merge(ann, on="flywire_id").head(20))
```

### `model.Params`

All model constants (see [How the model works](/docs/how-it-works/)): `t_run`, `n_run`, `dt`, `v_0`, `v_rst`, `v_th`, `t_mbr`, `tau`, `t_rfc`, `t_dly`, `w_syn`, `r_poi`, `f_poi`, `seed`.

### `model.simulate(con, stimulate, silence=(), params=None, stim_rates=None)`

Returns a `Result` with parallel arrays `neuron` (model index), `time` (ms) and `trial`, plus `rates()`. `stim_rates` gives each stimulated neuron its own rate.

### `viz.result_payload(res, ann, stim, silence, label)`

Packs a result into the compact JSON the web lab reads (base64 arrays for spikes and rates). Use it to add your own recorded experiments.

## Adding a recorded experiment to the site

1. Add an entry to `DEMOS` in `scripts/export_web_data.py`.
2. Run `python scripts/export_web_data.py --only <id>`.
3. Commit `web/public/data/runs/`. The landing page and lab pick it up automatically.
