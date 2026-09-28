"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, type Pack } from "@/lib/sim";
import { useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter, WiringToggle } from "./LiveBrain";

type Challenge = { id: string; name: string; goal: "down" | "up"; stim: [string, number][]; desc: string };
const CHALLENGES: Challenge[] = [
  { id: "stop-feast", name: "Stop the feast", goal: "down", stim: [["sugar", 200]], desc: "The fly is tasting pure sugar and its feeding neuron MN9 is firing hard. Silence up to three cell types to shut it down." },
  { id: "break-veto", name: "Break the bitter veto", goal: "up", stim: [["sugar", 200], ["bitter", 120]], desc: "Sugar plus bitter: the bitter neurons veto feeding and MN9 is silent. Find the cell types that carry the veto, and silence them to make the fly eat anyway." },
];
const EVAL_MS = 300, SETTLE_MS = 80, MAX_CUTS = 3;
const LS = "flybrain.surgeon.v1";

type Cand = { type: string; idx: number[]; cls: string; score?: number };

function typesActive(pack: Pack, brain: Brain, exclude: Set<number>): Cand[] {
  const by = new Map<string, { idx: number[]; act: number; cls: string }>();
  for (let i = 0; i < pack.n; i++) {
    const nm = pack.names[i];
    if (!nm || exclude.has(i) || pack.classes[i] === "sensory" || pack.classes[i] === "motor") continue;
    const e = by.get(nm) ?? { idx: [], act: 0, cls: pack.classes[i] };
    e.idx.push(i); e.act += brain.counts[i];
    by.set(nm, e);
  }
  // include every neuron of each type in the pack (both sides), rank by activity
  return [...by.entries()].filter(([, e]) => e.act > 0).sort((a, b) => b[1].act - a[1].act).slice(0, 48)
    .map(([type, e]) => ({ type, idx: e.idx, cls: e.cls }));
}

