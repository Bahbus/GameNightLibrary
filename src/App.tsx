import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink } from "./ExternalLink";
import { SetupAccessGate } from "./SetupAccessGate";
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
import {
  buildIssueUrl,
  buildWishlistIssueUrl,
  parseGameSource,
  slugifyGameName
} from "./lib/maintenance";
import type {
  CatalogGame,
  CatalogPayload,
  CatalogWishlistGame,
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

const operationCopy = {
  add: {
    label: "Add",
    description: "Add a game or expansion",
    action: "Continue the add request on GitHub"
  },
  update: {
    label: "Update",
    description: "Change shelf, availability, ratings, or details",
    action: "Continue the update request on GitHub"
  },
  remove: {
    label: "Remove",
    description: "Remove an owned item from the public library",
    action: "Continue the removal request on GitHub"
  }
} as const;

function Maintenance({ games }: { games: CatalogGame[] }) {
  const [operation, setOperation] = useState<"add" | "update" | "remove">("add");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isExpansion, setIsExpansion] = useState(false);
  const [parentSlug, setParentSlug] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [notes, setNotes] = useState("");

  const inventoryItems = useMemo(
    () =>
      games
        .flatMap((game) => [
          { slug: game.slug, bggId: game.bggId, name: game.name, label: game.name },
          ...game.expansions.map((expansion) => ({
            slug: expansion.slug,
            bggId: expansion.bggId,
            name: expansion.name,
            label: `${game.name} › ${expansion.name}`
          }))
        ])
        .sort((left, right) => left.label.localeCompare(right.label)),
    [games]
  );
  const selectedItem = inventoryItems.find((item) => item.slug === selectedSlug);
  const parent = games.find((game) => game.slug === parentSlug);
  const parsedSource = parseGameSource(source);
  const generatedSlug = slugifyGameName(name);
  const slug = operation === "add" ? customSlug || generatedSlug : (selectedItem?.slug ?? "");
  const requestName = operation === "add" ? name : (selectedItem?.name ?? "");
  const bggId = operation === "add" ? parsedSource.bggId : String(selectedItem?.bggId ?? "");
  const sourceUrl = operation === "add" ? parsedSource.sourceUrl : "";
  const sourceInvalid = Boolean(source.trim() && !parsedSource.bggId && !parsedSource.sourceUrl);
  const parentId = operation === "add" && isExpansion ? String(parent?.bggId ?? "") : "";
  const selectedOperation = operationCopy[operation];

  const changeOperation = (next: "add" | "update" | "remove") => {
    setOperation(next);
    setSelectedSlug("");
  };

  const url = useMemo(() => {
    return buildIssueUrl(REPOSITORY_URL, {
      operation,
      bggId,
      sourceUrl,
      name: requestName,
      slug,
      parentId,
      parentSlug: operation === "add" && isExpansion ? parentSlug : "",
      notes: operation === "add" ? notes : ""
    });
  }, [operation, bggId, sourceUrl, requestName, slug, parentId, parentSlug, isExpansion, notes]);

  return (
    <section class="maintenance-card">
      <div class="maintenance-intro">
        <span class="eyebrow">Library management</span>
        <h1>Manage the library</h1>
        <p>
          Choose a task and identify the game here. You will finish any remaining details on GitHub.
          A maintainer reviews every proposed update before the public library changes.
        </p>
        <div class="privacy-note">
          <strong>Everything submitted is public.</strong> Use shelf labels, never addresses or
          private personal information.
        </div>
      </div>
      <form
        class="maintenance-form"
        onSubmit={(event) => {
          event.preventDefault();
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        <fieldset class="operation-picker">
          <legend>What would you like to do?</legend>
          {(["add", "update", "remove"] as const).map((value) => (
            <label
              class={`${operation === value ? "is-active" : ""} ${value !== "add" && !inventoryItems.length ? "is-disabled" : ""}`}
              key={value}
            >
              <input
                aria-label={operationCopy[value].label}
                type="radio"
                name="operation"
                value={value}
                checked={operation === value}
                disabled={value !== "add" && !inventoryItems.length}
                onChange={() => changeOperation(value)}
              />
              <span>
                <strong>{operationCopy[value].label}</strong>
                <small>
                  {value !== "add" && !inventoryItems.length
                    ? "Available after the first game is published"
                    : operationCopy[value].description}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <div class="form-grid">
          {operation === "add" ? (
            <>
              <label>
                Game name
                <input
                  required
                  value={name}
                  onInput={(event) => setName(event.currentTarget.value)}
                  placeholder="7 Wonders"
                />
              </label>
              <label>
                BoardGameGeek ID or product link <span class="optional-label">(optional)</span>
                <input
                  value={source}
                  onInput={(event) => setSource(event.currentTarget.value)}
                  placeholder="https://boardgamegeek.com/boardgame/…"
                  aria-invalid={sourceInvalid}
                  aria-describedby={sourceInvalid ? "game-source-error" : undefined}
                />
                {sourceInvalid && (
                  <small class="field-error" id="game-source-error">
                    Enter a complete web address or a numeric BoardGameGeek ID.
                  </small>
                )}
              </label>
              <label class="check-control wide expansion-control">
                <input
                  type="checkbox"
                  checked={isExpansion}
                  disabled={!games.length}
                  onChange={(event) => {
                    setIsExpansion(event.currentTarget.checked);
                    if (!event.currentTarget.checked) setParentSlug("");
                  }}
                />
                <span>
                  <strong>This is an expansion</strong>
                  <small>
                    {games.length
                      ? "Attach it to a base game already in the library."
                      : "Publish its base game first, then add the expansion."}
                  </small>
                </span>
              </label>
              {isExpansion && (
                <label class="wide">
                  Base game
                  <select
                    required
                    value={parentSlug}
                    onChange={(event) => setParentSlug(event.currentTarget.value)}
                  >
                    <option value="">Choose its base game…</option>
                    {games.map((game) => (
                      <option value={game.slug} key={game.slug}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label class="wide">
                Ownership notes <span class="optional-label">(optional)</span>
                <textarea
                  rows={3}
                  value={notes}
                  onInput={(event) => setNotes(event.currentTarget.value)}
                  placeholder="Edition, condition, included promos, or other useful context…"
                />
              </label>
              <details class="maintenance-technical wide">
                <summary>Technical details</summary>
                <label>
                  Stable slug
                  <input
                    required
                    value={customSlug || generatedSlug}
                    onInput={(event) => setCustomSlug(event.currentTarget.value)}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    placeholder="Generated from the game name"
                  />
                </label>
                <p>Usually leave this generated value unchanged.</p>
              </details>
            </>
          ) : (
            <label>
              Game or expansion
              <select
                required
                value={selectedSlug}
                onChange={(event) => setSelectedSlug(event.currentTarget.value)}
              >
                <option value="">Choose from the library…</option>
                {inventoryItems.map((item) => (
                  <option value={item.slug} key={item.slug}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button class="primary-button" type="submit" disabled={sourceInvalid}>
          {selectedOperation.action} <span aria-hidden="true">↗</span>
          <span class="sr-only"> in a new tab</span>
        </button>
        <p class="form-help">
          GitHub will ask you to sign in, review the completed form, and submit it. Nothing changes
          immediately; a maintainer must approve the request.
        </p>
      </form>
    </section>
  );
}

const wishlistStatus = {
  interested: "On our radar",
  researching: "Researching",
  planned: "Planning to buy"
} as const;

function WishlistPanel({ games }: { games: CatalogWishlistGame[] }) {
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
    bggId: parsedSource.bggId,
    sourceUrl: parsedSource.sourceUrl,
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
        <label class="search-field">
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
                BoardGameGeek ID or product link <span class="optional-label">(optional)</span>
                <input
                  value={requestSource}
                  aria-invalid={sourceInvalid}
                  aria-describedby={sourceInvalid ? "wishlist-source-error" : undefined}
                  onInput={(event) => setRequestSource(event.currentTarget.value)}
                  placeholder="https://boardgamegeek.com/boardgame/…"
                />
              </label>
              {sourceInvalid && (
                <p class="field-error" id="wishlist-source-error" role="alert">
                  Enter a BoardGameGeek ID or a complete web address beginning with http:// or
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
            <article class="wishlist-card" key={game.slug}>
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

      <footer>
        <div>
          <strong>Game Night Library</strong>
          <p>A shared game inventory for finding what fits.</p>
        </div>
        <div class="footer-meta">
          <a
            class="bgg-attribution"
            href="https://boardgamegeek.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={`${import.meta.env.BASE_URL}powered-by-bgg-rgb.svg`} alt="Powered by BGG" />
            <span class="sr-only"> (opens in a new tab)</span>
          </a>
          <span>
            Metadata refreshed {payload ? new Date(payload.refreshedAt).toLocaleDateString() : "—"}
          </span>
          <span class="footer-methodology">
            Play styles and match scores are Game Night Library inferences, not BoardGameGeek
            ratings or recommendations.
          </span>
        </div>
      </footer>
    </>
  );
}
