import { csvRecords, parseCsv, recordsToCsv } from "./csv.js";

export const INTAKE_HEADERS = [
  "include",
  "submitted_wording",
  "proposed_title",
  "kind",
  "parent_title",
  "edition_or_owned_detail",
  "match_status",
  "notes",
  "source_url"
] as const;

export const MATCHING_HEADERS = [
  "slug",
  "kind",
  "parent_slug",
  "proposed_title",
  "edition_or_owned_detail",
  "quantity",
  "standalone",
  "source_url",
  "known_bgg_id",
  "match_status",
  "intake_notes",
  "matching_notes"
] as const;

export type MatchingStatus =
  "matched-from-source" | "local-only" | "pending-bgg-search" | "review-shared-bgg-id";

export interface IntakeRow {
  include: string;
  submittedWording: string;
  proposedTitle: string;
  kind: string;
  parentTitle: string;
  editionOrOwnedDetail: string;
  matchStatus: string;
  notes: string;
  sourceUrl: string;
}

export interface MatchingRow {
  slug: string;
  kind: "game" | "expansion";
  parentSlug: string;
  proposedTitle: string;
  editionOrOwnedDetail: string;
  quantity: number;
  standalone: boolean;
  sourceUrl: string;
  knownBggId?: number;
  matchStatus: MatchingStatus;
  intakeNotes: string;
  matchingNotes: string;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function directBggId(sourceUrl: string): number | undefined {
  if (!sourceUrl) return undefined;
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (!["boardgamegeek.com", "www.boardgamegeek.com"].includes(url.hostname)) return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.includes("expansions")) return undefined;
  if (!["boardgame", "boardgameexpansion"].includes(parts[0])) return undefined;
  const id = Number(parts[1]);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

const isBggUrl = (sourceUrl: string) => {
  try {
    const hostname = new URL(sourceUrl).hostname;
    return hostname === "boardgamegeek.com" || hostname === "www.boardgamegeek.com";
  } catch {
    return false;
  }
};

export function parseIntakeCsv(source: string): IntakeRow[] {
  const [headers] = parseCsv(source);
  if (!headers || headers.join(",") !== INTAKE_HEADERS.join(",")) {
    throw new Error(`Inventory intake headers must be: ${INTAKE_HEADERS.join(",")}`);
  }
  return csvRecords(source)
    .filter((row) => row.include === "Yes")
    .map((row, index) => {
      if (!row.proposed_title) throw new Error(`Intake row ${index + 2} requires proposed_title.`);
      if (!["Base game", "Base game/set", "Expansion"].includes(row.kind)) {
        throw new Error(`Intake row ${index + 2} has unsupported kind ${row.kind}.`);
      }
      if (row.kind === "Expansion" && !row.parent_title) {
        throw new Error(`Intake row ${index + 2} requires parent_title.`);
      }
      return {
        include: row.include,
        submittedWording: row.submitted_wording,
        proposedTitle: row.proposed_title,
        kind: row.kind,
        parentTitle: row.parent_title,
        editionOrOwnedDetail: row.edition_or_owned_detail,
        matchStatus: row.match_status,
        notes: row.notes,
        sourceUrl: row.source_url
      };
    });
}

export function buildMatchingManifest(intake: IntakeRow[]): MatchingRow[] {
  const slugByTitle = new Map<string, string>();
  const usedSlugs = new Set<string>();

  for (const row of intake) {
    const slug = slugify(row.proposedTitle);
    if (!slug) throw new Error(`Could not create a slug for ${row.proposedTitle}.`);
    if (slugByTitle.has(row.proposedTitle)) {
      throw new Error(`Duplicate proposed title: ${row.proposedTitle}.`);
    }
    if (usedSlugs.has(slug)) throw new Error(`Duplicate generated slug: ${slug}.`);
    slugByTitle.set(row.proposedTitle, slug);
    usedSlugs.add(slug);
  }

  const manifest = intake.map((row): MatchingRow => {
    const knownBggId = directBggId(row.sourceUrl);
    const parentSlug = row.parentTitle ? slugByTitle.get(row.parentTitle) : "";
    if (row.kind === "Expansion" && !parentSlug) {
      throw new Error(`${row.proposedTitle} references missing parent ${row.parentTitle}.`);
    }
    const localOnly = Boolean(row.sourceUrl) && !isBggUrl(row.sourceUrl);
    return {
      slug: slugByTitle.get(row.proposedTitle)!,
      kind: row.kind === "Expansion" ? "expansion" : "game",
      parentSlug: parentSlug ?? "",
      proposedTitle: row.proposedTitle,
      editionOrOwnedDetail: row.editionOrOwnedDetail,
      quantity: 1,
      standalone: false,
      sourceUrl: row.sourceUrl,
      knownBggId,
      matchStatus: knownBggId
        ? "matched-from-source"
        : localOnly
          ? "local-only"
          : "pending-bgg-search",
      intakeNotes: row.notes,
      matchingNotes: ""
    };
  });

  const idCounts = new Map<number, number>();
  manifest.forEach((row) => {
    if (row.knownBggId) idCounts.set(row.knownBggId, (idCounts.get(row.knownBggId) ?? 0) + 1);
  });
  return manifest.map((row) =>
    row.knownBggId && (idCounts.get(row.knownBggId) ?? 0) > 1
      ? {
          ...row,
          matchStatus: "review-shared-bgg-id",
          matchingNotes:
            "Multiple intake rows share this BGG ID; consolidate or model the owned content before import."
        }
      : row
  );
}

export function matchingManifestToCsv(rows: MatchingRow[]): string {
  return recordsToCsv(
    rows.map((row) => ({
      slug: row.slug,
      kind: row.kind,
      parent_slug: row.parentSlug,
      proposed_title: row.proposedTitle,
      edition_or_owned_detail: row.editionOrOwnedDetail,
      quantity: row.quantity,
      standalone: row.standalone,
      source_url: row.sourceUrl,
      known_bgg_id: row.knownBggId,
      match_status: row.matchStatus,
      intake_notes: row.intakeNotes,
      matching_notes: row.matchingNotes
    })),
    [...MATCHING_HEADERS]
  );
}

export function parseMatchingManifest(source: string): MatchingRow[] {
  const [headers] = parseCsv(source);
  if (!headers || headers.join(",") !== MATCHING_HEADERS.join(",")) {
    throw new Error(`Matching manifest headers must be: ${MATCHING_HEADERS.join(",")}`);
  }
  return csvRecords(source).map((row, index) => {
    const rowNumber = index + 2;
    const knownBggId = row.known_bgg_id ? Number(row.known_bgg_id) : undefined;
    if (knownBggId !== undefined && (!Number.isInteger(knownBggId) || knownBggId <= 0)) {
      throw new Error(`Matching row ${rowNumber} has an invalid known_bgg_id.`);
    }
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Matching row ${rowNumber} has an invalid quantity.`);
    }
    if (!["true", "false"].includes(row.standalone)) {
      throw new Error(`Matching row ${rowNumber} has an invalid standalone value.`);
    }
    return {
      slug: row.slug,
      kind: row.kind as MatchingRow["kind"],
      parentSlug: row.parent_slug,
      proposedTitle: row.proposed_title,
      editionOrOwnedDetail: row.edition_or_owned_detail,
      quantity,
      standalone: row.standalone === "true",
      sourceUrl: row.source_url,
      knownBggId,
      matchStatus: row.match_status as MatchingStatus,
      intakeNotes: row.intake_notes,
      matchingNotes: row.matching_notes
    };
  });
}
