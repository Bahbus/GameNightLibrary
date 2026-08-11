import type { SetupTimeRange } from "../setup/houseOptions.js";

export type Availability = "available" | "loaned" | "incomplete" | "unavailable";
export type TableSpace = "compact" | "standard" | "large";
export type GameMode = "competitive" | "cooperative" | "team" | "solo";
export type { SetupTimeRange } from "../setup/houseOptions.js";

export interface ValueOverrides {
  minPlayers?: number;
  maxPlayers?: number;
  minMinutes?: number;
  maxMinutes?: number;
  minAge?: number;
}

export interface HouseEvaluation {
  rating?: number;
  setupTimeRange?: SetupTimeRange;
  teachDifficulty?: number;
  tableSpace?: TableSpace;
  interaction?: number;
  luck?: number;
  downtime?: number;
  modes: GameMode[];
  moods: string[];
  accessibilityFlags: string[];
  contentFlags: string[];
  recommendationNotes?: string;
}

export interface OwnedExpansion {
  slug: string;
  bggId?: number;
  sourceUrl?: string;
  name: string;
  standalone: boolean;
  edition?: string;
  quantity: number;
  shelf?: string;
  availability: Availability;
  learned: boolean;
  ownershipNotes?: string;
  compatibilityNotes?: string;
  overrides?: ValueOverrides;
}

export interface InventoryGame {
  slug: string;
  bggId?: number;
  sourceUrl?: string;
  name: string;
  edition?: string;
  quantity: number;
  shelf?: string;
  availability: Availability;
  learned: boolean;
  ownershipNotes?: string;
  house: HouseEvaluation;
  overrides?: ValueOverrides;
  expansions: OwnedExpansion[];
}

export interface Inventory {
  version: 1;
  games: InventoryGame[];
}

export type WishlistStatus = "interested" | "researching" | "planned";

export interface WishlistGame {
  slug: string;
  bggId?: number;
  sourceUrl?: string;
  name: string;
  status: WishlistStatus;
  priority?: number;
  notes?: string;
}

export interface Wishlist {
  version: 1;
  games: WishlistGame[];
}
