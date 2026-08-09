// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SetupTokens, sha256Base64Url } from "../../service/tokens";
import { setupServiceConfig } from "../fixtures/setupService";

describe("setup service tokens", () => {
  it("signs and verifies bounded OAuth state", async () => {
    const tokens = new SetupTokens(setupServiceConfig());
    const input = {
      callback: "https://bahbus.github.io/GameNightLibrary/",
      codeChallenge: sha256Base64Url("v".repeat(64)),
      nonceHash: sha256Base64Url("n".repeat(64))
    };
    const state = await tokens.createOAuthState(input);
    await expect(tokens.verifyOAuthState(state)).resolves.toEqual(input);
    const tampered = state.split(".");
    tampered[2] = `${tampered[2][0] === "a" ? "b" : "a"}${tampered[2].slice(1)}`;
    await expect(tokens.verifyOAuthState(tampered.join("."))).rejects.toThrow();
  });

  it("issues short-lived grants bound to Setup and the verified login", async () => {
    const tokens = new SetupTokens(setupServiceConfig());
    const session = await tokens.createGrant("Bahbus");
    await expect(tokens.verifyGrant(session.grant)).resolves.toMatchObject({
      login: "Bahbus",
      expiresAt: session.expiresAt
    });
  });

  it("does not accept a grant signed for another service", async () => {
    const first = new SetupTokens(setupServiceConfig());
    const second = new SetupTokens(
      setupServiceConfig({
        signingSecret: "a-different-test-signing-secret-with-enough-randomness-123"
      })
    );
    const session = await first.createGrant("Bahbus");
    await expect(second.verifyGrant(session.grant)).rejects.toThrow();
  });
});
