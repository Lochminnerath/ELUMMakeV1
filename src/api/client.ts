import type {
  AppNotification,
  Design,
  DesignContent,
  DesignSummary,
  NewDesignInput,
  PublicUser,
  SaveResult,
  Session,
  Share,
  ShareRole,
  SignInInput,
  SignUpInput,
  User,
} from './types';

/** The contract every Make backend fulfils: Supabase in production, the browser in preview. */
export interface MakeApi {
  /** `remote` for the ELUM platform on Supabase, `local` for in-browser preview mode. */
  readonly mode: 'remote' | 'local';

  // Accounts. Supabase Auth holds them; public.profiles holds what other people see.
  restoreSession(): Promise<Session | null>;
  signUp(input: SignUpInput): Promise<Session>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  updateProfile(input: { name: string }): Promise<User>;
  /** Calls back when the session ends (expired, revoked, signed out in another tab). */
  onUnauthorized(handler: () => void): () => void;

  // Confirming an email. Only on Supabase, where accounts confirm by link.
  resendConfirmation?(email: string): Promise<void>;
  /** Why the confirmation link that opened the app did not work, if it did not. Read once. */
  takeLinkProblem?(): string | null;

  // ELUM Type addresses. Only on Supabase, where type-signup creates them.
  typeDomain?(): Promise<string>;
  handleAvailable?(handle: string): Promise<boolean>;

  // Signing in across ELUM apps through ELUM Account. Only on Supabase.
  handoff?(to: string, next: string): Promise<string>;
  completeHandoff?(tokenHash: string): Promise<Session>;

  /** Notifications from every ELUM service. Only on Supabase. */
  readonly notifications?: NotificationsApi;

  // Designs
  listDesigns(): Promise<DesignSummary[]>;
  createDesign(input?: NewDesignInput): Promise<DesignSummary>;
  getDesign(id: string): Promise<Design>;
  /** Saves when `version` is still current; otherwise fails with `conflict`. */
  saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult>;
  renameDesign(id: string, title: string): Promise<void>;
  resizeDesign(id: string, width: number, height: number): Promise<void>;
  duplicateDesign(id: string): Promise<DesignSummary>;
  /** Owners delete the design; anyone else leaves it. */
  deleteDesign(id: string): Promise<void>;

  // Sharing
  listShares(id: string): Promise<Share[]>;
  share(id: string, email: string, role: ShareRole): Promise<Share>;
  unshare(id: string, userId: string): Promise<void>;
  findPeople(query: string): Promise<PublicUser[]>;

  // Pictures
  /** Stores a picture for a design and returns the `src` to put on an image element. */
  uploadImage(designId: string, file: File): Promise<string>;
  /** Turns an element's `src` into a URL the browser can load. */
  imageUrl(src: string): Promise<string>;
}

export interface NotificationsApi {
  list(options?: { before?: string; unreadOnly?: boolean; limit?: number }): Promise<AppNotification[]>;
  /** Marks these as read, or all of them. */
  markRead(ids?: string[]): Promise<void>;
  /** Calls back when a new notification arrives. Returns an unsubscribe function. */
  subscribe(onNew: (n: AppNotification) => void): () => void;
}

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
