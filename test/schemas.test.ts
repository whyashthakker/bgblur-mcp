import { describe, expect, it } from "vitest";
import { z } from "zod";

import { blurBackgroundSchema, removeObjectFromVideoSchema } from "../src/schemas.js";

describe("tool schemas", () => {
  it("applies blur background defaults", () => {
    const parsed = z.object(blurBackgroundSchema).parse({
      image_url: "https://example.com/image.jpg",
    });

    expect(parsed.blur_strength).toBe(0.7);
    expect(parsed.output_format).toBe("png");
  });

  it("rejects invalid object prompts", () => {
    expect(() =>
      z.object(removeObjectFromVideoSchema).parse({
        video_url: "https://example.com/video.mp4",
        object_text: "",
      }),
    ).toThrow();
  });
});
