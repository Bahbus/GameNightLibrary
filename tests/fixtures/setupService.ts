import type { ServiceConfig } from "../../service/config";

export const SETUP_ORIGIN = "https://bahbus.github.io";
export const SETUP_CALLBACK = "https://bahbus.github.io/GameNightLibrary/";
export const SOURCE_SHA = "a".repeat(40);

export const setupServiceConfig = (overrides: Partial<ServiceConfig> = {}): ServiceConfig => ({
  host: "127.0.0.1",
  port: 8787,
  allowedCallbacks: new Set([SETUP_CALLBACK]),
  allowedOrigins: new Set([SETUP_ORIGIN]),
  github: {
    appId: 1,
    clientId: "Iv1.test",
    clientSecret: "not-a-real-secret",
    installationId: 2,
    privateKey: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
    repositoryId: 3
  },
  grantTtlSeconds: 900,
  oauthStateTtlSeconds: 600,
  owner: "Bahbus",
  repo: "GameNightLibrary",
  repository: "Bahbus/GameNightLibrary",
  serviceIssuer: "https://setup.example.test/",
  signingSecret: "test-signing-secret-with-at-least-forty-three-characters-123456",
  trustProxyHops: 0,
  ...overrides
});
