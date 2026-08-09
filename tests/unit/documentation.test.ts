import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

const markdownLink = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;

const localTarget = (source: string, rawTarget: string) => {
  const target = rawTarget.trim().replace(/^<|>$/g, "").split("#", 1)[0];
  if (!target || /^(?:[a-z]+:|#)/i.test(target)) return undefined;
  return normalize(join(dirname(source), decodeURIComponent(target)));
};

describe("documentation", () => {
  it("keeps every relative Markdown link and image target valid", async () => {
    const docs = (await readdir("docs"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => join("docs", name));
    const sources = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "NOTICE.md", ...docs];
    const missing: string[] = [];

    for (const source of sources) {
      const markdown = await readFile(source, "utf8");
      for (const match of markdown.matchAll(markdownLink)) {
        const target = localTarget(source, match[1]);
        if (!target) continue;
        try {
          await access(target);
        } catch {
          missing.push(`${source} -> ${target}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
