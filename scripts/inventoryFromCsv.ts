import type {
  Availability,
  GameMode,
  Inventory,
  InventoryGame,
  OwnedExpansion,
  SetupTimeRange,
  TableSpace,
  ValueOverrides
} from "../shared/inventory/types.js";
import { parseInventory } from "../shared/inventory/schema.js";
import { SETUP_TIME_RANGE_VALUES } from "../shared/setup/houseOptions";
import { csvRecords } from "../shared/csv";

const list = (value: string) =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
const number = (value: string) => (value ? Number(value) : undefined);
const boolean = (value: string) => value.toLocaleLowerCase() === "true";
const optional = (value: string) => value || undefined;
const overrides = (row: Record<string, string>): ValueOverrides | undefined => {
  const value = {
    minPlayers: number(row.override_min_players),
    maxPlayers: number(row.override_max_players),
    minMinutes: number(row.override_min_minutes),
    maxMinutes: number(row.override_max_minutes),
    minAge: number(row.override_min_age)
  };
  return Object.values(value).some((item) => item !== undefined) ? value : undefined;
};

export function inventoryFromCsv(source: string): Inventory {
  const rows = csvRecords(source);
  const games: InventoryGame[] = [];
  const expansions: Array<{
    parentBggId?: number;
    parentSlug?: string;
    expansion: OwnedExpansion;
    row: number;
  }> = [];
  const rowErrors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const bggId = row.bgg_id ? Number(row.bgg_id) : undefined;
    if (bggId !== undefined && (!Number.isInteger(bggId) || bggId <= 0)) {
      rowErrors.push(`Row ${rowNumber}: bgg_id must be blank or a positive integer.`);
      return;
    }
    const rowOverrides = overrides(row);
    const setupTimeRange = optional(row.setup_time_range);
    if (
      setupTimeRange &&
      !SETUP_TIME_RANGE_VALUES.some((candidate) => candidate === setupTimeRange)
    ) {
      rowErrors.push(`Row ${rowNumber}: setup_time_range is invalid.`);
      return;
    }
    if (bggId === undefined) {
      const missing = [
        ["source_url", row.source_url],
        ...(row.kind === "game" || boolean(row.standalone)
          ? [
              ["override_min_players", row.override_min_players],
              ["override_max_players", row.override_max_players],
              ["override_min_minutes", row.override_min_minutes],
              ["override_max_minutes", row.override_max_minutes],
              ["override_min_age", row.override_min_age]
            ]
          : [])
      ]
        .filter(([, value]) => !value)
        .map(([field]) => field);
      if (missing.length) {
        rowErrors.push(
          `Row ${rowNumber}: a local-only item without bgg_id requires ${missing.join(", ")}.`
        );
        return;
      }
    }
    if (row.kind === "game") {
      games.push({
        slug: row.slug,
        bggId,
        sourceUrl: optional(row.source_url),
        name: row.name,
        edition: optional(row.edition),
        quantity: number(row.quantity) ?? 1,
        shelf: optional(row.shelf),
        availability: (row.availability || "available") as Availability,
        learned: boolean(row.learned),
        house: {
          rating: number(row.house_rating),
          setupTimeRange: setupTimeRange as SetupTimeRange | undefined,
          teachDifficulty: number(row.teach_difficulty),
          tableSpace: optional(row.table_space) as TableSpace | undefined,
          interaction: number(row.interaction),
          luck: number(row.luck),
          downtime: number(row.downtime),
          modes: list(row.modes) as GameMode[],
          moods: list(row.moods),
          accessibilityFlags: list(row.accessibility_flags),
          contentFlags: list(row.content_flags),
          recommendationNotes: optional(row.recommendation_notes)
        },
        overrides: rowOverrides,
        expansions: []
      });
    } else if (row.kind === "expansion") {
      const parentBggId = row.parent_bgg_id ? Number(row.parent_bgg_id) : undefined;
      const parentSlug = optional(row.parent_slug);
      if (
        (parentBggId !== undefined && (!Number.isInteger(parentBggId) || parentBggId <= 0)) ||
        (parentBggId === undefined && !parentSlug)
      ) {
        rowErrors.push(
          `Row ${rowNumber}: an expansion requires a valid parent_slug or parent_bgg_id.`
        );
        return;
      }
      expansions.push({
        parentBggId,
        parentSlug,
        row: rowNumber,
        expansion: {
          slug: row.slug,
          bggId,
          sourceUrl: optional(row.source_url),
          name: row.name,
          standalone: boolean(row.standalone),
          edition: optional(row.edition),
          quantity: number(row.quantity) ?? 1,
          shelf: optional(row.shelf),
          availability: (row.availability || "available") as Availability,
          learned: boolean(row.learned),
          overrides: rowOverrides
        }
      });
    } else {
      rowErrors.push(`Row ${rowNumber}: kind must be "game" or "expansion".`);
    }
  });

  expansions.forEach(({ parentBggId, parentSlug, expansion, row }) => {
    const parentById =
      parentBggId === undefined ? undefined : games.find((game) => game.bggId === parentBggId);
    const parentBySlug = parentSlug ? games.find((game) => game.slug === parentSlug) : undefined;
    if (parentById && parentBySlug && parentById !== parentBySlug) {
      rowErrors.push(`Row ${row}: parent_slug and parent_bgg_id identify different games.`);
      return;
    }
    const parent = parentBySlug ?? parentById;
    if (!parent) rowErrors.push(`Row ${row}: the expansion parent was not imported.`);
    else parent.expansions.push(expansion);
  });
  if (rowErrors.length) throw new Error(rowErrors.join("\n"));

  games.sort((left, right) => left.name.localeCompare(right.name));
  games.forEach((game) =>
    game.expansions.sort((left, right) => left.name.localeCompare(right.name))
  );
  return parseInventory({ version: 1, games }) as Inventory;
}
