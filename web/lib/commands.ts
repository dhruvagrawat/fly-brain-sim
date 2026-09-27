// Command language for the lab's command center (⌘K).
//
// Examples:
//   stimulate sugar at 200 hz
//   stim LPLC2 silence DNp01 run
//   silence CB0248, CB0192 then run 10 trials
//   view top · mean · play · speed 1/4 · find MN9 · open ppl1_dopamine · compare
//
// A line is split into clauses at command verbs; each clause becomes one Action.

export type Action =
  | { kind: "stim"; targets: string[]; replace?: boolean }
  | { kind: "silence"; targets: string[] }
  | { kind: "rate"; hz: number }
  | { kind: "trials"; n: number }
  | { kind: "duration"; ms: number }
  | { kind: "run" }
  | { kind: "clear"; what: "stim" | "silence" | "all" }
  | { kind: "view"; view: "front" | "top" | "side" }
  | { kind: "mode"; mode: "replay" | "mean" }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "speed"; x: number }
  | { kind: "seek"; ms: number }
  | { kind: "find"; query: string }
  | { kind: "open"; run: string }
  | { kind: "compare" }
  | { kind: "export" }
  | { kind: "copycli" }
  | { kind: "go"; path: string };

const VERBS: Record<string, string> = {
  stim: "stim", stimulate: "stim", activate: "stim", excite: "stim", drive: "stim", add: "stim",
  silence: "silence", inhibit: "silence", block: "silence", kill: "silence", mute: "silence",
  rate: "rate", hz: "rate", freq: "rate", frequency: "rate",
  trials: "trials", trial: "trials", repeats: "trials",
  duration: "duration", length: "duration", for: "duration",
  run: "run", go: "run", simulate: "run", start: "run",
  clear: "clear", reset: "clear",
  view: "view", show: "view", front: "view", top: "view", side: "view",
  mean: "mode", replay: "mode", rates: "mode",
  play: "play", pause: "pause", stop: "pause",
  speed: "speed",
  seek: "seek", jump: "seek", at: "at",
  find: "find", select: "find", search: "find", where: "find",
  open: "open", load: "open", demo: "open",
  compare: "compare", diff: "compare",
  export: "export", download: "export", csv: "export",
  cli: "copycli", command: "copycli",
  docs: "go", home: "go", help: "go",
};

const num = (s: string) => {
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?/);
  if (!m) return NaN;
  return m[2] ? +m[1] / +m[2] : +m[1];
};

