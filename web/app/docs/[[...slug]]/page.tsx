import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS, getDoc } from "@/lib/docs";

const REPO = "https://github.com/dhruvagrawat/fly-brain-sim";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug ? [d.slug] : [] }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug?.[0] ?? "");
  const s = slug?.[0] ?? "";
  return { title: doc ? `${doc.page.title} · Docs` : "Docs", description: doc?.description, alternates: { canonical: `/docs/${s ? s + "/" : ""}` }, openGraph: { images: [{ url: "/og/docs.png", width: 1200, height: 630 }] } };
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const s = slug?.[0] ?? "";
  const doc = getDoc(s);
  if (!doc) notFound();
  const i = DOCS.findIndex((d) => d.slug === s);
  const prev = DOCS[i - 1], next = DOCS[i + 1];
  const groups = Array.from(new Set(DOCS.map((d) => d.group)));
  const href = (d: { slug: string }) => (d.slug ? `/docs/${d.slug}/` : "/docs/");
  const rel = doc.page.file.includes("/content/docs/") ? `web/content/docs/${doc.page.file.split("/content/docs/")[1]}` : doc.page.file.split("/").pop();
  return (
    <div className="container docs">
      <nav className="docs-nav" aria-label="Documentation">
        {groups.map((g) => (
          <div key={g} className="docs-nav-group">
            <p className="eyebrow" style={{ padding: "0 10px 6px" }}>{g}</p>
            {DOCS.filter((d) => d.group === g).map((d) => (
              <Link key={d.slug} href={href(d)} aria-current={d.slug === s ? "page" : undefined}>{d.title}</Link>
            ))}
          </div>
        ))}
      </nav>
      <article>
        <div className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <p className="docs-edit">
          Found something out of date? <a href={`${REPO}/edit/main/${rel}`} target="_blank" rel="noopener noreferrer">Edit this page on GitHub</a>.
        </p>
        <div className="docs-pager">
          {prev ? <Link href={href(prev)}><small>Previous</small>{prev.title}</Link> : <span />}
          {next && <Link href={href(next)} className="next"><small>Next</small>{next.title}</Link>}
        </div>
      </article>
    </div>
  );
}
