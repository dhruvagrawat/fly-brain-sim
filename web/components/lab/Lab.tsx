"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import BrainGL, { type BrainHandle, type ViewName } from "@/components/BrainGL";
import CommandPalette from "./CommandPalette";
import { PopulationChart, Raster } from "./Charts";
import { Compare, NeuronTable, Outputs, RunLog } from "./Parts";
import { Clock } from "@/lib/clock";
import { Backend, loadGeometry, loadPresets, loadRecordedRun, loadRunIndex, type Geometry, type Preset, type Run, type RunSummary } from "@/lib/data";
import type { Action } from "@/lib/commands";
import { parseCommand } from "@/lib/commands";
import { CLASS_LABEL, behaviourOf, fmt, nameOf } from "@/lib/labels";

const LS_BACKEND = "flybrain.backend";
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

type Conn = { state: "checking" | "offline" | "online"; backend: Backend | null; url: string };

export default function Lab() {
  const clock = useMemo(() => new Clock(), []);
  const brain = useRef<BrainHandle>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [index, setIndex] = useState<RunSummary[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState<Run[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [stim, setStim] = useState<string[]>([]);
  const [sil, setSil] = useState<string[]>([]);
  const [rate, setRate] = useState(200);
  const [trials, setTrials] = useState(5);
  const [duration, setDuration] = useState(1000);
  const [stimInput, setStimInput] = useState("");
  const [silInput, setSilInput] = useState("");

  const [mode, setMode] = useState<"replay" | "mean">("replay");
  const [view, setView] = useState<ViewName | null>("front");
  const [selected, setSelected] = useState(-1);
  const [hidden, setHidden] = useState<Set<string>>(new Set(["stimulated"]));
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [conn, setConn] = useState<Conn>({ state: "checking", backend: null, url: "http://127.0.0.1:8050" });
  const [connectOpen, setConnectOpen] = useState(false);
  const [progress, setProgress] = useState<{ busy: boolean; msg: string; frac: number; err?: boolean }>({ busy: false, msg: "", frac: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // latest state for command execution
  const st = useRef({ stim, sil, rate, trials, duration, run, log, compare, conn, index });
  st.current = { stim, sil, rate, trials, duration, run, log, compare, conn, index };

  // ---------- run loading ----------
  const showRun = useCallback((r: Run) => {
    clock.pause();
    clock.duration = r.params.t_run;
    clock.set(0);
    setRun(r);
    setSelected(-1);
    setShowCompare(false);
    setStim(r.stim_spec ?? []);
    setSil(r.silence_spec ?? []);
    setRate(r.params.rate);
    setTrials(r.params.n_run);
    setDuration(r.params.t_run);
  }, [clock]);

  const addToLog = useCallback((r: Run) => setLog((l) => [...l.filter((x) => !(x.id && x.id === r.id && x.source === "recorded" && r.source === "recorded")), r].slice(-20)), []);

  const openRecorded = useCallback(async (id: string) => {
    const existing = st.current.log.find((r) => r.id === id && r.source === "recorded");
    if (existing) { showRun(existing); return; }
    const r = await loadRecordedRun(id);
    addToLog(r);
    showRun(r);
  }, [addToLog, showRun]);

  // ---------- live simulation ----------
  const simulate = useCallback(async (over?: Partial<{ stim: string[]; sil: string[] }>) => {
    const s = st.current;
    const stimNow = over?.stim ?? s.stim, silNow = over?.sil ?? s.sil;
    if (!s.conn.backend || s.conn.state !== "online") { setConnectOpen(true); return; }
    if (!stimNow.length) { say("Choose something to stimulate first."); return; }
    setProgress({ busy: true, msg: "Starting…", frac: 0.02 });
    const t0 = Date.now();
    try {
      const label = stimNow.map((x) => x.replace(/_/g, " ")).join(" + ") + (silNow.length ? ` · silenced ${silNow.join(", ")}` : "");
      const r = await s.conn.backend.run(
        { stim: stimNow, silence: silNow, rate: s.rate, trials: s.trials, duration: s.duration, label },
        (tr, of) => setProgress({ busy: true, msg: `Simulating trial ${Math.min(tr + 1, of)} of ${of} · ${Math.round((Date.now() - t0) / 1000)} s`, frac: Math.max(0.02, tr / of) }),
      );
      r.stim_spec = stimNow; r.silence_spec = silNow;
      addToLog(r);
      showRun(r);
      setProgress({ busy: false, msg: `Done in ${Math.round((Date.now() - t0) / 1000)} s`, frac: 1 });
      setTimeout(() => setProgress((p) => (p.busy ? p : { ...p, frac: 0 })), 1200);
    } catch (e) {
      setProgress({ busy: false, msg: (e as Error).message, frac: 0, err: true });
    }
  }, [addToLog, showRun, say]);

  // ---------- selection ----------
  const select = useCallback((i: number, scroll = true) => {
    setSelected(i);
    if (scroll) setTimeout(() => document.querySelector(`tr[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 30);
  }, []);

  // ---------- helpers ----------
  const cliCommand = useCallback(() => {
    const s = st.current;
    const q = (xs: string[]) => xs.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(" ");
    return `python -m flybrain run --stim ${q(s.stim) || "sugar"}${s.sil.length ? ` --silence ${q(s.sil)}` : ""} --rate ${s.rate} --trials ${s.trials} --duration ${s.duration}`;
  }, []);

  const exportCsv = useCallback(() => {
    const r = st.current.run;
    if (!r) return say("Load a run first.");
    const head = "rank,flywire_id,cell_type,class,side,transmitter,rate_hz,std_hz,stimulated\n";
    const body = r.active.map((x, k) => [k + 1, x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8]].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `flybrain-${(r.id ?? r.label).replace(/[^\w]+/g, "_").slice(0, 40)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Downloaded ${r.active.length} neurons as CSV`);
  }, [say]);

  const copy = useCallback(async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); say(`Copied ${what}`); } catch { say(text); }
  }, [say]);

  // ---------- command execution ----------
  const execute = useCallback((actions: Action[]) => {
    let nextStim = st.current.stim, nextSil = st.current.sil, replaced = false;
    for (const a of actions) {
      switch (a.kind) {
        case "stim":
          if (!replaced && st.current.run?.source === "recorded") { nextStim = []; replaced = true; }
          nextStim = [...nextStim, ...a.targets.filter((t) => !nextStim.includes(t))];
          setStim(nextStim); break;
        case "silence": nextSil = [...nextSil, ...a.targets.filter((t) => !nextSil.includes(t))]; setSil(nextSil); break;
        case "rate": setRate(Math.max(1, Math.min(1000, a.hz))); st.current.rate = a.hz; break;
        case "trials": setTrials(Math.max(1, Math.min(50, a.n))); st.current.trials = a.n; break;
        case "duration": setDuration(Math.max(50, Math.min(5000, a.ms))); st.current.duration = a.ms; break;
        case "clear":
          if (a.what !== "silence") { nextStim = []; setStim([]); }
          if (a.what !== "stim") { nextSil = []; setSil([]); }
          break;
        case "run": simulate({ stim: nextStim, sil: nextSil }); break;
        case "view": brain.current?.setView(a.view); break;
        case "mode": setMode(a.mode); if (a.mode === "mean") clock.pause(); break;
        case "play": setMode("replay"); clock.play(); break;
        case "pause": clock.pause(); break;
        case "speed": clock.speed = a.x; setSpeed(a.x); break;
        case "seek": setMode("replay"); clock.set(a.ms); break;
        case "find": {
          const r = st.current.run;
          const q = a.query.toLowerCase();
          const hit = r?.active.find((x) => x[1] === a.query) ?? r?.active.find((x) => (x[2] || "").toLowerCase() === q)
            ?? r?.active.find((x) => (x[2] || "").toLowerCase().includes(q) || (behaviourOf(x) ?? "").toLowerCase().includes(q));
          if (hit) { select(hit[0]); say(`Found ${nameOf(hit)} · ${hit[6].toFixed(1)} Hz`); }
          else say(`“${a.query}” didn't fire in this run`);
          break;
        }
        case "open": {
          const q = a.run.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const hit = st.current.index.find((r) => r.id === q) ?? st.current.index.find((r) => r.id!.includes(q) || r.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").includes(q));
          if (hit) openRecorded(hit.id!); else say(`No recorded run matches “${a.run}”`);
          break;
        }
        case "compare": {
          const l = st.current.log, c = st.current.compare;
          const pair = c.length === 2 ? c : l.slice(-2).map((r) => r.key);
          if (pair.length < 2) say("Open or run at least two experiments to compare");
          else { setCompare(pair); setShowCompare(true); setTimeout(() => document.getElementById("compare")?.scrollIntoView({ behavior: "smooth" }), 50); }
          break;
        }
        case "export": exportCsv(); break;
        case "copycli": copy(cliCommand(), "terminal command"); break;
        case "go": window.location.href = a.path; break;
      }
    }
  }, [simulate, clock, select, say, openRecorded, exportCsv, copy, cliCommand]);

  // ---------- boot ----------
  useEffect(() => {
    (async () => {
      const [g, p, idx] = await Promise.all([loadGeometry(), loadPresets(), loadRunIndex()]);
      setGeo(g); setPresets(p); setIndex(idx);
      st.current.index = idx;
      const params = new URLSearchParams(window.location.search);
      const first = params.get("run") && idx.find((r) => r.id === params.get("run")) ? params.get("run")! : idx[0]?.id;
      if (first) await openRecorded(first);
      const cmd = params.get("cmd");
      if (cmd) setTimeout(() => execute(parseCommand(cmd).actions), 50);
    })().catch(() => say("Couldn't load the brain data. Reload the page to try again."));
    // backend: same origin first (python -m flybrain serve), then a saved address
    (async () => {
      const same = Backend.sameOrigin();
      if (await same.ping()) return setConn({ state: "online", backend: same, url: window.location.origin });
      const saved = lsGet(LS_BACKEND);
      if (saved) {
        const b = new Backend(saved);
        if (await b.ping()) return setConn({ state: "online", backend: b, url: saved });
      }
      setConn((c) => ({ ...c, state: "offline", backend: null, url: saved || c.url }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clock.subscribe(() => setPlaying(clock.playing)), [clock]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      const typing = /INPUT|SELECT|TEXTAREA/.test(tag);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (typing || paletteOpen) return;
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
      else if (e.code === "Space" && tag !== "BUTTON") { e.preventDefault(); if (mode !== "replay") setMode("replay"); clock.toggle(); }
      else if (e.key === "1") brain.current?.setView("front");
      else if (e.key === "2") brain.current?.setView("top");
      else if (e.key === "3") brain.current?.setView("side");
      else if (e.key === "m") setMode((m) => (m === "mean" ? "replay" : "mean"));
      else if (e.key === "ArrowRight") clock.set(clock.t + 10);
      else if (e.key === "ArrowLeft") clock.set(clock.t - 10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock, mode, paletteOpen]);

  const connect = async (url: string) => {
    setConn((c) => ({ ...c, state: "checking", url }));
    const b = new Backend(url.trim());
    if (await b.ping(3000)) {
      lsSet(LS_BACKEND, url.trim());
      setConn({ state: "online", backend: b, url: url.trim() });
      setConnectOpen(false);
      say("Connected to your simulator. Live runs are on.");
    } else {
      setConn({ state: "offline", backend: null, url });
      say("No simulator answered at that address.");
    }
  };

  const selRow = run && selected >= 0 ? run.byIndex.get(selected) : undefined;
  const hovRow = run && hover && hover.i >= 0 ? run.byIndex.get(hover.i) : undefined;
  const cmpRuns = compare.map((k) => log.find((r) => r.key === k)).filter(Boolean) as Run[];

  const addTok = (which: "stim" | "sil", v: string) => {
    v = v.trim();
    if (!v) return;
    if (which === "stim") setStim((s) => (s.includes(v) ? s : [...s, v]));
    else setSil((s) => (s.includes(v) ? s : [...s, v]));
  };

  return (
    <div className="lab">
      {/* ---------- left rail ---------- */}
      <aside className="panel rail" aria-label="Experiment setup">
        <button className="cmdk" onClick={() => setPaletteOpen(true)}>
          <span>Type a command…</span><kbd>⌘K</kbd>
        </button>

        <section className="rail-sec">
          <h2 className="eyebrow">Recorded experiments</h2>
          <div className="runs">
            {index.map((r) => (
              <button key={r.id} className="run-item" aria-pressed={run?.id === r.id && run?.source === "recorded"} onClick={() => openRecorded(r.id!)}>
                <b>{r.label}</b>
                <span>{r.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rail-sec">
          <div className="sec-head"><h2 className="eyebrow">Stimulate</h2></div>
          <div className="chips">
            {presets.filter((p) => p.n > 0).map((p) => (
              <button key={p.name} className="chip" title={`${p.desc} · ${p.n} neurons`} aria-pressed={stim.includes(p.name)}
                onClick={() => setStim((s) => (s.includes(p.name) ? s.filter((x) => x !== p.name) : [...s, p.name]))}>
                {p.name.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="tokens" data-empty="Pick a preset or add a cell type">
            {stim.map((t) => <span key={t} className="token">{t}<button aria-label={`Remove ${t}`} onClick={() => setStim((s) => s.filter((x) => x !== t))}>×</button></span>)}
          </div>
          <form className="addrow" onSubmit={(e) => { e.preventDefault(); addTok("stim", stimInput); setStimInput(""); }}>
            <input id="stim-input" className="input" list="celltypes" value={stimInput} onChange={(e) => setStimInput(e.target.value)} placeholder="Cell type or FlyWire ID" autoComplete="off" />
            <button className="btn">Add</button>
          </form>
        </section>

        <section className="rail-sec">
          <h2 className="eyebrow">Silence</h2>
          <div className="tokens" data-empty="Nothing silenced">
            {sil.map((t) => <span key={t} className="token is-sil">{t}<button aria-label={`Remove ${t}`} onClick={() => setSil((s) => s.filter((x) => x !== t))}>×</button></span>)}
          </div>
          <form className="addrow" onSubmit={(e) => { e.preventDefault(); addTok("sil", silInput); setSilInput(""); }}>
            <input id="sil-input" className="input" list="celltypes" value={silInput} onChange={(e) => setSilInput(e.target.value)} placeholder="Cell type or FlyWire ID" autoComplete="off" />
            <button className="btn">Add</button>
          </form>
        </section>

        <section className="rail-sec">
          <div className="sec-head"><label className="eyebrow" htmlFor="rate">Stimulation rate</label><span className="mono">{rate} Hz</span></div>
          <input id="rate" type="range" min={10} max={400} step={10} value={rate} onChange={(e) => setRate(+e.target.value)} />
          <div className="grid2">
            <label htmlFor="trials">Trials<input id="trials" className="input" type="number" min={1} max={50} value={trials} onChange={(e) => setTrials(+e.target.value)} /></label>
            <label htmlFor="duration">Trial length
              <select id="duration" className="input" value={duration} onChange={(e) => setDuration(+e.target.value)}>
                {[250, 500, 1000, 2000].map((d) => <option key={d} value={d}>{d} ms</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="rail-sec">
          <button className="btn primary" onClick={() => simulate()} disabled={progress.busy}>
            {conn.state === "online" ? (progress.busy ? "Simulating…" : "Run simulation") : "Run simulation"}
          </button>
          <div className="progress" aria-hidden><i style={{ width: `${progress.frac * 100}%` }} /></div>
          <div className={`status ${progress.err ? "is-err" : ""}`} role="status">{progress.msg}</div>
          <button className={`conn conn-${conn.state}`} onClick={() => setConnectOpen(true)}>
            <i aria-hidden />
            {conn.state === "online" ? `Live simulator connected` : conn.state === "checking" ? "Looking for a simulator…" : "Recorded runs only · connect a simulator"}
          </button>
        </section>

        <section className="rail-sec">
          <div className="sec-head">
            <h2 className="eyebrow">Experiment log</h2>
            <button className="btn ghost small" onClick={() => execute([{ kind: "compare" }])} disabled={log.length < 2}>Compare</button>
          </div>
          <RunLog log={log} current={run?.key ?? null} compare={compare}
            onOpen={(k) => { const r = log.find((x) => x.key === k); if (r) showRun(r); }}
            onToggleCompare={(k) => setCompare((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k].slice(-2)))} />
        </section>
      </aside>

      {/* ---------- main ---------- */}
      <div className="lab-main">
        <section className="panel scope-panel" aria-label="Brain activity">
          <div className="run-head">
            <div>
              <h1 className="run-title">{run?.label ?? "Loading the brain…"}</h1>
              {run && (
                <div className="stats">
                  <span><b>{fmt.format(run.n_active)}</b> of {fmt.format(geo?.n ?? 0)} neurons fired</span>
                  <span><b>{fmt.format(run.n_spikes)}</b> spikes</span>
                  <span>{run.params.n_run} × {fmt.format(run.params.t_run)} ms at {run.params.rate} Hz</span>
                  {run.silence.length > 0 && <span>{run.silence.length} silenced</span>}
                  <span className={`pill ${run.source}`}>{run.source}</span>
                </div>
              )}
            </div>
            <div className="run-actions">
              <button className="btn ghost small" onClick={() => copy(cliCommand(), "terminal command")}>Copy CLI</button>
              <button className="btn ghost small" onClick={exportCsv}>CSV</button>
              <button className="btn ghost small" onClick={() => {
                const cmd = `${stim.length ? "stim " + stim.join(" ") : ""} ${sil.length ? "silence " + sil.join(" ") : ""} rate ${rate}`.trim();
                const url = `${window.location.origin}/lab/?${run?.source === "recorded" && run.id ? `run=${run.id}` : `cmd=${encodeURIComponent(cmd)}`}`;
                copy(url, "link to this experiment");
              }}>Share</button>
            </div>
          </div>

          <div className="scope">
            <BrainGL ref={brain} geo={geo} run={run} clock={clock} mode={mode} selected={selected} interactive
              onPick={(i) => select(i)} onHover={(i, x, y) => setHover(i >= 0 ? { i, x, y } : null)} onViewChange={setView} />
            <div className="scope-ui tl">
              <div className="seg">
                {(["front", "top", "side"] as ViewName[]).map((v, k) => (
                  <button key={v} aria-pressed={view === v} onClick={() => brain.current?.setView(v)} title={`${v} view (${k + 1})`}>{v[0].toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="scope-ui tr">
              <div className="seg">
                <button aria-pressed={mode === "replay"} onClick={() => setMode("replay")}>Replay</button>
                <button aria-pressed={mode === "mean"} onClick={() => { setMode("mean"); clock.pause(); }} title="Mean firing rate (M)">Mean rate</button>
              </div>
            </div>
            <div className="scope-ui bl">
              <span className="scope-note">drag to rotate · scroll to zoom · click a glowing neuron</span>
              <span className="lut"><span>{mode === "mean" ? "0 Hz" : "quiet"}</span><i /><span>{mode === "mean" ? `${Math.round(run?.maxRate ?? 0)} Hz` : "bursting"}</span></span>
            </div>
            {hovRow && hover && (
              <div className="tip scope-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                <b>{nameOf(hovRow)}</b>
                <small>{CLASS_LABEL[hovRow[3]] ?? hovRow[3]}{hovRow[4] ? ` · ${hovRow[4]}` : ""}{behaviourOf(hovRow) ? ` · ${behaviourOf(hovRow)}` : ""}</small>
                <span className="mono">{hovRow[6].toFixed(1)} Hz mean</span>
              </div>
            )}
            {!geo && <div className="scope-loading">Loading 138,639 neurons…</div>}
          </div>

          <Playbar clock={clock} playing={playing} speed={speed} onSpeed={(x) => { clock.speed = x; setSpeed(x); }} onPlay={() => { setMode("replay"); clock.toggle(); }} duration={run?.params.t_run ?? 1000} />

          {selRow && (
            <div className="info">
              <span className="info-name">{nameOf(selRow)}</span>
              <span className="muted">{CLASS_LABEL[selRow[3]] ?? selRow[3]}{selRow[4] ? ` · ${selRow[4]}` : ""}{selRow[5] ? ` · ${selRow[5]}` : ""}{behaviourOf(selRow) ? ` · ${behaviourOf(selRow)}` : ""}</span>
              <span className="mono">{selRow[6].toFixed(1)} ± {selRow[7].toFixed(1)} Hz</span>
              <span className="mono muted">{selRow[1]}</span>
              <span className="info-acts">
                <button className="btn small" onClick={() => { addTok("stim", selRow[2] || selRow[1]); say(`Added ${nameOf(selRow)} to stimulus`); }}>Stimulate this type</button>
                <button className="btn small" onClick={() => { addTok("sil", selRow[1]); say(`Will silence ${nameOf(selRow)} in the next run`); }}>Silence this neuron</button>
                <a className="btn ghost small" href={`https://codex.flywire.ai/app/cell_details?root_id=${selRow[1]}`} target="_blank" rel="noopener noreferrer">FlyWire Codex ↗</a>
              </span>
            </div>
          )}
        </section>

        {showCompare && cmpRuns.length === 2 && (
          <div id="compare"><Compare a={cmpRuns[0]} b={cmpRuns[1]} onClose={() => setShowCompare(false)} onSelect={(i) => select(i)} /></div>
        )}

        {run && (
          <>
            <section className="panel card" aria-label="Brain output">
              <div className="card-head">
                <h3>Brain output</h3>
                <span className="muted small">Descending and motor neurons that fired: what the brain tells the body</span>
              </div>
              <Outputs run={run} onSelect={(i) => select(i)} />
            </section>

            <div className="cards">
              <section className="panel card" aria-label="Population activity">
                <div className="card-head"><h3>Population activity</h3><span className="muted small">Spikes per second by class, averaged over trials</span></div>
                <PopulationChart run={run} clock={clock} hidden={hidden} onToggle={(k) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
              </section>
              <section className="panel card" aria-label="Spike raster">
                <div className="card-head"><h3>Spike raster</h3><span className="muted small">Most active neurons, trial 1. Stimulated rows in orange.</span></div>
                <Raster run={run} clock={clock} selected={selected} onSelect={(i) => select(i, true)} />
              </section>
            </div>

            <section className="panel card" aria-label="Active neurons">
              <NeuronTable run={run} selected={selected} onSelect={(i) => select(i, false)} />
            </section>
          </>
        )}
      </div>

      <datalist id="celltypes">
        {geo?.cellTypes.slice(0, 6000).map(([t]) => <option key={t} value={t} />)}
      </datalist>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onRun={execute} presets={presets} runs={index} cellTypes={geo?.cellTypes ?? []} run={run} />

      {connectOpen && (
        <div className="palette-backdrop" onMouseDown={() => setConnectOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="connect-title">Connect your simulator</h2>
            <p>This site replays recorded experiments. To run new ones, start the simulator on your computer. It takes about 10 seconds per simulated second on one CPU core.</p>
            <ol className="steps-mini">
              <li><code>git clone https://github.com/dhruvagrawat/fly-brain-sim && cd fly-brain-sim</code></li>
              <li><code>pip install -r requirements.txt && python -m flybrain fetch</code></li>
              <li><code>python -m flybrain serve</code></li>
            </ol>
            <p className="muted small">Then open <code>http://127.0.0.1:8050</code>, or connect this page to it:</p>
            <form className="addrow" onSubmit={(e) => { e.preventDefault(); connect((e.currentTarget.elements.namedItem("backend-url") as HTMLInputElement).value); }}>
              <input id="backend-url" name="backend-url" className="input" defaultValue={conn.url} aria-label="Simulator address" />
              <button className="btn primary-sm" disabled={conn.state === "checking"}>{conn.state === "checking" ? "Checking…" : "Connect"}</button>
            </form>
            {conn.state === "online" && <p className="ok">Connected to {conn.url || "this server"}.</p>}
            <div className="dialog-foot">
              <Link href="/docs/getting-started/" className="btn ghost small">Setup guide</Link>
              <button className="btn ghost small" onClick={() => setConnectOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Playbar({ clock, playing, speed, onSpeed, onPlay, duration }: { clock: Clock; playing: boolean; speed: number; onSpeed: (x: number) => void; onPlay: () => void; duration: number }) {
  const scrub = useRef<HTMLInputElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  useEffect(() => clock.subscribe((t) => {
    if (scrub.current && document.activeElement !== scrub.current) scrub.current.value = String(t);
    if (tRef.current) tRef.current.textContent = `${t.toFixed(1)} ms`;
  }), [clock]);
  return (
    <div className="playbar">
      <button className="play" onClick={onPlay} aria-label={playing ? "Pause" : "Play"}>
        <svg viewBox="0 0 14 14" aria-hidden>{playing ? <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" /> : <path d="M3 1.5v11l9-5.5z" />}</svg>
      </button>
      <span className="clock mono" ref={tRef}>0.0 ms</span>
      <input ref={scrub} id="scrub" type="range" min={0} max={duration} step={0.5} defaultValue={0} aria-label="Replay time" onInput={(e) => clock.set(+(e.target as HTMLInputElement).value)} />
      <label className="muted small" htmlFor="speed">Speed</label>
      <select id="speed" className="input small" value={speed} onChange={(e) => onSpeed(+e.target.value)}>
        <option value={0.02}>1/50×</option><option value={0.05}>1/20×</option><option value={0.1}>1/10×</option><option value={0.25}>1/4×</option><option value={1}>real time</option>
      </select>
      <span className="muted small kbd-hint"><kbd>space</kbd> play · <kbd>←</kbd><kbd>→</kbd> step</span>
    </div>
  );
}


