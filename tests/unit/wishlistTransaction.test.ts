import { describe, expect, it } from "vitest";
import { applyWishlistRequest } from "../../scripts/wishlistTransaction";
import type { Inventory, Wishlist } from "../../shared/inventory/types";

const issueBody = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join("\n\n");

const inventory = (): Inventory => ({
  version: 1,
  games: [
    {
      slug: "owned-game",
      bggId: 100,
      name: "Owned Game",
      quantity: 1,
      availability: "available",
      learned: true,
      house: {
        modes: ["competitive"],
        moods: [],
        accessibilityFlags: [],
        contentFlags: []
      },
      expansions: []
    }
  ]
});

const wishlist = (): Wishlist => ({
  version: 1,
  games: [
    {
      slug: "existing-game",
      bggId: 200,
      name: "Existing Game",
      status: "researching"
    }
  ]
});

describe("wish-list issue transactions", () => {
  it("adds and alphabetizes a BGG-linked suggestion with its public reasoning", () => {
    const result = applyWishlistRequest(
      wishlist(),
      inventory(),
      issueBody({
        "Game name": "A New Game",
        "BoardGameGeek ID or source URL": "https://boardgamegeek.com/boardgame/300/a-new-game",
        "Why should we consider it?": "It fills a cooperative weeknight niche.",
        "Other notes": "The revised edition looks best."
      })
    );

    expect(result.games.map((game) => game.slug)).toEqual(["a-new-game", "existing-game"]);
    expect(result.games[0]).toEqual({
      slug: "a-new-game",
      bggId: 300,
      name: "A New Game",
      status: "interested",
      notes:
        "It fills a cooperative weeknight niche.\n\nAdditional notes: The revised edition looks best."
    });
  });

  it("adds a non-BGG game from a public product URL", () => {
    const result = applyWishlistRequest(
      { version: 1, games: [] },
      inventory(),
      issueBody({
        "Game name": "Local Project",
        "BoardGameGeek ID or source URL": "https://publisher.example/local-project",
        "Why should we consider it?": "It supports the whole group."
      })
    );

    expect(result.games[0]).toMatchObject({
      slug: "local-project",
      sourceUrl: "https://publisher.example/local-project",
      status: "interested"
    });
  });

  it("accepts the previous two-field issue format for already-open requests", () => {
    const result = applyWishlistRequest(
      { version: 1, games: [] },
      inventory(),
      issueBody({
        "Game name": "Legacy Request",
        "BGG ID": "301",
        "Why should we consider it?": "It works well at two players."
      })
    );

    expect(result.games[0].bggId).toBe(301);
  });

  it.each([
    [
      "an existing wish-list slug",
      { "Game name": "Existing Game", "BoardGameGeek ID or source URL": "400" },
      /slug existing-game already exists/
    ],
    [
      "an existing wish-list BGG ID",
      { "Game name": "Another Name", "BoardGameGeek ID or source URL": "200" },
      /already on the wish list/
    ],
    [
      "an owned game",
      { "Game name": "Owned Game", "BoardGameGeek ID or source URL": "100" },
      /already owned/
    ],
    [
      "a missing source",
      { "Game name": "Unlinked Game", "BoardGameGeek ID or source URL": "" },
      /BoardGameGeek ID or source URL/
    ],
    [
      "a non-web source",
      { "Game name": "Unsafe Game", "BoardGameGeek ID or source URL": "javascript:alert(1)" },
      /BoardGameGeek ID or source URL/
    ]
  ])("rejects %s", (_name, fields, expected) => {
    expect(() =>
      applyWishlistRequest(
        wishlist(),
        inventory(),
        issueBody({
          ...fields,
          "Why should we consider it?": "It might fit the group."
        })
      )
    ).toThrow(expected);
  });

  it("requires reasoning and does not mutate source data when validation fails", () => {
    const source = wishlist();
    const before = JSON.parse(JSON.stringify(source)) as Wishlist;
    expect(() =>
      applyWishlistRequest(
        source,
        inventory(),
        issueBody({
          "Game name": "No Reason",
          "BoardGameGeek ID or source URL": "400"
        })
      )
    ).toThrow(/Why should we consider it/);
    expect(source).toEqual(before);
  });
});
