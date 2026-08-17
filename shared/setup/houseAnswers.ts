import { recordsToCsv } from "../csv.js";
import { SETUP_TIME_RANGE_VALUES } from "./houseOptions.js";

export const HOUSE_ANSWER_FIELDS = [
  ["slug", "slug"],
  ["title", "title"],
  ["availability", "availability"],
  ["learned", "learned"],
  ["shelf", "shelf"],
  ["house_rating", "houseRating"],
  ["setup_time_range", "setupTimeRange"],
  ["teach_difficulty", "teachDifficulty"],
  ["table_space", "tableSpace"],
  ["interaction", "interaction"],
  ["luck", "luck"],
  ["downtime", "downtime"],
  ["modes", "modes"],
  ["moods", "moods"],
  ["accessibility_flags", "accessibilityFlags"],
  ["content_flags", "contentFlags"],
  ["recommendation_notes", "recommendationNotes"],
  ["local_values_required", "localValuesRequired"],
  ["local_min_players", "localMinPlayers"],
  ["local_max_players", "localMaxPlayers"],
  ["local_min_minutes", "localMinMinutes"],
  ["local_max_minutes", "localMaxMinutes"],
  ["local_min_age", "localMinAge"]
] as const;

export const HOUSE_ANSWER_HEADERS = HOUSE_ANSWER_FIELDS.map(([header]) => header);
type HouseAnswerProperty = (typeof HOUSE_ANSWER_FIELDS)[number][1];

export type HouseAnswer = Record<HouseAnswerProperty, string>;

const validateHouseAnswerRow = (row: HouseAnswer, context: string) => {
  if (!row.slug || !row.title) throw new Error(`${context} needs identity.`);
  if (!["available", "loaned", "incomplete", "unavailable"].includes(row.availability)) {
    throw new Error(`${context} has invalid availability.`);
  }
  if (row.learned && !["yes", "no"].includes(row.learned)) {
    throw new Error(`${context} has invalid learned value.`);
  }
  if (row.tableSpace && !["compact", "standard", "large"].includes(row.tableSpace)) {
    throw new Error(`${context} has invalid table_space.`);
  }
  if (
    row.setupTimeRange &&
    !SETUP_TIME_RANGE_VALUES.some((value) => value === row.setupTimeRange)
  ) {
    throw new Error(`${context} has invalid setup_time_range.`);
  }
  for (const [field, label] of [
    ["houseRating", "house_rating"],
    ["teachDifficulty", "teach_difficulty"],
    ["interaction", "interaction"],
    ["luck", "luck"],
    ["downtime", "downtime"]
  ] as const) {
    const value = row[field];
    if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
      throw new Error(`${context} has invalid ${label}.`);
    }
  }
  return row;
};

export function parseHouseAnswer(value: unknown, context = "House answer"): HouseAnswer {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} is invalid.`);
  }
  const candidate = value as Record<string, unknown>;
  const entries = HOUSE_ANSWER_FIELDS.map(([, property]) => {
    const fieldValue = candidate[property];
    if (typeof fieldValue !== "string") {
      throw new Error(`${context} has invalid ${property}.`);
    }
    return [property, fieldValue] as const;
  });
  return validateHouseAnswerRow(Object.fromEntries(entries) as HouseAnswer, context);
}

export function houseAnswersToCsv(rows: HouseAnswer[]): string {
  return recordsToCsv(
    rows.map((row) =>
      Object.fromEntries(HOUSE_ANSWER_FIELDS.map(([header, property]) => [header, row[property]]))
    ),
    [...HOUSE_ANSWER_HEADERS]
  );
}
