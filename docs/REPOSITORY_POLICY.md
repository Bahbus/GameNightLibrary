# Repository policy

`config/repository-policy.json` is the reviewable contract for the GitHub settings that protect
this repository. `scripts/configureRepository.sh` applies that contract; the separate
`scripts/auditRepository.sh` reads live settings and compares them with the same contract.

## Hardened contract

- GitHub Actions is limited to GitHub-owned actions pinned to immutable commit SHAs.
- Workflow tokens default to read-only and cannot approve pull requests. Individual trusted
  workflows request only the write permissions needed to create their reviewable branches and
  pull requests; no workflow merges automatically.
- `main` requires current `verify` and `analyze JavaScript and TypeScript` checks.
- Branch protection applies to administrators, requires resolved conversations, and prohibits
  force pushes and deletion. No approving review is required while there is one maintainer.
- GitHub Pages deploys through Actions.
- The `github-pages` environment accepts deployments only from `main`.
- Issues, Dependabot alerts and security updates, automated security fixes, private vulnerability
  reporting, secret scanning, and push protection are enabled.
- Inventory automation runs once when a collaborator opens a structured request, or when a
  maintainer explicitly approves a public request. Unrelated label changes do not retrigger it.

## Read-only audit

Authenticate GitHub CLI with access to the repository, install `jq`, then run:

```sh
npm run repository:audit -- Bahbus/GameNightLibrary
```

The audit performs only GitHub API GET requests and unauthenticated reads of the configured Setup
service health and revision endpoints. It prints one pass or mismatch per policy area, verifies the
maintenance labels and Pages deployment branch, and reports current open Dependabot, code-scanning,
and secret-scanning alert counts. It also compares the deployed Setup revision with `main`: an older
revision is acceptable only when no service runtime input has changed. Set `SETUP_SERVICE_URL` to
audit a non-default deployment. The command never prints authentication tokens or secret values. A
mismatch exits nonzero without changing GitHub or the service.

Treat a mismatch as a review prompt, not permission to overwrite the live setting. Compare the
live result, this policy, and the repository's current workflows. Update the reviewed policy first
when the intended contract has genuinely changed.

## Applying the policy

Applying policy mutates repository settings and therefore remains an explicit maintainer action:

```sh
npm run repository:configure -- Bahbus/GameNightLibrary
```

Review `config/repository-policy.json` and the script diff before running it. The command
idempotently creates the standard labels, selects the Pages workflow source, restricts its
environment to `main`, applies the Actions allowlist and token defaults, enables supported security
features, and replaces `main` branch protection with the reviewed policy. Meaningful API errors
stop the script; it does not silently ignore unexpected failures.

After applying it, rerun the read-only audit and inspect GitHub's repository settings. Do not run
the mutating command from an untrusted pull request or with credentials for a broader account than
the target repository requires.
