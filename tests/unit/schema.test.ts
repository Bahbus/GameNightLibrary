import { describe, expect, it } from "vitest";
import { parseInventory, parseWishlist } from "../../src/lib/schema";

const game = (slug: string, bggId: number) => ({
  slug,
  bggId,
  name: slug,
  quantity: 1,
  availability: "available",
  learned: false,
  house: {
    modes: [],
    moods: [],
    accessibilityFlags: [],
    contentFlags: []
  },
  expansions: []
});

describe("wishlist schema", () => {
  it("accepts a linked unowned game", () => {
    expect(
      parseWishlist({
        version: 1,
        games: [
          {
            slug: "future-game",
            bggId: 42,
            name: "Future Game",
            status: "researching",
            priority: 4
          }
        ]
      }).games[0]
    ).toMatchObject({ slug: "future-game", status: "researching", priority: 4 });
  });

  it("rejects duplicate identities and unlinked requests", () => {
    expect(() =>
      parseWishlist({
        version: 1,
        games: [
          { slug: "same", bggId: 42, name: "One" },
          { slug: "same", bggId: 42, name: "Two" }
        ]
      })
    ).toThrow(/Duplicate wishlist/);
    expect(() =>
      parseWishlist({
        version: 1,
        games: [{ slug: "unlinked", name: "Unlinked" }]
      })
    ).toThrow(/bggId or sourceUrl/);
  });
});

describe("inventory schema", () => {
  it("accepts an empty inventory", () => {
    expect(parseInventory({ version: 1, games: [] })).toEqual({ version: 1, games: [] });
  });

  it("rejects duplicate BGG IDs and slugs", () => {
    expect(() =>
      parseInventory({ version: 1, games: [game("same", 10), game("same", 10)] })
    ).toThrow();
  });

  it("rejects inverted override ranges", () => {
    expect(() =>
      parseInventory({
        version: 1,
        games: [{ ...game("range", 10), overrides: { minPlayers: 5, maxPlayers: 2 } }]
      })
    ).toThrow(/minPlayers/);
  });

  it("accepts a local-only game with a source and complete filter values", () => {
    const local = {
      ...game("local-game", 10),
      bggId: undefined,
      sourceUrl: "https://publisher.example/local-game",
      house: { ...game("local-game", 10).house, modes: ["competitive"] },
      overrides: {
        minPlayers: 2,
        maxPlayers: 8,
        minMinutes: 15,
        maxMinutes: 30,
        minAge: 18
      }
    };
    expect(parseInventory({ version: 1, games: [local] }).games[0].bggId).toBeUndefined();
  });

  it("rejects a local-only game without complete filter values", () => {
    expect(() =>
      parseInventory({
        version: 1,
        games: [
          {
            ...game("local-game", 10),
            bggId: undefined,
            sourceUrl: "https://publisher.example/local-game",
            house: { ...game("local-game", 10).house, modes: ["competitive"] },
            overrides: { minPlayers: 2 }
          }
        ]
      })
    ).toThrow(/maxPlayers/);
  });

  it("rejects a local-only game without a supported mode", () => {
    expect(() =>
      parseInventory({
        version: 1,
        games: [
          {
            ...game("local-game", 10),
            bggId: undefined,
            sourceUrl: "https://publisher.example/local-game",
            overrides: {
              minPlayers: 2,
              maxPlayers: 4,
              minMinutes: 10,
              maxMinutes: 30,
              minAge: 8
            }
          }
        ]
      })
    ).toThrow(/supported mode/);
  });

  it("lets a non-standalone local expansion inherit its base game's filter values", () => {
    const base = {
      ...game("base", 10),
      expansions: [
        {
          slug: "bundled-module",
          sourceUrl: "https://publisher.example/base",
          name: "Bundled Module",
          standalone: false
        }
      ]
    };

    expect(parseInventory({ version: 1, games: [base] }).games[0].expansions[0]).toMatchObject({
      slug: "bundled-module",
      standalone: false
    });
  });

  it("requires a local-only standalone expansion to be modeled as a base game", () => {
    const base = {
      ...game("base", 10),
      expansions: [
        {
          slug: "standalone-module",
          sourceUrl: "https://publisher.example/standalone",
          name: "Standalone Module",
          standalone: true
        }
      ]
    };

    expect(() => parseInventory({ version: 1, games: [base] })).toThrow(/modeled as a base game/);
  });

  it("allows multiple local-only games while still enforcing unique slugs", () => {
    const local = (slug: string) => ({
      ...game(slug, 10),
      bggId: undefined,
      sourceUrl: `https://publisher.example/${slug}`,
      house: { ...game(slug, 10).house, modes: ["competitive"] },
      overrides: {
        minPlayers: 1,
        maxPlayers: 4,
        minMinutes: 10,
        maxMinutes: 20,
        minAge: 8
      }
    });
    expect(parseInventory({ version: 1, games: [local("one"), local("two")] }).games).toHaveLength(
      2
    );
  });
});
