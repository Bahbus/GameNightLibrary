import { createHash, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { ServiceConfig } from "./config.js";

const STATE_AUDIENCE = "board-game-inventory:setup-oauth";
const GRANT_AUDIENCE = "board-game-inventory:setup";

export interface OAuthState {
  callback: string;
  codeChallenge: string;
  nonceHash: string;
}

export interface SetupGrant {
  grant: string;
  login: string;
  expiresAt: string;
}

export const sha256Base64Url = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("base64url");

export class SetupTokens {
  private readonly key: Uint8Array;

  constructor(private readonly config: ServiceConfig) {
    this.key = Buffer.from(config.signingSecret, "utf8");
  }

  async createOAuthState(value: OAuthState): Promise<string> {
    return new SignJWT({ ...value, purpose: "oauth-state" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setAudience(STATE_AUDIENCE)
      .setIssuer(this.config.serviceIssuer)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.config.oauthStateTtlSeconds}s`)
      .sign(this.key);
  }

  async verifyOAuthState(token: string): Promise<OAuthState> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ["HS256"],
      audience: STATE_AUDIENCE,
      issuer: this.config.serviceIssuer
    });
    if (
      payload.purpose !== "oauth-state" ||
      typeof payload.callback !== "string" ||
      typeof payload.codeChallenge !== "string" ||
      typeof payload.nonceHash !== "string"
    ) {
      throw new Error("Invalid OAuth state.");
    }
    return {
      callback: payload.callback,
      codeChallenge: payload.codeChallenge,
      nonceHash: payload.nonceHash
    };
  }

  async createGrant(login: string): Promise<SetupGrant> {
    const now = Math.floor(Date.now() / 1_000);
    const expires = now + this.config.grantTtlSeconds;
    const grant = await new SignJWT({ permission: "setup" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setAudience(GRANT_AUDIENCE)
      .setIssuer(this.config.serviceIssuer)
      .setSubject(login)
      .setIssuedAt(now)
      .setJti(randomUUID())
      .setExpirationTime(expires)
      .sign(this.key);
    return { grant, login, expiresAt: new Date(expires * 1_000).toISOString() };
  }

  async verifyGrant(grant: string): Promise<{ login: string; expiresAt: string }> {
    const { payload } = await jwtVerify(grant, this.key, {
      algorithms: ["HS256"],
      audience: GRANT_AUDIENCE,
      issuer: this.config.serviceIssuer
    });
    if (
      payload.permission !== "setup" ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Invalid setup grant.");
    }
    return { login: payload.sub, expiresAt: new Date(payload.exp * 1_000).toISOString() };
  }
}
