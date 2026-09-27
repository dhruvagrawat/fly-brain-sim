# Command center

Press <kbd>⌘K</kbd> (or <kbd>Ctrl K</kbd>, or <kbd>/</kbd>) anywhere in the lab. Type what you want in plain words, and the first row shows exactly how Flybrain understood you. Press <kbd>Enter</kbd> to do it.

```text
stimulate sugar at 200 hz, then run
stim looming silence DNp01 run 10 trials
open ppl1 dopamine
view top mean
find MN9
```

Below the command row, the palette also suggests matching recorded experiments, presets, cell types (stimulate or silence), and neurons from the current run. <kbd>↑</kbd> <kbd>↓</kbd> move the selection, and <kbd>Tab</kbd> turns a suggestion into editable text.

## Commands

A line can hold several commands. Words like *then*, *and*, *with* and commas are ignored, so write naturally.

| Command | Aliases | Example | Effect |
|---|---|---|---|
| `stimulate <targets>` | `stim`, `activate`, `excite`, `drive` | `stim sugar LPLC2` | Add targets to the stimulus. A bare name at the start also counts. |
| `silence <targets>` | `inhibit`, `block`, `mute` | `silence CB0248 CB0192` | Remove these neurons' outgoing synapses in the next run |
| `rate <hz>` | `at <hz>`, `<n>hz` | `at 150 hz`, `150hz` | Stimulation rate |
| `trials <n>` | `<n> trials` | `run 10 trials` | Number of trials |
| `duration <ms>` | `<n>ms`, `<n>s` | `500ms` | Trial length |
| `run` | `go`, `simulate` | `run` | Start the simulation (needs a connected simulator) |
| `clear [stim\|silence\|all]` | `reset` | `clear silence` | Empty the lists |
| `view front\|top\|side` | `front`, `top`, `side` | `top` | Camera |
| `mean` / `replay` | | `mean` | Map mode |
| `play` / `pause` | `stop` | `play` | Playback |
| `speed <x>` | | `speed 1/4` | Playback speed (1 = real time) |
| `seek <ms>` | `jump <ms>`, `at <n> ms` | `seek 300` | Jump in the replay |
| `find <name or id>` | `select`, `where` | `find MN9`, `find escape` | Select a neuron that fired, by name, ID or behaviour |
| `open <experiment>` | `load`, `demo` | `open looming` | Open a recorded run |
| `compare` | `diff` | `compare` | Compare the two ticked runs (or the last two) |
| `export` | `csv`, `download` | `csv` | Download the neuron table |
| `cli` | `command` | `cli` | Copy the equivalent terminal command |
| `docs` / `home` | `help` | `docs` | Navigate |

**Targets** can be a preset (`sugar`, `looming`, `giant_fiber`, `moonwalker`, `forward_walk`, `steer`, `ppl1_dopamine`, `clock_lnv`), any FlyWire cell type (`DNp01`, `MBON11`, `PAM05`…), or a FlyWire root ID.

## Commands in links

Any command works as a URL parameter, which makes experiments shareable:

```text
/lab/?cmd=stim%20looming%20silence%20DNp01%20rate%20150
/lab/?run=ppl1_dopamine&cmd=view%20top%20mean
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>⌘K</kbd> / <kbd>/</kbd> | Open the command center |
| <kbd>space</kbd> | Play / pause |
| <kbd>←</kbd> <kbd>→</kbd> | Step 10 ms |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Front, top, side view |
| <kbd>M</kbd> | Toggle replay / mean rate |
