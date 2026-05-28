import { handle_cors } from '../_shared/cors.ts';
import { err } from '../_shared/response.ts';
import { handle_create_session } from './create_session.ts';
import { handle_sign } from './sign.ts';

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create_session':
        return await handle_create_session(body, req);
      case 'sign':
        return await handle_sign(body, req);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'consent-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
