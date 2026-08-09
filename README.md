# Game Night Library

A public, GitHub-backed board game inventory that helps groups find a game by player count,
time, complexity, mood, mechanics, accessibility needs, and house preferences. When several
games fit, a transparent weighted roulette makes the final choice.

The intended site is `https://bahbus.github.io/BoardGameInventory/`.

## How it works

- `data/inventory.yaml` is the canonical ownership record.
- `data/wishlist.yaml` is the canonical list of unowned games under consideration. Wish-list
  entries are visible but never participate in library filters or roulette.
- Games absent from BGG use a stable slug, public source URL, and complete local player/time/age
  values. The application never invents a BGG ID.
- BoardGameGeek metadata is fetched only in trusted GitHub Actions builds and is packaged into
  the Pages artifact; it is not committed.
- The browser performs filtering, scoring, and roulette draws locally.
- Catalog maintenance forms prefill GitHub Issues. Authorized requests can produce reviewable
  pull requests, but nothing merges automatically.
- The Wish list view links to a public game-request Issue Form. Maintainers can research the
  suggestion and add it to the portable YAML list through normal review.

## Local development

Requires the Node.js 24 LTS release line.

```sh
npm install
npm run dev
```

An empty inventory builds without credentials. A production deployment containing BGG-linked items requires an
approved BoardGameGeek application token in `BGG_API_TOKEN`.

Useful checks:

```sh
npm run check
npm run test:e2e
npm run lighthouse
npm run inventory:validate
```

## Import the initial collection

The resolved, pre-match ownership list lives in `data/inventory.intake.csv`. It is a UTF-8,
plain-text review artifact containing the submitted wording, normalized title, ownership detail,
parent relationship, notes, and source links. It intentionally remains separate from the
canonical import format until BGG IDs have been matched and verified.

Prepare the deterministic matching manifest without network access:

```sh
npm run inventory:prepare
```

This writes `data/inventory.matching.csv`, assigning stable slugs and parent slugs, extracting
IDs only from direct BGG item links, preserving local-only sources, and flagging shared IDs for
manual review. The manifest also records quantity and whether an expansion is independently
playable; review those authored values before finalization. The pre-token reconciliation identifies
78 of 81 ownership rows from direct BGG item links. Buzzed Tower remains a local-only game, while
Unsettled's bundled Wenora and Grakkis planet modules use the publisher's product page and inherit
the Framework's metadata because BGG does not list them separately. Generate a candidate report
without modifying the manifest or canonical inventory:

```sh
BGG_API_TOKEN=... npm run inventory:match
```

The live matcher suggests exact and near matches in `outputs/inventory-match-report.csv`; it
never accepts a candidate automatically.

House-specific information can be collected independently of BGG. The intended owner workflow
is the site's **Setup** screen. Setup remains completely locked until the separate GitHub
verification service confirms that the signed-in account is a repository collaborator. Once
verified, it presents games alphabetically, saves progress automatically in that browser, supports
an open CSV download, and submits completed answers to a new branch and pull request. It never
writes to `main` or merges automatically. The public Setup tab is included only while a required
house answer is incomplete; merging the completed Setup pull request hides it on the next Pages
build, and adding a new incomplete game brings it back.

Regenerate the browser questionnaire after changing the matching manifest:

```sh
npm run inventory:prepare-house
npm run house-editor:build
```

The first command creates the version-controlled `data/inventory.house.csv` source with one row
per selectable game. The second validates that source and creates a local inspection artifact in
`outputs/house-intake.json`; it is never packaged in the public GitHub Pages artifact. The live
service reads the current file from `main`, ties the questionnaire to its Git blob SHA, and
rejects stale submissions. Setup collects learned state, shelf label, ratings, setup and teaching
burden, table space, interaction, luck, downtime, moods, accessibility, content, and recommendation
notes. Game Night Library cautiously infers competitive, cooperative, team, and solo support from
BGG mechanics and player counts; BGG does not supply those mode labels. A non-empty authored mode
list is a full house override when an inference needs correcting. Local-only games ask for modes as
well as player-count, duration, and minimum-age answers so they remain fully filterable.

### Finalize the canonical inventory

The matching manifest and guided Setup answers remain reviewable source records. They do not
change `data/inventory.yaml` automatically. After Setup is complete, validate the complete
conversion without writing anything:

```sh
npm run inventory:finalize:check
```

Inspect the exact deterministic YAML on standard output if desired:

```sh
npm run inventory:finalize:preview
```

Only after reviewing both inputs and the preview, replace the canonical inventory explicitly:

