import { beforeEach, describe, expect, it, vi } from "vitest";

function makeJsonResponse(payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    })
  );
}

describe("api client fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("uses the unified rub endpoint directly", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === "/api/rub?count=2&rub_number=240") {
        return makeJsonResponse({
          rub_number: "240 - 1",
          verses: [{ verse_key: "114:6" }, { verse_key: "1:1" }]
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchRubContent } = await import("@/lib/api/client");
    const payload = await fetchRubContent(240, 2);

    expect(payload.rub_number).toBe("240 - 1");
    expect(payload.verses.map((verse) => verse.verse_key)).toEqual(["114:6", "1:1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads the verse sequence once and reuses the client cache", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url === "/api/verse_sequence") {
        return makeJsonResponse({ verses: ["1:1", "1:2"] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { loadVerseSequence } = await import("@/lib/api/client");
    const first = await loadVerseSequence();
    const second = await loadVerseSequence();

    expect(first).toEqual(["1:1", "1:2"]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
