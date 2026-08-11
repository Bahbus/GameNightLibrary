import { useMemo } from "preact/hooks";
import { DEFAULT_PREFERENCES } from "../../lib/preferences";
import type { CatalogGame, GameMode, GroupPreferences, TableSpace } from "../../types";

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

export function FilterPanel({
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
