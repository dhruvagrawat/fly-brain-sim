"use client";
import { useMemo, useState } from "react";
import type { Run } from "@/lib/data";
import { CLASS_LABEL, behaviourOf, fmt, nameOf } from "@/lib/labels";

export function Outputs({ run, onSelect }: { run: Run; onSelect: (i: number) => void }) {
  const outs = run.active.filter((r) => (r[3] === "descending" || r[3] === "motor") && !r[8]).slice(0, 12);
  if (!outs.length) return <p className="empty">No descending or motor neurons fired. This stimulus stays inside the brain.</p>;
  const mx = outs[0][6];
  return (
    <div className="outputs">
      {outs.map((r) => {
        const beh = behaviourOf(r);
        return (
          <button key={r[0]} className={`out ${beh ? "is-known" : ""}`} onClick={() => onSelect(r[0])}>
            <span className="out-name">{nameOf(r)} {r[4] && <span className="muted">{r[4]}</span>}</span>
            <span className="out-beh">{beh ?? `${CLASS_LABEL[r[3]]} neuron`}</span>
            <span className="out-rate mono">{r[6].toFixed(1)} Hz</span>
            <span className="bar"><i style={{ width: `${(100 * r[6]) / mx}%` }} /></span>
          </button>
        );
      })}
    </div>
  );
}

export function NeuronTable({ run, selected, onSelect }: { run: Run; selected: number; onSelect: (i: number) => void }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(25);
  const [sort, setSort] = useState<{ k: number; dir: 1 | -1 }>({ k: 6, dir: -1 });
  const rank = useMemo(() => new Map(run.active.map((r, k) => [r[0], k + 1])), [run]);
  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    let rs = run.active;
    if (lq) rs = rs.filter((r) => (r[2] || "").toLowerCase().includes(lq) || r[1].includes(lq) || (CLASS_LABEL[r[3]] ?? r[3]).toLowerCase().includes(lq) || (r[5] || "").toLowerCase().includes(lq));
    if (sort.k !== 6 || sort.dir !== -1) {
      rs = rs.slice().sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        return (typeof x === "number" ? (x as number) - (y as number) : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return rs;
  }, [run, q, sort]);
  const mx = run.active[0]?.[6] ?? 1;
  const th = (label: string, k: number, num = false) => (
    <th className={num ? "num" : ""} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="th-btn" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : num ? -1 : 1 }))}>
        {label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <>
      <div className="card-head">
        <h3>Active neurons <span className="muted">{fmt.format(run.n_active)}{run.n_active > run.active.length ? ` · top ${fmt.format(run.active.length)} listed` : ""}</span></h3>
        <input id="neuron-filter" className="input" value={q} onChange={(e) => { setQ(e.target.value); setShown(25); }} placeholder="Filter by name, class, transmitter or ID" aria-label="Filter neurons" />
      </div>
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>{th("Neuron", 2)}{th("Class", 3)}{th("Side", 4)}{th("Transmitter", 5)}{th("Rate (Hz)", 6, true)}{th("± SD", 7, true)}<th>FlyWire ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => (
              <tr key={r[0]} className={r[0] === selected ? "sel" : ""} onClick={() => onSelect(r[0])} data-i={r[0]}>
                <td className="num mono">{rank.get(r[0])}</td>
                <td>{nameOf(r)}{r[8] ? <span className="tag">stimulated</span> : null}</td>
                <td>{CLASS_LABEL[r[3]] ?? r[3]}</td>
                <td>{r[4]}</td>
                <td>{r[5]}</td>
                <td className="num mono"><span className="rbar"><i style={{ width: `${(100 * r[6]) / mx}%` }} /></span>{r[6].toFixed(1)}</td>
                <td className="num mono">{r[7].toFixed(1)}</td>
                <td className="mono muted">{r[1]}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="empty">No neurons match “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > shown && <button className="btn ghost more" onClick={() => setShown((s) => s + 100)}>Show {Math.min(100, rows.length - shown)} more</button>}
    </>
  );
}

export function RunLog({ log, current, compare, onOpen, onToggleCompare }: {
  log: Run[]; current: string | null; compare: string[]; onOpen: (k: string) => void; onToggleCompare: (k: string) => void;
}) {
  if (!log.length) return <p className="empty">Runs you open or simulate appear here. Tick two to compare them.</p>;
  return (
    <ol className="log">
      {log.slice().reverse().map((r) => (
        <li key={r.key} className={r.key === current ? "is-current" : ""}>
          <input type="checkbox" id={`cmp-${r.key}`} checked={compare.includes(r.key)} onChange={() => onToggleCompare(r.key)} aria-label={`Compare ${r.label}`} />
          <button className="log-open" onClick={() => onOpen(r.key)}>
            <span className="log-title">{r.label}</span>
            <span className="log-meta mono">
              {r.source === "live" ? "live" : "recorded"} · {fmt.format(r.n_active)} active · {r.params.rate} Hz × {r.params.n_run}
              {r.silence.length ? ` · ${r.silence.length} silenced` : ""}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Compare({ a, b, onClose, onSelect }: { a: Run; b: Run; onClose: () => void; onSelect: (i: number) => void }) {
  const rows = useMemo(() => {
    const ids = new Set<number>([...a.rateOf.keys(), ...b.rateOf.keys()]);
    const out: { i: number; ra: number; rb: number; d: number; name: string; cls: string }[] = [];
    for (const i of ids) {
      const ra = a.rateOf.get(i) ?? 0, rb = b.rateOf.get(i) ?? 0;
      const row = a.byIndex.get(i) ?? b.byIndex.get(i);
      out.push({ i, ra, rb, d: rb - ra, name: row ? nameOf(row) : `#${i}`, cls: row ? CLASS_LABEL[row[3]] ?? row[3] : "" });
    }
    return out.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  }, [a, b]);
  const onlyA = rows.filter((r) => r.rb === 0).length, onlyB = rows.filter((r) => r.ra === 0).length;
  const mx = Math.max(1, ...rows.slice(0, 40).map((r) => Math.abs(r.d)));
  return (
    <section className="panel card compare" aria-label="Run comparison">
      <div className="card-head">
        <h3>Compare runs</h3>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
      <p className="compare-lead">
        <b className="ca">A</b> {a.label} <span className="muted">({fmt.format(a.n_active)} active)</span> vs <b className="cb">B</b> {b.label} <span className="muted">({fmt.format(b.n_active)} active)</span>.
        {" "}{fmt.format(onlyA)} neurons fire only in A, {fmt.format(onlyB)} only in B. Biggest rate changes first.
      </p>
      <div className="tscroll">
        <table>
          <thead><tr><th>Neuron</th><th>Class</th><th className="num">A (Hz)</th><th className="num">B (Hz)</th><th>Change B − A</th></tr></thead>
          <tbody>
            {rows.slice(0, 60).map((r) => (
              <tr key={r.i} onClick={() => onSelect(r.i)}>
                <td>{r.name}</td><td>{r.cls}</td>
                <td className="num mono">{r.ra.toFixed(1)}</td><td className="num mono">{r.rb.toFixed(1)}</td>
                <td className="diff">
                  <span className="dbar"><i className={r.d >= 0 ? "up" : "down"} style={{ width: `${(50 * Math.abs(r.d)) / mx}%`, [r.d >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span>
                  <span className="mono">{r.d >= 0 ? "+" : "−"}{Math.abs(r.d).toFixed(1)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
