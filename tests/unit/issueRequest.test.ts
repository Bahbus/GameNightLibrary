import { describe, expect, it } from "vitest";
import { fieldsFromIssue, requestDecision } from "../../scripts/issueRequest";

describe("library issue requests", () => {
  it("parses structured issue form headings", () => {
    const fields = fieldsFromIssue(
      "### BGG ID\n\n68448\n\n### Game name\n\n7 Wonders\n\n### Notes\n\n_No response_"
    );
    expect(fields.get("BGG ID")).toBe("68448");
    expect(fields.get("Game name")).toBe("7 Wonders");
    expect(fields.has("Notes")).toBe(false);
  });

  it.each(["OWNER", "MEMBER", "COLLABORATOR"] as const)(
    "automates a trusted %s request",
    (association) => {
      expect(requestDecision({ association, approved: false, hasRequestLabel: true })).toBe(
        "automate"
      );
    }
  );

  it("holds an unapproved public request as a suggestion", () => {
    expect(requestDecision({ association: "NONE", approved: false, hasRequestLabel: true })).toBe(
      "suggestion"
    );
  });

  it("automates an explicitly approved public request", () => {
    expect(requestDecision({ association: "NONE", approved: true, hasRequestLabel: true })).toBe(
      "automate"
    );
  });

  it("ignores unrelated issues", () => {
    expect(requestDecision({ association: "OWNER", approved: false, hasRequestLabel: false })).toBe(
      "ignore"
    );
  });
});
