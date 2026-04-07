import type { MetadataRoute } from "next";

import { getVerseSequencePayload } from "@/lib/server/quran-api";
import { SITE_URL, compareVerseKeys, normalizeVerseKey } from "@/lib/seo/metadata";

type SitemapChangeFrequency = "daily" | "weekly";

const STATIC_PAGES: Array<{
  pathname: string;
  priority: number;
  changeFrequency: SitemapChangeFrequency;
}> = [
  { pathname: "/focus", priority: 1, changeFrequency: "daily" },
  { pathname: "/reader/rub", priority: 0.95, changeFrequency: "daily" },
  { pathname: "/reader/page", priority: 0.95, changeFrequency: "daily" }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.pathname}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));

  const tafsirEntries = await buildTafsirEntries(now);

  return [...staticEntries, ...tafsirEntries];
}

async function buildTafsirEntries(lastModified: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const payload = await getVerseSequencePayload();
    const verseKeys = new Set<string>();

    for (const verseKey of payload.verses ?? []) {
      const normalized = normalizeVerseKey(verseKey);
      if (normalized) {
        verseKeys.add(normalized);
      }
    }

    return Array.from(verseKeys)
      .sort(compareVerseKeys)
      .map((verseKey) => ({
        url: `${SITE_URL}/tafsir/${encodeURIComponent(verseKey)}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.7
      }));
  } catch {
    return [];
  }
}
