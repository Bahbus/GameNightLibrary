import {
  houseIntakeToCsv,
  validateHouseIntakeCsv,
  type HouseIntakeRow
} from "../scripts/houseIntake.js";
import { SETUP_TIME_RANGE_VALUES } from "../src/lib/houseOptions.js";

const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;
const INTEGER = /^\d+$/;
const TEXT_LIMIT = 2_000;
const LIST_LIMIT = 500;

const numericFields = [
  "localMinPlayers",
  "localMaxPlayers",
  "localMinMinutes",
  "localMaxMinutes",
  "localMinAge"
] as const;

const textFields = ["shelf", "recommendationNotes"] as const;
const listFields = ["moods", "accessibilityFlags", "contentFlags"] as const;
const numericLimits: Record<(typeof numericFields)[number], [number, number]> = {
  localMinPlayers: [1, 99],
  localMaxPlayers: [1, 99],
  localMinMinutes: [1, 10_080],
  localMaxMinutes: [1, 10_080],
  localMinAge: [0, 99]
};

const assertSafeText = (value: string, label: string, row: number, limit: number) => {
  if (value.length > limit) throw new Error(`House intake row ${row} has an overlong ${label}.`);
  if (FORMULA_PREFIX.test(value)) {
    throw new Error(`House intake row ${row} has an unsafe spreadsheet formula in ${label}.`);
  }
};

export function validateHouseSubmission(currentCsv: string, submittedCsv: string) {
  if (Buffer.byteLength(submittedCsv, "utf8") > 256 * 1_024) {
    throw new Error("House answers exceed the 256 KiB submission limit.");
  }
  const current = validateHouseIntakeCsv(currentCsv);
  const submitted = validateHouseIntakeCsv(submittedCsv);
  if (current.length !== submitted.length) {
    throw new Error("The submitted game list does not match the current setup list.");
  }

  const submittedBySlug = new Map(submitted.map((row) => [row.slug, row]));
  if (submittedBySlug.size !== current.length) {
    throw new Error("The submitted game list does not match the current setup list.");
  }

  for (let index = 0; index < current.length; index += 1) {
    const source = current[index];
    const answer = submittedBySlug.get(source.slug);
    const row = index + 2;
    if (!answer) {
      throw new Error("The submitted game list does not match the current setup list.");
    }
    if (
      answer.slug !== source.slug ||
      answer.title !== source.title ||
      answer.localValuesRequired !== source.localValuesRequired
    ) {
      throw new Error(`House intake row ${row} changed a protected identity field.`);
    }
    if (!["yes", "no"].includes(answer.learned)) {
      throw new Error(`House intake row ${row} must state whether the game is learned.`);
    }
    if (
      answer.setupTimeRange &&
      !SETUP_TIME_RANGE_VALUES.some((value) => value === answer.setupTimeRange)
    ) {
      throw new Error(`House intake row ${row} has an invalid setupTimeRange.`);
    }
    const modes = answer.modes
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    if (modes.some((value) => !["competitive", "cooperative", "team", "solo"].includes(value))) {
      throw new Error(`House intake row ${row} has an invalid game mode.`);
    }
    for (const field of numericFields) {
      const value = answer[field];
      if (value && !INTEGER.test(value)) {
        throw new Error(`House intake row ${row} has invalid ${field}.`);
      }
      const [minimum, maximum] = numericLimits[field];
      if (value && (Number(value) < minimum || Number(value) > maximum)) {
        throw new Error(`House intake row ${row} has out-of-range ${field}.`);
      }
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
      throw new Error(`House intake row ${row} needs every local filter value.`);
    }
    if (answer.localValuesRequired === "yes" && !modes.length) {
      throw new Error(`House intake row ${row} needs at least one game mode.`);
    }
    if (
      answer.localMinPlayers &&
      answer.localMaxPlayers &&
      Number(answer.localMinPlayers) > Number(answer.localMaxPlayers)
    ) {
      throw new Error(`House intake row ${row} has an inverted player range.`);
    }
    if (
      answer.localMinMinutes &&
      answer.localMaxMinutes &&
      Number(answer.localMinMinutes) > Number(answer.localMaxMinutes)
    ) {
      throw new Error(`House intake row ${row} has an inverted duration range.`);
    }
    for (const field of textFields) assertSafeText(answer[field], field, row, TEXT_LIMIT);
    for (const field of listFields) assertSafeText(answer[field], field, row, LIST_LIMIT);
  }
  const sourceOrdered = current.map((row) => submittedBySlug.get(row.slug)!);
  return { rows: sourceOrdered, csv: houseIntakeToCsv(sourceOrdered) };
}

export const questionnaireFromCsv = (sourceSha: string, csv: string) => ({
  schemaVersion: 2 as const,
  sourceSha,
  games: validateHouseIntakeCsv(csv)
});

export type ValidatedHouseSubmission = {
  rows: HouseIntakeRow[];
  csv: string;
};
