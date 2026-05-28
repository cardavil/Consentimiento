// Loads an org's cloud connection: decrypts the access token (pgcrypto via RPC),
// refreshes it if expired, and returns a ready-to-use provider + token.
// Reused by drive-service, otp-service (signer OTP) and consent-service (sign).
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { get_provider } from './providers/index.ts';
import type { CloudProvider } from './providers/types.ts';

const enc_key = () => Deno.env.get('ENCRYPTION_KEY')!;

export async function encrypt_secret(admin: SupabaseClient, plaintext: string): Promise<string> {
  const { data, error } = await admin.rpc('encrypt_secret', { p_plaintext: plaintext, p_key: enc_key() });
  if (error) throw new Error(`encrypt_failed: ${error.message}`);
  return data as string;
}

export async function decrypt_secret(admin: SupabaseClient, ciphertext: string): Promise<string> {
  const { data, error } = await admin.rpc('decrypt_secret', { p_ciphertext: ciphertext, p_key: enc_key() });
  if (error) throw new Error(`decrypt_failed: ${error.message}`);
  return data as string;
}

export interface OrgConnection {
  provider: CloudProvider;
  access_token: string;
  drive_folder_id: string | null;
  history_sheet_id: string | null;
  history_sheets: Record<string, string>;
  sender_email: string | null;
}

export async function get_org_connection(
  admin: SupabaseClient,
  organization_id: string,
): Promise<OrgConnection | null> {
  const { data: row } = await admin
    .from('org_oauth')
    .select('*')
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (!row) return null;

  const provider = get_provider(row.provider);
  let access_token = await decrypt_secret(admin, row.access_token);

  const expires_soon = !row.token_expires_at ||
    new Date(row.token_expires_at).getTime() <= Date.now() + 60_000;

  if (expires_soon && row.refresh_token) {
    const refresh_token = await decrypt_secret(admin, row.refresh_token);
    const fresh = await provider.refresh(refresh_token);
    access_token = fresh.access_token;

    const update: Record<string, unknown> = {
      access_token: await encrypt_secret(admin, fresh.access_token),
      token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      last_refreshed_at: new Date().toISOString(),
    };
    if (fresh.refresh_token) {
      update.refresh_token = await encrypt_secret(admin, fresh.refresh_token);
    }
    await admin.from('org_oauth').update(update).eq('organization_id', organization_id);
  }

  return {
    provider,
    access_token,
    drive_folder_id: row.drive_folder_id,
    history_sheet_id: row.history_sheet_id,
    history_sheets: row.history_sheets || {},
    sender_email: row.sender_email,
  };
}
