import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppStatusPayload = vi.fn();
const getCurrentRub = vi.fn();

vi.mock("@/lib/server/quran-api", () => ({
  getAppStatusPayload
}));

vi.mock("@/lib/server/rub-state", () => ({
  getCurrentRub
}));

describe("status route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns online status payload from Next server state", async () => {
    getCurrentRub.mockResolvedValue(9);
    getAppStatusPayload.mockResolvedValue({
      offline: false,
      rubs: 240,
      pages: 604,
      chapters: 114,
      current_rub: 9,
      backendAvailable: true
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      offline: false,
      rubs: 240,
      pages: 604,
      chapters: 114,
      current_rub: 9,
      backendAvailable: true
    });
    expect(getCurrentRub).toHaveBeenCalledTimes(1);
    expect(getAppStatusPayload).toHaveBeenCalledWith(9);
  });
});
