import { describe, expect, it } from "vitest";
import {
  createRouletteLabelLayout,
  createRouletteSlices,
  nextWheelRotation
} from "../../src/lib/rouletteWheel";
import type { ScoredGame } from "../../src/types";
import { catalogFixture } from "../fixtures/catalog";

const scored = (index: number, weight: number): ScoredGame => ({
  game: catalogFixture.games[index],
  matchScore: 0.5,
  rouletteWeight: weight,
  components: []
});

describe("weighted roulette wheel", () => {
  it("gives every slice the exact share used by weighted selection", () => {
    const slices = createRouletteSlices([scored(0, 1), scored(1, 3)]);

    expect(slices.map((slice) => slice.probability)).toEqual([0.25, 0.75]);
    expect(slices.map(({ startAngle, endAngle }) => [startAngle, endAngle])).toEqual([
      [0, 90],
      [90, 360]
    ]);
  });

  it("closes the wheel exactly despite floating-point weights", () => {
    const slices = createRouletteSlices([scored(0, 1.2), scored(1, 4.7)]);
    expect(slices[0].startAngle).toBe(0);
    expect(slices.at(-1)?.endAngle).toBe(360);
    expect(slices.reduce((sum, slice) => sum + slice.probability, 0)).toBeCloseTo(1, 12);
  });

  it("adds full turns and lands the winner slice beneath the pointer", () => {
    const current = 137;
    const winnerCenter = 245;
    const rotation = nextWheelRotation(current, winnerCenter);

    expect(rotation - current).toBeGreaterThanOrEqual(4 * 360);
    expect((((rotation + winnerCenter) % 360) + 360) % 360).toBeCloseTo(0, 10);
  });

  it("wraps wheel labels more aggressively as slices narrow", () => {
    const wide = createRouletteLabelLayout("Forest Council Fox Den", 95)!;
    const medium = createRouletteLabelLayout("Forest Council Fox Den", 34)!;
    const narrow = createRouletteLabelLayout("Forest Council Fox Den", 12)!;

    expect(wide.lines.length).toBeLessThan(medium.lines.length);
    expect(medium.lines.length).toBeLessThan(narrow.lines.length);
    expect(wide.fontSize).toBeGreaterThan(narrow.fontSize);
    expect(createRouletteLabelLayout("Too Narrow", 6)).toBeUndefined();
  });
});
