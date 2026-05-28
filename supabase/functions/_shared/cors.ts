export const cors_headers: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-access-token, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function handle_cors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors_headers });
  }
  return null;
}
