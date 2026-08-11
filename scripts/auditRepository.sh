#!/usr/bin/env bash
set -euo pipefail

repository="${1:-Bahbus/GameNightLibrary}"
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
policy_file="$script_directory/../config/repository-policy.json"
failures=0

if [[ ! "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must use owner/name format." >&2
  exit 1
fi
for command_name in curl gh jq; do
  if ! command -v "$command_name" >/dev/null; then
    echo "$command_name is required." >&2
    exit 1
  fi
done
gh auth status -h github.com >/dev/null
jq -e . "$policy_file" >/dev/null

check_json() {
  local label="$1"
  local endpoint="$2"
  local actual_filter="$3"
  local policy_filter="$4"
  local response actual expected
  response="$(gh api "$endpoint")"
  actual="$(jq -c "$actual_filter" <<< "$response")"
  expected="$(jq -c "$policy_filter" "$policy_file")"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS  $label"
  else
    echo "FAIL  $label" >&2
    echo "      expected: $expected" >&2
    echo "      actual:   $actual" >&2
    failures=$((failures + 1))
  fi
}

check_enabled_endpoint() {
  local label="$1"
  local endpoint="$2"
  if gh api "$endpoint" >/dev/null; then
    echo "PASS  $label"
  else
    echo "FAIL  $label" >&2
    failures=$((failures + 1))
  fi
}

count_alerts() {
  gh api --paginate --slurp "$1" | jq 'map(length) | add'
}

check_json \
  "Actions permissions" \
  "repos/$repository/actions/permissions" \
  '{enabled, allowed_actions, sha_pinning_required}' \
  '.actionsPermissions'
check_json \
  "Allowed Actions" \
  "repos/$repository/actions/permissions/selected-actions" \
  '{github_owned_allowed, verified_allowed, patterns_allowed}' \
  '.selectedActions'
check_json \
  "Workflow token defaults" \
  "repos/$repository/actions/permissions/workflow" \
  '{default_workflow_permissions, can_approve_pull_request_reviews}' \
  '.workflowPermissions'
check_json \
  "Pages deployment source" \
  "repos/$repository/pages" \
  '{build_type}' \
  '.pages'
check_json \
  "Pages environment policy" \
  "repos/$repository/environments/github-pages" \
  '{can_admins_bypass, deployment_branch_policy}' \
  '.pagesEnvironment'
check_json \
  "Pages deployment branches" \
  "repos/$repository/environments/github-pages/deployment-branch-policies" \
  '[.branch_policies[] | {name, type}] | sort_by(.name, .type)' \
  '.pagesBranchPolicies | sort_by(.name, .type)'
check_json \
  "Repository security settings" \
  "repos/$repository" \
  '{has_issues, has_wiki, security_and_analysis: {secret_scanning: {status: .security_and_analysis.secret_scanning.status}, secret_scanning_push_protection: {status: .security_and_analysis.secret_scanning_push_protection.status}}}' \
  '.repositoryPatch'
check_json \
  "Automated security fixes" \
  "repos/$repository/automated-security-fixes" \
  '{enabled, paused}' \
  '.automatedSecurityFixes'
check_json \
  "Private vulnerability reporting" \
  "repos/$repository/private-vulnerability-reporting" \
  '{enabled}' \
  '.privateVulnerabilityReporting'
check_json \
  "Main branch protection" \
  "repos/$repository/branches/main/protection" \
  '{required_status_checks: {strict: .required_status_checks.strict, contexts: (.required_status_checks.contexts | sort)}, enforce_admins: .enforce_admins.enabled, required_pull_request_reviews: {dismiss_stale_reviews: .required_pull_request_reviews.dismiss_stale_reviews, require_code_owner_reviews: .required_pull_request_reviews.require_code_owner_reviews, require_last_push_approval: .required_pull_request_reviews.require_last_push_approval, required_approving_review_count: .required_pull_request_reviews.required_approving_review_count}, restrictions, required_linear_history: .required_linear_history.enabled, allow_force_pushes: .allow_force_pushes.enabled, allow_deletions: .allow_deletions.enabled, block_creations: .block_creations.enabled, required_conversation_resolution: .required_conversation_resolution.enabled, lock_branch: .lock_branch.enabled, allow_fork_syncing: .allow_fork_syncing.enabled}' \
  '.branchProtection | .required_status_checks.contexts |= sort'

check_enabled_endpoint "Dependabot alerts" "repos/$repository/vulnerability-alerts"

labels_response="$(gh api --paginate --slurp "repos/$repository/labels?per_page=100" | jq 'add')"
actual_labels="$(jq -c --slurpfile policy "$policy_file" \
  '[.[] | select(.name as $name | $policy[0].labels | any(.name == $name)) | {name, color, description}] | sort_by(.name)' \
  <<< "$labels_response")"
expected_labels="$(jq -c '.labels | sort_by(.name)' "$policy_file")"
if [[ "$actual_labels" == "$expected_labels" ]]; then
  echo "PASS  Maintenance labels"
else
  echo "FAIL  Maintenance labels" >&2
  echo "      expected: $expected_labels" >&2
  echo "      actual:   $actual_labels" >&2
  failures=$((failures + 1))
fi

repository_response="$(gh api "repos/$repository")"
if [[ "$(jq -r '.security_and_analysis.dependabot_security_updates.status' <<< "$repository_response")" == "enabled" ]]; then
  echo "PASS  Dependabot security updates"
else
  echo "FAIL  Dependabot security updates" >&2
  failures=$((failures + 1))
fi

dependabot_alerts="$(count_alerts "repos/$repository/dependabot/alerts?state=open&per_page=100")"
code_scanning_alerts="$(count_alerts "repos/$repository/code-scanning/alerts?state=open&per_page=100")"
secret_scanning_alerts="$(count_alerts "repos/$repository/secret-scanning/alerts?state=open&per_page=100")"
echo "INFO  Open alerts: Dependabot $dependabot_alerts, code scanning $code_scanning_alerts, secret scanning $secret_scanning_alerts"

service_url="${SETUP_SERVICE_URL:-https://game-night-library-setup.vercel.app/}"
service_url="${service_url%/}"
if health_response="$(curl --connect-timeout 5 --max-time 15 --fail --silent --show-error "$service_url/healthz")" &&
  [[ "$(jq -r '.status // empty' <<< "$health_response")" == "ok" ]]; then
  echo "PASS  Setup service health"
else
  echo "FAIL  Setup service health at $service_url" >&2
  failures=$((failures + 1))
fi

if revision_response="$(curl --connect-timeout 5 --max-time 15 --fail --silent --show-error "$service_url/revision.json")"; then
  service_revision="$(jq -r '.revision // empty' <<< "$revision_response")"
else
  service_revision=""
fi
if [[ "$service_revision" =~ ^[a-f0-9]{40}$ ]]; then
  if compare_response="$(gh api "repos/$repository/compare/$service_revision...main")"; then
    compare_status="$(jq -r '.status' <<< "$compare_response")"
    service_paths='^(api/|service/|shared/csv\.ts$|shared/setup/|Dockerfile$|package(-lock)?\.json$|tsconfig(\.service)?\.json$|vercel\.json$)'
    changed_service_files="$(jq -r --arg paths "$service_paths" '.files[].filename | select(test($paths))' <<< "$compare_response")"
    compared_file_count="$(jq '.files | length' <<< "$compare_response")"
    if [[ "$compare_status" != "ahead" && "$compare_status" != "identical" ]]; then
      echo "FAIL  Setup service revision is not an ancestor of main: $service_revision ($compare_status)" >&2
      failures=$((failures + 1))
    elif [[ -n "$changed_service_files" ]]; then
      echo "FAIL  Setup service is behind service-relevant changes on main:" >&2
      sed 's/^/      /' <<< "$changed_service_files" >&2
      failures=$((failures + 1))
    elif ((compared_file_count >= 300)); then
      echo "FAIL  Setup service drift comparison reached GitHub's 300-file limit." >&2
      failures=$((failures + 1))
    else
      echo "PASS  Setup service revision covers current service inputs ($service_revision)"
    fi
  else
    echo "FAIL  Setup service revision is not available in $repository." >&2
    failures=$((failures + 1))
  fi
else
  echo "FAIL  Setup service did not report a complete deployed revision." >&2
  failures=$((failures + 1))
fi

if ((failures > 0)); then
  echo "Repository policy audit found $failures configuration mismatch(es)." >&2
  exit 1
fi
echo "Repository policy audit passed for $repository."
