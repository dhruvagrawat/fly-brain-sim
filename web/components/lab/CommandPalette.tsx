"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { describe, EXAMPLES, parseCommand, type Action } from "@/lib/commands";
import type { Preset, Run, RunSummary } from "@/lib/data";
import { CLASS_LABEL, nameOf } from "@/lib/labels";

type Item = { id: string; group: string; title: string; hint?: string; actions: Action[] | null; onPick?: () => void };

type Props = {
  open: boolean;
  onClose: () => void;
  onRun: (actions: Action[]) => void;
  presets: Preset[];
  runs: RunSummary[];
  cellTypes: [string, number][];
  run: Run | null;
};

export default function CommandPalette({ open, onClose, onRun, presets, runs, cellTypes, run }: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const query = q.trim();
    const lq = query.toLowerCase();
    if (query) {
      const { actions, errors } = parseCommand(query);
      if (actions.length) out.push({ id: "cmd", group: "Command", title: actions.map(describe).join(" · "), hint: "Enter", actions });
      else if (errors.length) out.push({ id: "err", group: "Command", title: errors[0], actions: null });
    }
    const last = lq.split(/\s+/).pop() || "";
    const match = (s: string) => !lq || s.toLowerCase().includes(lq) || (!!last && s.toLowerCase().includes(last));
    runs.filter((r) => match(r.label) || match(r.id ?? "")).slice(0, lq ? 4 : 6).forEach((r) =>
      out.push({ id: "run-" + r.id, group: "Recorded experiments", title: r.label, hint: `${r.n_active.toLocaleString()} neurons`, actions: [{ kind: "open", run: r.id! }] }));
    presets.filter((p) => p.n > 0 && (match(p.name) || match(p.desc))).slice(0, lq ? 4 : 8).forEach((p) =>
      out.push({ id: "pre-" + p.name, group: "Stimulate a preset", title: `Stimulate ${p.name.replace(/_/g, " ")}`, hint: p.desc, actions: [{ kind: "stim", targets: [p.name] }] }));
    if (last.length >= 2) {
      const types = cellTypes.filter(([t]) => t.toLowerCase().startsWith(last)).slice(0, 5);
      types.forEach(([t, c]) => {
        out.push({ id: "st-" + t, group: "Cell types", title: `Stimulate ${t}`, hint: `${c} neuron${c > 1 ? "s" : ""}`, actions: [{ kind: "stim", targets: [t] }] });
        out.push({ id: "si-" + t, group: "Cell types", title: `Silence ${t}`, hint: `${c} neuron${c > 1 ? "s" : ""}`, actions: [{ kind: "silence", targets: [t] }] });
      });
      if (run) {
        run.active.filter((r) => (r[2] || "").toLowerCase().startsWith(last) || r[1].includes(last)).slice(0, 5).forEach((r) =>
          out.push({ id: "n-" + r[0], group: "Neurons in this run", title: `Find ${nameOf(r)}`, hint: `${CLASS_LABEL[r[3]] ?? r[3]} · ${r[6].toFixed(0)} Hz`, actions: [{ kind: "find", query: r[1] }] }));
      }
    }
    if (!lq) {
      const quick: [string, Action[]][] = [
        ["Run the simulation", [{ kind: "run" }]],
        ["Play / pause replay", [{ kind: "play" }]],
        ["Show mean firing rate", [{ kind: "mode", mode: "mean" }]],
        ["Top view", [{ kind: "view", view: "top" }]],
        ["Compare the last two runs", [{ kind: "compare" }]],
        ["Download active neurons as CSV", [{ kind: "export" }]],
        ["Copy the equivalent terminal command", [{ kind: "copycli" }]],
        ["Open the documentation", [{ kind: "go", path: "/docs/" }]],
      ];
      quick.forEach(([t, a], k) => out.push({ id: "q" + k, group: "Actions", title: t, actions: a }));
    }
    return out;
  }, [q, presets, runs, cellTypes, run]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-k="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const pick = (it: Item | undefined) => {
    if (!it || !it.actions) return;
    onRun(it.actions);
    onClose();
  };

  let lastGroup = "";
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command center" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="palette-prompt" aria-hidden>›</span>
          <input
            ref={inputRef}
            id="palette-input"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a command: stimulate sugar at 200 hz run"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(items[sel]); }
              else if (e.key === "Escape") onClose();
              else if (e.key === "Tab" && items[sel]?.actions?.[0]) {
                e.preventDefault();
                const a = items[sel].actions![0];
                if (a.kind === "stim" || a.kind === "silence") setQ(`${a.kind === "stim" ? "stimulate" : "silence"} ${a.targets.join(" ")} `);
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} role="listbox">
          {items.map((it, k) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {head && <div className="palette-group">{head}</div>}
                <button data-k={k} role="option" aria-selected={k === sel} className={`palette-item ${it.actions ? "" : "is-error"}`}
                  onMouseEnter={() => setSel(k)} onClick={() => pick(it)}>
                  <span>{it.title}</span>
                  {it.hint && <span className="palette-hint">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span>Try:</span>
          {EXAMPLES.slice(0, 4).map((ex) => (
            <button key={ex} className="palette-ex" onClick={() => { setQ(ex); inputRef.current?.focus(); }}>{ex}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
