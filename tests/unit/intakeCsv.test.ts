import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "../../shared/csv";

const intakePath = "data/inventory.intake.csv";

describe("resolved inventory intake CSV", () => {
  it("has the stable open-format contract and all 81 resolved rows", async () => {
    const source = await readFile(intakePath, "utf8");
    const [headers] = parseCsv(source);
    const rows = csvRecords(source);

    expect(headers).toEqual([
      "include",
      "submitted_wording",
      "proposed_title",
      "kind",
      "parent_title",
      "edition_or_owned_detail",
      "match_status",
      "notes",
      "source_url"
    ]);
    expect(rows).toHaveLength(81);
    expect(rows.every((row) => row.include === "Yes")).toBe(true);
    expect(rows.every((row) => row.match_status === "Ready to match")).toBe(true);
  });

  it("uses unique proposed titles and valid base-game parents", async () => {
    const rows = csvRecords(await readFile(intakePath, "utf8"));
    const titles = rows.map((row) => row.proposed_title);
    const baseTitles = new Set(
      rows.filter((row) => row.kind !== "Expansion").map((row) => row.proposed_title)
    );

    expect(new Set(titles).size).toBe(titles.length);
    expect(
      rows
        .filter((row) => row.kind === "Expansion")
        .every((row) => baseTitles.has(row.parent_title))
    ).toBe(true);
  });

  it("preserves the resolved Unsettled and Dice Throne ownership details", async () => {
    const rows = csvRecords(await readFile(intakePath, "utf8"));
    const titles = new Set(rows.map((row) => row.proposed_title));

    expect([...titles]).toEqual(
      expect.arrayContaining([
        "Unsettled: Wenora",
        "Unsettled: Grakkis",
        "Unsettled: Zehronn",
        "Unsettled: Yendraal",
        "Unsettled: Strannos",
        "Unsettled: Kaelyfos",
        "Unsettled: Koguya",
        "Unsettled: Blackout",
        "Unsettled: Gniir"
      ])
    );
    expect(titles).toContain("Unsettled: Scientific Fascinations");
    expect(titles).toContain("Unsettled: Scientific Specializations");
    expect(titles).toContain("Unsettled: Luna's Synthesizer");
    expect(titles).toContain("Unsettled: Survival Task Pack 1");
    expect(titles).toContain("Unsettled: Survival Task Pack 2");
    expect(titles).toContain("Dice Throne: Season One");
    expect([...titles].filter((title) => title.startsWith("Dice Throne"))).toHaveLength(1);
  });
});
