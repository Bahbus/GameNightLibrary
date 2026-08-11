import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BggMetadata,
  CatalogGame,
  CatalogMetadata,
  CatalogPayload
} from "../shared/catalog/types.js";
import type { Inventory, Wishlist } from "../shared/inventory/types.js";
import { fetchBggMetadata } from "./bgg";
import { cacheCatalogThumbnails } from "./thumbnailCache";

const fallbackMetadata = (
  bggId: number | undefined,
  name: string,
  sourceUrl?: string
): CatalogMetadata => ({
  bggId,
  name,
  categories: [],
  mechanics: [],
  modes: [],
  playerRecommendations: [],
  url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : sourceUrl
});

export async function buildCatalogPayload({
  inventory,
  wishlist = { version: 1, games: [] },
  setupRequired = true,
  token,
  requireEnrichment = false,
  fetcher = fetch,
  now = () => new Date()
}: {
  inventory: Inventory;
  wishlist?: Wishlist;
  setupRequired?: boolean;
  token?: string;
  requireEnrichment?: boolean;
  fetcher?: typeof fetch;
  now?: () => Date;
}): Promise<CatalogPayload> {
  const ownedSlugs = new Set(
    inventory.games.flatMap((game) => [
      game.slug,
      ...game.expansions.map((expansion) => expansion.slug)
    ])
  );
  const ownedBggIds = new Set(
    inventory.games
      .flatMap((game) => [game.bggId, ...game.expansions.map((expansion) => expansion.bggId)])
      .filter((id): id is number => id !== undefined)
  );
  for (const game of wishlist.games) {
    if (ownedSlugs.has(game.slug)) {
      throw new Error(`Wishlist slug is already owned: ${game.slug}`);
    }
    if (game.bggId !== undefined && ownedBggIds.has(game.bggId)) {
      throw new Error(`Wishlist BGG ID is already owned: ${game.bggId}`);
    }
  }
  const ids = [
    ...inventory.games.flatMap((game) => [
      game.bggId,
      ...game.expansions.map((expansion) => expansion.bggId)
    ]),
    ...wishlist.games.map((game) => game.bggId)
  ].filter((id): id is number => id !== undefined);
  if (requireEnrichment && ids.length && !token) {
    throw new Error("BGG_API_TOKEN is required to deploy a non-empty enriched catalog.");
  }
  const enriched = Boolean(token && ids.length);
  const metadata = enriched
    ? await fetchBggMetadata(ids, token!, fetcher)
    : new Map<number, BggMetadata>();

  const games: CatalogGame[] = inventory.games.map((game) => ({
    ...game,
    metadata:
      (game.bggId === undefined ? undefined : metadata.get(game.bggId)) ??
      fallbackMetadata(game.bggId, game.name, game.sourceUrl),
    expansions: game.expansions.map((expansion) => ({
      ...expansion,
      metadata:
        (expansion.bggId === undefined ? undefined : metadata.get(expansion.bggId)) ??
        fallbackMetadata(expansion.bggId, expansion.name, expansion.sourceUrl)
    }))
  }));

  return {
    schemaVersion: 1,
    refreshedAt: now().toISOString(),
    enriched,
    setupRequired,
    games,
    wishlist: wishlist.games.map((game) => ({
      ...game,
      metadata:
        (game.bggId === undefined ? undefined : metadata.get(game.bggId)) ??
        fallbackMetadata(game.bggId, game.name, game.sourceUrl)
    }))
  };
}

export async function writeCatalogPayload(payload: CatalogPayload, output: URL): Promise<void> {
  const target = fileURLToPath(output);
  const temporary = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export async function generateCatalog(options: {
  inventory: Inventory;
  wishlist?: Wishlist;
  setupRequired?: boolean;
  output: URL;
  token?: string;
  requireEnrichment?: boolean;
  fetcher?: typeof fetch;
  now?: () => Date;
  thumbnailCacheDirectory?: URL;
}): Promise<CatalogPayload> {
  let payload = await buildCatalogPayload(options);
  if (options.thumbnailCacheDirectory) {
    payload = await cacheCatalogThumbnails(
      payload,
      options.thumbnailCacheDirectory,
      options.fetcher
    );
  }
  await writeCatalogPayload(payload, options.output);
  return payload;
}