export default function BrainSurgeon() {
  const { geo, pack, error } = useFly("taste");
  const [scrambled, setScrambled] = useState(false);
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 21, scramble: scrambled }) : null), [pack, scrambled]);
  const [ch, setCh] = useState<Challenge>(CHALLENGES[0]);
  const [auto, setAuto] = useState(false);
  const [cuts, setCuts] = useState<Cand[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [mn9, setMn9] = useState(0);
  const [live, setLive] = useState(0);
  const [status, setStatus] = useState("Preparing the patient…");
  const [best, setBest] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<{ done: number; of: number; step: number } | null>(null);
  const [filter, setFilter] = useState("");

  // evaluation queue: each job runs the patient with a set of cuts and reports MN9
  type Job = { cuts: Cand[]; label: string; onDone: (mn9: number) => void };
  const Q = useRef<{ jobs: Job[]; cur: Job | null; t: number; spikes: number }>({ jobs: [], cur: null, t: 0, spikes: 0 });
  const mn9Trace = useRef<number[]>([]);

  const prepare = (b: Brain, c: Cand[]) => {
    b.reset(); b.clearStim(); b.silenced.fill(0);
    for (const [g, hz] of ch.stim) b.setStim(b.pack.groups[g], hz);
    for (const k of c) b.setSilenced(k.idx, true);
  };
  const enqueue = (job: Job) => { Q.current.jobs.push(job); };

  // on load / challenge change: baseline + candidate list
  useEffect(() => {
    if (!brain || !pack) return;
    Q.current = { jobs: [], cur: null, t: 0, spikes: 0 };
    setCuts([]); setBaseline(null); setCands([]); setProgress(null);
    setStatus("Measuring the patient's baseline…");
    enqueue({ cuts: [], label: "baseline", onDone: (m) => {
      setBaseline(m); setMn9(m);
      const exclude = new Set<number>(pack.groups.MN9);
      setCands(typesActive(pack, brain, exclude));
      setStatus(ch.goal === "down" ? `Baseline MN9: ${m.toFixed(0)} Hz. Pick up to three cell types to silence.` : `Baseline MN9: ${m.toFixed(0)} Hz (vetoed). Pick up to three cell types to silence.`);
    } });
    try { const s = localStorage.getItem(LS); if (s) setBest(JSON.parse(s)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain, pack, ch]);

  const operate = (c: Cand[]) => {
    setCuts(c);
    setStatus(c.length ? `Operating: silencing ${c.map((x) => x.type).join(", ")}…` : "Stitching the patient back up…");
    enqueue({ cuts: c, label: "operate", onDone: (m) => {
      setMn9(m);
      if (baseline == null) return;
      const change = ch.goal === "down" ? (baseline - m) / Math.max(1, baseline) : m;
      const sc = ch.goal === "down" ? Math.round(100 * change) : Math.round(m);
      setStatus(ch.goal === "down" ? `MN9 ${m.toFixed(0)} Hz: feeding down ${Math.max(0, sc)}%.` : `MN9 ${m.toFixed(0)} Hz ${m > 5 ? ": the fly is eating through the bitter!" : ": the veto still holds."}`);
      if (!scrambled && c.length && sc > (best[ch.id] ?? -1)) {
        const nb = { ...best, [ch.id]: sc };
        setBest(nb);
        try { localStorage.setItem(LS, JSON.stringify(nb)); } catch { /* ignore */ }
      }
    } });
  };

  // auto-surgeon: greedy search, one cut at a time
  const autoSurgeon = () => {
    if (!cands.length || baseline == null) return;
    Q.current.jobs = [];
    let chosen: Cand[] = [];
    const step = (k: number) => {
      if (k >= MAX_CUTS) { setProgress(null); operate(chosen); setStatus((s) => `Auto-surgeon done. ${s}`); return; }
      const pool = cands.filter((c) => !chosen.some((x) => x.type === c.type)).slice(0, 24);
      const results: Cand[] = [];
      setProgress({ done: 0, of: pool.length, step: k + 1 });
      pool.forEach((c, j) => enqueue({ cuts: [...chosen, c], label: `try ${c.type}`, onDone: (m) => {
        results.push({ ...c, score: m });
        setProgress({ done: j + 1, of: pool.length, step: k + 1 });
        setCands((cs) => cs.map((x) => (x.type === c.type ? { ...x, score: m } : x)));
        if (results.length === pool.length) {
          results.sort((a, b) => (ch.goal === "down" ? a.score! - b.score! : b.score! - a.score!));
          chosen = [...chosen, results[0]];
          setCuts(chosen);
          step(k + 1);
        }
      } }));
    };
    setStatus("Auto-surgeon is testing every candidate cut on the live brain…");
    step(0);
  };

  useEffect(() => { if (auto && cands.length && !progress) autoSurgeon(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auto, cands.length]);

  // the simulation loop runs jobs in small slices so the page stays responsive
  const ui = useRef(0);
  useSimLoop((ms) => {
    if (!brain || !pack) return;
    const q = Q.current;
    if (!q.cur) {
      const next = q.jobs.shift();
      if (next) { q.cur = next; q.t = 0; q.spikes = 0; prepare(brain, next.cuts); }
      else { // idle: keep the patient alive with the current cuts, for the live view
        brain.run(ms);
      }
    }
    if (q.cur) {
      const before = brain.groupCount(pack.groups.MN9);
      const slice = Math.min(ms * 4, EVAL_MS + SETTLE_MS - q.t);
      brain.run(slice);
      if (q.t >= SETTLE_MS) q.spikes += brain.groupCount(pack.groups.MN9) - before;
      q.t += slice;
      if (q.t >= EVAL_MS + SETTLE_MS) {
        const m = q.spikes / pack.groups.MN9.length / (EVAL_MS / 1000);
        const done = q.cur; q.cur = null;
        done.onDone(m);
        if (!q.jobs.length) prepare(brain, cutsRef.current);
      }
    }
    ui.current += ms;
    if (ui.current > 60) {
      ui.current = 0;
      let a = 0; for (let i = 0; i < brain.n; i++) if (brain.trace[i] > 0.05) a++;
      setLive(a);
      const tr = mn9Trace.current; let s = 0; for (const i of pack.groups.MN9) s += brain.trace[i];
      tr.push(s); if (tr.length > 160) tr.shift();
    }
  }, { running: !!brain, speed: 1, maxMsPerFrame: 10 });
  const cutsRef = useRef<Cand[]>([]);
  cutsRef.current = cuts;

  const toggleCut = (c: Cand) => {
    const has = cuts.some((x) => x.type === c.type);
    if (!has && cuts.length >= MAX_CUTS) { setStatus("Three cuts maximum. Remove one first."); return; }
    operate(has ? cuts.filter((x) => x.type !== c.type) : [...cuts, c]);
  };

  const shown = cands.filter((c) => !filter || c.type.toLowerCase().includes(filter.toLowerCase()));
  const drop = baseline != null ? (ch.goal === "down" ? Math.max(0, (baseline - mn9) / Math.max(1, baseline)) : Math.min(1, mn9 / 115)) : 0;

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Operating table">
        <div className="stage-top">
          <Autopilot on={auto} onChange={(v) => { setAuto(v); if (v) autoSurgeon(); }} label="Auto-surgeon"
            desc="The auto-surgeon is lesioning the live brain: it tries each cell type, measures MN9, keeps the best cut and repeats three times." />
          <WiringToggle scrambled={scrambled} onChange={setScrambled} />
        </div>
        <div className="seg-inline wide" role="tablist" aria-label="Challenge">
          {CHALLENGES.map((c) => <button key={c.id} role="tab" aria-selected={ch.id === c.id} aria-pressed={ch.id === c.id} onClick={() => { setAuto(false); setCh(c); }}>{c.name}</button>)}
        </div>
        <p className="lead">{ch.desc}</p>
        <div className="or">
          <div className="or-vitals">
            <div className="vital">
              <span className="eyebrow">MN9 feeding neuron</span>
              <b className="mono big">{mn9.toFixed(0)} <small>Hz</small></b>
              <span className="muted small">baseline {baseline == null ? "…" : `${baseline.toFixed(0)} Hz`}</span>
            </div>
            <div className="vital">
              <span className="eyebrow">{ch.goal === "down" ? "Feeding stopped" : "Veto broken"}</span>
              <b className="mono big">{Math.round(drop * 100)}<small>%</small></b>
              <span className="muted small">best {best[ch.id] != null ? (ch.goal === "down" ? `${best[ch.id]}%` : `${best[ch.id]} Hz`) : "-"}</span>
            </div>
            <Ecg trace={mn9Trace.current} />
          </div>
          <div className="cuts">
            <span className="eyebrow">Cuts ({cuts.length}/{MAX_CUTS})</span>
            {cuts.length ? cuts.map((c) => (
              <button key={c.type} className="cut" onClick={() => toggleCut(c)}>✂ {c.type} <span className="muted small">{c.idx.length} neurons</span> <span aria-hidden>×</span></button>
            )) : <span className="muted small">No cuts yet.</span>}
          </div>
          <p className="status" aria-live="polite">{status}{progress ? ` Step ${progress.step}/3: tested ${progress.done} of ${progress.of}.` : ""}</p>
        </div>
        <div className="cands-head">
          <h3>Candidate cell types <span className="muted small">active in this experiment, most active first</span></h3>
          <input id="cand-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter cell types" />
        </div>
        <div className="cands">
          {shown.map((c) => {
            const on = cuts.some((x) => x.type === c.type);
            return (
              <button key={c.type} className={`cand ${on ? "is-on" : ""}`} onClick={() => { setAuto(false); toggleCut(c); }} disabled={!!progress}>
                <b>{c.type}</b>
                <span className="muted small">{c.cls} · {c.idx.length}</span>
                {c.score != null && <span className="mono small cand-score">{c.score.toFixed(0)} Hz</span>}
              </button>
            );
          })}
          {!cands.length && <p className="empty">Measuring which cell types are active…</p>}
        </div>
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} stim={pack ? ch.stim.flatMap(([g]) => pack.groups[g]) : []} silence={cuts.flatMap((c) => c.idx)}
          title="Patient" subtitle={pack ? `${pack.n.toLocaleString()} neurons · blue crosses are your cuts` : "loading…"}>
          <div className="meters">
            <Meter label="MN9 · feeding" value={mn9} max={140} />
            <Meter label="Neurons firing" value={live} max={1500} unit="" tone="blue" />
          </div>
        </LiveBrain>
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}

function Ecg({ trace }: { trace: number[] }) {
  const w = 220, h = 54, max = Math.max(1, ...trace);
  const d = trace.map((v, i) => `${i ? "L" : "M"}${((i / 159) * w).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join("");
  return <svg viewBox={`0 0 ${w} ${h}`} className="ecg" aria-hidden><path d={d} /></svg>;
}
