"use client";
import { useEffect, useRef, useState } from "react";
import { loadGeometry, type Geometry } from "./data";
import { Brain, loadPack, type Pack } from "./sim";

const packCache = new Map<string, Promise<Pack>>();
let geoCache: Promise<Geometry> | null = null;

export function getPack(id: string) {
  if (!packCache.has(id)) packCache.set(id, loadPack(id));
  return packCache.get(id)!;
}
export function getGeometry() {
  if (!geoCache) geoCache = loadGeometry();
  return geoCache;
}

/** Load the brain map and a circuit pack. */
export function useFly(packId: string) {
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getGeometry(), getPack(packId)])
      .then(([g, p]) => { if (alive) { setGeo(g); setPack(p); } })
      .catch(() => alive && setError("Couldn't load the brain data. Check your connection and reload."));
    return () => { alive = false; };
  }, [packId]);
  return { geo, pack, error };
}

/**
 * Drive a simulation from requestAnimationFrame. `tick(simMs)` is called with how much
 * simulated time to advance this frame, capped so the page stays responsive.
 */
export function useSimLoop(tick: (simMs: number, realMs: number) => void, opts: { running: boolean; speed: number; maxMsPerFrame?: number }) {
  const cb = useRef(tick);
  cb.current = tick;
  const o = useRef(opts);
  o.current = opts;
  useEffect(() => {
    let raf = 0, last = 0, visible = true;
    const onVis = () => { visible = !document.hidden; last = 0; };
    document.addEventListener("visibilitychange", onVis);
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (!o.current.running || !visible) { last = 0; return; }
      const real = last ? Math.min(50, ts - last) : 16;
      last = ts;
      const sim = Math.min(o.current.maxMsPerFrame ?? 12, real * o.current.speed);
      cb.current(sim, real);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}

/** Group firing rate (Hz) from spike counts, smoothed with an exponential filter. */
export class GroupRate {
  private prev: Uint32Array | null = null;
  rate = 0;
  constructor(public readonly idx: number[], public tau = 60) {}
  update(brain: Brain, ms: number) {
    if (!this.prev || this.prev.length !== brain.counts.length) this.prev = new Uint32Array(brain.counts.length);
    let c = 0;
    for (const i of this.idx) { c += brain.counts[i] - this.prev[i]; this.prev[i] = brain.counts[i]; }
    if (ms <= 0 || !this.idx.length) return this.rate;
    const inst = c / this.idx.length / (ms / 1000);
    this.rate += (inst - this.rate) * (1 - Math.exp(-ms / this.tau));
    return this.rate;
  }
  reset() { this.rate = 0; this.prev = null; }
}

/** Count spikes of a group since the last call (not smoothed). */
export function spikesSince(brain: Brain, idx: number[], prev: Uint32Array) {
  let c = 0;
  for (const i of idx) { c += brain.counts[i] - prev[i]; prev[i] = brain.counts[i]; }
  return c;
}
