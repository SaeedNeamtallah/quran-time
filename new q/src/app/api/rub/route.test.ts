import { beforeEach, describe, expect, it, vi } from "vitest";

const getRubPayload = vi.fn();
const getCurrentRub = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getRubPayload
}));

vi.mock("@/lib/server/rub-state", () => ({
  getCurrentRub
}));

describe("rub route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses explicit rub_number query when provided", async () => {
    getCurrentRub.mockResolvedValue(1);
    getRubPayload.mockResolvedValue({
      rub_number: 5,
      verses: [
        {
          id: 1,
          verse_number: 1,
          verse_key: "5:1",
          hizb_number: 3,
          rub_el_hizb_number: 5,
          ruku_number: 1,
          manzil_number: 1,
          text_uthmani: "نص",
          page_number: 100,
          juz_number: 1,
          chapter_id: 5
        }
      ],
      page_sources: []
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/rub?count=1&rub_number=5"));

    expect(getCurrentRub).not.toHaveBeenCalled();
    expect(getRubPayload).toHaveBeenCalledWith(5, 1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      rub_number: 5,
      verses: [{ verse_key: "5:1" }]
    });
  });

  it("falls back to persisted state rub when query is missing", async () => {
    getCurrentRub.mockResolvedValue(240);
    getRubPayload.mockResolvedValue({
      rub_number: "240 - 1",
      verses: [
        {
          id: 2,
          verse_number: 6,
          verse_key: "114:6",
          hizb_number: 60,
          rub_el_hizb_number: 240,
          ruku_number: 1,
          manzil_number: 7,
          text_uthmani: "من الجنة والناس",
          page_number: 604,
          juz_number: 30,
          chapter_id: 114
        },
        {
          id: 1,
          verse_number: 1,
          verse_key: "1:1",
          hizb_number: 1,
          rub_el_hizb_number: 1,
          ruku_number: 1,
          manzil_number: 1,
          text_uthmani: "الحمد لله",
          page_number: 1,
          juz_number: 1,
          chapter_id: 1
        }
      ],
      page_sources: []
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/rub?count=2"));

    expect(response.status).toBe(200);
    expect(getCurrentRub).toHaveBeenCalledTimes(1);
    expect(getRubPayload).toHaveBeenCalledWith(240, 2);
    await expect(response.json()).resolves.toMatchObject({
      rub_number: "240 - 1",
      verses: [
        { verse_key: "114:6" },
        { verse_key: "1:1" }
      ]
    });
  });
});
