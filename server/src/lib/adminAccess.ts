export const DEFAULT_ADMIN_EMAIL = 'wilsontechtechy@gmail.com';

export function designatedAdminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export function isDesignatedAdmin(email: string | null | undefined): boolean {
  return Boolean(email?.trim()) && email!.trim().toLowerCase() === designatedAdminEmail();
}
