import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../../ExternalLink";
import { HouseQuestionnaire } from "./HouseQuestionnaire";
import {
  EMPTY_PROGRESS,
  houseAnswersToCsv,
  mergeHouseProgress,
  parseHouseEditorDataset,
  validateHouseAnswer,
  type HouseAnswer
} from "../../lib/houseEditor";
import { clearSetupProgress, readSetupProgress, storeSetupProgress } from "../../lib/setupProgress";
import {
  SetupVerificationError,
  submitHouseAnswers,
  type SetupSubmission
} from "../../lib/setupAccess";
import {
  applyHowItPlaysSuggestion,
  parseSetupSuggestions,
  type HowItPlaysSuggestion
} from "../../lib/setupSuggestions";

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new window.Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function HouseEditor({
  serviceUrl,
  grant,
  onVerificationLost
}: {
  serviceUrl: URL;
  grant: string;
  onVerificationLost: () => void;
}) {
  const [storedProgress] = useState(readSetupProgress);
  const storedSourceSha = useRef(storedProgress.sourceSha);
  const progressDirty = useRef(false);
  const [sourceGames, setSourceGames] = useState<HouseAnswer[]>([]);
  const [sourceSha, setSourceSha] = useState("");
  const [suggestions, setSuggestions] = useState<Map<string, HowItPlaysSuggestion>>(new Map());
  const [progress, setProgress] = useState(storedProgress.progress);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"status" | "error">("status");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SetupSubmission>();
  const [progressSaved, setProgressSaved] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(new URL("api/setup/questionnaire", serviceUrl), {
          headers: { authorization: `Bearer ${grant}` }
        });
        if (response.status === 401 || response.status === 403) {
          onVerificationLost();
          return;
        }
        const value = await response.json().catch(() => undefined);
        if (!response.ok) {
          const message =
            value &&
            typeof value === "object" &&
            "message" in value &&
            typeof value.message === "string" &&
            value.message.length <= 500
              ? value.message
              : "The setup questionnaire could not be loaded.";
          throw new Error(message);
        }
        const dataset = parseHouseEditorDataset(value);
        let suggestionMap = new Map<string, HowItPlaysSuggestion>();
        try {
          const suggestionResponse = await fetch(
            new URL("setup-suggestions.json", document.baseURI),
            { signal: globalThis.AbortSignal.timeout(5_000) }
          );
          if (!suggestionResponse.ok) throw new Error("Setup suggestions are unavailable.");
          const payload = parseSetupSuggestions(
            (await suggestionResponse.json()) as unknown,
            dataset.sourceSha
          );
          suggestionMap = new Map(
            payload.suggestions.map((suggestion) => [suggestion.slug, suggestion])
          );
        } catch {
          // The questionnaire remains usable when optional suggestions are unavailable.
        }
        if (!active) return;
        if (storedSourceSha.current && storedSourceSha.current !== dataset.sourceSha) {
          clearSetupProgress();
          storedSourceSha.current = undefined;
          setProgress({ ...EMPTY_PROGRESS, answers: {}, completedSlugs: [] });
        }
        setSourceSha(dataset.sourceSha);
        setSuggestions(suggestionMap);
        setSourceGames(dataset.games);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "The setup questionnaire could not be loaded."
          );
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [grant, onVerificationLost, serviceUrl]);

  useEffect(() => {
    if (!progressDirty.current || !sourceSha || submission) return;
    try {
      storeSetupProgress(progress, sourceSha);
      storedSourceSha.current = sourceSha;
      progressDirty.current = false;
      setProgressSaved(true);
    } catch {
      setProgressSaved(false);
    }
  }, [progress, sourceSha, submission]);

  useEffect(() => {
    if (submission) clearSetupProgress();
  }, [submission]);

  const suggestedSourceGames = useMemo(
    () => sourceGames.map((game) => applyHowItPlaysSuggestion(game, suggestions.get(game.slug))),
    [sourceGames, suggestions]
  );
  const games = useMemo(
    () => mergeHouseProgress(suggestedSourceGames, progress),
    [suggestedSourceGames, progress]
  );
  const current = games[index];
  const currentSuggestion = current ? suggestions.get(current.slug) : undefined;
  const knownSlugs = new Set(sourceGames.map((game) => game.slug));
  const completed = new Set(progress.completedSlugs.filter((slug) => knownSlugs.has(slug)));
  const percent = games.length ? Math.round((completed.size / games.length) * 100) : 0;
  const progressStatus = progressSaved
    ? "Progress saves automatically on this device."
    : "This browser could not save progress automatically.";
  const gameNavigation = games
    .map((game, gameIndex) => ({ game, gameIndex }))
    .sort((left, right) =>
      left.game.title.localeCompare(right.game.title, "en", { sensitivity: "base" })
    );
  const setupNavigatorRef = useRef<globalThis.HTMLElement | null>(null);
  const setupMainRef = useRef<globalThis.HTMLDivElement | null>(null);
  const gameHeadingRef = useRef<globalThis.HTMLHeadingElement | null>(null);
  const noticeRef = useRef<globalThis.HTMLParagraphElement | null>(null);
  const focusHeadingAfterNavigation = useRef(false);

  useLayoutEffect(() => {
    const navigator = setupNavigatorRef.current;
    const main = setupMainRef.current;
    if (!navigator || !main) return;

    const matchQuestionnaireHeight = () => {
      navigator.style.setProperty(
        "--setup-questionnaire-height",
        `${main.getBoundingClientRect().height}px`
      );
    };
    matchQuestionnaireHeight();
    const observer = new globalThis.ResizeObserver(matchQuestionnaireHeight);
    observer.observe(main);
    return () => observer.disconnect();
  }, [current?.slug]);

  const update = <K extends keyof HouseAnswer>(key: K, value: HouseAnswer[K]) => {
    if (!current) return;
    progressDirty.current = true;
    setProgress((previous) => ({
      ...previous,
      answers: {
        ...previous.answers,
        [current.slug]: {
          ...(previous.answers[current.slug] ?? {}),
          [key]: value
        }
      }
    }));
    setNotice("");
    setValidationAttempted(false);
  };

  const showGame = (nextIndex: number, moveFocus = true) => {
    const boundedIndex = Math.max(0, Math.min(games.length - 1, nextIndex));
    focusHeadingAfterNavigation.current = moveFocus;
    setValidationAttempted(false);
    setNotice("");
    setIndex(boundedIndex);
    if (moveFocus && boundedIndex === index) {
      focusHeadingAfterNavigation.current = false;
      globalThis.requestAnimationFrame(() => gameHeadingRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!focusHeadingAfterNavigation.current) return;
    focusHeadingAfterNavigation.current = false;
    gameHeadingRef.current?.focus();
  }, [current?.slug]);

  const finishCurrent = () => {
    if (!current) return;
    const errors = validateHouseAnswer(current);
    if (errors.length) {
      setValidationAttempted(true);
      setNoticeKind("error");
      setNotice(errors.join(" "));
      globalThis.requestAnimationFrame(() => {
        const invalidField =
          setupMainRef.current?.querySelector<globalThis.HTMLElement>(
            'select[aria-invalid="true"]'
          ) ??
          setupMainRef.current?.querySelector<globalThis.HTMLElement>(
            '.local-values input[aria-invalid="true"]'
          ) ??
          setupMainRef.current?.querySelector<globalThis.HTMLElement>(
            'fieldset[aria-invalid="true"]'
          );
        (invalidField ?? noticeRef.current)?.focus();
      });
      return;
    }
    progressDirty.current = true;
    setProgress((previous) => ({
      ...previous,
      completedSlugs: [...new Set([...previous.completedSlugs, current.slug])]
    }));
    setValidationAttempted(false);
    setNoticeKind("status");
    setNotice(`${current.title} saved.`);
    if (index < games.length - 1) showGame(index + 1);
  };

  const submit = async () => {
    if (completed.size !== games.length || !sourceSha) return;
    setSubmitting(true);
    setNotice("");
    try {
      const result = await submitHouseAnswers(
        serviceUrl,
        grant,
        `${houseAnswersToCsv(games)}\n`,
        sourceSha
      );
      clearSetupProgress();
      setSubmission(result);
      setNoticeKind("status");
    } catch (cause) {
      if (cause instanceof SetupVerificationError) {
        onVerificationLost();
        return;
      }
      setNoticeKind("error");
      setNotice(cause instanceof Error ? cause.message : "The setup answers could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <section class="setup-shell">
        <div class="empty-state" role="alert">
          <span aria-hidden="true">!</span>
          <h2>We couldn’t open game setup</h2>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!current) {
    return (
      <section class="setup-shell" aria-busy="true">
        <div class="setup-loading" role="status">
          Preparing the game list…
        </div>
      </section>
    );
  }

  return (
    <section class="setup-shell" aria-labelledby="setup-title">
      <div class="setup-overview">
        <div
          class="setup-overview-title"
          data-layout-motion="setup-overview-title"
          data-layout-motion-at="701 1280"
        >
          <span class="eyebrow">Guided collection setup</span>
          <h1 id="setup-title">Tell us about the games</h1>
        </div>
        <p class={`setup-overview-copy${progressSaved ? "" : " setup-autosave-error"}`}>
          {progressStatus}
        </p>
        <div class="setup-progress setup-progress-compact">
          <strong>
            {completed.size} of {games.length}
          </strong>
          <span>{percent}% complete</span>
          <progress aria-label="Setup completion" max={games.length} value={completed.size}>
            {percent}%
          </progress>
        </div>
      </div>

      <div class="setup-workspace">
        <aside
          class="setup-navigator"
          aria-label="Setup progress and game navigation"
          ref={setupNavigatorRef}
          data-layout-motion="setup-navigator"
          data-layout-motion-at="1280"
        >
          <div class="setup-progress setup-progress-wide">
            <strong>
              {completed.size} of {games.length}
            </strong>
            <span>{percent}% complete</span>
            <progress aria-label="Setup completion" max={games.length} value={completed.size}>
              {percent}%
            </progress>
          </div>
          <p class="sr-only" id="setup-game-navigation-help">
            Use the arrow keys to select a game. Press Enter or Space to move into its
            questionnaire.
          </p>
          <div
            class="setup-game-list"
            role="navigation"
            aria-label="Games to set up"
            aria-describedby="setup-game-navigation-help"
          >
            {gameNavigation.map(({ game, gameIndex }, navigationIndex) => (
              <button
                type="button"
                class={gameIndex === index ? "is-current" : ""}
                aria-current={gameIndex === index ? "step" : undefined}
                tabIndex={gameIndex === index ? 0 : -1}
                onClick={() => showGame(gameIndex)}
                onKeyDown={(event) => {
                  let nextNavigationIndex: number | undefined;
                  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                    nextNavigationIndex = Math.min(navigationIndex + 1, gameNavigation.length - 1);
                  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                    nextNavigationIndex = Math.max(navigationIndex - 1, 0);
                  } else if (event.key === "Home") {
                    nextNavigationIndex = 0;
                  } else if (event.key === "End") {
                    nextNavigationIndex = gameNavigation.length - 1;
                  }
                  if (nextNavigationIndex === undefined) return;
                  event.preventDefault();
                  if (nextNavigationIndex === navigationIndex) return;
                  const next = gameNavigation[nextNavigationIndex];
                  showGame(next.gameIndex, false);
                  globalThis.requestAnimationFrame(() => {
                    setupNavigatorRef.current
                      ?.querySelectorAll<globalThis.HTMLButtonElement>(".setup-game-list button")
                      [nextNavigationIndex]?.focus();
                  });
                }}
                key={game.slug}
              >
                <span>{game.title}</span>
                {completed.has(game.slug) && <span aria-label="Complete">✓</span>}
              </button>
            ))}
          </div>
        </aside>

        <div
          class="setup-workspace-main"
          ref={setupMainRef}
          data-layout-motion="setup-workspace-main"
          data-layout-motion-at="1280"
        >
          <div class="setup-toolbar">
            <p class="setup-toolbar-guidance">Answer what you know, one game at a time.</p>
            <label>
              Jump to a game
              <select
                value={index}
                onChange={(event) => showGame(Number(event.currentTarget.value), false)}
              >
                {games.map((game, gameIndex) => (
                  <option value={gameIndex} key={game.slug}>
                    {completed.has(game.slug) ? "✓ " : ""}
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
            <div class="setup-downloads">
              <span class="setup-download-guidance">Answer what you know, one game at a time.</span>
              <span
                class={progressSaved ? "setup-autosave" : "setup-autosave setup-autosave-error"}
              >
                {progressStatus}
              </span>
              <button
                class="secondary-button dark"
                onClick={() =>
                  download(
                    "inventory-house-answers.csv",
                    `${houseAnswersToCsv(games)}\n`,
                    "text/csv;charset=utf-8"
                  )
                }
              >
                Download CSV copy
              </button>
            </div>
          </div>

          {completed.size === games.length && (
            <div class="setup-complete">
              {submission ? (
                <>
                  <strong role="status">Setup answers were sent for review.</strong>
                  <ExternalLink href={submission.pullRequestUrl}>
                    View proposed update #{submission.pullRequestNumber} on GitHub
                  </ExternalLink>
                </>
              ) : (
                <>
                  <strong role="status">Every game has a completed answer.</strong>
                  <span>
                    Send the answers for review. The public library will not change until the
                    proposed update is approved.
                  </span>
                  <button
                    class="primary-button"
                    disabled={submitting}
                    onClick={() => void submit()}
                  >
                    {submitting ? "Sending for review…" : "Send for review"}
                  </button>
                </>
              )}
            </div>
          )}

          <HouseQuestionnaire
            current={current}
            suggestion={currentSuggestion}
            gameNumber={index + 1}
            gameCount={games.length}
            complete={completed.has(current.slug)}
            validationAttempted={validationAttempted}
            notice={notice}
            noticeKind={noticeKind}
            canGoPrevious={index > 0}
            canSkip={index < games.length - 1}
            headingRef={gameHeadingRef}
            noticeRef={noticeRef}
            update={update}
            onPrevious={() => showGame(index - 1)}
            onSkip={() => showGame(index + 1)}
            onFinish={finishCurrent}
          />
        </div>
      </div>

      <p class="setup-privacy">
        These answers are intended for this public inventory, so use shelf labels rather than
        addresses or private information.
      </p>
    </section>
  );
}
