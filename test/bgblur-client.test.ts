import { describe, expect, it, vi } from "vitest";

import { BgblurClient } from "../src/bgblur-client.js";

describe("BgblurClient", () => {
  it("sends bearer auth without exposing the key in output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new BgblurClient({
      apiKey: "vba_secret",
      apiBaseUrl: "https://bgblur.com/api/v1",
      timeoutMs: 1000,
    });

    await client.post("/images/blur-background", {
      image_url: "https://example.com/image.jpg",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://bgblur.com/api/v1/images/blur-background",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer vba_secret",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
