import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "@playwright/test";

const repository = process.env.GITHUB_REPOSITORY ?? "Bahbus/GameNightLibrary";
const repositoryName = repository.split("/").at(-1);
if (!repositoryName) throw new Error("GITHUB_REPOSITORY must include a repository name.");
const basePath = `/${repositoryName}/`;
const url = `http://127.0.0.1:4173${basePath}`;
const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, GITHUB_ACTIONS: "true" }
});
if (build.status !== 0) process.exit(build.status ?? 1);
await copyFile("tests/fixtures/catalog.lighthouse.json", "dist/catalog.json");
const server = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173", "--base", basePath],
  {
    stdio: "inherit",
    env: { ...process.env, GITHUB_ACTIONS: "true" }
  }
);
let chrome;
const temporary = await mkdtemp(join(tmpdir(), "board-game-lighthouse-"));

try {
  let serverReady = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // The preview process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!serverReady) throw new Error("The Lighthouse preview server did not become ready.");

  const catalogResponse = await fetch(new globalThis.URL("catalog.json", url));
  const contentType = catalogResponse.headers.get("content-type") ?? "";
  if (!catalogResponse.ok || !contentType.includes("application/json")) {
    throw new Error("The Lighthouse catalog fixture was not served from the Pages base path.");
  }
  const catalog = await catalogResponse.json();
  if (!catalog || !Array.isArray(catalog.games) || catalog.games.length === 0) {
    throw new Error("The Lighthouse catalog fixture must contain at least one game.");
  }

  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless", "--no-sandbox", `--user-data-dir=${temporary}`]
  });
  const result = await lighthouse(url, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
  });
  if (!result) throw new Error("Lighthouse did not produce a report.");
  await writeFile("lighthouse-report.json", result.report, "utf8");

  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([key, category]) => [key, category.score ?? 0])
  );
  for (const [category, score] of Object.entries(scores)) {
    console.log(`${category}: ${Math.round(score * 100)}`);
    const minimum = category === "best-practices" ? 1 : 0.9;
    if (score < minimum) {
      const failedAudits = result.lhr.categories[category].auditRefs
        .map(({ id }) => result.lhr.audits[id])
        .filter((audit) => audit.score === 0)
        .map((audit) => `${audit.id}: ${audit.title}`);
      for (const audit of failedAudits) console.error(`  ${audit}`);
      throw new Error(`${category} Lighthouse score is below ${Math.round(minimum * 100)}.`);
    }
  }
} finally {
  if (chrome) await chrome.kill();
  server.kill("SIGTERM");
  await rm(temporary, { recursive: true, force: true });
}
