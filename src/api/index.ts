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
// ELUM runs on one Supabase project, so every build connects to it unless told otherwise. The
// address and publishable key are public (the database's row-level security protects the data).
// Browser-only preview mode is used only in tests, or when VITE_ELUM_PREVIEW=true on purpose.
const ELUM_SUPABASE_URL = 'https://afdnnvngrpdodsfwpaqo.supabase.co';
const ELUM_SUPABASE_KEY = 'sb_publishable_0o6tXC51UwLFHi8j8d9zcQ_xeB1eKyz';
const browserOnly = env.MODE === 'test' || env.VITE_ELUM_PREVIEW === 'true';
const supabaseUrl = browserOnly ? null : env.VITE_SUPABASE_URL?.trim() || ELUM_SUPABASE_URL;
const supabaseKey = browserOnly ? null : env.VITE_SUPABASE_ANON_KEY?.trim() || ELUM_SUPABASE_KEY;

export const api: MakeApi = supabaseUrl && supabaseKey ? new SupabaseApi(supabaseUrl, supabaseKey) : new LocalApi();

export * from './types';
export type { MakeApi, NotificationsApi } from './client';
export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './client';
export { ApiError, errorMessage, isApiError } from './errors';
