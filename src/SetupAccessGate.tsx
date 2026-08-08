import { useCallback, useEffect, useState } from "preact/hooks";
import { HouseEditor } from "./HouseEditor";
import {
  beginSetupVerification,
  clearSetupAccessSession,
  exchangeSetupCode,
  parseSetupServiceUrl,
  readSetupAccessSession,
  removeSetupAuthQuery,
  storeSetupAccessSession,
  takeSetupAuthValues,
  verifySetupAccess,
  type SetupAccessSession
} from "./lib/setupAccess";

type GateState =
  | { kind: "checking" }
  | { kind: "required" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string }
  | { kind: "verified"; session: SetupAccessSession };

const serviceUrl = parseSetupServiceUrl(import.meta.env.VITE_SETUP_SERVICE_URL);

export function SetupAccessGate() {
  const [state, setState] = useState<GateState>({ kind: "checking" });
  const verificationLost = useCallback(() => {
    clearSetupAccessSession();
    setState({
      kind: "failed",
      message: "GitHub collaborator verification expired or was withdrawn. Please verify again."
    });
  }, []);

  useEffect(() => {
    let active = true;
    let expiryTimer: number | undefined;

    const allow = (session: SetupAccessSession) => {
      if (!active) return;
      const remaining = Date.parse(session.expiresAt) - Date.now();
      if (remaining <= 0) {
        clearSetupAccessSession();
        setState({ kind: "required" });
        return;
      }
      setState({ kind: "verified", session });
      expiryTimer = window.setTimeout(
        () => {
          clearSetupAccessSession();
          setState({ kind: "required" });
        },
        Math.min(remaining, 2_147_483_647)
      );
    };

    const check = async () => {
      if (!serviceUrl) {
        setState({ kind: "unavailable" });
        return;
      }

      const query = new URLSearchParams(window.location.search);
      const code = query.get("code");
      const oauthState = query.get("state");
      const authValues = takeSetupAuthValues();
      if (authValues) {
        removeSetupAuthQuery();
        if (!code || !oauthState) {
          setState({
            kind: "failed",
            message: "The GitHub verification response was incomplete. Please try again."
          });
          return;
        }
        try {
          const session = await exchangeSetupCode(
            serviceUrl,
            code,
            oauthState,
            authValues.nonce,
            authValues.codeVerifier
          );
          storeSetupAccessSession(session);
          allow(session);
        } catch (cause) {
          clearSetupAccessSession();
          setState({
            kind: "failed",
            message: cause instanceof Error ? cause.message : "GitHub verification failed."
          });
        }
        return;
      }
      if (code || oauthState) {
        removeSetupAuthQuery();
        setState({
          kind: "failed",
          message: "The GitHub verification response was incomplete. Please try again."
        });
        return;
      }

      const saved = readSetupAccessSession();
      if (!saved) {
        setState({ kind: "required" });
        return;
      }
      try {
        const verified = await verifySetupAccess(serviceUrl, saved);
        const session = { ...saved, ...verified };
        storeSetupAccessSession(session);
        allow(session);
      } catch (cause) {
        clearSetupAccessSession();
        setState({
          kind: "failed",
          message:
            cause instanceof Error ? cause.message : "GitHub could not confirm collaborator access."
        });
      }
    };

    void check();
    return () => {
      active = false;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, []);

  if (state.kind === "verified") {
    return (
      <>
        <div class="setup-access-bar">
          <span role="status">
            Verified collaborator: <strong>@{state.session.login}</strong>
          </span>
          <button
            class="secondary-button dark compact-button"
            onClick={() => {
              clearSetupAccessSession();
              setState({ kind: "required" });
            }}
          >
            End setup session
          </button>
        </div>
        <HouseEditor
          serviceUrl={serviceUrl!}
          grant={state.session.grant}
          onVerificationLost={verificationLost}
        />
      </>
    );
  }

  return (
    <section class="setup-gate" aria-labelledby="setup-access-title">
      <div class="setup-gate-card">
        <span class="setup-gate-mark" aria-hidden="true">
          {state.kind === "failed" || state.kind === "unavailable" ? "!" : "✓"}
        </span>
        {state.kind === "checking" ? (
          <>
            <h1 id="setup-access-title">Checking collaborator access…</h1>
            <p>The setup questionnaire will open only after GitHub confirms access.</p>
          </>
        ) : state.kind === "unavailable" ? (
          <>
            <h1 id="setup-access-title">Verification is not available yet</h1>
            <p>
              The secure GitHub connection has not been configured. Setup remains locked and no
              questionnaire data has been loaded.
            </p>
          </>
        ) : state.kind === "failed" ? (
          <>
            <h1 id="setup-access-title">We couldn’t verify collaborator access</h1>
            <p role="alert">{state.message}</p>
            <button
              class="primary-button"
              onClick={() => serviceUrl && void beginSetupVerification(serviceUrl)}
            >
              Try GitHub verification again
            </button>
          </>
        ) : (
          <>
            <h1 id="setup-access-title">Collaborator verification required</h1>
            <p>
              Sign in with GitHub. The setup questionnaire stays hidden unless this account can edit
              this library.
            </p>
            <button
              class="primary-button"
              onClick={() => serviceUrl && void beginSetupVerification(serviceUrl)}
            >
              Verify with GitHub
            </button>
          </>
        )}
      </div>
    </section>
  );
}
