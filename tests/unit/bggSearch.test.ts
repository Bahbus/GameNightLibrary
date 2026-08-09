import { describe, expect, it } from "vitest";
import {
  buildMatchReport,
  fetchBggSearch,
  parseBggSearch,
  rankBggCandidates
} from "../../scripts/bggSearch";
import type { MatchingRow } from "../../scripts/intakeMatching";

const searchXml = `<?xml version="1.0" encoding="utf-8"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="9209">
    <name type="primary" value="Ticket to Ride"/>
    <yearpublished value="2004"/>
  </item>
  <item type="boardgame" id="123">
    <name type="primary" value="Ticket to Ride: Europe"/>
    <yearpublished value="2005"/>
  </item>
</items>`;

const pending = (title: string): MatchingRow => ({
  slug: "ticket-to-ride",
  kind: "game",
  parentSlug: "",
  proposedTitle: title,
  editionOrOwnedDetail: "",
  quantity: 1,
  standalone: false,
  sourceUrl: "",
  matchStatus: "pending-bgg-search",
  intakeNotes: "",
  matchingNotes: ""
});

describe("BGG search matching", () => {
  it("parses and ranks an exact title above related candidates", () => {
    const candidates = parseBggSearch(searchXml);
    expect(candidates).toHaveLength(2);
    expect(rankBggCandidates("Ticket to Ride", candidates)[0]).toMatchObject({
      bggId: 9209,
      score: 1
    });
  });

  it("retries a queued search without sleeping in tests", async () => {
    let calls = 0;
    const waits: number[] = [];
    const result = await fetchBggSearch(
      "Ticket to Ride",
      "token",
      async () => {
        calls += 1;
        return new Response(calls === 1 ? "" : searchXml, { status: calls === 1 ? 202 : 200 });
      },
      async (milliseconds) => {
        waits.push(milliseconds);
      }
    );
    expect(calls).toBe(2);
    expect(waits).toEqual([5000]);
    expect(result[0].bggId).toBe(9209);
  });

  it("suggests but does not silently confirm a unique exact title", async () => {
    const [result] = await buildMatchReport([pending("Ticket to Ride")], async () =>
      parseBggSearch(searchXml)
    );
    expect(result.knownBggId).toBeUndefined();
    expect(result).toMatchObject({
      suggestedBggId: 9209,
      suggestionStatus: "exact-title"
    });
  });

  it("requires review when exact search results are ambiguous", async () => {
    const duplicates = [
      { bggId: 1, name: "Medium" },
      { bggId: 2, name: "Medium" }
    ];
    const [result] = await buildMatchReport([pending("Medium")], async () => duplicates);
    expect(result.suggestionStatus).toBe("review");
  });
});
