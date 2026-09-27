"use client";
import { useEffect, useRef, useState } from "react";
import { describe, EXAMPLES, parseCommand } from "@/lib/commands";

/** Types example commands into a fake command center and shows how the real parser reads them. */
export default function CommandDemo() {
  const [text, setText] = useState("");
  const [k, setK] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const target = EXAMPLES[k % EXAMPLES.length];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setText(target); return; }
    let i = 0, timer: ReturnType<typeof setTimeout>;
    const type = () => {
      if (!visible.current) { timer = setTimeout(type, 400); return; }
      i++;
      setText(target.slice(0, i));
      if (i < target.length) timer = setTimeout(type, 45 + Math.random() * 60);
      else timer = setTimeout(() => setK((x) => x + 1), 2200);
    };
    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, [k]);

  const { actions } = parseCommand(text);
  return (
    <div className="cmd-demo" ref={box} aria-label="Command center demo">
      <div className="cmd-demo-input">
        <span className="palette-prompt" aria-hidden>›</span>
        <span className="mono">{text}</span><span className="caret" aria-hidden />
        <kbd className="cmd-k">⌘K</kbd>
      </div>
      <div className="cmd-demo-out">
        {actions.length ? actions.map((a, i) => (
          <div key={i} className="cmd-demo-row" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="cmd-demo-n mono">{i + 1}</span>{describe(a)}
          </div>
        )) : <div className="cmd-demo-row muted">Understands plain phrases like “stimulate sugar at 200 hz, then run”</div>}
      </div>
    </div>
  );
}
