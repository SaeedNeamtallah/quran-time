import { beforeEach, describe, expect, it, vi } from "vitest";

const getRubWordTimingsPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getRubWordTimingsPayload
}));

describe("rub_word_timings route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rub word timings payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/rub_word_timings?rub_number=1&count=1&recitation_id=7");
    getRubWordTimingsPayload.mockResolvedValue({
      rub_number: 1,
      count: 1,
      recitation_id: 7,
      word_timings: {}
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getRubWordTimingsPayload).toHaveBeenCalledWith(1, 1, 7);
    await expect(response.json()).resolves.toMatchObject({
      rub_number: 1,
      recitation_id: 7
    });
  });
});
