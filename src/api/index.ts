import type { MakeApi } from './client';
import { LocalApi } from './local/LocalApi';
import { SupabaseApi } from './supabase/SupabaseApi';

/**
 * The one API instance the app uses:
 * - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set: the ELUM platform on Supabase. Accounts are
 *   Supabase Auth users; designs live in the make schema (see supabase/README.md).
 * - neither: preview mode on your own computer, with everything kept in this browser. Netlify
 *   builds refuse to run this way (scripts/require-supabase.mjs).
 */
const env = import.meta.env;
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const api: MakeApi = supabaseUrl && supabaseKey ? new SupabaseApi(supabaseUrl, supabaseKey) : new LocalApi();

export * from './types';
export type { MakeApi, NotificationsApi } from './client';
export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './client';
export { ApiError, errorMessage, isApiError } from './errors';
