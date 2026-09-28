import Link from "next/link";
import type { Metadata } from "next";
import { APPS, SITE_NAME, SITE_URL } from "@/lib/apps";

export const metadata: Metadata = {
  title: { absolute: `Fly brain apps: games and experiments on a real connectome · ${SITE_NAME}` },
  description: "Eight free browser apps that run a real fruit fly brain simulation: a food critic, Flappy Fly, Twitch Plays Fly Brain, brain radio, a brain surgeon game and more. Autopilot lets the fly's own neurons take control.",
  keywords: ["fly brain simulation", "fruit fly connectome games", "flywire", "drosophila brain", "neuroscience games", "brain simulation online"],
  alternates: { canonical: `${SITE_URL}/apps/` },
  openGraph: { title: "Fly brain apps · Flybrain", description: "Eight apps where a real fruit fly brain takes control.", url: `${SITE_URL}/apps/`, images: [{ url: `${SITE_URL}/og/apps.png`, width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
};

const GLYPH: Record<string, string> = {
  "food-critic": "M12 3c-3 4-5 6.5-5 10a5 5 0 0 0 10 0c0-3.5-2-6-5-10z",
  "smell-o-vision": "M4 16c3-6 6 6 9 0s6 6 7 0M4 10c3-6 6 6 9 0s6 6 7 0",
  "brain-surgeon": "M5 19 19 5M8 5l3 3M16 13l3 3M4 14l6 6",
  "flappy-fly": "M3 18c4-9 8-9 12-4M14 8h4v10h-4zM4 6h4v6H4z",
  "twitch-plays": "M4 4h16v11l-4 4h-4l-3 3v-3H4z",
  "brain-radio": "M3 12h2l2-6 3 12 3-9 2 5 2-2h4",
  "real-or-fake": "M5 12l4 4 10-10M5 20h14",
  "fly-gangs": "M7 8a3 3 0 1 0 0-.01M17 8a3 3 0 1 0 0-.01M2 20c1-4 4-6 5-6s4 2 5 6M12 20c1-4 4-6 5-6s4 2 5 6",
};

export default function AppsPage() {
  const ld = {
    "@context": "https://schema.org", "@type": "ItemList", name: "Flybrain apps",
    itemListElement: APPS.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/apps/${a.slug}/`, name: a.name })),
  };
  return (
    <div className="container apps-hub">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="hub-head">
        <p className="eyebrow">Apps</p>
        <h1>Hand a real fly brain the controls</h1>
        <p className="section-lead">Eight apps, each running a slice of the FlyWire connectome live in your browser: 4,000 to 7,000 real neurons, no installs. Every app has an <strong>autopilot</strong> where the fly's own neurons take over, and a <strong>scrambled wiring</strong> switch that proves it's the real connections doing the work.</p>
      </header>
      <div className="hub-grid">
        {APPS.map((a) => (
          <Link key={a.slug} href={`/apps/${a.slug}/`} className="hub-card">
            <div className="hub-icon" aria-hidden><svg viewBox="0 0 24 24"><path d={GLYPH[a.slug]} /></svg></div>
            {a.status && <span className="rstatus rstatus-building">{a.status}</span>}
            <h2>{a.name}</h2>
            <p>{a.tagline}</p>
            <p className="hub-auto small"><b>Autopilot:</b> {a.autopilot}</p>
            <span className="exp-go">Open →</span>
          </Link>
        ))}
      </div>
      <section className="hub-how">
        <h2>How apps run a brain in your browser</h2>
        <p>The full fly brain has 138,639 neurons and 15 million connections, which is too much to stream to a phone. But in this model a neuron that never fires has no effect on anything. So for each app I simulate the whole brain offline under every condition the app can produce, and keep only the neurons that respond (plus strongly connected neighbours for lesion experiments). The result is a <em>circuit pack</em> of 4,000 to 7,000 neurons. For every condition I tested, it reproduces the full brain exactly, spike for spike. Details are in the <Link href="/docs/apps/">apps documentation</Link>.</p>
      </section>
    </div>
  );
}
