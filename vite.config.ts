import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { buildSocialTags, resolveDeployOrigin } from "./src/config/socialTags";

/**
 * Injects the Open Graph / Twitter card meta tags into the
 * `<!--social-tags-->` marker in `index.html`.
 *
 * Deliberately does NOT rely on Vite's `%VITE_X%` HTML placeholder syntax:
 * an unresolved placeholder shipping to production is worse than a missing
 * tag. `resolveSiteUrl`/`buildSocialTags` are pure and fully unit-tested in
 * `src/config/socialTags.test.ts`.
 */
function socialTagsPlugin(): Plugin {
  return {
    name: "focube-social-tags",
    transformIndexHtml(html) {
      // VERCEL_PROJECT_PRODUCTION_URL is a build-time system variable, so it
      // needs no VITE_ prefix: this hook runs in Node, not in the browser.
      const siteUrl = resolveDeployOrigin(
        process.env.VITE_SITE_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      );
      return html.replace("<!--social-tags-->", buildSocialTags(siteUrl));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    socialTagsPlugin(),
  ],
})
