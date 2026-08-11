import { useState } from "preact/hooks";
import { ExternalLink } from "../../ExternalLink";
import { effectiveModes, effectiveValues } from "../../lib/catalog";
import { buildIssueUrl } from "../../lib/maintenance";
import type { CatalogGame, ScoredGame } from "../../types";
import { formatMinutes, formatPlayers } from "./gameFormatting";

const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;

export function Cover({ game }: { game: CatalogGame }) {
  const [failed, setFailed] = useState(false);
  const image = game.metadata.cachedThumbnail;
  if (!image || failed) {
    return (
      <div class="cover-fallback" aria-hidden="true">
        <span>♟</span>
        <strong>{game.name.slice(0, 1)}</strong>
      </div>
    );
  }
  return (
    <img class="game-cover" src={image} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

export function GameCard({
  entry,
  onInspect
}: {
  entry: ScoredGame;
  onInspect: (trigger: HTMLButtonElement) => void;
}) {
  const { game } = entry;
  const values = effectiveValues(game);
  const overridden = Boolean(game.overrides && Object.keys(game.overrides).length);

  return (
    <article class="game-card">
      <div class="cover-wrap">
        <Cover game={game} />
        <span class="match-pill">{Math.round(entry.matchScore * 100)}% match</span>
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <div>
            <span class="eyebrow">
              {game.metadata.yearPublished ?? "Year unknown"} · Shelf {game.shelf ?? "unassigned"}
            </span>
            <h3>{game.name}</h3>
          </div>
          {game.house.rating && (
            <span class="house-rating" aria-label={`House rating ${game.house.rating} out of 5`}>
              ★ {game.house.rating}
            </span>
          )}
        </div>
        <div class="stat-row">
          <span>♟ {formatPlayers(values.minPlayers, values.maxPlayers)}</span>
          <span>◷ {formatMinutes(values.minMinutes, values.maxMinutes)}</span>
          <span>◆ {game.metadata.complexity?.toFixed(1) ?? "?"} weight</span>
        </div>
        {overridden && <p class="override-note">House values control the displayed range.</p>}
        <div class="tag-row">
          {[...effectiveModes(game), ...game.house.moods].slice(0, 5).map((tag) => (
            <span class="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        {game.expansions.length > 0 && (
          <details class="expansion-list">
            <summary>
              {game.expansions.length} owned expansion
              {game.expansions.length === 1 ? "" : "s"}
            </summary>
            <ul>
              {game.expansions.map((expansion) => (
                <li key={expansion.slug}>
                  <span>{expansion.name}</span>
                  {expansion.standalone && <span class="mini-badge">Standalone</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div class="card-links">
          <button
            class="secondary-button dark compact-button"
            type="button"
            data-inspector-trigger={game.slug}
            aria-haspopup="dialog"
            onClick={(event) => onInspect(event.currentTarget)}
          >
            Details
          </button>
          {game.metadata.url && (
            <ExternalLink href={game.metadata.url}>
              {game.bggId ? "View on BoardGameGeek" : "View product source"}
            </ExternalLink>
          )}
          <ExternalLink
            href={buildIssueUrl(REPOSITORY_URL, {
              operation: "update",
              bggId: game.bggId?.toString() ?? "",
              sourceUrl: game.sourceUrl ?? "",
              name: game.name,
              slug: game.slug,
              parentId: "",
              parentSlug: "",
              modes: "",
              notes: ""
            })}
          >
            Suggest edit
          </ExternalLink>
        </div>
      </div>
    </article>
  );
}
