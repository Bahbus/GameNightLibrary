import { parseInventory } from "../shared/inventory/schema.js";
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
import { SETUP_TIME_RANGE_VALUES } from "../shared/setup/houseOptions";
import { fieldsFromIssue } from "./issueRequest";

export type InventoryOperation = "add" | "update" | "remove";

const availabilityValues = [
  "available",
  "loaned",
  "incomplete",
  "unavailable"
] as const satisfies readonly Availability[];
const tableSpaceValues = ["compact", "standard", "large"] as const satisfies readonly TableSpace[];
const modeValues = [
  "competitive",
  "cooperative",
  "team",
  "solo"
] as const satisfies readonly GameMode[];

const integer = (value: string | undefined, label: string) => {
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
};

const optionalInteger = (value: string | undefined, label: string) =>
  value ? integer(value, label) : undefined;

const optionalNonnegativeInteger = (value: string | undefined, label: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a nonnegative integer.`);
  }
  return parsed;
};

const optionalRating = (value: string | undefined, label: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error(`${label} must be between 1 and 5.`);
  }
  return parsed;
};

const parseBoolean = (
  value: string | undefined,
  label: string,
  defaultValue?: boolean
): boolean => {
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`${label} must be Yes or No.`);
  }
  const normalized = value.toLocaleLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized.includes("[x]")) return true;
  if (normalized === "no" || normalized === "false" || normalized.includes("[ ]")) return false;
  throw new Error(`${label} must be Yes or No.`);
};

const parseAvailability = (
  value: string | undefined,
  defaultValue?: Availability
): Availability => {
  if (!value && defaultValue) return defaultValue;
  if (availabilityValues.includes(value as Availability)) return value as Availability;
  throw new Error(`Availability must be one of: ${availabilityValues.join(", ")}.`);
};

const optionalTableSpace = (value: string | undefined) => {
  if (!value) return undefined;
  if (tableSpaceValues.includes(value as TableSpace)) return value as TableSpace;
  throw new Error(`Table space must be one of: ${tableSpaceValues.join(", ")}.`);
};

const optionalSetupTimeRange = (value: string | undefined) => {
  if (!value) return undefined;
  if (SETUP_TIME_RANGE_VALUES.some((range) => range === value)) return value as SetupTimeRange;
  throw new Error(`Setup time range must be one of: ${SETUP_TIME_RANGE_VALUES.join(", ")}.`);
};

const list = (value: string | undefined) =>
  value
    ?.split(";")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const modes = (value: string | undefined) => {
  const values = list(value);
  const invalid = values.filter((item) => !modeValues.includes(item as GameMode));
  if (invalid.length) throw new Error(`Modes contains invalid values: ${invalid.join(", ")}.`);
  return values as GameMode[];
};

const overrideValues = (fields: Map<string, string>): ValueOverrides => ({
  minPlayers: optionalInteger(fields.get("Minimum players"), "Minimum players"),
  maxPlayers: optionalInteger(fields.get("Maximum players"), "Maximum players"),
  minMinutes: optionalNonnegativeInteger(fields.get("Minimum minutes"), "Minimum minutes"),
  maxMinutes: optionalNonnegativeInteger(fields.get("Maximum minutes"), "Maximum minutes"),
  minAge: optionalNonnegativeInteger(fields.get("Minimum age"), "Minimum age")
});

const definedEntries = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;

const locate = (inventory: Inventory, targetSlug: string) => {
  const base = inventory.games.find((game) => game.slug === targetSlug);
  if (base) return { kind: "game" as const, base };
  for (const parent of inventory.games) {
    const expansion = parent.expansions.find((item) => item.slug === targetSlug);
    if (expansion) return { kind: "expansion" as const, base: parent, expansion };
  }
  return undefined;
};

const findByBggId = (inventory: Inventory, bggId: number) => {
  for (const game of inventory.games) {
    if (game.bggId === bggId) return game;
    const expansion = game.expansions.find((item) => item.bggId === bggId);
    if (expansion) return expansion;
  }
  return undefined;
};

const applyUpdate = (target: InventoryGame | OwnedExpansion, fields: Map<string, string>) => {
  const name = fields.get("Game name");
  const shelf = fields.get("Shelf label");
  const availability = fields.get("Availability");
  const notes = fields.get("Ownership notes");
  const sourceUrl = fields.get("Source URL");
  const edition = fields.get("Edition");
  const quantity = optionalInteger(fields.get("Quantity"), "Quantity");

  if (name) target.name = name;
  if (edition) target.edition = edition === "(clear)" ? undefined : edition;
  if (quantity !== undefined) target.quantity = quantity;
  if (shelf) target.shelf = shelf === "(clear)" ? undefined : shelf;
  if (availability) target.availability = parseAvailability(availability);
  if (fields.has("Learned")) {
    target.learned = parseBoolean(fields.get("Learned"), "Learned");
  }
  if (notes) target.ownershipNotes = notes === "(clear)" ? undefined : notes;
  if (sourceUrl) target.sourceUrl = sourceUrl === "(clear)" ? undefined : sourceUrl;

  const nextOverrides = definedEntries(overrideValues(fields));
  if (Object.keys(nextOverrides).length) {
    target.overrides = { ...target.overrides, ...nextOverrides };
  }
};

export function applyInventoryTransaction(
  sourceInventory: Inventory,
  operation: InventoryOperation,
  body: string
): Inventory {
  const inventory = parseInventory(JSON.parse(JSON.stringify(sourceInventory)) as unknown);
  const fields = fieldsFromIssue(body);
  const slug = fields.get("Stable slug");
  const bggId = optionalInteger(fields.get("BGG ID"), "BGG ID");

  if (operation === "add") {
    const name = fields.get("Game name");
    if (!name || !slug) throw new Error("Game name and Stable slug are required.");
    if (locate(inventory, slug)) throw new Error(`Slug ${slug} is already in the inventory.`);
    if (bggId !== undefined && findByBggId(inventory, bggId)) {
      throw new Error(`BGG ID ${bggId} is already in the inventory.`);
    }

    const parentSlug = fields.get("Parent slug");
    const parentBggId = optionalInteger(fields.get("Parent BGG ID"), "Parent BGG ID");
    const parentBySlug = parentSlug
      ? inventory.games.find((game) => game.slug === parentSlug)
      : undefined;
    const parentById =
      parentBggId === undefined
        ? undefined
        : inventory.games.find((game) => game.bggId === parentBggId);

    if (parentSlug && !parentBySlug) {
      throw new Error(`Parent slug ${parentSlug} is not in the inventory.`);
    }
    if (parentBggId !== undefined && !parentById) {
      throw new Error(`Parent BGG ID ${parentBggId} is not in the inventory.`);
    }
    if (parentBySlug && parentById && parentBySlug !== parentById) {
      throw new Error("Parent slug and Parent BGG ID identify different games.");
    }

    const shared = {
      slug,
      bggId,
      sourceUrl: fields.get("Source URL"),
      name,
      edition: fields.get("Edition"),
      quantity: optionalInteger(fields.get("Quantity"), "Quantity") ?? 1,
      shelf: fields.get("Shelf label"),
      availability: parseAvailability(fields.get("Availability"), "available"),
      learned: parseBoolean(fields.get("Learned"), "Learned", false),
      ownershipNotes: fields.get("Ownership notes"),
      overrides: overrideValues(fields)
    };
    const parent = parentBySlug ?? parentById;

    if (parent) {
      const expansion: OwnedExpansion = {
        ...shared,
        standalone: parseBoolean(fields.get("Standalone"), "Standalone", false),
        compatibilityNotes: fields.get("Compatibility notes")
      };
      parent.expansions.push(expansion);
      parent.expansions.sort((left, right) => left.name.localeCompare(right.name));
    } else {
      const game: InventoryGame = {
        ...shared,
        house: {
          rating: optionalRating(fields.get("House rating"), "House rating"),
          setupTimeRange: optionalSetupTimeRange(fields.get("Setup time range")),
          teachDifficulty: optionalRating(fields.get("Teach difficulty"), "Teach difficulty"),
          tableSpace: optionalTableSpace(fields.get("Table space")),
          interaction: optionalRating(fields.get("Interaction"), "Interaction"),
          luck: optionalRating(fields.get("Luck"), "Luck"),
          downtime: optionalRating(fields.get("Downtime"), "Downtime"),
          modes: modes(fields.get("Modes")),
          moods: list(fields.get("Moods")),
          accessibilityFlags: list(fields.get("Accessibility flags")),
          contentFlags: list(fields.get("Content flags")),
          recommendationNotes: fields.get("Recommendation notes")
        },
        expansions: []
      };
      inventory.games.push(game);
      inventory.games.sort((left, right) => left.name.localeCompare(right.name));
    }
  } else {
    if (!slug) throw new Error("Stable slug is required.");
    const found = locate(inventory, slug);
    if (!found) throw new Error(`Slug ${slug} is not in the inventory.`);
    const target = found.kind === "game" ? found.base : found.expansion;
    if (bggId !== undefined && target.bggId !== bggId) {
      throw new Error(`BGG ID ${bggId} does not match slug ${slug}.`);
    }

    if (operation === "update") {
      applyUpdate(target, fields);
      if (found.kind === "game") {
        const rating = optionalRating(fields.get("House rating"), "House rating");
        const setup = optionalSetupTimeRange(fields.get("Setup time range"));
        const teach = optionalRating(fields.get("Teach difficulty"), "Teach difficulty");
        const tableSpace = optionalTableSpace(fields.get("Table space"));
        const interaction = optionalRating(fields.get("Interaction"), "Interaction");
        const luck = optionalRating(fields.get("Luck"), "Luck");
        const downtime = optionalRating(fields.get("Downtime"), "Downtime");
        if (rating !== undefined) found.base.house.rating = rating;
        if (setup !== undefined) found.base.house.setupTimeRange = setup;
        if (teach !== undefined) found.base.house.teachDifficulty = teach;
        if (tableSpace !== undefined) found.base.house.tableSpace = tableSpace;
        if (interaction !== undefined) found.base.house.interaction = interaction;
        if (luck !== undefined) found.base.house.luck = luck;
        if (downtime !== undefined) found.base.house.downtime = downtime;
        if (fields.has("Modes")) found.base.house.modes = modes(fields.get("Modes"));
        if (fields.has("Moods")) found.base.house.moods = list(fields.get("Moods"));
        if (fields.has("Accessibility flags")) {
          found.base.house.accessibilityFlags = list(fields.get("Accessibility flags"));
        }
        if (fields.has("Content flags")) {
          found.base.house.contentFlags = list(fields.get("Content flags"));
        }
        const recommendation = fields.get("Recommendation notes");
        if (recommendation) {
          found.base.house.recommendationNotes =
            recommendation === "(clear)" ? undefined : recommendation;
        }
      }
    } else {
      if (!parseBoolean(fields.get("Confirm removal"), "Confirm removal")) {
        throw new Error("The removal confirmation must be checked.");
      }
      if (found.kind === "game") {
        inventory.games = inventory.games.filter((game) => game.slug !== slug);
      } else {
        found.base.expansions = found.base.expansions.filter((item) => item.slug !== slug);
      }
    }
  }

  return parseInventory(inventory);
}
