import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create_anon_client } from '../_shared/supabase.ts';

const encoder = new TextEncoder();

export function generate_otp(length = 6): string {
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

export async function validate_otp(
  admin: SupabaseClient,
  email: string,
  code: string,
): Promise<OtpResult> {
  const { data: token } = await admin
    .from('otp_tokens')
    .select('id, code_hash, attempts')
    .eq('email', email)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) return { valid: false, error_code: 'OTP_EXPIRED' };
  if (token.attempts >= 5) return { valid: false, error_code: 'OTP_MAX_ATTEMPTS' };

  const submitted_hash = await hash_code(code);

  if (submitted_hash !== token.code_hash) {
    await admin
      .from('otp_tokens')
      .update({ attempts: token.attempts + 1 })
      .eq('id', token.id);
    return { valid: false, error_code: 'OTP_INVALID' };
  }

  await admin
    .from('otp_tokens')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', token.id);

  return { valid: true, token_id: token.id };
}

export async function generate_session(
  admin: SupabaseClient,
  email: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const { data: link_data, error: link_err } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (link_err || !link_data) {
    console.error({ fn: 'generate_session', error: link_err?.message, email });
    return null;
  }

  const anon = create_anon_client();
  const { data: session_data, error: session_err } = await anon.auth.verifyOtp({
    token_hash: link_data.properties.hashed_token,
    type: 'magiclink',
  });

  if (session_err || !session_data?.session) {
    console.error({ fn: 'generate_session', error: session_err?.message, email });
    return null;
  }

  return {
    access_token: session_data.session.access_token,
    refresh_token: session_data.session.refresh_token,
  };
}
