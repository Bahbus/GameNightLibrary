import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  createRouletteLabelLayout,
  createRouletteSlices,
  type RouletteSlice
} from "../../lib/rouletteWheel";
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
  const shellRef = useRef<globalThis.HTMLDivElement>(null);
  const wheelRef = useRef<globalThis.SVGSVGElement>(null);
  const [hoveredSlug, setHoveredSlug] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const activeSlug = hoveredSlug || selectedSlug;
  const active = slices.find((slice) => slice.entry.game.slug === activeSlug);
  const displayedAngle = active ? active.centerAngle + rotation : 0;
  const tooltipPoint = point(displayedAngle, 39);

  useEffect(() => {
    if (!selectedSlug || slices.some((slice) => slice.entry.game.slug === selectedSlug)) return;
    setSelectedSlug("");
  }, [selectedSlug, slices]);

  useEffect(() => {
    if (!selectedSlug) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!shellRef.current?.contains(event.target as globalThis.Node)) setSelectedSlug("");
    };
    globalThis.document.addEventListener("pointerdown", closeOutside);
    return () => globalThis.document.removeEventListener("pointerdown", closeOutside);
  }, [selectedSlug]);

  const moveSelection = (nextIndex: number) => {
    const next = slices[Math.max(0, Math.min(slices.length - 1, nextIndex))];
    if (next) setSelectedSlug(next.entry.game.slug);
  };

  const handleWheelKey = (event: globalThis.KeyboardEvent) => {
    if (!slices.length || revealing) return;
    const currentIndex = slices.findIndex((slice) => slice.entry.game.slug === selectedSlug);
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = Math.min(Math.max(currentIndex + 1, 0), slices.length - 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = currentIndex < 0 ? slices.length - 1 : Math.max(currentIndex - 1, 0);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = slices.length - 1;
    } else if (event.key === "Escape") {
      setSelectedSlug("");
      return;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    moveSelection(nextIndex);
  };

  return (
    <div class="roulette-wheel-shell" ref={shellRef}>
      <span class="roulette-pointer" aria-hidden="true" />
      <div
        class="roulette-wheel-graphic"
        style={{ transform: `rotate(${rotation}deg)` }}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
          setHoveredSlug("");
          setSelectedSlug("");
        }}
      >
        <svg
          ref={wheelRef}
          class="roulette-wheel"
          viewBox="0 0 100 100"
          role="listbox"
          tabIndex={revealing || !games.length ? -1 : 0}
          aria-label={`Weighted roulette odds for ${games.length} ${games.length === 1 ? "game" : "games"}. Use arrow keys to inspect each chance.`}
          aria-activedescendant={selectedSlug ? `roulette-slice-${selectedSlug}` : undefined}
          onFocus={() => {
            if (!selectedSlug && slices[0]) setSelectedSlug(slices[0].entry.game.slug);
          }}
          onBlur={() => {
            setHoveredSlug("");
            setSelectedSlug("");
          }}
          onKeyDown={handleWheelKey}
        >
          {slices.map((slice, index) => {
            const percentage = slice.probability * 100;
            const labelLayout = createRouletteLabelLayout(
              slice.entry.game.name,
              slice.endAngle - slice.startAngle
            );
            const labelPoint = point(slice.centerAngle, labelLayout?.radius ?? 0);
            return (
              <g
                id={`roulette-slice-${slice.entry.game.slug}`}
                role="option"
                class="roulette-slice"
                aria-label={`${slice.entry.game.name}: ${percentage.toFixed(1)}% chance`}
                aria-selected={selectedSlug === slice.entry.game.slug}
                onPointerEnter={(event) => {
                  if (!revealing && event.pointerType === "mouse")
                    setHoveredSlug(slice.entry.game.slug);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setHoveredSlug("");
                }}
                onClick={() => {
                  if (revealing) return;
                  wheelRef.current?.focus({ preventScroll: true });
                  setSelectedSlug(slice.entry.game.slug);
                }}
                key={slice.entry.game.slug}
              >
                <path d={slicePath(slice)} fill={COLORS[index % COLORS.length]} />
                {labelLayout && (
                  <g
                    class="roulette-slice-label"
                    aria-hidden="true"
                    transform={`rotate(${slice.centerAngle} ${labelPoint.x} ${labelPoint.y})`}
                  >
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      font-size={labelLayout.fontSize}
                      text-anchor="middle"
                      dominant-baseline="middle"
                    >
                      {labelLayout.lines.map((line, lineIndex) => (
                        <tspan
                          x={labelPoint.x}
                          dy={lineIndex === 0 ? 0 : labelLayout.lineHeight}
                          key={`${line}-${lineIndex}`}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
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
