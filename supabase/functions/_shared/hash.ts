// SHA-256 hex of raw bytes (e.g. PDF integrity hash).
export async function sha256_bytes(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
