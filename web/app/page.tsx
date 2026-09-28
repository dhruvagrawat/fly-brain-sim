import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import HeroBrain from "@/components/home/HeroBrain";
import NeuronDemo from "@/components/home/NeuronDemo";
import CascadeDemo from "@/components/home/CascadeDemo";
import CommandDemo from "@/components/home/CommandDemo";
import { CountUp, LiveWhenVisible, Reveal } from "@/components/home/Reveal";
import type { RunSummary } from "@/lib/data";
import { APPS } from "@/lib/apps";

type Indexed = RunSummary & { spark: number[] };

function runs(): Indexed[] {
  const p = path.join(process.cwd(), "public", "data", "runs", "index.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function Spark({ values }: { values: number[] }) {
  const w = 240, h = 56, max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 8)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none" aria-hidden>
      <path d={`M0,${h} L${pts.join(" L")} L${w},${h} Z`} className="spark-fill" />
      <path d={`M${pts.join(" L")}`} className="spark-line" />
    </svg>
  );
}

const ROADMAP: { status: "Shipped" | "Building" | "Next" | "Exploring"; title: string; text: string }[] = [
  { status: "Shipped", title: "Whole-brain simulator", text: "All 138,639 neurons as leaky integrate-and-fire units, rewritten in Numba so it runs on a laptop." },
  { status: "Shipped", title: "Lab + command center", text: "3D replay, brain outputs, charts, experiment log, run comparison and a plain-language command bar." },
  { status: "Building", title: "Virtual body", text: "Close the loop: the brain sees a simple world, its descending neurons steer a simulated fly." },
  { status: "Next", title: "Training the brain", text: "Dopamine-gated plasticity in the mushroom body, so the fly can learn to avoid or seek things." },
  { status: "Next", title: "Male brain (MaleCNS v1.0)", text: "Add the September 2026 Janelia + Google male connectome and compare the two sexes." },
  { status: "Exploring", title: "In-browser simulation", text: "Run the full model on the GPU with WebGPU, so anyone can experiment without installing anything." },
];

export default function Home() {
  const rs = runs();
  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <HeroBrain />
        <div className="hero-shade" aria-hidden />
        <div className="container hero-in">
          <p className="eyebrow hero-eyebrow"><span className="live-dot" aria-hidden /> Drosophila melanogaster · whole-brain simulation</p>
          <h1 className="hero-title">
            Every neuron of a fly’s brain.<br />
            <span className="hero-glow">Switched on.</span>
          </h1>
          <p className="hero-sub">
            Flybrain simulates all 138,639 neurons and 15 million connections of the adult fruit fly brain.
            Pick a cell type, stimulate it, and watch the signal spread from taste or vision all the way to the
            neurons that move the body.
          </p>
          <div className="hero-cta">
            <Link href="/lab/" className="btn big solid">Open the lab →</Link>
            <Link href="/docs/getting-started/" className="btn big line">Run it yourself</Link>
          </div>
          <p className="hero-by">Built by <a href="https://github.com/dhruvagrawat" target="_blank" rel="noopener noreferrer">Dhruv Agrawat</a> · open source</p>
        </div>
      </section>

      {/* ---------------- numbers ---------------- */}
      <section className="numbers container" aria-label="Key numbers">
        {[
          [138639, "neurons, each at its real position"],
          [15091983, "connections between them"],
          [8839, "named cell types to stimulate"],
          [9, "seconds to simulate one second, on one CPU core"],
        ].map(([n, l], i) => (
          <Reveal key={i} className="number" delay={i * 70}>
            <span className="number-n"><CountUp to={n as number} /></span>
            <span className="number-l">{l as string}</span>
          </Reveal>
        ))}
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="section container" id="how">
        <Reveal className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title">From a real brain to a running one</h2>
          <p className="section-lead">Three steps take a fly brain from an electron microscope to something you can poke.</p>
        </Reveal>
        <ol className="pipeline">
          <Reveal as="li" className="pipe" delay={0}>
            <div className="pipe-art art-slices" aria-hidden><i /><i /><i /><i /><i /></div>
            <span className="pipe-n mono">01</span>
            <h3>Imaged</h3>
            <p>A fly brain was cut into about 7,000 slices, each 40 nm thin, and photographed with an electron microscope. The FlyWire team traced every neuron through all of them.</p>
          </Reveal>
          <Reveal as="li" className="pipe" delay={90}>
            <div className="pipe-art art-trace" aria-hidden>
              <svg viewBox="0 0 200 110"><path d="M10 90 C 40 20, 70 100, 100 50 S 160 10, 190 60" /><path d="M20 20 C 60 40, 80 10, 120 80 S 170 100, 190 20" /><path d="M5 55 C 50 60, 90 30, 130 60 S 180 40, 195 90" /></svg>
            </div>
            <span className="pipe-n mono">02</span>
            <h3>Wired</h3>
            <p>Every synapse between two neurons was counted, and each neuron’s transmitter was predicted. That gives a signed wiring diagram: who excites whom, and who inhibits whom.</p>
          </Reveal>
          <Reveal as="li" className="pipe" delay={180}>
            <div className="pipe-art art-fire" aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 137) % 1900}ms`, left: `${(i * 37) % 92 + 4}%`, top: `${(i * 53) % 80 + 8}%` }} />)}</div>
            <span className="pipe-n mono">03</span>
            <h3>Simulated</h3>
            <p>Each neuron becomes a leaky integrate-and-fire unit that sums its inputs and spikes past a threshold. Stimulate a few and the activity flows through the real wiring.</p>
          </Reveal>
        </ol>
        <LiveWhenVisible selector=".pipe-art" />
      </section>

      {/* ---------------- neuron explainer ---------------- */}
      <section className="section container split" id="neuron">
        <Reveal className="split-text">
          <p className="eyebrow">Meet one neuron</p>
          <h2 className="section-title">Charge up, cross the line, fire</h2>
          <p>Every neuron in the model follows the same rule. Incoming spikes push its voltage up (excitation) or down (inhibition). The charge leaks away over about 20 ms. If the voltage crosses <b>−45 mV</b>, the neuron fires a spike, resets to rest, and sends a kick to every neuron it connects to.</p>
          <p>This one is running live with the exact constants of the full brain model. Turn up the excitation and it fires more. Add inhibition and it goes quiet.</p>
          <pre className="eq mono" aria-label="Model equations">{`dv/dt = (v₀ − v + g) / 20 ms
