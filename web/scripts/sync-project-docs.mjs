// Copy the repo-level CHANGELOG, ROADMAP and NOTEBOOK into web/content/project so the
// docs build works even when only the web/ folder is available (e.g. Vercel Root Directory = web).
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const web = process.cwd(), root = join(web, "..");
for (const f of ["CHANGELOG.md", "ROADMAP.md", "NOTEBOOK.md"]) {
  const src = join(root, f);
  if (existsSync(src)) copyFileSync(src, join(web, "content", "project", f));
}
