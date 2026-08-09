import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildWikiPages,
  createWikiPage,
  createWikiSidebar,
  wikiPageSources,
  wikiRepositoryUrl
} from "../../scripts/wikiGeneration";

describe("Wiki generation", () => {
  it("mirrors every owned guide and adds navigation", async () => {
    const pages = await buildWikiPages(async (source) => `# ${source}\n\nBody`);

    expect([...pages.keys()]).toEqual([
      ...wikiPageSources.map((page) => page.target),
      "_Sidebar.md"
    ]);
    expect(pages.get("Home.md")).toContain("Propose changes there through a pull request");
    expect(pages.get("_Sidebar.md")).toBe(createWikiSidebar());
  });

  it("builds the complete mirror from the repository sources", async () => {
    const pages = await buildWikiPages((source) => readFile(source, "utf8"));

    expect(pages.size).toBe(wikiPageSources.length + 1);
    for (const [target, content] of pages) {
      expect(content, target).not.toMatch(/\]\((?:\.\.\/|[A-Z_]+\.md)/);
    }
  });

  it("rewrites mirrored pages to Wiki links and other files to reviewed source links", () => {
    const page = wikiPageSources.find((candidate) => candidate.source === "docs/README.md");
    expect(page).toBeDefined();

    const generated = createWikiPage(
      "# Guides\n\n[Use it](USING_THE_LIBRARY.md#find-games) and read [security](../SECURITY.md).",
      page!
    );

    expect(generated).toContain(`${wikiRepositoryUrl}/Using-the-library#find-games`);
    expect(generated).toContain(`${wikiRepositoryUrl}/Security`);
    expect(generated).not.toContain("](USING_THE_LIBRARY.md");
  });

  it("leaves external and same-page links unchanged", () => {
    const page = wikiPageSources[0];
    const generated = createWikiPage(
      "# Guides\n\n[Web](https://example.com) and [section](#section).",
      page
    );

    expect(generated).toContain("[Web](https://example.com)");
    expect(generated).toContain("[section](#section)");
  });
});
