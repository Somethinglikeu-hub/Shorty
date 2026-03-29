export class ShortyError extends Error {
  readonly recoverable: boolean;
  readonly step: string;
  readonly details?: string;

  constructor(step: string, message: string, recoverable = true, details?: string) {
    super(message);
    this.name = "ShortyError";
    this.step = step;
    this.recoverable = recoverable;
    this.details = details;
  }
}

export function toShortyError(error: unknown, step: string): ShortyError {
  if (error instanceof ShortyError) {
    return error;
  }

  if (error instanceof Error) {
    return new ShortyError(step, error.message, false);
  }

  return new ShortyError(step, "Bilinmeyen bir hata olustu.", false);
}

