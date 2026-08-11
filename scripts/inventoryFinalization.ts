import type {
  Availability,
  GameMode,
  HouseEvaluation,
  Inventory,
  InventoryGame,
  OwnedExpansion,
  TableSpace,
  ValueOverrides
} from "../shared/inventory/types.js";
import { parseInventory } from "../shared/inventory/schema.js";
import { validateHouseSubmission } from "../service/houseSubmission";
import {
  buildHouseIntake,
  houseIntakeToCsv,
  validateHouseIntakeCsv,
  type HouseIntakeRow
} from "./houseIntake";
import { directBggId, parseMatchingManifest, type MatchingRow } from "./intakeMatching";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPLETE_STATUSES = new Set(["matched-from-source", "local-only"]);
const LOCAL_FIELDS = [
  "localMinPlayers",
  "localMaxPlayers",
  "localMinMinutes",
  "localMaxMinutes",
  "localMinAge"
] as const;

const optional = (value: string) => value || undefined;
const number = (value: string) => (value ? Number(value) : undefined);
const list = (value: string) => [
  ...new Set(
    value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
  )
];
const compareByName = (
  left: { name: string; slug: string },
  right: { name: string; slug: string }
) =>
  left.name.localeCompare(right.name, "en", { sensitivity: "base", numeric: true }) ||
  left.slug.localeCompare(right.slug);

const publicUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

function validateManifest(rows: MatchingRow[]): void {
  const errors: string[] = [];
  const slugRows = new Map<string, number>();
  const bggRows = new Map<number, number>();
  const baseSlugs = new Set(rows.filter((row) => row.kind === "game").map((row) => row.slug));

  if (!rows.length) errors.push("Matching manifest must contain at least one ownership row.");

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!SLUG.test(row.slug)) {
      errors.push(`Matching row ${rowNumber} has invalid slug ${row.slug || "(blank)"}.`);
    }
    const duplicateSlug = slugRows.get(row.slug);
    if (duplicateSlug !== undefined) {
      errors.push(
        `Matching row ${rowNumber} repeats slug ${row.slug} from matching row ${duplicateSlug}.`
      );
    } else {
      slugRows.set(row.slug, rowNumber);
    }
    if (!["game", "expansion"].includes(row.kind)) {
      errors.push(`Matching row ${rowNumber} has invalid kind ${row.kind}.`);
    }
    if (!row.proposedTitle) {
      errors.push(`Matching row ${rowNumber} needs a proposed title.`);
    }
    if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
      errors.push(`Matching row ${rowNumber} has invalid quantity.`);
    }
    if (!COMPLETE_STATUSES.has(row.matchStatus)) {
      errors.push(
        `Matching row ${rowNumber} is not resolved: ${row.matchStatus || "(blank status)"}.`
      );
    }
    if (!publicUrl(row.sourceUrl)) {
      errors.push(`Matching row ${rowNumber} needs a public HTTP(S) source URL.`);
    }
    if (row.matchStatus === "matched-from-source" && row.knownBggId === undefined) {
      errors.push(`Matching row ${rowNumber} is matched but has no BGG ID.`);
    }
    if (
      row.matchStatus === "matched-from-source" &&
      row.knownBggId !== undefined &&
      directBggId(row.sourceUrl) !== row.knownBggId
    ) {
      errors.push(
        `Matching row ${rowNumber} source URL does not identify BGG ID ${row.knownBggId}.`
      );
    }
    if (row.matchStatus === "local-only" && row.knownBggId !== undefined) {
      errors.push(`Matching row ${rowNumber} is local-only but also has a BGG ID.`);
    }
    if (row.matchStatus === "local-only" && directBggId(row.sourceUrl) !== undefined) {
      errors.push(`Matching row ${rowNumber} is local-only but uses a direct BGG item URL.`);
    }
    if (row.knownBggId !== undefined) {
      const duplicateBgg = bggRows.get(row.knownBggId);
      if (duplicateBgg !== undefined) {
        errors.push(
          `Matching row ${rowNumber} repeats BGG ID ${row.knownBggId} from matching row ${duplicateBgg}.`
        );
      } else {
        bggRows.set(row.knownBggId, rowNumber);
      }
    }
    if (row.kind === "game" && row.parentSlug) {
      errors.push(`Matching row ${rowNumber} is a base game but has parent ${row.parentSlug}.`);
    }
    if (row.kind === "game" && row.standalone) {
      errors.push(`Matching row ${rowNumber} is a base game and cannot be marked standalone.`);
    }
    if (row.kind === "expansion") {
      if (!row.parentSlug) {
        errors.push(`Matching row ${rowNumber} is an expansion without a parent slug.`);
      } else if (!baseSlugs.has(row.parentSlug)) {
        errors.push(
          `Matching row ${rowNumber} references missing base-game parent ${row.parentSlug}.`
        );
      }
      if (row.matchStatus === "local-only" && row.standalone) {
        errors.push(
          `Matching row ${rowNumber} is a local standalone expansion; model it as a base game so Setup can provide complete filter values.`
        );
      }
    }
  });

  if (errors.length) throw new Error(errors.join("\n"));
}

