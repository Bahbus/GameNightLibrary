import {
  houseAnswersToCsv as serializeHouseAnswers,
  parseHouseAnswer,
  type HouseAnswer as SharedHouseAnswer
} from "../../shared/setup/houseAnswers";

export type HouseAnswer = SharedHouseAnswer;

export interface HouseEditorDataset {
  schemaVersion: 2;
  sourceSha: string;
  games: HouseAnswer[];
}

export interface SavedHouseProgress {
  answers: Record<string, Partial<HouseAnswer>>;
  completedSlugs: string[];
}

export const EMPTY_PROGRESS: SavedHouseProgress = {
  answers: {},
  completedSlugs: []
};

export function parseSavedHouseProgress(value: unknown): SavedHouseProgress {
  if (
    typeof value !== "object" ||
    value === null ||
    !("answers" in value) ||
    typeof value.answers !== "object" ||
    value.answers === null ||
    Array.isArray(value.answers) ||
    Object.values(value.answers).some(
      (answer) => typeof answer !== "object" || answer === null || Array.isArray(answer)
    ) ||
    !("completedSlugs" in value) ||
    !Array.isArray(value.completedSlugs) ||
    value.completedSlugs.some((slug) => typeof slug !== "string")
  ) {
    throw new Error("Saved Setup progress has an unsupported format.");
  }
  return {
    answers: value.answers as SavedHouseProgress["answers"],
    completedSlugs: [...value.completedSlugs]
  };
}

export function parseHouseEditorDataset(value: unknown): HouseEditorDataset {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 2 ||
    !("sourceSha" in value) ||
    typeof value.sourceSha !== "string" ||
    !/^[a-f0-9]{40}$/.test(value.sourceSha) ||
    !("games" in value) ||
    !Array.isArray(value.games)
  ) {
    throw new Error("The setup questionnaire has an unsupported format.");
  }
  const slugs = new Set<string>();
  const games = value.games
    .map((candidate) => {
      const game = parseHouseAnswer(candidate, "The setup questionnaire game");
      if (slugs.has(game.slug)) {
        throw new Error(`The setup questionnaire repeats ${game.slug}.`);
      }
      slugs.add(game.slug);
      return game;
    })
    .sort((left, right) =>
      left.title.localeCompare(right.title, "en", { numeric: true, sensitivity: "base" })
    );
  return { schemaVersion: 2, sourceSha: value.sourceSha, games };
}

export function mergeHouseProgress(
  games: HouseAnswer[],
  progress: SavedHouseProgress
): HouseAnswer[] {
  return games.map((game) => ({
    ...game,
    ...(progress.answers[game.slug] ?? {}),
    slug: game.slug,
    title: game.title,
    localValuesRequired: game.localValuesRequired
  }));
}

export function validateHouseAnswer(answer: HouseAnswer): string[] {
  const errors: string[] = [];
  if (!["yes", "no"].includes(answer.learned)) {
    errors.push("Choose whether the game has been learned.");
  }
  if (
    answer.localValuesRequired === "yes" &&
    [
      answer.localMinPlayers,
      answer.localMaxPlayers,
      answer.localMinMinutes,
      answer.localMaxMinutes,
      answer.localMinAge
    ].some((value) => !value)
  ) {
    errors.push("Fill in every local game value so filtering will work.");
  }
  if (answer.localValuesRequired === "yes" && !normalizeList(answer.modes)) {
    errors.push("Choose at least one supported style so mode filtering will work.");
  }
  return errors;
}

const normalizeList = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(";");

export function houseAnswersToCsv(games: HouseAnswer[]): string {
  return serializeHouseAnswers(
    games.map((game) => ({
      ...game,
      modes: normalizeList(game.modes),
      moods: normalizeList(game.moods),
      accessibilityFlags: normalizeList(game.accessibilityFlags),
      contentFlags: normalizeList(game.contentFlags)
    }))
  );
}
