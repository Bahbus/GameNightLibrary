# Setup verification and submission service

The Setup service is the only trusted backend for the guided owner questionnaire. GitHub Pages
remains a static public site. The service verifies a GitHub collaborator, serves the questionnaire
only after verification, and creates a reviewable pull request containing the completed answers.

The implementation is provider-neutral, with a thin Vercel entry point in `api/index.ts`:

- Node.js 24 LTS and standard HTTP
- an OCI `Dockerfile`
- a Compose Specification file for local or self-hosted use
- environment variables for runtime configuration
- no database, cookies, proprietary data format, or provider SDK

The Docker and Compose paths remain supported, so moving away from Vercel does not require
changing the service or its data.

## Security and repository boundaries

Register a dedicated GitHub App and install it only on `Bahbus/GameNightLibrary`.

Repository permissions:

- **Metadata:** read-only (automatically available)
- **Contents:** read and write
- **Pull requests:** read and write

Do not grant Administration, Actions, Workflows, Issues, or merge permissions. Disable webhooks;
this service does not consume them. Keep expiring user access tokens enabled.

The service uses two different GitHub identities:

1. A short-lived GitHub App user access token proves that the signed-in user and the App both have
   write access to this repository. PKCE and signed OAuth state protect the browser flow. The
   service revokes that GitHub token immediately after verification.
2. A repository-restricted installation client reads `data/inventory.house.csv`, creates one
   fixed `inventory/house-setup` branch, commits only that file, and opens a non-draft pull request.
   The service uses Octokit's supported `getInstallationOctokit` flow so installation tokens remain
   internal and are refreshed by the SDK.

The browser receives only a service-signed Setup grant valid for 15 minutes by default. It never
receives a GitHub access token, client secret, installation token, or private key. The service
never merges or writes directly to `main`.

## Register the GitHub App

Create a GitHub App under the `Bahbus` account with:

- Homepage URL: `https://bahbus.github.io/GameNightLibrary/`
- Callback URL: `https://bahbus.github.io/GameNightLibrary/`
- Webhooks: inactive
- User authorization callback: the exact URL above
- Repository permissions: Metadata read, Contents read/write, Pull requests read/write
- Installation scope: only `Bahbus/GameNightLibrary`

Record the App ID and Client ID, generate one client secret and one private key, then install the
App on the repository. The numeric repository ID can be read without exposing a secret:

```sh
gh api repos/Bahbus/GameNightLibrary --jq .id
```

The installation ID appears in the installation URL after installing the App and can also be
queried through GitHub's App installation API once App authentication is configured.

## Configure the service

Copy `.env.service.example` to `.env.service`. This file is ignored by Git. Fill in:

- `SETUP_GITHUB_APP_ID`
- `SETUP_GITHUB_CLIENT_ID`
- `SETUP_GITHUB_CLIENT_SECRET`
- `SETUP_GITHUB_PRIVATE_KEY`
- `SETUP_GITHUB_INSTALLATION_ID`
- `SETUP_GITHUB_REPOSITORY_ID`
- `SETUP_SIGNING_SECRET` generated independently with at least 256 bits of entropy
- `SETUP_SERVICE_ISSUER`, the final HTTPS service URL

Production allowlists should remain:

```dotenv
SETUP_ALLOWED_ORIGINS=https://bahbus.github.io
SETUP_ALLOWED_CALLBACKS=https://bahbus.github.io/GameNightLibrary/
SETUP_REPOSITORY=Bahbus/GameNightLibrary
```

Never put a GitHub secret, private key, signing secret, or token in a `VITE_` variable. Vite values
are public browser configuration.

## Build and run

Local source build:

```sh
npm ci
npm run service:build
npm run service:start
```

Portable container:

```sh
docker compose up --build
```

Vercel-compatible type check:

```sh
npm run vercel:build
```

The Vercel CLI is intentionally not an application dependency. The guarded deployment command
pins its version while keeping provider tooling out of the service's production dependency tree.

The multi-stage container bundles the service and its JavaScript dependencies into one reviewed
artifact, so the runtime image contains neither package manifests nor `node_modules`. Its build
context allowlists only the package manifests, service source, and shared contracts. The container
runs as an unprivileged user with all Linux capabilities dropped, a read-only filesystem, and an
init process, and exposes port `8787`. `GET /healthz` is the only unauthenticated data endpoint.

