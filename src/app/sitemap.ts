import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { CONTESTS, EXHIBITIONS } from "@/lib/site-data";

/** XML sitemap for crawlers (Google / Naver / Bing). Lists public content so it
 *  is indexed domestically and internationally. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string) => `${SITE_URL}${path}`;

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: url("/contests"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: url("/exhibitions"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/winners"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/notices"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: url("/help"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const contestPages: MetadataRoute.Sitemap = CONTESTS.map((c) => ({
    url: url(`/contests/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const exhibitionPages: MetadataRoute.Sitemap = EXHIBITIONS.map((e) => ({
    url: url(`/exhibitions/${e.slug}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...contestPages, ...exhibitionPages];
}
