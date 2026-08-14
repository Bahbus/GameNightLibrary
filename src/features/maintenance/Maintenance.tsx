import { useMemo, useState } from "preact/hooks";
import { buildIssueUrl, parseGameSource, slugifyGameName } from "../../lib/maintenance";
import type { CatalogGame, GameMode } from "../../types";

const REPOSITORY_URL = __GITHUB_REPOSITORY_URL__;
const modeOptions = [
  ["competitive", "Competitive"],
  ["cooperative", "Cooperative"],
  ["solo", "Solo"],
  ["team", "Teams"]
] as const satisfies readonly (readonly [GameMode, string])[];

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

export function Maintenance({ games }: { games: CatalogGame[] }) {
  const [operation, setOperation] = useState<"add" | "update" | "remove">("add");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isExpansion, setIsExpansion] = useState(false);
  const [parentSlug, setParentSlug] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [modes, setModes] = useState<GameMode[]>([]);
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
  const needsLocalModes = operation === "add" && !isExpansion && Boolean(sourceUrl);
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
      modes: needsLocalModes ? modes.join(";") : "",
      notes: operation === "add" ? notes : ""
    });
  }, [
    operation,
    bggId,
    sourceUrl,
    requestName,
    slug,
    parentId,
    parentSlug,
    isExpansion,
    needsLocalModes,
    modes,
    notes
  ]);

  return (
    <section class="maintenance-card">
      <div
        class="maintenance-intro"
        data-layout-motion="maintenance-intro"
        data-layout-motion-at="941"
      >
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
        data-layout-motion="maintenance-form"
        data-layout-motion-at="941"
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
              {needsLocalModes && (
                <fieldset class="maintenance-modes wide">
                  <legend>How can this game be played?</legend>
                  <p>
                    Choose every supported mode. This is required because BoardGameGeek cannot
                    supply metadata for this game.
                  </p>
                  <div>
                    {modeOptions.map(([value, label]) => (
                      <label class="check-control" key={value}>
                        <input
                          type="checkbox"
                          name="modes"
                          value={value}
                          checked={modes.includes(value)}
                          onChange={(event) =>
                            setModes((current) =>
                              event.currentTarget.checked
                                ? [...current, value]
                                : current.filter((mode) => mode !== value)
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
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
        <button
          class="primary-button"
          type="submit"
          disabled={sourceInvalid || (needsLocalModes && modes.length === 0)}
        >
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
