import { parseCsv } from "../csv.js";
import {
  HOUSE_ANSWER_FIELDS,
  HOUSE_ANSWER_HEADERS,
  houseAnswersToCsv,
  parseHouseAnswer,
  type HouseAnswer
} from "./houseAnswers.js";

export type HouseIntakeRow = HouseAnswer;
export const houseIntakeToCsv = houseAnswersToCsv;

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

export function validateHouseIntakeCsv(source: string): HouseIntakeRow[] {
  const [headers, ...rows] = parseCsv(source);
  if (!headers || headers.join(",") !== HOUSE_ANSWER_HEADERS.join(",")) {
    throw new Error(`House intake headers must be: ${HOUSE_ANSWER_HEADERS.join(",")}`);
  }
  const seen = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== HOUSE_ANSWER_HEADERS.length) {
      throw new Error(`House intake row ${index + 2} has ${values.length} columns.`);
    }
    const record = Object.fromEntries(
      HOUSE_ANSWER_HEADERS.map((header, column) => [header, values[column].trim()])
    );
    const row = parseHouseAnswer(
      Object.fromEntries(
        HOUSE_ANSWER_FIELDS.map(([header, property]) => [property, record[header]])
      ),
      `House intake row ${index + 2}`
    );
    if (seen.has(record.slug)) throw new Error(`Duplicate house intake slug: ${record.slug}.`);
    seen.add(record.slug);
    return row;
  });
}
