import { ok, err } from '../_shared/response.ts';
import { create_admin_client } from '../_shared/supabase.ts';
import { validate_otp, generate_session } from './otp_check.ts';

export async function handle_verify(body: Record<string, unknown>): Promise<Response> {
  const email = (body.email as string || '').trim().toLowerCase();
  const code = (body.code as string || '').trim();

  if (!email || !code || code.length !== 6) return err('OTP_INVALID');

  const admin = create_admin_client();

  const result = await validate_otp(admin, email, code);
  if (!result.valid) return err(result.error_code!);

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('email', email)
    .single();

  if (!org) return err('OTP_INVALID');

  const session = await generate_session(admin, email);
  if (!session) return err('ERROR_SERVIDOR', 500);

  return ok(session);
}
