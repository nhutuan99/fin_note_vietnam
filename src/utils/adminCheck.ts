/**
 * Decode the admin email from the base64 env variable.
 * This avoids exposing the plaintext email in source code or
 * making it trivially searchable in the built JS bundle.
 */
const _decoded = import.meta.env.VITE_CONTACT_EMAIL_B64
  ? atob(import.meta.env.VITE_CONTACT_EMAIL_B64)
  : ''

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email || !_decoded) return false
  return email.toLowerCase() === _decoded.toLowerCase()
}
