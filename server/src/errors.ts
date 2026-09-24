/**
 * The API's error vocabulary (spec 9.1).
 *
 * Status is derived from the code rather than passed by the caller, because
 * `stock_unavailable` with a 200 or `not_found` with a 500 is the kind of bug that
 * survives a code review and only shows up when a client branches on the wrong thing.
 */
export const ERROR_STATUS = {
  validation_failed: 400,
  unauthenticated: 401,
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

  /**
   * What goes on the wire, matching spec 9.1 exactly. The request id travels in the
   * `x-request-id` header instead of the body so this shape stays as documented.
   */
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
