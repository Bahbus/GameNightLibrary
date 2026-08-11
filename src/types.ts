import type { CatalogGame } from "../shared/catalog/types";
import type { GameMode, TableSpace } from "../shared/inventory/types";
export type * from "../shared/catalog/types";
export type * from "../shared/inventory/types";
export type SortKey = "name" | "bggRating" | "complexity" | "duration" | "players" | "houseRating";

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
