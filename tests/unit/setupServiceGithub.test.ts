// @vitest-environment node

import { Octokit } from "octokit";
import { describe, expect, it, vi } from "vitest";
import { houseIntakeToCsv, type HouseIntakeRow } from "../../scripts/houseIntake";
import { ServiceError } from "../../service/errors";
import { GitHubSetupGateway } from "../../service/github";
import { SOURCE_SHA, setupServiceConfig } from "../fixtures/setupService";

const row = (overrides: Partial<HouseIntakeRow> = {}): HouseIntakeRow => ({
  slug: "example-game",
  title: "Example Game",
  availability: "available",
  learned: "",
  shelf: "",
  houseRating: "",
  setupTimeRange: "",
  teachDifficulty: "",
  tableSpace: "",
  interaction: "",
  luck: "",
  downtime: "",
  modes: "",
  moods: "",
  accessibilityFlags: "",
  contentFlags: "",
  recommendationNotes: "",
  localValuesRequired: "no",
  localMinPlayers: "",
  localMaxPlayers: "",
  localMinMinutes: "",
  localMaxMinutes: "",
  localMinAge: "",
  ...overrides
});

describe("GitHub setup gateway", () => {
  it("creates a GitHub App authorization URL with exact PKCE parameters", () => {
    const gateway = new GitHubSetupGateway(setupServiceConfig());
    const url = new URL(
      gateway.authorizationUrl({
        callback: "https://bahbus.github.io/GameNightLibrary/",
        codeChallenge: "challenge",
        state: "signed-state"
      })
    );
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("client_id")).toBe("Iv1.test");
    expect(url.searchParams.get("redirect_uri")).toBe("https://bahbus.github.io/GameNightLibrary/");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("limits the user token to the repository and requires push permission", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response(JSON.stringify({ access_token: "ghu_test", token_type: "bearer" }), {
        status: 200
      });
    });
    const revokeUserToken = vi.fn(async () => undefined);
    const getAuthenticated = vi.fn(async () => ({ data: { login: "Bahbus" } }));
    const get = vi.fn(async () => ({
      data: { id: 3, permissions: { push: true } }
    }));
    const gateway = new GitHubSetupGateway(setupServiceConfig(), {
      fetcher,
      revokeUserToken,
      userOctokit: () =>
        ({ rest: { users: { getAuthenticated }, repos: { get } } }) as unknown as Octokit
    });

    await expect(
      gateway.exchangeAndVerifyUser({
        callback: "https://bahbus.github.io/GameNightLibrary/",
        code: "code",
        codeVerifier: "verifier"
      })
    ).resolves.toEqual({ login: "Bahbus" });
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(request.repository_id).toBe("3");
    expect(request.code_verifier).toBe("verifier");
    expect(revokeUserToken).toHaveBeenCalledWith("ghu_test");

    get.mockResolvedValueOnce({
      data: { id: 3, permissions: { push: false } }
    });
    await expect(
      gateway.exchangeAndVerifyUser({
        callback: "https://bahbus.github.io/GameNightLibrary/",
        code: "code",
        codeVerifier: "verifier"
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "not_collaborator"
    } satisfies Partial<ServiceError>);
  });

  it("creates exactly one fixed branch, file commit, and pull request", async () => {
    const currentCsv = houseIntakeToCsv([row()]);
    const submittedCsv = houseIntakeToCsv([row({ learned: "yes" })]);
    const getContent = vi.fn(async () => ({
      data: {
        type: "file",
        encoding: "base64",
        sha: SOURCE_SHA,
        content: Buffer.from(currentCsv).toString("base64")
      }
    }));
    const getRef = vi.fn(async () => ({ data: { object: { sha: "b".repeat(40) } } }));
    const createRef = vi.fn(async () => ({}));
    const deleteRef = vi.fn(async () => ({}));
    const createOrUpdateFileContents = vi.fn(async () => ({}));
    const createPull = vi.fn(async () => ({
      data: {
        number: 42,
        html_url: "https://github.com/Bahbus/GameNightLibrary/pull/42"
      }
    }));
    const installation = {
      rest: {
        git: { createRef, deleteRef, getRef },
        pulls: { create: createPull },
        repos: { createOrUpdateFileContents, getContent }
      }
    } as unknown as Octokit;
    const gateway = new GitHubSetupGateway(setupServiceConfig(), {
      installationOctokit: async () => installation
    });

    await expect(
      gateway.submitHouseAnswers({
        csv: submittedCsv,
        login: "Bahbus",
        sourceSha: SOURCE_SHA
      })
    ).resolves.toEqual({
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/Bahbus/GameNightLibrary/pull/42"
    });
    expect(createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "refs/heads/inventory/house-setup" })
    );
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: "inventory/house-setup",
        path: "data/inventory.house.csv",
        sha: SOURCE_SHA
      })
    );
    expect(createPull).toHaveBeenCalledWith(
      expect.objectContaining({
        base: "main",
        draft: false,
        head: "inventory/house-setup"
      })
    );
    expect(deleteRef).not.toHaveBeenCalled();

    createRef.mockRejectedValueOnce(Object.assign(new Error("Reference exists"), { status: 422 }));
    await expect(
      gateway.submitHouseAnswers({
        csv: submittedCsv,
        login: "Bahbus",
        sourceSha: SOURCE_SHA
      })
    ).rejects.toMatchObject({ status: 409, code: "open_setup_request" });
    expect(createOrUpdateFileContents).toHaveBeenCalledTimes(1);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it("turns installation-backed questionnaire failures into a safe service error", async () => {
    const installation = {
      rest: {
        repos: {
          getContent: vi.fn(async () =>
            Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 }))
          )
        }
      }
    } as unknown as Octokit;
    const gateway = new GitHubSetupGateway(setupServiceConfig(), {
      installationOctokit: async () => installation
    });

    await expect(gateway.getQuestionnaire()).rejects.toMatchObject({
      status: 503,
      code: "github_inventory_read"
    } satisfies Partial<ServiceError>);
  });

  it("cleans only its new branch when pull request creation fails", async () => {
    const csv = houseIntakeToCsv([row({ learned: "yes" })]);
    const deleteRef = vi.fn(async () => ({}));
    const installation = {
      rest: {
        git: {
          createRef: vi.fn(async () => ({})),
          deleteRef,
          getRef: vi.fn(async () => ({ data: { object: { sha: "b".repeat(40) } } }))
        },
        pulls: { create: vi.fn(async () => Promise.reject(new Error("GitHub unavailable"))) },
        repos: {
          createOrUpdateFileContents: vi.fn(async () => ({})),
          getContent: vi.fn(async () => ({
            data: {
              type: "file",
              encoding: "base64",
              sha: SOURCE_SHA,
              content: Buffer.from(houseIntakeToCsv([row()])).toString("base64")
            }
          }))
        }
      }
    } as unknown as Octokit;
    const gateway = new GitHubSetupGateway(setupServiceConfig(), {
      installationOctokit: async () => installation
    });

    await expect(
      gateway.submitHouseAnswers({ csv, login: "Bahbus", sourceSha: SOURCE_SHA })
    ).rejects.toThrow("GitHub unavailable");
    expect(deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/inventory/house-setup" })
    );
  });
});
