export { parseGameSource, slugifyGameName } from "../../shared/inventory/requestFields";

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
  source: string;
  name: string;
  reasons: string;
  notes: string;
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
    "game-source": request.source,
    "game-name": request.name,
    reasons: request.reasons,
    notes: request.notes
  });
  [...params.entries()].forEach(([key, value]) => {
    if (!value) params.delete(key);
  });
  return `${repositoryUrl}/issues/new?${params.toString()}`;
}
