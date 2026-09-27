"use client";
import { useEffect, useRef, useState } from "react";
import type { Run } from "@/lib/data";
import type { Clock } from "@/lib/clock";
import { CLASS_LABEL, SERIES, fmt, nameOf } from "@/lib/labels";

const css = (n: string) => (typeof window === "undefined" ? "#888" : getComputedStyle(document.documentElement).getPropertyValue(n).trim());
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

/** Re-render when the colour theme changes (charts read CSS tokens). */
export function useThemeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", bump); mo.disconnect(); };
  }, []);
  return tick;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function groupSeries(run: Run) {
  const out: Record<string, number[]> = {};
  const keys = SERIES.map((s) => s[0]);
  for (const [k, v] of Object.entries(run.series)) {
    const key = keys.includes(k) ? k : "other";
    if (!out[key]) out[key] = v.slice();
    else v.forEach((x, j) => (out[key][j] += x));
  }
  return SERIES.filter(([k]) => out[k]).map(([k, c]) => ({ key: k, token: c, values: out[k] }));
}

export function PopulationChart({ run, clock, hidden, onToggle }: { run: Run; clock: Clock; hidden: Set<string>; onToggle: (k: string) => void }) {
  const tick = useThemeTick();
  const [ref, w] = useWidth<HTMLDivElement>();
  const nowRef = useRef<SVGLineElement>(null);
  const [hover, setHover] = useState<{ j: number; x: number } | null>(null);
  const series = groupSeries(run);
  const vis = series.filter((s) => !hidden.has(s.key));
  const h = 250, m = { l: 52, r: 12, t: 12, b: 26 };
  const T = run.params.t_run, bin = run.params.bin_ms, nb = (series[0]?.values.length ?? 1);
  const ymax = niceMax(Math.max(1, ...vis.flatMap((s) => s.values)));
  const X = (t: number) => m.l + ((w - m.l - m.r) * t) / T;
  const Y = (v: number) => m.t + (h - m.t - m.b) * (1 - v / ymax);
  const step = T <= 300 ? 50 : T <= 1000 ? 200 : 500;
  const colors = Object.fromEntries(series.map((s) => [s.key, css(s.token)]));
  void tick;

  useEffect(() => clock.subscribe((t) => {
    const l = nowRef.current;
    if (l) { const x = X(t); l.setAttribute("x1", String(x)); l.setAttribute("x2", String(x)); }
  }));

  const onMove = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect(), x = e.clientX - r.left;
    const t = Math.max(0, Math.min(T - 0.001, ((x - m.l) / (w - m.l - m.r)) * T));
    setHover({ j: Math.min(nb - 1, Math.floor(t / bin)), x });
  };
  const onClick = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    clock.set(((e.clientX - r.left - m.l) / (w - m.l - m.r)) * T);
  };

  return (
    <div className="viz">
      <div className="legend" role="group" aria-label="Show or hide classes">
        {series.map((s) => (
          <button key={s.key} aria-pressed={!hidden.has(s.key)} onClick={() => onToggle(s.key)}>
            <i style={{ background: colors[s.key] }} />
            {CLASS_LABEL[s.key] ?? s.key}
          </button>
        ))}
      </div>
      <div className="chart" ref={ref}>
        <svg viewBox={`0 0 ${w} ${h}`} height={h} role="img" aria-label="Spikes per second by neuron class over time">
          {[0, 1, 2, 3, 4].map((k) => {
            const v = (ymax * k) / 4, y = Y(v);
            return (
              <g key={k}>
                <line x1={m.l} x2={w - m.r} y1={y} y2={y} className="grid" />
                <text x={m.l - 8} y={y + 4} textAnchor="end" className="tick">{fmt.format(v)}</text>
              </g>
            );
          })}
          {Array.from({ length: Math.floor(T / step) + 1 }, (_, k) => k * step).map((t) => (
            <text key={t} x={X(t)} y={h - 7} textAnchor="middle" className="tick">{t}</text>
          ))}
          <text x={w - m.r} y={h - 20} textAnchor="end" className="tick">ms</text>
          {vis.map((s) => (
            <path key={s.key} fill="none" stroke={colors[s.key]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              d={s.values.map((v, j) => `${j ? "L" : "M"}${X((j + 0.5) * bin).toFixed(1)},${Y(v).toFixed(1)}`).join("")} />
          ))}
          {!vis.length && <text x={w / 2} y={h / 2} textAnchor="middle" className="tick">All classes hidden. Pick one above.</text>}
          <line ref={nowRef} x1={X(clock.t)} x2={X(clock.t)} y1={m.t} y2={h - m.b} className="now" />
          {hover && <line x1={X((hover.j + 0.5) * bin)} x2={X((hover.j + 0.5) * bin)} y1={m.t} y2={h - m.b} className="hair" />}
          <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={h - m.t - m.b} fill="transparent" style={{ cursor: "crosshair" }}
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} />
        </svg>
        {hover && vis.length > 0 && (
          <div className="tip" style={{ left: hover.x + 180 > w ? hover.x - 190 : hover.x + 14, top: 8 }}>
            <small>{(hover.j * bin).toFixed(0)}–{((hover.j + 1) * bin).toFixed(0)} ms · click to jump</small>
            {vis.slice().sort((a, b) => b.values[hover.j] - a.values[hover.j]).map((s) => (
              <div className="row" key={s.key}>
                <span><i style={{ background: colors[s.key] }} /> {CLASS_LABEL[s.key]}</span>
                <span className="mono">{fmt.format(Math.round(s.values[hover.j]))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Raster({ run, clock, selected, onSelect }: { run: Run; clock: Clock; selected: number; onSelect: (i: number) => void }) {
  const tick = useThemeTick();
  const [wrapRef, w] = useWidth<HTMLDivElement>();
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<ImageData | null>(null);
  const geom = useRef({ L: 0, top: 4, rh: 1, h: 280, bot: 22, X: (t: number) => t, dpr: 1 });
  const [tip, setTip] = useState<{ k: number; x: number; y: number } | null>(null);

  const drawNow = (t: number) => {
    const c = cv.current?.getContext("2d"), g = geom.current;
    if (!c || !img.current) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.putImageData(img.current, 0, 0);
    c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    const x = g.X(t);
    c.strokeStyle = css("--accent");
    c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(x, g.top); c.lineTo(x, g.h - g.bot); c.stroke();
    c.setLineDash([]);
  };

  useEffect(() => {
    const canvas = cv.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), h = 280;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext("2d")!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const rows = run.raster, L = Math.min(112, w * 0.3), R = 8, top = 4, bot = 22, T = run.params.t_run;
    const rh = (h - top - bot) / Math.max(1, rows.length);
    const X = (t: number) => L + ((w - L - R) * t) / T;
    const ink = css("--text"), ink2 = css("--muted"), stimC = css("--s2"), line = css("--line");
    c.font = `10.5px "Chivo Mono", ui-monospace, monospace`;
    c.textBaseline = "middle";
    rows.forEach((row, k) => {
      const y = top + k * rh, isStim = run.stimSet.has(row.i), r = run.byIndex.get(row.i);
      if (k % Math.ceil(12 / rh) === 0) { c.fillStyle = ink2; c.textAlign = "right"; c.fillText(String(r ? nameOf(r) : row.i).slice(0, 13), L - 8, y + rh / 2); }
      c.fillStyle = isStim ? stimC : ink;
      c.globalAlpha = isStim ? 0.95 : 0.78;
      for (const t of row.t) c.fillRect(X(t) - 0.5, y + rh * 0.12, 1, Math.max(1, rh * 0.76));
      c.globalAlpha = 1;
      if (row.i === selected) { c.strokeStyle = css("--accent"); c.lineWidth = 1; c.strokeRect(L, y, w - L - R, rh); }
    });
    c.strokeStyle = line; c.beginPath(); c.moveTo(L, h - bot + 0.5); c.lineTo(w - R, h - bot + 0.5); c.stroke();
    c.fillStyle = ink2; c.textAlign = "center";
    const step = T <= 300 ? 50 : T <= 1000 ? 200 : 500;
    for (let t = 0; t <= T; t += step) c.fillText(String(t), X(t), h - 9);
    geom.current = { L, top, rh, h, bot, X, dpr };
    img.current = c.getImageData(0, 0, canvas.width, canvas.height);
    drawNow(clock.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, w, selected, tick]);

  useEffect(() => {
    let last = 0;
    return clock.subscribe((t) => { const n = performance.now(); if (n - last > 50) { last = n; drawNow(t); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  const rowAt = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect(), g = geom.current;
    const k = Math.floor((e.clientY - r.top - g.top) / g.rh);
    return { k: k >= 0 && k < run.raster.length ? k : -1, x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tipRow = tip && tip.k >= 0 ? run.raster[tip.k] : null;
  const tipInfo = tipRow ? run.byIndex.get(tipRow.i) : undefined;

  return (
    <div className="chart" ref={wrapRef}>
      <canvas ref={cv} style={{ width: "100%", height: 280, display: "block", cursor: "crosshair" }}
        onMouseMove={(e) => setTip(rowAt(e))} onMouseLeave={() => setTip(null)}
        onClick={(e) => { const { k } = rowAt(e); if (k >= 0) onSelect(run.raster[k].i); }}
        role="img" aria-label="Spike raster of the most active neurons in trial 1" />
      {tipRow && (
        <div className="tip" style={{ left: tip!.x + 230 > w ? tip!.x - 240 : tip!.x + 14, top: Math.min(tip!.y + 12, 200) }}>
          <b>{tipInfo ? nameOf(tipInfo) : tipRow.i}</b>
          <small>{tipInfo ? CLASS_LABEL[tipInfo[3]] ?? tipInfo[3] : ""}{run.stimSet.has(tipRow.i) ? " · stimulated" : ""}</small>
          <span className="mono">{tipRow.t.length} spikes in trial 1 · {(run.rateOf.get(tipRow.i) ?? 0).toFixed(1)} Hz mean</span>
        </div>
      )}
    </div>
  );
}
