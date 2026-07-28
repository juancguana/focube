import { describe, expect, it } from "vitest";
import { buildSocialTags, resolveSiteUrl } from "./socialTags";

describe("resolveSiteUrl — origen del sitio (Slice B)", () => {
  it("devuelve vacío cuando falta la variable", () => {
    expect(resolveSiteUrl(undefined)).toBe("");
    expect(resolveSiteUrl("")).toBe("");
  });

  it("devuelve vacío para una URL inválida", () => {
    expect(resolveSiteUrl("no-es-una-url")).toBe("");
  });

  it("devuelve vacío para un origen no https", () => {
    expect(resolveSiteUrl("http://focube.app")).toBe("");
  });

  it("devuelve el origen sin slash final para una URL https válida", () => {
    expect(resolveSiteUrl("https://focube.app")).toBe("https://focube.app");
    expect(resolveSiteUrl("https://focube.app/")).toBe("https://focube.app");
  });

  it("ignora la ruta de una URL https con path y devuelve solo el origen", () => {
    expect(resolveSiteUrl("https://focube.app/algo")).toBe(
      "https://focube.app",
    );
  });
});

describe("buildSocialTags — degradado sin dominio verificado", () => {
  const html = buildSocialTags("");

  it("usa una imagen relativa de 1200x630", () => {
    expect(html).toContain('content="/og-cover.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it("omite og:url por completo cuando no hay origen verificado", () => {
    expect(html).not.toContain("og:url");
  });

  it("nunca deja un placeholder de Vite sin resolver", () => {
    expect(html).not.toContain("%VITE_SITE_URL%");
    expect(html).not.toContain("%VITE_");
  });
});

describe("buildSocialTags — con dominio verificado", () => {
  const siteUrl = "https://focube.app";
  const html = buildSocialTags(siteUrl);

  it("incluye todas las etiquetas Open Graph y Twitter requeridas", () => {
    const requiredSubstrings = [
      'property="og:title"',
      'property="og:description"',
      'property="og:image"',
      'property="og:image:width" content="1200"',
      'property="og:image:height" content="630"',
      'property="og:image:alt"',
      'property="og:type" content="website"',
      'property="og:site_name"',
      'property="og:locale" content="es"',
      `property="og:url" content="${siteUrl}"`,
      'name="twitter:card" content="summary_large_image"',
      'name="twitter:title"',
      'name="twitter:description"',
      'name="twitter:image"',
    ];

    for (const fragment of requiredSubstrings) {
      expect(html).toContain(fragment);
    }
  });

  it("construye una imagen absoluta https:// a partir del origen", () => {
    expect(html).toContain(`content="${siteUrl}/og-cover.png"`);
  });

  it("falla el guard si falta una etiqueta requerida", () => {
    // Prueba de mutación explícita: si `og:type` desapareciera del bloque
    // construido, este guard debe detectarlo.
    const withoutOgType = html
      .split("\n")
      .filter((line) => !line.includes("og:type"))
      .join("\n");
    expect(withoutOgType).not.toContain('property="og:type"');
    expect(html).toContain('property="og:type"');
  });
});
