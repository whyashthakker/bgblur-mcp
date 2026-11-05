import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { BgblurClient } from "../src/bgblur-client.js";
import { registerTools } from "../src/tools/register.js";
import { resolveMediaInput } from "../src/utils/media-resolver.js";
import { errorText } from "../src/utils/response.js";

describe("Claude connector review requirements", () => {
  it("marks processing tools as requiring confirmation", () => {
    const tools: Record<string, { annotations: { destructiveHint?: boolean; readOnlyHint?: boolean } }> = {};
    const server = {
      registerTool(name: string, definition: typeof tools[string]) {
        tools[name] = definition;
      },
    };

    registerTools(server as never, () => ({} as BgblurClient));

    expect(tools.blur_background.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(tools.check_credits.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(tools.upload_image).toBeUndefined();
  });

  it("returns a protocol error for a failed tool call", () => {
    expect(errorText(new Error("Invalid media URL"))).toMatchObject({
      isError: true,
      content: [{ type: "text", text: expect.stringContaining("Invalid media URL") }],
    });
  });

  it("does not read server files from remote media_file input", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bgblur-mcp-test-"));
    const filePath = path.join(directory, "secret.png");
    const uploadLocalFile = vi.fn();
    try {
      await writeFile(filePath, "private file contents");
      await expect(resolveMediaInput(
        { uploadLocalFile } as unknown as BgblurClient,
        { media_file: filePath, media_type: "image" },
      )).rejects.toThrow("server file paths are not supported over HTTP");
      expect(uploadLocalFile).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps local file support for the stdio server", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bgblur-mcp-test-"));
    const filePath = path.join(directory, "photo.png");
    const uploadLocalFile = vi.fn().mockResolvedValue({ media_url: "https://cdn.example/photo.png" });
    try {
      await writeFile(filePath, "image bytes");
      await expect(resolveMediaInput(
        { uploadLocalFile } as unknown as BgblurClient,
        { media_file: filePath, media_type: "image" },
        { allowLocalFilePath: true },
      )).resolves.toBe("https://cdn.example/photo.png");
      expect(uploadLocalFile).toHaveBeenCalledOnce();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
