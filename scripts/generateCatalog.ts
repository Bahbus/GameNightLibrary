import { generateCatalog } from "./catalogGeneration";
import { readFile } from "node:fs/promises";
import { houseSetupRequired, validateHouseIntakeCsv } from "./houseIntake";
import { parseMatchingManifest } from "./intakeMatching";
import { readInventory, readWishlist } from "./inventoryIo";
import { buildSetupSuggestions, writeSetupSuggestions } from "./setupSuggestionGeneration";

const [inventory, wishlist, houseIntakeSource, matchingSource] = await Promise.all([
  readInventory(),
  readWishlist(),
  readFile(new URL("../data/inventory.house.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/inventory.matching.csv", import.meta.url), "utf8")
]);
const houseRows = validateHouseIntakeCsv(houseIntakeSource);
const setupRequired = houseSetupRequired(houseRows);
const token = process.env.BGG_API_TOKEN;
const output = new URL("../public/catalog.json", import.meta.url);
const payload = await generateCatalog({
  inventory,
  wishlist,
  setupRequired,
  output,
  thumbnailCacheDirectory: new URL("../public/bgg-covers/", import.meta.url),
  token,
  requireEnrichment: process.env.REQUIRE_BGG_ENRICHMENT === "1"
});
const setupSuggestions = await buildSetupSuggestions({
  houseRows,
  houseSource: houseIntakeSource,
  manifest: parseMatchingManifest(matchingSource),
  token: setupRequired ? token : undefined,
  requireEnrichment: process.env.REQUIRE_BGG_ENRICHMENT === "1"
});
await writeSetupSuggestions(
  setupSuggestions,
  new URL("../public/setup-suggestions.json", import.meta.url)
);
console.log(
  `Generated catalog with ${payload.games.length} base game${payload.games.length === 1 ? "" : "s"} and ${payload.wishlist.length} wishlist item${payload.wishlist.length === 1 ? "" : "s"}.`
);
console.log(
  `Generated ${setupSuggestions.suggestions.length} BGG-backed setup suggestion${setupSuggestions.suggestions.length === 1 ? "" : "s"}.`
);
