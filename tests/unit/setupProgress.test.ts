import { describe, expect, it } from "vitest";
import { BROWSER_STORAGE_KEYS } from "../../src/lib/browserStorage";
import {
  SETUP_PROGRESS_MAX_AGE_MS,
  clearSetupProgress,
  readSetupProgress,
  storeSetupProgress
} from "../../src/lib/setupProgress";

const sourceSha = "a".repeat(40);

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const withUnavailableLocalStorage = (action: () => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new globalThis.DOMException("Storage access denied", "SecurityError");
    }
  });
  try {
    action();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
};

describe("Setup progress storage", () => {
  it("stores and restores current progress with its inventory revision", () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 11);
    const progress = {
      answers: { example: { learned: "yes" } },
      completedSlugs: ["example"]
    };

    storeSetupProgress(progress, sourceSha, storage, now);

    expect(readSetupProgress(storage, now)).toEqual({ progress, sourceSha });
    expect(storage.getItem(BROWSER_STORAGE_KEYS.setupProgress)).toContain(
      new Date(now).toISOString()
    );
  });

  it("deletes expired, future-dated, and malformed progress", () => {
    const now = Date.UTC(2026, 7, 11);
    for (const value of [
      JSON.stringify({ answers: {}, completedSlugs: [], sourceSha, savedAt: "not-a-date" }),
      JSON.stringify({
        answers: {},
        completedSlugs: [],
        sourceSha,
        savedAt: new Date(now + 1).toISOString()
      }),
      JSON.stringify({
        answers: {},
        completedSlugs: [],
        sourceSha,
        savedAt: new Date(now - SETUP_PROGRESS_MAX_AGE_MS - 1).toISOString()
      })
    ]) {
      const storage = new MemoryStorage();
      storage.setItem(BROWSER_STORAGE_KEYS.setupProgress, value);
      expect(readSetupProgress(storage, now).progress.completedSlugs).toEqual([]);
      expect(storage.getItem(BROWSER_STORAGE_KEYS.setupProgress)).toBeNull();
    }
  });

  it("clears progress after setup no longer needs it", () => {
    const storage = new MemoryStorage();
    storeSetupProgress({ answers: {}, completedSlugs: [] }, sourceSha, storage);
    clearSetupProgress(storage);
    expect(storage.getItem(BROWSER_STORAGE_KEYS.setupProgress)).toBeNull();
  });

  it("starts fresh when browser policy blocks localStorage itself", () => {
    withUnavailableLocalStorage(() => {
      expect(readSetupProgress()).toEqual({
        progress: { answers: {}, completedSlugs: [] }
      });
      expect(() => clearSetupProgress()).not.toThrow();
      expect(() => storeSetupProgress({ answers: {}, completedSlugs: [] }, sourceSha)).toThrow(
        /Storage access denied/
      );
    });
  });
});
