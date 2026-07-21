import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, loadWorkflowBundle } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  it("surfaces the backend error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Workflow not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(apiGet("/workflows/missing")).rejects.toEqual(
      new ApiError("Workflow not found", 404)
    );
  });

  it("rejects invalid successful JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }))
    );

    await expect(apiGet("/workflows/WF-1")).rejects.toThrow(
      "invalid JSON"
    );
  });
});

describe("loadWorkflowBundle", () => {
  it("loads workflow artifacts and skill registry metadata", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) => {
      const body = input.endsWith("/workflows/WF-1")
        ? {
            id: "WF-1",
            documentId: "DOC-1",
            status: "ACTIVE",
            createdAt: "2026-06-12T00:00:00Z",
            updatedAt: "2026-06-12T00:00:00Z"
          }
        : [];
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const bundle = await loadWorkflowBundle("WF-1");

    expect(bundle.workflow.id).toBe("WF-1");
    expect(bundle.skills).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(
      fetchMock.mock.calls.map(([url]) => url as string)
    ).toEqual(
      expect.arrayContaining([
        "/api/v1/business-analysis/workflows/WF-1",
        "/api/v1/business-analysis/workflows/WF-1/test-intents",
        "/api/v1/business-analysis/workflows/WF-1/test-cases",
        "/api/v1/business-analysis/workflows/WF-1/bdd-scenarios",
        "/api/v1/business-analysis/jobs?workflowId=WF-1",
        "/api/v1/skills"
      ])
    );
  });
});
