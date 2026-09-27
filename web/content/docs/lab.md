# Using the lab

The [lab](/lab/) is where experiments happen. It has two columns: the **experiment rail** on the left and the **results** on the right.

## The experiment rail

- **Recorded experiments**: six full-brain runs that ship with the site. Click one to load it.
- **Stimulate**: preset chips plus a box that autocompletes all 8,839 cell types. You can also paste FlyWire IDs.
- **Silence**: the same, for neurons whose output you want to remove.
- **Stimulation rate, trials, trial length**: stimulated neurons receive random (Poisson) input at this rate. More trials average out the randomness.
- **Run simulation**: runs on your connected simulator (see [Install and run](/docs/getting-started/)). A progress bar counts trials.
- **Experiment log**: every run you open or simulate in this session. Click one to reopen it, and tick two to compare them.

## The brain map

All 138,639 neurons are drawn at their real 3D positions (FlyWire soma coordinates). Dim blue points are neurons at rest. Neurons that fire glow on a magma scale, from purple (a spike or two) to near-white (bursting).

| Control | What it does |
|---|---|
| Drag | Rotate the brain |
| Scroll | Zoom |
| Front / Top / Side, or keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Snap to a standard view |
| Replay / Mean rate, or key <kbd>M</kbd> | Spike-by-spike replay of trial 1, or the average rate over all trials |
| Hover a glowing neuron | Name, class and rate |
| Click a glowing neuron | Select it everywhere: map, raster and table |

Orange rings mark stimulated neurons. Blue crosses mark silenced ones.

## Playback

<kbd>space</kbd> plays and pauses. <kbd>←</kbd> and <kbd>→</kbd> step 10 ms. The default speed is 1/10 real time, so one simulated second takes ten seconds to watch. Clicking anywhere on the population chart jumps the replay to that moment.

## Brain output

The descending and motor neurons that fired, ranked by rate. Descending neurons carry commands from the brain to the ventral nerve cord (the fly's "spinal cord"). Motor neurons in the head drive the proboscis, antennae and eyes. When a neuron's role is known from the literature (MN9 → proboscis extension, DNp01 → escape jump, MDN → backward walking…), it is labelled and outlined.

## Charts

- **Population activity**: spikes per second for each neuron class over time, averaged over trials. Click a class in the legend to show or hide it. Stimulated neurons are hidden by default because they would dwarf everything else.
- **Spike raster**: every spike of the 80 most active neurons in trial 1. Stimulated neurons are in orange.

## Neuron table

Every neuron that fired, with cell type, class, hemisphere, predicted neurotransmitter, mean rate and standard deviation. You can filter by anything and sort by any column. Selecting a neuron gives you three buttons: stimulate its type, silence it in the next run, or open it in [FlyWire Codex](https://codex.flywire.ai) to see its real 3D shape.

## Comparing runs

Tick two runs in the experiment log and press **Compare** (or type `compare`). The comparison lists every neuron whose rate changed, biggest change first, with a diverging bar: orange when it went up in B, blue when it went down. This is the core tool for silencing experiments. Run the baseline, run it again with a cell type silenced, and compare.

## Sharing and exporting

- **Share** copies a link. Recorded runs link directly (`/lab/?run=sugar_feeding`). Live runs link as a command (`/lab/?cmd=stim%20sugar%20rate%20200`) that anyone with a simulator can rerun.
- **CSV** downloads the neuron table.
- **Copy CLI** copies the equivalent `python -m flybrain run …` command.
