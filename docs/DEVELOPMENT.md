# Development

## Requirements and local start

- Node.js 24 LTS
- npm from that Node release
- Chromium only when running the end-to-end or Lighthouse suites locally

Install the locked dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

The development build supports an empty inventory without credentials. `npm run dev` generates the
catalog first, then starts the application.

## Environment variables

| Variable                   | Where it belongs                     | Purpose                                                           |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `BGG_API_TOKEN`            | Local shell or GitHub Actions secret | Live BGG matching and trusted enrichment                          |
| `REQUIRE_BGG_ENRICHMENT=1` | Trusted production build             | Fails a non-empty BGG-linked build when enrichment is unavailable |
| `VITE_SETUP_SERVICE_URL`   | Public build configuration           | HTTPS origin of the Setup service                                 |
| `SETUP_*` variables        | Setup service secret storage         | GitHub App and service configuration                              |

Never put a GitHub token, client secret, private key, or signing secret in a `VITE_` variable. Vite
values are embedded in public browser code. See [Setup service](SETUP_SERVICE.md) for backend
configuration.

## Project map

| Path                 | Responsibility                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| `api/`               | Thin Vercel entry point for the Setup service                                   |
| `src/`               | Preact interface, filtering, scoring, roulette, Setup, and maintenance UI       |
| `scripts/`           | Inventory validation/import, BGG enrichment, catalog generation, and operations |
| `service/`           | Provider-neutral Setup verification and submission service                      |
| `data/`              | Authored inventory, wish list, matching, and house-answer records               |
| `public/`            | Stable static assets and generated local catalog inputs                         |
| `tests/unit/`        | Deterministic schema, scoring, API parsing, service, and governance tests       |
| `tests/e2e/`         | Chromium behavior, responsive layout, keyboard, and accessibility coverage      |
| `.github/workflows/` | Validation, CodeQL, request automation, and Pages deployment                    |

## Validation commands

| Command                                               | What it checks                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run check`                                       | Formatting, lint, strict TypeScript, unit tests, app build, and service build    |
| `npm run test:e2e`                                    | Desktop, wide, and phone Chromium behavior and automated accessibility           |
| `npm run lighthouse`                                  | Representative phone performance, accessibility, best practices, and SEO budgets |
| `npm run inventory:validate`                          | Canonical ownership schema and relationships                                     |
| `npm run repository:audit -- Bahbus/GameNightLibrary` | Read-only comparison of live GitHub settings to policy                           |

Run the first three before opening a code or UI pull request. Inventory-only changes should also run
the inventory validator. Pull-request CI repeats the complete check, Chromium, Lighthouse, and
CodeQL gates.

PR tests never depend on the live BGG API. Parsing, queued responses, throttling, retries, missing
games, and failure preservation use deterministic fixtures.

## Documentation and Wiki publishing

Markdown in this repository is authoritative. `npm run wiki:build` creates an ignored,
deterministic mirror in `outputs/wiki/`, adds a navigation sidebar and source notices, and rewrites
cross-guide links for the Wiki. Unit tests validate both the source links and the generated mapping.

After documentation reaches `main`, the Publish Wiki workflow replaces the Wiki contents with that
reviewed mirror. A `gollum` trigger restores the reviewed version after a direct browser edit, and a
weekly run catches other drift. GitHub creates the Wiki Git repository only after its first Home
page exists; initialize that page once before the first workflow run.

## Generated and authored files

Do not commit:

- `public/catalog.json` or `public/setup-suggestions.json`;
- `public/bgg-covers/`;
- `dist/`, `build/`, `outputs/`, coverage, Playwright, or Lighthouse output;
- local `.env` files, Vercel state, or credentials.

The Pages build retains original BGG image URLs as source metadata, downloads thumbnails into its
ephemeral artifact, and serves only local cover paths to visitors. A failed cover download uses the
application fallback and does not hotlink the source.

Authored YAML, CSV sources, application assets, and deterministic test fixtures belong in the
repository. BGG-derived catalog contents and thumbnails remain outside the MIT license; see
[NOTICE.md](../NOTICE.md).

## Pages and BGG enrichment

GitHub Pages deployment runs on changes to `main`, weekly at an off-peak minute, and manual
dispatch. The trusted build:

1. validates source records;
2. fetches BGG metadata in conservative batches with bounded backoff;
3. caches cover thumbnails into the artifact;
4. builds the Preact application under the current repository path;
5. uploads and deploys through the protected `github-pages` environment.

Generated BGG material is not committed. If required enrichment fails, the workflow fails before a
new Pages artifact replaces the existing deployment.

## Setup service development

Build and run the portable service from source:

```sh
npm run service:build
npm run service:start
```

Or use the OCI path:

```sh
docker compose up --build
```

Use `npm run service:deploy` only from a clean, current `main`. It checks the repository, deploys the
reviewed service through the pinned Vercel CLI, and verifies live health and revision responses.
The full provider configuration and security boundaries live in [Setup service](SETUP_SERVICE.md).

`tsconfig.service.json` deliberately extends the DOM-free base configuration rather than the
browser configuration. The OCI build produces a self-contained service bundle; dependencies used
only by repository enrichment and YAML/CSV tooling remain development dependencies and are not
part of the service runtime image.

## Browser and accessibility support

The application targets current evergreen browsers and requires a network connection. It is not a
PWA and does not install an offline cache. UI changes should preserve:

- keyboard operation and visible focus;
- semantic names and screen-reader status announcements;
- reduced-motion behavior;
- forced-colors compatibility;
- enlarged text spacing;
- layouts down to 320 CSS pixels and the dedicated wide-screen presentation.

Automated checks are strong regression coverage, not a substitute for every physical NVDA, JAWS,
VoiceOver, browser, and operating-system combination. Report what was actually tested in pull
requests.
