"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Geometry, Run } from "@/lib/data";
import { activityAt } from "@/lib/data";
import type { Clock } from "@/lib/clock";

export type ViewName = "front" | "top" | "side";
export const VIEWS: Record<ViewName, { yaw: number; pitch: number }> = {
  front: { yaw: 0, pitch: 0 },
  top: { yaw: 0, pitch: Math.PI / 2 },
  side: { yaw: Math.PI / 2, pitch: 0 },
};

export type BrainHandle = { setView: (v: ViewName) => void; redraw: () => void };

type Props = {
  geo: Geometry | null;
  run: Run | null;
  clock: Clock;
  mode: "replay" | "mean";
  selected?: number;
  interactive?: boolean;
  autoRotate?: boolean;
  initialYaw?: number;
  onPick?: (i: number) => void;
  onHover?: (i: number, x: number, y: number) => void;
  onViewChange?: (v: ViewName | null) => void;
  className?: string;
  ariaLabel?: string;
};

// ---------- tiny mat4 helpers (column-major) ----------
type M4 = Float32Array<ArrayBuffer>;
const mul = (a: M4, b: M4): M4 => {
  const o: M4 = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
};
const persp = (fovy: number, aspect: number, near: number, far: number): M4 => {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
};
const rotX = (a: number): M4 => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a: number): M4 => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const trans = (x: number, y: number, z: number): M4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const scale = (x: number, y: number, z: number): M4 => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);

