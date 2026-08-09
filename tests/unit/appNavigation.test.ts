import { describe, expect, it } from "vitest";
import { buildAppUrl, parseAppView } from "../../src/lib/appNavigation";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";

describe("application navigation", () => {
  it("reads supported views and falls back safely", () => {
    expect(parseAppView("?v=1&view=roulette")).toBe("roulette");
    expect(parseAppView("view=wishlist")).toBe("wishlist");
    expect(parseAppView("?view=unknown")).toBe("library");
  });

  it("preserves filter settings in view links", () => {
    const preferences = { ...DEFAULT_PREFERENCES, players: 6 };
    expect(buildAppUrl("/GameNightLibrary/", preferences, "roulette")).toBe(
      "/GameNightLibrary/?v=1&players=6&view=roulette"
    );
    expect(buildAppUrl("/GameNightLibrary/", preferences, "library")).toBe(
      "/GameNightLibrary/?v=1&players=6"
    );
  });
});