dg/dt = −g / 5 ms
v > −45 mV  →  spike, v ← −52 mV`}</pre>
        </Reveal>
        <Reveal className="split-demo" delay={100}><NeuronDemo /></Reveal>
      </section>

      {/* ---------------- cascade explainer ---------------- */}
      <section className="section container split reverse" id="circuit">
        <Reveal className="split-text">
          <p className="eyebrow">Then wire them up</p>
          <h2 className="section-title">Signals race from sense to action</h2>
          <p>Connect neurons and spikes start to travel. Sensory neurons drive interneurons, interneurons drive descending neurons, and descending neurons command the motor neurons that move the body. Inhibitory cells (blue) hold parts of the circuit back.</p>
          <p><b>Try it:</b> click neurons in the middle layers to silence them and watch the motor output drop. The lab runs the same experiment on the whole brain, with 138,639 neurons instead of 23.</p>
        </Reveal>
        <Reveal className="split-demo" delay={100}><CascadeDemo /></Reveal>
      </section>

      {/* ---------------- experiments ---------------- */}
      <section className="section container" id="experiments">
        <Reveal className="section-head">
          <p className="eyebrow">Recorded experiments</p>
          <h2 className="section-title">Six ways to wake a brain</h2>
          <p className="section-lead">Each one is a full-brain simulation you can replay, rotate and dissect in the lab. The curve shows how many spikes per second the rest of the brain fires in response.</p>
        </Reveal>
        <div className="exp-grid">
          {rs.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 70}>
              <Link href={`/lab/?run=${r.id}`} className="exp">
                <Spark values={r.spark} />
                <h3>{r.label}</h3>
                <p>{r.blurb}</p>
                <span className="exp-meta mono">{r.n_active.toLocaleString("en-US")} neurons · {r.n_spikes.toLocaleString("en-US")} spikes</span>
                <span className="exp-go">Replay →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- apps ---------------- */}
      <section className="section container" id="apps">
        <Reveal className="section-head">
          <p className="eyebrow">Apps</p>
          <h2 className="section-title">Hand the fly the controls</h2>
          <p className="section-lead">Eight apps where a real slice of the connectome runs live in your browser and the fly’s own neurons make the decisions. Flip on autopilot and watch it eat, sniff, dodge, DJ and evolve.</p>
        </Reveal>
        <div className="hub-grid">
          {APPS.map((a, i) => (
            <Reveal key={a.slug} delay={(i % 4) * 60}>
              <Link href={`/apps/${a.slug}/`} className="hub-card">
                <h3 style={{ margin: 0, font: "700 19px/1.2 var(--display)" }}>{a.name}</h3>
                <p>{a.tagline}</p>
                <span className="exp-go">Open →</span>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="center"><Link href="/apps/" className="btn big solid">All apps →</Link></div>
      </section>

      {/* ---------------- command center ---------------- */}
      <section className="section container split" id="commands">
        <Reveal className="split-text">
          <p className="eyebrow">Command center</p>
          <h2 className="section-title">Just say what to try</h2>
          <p>Press <kbd>⌘K</kbd> in the lab and type an experiment the way you’d say it. “Stimulate sugar at 200 hz and run.” “Silence DNp01.” “Find MN9.” “Compare.” It autocompletes 8,839 cell types and every neuron that fired.</p>
          <Link href="/docs/command-center/" className="btn ghost">Every command →</Link>
        </Reveal>
        <Reveal className="split-demo" delay={100}><CommandDemo /></Reveal>
      </section>

      {/* ---------------- guide ---------------- */}
      <section className="section container" id="guide">
        <Reveal className="section-head">
          <p className="eyebrow">Guide</p>
          <h2 className="section-title">Your first experiment in a minute</h2>
        </Reveal>
        <ol className="guide">
          {[
            ["Open a recorded run", "Start with “Sugar taste → feeding”. The brain map shows every neuron. The glowing ones are firing."],
            ["Press play", "Hit space. Watch the taste signal land in the lower brain, then spread to the neurons that control the proboscis."],
            ["Click a glowing neuron", "See its cell type, transmitter and firing rate, then open it in FlyWire Codex or add it to your next experiment."],
            ["Change something and compare", "Silence a cell type, run it on your own machine, then compare the two runs to see which neurons lost their drive."],
          ].map(([h, p], i) => (
            <Reveal as="li" key={i} className="guide-step" delay={i * 80}>
              <span className="guide-n mono">{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </Reveal>
          ))}
        </ol>
        <div className="center"><Link href="/lab/" className="btn big solid">Start in the lab →</Link></div>
      </section>

      {/* ---------------- roadmap ---------------- */}
      <section className="section container" id="roadmap">
        <Reveal className="section-head">
          <p className="eyebrow">Roadmap</p>
          <h2 className="section-title">Where this is going</h2>
          <p className="section-lead">Flybrain is a living project. The goal is a fly brain you can train, embody and study, all from a browser.</p>
        </Reveal>
        <div className="road">
          {ROADMAP.map((r, i) => (
            <Reveal key={r.title} className="road-item" delay={(i % 3) * 70}>
              <span className={`rstatus rstatus-${r.status.toLowerCase()}`}>{r.status}</span>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </Reveal>
          ))}
        </div>
        <div className="center"><Link href="/docs/roadmap/" className="btn ghost">Full roadmap and changelog →</Link></div>
      </section>

      {/* ---------------- credits ---------------- */}
      <section className="section container credits" id="credits">
        <Reveal className="credits-in">
          <div>
            <p className="eyebrow">Credits</p>
            <h2 className="section-title">Standing on a very detailed shoulder</h2>
            <p>
              Flybrain is designed and built by <b>Dhruv Agrawat</b>. It would not exist without the people who mapped and modelled the fly brain:
              the <a href="https://flywire.ai" target="_blank" rel="noopener noreferrer">FlyWire consortium</a> (Dorkenwald et al. and Schlegel et al., <i>Nature</i> 2024),
              who reconstructed the connectome and annotated its cell types, and <b>Philip Shiu, Nico Spiller</b> and colleagues (Shiu et al., <i>Nature</i> 2024),
              whose whole-brain model and open data this simulator reimplements.
            </p>
          </div>
          <Link href="/docs/credits/" className="btn ghost">Citations →</Link>
        </Reveal>
      </section>
    </>
  );
}
