import { describe, expect, it } from "vitest";
import {
  createStandalonePlayModes,
  effectiveModes,
  filterAndScore,
  isEligible,
  roulettePool,
  scoreGame,
  weightedDraw
} from "../../src/lib/catalog";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import type { GameMode } from "../../src/types";
import { catalogFixture } from "../fixtures/catalog";

const forest = catalogFixture.games[0];
const racers = catalogFixture.games[1];

describe("catalog filtering and scoring", () => {
  it("enforces player count, availability, and learned requirements", () => {
    expect(isEligible(forest, { ...DEFAULT_PREFERENCES, players: 5, learnedOnly: true })).toBe(
      true
    );
    expect(isEligible(racers, { ...DEFAULT_PREFERENCES, players: 6, learnedOnly: true })).toBe(
      false
    );
    expect(isEligible(forest, { ...DEFAULT_PREFERENCES, players: 9 })).toBe(false);
  });

  it("treats missing soft metadata as neutral", () => {
    const neutral = scoreGame(
      {
        ...forest,
        house: { ...forest.house, rating: undefined },
        metadata: { ...forest.metadata, playerRecommendations: [] }
      },
      DEFAULT_PREFERENCES
    );
    expect(neutral.matchScore).toBe(0.5);
    expect(neutral.rouletteWeight).toBe(2);
  });

  it("filters a local-only game through authored player and time values", () => {
    const local = {
      ...racers,
      slug: "local-party-game",
      bggId: undefined,
      sourceUrl: "https://publisher.example/local-party-game",
      overrides: {
        minPlayers: 3,
        maxPlayers: 12,
        minMinutes: 20,
        maxMinutes: 40,
        minAge: 18
      },
      metadata: {
        ...racers.metadata,
        bggId: undefined,
        url: "https://publisher.example/local-party-game",
        minPlayers: undefined,
        maxPlayers: undefined,
        minMinutes: undefined,
        maxMinutes: undefined,
        minAge: undefined
      }
    };
    expect(isEligible(local, { ...DEFAULT_PREFERENCES, players: 8, maxMinutes: 45 })).toBe(true);
    expect(isEligible(local, { ...DEFAULT_PREFERENCES, players: 2 })).toBe(false);
    expect(isEligible(local, { ...DEFAULT_PREFERENCES, maxMinutes: 30 })).toBe(false);
  });

  it("uses BGG modes by default and lets house modes override them", () => {
    const derived = {
      ...forest,
      house: { ...forest.house, modes: [] },
      metadata: { ...forest.metadata, modes: ["cooperative", "solo"] as GameMode[] }
    };
    expect(effectiveModes(derived)).toEqual(["cooperative", "solo"]);
    expect(isEligible(derived, { ...DEFAULT_PREFERENCES, requiredMode: "solo" })).toBe(true);

    const overridden = {
      ...derived,
      house: { ...derived.house, modes: ["competitive"] as GameMode[] }
    };
    expect(effectiveModes(overridden)).toEqual(["competitive"]);
    expect(isEligible(overridden, { ...DEFAULT_PREFERENCES, requiredMode: "solo" })).toBe(false);
  });

  it("uses the documented exact weight for a perfect match", () => {
    const result = scoreGame(forest, {
      ...DEFAULT_PREFERENCES,
      players: 4,
      targetComplexity: 3,
      preferredMoods: ["social"]
    });
    expect(result.matchScore).toBe(1);
    expect(result.rouletteWeight).toBe(5);
  });

  it("compares setup-time ranges using their conservative upper bounds", () => {
    const withinLimit = scoreGame(forest, { ...DEFAULT_PREFERENCES, maxSetupMinutes: 10 });
    const tighterLimit = scoreGame(forest, { ...DEFAULT_PREFERENCES, maxSetupMinutes: 5 });

    expect(withinLimit.components.find((component) => component.key === "setup")?.score).toBe(1);
    expect(tighterLimit.components.find((component) => component.key === "setup")?.score).toBe(0);
  });

  it("draws deterministically and resets exclusions after exhaustion", () => {
    const games = filterAndScore([forest, racers], DEFAULT_PREFERENCES);
    expect(weightedDraw(games, new Set(), () => 0)?.game.slug).toBe("forest-council");
    expect(weightedDraw(games, new Set(["forest-council"]), () => 0)?.game.slug).toBe(
      "rocket-racers"
    );
    expect(
      weightedDraw(games, new Set(["forest-council", "rocket-racers"]), () => 0)?.game.slug
    ).toBe("forest-council");
  });

  it("uses the same remaining pool for displayed odds and weighted draws", () => {
    const games = filterAndScore([forest, racers], DEFAULT_PREFERENCES);
    expect(
      roulettePool(games, new Set(["forest-council"])).map((entry) => entry.game.slug)
    ).toEqual(["rocket-racers"]);
    expect(
      roulettePool(games, new Set(["forest-council", "rocket-racers"])).map(
        (entry) => entry.game.slug
      )
    ).toEqual(["forest-council", "rocket-racers"]);
  });

  it("uses exact cumulative weight boundaries for deterministic draws", () => {
    const games = filterAndScore([forest, racers], DEFAULT_PREFERENCES);
    const total = games.reduce((sum, game) => sum + game.rouletteWeight, 0);
    const firstBoundary = games[0].rouletteWeight / total;

    expect(weightedDraw(games, new Set(), () => firstBoundary - Number.EPSILON)?.game.slug).toBe(
      games[0].game.slug
    );
    expect(weightedDraw(games, new Set(), () => firstBoundary)?.game.slug).toBe(games[1].game.slug);
  });

  it("creates a selectable mode only for standalone expansions", () => {
    const modes = createStandalonePlayModes([forest]);
    expect(modes.map((game) => game.name)).toEqual(["Forest Council", "Forest Council: Fox Den"]);
  });
});
