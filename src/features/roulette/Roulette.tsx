import { useEffect, useRef, useState } from "preact/hooks";
import { weightedDraw } from "../../lib/catalog";
import type { ScoredGame } from "../../types";

export function Roulette({
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
