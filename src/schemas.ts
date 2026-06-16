import { z } from "zod";

export const outputFormatSchema = z
  .enum(["png", "jpg", "webp"])
  .default("png")
  .describe("Output image format. One of 'png', 'jpg', or 'webp'. Defaults to 'png'.");

export const blurStrengthSchema = z
  .number()
  .min(0)
  .max(1)
  .default(0.7)
  .describe("Blur intensity from 0 (no blur) to 1 (maximum blur). Defaults to 0.7.");

export const strongBlurStrengthSchema = z
  .number()
  .min(0)
  .max(1)
  .default(0.8)
  .describe("Blur intensity from 0 (no blur) to 1 (maximum blur). Defaults to 0.8.");

export const mediaTypeSchema = z
  .enum(["image", "video"])
  .describe("Whether the input media is an 'image' or a 'video'.");

export const blurBackgroundSchema = {
  media_file: z.string().describe("Uploaded image file returned by upload_image. Use this or image_url.").optional(),
  image_url: z.string().url().describe("Public URL of the image to process. Use this or media_file.").optional(),
  blur_strength: blurStrengthSchema,
  output_format: outputFormatSchema,
};

export const removeBackgroundSchema = {
  media_file: z.string().describe("Uploaded image file returned by upload_image. Use this or image_url.").optional(),
  image_url: z.string().url().describe("Public URL of the image to process. Use this or media_file.").optional(),
  output_transparent: z
    .boolean()
    .default(true)
    .describe("If true, the removed background is transparent. If false, fill it with background_color. Defaults to true."),
  background_color: z
    .string()
    .optional()
    .describe("Hex color (e.g. '#ffffff') to fill the background with when output_transparent is false."),
  output_format: outputFormatSchema,
};

export const portraitEnhanceSchema = {
  media_file: z.string().describe("Uploaded image file returned by upload_image. Use this or image_url.").optional(),
  image_url: z.string().url().describe("Public URL of the image to process. Use this or media_file.").optional(),
  enhance_face: z.boolean().default(true).describe("If true, apply face enhancement. Defaults to true."),
  depth_effect: z.boolean().default(true).describe("If true, apply a depth-of-field background effect. Defaults to true."),
  output_format: outputFormatSchema,
};

export const blurFacesSchema = {
  media_file: z.string().describe("Uploaded image/video file returned by upload_image or upload_video. Use this or media_url.").optional(),
  media_url: z.string().url().describe("Public URL of the image/video to process. Use this or media_file.").optional(),
  media_type: mediaTypeSchema,
  blur_strength: strongBlurStrengthSchema,
  pixelated: z.boolean().default(false).describe("If true, render the blur as visible pixelation instead of a smooth blur. Defaults to false."),
};

export const blurLicensePlatesSchema = {
  media_file: z.string().describe("Uploaded image/video file returned by upload_image or upload_video. Use this or media_url.").optional(),
  media_url: z.string().url().describe("Public URL of the image/video to process. Use this or media_file.").optional(),
  media_type: mediaTypeSchema,
  blur_strength: strongBlurStrengthSchema,
  pixelated: z.boolean().default(false).describe("If true, render the blur as visible pixelation instead of a smooth blur. Defaults to false."),
};

export const blurVideoBackgroundSchema = {
  media_file: z.string().describe("Uploaded video file returned by upload_video. Use this or video_url.").optional(),
  video_url: z.string().url().describe("Public URL of the video to process. Use this or media_file.").optional(),
  blur_strength: blurStrengthSchema,
  duration_seconds: z
    .number()
    .positive()
    .max(3600)
    .optional()
    .describe("Limit processing to the first N seconds of the video (max 3600). Omit to process the full video."),
};

export const removeObjectFromVideoSchema = {
  media_file: z.string().describe("Uploaded video file returned by upload_video. Use this or video_url.").optional(),
  video_url: z.string().url().describe("Public URL of the video to process. Use this or media_file.").optional(),
  object_text: z.string().min(1).max(40).describe("Short text description of the object to remove (e.g. 'person', 'car', 'logo'). 1-40 characters."),
  duration_seconds: z
    .number()
    .positive()
    .max(60)
    .optional()
    .describe("Limit processing to the first N seconds of the video (max 60). Omit to process the full video."),
};

export const detectNsfwSchema = {
  media_file: z.string().describe("Uploaded image/video file returned by upload_image or upload_video. Use this or media_url.").optional(),
  media_url: z.string().url().describe("Public URL of the image/video to scan. Use this or media_file.").optional(),
  media_type: mediaTypeSchema,
};

export const getJobStatusSchema = {
  job_id: z.string().min(1).describe("The job_id returned by an asynchronous BGBlur tool call (e.g. a video job)."),
};

export const uploadImageSchema = {
  file_path: z.string().min(1).describe("Absolute local file path to the image to upload (e.g. '/Users/me/Downloads/photo.png')."),
};

export const uploadVideoSchema = {
  file_path: z.string().min(1).describe("Absolute local file path to the video to upload (e.g. '/Users/me/Downloads/clip.mp4')."),
};

export const emptySchema = {};

export const blurAnythingSchema = {
  media_file: z.string().describe("Uploaded image/video file returned by upload_image or upload_video. Use this or media_url.").optional(),
  media_url: z.string().url().describe("Public URL of the image/video to process. Use this or media_file.").optional(),
  media_type: mediaTypeSchema,
  prompt: z.string().min(1).max(520).describe("Natural-language description of what to blur (e.g. 'the red car' or 'all phone screens'). 1-520 characters."),
  blur_strength: blurStrengthSchema,
  pixelated: z.boolean().default(false).describe("If true, render the blur as visible pixelation instead of a smooth blur. Defaults to false."),
  pixelation_strength: z
    .number()
    .optional()
    .describe("Pixelation block size when pixelated is true. Higher values produce larger, blockier pixels."),
};

export const faceAnonymizationSchema = {
  media_file: z.string().describe("Uploaded video file returned by upload_video. Use this or video_url.").optional(),
  video_url: z.string().url().describe("Public URL of the video to process. Use this or media_file.").optional(),
};
