import type { ScoredGame } from "../types";

export interface RouletteSlice {
  entry: ScoredGame;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
  probability: number;
}

export interface RouletteLabelLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  radius: number;
}

const labelTokens = (name: string, width: number) => {
  const tokens: string[] = [];
  for (const word of name.split(/\s+/).filter(Boolean)) {
    if (word.length <= width) {
      tokens.push(word);
      continue;
    }
    for (let offset = 0; offset < word.length; offset += width) {
      tokens.push(word.slice(offset, offset + width));
    }
  }
  return tokens;
};

export function createRouletteLabelLayout(
  name: string,
  sliceAngle: number
): RouletteLabelLayout | undefined {
  if (!name.trim() || sliceAngle < 7) return undefined;

  const fontSize = sliceAngle >= 55 ? 3.4 : sliceAngle >= 28 ? 3.05 : 2.7;
  const lineHeight = fontSize * 1.08;
  const chord = 2 * 36 * Math.sin((Math.min(sliceAngle, 150) * Math.PI) / 360);
  const lineWidth = Math.max(2, Math.min(22, Math.floor((chord - 1.5) / (fontSize * 0.58))));
  const maxLines = sliceAngle >= 70 ? 2 : sliceAngle >= 38 ? 3 : sliceAngle >= 18 ? 4 : 6;
  const tokens = labelTokens(name.trim(), lineWidth);
  const lines: string[] = [];

  while (tokens.length && lines.length < maxLines) {
    let line = tokens.shift()!;
    while (tokens[0] && `${line} ${tokens[0]}`.length <= lineWidth) {
      line += ` ${tokens.shift()!}`;
    }
    lines.push(line);
  }

  if (tokens.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, lineWidth - 1)).trimEnd()}…`;
  }

  return { lines, fontSize, lineHeight, radius: sliceAngle >= 28 ? 37 : 39 };
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
