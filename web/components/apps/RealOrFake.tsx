"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, type Pack } from "@/lib/sim";
import { getPack, useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter } from "./LiveBrain";

type Test = { id: string; name: string; pack: "taste" | "loom"; stim: [string, number][]; out: string[]; outLabel: string; expect: "high" | "zero"; blurb: string };
const TESTS: Test[] = [
  { id: "feed", name: "Sugar → feeding", pack: "taste", stim: [["sugar", 200]], out: ["MN9"], outLabel: "MN9 feeding neuron", expect: "high", blurb: "Stimulate 20 sugar-taste neurons. A real fly brain should drive MN9, the proboscis motor neuron." },
  { id: "veto", name: "Bitter veto", pack: "taste", stim: [["sugar", 200], ["bitter", 200]], out: ["MN9"], outLabel: "MN9 feeding neuron", expect: "zero", blurb: "Sugar plus bitter. Bitter neurons should shut feeding down completely." },
  { id: "escape", name: "Looming → escape", pack: "loom", stim: [["LPLC2_left", 80], ["LPLC2_right", 80]], out: ["GF_left", "GF_right"], outLabel: "Giant fiber escape neurons", expect: "high", blurb: "Stimulate the looming detectors. The giant fiber escape neurons should fire." },
];
type Control = "targets" | "weights";
const CONTROLS: Record<Control, string> = { targets: "Scrambled targets", weights: "Shuffled strengths" };
const RUN_MS = 300;

function makeBrain(pack: Pack, which: "real" | Control, seed: number) {
  if (which === "real") return new Brain(pack, { seed });
  if (which === "targets") return new Brain(pack, { seed, scramble: 100 + seed });
  return new Brain(pack, { seed, shuffleWeights: 200 + seed });
}
function setup(b: Brain, t: Test) { b.reset(); b.clearStim(); for (const [g, hz] of t.stim) b.setStim(b.pack.groups[g], hz); }
function outRate(b: Brain, t: Test, ms: number) { let c = 0, n = 0; for (const g of t.out) { for (const i of b.pack.groups[g]) c += b.counts[i]; n += b.pack.groups[g].length; } return c / n / (ms / 1000); }

type Row = { test: string; real: number[]; targets: number[]; weights: number[] };

