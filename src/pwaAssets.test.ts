import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test for the PWA icon manifest and the apple-touch-icon link.
 *
 * Lives in `src/` rather than `public/` on purpose: anything under `public/`
 * is copied verbatim into `dist/` by Vite, and a stray `.test.ts` file there
 * would ship inside the production build.
 */

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const repoRoot = join(__dirname, "..");

const manifest = JSON.parse(
  readFileSync(join(repoRoot, "public", "manifest.json"), "utf-8"),
) as { icons: ManifestIcon[] };

const indexHtml = readFileSync(join(repoRoot, "index.html"), "utf-8");

describe("public/manifest.json — icon purpose split", () => {
  it("declares raster PNG entries for 192 and 512 with purpose 'any'", () => {
    const any192 = manifest.icons.find(
      (icon) => icon.sizes === "192x192" && icon.purpose === "any",
    );
    const any512 = manifest.icons.find(
      (icon) => icon.sizes === "512x512" && icon.purpose === "any",
    );
    expect(any192).toBeDefined();
    expect(any192?.src).toMatch(/\.png$/);
    expect(any512).toBeDefined();
    expect(any512?.src).toMatch(/\.png$/);
  });

  it("declares a maskable-512 PNG entry with purpose exactly 'maskable'", () => {
    const maskable = manifest.icons.find(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
    );
    expect(maskable).toBeDefined();
    expect(maskable?.src).toMatch(/\.png$/);
  });

  it("never declares a single entry claiming both 'any' and 'maskable'", () => {
    for (const icon of manifest.icons) {
      const purposes = icon.purpose.split(/\s+/);
      const claimsBoth =
        purposes.includes("any") && purposes.includes("maskable");
      expect(claimsBoth).toBe(false);
    }
  });
});

describe("index.html — apple-touch-icon uses a real PNG", () => {
  it("points apple-touch-icon at /icon-192.png, not the SVG favicon", () => {
    const match = indexHtml.match(
      /<link\s+rel="apple-touch-icon"\s+href="([^"]+)"/,
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("/icon-192.png");
  });
});
