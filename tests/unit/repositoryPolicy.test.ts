import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const loadPolicy = async () =>
  JSON.parse(await readFile("config/repository-policy.json", "utf8")) as Record<string, unknown>;

describe("repository governance policy", () => {
  it("keeps Actions least-privilege and SHA-pinned", async () => {
    const policy = await loadPolicy();
    expect(policy.actionsPermissions).toEqual({
      enabled: true,
      allowed_actions: "selected",
      sha_pinning_required: true
    });
    expect(policy.selectedActions).toEqual({
      github_owned_allowed: true,
      verified_allowed: false,
      patterns_allowed: []
    });
    expect(policy.workflowPermissions).toEqual({
      default_workflow_permissions: "read",
      can_approve_pull_request_reviews: false
    });
  });

  it("requires validation and CodeQL without a sole-maintainer review", async () => {
    const policy = await loadPolicy();
    expect(policy.branchProtection).toMatchObject({
      required_status_checks: {
        strict: true,
        contexts: ["analyze JavaScript and TypeScript", "verify"]
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        required_approving_review_count: 0
      },
      allow_force_pushes: false,
      allow_deletions: false,
      required_conversation_resolution: true,
      allow_fork_syncing: false
    });
  });

  it("uses the shared policy for mutation and keeps the audit read-only", async () => {
    const configure = await readFile("scripts/configureRepository.sh", "utf8");
    const audit = await readFile("scripts/auditRepository.sh", "utf8");

    for (const selector of [
      ".actionsPermissions",
      ".selectedActions",
      ".workflowPermissions",
      ".pages",
      ".repositoryPatch",
      ".branchProtection"
    ]) {
      expect(configure).toContain(selector);
    }
    expect(configure).not.toContain("allowed_actions=all");
    expect(configure).not.toContain("can_approve_pull_request_reviews=true");
    expect(audit).not.toContain("--method");
    expect(audit).not.toContain("gh label");
    expect(audit).toContain("Repository policy audit passed");
  });

  it("publishes only reviewed documentation to the Wiki with pinned Actions", async () => {
    const workflow = await readFile(".github/workflows/wiki.yml", "utf8");

    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("gollum:");
    expect(workflow).toContain("permissions:\n  contents: write");
    expect(workflow).toContain("npm run wiki:build");
    expect(workflow).toContain('git -C "$wiki_directory" rm -r --ignore-unmatch -- .');
    expect(workflow).not.toMatch(/uses:\s+[^\s@]+@(?![a-f0-9]{40}\b)/);
  });

  it("does not rebuild Pages for documentation-only commits", async () => {
    const workflow = parse(await readFile(".github/workflows/deploy.yml", "utf8")) as {
      on: {
        push: { branches: string[]; "paths-ignore": string[] };
        schedule: Array<{ cron: string }>;
        workflow_dispatch: null;
      };
    };

    expect(workflow.on.push).toEqual({
      branches: ["main"],
      "paths-ignore": ["**/*.md", "LICENSE"]
    });
    expect(workflow.on.schedule).toEqual([{ cron: "17 10 * * 3" }]);
    expect(workflow.on.workflow_dispatch).toBeNull();
  });
});
