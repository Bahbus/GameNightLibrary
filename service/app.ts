import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z, ZodError } from "zod";
import type { ServiceConfig } from "./config.js";
import { ServiceError } from "./errors.js";
import type { SetupGateway } from "./github.js";
import { createServiceRevision } from "../shared/setup/serviceRevision.js";
import { SetupTokens, sha256Base64Url } from "./tokens.js";

const PKCE_VALUE = /^[A-Za-z0-9_-]{43,128}$/;
const SHA_256_VALUE = /^[A-Za-z0-9_-]{43}$/;
const OAUTH_CODE = /^[A-Za-z0-9_-]{1,256}$/;
const SOURCE_SHA = /^[a-f0-9]{40}$/;

const startSchema = z.object({
  callback: z.string().url(),
  code_challenge: z.string().regex(SHA_256_VALUE),
  nonce_hash: z.string().regex(SHA_256_VALUE)
});

const exchangeSchema = z.object({
  code: z.string().regex(OAUTH_CODE),
  codeVerifier: z.string().regex(PKCE_VALUE),
  nonce: z.string().regex(PKCE_VALUE),
  state: z.string().min(1).max(4_096)
});

const submissionSchema = z.object({
  csv: z
    .string()
    .min(1)
    .max(256 * 1_024),
  sourceSha: z.string().regex(SOURCE_SHA)
});

const sameValue = (left: string, right: string) => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const bearerToken = (request: Request) => {
  const authorization = request.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._-]{1,4096})$/.exec(authorization);
  if (!match) throw new ServiceError(401, "Collaborator verification is required.", "unauthorized");
  return match[1];
};

const clientOrigin = (request: Request, config: ServiceConfig) => {
  const origin = request.get("origin");
  if (!origin || !config.allowedOrigins.has(origin)) {
    throw new ServiceError(403, "This site is not allowed to use Setup.", "origin_denied");
  }
  return origin;
};

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch(next);
  };

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const submitRateLimit = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

export function createSetupService({
  config,
  gateway,
  tokens = new SetupTokens(config),
  revision
}: {
  config: ServiceConfig;
  gateway: SetupGateway;
  tokens?: SetupTokens;
  revision?: string;
}) {
  const app = express();
  const deployedRevision = revision ? createServiceRevision(revision) : undefined;
  app.disable("x-powered-by");
  if (config.trustProxyHops) app.set("trust proxy", config.trustProxyHops);
  app.use((_request, response, next) => {
    response.set("cache-control", "no-store");
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" }
    })
  );

  app.get("/healthz", (_request, response) => {
    response.set("cache-control", "no-store").json({ status: "ok" });
  });

  app.get("/revision.json", (_request, response) => {
    if (!deployedRevision) {
      response
        .status(503)
        .set("cache-control", "no-store")
        .json({ code: "revision_unavailable", message: "Deployment revision is unavailable." });
      return;
    }
    response.set("cache-control", "no-store").json(deployedRevision);
  });

  app.use("/auth", authRateLimit);
  app.get(
    "/auth/github/start",
    asyncRoute(async (request, response) => {
      const query = startSchema.parse(request.query);
      if (!config.allowedCallbacks.has(query.callback)) {
        throw new ServiceError(400, "That Setup callback is not allowed.", "callback_denied");
      }
      const state = await tokens.createOAuthState({
        callback: query.callback,
        codeChallenge: query.code_challenge,
        nonceHash: query.nonce_hash
      });
      const authorizationUrl = gateway.authorizationUrl({
        callback: query.callback,
        codeChallenge: query.code_challenge,
        state
      });
      response.set("cache-control", "no-store").redirect(302, authorizationUrl);
    })
  );

  app.use("/api/setup", (request, response, next) => {
    try {
      const origin = clientOrigin(request, config);
      response.set("access-control-allow-origin", origin);
      response.set("vary", "Origin");
      response.set("access-control-allow-methods", "GET, POST, OPTIONS");
      response.set("access-control-allow-headers", "Authorization, Content-Type");
      response.set("access-control-max-age", "600");
      if (request.method === "OPTIONS") {
        response.sendStatus(204);
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/setup", apiRateLimit);

  app.post(
    "/api/setup/exchange",
    express.json({ limit: "8kb", strict: true }),
    asyncRoute(async (request, response) => {
      const input = exchangeSchema.parse(request.body);
      let oauthState: Awaited<ReturnType<SetupTokens["verifyOAuthState"]>>;
      try {
        oauthState = await tokens.verifyOAuthState(input.state);
      } catch {
        throw new ServiceError(401, "GitHub verification could not be completed.", "oauth_state");
      }
      const origin = clientOrigin(request, config);
      if (
        !config.allowedCallbacks.has(oauthState.callback) ||
        new URL(oauthState.callback).origin !== origin ||
        !sameValue(sha256Base64Url(input.nonce), oauthState.nonceHash) ||
        !sameValue(sha256Base64Url(input.codeVerifier), oauthState.codeChallenge)
      ) {
        throw new ServiceError(401, "GitHub verification could not be completed.", "oauth_state");
      }
      const user = await gateway.exchangeAndVerifyUser({
        callback: oauthState.callback,
        code: input.code,
        codeVerifier: input.codeVerifier
      });
      const grant = await tokens.createGrant(user.login);
      response.set("cache-control", "no-store").json({ verified: true, ...grant });
    })
  );

  const requireGrant = (request: Request, response: Response, next: NextFunction) => {
    void tokens
      .verifyGrant(bearerToken(request))
      .then((access) => {
        response.locals.setupAccess = access;
        next();
      })
      .catch(() =>
        next(new ServiceError(401, "Collaborator verification is required.", "unauthorized"))
      );
  };

  app.post(
    "/api/setup/session",
    requireGrant,
    asyncRoute(async (_request, response) => {
      response.set("cache-control", "no-store").json({
        verified: true,
        login: response.locals.setupAccess.login,
        expiresAt: response.locals.setupAccess.expiresAt
      });
    })
  );

  app.get(
    "/api/setup/questionnaire",
    requireGrant,
    asyncRoute(async (_request, response) => {
      const questionnaire = await gateway.getQuestionnaire();
      response.set("cache-control", "private, no-store").json(questionnaire);
    })
  );

  app.post(
    "/api/setup/submit",
    submitRateLimit,
    requireGrant,
    express.json({ limit: "280kb", strict: true }),
    asyncRoute(async (request, response) => {
      const input = submissionSchema.parse(request.body);
      const result = await gateway.submitHouseAnswers({
        ...input,
        login: response.locals.setupAccess.login
      });
      response.status(201).set("cache-control", "no-store").json(result);
    })
  );

  app.use((_request, response) => {
    response.status(404).json({ code: "not_found", message: "Not found." });
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestId = request.get("x-request-id")?.slice(0, 100);
    if (error instanceof ServiceError) {
      response.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ code: "invalid_request", message: "The request is invalid." });
      return;
    }
    console.error("Setup service request failed.", {
      method: request.method,
      path: request.path,
      requestId
    });
    response.status(500).json({ code: "internal_error", message: "Setup could not be completed." });
  });

  return app;
}
