import { handle_cors } from '../_shared/cors.ts';
import { err } from '../_shared/response.ts';
import { handle_create_template } from './create_template.ts';
import { handle_create_session } from './create_session.ts';
import { handle_sign } from './sign.ts';
import { handle_get_document } from './get_document.ts';
import { handle_get_channels } from './get_channels.ts';

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create_template':
        return await handle_create_template(body, req);
      case 'create_session':
        return await handle_create_session(body, req);
      case 'sign':
        return await handle_sign(body, req);
      case 'get_document':
        return await handle_get_document(body, req);
      case 'get_channels':
        return await handle_get_channels(body, req);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'signing-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
