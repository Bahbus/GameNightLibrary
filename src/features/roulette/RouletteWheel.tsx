import { useMemo, useState } from "preact/hooks";
import { createRouletteSlices, type RouletteSlice } from "../../lib/rouletteWheel";
import type { ScoredGame } from "../../types";

const COLORS = [
  "#f07b3f",
  "#f6c85f",
  "#73c8a9",
  "#a78bd4",
  "#ef9fbc",
  "#77a8d9",
  "#e2a84b",
  "#8bcf75",
  "#d98585",
  "#68b8bd",
  "#c894c2",
  "#b9b45d"
] as const;

const point = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;
  return { x: 50 + Math.sin(radians) * radius, y: 50 - Math.cos(radians) * radius };
};

const slicePath = ({ startAngle, endAngle }: RouletteSlice) => {
  if (endAngle - startAngle >= 359.999) {
    return "M 50 0 A 50 50 0 1 1 49.999 0 Z";
  }
  const start = point(startAngle, 49);
  const end = point(endAngle, 49);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 50 50 L ${start.x} ${start.y} A 49 49 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

const shortLabel = (name: string) => (name.length > 18 ? `${name.slice(0, 16)}…` : name);

export function RouletteWheel({
  games,
  rotation,
  revealing
}: {
  games: ScoredGame[];
  rotation: number;
  revealing: boolean;
}) {
  const slices = useMemo(() => createRouletteSlices(games), [games]);
  const [activeSlug, setActiveSlug] = useState("");
  const active = slices.find((slice) => slice.entry.game.slug === activeSlug);
  const displayedAngle = active ? active.centerAngle + rotation : 0;
  const tooltipPoint = point(displayedAngle, 39);

  return (
    <div class="roulette-wheel-shell">
      <span class="roulette-pointer" aria-hidden="true" />
      <div
        class="roulette-wheel-graphic"
        style={{ transform: `rotate(${rotation}deg)` }}
        onTransitionEnd={() => setActiveSlug("")}
      >
        <svg
          class="roulette-wheel"
          viewBox="0 0 100 100"
          role="list"
          aria-label={`Weighted roulette odds for ${games.length} ${games.length === 1 ? "game" : "games"}`}
        >
          {slices.map((slice, index) => {
            const percentage = slice.probability * 100;
            const labelPoint = point(slice.centerAngle, 33);
            const showLabel = percentage >= 9 && slices.length <= 12;
            return (
              <g
                role="listitem"
                tabIndex={revealing ? -1 : 0}
                class="roulette-slice"
                aria-label={`${slice.entry.game.name}: ${percentage.toFixed(1)}% chance`}
                onMouseEnter={() => !revealing && setActiveSlug(slice.entry.game.slug)}
                onMouseLeave={() => setActiveSlug("")}
                onFocus={() => !revealing && setActiveSlug(slice.entry.game.slug)}
                onBlur={() => setActiveSlug("")}
                key={slice.entry.game.slug}
              >
                <path d={slicePath(slice)} fill={COLORS[index % COLORS.length]} />
                {showLabel && (
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    aria-hidden="true"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    transform={`rotate(${-rotation} ${labelPoint.x} ${labelPoint.y})`}
                  >
                    {shortLabel(slice.entry.game.name)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {active && !revealing && (
        <div
          class="roulette-tooltip"
          role="tooltip"
          style={{ left: `${tooltipPoint.x}%`, top: `${tooltipPoint.y}%` }}
        >
          <strong>{active.entry.game.name}</strong>
          <span>{(active.probability * 100).toFixed(1)}% chance this spin</span>
          <small>{Math.round(active.entry.matchScore * 100)}% preference match</small>
        </div>
      )}
    </div>
  );
}
