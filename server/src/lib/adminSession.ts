import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { designatedAdminEmail } from './adminAccess.js';

const SESSION_SECONDS = 8 * 60 * 60;
const ADMIN_ID = 'marketlink-admin';

interface AdminClaims {
  sub: typeof ADMIN_ID;
  email: string;
  exp: number;
  nonce: string;
}

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

function signature(value: string, password: string): Buffer {
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'marketlink-admin-session';
  const signingKey = createHmac('sha256', serverKey).update(`marketlink-admin:${password}`).digest();
  return createHmac('sha256', signingKey).update(value).digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAdminSession(email: string, password: string): { token: string; expiresAt: string } | null {
  const configured = configuredPassword();
  if (!configured || email.trim().toLowerCase() !== designatedAdminEmail()) return null;
  if (!safeEqual(Buffer.from(password), Buffer.from(configured))) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const claims: AdminClaims = {
    sub: ADMIN_ID,
    email: designatedAdminEmail(),
    exp: expiresAt,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const token = `${encoded}.${signature(encoded, configured).toString('base64url')}`;
  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export function verifyAdminSession(token: string): { email: string } | null {
  const configured = configuredPassword();
  if (!configured) return null;
  const [encoded, encodedSignature, extra] = token.split('.');
  if (!encoded || !encodedSignature || extra !== undefined) return null;

  let provided: Buffer;
  let claims: AdminClaims;
  try {
    provided = Buffer.from(encodedSignature, 'base64url');
    if (!safeEqual(signature(encoded, configured), provided)) return null;
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    claims = parsed as AdminClaims;
  } catch {
    return null;
  }

  if (
    claims.sub !== ADMIN_ID ||
    claims.email !== designatedAdminEmail() ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000) ||
    typeof claims.nonce !== 'string'
  ) return null;
  return { email: claims.email };
}
