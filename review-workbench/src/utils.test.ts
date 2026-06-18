import { describe, expect, it } from "vitest";
import {
  currentBddScenarios,
  displayText,
  isActiveJobStatus,
  parseJsonText,
  sortBddScenarios,
  statusTone
} from "./utils";

describe("parseJsonText", () => {
  it("parses persisted JSON arrays", () => {
    const result = parseJsonText('["one","two"]');
    expect(result.value).toEqual(["one", "two"]);
    expect(result.error).toBeUndefined();
  });

  it("preserves invalid JSON as visible raw text", () => {
    const result = parseJsonText("not-json");
    expect(result.value).toBe("not-json");
    expect(result.raw).toBe("not-json");
    expect(result.error).toContain("raw text");
  });

  it("formats structured values without repairing them", () => {
    expect(displayText('{"source":"persisted"}')).toContain(
      '"source": "persisted"'
    );
  });
});

describe("job lifecycle", () => {
  it("polls only the approved active states", () => {
    expect(isActiveJobStatus("QUEUED")).toBe(true);
    expect(isActiveJobStatus("RUNNING")).toBe(true);
    expect(isActiveJobStatus("SUCCEEDED")).toBe(false);
    expect(isActiveJobStatus("FAILED")).toBe(false);
    expect(isActiveJobStatus("UNKNOWN")).toBe(false);
  });

  it("keeps terminal failures visually distinct", () => {
    expect(statusTone("RUNNING")).toBe("active");
    expect(statusTone("SUCCEEDED")).toBe("positive");
    expect(statusTone("FAILED")).toBe("negative");
  });
});

describe("BDD draft ordering", () => {
  it("keeps stale BDD rows out of the current draft set", () => {
    const scenarios = [
      {
        id: "stale",
        status: "STALE",
        staleAt: "2026-06-16T09:00:00Z",
        updatedAt: "2026-06-16T09:00:00Z"
      },
      {
        id: "draft",
        status: "DRAFT",
        staleAt: null,
        updatedAt: "2026-06-16T08:00:00Z"
      }
    ];

    expect(currentBddScenarios(scenarios).map((scenario) => scenario.id)).toEqual([
      "draft"
    ]);
  });

  it("sorts current BDD drafts before stale history rows", () => {
    const scenarios = [
      {
        id: "stale-newer",
        status: "STALE",
        staleAt: "2026-06-16T10:00:00Z",
        updatedAt: "2026-06-16T10:00:00Z"
      },
      {
        id: "draft-older",
        status: "DRAFT",
        staleAt: null,
        updatedAt: "2026-06-16T08:00:00Z"
      }
    ];

    expect(sortBddScenarios(scenarios).map((scenario) => scenario.id)).toEqual([
      "draft-older",
      "stale-newer"
    ]);
  });
});
