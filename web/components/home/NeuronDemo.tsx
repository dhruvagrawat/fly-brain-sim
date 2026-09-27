"use client";
import { useEffect, useRef, useState } from "react";

/**
 * One leaky integrate-and-fire neuron, simulated live with the same equations
 * and constants as the whole-brain model:
 *   dv/dt = (v0 - v + g) / 20 ms,  dg/dt = -g / 5 ms,  threshold -45 mV, reset -52 mV, refractory 2.2 ms
 */
const V0 = -52, VTH = -45, TM = 20, TAU = 5, TREF = 2.2, DT = 0.1;
const W_E = 5.5, W_I = -7; // mV per input spike (illustrative: ~20 synapses x 0.275 mV)
const WINDOW = 400; // ms shown

export default function NeuronDemo() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [exc, setExc] = useState(260);
  const [inh, setInh] = useState(0);
  const [rate, setRate] = useState(0);
  const P = useRef({ exc, inh });
  P.current = { exc, inh };

  useEffect(() => {
    const canvas = cv.current!;
    const st = { v: V0, g: 0, ref: 0, t: 0 };
    const vs = new Float32Array(WINDOW / DT);
    const inE = new Uint8Array(WINDOW / DT), inI = new Uint8Array(WINDOW / DT), out = new Uint8Array(WINDOW / DT);
    vs.fill(V0);
    let head = 0, raf = 0, spikesRecent: number[] = [], visible = true;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dvd = Math.exp(-DT / TM), dgd = Math.exp(-DT / TAU), k = TAU / (TAU - TM);

    const step = () => {
      const { exc, inh } = P.current;
      let e = 0, i = 0;
      if (Math.random() < exc * DT / 1000) { st.g += W_E; e = 1; }
      if (Math.random() < inh * DT / 1000) { st.g += W_I; i = 1; }
      let spike = 0;
      if (st.ref > 0) st.ref -= DT;
      else {
        const u = st.v - V0, g = st.g;
        st.v = V0 + (u - k * g) * dvd + k * g * dgd;
        st.g = g * dgd;
        if (st.v > VTH) { st.v = V0; st.g = 0; st.ref = TREF; spike = 1; spikesRecent.push(st.t); }
      }
      st.t += DT;
      vs[head] = spike ? 0 : st.v; inE[head] = e; inI[head] = i; out[head] = spike;
      head = (head + 1) % vs.length;
    };

    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      const c = canvas.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue("--text").trim(), muted = cs.getPropertyValue("--muted").trim(), line = cs.getPropertyValue("--line").trim();
      const acc = cs.getPropertyValue("--accent").trim(), blue = cs.getPropertyValue("--s1").trim();
      const L = 44, R = 10, top = 14, plotH = H - 70;
      const Y = (v: number) => top + plotH * (1 - (v - -60) / (-38 - -60));
      const X = (k: number) => L + (W - L - R) * k / vs.length;
      // grid + threshold
      c.font = "11px 'Chivo Mono', monospace"; c.fillStyle = muted; c.textAlign = "right"; c.textBaseline = "middle";
      for (const v of [-60, -52, -45, -40]) {
        c.strokeStyle = line; c.lineWidth = 1; c.setLineDash(v === VTH ? [4, 4] : []);
        if (v === VTH) c.strokeStyle = acc;
        c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke();
        c.fillText(String(v), L - 6, Y(v));
      }
      c.setLineDash([]);
      c.textAlign = "left"; c.fillStyle = acc; c.fillText("threshold", L + 6, Y(VTH) - 9);
      c.fillStyle = muted; c.fillText("rest", L + 6, Y(V0) + 10);
      // voltage trace (oldest -> newest)
      c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath();
      for (let k = 0; k < vs.length; k++) {
        const idx = (head + k) % vs.length, v = vs[idx];
        const x = X(k);
        if (out[idx]) { c.lineTo(x, Y(VTH)); c.lineTo(x, top - 4); c.moveTo(x, Y(V0)); }
        else if (k === 0) c.moveTo(x, Y(Math.max(-60, Math.min(-38, v))));
        else c.lineTo(x, Y(Math.max(-60, Math.min(-38, v))));
      }
      c.stroke();
      // spike glow
      for (let k = 0; k < vs.length; k++) {
        const idx = (head + k) % vs.length;
        if (!out[idx]) continue;
        const x = X(k), age = 1 - k / vs.length;
        const gr = c.createRadialGradient(x, top, 0, x, top, 14);
        gr.addColorStop(0, `rgba(252,190,120,${0.9 - age * 0.6})`); gr.addColorStop(1, "rgba(252,190,120,0)");
        c.fillStyle = gr; c.fillRect(x - 14, top - 14, 28, 28);
      }
      // inputs raster
      const yE = H - 42, yI = H - 24;
      c.fillStyle = muted; c.textAlign = "right"; c.fillText("in +", L - 6, yE); c.fillText("in −", L - 6, yI);
      for (let k = 0; k < vs.length; k++) {
        const idx = (head + k) % vs.length, x = X(k);
        if (inE[idx]) { c.fillStyle = acc; c.fillRect(x, yE - 6, 1.5, 12); }
        if (inI[idx]) { c.fillStyle = blue; c.fillRect(x, yI - 6, 1.5, 12); }
      }
    };

    let last = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = last ? Math.min(50, ts - last) : 16; last = ts;
      // play at 1/5 real time: 1 simulated ms per 5 real ms
      const n = Math.round((dt / 5) / DT);
      for (let k = 0; k < n; k++) step();
      spikesRecent = spikesRecent.filter((t) => t > st.t - 1000);
      draw();
    };
    if (reduce) { for (let k = 0; k < vs.length; k++) step(); draw(); }
    else raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; });
    io.observe(canvas);
    const rt = setInterval(() => setRate(spikesRecent.filter((t) => t > st.t - 1000).length), 500);
    return () => { cancelAnimationFrame(raf); io.disconnect(); clearInterval(rt); };
  }, []);

  return (
    <div className="demo neuron-demo">
      <canvas ref={cv} className="demo-canvas" style={{ height: 300 }} role="img" aria-label="Membrane voltage of one simulated neuron, with its excitatory and inhibitory inputs" />
      <div className="demo-controls">
        <label htmlFor="exc">
          <span>Excitatory input <b className="mono">{exc} Hz</b></span>
          <input id="exc" type="range" min={0} max={600} step={10} value={exc} onChange={(e) => setExc(+e.target.value)} />
        </label>
        <label htmlFor="inh">
          <span>Inhibitory input <b className="mono">{inh} Hz</b></span>
          <input id="inh" type="range" min={0} max={600} step={10} value={inh} onChange={(e) => setInh(+e.target.value)} className="blue" />
        </label>
        <div className="readout"><span className="mono big">{rate}</span><span className="muted small">spikes / s<br />output</span></div>
      </div>
    </div>
  );
}
