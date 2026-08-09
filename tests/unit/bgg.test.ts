import { describe, expect, it } from "vitest";
import { fetchBggMetadata, parseBggThings } from "../../scripts/bgg";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="101">
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/image.jpg</image>
    <name type="primary" value="Forest Council"/>
    <yearpublished value="2022"/>
    <minplayers value="2"/>
    <maxplayers value="5"/>
    <minplaytime value="45"/>
    <maxplaytime value="75"/>
    <minage value="10"/>
    <link type="boardgamecategory" id="1" value="Fantasy"/>
    <link type="boardgamemechanic" id="2" value="Cooperative Game"/>
    <poll name="suggested_numplayers">
      <results numplayers="4">
        <result value="Best" numvotes="12"/>
        <result value="Recommended" numvotes="4"/>
        <result value="Not Recommended" numvotes="1"/>
      </results>
    </poll>
    <statistics>
      <ratings>
        <average value="8.1"/>
        <averageweight value="3.0"/>
        <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="120"/></ranks>
      </ratings>
    </statistics>
  </item>
</items>`;

describe("BGG enrichment", () => {
  it("parses public game fields and recommendation polls", () => {
    const [game] = parseBggThings(xml);
    expect(game).toMatchObject({
      bggId: 101,
      name: "Forest Council",
      minPlayers: 2,
      maxPlayers: 5,
      complexity: 3,
      rating: 8.1,
      rank: 120,
      categories: ["Fantasy"],
      mechanics: ["Cooperative Game"],
      modes: ["cooperative"]
    });
    expect(game.playerRecommendations).toEqual([{ playerCount: 4, rating: "best" }]);
  });

  it("derives competitive, cooperative, team, and solo modes from BGG fields", () => {
    const modesXml = `<items>
      <item type="boardgame" id="201">
        <name type="primary" value="Solo Team"/>
        <minplayers value="1"/>
        <link type="boardgamemechanic" value="Cooperative Game"/>
        <link type="boardgamemechanic" value="Team-Based Game"/>
      </item>
      <item type="boardgame" id="202">
        <name type="primary" value="Semi-Cooperative"/>
        <minplayers value="2"/>
        <link type="boardgamemechanic" value="Semi-Cooperative Game"/>
      </item>
      <item type="boardgame" id="203">
        <name type="primary" value="Ordinary Competition"/>
        <minplayers value="2"/>
      </item>
      <item type="boardgame" id="204">
        <name type="primary" value="Team Competition"/>
        <minplayers value="4"/>
        <link type="boardgamemechanic" value="Team-Based Game"/>
      </item>
    </items>`;

    const [soloTeam, semiCooperative, competitive, teamCompetition] = parseBggThings(modesXml);
    expect(soloTeam.modes).toEqual(["cooperative", "team", "solo"]);
    expect(semiCooperative.modes).toEqual(["cooperative", "competitive"]);
    expect(competitive.modes).toEqual(["competitive"]);
    expect(teamCompetition.modes).toEqual(["team", "competitive"]);
  });

  it("retries queued responses and returns the successful payload", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response(calls === 1 ? "" : xml, { status: calls === 1 ? 202 : 200 });
    };
    const result = await fetchBggMetadata([101], "token", fetcher as typeof fetch, async () => {});
    expect(calls).toBe(2);
    expect(result.get(101)?.name).toBe("Forest Council");
  });

  it("rejects a missing BGG item", async () => {
    const fetcher = async () => new Response("<items></items>", { status: 200 });
    await expect(fetchBggMetadata([999], "token", fetcher as typeof fetch)).rejects.toThrow(
      /did not return/
    );
  });

  it.each([429, 500, 502, 503, 504])(
    "retries a transient %s response with bounded backoff",
    async (status) => {
      let calls = 0;
      const waits: number[] = [];
      const fetcher = async () => {
        calls += 1;
        return new Response(calls === 1 ? "" : xml, {
          status: calls === 1 ? status : 200
        });
      };

      const result = await fetchBggMetadata(
        [101],
        "token",
        fetcher as typeof fetch,
        async (milliseconds) => {
          waits.push(milliseconds);
        }
      );

      expect(result.get(101)?.name).toBe("Forest Council");
      expect(calls).toBe(2);
      expect(waits).toEqual([5000]);
    }
  );

  it("stops after five retryable failures", async () => {
    let calls = 0;
    const waits: number[] = [];
    const fetcher = async () => {
      calls += 1;
      return new Response("", { status: 503 });
    };

    await expect(
      fetchBggMetadata([101], "token", fetcher as typeof fetch, async (milliseconds) => {
        waits.push(milliseconds);
      })
    ).rejects.toThrow(/failed after retries/);
    expect(calls).toBe(5);
    expect(waits).toEqual([5000, 10000, 20000, 30000]);
  });

  it("does not retry permanent API failures", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return new Response("", { status: 401 });
    };

    await expect(
      fetchBggMetadata([101], "token", fetcher as typeof fetch, async () => {})
    ).rejects.toThrow(/returned 401/);
    expect(calls).toBe(1);
  });

  it("requests at most 20 IDs per BGG batch", async () => {
    const ids = Array.from({ length: 21 }, (_, index) => index + 1);
    const requestedBatches: number[][] = [];
    const waits: number[] = [];
    const fetcher = async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input));
      const batch = url.searchParams.get("id")!.split(",").map(Number);
      requestedBatches.push(batch);
      const items = batch
        .map(
          (id) =>
            `<item type="boardgame" id="${id}"><name type="primary" value="Game ${id}"/></item>`
        )
        .join("");
      return new Response(`<items>${items}</items>`, { status: 200 });
    };

    const result = await fetchBggMetadata(
      ids,
      "token",
      fetcher as typeof fetch,
      async (milliseconds) => {
        waits.push(milliseconds);
      }
    );
    expect(requestedBatches.map((batch) => batch.length)).toEqual([20, 1]);
    expect(waits).toEqual([5000]);
    expect(result.size).toBe(21);
  });
});
