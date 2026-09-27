# Install and run

The website replays recorded experiments. To run **new** experiments you run the simulator on your own computer. It needs Python 3.10+, about 1 GB of RAM and 150 MB of disk.

## 1. Get the code

```bash
git clone https://github.com/dhruvagrawat/fly-brain-sim
cd fly-brain-sim
pip install -r requirements.txt
```

The requirements are small: NumPy, pandas, PyArrow and Numba.

## 2. Download the brain

```bash
python -m flybrain fetch
```

This downloads the FlyWire v783 connectome (~105 MB) and the neuron annotations (~32 MB) into `data/`, then builds a compact cache. It only happens once.

## 3. Start the lab

```bash
python -m flybrain serve
```

This opens `http://127.0.0.1:8050` in your browser. If the web app has been built (`web/out/`, see below), you get the full lab. Otherwise you get a lightweight single-page version. The first start takes ~20 seconds while Numba compiles the simulator.

The **Run simulation** button is now live. So is the command center: `stimulate looming at 150 hz run`.

### Using the hosted site with your simulator

You can also keep the hosted site open and point it at your machine. In the lab, click **connect a simulator** under the Run button and enter `http://127.0.0.1:8050`. The server allows cross-origin requests from the browser, so recorded and live runs end up in the same experiment log.

## 4. Or use the terminal

```bash
python -m flybrain presets
python -m flybrain run --stim sugar --rate 200 --trials 10
python -m flybrain run --stim sugar --silence CB0616 --trials 10 --out results/sugar_minus_cb0616
```

Each run writes `rates.csv` (firing rate for every neuron that fired, with its cell type) and `spikes.parquet` (every spike) to the output folder. See [Python API and CLI](/docs/python/) for everything else.

## Building the web app locally

```bash
cd web
npm install
npm run dev      # hot-reloading dev server on :3000
npm run build    # static site in web/out/, which `flybrain serve` then serves
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: numba` | `pip install numba` (Python 3.10 – 3.13). |
| First run is slow | Numba compiles on first use (~15 s). Later runs start instantly. |
| “A simulation is already running” | The server runs one job at a time. Wait for it to finish. |
| Hosted site can't connect | Make sure `flybrain serve` is running, and allow the browser's local-network prompt if it asks. |
