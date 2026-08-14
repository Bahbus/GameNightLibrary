import type { Ref } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  ACCESSIBILITY_OPTIONS,
  CONTENT_OPTIONS,
  MOOD_OPTIONS,
  SETUP_TIME_RANGES,
  type HouseTagOption
} from "../../../shared/setup/houseOptions";
import { ExternalLink } from "../../ExternalLink";
import type { HouseAnswer } from "../../lib/houseEditor";
import type { HowItPlaysSuggestion } from "../../lib/setupSuggestions";

type UpdateHouseAnswer = <K extends keyof HouseAnswer>(key: K, value: HouseAnswer[K]) => void;

const ratingOptions = [
  ["", "Not sure yet"],
  ["1", "1 — very low"],
  ["2", "2 — low"],
  ["3", "3 — medium"],
  ["4", "4 — high"],
  ["5", "5 — very high"]
];

const selectedTags = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

function RatingField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {ratingOptions.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TagCheckboxField({
  legend,
  help,
  value,
  options,
  onChange
}: {
  legend: string;
  help: string;
  value: string;
  options: readonly HouseTagOption[];
  onChange: (value: string) => void;
}) {
  const selected = selectedTags(value);
  const orderedOptions = useMemo(
    () =>
      [...options].sort((left, right) =>
        left.label.localeCompare(right.label, "en", { sensitivity: "base" })
      ),
    [options]
  );
  const knownValues = new Set(orderedOptions.map((option) => option.value));
  const selectedKnown = orderedOptions.filter((option) => selected.includes(option.value));
  const selectedKnownValues = selectedKnown.map((option) => option.value);
  const selectedKnownKey = selectedKnownValues.join(";");
  const custom = selected.filter((tag) => !knownValues.has(tag));
  const [expanded, setExpanded] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [compactValues, setCompactValues] = useState(() =>
    selectedKnownValues.length
      ? selectedKnownValues
      : orderedOptions.slice(0, 3).map((option) => option.value)
  );
  const [customInput, setCustomInput] = useState(custom.join(", "));

  useEffect(() => {
    if (!interacted && selectedKnownKey) setCompactValues(selectedKnownKey.split(";"));
  }, [interacted, selectedKnownKey]);

  const visibleOptions = expanded
    ? orderedOptions
    : orderedOptions.filter((option) => compactValues.includes(option.value));
  const hiddenCount = orderedOptions.length - visibleOptions.length;
  const setKnownValue = (tag: string, checked: boolean) => {
    setInteracted(true);
    const next = checked
      ? [...selected.filter((value) => value !== tag), tag]
      : selected.filter((value) => value !== tag);
    onChange(next.join(";"));
  };
  const setCustomValues = (input: string) => {
    setInteracted(true);
    setCustomInput(input);
    const known = selected.filter((tag) => knownValues.has(tag));
    onChange([...known, ...selectedTags(input)].join(";"));
  };

  return (
    <fieldset class="setup-tag-field wide">
      <legend>{legend}</legend>
      <div class="setup-tag-heading">
        <p>{help}</p>
        {hiddenCount || expanded ? (
          <button
            type="button"
            class="setup-options-toggle"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Show fewer ${legend.toLocaleLowerCase()} options`
                : `Show all ${orderedOptions.length} ${legend.toLocaleLowerCase()} options`
            }
            onClick={() => {
              if (expanded) {
                setCompactValues(
                  (selectedKnown.length ? selectedKnown : orderedOptions.slice(0, 3)).map(
                    (option) => option.value
                  )
                );
              }
              setExpanded(!expanded);
            }}
          >
            <span>{expanded ? "Show fewer" : "Show all"}</span>
            {!expanded ? <span class="setup-options-count">{orderedOptions.length}</span> : null}
            <span class="setup-options-chevron" aria-hidden="true">
              {expanded ? "▴" : "▾"}
            </span>
          </button>
        ) : null}
      </div>
      <div class="setup-checkboxes">
        {visibleOptions.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => setKnownValue(option.value, event.currentTarget.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {expanded || custom.length ? (
        <label class="setup-other-tag">
          Other (separate multiple tags with commas)
          <input
            value={customInput}
            onInput={(event) => setCustomValues(event.currentTarget.value)}
            placeholder="Add another consideration…"
          />
        </label>
      ) : null}
    </fieldset>
  );
}

function BasicsSection({
  current,
  validationAttempted,
  update
}: {
  current: HouseAnswer;
  validationAttempted: boolean;
  update: UpdateHouseAnswer;
}) {
  const learnedInvalid = validationAttempted && !["yes", "no"].includes(current.learned);
  return (
    <div class="setup-section">
      <div>
        <h3>The basics</h3>
        <p>These help us know whether the game can be offered tonight.</p>
      </div>
      <div class="setup-fields">
        <label>
          Is it available?
          <select
            value={current.availability}
            onChange={(event) => update("availability", event.currentTarget.value)}
          >
            <option value="available">Available</option>
            <option value="loaned">Loaned out</option>
            <option value="incomplete">Incomplete</option>
            <option value="unavailable">Otherwise unavailable</option>
          </select>
        </label>
        <label>
          Have you learned it?
          <select
            value={current.learned}
            aria-invalid={learnedInvalid}
            aria-describedby={learnedInvalid ? "setup-validation-notice" : undefined}
            onChange={(event) => update("learned", event.currentTarget.value)}
          >
            <option value="">Choose one</option>
            <option value="yes">Yes</option>
            <option value="no">Not yet</option>
          </select>
        </label>
        <label>
          Shelf label
          <input
            value={current.shelf}
            onInput={(event) => update("shelf", event.currentTarget.value)}
            placeholder="For example: Basement A3"
          />
        </label>
      </div>
    </div>
  );
}

function ExperienceSection({
  current,
  update
}: {
  current: HouseAnswer;
  update: UpdateHouseAnswer;
}) {
  return (
    <div class="setup-section">
      <div>
        <h3>Your experience</h3>
        <p>It is fine to leave ratings blank until the group has played it.</p>
      </div>
      <div class="setup-fields rating-grid">
        <RatingField
          label="Overall house rating"
          value={current.houseRating}
          onChange={(value) => update("houseRating", value)}
        />
        <label>
          Setup time
          <select
            value={current.setupTimeRange}
            onChange={(event) => update("setupTimeRange", event.currentTarget.value)}
          >
            <option value="">Not sure yet</option>
            {SETUP_TIME_RANGES.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <RatingField
          label="Teaching difficulty"
          value={current.teachDifficulty}
          onChange={(value) => update("teachDifficulty", value)}
        />
        <label>
          Table space
          <select
            value={current.tableSpace}
            onChange={(event) => update("tableSpace", event.currentTarget.value)}
          >
            <option value="">Not sure yet</option>
            <option value="compact">Compact — small table</option>
            <option value="standard">Standard — dining table</option>
            <option value="large">Large — needs extra room</option>
          </select>
        </label>
        <RatingField
          label="Player interaction"
          value={current.interaction}
          onChange={(value) => update("interaction", value)}
        />
        <RatingField
          label="Influence of luck"
          value={current.luck}
          onChange={(value) => update("luck", value)}
        />
        <RatingField
          label="Downtime between turns"
          value={current.downtime}
          onChange={(value) => update("downtime", value)}
        />
      </div>
    </div>
  );
}

function HowItPlaysSection({
  current,
  suggestion,
  validationAttempted,
  update
}: {
  current: HouseAnswer;
  suggestion?: HowItPlaysSuggestion;
  validationAttempted: boolean;
  update: UpdateHouseAnswer;
}) {
  const modes = selectedTags(current.modes);
  const modesInvalid = validationAttempted && !modes.length;
  const toggleMode = (mode: string) =>
    update(
      "modes",
      modes.includes(mode)
        ? modes.filter((value) => value !== mode).join(";")
        : [...modes, mode].join(";")
    );

  return (
    <div class="setup-section">
      <div>
        <h3>How it plays</h3>
        <p>These answers improve preference matching. Use everyday words where prompted.</p>
      </div>
      <div class="setup-fields">
        {suggestion ? (
          <aside class="setup-inference-note wide">
            <strong>BoardGameGeek suggestions are preselected.</strong>
            <p>
              These are cautious inferences from BoardGameGeek category and mechanic labels, not
              facts supplied directly by BoardGameGeek. Please uncheck anything that does not fit
              your copy or group.
            </p>
            <details>
              <summary>See the BoardGameGeek information used</summary>
              {suggestion.categories.length ? (
                <span>Categories: {suggestion.categories.join(", ")}</span>
              ) : null}
              {suggestion.mechanics.length ? (
                <span>Mechanics: {suggestion.mechanics.join(", ")}</span>
              ) : null}
              <ExternalLink href={`https://boardgamegeek.com/boardgame/${suggestion.bggId}`}>
                Review this game on BoardGameGeek
              </ExternalLink>
            </details>
          </aside>
        ) : null}
        {current.localValuesRequired === "yes" ? (
          <fieldset
            class="setup-modes"
            aria-invalid={modesInvalid}
            aria-describedby={modesInvalid ? "setup-validation-notice" : undefined}
            tabIndex={modesInvalid ? -1 : undefined}
          >
            <legend>Supported styles</legend>
            <p class="setup-mode-help">
              This game is not listed on BoardGameGeek, so select every style it supports.
            </p>
            {[
              ["competitive", "Competitive"],
              ["cooperative", "Cooperative"],
              ["team", "Teams"],
              ["solo", "Solo"]
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={modes.includes(value)}
                  onChange={() => toggleMode(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        ) : null}
        <TagCheckboxField
          key={`moods-${current.slug}`}
          legend="Mood or vibe"
          help="Choose every description that feels like a good fit."
          value={current.moods}
          options={MOOD_OPTIONS}
          onChange={(value) => update("moods", value)}
        />
        <TagCheckboxField
          key={`content-${current.slug}`}
          legend="Content considerations"
          help="Choose themes people may want to know about before game night."
          value={current.contentFlags}
          options={CONTENT_OPTIONS}
          onChange={(value) => update("contentFlags", value)}
        />
        <TagCheckboxField
          key={`accessibility-${current.slug}`}
          legend="Accessibility considerations"
          help="Choose traits that could affect whether someone can comfortably play."
          value={current.accessibilityFlags}
          options={ACCESSIBILITY_OPTIONS}
          onChange={(value) => update("accessibilityFlags", value)}
        />
        <label class="wide">
          Recommendation notes
          <textarea
            rows={3}
            value={current.recommendationNotes}
            onInput={(event) => update("recommendationNotes", event.currentTarget.value)}
            placeholder="Who tends to enjoy this game, or when does it work especially well?"
          />
        </label>
      </div>
    </div>
  );
}

function LocalValuesSection({
  current,
  validationAttempted,
  update
}: {
  current: HouseAnswer;
  validationAttempted: boolean;
  update: UpdateHouseAnswer;
}) {
  if (current.localValuesRequired !== "yes") return null;
  return (
    <div class="setup-section local-values">
      <div>
        <h3>Basic game details</h3>
        <p>
          This game is not listed on BoardGameGeek, so these five answers are needed for filtering.
        </p>
      </div>
      <div class="setup-fields local-grid">
        {[
          ["localMinPlayers", "Minimum players"],
          ["localMaxPlayers", "Maximum players"],
          ["localMinMinutes", "Minimum minutes"],
          ["localMaxMinutes", "Maximum minutes"],
          ["localMinAge", "Minimum age"]
        ].map(([key, label]) => {
          const field = key as keyof HouseAnswer;
          const invalid = validationAttempted && !current[field];
          return (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                inputMode="numeric"
                aria-invalid={invalid}
                aria-describedby={invalid ? "setup-validation-notice" : undefined}
                value={current[field]}
                onInput={(event) => update(field, event.currentTarget.value)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function HouseQuestionnaire({
  current,
  suggestion,
  gameNumber,
  gameCount,
  complete,
  validationAttempted,
  notice,
  noticeKind,
  canGoPrevious,
  canSkip,
  headingRef,
  noticeRef,
  update,
  onPrevious,
  onSkip,
  onFinish
}: {
  current: HouseAnswer;
  suggestion?: HowItPlaysSuggestion;
  gameNumber: number;
  gameCount: number;
  complete: boolean;
  validationAttempted: boolean;
  notice: string;
  noticeKind: "status" | "error";
  canGoPrevious: boolean;
  canSkip: boolean;
  headingRef: Ref<globalThis.HTMLHeadingElement>;
  noticeRef: Ref<globalThis.HTMLParagraphElement>;
  update: UpdateHouseAnswer;
  onPrevious: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  return (
    <article class="setup-card">
      <header>
        <div>
          <span class="eyebrow">
            Game {gameNumber} of {gameCount}
          </span>
          <h2 ref={headingRef} tabIndex={-1}>
            {current.title}
          </h2>
        </div>
        {complete && <span class="complete-badge">Complete</span>}
      </header>

      <BasicsSection current={current} validationAttempted={validationAttempted} update={update} />
      <ExperienceSection current={current} update={update} />
      <HowItPlaysSection
        current={current}
        suggestion={suggestion}
        validationAttempted={validationAttempted}
        update={update}
      />
      <LocalValuesSection
        current={current}
        validationAttempted={validationAttempted}
        update={update}
      />

      <div class="setup-actions">
        <button class="secondary-button dark" disabled={!canGoPrevious} onClick={onPrevious}>
          Previous
        </button>
        <button class="secondary-button dark" disabled={!canSkip} onClick={onSkip}>
          Skip for now
        </button>
        <button class="primary-button" onClick={onFinish}>
          {canSkip ? "Save & next" : "Save game"}
        </button>
      </div>
      <p
        class="setup-notice"
        id="setup-validation-notice"
        role={noticeKind === "error" ? "alert" : "status"}
        tabIndex={noticeKind === "error" ? -1 : undefined}
        ref={noticeRef}
      >
        {notice}
      </p>
    </article>
  );
}
