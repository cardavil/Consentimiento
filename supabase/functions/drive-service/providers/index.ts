import { google } from './google.ts';
import { microsoft } from './microsoft.ts';
import type { CloudProvider } from './types.ts';

export function get_provider(name: string): CloudProvider {
  if (name === 'google_workspace') return google;
  if (name === 'microsoft_365') return microsoft;
  throw new Error('PROVIDER_INVALID');
}
