import { describe, expect, it } from "vitest";
import { buildAppUrl, parseAppView } from "../../src/lib/appNavigation";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";

describe("application navigation", () => {
  it("reads supported views and falls back safely", () => {
    expect(parseAppView("?view=roulette")).toBe("roulette");
    expect(parseAppView("view=wishlist")).toBe("wishlist");
    expect(parseAppView("?view=unknown")).toBe("library");
  });

  it("preserves filter settings in view links", () => {
    const preferences = { ...DEFAULT_PREFERENCES, players: 6 };
    expect(buildAppUrl("/GameNightLibrary/", preferences, "roulette")).toBe(
      "/GameNightLibrary/?players=6&view=roulette"
    );
    expect(buildAppUrl("/GameNightLibrary/", preferences, "library")).toBe(
      "/GameNightLibrary/?players=6"
    );
  });

  it("uses the bare application path for default library state", () => {
    expect(buildAppUrl("/GameNightLibrary/", DEFAULT_PREFERENCES, "library")).toBe(
      "/GameNightLibrary/"
    );
  });
});
