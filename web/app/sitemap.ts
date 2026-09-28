import type { MetadataRoute } from "next";
import { APPS, SITE_URL } from "@/lib/apps";
import { DOCS } from "@/lib/docs";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/apps/`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...APPS.map((a) => ({ url: `${SITE_URL}/apps/${a.slug}/`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${SITE_URL}/lab/`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...DOCS.map((d) => ({ url: `${SITE_URL}/docs/${d.slug ? d.slug + "/" : ""}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
