import type {
  CatalogGame,
  GameMode,
  GroupPreferences,
  ScoreComponent,
  ScoredGame,
  TableSpace
} from "../types";
import { setupTimeComparisonMinutes } from "../../shared/setup/houseOptions";

const TABLE_SPACE_RANK: Record<TableSpace, number> = {
  compact: 1,
  standard: 2,
  large: 3
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const closeness = (actual: number | undefined, target: number, spread: number) =>
  actual === undefined ? 0.5 : clamp(1 - Math.abs(actual - target) / spread);
const maxValue = (values: Array<number | undefined>) => values.find((value) => value !== undefined);

export function effectiveValues(game: CatalogGame) {
  const metadata = game.metadata;
  return {
    minPlayers: maxValue([game.overrides?.minPlayers, metadata.minPlayers]),
    maxPlayers: maxValue([game.overrides?.maxPlayers, metadata.maxPlayers]),
    minMinutes: maxValue([game.overrides?.minMinutes, metadata.minMinutes]),
    maxMinutes: maxValue([game.overrides?.maxMinutes, metadata.maxMinutes]),
    minAge: maxValue([game.overrides?.minAge, metadata.minAge])
  };
}

export function effectiveModes(game: CatalogGame): GameMode[] {
  return game.house.modes.length ? game.house.modes : game.metadata.modes;
}

export function isEligible(game: CatalogGame, preferences: GroupPreferences): boolean {
  const values = effectiveValues(game);
  const query = preferences.query.trim().toLocaleLowerCase();

  if (
    query &&
    ![
      game.name,
      game.metadata.name,
      ...game.metadata.categories,
      ...game.metadata.mechanics,
      ...game.house.moods
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query)
  ) {
    return false;
  }
  if (game.availability !== "available") return false;
  if (preferences.learnedOnly && !game.learned) return false;
  if (
    preferences.players !== undefined &&
    ((values.minPlayers !== undefined && preferences.players < values.minPlayers) ||
      (values.maxPlayers !== undefined && preferences.players > values.maxPlayers))
  ) {
    return false;
  }
  if (
    preferences.maxMinutes !== undefined &&
    values.maxMinutes !== undefined &&
    values.maxMinutes > preferences.maxMinutes
  ) {
    return false;
  }
  if (preferences.requiredMode && !effectiveModes(game).includes(preferences.requiredMode)) {
    return false;
  }
  if (
    preferences.minAge !== undefined &&
    values.minAge !== undefined &&
    preferences.minAge < values.minAge
  ) {
    return false;
  }
  if (
    preferences.maxTableSpace &&
    game.house.tableSpace &&
    TABLE_SPACE_RANK[game.house.tableSpace] > TABLE_SPACE_RANK[preferences.maxTableSpace]
  ) {
    return false;
  }
  if (
    preferences.excludedAccessibility.some((flag) => game.house.accessibilityFlags.includes(flag))
  ) {
    return false;
  }
  if (preferences.excludedContent.some((flag) => game.house.contentFlags.includes(flag))) {
    return false;
  }
  return true;
}

function playerFit(game: CatalogGame, players: number | undefined): number {
  if (players === undefined) return 0.5;
  const recommendation = game.metadata.playerRecommendations.find(
    (item) => item.playerCount === players
  );
  if (!recommendation) return 0.5;
  if (recommendation.rating === "best") return 1;
  if (recommendation.rating === "recommended") return 0.75;
  return 0;
}

function tagMatch(actual: string[], desired: string[]): number {
  if (!desired.length) return 0.5;
  const normalized = new Set(actual.map((item) => item.toLocaleLowerCase()));
  const matches = desired.filter((item) => normalized.has(item.toLocaleLowerCase())).length;
  return matches / desired.length;
}

function add(components: ScoreComponent[], key: string, label: string, score: number, weight = 1) {
  components.push({ key, label, score: clamp(score), weight });
}

export function scoreGame(game: CatalogGame, preferences: GroupPreferences): ScoredGame {
  const values = effectiveValues(game);
  const components: ScoreComponent[] = [];

  add(
    components,
    "house-rating",
    "House rating",
    game.house.rating === undefined ? 0.5 : (game.house.rating - 1) / 4,
    2
  );
  add(
    components,
    "player-fit",
    "Community player-count fit",
    playerFit(game, preferences.players),
    2
  );

  if (preferences.targetMinutes !== undefined) {
    const midpoint =
      values.minMinutes !== undefined && values.maxMinutes !== undefined
        ? (values.minMinutes + values.maxMinutes) / 2
        : (values.maxMinutes ?? values.minMinutes);
    add(
      components,
      "duration",
      "Preferred playing time",
      closeness(midpoint, preferences.targetMinutes, Math.max(30, preferences.targetMinutes))
    );
  }
  if (preferences.targetComplexity !== undefined) {
    add(
      components,
      "complexity",
      "Preferred complexity",
      closeness(game.metadata.complexity, preferences.targetComplexity, 4)
    );
  }
  if (preferences.preferredMoods.length) {
    add(
      components,
      "moods",
      "Preferred mood",
      tagMatch(game.house.moods, preferences.preferredMoods)
    );
  }
  if (preferences.preferredMechanics.length) {
    add(
      components,
      "mechanics",
      "Preferred mechanics",
      tagMatch(game.metadata.mechanics, preferences.preferredMechanics)
    );
  }
  if (preferences.preferredThemes.length) {
    add(
      components,
      "themes",
      "Preferred themes",
      tagMatch(game.metadata.categories, preferences.preferredThemes)
    );
  }
  if (preferences.targetInteraction !== undefined) {
    add(
      components,
      "interaction",
      "Interaction level",
      closeness(game.house.interaction, preferences.targetInteraction, 4)
    );
  }
  if (preferences.targetLuck !== undefined) {
    add(components, "luck", "Luck level", closeness(game.house.luck, preferences.targetLuck, 4));
  }
  if (preferences.targetDowntime !== undefined) {
    add(
      components,
      "downtime",
      "Downtime level",
      closeness(game.house.downtime, preferences.targetDowntime, 4)
    );
  }
  if (preferences.maxSetupMinutes !== undefined) {
    const setup = game.house.setupTimeRange
      ? setupTimeComparisonMinutes(game.house.setupTimeRange)
      : undefined;
    add(
      components,
      "setup",
      "Setup burden",
      setup === undefined
        ? 0.5
        : setup <= preferences.maxSetupMinutes
          ? 1
          : clamp(1 - (setup - preferences.maxSetupMinutes) / preferences.maxSetupMinutes)
    );
  }
  if (preferences.maxTeachDifficulty !== undefined) {
    const teach = game.house.teachDifficulty;
    add(
      components,
      "teach",
      "Teaching difficulty",
      teach === undefined
        ? 0.5
        : teach <= preferences.maxTeachDifficulty
          ? 1
          : clamp(1 - (teach - preferences.maxTeachDifficulty) / 4)
    );
  }

  const weightTotal = components.reduce((total, component) => total + component.weight, 0);
  const matchScore =
    components.reduce((total, component) => total + component.score * component.weight, 0) /
    weightTotal;
  return {
    game,
    matchScore,
    rouletteWeight: 1 + 4 * matchScore ** 2,
    components
  };
}

export function filterAndScore(games: CatalogGame[], preferences: GroupPreferences): ScoredGame[] {
  return games
    .filter((game) => isEligible(game, preferences))
    .map((game) => scoreGame(game, preferences));
}

export function sortScoredGames(games: ScoredGame[], sort: GroupPreferences["sort"]): ScoredGame[] {
  const copy = [...games];
  const value = (entry: ScoredGame) => {
    const effective = effectiveValues(entry.game);
    switch (sort) {
      case "bggRating":
        return entry.game.metadata.rating ?? -1;
      case "complexity":
        return entry.game.metadata.complexity ?? -1;
      case "duration":
        return effective.maxMinutes ?? -1;
      case "players":
        return effective.maxPlayers ?? -1;
      case "houseRating":
        return entry.game.house.rating ?? -1;
      default:
        return 0;
    }
  };
  if (sort === "name") {
    return copy.sort((a, b) => a.game.name.localeCompare(b.game.name));
  }
  return copy.sort((a, b) => value(b) - value(a) || a.game.name.localeCompare(b.game.name));
}

export type RandomUnit = () => number;

export function cryptoRandomUnit(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 0x1_0000_0000;
}

export function weightedDraw(
  games: ScoredGame[],
  excludedSlugs: Set<string>,
  random: RandomUnit = cryptoRandomUnit
): ScoredGame | undefined {
  const candidates = roulettePool(games, excludedSlugs);
  if (!candidates.length) return undefined;

  const total = candidates.reduce((sum, entry) => sum + entry.rouletteWeight, 0);
  let needle = Math.max(0, Math.min(0.999999999999, random())) * total;
  for (const candidate of candidates) {
    needle -= candidate.rouletteWeight;
    if (needle < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

export function roulettePool(games: ScoredGame[], excludedSlugs: Set<string>): ScoredGame[] {
  const remaining = games.filter((entry) => !excludedSlugs.has(entry.game.slug));
  return remaining.length ? remaining : games;
}

export function createStandalonePlayModes(games: CatalogGame[]): CatalogGame[] {
  return games.flatMap((game) => [
    { ...game, playMode: { kind: "base", label: game.name } as const },
    ...game.expansions
      .filter((expansion) => expansion.standalone)
      .map((expansion) => ({
        ...game,
        slug: `${game.slug}--${expansion.slug}`,
        name: `${game.name}: ${expansion.name}`,
        bggId: expansion.bggId,
        edition: expansion.edition,
        quantity: expansion.quantity,
        shelf: expansion.shelf ?? game.shelf,
        availability: expansion.availability,
        learned: expansion.learned,
        ownershipNotes: expansion.ownershipNotes,
        overrides: expansion.overrides,
        metadata: expansion.metadata ?? {
          ...game.metadata,
          bggId: expansion.bggId,
          name: expansion.name,
          url: expansion.bggId
            ? `https://boardgamegeek.com/boardgame/${expansion.bggId}`
            : expansion.sourceUrl
        },
        playMode: {
          kind: "standalone-expansion" as const,
          expansionSlug: expansion.slug,
          label: `${game.name}: ${expansion.name}`
        }
      }))
  ]);
}
