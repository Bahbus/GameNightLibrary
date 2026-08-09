// @vitest-environment node

import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSetupService } from "../../service/app";
import { ServiceError } from "../../service/errors";
import type { SetupGateway } from "../../service/github";
import { sha256Base64Url } from "../../service/tokens";
import {
  SETUP_CALLBACK,
  SETUP_ORIGIN,
  SOURCE_SHA,
  setupServiceConfig
} from "../fixtures/setupService";

const verifier = "v".repeat(64);
const nonce = "n".repeat(64);

const gatewayFixture = () => {
  let issuedState = "";
  const gateway: SetupGateway = {
    authorizationUrl: vi.fn((input) => {
      issuedState = input.state;
      return `https://github.com/login/oauth/authorize?state=${encodeURIComponent(input.state)}`;
    }),
    exchangeAndVerifyUser: vi.fn(async () => ({ login: "Bahbus" })),
    getQuestionnaire: vi.fn(async () => ({
      schemaVersion: 2 as const,
      sourceSha: SOURCE_SHA,
      games: []
    })),
    submitHouseAnswers: vi.fn(async () => ({
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/Bahbus/GameNightLibrary/pull/42"
    }))
  };
  return { gateway, issuedState: () => issuedState };
};

const begin = async (app: ReturnType<typeof createSetupService>, issuedState: () => string) => {
  const response = await request(app)
    .get("/auth/github/start")
    .query({
      callback: SETUP_CALLBACK,
      code_challenge: sha256Base64Url(verifier),
      nonce_hash: sha256Base64Url(nonce)
    });
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
  expect(issuedState()).not.toBe("");
  return issuedState();
};

const exchange = (
  app: ReturnType<typeof createSetupService>,
  state: string,
  overrides: Record<string, string> = {}
) =>
  request(app)
    .post("/api/setup/exchange")
    .set("Origin", SETUP_ORIGIN)
    .send({ code: "github-code", codeVerifier: verifier, nonce, state, ...overrides });

describe("setup verification service", () => {
  it("exposes a minimal health response with hardened headers", async () => {
    const { gateway } = gatewayFixture();
    const response = await request(
      createSetupService({ config: setupServiceConfig(), gateway })
    ).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("completes signed state and PKCE verification before issuing a grant", async () => {
    const fixture = gatewayFixture();
    const app = createSetupService({ config: setupServiceConfig(), gateway: fixture.gateway });
    const state = await begin(app, fixture.issuedState);
    const response = await exchange(app, state);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      verified: true,
      login: "Bahbus"
    });
    expect(response.body.grant).toEqual(expect.any(String));
    expect(fixture.gateway.exchangeAndVerifyUser).toHaveBeenCalledWith({
      callback: SETUP_CALLBACK,
      code: "github-code",
      codeVerifier: verifier
    });

    const session = await request(app)
      .post("/api/setup/session")
      .set("Origin", SETUP_ORIGIN)
      .set("Authorization", `Bearer ${response.body.grant}`);
    expect(session.status).toBe(200);
    expect(session.body.login).toBe("Bahbus");
  });

  it("rejects unknown callbacks, origins, and mismatched PKCE values", async () => {
    const fixture = gatewayFixture();
    const app = createSetupService({ config: setupServiceConfig(), gateway: fixture.gateway });
    expect(
      (
        await request(app)
          .get("/auth/github/start")
          .query({
            callback: "https://attacker.example/callback",
            code_challenge: sha256Base64Url(verifier),
            nonce_hash: sha256Base64Url(nonce)
          })
      ).status
    ).toBe(400);

    const state = await begin(app, fixture.issuedState);
    expect((await exchange(app, state).set("Origin", "https://attacker.example")).status).toBe(403);
    expect((await exchange(app, state, { nonce: "x".repeat(64) })).status).toBe(401);
    expect(fixture.gateway.exchangeAndVerifyUser).not.toHaveBeenCalled();
  });

  it("shows collaborator rejection without issuing access", async () => {
    const fixture = gatewayFixture();
    vi.mocked(fixture.gateway.exchangeAndVerifyUser).mockRejectedValue(
      new ServiceError(
        403,
        "The signed-in GitHub account is not a repository collaborator.",
        "not_collaborator"
      )
    );
    const app = createSetupService({ config: setupServiceConfig(), gateway: fixture.gateway });
    const response = await exchange(app, await begin(app, fixture.issuedState));
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "not_collaborator",
      message: "The signed-in GitHub account is not a repository collaborator."
    });
    expect(response.body.grant).toBeUndefined();
  });

  it("never serves the questionnaire without a valid grant", async () => {
    const fixture = gatewayFixture();
    const app = createSetupService({ config: setupServiceConfig(), gateway: fixture.gateway });
    const denied = await request(app).get("/api/setup/questionnaire").set("Origin", SETUP_ORIGIN);
    expect(denied.status).toBe(401);
    expect(fixture.gateway.getQuestionnaire).not.toHaveBeenCalled();
    const tampered = await request(app)
      .get("/api/setup/questionnaire")
      .set("Origin", SETUP_ORIGIN)
      .set("Authorization", "Bearer header.payload.signature");
    expect(tampered.status).toBe(401);
    expect(fixture.gateway.getQuestionnaire).not.toHaveBeenCalled();

    const auth = await exchange(app, await begin(app, fixture.issuedState));
    const allowed = await request(app)
      .get("/api/setup/questionnaire")
      .set("Origin", SETUP_ORIGIN)
      .set("Authorization", `Bearer ${auth.body.grant}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.sourceSha).toBe(SOURCE_SHA);
  });

  it("submits only through an authenticated collaborator session", async () => {
    const fixture = gatewayFixture();
    const app = createSetupService({ config: setupServiceConfig(), gateway: fixture.gateway });
    const auth = await exchange(app, await begin(app, fixture.issuedState));
    const response = await request(app)
      .post("/api/setup/submit")
      .set("Origin", SETUP_ORIGIN)
      .set("Authorization", `Bearer ${auth.body.grant}`)
      .send({ csv: "test-csv", sourceSha: SOURCE_SHA });
    expect(response.status).toBe(201);
    expect(response.body.pullRequestUrl).toBe("https://github.com/Bahbus/GameNightLibrary/pull/42");
    expect(fixture.gateway.submitHouseAnswers).toHaveBeenCalledWith({
      csv: "test-csv",
      login: "Bahbus",
      sourceSha: SOURCE_SHA
    });
  });
});
