import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createServiceRevision } from "./serviceRevision";

const NETLIFY_CLI_VERSION = "27.0.1";
const DEFAULT_SERVICE_URL = "https://board-game-inventory-setup.netlify.app/";
const stateSchema = z.object({ siteId: z.string().uuid() });
const deploySchema = z.object({ url: z.string().url().optional() }).passthrough();

const git = (...arguments_: string[]) =>
  execFileSync("git", arguments_, { encoding: "utf8" }).trim();

const run = (command: string, arguments_: string[], environment = process.env) => {
  const result = spawnSync(command, arguments_, { env: environment, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const waitForDeployment = async (serviceUrl: URL, revision: string) => {
  let lastError = "The deployed service did not respond.";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const [healthResponse, revisionResponse] = await Promise.all([
        fetch(new URL("healthz", serviceUrl), { cache: "no-store" }),
        fetch(new URL(`revision.json?revision=${revision}`, serviceUrl), { cache: "no-store" })
      ]);
      if (!healthResponse.ok || !revisionResponse.ok) {
        lastError = `Health returned ${healthResponse.status}; revision returned ${revisionResponse.status}.`;
      } else {
        const health = z.object({ status: z.literal("ok") }).parse(await healthResponse.json());
        const deployed = createServiceRevision(
          z.object({ revision: z.string() }).parse(await revisionResponse.json()).revision
        );
        if (health.status === "ok" && deployed.revision === revision) return;
        lastError = `Expected revision ${revision}, received ${deployed.revision}.`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_500));
  }
  throw new Error(`Setup service verification failed: ${lastError}`);
};

if (git("branch", "--show-current") !== "main") {
  throw new Error("Setup service deployments must run from main.");
}
if (git("status", "--porcelain")) {
  throw new Error("Setup service deployments require a clean working tree.");
}

run("git", ["fetch", "origin", "main", "--quiet"]);
const revision = createServiceRevision(git("rev-parse", "HEAD")).revision;
const remoteRevision = createServiceRevision(git("rev-parse", "origin/main")).revision;
if (revision !== remoteRevision) {
  throw new Error("Local main must exactly match origin/main before deploying the Setup service.");
}

const { siteId } = stateSchema.parse(
  JSON.parse(await readFile(".netlify/state.json", "utf8")) as unknown
);
run("npm", ["run", "check"]);

const deploy = spawnSync(
  "npx",
  [
    "--yes",
    `netlify-cli@${NETLIFY_CLI_VERSION}`,
    "deploy",
    "--build",
    "--prod",
    "--context",
    "production",
    "--site",
    siteId,
    "--message",
    `GameNightLibrary ${revision.slice(0, 12)}`,
    "--json"
  ],
  {
    encoding: "utf8",
    env: { ...process.env, SETUP_SERVICE_REVISION: revision }
  }
);
if (deploy.status !== 0) {
  if (deploy.stderr) process.stderr.write(deploy.stderr);
  process.exit(deploy.status ?? 1);
}
if (deploy.stderr) process.stdout.write(deploy.stderr);
const deployment = deploySchema.parse(JSON.parse(deploy.stdout ?? "") as unknown);
const serviceUrl = new URL(process.env.SETUP_SERVICE_URL ?? deployment.url ?? DEFAULT_SERVICE_URL);
await waitForDeployment(serviceUrl, revision);
console.log(`Setup service ${revision.slice(0, 12)} is live at ${serviceUrl.href}`);
