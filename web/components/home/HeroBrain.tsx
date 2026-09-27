"use client";
import { useEffect, useMemo, useState } from "react";
import BrainGL from "@/components/BrainGL";
import { Clock } from "@/lib/clock";
import { loadGeometry, loadRecordedRun, type Geometry, type Run } from "@/lib/data";

/** Full-bleed rotating brain replaying a recorded experiment on loop. */
export default function HeroBrain({ runId = "sugar_feeding" }: { runId?: string }) {
  const clock = useMemo(() => { const c = new Clock(); c.speed = 0.12; return c; }, []);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([loadGeometry(), loadRecordedRun(runId)]).then(([g, r]) => {
      if (!alive) return;
      setGeo(g); setRun(r);
      clock.duration = r.params.t_run;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) clock.play();
      else clock.set(300);
    }).catch(() => {});
    const un = clock.subscribe((x) => setT(Math.floor(x / 10) * 10));
    return () => { alive = false; clock.pause(); un(); };
  }, [clock, runId]);
  return (
    <div className="hero-brain">
      <BrainGL geo={geo} run={run} clock={clock} mode="replay" autoRotate initialYaw={-0.5} ariaLabel="Rotating 3D map of all 138,639 neurons with a sugar-taste signal spreading through it" />
      <div className="hero-brain-hud mono" aria-hidden>
        <span>REPLAY · sugar taste → feeding</span>
        <span>t = {t.toString().padStart(4, " ")} ms</span>
      </div>
    </div>
  );
}
