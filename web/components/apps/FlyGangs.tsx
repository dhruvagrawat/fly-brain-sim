"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, rng } from "@/lib/sim";
import { getGeometry, getPack } from "@/lib/useFly";
import type { Geometry } from "@/lib/data";
import type { Pack } from "@/lib/sim";
import { Autopilot, LiveBrain } from "./LiveBrain";

type Gang = { id: number; name: string; color: string; cuts: string[]; gen: number; parent?: string; wins: number; last?: Result; best: number };
type Result = { feast: number; poison: number; dodge: number; score: number };
const NAMES = ["Proboscis Mafia", "Sugar Cartel", "Giant Fibre Gang", "Bitter Boys", "Moonwalk Crew", "Labellum Lords", "The Wild Types", "Kenyon Syndicate", "Looming Legion", "MN9 Posse", "Haltere Hustlers", "Ommatidia Outfit"];
const COLORS = ["#ff8a4c", "#3987e5", "#1baf7a", "#e87ba4", "#c98500", "#9085e9", "#e66767", "#6fc2c2"];
const LS = "flybrain.gangs.v1";

type Pool = { type: string; where: "taste" | "loom" }[];

function applyCuts(b: Brain, cuts: string[]) {
  b.silenced.fill(0);
  if (!cuts.length) return;
  const set = new Set(cuts);
  for (let i = 0; i < b.n; i++) if (set.has(b.pack.names[i])) b.silenced[i] = 1;
}
function rate(b: Brain, idx: number[], ms: number) { let c = 0; for (const i of idx) c += b.counts[i]; return c / idx.length / (ms / 1000); }

