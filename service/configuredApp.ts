import { createSetupService } from "./app.js";
import { parseServiceConfig } from "./config.js";
import { GitHubSetupGateway } from "./github.js";

export function createConfiguredSetupService(
  environment: Record<string, string | undefined> = process.env
) {
  const config = parseServiceConfig(environment);
  return {
    app: createSetupService({
      config,
      gateway: new GitHubSetupGateway(config),
      revision: environment.SETUP_SERVICE_REVISION ?? environment.VERCEL_GIT_COMMIT_SHA
    }),
    config
  };
}
