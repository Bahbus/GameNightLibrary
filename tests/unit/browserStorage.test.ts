import { describe, expect, it } from "vitest";
import { clearLegacyBrowserState } from "../../src/lib/browserStorage";

class RecordingStorage {
  removed: string[] = [];

  removeItem(key: string) {
    this.removed.push(key);
  }
}

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
});
