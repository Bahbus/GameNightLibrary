import { z } from "zod";
import { SETUP_TIME_RANGE_VALUES } from "../setup/houseOptions.js";
import type { Inventory, Wishlist } from "./types.js";

const availabilitySchema = z.enum(["available", "loaned", "incomplete", "unavailable"]);
const tableSpaceSchema = z.enum(["compact", "standard", "large"]);
const modeSchema = z.enum(["competitive", "cooperative", "team", "solo"]);
const localValues = ["minPlayers", "maxPlayers", "minMinutes", "maxMinutes", "minAge"] as const;

const overridesSchema = z
  .object({
    minPlayers: z.number().int().positive().optional(),
    maxPlayers: z.number().int().positive().optional(),
    minMinutes: z.number().int().nonnegative().optional(),
    maxMinutes: z.number().int().nonnegative().optional(),
    minAge: z.number().int().nonnegative().optional()
  })
  .superRefine((value, context) => {
    if (
      value.minPlayers !== undefined &&
      value.maxPlayers !== undefined &&
      value.minPlayers > value.maxPlayers
    ) {
      context.addIssue({
        code: "custom",
        message: "minPlayers cannot exceed maxPlayers",
        path: ["minPlayers"]
      });
    }
    if (
      value.minMinutes !== undefined &&
      value.maxMinutes !== undefined &&
      value.minMinutes > value.maxMinutes
    ) {
      context.addIssue({
        code: "custom",
        message: "minMinutes cannot exceed maxMinutes",
        path: ["minMinutes"]
      });
    }
  });

const localIdentitySchema = {
  bggId: z.number().int().positive().optional(),
  sourceUrl: z.url().optional()
};

const requireLocalGameDetails = (
  value: {
    bggId?: number;
    sourceUrl?: string;
    house?: { modes?: string[] };
    overrides?: Record<string, number | undefined>;
  },
  context: z.RefinementCtx
) => {
  if (value.bggId !== undefined) return;
  if (!value.sourceUrl) {
    context.addIssue({
      code: "custom",
      message: "A local-only item requires sourceUrl when bggId is absent.",
      path: ["sourceUrl"]
    });
  }
  localValues.forEach((field) => {
    if (value.overrides?.[field] === undefined) {
      context.addIssue({
        code: "custom",
        message: `A local-only item requires overrides.${field}.`,
        path: ["overrides", field]
      });
    }
  });
  if (!value.house?.modes?.length) {
    context.addIssue({
      code: "custom",
      message: "A local-only game requires at least one supported mode.",
      path: ["house", "modes"]
    });
  }
};

const requireLocalExpansionDetails = (
  value: { bggId?: number; sourceUrl?: string; standalone?: boolean },
  context: z.RefinementCtx
) => {
  if (value.bggId !== undefined) return;
  if (!value.sourceUrl) {
    context.addIssue({
      code: "custom",
      message: "A local-only item requires sourceUrl when bggId is absent.",
      path: ["sourceUrl"]
    });
  }
  if (value.standalone) {
    context.addIssue({
      code: "custom",
      message: "A local-only standalone expansion must be modeled as a base game.",
      path: ["standalone"]
    });
  }
};

const expansionSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ...localIdentitySchema,
    name: z.string().min(1),
    standalone: z.boolean().default(false),
    edition: z.string().min(1).optional(),
    quantity: z.number().int().positive().default(1),
    shelf: z.string().min(1).optional(),
    availability: availabilitySchema.default("available"),
    learned: z.boolean().default(false),
    ownershipNotes: z.string().min(1).optional(),
    compatibilityNotes: z.string().min(1).optional(),
    overrides: overridesSchema.optional()
  })
  .superRefine(requireLocalExpansionDetails);

const gameSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ...localIdentitySchema,
    name: z.string().min(1),
    edition: z.string().min(1).optional(),
    quantity: z.number().int().positive().default(1),
    shelf: z.string().min(1).optional(),
    availability: availabilitySchema.default("available"),
    learned: z.boolean().default(false),
    ownershipNotes: z.string().min(1).optional(),
    house: z
      .object({
        rating: z.number().min(1).max(5).optional(),
        setupTimeRange: z.enum(SETUP_TIME_RANGE_VALUES as [string, ...string[]]).optional(),
        teachDifficulty: z.number().min(1).max(5).optional(),
        tableSpace: tableSpaceSchema.optional(),
        interaction: z.number().min(1).max(5).optional(),
        luck: z.number().min(1).max(5).optional(),
        downtime: z.number().min(1).max(5).optional(),
        modes: z.array(modeSchema).default([]),
        moods: z.array(z.string().min(1)).default([]),
        accessibilityFlags: z.array(z.string().min(1)).default([]),
        contentFlags: z.array(z.string().min(1)).default([]),
        recommendationNotes: z.string().min(1).optional()
      })
      .default({
        modes: [],
        moods: [],
        accessibilityFlags: [],
        contentFlags: []
      }),
    overrides: overridesSchema.optional(),
    expansions: z.array(expansionSchema).default([])
  })
  .superRefine(requireLocalGameDetails);

export const inventorySchema = z
  .object({
    version: z.literal(1),
    games: z.array(gameSchema)
  })
  .superRefine((inventory, context) => {
    const slugs = new Set<string>();
    const bggIds = new Set<number>();

    inventory.games.forEach((game, gameIndex) => {
      if (slugs.has(game.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate slug: ${game.slug}`,
          path: ["games", gameIndex, "slug"]
        });
      }
      if (game.bggId !== undefined && bggIds.has(game.bggId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate BGG ID: ${game.bggId}`,
          path: ["games", gameIndex, "bggId"]
        });
      }
      slugs.add(game.slug);
      if (game.bggId !== undefined) bggIds.add(game.bggId);

      game.expansions.forEach((expansion, expansionIndex) => {
        if (slugs.has(expansion.slug)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate slug: ${expansion.slug}`,
            path: ["games", gameIndex, "expansions", expansionIndex, "slug"]
          });
        }
        if (expansion.bggId !== undefined && bggIds.has(expansion.bggId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate BGG ID: ${expansion.bggId}`,
            path: ["games", gameIndex, "expansions", expansionIndex, "bggId"]
          });
        }
        slugs.add(expansion.slug);
        if (expansion.bggId !== undefined) bggIds.add(expansion.bggId);
      });
    });
  });

export function parseInventory(value: unknown): Inventory {
  return inventorySchema.parse(value) as Inventory;
}

const wishlistGameSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    bggId: z.number().int().positive().optional(),
    sourceUrl: z.url().optional(),
    name: z.string().min(1),
    status: z.enum(["interested", "researching", "planned"]).default("interested"),
    priority: z.number().int().min(1).max(5).optional(),
    notes: z.string().min(1).optional()
  })
  .superRefine((game, context) => {
    if (game.bggId === undefined && !game.sourceUrl) {
      context.addIssue({
        code: "custom",
        message: "A wishlist item requires either bggId or sourceUrl.",
        path: ["sourceUrl"]
      });
    }
  });

export const wishlistSchema = z
  .object({
    version: z.literal(1),
    games: z.array(wishlistGameSchema)
  })
  .superRefine((wishlist, context) => {
    const slugs = new Set<string>();
    const bggIds = new Set<number>();
    wishlist.games.forEach((game, index) => {
      if (slugs.has(game.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate wishlist slug: ${game.slug}`,
          path: ["games", index, "slug"]
        });
      }
      if (game.bggId !== undefined && bggIds.has(game.bggId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate wishlist BGG ID: ${game.bggId}`,
          path: ["games", index, "bggId"]
        });
      }
      slugs.add(game.slug);
      if (game.bggId !== undefined) bggIds.add(game.bggId);
    });
  });

export function parseWishlist(value: unknown): Wishlist {
  return wishlistSchema.parse(value) as Wishlist;
}
