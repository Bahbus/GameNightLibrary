import { lazy, Suspense } from "preact/compat";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink } from "./ExternalLink";
import { GameCard } from "./features/catalog/CatalogGameCard";
import { GameInspector } from "./features/catalog/GameInspector";
import { FilterPanel } from "./features/discovery/FilterPanel";
import { Maintenance } from "./features/maintenance/Maintenance";
import { Roulette } from "./features/roulette/Roulette";
import { WishlistPanel } from "./features/wishlist/WishlistPanel";
import { SiteFooter } from "./SiteFooter";
import { buildAppUrl, parseAppView, type AppView } from "./lib/appNavigation";
import { createStandalonePlayModes, filterAndScore, sortScoredGames } from "./lib/catalog";
import { DEFAULT_PREFERENCES, parsePreferences } from "./lib/preferences";
import type { CatalogPayload, GroupPreferences, SortKey } from "./types";

const STORAGE_KEY = "board-game-inventory:preferences:v1";
const DRAWN_KEY = "board-game-inventory:drawn:v1";
const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;
const SetupAccessGate = lazy(() =>
  import("./features/setup/SetupAccessGate").then(({ SetupAccessGate }) => ({
    default: SetupAccessGate
  }))
);

const viewTitles: Record<AppView, string> = {
  library: "Library | Game Night Library",
  roulette: "Roulette | Game Night Library",
  wishlist: "Wish list | Game Night Library",
  maintain: "Manage | Game Night Library",
  setup: "Setup | Game Night Library"
};

const storeLocally = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Filtering and roulette still work when storage is unavailable or full.
  }
};

const isSetupAuthCallback = () => {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.has("code") || query.has("state");
};

function initialPreferences(): GroupPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  const fromUrl = parsePreferences(window.location.search);
  if (window.location.search) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function initialView(): AppView {
  if (typeof window === "undefined") return "library";
  if (isSetupAuthCallback()) return "setup";
  return parseAppView(window.location.search);
}

