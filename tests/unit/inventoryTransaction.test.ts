import { describe, expect, it } from "vitest";
import { applyInventoryTransaction } from "../../scripts/inventoryTransaction";
import type { Inventory } from "../../src/types";

const issueBody = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join("\n\n");

const inventory = (): Inventory => ({
  version: 1,
  games: [
    {
      slug: "base-game",
      bggId: 100,
      name: "Base Game",
      quantity: 1,
      availability: "available",
      learned: false,
      house: {
        modes: [],
        moods: [],
        accessibilityFlags: [],
        contentFlags: []
      },
      expansions: [
        {
          slug: "old-expansion",
          bggId: 101,
          name: "Old Expansion",
          standalone: false,
          quantity: 1,
          availability: "available",
          learned: false
        }
      ]
    },
    {
      slug: "other-game",
      bggId: 200,
      name: "Other Game",
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

describe("inventory issue transactions", () => {
  it("adds a BGG-linked base game with validated house values", () => {
    const result = applyInventoryTransaction(
      inventory(),
      "add",
      issueBody({
        "Game name": "New Game",
        "Stable slug": "new-game",
        "BGG ID": "300",
        Availability: "available",
        Learned: "Yes",
        "House rating": "4.5",
        "Setup time range": "5-10",
        "Teach difficulty": "2",
        Modes: "competitive;team"
      })
    );

    expect(result.games.find((game) => game.slug === "new-game")).toMatchObject({
      bggId: 300,
      learned: true,
      house: { rating: 4.5, setupTimeRange: "5-10", modes: ["competitive", "team"] }
    });
  });

  it("adds a local-only game only when its public source and filter values are complete", () => {
    const result = applyInventoryTransaction(
      inventory(),
      "add",
      issueBody({
        "Game name": "Local Game",
        "Stable slug": "local-game",
        "Source URL": "https://publisher.example/local-game",
        "Minimum players": "2",
        "Maximum players": "8",
        "Minimum minutes": "15",
        "Maximum minutes": "45",
        "Minimum age": "12",
        Modes: "competitive;team"
      })
    );

    expect(result.games.find((game) => game.slug === "local-game")).toMatchObject({
      sourceUrl: "https://publisher.example/local-game",
      house: { modes: ["competitive", "team"] },
      overrides: {
        minPlayers: 2,
        maxPlayers: 8,
        minMinutes: 15,
        maxMinutes: 45,
        minAge: 12
      }
    });
  });

  it("rejects a local-only game without supported modes", () => {
    expect(() =>
      applyInventoryTransaction(
        inventory(),
        "add",
        issueBody({
          "Game name": "Local Game",
          "Stable slug": "local-game",
          "Source URL": "https://publisher.example/local-game",
          "Minimum players": "2",
          "Maximum players": "8",
          "Minimum minutes": "15",
          "Maximum minutes": "45",
          "Minimum age": "12"
        })
      )
    ).toThrow(/supported mode/);
  });

  it("rejects a local-only standalone expansion", () => {
    expect(() =>
      applyInventoryTransaction(
        inventory(),
        "add",
        issueBody({
          "Game name": "Standalone Local Module",
          "Stable slug": "standalone-local-module",
          "Source URL": "https://publisher.example/standalone-local-module",
          "Parent slug": "base-game",
          Standalone: "Yes"
        })
      )
    ).toThrow(/modeled as a base game/);
  });

  it("adds an expansion when both parent identifiers agree", () => {
    const result = applyInventoryTransaction(
      inventory(),
      "add",
      issueBody({
        "Game name": "New Expansion",
        "Stable slug": "new-expansion",
        "BGG ID": "301",
        "Parent slug": "base-game",
        "Parent BGG ID": "100",
        Standalone: "Yes"
      })
    );

    expect(result.games[0].expansions.find((item) => item.slug === "new-expansion")).toMatchObject({
      bggId: 301,
      standalone: true
    });
  });

  it("updates by slug, cross-checks the BGG ID, and clears optional text", () => {
    const source = inventory();
    source.games[0].shelf = "A1";
    source.games[0].ownershipNotes = "Old note";
    const result = applyInventoryTransaction(
      source,
      "update",
      issueBody({
        "Stable slug": "base-game",
        "BGG ID": "100",
        "Game name": "Renamed Base",
        "Shelf label": "(clear)",
        "Ownership notes": "(clear)",
        Availability: "loaned",
        Learned: "Yes",
        "House rating": "5"
      })
    );

    expect(result.games[0]).toMatchObject({
      name: "Renamed Base",
      availability: "loaned",
      learned: true,
      house: { rating: 5 }
    });
    expect(result.games[0].shelf).toBeUndefined();
    expect(result.games[0].ownershipNotes).toBeUndefined();
  });

  it("removes exactly the confirmed target", () => {
    const result = applyInventoryTransaction(
      inventory(),
      "remove",
      issueBody({
        "Stable slug": "old-expansion",
        "BGG ID": "101",
        "Confirm removal": "- [x] I confirm that this item should be removed."
      })
    );

    expect(result.games[0].expansions).toHaveLength(0);
    expect(result.games).toHaveLength(2);
  });

  it.each([
    [
      "duplicate slug",
      issueBody({ "Game name": "Duplicate", "Stable slug": "base-game", "BGG ID": "400" }),
      /already in the inventory/
    ],
    [
      "duplicate BGG ID",
      issueBody({ "Game name": "Duplicate", "Stable slug": "duplicate", "BGG ID": "100" }),
      /BGG ID 100 is already/
    ],
    [
      "invalid availability",
      issueBody({
        "Game name": "Invalid",
        "Stable slug": "invalid",
        "BGG ID": "400",
        Availability: "maybe"
      }),
      /Availability must be one of/
    ],
    [
      "invalid mode",
      issueBody({
        "Game name": "Invalid",
        "Stable slug": "invalid",
        "BGG ID": "400",
        Modes: "duel"
      }),
      /Modes contains invalid/
    ],
    [
      "invalid setup-time range",
      issueBody({
        "Game name": "Invalid",
        "Stable slug": "invalid",
        "BGG ID": "400",
        "Setup time range": "ten-ish"
      }),
      /Setup time range must be one of/
    ],
    [
      "missing parent",
      issueBody({
        "Game name": "Orphan",
        "Stable slug": "orphan",
        "BGG ID": "400",
        "Parent slug": "missing"
      }),
      /Parent slug missing is not/
    ],
    [
      "conflicting parents",
      issueBody({
        "Game name": "Conflicted",
        "Stable slug": "conflicted",
        "BGG ID": "400",
        "Parent slug": "base-game",
        "Parent BGG ID": "200"
      }),
      /identify different games/
    ]
  ])("rejects a %s addition", (_name, body, expected) => {
    expect(() => applyInventoryTransaction(inventory(), "add", body)).toThrow(expected);
  });

  it("rejects stale update targets and mismatched BGG cross-checks", () => {
    expect(() =>
      applyInventoryTransaction(inventory(), "update", issueBody({ "Stable slug": "missing" }))
    ).toThrow(/not in the inventory/);

    expect(() =>
      applyInventoryTransaction(
        inventory(),
        "update",
        issueBody({ "Stable slug": "base-game", "BGG ID": "200" })
      )
    ).toThrow(/does not match/);
  });

  it("requires explicit removal confirmation", () => {
    expect(() =>
      applyInventoryTransaction(
        inventory(),
        "remove",
        issueBody({ "Stable slug": "base-game", "Confirm removal": "- [ ] I confirm." })
      )
    ).toThrow(/must be checked/);
  });

  it("does not mutate the supplied inventory when validation fails", () => {
    const source = inventory();
    const before = JSON.parse(JSON.stringify(source)) as Inventory;

    expect(() =>
      applyInventoryTransaction(
        source,
        "update",
        issueBody({
          "Stable slug": "base-game",
          "Source URL": "(clear)",
          "Minimum players": "5",
          "Maximum players": "2"
        })
      )
    ).toThrow(/minPlayers/);
    expect(source).toEqual(before);
  });
});
