"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "@/lib/sim";
import { useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter, WiringToggle } from "./LiveBrain";

type Odor = { id: string; name: string; glom: string; note: string; hue: string };
const ODORS: Odor[] = [
  { id: "vinegar", name: "Apple cider vinegar", glom: "DM1 · DM4 · DP1m · VM2 · VA2", note: "Fermenting fruit: the smell of dinner", hue: "#e8a33d" },
  { id: "banana", name: "Ripe banana", glom: "DM2 · DM3 · DL1", note: "Fruity esters", hue: "#f2d24b" },
  { id: "pheromone", name: "Male pheromone (cVA)", glom: "DA1", note: "Fly perfume", hue: "#e87ba4" },
  { id: "ammonia", name: "Ammonia", glom: "VM1", note: "Sharp and nitrogenous", hue: "#7fb3e8" },
  { id: "co2", name: "Carbon dioxide", glom: "V", note: "Stress odour of other flies", hue: "#9aa6ba" },
  { id: "mould", name: "Mould (geosmin)", glom: "DA2", note: "Spoiled food warning", hue: "#6a9a5b" },
];
const SNIFF_MS = 15, WINDOW_MS = 20, SNIFF_HZ = 150;
/** Receptor neurons respond roughly logarithmically to concentration. */
const compress = (c: number) => (c < 0.01 ? 0 : 0.3 + (0.7 * Math.log(1 + c * 60)) / Math.log(61));

/** Run one sniff: reset, stimulate receptor neurons for 15 ms, record projection-neuron spikes. */
function sniff(brain: Brain, left: number[], right: number[], cL: number, cR: number) {
  brain.reset();
  brain.clearStim();
  brain.setStim(left, SNIFF_HZ * compress(cL));
  brain.setStim(right, SNIFF_HZ * compress(cR));
  brain.run(SNIFF_MS);
  brain.clearStim();
  brain.run(WINDOW_MS - SNIFF_MS);
}

