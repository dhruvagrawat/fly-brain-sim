# fly-brain-sim

Simulate an entire fruit fly brain on your laptop. Stimulate any set of neurons and watch the activity spread through all ~139,000 neurons and 15 million connections of the adult *Drosophila* connectome.

The model is the whole-brain leaky integrate-and-fire model from
[Shiu et al., *Nature* 2024](https://www.nature.com/articles/s41586-024-07763-9),
rewritten in NumPy + Numba (no Brian2), so one simulated second of the full brain takes ~9 s on a single CPU core.

## Quick start

```bash
pip install -r requirements.txt
python -m flybrain fetch                 # downloads ~140 MB of connectome data into data/
python -m flybrain presets               # list named neuron sets
python -m flybrain run --stim sugar --rate 200 --trials 10
```

Stimulating sugar-taste neurons activates ~400 neurons downstream, including the proboscis motor neuron MN9 (`720575940660219265`). That reproduces the feeding result from the paper.

### What you can stimulate or silence

`--stim` and `--silence` each accept any mix of:

- a **preset**: `sugar`, `giant_fiber`, `moonwalker`, `forward_walk`, `steer`, `ppl1_dopamine`, `clock_lnv`
- a **cell type** from the FlyWire annotations, e.g. `DNp01`, `MBON01`, `PAM05`
- raw **FlyWire root IDs** (v783)

```bash
# does silencing a neuron block the feeding response?
python -m flybrain run --stim sugar --silence 720575940622695448 --trials 10
```

Outputs go to `results/latest/`: `rates.csv` (firing rate per active neuron, with cell type, class and neurotransmitter) and `spikes.parquet` (every spike).

### Python API

```python
from flybrain import data, model, neurons

con = data.load()
ann = data.load_annotations(con)
stim = neurons.resolve("sugar", ann)
res = model.simulate(con, stim, params=model.Params(n_run=5, r_poi=200))
print(res.rates().head())
```

## Model

Each neuron is a leaky integrate-and-fire unit with an exponentially decaying synaptic current:

```
dv/dt = (v_0 - v + g) / t_mbr        dg/dt = -g / tau
```

A spike adds `w_syn × (signed synapse count)` to each target's `g` after a 1.8 ms delay. Sign comes from the predicted neurotransmitter (GABA and glutamate are inhibitory). Stimulated neurons get Poisson input. All parameters (`flybrain/model.py → Params`) follow Shiu et al.: v_0 = −52 mV, v_th = −45 mV, t_mbr = 20 ms, tau = 5 ms, refractory 2.2 ms, w_syn = 0.275 mV.

Silencing removes a neuron's outgoing synapses.

## Data and credits

- Connectome: FlyWire whole-brain connectome, materialization v783 ([Dorkenwald et al. 2024](https://www.nature.com/articles/s41586-024-07558-y)), as packaged by [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) (MIT).
- Cell types and positions: [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations) ([Schlegel et al. 2024](https://www.nature.com/articles/s41586-024-07686-5)).
- Model: [Shiu et al. 2024](https://www.nature.com/articles/s41586-024-07763-9).

This is the FlyWire (female) brain. The September 2026 MaleCNS v1.0 connectome from Janelia/Google is a candidate for a future data source.

The data is downloaded at runtime and not redistributed here. Please cite the papers above if you use this in research.
