"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A 23-neuron toy circuit (sensory → interneurons → descending → motor) running the
 * same LIF equations as the whole-brain model, slowed down so you can watch spikes travel.
 * Click a neuron to silence it and see how the output changes.
 */
type N = { x: number; y: number; layer: number; inh: boolean; v: number; g: number; ref: number; flash: number; silenced: boolean };
type E = { a: number; b: number; w: number };
type Pulse = { e: number; t: number };

const LAYERS = [5, 9, 6, 3];
const LABELS = ["Sensory", "Interneurons", "Descending", "Motor"];
const V0 = -52, VTH = -45, TM = 20, TAU = 5, DT = 0.1, DELAY = 6; // delay stretched for visibility

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function build() {
  const r = rng(7);
  const ns: N[] = [];
  LAYERS.forEach((n, l) => {
    for (let k = 0; k < n; k++) ns.push({ x: (l + 0.5) / LAYERS.length, y: (k + 0.5) / n, layer: l, inh: l === 1 && (k === 2 || k === 6), v: V0, g: 0, ref: 0, flash: 0, silenced: false });
  });
  const es: E[] = [];
  const idx = (l: number) => ns.map((n, i) => (n.layer === l ? i : -1)).filter((i) => i >= 0);
  for (let l = 0; l < LAYERS.length - 1; l++) {
    for (const a of idx(l)) for (const b of idx(l + 1)) {
      if (r() < (l === 0 ? 0.55 : l === 2 ? 0.7 : 0.5)) es.push({ a, b, w: ns[a].inh ? -(3 + r() * 3) : l === 2 ? 9 + r() * 6 : 7.5 + r() * 6 });
    }
  }
  // lateral inhibition inside the interneuron layer
  for (const a of idx(1).filter((i) => ns[i].inh)) for (const b of idx(1)) if (a !== b && r() < 0.5) es.push({ a, b, w: -(2 + r() * 3) });
  return { ns, es };
}

