import { beforeEach, describe, expect, it, vi } from "vitest";

const getPageWordTimingsPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getPageWordTimingsPayload
}));

describe("page_word_timings route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns page word timings payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/page_word_timings?page_number=7&recitation_id=7");
    getPageWordTimingsPayload.mockResolvedValue({
      page_number: 7,
      recitation_id: 7,
      word_timings: {}
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getPageWordTimingsPayload).toHaveBeenCalledWith(7, 7);
    await expect(response.json()).resolves.toMatchObject({
      page_number: 7,
      recitation_id: 7
    });
  });
});
