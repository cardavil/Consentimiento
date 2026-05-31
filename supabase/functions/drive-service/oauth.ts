import { ok, err } from '../_shared/response.ts';
import { require_tenant } from '../_shared/auth.ts';
import { get_provider } from './providers/index.ts';
import { encrypt_secret } from './connection.ts';
import { HISTORY_HEADER } from '../_shared/history.ts';

function redirect_uri(): string {
  return `${Deno.env.get('OAUTH_REDIRECT_BASE')}/onboarding.html`;
}

// Step 1: return the provider's consent URL. The frontend opens it; the provider
// redirects back to onboarding.html with ?code & ?state.
export async function handle_oauth_start(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const provider_name = body.provider as string;
  let provider;
  try {
    provider = get_provider(provider_name);
  } catch {
    return err('PROVIDER_INVALID');
  }

  const state = `${provider_name}:${crypto.randomUUID()}`;
  return ok({ auth_url: provider.auth_url(redirect_uri(), state), state });
}

// Step 2: exchange the code, set up folder + history sheet, store encrypted tokens.
export async function handle_oauth_callback(body: Record<string, unknown>, req: Request): Promise<Response> {
  const ctx = await require_tenant(req);
  if (!ctx) return err('NO_AUTORIZADO', 401);

  const provider_name = body.provider as string;
  const code = body.code as string;
  if (!code) return err('CODE_REQUERIDO');

  let provider;
  try {
    provider = get_provider(provider_name);
  } catch {
    return err('PROVIDER_INVALID');
  }

  try {
    const tokens = await provider.exchange_code(code, redirect_uri());
    const sender_email = await provider.account_email(tokens.access_token);
    const folder_id = await provider.ensure_folder(tokens.access_token, 'Consentia');
    const year = new Date().getUTCFullYear();
    const sheet_id = await provider.ensure_sheet(tokens.access_token, folder_id, `Historial-${year}`);
    // Write the column header on the freshly created History sheet (best-effort).
    try { await provider.append_sheet_row(tokens.access_token, sheet_id, HISTORY_HEADER); } catch (_e) { /* header is non-critical */ }

    const row: Record<string, unknown> = {
      tenant_id: ctx.tenant_id,
      provider: provider_name,
      access_token: await encrypt_secret(ctx.admin, tokens.access_token),
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      last_refreshed_at: new Date().toISOString(),
      drive_folder_id: folder_id,
      history_sheet_id: sheet_id,
      history_sheets: { [year]: sheet_id },
      sender_email,
    };
    if (tokens.refresh_token) {
      row.refresh_token = await encrypt_secret(ctx.admin, tokens.refresh_token);
    }

    const { error: upsert_err } = await ctx.admin
      .from('tenant_oauth')
      .upsert(row, { onConflict: 'tenant_id' });
    if (upsert_err) {
      console.error({ fn: 'oauth_callback', error: upsert_err.message });
      return err('ERROR_SERVIDOR', 500);
    }

    await ctx.admin.from('audit_log').insert({
      tenant_id: ctx.tenant_id,
      event_type: 'tenant_oauth_connected',
      event_data: { provider: provider_name },
    });

    return ok({ provider: provider_name, sender_email, folder_id });
  } catch (e) {
    console.error({ fn: 'oauth_callback', error: (e as Error).message });
    return err('OAUTH_FALLIDO', 502);
  }
}
