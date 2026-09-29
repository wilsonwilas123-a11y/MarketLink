

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Spec 9.1's machine-readable code. The client branches on this, never on `message`. */
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  /** Prefixes every path. Overridable so tests need no server. */
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
  upload: <T>(path: string, file: File) => Promise<T>;
}


async function send(
  fetchImpl: typeof fetch,
  baseUrl: string,
  getToken: () => Promise<string | null>,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const token = await getToken();

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined || (typeof FormData !== 'undefined' && body instanceof FormData) ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : (typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body)),
    });
  } catch {
    // The server is unreachable. Not an ApiError from the envelope table: nothing answered.
    throw new ApiError(0, 'network_error', 'Cannot reach MarketLink. Check your connection.');
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = readEnvelope(payload);
    throw new ApiError(
      response.status,
      envelope?.code ?? 'internal',
      envelope?.message ?? `Request failed with status ${response.status}.`,
      envelope?.details,
    );
  }

  return payload;
}

interface Envelope {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Tolerant by necessity: a 502 from the dev proxy or a misconfigured deployment carries no
 * envelope at all, and the caller still needs a status and a code to branch on.
 */
function readEnvelope(payload: unknown): Envelope | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;

  const { code, message, details } = error as { code?: unknown; message?: unknown; details?: unknown };
  if (typeof code !== 'string' || typeof message !== 'string') return null;

  return { code, message, ...(details === undefined ? {} : { details }) };
}

export function createApi({ baseUrl = '/api', getToken, fetchImpl }: ApiOptions): ApiClient {
  const doFetch = fetchImpl ?? globalThis.fetch;

  const call = (method: string, path: string, body?: unknown) =>
    send(doFetch, baseUrl, getToken, method, path, body);

  return {
    get: (path) => call('GET', path) as Promise<never>,
    post: (path, body) => call('POST', path, body) as Promise<never>,
    put: (path, body) => call('PUT', path, body) as Promise<never>,
    patch: (path, body) => call('PATCH', path, body) as Promise<never>,
    delete: (path) => call('DELETE', path) as Promise<never>,
    upload: (path, file) => {
      const form = new FormData(); form.append('image', file);
      return call('POST', path, form) as Promise<never>;
    },
  };
}
