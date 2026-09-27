"""Local web interface: python -m flybrain serve"""
from __future__ import annotations

import json
import mimetypes
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import data, model, neurons, viz

WEB_DIR = Path(__file__).resolve().parent / "web"
#: Built Next.js site (cd web && npm run build). Served when present.
SITE_DIR = Path(__file__).resolve().parent.parent / "web" / "out"


HEAD = ('<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')


def page_html(embed: str | None = None, standalone: bool = True) -> str:
    """The web UI. With `embed` (JSON), the page shows recorded runs instead of calling the API."""
    body = (WEB_DIR / "app.html").read_text(encoding="utf-8")
    if embed is not None:
        body = body.replace("__EMBED__", embed.replace("</", "<\\/"))
    return (HEAD + body) if standalone else body


class State:
    def __init__(self, data_dir):
        print("Loading connectome ...", flush=True)
        self.con = data.load(data_dir)
        self.ann = data.load_annotations(self.con, data_dir)
        self.geometry = json.dumps(viz.geometry(self.ann)).encode()
        self.presets = [{"name": k, "desc": d, "n": len(neurons.resolve(k, self.ann))}
                        for k, (d, _) in neurons.PRESETS.items()]
        self.lock = threading.Lock()
        self.job = {"state": "idle"}
        print("Compiling simulator (first run only) ...", flush=True)
        model.simulate(self.con, [], params=model.Params(t_run=5, n_run=1), verbose=False)

    def resolve(self, items):
        ids = []
        for item in items or []:
            item = str(item).strip()
            if not item:
                continue
            found = neurons.resolve([int(item)], self.ann) if item.isdigit() else neurons.resolve(item, self.ann)
            if not found:
                raise ValueError(f"No neurons match '{item}'. Use a preset, a cell type or a FlyWire ID.")
            ids.extend(found)
        return list(dict.fromkeys(ids))

    def start(self, req):
        with self.lock:
            if self.job["state"] == "running":
                raise ValueError("A simulation is already running.")
            stim = self.resolve(req.get("stim"))
            silence = self.resolve(req.get("silence"))
            if not stim:
                raise ValueError("Choose at least one neuron to stimulate.")
            p = model.Params(
                t_run=float(min(max(req.get("duration", 1000), 50), 5000)),
                n_run=int(min(max(req.get("trials", 5), 1), 50)),
                r_poi=float(min(max(req.get("rate", 150), 1), 1000)),
                seed=int(req.get("seed", 0)),
            )
            label = req.get("label") or ", ".join(map(str, req.get("stim")))
            self.job = {"state": "running", "trial": 0, "n_run": p.n_run, "started": time.time()}
        threading.Thread(target=self._run, args=(stim, silence, p, label), daemon=True).start()

    def _run(self, stim, silence, p, label):
        try:
            job = self.job
            n_run = p.n_run
            results = []
            # run trial by trial so progress can be reported
            for t in range(n_run):
                q = model.Params(**{**p.__dict__, "n_run": 1, "seed": p.seed * 1000 + t})
                results.append(model.simulate(self.con, stim, silence, params=q, verbose=False))
                job["trial"] = t + 1
            import numpy as np
            res = model.Result(
                np.concatenate([r.neuron for r in results]),
                np.concatenate([r.time for r in results]),
                np.concatenate([np.full(r.neuron.size, k, np.int32) for k, r in enumerate(results)]),
                p, self.con.flywire_ids, any(r.truncated for r in results),
            )
            payload = viz.result_payload(res, self.ann, stim, silence, label)
            payload["elapsed_s"] = round(time.time() - job["started"], 1)
            self.job = {"state": "done", "result": json.dumps(payload).encode()}
        except Exception as e:  # report to the UI
            traceback.print_exc()
            self.job = {"state": "error", "error": str(e)}


def make_handler(state: State):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass

        def _cors(self):
            # Let the hosted site (e.g. on Vercel) drive this local simulator.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")

        def _send(self, body: bytes, ctype="application/json", code=200, cache="no-store"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            self._cors()
            self.end_headers()
            if not getattr(self, "_head_only", False):
                self.wfile.write(body)

        def do_HEAD(self):
            # Next.js prefetches pages with HEAD; answer with headers only.
            self._head_only = True
            try:
                self.do_GET()
            finally:
                self._head_only = False

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _static(self, path: str) -> bool:
            """Serve a file from the built web app. Returns False if not found."""
            if not SITE_DIR.is_dir():
                return False
            rel = path.lstrip("/")
            target = (SITE_DIR / rel).resolve()
            if SITE_DIR.resolve() not in target.parents and target != SITE_DIR.resolve():
                return False
            if target.is_dir():
                target = target / "index.html"
            elif not target.exists() and (SITE_DIR / (rel + ".html")).exists():
                target = SITE_DIR / (rel + ".html")
            if not target.is_file():
                return False
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
                ctype += "; charset=utf-8"
            cache = "public, max-age=31536000, immutable" if "/_next/static/" in path else "no-cache"
            self._send(target.read_bytes(), ctype, cache=cache)
            return True

        def _json(self, obj, code=200):
            self._send(json.dumps(obj).encode(), code=code)

        def do_GET(self):
            path = self.path.split("?")[0]
            if not path.startswith("/api/") and self._static(path):
                return
            if path in ("/", "/index.html"):
                self._send(page_html().encode(), "text/html; charset=utf-8")
            elif path == "/api/geometry":
                self._send(state.geometry)
            elif path == "/api/presets":
                self._json(state.presets)
            elif path == "/api/status":
                job = state.job
                if job["state"] == "done":
                    self._send(b'{"state":"done","result":' + job["result"] + b"}")
                else:
                    self._json(job)
            else:
                self._json({"error": "not found"}, 404)

        def do_POST(self):
            if self.path != "/api/run":
                return self._json({"error": "not found"}, 404)
            try:
                length = int(self.headers.get("Content-Length", 0))
                state.start(json.loads(self.rfile.read(length) or b"{}"))
                self._json({"state": "running"})
            except ValueError as e:
                self._json({"error": str(e)}, 400)

    return Handler


def serve(host="127.0.0.1", port=8050, data_dir=data.DEFAULT_DATA_DIR, open_browser=True):
    state = State(data_dir)
    httpd = ThreadingHTTPServer((host, port), make_handler(state))
    url = f"http://{host}:{port}/" + ("lab/" if SITE_DIR.is_dir() else "")
    print(f"Fly brain simulator running at {url}  (Ctrl+C to stop)", flush=True)
    if open_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
