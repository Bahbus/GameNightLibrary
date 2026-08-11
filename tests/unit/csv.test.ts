import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "../../shared/csv";

describe("CSV parsing", () => {
  it("handles quoted commas and escaped quotes", () => {
    expect(parseCsv('name,notes\n"Game, The","A ""great"" game"\n')).toEqual([
      ["name", "notes"],
      ["Game, The", 'A "great" game']
    ]);
  });

  it("reports inconsistent row widths", () => {
    expect(() => csvRecords("a,b\none\n")).toThrow(/row 2/);
  });
});
