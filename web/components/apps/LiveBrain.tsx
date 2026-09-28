"use client";
import { useMemo, useRef, useState } from "react";
import BrainGL, { type LiveSource } from "@/components/BrainGL";
import { Clock } from "@/lib/clock";
import type { Geometry } from "@/lib/data";
import type { Brain } from "@/lib/sim";

/** The live brain map used by every app: the full brain in 3D, lit by the running simulation. */
export function LiveBrain({ geo, brain, stim, silence, title, subtitle, children, className = "", height }: {
  geo: Geometry | null;
  brain: Brain | null;
  stim?: number[]; // local indices
  silence?: number[];
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  height?: number | string;
}) {
  const clock = useMemo(() => new Clock(), []);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const bRef = useRef(brain);
  bRef.current = brain;
  const live = useMemo<LiveSource | null>(() => {
    if (!brain) return null;
    const g = brain.pack.global;
    return {
      fill: (act, touched) => (bRef.current ? bRef.current.fillActivity(act, touched) : touched),
      stim: (stim ?? []).map((i) => g[i]),
      silence: (silence ?? []).map((i) => g[i]),
    };
  }, [brain, stim, silence]);
  const localOf = useMemo(() => {
    const m = new Map<number, number>();
    brain?.pack.global.forEach((gi, li) => m.set(gi, li));
    return m;
  }, [brain]);
  const hl = hover && brain ? localOf.get(hover.i) : undefined;
  return (
    <div className={`live-brain ${className}`}>
      {(title || subtitle) && (
        <div className="live-brain-head">
          {title && <span className="live-dot" aria-hidden />}
          <div>
            {title && <b>{title}</b>}
            {subtitle && <span className="muted small"> {subtitle}</span>}
          </div>
        </div>
      )}
      <div className="live-brain-scope" style={height ? { height } : undefined}>
        <BrainGL geo={geo} run={null} live={live} clock={clock} mode="replay" interactive
          onHover={(i, x, y) => setHover(i >= 0 ? { i, x, y } : null)} ariaLabel="Live 3D map of the fruit fly brain; neurons glow as they fire" />
        {!geo && <div className="scope-loading">Loading 138,639 neurons…</div>}
        {hover && hl !== undefined && brain && (
          <div className="tip scope-tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
            <b>{brain.pack.names[hl] || "unnamed neuron"}</b>
            <small>{brain.pack.classes[hl]}{brain.pack.sides[hl] ? ` · ${brain.pack.sides[hl]}` : ""}</small>
          </div>
        )}
        <span className="lut live-lut"><span>quiet</span><i /><span>firing</span></span>
      </div>
      {children}
    </div>
  );
}

export function Meter({ label, value, max, unit = "Hz", hint, tone = "accent" }: { label: string; value: number; max: number; unit?: string; hint?: string; tone?: "accent" | "blue" | "green" }) {
  const f = Math.max(0, Math.min(1, value / max));
  return (
    <div className={`meter tone-${tone}`}>
      <div className="meter-top"><span>{label}</span><b className="mono">{value.toFixed(0)}<small> {unit}</small></b></div>
      <div className="meter-bar"><i style={{ width: `${f * 100}%` }} /></div>
      {hint && <div className="meter-hint muted small">{hint}</div>}
    </div>
  );
}

export function Autopilot({ on, onChange, label = "Autopilot", desc }: { on: boolean; onChange: (v: boolean) => void; label?: string; desc: string }) {
  return (
    <div className={`autopilot ${on ? "is-on" : ""}`}>
      <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="ap-switch" aria-label={`${label} ${on ? "on" : "off"}`}>
        <i />
      </button>
      <div>
        <b>{label} {on ? "on" : "off"}</b>
        <span className="muted small">{on ? desc : "You're in control. Switch on to hand control to the fly's brain."}</span>
      </div>
    </div>
  );
}

export function WiringToggle({ scrambled, onChange }: { scrambled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="seg-inline" role="group" aria-label="Wiring">
      <button aria-pressed={!scrambled} onClick={() => onChange(false)}>Real wiring</button>
      <button aria-pressed={scrambled} onClick={() => onChange(true)}>Scrambled</button>
    </div>
  );
}
