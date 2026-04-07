import { beforeEach, describe, expect, it, vi } from "vitest";

const getTafsirPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getTafsirPayload
}));

describe("tafsir route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tafsir payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/tafsir?verse_key=2%3A255&tafsir_id=926");
    getTafsirPayload.mockResolvedValue({
      verse_key: "2:255",
      verse_text: "الله لا إله إلا هو",
      tafsir: {
        resource_id: 926,
        name: "التفسير",
        language_name: "ar",
        text: "نص",
        plain_text: "نص"
      }
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getTafsirPayload).toHaveBeenCalledWith("2:255", 926);
    await expect(response.json()).resolves.toMatchObject({
      verse_key: "2:255"
    });
  });
});
