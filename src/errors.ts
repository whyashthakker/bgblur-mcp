export class BgblurApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BgblurApiError";
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof BgblurApiError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: "request_failed",
        message: error.message,
      },
    };
  }

  return {
    success: false,
    error: {
      code: "request_failed",
      message: "BGBlur request failed.",
    },
  };
}
