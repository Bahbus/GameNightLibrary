import type { BggMetadata } from "../catalog/types.js";
import { ACCESSIBILITY_OPTIONS, CONTENT_OPTIONS, MOOD_OPTIONS } from "./houseOptions.js";

export interface HowItPlaysSuggestion {
  slug: string;
  bggId: number;
  moods: string[];
  accessibilityFlags: string[];
  contentFlags: string[];
  categories: string[];
  mechanics: string[];
}

export interface SetupSuggestionsPayload {
  schemaVersion: 1;
  sourceSha: string;
  enriched: boolean;
  suggestions: HowItPlaysSuggestion[];
}

type InferredSuggestionFields = Pick<
  HowItPlaysSuggestion,
  "moods" | "accessibilityFlags" | "contentFlags"
>;

type EditableHowItPlays = {
  moods: string;
  accessibilityFlags: string;
  contentFlags: string;
};

type Rule = {
  value: string;
  categories?: readonly string[];
  mechanics?: readonly string[];
};

const moodRules: readonly Rule[] = [
  {
    value: "casual",
    categories: ["Party Game"],
    mechanics: ["Flicking", "Stacking and Balancing", "Speed Matching"]
  },
  { value: "cozy", categories: ["Farming"] },
  {
    value: "strategic",
    categories: ["Civilization", "Economic", "Political", "Wargame"],
    mechanics: [
      "Area Majority / Influence",
      "Deck, Bag, and Pool Building",
      "Tech Trees / Tech Tracks",
      "Variable Player Powers",
      "Worker Placement"
    ]
  },
  {
    value: "puzzly",
    categories: ["Deduction", "Puzzle", "Word Game"],
    mechanics: ["Connections", "Deduction", "Pattern Building", "Pattern Recognition"]
  },
  {
    value: "social",
    categories: ["Party Game"],
    mechanics: [
      "Acting",
      "Communication Limits",
      "Negotiation",
      "Player Judge",
      "Questions and Answers",
      "Team-Based Game",
      "Voting"
    ]
  },
  {
    value: "silly",
    categories: ["Humor", "Party Game"],
    mechanics: ["Acting", "Flicking", "Singing", "Stacking and Balancing"]
  },
  {
    value: "tense",
    categories: ["Horror", "Racing"],
    mechanics: ["Hidden Roles", "Player Elimination", "Push Your Luck", "Real-Time", "Traitor Game"]
  },
  {
    value: "thematic",
    categories: [
      "Adventure",
      "Exploration",
      "Fantasy",
      "Horror",
      "Novel-based",
      "Science Fiction",
      "Video Game Theme"
    ],
    mechanics: [
      "Narrative Choice / Paragraph",
      "Role Playing",
      "Scenario / Mission / Campaign Game",
      "Storytelling"
    ]
  },
  {
    value: "chaotic",
    mechanics: ["Flicking", "Real-Time", "Speed Matching", "Stacking and Balancing"]
  }
];

const accessibilityRules: readonly Rule[] = [
  {
    value: "language-dependent",
    categories: ["Trivia", "Word Game"],
    mechanics: [
      "Acting",
      "Communication Limits",
      "Player Judge",
      "Questions and Answers",
      "Storytelling"
    ]
  },
  { value: "heavy-reading", mechanics: ["Narrative Choice / Paragraph"] },
  { value: "memory-heavy", mechanics: ["Memory"] },
  {
    value: "fine-motor",
    categories: ["Action / Dexterity"],
    mechanics: ["Flicking", "Physical Removal", "Speed Matching", "Stacking and Balancing"]
  }
];

const contentRules: readonly Rule[] = [
  { value: "alcohol", categories: ["Drinking"] },
  { value: "horror", categories: ["Horror"] },
  { value: "violence", categories: ["Fighting", "Murder/Mystery", "Wargame", "Zombies"] },
  { value: "mature-themes", categories: ["Mature / Adult"] }
];

const normalized = (values: readonly string[]) =>
  new Set(values.map((value) => value.trim().toLocaleLowerCase()));

const matches = (values: Set<string>, candidates: readonly string[] | undefined) =>
  candidates?.some((candidate) => values.has(candidate.toLocaleLowerCase())) ?? false;

const infer = (rules: readonly Rule[], categories: Set<string>, mechanics: Set<string>) =>
  rules
    .filter((rule) => matches(categories, rule.categories) || matches(mechanics, rule.mechanics))
    .map((rule) => rule.value);

export function inferHowItPlays(metadata: BggMetadata): InferredSuggestionFields {
  const categories = normalized(metadata.categories);
  const mechanics = normalized(metadata.mechanics);
  return {
    moods: infer(moodRules, categories, mechanics),
    accessibilityFlags: infer(accessibilityRules, categories, mechanics),
    contentFlags: infer(contentRules, categories, mechanics)
  };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const allowedValues = {
  moods: new Set<string>(MOOD_OPTIONS.map((option) => option.value)),
  accessibilityFlags: new Set<string>(ACCESSIBILITY_OPTIONS.map((option) => option.value)),
  contentFlags: new Set<string>(CONTENT_OPTIONS.map((option) => option.value))
};

export function parseSetupSuggestions(
  value: unknown,
  expectedSourceSha: string
): SetupSuggestionsPayload {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("sourceSha" in value) ||
    value.sourceSha !== expectedSourceSha ||
    !("enriched" in value) ||
    typeof value.enriched !== "boolean" ||
    !("suggestions" in value) ||
    !Array.isArray(value.suggestions)
  ) {
    throw new Error("Setup suggestions do not match the current questionnaire.");
  }

  const slugs = new Set<string>();
  const suggestions = value.suggestions.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("slug" in candidate) ||
      typeof candidate.slug !== "string" ||
      slugs.has(candidate.slug) ||
      !("bggId" in candidate) ||
      !Number.isSafeInteger(candidate.bggId) ||
      !("moods" in candidate) ||
      !isStringArray(candidate.moods) ||
      candidate.moods.some((item: string) => !allowedValues.moods.has(item)) ||
      !("accessibilityFlags" in candidate) ||
      !isStringArray(candidate.accessibilityFlags) ||
      candidate.accessibilityFlags.some(
        (item: string) => !allowedValues.accessibilityFlags.has(item)
      ) ||
      !("contentFlags" in candidate) ||
      !isStringArray(candidate.contentFlags) ||
      candidate.contentFlags.some((item: string) => !allowedValues.contentFlags.has(item)) ||
      !("categories" in candidate) ||
      !isStringArray(candidate.categories) ||
      !("mechanics" in candidate) ||
      !isStringArray(candidate.mechanics)
    ) {
      throw new Error("Setup suggestions contain an invalid game.");
    }
    slugs.add(candidate.slug);
    return candidate as HowItPlaysSuggestion;
  });

  return { schemaVersion: 1, sourceSha: value.sourceSha, enriched: value.enriched, suggestions };
}

const joined = (values: string[]) => [...new Set(values)].join(";");
const split = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function applyHowItPlaysSuggestion<T extends EditableHowItPlays>(
  game: T,
  suggestion: HowItPlaysSuggestion | undefined
): T {
  if (!suggestion) return game;
  return {
    ...game,
    moods: joined([...split(game.moods), ...suggestion.moods]),
    accessibilityFlags: joined([
      ...split(game.accessibilityFlags),
      ...suggestion.accessibilityFlags
    ]),
    contentFlags: joined([...split(game.contentFlags), ...suggestion.contentFlags])
  };
}
