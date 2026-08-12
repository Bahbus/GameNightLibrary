import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { roulettePool, weightedDraw } from "../../lib/catalog";
import { createRouletteSlices, nextWheelRotation } from "../../lib/rouletteWheel";
import type { ScoredGame } from "../../types";
import { RouletteWheel } from "./RouletteWheel";

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
  const [rotation, setRotation] = useState(0);
  const [spinPool, setSpinPool] = useState<ScoredGame[]>();
  const timer = useRef<number>();
  const drawnEligible = useMemo(
    () => drawn.filter((slug) => games.some((entry) => entry.game.slug === slug)),
    [drawn, games]
  );
  const candidates = useMemo(() => roulettePool(games, new Set(drawn)), [drawn, games]);
  const displayedGames = revealing && spinPool ? spinPool : candidates;

  const finishReveal = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
    setRevealing(false);
    setSpinPool(undefined);
  };

  const draw = () => {
    if (timer.current) window.clearTimeout(timer.current);
    const result = weightedDraw(games, new Set(drawn));
    if (!result) return;
    const currentPool = roulettePool(games, new Set(drawn));
    const winnerSlice = createRouletteSlices(currentPool).find(
      (slice) => slice.entry.game.slug === result.game.slug
    );
    setWinner(result);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSpinPool(currentPool);
    if (winnerSlice) {
      setRotation((current) => nextWheelRotation(current, winnerSlice.centerAngle));
    }
    setRevealing(!reduced);
    if (!drawn.includes(result.game.slug)) setDrawn([...drawn, result.game.slug]);
    if (!reduced) {
      timer.current = window.setTimeout(finishReveal, 1800);
    } else {
      setSpinPool(undefined);
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
          <span>{drawnEligible.length} already drawn</span>
          <span>{candidates.length} in the next spin</span>
        </div>
        <div class="roulette-actions">
          <button class="primary-button" onClick={draw} disabled={!games.length || revealing}>
            {winner ? "Spin again" : "Spin the roulette"}
          </button>
          {revealing && (
            <button class="secondary-button" onClick={finishReveal}>
              Skip animation
            </button>
          )}
          {drawn.length > 0 && (
            <button
              class="secondary-button compact-button"
              onClick={() => {
                setDrawn([]);
                setWinner(undefined);
                setSpinPool(undefined);
              }}
            >
              Reset draws
            </button>
          )}
        </div>
      </div>
      <div class={`roulette-stage ${revealing ? "is-spinning" : ""}`}>
        <RouletteWheel games={displayedGames} rotation={rotation} revealing={revealing} />
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
