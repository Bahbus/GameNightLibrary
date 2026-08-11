import { buildCatalogPayload } from "./catalogGeneration";
import { formatZodError, readInventory, readWishlist } from "./inventoryIo";

try {
  const [inventory, wishlist] = await Promise.all([readInventory(), readWishlist()]);
  await buildCatalogPayload({ inventory, wishlist });
  const expansionCount = inventory.games.reduce((count, game) => count + game.expansions.length, 0);
  console.log(
    `Library data is valid: ${inventory.games.length} base games, ${expansionCount} expansions, and ${wishlist.games.length} wish-list games.`
  );
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
