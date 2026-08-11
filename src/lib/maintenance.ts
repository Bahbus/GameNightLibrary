export interface MaintenanceRequest {
  operation: "add" | "update" | "remove";
  bggId: string;
  sourceUrl: string;
  name: string;
  slug: string;
  parentId: string;
  parentSlug: string;
  modes: string;
  notes: string;
}

export interface WishlistRequest {
  bggId: string;
  sourceUrl: string;
  name: string;
  reasons: string;
  notes: string;
}

export function slugifyGameName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseGameSource(value: string): { bggId: string; sourceUrl: string } {
  const source = value.trim();
  if (/^\d+$/.test(source)) return { bggId: source, sourceUrl: "" };
  try {
    const url = new URL(source);
    const bggMatch =
      /(?:^|\.)boardgamegeek\.com$/i.test(url.hostname) &&
      /^\/boardgame\/(\d+)(?:\/|$)/.exec(url.pathname);
    return bggMatch ? { bggId: bggMatch[1], sourceUrl: "" } : { bggId: "", sourceUrl: url.href };
  } catch {
    return { bggId: "", sourceUrl: "" };
  }
}

export function buildIssueUrl(repositoryUrl: string, request: MaintenanceRequest): string {
  const params = new URLSearchParams({
    template: `inventory-${request.operation}.yml`,
    "bgg-id": request.bggId,
    "source-url": request.sourceUrl,
    "game-name": request.name,
    slug: request.slug,
    "parent-bgg-id": request.parentId,
    "parent-slug": request.parentSlug,
    modes: request.modes,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}

export function buildWishlistIssueUrl(repositoryUrl: string, request: WishlistRequest): string {
  const params = new URLSearchParams({
    template: "game-request.yml",
    "bgg-id": request.bggId,
    "source-url": request.sourceUrl,
    "game-name": request.name,
    reasons: request.reasons,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}
