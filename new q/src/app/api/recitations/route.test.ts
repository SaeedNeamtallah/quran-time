import { beforeEach, describe, expect, it, vi } from "vitest";

const getRecitationsPayload = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getRecitationsPayload
}));

describe("recitations route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recitations payload from Next server logic", async () => {
    getRecitationsPayload.mockResolvedValue({
      default_recitation_id: 7,
      recitations: []
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(getRecitationsPayload).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      default_recitation_id: 7,
      recitations: []
    });
  });
});
