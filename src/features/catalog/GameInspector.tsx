import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../../ExternalLink";
import { effectiveModes, effectiveValues } from "../../lib/catalog";
import { buildIssueUrl } from "../../lib/maintenance";
import type { ScoredGame } from "../../types";
import { Cover } from "./CatalogGameCard";
import { formatMinutes, formatPlayers } from "./gameFormatting";

const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function GameInspector({
  entry,
  onClose,
  demo = false
}: {
  entry: ScoredGame;
  onClose: () => void;
  demo?: boolean;
}) {
  const { game } = entry;
  const values = effectiveValues(game);
  const closeButton = useRef<globalThis.HTMLButtonElement>(null);
  const dialog = useRef<globalThis.HTMLDivElement>(null);
  const overlayMode = useMediaQuery("(max-width: 1719px)");

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!overlayMode || event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.current?.querySelectorAll<globalThis.HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary"
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    if (overlayMode) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeys);
    };
  }, [game.slug, onClose, overlayMode]);

  return (
    <div
      ref={dialog}
      class="game-inspector"
      role="dialog"
      aria-modal={overlayMode ? "true" : undefined}
      aria-labelledby="game-inspector-title"
    >
      <div class="game-inspector-heading">
        <span class="eyebrow">{demo ? "Fictional demo" : "Game details"}</span>
        <button
          ref={closeButton}
          class="secondary-button dark compact-button inspector-close"
          type="button"
          onClick={onClose}
        >
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="inspector-cover">
        <Cover game={game} />
        <span class="match-pill">{Math.round(entry.matchScore * 100)}% match</span>
      </div>
      <div class="inspector-body">
        <h2 id="game-inspector-title">{game.name}</h2>
        {demo && (
          <p class="demo-notice">
            This fictional game is here so you can try the library before the real collection is
            published. It is not owned and will disappear automatically.
          </p>
        )}
        {game.edition && <p class="inspector-edition">{game.edition} edition</p>}
        <dl class="inspector-stats">
          <div>
            <dt>Players</dt>
            <dd>{formatPlayers(values.minPlayers, values.maxPlayers)}</dd>
          </div>
          <div>
            <dt>Playing time</dt>
            <dd>{formatMinutes(values.minMinutes, values.maxMinutes)}</dd>
          </div>
          <div>
            <dt>Minimum age</dt>
            <dd>{values.minAge ? `${values.minAge}+` : "Unknown"}</dd>
          </div>
          <div>
            <dt>Complexity</dt>
            <dd>{game.metadata.complexity?.toFixed(1) ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>House rating</dt>
            <dd>{game.house.rating ? `${game.house.rating} / 5` : "Not rated"}</dd>
          </div>
          <div>
            <dt>BoardGameGeek rating</dt>
            <dd>{demo ? "Not applicable" : (game.metadata.rating?.toFixed(1) ?? "Unknown")}</dd>
          </div>
        </dl>

        <div class="inspector-shelf">
          <strong>{game.availability === "available" ? "Available" : game.availability}</strong>
          <span>Shelf {game.shelf ?? "unassigned"}</span>
          <span>{game.learned ? "Learned" : "Not learned yet"}</span>
        </div>

        {[...effectiveModes(game), ...game.house.moods].length > 0 && (
          <div class="tag-row">
            {[...effectiveModes(game), ...game.house.moods].map((tag) => (
              <span class="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {game.house.recommendationNotes && (
          <section class="inspector-note">
            <h3>House recommendation</h3>
            <p>{game.house.recommendationNotes}</p>
          </section>
        )}

        {game.expansions.length > 0 && (
          <section class="inspector-note">
            <h3>Owned expansions</h3>
            <ul>
              {game.expansions.map((expansion) => (
                <li key={expansion.slug}>{expansion.name}</li>
              ))}
            </ul>
          </section>
        )}

        <div class="inspector-links">
          {!demo && game.metadata.url && (
            <ExternalLink href={game.metadata.url}>
              {game.bggId ? "View on BoardGameGeek" : "View product source"}
            </ExternalLink>
          )}
          {!demo && (
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
          )}
        </div>
      </div>
    </div>
  );
}
