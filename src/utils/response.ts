import { normalizeError } from "../errors.js";

export function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function errorText(error: unknown) {
  return jsonText(normalizeError(error));
}
