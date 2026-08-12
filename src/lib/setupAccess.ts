import {
  BROWSER_STORAGE_KEYS,
  readBrowserValue,
  removeBrowserValue,
  writeBrowserValue,
  type StorageReader,
  type StorageRemover,
  type StorageWriter
} from "./browserStorage";

const SESSION_KEY = BROWSER_STORAGE_KEYS.setupAccess;
const NONCE_KEY = BROWSER_STORAGE_KEYS.setupAuthNonce;
const VERIFIER_KEY = BROWSER_STORAGE_KEYS.setupAuthVerifier;

export interface SetupAccessSession {
  grant: string;
  login: string;
  expiresAt: string;
}

export interface VerifiedSetupAccess {
  login: string;
  expiresAt: string;
}

export interface SetupSubmission {
  pullRequestNumber: number;
  pullRequestUrl: string;
}

export class SetupVerificationError extends Error {
  constructor() {
    super("GitHub collaborator verification is no longer valid.");
    this.name = "SetupVerificationError";
  }
}

const isLocalHttp = (url: URL) =>
  url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");

export const parseSetupServiceUrl = (value: string | undefined): URL | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.username || url.password || (url.protocol !== "https:" && !isLocalHttp(url))) {
      return undefined;
    }
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  } catch {
    return undefined;
  }
};

export const readSetupAccessSession = (
  storage?: StorageReader & StorageRemover
): SetupAccessSession | undefined => {
  try {
    const value = JSON.parse(
      readBrowserValue("session", SESSION_KEY, storage) ?? "null"
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      removeBrowserValue("session", SESSION_KEY, storage);
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.grant !== "string" ||
      !candidate.grant ||
      typeof candidate.login !== "string" ||
      !candidate.login ||
      typeof candidate.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.expiresAt))
    ) {
      removeBrowserValue("session", SESSION_KEY, storage);
      return undefined;
    }
    return {
      grant: candidate.grant,
      login: candidate.login,
      expiresAt: candidate.expiresAt
    };
  } catch {
    removeBrowserValue("session", SESSION_KEY, storage);
    return undefined;
  }
};

export const storeSetupAccessSession = (session: SetupAccessSession, storage?: StorageWriter) =>
  writeBrowserValue("session", SESSION_KEY, JSON.stringify(session), storage);

export const clearSetupAccessSession = (storage?: StorageRemover) =>
  void removeBrowserValue("session", SESSION_KEY, storage);

const parseAccessResponse = (value: unknown): VerifiedSetupAccess => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GitHub returned an invalid verification response.");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.verified !== true ||
    typeof candidate.login !== "string" ||
    !candidate.login ||
    typeof candidate.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.expiresAt))
  ) {
    throw new Error("GitHub could not confirm collaborator access.");
  }
  return { login: candidate.login, expiresAt: candidate.expiresAt };
};

export const verifySetupAccess = async (
  serviceUrl: URL,
  session: SetupAccessSession,
  fetcher: typeof fetch = fetch
): Promise<VerifiedSetupAccess> => {
  const response = await fetcher(new URL("api/setup/session", serviceUrl), {
    headers: { authorization: `Bearer ${session.grant}` },
    method: "POST"
  });
  if (!response.ok) throw new Error("GitHub could not confirm collaborator access.");
  return parseAccessResponse(await response.json());
};

export const exchangeSetupCode = async (
  serviceUrl: URL,
  code: string,
  state: string,
  nonce: string,
  codeVerifier: string,
  fetcher: typeof fetch = fetch
): Promise<SetupAccessSession> => {
  const response = await fetcher(new URL("api/setup/exchange", serviceUrl), {
    body: JSON.stringify({ code, state, nonce, codeVerifier }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok)
    throw new Error("GitHub verification failed or this account is not a collaborator.");
  const value = (await response.json()) as Record<string, unknown>;
  const verified = parseAccessResponse(value);
  if (typeof value.grant !== "string" || !value.grant) {
    throw new Error("GitHub returned an invalid verification response.");
  }
  return { grant: value.grant, ...verified };
};

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const randomValue = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64Url(bytes);
};

const sha256 = async (value: string) =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

export const beginSetupVerification = async (
  serviceUrl: URL,
  location: { assign(url: string): void; origin: string; pathname: string } = window.location,
  storage?: StorageWriter & StorageRemover
) => {
  const nonce = randomValue(32);
  const codeVerifier = randomValue(64);
  try {
    writeBrowserValue("session", NONCE_KEY, nonce, storage);
    writeBrowserValue("session", VERIFIER_KEY, codeVerifier, storage);
  } catch (cause) {
    removeBrowserValue("session", NONCE_KEY, storage);
    removeBrowserValue("session", VERIFIER_KEY, storage);
    throw cause;
  }
  const startUrl = new URL("auth/github/start", serviceUrl);
  startUrl.searchParams.set("callback", `${location.origin}${location.pathname}`);
  startUrl.searchParams.set("nonce_hash", await sha256(nonce));
  startUrl.searchParams.set("code_challenge", await sha256(codeVerifier));
  location.assign(startUrl.href);
};

export const takeSetupAuthValues = (storage?: StorageReader & StorageRemover) => {
  const nonce = readBrowserValue("session", NONCE_KEY, storage);
  const codeVerifier = readBrowserValue("session", VERIFIER_KEY, storage);
  removeBrowserValue("session", NONCE_KEY, storage);
  removeBrowserValue("session", VERIFIER_KEY, storage);
  return nonce && codeVerifier ? { nonce, codeVerifier } : undefined;
};

export const removeSetupAuthQuery = (
  location: { href: string } = window.location,
  history: {
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
  } = window.history
) => {
  const url = new URL(location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

export const submitHouseAnswers = async (
  serviceUrl: URL,
  grant: string,
  csv: string,
  sourceSha: string,
  fetcher: typeof fetch = fetch
): Promise<SetupSubmission> => {
  const response = await fetcher(new URL("api/setup/submit", serviceUrl), {
    body: JSON.stringify({ csv, sourceSha }),
    headers: {
      authorization: `Bearer ${grant}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  const value = (await response.json().catch(() => undefined)) as
    Record<string, unknown> | undefined;
  if (response.status === 401 || response.status === 403) {
    throw new SetupVerificationError();
  }
  if (!response.ok) {
    const message =
      typeof value?.message === "string" && value.message.length <= 500
        ? value.message
        : "The setup answers could not be submitted.";
    throw new Error(message);
  }
  if (
    typeof value?.pullRequestNumber !== "number" ||
    !Number.isInteger(value.pullRequestNumber) ||
    typeof value.pullRequestUrl !== "string"
  ) {
    throw new Error("GitHub returned an invalid pull request response.");
  }
  const url = new URL(value.pullRequestUrl);
  const expectedRepositoryPath = new URL(__GITHUB_REPOSITORY_URL__).pathname.replace(/\/$/, "");
  if (
    url.origin !== "https://github.com" ||
    url.pathname !== `${expectedRepositoryPath}/pull/${value.pullRequestNumber}`
  ) {
    throw new Error("GitHub returned an unexpected pull request URL.");
  }
  return {
    pullRequestNumber: value.pullRequestNumber,
    pullRequestUrl: url.href
  };
};
