import { EMPTY_PROGRESS, parseSavedHouseProgress, type SavedHouseProgress } from "./houseEditor";
import {
  BROWSER_STORAGE_KEYS,
  readBrowserValue,
  removeBrowserValue,
  writeBrowserValue,
  type StorageReader,
  type StorageRemover,
  type StorageWriter
} from "./browserStorage";

export const SETUP_PROGRESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export interface StoredSetupProgress {
  progress: SavedHouseProgress;
  sourceSha?: string;
}

const empty = (): StoredSetupProgress => ({
  progress: { ...EMPTY_PROGRESS, answers: {}, completedSlugs: [] }
});

export function readSetupProgress(
  storage?: StorageReader & StorageRemover,
  now = Date.now()
): StoredSetupProgress {
  try {
    const source = readBrowserValue("local", BROWSER_STORAGE_KEYS.setupProgress, storage);
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
    removeBrowserValue("local", BROWSER_STORAGE_KEYS.setupProgress, storage);
    return empty();
  }
}

export function storeSetupProgress(
  progress: SavedHouseProgress,
  sourceSha: string,
  storage?: StorageWriter,
  now = Date.now()
) {
  writeBrowserValue(
    "local",
    BROWSER_STORAGE_KEYS.setupProgress,
    JSON.stringify({ ...progress, sourceSha, savedAt: new Date(now).toISOString() }),
    storage
  );
}

export function clearSetupProgress(storage?: StorageRemover) {
  removeBrowserValue("local", BROWSER_STORAGE_KEYS.setupProgress, storage);
}
