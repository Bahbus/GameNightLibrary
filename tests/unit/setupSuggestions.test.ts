import { describe, expect, it } from "vitest";
import { buildSetupSuggestions, gitBlobSha } from "../../scripts/setupSuggestionGeneration";
import type { HouseIntakeRow } from "../../scripts/houseIntake";
import type { MatchingRow } from "../../scripts/intakeMatching";
import {
  applyHowItPlaysSuggestion,
  inferHowItPlays,
  parseSetupSuggestions,
  type HowItPlaysSuggestion
} from "../../src/lib/setupSuggestions";
import type { BggMetadata } from "../../src/types";

const metadata = (overrides: Partial<BggMetadata> = {}): BggMetadata => ({
  bggId: 101,
  name: "Example",
  categories: [],
  mechanics: [],
  modes: ["competitive"],
  playerRecommendations: [],
  url: "https://boardgamegeek.com/boardgame/101",
  ...overrides
});

const suggestion: HowItPlaysSuggestion = {
  slug: "example",
  bggId: 101,
  moods: ["strategic", "tense"],
  accessibilityFlags: ["memory-heavy"],
  contentFlags: ["horror"],
  categories: ["Horror"],
  mechanics: ["Memory", "Worker Placement"]
};

const houseRow: HouseIntakeRow = {
  slug: "example",
  title: "Example",
  availability: "available",
  learned: "",
  shelf: "",
  houseRating: "",
  setupTimeRange: "",
  teachDifficulty: "",
  tableSpace: "",
  interaction: "",
  luck: "",
  downtime: "",
  modes: "",
  moods: "",
  accessibilityFlags: "",
  contentFlags: "",
  recommendationNotes: "",
  localValuesRequired: "no",
  localMinPlayers: "",
  localMaxPlayers: "",
  localMinMinutes: "",
  localMaxMinutes: "",
  localMinAge: ""
};

const matchingRow: MatchingRow = {
  slug: "example",
  kind: "game",
  parentSlug: "",
  proposedTitle: "Example",
  editionOrOwnedDetail: "",
  quantity: 1,
  standalone: false,
  sourceUrl: "https://boardgamegeek.com/boardgame/101/example",
  knownBggId: 101,
  matchStatus: "matched-from-source",
  intakeNotes: "",
  matchingNotes: ""
};

describe("BGG-backed setup suggestions", () => {
  it("infers only supported tags from strong category and mechanic signals", () => {
    expect(
      inferHowItPlays(
        metadata({
          categories: ["Horror", "Mature / Adult", "Word Game"],
          mechanics: ["Memory", "Worker Placement"]
        })
      )
    ).toEqual({
      moods: ["strategic", "puzzly", "tense", "thematic"],
      accessibilityFlags: ["language-dependent", "memory-heavy"],
      contentFlags: ["horror", "mature-themes"]
    });
  });

  it("does not invent accessibility or content warnings from generic themes", () => {
    expect(inferHowItPlays(metadata({ categories: ["Animals"] }))).toEqual({
      moods: [],
      accessibilityFlags: [],
      contentFlags: []
    });
  });

  it("validates source-bound payloads and merges suggestions with authored answers", () => {
    const sourceSha = "a".repeat(40);
    const payload = parseSetupSuggestions(
      { schemaVersion: 1, sourceSha, enriched: true, suggestions: [suggestion] },
      sourceSha
    );
    expect(payload.suggestions).toHaveLength(1);
    expect(
      applyHowItPlaysSuggestion(
        { moods: "cozy", accessibilityFlags: "", contentFlags: "violence" },
        suggestion
      )
    ).toEqual({
      moods: "cozy;strategic;tense",
      accessibilityFlags: "memory-heavy",
      contentFlags: "violence;horror"
    });
    expect(() =>
      parseSetupSuggestions(
        { schemaVersion: 1, sourceSha: "b".repeat(40), enriched: true, suggestions: [] },
        sourceSha
      )
    ).toThrow(/current questionnaire/);
  });

  it("builds deterministic suggestions from matched BGG games and stays empty without a token", async () => {
    const houseSource = "questionnaire source\n";
    const withoutToken = await buildSetupSuggestions({
      houseRows: [houseRow],
      houseSource,
      manifest: [matchingRow]
    });
    expect(withoutToken).toEqual({
      schemaVersion: 1,
      sourceSha: gitBlobSha(houseSource),
      enriched: false,
      suggestions: []
    });
    await expect(
      buildSetupSuggestions({
        houseRows: [houseRow],
        houseSource,
        manifest: [matchingRow],
        requireEnrichment: true
      })
    ).rejects.toThrow(/BGG_API_TOKEN/);

    const fetcher = async () =>
      new Response(
        `<items><item type="boardgame" id="101"><name type="primary" value="Example"/><link type="boardgamecategory" value="Horror"/><link type="boardgamemechanic" value="Memory"/></item></items>`,
        { status: 200 }
      );
    const enriched = await buildSetupSuggestions({
      houseRows: [houseRow],
      houseSource,
      manifest: [matchingRow],
      token: "token",
      fetcher: fetcher as typeof fetch
    });
    expect(enriched.suggestions[0]).toMatchObject({
      slug: "example",
      moods: ["tense", "thematic"],
      accessibilityFlags: ["memory-heavy"],
      contentFlags: ["horror"]
    });
  });
});
