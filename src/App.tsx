import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink } from "./ExternalLink";
import { Maintenance } from "./features/maintenance/Maintenance";
import { WishlistPanel } from "./features/wishlist/WishlistPanel";
import { SetupAccessGate } from "./SetupAccessGate";
import { SiteFooter } from "./SiteFooter";
import { buildAppUrl, parseAppView, type AppView } from "./lib/appNavigation";
import {
  createStandalonePlayModes,
  effectiveModes,
  effectiveValues,
  filterAndScore,
  sortScoredGames,
  weightedDraw
} from "./lib/catalog";
import { DEFAULT_PREFERENCES, parsePreferences } from "./lib/preferences";
import { buildIssueUrl } from "./lib/maintenance";
import type {
  CatalogGame,
  CatalogPayload,
  GameMode,
  GroupPreferences,
  ScoredGame,
  SortKey,
  TableSpace
} from "./types";

const STORAGE_KEY = "board-game-inventory:preferences:v1";
const DRAWN_KEY = "board-game-inventory:drawn:v1";
const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;

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

const isSetupAuthCallback = () => {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.has("code") || query.has("state");
};

const formatMinutes = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return "Time unknown";
  if (min === max || max === undefined) return `${min} min`;
  if (min === undefined) return `Up to ${max} min`;
  return `${min}–${max} min`;
};

const formatPlayers = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return "Players unknown";
  if (min === max || max === undefined) return `${min} players`;
  if (min === undefined) return `Up to ${max} players`;
  return `${min}–${max} players`;
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

