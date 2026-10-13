/** Only a definitive authentication rejection ends a session.
 * Unknown/transport/provider failures still deny the operation, but are retryable.
 * Never classify failures by a free-form error message or log tokens.
 */
export function isDefinitiveAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; code?: string; name?: string };
  if (e.status !== undefined && (e.status >= 500 || e.status === 408 || e.status === 429)) return false;
  if (e.status === 401 || e.status === 403) return true;
  return e.name === 'AuthSessionMissingError' || new Set([
    'bad_jwt', 'jwt_expired', 'session_not_found', 'refresh_token_not_found',
    'refresh_token_already_used', 'user_not_found', 'user_banned', 'PGRST301', 'PGRST303', '42501',
  ]).has(e.code || '');
}
