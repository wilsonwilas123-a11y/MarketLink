import { describe, expect, it } from 'vitest';
import { ERROR_STATUS, ApiError, isApiError } from '../src/errors.js';

describe('ApiError', () => {
  it('derives the status from the code, never from the caller', () => {
    expect(new ApiError('stock_unavailable', 'gone').status).toBe(409);
    expect(new ApiError('not_found', 'gone').status).toBe(404);
    expect(new ApiError('account_disabled', 'gone').status).toBe(403);
  });

  it('matches the table in spec 9.1 exactly', () => {
    expect(ERROR_STATUS).toEqual({
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
    });
  });

  it('omits details entirely rather than sending null', () => {
    expect(new ApiError('not_found', 'nope').toJSON()).toEqual({
      error: { code: 'not_found', message: 'nope' },
    });
    expect(
      new ApiError('stock_unavailable', 'few left', { available: 3, requested: 5 }).toJSON(),
    ).toEqual({
      error: {
        code: 'stock_unavailable',
        message: 'few left',
        details: { available: 3, requested: 5 },
      },
    });
  });

  it('survives the instanceof check across the middleware boundary', () => {
    expect(isApiError(new ApiError('internal', 'x'))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError('nope')).toBe(false);
  });
});
