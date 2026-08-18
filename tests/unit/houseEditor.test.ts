import { describe, expect, it } from "vitest";
import {
  houseAnswersToCsv,
  mergeHouseProgress,
  parseHouseEditorDataset,
  parseSavedHouseProgress,
  validateHouseAnswer,
  type HouseAnswer
} from "../../src/lib/houseEditor";

const answer = (overrides: Partial<HouseAnswer> = {}): HouseAnswer => ({
  slug: "example-game",
  title: "Example Game",
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
  localMinAge: "",
  ...overrides
});
const sourceSha = "a".repeat(40);

describe("browser house editor", () => {
  it("validates the generated dataset and rejects duplicate slugs", () => {
    expect(
      parseHouseEditorDataset({ schemaVersion: 2, sourceSha, games: [answer()] }).games[0].title
    ).toBe("Example Game");
    expect(() =>
      parseHouseEditorDataset({ schemaVersion: 2, sourceSha, games: [answer(), answer()] })
    ).toThrow(/repeats example-game/);
    expect(() =>
      parseHouseEditorDataset({
        schemaVersion: 2,
        sourceSha,
        games: [{ ...answer(), availability: 1 }]
      })
    ).toThrow(/invalid availability/);
    expect(() =>
      parseHouseEditorDataset({
        schemaVersion: 2,
        sourceSha,
        games: [{ ...answer(), recommendationNotes: undefined }]
      })
    ).toThrow(/invalid recommendationNotes/);
  });

  it("sorts questionnaire games alphabetically for navigation", () => {
    const games = parseHouseEditorDataset({
      schemaVersion: 2,
      sourceSha,
      games: [
        answer({ slug: "zulu", title: "Zulu" }),
        answer({ slug: "alpha-10", title: "Alpha 10" }),
        answer({ slug: "alpha-2", title: "Alpha 2" })
      ]
    }).games;

    expect(games.map((game) => game.title)).toEqual(["Alpha 2", "Alpha 10", "Zulu"]);
  });

  it("accepts current stored progress and rejects malformed progress", () => {
    expect(
      parseSavedHouseProgress({
        answers: { "example-game": { learned: "yes" } },
        completedSlugs: ["example-game"]
      }).completedSlugs
    ).toEqual(["example-game"]);
    expect(() =>
      parseSavedHouseProgress({
        answers: [],
        completedSlugs: ["example-game"]
      })
    ).toThrow(/unsupported format/);
  });

  it("merges saved answers without allowing identity fields to drift", () => {
    const [merged] = mergeHouseProgress([answer()], {
      completedSlugs: ["example-game"],
      answers: {
        "example-game": {
          slug: "wrong",
          title: "Wrong",
          learned: "yes",
          houseRating: "5"
        }
      }
    });

    expect(merged).toMatchObject({
      slug: "example-game",
      title: "Example Game",
      learned: "yes",
      houseRating: "5"
    });
  });

  it("requires a learned answer, modes, and all five filter values for a local-only game", () => {
    expect(validateHouseAnswer(answer())).toEqual(["Choose whether the game has been learned."]);
    expect(
      validateHouseAnswer(
        answer({
          learned: "no",
          localValuesRequired: "yes",
          localMinPlayers: "2"
        })
      )
    ).toEqual([
      "Fill in every local game value so filtering will work.",
      "Choose at least one supported style so mode filtering will work."
    ]);
    expect(
      validateHouseAnswer(
        answer({
          learned: "yes",
          localValuesRequired: "yes",
          modes: "competitive;solo",
          localMinPlayers: "2",
          localMaxPlayers: "8",
          localMinMinutes: "15",
          localMaxMinutes: "30",
          localMinAge: "18"
        })
      )
    ).toEqual([]);
  });

  it("exports deterministic CSV while accepting commas in plain-language lists", () => {
    const csv = houseAnswersToCsv([
      answer({
        learned: "yes",
        modes: "competitive, team",
        moods: "cozy, strategic",
        recommendationNotes: 'Works for people who enjoy "thinky", social games.'
      })
    ]);

    expect(csv).toContain("competitive;team");
    expect(csv).toContain("cozy;strategic");
    expect(csv).toContain('"Works for people who enjoy ""thinky"", social games."');
  });
});