export default function RealOrFake() {
  const [test, setTest] = useState<Test>(TESTS[0]);
  const [control, setControl] = useState<Control>("targets");
  const { geo, pack, error } = useFly(test.pack);
  const real = useMemo(() => (pack ? makeBrain(pack, "real", 1) : null), [pack]);
  const fake = useMemo(() => (pack ? makeBrain(pack, control, 1) : null), [pack, control]);
  const [rates, setRates] = useState({ real: 0, fake: 0 });
  const [auto, setAuto] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [battery, setBattery] = useState<{ done: number; of: number } | null>(null);
  const S = useRef({ t: 0, real: 0, fake: 0 });

  useEffect(() => { if (real && fake) { setup(real, test); setup(fake, test); S.current = { t: 0, real: 0, fake: 0 }; } }, [real, fake, test]);

  // live side-by-side: loop the test every 600 ms of simulated time
  const ui = useRef(0);
  useSimLoop((ms) => {
    if (!real || !fake || battery) return;
    const s = S.current;
    real.run(ms / 2); fake.run(ms / 2); s.t += ms / 2;
    if (s.t >= 600) {
      s.real = outRate(real, test, s.t); s.fake = outRate(fake, test, s.t);
      setRates({ real: s.real, fake: s.fake });
      setup(real, test); setup(fake, test); s.t = 0;
    }
    ui.current += ms;
    if (ui.current > 200 && s.t > 150) { ui.current = 0; setRates({ real: outRate(real, test, s.t), fake: outRate(fake, test, s.t) }); }
  }, { running: !!real && !battery, speed: 1, maxMsPerFrame: 14 });

  // autopilot battery: every test x {real, two controls} x 3 seeds
  const runBattery = async () => {
    const jobs: { t: Test; which: "real" | Control; seed: number }[] = [];
    for (const t of TESTS) for (const which of ["real", "targets", "weights"] as const) for (const seed of [1, 2, 3]) jobs.push({ t, which, seed });
    setBattery({ done: 0, of: jobs.length });
    const out: Record<string, Row> = {};
    for (let k = 0; k < jobs.length; k++) {
      const { t, which, seed } = jobs[k];
      const p = await getPack(t.pack);
      const b = makeBrain(p, which, seed);
      setup(b, t);
      // run in slices so the page stays responsive
      for (let done = 0; done < RUN_MS; done += 50) { b.run(50); await new Promise((r) => requestAnimationFrame(() => r(null))); }
      const r = outRate(b, t, RUN_MS);
      const row = (out[t.id] ??= { test: t.name, real: [], targets: [], weights: [] });
      row[which].push(r);
      setRows(Object.values(out).map((x) => ({ ...x })));
      setBattery({ done: k + 1, of: jobs.length });
    }
    setBattery(null);
  };
  useEffect(() => { if (auto && !battery) runBattery(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auto]);

  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const verdict = (t: Test, v: number) => (t.expect === "high" ? v > 20 : v < 5);
  const maxR = Math.max(60, rates.real, rates.fake);

  return (
    <div>
      <section className="panel stage" aria-label="Control experiment">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} label="Autopilot"
            desc="Running the full control battery by itself: 3 tests × real wiring and 2 controls × 3 random seeds, then grading the results." />
          <div className="seg-inline" role="group" aria-label="Control">
            {(Object.keys(CONTROLS) as Control[]).map((c) => <button key={c} aria-pressed={control === c} onClick={() => setControl(c)}>{CONTROLS[c]}</button>)}
          </div>
        </div>
        <div className="seg-inline wide" role="tablist" aria-label="Test">
          {TESTS.map((t) => <button key={t.id} role="tab" aria-selected={test.id === t.id} aria-pressed={test.id === t.id} onClick={() => setTest(t)}>{t.name}</button>)}
        </div>
        <p className="lead">{test.blurb} <span className="muted">Expected from a real brain: {test.expect === "high" ? "strong firing" : "silence"}.</span></p>
        <div className="versus">
          <div className="vs-col">
            <LiveBrain geo={geo} brain={real} stim={pack ? test.stim.flatMap(([g]) => pack.groups[g]) : []} title="Real fly wiring" subtitle={pack ? `${pack.n.toLocaleString()} neurons` : ""} height={300}>
              <Meter label={test.outLabel} value={rates.real} max={maxR} hint={verdict(test, rates.real) ? "✓ behaves like a fly" : "✗ doesn't behave like a fly"} />
            </LiveBrain>
          </div>
          <div className="vs-mid" aria-hidden>vs</div>
          <div className="vs-col">
            <LiveBrain geo={geo} brain={fake} stim={pack ? test.stim.flatMap(([g]) => pack.groups[g]) : []} title={CONTROLS[control]}
              subtitle={control === "targets" ? "same synapses, random targets" : "same connections, shuffled strengths"} height={300}>
              <Meter label={test.outLabel} value={rates.fake} max={maxR} tone="blue" hint={verdict(test, rates.fake) ? "✓ behaves like a fly" : "✗ doesn't behave like a fly"} />
            </LiveBrain>
          </div>
        </div>
      </section>

      <section className="panel card report" aria-label="Report card">
        <div className="card-head">
          <h3>Report card</h3>
          <button className="btn primary-sm" onClick={() => runBattery()} disabled={!!battery}>{battery ? `Running ${battery.done}/${battery.of}…` : "Run the full battery"}</button>
        </div>
        {rows.length ? (
          <div className="tscroll">
            <table>
              <thead><tr><th>Test</th><th className="num">Real wiring</th><th className="num">Scrambled targets</th><th className="num">Shuffled strengths</th><th>Verdict</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const t = TESTS.find((x) => x.name === r.test)!;
                  const mr = mean(r.real), ok = verdict(t, mr), c1 = !verdict(t, mean(r.targets)), c2 = !verdict(t, mean(r.weights));
                  const weaker = t.expect === "high" && !c2 && mean(r.weights) < 0.5 * mr;
                  return (
                    <tr key={r.test}>
                      <td>{r.test}</td>
                      <td className="num mono">{fmt(r.real)}</td><td className="num mono">{fmt(r.targets)}</td><td className="num mono">{fmt(r.weights)}</td>
                      <td>{r.real.length === 3 && r.targets.length === 3 && r.weights.length === 3 ? (ok && c1 && c2 ? <b className="ok">Only the real wiring does it</b> : ok && c1 && weaker ? <b className="ok">Real wiring {(mr / Math.max(1, mean(r.weights))).toFixed(1)}× stronger than any control</b> : ok ? <span>Real works; a control does too</span> : <span className="warn">Real wiring fails</span>) : <span className="muted">running…</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">Press “Run the full battery” or switch on Autopilot. Each cell is the mean output firing rate (Hz) over 3 random seeds.</p>}
      </section>
      {error && <p className="warn">{error}</p>}
    </div>
  );
}

function fmt(a: number[]) { return a.length ? `${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} Hz` : "…"; }
