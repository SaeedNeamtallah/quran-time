import { beforeEach, describe, expect, it, vi } from "vitest";

const getPageRecitationPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getPageRecitationPayload
}));

describe("page_recitation route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns page recitation payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/page_recitation?page_number=7&recitation_id=7");
    getPageRecitationPayload.mockResolvedValue({
      page_number: 7,
      recitation_id: 7,
      audio_files: []
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getPageRecitationPayload).toHaveBeenCalledWith(7, 7);
    await expect(response.json()).resolves.toMatchObject({
      page_number: 7,
      recitation_id: 7
    });
  });
});
