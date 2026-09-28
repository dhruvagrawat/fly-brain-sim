"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "@/lib/sim";
import { GroupRate, useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter } from "./LiveBrain";

type Station = { id: string; name: string; bpm: number; desc: string; pattern: (string | null)[] };
// 16-step patterns: each step can pulse one stimulus group for 60 ms
const STATIONS: Station[] = [
  { id: "sugar-rush", name: "Sugar Rush", bpm: 112, desc: "Sugar pulses on the beat. Listen for the feeding circuit answering.", pattern: ["sugar", null, null, null, "sugar", null, "sugar", null, "sugar", null, null, null, "sugar", null, "sugar", "sugar"] },
  { id: "night-terrors", name: "Night Terrors", bpm: 96, desc: "Looming threats. The giant fiber drops the bass.", pattern: ["LPLC2_left", null, null, null, null, null, "LPLC2_right", null, null, null, "LPLC2_left", null, null, null, "LPLC2_right", null] },
  { id: "moonwalk", name: "Moonwalk", bpm: 104, desc: "Forward and backward walking neurons trade phrases.", pattern: ["forward_walk", null, "moonwalker", null, "forward_walk", null, "steer", null, "moonwalker", null, "forward_walk", null, "steer", null, "moonwalker", null] },
  { id: "bitter-truth", name: "Bitter Truth", bpm: 84, desc: "Bitter taste: a darker, sparser circuit.", pattern: ["bitter", null, null, null, null, null, null, null, "bitter", null, null, "salt", null, null, null, null] },
  { id: "vinegar-rave", name: "Vinegar Rave", bpm: 128, desc: "Rapid sniffs of vinegar and banana. The whole smell centre joins in.", pattern: ["ORN_vinegar", null, "ORN_banana", null, "ORN_vinegar", null, "ORN_pheromone", null, "ORN_vinegar", null, "ORN_banana", null, "ORN_vinegar", "ORN_vinegar", "ORN_pheromone", null] },
];
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
const CLASS_VOICE: Record<string, { oct: number; wave: OscillatorType; dec: number; gain: number; hue: string }> = {
  sensory: { oct: 5, wave: "sine", dec: 0.25, gain: 0.05, hue: "#3987e5" },
  central: { oct: 4, wave: "triangle", dec: 0.35, gain: 0.06, hue: "#199e70" },
  optic: { oct: 6, wave: "sine", dec: 0.5, gain: 0.035, hue: "#6fc26f" },
  visual_projection: { oct: 5, wave: "square", dec: 0.12, gain: 0.02, hue: "#c98500" },
  descending: { oct: 2, wave: "sawtooth", dec: 0.5, gain: 0.07, hue: "#d55181" },
  motor: { oct: 3, wave: "square", dec: 0.18, gain: 0.05, hue: "#e66767" },
  ascending: { oct: 4, wave: "sine", dec: 0.6, gain: 0.04, hue: "#9085e9" },
};
const DEF_VOICE = { oct: 4, wave: "triangle" as OscillatorType, dec: 0.3, gain: 0.04, hue: "#8b93a1" };