```sh
npm run inventory:finalize
npm run inventory:validate
```

Finalization rejects unresolved or duplicate identities, mismatched Setup rows, incomplete local
metadata, invalid parent relationships, quantities, modes, enumerations, and ranges. BGG-linked
games keep authored modes blank unless the house intentionally overrides BGG. Owned expansions
inherit their base game's shelf, availability, and learned state during the initial conversion.
Non-standalone local expansions may inherit base metadata; a local standalone item must instead be
modeled as a selectable base game so Setup can collect complete filter values.

The write is validation-first and atomic: a failure leaves the existing `data/inventory.yaml`
untouched. Correct the reported row in the matching or house CSV and rerun the check. Trusted
production deployments require the repository's `BGG_API_TOKEN` Actions secret when the collection
contains BGG-linked games.

Set the public service URL at build time using `VITE_SETUP_SERVICE_URL`. If it is absent or
invalid, the site fails closed and explains that verification is unavailable. Never place a
GitHub token, OAuth secret, or GitHub App private key in a `VITE_` variable; those values are
embedded in the public browser build.

The verification/submission service is a portable Node application with an OCI `Dockerfile`,
Compose configuration, and a thin Netlify Functions adapter. See
[Setup service deployment](docs/SETUP_SERVICE.md) for the GitHub App permissions, secrets, local
verification, Netlify deployment, provider-neutral deployment contract, and production activation
steps.

Reviewed Setup-service releases use `npm run service:deploy`. The command deploys only a clean,
current `main`, runs the repository checks first, and verifies the live `/healthz` and
`/revision.json` responses afterward so the independently hosted service cannot silently drift
behind the repository.

Copy `data/inventory.example.csv`, replace the sample rows, then run:

```sh
npm run inventory:import -- path/to/inventory.csv
```

The importer checks every row before replacing `data/inventory.yaml`. Multi-value cells use
semicolons. Expansions use `kind=expansion` and identify an imported base game through
`parent_slug` (preferred) or `parent_bgg_id`. A row without `bgg_id` must provide `source_url`
and every `override_*` player/time/age field so it remains fully filterable.

## Wish list and game requests

Unowned games live separately in `data/wishlist.yaml`. Each entry has a stable slug, a BGG ID or
public source URL, a status (`interested`, `researching`, or `planned`), and optional priority and
notes. The build validates duplicate identities and rejects a wish-list game that is already in
owned inventory.

Visitors can use the site's **Wish list** view to browse or search candidates and open a public
GitHub game request. Requests use the `wishlist` label and remain suggestions until a maintainer
adds a reviewed entry to the YAML file. Moving a purchased game into `data/inventory.yaml` makes
it eligible for filters and roulette; the build requires removing the matching wish-list entry.

## GitHub setup

1. Create the public `Bahbus/BoardGameInventory` repository and push `main`.
2. Register a noncommercial application at BoardGameGeek and add its token as the Actions
   secret `BGG_API_TOKEN`.
3. Install GitHub CLI and `jq`, authenticate to the repository, and review
   `config/repository-policy.json`.
4. Explicitly apply the reviewed policy with
   `npm run repository:configure -- Bahbus/BoardGameInventory`.
5. Confirm the result without mutation using
   `npm run repository:audit -- Bahbus/BoardGameInventory`.

The policy restricts Actions to SHA-pinned GitHub-owned actions, keeps workflow tokens read-only by
default, prevents Actions from approving pull requests, requires validation and CodeQL on `main`,
enforces protection for administrators, and enables the available public-repository security
features. Trusted workflows request their branch and pull-request permissions explicitly but never
merge automatically. The configuration command is an intentional mutating maintainer operation;
the audit uses only read requests and exits nonzero on drift. See
[Repository policy](docs/REPOSITORY_POLICY.md) for the complete contract, recovery guidance, and
commands.

## Public-data rule

Every inventory value is public. Shelf locations must be labels such as `Basement A3`, never
addresses, access instructions, contact details, or other private information.

## Browser support

Current evergreen browsers are supported. The application is responsive and online-only; it
does not install as a PWA or provide an offline cache.

## Attribution

BoardGameGeek data is used under the [BGG XML API terms](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use).
Public builds display BGG's official linked “Powered by BGG” mark and link every enriched game back
to its source. Builds retain the original image URLs as source metadata, cache thumbnails into the
ephemeral Pages artifact, and never ask a visitor's browser to hotlink BGG or GeekDo images. Game
modes and match scores are Game Night Library inferences; they are labeled accordingly and are not
presented as BGG ratings or recommendations.
