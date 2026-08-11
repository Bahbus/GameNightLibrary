export const HOUSE_ANSWER_HEADERS = [
  "slug",
  "title",
  "availability",
  "learned",
  "shelf",
  "house_rating",
  "setup_time_range",
  "teach_difficulty",
  "table_space",
  "interaction",
  "luck",
  "downtime",
  "modes",
  "moods",
  "accessibility_flags",
  "content_flags",
  "recommendation_notes",
  "local_values_required",
  "local_min_players",
  "local_max_players",
  "local_min_minutes",
  "local_max_minutes",
  "local_min_age"
] as const;

export interface HouseAnswer {
  slug: string;
  title: string;
  availability: string;
  learned: string;
  shelf: string;
  houseRating: string;
  setupTimeRange: string;
  teachDifficulty: string;
  tableSpace: string;
  interaction: string;
  luck: string;
  downtime: string;
  modes: string;
  moods: string;
  accessibilityFlags: string;
  contentFlags: string;
  recommendationNotes: string;
  localValuesRequired: string;
  localMinPlayers: string;
  localMaxPlayers: string;
  localMinMinutes: string;
  localMaxMinutes: string;
  localMinAge: string;
}

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
      if (
        typeof candidate !== "object" ||
        candidate === null ||
        !("slug" in candidate) ||
        typeof candidate.slug !== "string" ||
        !("title" in candidate) ||
        typeof candidate.title !== "string"
      ) {
        throw new Error("The setup questionnaire contains an invalid game.");
      }
      if (slugs.has(candidate.slug)) {
        throw new Error(`The setup questionnaire repeats ${candidate.slug}.`);
      }
      slugs.add(candidate.slug);
      return candidate as unknown as HouseAnswer;
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

const quoteCsv = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export function houseAnswersToCsv(games: HouseAnswer[]): string {
  const records = games.map((game) => [
    game.slug,
    game.title,
    game.availability,
    game.learned,
    game.shelf,
    game.houseRating,
    game.setupTimeRange,
    game.teachDifficulty,
    game.tableSpace,
    game.interaction,
    game.luck,
    game.downtime,
    normalizeList(game.modes),
    normalizeList(game.moods),
    normalizeList(game.accessibilityFlags),
    normalizeList(game.contentFlags),
    game.recommendationNotes,
    game.localValuesRequired,
    game.localMinPlayers,
    game.localMaxPlayers,
    game.localMinMinutes,
    game.localMaxMinutes,
    game.localMinAge
  ]);
  return [
    HOUSE_ANSWER_HEADERS.map(quoteCsv).join(","),
    ...records.map((record) => record.map(quoteCsv).join(","))
  ].join("\n");
}
