import Link from "next/link";
import type { Metadata } from "next";
import { APPS, SITE_NAME, SITE_URL, appBySlug } from "@/lib/apps";

export function appMetadata(slug: string): Metadata {
  const a = appBySlug(slug);
  const url = `${SITE_URL}/apps/${slug}/`;
  const title = `${a.name}: ${a.tagline.replace(/\.$/, "")}`;
  return {
    title: { absolute: `${a.name} · ${SITE_NAME}` },
    description: a.description,
    keywords: a.keywords,
    alternates: { canonical: url },
    openGraph: { title, description: a.description, url, siteName: SITE_NAME, type: "website", images: [{ url: `${SITE_URL}/og/${slug}.png`, width: 1200, height: 630, alt: a.name }] },
    twitter: { card: "summary_large_image", title, description: a.description, images: [`${SITE_URL}/og/${slug}.png`] },
  };
}

export type Faq = [string, string];

/** Header, JSON-LD, explainer sections and FAQ shared by every app page. */
export function AppPage({ slug, children, how, faq, stats }: { slug: string; children: React.ReactNode; how: React.ReactNode; faq: Faq[]; stats: string[] }) {
  const a = appBySlug(slug);
  const url = `${SITE_URL}/apps/${slug}/`;
  const ld = [
    {
      "@context": "https://schema.org", "@type": "WebApplication", name: a.name, url, description: a.description,
      applicationCategory: "EducationalApplication", operatingSystem: "Any (web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Person", name: "Dhruv Agrawat", url: "https://github.com/dhruvagrawat" },
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, t]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: t } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL + "/" },
      { "@type": "ListItem", position: 2, name: "Apps", item: SITE_URL + "/apps/" },
      { "@type": "ListItem", position: 3, name: a.name, item: url },
    ] },
  ];
  const i = APPS.findIndex((x) => x.slug === slug);
  const next = APPS[(i + 1) % APPS.length];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="container app-page">
        <nav className="crumbs small" aria-label="Breadcrumb"><Link href="/apps/">Apps</Link><span aria-hidden> / </span><span>{a.name}</span></nav>
        <header className="app-head">
          <h1>{a.name}</h1>
          <p className="app-tag">{a.tagline}</p>
          <ul className="app-stats">{stats.map((s) => <li key={s}>{s}</li>)}</ul>
        </header>
        {children}
        <section className="app-how">
          <div className="app-how-main prose">{how}</div>
          <aside className="app-faq">
            <h2>Questions</h2>
            {faq.map(([q, t]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{t}</p>
              </details>
            ))}
          </aside>
        </section>
        <div className="app-next">
          <Link href="/apps/" className="btn ghost">All apps</Link>
          <Link href={`/apps/${next.slug}/`} className="btn ghost">Next: {next.name} →</Link>
        </div>
      </div>
    </>
  );
}
