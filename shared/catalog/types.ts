import type { GameMode, InventoryGame, OwnedExpansion, WishlistGame } from "../inventory/types.js";

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

interface CatalogExpansion extends OwnedExpansion {
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
