import { beforeEach, describe, expect, it, vi } from "vitest";

const getRubRecitationPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getRubRecitationPayload
}));

describe("rub_recitation route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rub recitation payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/rub_recitation?rub_number=1&count=1&recitation_id=7");
    getRubRecitationPayload.mockResolvedValue({
      rub_number: 1,
      count: 1,
      recitation_id: 7,
      audio_files: []
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getRubRecitationPayload).toHaveBeenCalledWith(1, 1, 7);
    await expect(response.json()).resolves.toMatchObject({
      rub_number: 1,
      recitation_id: 7
    });
  });
});
