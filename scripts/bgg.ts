import { XMLParser } from "fast-xml-parser";
import type { BggMetadata, GameMode, PlayerRecommendation } from "../src/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (_name, path) => {
    const value = String(path);
    return (
      value.endsWith(".items.item") ||
      value.endsWith(".item.link") ||
      value.endsWith(".item.poll") ||
      value.endsWith(".results.result") ||
      value.endsWith(".result.answer")
    );
  }
});

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === "object" && value !== null && "value" in value) {
    const result = Number((value as { value: unknown }).value);
    return Number.isFinite(result) ? result : undefined;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};

const textValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "value" in value) {
    return String((value as { value: unknown }).value);
  }
  return undefined;
};

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function modesFromLinks(
  links: Array<{ type?: string; value?: string }>,
  minPlayers: number | undefined
): GameMode[] {
  const mechanisms = new Set(
    links
      .filter((link) => link.type === "boardgamemechanic")
      .map((link) => link.value?.trim().toLocaleLowerCase())
      .filter((value): value is string => Boolean(value))
  );
  const modes: GameMode[] = [];
  const cooperative = mechanisms.has("cooperative game");
  const team = mechanisms.has("team-based game");
  const semiCooperative = mechanisms.has("semi-cooperative game");
  const solo = minPlayers === 1 || mechanisms.has("solo / solitaire game");

  if (cooperative || semiCooperative) modes.push("cooperative");
  if (team) modes.push("team");
  if (!cooperative || semiCooperative) modes.push("competitive");
  if (solo) modes.push("solo");
  return modes;
}

function parsePlayerRecommendations(polls: unknown[]): PlayerRecommendation[] {
  const poll = polls.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { name?: string }).name === "suggested_numplayers"
  ) as { results?: Array<{ numplayers?: string; result?: unknown[] }> } | undefined;

  return asArray(poll?.results).flatMap((result) => {
    const playerCount = Number(result.numplayers);
    if (!Number.isFinite(playerCount)) return [];
    const answers = asArray(
      result.result as
        | { value?: string; numvotes?: string | number }
        | Array<{ value?: string; numvotes?: string | number }>
        | undefined
    );
    const totals = new Map(
      answers.map((answer) => [answer.value ?? "", Number(answer.numvotes ?? 0)])
    );
    const best = totals.get("Best") ?? 0;
    const recommended = totals.get("Recommended") ?? 0;
    const notRecommended = totals.get("Not Recommended") ?? 0;
    const rating =
      best >= recommended && best >= notRecommended
        ? "best"
        : recommended >= notRecommended
          ? "recommended"
          : "not-recommended";
    return [{ playerCount, rating }];
  });
}

export function parseBggThings(xml: string): BggMetadata[] {
  const parsed = parser.parse(xml) as { items?: { item?: unknown[] } };
  return asArray(parsed.items?.item).map((unknownItem) => {
    const item = unknownItem as {
      id: string | number;
      name?: Array<{ type?: string; value?: string }> | { type?: string; value?: string };
      yearpublished?: unknown;
      minplayers?: unknown;
      maxplayers?: unknown;
      minplaytime?: unknown;
      maxplaytime?: unknown;
      minage?: unknown;
      thumbnail?: string;
      image?: string;
      link?: Array<{ type?: string; value?: string }>;
      poll?: unknown[];
      statistics?: {
        ratings?: {
          average?: unknown;
          averageweight?: unknown;
          ranks?: { rank?: Array<{ name?: string; value?: string | number }> };
        };
      };
    };
    const bggId = Number(item.id);
    const names = asArray(item.name);
    const name =
      names.find((candidate) => candidate.type === "primary")?.value ??
      names[0]?.value ??
      `BGG #${bggId}`;
    const links = asArray(item.link);
    const categories = links
      .filter((link) => link.type === "boardgamecategory")
      .map((link) => link.value ?? "")
      .filter(Boolean);
    const mechanics = links
      .filter((link) => link.type === "boardgamemechanic")
      .map((link) => link.value ?? "")
      .filter(Boolean);
    const ranks = asArray(item.statistics?.ratings?.ranks?.rank);
    const rankValue = ranks.find((rank) => rank.name === "boardgame")?.value;
    const rank = rankValue === "Not Ranked" ? undefined : numberValue(rankValue);

    const minPlayers = numberValue(item.minplayers);

    return {
      bggId,
      name,
      yearPublished: numberValue(item.yearpublished),
      minPlayers,
      maxPlayers: numberValue(item.maxplayers),
      minMinutes: numberValue(item.minplaytime),
      maxMinutes: numberValue(item.maxplaytime),
      minAge: numberValue(item.minage),
      complexity: numberValue(item.statistics?.ratings?.averageweight),
      rating: numberValue(item.statistics?.ratings?.average),
      rank,
      thumbnail: textValue(item.thumbnail),
      image: textValue(item.image),
      categories,
      mechanics,
      modes: modesFromLinks(links, minPlayers),
      playerRecommendations: parsePlayerRecommendations(asArray(item.poll)),
      url: `https://boardgamegeek.com/boardgame/${bggId}`
    };
  });
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const BGG_REQUEST_INTERVAL_MS = 5_000;
const BGG_MAX_RETRY_DELAY_MS = 30_000;

export async function fetchBggMetadata(
  ids: number[],
  token: string,
  fetcher: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<unknown> = delay
): Promise<Map<number, BggMetadata>> {
  const result = new Map<number, BggMetadata>();
  for (let offset = 0; offset < ids.length; offset += 20) {
    if (offset > 0) await wait(BGG_REQUEST_INTERVAL_MS);
    const batch = ids.slice(offset, offset + 20);
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(",")}&stats=1`;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetcher(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Bahbus-GameNightLibrary/1.0"
        }
      });
      if (response.ok && response.status !== 202) break;
      if (![202, 429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`BGG returned ${response.status} for IDs ${batch.join(", ")}`);
      }
      if (attempt < 4) {
        await wait(Math.min(BGG_REQUEST_INTERVAL_MS * 2 ** attempt, BGG_MAX_RETRY_DELAY_MS));
      }
    }
    if (!response?.ok || response.status === 202) {
      throw new Error(`BGG enrichment failed after retries for IDs ${batch.join(", ")}`);
    }
    const metadata = parseBggThings(await response.text());
    for (const item of metadata) result.set(item.bggId, item);
  }
  const missing = ids.filter((id) => !result.has(id));
  if (missing.length) throw new Error(`BGG did not return IDs: ${missing.join(", ")}`);
  return result;
}
