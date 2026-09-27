// Shared playback clock. Lives outside React so 60 fps updates don't re-render the page.
export type ClockListener = (t: number) => void;

export class Clock {
  t = 0;
  duration = 1000;
  playing = false;
  speed = 0.1; // simulated ms per real ms
  private listeners = new Set<ClockListener>();
  private raf = 0;
  private last = 0;

  subscribe(fn: ClockListener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  private emit() {
    for (const fn of this.listeners) fn(this.t);
  }
  set(t: number) {
    this.t = Math.max(0, Math.min(this.duration, t));
    this.emit();
  }
  play() {
    if (this.playing) return;
    this.playing = true;
    this.last = 0;
    const step = (ts: number) => {
      if (!this.playing) return;
      const dt = this.last ? Math.min(100, ts - this.last) : 16;
      this.last = ts;
      let t = this.t + dt * this.speed;
      if (t > this.duration) t = 0;
      this.t = t;
      this.emit();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.emit();
  }
  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }
  toggle() {
    this.playing ? this.pause() : this.play();
  }
}
