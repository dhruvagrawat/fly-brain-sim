"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain } from "@/lib/sim";
import { GroupRate, useFly, useSimLoop } from "@/lib/useFly";
import { Autopilot, LiveBrain, Meter } from "./LiveBrain";

type Cmd = { key: string; label: string; groups: string[]; hz: number; ms: number; sniff?: boolean; desc: string };
const CMDS: Cmd[] = [
  { key: "sugar", label: "!sugar", groups: ["sugar"], hz: 200, ms: 1500, desc: "taste sugar" },
  { key: "bitter", label: "!bitter", groups: ["bitter"], hz: 200, ms: 1500, desc: "taste something bitter" },
  { key: "salt", label: "!salt", groups: ["salt"], hz: 200, ms: 1500, desc: "taste salt" },
  { key: "loom", label: "!loom", groups: ["LPLC2_left", "LPLC2_right"], hz: 80, ms: 1000, desc: "something rushes at the fly" },
  { key: "loomleft", label: "!loomleft", groups: ["LPLC2_left"], hz: 100, ms: 1000, desc: "threat from the left" },
  { key: "loomright", label: "!loomright", groups: ["LPLC2_right"], hz: 100, ms: 1000, desc: "threat from the right" },
  { key: "walk", label: "!walk", groups: ["forward_walk"], hz: 200, ms: 1500, desc: "forward-walking command neurons" },
  { key: "moonwalk", label: "!moonwalk", groups: ["moonwalker"], hz: 200, ms: 1500, desc: "backward-walking (MDN)" },
  { key: "jump", label: "!jump", groups: ["giant_fiber"], hz: 200, ms: 800, desc: "fire the giant fiber" },
  { key: "turn", label: "!turn", groups: ["steer"], hz: 200, ms: 1200, desc: "steering neurons" },
  { key: "vinegar", label: "!vinegar", groups: ["ORN_vinegar"], hz: 150, ms: 1500, sniff: true, desc: "sniff vinegar" },
  { key: "banana", label: "!banana", groups: ["ORN_banana"], hz: 150, ms: 1500, sniff: true, desc: "sniff banana" },
  { key: "pheromone", label: "!pheromone", groups: ["ORN_pheromone"], hz: 150, ms: 1500, sniff: true, desc: "sniff fly pheromone" },
];
const ALIASES: Record<string, string> = { escape: "jump", sweet: "sugar", candy: "sugar", poison: "bitter", scare: "loom", back: "moonwalk", forward: "walk", sniff: "vinegar", perfume: "pheromone" };
const BOTS = ["sugarfan42", "neuro_nerd", "fly_on_the_wall", "drosophila_dan", "spikequeen", "connectome_kid", "bzzzzz", "mn9_enjoyer"];

type Active = { cmd: Cmd; until: number; t0: number };
type Ev = { id: number; user: string; text: string; cmd?: string; brain?: string; system?: boolean };

