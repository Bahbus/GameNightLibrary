import type { HouseIntakeRow } from "../shared/setup/houseIntake.js";
import type { MatchingRow } from "./intakeMatching.js";

export {
  houseIntakeToCsv,
  houseSetupRequired,
  validateHouseIntakeCsv
} from "../shared/setup/houseIntake.js";
export type { HouseIntakeRow } from "../shared/setup/houseIntake.js";

const compareHouseTitles = (left: HouseIntakeRow, right: HouseIntakeRow) =>
  left.title.localeCompare(right.title, "en", { numeric: true, sensitivity: "base" });

export function buildHouseIntake(manifest: MatchingRow[]): HouseIntakeRow[] {
  return manifest
    .filter((row) => row.kind === "game")
    .map((row) => {
      const localOnly = row.matchStatus === "local-only";
      return {
        slug: row.slug,
        title: row.proposedTitle,
        availability: "available",
        learned: "",
        shelf: "",
        houseRating: "",
        setupTimeRange: "",
        teachDifficulty: "",
        tableSpace: "",
        interaction: "",
        luck: "",
        downtime: "",
        modes: "",
        moods: "",
        accessibilityFlags: "",
        contentFlags: row.slug === "buzzed-tower" ? "alcohol" : "",
        recommendationNotes: "",
        localValuesRequired: localOnly ? "yes" : "no",
        localMinPlayers: "",
        localMaxPlayers: "",
        localMinMinutes: "",
        localMaxMinutes: "",
        localMinAge: ""
      };
    })
    .sort(compareHouseTitles);
}
