import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export type DocPage = { slug: string; title: string; group: string; file: string; description?: string };

const WEB = process.cwd();
const ROOT = path.resolve(WEB, "..");
const c = (f: string) => path.join(WEB, "content", "docs", f);

export const DOCS: DocPage[] = [
  { slug: "", title: "Overview", group: "Start here", file: c("index.md") },
  { slug: "getting-started", title: "Install and run", group: "Start here", file: c("getting-started.md") },
  { slug: "lab", title: "Using the lab", group: "Start here", file: c("lab.md") },
  { slug: "command-center", title: "Command center", group: "Start here", file: c("command-center.md") },
  { slug: "how-it-works", title: "How the model works", group: "Science", file: c("how-it-works.md") },
  { slug: "experiments", title: "Recorded experiments", group: "Science", file: c("experiments.md") },
  { slug: "presets", title: "Presets and cell types", group: "Science", file: c("presets.md") },
  { slug: "python", title: "Python API and CLI", group: "Build", file: c("python.md") },
  { slug: "architecture", title: "Architecture", group: "Build", file: c("architecture.md") },
  { slug: "deploying", title: "Deploying", group: "Build", file: c("deploying.md") },
  { slug: "roadmap", title: "Roadmap", group: "Project", file: path.join(ROOT, "ROADMAP.md") },
  { slug: "changelog", title: "Changelog", group: "Project", file: path.join(ROOT, "CHANGELOG.md") },
  { slug: "notebook", title: "Lab notebook", group: "Project", file: path.join(ROOT, "NOTEBOOK.md") },
  { slug: "credits", title: "Credits and citations", group: "Project", file: c("credits.md") },
];

export function getDoc(slug: string) {
  const page = DOCS.find((d) => d.slug === slug);
  if (!page) return null;
  const md = fs.readFileSync(page.file, "utf8");
  const firstPara = md.split("\n\n").find((b) => b.trim() && !b.startsWith("#"))?.replace(/[*_`[\]]/g, "").replace(/\(.*?\)/g, "").trim();
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = marked.Parser.parseInline(tokens);
    const id = text.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  renderer.link = ({ href, tokens }) => {
    const text = marked.Parser.parseInline(tokens);
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
  };
  const html = marked.parse(md, { renderer, async: false }) as string;
  return { page, html, description: firstPara?.slice(0, 180) };
}