export default function SmellOVision() {
  const { geo, pack, error } = useFly("smell");
  const [scrambled, setScrambled] = useState(false);
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 5, scramble: scrambled }) : null), [pack, scrambled]);
  const [odor, setOdor] = useState<Odor>(ODORS[2]);
  const [auto, setAuto] = useState(true);
  const [finger, setFinger] = useState<[string, number][]>([]);
  const [pnL, setPnL] = useState(0);
  const [pnR, setPnR] = useState(0);
  const [found, setFound] = useState(0);
  const [tries, setTries] = useState(1);
  const cv = useRef<HTMLCanvasElement>(null);

  // glomerulus of each projection neuron (uniglomerular PNs are named "<glom>_...PN")
  const glomOf = useMemo(() => {
    if (!pack) return null;
    const m = new Map<number, string>();
    for (const i of [...pack.groups.PN_left, ...pack.groups.PN_right]) {
      const g = pack.names[i].split("_")[0];
      if (g && g !== "M" && !g.startsWith("CB")) m.set(i, g);
    }
    return m;
  }, [pack]);

  // arena state
  const W = 640, H = 400;
  const A = useRef({ x: 90, y: 300, h: -0.3, sx: 520, sy: 180, trail: [] as [number, number][], t: 0, sniffT: 0, reached: 0, attempts: 1, lastL: 0, lastR: 0, lost: 0, l0: 1, r0: 1, cal: "" });

  const conc = (x: number, y: number) => {
    const a = A.current, dx = x - a.sx, dy = y - a.sy;
    // plume drifting left from the source on a gentle wind, with a little turbulence
    const along = Math.max(0, -dx), across = dy + Math.sin(x * 0.03 + a.t * 0.002) * 6;
    const spread = 18 + along * 0.35;
    const plume = Math.exp(-(across * across) / (2 * spread * spread)) * Math.exp(-along / 520) * (dx < 20 ? 1 : Math.exp(-(dx - 20) / 25));
    const near = Math.exp(-(dx * dx + dy * dy) / (2 * 60 * 60));
    return Math.min(1, plume * 0.9 + near);
  };

  const doSniff = (cL: number, cR: number) => {
    if (!brain || !pack || !glomOf) return { L: 0, R: 0 };
    sniff(brain, pack.groups[`ORN_${odor.id}_left`], pack.groups[`ORN_${odor.id}_right`], cL, cR);
    let L = 0, R = 0;
    for (const i of pack.groups.PN_left) L += brain.counts[i];
    for (const i of pack.groups.PN_right) R += brain.counts[i];
    const by = new Map<string, number>();
    glomOf.forEach((g, i) => { if (brain.counts[i]) by.set(g, (by.get(g) ?? 0) + brain.counts[i]); });
    setFinger([...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
    setPnL(L); setPnR(R);
    return { L, R };
  };

  // manual sniff lab: repeat a both-antennae sniff every 700 ms
  const lab = useRef(0);
  useSimLoop((_ms, real) => {
    if (!brain) return;
    const a = A.current;
    a.t += real;
    if (!auto) {
      lab.current += real;
      if (lab.current > 700) { lab.current = 0; doSniff(1, 1); }
      drawArena(false);
      return;
    }
    // autopilot: sniff every 120 ms of real time, steer by left/right projection-neuron activity
    a.sniffT += real;
    const speed = 0.045 * real;
    if (a.sniffT > 120) {
      a.sniffT = 0;
      const ax = 11, sep = 0.7;
      const lx = a.x + Math.cos(a.h - sep) * ax, ly = a.y + Math.sin(a.h - sep) * ax;
      const rx = a.x + Math.cos(a.h + sep) * ax, ry = a.y + Math.sin(a.h + sep) * ax;
      const cL = conc(lx, ly), cR = conc(rx, ry);
      // calibrate each side's baseline for this odour and brain (sensory adaptation)
      const key = `${odor.id}:${scrambled}`;
      if (a.cal !== key && brain && pack) {
        let l0 = 0, r0 = 0;
        for (let k = 0; k < 6; k++) { const q = doSniff(0.75, 0.75); l0 += q.L; r0 += q.R; }
        a.l0 = Math.max(1, l0 / 6); a.r0 = Math.max(1, r0 / 6); a.cal = key;
      }
      const { L, R } = doSniff(cL, cR);
      a.lastL = L; a.lastR = R;
      const nl = L / a.l0, nr = R / a.r0, smell = (nl + nr) / 2;
      if (smell > 0.15) {
        // smelled it: surge upwind and turn toward the side whose projection neurons fired more
        a.lost = 0;
        const up = Math.atan2(Math.sin(-a.h), Math.cos(-a.h));
        a.h += 0.35 * up + (0.9 * (nr - nl)) / (nl + nr) + (Math.random() - 0.5) * 0.1;
      } else {
        // lost it: cast side to side, then wander
        a.lost++;
        a.h += a.lost < 6 ? (a.lost % 2 ? 1 : -1) * 0.6 : (Math.random() - 0.5) * 0.9;
      }
    }
    const surge = a.lost === 0 && a.lastL + a.lastR > 3 ? 1.3 : 0.8;
    a.x += Math.cos(a.h) * speed * surge; a.y += Math.sin(a.h) * speed * surge;
    if (a.x < 10 || a.x > W - 10) a.h = Math.PI - a.h;
    if (a.y < 10 || a.y > H - 10) a.h = -a.h;
    a.x = Math.max(10, Math.min(W - 10, a.x)); a.y = Math.max(10, Math.min(H - 10, a.y));
    a.trail.push([a.x, a.y]); if (a.trail.length > 600) a.trail.shift();
    if (Math.hypot(a.x - a.sx, a.y - a.sy) < 40) {
      a.reached++; setFound(a.reached);
      Object.assign(a, { x: 40 + Math.random() * 120, y: 60 + Math.random() * 280, h: Math.random() * 6.28, trail: [], sx: 470 + Math.random() * 120, sy: 90 + Math.random() * 220 });
      a.attempts++; setTries(a.attempts);
    }
    drawArena(true);
  }, { running: !!brain, speed: 1 });

  const drawArena = (withFly: boolean) => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const x = c.getContext("2d")!; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#070a10"; x.fillRect(0, 0, W, H);
    // plume
    const img = x.createImageData(W / 8, H / 8);
    const col = hex(odor.hue);
    for (let j = 0; j < H / 8; j++) for (let i = 0; i < W / 8; i++) {
      const v = conc(i * 8 + 4, j * 8 + 4), k = (j * (W / 8) + i) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = v * 170;
    }
    const tmp = document.createElement("canvas"); tmp.width = W / 8; tmp.height = H / 8; tmp.getContext("2d")!.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true; x.drawImage(tmp, 0, 0, W, H);
    const a = A.current;
    x.fillStyle = odor.hue; x.beginPath(); x.arc(a.sx, a.sy, 7, 0, 6.28); x.fill();
    x.strokeStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(a.sx, a.sy, 40, 0, 6.28); x.stroke();
    x.fillStyle = "rgba(255,255,255,.35)"; x.font = "11px ui-monospace, monospace"; x.fillText("wind ←", W - 64, 18);
    if (!withFly) return;
    x.strokeStyle = "rgba(255,160,100,.55)"; x.lineWidth = 1.5; x.beginPath();
    a.trail.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
    x.save(); x.translate(a.x, a.y); x.rotate(a.h);
    x.fillStyle = "#d9c7a3"; x.beginPath(); x.ellipse(-2, 0, 9, 5, 0, 0, 6.28); x.fill();
    x.fillStyle = "rgba(200,220,255,.5)"; x.beginPath(); x.ellipse(-5, -6, 7, 3.5, -0.4, 0, 6.28); x.ellipse(-5, 6, 7, 3.5, 0.4, 0, 6.28); x.fill();
    x.fillStyle = "#b3261e"; x.beginPath(); x.arc(6, -3, 2.6, 0, 6.28); x.arc(6, 3, 2.6, 0, 6.28); x.fill();
    const tot = a.lastL + a.lastR || 1;
    x.strokeStyle = `rgba(255,190,120,${0.3 + (0.7 * a.lastL) / tot})`; x.beginPath(); x.moveTo(8, -2); x.lineTo(15, -7); x.stroke();
    x.strokeStyle = `rgba(255,190,120,${0.3 + (0.7 * a.lastR) / tot})`; x.beginPath(); x.moveTo(8, 2); x.lineTo(15, 7); x.stroke();
    x.restore();
  };

  useEffect(() => { A.current.trail = []; }, [odor]);
  const maxF = finger[0]?.[1] ?? 1;

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Smell lab">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} label="Autopilot" desc="The fly is tracking the smell by itself: it sniffs with both antennae and turns toward whichever side's smell neurons fire more." />
          <WiringToggle scrambled={scrambled} onChange={setScrambled} />
        </div>
        <div className="odors" role="radiogroup" aria-label="Odour">
          {ODORS.map((o) => (
            <button key={o.id} role="radio" aria-checked={odor.id === o.id} className="odor" onClick={() => setOdor(o)}>
              <i style={{ background: o.hue }} /><b>{o.name}</b><span className="muted small">{o.note} · {o.glom}</span>
            </button>
          ))}
        </div>
        <div className="arena-wrap">
          <canvas ref={cv} className="arena" style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`Arena with a ${odor.name} plume${auto ? " and a fly tracking it" : ""}`} />
          {auto && <div className="arena-hud mono small">sources found {found} · attempt {tries}</div>}
          {!auto && <div className="arena-hud mono small">sniff lab: both antennae, full strength, every 0.7 s</div>}
        </div>
        <div className="finger">
          <h3>Odour fingerprint <span className="muted small">projection-neuron spikes per glomerulus, last sniff</span></h3>
          {finger.length ? finger.map(([g, n]) => (
            <div key={g} className="fbar"><span className="mono">{g}</span><i style={{ width: `${(100 * n) / maxF}%`, background: odor.hue }} /><b className="mono">{n}</b></div>
          )) : <p className="empty">Waiting for the first sniff…</p>}
        </div>
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} title="Live brain" subtitle={pack ? `${pack.n.toLocaleString()} smell-circuit neurons` : "loading…"}>
          <div className="meters">
            <Meter label="Left projection neurons" value={pnL} max={Math.max(40, pnL, pnR)} unit="spikes" hint="Per sniff. The fly turns toward the bigger number." />
            <Meter label="Right projection neurons" value={pnR} max={Math.max(40, pnL, pnR)} unit="spikes" tone="blue" />
          </div>
        </LiveBrain>
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}

function hex(h: string) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