export default function TwitchPlays() {
  const { geo, pack, error } = useFly("sandbox");
  const brain = useMemo(() => (pack ? new Brain(pack, { seed: 3 }) : null), [pack]);
  const [channel, setChannel] = useState("");
  const [conn, setConn] = useState<"off" | "connecting" | "on" | "error">("off");
  const [auto, setAuto] = useState(true);
  const [bots, setBots] = useState(true);
  const [events, setEvents] = useState<Ev[]>([]);
  const [leaders, setLeaders] = useState<Record<string, number>>({});
  const [out, setOut] = useState({ feed: 0, esc: 0, dl: 0, dr: 0, active: 0 });
  const [overlay, setOverlay] = useState(false);
  const [local, setLocal] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const S = useRef({ t: 0, actives: [] as Active[], lastCmd: -1e9, lastUser: new Map<string, number>(), boredom: new Map<string, number>(), evId: 0, window: { feed: 0, esc: 0, walk: 0 } });

  useEffect(() => { setOverlay(new URLSearchParams(location.search).get("overlay") === "1"); const c = new URLSearchParams(location.search).get("channel"); if (c) setChannel(c); }, []);

  const push = useCallback((e: Omit<Ev, "id">) => setEvents((ev) => [{ ...e, id: S.current.evId++ }, ...ev].slice(0, 40)), []);

  const G = useMemo(() => {
    if (!pack) return null;
    const g: Record<string, number[]> = { ...pack.groups };
    const DN = [...pack.groups.DN_left, ...pack.groups.DN_right];
    g.DN = DN;
    return g;
  }, [pack]);
  const rates = useMemo(() => (G ? { feed: new GroupRate(G.MN9, 150), esc: new GroupRate([...G.GF_left, ...G.GF_right], 150), dl: new GroupRate(G.DN_left, 250), dr: new GroupRate(G.DN_right, 250) } : null), [G]);

  const trigger = useCallback((user: string, raw: string, fromChat = true) => {
    const s = S.current;
    const word = raw.trim().replace(/^!/, "").split(/\s+/)[0].toLowerCase();
    const key = ALIASES[word] ?? word;
    const cmd = CMDS.find((c) => c.key === key);
    if (!cmd) return false;
    const last = s.lastUser.get(user) ?? -1e9;
    if (fromChat && s.t - last < 2500) return true; // per-user cooldown (simulated ms)
    s.lastUser.set(user, s.t);
    s.actives = s.actives.filter((a) => a.cmd.key !== cmd.key);
    s.actives.push({ cmd, until: s.t + cmd.ms, t0: s.t });
    if (fromChat) { s.lastCmd = s.t; setLeaders((l) => ({ ...l, [user]: (l[user] ?? 0) + 1 })); }
    push({ user, text: raw, cmd: cmd.label });
    return true;
  }, [push]);

  // Twitch chat (anonymous, read-only)
  const connect = () => {
    const ch = channel.trim().replace(/^#/, "").toLowerCase();
    if (!ch) return;
    ws.current?.close();
    setConn("connecting");
    const sock = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    ws.current = sock;
    sock.onopen = () => {
      sock.send("CAP REQ :twitch.tv/tags");
      sock.send("PASS SCHMOOPIIE");
      sock.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      sock.send(`JOIN #${ch}`);
    };
    sock.onmessage = (m) => {
      for (const line of String(m.data).split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) { sock.send("PONG :tmi.twitch.tv"); continue; }
        if (line.includes(" 366 ")) { setConn("on"); push({ user: "flybrain", text: `Connected to #${ch}. Chat commands are live.`, system: true }); }
        const pm = line.match(/(?:^@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/);
        if (pm) {
          const dn = pm[1]?.match(/display-name=([^;]*)/)?.[1] || pm[2];
          const text = pm[3];
          if (text.startsWith("!")) trigger(dn, text);
        }
      }
    };
    sock.onerror = () => setConn("error");
    sock.onclose = () => setConn((c) => (c === "on" || c === "connecting" ? "off" : c));
  };
  useEffect(() => () => ws.current?.close(), []);

  const ui = useRef(0), botT = useRef(0), sniffT = useRef(0);
  useSimLoop((ms) => {
    if (!brain || !G || !rates) return;
    const s = S.current;
    s.t += ms;
    // apply active stimuli (sniff commands pulse 20 ms every 300 ms)
    brain.clearStim();
    s.actives = s.actives.filter((a) => a.until > s.t);
    sniffT.current = (sniffT.current + ms) % 300;
    for (const a of s.actives) {
      if (a.cmd.sniff && sniffT.current > 20) continue;
      for (const g of a.cmd.groups) brain.setStim(G[g], a.cmd.hz);
    }
    brain.run(ms);
    const feed = rates.feed.update(brain, ms), esc = rates.esc.update(brain, ms), dl = rates.dl.update(brain, ms), dr = rates.dr.update(brain, ms);
    s.window.feed = Math.max(s.window.feed * 0.995, feed); s.window.esc = Math.max(s.window.esc * 0.995, esc); s.window.walk = Math.max(s.window.walk * 0.995, (dl + dr) * 30);
    // demo chat
    if (bots && conn !== "on") {
      botT.current += ms;
      if (botT.current > 2600 + Math.random() * 2000) {
        botT.current = 0;
        const c = CMDS[Math.floor(Math.random() * CMDS.length)];
        trigger(BOTS[Math.floor(Math.random() * BOTS.length)], c.label);
      }
    }
    // autopilot: quiet chat -> the brain picks its own next experience
    if (auto && s.t - s.lastCmd > 5000 && !s.actives.length) {
      const w = s.window;
      const bored = (k: string) => (s.boredom.get(k) ?? 0);
      let pick: string, why: string;
      if (w.feed > 30 && bored("sugar") < 3) { pick = "sugar"; why = `MN9 was at ${w.feed.toFixed(0)} Hz, so it goes back for more sugar`; }
      else if (w.esc > 40) { pick = "walk"; why = `giant fiber fired (${w.esc.toFixed(0)} Hz), so it runs for it`; }
      else if (w.walk > 30 && bored("vinegar") < 2) { pick = "vinegar"; why = "it's walking, so it stops to sniff around"; }
      else { const opts = ["sugar", "loom", "banana", "pheromone", "moonwalk"].filter((k) => bored(k) < 2); pick = opts[Math.floor(Math.random() * opts.length)] ?? "sugar"; why = "nothing much happening, so it explores"; }
      s.boredom.forEach((v, k) => s.boredom.set(k, Math.max(0, v - 0.34)));
      s.boredom.set(pick, bored(pick) + 1);
      s.lastCmd = s.t - 2500; // wait ~2.5 s before choosing again
      trigger("the fly (autopilot)", "!" + pick, false);
      push({ user: "brain", text: `Autopilot: ${why}.`, system: true });
      s.window = { feed: 0, esc: 0, walk: 0 };
    }
    ui.current += ms;
    if (ui.current > 80) {
      ui.current = 0;
      let a = 0; for (let i = 0; i < brain.n; i++) if (brain.trace[i] > 0.05) a++;
      setOut({ feed, esc, dl, dr, active: a });
    }
  }, { running: !!brain, speed: 1, maxMsPerFrame: 14 });

  const status = out.esc > 40 ? "ESCAPING" : out.feed > 25 ? "FEEDING" : out.dl + out.dr > 3 ? (Math.abs(out.dl - out.dr) > 0.8 ? `TURNING ${out.dl > out.dr ? "LEFT" : "RIGHT"}` : "WALKING") : out.active > 40 ? "THINKING" : "IDLE";
  const board = Object.entries(leaders).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const stim = pack && G ? S.current.actives.flatMap((a) => a.cmd.groups.flatMap((g) => G[g])) : [];

  const body = (
    <>
      <div className={`tw-status st-${status.split(" ")[0].toLowerCase()}`} aria-live="polite"><span className="eyebrow">Fly status</span><b>{status}</b></div>
      <div className="meters tw-meters">
        <Meter label="Feeding · MN9" value={out.feed} max={140} />
        <Meter label="Escape · giant fiber" value={out.esc} max={220} tone="blue" />
        <Meter label="Descending left" value={out.dl * 10} max={60} unit="" tone="green" />
        <Meter label="Descending right" value={out.dr * 10} max={60} unit="" tone="green" />
      </div>
    </>
  );

  if (overlay) {
    return (
      <div className="tw-overlay">
        <LiveBrain geo={geo} brain={brain} stim={stim} height="100%" className="tw-ov-brain" />
        <div className="tw-ov-side">
          {body}
          <div className="tw-cmds small">{CMDS.slice(0, 10).map((c) => <span key={c.key} className="mono">{c.label}</span>)}</div>
          <ul className="tw-feed">{events.slice(0, 8).map((e) => <li key={e.id} className={e.system ? "sys" : ""}><b>{e.user}</b> {e.cmd ?? e.text}</li>)}</ul>
        </div>
      </div>
    );
  }

  return (
    <div className="app-stage-grid">
      <section className="panel stage" aria-label="Twitch controls">
        <div className="stage-top">
          <Autopilot on={auto} onChange={setAuto} desc="When chat is quiet for 5 seconds, the fly picks its own next experience based on what its brain is doing: feeding, escaping or walking." />
        </div>
        <div className="tw-connect">
          <label htmlFor="tw-channel" className="eyebrow">Twitch channel</label>
          <form className="addrow" onSubmit={(e) => { e.preventDefault(); connect(); }}>
            <input id="tw-channel" className="input" placeholder="yourchannel" value={channel} onChange={(e) => setChannel(e.target.value)} autoComplete="off" />
            <button className="btn primary-sm" disabled={conn === "connecting"}>{conn === "on" ? "Reconnect" : conn === "connecting" ? "Connecting…" : "Connect chat"}</button>
          </form>
          <span className={`muted small conn-${conn}`}>{conn === "on" ? `Reading #${channel.replace(/^#/, "")} chat (read-only, no login)` : conn === "error" ? "Couldn't reach Twitch chat. Check the channel name." : "Read-only and anonymous. No Twitch login needed."}</span>
          <div className="tw-tools">
            <label className="check"><input type="checkbox" id="tw-bots" checked={bots} onChange={(e) => setBots(e.target.checked)} /> Demo chat bots when not connected</label>
            <button className="btn ghost small" onClick={() => { const u = `${location.origin}/apps/twitch-plays/?overlay=1${channel ? `&channel=${encodeURIComponent(channel.replace(/^#/, ""))}` : ""}`; navigator.clipboard?.writeText(u).catch(() => {}); push({ user: "flybrain", text: `Overlay URL copied: ${u}`, system: true }); }}>Copy OBS overlay URL</button>
          </div>
        </div>
        {body}
        <form className="addrow tw-local" onSubmit={(e) => { e.preventDefault(); if (!trigger("you", local.startsWith("!") ? local : "!" + local)) push({ user: "flybrain", text: `Unknown command “${local}”`, system: true }); setLocal(""); }}>
          <input id="tw-local" className="input" placeholder="Try a command: !sugar, !loom, !moonwalk…" value={local} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />
          <button className="btn">Send</button>
        </form>
        <div className="tw-cmds">
          {CMDS.map((c) => <button key={c.key} className="chip" onClick={() => trigger("you", c.label)} title={c.desc}>{c.label}</button>)}
        </div>
        <div className="tw-cols">
          <div>
            <h3>Chat → brain</h3>
            <ul className="tw-feed">
              {events.map((e) => <li key={e.id} className={e.system ? "sys" : ""}><b>{e.user}</b> <span>{e.cmd ? `${e.cmd}` : e.text}</span></li>)}
              {!events.length && <li className="muted">Waiting for commands…</li>}
            </ul>
          </div>
          <div>
            <h3>Top neuroscientists</h3>
            <ol className="tw-board">{board.map(([u, n]) => <li key={u}><span>{u}</span><b className="mono">{n}</b></li>)}</ol>
            {!board.length && <p className="empty">No commands yet.</p>}
          </div>
        </div>
      </section>
      <aside className="stage-side">
        <LiveBrain geo={geo} brain={brain} stim={stim} title="Live brain" subtitle={pack ? `${pack.n.toLocaleString()} neurons: taste, vision, smell, walking` : "loading…"} />
        {error && <p className="warn">{error}</p>}
      </aside>
    </div>
  );
}
