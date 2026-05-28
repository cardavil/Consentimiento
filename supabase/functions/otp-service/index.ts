import { handle_cors } from '../_shared/cors.ts';
import { err } from '../_shared/response.ts';
import { handle_send } from './send.ts';
import { handle_register } from './register.ts';

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'send':
        return await handle_send(body);
      case 'register':
        return await handle_register(body, req);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'otp-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
