
export const ERROR_STATUS = {
  validation_failed: 400,
  unauthenticated: 401,
  // A valid token whose account has not finished bootstrap. Its own code because the
  // client's response differs: `unauthenticated` signs out, this one shows the details form.
  profile_missing: 401,
  forbidden: 403,
  account_disabled: 403,
  farmer_not_approved: 403,
  not_found: 404,
  stock_unavailable: 409,
  cutoff_passed: 409,
  invalid_transition: 409,
  already_reviewed: 409,
  rate_limited: 429,
  internal: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = ERROR_STATUS[code];
  }


  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
