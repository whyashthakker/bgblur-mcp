import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

import type { BgblurClient } from "../bgblur-client.js";
import {
  blurAnythingSchema,
  faceAnonymizationSchema,
  blurBackgroundSchema,
  blurFacesSchema,
  blurLicensePlatesSchema,
  blurVideoBackgroundSchema,
  detectNsfwSchema,
  emptySchema,
  getJobStatusSchema,
  portraitEnhanceSchema,
  removeBackgroundSchema,
  removeObjectFromVideoSchema,
  uploadImageSchema,
  uploadVideoSchema,
} from "../schemas.js";
import { readLocalUpload } from "../utils/local-file.js";
import { resolveMediaInput } from "../utils/media-resolver.js";
import { errorText, jsonText } from "../utils/response.js";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ClientProvider = (extra: ToolExtra) => BgblurClient;

type RegisterToolOptions = {
  enableLocalUploads?: boolean;
};

export function registerTools(
  server: McpServer,
  getClient: ClientProvider,
  options: RegisterToolOptions = {},
) {
  if (options.enableLocalUploads) {
    server.tool(
      "upload_image",
      "Upload a local image file to BGBlur and return a CDN image URL.",
      uploadImageSchema,
      async (input, extra) =>
        callTool(async () => {
          const file = await readLocalUpload(input.file_path);
          if (!file.fileType.startsWith("image/")) {
            throw new Error("file_path must point to a supported image file.");
          }
          return getClient(extra).uploadLocalFile("image", file);
        }),
    );

    server.tool(
      "upload_video",
      "Upload a local video file to BGBlur and return a CDN video URL.",
      uploadVideoSchema,
      async (input, extra) =>
        callTool(async () => {
          const file = await readLocalUpload(input.file_path);
          if (!file.fileType.startsWith("video/")) {
            throw new Error("file_path must point to a supported video file.");
          }
          return getClient(extra).uploadLocalFile("video", file);
        }),
    );
  }

  server.tool(
    "check_credits",
    "Check remaining BGBlur credits and API key account usage information.",
    emptySchema,
    async (_input, extra) => callTool(() => getClient(extra).get("/me/credits")),
  );

  server.tool(
    "list_features",
    "List available BGBlur MCP/API features, input schemas, endpoints, and credit costs.",
    emptySchema,
    async (_input, extra) => callTool(() => getClient(extra).get("/features")),
  );

  server.tool(
    "blur_background",
    "Blur an image background with configurable intensity.",
    blurBackgroundSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.image_url,
        media_file: input.media_file,
        media_type: "image",
      });
      return getClient(extra).post("/images/blur-background", {
        image_url: media_url,
        blur_strength: input.blur_strength,
        output_format: input.output_format,
      });
    }),
  );

  server.tool(
    "remove_background",
    "Remove an image background and optionally return a transparent output.",
    removeBackgroundSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.image_url,
        media_file: input.media_file,
        media_type: "image",
      });
      return getClient(extra).post("/images/remove-background", {
        image_url: media_url,
        output_transparent: input.output_transparent,
        background_color: input.background_color,
        output_format: input.output_format,
      });
    }),
  );

  server.tool(
    "portrait_enhance",
    "Enhance a portrait and optionally apply depth effects.",
    portraitEnhanceSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.image_url,
        media_file: input.media_file,
        media_type: "image",
      });
      return getClient(extra).post("/images/portrait-enhance", {
        image_url: media_url,
        enhance_face: input.enhance_face,
        depth_effect: input.depth_effect,
        output_format: input.output_format,
      });
    }),
  );

  server.tool(
    "blur_faces",
    "Blur faces in an image or video.",
    blurFacesSchema,
    async (input, extra) => callTool(async () => {
      const resolved_url = await resolveMediaInput(getClient(extra), {
        media_url: input.media_url,
        media_file: input.media_file,
        media_type: input.media_type,
      });
      return getClient(extra).post(
        input.media_type === "image" ? "/images/face-blur" : "/videos/face-blur",
        input.media_type === "image"
          ? {
              image_url: resolved_url,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
            }
          : {
              video_url: resolved_url,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
            },
      );
    }),
  );

  server.tool(
    "blur_license_plates",
    "Blur license plates in an image or video.",
    blurLicensePlatesSchema,
    async (input, extra) => callTool(async () => {
      const resolved_url = await resolveMediaInput(getClient(extra), {
        media_url: input.media_url,
        media_file: input.media_file,
        media_type: input.media_type,
      });
      return getClient(extra).post(
        input.media_type === "image" ? "/images/license-plate-blur" : "/videos/license-plate-blur",
        input.media_type === "image"
          ? {
              image_url: resolved_url,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
            }
          : {
              video_url: resolved_url,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
            },
      );
    }),
  );

  server.tool(
    "blur_video_background",
    "Blur a video background.",
    blurVideoBackgroundSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.video_url,
        media_file: input.media_file,
        media_type: "video",
      });
      return getClient(extra).post("/videos/background-blur", {
        video_url: media_url,
        blur_strength: input.blur_strength,
        duration_seconds: input.duration_seconds,
      });
    }),
  );

  server.tool(
    "remove_object_from_video",
    "Remove a named object from a video.",
    removeObjectFromVideoSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.video_url,
        media_file: input.media_file,
        media_type: "video",
      });
      return getClient(extra).post("/videos/object-removal", {
        video_url: media_url,
        object_text: input.object_text,
        duration_seconds: input.duration_seconds,
      });
    }),
  );

  server.tool(
    "detect_nsfw",
    "Detect unsafe content in an image or video.",
    detectNsfwSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.media_url,
        media_file: input.media_file,
        media_type: input.media_type,
      });
      return getClient(extra).post("/detect/nsfw", {
        media_url: media_url,
        media_type: input.media_type,
      });
    }),
  );

  server.tool(
    "blur_anything",
    "Blur specific objects in an image or video based on a text prompt.",
    blurAnythingSchema,
    async (input, extra) => callTool(async () => {
      const resolved_url = await resolveMediaInput(getClient(extra), {
        media_url: input.media_url,
        media_file: input.media_file,
        media_type: input.media_type,
      });
      return getClient(extra).post(
        input.media_type === "image" ? "/images/blur-anything" : "/videos/blur-anything",
        input.media_type === "image"
          ? {
              image_url: resolved_url,
              prompt: input.prompt,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
              pixelation_strength: input.pixelation_strength,
            }
          : {
              video_url: resolved_url,
              prompt: input.prompt,
              blur_strength: input.blur_strength,
              pixelated: input.pixelated,
              pixelation_strength: input.pixelation_strength,
            },
      );
    }),
  );

  server.tool(
    "face_anonymization",
    "Deepfake-grade face anonymization for videos.",
    faceAnonymizationSchema,
    async (input, extra) => callTool(async () => {
      const media_url = await resolveMediaInput(getClient(extra), {
        media_url: input.video_url,
        media_file: input.media_file,
        media_type: "video",
      });
      return getClient(extra).post("/videos/face-anonymization", {
        video_url: media_url,
      });
    }),
  );

  server.tool(
    "get_job_status",
    "Check the status and result of an async BGBlur job.",
    getJobStatusSchema,
    async (input, extra) =>
      callTool(() => getClient(extra).get(`/jobs/${encodeURIComponent(input.job_id)}`)),
  );
}

async function callTool(callback: () => Promise<unknown>) {
  try {
    return jsonText(await callback());
  } catch (error) {
    return errorText(error);
  }
}
