import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import type { BgblurClient } from "../bgblur-client.js";

/**
 * Resolves media input by either returning the provided URL or
 * decoding the base64/file payload, saving it to a temp file,
 * and uploading it to the backend via uploadLocalFile.
 */
export async function resolveMediaInput(
  client: BgblurClient,
  input: {
    media_url?: string;
    media_file?: string;
    media_type: "image" | "video";
  }
): Promise<string> {
  // If a URL is provided, prefer it.
  if (input.media_url) {
    return input.media_url;
  }

  if (input.media_file) {
    let buffer: Buffer;
    let fileName = "upload.bin";
    let fileType = "application/octet-stream";

    // Check if it's a Data URI
    if (input.media_file.startsWith("data:")) {
      const matches = input.media_file.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        fileType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
        const ext = fileType.split("/")[1] || "bin";
        fileName = `upload.${ext}`;
      } else {
        throw new Error("Invalid data URI format for media_file");
      }
    } 
    // Check if it's a raw base64 string
    else if (/^[A-Za-z0-9+/=\s]+$/.test(input.media_file) && input.media_file.length > 200) {
      buffer = Buffer.from(input.media_file, "base64");
      fileName = input.media_type === "image" ? "upload.jpg" : "upload.mp4";
      fileType = input.media_type === "image" ? "image/jpeg" : "video/mp4";
    } 
    // Check if it's a local file path (ChatGPT or Claude Desktop local rewrite)
    else if (fs.existsSync(input.media_file)) {
      buffer = fs.readFileSync(input.media_file);
      fileName = path.basename(input.media_file);
      fileType = input.media_type === "image" ? "image/jpeg" : "video/mp4"; // Fallback
    } else {
      throw new Error("media_file must be a base64 string, data URI, or valid local file path");
    }

    // Upload to our backend using the presigned URL flow in bgblur-client
    const uploadResult = await client.uploadLocalFile(input.media_type, {
      fileName,
      fileType,
      fileSize: buffer.length,
      data: buffer,
    });

    if (!uploadResult.media_url) {
      throw new Error("Failed to upload media_file to BGBlur");
    }

    return uploadResult.media_url;
  }

  throw new Error("Either media_url or media_file must be provided in the input.");
}
