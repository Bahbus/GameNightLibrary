export type Availability = "available" | "loaned" | "incomplete" | "unavailable";
export type TableSpace = "compact" | "standard" | "large";
export type GameMode = "competitive" | "cooperative" | "team" | "solo";
export type { SetupTimeRange } from "../shared/setup/houseOptions";
import type { SetupTimeRange } from "../shared/setup/houseOptions";
export type SortKey = "name" | "bggRating" | "complexity" | "duration" | "players" | "houseRating";

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

export interface PlayerRecommendation {
  playerCount: number;
  rating: "best" | "recommended" | "not-recommended";
}

export interface BggMetadata {
  bggId: number;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minMinutes?: number;
  maxMinutes?: number;
  minAge?: number;
  complexity?: number;
  rating?: number;
  rank?: number;
  thumbnail?: string;
  image?: string;
  categories: string[];
  mechanics: string[];
  modes: GameMode[];
  playerRecommendations: PlayerRecommendation[];
  url: string;
}

export interface CatalogMetadata extends Omit<BggMetadata, "bggId" | "url"> {
  bggId?: number;
  url?: string;
  cachedThumbnail?: string;
}

export interface CatalogExpansion extends OwnedExpansion {
  metadata?: CatalogMetadata;
}

export interface CatalogGame extends Omit<InventoryGame, "expansions"> {
  metadata: CatalogMetadata;
  expansions: CatalogExpansion[];
  playMode?: {
    kind: "base" | "standalone-expansion";
    expansionSlug?: string;
    label: string;
  };
}

export interface CatalogWishlistGame extends WishlistGame {
  metadata: CatalogMetadata;
}

export interface CatalogPayload {
  schemaVersion: 1;
  refreshedAt: string;
  enriched: boolean;
  setupRequired: boolean;
  games: CatalogGame[];
  wishlist: CatalogWishlistGame[];
}

export interface GroupPreferences {
  version: 1;
  query: string;
  players?: number;
  maxMinutes?: number;
  requiredMode?: GameMode | "";
  minAge?: number;
  maxTableSpace?: TableSpace | "";
  learnedOnly: boolean;
  excludedAccessibility: string[];
  excludedContent: string[];
  targetMinutes?: number;
  targetComplexity?: number;
  preferredMoods: string[];
  preferredMechanics: string[];
  preferredThemes: string[];
  targetInteraction?: number;
  targetLuck?: number;
  targetDowntime?: number;
  maxSetupMinutes?: number;
  maxTeachDifficulty?: number;
  sort: SortKey;
}

export interface ScoreComponent {
  key: string;
  label: string;
  score: number;
  weight: number;
}

export interface ScoredGame {
  game: CatalogGame;
  matchScore: number;
  rouletteWeight: number;
  components: ScoreComponent[];
}
