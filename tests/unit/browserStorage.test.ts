import { describe, expect, it } from "vitest";
import { clearLegacyBrowserState } from "../../src/lib/browserStorage";

class RecordingStorage {
  removed: string[] = [];

  removeItem(key: string) {
    this.removed.push(key);
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
    });
    expect(session.removed).toHaveLength(3);

    withThrowingStorageProperty("sessionStorage", () => {
      expect(() => clearLegacyBrowserState(local)).not.toThrow();
    });
    expect(local.removed).toHaveLength(3);
  });
});
