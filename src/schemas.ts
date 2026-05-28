import { z } from "zod";

export const outputFormatSchema = z.enum(["png", "jpg", "webp"]).default("png");
export const blurStrengthSchema = z.number().min(0).max(1).default(0.7);
export const strongBlurStrengthSchema = z.number().min(0).max(1).default(0.8);
export const mediaTypeSchema = z.enum(["image", "video"]);

export const blurBackgroundSchema = {
  image_url: z.string().url(),
  blur_strength: blurStrengthSchema,
  output_format: outputFormatSchema,
};

export const removeBackgroundSchema = {
  image_url: z.string().url(),
  output_transparent: z.boolean().default(true),
  background_color: z.string().optional(),
  output_format: outputFormatSchema,
};

export const portraitEnhanceSchema = {
  image_url: z.string().url(),
  enhance_face: z.boolean().default(true),
  depth_effect: z.boolean().default(true),
  output_format: outputFormatSchema,
};

export const blurFacesSchema = {
  media_url: z.string().url(),
  media_type: mediaTypeSchema,
  blur_strength: strongBlurStrengthSchema,
  pixelated: z.boolean().default(false),
};

export const blurLicensePlatesSchema = {
  media_url: z.string().url(),
  media_type: mediaTypeSchema,
  blur_strength: strongBlurStrengthSchema,
  pixelated: z.boolean().default(false),
};

export const blurVideoBackgroundSchema = {
  video_url: z.string().url(),
  blur_strength: blurStrengthSchema,
  duration_seconds: z.number().positive().max(3600).optional(),
};

export const removeObjectFromVideoSchema = {
  video_url: z.string().url(),
  object_text: z.string().min(1).max(40),
  duration_seconds: z.number().positive().max(60).optional(),
};

export const detectNsfwSchema = {
  media_url: z.string().url(),
  media_type: mediaTypeSchema,
};

export const getJobStatusSchema = {
  job_id: z.string().min(1),
};

export const uploadImageSchema = {
  file_path: z.string().min(1),
};

export const uploadVideoSchema = {
  file_path: z.string().min(1),
};

export const emptySchema = {};

export const blurAnythingSchema = {
  media_url: z.string().url(),
  media_type: mediaTypeSchema,
  prompt: z.string().min(1).max(520),
  blur_strength: blurStrengthSchema,
  pixelated: z.boolean().default(false),
  pixelation_strength: z.number().optional(),
};

export const faceAnonymizationSchema = {
  video_url: z.string().url(),
};
