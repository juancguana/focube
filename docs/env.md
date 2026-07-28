# Environment variables

All of these are optional. With none of them set, the app runs exactly as it
ships today: analytics is a total silent no-op and the social tags degrade to
relative URLs. Nothing below is required to build, test or run Focube.

Vite only exposes variables prefixed with `VITE_`, and it inlines them into the
client bundle at build time. **Everything here is public.** Never put a secret,
a personal API key or a server-side token in a `VITE_` variable.

Set them in `.env.local` at the repo root (git-ignored).

| Variable | Default | Effect when unset |
|---|---|---|
| `VITE_POSTHOG_KEY` | — | No analytics code runs at all |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` | Uses the default host |
| `VITE_SITE_URL` | `VERCEL_PROJECT_PRODUCTION_URL` | Relative OG image, `og:url` omitted |

## `VITE_POSTHOG_KEY`

The PostHog **project** API key (the public, client-side one — it can write
events but cannot read them).

Without it, `resolveAnalyticsConfig` returns a `null` loader, the seam goes
terminal-disabled, and `trackEvent` returns immediately: no network request,
no console output, no buffer allocation, and `posthog-js` is never imported.
That is the state the code ships and gets reviewed in, so it is also the most
heavily tested path.

## `VITE_POSTHOG_HOST`

The ingestion host. Must be `https:` — any other protocol disables analytics
entirely rather than downgrading the transport, so an env typo can never send
events over plain http.

Use `https://eu.i.posthog.com` for an EU-hosted project.

## `VITE_SITE_URL`

The canonical origin used to build absolute Open Graph and Twitter card URLs,
e.g. `https://focube.app`. Crawlers require absolute image URLs.

**On Vercel you do not need to set this.** The build falls back to
`VERCEL_PROJECT_PRODUCTION_URL`, a system variable Vercel populates with the
shortest production custom domain (or the `.vercel.app` one when there is no
custom domain). It is available at build time and is set even on preview
deployments — which is what an OG image wants: a preview should advertise the
stable production image, not a per-deployment URL that dies with the branch.

It requires **Settings → Environment Variables → "Enable access to System
Environment Variables"** to be checked, which is Vercel's default.

Set `VITE_SITE_URL` explicitly only to override that — a different canonical
domain, or a host other than Vercel. An explicit value wins; an explicit value
that fails validation falls back to the platform host rather than leaving the
page with no origin at all.

With neither available, the page emits a relative `/og-cover.png` and omits
`og:url` entirely. Crawlers then fall back to the URL they fetched as
canonical, which is better than shipping a broken absolute URL or `og:url="/"`.

## After setting the analytics keys

The PostHog path cannot be verified without a key and a deployed site. Once
both exist, confirm manually:

- Events reach the PostHog live view.
- Only the 7 taxonomy events appear — no autocapture, no pageviews.
- No `$current_url` or referrer properties (they are denylisted because the
  shared-setup query string would otherwise ride along).
- `posthog-js` loads in its own chunk, after the app is interactive.
