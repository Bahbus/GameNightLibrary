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

export interface StorageReader {
  getItem(key: string): string | null;
}

export interface StorageWriter {
  setItem(key: string, value: string): void;
}

export interface StorageRemover {
  removeItem(key: string): void;
}

export type BrowserStorageArea = "local" | "session";

const resolveBrowserStorage = (
  area: BrowserStorageArea
): StorageReader & StorageWriter & StorageRemover =>
  area === "local" ? globalThis.localStorage : globalThis.sessionStorage;

export function readBrowserValue(
  area: BrowserStorageArea,
  key: string,
  storage?: StorageReader
): string | null {
  try {
    return (storage ?? resolveBrowserStorage(area)).getItem(key);
  } catch {
    return null;
  }
}

export function writeBrowserValue(
  area: BrowserStorageArea,
  key: string,
  value: string,
  storage?: StorageWriter
) {
  (storage ?? resolveBrowserStorage(area)).setItem(key, value);
}

export function tryWriteBrowserValue(
  area: BrowserStorageArea,
  key: string,
  value: string,
  storage?: StorageWriter
) {
  try {
    writeBrowserValue(area, key, value, storage);
    return true;
  } catch {
    return false;
  }
}

export function removeBrowserValue(
  area: BrowserStorageArea,
  key: string,
  storage?: StorageRemover
) {
  try {
    (storage ?? resolveBrowserStorage(area)).removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearLegacyBrowserState(local?: StorageRemover, session?: StorageRemover) {
  for (const key of LEGACY_LOCAL_KEYS) removeBrowserValue("local", key, local);
  for (const key of LEGACY_SESSION_KEYS) removeBrowserValue("session", key, session);
}
