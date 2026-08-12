import { describe, expect, it } from "vitest";
import {
  clearLegacyBrowserState,
  readBrowserValue,
  removeBrowserValue,
  tryWriteBrowserValue,
  writeBrowserValue
} from "../../src/lib/browserStorage";

class RecordingStorage {
  values = new Map<string, string>();
  removed: string[] = [];

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
    this.removed.push(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const withThrowingStorageProperty = (
  property: "localStorage" | "sessionStorage",
  action: () => void
) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, property);
  Object.defineProperty(globalThis, property, {
    configurable: true,
    get() {
      throw new globalThis.DOMException("Storage access denied", "SecurityError");
    }
  });
  try {
    action();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, property, descriptor);
    else Reflect.deleteProperty(globalThis, property);
  }
};

describe("browser storage lifecycle", () => {
  it("provides one injectable read, write, and removal contract", () => {
    const storage = new RecordingStorage();

    writeBrowserValue("local", "example", "saved", storage);

    expect(readBrowserValue("local", "example", storage)).toBe("saved");
    expect(removeBrowserValue("local", "example", storage)).toBe(true);
    expect(readBrowserValue("local", "example", storage)).toBeNull();
  });

  it("distinguishes best-effort writes from writes that must report failure", () => {
    const storage = {
      setItem() {
        throw new globalThis.DOMException("Storage is full", "QuotaExceededError");
      }
    };

    expect(tryWriteBrowserValue("local", "example", "value", storage)).toBe(false);
    expect(() => writeBrowserValue("local", "example", "value", storage)).toThrow(
      /Storage is full/
    );
  });

  it("removes every obsolete versioned key", () => {
    const local = new RecordingStorage();
    const session = new RecordingStorage();

    clearLegacyBrowserState(local, session);

    expect(local.removed).toEqual([
      "board-game-inventory:preferences:v1",
      "board-game-inventory:drawn:v1",
      "board-game-inventory:house-progress:v2"
    ]);
    expect(session.removed).toEqual([
      "board-game-inventory:setup-access:v1",
      "board-game-inventory:setup-auth-nonce:v1",
      "board-game-inventory:setup-pkce-verifier:v1"
    ]);
  });

  it("survives browser policies that reject storage property access", () => {
    const local = new RecordingStorage();
    const session = new RecordingStorage();

    withThrowingStorageProperty("localStorage", () => {
      expect(() => clearLegacyBrowserState(undefined, session)).not.toThrow();
      expect(readBrowserValue("local", "example")).toBeNull();
      expect(removeBrowserValue("local", "example")).toBe(false);
      expect(tryWriteBrowserValue("local", "example", "value")).toBe(false);
      expect(() => writeBrowserValue("local", "example", "value")).toThrow(/Storage access denied/);
    });
    expect(session.removed).toHaveLength(3);

    withThrowingStorageProperty("sessionStorage", () => {
      expect(() => clearLegacyBrowserState(local)).not.toThrow();
    });
    expect(local.removed).toHaveLength(3);
  });
});
