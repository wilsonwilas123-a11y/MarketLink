import { ErrorRef } from './schemas.js';

/** A `content` map pointing at a registered component. */
export function json(ref: { $ref: string }) {
  return { 'application/json': { schema: ref } };
}

/**
 * One error entry in a route's `responses` block. Every failure in this API carries the
 * same envelope (spec 9.1), so a route documents only why it fails, never what shape.
 */
export function error(description: string) {
  return { description, content: json(ErrorRef) };
}
