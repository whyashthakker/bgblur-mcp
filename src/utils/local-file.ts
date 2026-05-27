import { basename, extname } from "node:path";

import { readFile, stat } from "node:fs/promises";

const mimeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

export async function readLocalUpload(filePath: string) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error("file_path must point to a file.");
  }

  const extension = extname(filePath).toLowerCase();
  const fileType = mimeByExtension[extension];
  if (!fileType) {
    throw new Error("Unsupported file extension.");
  }

  return {
    fileName: basename(filePath),
    fileType,
    fileSize: fileStat.size,
    data: await readFile(filePath),
  };
}
