import { parseWishlist } from "../shared/inventory/schema.js";
import { parseGameSource, slugifyGameName } from "../shared/inventory/requestFields.js";
import type { Inventory, Wishlist, WishlistGame } from "../shared/inventory/types.js";
import { fieldsFromIssue } from "./issueRequest.js";

const allInventoryGames = (inventory: Inventory) =>
  inventory.games.flatMap((game) => [game, ...game.expansions]);

const requestSource = (fields: Map<string, string>) =>
  fields.get("BoardGameGeek ID or source URL") ??
  fields.get("BGG ID") ??
  fields.get("Source URL") ??
  "";

const requestNotes = (reasons: string, notes?: string) =>
  notes ? `${reasons}\n\nAdditional notes: ${notes}` : reasons;

export function applyWishlistRequest(
  sourceWishlist: Wishlist,
  inventory: Inventory,
  body: string
): Wishlist {
  const wishlist = parseWishlist(JSON.parse(JSON.stringify(sourceWishlist)) as unknown);
  const fields = fieldsFromIssue(body);
  const name = fields.get("Game name")?.trim();
  const reasons = fields.get("Why should we consider it?")?.trim();
  if (!name || !reasons) {
    throw new Error("Game name and Why should we consider it? are required.");
  }

  const slug = slugifyGameName(name);
  if (!slug) throw new Error("Game name must contain letters or numbers.");

  const parsedSource = parseGameSource(requestSource(fields));
  if (!parsedSource.bggId && !parsedSource.sourceUrl) {
    throw new Error("BoardGameGeek ID or source URL must be a positive BGG ID or HTTP(S) URL.");
  }
  const bggId = parsedSource.bggId ? Number(parsedSource.bggId) : undefined;
  if (bggId !== undefined && (!Number.isSafeInteger(bggId) || bggId <= 0)) {
    throw new Error("BoardGameGeek ID must be a positive integer.");
  }

  if (wishlist.games.some((game) => game.slug === slug)) {
    throw new Error(`Wish-list slug ${slug} already exists.`);
  }
  if (bggId !== undefined && wishlist.games.some((game) => game.bggId === bggId)) {
    throw new Error(`BoardGameGeek ID ${bggId} is already on the wish list.`);
  }
  if (
    parsedSource.sourceUrl &&
    wishlist.games.some((game) => game.sourceUrl === parsedSource.sourceUrl)
  ) {
    throw new Error(`Source URL ${parsedSource.sourceUrl} is already on the wish list.`);
  }

  const owned = allInventoryGames(inventory);
  if (owned.some((game) => game.slug === slug)) {
    throw new Error(`Wish-list slug ${slug} is already owned.`);
  }
  if (bggId !== undefined && owned.some((game) => game.bggId === bggId)) {
    throw new Error(`BoardGameGeek ID ${bggId} is already owned.`);
  }
  if (parsedSource.sourceUrl && owned.some((game) => game.sourceUrl === parsedSource.sourceUrl)) {
    throw new Error(`Source URL ${parsedSource.sourceUrl} is already owned.`);
  }

  const game: WishlistGame = {
    slug,
    bggId,
    sourceUrl: parsedSource.sourceUrl || undefined,
    name,
    status: "interested",
    notes: requestNotes(reasons, fields.get("Other notes")?.trim())
  };
  wishlist.games.push(game);
  wishlist.games.sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" })
  );
  return parseWishlist(wishlist);
}
