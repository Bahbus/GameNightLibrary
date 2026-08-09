// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseServiceConfig } from "../../service/config";

const environment = {
  SETUP_ALLOWED_CALLBACKS: "https://bahbus.github.io/GameNightLibrary/",
  SETUP_ALLOWED_ORIGINS: "https://bahbus.github.io",
  SETUP_GITHUB_APP_ID: "1",
  SETUP_GITHUB_CLIENT_ID: "Iv1.test",
  SETUP_GITHUB_CLIENT_SECRET: "secret",
  SETUP_GITHUB_INSTALLATION_ID: "2",
  SETUP_GITHUB_PRIVATE_KEY:
    "-----BEGIN RSA PRIVATE KEY-----\\ntest\\n-----END RSA PRIVATE KEY-----",
  SETUP_GITHUB_REPOSITORY_ID: "3",
  SETUP_SERVICE_ISSUER: "https://setup.example.test/",
  SETUP_SIGNING_SECRET: "test-signing-secret-with-at-least-forty-three-characters-123456"
};

describe("setup service configuration", () => {
  it("parses exact origins, callbacks, and fixed repository identifiers", () => {
    const config = parseServiceConfig(environment);
    expect(config.repository).toBe("Bahbus/GameNightLibrary");
    expect(config.allowedOrigins).toEqual(new Set(["https://bahbus.github.io"]));
    expect(config.github.repositoryId).toBe(3);
    expect(config.github.privateKey).toContain("\ntest\n");
  });

  it.each(['"', "'"])("normalizes a %s-wrapped multiline private key", (quote) => {
    const config = parseServiceConfig({
      ...environment,
      SETUP_GITHUB_PRIVATE_KEY: `${quote}${environment.SETUP_GITHUB_PRIVATE_KEY}${quote}`
    });
    expect(config.github.privateKey).toBe(
      "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----"
    );
  });

  it("rejects non-HTTPS production origins and unlisted callback origins", () => {
    expect(() =>
      parseServiceConfig({ ...environment, SETUP_ALLOWED_ORIGINS: "http://example.test" })
    ).toThrow();
    expect(() =>
      parseServiceConfig({
        ...environment,
        SETUP_ALLOWED_CALLBACKS: "https://attacker.example/callback"
      })
    ).toThrow(/not allowlisted/);
  });

  it("allows loopback HTTP for local development only", () => {
    const config = parseServiceConfig({
      ...environment,
      SETUP_ALLOWED_CALLBACKS: "http://127.0.0.1:4173/",
      SETUP_ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      SETUP_SERVICE_ISSUER: "http://127.0.0.1:8787/"
    });
    expect(config.allowedOrigins.has("http://127.0.0.1:4173")).toBe(true);
  });
});
