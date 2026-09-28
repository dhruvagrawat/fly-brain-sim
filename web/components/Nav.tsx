"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const REPO = "https://github.com/dhruvagrawat/fly-brain-sim";

export default function Nav() {
  const path = usePathname() || "/";
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(t ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("flybrain.theme", next); } catch { /* ignore */ }
    setTheme(next);
  };
  const cur = (p: string) => (p === "/" ? path === "/" : path.startsWith(p)) ? "page" : undefined;
  return (
    <header className="nav">
      <div className="container nav-in" style={path.startsWith("/lab") ? { maxWidth: 1600 } : undefined}>
        <Link href="/" className="brand" aria-label="Flybrain home">fly<b>brain</b><span className="brand-dot" aria-hidden /></Link>
        <nav className="nav-links" aria-label="Main">
          <Link href="/apps/" aria-current={cur("/apps")}>Apps</Link>
          <Link href="/lab/" aria-current={cur("/lab")}>Lab</Link>
          <Link href="/docs/" aria-current={cur("/docs")}>Docs</Link>
          <Link href="/docs/roadmap/" className="hide-sm">Roadmap</Link>
        </nav>
        <div className="nav-right">
          <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
          <a className="icon-btn" href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" /></svg>
          </a>
          <Link href="/lab/" className="btn small primary-sm hide-xs">Open the lab</Link>
        </div>
      </div>
    </header>
  );
}
