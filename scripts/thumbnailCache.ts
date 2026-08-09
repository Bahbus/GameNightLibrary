import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogMetadata, CatalogPayload } from "../src/types";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const extensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

async function cacheThumbnail(
  metadata: CatalogMetadata,
  directory: string,
  fetcher: typeof fetch
): Promise<CatalogMetadata> {
  const source = metadata.thumbnail ?? metadata.image;
  if (!source || metadata.bggId === undefined) return metadata;

  try {
    const sourceUrl = new URL(source);
    if (sourceUrl.protocol !== "https:") throw new Error("cover URL is not HTTPS");

    const response = await fetcher(sourceUrl, {
      headers: { "User-Agent": "Bahbus-BoardGameInventory/1.0" }
    });
    if (!response.ok) throw new Error(`cover returned ${response.status}`);

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
    const extension = contentType ? extensions.get(contentType) : undefined;
    if (!extension) throw new Error(`unsupported cover type ${contentType ?? "unknown"}`);

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_THUMBNAIL_BYTES) {
      throw new Error(`cover exceeds ${MAX_THUMBNAIL_BYTES} bytes`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_THUMBNAIL_BYTES) {
      throw new Error(`cover exceeds ${MAX_THUMBNAIL_BYTES} bytes`);
    }

    const filename = `${metadata.bggId}.${extension}`;
    await writeFile(join(directory, filename), bytes);
    return { ...metadata, cachedThumbnail: `bgg-covers/${filename}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Could not cache BGG cover ${metadata.bggId}: ${detail}`);
    return metadata;
  }
}

export async function cacheCatalogThumbnails(
  payload: CatalogPayload,
  outputDirectory: URL,
  fetcher: typeof fetch = fetch
): Promise<CatalogPayload> {
  const directory = fileURLToPath(outputDirectory);
  await mkdir(directory, { recursive: true });
  const cached = new Map<number, Promise<CatalogMetadata>>();
  let queue: Promise<unknown> = Promise.resolve();

  const cache = (metadata: CatalogMetadata | undefined) => {
    if (!metadata || metadata.bggId === undefined) return Promise.resolve(metadata);
    const existing = cached.get(metadata.bggId);
    if (existing) return existing;
    const pending = queue.then(() => cacheThumbnail(metadata, directory, fetcher));
    queue = pending;
    cached.set(metadata.bggId, pending);
    return pending;
  };

  return {
    ...payload,
    games: await Promise.all(
      payload.games.map(async (game) => ({
        ...game,
        metadata: (await cache(game.metadata))!,
        expansions: await Promise.all(
          game.expansions.map(async (expansion) => ({
            ...expansion,
            metadata: await cache(expansion.metadata)
          }))
        )
      }))
    ),
    wishlist: await Promise.all(
      payload.wishlist.map(async (game) => ({
        ...game,
        metadata: (await cache(game.metadata))!
      }))
    )
  };
}
