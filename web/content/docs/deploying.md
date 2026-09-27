# Deploying

## The website (Vercel)

The repo is ready for Vercel with no settings to change. `vercel.json` at the root tells Vercel to build `web/` and serve `web/out/`.

1. Go to [vercel.com/new](https://vercel.com/new) and import `dhruvagrawat/fly-brain-sim`.
2. Leave the defaults and press **Deploy**.
3. Every push to `main` redeploys automatically, and pull requests get preview URLs.

The hosted site is fully static: landing page, docs and the lab with recorded experiments. Live simulation needs the Python simulator, which is too heavy for serverless functions (~9 s of CPU per simulated second, plus 140 MB of data).

## Live simulation

The simplest setup is `python -m flybrain serve` on your own machine, with the hosted site connected to it (see [Install and run](/docs/getting-started/)).

To make live runs public, the simulator needs a host that allows long-running processes: Render, Fly.io, Railway, a small VM, or a Hugging Face Space. Run `python -m flybrain serve --host 0.0.0.0 --port $PORT --no-browser` and point the lab's "connect a simulator" box at its URL.

## Updating recorded experiments

```bash
python scripts/export_web_data.py          # all demos, ~3 minutes
git add web/public/data && git commit -m "Refresh recorded experiments" && git push
```
