import { readFile, rename, writeFile } from "node:fs/promises";
import YAML from "yaml";
import { parseInventory, parseWishlist } from "../shared/inventory/schema.js";
import type { Inventory, Wishlist } from "../shared/inventory/types.js";

export const INVENTORY_PATH = new URL("../data/inventory.yaml", import.meta.url);
const WISHLIST_PATH = new URL("../data/wishlist.yaml", import.meta.url);

export async function readInventory(path = INVENTORY_PATH): Promise<Inventory> {
  const source = await readFile(path, "utf8");
  return parseInventory(YAML.parse(source));
}

export function serializeInventory(inventory: Inventory): string {
  const validated = parseInventory(inventory);
  return YAML.stringify(validated, {
    lineWidth: 0,
    sortMapEntries: false
  });
}

export async function writeInventory(inventory: Inventory, path = INVENTORY_PATH) {
  const source = serializeInventory(inventory);
  const temporary = new URL(`${path.href}.tmp`);
  await writeFile(temporary, source, "utf8");
  await rename(temporary, path);
}

export async function readWishlist(path = WISHLIST_PATH): Promise<Wishlist> {
  const source = await readFile(path, "utf8");
  return parseWishlist(YAML.parse(source));
}

export async function writeWishlist(wishlist: Wishlist, path = WISHLIST_PATH) {
  const validated = parseWishlist(wishlist);
  const source = YAML.stringify(validated, {
    lineWidth: 0,
    sortMapEntries: false
  });
  const temporary = new URL(`${path.href}.tmp`);
  await writeFile(temporary, source, "utf8");
  await rename(temporary, path);
}

export function formatZodError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    return error.issues
      .map((issue) => `${issue.path?.join(".") || "inventory"}: ${issue.message}`)
      .join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}
