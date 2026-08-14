import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("runtime and tooling boundaries", () => {
  it("builds a self-contained service container without runtime package installation", async () => {
    const [dockerfile, dockerignore, packageSource] = await Promise.all([
      readFile("Dockerfile", "utf8"),
      readFile(".dockerignore", "utf8"),
      readFile("package.json", "utf8")
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["service:build"]).not.toContain("--packages=external");
    expect(packageJson.scripts["service:build"]).toContain("--format=cjs");
    expect(dockerfile.match(/^FROM node:24\.\d+\.\d+-alpine3\.\d+/gm)).toHaveLength(2);
    expect(dockerfile.match(/^RUN npm ci$/gm)).toHaveLength(1);
    expect(dockerfile).not.toContain("COPY scripts");
    expect(dockerfile).not.toContain("--omit=dev");
    expect(dockerfile).toContain("COPY --from=build --chown=node:node");
    expect(dockerignore).toContain("*\n!Dockerfile");
    expect(dockerignore).toContain("!service/**");
    expect(dockerignore).toContain("!shared/**");
  });

  it("keeps script-only parsers out of production dependencies", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("fast-xml-parser");
    expect(packageJson.dependencies).not.toHaveProperty("yaml");
    expect(packageJson.devDependencies).toHaveProperty("fast-xml-parser");
    expect(packageJson.devDependencies).toHaveProperty("yaml");
  });

  it("type-checks the service without browser libraries", async () => {
    const config = JSON.parse(await readFile("tsconfig.service.json", "utf8")) as {
      extends: string;
      compilerOptions: { lib: string[]; types: string[] };
    };

    expect(config.extends).toBe("./tsconfig.base.json");
    expect(config.compilerOptions.lib).toEqual(["ES2022"]);
    expect(config.compilerOptions.types).toEqual(["node"]);
  });

  it("keeps the pinned service image on weekly Dependabot updates", async () => {
    const config = parse(await readFile(".github/dependabot.yml", "utf8")) as {
      updates: Array<{
        "package-ecosystem": string;
        directory: string;
        ignore?: Array<{ "dependency-name": string; "update-types": string[] }>;
      }>;
    };

    expect(config.updates).toContainEqual(
      expect.objectContaining({ "package-ecosystem": "docker", directory: "/" })
    );
  });

  it("defers unsupported major toolchain upgrades without blocking current majors", async () => {
    const config = parse(await readFile(".github/dependabot.yml", "utf8")) as {
      updates: Array<{
        "package-ecosystem": string;
        ignore?: Array<{ "dependency-name": string; "update-types": string[] }>;
      }>;
    };
    const npm = config.updates.find((update) => update["package-ecosystem"] === "npm");
    const docker = config.updates.find((update) => update["package-ecosystem"] === "docker");

    expect(npm?.ignore).toContainEqual({
      "dependency-name": "typescript",
      "update-types": ["version-update:semver-major"]
    });
    expect(docker?.ignore).toContainEqual({
      "dependency-name": "node",
      "update-types": ["version-update:semver-major"]
    });
  });
});
