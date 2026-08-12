import type { ScoredGame } from "../types";

export interface RouletteSlice {
  entry: ScoredGame;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
  probability: number;
}

export function createRouletteSlices(games: ScoredGame[]): RouletteSlice[] {
  const total = games.reduce((sum, game) => sum + game.rouletteWeight, 0);
  if (!games.length || total <= 0) return [];

  let startAngle = 0;
  return games.map((entry, index) => {
    const probability = entry.rouletteWeight / total;
    const endAngle = index === games.length - 1 ? 360 : startAngle + probability * 360;
    const slice = {
      entry,
      startAngle,
      endAngle,
      centerAngle: startAngle + (endAngle - startAngle) / 2,
      probability
    };
    startAngle = endAngle;
    return slice;
  });
}

export function nextWheelRotation(current: number, winnerCenterAngle: number): number {
  const currentTurn = ((current % 360) + 360) % 360;
  const desiredTurn = ((-winnerCenterAngle % 360) + 360) % 360;
  const alignment = (desiredTurn - currentTurn + 360) % 360;
  return current + 4 * 360 + alignment;
}
