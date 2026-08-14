import {
  formatZodError,
  readInventory,
  readWishlist,
  writeInventory,
  writeWishlist
} from "./inventoryIo";
import { applyInventoryTransaction, type InventoryOperation } from "./inventoryTransaction";
import { applyWishlistRequest } from "./wishlistTransaction";

const target = process.env.REQUEST_TARGET;
const operation = process.env.REQUEST_OPERATION as InventoryOperation | undefined;
const body = process.env.ISSUE_BODY ?? "";
if (target !== "inventory" && target !== "wishlist") {
  console.error("REQUEST_TARGET must be inventory or wishlist.");
  process.exit(1);
}
if (target === "inventory" && (!operation || !["add", "update", "remove"].includes(operation))) {
  console.error("REQUEST_OPERATION must be add, update, or remove for an inventory request.");
  process.exit(1);
}

try {
  const inventory = await readInventory();
  if (target === "wishlist") {
    const wishlist = await readWishlist();
    await writeWishlist(applyWishlistRequest(wishlist, inventory, body));
    console.log("Wish-list request applied.");
  } else {
    const updated = applyInventoryTransaction(inventory, operation!, body);
    await writeInventory(updated);
    console.log(`${operation} inventory request applied.`);
  }
} catch (error) {
  console.error(formatZodError(error));
  process.exitCode = 1;
}
