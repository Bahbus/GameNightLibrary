import { EMPTY_PROGRESS, parseSavedHouseProgress, type SavedHouseProgress } from "./houseEditor";
import { BROWSER_STORAGE_KEYS } from "./browserStorage";

export const SETUP_PROGRESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

interface SetupProgressStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface StoredSetupProgress {
  progress: SavedHouseProgress;
  sourceSha?: string;
}

const empty = (): StoredSetupProgress => ({
  progress: { ...EMPTY_PROGRESS, answers: {}, completedSlugs: [] }
});

export function readSetupProgress(
  storage?: SetupProgressStorage,
  now = Date.now()
): StoredSetupProgress {
  try {
    const target = storage ?? globalThis.localStorage;
    const source = target.getItem(BROWSER_STORAGE_KEYS.setupProgress);
    if (!source) return empty();
    const value = JSON.parse(source) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Saved Setup progress has an unsupported format.");
    }
    const candidate = value as Record<string, unknown>;
    const savedAt = typeof candidate.savedAt === "string" ? Date.parse(candidate.savedAt) : NaN;
    if (
      !Number.isFinite(savedAt) ||
      savedAt > now ||
      now - savedAt > SETUP_PROGRESS_MAX_AGE_MS ||
      typeof candidate.sourceSha !== "string" ||
      !/^[a-f0-9]{40}$/.test(candidate.sourceSha)
    ) {
      throw new Error("Saved Setup progress has expired.");
    }
    return {
      progress: parseSavedHouseProgress(candidate),
      sourceSha: candidate.sourceSha
    };
  } catch {
    try {
      const target = storage ?? globalThis.localStorage;
      target.removeItem(BROWSER_STORAGE_KEYS.setupProgress);
    } catch {
      // Setup can start fresh when browser storage is unavailable.
    }
    return empty();
  }
}

export function storeSetupProgress(
  progress: SavedHouseProgress,
  sourceSha: string,
  storage?: SetupProgressStorage,
  now = Date.now()
) {
  const target = storage ?? globalThis.localStorage;
  target.setItem(
    BROWSER_STORAGE_KEYS.setupProgress,
    JSON.stringify({ ...progress, sourceSha, savedAt: new Date(now).toISOString() })
  );
}

export function clearSetupProgress(storage?: Pick<SetupProgressStorage, "removeItem">) {
  try {
    const target = storage ?? globalThis.localStorage;
    target.removeItem(BROWSER_STORAGE_KEYS.setupProgress);
  } catch {
    // Setup completion does not depend on browser storage access.
  }
}