function ToggleList({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!options.length) return null;
  return (
    <fieldset class="chip-fieldset">
      <legend>{label}</legend>
      <div class="chips">
        {options.map((option) => (
          <label class={`chip ${selected.includes(option) ? "is-active" : ""}`} key={option}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() =>
                onChange(
                  selected.includes(option)
                    ? selected.filter((item) => item !== option)
                    : [...selected, option]
                )
              }
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FilterPanel({
  preferences,
  onChange,
  games
}: {
  preferences: GroupPreferences;
  onChange: (next: GroupPreferences) => void;
  games: CatalogGame[];
}) {
  const update = <K extends keyof GroupPreferences>(key: K, value: GroupPreferences[K]) =>
    onChange({ ...preferences, [key]: value });
  const mechanics = useMemo(
    () => [...new Set(games.flatMap((game) => game.metadata.mechanics))].sort().slice(0, 20),
    [games]
  );
  const themes = useMemo(
    () => [...new Set(games.flatMap((game) => game.metadata.categories))].sort().slice(0, 20),
    [games]
  );
  const moods = useMemo(
    () => [...new Set(games.flatMap((game) => game.house.moods))].sort(),
    [games]
  );
  const accessFlags = useMemo(
    () => [...new Set(games.flatMap((game) => game.house.accessibilityFlags))].sort(),
    [games]
  );
  const contentFlags = useMemo(
    () => [...new Set(games.flatMap((game) => game.house.contentFlags))].sort(),
    [games]
  );

  return (
    <aside class="filter-panel" aria-label="Group requirements and preferences">
      <div class="filter-heading">
        <div>
          <span class="eyebrow">Build your game night</span>
          <h2>Who’s playing?</h2>
        </div>
        <button
          class="secondary-button dark compact-button"
          onClick={() => onChange({ ...DEFAULT_PREFERENCES })}
        >
          Reset
        </button>
      </div>

      <div class="filter-grid">
        <label>
          Group size
          <input
            type="number"
            min="1"
            max="99"
            value={preferences.players ?? ""}
            placeholder="Any"
            onInput={(event) =>
              update(
                "players",
                event.currentTarget.value ? Number(event.currentTarget.value) : undefined
              )
            }
          />
        </label>
        <label>
          Hard time limit
          <select
            value={preferences.maxMinutes ?? ""}
            onChange={(event) =>
              update(
                "maxMinutes",
                event.currentTarget.value ? Number(event.currentTarget.value) : undefined
              )
            }
          >
            <option value="">Any length</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">90 minutes</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>
        <label>
          Must support
          <select
            value={preferences.requiredMode}
            onChange={(event) => update("requiredMode", event.currentTarget.value as GameMode | "")}
          >
            <option value="">Any mode</option>
            <option value="competitive">Competitive</option>
            <option value="cooperative">Cooperative</option>
            <option value="team">Teams</option>
            <option value="solo">Solo</option>
          </select>
        </label>
        <label>
          Youngest player
          <input
            type="number"
            min="1"
            max="99"
            value={preferences.minAge ?? ""}
            placeholder="Any age"
            onInput={(event) =>
              update(
                "minAge",
                event.currentTarget.value ? Number(event.currentTarget.value) : undefined
              )
            }
          />
        </label>
        <label>
          Table size
          <select
            value={preferences.maxTableSpace}
            onChange={(event) =>
              update("maxTableSpace", event.currentTarget.value as TableSpace | "")
            }
          >
            <option value="">Any table</option>
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label class="check-control">
          <input
            type="checkbox"
            checked={preferences.learnedOnly}
            onChange={(event) => update("learnedOnly", event.currentTarget.checked)}
          />
          Only games we know
        </label>
      </div>

      <details>
        <summary>Fine-tune the vibe</summary>
        <div class="filter-grid advanced-grid">
          <label>
            Ideal playing time
            <input
              type="range"
              min="15"
              max="240"
              step="15"
              value={preferences.targetMinutes ?? 90}
              onInput={(event) => update("targetMinutes", Number(event.currentTarget.value))}
            />
            <output>{preferences.targetMinutes ?? 90} min</output>
          </label>
          <label>
            Ideal complexity
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={preferences.targetComplexity ?? 3}
              onInput={(event) => update("targetComplexity", Number(event.currentTarget.value))}
            />
            <output>{preferences.targetComplexity ?? 3} / 5</output>
          </label>
          <label>
            Interaction
            <input
              type="range"
              min="1"
              max="5"
              value={preferences.targetInteraction ?? 3}
              onInput={(event) => update("targetInteraction", Number(event.currentTarget.value))}
            />
            <output>{preferences.targetInteraction ?? 3} / 5</output>
          </label>
          <label>
            Luck
            <input
              type="range"
              min="1"
              max="5"
              value={preferences.targetLuck ?? 3}
              onInput={(event) => update("targetLuck", Number(event.currentTarget.value))}
            />
            <output>{preferences.targetLuck ?? 3} / 5</output>
          </label>
          <label>
            Downtime
            <input
              type="range"
              min="1"
              max="5"
              value={preferences.targetDowntime ?? 3}
              onInput={(event) => update("targetDowntime", Number(event.currentTarget.value))}
            />
            <output>{preferences.targetDowntime ?? 3} / 5</output>
          </label>
          <label>
            Maximum setup
            <input
              type="number"
              min="0"
              value={preferences.maxSetupMinutes ?? ""}
              placeholder="No preference"
              onInput={(event) =>
                update(
                  "maxSetupMinutes",
                  event.currentTarget.value ? Number(event.currentTarget.value) : undefined
                )
              }
            />
          </label>
          <label>
            Maximum teach difficulty
            <select
              value={preferences.maxTeachDifficulty ?? ""}
              onChange={(event) =>
                update(
                  "maxTeachDifficulty",
                  event.currentTarget.value ? Number(event.currentTarget.value) : undefined
                )
              }
            >
              <option value="">No preference</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option value={value} key={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </label>
        </div>
        <ToggleList
          label="Mood"
          options={moods}
          selected={preferences.preferredMoods}
          onChange={(value) => update("preferredMoods", value)}
        />
        <ToggleList
          label="Mechanics"
          options={mechanics}
          selected={preferences.preferredMechanics}
          onChange={(value) => update("preferredMechanics", value)}
        />
        <ToggleList
          label="Themes"
          options={themes}
          selected={preferences.preferredThemes}
          onChange={(value) => update("preferredThemes", value)}
        />
        <ToggleList
          label="Avoid accessibility conflicts"
          options={accessFlags}
          selected={preferences.excludedAccessibility}
          onChange={(value) => update("excludedAccessibility", value)}
        />
        <ToggleList
          label="Avoid content"
          options={contentFlags}
          selected={preferences.excludedContent}
          onChange={(value) => update("excludedContent", value)}
        />
      </details>
    </aside>
  );
}

function Cover({ game }: { game: CatalogGame }) {
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

function GameCard({
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

function GameInspector({ entry, onClose }: { entry: ScoredGame; onClose: () => void }) {
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
        <span class="eyebrow">Game details</span>
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
            <dd>{game.metadata.rating?.toFixed(1) ?? "Unknown"}</dd>
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
              notes: ""
            })}
          >
            Suggest edit
          </ExternalLink>
        </div>
      </div>
    </div>
  );
}

function Roulette({
  games,
  drawn,
  setDrawn
}: {
  games: ScoredGame[];
  drawn: string[];
  setDrawn: (next: string[]) => void;
}) {
  const [winner, setWinner] = useState<ScoredGame>();
  const [revealing, setRevealing] = useState(false);
  const timer = useRef<number>();

  const draw = () => {
    if (timer.current) window.clearTimeout(timer.current);
    const result = weightedDraw(games, new Set(drawn));
    if (!result) return;
    setWinner(result);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRevealing(!reduced);
    if (!drawn.includes(result.game.slug)) setDrawn([...drawn, result.game.slug]);
    if (!reduced) {
      timer.current = window.setTimeout(() => setRevealing(false), 1800);
    }
  };

  useEffect(() => () => timer.current && window.clearTimeout(timer.current), []);

  const good = winner?.components
    .filter((component) => component.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const misses = winner?.components
    .filter((component) => component.score < 0.45)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return (
    <section class="roulette-card" aria-labelledby="roulette-title">
      <div class="roulette-copy">
        <span class="eyebrow">Let chance break the tie</span>
        <h1 id="roulette-title">Game Night Roulette</h1>
        <p>Every qualifying game has a chance. Better preference matches get a stronger pull.</p>
        <div class="odds-note">
          <span>{games.length} eligible</span>
          <span>{drawn.length} already drawn</span>
        </div>
        <div class="roulette-actions">
          <button class="primary-button" onClick={draw} disabled={!games.length || revealing}>
            {winner ? "Spin again" : "Spin the roulette"}
          </button>
          {revealing && (
            <button class="secondary-button" onClick={() => setRevealing(false)}>
              Skip animation
            </button>
          )}
          {drawn.length > 0 && (
            <button
              class="secondary-button compact-button"
              onClick={() => {
                setDrawn([]);
                setWinner(undefined);
              }}
            >
              Reset draws
            </button>
          )}
        </div>
      </div>
      <div class={`roulette-stage ${revealing ? "is-spinning" : ""}`}>
        <div class="roulette-wheel" aria-hidden="true">
          <span>♟</span>
          <span>◆</span>
          <span>⚄</span>
          <span>★</span>
        </div>
        <div class="winner-panel" aria-live="polite" aria-busy={revealing}>
          {!games.length ? (
            <>
              <span class="winner-kicker">No eligible games</span>
              <strong>Loosen a requirement</strong>
            </>
          ) : !winner ? (
            <>
              <span class="winner-kicker">The table is ready</span>
              <strong>What will fate choose?</strong>
            </>
          ) : revealing ? (
            <>
              <span class="winner-kicker">Shuffling the library…</span>
              <strong>Hold onto your meeples!</strong>
            </>
          ) : (
            <>
              <span class="winner-kicker">Tonight’s pick</span>
              <strong>{winner.game.name}</strong>
              <span>{Math.round(winner.matchScore * 100)}% preference match</span>
            </>
          )}
        </div>
      </div>
      {winner && !revealing && (
        <div class="match-explanation">
          {good && good.length > 0 && (
            <div>
              <h3>Why it fits</h3>
              <ul>
                {good.map((item) => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            </div>
          )}
          {misses && misses.length > 0 && (
            <div>
              <h3>Worth knowing</h3>
              <ul>
                {misses.map((item) => (
                  <li key={item.key}>{item.label} is a weaker match</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
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

        {view === "setup" && <SetupAccessGate />}
      </main>

      <SiteFooter refreshedAt={payload?.refreshedAt} />
    </>
  );
}
