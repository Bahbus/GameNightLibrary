import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { HouseIntakeRow } from "./houseIntake";
import type { MatchingRow } from "./intakeMatching";
import { fetchBggMetadata } from "./bgg";
import {
  inferHowItPlays,
  type HowItPlaysSuggestion,
  type SetupSuggestionsPayload
} from "../src/lib/setupSuggestions";

export const gitBlobSha = (source: string) => {
  const bytes = new TextEncoder().encode(source);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
};

export async function buildSetupSuggestions({
  houseRows,
  houseSource,
  manifest,
  token,
  requireEnrichment = false,
  fetcher = fetch
}: {
  houseRows: HouseIntakeRow[];
  houseSource: string;
  manifest: MatchingRow[];
  token?: string;
  requireEnrichment?: boolean;
  fetcher?: typeof fetch;
}): Promise<SetupSuggestionsPayload> {
  const sourceSha = gitBlobSha(houseSource);
  const houseSlugs = new Set(houseRows.map((row) => row.slug));
  const matchedGames = manifest.filter(
    (row) => row.kind === "game" && row.knownBggId !== undefined && houseSlugs.has(row.slug)
  );
  if (requireEnrichment && matchedGames.length && !token) {
    throw new Error("BGG_API_TOKEN is required to enrich the Setup questionnaire.");
  }
  if (!token || !matchedGames.length) {
    return { schemaVersion: 1, sourceSha, enriched: false, suggestions: [] };
  }

  const metadata = await fetchBggMetadata(
    matchedGames.map((row) => row.knownBggId!),
    token,
    fetcher
  );
  const suggestions = matchedGames.flatMap((row): HowItPlaysSuggestion[] => {
    const game = metadata.get(row.knownBggId!);
    if (!game) return [];
    const inferred = inferHowItPlays(game);
    if (
      !inferred.moods.length &&
      !inferred.accessibilityFlags.length &&
      !inferred.contentFlags.length
    ) {
      return [];
    }
    return [
      {
        slug: row.slug,
        bggId: row.knownBggId!,
        ...inferred,
        categories: game.categories,
        mechanics: game.mechanics
      }
    ];
  });
  return { schemaVersion: 1, sourceSha, enriched: true, suggestions };
}

export async function writeSetupSuggestions(payload: SetupSuggestionsPayload, output: URL) {
  const target = fileURLToPath(output);
  const temporary = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}
