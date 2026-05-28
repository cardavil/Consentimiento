import { cors_headers } from './cors.ts';

const json_headers = { ...cors_headers, 'Content-Type': 'application/json' };

export function ok(data: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ ok: true, data }),
    { status: 200, headers: json_headers },
  );
}

export function err(error: string, status = 400): Response {
  return new Response(
    JSON.stringify({ ok: false, error }),
    { status, headers: json_headers },
  );
}
