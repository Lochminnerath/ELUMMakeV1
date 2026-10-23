/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, such as https://abcd.supabase.co. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key. Safe in the browser; row level security protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Parent domain shared by every ELUM service, such as .elum.services. Shares one sign-in across them. */
  readonly VITE_ELUM_COOKIE_DOMAIN?: string;
  /** ELUM Account, such as https://accountsbyelum.netlify.app. Set, signing in and account changes go there. */
  readonly VITE_ELUM_ACCOUNT_URL?: string;
  /** Where ELUM Write is hosted. Defaults to https://writebyelum.netlify.app. */
  readonly VITE_ELUM_WRITE_URL?: string;
  /** Where ELUM Type is hosted. Defaults to https://typebyelum.netlify.app. */
  readonly VITE_ELUM_TYPE_URL?: string;
  /** Where Make itself is hosted. Defaults to https://makebyelum.netlify.app. */
  readonly VITE_ELUM_MAKE_URL?: string;
  readonly VITE_ELUM_BROWSE_URL?: string;
  /** Where ELUM Store is hosted. Defaults to https://storebyelum.netlify.app. */
  readonly VITE_ELUM_STORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
