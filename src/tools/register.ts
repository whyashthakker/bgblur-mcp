import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";

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

type ToolMeta = { title: string; annotations: ToolAnnotations };

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} satisfies ToolAnnotations;

// Processing tools create a new output from the input media; they never modify
// or delete the source file. They spend credits, so they are not read-only.
const PROCESS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} satisfies ToolAnnotations;

const TOOL_META: Record<string, ToolMeta> = {
  upload_image: { title: "Upload Image", annotations: PROCESS },
  upload_video: { title: "Upload Video", annotations: PROCESS },
  check_credits: { title: "Check Credits", annotations: READ_ONLY },
  list_features: { title: "List Features", annotations: READ_ONLY },
  blur_background: { title: "Blur Image Background", annotations: PROCESS },
  remove_background: { title: "Remove Image Background", annotations: PROCESS },
  portrait_enhance: { title: "Enhance Portrait", annotations: PROCESS },
  blur_faces: { title: "Blur Faces", annotations: PROCESS },
  blur_license_plates: { title: "Blur License Plates", annotations: PROCESS },
  blur_video_background: { title: "Blur Video Background", annotations: PROCESS },
  remove_object_from_video: { title: "Remove Object From Video", annotations: PROCESS },
  detect_nsfw: { title: "Detect NSFW Content", annotations: READ_ONLY },
  blur_anything: { title: "Blur Anything", annotations: PROCESS },
  face_anonymization: { title: "Anonymize Faces In Video", annotations: PROCESS },
  get_job_status: { title: "Get Job Status", annotations: READ_ONLY },
};

type RegisterToolOptions = {
  enableLocalUploads?: boolean;
};

