import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();
const repositoryName = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const httpsUrl = z
  .string()
  .url()
  .transform((value, context) => {
    const url = new URL(value);
    const localHttp =
      url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (url.protocol !== "https:" && !localHttp) {
      context.addIssue({ code: "custom", message: "must use HTTPS outside local development" });
      return z.NEVER;
    }
    if (url.username || url.password || url.hash || url.search) {
      context.addIssue({
        code: "custom",
        message: "must not include credentials, queries, or fragments"
      });
      return z.NEVER;
    }
    return url.href;
  });

const environmentSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  SETUP_ALLOWED_CALLBACKS: z.string().min(1),
  SETUP_ALLOWED_ORIGINS: z.string().min(1),
  SETUP_GITHUB_APP_ID: positiveInteger,
  SETUP_GITHUB_CLIENT_ID: z.string().min(1),
  SETUP_GITHUB_CLIENT_SECRET: z.string().min(1),
  SETUP_GITHUB_INSTALLATION_ID: positiveInteger,
  SETUP_GITHUB_PRIVATE_KEY: z.string().includes("PRIVATE KEY"),
  SETUP_GITHUB_REPOSITORY_ID: positiveInteger,
  SETUP_GRANT_TTL_SECONDS: z.coerce.number().int().min(300).max(3_600).default(900),
  SETUP_OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  SETUP_REPOSITORY: repositoryName.default("Bahbus/GameNightLibrary"),
  SETUP_SERVICE_ISSUER: httpsUrl,
  SETUP_SIGNING_SECRET: z.string().min(43),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0)
});

const splitList = (value: string) => [
  ...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )
];

const normalizePrivateKey = (value: string) => {
  let normalized = value.trim();
  const surroundingQuote = normalized.at(0);
  if (
    (surroundingQuote === '"' || surroundingQuote === "'") &&
    normalized.at(-1) === surroundingQuote
  ) {
    normalized = normalized.slice(1, -1);
  }
  return normalized
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\r\n", "\n")
    .trim();
};

export interface ServiceConfig {
  host: string;
  port: number;
  allowedCallbacks: Set<string>;
  allowedOrigins: Set<string>;
  github: {
    appId: number;
    clientId: string;
    clientSecret: string;
    installationId: number;
    privateKey: string;
    repositoryId: number;
  };
  grantTtlSeconds: number;
  oauthStateTtlSeconds: number;
  owner: string;
  repo: string;
  repository: string;
  serviceIssuer: string;
  signingSecret: string;
  trustProxyHops: number;
}

export function parseServiceConfig(environment: Record<string, string | undefined>): ServiceConfig {
  const parsed = environmentSchema.parse(environment);
  const allowedCallbacks = new Set(
    splitList(parsed.SETUP_ALLOWED_CALLBACKS).map((value) => httpsUrl.parse(value))
  );
  const allowedOrigins = new Set(
    splitList(parsed.SETUP_ALLOWED_ORIGINS).map((value) => new URL(httpsUrl.parse(value)).origin)
  );
  if (!allowedCallbacks.size || !allowedOrigins.size) {
    throw new Error("At least one callback and origin must be configured.");
  }
  for (const callback of allowedCallbacks) {
    if (!allowedOrigins.has(new URL(callback).origin)) {
      throw new Error(`Callback origin is not allowlisted: ${callback}`);
    }
  }
  const [owner, repo] = parsed.SETUP_REPOSITORY.split("/");
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    allowedCallbacks,
    allowedOrigins,
    github: {
      appId: parsed.SETUP_GITHUB_APP_ID,
      clientId: parsed.SETUP_GITHUB_CLIENT_ID,
      clientSecret: parsed.SETUP_GITHUB_CLIENT_SECRET,
      installationId: parsed.SETUP_GITHUB_INSTALLATION_ID,
      privateKey: normalizePrivateKey(parsed.SETUP_GITHUB_PRIVATE_KEY),
      repositoryId: parsed.SETUP_GITHUB_REPOSITORY_ID
    },
    grantTtlSeconds: parsed.SETUP_GRANT_TTL_SECONDS,
    oauthStateTtlSeconds: parsed.SETUP_OAUTH_STATE_TTL_SECONDS,
    owner,
    repo,
    repository: parsed.SETUP_REPOSITORY,
    serviceIssuer: parsed.SETUP_SERVICE_ISSUER,
    signingSecret: parsed.SETUP_SIGNING_SECRET,
    trustProxyHops: parsed.TRUST_PROXY_HOPS
  };
}
