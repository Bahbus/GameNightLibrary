import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { buildWikiPages } from "./wikiGeneration";

const outputDirectory = new URL("../outputs/wiki/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const pages = await buildWikiPages((source) => readFile(source, "utf8"));
for (const [target, content] of pages) {
  await writeFile(new URL(target, outputDirectory), content, "utf8");
}

console.log(`Prepared ${pages.size} Wiki pages from reviewed repository documentation.`);