const VS = `
attribute vec3 a_pos; attribute float a_act; attribute float a_cls;
uniform mat4 u_mvp; uniform float u_px; uniform float u_base; uniform float u_zoom;
varying float v_act; varying float v_hide;
void main(){
  gl_Position = u_mvp * vec4(a_pos, 1.0);
  v_act = a_act; v_hide = a_cls > 254.5 ? 1.0 : 0.0;
  float s = a_act > 0.01 ? (5.0 + a_act * 17.0) : u_base;
  gl_PointSize = s * u_px * pow(u_zoom, 0.45);
}`;
const FS = `
precision mediump float;
varying float v_act; varying float v_hide;
uniform vec3 u_baseCol; uniform float u_baseA;
vec3 lut(float x){
  vec3 c0 = vec3(.31,.07,.48), c1 = vec3(.72,.22,.47), c2 = vec3(.99,.54,.38), c3 = vec3(.99,.99,.75);
  if (x < .33) return mix(c0, c1, x / .33);
  if (x < .66) return mix(c1, c2, (x - .33) / .33);
  return mix(c2, c3, (x - .66) / .34);
}
void main(){
  if (v_hide > 0.5) discard;
  vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0;
  if (r2 > 1.0) discard;
  if (v_act > 0.01) {
    float core = exp(-r2 * 10.0), glow = exp(-r2 * 3.0) * 0.45;
    gl_FragColor = vec4(lut(v_act) * (core * 1.25 + glow) * (0.4 + 0.85 * v_act), 1.0);
  } else {
    gl_FragColor = vec4(u_baseCol * (1.0 - r2) * u_baseA, 1.0);
  }
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

const BrainGL = forwardRef<BrainHandle, Props>(function BrainGL(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;

  const S = useRef({
    gl: null as WebGLRenderingContext | null,
    prog: null as WebGLProgram | null,
    bufPos: null as WebGLBuffer | null,
    bufAct: null as WebGLBuffer | null,
    bufCls: null as WebGLBuffer | null,
    loc: {} as Record<string, WebGLUniformLocation | number | null>,
    n: 0,
    pos: null as Float32Array | null,
    act: null as Float32Array | null,
    touched: [] as number[],
    yaw: props.initialYaw ?? 0,
    pitch: 0,
    zoom: 1,
    W: 1, H: 1, dpr: 1,
    mvp: new Float32Array(16) as M4,
    dirty: true,
    raf: 0,
    lastT: -1,
  });

  const computeMvp = () => {
    const s = S.current;
    const aspect = s.W / s.H;
    const fov = Math.PI / 6;
    const fitH = 520 / (2 * Math.tan(fov / 2));
    const fitW = 900 / (2 * Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW) / s.zoom;
    const model = mul(rotX(s.pitch), mul(rotY(s.yaw), scale(1, -1, -1)));
    s.mvp = mul(persp(fov, aspect, 10, 10000), mul(trans(0, 0, -dist), model));
  };

  const project = (i: number): [number, number] => {
    const s = S.current, m = s.mvp, p = s.pos!;
    const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [((cx / cw) * 0.5 + 0.5) * (s.W / s.dpr), (1 - ((cy / cw) * 0.5 + 0.5)) * (s.H / s.dpr)];
  };

  const draw = () => {
    const s = S.current, gl = s.gl, pr = P.current;
    if (!gl || !s.prog || !s.pos) return;
    // activity
    if (pr.run && s.act) {
      activityAt(pr.run, pr.clock.t, pr.mode, s.act, s.touched);
    } else if (s.act) {
      for (const i of s.touched) s.act[i] = 0;
      s.touched.length = 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.bufAct);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.act!);
    computeMvp();
    gl.viewport(0, 0, s.W, s.H);
    gl.clearColor(0.02, 0.027, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(s.prog);
    gl.uniformMatrix4fv(s.loc.u_mvp as WebGLUniformLocation, false, s.mvp);
    gl.uniform1f(s.loc.u_px as WebGLUniformLocation, s.dpr);
    gl.uniform1f(s.loc.u_zoom as WebGLUniformLocation, s.zoom);
    gl.uniform1f(s.loc.u_base as WebGLUniformLocation, 1.7);
    gl.uniform3f(s.loc.u_baseCol as WebGLUniformLocation, 0.36, 0.47, 0.66);
    gl.uniform1f(s.loc.u_baseA as WebGLUniformLocation, 0.32);
    gl.drawArrays(gl.POINTS, 0, s.n);
    drawOverlay();
  };

  const drawOverlay = () => {
    const s = S.current, pr = P.current, ov = ovRef.current;
    if (!ov) return;
    const c = ov.getContext("2d")!;
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    c.clearRect(0, 0, s.W, s.H);
    const run = pr.run;
    if (!run || !s.pos) return;
    if (run.stim.length <= 400) {
      c.strokeStyle = "rgba(255,150,90,.85)";
      c.lineWidth = 1;
      for (const i of run.stim) { const [x, y] = project(i); c.beginPath(); c.arc(x, y, 4.5, 0, 6.2832); c.stroke(); }
    }
    if (run.silence.length <= 400) {
      c.strokeStyle = "rgba(130,175,255,.95)";
      c.lineWidth = 1.2;
      for (const i of run.silence) {
        const [x, y] = project(i), d = 3.5;
        c.beginPath(); c.moveTo(x - d, y - d); c.lineTo(x + d, y + d); c.moveTo(x + d, y - d); c.lineTo(x - d, y + d); c.stroke();
      }
    }
    if (pr.selected != null && pr.selected >= 0) {
      const [x, y] = project(pr.selected);
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, 10, 0, 6.2832); c.stroke();
      c.beginPath();
      c.moveTo(x - 18, y); c.lineTo(x - 13, y); c.moveTo(x + 13, y); c.lineTo(x + 18, y);
      c.moveTo(x, y - 18); c.lineTo(x, y - 13); c.moveTo(x, y + 13); c.lineTo(x, y + 18);
      c.stroke();
    }
  };

  const pick = (clientX: number, clientY: number) => {
    const s = S.current, run = P.current.run, wrap = wrapRef.current;
    if (!run || !s.pos || !wrap) return -1;
    const r = wrap.getBoundingClientRect(), mx = clientX - r.left, my = clientY - r.top;
    let best = -1, bd = 14 * 14;
    for (let k = 0; k < run.rateI.length; k++) {
      const i = run.rateI[k];
      const [x, y] = project(i), d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  useImperativeHandle(ref, () => ({
    setView(v) {
      const s = S.current;
      s.yaw = VIEWS[v].yaw; s.pitch = VIEWS[v].pitch; s.zoom = 1; s.dirty = true;
      P.current.onViewChange?.(v);
    },
    redraw() { S.current.dirty = true; },
  }));

  // GL setup
  useEffect(() => {
    const cv = glRef.current!;
    const gl = cv.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) return;
    const s = S.current;
    s.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    s.prog = prog;
    for (const u of ["u_mvp", "u_px", "u_base", "u_zoom", "u_baseCol", "u_baseA"]) s.loc[u] = gl.getUniformLocation(prog, u);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    s.bufPos = gl.createBuffer(); s.bufAct = gl.createBuffer(); s.bufCls = gl.createBuffer();

    let onScreen = true;
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) s.dirty = true; });
    io.observe(cv);
    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      if (!onScreen || document.hidden) return;
      const pr = P.current;
      if (pr.autoRotate && !dragging.current) { s.yaw += 0.0012; s.dirty = true; }
      if (pr.run && pr.clock.t !== s.lastT) { s.lastT = pr.clock.t; s.dirty = true; }
      if (s.dirty) { s.dirty = false; draw(); }
    };
    s.raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(s.raf); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // geometry upload
  useEffect(() => {
    const s = S.current, gl = s.gl, geo = props.geo;
    if (!gl || !geo || !s.prog) return;
    s.n = geo.n;
    const pos = new Float32Array(3 * geo.n);
    for (let k = 0; k < 3 * geo.n; k++) pos[k] = geo.xyz[k] / 10;
    s.pos = pos;
    s.act = new Float32Array(geo.n);
    const cls = new Float32Array(geo.n);
    for (let i = 0; i < geo.n; i++) cls[i] = geo.cls[i];
    const bind = (buf: WebGLBuffer | null, data: Float32Array, name: string, size: number, usage: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      const loc = gl.getAttribLocation(s.prog!, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(s.bufPos, pos, "a_pos", 3, gl.STATIC_DRAW);
    bind(s.bufCls, cls, "a_cls", 1, gl.STATIC_DRAW);
    bind(s.bufAct, s.act, "a_act", 1, gl.DYNAMIC_DRAW);
    s.dirty = true;
  }, [props.geo]);

  useEffect(() => { S.current.dirty = true; }, [props.run, props.mode, props.selected]);

  // resize
  useEffect(() => {
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const s = S.current, r = wrap.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.W = Math.max(1, Math.round(r.width * s.dpr));
      s.H = Math.max(1, Math.round(r.height * s.dpr));
      for (const c of [glRef.current!, ovRef.current!]) { c.width = s.W; c.height = s.H; }
      s.dirty = true;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // interaction
  const dragging = useRef(false);
  useEffect(() => {
    const wrap = wrapRef.current!;
    if (!props.interactive) return;
    let d: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { d = { x: e.clientX, y: e.clientY, yaw: S.current.yaw, pitch: S.current.pitch, moved: false }; wrap.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      const s = S.current;
      if (d) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; dragging.current = true; wrap.dataset.dragging = "1"; }
        if (d.moved) {
          s.yaw = d.yaw + dx * 0.008;
          s.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d.pitch + dy * 0.008));
          s.dirty = true;
          P.current.onViewChange?.(null);
          P.current.onHover?.(-1, 0, 0);
        }
        return;
      }
      const i = pick(e.clientX, e.clientY);
      const r = wrap.getBoundingClientRect();
      P.current.onHover?.(i, e.clientX - r.left, e.clientY - r.top);
    };
    const up = (e: PointerEvent) => {
      if (d && !d.moved) { const i = pick(e.clientX, e.clientY); if (i >= 0) P.current.onPick?.(i); }
      d = null; dragging.current = false; delete wrap.dataset.dragging;
    };
    const leave = () => P.current.onHover?.(-1, 0, 0);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = S.current;
      s.zoom = Math.max(0.6, Math.min(14, s.zoom * Math.exp(-e.deltaY * 0.0015)));
      s.dirty = true;
    };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointerleave", leave);
    wrap.addEventListener("wheel", wheel, { passive: false });
    return () => {
      wrap.removeEventListener("pointerdown", down);
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerup", up);
      wrap.removeEventListener("pointerleave", leave);
      wrap.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.interactive]);

  return (
    <div ref={wrapRef} className={`brain-gl ${props.interactive ? "is-interactive" : ""} ${props.className ?? ""}`} role="img" aria-label={props.ariaLabel ?? "3D map of every neuron in the fly brain"}>
      <canvas ref={glRef} />
      <canvas ref={ovRef} />
    </div>
  );
});

export default BrainGL;