export function parseCommand(input: string): { actions: Action[]; errors: string[] } {
  const actions: Action[] = [];
  const errors: string[] = [];
  const words = input
    .replace(/[,;]+/g, " ")
    .replace(/\b(then|and|with|plus|&|\+)\b/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  const takeTargets = () => {
    const out: string[] = [];
    while (i < words.length && !(words[i].toLowerCase() in VERBS) && !/^\d+(\.\d+)?(hz|ms|s)$/i.test(words[i])) {
      out.push(words[i]);
      i++;
    }
    return out;
  };
  while (i < words.length) {
    const w = words[i], lw = w.toLowerCase();
    // bare "200hz" / "500ms" tokens
    const unit = lw.match(/^(\d+(?:\.\d+)?)(hz|ms|s)$/);
    if (unit) {
      i++;
      if (unit[2] === "hz") actions.push({ kind: "rate", hz: +unit[1] });
      else actions.push({ kind: "duration", ms: unit[2] === "s" ? +unit[1] * 1000 : +unit[1] });
      continue;
    }
    const verb = VERBS[lw];
    i++;
    if (!verb) {
      // a bare target at the start means "stimulate"
      i--;
      const t = takeTargets();
      if (t.length) actions.push({ kind: "stim", targets: t });
      else i++;
      continue;
    }
    switch (verb) {
      case "stim": {
        const t = takeTargets();
        if (t.length) actions.push({ kind: "stim", targets: t });
        else errors.push(`"${w}" needs something to stimulate, e.g. "${w} sugar"`);
        break;
      }
      case "silence": {
        const t = takeTargets();
        if (t.length) actions.push({ kind: "silence", targets: t });
        else errors.push(`"${w}" needs a cell type or ID, e.g. "silence DNp01"`);
        break;
      }
      case "at":
      case "rate": {
        const nx = words[i] ? num(words[i]) : NaN;
        if (!isNaN(nx)) {
          i++;
          if (words[i] && /^hz$/i.test(words[i])) i++;
          if (words[i] && /^ms$/i.test(words[i])) { i++; actions.push({ kind: "seek", ms: nx }); break; }
          actions.push({ kind: "rate", hz: nx });
        } else if (verb === "rate") errors.push('Give a rate, e.g. "rate 150"');
        break;
      }
      case "trials": {
        // "10 trials" (number before) handled below; "trials 10"
        const nx = words[i] ? num(words[i]) : NaN;
        if (!isNaN(nx)) { i++; actions.push({ kind: "trials", n: Math.round(nx) }); }
        else errors.push('Give a count, e.g. "trials 10"');
        break;
      }
      case "duration": {
        const nx = words[i] ? num(words[i]) : NaN;
        if (!isNaN(nx)) { i++; let ms = nx; if (words[i] && /^s$/i.test(words[i])) { ms *= 1000; i++; } else if (words[i] && /^ms$/i.test(words[i])) i++; actions.push({ kind: "duration", ms }); }
        break;
      }
      case "run": {
        // "run 10 trials"
        if (words[i] && !isNaN(num(words[i])) && words[i + 1] && /^trials?$/i.test(words[i + 1])) {
          actions.push({ kind: "trials", n: Math.round(num(words[i])) });
          i += 2;
        }
        actions.push({ kind: "run" });
        break;
      }
      case "clear": {
        const nx = (words[i] || "").toLowerCase();
        if (nx.startsWith("stim")) { i++; actions.push({ kind: "clear", what: "stim" }); }
        else if (nx.startsWith("sil")) { i++; actions.push({ kind: "clear", what: "silence" }); }
        else { if (nx === "all") i++; actions.push({ kind: "clear", what: "all" }); }
        break;
      }
      case "view": {
        const v = (["front", "top", "side"].includes(lw) ? lw : (words[i] || "").toLowerCase()) as "front" | "top" | "side";
        if (!["front", "top", "side"].includes(lw)) i++;
        if (["front", "top", "side"].includes(v)) actions.push({ kind: "view", view: v });
        else errors.push('Views are front, top and side');
        break;
      }
      case "mode":
        actions.push({ kind: "mode", mode: lw === "replay" ? "replay" : "mean" });
        break;
      case "play": actions.push({ kind: "play" }); break;
      case "pause": actions.push({ kind: "pause" }); break;
      case "speed": {
        const nx = words[i] ? num(words[i]) : NaN;
        if (!isNaN(nx)) { i++; if (words[i] && /^x$/i.test(words[i])) i++; actions.push({ kind: "speed", x: nx }); }
        break;
      }
      case "seek": {
        const nx = words[i] ? num(words[i]) : NaN;
        if (!isNaN(nx)) { i++; if (words[i] && /^ms$/i.test(words[i])) i++; actions.push({ kind: "seek", ms: nx }); }
        break;
      }
      case "find": {
        const q = takeTargets().join(" ");
        if (q) actions.push({ kind: "find", query: q });
        break;
      }
      case "open": {
        const q = takeTargets().join("_");
        if (q) actions.push({ kind: "open", run: q });
        break;
      }
      case "compare": actions.push({ kind: "compare" }); break;
      case "export": actions.push({ kind: "export" }); break;
      case "copycli": actions.push({ kind: "copycli" }); break;
      case "go": actions.push({ kind: "go", path: lw === "home" ? "/" : "/docs/" }); break;
    }
    // trailing "10 trials"
    if (words[i] && !isNaN(num(words[i])) && words[i + 1] && /^trials?$/i.test(words[i + 1])) {
      actions.push({ kind: "trials", n: Math.round(num(words[i])) });
      i += 2;
    }
  }
  return { actions, errors };
}

export function describe(a: Action): string {
  switch (a.kind) {
    case "stim": return `Stimulate ${a.targets.join(", ")}`;
    case "silence": return `Silence ${a.targets.join(", ")}`;
    case "rate": return `Stimulation rate ${a.hz} Hz`;
    case "trials": return `${a.n} trials`;
    case "duration": return `Trial length ${a.ms} ms`;
    case "run": return "Run the simulation";
    case "clear": return a.what === "all" ? "Clear stimulus and silencing" : `Clear ${a.what === "stim" ? "stimulus" : "silencing"}`;
    case "view": return `${a.view[0].toUpperCase()}${a.view.slice(1)} view`;
    case "mode": return a.mode === "mean" ? "Show mean firing rate" : "Show spike replay";
    case "play": return "Play replay";
    case "pause": return "Pause replay";
    case "speed": return `Replay speed ${a.x}×`;
    case "seek": return `Jump to ${a.ms} ms`;
    case "find": return `Find neuron “${a.query}”`;
    case "open": return `Open recorded run “${a.run.replace(/_/g, " ")}”`;
    case "compare": return "Compare the last two runs";
    case "export": return "Download active neurons as CSV";
    case "copycli": return "Copy the equivalent terminal command";
    case "go": return a.path === "/" ? "Go to home page" : "Open the documentation";
  }
}

export const EXAMPLES = [
  "stimulate sugar at 200 hz run",
  "stim looming silence DNp01 run",
  "open ppl1 dopamine",
  "view top mean",
  "find MN9",
  "speed 0.25 play",
  "compare",
  "cli",
];