The hosting platform must provide:

- HTTPS termination
- encrypted secret/environment storage
- a stable public URL
- request logs that do not record query strings or Authorization headers
- a writable-free container runtime (the service itself stores no files)
- outbound HTTPS access only to `github.com` and `api.github.com`

If a reverse proxy supplies the real client address, set `TRUST_PROXY_HOPS` to its exact hop count
after verifying that the proxy overwrites forwarded headers. Leave it at `0` otherwise.

## Deploy on Vercel without a repository integration

Vercel Functions can host the service on the Hobby plan without installing Vercel's GitHub App.
This keeps GitHub access limited to the dedicated, repository-scoped Game Night Library Setup App.

1. Run `npx --yes vercel@58.9.0 link` and link the checkout to the service project.
2. Store every configuration variable above in the Production environment only. Mark all values
   sensitive; at minimum, never expose `SETUP_GITHUB_CLIENT_SECRET`, `SETUP_GITHUB_PRIVATE_KEY`, or
   `SETUP_SIGNING_SECRET`.
3. Deploy from a committed checkout:

   ```sh
   npm run service:deploy
   ```

   The guarded command refuses to deploy unless the worktree is clean, the current branch is
   `main`, and its commit exactly matches `origin/main`. It runs the complete repository check,
   deploys through the pinned Vercel CLI, and then verifies both the health response and the
   deployed commit SHA. Local Vercel authentication and the ignored `.vercel/project.json` link
   remain required; no Vercel credential is added to the repository or GitHub Actions.

4. Confirm that `GET /healthz` returns `{"status":"ok"}`, `GET /revision.json` identifies the
   intended full Git commit SHA, and the root page identifies the service.

The read-only repository audit compares that revision with `main` and fails when a newer commit
changed a service runtime input. A revision can therefore be older than the latest UI or
documentation commit without producing a false drift warning. After merging service, shared Setup,
dependency, container, TypeScript-service, or Vercel configuration changes, redeploy from current
`main` and rerun `npm run repository:audit`.

The committed `vercel.json` selects the service-only build. `api/index.ts` exports the Express
application through Vercel's supported entry-point convention, while `service-static/` supplies a
small provider-neutral landing page and `.vercel/` remains ignored local provider state. Keep the
project disconnected from Git providers and deploy only reviewed commits from a trusted checkout
so untrusted pull requests cannot execute a build with secrets.

## Activate GitHub Pages

After deploying the service:

1. Set the repository Actions variable `SETUP_SERVICE_URL` to the public HTTPS service URL,
   including a trailing slash.
2. Confirm the GitHub App callback remains exactly
   `https://bahbus.github.io/GameNightLibrary/`.
3. Manually dispatch the Pages deployment.
4. Verify that an unauthenticated visitor sees only the locked Setup screen.
5. Verify that a non-collaborator receives the rejection screen.
6. Verify that a collaborator can complete Setup and receives a pull-request link.
7. Review and merge that pull request manually.
8. Confirm the next Pages build hides Setup because all required house answers are complete.
9. Confirm GitHub deletes `inventory/house-setup` after merge, or delete that merged branch through
   GitHub before starting another Setup submission.

If verification succeeds but the questionnaire cannot open, check the function logs for either
`GitHub App installation authentication failed` or `GitHub App could not read the setup source`.
The first indicates an App ID, installation ID, or private-key problem. The second indicates
repository access, file permissions, or a missing `data/inventory.house.csv`. The browser receives
only the corresponding safe recovery message.

The Pages build adds only the configured service origin to `connect-src`. If the repository
variable is absent or invalid, Setup fails closed and the public site does not allow the
cross-origin API connection.

## Submission validation

Before creating a branch, the service:

- requires a valid, unexpired Setup grant and an exact allowed browser origin
- limits request sizes and request rates
- confirms the questionnaire's Git blob SHA still matches `main`
- parses and validates the complete CSV
- requires the exact current row set and restores canonical source order before committing
- prevents changes to slug, title, and local-only identity fields
- requires learned state and all filter values for local-only games
- validates ratings, modes, numeric values, and min/max ranges
- rejects overlong text and spreadsheet-formula prefixes
- atomically refuses to create `inventory/house-setup` while another guided setup branch or pull
  request is still present

If PR creation fails after the service creates its branch, it makes a best-effort deletion of only
that newly created branch.
