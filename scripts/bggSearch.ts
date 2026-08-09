import { XMLParser } from "fast-xml-parser";
import type { MatchingRow } from "./intakeMatching";
import { recordsToCsv } from "./csv";
import { BGG_REQUEST_INTERVAL_MS } from "./bgg";

export interface BggSearchCandidate {
  bggId: number;
  name: string;
  yearPublished?: number;
}

export interface RankedCandidate extends BggSearchCandidate {
  score: number;
}

export interface MatchReportRow extends MatchingRow {
  candidateCount: number;
  suggestedBggId?: number;
  suggestedTitle: string;
  suggestedYear?: number;
  suggestionScore?: number;
  suggestionStatus:
    "source-confirmed" | "local-only" | "shared-id-review" | "exact-title" | "review" | "not-found";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name, path) => name === "item" && String(path).endsWith(".items.item")
});

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export function parseBggSearch(xml: string): BggSearchCandidate[] {
  const parsed = parser.parse(xml) as {
    items?: {
      item?: Array<{
        id?: string | number;
        name?: { value?: string };
        yearpublished?: { value?: string | number };
      }>;
    };
  };
  return asArray(parsed.items?.item).flatMap((item) => {
    const bggId = Number(item.id);
    const name = item.name?.value;
    const year = Number(item.yearpublished?.value);
    return Number.isInteger(bggId) && bggId > 0 && name
      ? [{ bggId, name, yearPublished: Number.isFinite(year) ? year : undefined }]
      : [];
  });
}

export function normalizeMatchTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function rankBggCandidates(
  query: string,
  candidates: BggSearchCandidate[]
): RankedCandidate[] {
  const normalizedQuery = normalizeMatchTitle(query);
  const queryTokens = new Set(normalizedQuery.split(" ").filter(Boolean));
  return candidates
    .map((candidate) => {
      const normalizedCandidate = normalizeMatchTitle(candidate.name);
      if (normalizedCandidate === normalizedQuery) return { ...candidate, score: 1 };
      const candidateTokens = new Set(normalizedCandidate.split(" ").filter(Boolean));
      const union = new Set([...queryTokens, ...candidateTokens]);
      const intersection = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
      const score = union.size ? (intersection / union.size) * 0.8 : 0;
      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.bggId - right.bggId);
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function fetchBggSearch(
  query: string,
  token: string,
  fetcher: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<unknown> = delay
): Promise<BggSearchCandidate[]> {
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`;
  let response: Response | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Bahbus-BoardGameInventory/1.0"
      }
    });
    if (response.ok && response.status !== 202) break;
    if (![202, 429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`BGG search returned ${response.status} for ${query}.`);
    }
    if (attempt < 4) {
      await wait(Math.min(BGG_REQUEST_INTERVAL_MS * 2 ** attempt, 30_000));
    }
  }
  if (!response?.ok || response.status === 202) {
    throw new Error(`BGG search failed after retries for ${query}.`);
  }
  return parseBggSearch(await response.text());
}

export async function buildMatchReport(
  rows: MatchingRow[],
  search: (query: string) => Promise<BggSearchCandidate[]>
): Promise<MatchReportRow[]> {
  const report: MatchReportRow[] = [];
  for (const row of rows) {
    if (row.matchStatus === "matched-from-source") {
      report.push({
        ...row,
        candidateCount: 0,
        suggestedBggId: row.knownBggId,
        suggestedTitle: row.proposedTitle,
        suggestionScore: 1,
        suggestionStatus: "source-confirmed"
      });
      continue;
    }
    if (row.matchStatus === "local-only") {
      report.push({
        ...row,
        candidateCount: 0,
        suggestedTitle: "",
        suggestionStatus: "local-only"
      });
      continue;
    }
    if (row.matchStatus === "review-shared-bgg-id") {
      report.push({
        ...row,
        candidateCount: 0,
        suggestedBggId: row.knownBggId,
        suggestedTitle: row.proposedTitle,
        suggestionStatus: "shared-id-review"
      });
      continue;
    }

    const candidates = rankBggCandidates(row.proposedTitle, await search(row.proposedTitle));
    const top = candidates[0];
    const exactCount = candidates.filter((candidate) => candidate.score === 1).length;
    report.push({
      ...row,
      candidateCount: candidates.length,
      suggestedBggId: top?.bggId,
      suggestedTitle: top?.name ?? "",
      suggestedYear: top?.yearPublished,
      suggestionScore: top?.score,
      suggestionStatus: !top
        ? "not-found"
        : top.score === 1 && exactCount === 1
          ? "exact-title"
          : "review"
    });
  }
  return report;
}

export const MATCH_REPORT_HEADERS = [
  "slug",
  "kind",
  "parent_slug",
  "proposed_title",
  "edition_or_owned_detail",
  "source_url",
  "known_bgg_id",
  "match_status",
  "intake_notes",
  "matching_notes",
  "candidate_count",
  "suggested_bgg_id",
  "suggested_title",
  "suggested_year",
  "suggestion_score",
  "suggestion_status"
] as const;

export function matchReportToCsv(rows: MatchReportRow[]): string {
  return recordsToCsv(
    rows.map((row) => ({
      slug: row.slug,
      kind: row.kind,
      parent_slug: row.parentSlug,
      proposed_title: row.proposedTitle,
      edition_or_owned_detail: row.editionOrOwnedDetail,
      source_url: row.sourceUrl,
      known_bgg_id: row.knownBggId,
      match_status: row.matchStatus,
      intake_notes: row.intakeNotes,
      matching_notes: row.matchingNotes,
      candidate_count: row.candidateCount,
      suggested_bgg_id: row.suggestedBggId,
      suggested_title: row.suggestedTitle,
      suggested_year: row.suggestedYear,
      suggestion_score:
        row.suggestionScore === undefined ? undefined : row.suggestionScore.toFixed(3),
      suggestion_status: row.suggestionStatus
    })),
    [...MATCH_REPORT_HEADERS]
  );
}
