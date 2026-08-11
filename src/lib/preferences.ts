import type { GroupPreferences } from "../types";

export const DEFAULT_PREFERENCES: GroupPreferences = {
  query: "",
  requiredMode: "",
  maxTableSpace: "",
  learnedOnly: false,
  excludedAccessibility: [],
  excludedContent: [],
  preferredMoods: [],
  preferredMechanics: [],
  preferredThemes: [],
  sort: "name"
};

const stringList = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const optionalNumber = (value: string | null) => {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export function serializePreferences(preferences: GroupPreferences): string {
  const params = new URLSearchParams();
  if (preferences.query) params.set("q", preferences.query);
  if (preferences.players) params.set("players", String(preferences.players));
  if (preferences.maxMinutes) params.set("max", String(preferences.maxMinutes));
  if (preferences.requiredMode) params.set("mode", preferences.requiredMode);
  if (preferences.minAge !== undefined) params.set("age", String(preferences.minAge));
  if (preferences.maxTableSpace) params.set("table", preferences.maxTableSpace);
  if (preferences.learnedOnly) params.set("learned", "1");
  if (preferences.excludedAccessibility.length)
    params.set("access", preferences.excludedAccessibility.join(","));
  if (preferences.excludedContent.length)
    params.set("content", preferences.excludedContent.join(","));
  if (preferences.targetMinutes) params.set("time", String(preferences.targetMinutes));
  if (preferences.targetComplexity) params.set("weight", String(preferences.targetComplexity));
  if (preferences.preferredMoods.length) params.set("moods", preferences.preferredMoods.join(","));
  if (preferences.preferredMechanics.length)
    params.set("mechanics", preferences.preferredMechanics.join(","));
  if (preferences.preferredThemes.length)
    params.set("themes", preferences.preferredThemes.join(","));
  if (preferences.targetInteraction)
    params.set("interaction", String(preferences.targetInteraction));
  if (preferences.targetLuck) params.set("luck", String(preferences.targetLuck));
  if (preferences.targetDowntime) params.set("downtime", String(preferences.targetDowntime));
  if (preferences.maxSetupMinutes) params.set("setup", String(preferences.maxSetupMinutes));
  if (preferences.maxTeachDifficulty) params.set("teach", String(preferences.maxTeachDifficulty));
  if (preferences.sort !== "name") params.set("sort", preferences.sort);
  return params.toString();
}

export function parsePreferences(search: string): GroupPreferences {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const validModes = ["competitive", "cooperative", "team", "solo"];
  const validSpaces = ["compact", "standard", "large"];
  const validSorts = ["name", "bggRating", "complexity", "duration", "players", "houseRating"];
  const mode = params.get("mode") ?? "";
  const table = params.get("table") ?? "";
  const sort = params.get("sort") ?? "name";

  return {
    ...DEFAULT_PREFERENCES,
    query: params.get("q") ?? "",
    players: optionalNumber(params.get("players")),
    maxMinutes: optionalNumber(params.get("max")),
    requiredMode: validModes.includes(mode) ? (mode as GroupPreferences["requiredMode"]) : "",
    minAge: optionalNumber(params.get("age")),
    maxTableSpace: validSpaces.includes(table) ? (table as GroupPreferences["maxTableSpace"]) : "",
    learnedOnly: params.get("learned") === "1",
    excludedAccessibility: stringList(params.get("access")),
    excludedContent: stringList(params.get("content")),
    targetMinutes: optionalNumber(params.get("time")),
    targetComplexity: optionalNumber(params.get("weight")),
    preferredMoods: stringList(params.get("moods")),
    preferredMechanics: stringList(params.get("mechanics")),
    preferredThemes: stringList(params.get("themes")),
    targetInteraction: optionalNumber(params.get("interaction")),
    targetLuck: optionalNumber(params.get("luck")),
    targetDowntime: optionalNumber(params.get("downtime")),
    maxSetupMinutes: optionalNumber(params.get("setup")),
    maxTeachDifficulty: optionalNumber(params.get("teach")),
    sort: validSorts.includes(sort) ? (sort as GroupPreferences["sort"]) : "name"
  };
}
