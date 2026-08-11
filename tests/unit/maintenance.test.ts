import { describe, expect, it } from "vitest";
import {
  buildIssueUrl,
  buildWishlistIssueUrl,
  parseGameSource,
  slugifyGameName
} from "../../src/lib/maintenance";

describe("maintenance input helpers", () => {
  it("generates a stable slug from a readable game name", () => {
    expect(slugifyGameName("  Éverdell: Duo! ")).toBe("everdell-duo");
  });

  it("extracts a BGG ID from either a link or a numeric ID", () => {
    expect(parseGameSource("https://boardgamegeek.com/boardgame/68448/7-wonders")).toEqual({
      bggId: "68448",
      sourceUrl: ""
    });
    expect(parseGameSource("68448")).toEqual({ bggId: "68448", sourceUrl: "" });
  });

  it("preserves another product page and rejects incomplete input", () => {
    expect(parseGameSource("https://publisher.example/local-game")).toEqual({
      bggId: "",
      sourceUrl: "https://publisher.example/local-game"
    });
    expect(parseGameSource("publisher page")).toEqual({ bggId: "", sourceUrl: "" });
  });
});

describe("maintenance request links", () => {
  it("prefills the matching GitHub issue form without empty values", () => {
    const url = buildIssueUrl("https://github.com/Bahbus/GameNightLibrary", {
      operation: "add",
      bggId: "68448",
      sourceUrl: "",
      name: "7 Wonders",
      slug: "7-wonders",
      parentId: "",
      parentSlug: "",
      modes: "",
      notes: ""
    });
    expect(url).toContain("template=inventory-add.yml");
    expect(url).toContain("bgg-id=68448");
    expect(url).toContain("game-name=7+Wonders");
    expect(url).not.toContain("parent-bgg-id");
  });

  it("prefills a slug and source without inventing a BGG ID", () => {
    const url = buildIssueUrl("https://github.com/Bahbus/GameNightLibrary", {
      operation: "add",
      bggId: "",
      sourceUrl: "https://publisher.example/local-game",
      name: "Local Game",
      slug: "local-game",
      parentId: "",
      parentSlug: "",
      modes: "competitive;solo",
      notes: ""
    });
    expect(url).toContain("slug=local-game");
    expect(url).toContain("source-url=https%3A%2F%2Fpublisher.example%2Flocal-game");
    expect(url).toContain("modes=competitive%3Bsolo");
    expect(url).not.toContain("bgg-id");
  });
});

describe("wishlist request links", () => {
  it("opens the game-request issue form with only supplied fields", () => {
    const url = buildWishlistIssueUrl("https://github.com/Bahbus/GameNightLibrary", {
      bggId: "",
      sourceUrl: "",
      name: "Sky Team",
      reasons: "A cooperative two-player game would fit weeknights.",
      notes: ""
    });
    expect(url).toContain("template=game-request.yml");
    expect(url).toContain("game-name=Sky+Team");
    expect(url).toContain("reasons=A+cooperative+two-player+game+would+fit+weeknights.");
    expect(url).not.toContain("bgg-id");
    expect(url).not.toContain("source-url");
  });
});