export default function BrainRadio() {
  const { geo, pack, error } = useFly("sandbox");
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 4 }) : null), [pack]);
  const [on, setOn] = useState(false);
  const [auto, setAuto] = useState(true);
  const [station, setStation] = useState<Station>(STATIONS[0]);
  const [recording, setRecording] = useState(false);
  const [dj, setDj] = useState<string>("");
  const [out, setOut] = useState({ feed: 0, esc: 0, dl: 0, dr: 0, notes: 0 });
  const audio = useRef<{ ctx: AudioContext; master: GainNode; filter: BiquadFilterNode; pan: StereoPannerNode; dest: MediaStreamAudioDestinationNode; rec?: MediaRecorder; chunks: Blob[] } | null>(null);
  const roll = useRef<HTMLCanvasElement>(null);
  const notes = useRef<{ t: number; y: number; c: string }[]>([]);
  const S = useRef({ t: 0, step: -1, bar: 0, feed: 0, esc: 0, dlr: 0, played: 0, stationId: station.id });
  const stRef = useRef(station);
  stRef.current = station;

  // per-neuron pitch (dorsal = high) and pan (left/right) from real positions
  const voice = useMemo(() => {
    if (!pack || !geo) return null;
    const n = pack.n, pitch = new Float32Array(n), pan = new Float32Array(n);
    let ymin = 1e9, ymax = -1e9, xmax = 1;
    for (let i = 0; i < n; i++) { const g = pack.global[i]; const y = geo.xyz[3 * g + 1], x = geo.xyz[3 * g]; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); xmax = Math.max(xmax, Math.abs(x)); }
    for (let i = 0; i < n; i++) { const g = pack.global[i]; pitch[i] = 1 - (geo.xyz[3 * g + 1] - ymin) / (ymax - ymin || 1); pan[i] = Math.max(-1, Math.min(1, geo.xyz[3 * g] / xmax)); }
    return { pitch, pan };
  }, [pack, geo]);
  const rates = useMemo(() => (pack ? { feed: new GroupRate(pack.groups.MN9, 300), esc: new GroupRate([...pack.groups.GF_left, ...pack.groups.GF_right], 300), dl: new GroupRate(pack.groups.DN_left, 500), dr: new GroupRate(pack.groups.DN_right, 500) } : null), [pack]);

  const start = async () => {
    if (!audio.current) {
      const ctx = new AudioContext();
      const master = ctx.createGain(); master.gain.value = 0.9;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 5000; filter.Q.value = 0.7;
      const pan = ctx.createStereoPanner();
      const comp = ctx.createDynamicsCompressor();
      const verb = ctx.createConvolver();
      const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.28;
      master.connect(filter); filter.connect(pan); pan.connect(comp); pan.connect(verb); verb.connect(wet); wet.connect(comp);
      const dest = ctx.createMediaStreamDestination();
      comp.connect(ctx.destination); comp.connect(dest);
      audio.current = { ctx, master, filter, pan, dest, chunks: [] };
    }
    await audio.current.ctx.resume();
    setOn(true);
  };
  const stop = () => { audio.current?.ctx.suspend(); setOn(false); };
  useEffect(() => () => { audio.current?.ctx.close(); }, []);

  const note = (i: number) => {
    const A = audio.current; if (!A || !pack || !voice) return;
    const cls = pack.classes[i], v = CLASS_VOICE[cls] ?? DEF_VOICE;
    const deg = Math.floor(voice.pitch[i] * 10), semis = SCALE[deg % 5] + 12 * Math.floor(deg / 5);
    const f = 55 * Math.pow(2, v.oct - 1 + semis / 12);
    const t = A.ctx.currentTime + 0.01;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain(), p = A.ctx.createStereoPanner();
    o.type = v.wave; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v.gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + v.dec);
    p.pan.value = voice.pan[i] * 0.8;
    o.connect(g); g.connect(p); p.connect(A.master);
    o.start(t); o.stop(t + v.dec + 0.05);
    notes.current.push({ t: performance.now(), y: voice.pitch[i], c: v.hue });
  };

  const ui = useRef(0);
  useSimLoop((ms) => {
    if (!brain || !pack || !rates) return;
    const s = S.current, st = stRef.current;
    s.t += ms;
    const stepMs = 60000 / st.bpm / 4;
    const step = Math.floor(s.t / stepMs) % 16;
    brain.clearStim();
    const inStep = s.t % stepMs;
    const g = st.pattern[step];
    if (g && inStep < 60) brain.setStim(pack.groups[g], g.startsWith("ORN") ? 150 : 220);
    const spikes = brain.run(ms);
    const feed = rates.feed.update(brain, ms), esc = rates.esc.update(brain, ms), dl = rates.dl.update(brain, ms), dr = rates.dr.update(brain, ms);
    // sonify: a handful of spikes per frame, spread over classes
    if (on && spikes.length) {
      const budget = Math.min(7, spikes.length);
      const seen = new Set<string>();
      for (let k = 0, tries = 0; k < budget && tries < budget * 4; tries++) {
        const i = spikes[Math.floor(Math.random() * spikes.length)];
        const c = pack.classes[i];
        if (seen.has(c) && seen.size < 4) continue;
        seen.add(c); note(i); k++; s.played++;
      }
      // brain outputs shape the mix: feeding opens the filter, left/right descending balance pans
      const A = audio.current;
      if (A) {
        A.filter.frequency.setTargetAtTime(900 + Math.min(1, feed / 100) * 7000 + Math.min(1, esc / 150) * 3000, A.ctx.currentTime, 0.2);
        A.pan.pan.setTargetAtTime(Math.max(-0.6, Math.min(0.6, (dr - dl) * 0.8)), A.ctx.currentTime, 0.4);
      }
    }
    s.feed = Math.max(s.feed * 0.998, feed); s.esc = Math.max(s.esc * 0.998, esc); s.dlr = (dl + dr);
    // autopilot DJ: every 4 bars the brain picks the next station
    if (step !== s.step) { s.step = step; if (step === 0) s.bar++; }
    if (auto && s.bar >= 4) {
      s.bar = 0;
      let next: Station, why: string;
      if (s.esc > 60) { next = STATIONS.find((x) => x.id === "moonwalk")!; why = `the giant fiber hit ${s.esc.toFixed(0)} Hz, so the fly backs off into Moonwalk`; }
      else if (s.feed > 60) { next = STATIONS.find((x) => x.id === "bitter-truth")!; why = `MN9 peaked at ${s.feed.toFixed(0)} Hz: full, so it cools down with Bitter Truth`; }
      else if (st.id === "bitter-truth") { next = STATIONS.find((x) => x.id === "vinegar-rave")!; why = "feeding went quiet, so it goes looking for food: Vinegar Rave"; }
      else if (st.id === "vinegar-rave") { next = STATIONS.find((x) => x.id === "sugar-rush")!; why = "smelled food, now it wants sugar"; }
      else { next = STATIONS.find((x) => x.id === "night-terrors")!; why = "things got calm, so something looms"; }
      s.feed = 0; s.esc = 0;
      setStation(next); setDj(why);
    }
    ui.current += ms;
    if (ui.current > 80) { ui.current = 0; setOut({ feed, esc, dl, dr, notes: s.played }); drawRoll(); }
  }, { running: !!brain, speed: 1, maxMsPerFrame: 14 });

  const drawRoll = () => {
    const c = roll.current; if (!c) return;
    const W = c.clientWidth, H = 150, dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = H * dpr; }
    const x = c.getContext("2d")!; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#070a10"; x.fillRect(0, 0, W, H);
    const now = performance.now(), span = 6000;
    notes.current = notes.current.filter((n) => now - n.t < span);
    for (const n of notes.current) { const px = W - ((now - n.t) / span) * W; x.fillStyle = n.c; x.globalAlpha = 1 - (now - n.t) / span; x.fillRect(px, 6 + (1 - n.y) * (H - 14), 6, 3); }
    x.globalAlpha = 1;
  };

  const record = () => {
    const A = audio.current; if (!A) return;
    if (recording && A.rec) { A.rec.stop(); setRecording(false); return; }
    A.chunks = [];
    const rec = new MediaRecorder(A.dest.stream);
    rec.ondataavailable = (e) => A.chunks.push(e.data);
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(A.chunks, { type: rec.mimeType || "audio/webm" }));
      const a = document.createElement("a"); a.href = url; a.download = `flybrain-radio-${station.id}.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    rec.start(); A.rec = rec; setRecording(true);
  };

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Radio">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} label="Fly DJ" desc="The fly is DJing. Every 4 bars its own brain outputs pick the next station, feeding opens the filter, and left/right walking signals pan the mix." />
        </div>
        <div className="radio-deck">
          <button className={`radio-play ${on ? "is-on" : ""}`} onClick={on ? stop : start} aria-label={on ? "Stop radio" : "Start radio"} disabled={!brain}>
            <svg viewBox="0 0 24 24" aria-hidden>{on ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4v16l13-8z" />}</svg>
          </button>
          <div>
            <p className="eyebrow">Now playing</p>
            <h2 className="radio-title">{station.name}</h2>
            <p className="muted small">{station.desc} · {station.bpm} bpm</p>
            {auto && dj && <p className="dj small">DJ fly: {dj}</p>}
          </div>
          <button className="btn ghost small" onClick={record} disabled={!on}>{recording ? "Stop & download" : "Record"}</button>
        </div>
        <canvas ref={roll} className="roll" style={{ height: 150 }} aria-label="Scrolling view of notes played by the fly brain" role="img" />
        <div className="stations" role="radiogroup" aria-label="Station">
          {STATIONS.map((s) => (
            <button key={s.id} role="radio" aria-checked={station.id === s.id} className="station" onClick={() => { setAuto(false); setStation(s); }}>
              <b>{s.name}</b><span className="muted small">{s.bpm} bpm</span>
              <span className="steps" aria-hidden>{s.pattern.map((p, k) => <i key={k} className={p ? "on" : ""} />)}</span>
            </button>
          ))}
        </div>
        <div className="legend-inline small">
          {Object.entries(CLASS_VOICE).map(([k, v]) => <span key={k}><i className="dot" style={{ background: v.hue }} /> {k.replace("_", " ")}</span>)}
        </div>
        {!on && <p className="muted small">Press play to hear it. Audio starts only when you ask.</p>}
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} title="Live brain" subtitle={pack ? `${pack.n.toLocaleString()} neurons · each spike can be a note` : "loading…"}>
          <div className="meters">
            <Meter label="Feeding · MN9 (filter)" value={out.feed} max={140} />
            <Meter label="Escape · giant fiber (energy)" value={out.esc} max={220} tone="blue" />
            <Meter label="Notes played" value={out.notes} max={Math.max(100, out.notes)} unit="" tone="green" />
          </div>
        </LiveBrain>
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}