export function registerTools(
  server: McpServer,
  getClient: ClientProvider,
  options: RegisterToolOptions = {},
) {
  const defineTool = (
    name: string,
    meta: ToolMeta,
    description: string,
    inputSchema: any,
    cb: (input: any, extra: ToolExtra) => Promise<any>,
  ) =>
    server.registerTool(
      name,
      { title: meta.title, description, inputSchema, annotations: meta.annotations },
      cb as any,
    );

  if (options.enableLocalUploads) {
    defineTool(
      "upload_image",
      TOOL_META["upload_image"],
      "This tool will upload a local image file to BGBlur and return a CDN URL that can be passed as media_file to any other BGBlur tool. " +
        "It takes one argument: " +
        "- file_path (str, required): Absolute local path to the image file.",
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

    defineTool(
      "upload_video",
      TOOL_META["upload_video"],
      "This tool will upload a local video file to BGBlur and return a CDN URL that can be passed as media_file to any other BGBlur tool. " +
        "It takes one argument: " +
        "- file_path (str, required): Absolute local path to the video file.",
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

  defineTool(
    "check_credits",
    TOOL_META["check_credits"],
    "This tool will check the remaining BGBlur credits and account usage information for the calling API key. It takes no arguments.",
    emptySchema,
    async (_input, extra) => callTool(() => getClient(extra).get("/me/credits")),
  );

  defineTool(
    "list_features",
    TOOL_META["list_features"],
    "This tool will list every available BGBlur tool, its endpoint, input schema, and credit cost. It takes no arguments.",
    emptySchema,
    async (_input, extra) => callTool(() => getClient(extra).get("/features")),
  );

  defineTool(
    "blur_background",
    TOOL_META["blur_background"],
    "This tool will blur the background of an image while keeping the foreground subject sharp. " +
      "It takes the following arguments: " +
      "- media_file or image_url (one required): The image to process, either an uploaded file or a public URL. " +
      "- blur_strength (number, optional): Blur intensity from 0 to 1. Defaults to 0.7. " +
      "- output_format (str, optional): 'png', 'jpg', or 'webp'. Defaults to 'png'.",
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

  defineTool(
    "remove_background",
    TOOL_META["remove_background"],
    "This tool will remove the background of an image, returning either a transparent result or a flat color fill. " +
      "It takes the following arguments: " +
      "- media_file or image_url (one required): The image to process, either an uploaded file or a public URL. " +
      "- output_transparent (bool, optional): If true, the removed background is transparent. Defaults to true. " +
      "- background_color (str, optional): Hex color to fill the background with when output_transparent is false. " +
      "- output_format (str, optional): 'png', 'jpg', or 'webp'. Defaults to 'png'.",
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

  defineTool(
    "portrait_enhance",
    TOOL_META["portrait_enhance"],
    "This tool will enhance a portrait photo, optionally sharpening the face and applying a depth-of-field background effect. " +
      "It takes the following arguments: " +
      "- media_file or image_url (one required): The image to process, either an uploaded file or a public URL. " +
      "- enhance_face (bool, optional): Apply face enhancement. Defaults to true. " +
      "- depth_effect (bool, optional): Apply a depth-of-field background effect. Defaults to true. " +
      "- output_format (str, optional): 'png', 'jpg', or 'webp'. Defaults to 'png'.",
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

  defineTool(
    "blur_faces",
    TOOL_META["blur_faces"],
    "This tool will detect and blur every face in an image or video. " +
      "It takes the following arguments: " +
      "- media_file or media_url (one required): The image/video to process, either an uploaded file or a public URL. " +
      "- media_type (str, required): 'image' or 'video'. " +
      "- blur_strength (number, optional): Blur intensity from 0 to 1. Defaults to 0.8. " +
      "- pixelated (bool, optional): Render as pixelation instead of a smooth blur. Defaults to false.",
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

  defineTool(
    "blur_license_plates",
    TOOL_META["blur_license_plates"],
    "This tool will detect and blur every license plate in an image or video. " +
      "It takes the following arguments: " +
      "- media_file or media_url (one required): The image/video to process, either an uploaded file or a public URL. " +
      "- media_type (str, required): 'image' or 'video'. " +
      "- blur_strength (number, optional): Blur intensity from 0 to 1. Defaults to 0.8. " +
      "- pixelated (bool, optional): Render as pixelation instead of a smooth blur. Defaults to false.",
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

  defineTool(
    "blur_video_background",
    TOOL_META["blur_video_background"],
    "This tool will blur the background of a video while keeping the foreground subject sharp. This is an asynchronous operation; use get_job_status with the returned job_id to retrieve the result. " +
      "It takes the following arguments: " +
      "- media_file or video_url (one required): The video to process, either an uploaded file or a public URL. " +
      "- blur_strength (number, optional): Blur intensity from 0 to 1. Defaults to 0.7. " +
      "- duration_seconds (number, optional): Limit processing to the first N seconds (max 3600).",
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

  defineTool(
    "remove_object_from_video",
    TOOL_META["remove_object_from_video"],
    "This tool will remove a named object from a video, inpainting the area it occupied. This is an asynchronous operation; use get_job_status with the returned job_id to retrieve the result. " +
      "It takes the following arguments: " +
      "- media_file or video_url (one required): The video to process, either an uploaded file or a public URL. " +
      "- object_text (str, required): Short description of the object to remove (e.g. 'person', 'car'). " +
      "- duration_seconds (number, optional): Limit processing to the first N seconds (max 60).",
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

  defineTool(
    "detect_nsfw",
    TOOL_META["detect_nsfw"],
    "This tool will scan an image or video and report whether it contains unsafe (NSFW) content. " +
      "It takes the following arguments: " +
      "- media_file or media_url (one required): The image/video to scan, either an uploaded file or a public URL. " +
      "- media_type (str, required): 'image' or 'video'.",
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

  defineTool(
    "blur_anything",
    TOOL_META["blur_anything"],
    "This tool will blur whatever you describe in a text prompt, anywhere it appears in an image or video (e.g. 'the red car' or 'all phone screens'). " +
      "It takes the following arguments: " +
      "- media_file or media_url (one required): The image/video to process, either an uploaded file or a public URL. " +
      "- media_type (str, required): 'image' or 'video'. " +
      "- prompt (str, required): Natural-language description of what to blur. " +
      "- blur_strength (number, optional): Blur intensity from 0 to 1. Defaults to 0.7. " +
      "- pixelated (bool, optional): Render as pixelation instead of a smooth blur. Defaults to false. " +
      "- pixelation_strength (number, optional): Pixelation block size when pixelated is true.",
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

  defineTool(
    "face_anonymization",
    TOOL_META["face_anonymization"],
    "This tool will anonymize every face in a video so people in it cannot be identified, while keeping the rest of the video unchanged. This is an asynchronous operation; use get_job_status with the returned job_id to retrieve the result. " +
      "It takes the following argument: " +
      "- media_file or video_url (one required): The video to process, either an uploaded file or a public URL.",
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

  defineTool(
    "get_job_status",
    TOOL_META["get_job_status"],
    "This tool will fetch the status and result of an asynchronous BGBlur job (returned by tools like blur_video_background, remove_object_from_video, or face_anonymization). " +
      "It takes the following argument: " +
      "- job_id (str, required): The job_id returned by the asynchronous tool call.",
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
