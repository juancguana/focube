// Relative import (not the "@/" alias): this module is also imported
// directly by `vite.config.ts`, which Vite loads as a plain Node ESM module
// without the `vite-tsconfig-paths` alias resolution applied to itself.
import { copy } from "../copy";

/**
 * Open Graph / Twitter card generation.
 *
 * `VITE_SITE_URL` has no verified value today — `sst.config.ts` declares no
 * custom domain. The real failure mode is not "wrong domain", it is Vite
 * leaving a literal `%VITE_SITE_URL%` placeholder in the built HTML when the
 * var is undefined. This module never touches that placeholder syntax: it
 * resolves the value in plain TypeScript and injects a fully-built tag block
 * via a `transformIndexHtml` hook (see `vite.config.ts`), so an unresolved
 * placeholder cannot leak into shipped HTML.
 */

const OG_IMAGE_PATH = "/og-cover.png";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Resolves `VITE_SITE_URL` into a safe absolute origin.
 *
 * Returns `""` when the value is absent, unparseable, or not served over
 * `https:` — an env typo or a plain-http misconfiguration must never end up
 * in a social card. Trailing paths/slashes are dropped: only the origin is
 * ever returned.
 */
export function resolveSiteUrl(raw: string | undefined): string {
  if (!raw) return "";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }

  if (parsed.protocol !== "https:") return "";

  return parsed.origin;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function ogTag(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeAttr(content)}" />`;
}

function twitterTag(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeAttr(content)}" />`;
}

/**
 * Builds the Open Graph + Twitter card meta tag block injected into
 * `index.html` in place of the `<!--social-tags-->` marker.
 *
 * `siteUrl` MUST already be the output of `resolveSiteUrl` (or `""`). When
 * `""`, the image URLs degrade to root-relative paths and `og:url` is
 * omitted entirely — an `og:url` of `"/"` is worse than none, since crawlers
 * fall back to the fetched document URL as canonical anyway.
 */
export function buildSocialTags(siteUrl: string): string {
  const imageUrl = siteUrl ? `${siteUrl}${OG_IMAGE_PATH}` : OG_IMAGE_PATH;

  const tags = [
    ogTag("og:title", copy.og.title),
    ogTag("og:description", copy.og.description),
    ogTag("og:image", imageUrl),
    ogTag("og:image:width", String(OG_IMAGE_WIDTH)),
    ogTag("og:image:height", String(OG_IMAGE_HEIGHT)),
    ogTag("og:image:alt", copy.og.imageAlt),
    ogTag("og:type", "website"),
    ogTag("og:site_name", copy.brand),
    ogTag("og:locale", "es"),
    ...(siteUrl ? [ogTag("og:url", siteUrl)] : []),
    twitterTag("twitter:card", "summary_large_image"),
    twitterTag("twitter:title", copy.og.title),
    twitterTag("twitter:description", copy.og.description),
    twitterTag("twitter:image", imageUrl),
  ];

  return tags.join("\n    ");
}
