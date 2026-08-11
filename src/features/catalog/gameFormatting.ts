export const formatMinutes = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return "Time unknown";
  if (min === max || max === undefined) return `${min} min`;
  if (min === undefined) return `Up to ${max} min`;
  return `${min}–${max} min`;
};

export const formatPlayers = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return "Players unknown";
  if (min === max || max === undefined) return `${min} players`;
  if (min === undefined) return `Up to ${max} players`;
  return `${min}–${max} players`;
};
