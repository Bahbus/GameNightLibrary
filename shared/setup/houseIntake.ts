import { parseCsv, recordsToCsv } from "../csv.js";
import { SETUP_TIME_RANGE_VALUES } from "./houseOptions.js";

const HOUSE_INTAKE_HEADERS = [
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

export interface HouseIntakeRow {
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

export const houseSetupRequired = (rows: HouseIntakeRow[]) =>
  rows.some(
    (row) =>
      !["yes", "no"].includes(row.learned) ||
      (row.localValuesRequired === "yes" &&
        (!row.modes ||
          [
            row.localMinPlayers,
            row.localMaxPlayers,
            row.localMinMinutes,
            row.localMaxMinutes,
            row.localMinAge
          ].some((value) => !value)))
  );

export function houseIntakeToCsv(rows: HouseIntakeRow[]): string {
  return recordsToCsv(
    rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      availability: row.availability,
      learned: row.learned,
      shelf: row.shelf,
      house_rating: row.houseRating,
      setup_time_range: row.setupTimeRange,
      teach_difficulty: row.teachDifficulty,
      table_space: row.tableSpace,
      interaction: row.interaction,
      luck: row.luck,
      downtime: row.downtime,
      modes: row.modes,
      moods: row.moods,
      accessibility_flags: row.accessibilityFlags,
      content_flags: row.contentFlags,
      recommendation_notes: row.recommendationNotes,
      local_values_required: row.localValuesRequired,
      local_min_players: row.localMinPlayers,
      local_max_players: row.localMaxPlayers,
      local_min_minutes: row.localMinMinutes,
      local_max_minutes: row.localMaxMinutes,
      local_min_age: row.localMinAge
    })),
    [...HOUSE_INTAKE_HEADERS]
  );
}

export function validateHouseIntakeCsv(source: string): HouseIntakeRow[] {
  const [headers, ...rows] = parseCsv(source);
  if (!headers || headers.join(",") !== HOUSE_INTAKE_HEADERS.join(",")) {
    throw new Error(`House intake headers must be: ${HOUSE_INTAKE_HEADERS.join(",")}`);
  }
  const seen = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== HOUSE_INTAKE_HEADERS.length) {
      throw new Error(`House intake row ${index + 2} has ${values.length} columns.`);
    }
    const record = Object.fromEntries(
      HOUSE_INTAKE_HEADERS.map((header, column) => [header, values[column].trim()])
    );
    if (!record.slug || !record.title)
      throw new Error(`House intake row ${index + 2} needs identity.`);
    if (seen.has(record.slug)) throw new Error(`Duplicate house intake slug: ${record.slug}.`);
    seen.add(record.slug);
    if (!["available", "loaned", "incomplete", "unavailable"].includes(record.availability)) {
      throw new Error(`House intake row ${index + 2} has invalid availability.`);
    }
    if (record.learned && !["yes", "no"].includes(record.learned)) {
      throw new Error(`House intake row ${index + 2} has invalid learned value.`);
    }
    if (record.table_space && !["compact", "standard", "large"].includes(record.table_space)) {
      throw new Error(`House intake row ${index + 2} has invalid table_space.`);
    }
    if (
      record.setup_time_range &&
      !SETUP_TIME_RANGE_VALUES.some((value) => value === record.setup_time_range)
    ) {
      throw new Error(`House intake row ${index + 2} has invalid setup_time_range.`);
    }
    for (const field of [
      "house_rating",
      "teach_difficulty",
      "interaction",
      "luck",
      "downtime"
    ] as const) {
      const value = record[field];
      if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
        throw new Error(`House intake row ${index + 2} has invalid ${field}.`);
      }
    }
    return {
      slug: record.slug,
      title: record.title,
      availability: record.availability,
      learned: record.learned,
      shelf: record.shelf,
      houseRating: record.house_rating,
      setupTimeRange: record.setup_time_range,
      teachDifficulty: record.teach_difficulty,
      tableSpace: record.table_space,
      interaction: record.interaction,
      luck: record.luck,
      downtime: record.downtime,
      modes: record.modes,
      moods: record.moods,
      accessibilityFlags: record.accessibility_flags,
      contentFlags: record.content_flags,
      recommendationNotes: record.recommendation_notes,
      localValuesRequired: record.local_values_required,
      localMinPlayers: record.local_min_players,
      localMaxPlayers: record.local_max_players,
      localMinMinutes: record.local_min_minutes,
      localMaxMinutes: record.local_max_minutes,
      localMinAge: record.local_min_age
    };
  });
}
