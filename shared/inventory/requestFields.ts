export function slugifyGameName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseGameSource(value: string): { bggId: string; sourceUrl: string } {
  const source = value.trim();
  const bggId = (candidate: string) => {
    const parsed = Number(candidate);
    return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : "";
  };
  if (/^\d+$/.test(source)) return { bggId: bggId(source), sourceUrl: "" };
  try {
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { bggId: "", sourceUrl: "" };
    }
    const bggMatch =
      /(?:^|\.)boardgamegeek\.com$/i.test(url.hostname) &&
      /^\/boardgame\/(\d+)(?:\/|$)/.exec(url.pathname);
    return bggMatch
      ? { bggId: bggId(bggMatch[1]), sourceUrl: "" }
      : { bggId: "", sourceUrl: url.href };
  } catch {
    return { bggId: "", sourceUrl: "" };
  }
}
