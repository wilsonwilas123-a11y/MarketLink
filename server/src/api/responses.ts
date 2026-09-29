import { ErrorRef } from './schemas.js';

/** A `content` map pointing at a registered component. */
export function json(ref: { $ref: string }) {
  return { 'application/json': { schema: ref } };
}


export function error(description: string) {
  return { description, content: json(ErrorRef) };
}
