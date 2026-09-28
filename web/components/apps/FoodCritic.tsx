"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "@/lib/sim";
import { GroupRate, useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter, WiringToggle } from "./LiveBrain";

type Dish = { id: string; name: string; sweet: number; bitter: number; salt: number; note: string };
const MENU: Dish[] = [
  { id: "jalebi", name: "Jalebi", sweet: 1, bitter: 0, salt: 0, note: "Deep-fried sugar spirals" },
  { id: "gulab-jamun", name: "Gulab jamun", sweet: 0.95, bitter: 0, salt: 0.05, note: "Syrup-soaked dumplings" },
  { id: "mango-lassi", name: "Mango lassi", sweet: 0.8, bitter: 0, salt: 0.05, note: "Mango + yogurt" },
  { id: "banana", name: "Ripe banana", sweet: 0.7, bitter: 0, salt: 0, note: "A fly classic" },
  { id: "cola", name: "Cola", sweet: 0.9, bitter: 0.05, salt: 0, note: "Liquid sugar" },
  { id: "masala-chai", name: "Masala chai", sweet: 0.6, bitter: 0.25, salt: 0, note: "Sweet, with tannins" },
  { id: "nimbu-pani", name: "Nimbu pani", sweet: 0.5, bitter: 0, salt: 0.4, note: "Sweet-salty lemonade" },
  { id: "pani-puri", name: "Pani puri", sweet: 0.3, bitter: 0.1, salt: 0.5, note: "Tangy, spicy, salty" },
  { id: "filter-coffee", name: "Filter coffee", sweet: 0.4, bitter: 0.5, salt: 0, note: "Caffeine is bitter to flies" },
  { id: "dark-chocolate", name: "85% dark chocolate", sweet: 0.3, bitter: 0.7, salt: 0, note: "Mostly bitter" },
  { id: "salted-chips", name: "Salted chips", sweet: 0, bitter: 0, salt: 0.9, note: "Salt, a lot of it" },
  { id: "karela", name: "Karela fry", sweet: 0, bitter: 0.9, salt: 0.3, note: "Bitter gourd" },
  { id: "neem", name: "Neem juice", sweet: 0, bitter: 1, salt: 0, note: "The bitterest thing on the menu" },
  { id: "water", name: "Plain water", sweet: 0, bitter: 0, salt: 0, note: "Control" },
];
const MAX_HZ = 200; // stimulation rate at full intensity
const TASTE_MS = 600, REST_MS = 300;
const LS = "flybrain.foodcritic.v1";

type Verdict = { id: string; name: string; score: number; mn9: number; ts: number };

function review(d: Dish, mn9: number, score: number) {
  if (score >= 8.5) return `Proboscis fully out. MN9 fired at ${mn9.toFixed(0)} Hz. The sugar neurons are shouting and nothing is stopping them.`;
  if (score >= 6) return `Keen. MN9 at ${mn9.toFixed(0)} Hz: a solid, steady slurp${d.bitter > 0 ? ", though the bitter neurons are dragging it down a little" : ""}.`;
  if (score >= 3) return `Hesitant. MN9 managed ${mn9.toFixed(0)} Hz. ${d.bitter > d.sweet * 0.3 ? "The bitter neurons are putting on the brakes." : "Not sweet enough to get excited about."}`;
  if (score > 0.3) return `Barely a lick (MN9 ${mn9.toFixed(1)} Hz). ${d.bitter > 0.1 ? "There's sugar in there, but the bitter neurons are vetoing it." : d.salt > 0.5 ? "Salt alone doesn't do much for this brain." : "Not enough sugar to get the feeding circuit going."}`;
  if (d.bitter > 0.2) return "Bitter veto. The bitter neurons shut the feeding circuit down completely. MN9: silent.";
  return "Nothing. No sugar, no feeding. MN9 didn't fire a single spike.";
}

