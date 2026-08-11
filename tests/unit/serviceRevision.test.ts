import { describe, expect, it } from "vitest";
import {
  createServiceRevision,
  serializeServiceRevision
} from "../../shared/setup/serviceRevision";

describe("Setup service revision", () => {
  const revision = "8606a0331a01ba681b7140f493907f7906ce4150";

  it("normalizes and serializes a complete Git commit SHA", () => {
    expect(createServiceRevision(`  ${revision.toUpperCase()}\n`)).toEqual({ revision });
    expect(JSON.parse(serializeServiceRevision(revision))).toEqual({ revision });
    expect(serializeServiceRevision(revision)).toMatch(/\n$/);
  });

  it.each(["", "8606a03", `${revision}0`, "z".repeat(40)])("rejects invalid revision %j", (value) =>
    expect(() => createServiceRevision(value)).toThrow(/complete Git commit SHA/)
  );
});
