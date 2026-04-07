import { beforeEach, describe, expect, it, vi } from "vitest";

const getVerseAudioPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getVerseAudioPayload
}));

describe("verse_audio route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns verse audio payload from Next server logic", async () => {
    const request = new Request("http://localhost/api/verse_audio?verse_key=1%3A1&recitation_id=7");
    getVerseAudioPayload.mockResolvedValue({
      verse_key: "1:1",
      verse_text: "الحمد لله",
      recitation_id: 7,
      audio_url: "https://example.com/1-1.mp3"
    });

    const { GET } = await import("./route");
    const response = await GET(request);

    expect(getVerseAudioPayload).toHaveBeenCalledWith("1:1", 7);
    await expect(response.json()).resolves.toMatchObject({
      audio_url: "https://example.com/1-1.mp3"
    });
  });
});
