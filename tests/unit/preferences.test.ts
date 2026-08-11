import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  serializePreferences
} from "../../src/lib/preferences";

describe("shareable preferences", () => {
  it("round-trips shareable state without a schema marker", () => {
    const expected = {
      ...DEFAULT_PREFERENCES,
      players: 6,
      maxMinutes: 90,
      requiredMode: "team" as const,
      preferredMoods: ["social", "chaotic"],
      targetComplexity: 2.5,
      learnedOnly: true
    };
    const serialized = serializePreferences(expected);
    expect(serialized).not.toContain("v=");
    expect(parsePreferences(serialized)).toEqual(expected);
  });

  it("ignores unrelated query parameters", () => {
    expect(parsePreferences("campaign=summer&players=6")).toEqual({
      ...DEFAULT_PREFERENCES,
      players: 6
    });
  });

  it("round-trips the solo mode filter", () => {
    const preferences = { ...DEFAULT_PREFERENCES, requiredMode: "solo" as const };
    expect(parsePreferences(serializePreferences(preferences))).toEqual(preferences);
  });
});
