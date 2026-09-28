"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "@/lib/sim";
import { useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter, WiringToggle } from "./LiveBrain";

const W = 720, H = 420, FLY_X = 170, GROUND = H - 28;
const GRAV = 0.0011, FLAP_V = -0.36, PIPE_V = 0.14, PIPE_W = 58, GAP = 150, SPACING = 290;
const MAX_HZ = 150, REFRACT = 170;
const LS = "flybrain.flappy.v1";

type Pipe = { x: number; gapY: number; passed: boolean };

export default function FlappyFly() {
  const { geo, pack, error } = useFly("loom");
  const [scrambled, setScrambled] = useState(false);
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 8, scramble: scrambled }) : null), [pack, scrambled]);
  const [auto, setAuto] = useState(true);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState({ fly: 0, human: 0 });
  const [dead, setDead] = useState(false);
  const [loom, setLoom] = useState(0);
  const [gfHz, setGfHz] = useState(0);
  const [runs, setRuns] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const G = useRef({ y: H / 2, vy: 0, pipes: [] as Pipe[], score: 0, dead: false, deadT: 0, flapT: 999, t: 0, loom: 0, gfRate: 0,
    hist: [] as { l: number; gf: number; flap: boolean }[], wing: 0, flaps: 0 });
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useEffect(() => { try { const s = localStorage.getItem(LS); if (s) setBest(JSON.parse(s)); } catch { /* ignore */ } }, []);

  const reset = () => {
    const g = G.current;
    Object.assign(g, { y: H / 2 - 40, vy: 0, pipes: [], score: 0, dead: false, deadT: 0, flapT: 999, t: 0, hist: [], flaps: 0 });
    for (let k = 0; k < 4; k++) g.pipes.push({ x: 520 + k * SPACING, gapY: 120 + Math.random() * (H - 260), passed: false });
    setScore(0); setDead(false); setRuns((r) => r + 1);
    brain?.reset();
  };
  useEffect(() => { reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [brain, auto]);

  const flap = () => { const g = G.current; if (g.dead) { reset(); return; } g.vy = FLAP_V; g.flapT = 0; g.flaps++; };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "ArrowUp") && !autoRef.current && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement?.tagName ?? ""))) {
        const c = cv.current, r = c?.getBoundingClientRect();
        if (r && r.bottom > 0 && r.top < innerHeight) { e.preventDefault(); flap(); }
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  /**
   * Collision-course looming from below, 0..~2. LPLC2 neurons fire as an approaching object
   * nears impact, so input grows as time-to-contact shrinks (lower pipe < 450 ms, ground < 380 ms).
   */
  const looming = (g: typeof G.current) => {
    let L = 0;
    for (const p of g.pipes) {
      const d = p.x - (FLY_X + 12);
      if (d < -PIPE_W || d > 400) continue;
      if (g.y + 10 > p.gapY + GAP / 2 - 4) { const tau = Math.max(0, d) / PIPE_V; if (tau < 450) L += 1 - tau / 450; }
    }
    if (g.vy > 0) { const tau = Math.max(0, GROUND - (g.y + 10)) / g.vy; if (tau < 380) L += 1 - tau / 380; }
    return L;
  };

  const ui = useRef(0);
  useSimLoop((ms) => {
    if (!brain || !pack) return;
    const g = G.current;
    const step = ms; // game time follows simulated time
    if (g.dead) {
      g.deadT += step;
      brain.clearStim(); brain.run(step);
      if (g.deadT > 900) reset();
      draw();
      return;
    }
    // senses -> brain
    g.loom = looming(g);
    const hz = Math.min(MAX_HZ, g.loom * MAX_HZ);
    brain.clearStim();
    brain.setStim(pack.groups.LPLC2_left, hz);
    brain.setStim(pack.groups.LPLC2_right, hz);
    const before = brain.groupCount(pack.groups.GF_left) + brain.groupCount(pack.groups.GF_right);
    brain.run(step);
    const gfSpikes = brain.groupCount(pack.groups.GF_left) + brain.groupCount(pack.groups.GF_right) - before;
    g.gfRate += (gfSpikes / 2 / (step / 1000) - g.gfRate) * (1 - Math.exp(-step / 60));
    // brain -> body: a giant fiber spike triggers a jump (with a short refractory period)
    g.flapT += step;
    let flapped = false;
    if (autoRef.current && gfSpikes > 0 && g.flapT > REFRACT) { g.vy = FLAP_V; g.flapT = 0; flapped = true; g.flaps++; }
    // physics
    g.vy += GRAV * step; g.y += g.vy * step; g.t += step; g.wing += step;
    for (const p of g.pipes) {
      p.x -= PIPE_V * step;
      if (!p.passed && p.x + PIPE_W < FLY_X) { p.passed = true; g.score++; setScore(g.score); }
    }
    if (g.pipes[0].x < -PIPE_W - 10) { g.pipes.shift(); const last = g.pipes[g.pipes.length - 1]; g.pipes.push({ x: last.x + SPACING, gapY: 110 + Math.random() * (H - 250), passed: false }); }
    // collisions
    if (g.y < 12) { g.y = 12; g.vy = Math.max(0, g.vy); }
    const hit = g.y + 10 > GROUND || g.pipes.some((p) => FLY_X + 12 > p.x && FLY_X - 12 < p.x + PIPE_W && (g.y - 9 < p.gapY - GAP / 2 || g.y + 9 > p.gapY + GAP / 2));
    if (hit) {
      g.dead = true; setDead(true);
      const who = autoRef.current ? "fly" : "human";
      setBest((b) => {
        if (scrambled && who === "fly") return b;
        const nb = { ...b, [who]: Math.max(b[who], g.score) };
        try { localStorage.setItem(LS, JSON.stringify(nb)); } catch { /* ignore */ }
        return nb;
      });
    }
    g.hist.push({ l: hz, gf: gfSpikes, flap: flapped }); if (g.hist.length > 420) g.hist.shift();
    ui.current += step;
    if (ui.current > 60) { ui.current = 0; setLoom(hz); setGfHz(g.gfRate); }
    draw();
  }, { running: !!brain, speed: 1, maxMsPerFrame: 20 });

  const draw = () => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const x = c.getContext("2d")!; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = G.current;
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#0a0f1c"); sky.addColorStop(1, "#141a2b");
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    // parallax specks
    x.fillStyle = "rgba(140,160,210,.25)";
    for (let k = 0; k < 40; k++) { const px = ((k * 97 - g.t * 0.03) % W + W) % W, py = (k * 53) % (H - 60); x.fillRect(px, py, 1.5, 1.5); }
    // pipes: glass tubes
    for (const p of g.pipes) {
      const top = p.gapY - GAP / 2, bot = p.gapY + GAP / 2;
      for (const [y0, y1] of [[0, top], [bot, GROUND]]) {
        const gr = x.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        gr.addColorStop(0, "#2a6b52"); gr.addColorStop(0.5, "#3fae7d"); gr.addColorStop(1, "#1f4f3d");
        x.fillStyle = gr; x.fillRect(p.x, y0, PIPE_W, y1 - y0);
        x.fillStyle = "#57d19a"; x.fillRect(p.x - 4, y0 === 0 ? y1 - 12 : y0, PIPE_W + 8, 12);
      }
    }
    x.fillStyle = "#1c2233"; x.fillRect(0, GROUND, W, H - GROUND);
    x.fillStyle = "#2b3550"; for (let k = 0; k < W; k += 24) x.fillRect((k - (g.t * PIPE_V) % 24), GROUND, 12, 3);
    // looming highlight
    if (g.loom > 0.05) { x.fillStyle = `rgba(255,120,80,${Math.min(0.3, g.loom * 0.25)})`; x.fillRect(FLY_X - 30, g.y + 10, 400, GROUND - g.y); }
    // fly
    x.save(); x.translate(FLY_X, g.y); x.rotate(Math.max(-0.5, Math.min(0.8, g.vy * 1.6)));
    const flapA = g.flapT < 120 ? Math.sin(g.flapT / 12) * 0.9 : Math.sin(g.wing / 30) * 0.25;
    x.fillStyle = "rgba(200,220,255,.55)";
    x.save(); x.rotate(-0.6 + flapA); x.beginPath(); x.ellipse(-4, -9, 12, 5, 0, 0, 6.28); x.fill(); x.restore();
    x.fillStyle = "#d9c7a3"; x.beginPath(); x.ellipse(0, 0, 13, 7.5, 0, 0, 6.28); x.fill();
    x.fillStyle = "#8a6d3b"; for (let k = -6; k <= 4; k += 5) x.fillRect(k, -7, 2, 14);
    x.fillStyle = "#c0392b"; x.beginPath(); x.arc(10, -2, 5, 0, 6.28); x.fill();
    if (g.flapT < 80) { x.strokeStyle = "rgba(255,210,140,.9)"; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 20 + g.flapT / 5, 0, 6.28); x.stroke(); }
    x.restore();
    // HUD
    x.fillStyle = "#fff"; x.font = "700 30px 'Bricolage Grotesque', sans-serif"; x.textAlign = "center"; x.fillText(String(g.score), W / 2, 44);
    if (g.dead) { x.fillStyle = "rgba(5,7,11,.55)"; x.fillRect(0, 0, W, H); x.fillStyle = "#fff"; x.font = "700 26px 'Bricolage Grotesque', sans-serif"; x.fillText(autoRef.current ? "The fly crashed. Rebooting brain…" : "Crashed. Press space to go again", W / 2, H / 2); }
    // reflex strip: looming input, GF spikes, flaps
    const sy = H - 22;
    x.fillStyle = "rgba(5,7,11,.7)"; x.fillRect(0, sy - 2, W, 24);
    g.hist.forEach((h, k) => {
      const px = (k / 420) * W;
      if (h.l > 1) { x.fillStyle = `rgba(255,138,76,${Math.min(1, h.l / MAX_HZ)})`; x.fillRect(px, sy, 2, 6); }
      if (h.gf) { x.fillStyle = "#fcfdbf"; x.fillRect(px, sy + 8, 1.5, 6); }
      if (h.flap) { x.fillStyle = "#7aa7ff"; x.fillRect(px, sy + 15, 3, 5); }
    });
  };

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Flappy Fly game">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} desc="The fly's giant fiber is playing. Looming obstacles below drive its LPLC2 neurons, and every giant fiber spike is a flap." />
          <WiringToggle scrambled={scrambled} onChange={setScrambled} />
        </div>
        <div className="game-wrap" onPointerDown={() => { if (!auto) flap(); }}>
          <canvas ref={cv} className="game" style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`Flappy Fly. Score ${score}.`} />
        </div>
        <div className="game-legend small">
          <span><i className="sw" style={{ background: "#ff8a4c" }} /> looming input (LPLC2)</span>
          <span><i className="sw" style={{ background: "#fcfdbf" }} /> giant fiber spike</span>
          <span><i className="sw" style={{ background: "#7aa7ff" }} /> flap</span>
          <span className="muted">{auto ? "Brain in control" : "You're in control: space, ↑ or tap to flap"}</span>
        </div>
        <div className="scores">
          <div><span className="eyebrow">Score</span><b className="mono big">{score}</b></div>
          <div><span className="eyebrow">Fly best</span><b className="mono big">{best.fly}</b></div>
          <div><span className="eyebrow">Your best</span><b className="mono big">{best.human}</b></div>
          <div><span className="eyebrow">Attempts</span><b className="mono big">{runs}</b></div>
        </div>
        {dead && !auto && <p className="muted small">Tip: switch Autopilot on to watch the fly's escape reflex play.</p>}
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} stim={pack && loom > 1 ? [...pack.groups.LPLC2_left, ...pack.groups.LPLC2_right] : []}
          title="Live brain" subtitle={pack ? `${pack.n.toLocaleString()} looming-circuit neurons` : "loading…"}>
          <div className="meters">
            <Meter label="LPLC2 looming input" value={loom} max={MAX_HZ} />
            <Meter label="Giant fiber (DNp01)" value={gfHz} max={250} tone="blue" hint="Each spike is a jump command." />
          </div>
        </LiveBrain>
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}
