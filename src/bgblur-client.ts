import type { BgblurConfig } from "./config.js";
import { BgblurApiError } from "./errors.js";

export class BgblurClient {
  constructor(private readonly config: BgblurConfig) {}

  post(path: string, body: Record<string, unknown>) {
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  get(path: string) {
    return this.request(path, { method: "GET" });
  }

  async uploadLocalFile(
    kind: "image" | "video",
    file: {
      fileName: string;
      fileType: string;
      fileSize: number;
      data: Buffer;
    },
  ) {
    const presign = await this.post(`/uploads/${kind}`, {
      file_name: file.fileName,
      file_type: file.fileType,
      file_size: file.fileSize,
    });

    if (!presign?.upload_url || typeof presign.upload_url !== "string") {
      throw new BgblurApiError("upload_failed", "BGBlur did not return an upload URL.");
    }

    const uploadResponse = await fetch(presign.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": file.fileType,
      },
      body: file.data as unknown as BodyInit,
    });

    if (!uploadResponse.ok) {
      throw new BgblurApiError("upload_failed", "Could not upload media to BGBlur.");
    }

    const mediaUrl =
      kind === "image"
        ? presign.image_url || presign.media_url
        : presign.video_url || presign.media_url;

    return {
      success: true,
      ...(kind === "image" ? { image_url: mediaUrl } : { video_url: mediaUrl }),
      media_url: mediaUrl,
    };
  }

  private async request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...init.headers,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.message ||
          "BGBlur API request failed.";
        const code = data?.error?.code || "bgblur_api_error";
        throw new BgblurApiError(code, message, response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof BgblurApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new BgblurApiError("timeout", "BGBlur API request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