function houseEvaluation(row: HouseIntakeRow): HouseEvaluation {
  return {
    rating: number(row.houseRating),
    setupTimeRange: optional(row.setupTimeRange) as HouseEvaluation["setupTimeRange"],
    teachDifficulty: number(row.teachDifficulty),
    tableSpace: optional(row.tableSpace) as TableSpace | undefined,
    interaction: number(row.interaction),
    luck: number(row.luck),
    downtime: number(row.downtime),
    modes: list(row.modes) as GameMode[],
    moods: list(row.moods),
    accessibilityFlags: list(row.accessibilityFlags),
    contentFlags: list(row.contentFlags),
    recommendationNotes: optional(row.recommendationNotes)
  };
}

function localOverrides(row: HouseIntakeRow): ValueOverrides | undefined {
  if (row.localValuesRequired !== "yes") return undefined;
  return {
    minPlayers: number(row.localMinPlayers),
    maxPlayers: number(row.localMaxPlayers),
    minMinutes: number(row.localMinMinutes),
    maxMinutes: number(row.localMaxMinutes),
    minAge: number(row.localMinAge)
  };
}

const ownershipNotes = (row: MatchingRow) => optional(row.intakeNotes);
const compatibilityNotes = (row: MatchingRow) => optional(row.matchingNotes);

function preflightHouseAnswers(manifest: MatchingRow[], houseCsv: string): void {
  const expected = buildHouseIntake(manifest);
  const submitted = validateHouseIntakeCsv(houseCsv);
  const expectedBySlug = new Map(expected.map((row) => [row.slug, row]));
  const submittedBySlug = new Map(
    submitted.map((row, index) => [row.slug, { row, rowNumber: index + 2 }])
  );
  const errors: string[] = [];

  for (const expectedRow of expected) {
    const submittedEntry = submittedBySlug.get(expectedRow.slug);
    if (!submittedEntry) {
      errors.push(`Setup answers are missing base game ${expectedRow.slug}.`);
      continue;
    }
    const { row, rowNumber } = submittedEntry;
    if (
      row.title !== expectedRow.title ||
      row.localValuesRequired !== expectedRow.localValuesRequired
    ) {
      errors.push(`House intake row ${rowNumber} changed a protected identity field.`);
    }
    if (!["yes", "no"].includes(row.learned)) {
      errors.push(
        `House intake row ${rowNumber} (${row.slug}) must state whether the game is learned.`
      );
    }
    if (row.localValuesRequired === "yes" && LOCAL_FIELDS.some((field) => row[field] === "")) {
      errors.push(`House intake row ${rowNumber} (${row.slug}) needs every local filter value.`);
    }
    if (row.localValuesRequired === "yes" && !row.modes) {
      errors.push(`House intake row ${rowNumber} (${row.slug}) needs at least one game mode.`);
    }
    if (row.localValuesRequired === "no" && LOCAL_FIELDS.some((field) => row[field])) {
      errors.push(
        `House intake row ${rowNumber} has local filter values for BGG-linked game ${row.slug}.`
      );
    }
  }
  for (const { row, rowNumber } of submittedBySlug.values()) {
    if (!expectedBySlug.has(row.slug)) {
      errors.push(`House intake row ${rowNumber} contains unexpected game ${row.slug}.`);
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
}

export function finalizeInventory(matchingCsv: string, houseCsv: string): Inventory {
  const manifest = parseMatchingManifest(matchingCsv);
  validateManifest(manifest);

  preflightHouseAnswers(manifest, houseCsv);
  const expectedHouseCsv = houseIntakeToCsv(buildHouseIntake(manifest));
  const houseRows = validateHouseSubmission(expectedHouseCsv, houseCsv).rows;
  const houseBySlug = new Map(houseRows.map((row) => [row.slug, row]));

  const gamesBySlug = new Map<string, InventoryGame>();
  for (const row of manifest.filter((item) => item.kind === "game")) {
    const house = houseBySlug.get(row.slug);
    if (!house) throw new Error(`Setup answers are missing base game ${row.slug}.`);
    gamesBySlug.set(row.slug, {
      slug: row.slug,
      bggId: row.knownBggId,
      sourceUrl: row.sourceUrl,
      name: row.proposedTitle,
      edition: optional(row.editionOrOwnedDetail),
      quantity: row.quantity,
      shelf: optional(house.shelf),
      availability: house.availability as Availability,
      learned: house.learned === "yes",
      ownershipNotes: ownershipNotes(row),
      house: houseEvaluation(house),
      overrides: localOverrides(house),
      expansions: []
    });
  }

  for (const row of manifest.filter((item) => item.kind === "expansion")) {
    const parent = gamesBySlug.get(row.parentSlug);
    if (!parent) throw new Error(`Expansion ${row.slug} has no compiled parent ${row.parentSlug}.`);
    const expansion: OwnedExpansion = {
      slug: row.slug,
      bggId: row.knownBggId,
      sourceUrl: row.sourceUrl,
      name: row.proposedTitle,
      standalone: row.standalone,
      edition: optional(row.editionOrOwnedDetail),
      quantity: row.quantity,
      shelf: parent.shelf,
      availability: parent.availability,
      learned: parent.learned,
      ownershipNotes: ownershipNotes(row),
      compatibilityNotes: compatibilityNotes(row)
    };
    parent.expansions.push(expansion);
  }

  const games = [...gamesBySlug.values()].sort(compareByName);
  games.forEach((game) => game.expansions.sort(compareByName));
  return parseInventory({ version: 1, games });
}
