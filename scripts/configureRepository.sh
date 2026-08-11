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

while IFS=$'\t' read -r name color description; do
  gh label create "$name" --repo "$repository" --color "$color" --description "$description" --force
done < <(jq -r '.labels[] | [.name, .color, .description] | @tsv' "$policy_file")

if gh api "repos/$repository/pages" >/dev/null 2>&1; then
  apply_policy PUT "repos/$repository/pages" '.pages'
else
  apply_policy POST "repos/$repository/pages" '.pages'
fi

apply_policy PUT "repos/$repository/actions/permissions" '.actionsPermissions'
apply_policy PUT "repos/$repository/actions/permissions/selected-actions" '.selectedActions'
apply_policy PUT "repos/$repository/actions/permissions/workflow" '.workflowPermissions'

apply_policy PUT "repos/$repository/environments/github-pages" '{deployment_branch_policy: .pagesEnvironment.deployment_branch_policy}'
pages_policies="$(gh api "repos/$repository/environments/github-pages/deployment-branch-policies")"
while IFS=$'\t' read -r name type; do
  if ! jq -e --arg name "$name" --arg type "$type" \
    '.branch_policies[] | select(.name == $name and .type == $type)' <<< "$pages_policies" >/dev/null; then
    gh api --method POST "repos/$repository/environments/github-pages/deployment-branch-policies" \
      -f name="$name" -f type="$type" >/dev/null
  fi
done < <(jq -r '.pagesBranchPolicies[] | [.name, .type] | @tsv' "$policy_file")

gh api --method PUT "repos/$repository/vulnerability-alerts" \
  -H "Accept: application/vnd.github+json" >/dev/null
gh api --method PUT "repos/$repository/automated-security-fixes" \
  -H "Accept: application/vnd.github+json" >/dev/null
gh api --method PUT "repos/$repository/private-vulnerability-reporting" \
  -H "Accept: application/vnd.github+json" >/dev/null

apply_policy PATCH "repos/$repository" '.repositoryPatch'
apply_policy PUT "repos/$repository/branches/main/protection" '.branchProtection'

echo "Configured labels, Pages, hardened Actions, security features, and main protection for $repository."
