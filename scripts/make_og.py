"""Render Open Graph images (1200x630) for the site into web/public/og/.

Needs Playwright + Chromium and a running static server of web/out:
    cd web && npm run build && python -m http.server 8060 --directory out &
    python scripts/make_og.py
"""
from __future__ import annotations

import asyncio
import base64
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "og"
OUT.mkdir(parents=True, exist_ok=True)
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8060"


def apps():
    src = (ROOT / "web" / "lib" / "apps.ts").read_text()
    items = re.findall(r'slug: "([^"]+)",\s*name: "([^"]+)",\s*tagline: "([^"]+)"', src)
    return [{"slug": s, "name": n, "tagline": t} for s, n, t in items]


CARD = """<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:B;src:url('%(font)s')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#05070b;color:#eef2f8;font-family:B,system-ui,sans-serif;overflow:hidden;position:relative}
.bg{position:absolute;inset:0;background:url('%(brain)s') no-repeat 640px 60px/760px auto;opacity:.95}
.sh{position:absolute;inset:0;background:linear-gradient(90deg,#05070b 0%%,rgba(5,7,11,.92) 42%%,rgba(5,7,11,0) 75%%)}
.in{position:absolute;left:72px;top:72px;right:520px;bottom:64px;display:flex;flex-direction:column;justify-content:space-between}
.brand{font-weight:800;font-size:34px;letter-spacing:-.02em}.brand b{color:#ff8a4c}
.eb{font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:#9aa6ba;margin-bottom:18px}
h1{font-size:%(size)spx;line-height:1.02;letter-spacing:-.03em;font-weight:800}
p{font-size:26px;line-height:1.35;color:#b9c3d3;margin-top:18px}
.ft{font-size:20px;color:#7f8a9e}.ft b{color:#ffb07e;font-weight:600}
</style></head><body><div class="bg"></div><div class="sh"></div>
<div class="in"><div class="brand">fly<b>brain</b></div>
<div><div class="eb">%(eyebrow)s</div><h1>%(title)s</h1><p>%(sub)s</p></div>
<div class="ft"><b>138,639 neurons</b> · real FlyWire connectome · runs in your browser</div></div></body></html>"""


async def main():
    font = ROOT / "web" / "node_modules" / "@fontsource" / "bricolage-grotesque" / "files" / "bricolage-grotesque-latin-800-normal.woff2"
    font_uri = "data:font/woff2;base64," + base64.b64encode(font.read_bytes()).decode()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1400, "height": 900}, color_scheme="dark")
        await pg.goto(f"{BASE}/lab/?run=ppl1_dopamine&cmd=seek%20600")
        await pg.wait_for_timeout(9000)
        brain_png = await pg.locator(".scope").screenshot()
        brain_uri = "data:image/png;base64," + base64.b64encode(brain_png).decode()
        cards = [
            ("home", "Whole-brain simulation", "Every neuron of a fly’s brain. Switched on.", "Stimulate any of 8,839 cell types and watch the signal spread.", 64),
            ("apps", "8 apps", "Hand a real fly brain the controls", "Games and experiments where the fly’s own neurons decide.", 60),
            ("lab", "The lab", "Run experiments on a fly brain", "3D replay, command center, run comparison.", 60),
            ("docs", "Documentation", "How Flybrain works", "Guides, model, API, roadmap and lab notebook.", 60),
        ] + [(a["slug"], "Flybrain app", a["name"], a["tagline"], 66 if len(a["name"]) < 18 else 56) for a in apps()]
        card = await b.new_page(viewport={"width": 1200, "height": 630})
        for slug, eyebrow, title, sub, size in cards:
            html = CARD % {"font": font_uri, "brain": brain_uri, "eyebrow": eyebrow, "title": title, "sub": sub, "size": size}
            await card.set_content(html)
            await card.wait_for_timeout(150)
            await card.screenshot(path=str(OUT / f"{slug}.png"))
            print("og:", slug)
        await b.close()


asyncio.run(main())
