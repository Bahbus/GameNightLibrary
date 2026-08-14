import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../../ExternalLink";
import { buildWishlistIssueUrl, parseGameSource } from "../../lib/maintenance";
import type { CatalogWishlistGame } from "../../types";

const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;

const wishlistStatus = {
  interested: "On our radar",
  researching: "Researching",
  planned: "Planning to buy"
} as const;

export function WishlistPanel({ games }: { games: CatalogWishlistGame[] }) {
  const [query, setQuery] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestSource, setRequestSource] = useState("");
  const [requestReasons, setRequestReasons] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const requestTrigger = useRef<HTMLButtonElement>(null);
  const requestNameInput = useRef<globalThis.HTMLInputElement>(null);
  const requestDialog = useRef<globalThis.HTMLElement>(null);
  const parsedSource = parseGameSource(requestSource);
  const sourceInvalid = Boolean(
    requestSource.trim() && !parsedSource.bggId && !parsedSource.sourceUrl
  );
  const requestUrl = buildWishlistIssueUrl(REPOSITORY_URL, {
    source: parsedSource.bggId || parsedSource.sourceUrl,
    name: requestName,
    reasons: requestReasons,
    notes: requestNotes
  });

  const closeRequest = useCallback(() => {
    setRequestOpen(false);
    window.requestAnimationFrame(() => requestTrigger.current?.focus());
  }, []);

  useEffect(() => {
    if (!requestOpen) return;
    requestNameInput.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRequest();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        requestDialog.current?.querySelectorAll<globalThis.HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href]"
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
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
    };
  }, [closeRequest, requestOpen]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? games.filter((game) =>
          [game.name, game.notes, game.metadata.categories.join(" ")]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized)
        )
      : games;
    return [...filtered].sort(
      (left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) ||
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    );
  }, [games, query]);

  return (
    <section class="wishlist-section" aria-labelledby="wishlist-title">
      <div class="wishlist-heading">
        <span class="eyebrow">Games we’re considering</span>
        <h1 id="wishlist-title">Wish list & requests</h1>
        <p>
          These games are not owned yet, so they stay out of group filters and roulette until they
          join the shelves.
        </p>
      </div>

      <div class="wishlist-toolbar">
        <label
          class="search-field"
          data-layout-motion="wishlist-search"
          data-layout-motion-at="701"
        >
          <span class="sr-only">Search wish list</span>
          <input
            type="search"
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search the wish list…"
          />
        </label>
        <button
          class="primary-button"
          type="button"
          ref={requestTrigger}
          data-layout-motion="wishlist-request"
          data-layout-motion-at="701"
          onClick={() => setRequestOpen(true)}
        >
          Request a game
        </button>
      </div>
      <p class="sr-only" role="status" aria-live="polite">
        {visible.length} wish-list {visible.length === 1 ? "game" : "games"} shown.
      </p>

      {requestOpen && (
        <>
          <div class="inspector-backdrop" aria-hidden="true" onClick={closeRequest} />
          <section
            ref={requestDialog}
            class="wishlist-request-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-request-title"
          >
            <header>
              <div>
                <span class="eyebrow">Wish-list suggestion</span>
                <h2 id="wishlist-request-title">Request a game</h2>
              </div>
              <button
                class="secondary-button dark compact-button inspector-close"
                type="button"
                onClick={closeRequest}
              >
                Close <span aria-hidden="true">×</span>
              </button>
            </header>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                window.open(requestUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <p class="wishlist-request-intro">
                Tell us what caught your eye. We’ll fill in a public request, then GitHub will ask
                you to sign in, review it, and submit it.
              </p>
              <label>
                Game name
                <input
                  ref={requestNameInput}
                  required
                  value={requestName}
                  onInput={(event) => setRequestName(event.currentTarget.value)}
                  placeholder="For example: Sky Team"
                />
              </label>
              <label>
                BoardGameGeek ID or product link
                <input
                  required
                  value={requestSource}
                  aria-invalid={sourceInvalid}
                  aria-describedby={sourceInvalid ? "wishlist-source-error" : undefined}
                  onInput={(event) => setRequestSource(event.currentTarget.value)}
                  placeholder="https://boardgamegeek.com/boardgame/…"
                />
              </label>
              {sourceInvalid && (
                <p class="field-error" id="wishlist-source-error" role="alert">
                  Enter a BoardGameGeek ID or a complete product address beginning with http:// or
                  https://.
                </p>
              )}
              <label>
                Why should we consider it?
                <textarea
                  required
                  value={requestReasons}
                  onInput={(event) => setRequestReasons(event.currentTarget.value)}
                  placeholder="What group, mood, or experience would make this a good fit?"
                />
              </label>
              <label>
                Other notes <span class="optional-label">(optional)</span>
                <textarea
                  value={requestNotes}
                  onInput={(event) => setRequestNotes(event.currentTarget.value)}
                  placeholder="Edition, availability, or anything else useful"
                />
              </label>
              <div class="wishlist-request-actions">
                <button class="secondary-button dark" type="button" onClick={closeRequest}>
                  Cancel
                </button>
                <button class="primary-button" type="submit" disabled={sourceInvalid}>
                  Continue on GitHub <span aria-hidden="true">↗</span>
                  <span class="sr-only"> in a new tab</span>
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {!games.length ? (
        <div class="empty-state">
          <span aria-hidden="true">◇</span>
          <h2>The wish list is ready for its first suggestion</h2>
          <p>Tell us what looks interesting and why it might fit the group.</p>
        </div>
      ) : !visible.length ? (
        <div class="empty-state">
          <span aria-hidden="true">◇</span>
          <h2>No wish-list game matches that search</h2>
          <button class="secondary-button dark" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      ) : (
        <div class="wishlist-grid">
          {visible.map((game) => (
            <article
              class="wishlist-card"
              key={game.slug}
              data-layout-motion={`wishlist-card-${game.slug}`}
              data-layout-motion-at="431 941 1280"
            >
              <div class="wishlist-cover">
                {game.metadata.cachedThumbnail ? (
                  <img
                    src={game.metadata.cachedThumbnail}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      event.currentTarget.nextElementSibling?.removeAttribute("hidden");
                    }}
                  />
                ) : null}
                <div class="cover-fallback" hidden={Boolean(game.metadata.cachedThumbnail)}>
                  <span aria-hidden="true">◇</span>
                </div>
              </div>
              <div class="wishlist-card-copy">
                <div class="wishlist-badges">
                  <span>{wishlistStatus[game.status]}</span>
                  {game.priority && <span>Priority {game.priority}/5</span>}
                </div>
                <h2>{game.name}</h2>
                {game.notes && <p>{game.notes}</p>}
                {game.metadata.url && (
                  <ExternalLink href={game.metadata.url}>
                    {game.bggId ? "View on BoardGameGeek" : "View source"}
                  </ExternalLink>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
