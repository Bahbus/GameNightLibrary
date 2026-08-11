import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("shared setup domain", () => {
  it("keeps the runtime service independent from scripts and browser code", async () => {
    const serviceSources = await Promise.all(
      ["service/app.ts", "service/houseSubmission.ts"].map((path) => readFile(path, "utf8"))
    );

    for (const source of serviceSources) {
      expect(source).not.toMatch(/from ["']\.\.\/(?:scripts|src)\//);
    }
  });

  it("keeps shared contracts independent from their consumers", async () => {
    const sharedSources = await Promise.all(
      [
        "shared/csv.ts",
        "shared/setup/houseIntake.ts",
        "shared/setup/houseOptions.ts",
        "shared/setup/serviceRevision.ts"
      ].map((path) => readFile(path, "utf8"))
    );

    for (const source of sharedSources) {
      expect(source).not.toMatch(/from ["'].*\/(?:scripts|service|src)\//);
    }
  });

  it("type-checks the service against only its API and shared contracts", async () => {
    const config = JSON.parse(await readFile("tsconfig.service.json", "utf8")) as {
      include: string[];
    };

    expect(config.include).toEqual(["api/index.ts", "service", "shared"]);
  });
});
