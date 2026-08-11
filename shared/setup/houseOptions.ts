export const SETUP_TIME_RANGES = [
  { value: "under-5", label: "Less than 5 minutes", comparisonMinutes: 5 },
  { value: "5-10", label: "5–10 minutes", comparisonMinutes: 10 },
  { value: "11-20", label: "11–20 minutes", comparisonMinutes: 20 },
  { value: "21-30", label: "21–30 minutes", comparisonMinutes: 30 },
  { value: "31-45", label: "31–45 minutes", comparisonMinutes: 45 },
  { value: "46-60", label: "46–60 minutes", comparisonMinutes: 60 },
  { value: "over-60", label: "More than 60 minutes", comparisonMinutes: 90 }
] as const;

export type SetupTimeRange = (typeof SETUP_TIME_RANGES)[number]["value"];

export const SETUP_TIME_RANGE_VALUES = SETUP_TIME_RANGES.map((option) => option.value);

export const setupTimeComparisonMinutes = (range: SetupTimeRange) =>
  SETUP_TIME_RANGES.find((option) => option.value === range)?.comparisonMinutes;

export const MOOD_OPTIONS = [
  { value: "casual", label: "Casual / relaxed" },
  { value: "cozy", label: "Cozy" },
  { value: "strategic", label: "Strategic / thinky" },
  { value: "puzzly", label: "Puzzly" },
  { value: "social", label: "Social" },
  { value: "silly", label: "Silly" },
  { value: "tense", label: "Tense" },
  { value: "thematic", label: "Immersive / thematic" },
  { value: "chaotic", label: "Chaotic" }
] as const;

export const ACCESSIBILITY_OPTIONS = [
  { value: "color-dependent", label: "Color-dependent information" },
  { value: "small-text", label: "Small text" },
  { value: "heavy-reading", label: "Heavy reading" },
  { value: "language-dependent", label: "Language-dependent play" },
  { value: "fine-motor", label: "Fine motor precision" },
  { value: "memory-heavy", label: "Memory-heavy play" },
  { value: "hearing-dependent", label: "Hearing-dependent play" }
] as const;

export const CONTENT_OPTIONS = [
  { value: "alcohol", label: "Alcohol" },
  { value: "horror", label: "Horror" },
  { value: "violence", label: "Violence" },
  { value: "gore", label: "Gore" },
  { value: "mature-themes", label: "Mature themes" },
  { value: "sexual-content", label: "Sexual content" },
  { value: "strong-language", label: "Strong language" },
  { value: "spiders-insects", label: "Spiders / insects" }
] as const;

export type HouseTagOption = { value: string; label: string };
