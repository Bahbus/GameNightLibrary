#!/usr/bin/env bash
set -euo pipefail

repository="${1:-Bahbus/GameNightLibrary}"
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
policy_file="$script_directory/../config/repository-policy.json"

if [[ ! "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must use owner/name format." >&2
  exit 1
fi
for command_name in gh jq; do
  if ! command -v "$command_name" >/dev/null; then
    echo "$command_name is required." >&2
    exit 1
  fi
done
gh auth status -h github.com >/dev/null
jq -e . "$policy_file" >/dev/null

apply_policy() {
  local method="$1"
  local endpoint="$2"
  local selector="$3"
  jq -c "$selector" "$policy_file" | gh api --method "$method" "$endpoint" --input - >/dev/null
}

for label in \
  "inventory:add|1d76db|Add an inventory item" \
  "inventory:update|5319e7|Update an inventory item" \
  "inventory:remove|b60205|Remove an inventory item" \
  "wishlist|7c3aed|Unowned game request or wish-list candidate" \
  "approved-inventory-change|0e8a16|Maintainer-approved public suggestion" \
  "suggestion|d4c5f9|Public suggestion awaiting review" \
  "needs-info|d876e3|Request needs correction"; do
  IFS='|' read -r name color description <<< "$label"
  gh label create "$name" --repo "$repository" --color "$color" --description "$description" --force
done

if gh api "repos/$repository/pages" >/dev/null 2>&1; then
  apply_policy PUT "repos/$repository/pages" '.pages'
else
  apply_policy POST "repos/$repository/pages" '.pages'
fi

apply_policy PUT "repos/$repository/actions/permissions" '.actionsPermissions'
apply_policy PUT "repos/$repository/actions/permissions/selected-actions" '.selectedActions'
apply_policy PUT "repos/$repository/actions/permissions/workflow" '.workflowPermissions'

gh api --method PUT "repos/$repository/vulnerability-alerts" \
  -H "Accept: application/vnd.github+json" >/dev/null
gh api --method PUT "repos/$repository/automated-security-fixes" \
  -H "Accept: application/vnd.github+json" >/dev/null
gh api --method PUT "repos/$repository/private-vulnerability-reporting" \
  -H "Accept: application/vnd.github+json" >/dev/null

apply_policy PATCH "repos/$repository" '.repositoryPatch'
apply_policy PUT "repos/$repository/branches/main/protection" '.branchProtection'

echo "Configured labels, Pages, hardened Actions, security features, and main protection for $repository."
