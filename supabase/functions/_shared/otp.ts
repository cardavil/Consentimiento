import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MAX_OTP_ATTEMPTS } from './limits.ts';

const encoder = new TextEncoder();

export function generate_otp(length = 8): string {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);
  return Array.from(digits, (d) => (d % 10).toString()).join('');
}

export async function hash_code(code: string): Promise<string> {
  const data = encoder.encode(code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

interface OtpResult {
  valid: boolean;
  error_code?: string;
  token_id?: string;
}

// Validates the most recent unverified, unexpired OTP for an email/purpose.
export async function validate_otp(
  admin: SupabaseClient,
  email: string,
  code: string,
  purpose?: string,
): Promise<OtpResult> {
  let query = admin
    .from('otp_tokens')
    .select('id, code_hash, attempts')
    .eq('email', email)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString());
  if (purpose) query = query.eq('purpose', purpose);

  const { data: token } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) return { valid: false, error_code: 'OTP_EXPIRED' };
  if (token.attempts >= MAX_OTP_ATTEMPTS) return { valid: false, error_code: 'OTP_MAX_ATTEMPTS' };

  const submitted_hash = await hash_code(code);

  if (submitted_hash !== token.code_hash) {
    await admin.from('otp_tokens').update({ attempts: token.attempts + 1 }).eq('id', token.id);
    return { valid: false, error_code: 'OTP_INVALID' };
  }

  await admin.from('otp_tokens').update({ verified_at: new Date().toISOString() }).eq('id', token.id);
  return { valid: true, token_id: token.id };
}
