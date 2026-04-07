import { beforeEach, describe, expect, it, vi } from "vitest";

const setCurrentRub = vi.fn();

vi.mock("@/lib/server/rub-state", () => ({
  setCurrentRub
}));

describe("set_rub route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the incoming rub number and returns it", async () => {
    setCurrentRub.mockResolvedValue(12);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/set_rub", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rub_number: 12
      })
    });

    const response = await POST(request);

    expect(setCurrentRub).toHaveBeenCalledWith(12);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "تم تحديث الربع الحالي.",
      current_rub: 12
    });
  });

  it("clamps invalid payload to safe rub range", async () => {
    setCurrentRub.mockResolvedValue(1);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/set_rub", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rub_number: -99
      })
    });

    const response = await POST(request);

    expect(setCurrentRub).toHaveBeenCalledWith(1);
    expect(response.status).toBe(200);
  });
});
