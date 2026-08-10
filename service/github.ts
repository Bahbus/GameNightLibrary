import { App, Octokit } from "octokit";
import { z } from "zod";
import type { ServiceConfig } from "./config.js";
import { ServiceError } from "./errors.js";
import { questionnaireFromCsv, validateHouseSubmission } from "./houseSubmission.js";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1)
});

const fileContentSchema = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
  sha: z.string().regex(/^[a-f0-9]{40}$/),
  type: z.literal("file")
});

const logGitHubFailure = (message: string, error: unknown) => {
  const details =
    error instanceof Error
      ? {
          name: error.name.slice(0, 100),
          message: error.message.slice(0, 500),
          status: "status" in error && typeof error.status === "number" ? error.status : undefined
        }
      : { name: "UnknownError" };
  console.error(message, details);
};

export interface Questionnaire {
  schemaVersion: 2;
  sourceSha: string;
  games: ReturnType<typeof questionnaireFromCsv>["games"];
}

export interface SubmissionResult {
  pullRequestNumber: number;
  pullRequestUrl: string;
}

export interface SetupGateway {
  authorizationUrl(input: { callback: string; codeChallenge: string; state: string }): string;
  exchangeAndVerifyUser(input: {
    callback: string;
    code: string;
    codeVerifier: string;
  }): Promise<{ login: string }>;
  getQuestionnaire(): Promise<Questionnaire>;
  submitHouseAnswers(input: {
    csv: string;
    login: string;
    sourceSha: string;
  }): Promise<SubmissionResult>;
}

export interface GitHubGatewayDependencies {
  fetcher?: typeof fetch;
  installationOctokit?: () => Promise<Octokit>;
  revokeUserToken?: (token: string) => Promise<void>;
  userOctokit?: (token: string) => Octokit;
}

export class GitHubSetupGateway implements SetupGateway {
  private readonly app: App;
  private readonly fetcher: typeof fetch;

  constructor(
    private readonly config: ServiceConfig,
    private readonly dependencies: GitHubGatewayDependencies = {}
  ) {
    this.fetcher = dependencies.fetcher ?? fetch;
    this.app = new App({
      appId: config.github.appId,
      privateKey: config.github.privateKey,
      oauth: {
        clientId: config.github.clientId,
        clientSecret: config.github.clientSecret
      },
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    });
  }

  authorizationUrl({
    callback,
    codeChallenge,
    state
  }: {
    callback: string;
    codeChallenge: string;
    state: string;
  }) {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.config.github.clientId);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.href;
  }

  async exchangeAndVerifyUser({
    callback,
    code,
    codeVerifier
  }: {
    callback: string;
    code: string;
    codeVerifier: string;
  }) {
    const response = await this.fetcher("https://github.com/login/oauth/access_token", {
      body: JSON.stringify({
        client_id: this.config.github.clientId,
        client_secret: this.config.github.clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: callback,
        repository_id: String(this.config.github.repositoryId)
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "GameNightLibrary-setup-service"
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok)
      throw new ServiceError(401, "GitHub rejected the authorization code.", "github_oauth");
    const token = tokenResponseSchema.parse(await response.json()).access_token;

    try {
      const userOctokit = this.dependencies.userOctokit?.(token) ?? new Octokit({ auth: token });
      const [user, repository] = await Promise.all([
        userOctokit.rest.users.getAuthenticated(),
        userOctokit.rest.repos.get({ owner: this.config.owner, repo: this.config.repo })
      ]);
      if (repository.data.id !== this.config.github.repositoryId) {
        throw new ServiceError(403, "GitHub returned an unexpected repository.", "wrong_repo");
      }
      if (repository.data.permissions?.push !== true) {
        throw new ServiceError(
          403,
          "The signed-in GitHub account is not a repository collaborator.",
          "not_collaborator"
        );
      }
      return { login: user.data.login };
    } finally {
      if (this.dependencies.revokeUserToken) {
        await this.dependencies.revokeUserToken(token).catch(() => undefined);
      } else {
        await this.app.oauth.deleteToken({ token }).catch(() => undefined);
      }
    }
  }

  async getQuestionnaire(): Promise<Questionnaire> {
    const octokit = await this.installationOctokit();
    try {
      const current = await this.getHouseFile(octokit);
      return questionnaireFromCsv(current.sha, current.csv);
    } catch (error) {
      logGitHubFailure("GitHub App could not read the setup source.", error);
      throw new ServiceError(
        503,
        "GitHub could not open the setup data. Please try again later. If this continues, ask the library owner to check the GitHub connection.",
        "github_inventory_read"
      );
    }
  }

  async submitHouseAnswers({
    csv,
    login,
    sourceSha
  }: {
    csv: string;
    login: string;
    sourceSha: string;
  }): Promise<SubmissionResult> {
    const octokit = await this.installationOctokit();
    const [current, main] = await Promise.all([
      this.getHouseFile(octokit),
      octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: "heads/main"
      })
    ]);
    if (current.sha !== sourceSha) {
      throw new ServiceError(
        409,
        "The setup list changed after it was opened. Reload Setup and try again.",
        "stale_setup"
      );
    }
    let validated: ReturnType<typeof validateHouseSubmission>;
    try {
      validated = validateHouseSubmission(current.csv, csv);
    } catch (error) {
      throw new ServiceError(
        400,
        error instanceof Error ? error.message : "The house answers are invalid.",
        "invalid_answers"
      );
    }
    const branch = "inventory/house-setup";
    let branchCreated = false;
    try {
      try {
        await octokit.rest.git.createRef({
          owner: this.config.owner,
          repo: this.config.repo,
          ref: `refs/heads/${branch}`,
          sha: main.data.object.sha
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          error.status === 422
        ) {
          throw new ServiceError(
            409,
            "Another guided setup pull request or branch is already open.",
            "open_setup_request"
          );
        }
        throw error;
      }
      branchCreated = true;
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: "data/inventory.house.csv",
        branch,
        content: Buffer.from(validated.csv, "utf8").toString("base64"),
        message: "Update guided setup answers",
        sha: current.sha
      });
      const pull = await octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        base: "main",
        head: branch,
        title: "Update guided setup answers",
        body: [
          `Submitted through the collaborator-only guided Setup by @${login}.`,
          "",
          `Questionnaire source: \`${sourceSha}\`.`,
          "",
          "This pull request was created automatically but must be reviewed and merged manually."
        ].join("\n"),
        draft: false,
        maintainer_can_modify: true
      });
      return {
        pullRequestNumber: pull.data.number,
        pullRequestUrl: pull.data.html_url
      };
    } catch (error) {
      if (branchCreated) {
        await octokit.rest.git
          .deleteRef({
            owner: this.config.owner,
            repo: this.config.repo,
            ref: `heads/${branch}`
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async installationOctokit() {
    if (this.dependencies.installationOctokit) {
      return this.dependencies.installationOctokit();
    }
    try {
      return await this.app.getInstallationOctokit(this.config.github.installationId);
    } catch (error) {
      logGitHubFailure("GitHub App installation authentication failed.", error);
      throw new ServiceError(
        503,
        "GitHub could not open the setup data. Please try again later. If this continues, ask the library owner to check the GitHub connection.",
        "github_installation_auth"
      );
    }
  }

  private async getHouseFile(octokit: Octokit) {
    const response = await octokit.rest.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path: "data/inventory.house.csv",
      ref: "main"
    });
    const file = fileContentSchema.parse(response.data);
    return {
      sha: file.sha,
      csv: Buffer.from(file.content.replaceAll("\n", ""), "base64").toString("utf8")
    };
  }
}
