// Types, decoding and data access shared by the landing page and the lab.

export type Geometry = {
  n: number;
  xyz: Int16Array; // interleaved x,y,z in 0.1 µm, centred
  cls: Uint8Array; // index into classes, 255 = no position
  classes: string[];
  cellTypes: [string, number][];
};

export type Preset = { name: string; desc: string; n: number };

// row: [index, flywire_id, name, class, side, nt, rate, std, stimulated]
export type Row = [number, string, string, string, string, string, number, number, number];

export type RunPayload = {
  id?: string;
  label: string;
  blurb?: string;
  params: { t_run: number; n_run: number; rate: number; dt: number; bin_ms: number };
  stim: number[];
  silence: number[];
  n_spikes: number;
  n_active: number;
  truncated: boolean;
  columns: string[];
  active: Row[];
  rates: { i: string; r: string };
  series: Record<string, number[]>;
  replay: { n: string; t: string };
  raster: { i: number; t: number[] }[];
  stim_spec?: string[];
  silence_spec?: string[];
  elapsed_s?: number | null;
};

export type Run = RunPayload & {
  key: string; // unique per loaded run (for the log)
  source: "recorded" | "live";
  createdAt: number;
  replayN: Uint32Array;
  replayT: Uint32Array; // 0.1 ms units, sorted
  rateI: Uint32Array;
  rateR: Float32Array;
  rateOf: Map<number, number>;
  maxRate: number;
  byIndex: Map<number, Row>;
  stimSet: Set<number>;
};

export type RunSummary = Pick<RunPayload, "id" | "label" | "blurb" | "n_active" | "n_spikes" | "params" | "stim_spec">;

function b64<T>(s: string, T: { new (b: ArrayBuffer): T }): T {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new T(u8.buffer);
}

export const dataUrl = (p: string) => `/data/${p}`;

export async function loadGeometry(): Promise<Geometry> {
  const g = await (await fetch(dataUrl("geometry.json"))).json();
  return { n: g.n, xyz: b64(g.xyz, Int16Array), cls: b64(g.cls, Uint8Array), classes: g.classes, cellTypes: g.cell_types };
}

export async function loadPresets(): Promise<Preset[]> {
  return (await fetch(dataUrl("presets.json"))).json();
}

export async function loadRunIndex(): Promise<RunSummary[]> {
  return (await fetch(dataUrl("runs/index.json"))).json();
}

export async function loadRecordedRun(id: string): Promise<Run> {
  const p: RunPayload = await (await fetch(dataUrl(`runs/${id}.json`))).json();
  return decodeRun(p, "recorded");
}

let keyCounter = 0;
export function decodeRun(p: RunPayload, source: Run["source"]): Run {
  const rateI = b64(p.rates.i, Uint32Array);
  const rateR = b64(p.rates.r, Float32Array);
  const rateOf = new Map<number, number>();
  let maxRate = 1;
  for (let k = 0; k < rateI.length; k++) {
    rateOf.set(rateI[k], rateR[k]);
    if (rateR[k] > maxRate) maxRate = rateR[k];
  }
  return {
    ...p,
    key: `${p.id ?? "live"}-${Date.now()}-${keyCounter++}`,
    source,
    createdAt: Date.now(),
    replayN: b64(p.replay.n, Uint32Array),
    replayT: b64(p.replay.t, Uint32Array),
    rateI,
    rateR,
    rateOf,
    maxRate,
    byIndex: new Map(p.active.map((r) => [r[0], r])),
    stimSet: new Set(p.stim),
  };
}

// ---------- live simulator (python -m flybrain serve) ----------

export type RunRequest = { stim: string[]; silence: string[]; rate: number; trials: number; duration: number; label: string };

export class Backend {
  constructor(public base: string) {}
  static sameOrigin() {
    return new Backend("");
  }
  url(p: string) {
    return `${this.base.replace(/\/$/, "")}/api/${p}`;
  }
  async ping(timeoutMs = 1500): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(this.url("presets"), { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return false;
      const j = await r.json();
      return Array.isArray(j);
    } catch {
      return false;
    }
  }
  async run(req: RunRequest, onProgress: (trial: number, of: number) => void): Promise<Run> {
    const r = await fetch(this.url("run"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "The simulator refused the run.");
    for (;;) {
      await new Promise((res) => setTimeout(res, 600));
      const s = await (await fetch(this.url("status"))).json();
      if (s.state === "running") onProgress(s.trial, s.n_run);
      else if (s.state === "done") return decodeRun(s.result, "live");
      else if (s.state === "error") throw new Error(s.error);
      else throw new Error("The simulation stopped unexpectedly.");
    }
  }
}

export function lowerBound(a: ArrayLike<number>, v: number) {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** Per-neuron activity 0..1 for the current frame. Fills `act` and returns touched indices. */
export function activityAt(run: Run, t: number, mode: "replay" | "mean", act: Float32Array, touched: number[]): number[] {
  for (const i of touched) act[i] = 0;
  touched.length = 0;
  if (mode === "mean") {
    const lmax = Math.log1p(run.maxRate);
    for (let k = 0; k < run.rateI.length; k++) {
      const i = run.rateI[k];
      act[i] = Math.max(0.08, Math.log1p(run.rateR[k]) / lmax);
      touched.push(i);
    }
    return touched;
  }
  const T = run.replayT, N = run.replayN, t10 = t * 10, tau = 150, win = 1000;
  const lo = lowerBound(T, t10 - win), hi = lowerBound(T, t10 + 1);
  for (let k = lo; k < hi; k++) {
    const i = N[k];
    if (act[i] === 0) touched.push(i);
    act[i] += Math.exp(-(t10 - T[k]) / tau);
  }
  for (const i of touched) act[i] = Math.min(1, act[i] / 2.2);
  return touched;
}