export default function FlyGangs() {
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [packs, setPacks] = useState<{ taste: Pack; loom: Pack } | null>(null);
  const brains = useMemo(() => (packs ? { taste: new Brain(packs.taste, { seed: 31 }), loom: new Brain(packs.loom, { seed: 32 }) } : null), [packs]);
  const [pool, setPool] = useState<Pool>([]);
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [auto, setAuto] = useState(true);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<string>("Loading brains…");
  const [evaluating, setEvaluating] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showBrain, setShowBrain] = useState<"taste" | "loom">("taste");
  const [myName, setMyName] = useState("");
  const [myCuts, setMyCuts] = useState<string[]>([]);
  const busy = useRef(false);
  const idc = useRef(100);
  const R = useRef(rng(Date.now() % 100000));

  useEffect(() => {
    Promise.all([getGeometry(), getPack("taste"), getPack("loom")]).then(([g, t, l]) => { setGeo(g); setPacks({ taste: t, loom: l }); });
  }, []);

  // mutation pool: cell types active during feeding or escape
  useEffect(() => {
    if (!brains) return;
    const types = (b: Brain, stim: [string, number][], ms: number, where: "taste" | "loom") => {
      b.reset(); b.clearStim(); b.silenced.fill(0);
      for (const [g, hz] of stim) b.setStim(b.pack.groups[g], hz);
      b.run(ms);
      const s = new Map<string, number>();
      for (let i = 0; i < b.n; i++) if (b.counts[i] && b.pack.names[i] && b.pack.classes[i] !== "sensory" && b.pack.classes[i] !== "motor" && !b.pack.names[i].startsWith("LPLC2") && !b.pack.names[i].startsWith("DNp01")) s.set(b.pack.names[i], (s.get(b.pack.names[i]) ?? 0) + b.counts[i]);
      return [...s.entries()].sort((a, c) => c[1] - a[1]).slice(0, 40).map(([type]) => ({ type, where }));
    };
    const p = [...types(brains.taste, [["sugar", 200]], 200, "taste"), ...types(brains.loom, [["LPLC2_left", 80], ["LPLC2_right", 80]], 150, "loom")];
    setPool(p);
    let saved: Gang[] | null = null;
    try { const s = localStorage.getItem(LS); if (s) saved = JSON.parse(s); } catch { /* ignore */ }
    if (saved?.length) { setGangs(saved); idc.current = Math.max(...saved.map((g) => g.id)) + 1; }
    else {
      const r = R.current;
      const g: Gang[] = [{ id: 1, name: "The Wild Types", color: COLORS[0], cuts: [], gen: 0, wins: 0, best: 0 }];
      for (let k = 1; k < 6; k++) {
        const cuts = Array.from({ length: 1 + Math.floor(r() * 2) }, () => p[Math.floor(r() * p.length)].type);
        g.push({ id: k + 1, name: NAMES[k], color: COLORS[k], cuts: [...new Set(cuts)], gen: 0, wins: 0, best: 0 });
      }
      setGangs(g);
    }
    setPhase("Ready. The tournament starts in a moment.");
  }, [brains]);

  const evaluate = async (g: Gang): Promise<Result> => {
    const { taste, loom } = brains!;
    const run = async (b: Brain, stim: [string, number][], ms: number, out: string[]) => {
      b.reset(); b.clearStim(); applyCuts(b, g.cuts);
      for (const [grp, hz] of stim) b.setStim(b.pack.groups[grp], hz);
      for (let t = 0; t < ms; t += 25) { b.run(25); await new Promise((r) => requestAnimationFrame(() => r(null))); }
      return out.reduce((a, grp) => a + rate(b, b.pack.groups[grp], ms), 0) / out.length;
    };
    setShowBrain("taste");
    const feast = await run(taste, [["sugar", 200]], 250, ["MN9"]);
    const poison = await run(taste, [["sugar", 200], ["bitter", 200]], 250, ["MN9"]);
    setShowBrain("loom");
    const dodge = await run(loom, [["LPLC2_left", 60], ["LPLC2_right", 60]], 150, ["GF_left", "GF_right"]);
    const score = feast / 10 + dodge / 15 - poison / 5;
    return { feast, poison, dodge, score };
  };

  const playRound = async () => {
    if (busy.current || !brains || !gangs.length) return;
    busy.current = true;
    const r = round + 1; setRound(r);
    const res = [...gangs];
    for (let k = 0; k < res.length; k++) {
      setEvaluating(res[k].id);
      setPhase(`Round ${r}: ${res[k].name} is feasting, refusing poison and dodging the swatter…`);
      const out = await evaluate(res[k]);
      res[k] = { ...res[k], last: out, best: Math.max(res[k].best, out.score) };
      setGangs([...res]);
    }
    setEvaluating(null);
    res.sort((a, b) => b.last!.score - a.last!.score);
    res[0].wins++;
    const winner = res[0], loser = res[res.length - 1];
    // evolution: the loser is replaced by a mutant child of the winner
    const rr = R.current;
    const cuts = [...winner.cuts];
    const roll = rr();
    if ((roll < 0.45 && cuts.length < 3) || !cuts.length) cuts.push(pool[Math.floor(rr() * pool.length)].type);
    else if (roll < 0.75 && cuts.length) cuts.splice(Math.floor(rr() * cuts.length), 1);
    else if (cuts.length) cuts[Math.floor(rr() * cuts.length)] = pool[Math.floor(rr() * pool.length)].type;
    const childName = `${NAMES[Math.floor(rr() * NAMES.length)].split(" ").slice(-1)[0]} ${["Jr.", "II", "Reborn", "Clan", "Spawn"][Math.floor(rr() * 5)]}`;
    const child: Gang = { id: idc.current++, name: childName, color: loser.color, cuts: [...new Set(cuts)], gen: winner.gen + 1, parent: winner.name, wins: 0, best: 0 };
    const next = [...res.slice(0, -1), child];
    const line = `Round ${r}: ${winner.name} wins (${winner.last!.score.toFixed(1)} pts). ${loser.name} is out. ${child.name}, a mutant child of ${winner.name}, joins with ${child.cuts.length ? child.cuts.join(", ") + " silenced" : "no mutations"}.`;
    setLog((l) => [line, ...l].slice(0, 30));
    setGangs(next);
    try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* ignore */ }
    setPhase(line);
    busy.current = false;
  };

  useEffect(() => {
    if (!auto || !pool.length) return;
    const t = setInterval(() => { if (!busy.current) playRound(); }, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, pool.length, gangs, round]);

  const join = () => {
    const name = myName.trim() || `Gang ${idc.current}`;
    const g: Gang = { id: idc.current++, name, color: COLORS[idc.current % COLORS.length], cuts: myCuts.slice(0, 3), gen: 0, wins: 0, best: 0 };
    setGangs((gs) => { const s = [...gs].sort((a, b) => (b.last?.score ?? 0) - (a.last?.score ?? 0)); const n = [...s.slice(0, 5), g]; try { localStorage.setItem(LS, JSON.stringify(n)); } catch { /* ignore */ } return n; });
    setLog((l) => [`${name} joins the tournament with ${g.cuts.length ? g.cuts.join(", ") + " silenced" : "an untouched brain"}.`, ...l]);
    setMyName(""); setMyCuts([]);
  };
  const resetAll = () => { try { localStorage.removeItem(LS); } catch { /* ignore */ } location.reload(); };

  const sorted = [...gangs].sort((a, b) => (b.last?.score ?? -99) - (a.last?.score ?? -99));
  const maxS = Math.max(1, ...gangs.map((g) => g.last?.score ?? 0));
  const evalGang = gangs.find((g) => g.id === evaluating);
  const shownBrain = brains ? brains[showBrain] : null;
  const cutIdx = useMemo(() => {
    if (!shownBrain || !evalGang) return [];
    const s = new Set(evalGang.cuts), out: number[] = [];
    for (let i = 0; i < shownBrain.n; i++) if (s.has(shownBrain.pack.names[i])) out.push(i);
    return out;
  }, [shownBrain, evalGang]);

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Tournament">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} label="Tournament autopilot" desc="Rounds run by themselves. Each gang's brain is simulated at every event, the loser is replaced by a mutant child of the winner, and the gangs evolve." />
          <button className="btn ghost small" onClick={() => playRound()} disabled={busy.current || !pool.length}>Play one round</button>
        </div>
        <p className="status" aria-live="polite">{phase}</p>
        <div className="gangs">
          {sorted.map((g, k) => (
            <div key={g.id} className={`gang ${evaluating === g.id ? "is-eval" : ""}`} style={{ "--gc": g.color } as React.CSSProperties}>
              <div className="gang-rank mono">{k + 1}</div>
              <div className="gang-main">
                <div className="gang-top"><b>{g.name}</b><span className="muted small">gen {g.gen}{g.parent ? ` · child of ${g.parent}` : ""} · {g.wins} win{g.wins === 1 ? "" : "s"}</span></div>
                <div className="gang-cuts small">{g.cuts.length ? g.cuts.map((c) => <span key={c} className="mono">✂ {c}</span>) : <span className="muted">untouched brain</span>}</div>
                {g.last && (
                  <div className="gang-events small mono">
                    <span title="MN9 on sugar">feast {g.last.feast.toFixed(0)}</span>
                    <span title="MN9 on sugar+bitter" className={g.last.poison > 5 ? "bad" : ""}>poison {g.last.poison.toFixed(0)}</span>
                    <span title="Giant fiber on looming">dodge {g.last.dodge.toFixed(0)}</span>
                  </div>
                )}
              </div>
              <div className="gang-score">
                <b className="mono">{g.last ? g.last.score.toFixed(1) : "-"}</b>
                <span className="bar"><i style={{ width: `${Math.max(0, ((g.last?.score ?? 0) / maxS) * 100)}%`, background: g.color }} /></span>
              </div>
            </div>
          ))}
        </div>
        <details className="custom">
          <summary>Start your own gang</summary>
          <div className="custom-in">
            <label htmlFor="gang-name">Gang name<input id="gang-name" className="input" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="The Proboscis Mafia" /></label>
            <div className="chips">
              {pool.slice(0, 36).map((p) => (
                <button key={p.type + p.where} className="chip" aria-pressed={myCuts.includes(p.type)} onClick={() => setMyCuts((c) => (c.includes(p.type) ? c.filter((x) => x !== p.type) : c.length < 3 ? [...c, p.type] : c))} title={`${p.where} circuit`}>{p.type}</button>
              ))}
            </div>
            <span className="muted small">Pick up to 3 cell types to silence ({myCuts.length}/3). Or pick none and trust the wild type.</span>
            <button className="btn primary-sm" onClick={join} disabled={!pool.length}>Join the tournament</button>
          </div>
        </details>
        <div className="gang-log">
          <h3>Tournament log</h3>
          <ul>{log.map((l, k) => <li key={k}>{l}</li>)}{!log.length && <li className="muted">No rounds yet.</li>}</ul>
          <button className="btn ghost small" onClick={resetAll}>Reset tournament</button>
        </div>
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={shownBrain} silence={cutIdx} title={evalGang ? `${evalGang.name}'s brain` : "Contestant brain"}
          subtitle={showBrain === "taste" ? "taste circuit · feast & poison" : "looming circuit · dodge"} />
        <div className="panel board">
          <h3>How scoring works</h3>
          <ul className="small">
            <li><b>Feast:</b> sugar → MN9 rate ÷ 10</li>
            <li><b>Poison:</b> sugar + bitter → MN9 rate ÷ 5, subtracted. A healthy brain refuses.</li>
            <li><b>Dodge:</b> looming → giant fiber rate ÷ 15</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
