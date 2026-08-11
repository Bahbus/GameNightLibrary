export const BROWSER_STORAGE_KEYS = {
  preferences: "game-night-library:preferences",
  rouletteDrawn: "game-night-library:roulette-drawn",
  setupAccess: "game-night-library:setup-access",
  setupAuthNonce: "game-night-library:setup-auth-nonce",
  setupAuthVerifier: "game-night-library:setup-pkce-verifier",
  setupProgress: "game-night-library:setup-progress"
} as const;

const LEGACY_LOCAL_KEYS = [
  "board-game-inventory:preferences:v1",
  "board-game-inventory:drawn:v1",
  "board-game-inventory:house-progress:v2"
];

const LEGACY_SESSION_KEYS = [
  "board-game-inventory:setup-access:v1",
  "board-game-inventory:setup-auth-nonce:v1",
  "board-game-inventory:setup-pkce-verifier:v1"
];

interface StorageRemover {
  removeItem(key: string): void;
}

export function clearLegacyBrowserState(
  local: StorageRemover = globalThis.localStorage,
  session: StorageRemover = globalThis.sessionStorage
) {
  try {
    for (const key of LEGACY_LOCAL_KEYS) local.removeItem(key);
  } catch {
    // The application remains usable when browser storage is unavailable.
  }
  try {
    for (const key of LEGACY_SESSION_KEYS) session.removeItem(key);
  } catch {
    // Collaborator verification will simply start a fresh session.
  }
}
