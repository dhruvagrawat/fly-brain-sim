// In-browser leaky integrate-and-fire simulator for a "circuit pack": the part of the
// fly brain that responds in a given app. Same equations, constants and update order
// as flybrain/model.py (Shiu et al. 2024), so results match the full-brain Python model.

export type PackMeta = {
  id: string;
  label: string;
  n: number;
  edges: number;
  groups: Record<string, number[]>; // name -> local neuron indices
  names: string[]; // cell type per local neuron
  classes: string[]; // super class per local neuron
  sides: string[];
  flywire: string[];
  validation?: Record<string, unknown>;
};

export type Pack = PackMeta & {
  global: Uint32Array; // local -> global model index (for the brain map)
  indptr: Uint32Array;
  post: Uint16Array;
  w: Int16Array;
};

export async function loadPack(id: string): Promise<Pack> {
  const [meta, buf] = await Promise.all([
    fetch(`/data/circuits/${id}.json`).then((r) => r.json() as Promise<PackMeta>),
    fetch(`/data/circuits/${id}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const n = meta.n, e = meta.edges;
  let o = 0;
  const global = new Uint32Array(buf, o, n); o += 4 * n;
  const indptr = new Uint32Array(buf, o, n + 1); o += 4 * (n + 1);
  const post = new Uint16Array(buf, o, e); o += 2 * e;
  const w = new Int16Array(buf, o, e);
  return { ...meta, global, indptr, post, w };
}

export const PARAMS = {
  dt: 0.1, v0: -52, vRst: -52, vTh: -45, tMbr: 20, tau: 5, tRfc: 2.2, tDly: 1.8, wSyn: 0.275, fPoi: 250,
};

/** Deterministic PRNG (mulberry32) so runs are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Brain {
  readonly n: number;
  readonly pack: Pack;
  t = 0; // ms
  private post: Uint16Array;
  private indptr: Uint32Array;
  private wmv: Float32Array; // weight in mV
  private v: Float32Array;
  private g: Float32Array;
  private refEnd: Int32Array;
  private ring: Float32Array; // (delay+1) x n
  private step_ = 0;
  private delay: number;
  private rfc: number;
  private dvd: number;
  private dgd: number;
  private k: number;
  private rand: () => number;
  /** Stimulation rate in Hz per neuron (Poisson input). */
  readonly stim: Float32Array;
  /** 1 = outgoing synapses removed. */
  readonly silenced: Uint8Array;
  /** Spike count since last `takeCounts()`. */
  readonly counts: Uint32Array;
  /** Visual trace per neuron (+1 per spike, decays with 15 ms). */
  readonly trace: Float32Array;
  /** Neurons that spiked in the last step() call. */
  lastSpikes: number[] = [];
  scrambled = false;

  constructor(pack: Pack, opts: { seed?: number; scramble?: boolean | number; shuffleWeights?: number } = {}) {
    this.pack = pack;
    this.n = pack.n;
    this.indptr = pack.indptr;
    this.post = opts.scramble ? scramblePost(pack, typeof opts.scramble === "number" ? opts.scramble : 7) : pack.post;
    this.scrambled = !!opts.scramble;
    this.wmv = new Float32Array(pack.w.length);
    for (let i = 0; i < pack.w.length; i++) this.wmv[i] = pack.w[i] * PARAMS.wSyn;
    if (opts.shuffleWeights) {
      // keep who-connects-to-whom, but shuffle synapse strengths and signs across all connections
      const r = rng(opts.shuffleWeights);
      for (let i = this.wmv.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = this.wmv[i]; this.wmv[i] = this.wmv[j]; this.wmv[j] = t; }
      this.scrambled = true;
    }
    const n = this.n;
    this.v = new Float32Array(n).fill(PARAMS.v0);
    this.g = new Float32Array(n);
    this.refEnd = new Int32Array(n);
    this.delay = Math.round(PARAMS.tDly / PARAMS.dt);
    this.rfc = Math.round(PARAMS.tRfc / PARAMS.dt);
    this.ring = new Float32Array((this.delay + 1) * n);
    this.dvd = Math.exp(-PARAMS.dt / PARAMS.tMbr);
    this.dgd = Math.exp(-PARAMS.dt / PARAMS.tau);
    this.k = PARAMS.tau / (PARAMS.tau - PARAMS.tMbr);
    this.rand = rng(opts.seed ?? 1);
    this.stim = new Float32Array(n);
    this.silenced = new Uint8Array(n);
    this.counts = new Uint32Array(n);
    this.trace = new Float32Array(n);
  }

  reset() {
    this.v.fill(PARAMS.v0); this.g.fill(0); this.refEnd.fill(0); this.ring.fill(0);
    this.counts.fill(0); this.trace.fill(0); this.t = 0; this.step_ = 0;
  }

  setStim(localIdx: number[], hz: number) { for (const i of localIdx) this.stim[i] = hz; }
  clearStim() { this.stim.fill(0); }
  setSilenced(localIdx: number[], on = true) { for (const i of localIdx) this.silenced[i] = on ? 1 : 0; }

  /** Advance `ms` of simulated time. Returns neurons that spiked (may repeat). */
  run(ms: number): number[] {
    const steps = Math.round(ms / PARAMS.dt);
    const spikes: number[] = [];
    const n = this.n, v = this.v, g = this.g, refEnd = this.refEnd, ring = this.ring, stim = this.stim;
    const L = this.delay + 1, dvd = this.dvd, dgd = this.dgd, k = this.k, v0 = PARAMS.v0, vTh = PARAMS.vTh;
    const kick = PARAMS.wSyn * PARAMS.fPoi, pScale = PARAMS.dt / 1000;
    const traceDecay = Math.exp(-PARAMS.dt / 15);
    const tr = this.trace, counts = this.counts, sil = this.silenced;
    const indptr = this.indptr, post = this.post, wmv = this.wmv;
    for (let s = 0; s < steps; s++) {
      const t = this.step_;
      const base = (t % L) * n;
      // 1. deliver delayed synaptic input
      for (let i = 0; i < n; i++) {
        const x = ring[base + i];
        if (x !== 0) { g[i] += x; ring[base + i] = 0; }
      }
      // 2. Poisson stimulation onto v; stimulated neurons have no refractory period
      for (let i = 0; i < n; i++) {
        const r = stim[i];
        if (r > 0 && this.rand() < r * pScale) v[i] += kick;
      }
      // 3. integrate, threshold, reset, propagate
      const target = ((t + this.delay) % L) * n;
      for (let i = 0; i < n; i++) {
        tr[i] *= traceDecay;
        if (t < refEnd[i]) continue;
        const gi = g[i], u = v[i] - v0;
        const nv = v0 + (u - k * gi) * dvd + k * gi * dgd;
        g[i] = gi * dgd;
        if (nv > vTh) {
          v[i] = PARAMS.vRst; g[i] = 0;
          if (stim[i] === 0) refEnd[i] = t + 1 + this.rfc;
          counts[i]++; tr[i] += 1; spikes.push(i);
          if (!sil[i]) for (let e = indptr[i]; e < indptr[i + 1]; e++) ring[target + post[e]] += wmv[e];
        } else v[i] = nv;
      }
      this.step_++;
    }
    this.t += steps * PARAMS.dt;
    this.lastSpikes = spikes;
    return spikes;
  }

  /** Mean rate in Hz of a group over the last `ms` given counts accumulated since `since`. */
  groupCount(idx: number[]) { let c = 0; for (const i of idx) c += this.counts[i]; return c; }
  takeCounts(): Uint32Array { const c = this.counts.slice(); this.counts.fill(0); return c; }

  /** Write per-neuron activity (0..1) into a full-brain array for BrainGL. */
  fillActivity(act: Float32Array, touched: number[]) {
    for (const i of touched) act[i] = 0;
    touched.length = 0;
    const g = this.pack.global, tr = this.trace;
    for (let i = 0; i < this.n; i++) {
      const x = tr[i];
      if (x > 0.02) { const gi = g[i]; act[gi] = Math.min(1, x / 2.2); touched.push(gi); }
    }
    return touched;
  }
}

/** Every synapse keeps its presynaptic neuron and weight but gets a random target. */
export function scramblePost(pack: Pack, seed: number) {
  const r = rng(seed), p = new Uint16Array(pack.post.length);
  for (let i = 0; i < p.length; i++) p[i] = Math.floor(r() * pack.n);
  return p;
}

/** Exponential moving rate estimator (Hz) for a group of neurons. */
export class RateMeter {
  rate = 0;
  idx: number[];
  tau: number;
  constructor(idx: number[], tau = 80) { this.idx = idx; this.tau = tau; }
  update(brain: Brain, prevCounts: Uint32Array, ms: number) {
    let c = 0;
    for (const i of this.idx) c += brain.counts[i] - prevCounts[i];
    const inst = this.idx.length ? (c / this.idx.length) / (ms / 1000) : 0;
    const a = 1 - Math.exp(-ms / this.tau);
    this.rate += (inst - this.rate) * a;
    return this.rate;
  }
}