export default function CascadeDemo() {
  const cv = useRef<HTMLCanvasElement>(null);
  const net = useRef(build());
  const [on, setOn] = useState(true);
  const [motorHz, setMotorHz] = useState(0);
  const [silencedCount, setSilencedCount] = useState(0);
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    const canvas = cv.current!;
    const { ns, es } = net.current;
    const out: number[][] = ns.map(() => []);
    es.forEach((e, k) => out[e.a].push(k));
    let pulses: Pulse[] = [];
    let t = 0, raf = 0, last = 0, visible = true;
    const motorSpikes: number[] = [];
    const dvd = Math.exp(-DT / TM), dgd = Math.exp(-DT / TAU), kk = TAU / (TAU - TM);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const step = () => {
      // deliver pulses that have arrived
      pulses = pulses.filter((p) => {
        if (t - p.t >= DELAY) { const e = es[p.e]; ns[e.b].g += e.w; return false; }
        return true;
      });
      ns.forEach((n, i) => {
        if (n.layer === 0 && onRef.current && Math.random() < 180 * DT / 1000) n.v += 9;
        if (n.ref > 0) { n.ref -= DT; return; }
        const u = n.v - V0, g = n.g;
        n.v = V0 + (u - kk * g) * dvd + kk * g * dgd;
        n.g = g * dgd;
        if (n.v > VTH) {
          n.v = V0; n.g = 0; n.ref = 2.2; n.flash = 1;
          if (n.layer === 3) motorSpikes.push(t);
          if (!n.silenced) for (const e of out[i]) pulses.push({ e, t });
        }
      });
      t += DT;
    };

    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      const c = canvas.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const cs = getComputedStyle(document.documentElement);
      const line = cs.getPropertyValue("--line-strong").trim(), muted = cs.getPropertyValue("--muted").trim(), panel = cs.getPropertyValue("--panel-2").trim();
      const acc = cs.getPropertyValue("--accent").trim(), blue = cs.getPropertyValue("--s1").trim(), ink = cs.getPropertyValue("--text").trim();
      const px = (n: N) => 24 + n.x * (W - 48), py = (n: N) => 34 + n.y * (H - 56);
      // labels
      c.font = "600 10.5px Chivo, sans-serif"; c.fillStyle = muted; c.textAlign = "center";
      LABELS.forEach((l, k) => c.fillText(l.toUpperCase(), 24 + ((k + 0.5) / LAYERS.length) * (W - 48), 14));
      // edges
      for (const e of es) {
        const a = ns[e.a], b = ns[e.b];
        c.strokeStyle = e.w < 0 ? blue : line; c.globalAlpha = e.w < 0 ? 0.35 : 0.5; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px(a), py(a));
        if (a.layer === b.layer) c.quadraticCurveTo(px(a) + 40, (py(a) + py(b)) / 2, px(b), py(b)); else c.lineTo(px(b), py(b));
        c.stroke();
      }
      c.globalAlpha = 1;
      // pulses
      for (const p of pulses) {
        const e = es[p.e], a = ns[e.a], b = ns[e.b], f = (t - p.t) / DELAY;
        let x = px(a) + (px(b) - px(a)) * f, y = py(a) + (py(b) - py(a)) * f;
        if (a.layer === b.layer) { const mx = px(a) + 40, my = (py(a) + py(b)) / 2; x = (1 - f) ** 2 * px(a) + 2 * (1 - f) * f * mx + f * f * px(b); y = (1 - f) ** 2 * py(a) + 2 * (1 - f) * f * my + f * f * py(b); }
        c.fillStyle = e.w < 0 ? blue : acc;
        c.beginPath(); c.arc(x, y, 2.6, 0, 6.2832); c.fill();
      }
      // nodes
      for (const n of ns) {
        const x = px(n), y = py(n), r = n.layer === 3 ? 11 : 9;
        const depol = Math.max(0, Math.min(1, (n.v - V0) / (VTH - V0)));
        if (n.flash > 0.02) {
          const gr = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
          gr.addColorStop(0, `rgba(252,200,140,${0.85 * n.flash})`); gr.addColorStop(1, "rgba(252,200,140,0)");
          c.fillStyle = gr; c.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
        }
        c.fillStyle = panel; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.fillStyle = n.inh ? blue : acc; c.globalAlpha = 0.18 + 0.82 * Math.max(depol, n.flash);
        c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = n.inh ? blue : ink; c.lineWidth = n.layer === 3 ? 2 : 1.2;
        c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
        if (n.silenced) {
          c.strokeStyle = ink; c.lineWidth = 2;
          c.beginPath(); c.moveTo(x - r - 3, y - r - 3); c.lineTo(x + r + 3, y + r + 3); c.stroke();
        }
        n.flash *= 0.9;
      }
    };

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = last ? Math.min(50, ts - last) : 16; last = ts;
      const n = Math.round(dt / 25 / DT); // 1 simulated ms per 25 real ms
      for (let k = 0; k < n; k++) step();
      draw();
    };
    if (reduce) { for (let k = 0; k < 3000; k++) step(); draw(); } else raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; });
    io.observe(canvas);
    const iv = setInterval(() => {
      while (motorSpikes.length && motorSpikes[0] < t - 200) motorSpikes.shift();
      setMotorHz(Math.round(motorSpikes.length / 3 / 0.2));
    }, 400);

    const click = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect(), W = canvas.clientWidth, H = canvas.clientHeight;
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 20 * 20;
      ns.forEach((n, i) => { const d = (24 + n.x * (W - 48) - mx) ** 2 + (34 + n.y * (H - 56) - my) ** 2; if (d < bd) { bd = d; best = i; } });
      if (best >= 0 && ns[best].layer > 0) { ns[best].silenced = !ns[best].silenced; setSilencedCount(ns.filter((n) => n.silenced).length); }
    };
    canvas.addEventListener("click", click);
    return () => { cancelAnimationFrame(raf); io.disconnect(); clearInterval(iv); canvas.removeEventListener("click", click); };
  }, []);

  return (
    <div className="demo cascade-demo">
      <canvas ref={cv} className="demo-canvas" style={{ height: 320, cursor: "pointer" }} role="img"
        aria-label="A small circuit of sensory, inter-, descending and motor neurons. Spikes travel along the connections." />
      <div className="demo-controls">
        <button className={`btn ${on ? "primary-sm" : ""}`} onClick={() => setOn((o) => !o)} aria-pressed={on}>
          {on ? "Stimulus on" : "Stimulus off"}
        </button>
        <span className="muted small">Click any neuron to silence it{silencedCount ? ` · ${silencedCount} silenced` : ""}</span>
        <button className="btn ghost small" onClick={() => { net.current.ns.forEach((n) => (n.silenced = false)); setSilencedCount(0); }} disabled={!silencedCount}>Reset</button>
        <div className="readout"><span className="mono big">{motorHz}</span><span className="muted small">Hz per<br />motor neuron</span></div>
      </div>
      <div className="legend-inline small muted">
        <span><i className="dot acc" /> excitatory</span><span><i className="dot blue" /> inhibitory</span><span>slowed down 25×, delays stretched for visibility</span>
      </div>
    </div>
  );
}