export function App() {
  const setupAuthCallback = isSetupAuthCallback();
  const [payload, setPayload] = useState<CatalogPayload>();
  const [error, setError] = useState("");
  const [view, setView] = useState<AppView>(initialView);
  const [preferences, setPreferences] = useState<GroupPreferences>(initialPreferences);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [inspectedSlug, setInspectedSlug] = useState("");
  const inspectorTrigger = useRef<HTMLButtonElement>();
  const [drawn, setDrawnState] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAWN_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const navigateToView = useCallback(
    (nextView: AppView) => {
      if (nextView === view) return;
      setView(nextView);
      if (!isSetupAuthCallback()) {
        window.history.pushState(
          null,
          "",
          buildAppUrl(window.location.pathname, preferences, nextView)
        );
      }
    },
    [preferences, view]
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}catalog.json`)
      .then((response) => {
        if (!response.ok) throw new Error("The catalog could not be loaded.");
        return response.json() as Promise<CatalogPayload>;
      })
      .then(setPayload)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    if (payload && !payload.setupRequired && !setupAuthCallback && view === "setup") {
      setView("library");
      window.history.replaceState(
        null,
        "",
        buildAppUrl(window.location.pathname, preferences, "library")
      );
    }
  }, [payload, preferences, setupAuthCallback, view]);

  useEffect(() => {
    storeLocally(STORAGE_KEY, preferences);
    if (isSetupAuthCallback()) return;
    window.history.replaceState(null, "", buildAppUrl(window.location.pathname, preferences, view));
    setShareStatus("idle");
  }, [preferences, view]);

  useEffect(() => {
    document.title = viewTitles[view];
  }, [view]);

  useEffect(() => {
    const restoreUrlState = () => {
      setView(parseAppView(window.location.search));
      setPreferences(parsePreferences(window.location.search));
    };
    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, []);

  const setDrawn = (next: string[]) => {
    setDrawnState(next);
    storeLocally(DRAWN_KEY, next);
  };

  const copyShareLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  };

  const games = useMemo(() => createStandalonePlayModes(payload?.games ?? []), [payload]);
  const scored = useMemo(
    () => sortScoredGames(filterAndScore(games, preferences), preferences.sort),
    [games, preferences]
  );
  const inspectedEntry = scored.find((entry) => entry.game.slug === inspectedSlug);
  const closeInspector = useCallback(() => {
    setInspectedSlug("");
    window.requestAnimationFrame(() => {
      if (inspectorTrigger.current?.isConnected) inspectorTrigger.current.focus();
    });
  }, []);

  useEffect(() => {
    if (view !== "library" || (inspectedSlug && !inspectedEntry)) setInspectedSlug("");
  }, [inspectedEntry, inspectedSlug, view]);
  const stale = payload
    ? Date.now() - new Date(payload.refreshedAt).getTime() > 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <>
      <header class="site-header">
        <a class="brand" href={`${import.meta.env.BASE_URL}`}>
          <span class="brand-mark" aria-hidden="true">
            ⚄
          </span>
          <span>
            <strong>Game Night</strong>
            <small>Library</small>
          </span>
        </a>
        <nav aria-label="Primary">
          {(
            [
              ["library", "Library"],
              ["roulette", "Roulette"],
              ["wishlist", "Wish list"],
              ["maintain", "Manage"],
              ...(payload?.setupRequired !== false || setupAuthCallback
                ? ([["setup", "Setup"]] as const)
                : [])
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              class={view === value ? "is-active" : ""}
              aria-current={view === value ? "page" : undefined}
              onClick={() => navigateToView(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </nav>
        <ExternalLink class="github-link" href={REPOSITORY_URL}>
          GitHub
        </ExternalLink>
      </header>

      <main id="main">
        <p class="sr-only" role="status" aria-live="polite">
          {viewTitles[view].split(" |")[0]} view loaded.
        </p>
        {view === "library" && (
          <section class="hero">
            <div class="hero-copy">
              <span class="eyebrow">Your shelves, sorted for tonight</span>
              <h1>
                Find the game that <em>fits the table.</em>
              </h1>
              <p>
                Set the group size, time, and vibe. Browse the best matches—or let the roulette
                settle it.
              </p>
            </div>
            <div class="hero-decor" aria-hidden="true">
              <div class="die die-one">⚄</div>
              <div class="meeple">♟</div>
              <div class="card-shape">PLAY</div>
            </div>
          </section>
        )}

        {stale && (
          <div class="status-banner" role="status">
            BoardGameGeek details are more than 30 days old. Inventory and house notes are still
            current.
          </div>
        )}

        {(view === "library" || view === "roulette") && (
          <div
            class={`discovery-layout discovery-layout-${view}${inspectedEntry ? " has-inspector" : ""}`}
          >
            <FilterPanel preferences={preferences} onChange={setPreferences} games={games} />
            <div class="discovery-content">
              {view === "roulette" ? (
                <Roulette games={scored} drawn={drawn} setDrawn={setDrawn} />
              ) : (
                <section class="library-section" aria-labelledby="library-title">
                  <div class="library-toolbar">
                    <div>
                      <span class="eyebrow">The shortlist</span>
                      <h2 id="library-title" aria-live="polite" aria-atomic="true">
                        {payload
                          ? `${scored.length} game${scored.length === 1 ? "" : "s"} ready`
                          : "Loading the shelves…"}
                      </h2>
                    </div>
                    <div class="toolbar-actions">
                      <label class="search-field">
                        <span class="sr-only">Search library</span>
                        <input
                          type="search"
                          value={preferences.query}
                          onInput={(event) =>
                            setPreferences({ ...preferences, query: event.currentTarget.value })
                          }
                          placeholder="Search games, mechanics…"
                        />
                      </label>
                      <label>
                        <span class="sr-only">Sort games</span>
                        <select
                          value={preferences.sort}
                          onChange={(event) =>
                            setPreferences({
                              ...preferences,
                              sort: event.currentTarget.value as SortKey
                            })
                          }
                        >
                          <option value="name">Sort: Name</option>
                          <option value="houseRating">House rating</option>
                          <option value="bggRating">BoardGameGeek rating</option>
                          <option value="complexity">Complexity</option>
                          <option value="duration">Duration</option>
                          <option value="players">Player count</option>
                        </select>
                      </label>
                      <button
                        class="secondary-button dark compact-button"
                        onClick={() => void copyShareLink()}
                      >
                        <span aria-live="polite">
                          {shareStatus === "copied"
                            ? "Copied!"
                            : shareStatus === "failed"
                              ? "Copy failed"
                              : "Copy link"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div class="empty-state" role="alert">
                      <span aria-hidden="true">!</span>
                      <h3>We couldn’t open the library</h3>
                      <p>{error}</p>
                    </div>
                  ) : payload && !payload.games.length ? (
                    <div class="empty-state">
                      <span aria-hidden="true">♟</span>
                      <h3>The shelves are ready for their first game</h3>
                      <p>
                        Start with the bulk CSV template, or use Manage to prepare an individual
                        addition.
                      </p>
                      <button class="primary-button" onClick={() => navigateToView("maintain")}>
                        Add the first game
                      </button>
                    </div>
                  ) : payload && !scored.length ? (
                    <div class="empty-state">
                      <span aria-hidden="true">◇</span>
                      <h3>No game meets every requirement</h3>
                      <p>Try a longer time limit, another mode, or a different table size.</p>
                      <button
                        class="secondary-button dark"
                        onClick={() => setPreferences({ ...DEFAULT_PREFERENCES })}
                      >
                        Clear requirements
                      </button>
                    </div>
                  ) : (
                    <div class="game-grid">
                      {scored.map((entry) => (
                        <GameCard
                          entry={entry}
                          key={entry.game.slug}
                          onInspect={(trigger) => {
                            inspectorTrigger.current = trigger;
                            setInspectedSlug(entry.game.slug);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
            {inspectedEntry && (
              <>
                <div class="inspector-backdrop" aria-hidden="true" onClick={closeInspector} />
                <GameInspector entry={inspectedEntry} onClose={closeInspector} />
              </>
            )}
          </div>
        )}

        {view === "wishlist" && <WishlistPanel games={payload?.wishlist ?? []} />}

        {view === "maintain" && <Maintenance games={payload?.games ?? []} />}

        {view === "setup" && (
          <Suspense
            fallback={
              <section class="setup-loading" aria-busy="true">
                <span role="status">Opening secure setup…</span>
              </section>
            }
          >
            <SetupAccessGate />
          </Suspense>
        )}
      </main>

      <SiteFooter refreshedAt={payload?.refreshedAt} />
    </>
  );
}
