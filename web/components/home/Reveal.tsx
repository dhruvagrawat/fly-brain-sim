"use client";
import { useEffect, useRef, useState } from "react";

/** Adds `is-in` when the element scrolls into view. Content is visible without JS. */
export function Reveal({ children, className = "", as: Tag = "div", delay = 0 }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "li"; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight * 0.95) return; // already on screen: don't animate
    el.classList.add("will-reveal");
    let done = false;
    const show = () => { if (done) return; done = true; el.classList.add("is-in"); cleanup(); };
    const check = () => { if (el.getBoundingClientRect().top < innerHeight * 0.92) show(); };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) show(); }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    // fallback for busy main threads: also check on scroll, and never leave content hidden for long
    const onScroll = () => requestAnimationFrame(check);
    addEventListener("scroll", onScroll, { passive: true });
    const safety = setInterval(check, 700);
    function cleanup() { io.disconnect(); removeEventListener("scroll", onScroll); clearInterval(safety); }
    return cleanup;
  }, []);
  return <Tag ref={ref as never} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</Tag>;
}

/** Counts up to `to` once visible. */
export function CountUp({ to, duration = 1400, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { to: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current!;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (ts: number) => {
        const f = Math.min(1, (ts - t0) / duration), ease = 1 - Math.pow(1 - f, 3);
        setV(to * ease);
        if (f < 1) raf = requestAnimationFrame(tick);
      };
      setV(0);
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{format(v)}</span>;
}

/** Runs CSS loop animations (elements matching `selector`) only while they are on screen. */
export function LiveWhenVisible({ selector }: { selector: string }) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-live", e.isIntersecting)));
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
  return null;
}