export default function FoodCritic() {
  const { geo, pack, error } = useFly("taste");
  const [scrambled, setScrambled] = useState(false);
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 11, scramble: scrambled }) : null), [pack, scrambled]);
  const [auto, setAuto] = useState(true);
  const [current, setCurrent] = useState<Dish | null>(null);
  const [custom, setCustom] = useState({ sweet: 0.6, bitter: 0.2, salt: 0.1 });
  const [mn9, setMn9] = useState(0);
  const [ext, setExt] = useState(0);
  const [phase, setPhase] = useState<"idle" | "tasting" | "rest">("idle");
  const [verdict, setVerdict] = useState<{ dish: Dish; score: number; mn9: number; text: string } | null>(null);
  const [board, setBoard] = useState<Verdict[]>([]);
  const [active, setActive] = useState(0);

  const st = useRef({ phase: "idle" as "idle" | "tasting" | "rest", t: 0, sum: 0, n: 0, dish: null as Dish | null, queue: 0, ext: 0 });
  const meter = useRef<GroupRate | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(LS); if (s) setBoard(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (brain) meter.current = new GroupRate(brain.pack.groups.MN9, 50); }, [brain]);

  const G = pack?.groups;
  const serve = useCallback((d: Dish) => {
    if (!brain || !G) return;
    brain.clearStim();
    brain.setStim(G.sugar, d.sweet * MAX_HZ);
    brain.setStim(G.bitter, d.bitter * MAX_HZ);
    brain.setStim(G.salt, d.salt * MAX_HZ);
    Object.assign(st.current, { phase: "tasting", t: 0, sum: 0, n: 0, dish: d });
    setCurrent(d); setPhase("tasting"); setVerdict(null);
  }, [brain, G]);

  const finish = useCallback(() => {
    const s = st.current, d = s.dish!;
    const m = s.n ? s.sum / s.n : 0;
    const score = Math.min(10, (m / 115) * 10);
    const text = review(d, m, score);
    setVerdict({ dish: d, score, mn9: m, text });
    if (!scrambled) setBoard((b) => {
      const nb = [{ id: d.id, name: d.name, score, mn9: m, ts: Date.now() }, ...b.filter((x) => x.id !== d.id)].slice(0, 30);
      try { localStorage.setItem(LS, JSON.stringify(nb)); } catch { /* ignore */ }
      return nb;
    });
    brain?.clearStim();
    Object.assign(s, { phase: "rest", t: 0 });
    setPhase("rest");
  }, [brain, scrambled]);

  // autopilot: start with the first dish
  useEffect(() => {
    if (auto && brain && st.current.phase === "idle") serve(MENU[st.current.queue++ % MENU.length]);
  }, [auto, brain, serve]);

  const uiAcc = useRef(0);
  useSimLoop((ms) => {
    if (!brain) return;
    brain.run(ms);
    const s = st.current;
    const r = meter.current?.update(brain, ms) ?? 0;
    // proboscis follows MN9 with some inertia
    s.ext += (Math.min(1, r / 110) - s.ext) * (1 - Math.exp(-ms / 120));
    if (s.phase === "tasting") {
      s.t += ms;
      if (s.t > 200) { s.sum += r * ms; s.n += ms; }
      if (s.t >= TASTE_MS) finish();
    } else if (s.phase === "rest") {
      s.t += ms;
      if (s.t >= REST_MS + (auto ? 900 : 0)) {
        if (auto) serve(MENU[s.queue++ % MENU.length]);
        else { s.phase = "idle"; setPhase("idle"); }
      }
    }
    uiAcc.current += ms;
    if (uiAcc.current > 30) {
      uiAcc.current = 0;
      setMn9(r); setExt(s.ext);
      let a = 0; for (let i = 0; i < brain.n; i++) if (brain.trace[i] > 0.05) a++;
      setActive(a);
    }
  }, { running: !!brain, speed: 1 });

  const sorted = [...board].sort((a, b) => b.score - a.score);
  const d = current;

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="The fly's table">
        <div className="stage-top">
          <Autopilot on={auto} onChange={(v) => { setAuto(v); if (v && st.current.phase !== "tasting") serve(MENU[st.current.queue++ % MENU.length]); }}
            desc="The fly's brain is working through the menu by itself. Each score is how hard its feeding neuron fires." />
          <WiringToggle scrambled={scrambled} onChange={(v) => { setScrambled(v); st.current.phase = "idle"; setPhase("idle"); }} />
        </div>

        <div className="critic">
          <FlyHead ext={ext} tasting={phase === "tasting"} />
          <div className="critic-verdict" aria-live="polite">
            <p className="eyebrow">{phase === "tasting" ? "Now tasting" : verdict ? "Verdict" : "Waiting for food"}</p>
            <h2>{d ? d.name : "Pick a dish"}</h2>
            {d && <TasteBars d={d} />}
            {verdict && phase !== "tasting" ? (
              <>
                <div className="score"><span className="mono">{verdict.score.toFixed(1)}</span><small>/10</small></div>
                <p className="review">{verdict.text}</p>
                {scrambled && <p className="warn small">Scrambled wiring: same neurons, random connections. The feeding reflex is gone.</p>}
              </>
            ) : (
              <p className="review muted">{phase === "tasting" ? "Sugar, bitter and salt neurons are firing. Watch MN9." : "Serve something from the menu."}</p>
            )}
          </div>
        </div>

        <div className="menu" role="list">
          {MENU.map((m) => (
            <button key={m.id} role="listitem" className={`dish ${d?.id === m.id ? "is-on" : ""}`} onClick={() => { setAuto(false); serve(m); }} disabled={!brain}>
              <b>{m.name}</b>
              <span className="muted small">{m.note}</span>
              <TasteBars d={m} mini />
            </button>
          ))}
        </div>

        <details className="custom">
          <summary>Mix your own</summary>
          <div className="custom-in">
            {(["sweet", "bitter", "salt"] as const).map((k) => (
              <label key={k} htmlFor={`c-${k}`}>{k[0].toUpperCase() + k.slice(1)} <b className="mono">{Math.round(custom[k] * 100)}%</b>
                <input id={`c-${k}`} type="range" min={0} max={1} step={0.05} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: +e.target.value })} />
              </label>
            ))}
            <button className="btn primary-sm" onClick={() => { setAuto(false); serve({ id: "custom", name: "Your mix", note: "", ...custom }); }} disabled={!brain}>Serve it</button>
          </div>
        </details>
      </section>

      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} stim={d && phase === "tasting" ? [...(d.sweet ? G!.sugar : []), ...(d.bitter ? G!.bitter : []), ...(d.salt ? G!.salt : [])] : []}
          title="Live brain" subtitle={pack ? `${pack.n.toLocaleString()} taste-circuit neurons, running now` : "loading…"}>
          <div className="meters">
            <Meter label="MN9 · feeding motor neuron" value={mn9} max={140} hint="Drives proboscis extension. This is the fly's decision." />
            <Meter label="Neurons firing" value={active} max={1200} unit="" tone="blue" />
          </div>
        </LiveBrain>
        <div className="panel board">
          <h3>The fly's rankings</h3>
          {sorted.length ? (
            <ol>
              {sorted.slice(0, 10).map((v) => (
                <li key={v.id}><span>{v.name}</span><b className="mono">{v.score.toFixed(1)}</b></li>
              ))}
            </ol>
          ) : <p className="empty">Scores appear as the fly tastes.</p>}
        </div>
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}

