import { describe, expect, it } from "vitest";
import {
  pagesBasePath,
  pagesProjectUrl,
  parseGitHubRepository,
  repositoryUrl,
  TARGET_REPOSITORY
} from "../../src/lib/projectIdentity";

describe("project identity", () => {
  it("uses the chosen Game Night Library repository identity", () => {
    expect(TARGET_REPOSITORY).toBe("Bahbus/GameNightLibrary");
    expect(repositoryUrl(TARGET_REPOSITORY)).toBe("https://github.com/Bahbus/GameNightLibrary");
    expect(pagesBasePath(TARGET_REPOSITORY)).toBe("/GameNightLibrary/");
    expect(pagesProjectUrl(TARGET_REPOSITORY)).toBe("https://bahbus.github.io/GameNightLibrary/");
  });

  it("accepts GitHub's current repository identity and rejects malformed values", () => {
    expect(parseGitHubRepository("Bahbus/BoardGameInventory")).toEqual({
      owner: "Bahbus",
      name: "BoardGameInventory",
      fullName: "Bahbus/BoardGameInventory"
    });
    expect(parseGitHubRepository("missing-owner")).toBeUndefined();
    expect(parseGitHubRepository("owner/repo/extra")).toBeUndefined();
  });
});
