import { handle_cors } from '../_shared/cors.ts';
import { err } from '../_shared/response.ts';
import { handle_get_config, handle_set_sms, handle_set_whatsapp, handle_test } from './config.ts';

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'get_config':
        return await handle_get_config(body, req);
      case 'set_sms':
        return await handle_set_sms(body, req);
      case 'set_whatsapp':
        return await handle_set_whatsapp(body, req);
      case 'test':
        return await handle_test(body, req);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'config-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