function TasteBars({ d, mini }: { d: Pick<Dish, "sweet" | "bitter" | "salt">; mini?: boolean }) {
  return (
    <div className={`taste-bars ${mini ? "mini" : ""}`} aria-label={`sweet ${Math.round(d.sweet * 100)}%, bitter ${Math.round(d.bitter * 100)}%, salty ${Math.round(d.salt * 100)}%`}>
      {(["sweet", "bitter", "salt"] as const).map((k) => (
        <span key={k} className={`tb tb-${k}`}><i style={{ width: `${d[k] * 100}%` }} />{!mini && <em>{k}</em>}</span>
      ))}
    </div>
  );
}

/** Front view of a fly head. The proboscis extends with MN9 activity. */
function FlyHead({ ext, tasting }: { ext: number; tasting: boolean }) {
  const L = 30 + ext * 60;
  return (
    <svg viewBox="0 0 240 230" className={`flyhead ${tasting ? "is-tasting" : ""}`} role="img" aria-label={`Fly head, proboscis ${Math.round(ext * 100)}% extended`}>
      <defs>
        <radialGradient id="eyeG" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#ff6b5a" /><stop offset=".6" stopColor="#b3261e" /><stop offset="1" stopColor="#5c0f0b" /></radialGradient>
        <pattern id="facets" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" fill="rgba(255,255,255,.12)" /></pattern>
      </defs>
      <g transform="translate(120 90)">
        <path d={`M-10 30 L-12 ${30 + L} L12 ${30 + L} L10 30 Z`} className="fh-rostrum" />
        <ellipse cx="0" cy={34 + L} rx={16 + ext * 6} ry={9 + ext * 4} className="fh-labellum" />
        <path d={`M-12 ${34 + L} Q0 ${40 + L} 12 ${34 + L}`} className="fh-lab-line" />
        <ellipse cx="0" cy="0" rx="62" ry="54" className="fh-head" />
        <ellipse cx="-50" cy="-8" rx="42" ry="50" fill="url(#eyeG)" />
        <ellipse cx="-50" cy="-8" rx="42" ry="50" fill="url(#facets)" />
        <ellipse cx="50" cy="-8" rx="42" ry="50" fill="url(#eyeG)" />
        <ellipse cx="50" cy="-8" rx="42" ry="50" fill="url(#facets)" />
        <path d="M-10 -40 Q-22 -70 -30 -74 M10 -40 Q22 -70 30 -74" className="fh-antenna" />
        <circle cx="-4" cy="-46" r="2.4" className="fh-ocellus" /><circle cx="4" cy="-46" r="2.4" className="fh-ocellus" /><circle cx="0" cy="-51" r="2.4" className="fh-ocellus" />
      </g>
    </svg>
  );
}
