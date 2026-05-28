import { handle_cors } from '../_shared/cors.ts';
import { err } from '../_shared/response.ts';
import { handle_oauth_start, handle_oauth_callback } from './oauth.ts';
import { handle_list_files, handle_get_status, handle_disconnect, handle_download_b64 } from './files.ts';

Deno.serve(async (req) => {
  const cors = handle_cors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'oauth_start':
        return await handle_oauth_start(body, req);
      case 'oauth_callback':
        return await handle_oauth_callback(body, req);
      case 'list_files':
        return await handle_list_files(body, req);
      case 'download_b64':
        return await handle_download_b64(body, req);
      case 'get_status':
        return await handle_get_status(body, req);
      case 'disconnect':
        return await handle_disconnect(body, req);
      default:
        return err('INVALID_ACTION');
    }
  } catch (e) {
    console.error({ fn: 'drive-service', error: (e as Error).message });
    return err('ERROR_SERVIDOR', 500);
  }
});
