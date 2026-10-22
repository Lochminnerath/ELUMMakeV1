import { createClient, type Session as AuthSession, type SupabaseClient } from '@supabase/supabase-js';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, type MakeApi, type NotificationsApi } from '../client';
import { ApiError } from '../errors';
import type {
  AppNotification,
  BrandKit,
  BrandKitAsset,
  Comment,
  DesignTemplate,
  DesignVersion,
  Favorite,
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
} from '../types';
import { checkSignUp, cleanName, cleanTitle, handleProblem, isEmail, MIN_PASSWORD } from '../validation';
import { cookieStorage, usableCookieDomain } from './cookieStorage';
import { PENDING_ROLE, tokenRole } from '../../security/approvals';

/**
 * ELUM Make on the ELUM platform (Supabase):
 * - Auth: Supabase Auth holds every account (Authentication > Users). A database trigger gives
 *   each new account a public.profiles row, which is what other people see.
 * - Designs: the make schema, reached only through the public.make_* functions, which check who
 *   may see and change what (supabase/migrations).
 * - Pictures: the private make-images bucket, one folder per design, read through signed links.
 */

const BUCKET = 'make-images';
const STORAGE_PREFIX = 'storage:';
const SIGNED_URL_SECONDS = 60 * 60;
const PROFILE = 'id, name, email, color, account_type, created_at';
/** Where Type addresses live when the database cannot say. */
const DEFAULT_TYPE_DOMAIN = 'type.elum.services';

interface ProfileRow extends PublicUser {
  account_type: 'type' | 'external' | null;
  created_at: string;
}

/** What Supabase and PostgREST put in their errors. */
interface RawError {
  code?: string;
  message?: string;
  details?: string | null;
  status?: number;
  statusCode?: string | number;
  name?: string;
}

/** Translates Supabase errors into the app's error codes and plain messages. */
export function toApiError(error: RawError | null | undefined, fallback = 'Something went wrong. Please try again.'): ApiError {
  const code = String(error?.code ?? '');
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const message = error?.message ?? '';
  // Make's own database functions raise PostgREST status codes with readable messages.
  if (code === 'PT409') return new ApiError('conflict', message, { version: Number(error?.details) });
  if (code === 'PT403') return new ApiError('forbidden', message);
  if (code === 'PT404') return new ApiError('not_found', message);
  if (code === 'PT400') return new ApiError('invalid', message);
  if (code === 'PT429' || status === 429) return new ApiError('rate_limited', message || 'Too many requests. Wait a little and try again.');
  if (code === 'PT401' || code === 'PGRST301' || code === 'PGRST303' || status === 401) {
    return new ApiError('unauthorized', 'Your session has ended. Sign in again.');
  }
  if (code === '42501' || status === 403) return new ApiError('forbidden', 'You do not have permission to do that.');
  if (code === 'PGRST202' || code === '42883') {
    return new ApiError('server', 'Make is not set up in this database yet. Run the Make migration (supabase/README.md).');
  }
  if (code === '22P02') return new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
  if (status === 413 || /exceeded the maximum allowed size/i.test(message)) return new ApiError('too_large', 'Pictures can be up to 15 MB.');
  if (error?.name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(message)) {
    return new ApiError('network', 'We could not reach ELUM. Check your connection and try again.');
  }
  return new ApiError('server', fallback);
}

/** The error an edge function answered with, such as type-signup's "That name is taken." */
async function functionError(error: unknown): Promise<ApiError> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as { error?: { code?: string; message?: string; details?: { field?: string } } };
      const message = body.error?.message ?? 'Something went wrong. Please try again.';
      switch (body.error?.code) {
        case 'conflict':
          return new ApiError('conflict', message, { field: 'handle' });
        case 'invalid':
          return new ApiError('invalid', message, body.error.details?.field ? { field: body.error.details.field } : undefined);
        case 'rate_limited':
          return new ApiError('rate_limited', message);
        case 'forbidden':
          return new ApiError('forbidden', message);
        default:
          return new ApiError('server', message);
      }
    } catch {
      // Fall through.
    }
  }
  return new ApiError('network', 'ELUM Type sign-up is not reachable. Check that the type-signup function is deployed.');
}

export class SupabaseApi implements MakeApi {
  readonly mode = 'remote' as const;
  readonly sb: SupabaseClient;
  private readonly unauthorizedHandlers = new Set<() => void>();
  private readonly signedUrls = new Map<string, { url: string; expires: number }>();
  private linkProblem: string | null = null;
  private domainLookup: Promise<string> | null = null;

  constructor(url: string, anonKey: string, client?: SupabaseClient) {
    // With VITE_ELUM_COOKIE_DOMAIN set (such as .elum.services), the session lives in cookies on
    // that domain, so one sign-in covers every ELUM service. Otherwise it stays in this site's storage.
    const cookieDomain = typeof location === 'undefined' ? null : usableCookieDomain(import.meta.env.VITE_ELUM_COOKIE_DOMAIN, location.hostname);
    this.sb =
      client ??
      createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          ...(cookieDomain ? { storageKey: 'elum-auth', storage: cookieStorage({ domain: cookieDomain, secure: location.protocol === 'https:' }) } : {}),
        },
      });
    // A confirmation link that failed (expired, or already used) lands here with the reason in the
    // address. Keep it to show on the sign-in page.
    if (typeof location !== 'undefined' && /error_description=/.test(location.hash + location.search)) {
      const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
      const code = params.get('error_code');
      this.linkProblem =
        code === 'otp_expired'
          ? 'That confirmation link has expired or was already used. Sign in, or send yourself a new link.'
          : params.get('error_description')?.replace(/\+/g, ' ') ?? 'That link did not work. Try signing in.';
    }
    this.sb.auth.onAuthStateChange((event) => {
      // Covers expiry, revocation and signing out in another tab.
      if (event === 'SIGNED_OUT') {
        this.signedUrls.clear();
        this.unauthorizedHandlers.forEach((h) => h());
      }
    });
  }

  onUnauthorized(handler: () => void): () => void {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  }

  /** Database calls, with errors turned into ApiErrors (and a lost session reported once). */
  private async rpc<T>(name: string, args?: Record<string, unknown>, fallback?: string): Promise<T> {
    const { data, error } = await this.sb.rpc(name, args);
    if (error) {
      const e = toApiError(error, fallback);
      if (e.code === 'unauthorized') this.unauthorizedHandlers.forEach((h) => h());
      throw e;
    }
    return data as T;
  }

  // ---------------------------------------------------------------- accounts

  async restoreSession(): Promise<Session | null> {
    const { data, error } = await this.sb.auth.getSession();
    if (error || !data.session) return null;
    try {
      return await this.sessionFor(data.session);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return null;
      throw e;
    }
  }

  async signUp(input: SignUpInput): Promise<Session> {
    if (input.accountType === 'type') return this.signUpType(input);
    const { name, email, password } = checkSignUp(input);
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      if (error.code === 'user_already_exists' || error.code === 'email_exists') {
        throw new ApiError('email_taken', 'An account with this email already exists. Sign in instead.', { field: 'email' });
      }
      if (error.code === 'weak_password') throw new ApiError('invalid', error.message, { field: 'password' });
      // Supabase keeps the account only once the confirmation email is sent. Its built-in sender
      // only reaches the project's own team, so without an SMTP sender other sign-ups are dropped.
      if (/sending.*email|email.*send/i.test(error.message ?? '') || error.code === 'unexpected_failure') {
        throw new ApiError('server', 'We could not send your confirmation email, so the account was not created. ELUM email is not set up yet (Supabase > Authentication > Emails > SMTP Settings).');
      }
      if (error.code === 'signup_disabled') throw new ApiError('forbidden', 'New accounts are switched off right now (Supabase > Authentication > Sign In / Providers).');
      if (error.code === 'email_address_invalid') throw new ApiError('invalid', 'Enter a valid email address.', { field: 'email' });
      if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
        throw new ApiError('rate_limited', 'Too many attempts. Wait a minute and try again.');
      }
      throw toApiError(error);
    }
    // With email confirmation on, there is no session until the link is followed.
    if (!data.session) {
      throw new ApiError('confirm_email', `We sent a link to ${email}. Open it to confirm your email, then sign in.`);
    }
    return this.sessionFor(data.session);
  }

  /**
   * A new ELUM Type address. Only the server may create one (it is verified by construction and
   * sets account_type and handle), so the type-signup function makes the account; then we sign in.
   */
  private async signUpType(input: SignUpInput): Promise<Session> {
    const name = cleanName(input.name);
    const handle = (input.handle ?? '').trim().toLowerCase();
    const problem = handleProblem(handle);
    if (problem) throw new ApiError('invalid', problem, { field: 'handle' });
    if (input.password.length < MIN_PASSWORD) {
      throw new ApiError('invalid', `Use at least ${MIN_PASSWORD} characters for your password.`, { field: 'password' });
    }
    const recoveryEmail = input.recoveryEmail?.trim() || undefined;
    if (recoveryEmail && !isEmail(recoveryEmail)) {
      throw new ApiError('invalid', 'Enter a valid recovery email, or leave it empty.', { field: 'recoveryEmail' });
    }
    const { data, error } = await this.sb.functions.invoke<{ error?: RawError }>('type-signup', {
      body: { handle, name, password: input.password, recoveryEmail },
    });
    if (error) throw await functionError(error);
    if (data?.error) throw toApiError(data.error);
    return this.signIn({ email: handle, password: input.password });
  }

  /** The domain Type addresses live on, from the database (elum.config type_domain). */
  typeDomain(): Promise<string> {
    this.domainLookup ??= Promise.resolve(this.sb.rpc('type_domain')).then(
      ({ data }) => (typeof data === 'string' && data ? data : DEFAULT_TYPE_DOMAIN),
      () => DEFAULT_TYPE_DOMAIN,
    );
    return this.domainLookup;
  }

  async handleAvailable(handle: string): Promise<boolean> {
    if (handleProblem(handle)) return false;
    return (await this.rpc<boolean>('elum_handle_available', { p_handle: handle.trim().toLowerCase() })) === true;
  }

  takeLinkProblem(): string | null {
    const problem = this.linkProblem;
    this.linkProblem = null;
    return problem;
  }

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await this.sb.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/` } });
    if (error) {
      if (error.status === 429) throw new ApiError('rate_limited', 'A link was sent a moment ago. Wait a minute and try again.');
      throw toApiError(error);
    }
  }

  async signIn(input: SignInInput): Promise<Session> {
    // A Type address can be typed as just its name.
    const login = input.email.trim().toLowerCase();
    const email = login.includes('@') ? login : `${login}@${await this.typeDomain()}`;
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: input.password });
    if (error) {
      if (error.code === 'email_not_confirmed') {
        throw new ApiError('confirm_email', 'Confirm your email first. We sent you a link when you signed up.');
      }
      if (error.code === 'invalid_credentials' || error.status === 400) {
        throw new ApiError('invalid_credentials', 'That email and password do not match.');
      }
      throw toApiError(error);
    }
    return this.sessionFor(data.session);
  }

  async signOut(): Promise<void> {
    this.signedUrls.clear();
    await this.sb.auth.signOut();
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const me = await this.me();
    const { data, error } = await this.sb.from('profiles').update({ name: cleanName(input.name) }).eq('id', me).select(PROFILE).single<ProfileRow>();
    if (error) throw toApiError(error);
    return { ...toUser(data), pictureUrl: await this.pictureUrl(data.id) };
  }

  private async me(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) {
      this.unauthorizedHandlers.forEach((h) => h());
      throw new ApiError('unauthorized', 'Your session has ended. Sign in again.');
    }
    return id;
  }

  private async sessionFor(session: AuthSession): Promise<Session> {
    // Waiting for approval from another device (ELUM Account > Security): nothing else answers it.
    if (tokenRole(session.access_token) === PENDING_ROLE) {
      throw new ApiError('approval_required', 'Approve this sign-in on a device you are already signed in to.');
    }
    const profile = await this.profileFor(session.user.id);
    // Tell the platform this account uses Make. Optional: older databases lack the function.
    void this.sb.rpc('elum_join_service', { p_service: 'make' }).then(() => undefined, () => undefined);
    return { user: { ...toUser(profile), pictureUrl: await this.pictureUrl(profile.id) } };
  }

  /**
   * The person's profile. An account Supabase Auth knows but the profile trigger missed gets one
   * made now (elum_ensure_profile), so it can always sign in.
   */
  private async profileFor(id: string): Promise<ProfileRow> {
    const load = () => this.sb.from('profiles').select(PROFILE).eq('id', id).maybeSingle<ProfileRow>();
    let { data, error } = await load();
    if (error) throw toApiError(error);
    if (!data) {
      const made = await this.sb.rpc('elum_ensure_profile');
      if (made.error) {
        throw new ApiError('server', 'Your account is missing its profile. Run the latest database migrations (profile_for_every_account), then sign in again.');
      }
      ({ data, error } = await load());
      if (error) throw toApiError(error);
      if (!data) throw new ApiError('server', 'Your account is missing its profile. Sign in again in a moment.');
    }
    return data;
  }

  /** The profile picture from ELUM Account, when there is one (older databases have none). */
  private async pictureUrl(id: string): Promise<string | null> {
    try {
      const { data } = await this.sb.rpc('elum_pictures', { p_ids: [id] });
      const path = (data as { picture: string }[] | null)?.[0]?.picture;
      if (!path) return null;
      const signed = await this.sb.storage.from('avatars').createSignedUrl(path, SIGNED_URL_SECONDS);
      return signed.data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------- signing in across apps

  async handoff(to: string, next: string): Promise<string> {
    await this.me();
    const { data, error } = await this.sb.functions.invoke<{ data?: { url: string } }>('account-handoff', { body: { to, next } });
    if (error || !data?.data?.url) throw new ApiError('server', 'We could not sign you in there.');
    return data.data.url;
  }

  async completeHandoff(tokenHash: string): Promise<Session> {
    const { data, error } = await this.sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error || !data.session) throw new ApiError('unauthorized', 'That sign-in link has expired or was already used. Sign in again.');
    return this.sessionFor(data.session);
  }

  // ----------------------------------------------------------- notifications

  /** Notifications from every ELUM service (the platform's elum.notifications). */
  readonly notifications: NotificationsApi = {
    list: async ({ before, unreadOnly = false, limit = 30 } = {}) => {
      await this.me();
      const rows = await this.rpc<NotificationRow[]>('elum_notifications', { p_limit: limit, p_before: before ?? null, p_unread_only: unreadOnly });
      return (rows ?? []).map(toNotification);
    },
    markRead: async (ids) => {
      await this.me();
      await this.rpc('elum_mark_notifications_read', { p_ids: ids ?? null });
    },
    subscribe: (onNew) => {
      let channel: ReturnType<SupabaseClient['channel']> | null = null;
      let stopped = false;
      void this.sb.auth.getSession().then(({ data }) => {
        const me = data.session?.user.id;
        if (!me || stopped) return;
        channel = this.sb
          .channel(`elum-notifications-${me}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'elum', table: 'notifications', filter: `account_id=eq.${me}` }, (change) => {
            const row = change.new as Record<string, unknown>;
            onNew(
              toNotification({
                id: String(row.id),
                service_id: String(row.service_id),
                type: String(row.type),
                title: String(row.title),
                body: (row.body as string | null) ?? null,
                link: (row.link as string | null) ?? null,
                created_at: String(row.created_at),
                read_at: null,
                actor: null,
              }),
            );
          })
          .subscribe();
      });
      return () => {
        stopped = true;
        if (channel) void this.sb.removeChannel(channel);
      };
    },
  };

  // ----------------------------------------------------------------- designs

  async listDesigns(): Promise<DesignSummary[]> {
    await this.me();
    return (await this.rpc<DesignSummary[]>('make_list')) ?? [];
  }

  async createDesign(input: NewDesignInput = {}): Promise<DesignSummary> {
    await this.me();
    return this.rpc<DesignSummary>('make_create', {
      p_title: cleanTitle(input.title),
      p_kind: input.kind ?? 'presentation',
      p_width: input.width ?? 1920,
      p_height: input.height ?? 1080,
      p_content: input.content ?? { pages: [] },
    });
  }

  async getDesign(id: string): Promise<Design> {
    await this.me();
    return this.rpc<Design>('make_get', { p_id: id });
  }

  async saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult> {
    return this.rpc<SaveResult>('make_save', { p_id: id, p_version: version, p_content: content, p_title: title ?? null }, 'Your changes could not be saved. They are kept here; trying again.');
  }

  async versionHistory(designId: string): Promise<DesignVersion[]> {
    return (await this.rpc<DesignVersion[]>('make_versions', { p_id: designId })) ?? [];
  }

  async restoreVersion(designId: string, version: number): Promise<SaveResult> {
    return this.rpc<SaveResult>('make_restore_version', { p_id: designId, p_version: version });
  }

  async comments(designId: string): Promise<Comment[]> {
    return (await this.rpc<Comment[]>('make_comments', { p_id: designId })) ?? [];
  }

  async addComment(designId: string, body: string, parentId?: string, position?: { page: number; x: number; y: number }): Promise<Comment> {
    return this.rpc<Comment>('make_add_comment', {
      p_id: designId,
      p_body: body,
      p_parent: parentId ?? null,
      p_page: position?.page ?? null,
      p_x: position?.x ?? null,
      p_y: position?.y ?? null,
    });
  }

  async resolveComment(commentId: string, resolved: boolean): Promise<void> {
    await this.rpc('make_resolve_comment', { p_comment: commentId, p_resolved: resolved });
  }

  async brandKits(): Promise<BrandKit[]> {
    return (await this.rpc<BrandKit[]>('make_brand_kits')) ?? [];
  }

  async getBrandKit(id: string): Promise<BrandKit> {
    return this.rpc<BrandKit>('make_brand_kit', { p_kit: id });
  }

  async saveBrandKit(id: string | null, name: string, description: string, assets: { colors: BrandKitAsset[]; fonts: BrandKitAsset[]; logo?: string }): Promise<BrandKit> {
    return this.rpc<BrandKit>('make_save_brand_kit', {
      p_kit: id,
      p_name: name,
      p_description: description || null,
      p_colors: assets.colors,
      p_fonts: assets.fonts,
      p_logo: assets.logo ?? null,
    });
  }

  async templates(category?: string): Promise<DesignTemplate[]> {
    return (await this.rpc<DesignTemplate[]>('make_templates', { p_category: category ?? null })) ?? [];
  }

  async saveAsTemplate(designId: string, title: string, description?: string, category?: string): Promise<DesignTemplate> {
    return this.rpc<DesignTemplate>('make_save_as_template', { p_id: designId, p_title: title, p_description: description ?? null, p_category: category ?? null });
  }

  async createFromTemplate(templateId: string): Promise<DesignSummary> {
    return this.rpc<DesignSummary>('make_create_from_template', { p_template: templateId });
  }

  async setTags(designId: string, tags: string[]): Promise<void> {
    await this.rpc('make_set_tags', { p_id: designId, p_tags: tags });
  }

  async tagSearch(tags: string[], kind?: string): Promise<DesignSummary[]> {
    return (await this.rpc<DesignSummary[]>('make_tag_search', { p_tags: tags, p_kind: kind ?? null })) ?? [];
  }

  async incrementViews(designId: string): Promise<void> {
    await this.rpc('make_view', { p_id: designId });
  }

  async favorites(): Promise<Favorite[]> {
    return (await this.rpc<Favorite[]>('make_favorites')) ?? [];
  }

  async toggleFavorite(designId: string, favorited: boolean): Promise<void> {
    await this.rpc('make_favorite', { p_id: designId, p_on: favorited });
  }

  async renameDesign(id: string, title: string): Promise<void> {
    await this.rpc('make_rename', { p_id: id, p_title: cleanTitle(title) });
  }

  async resizeDesign(id: string, width: number, height: number): Promise<void> {
    await this.rpc('make_resize', { p_id: id, p_width: Math.round(width), p_height: Math.round(height) });
  }

  async duplicateDesign(id: string): Promise<DesignSummary> {
    return this.rpc<DesignSummary>('make_duplicate', { p_id: id });
  }

  async deleteDesign(id: string): Promise<void> {
    // Supabase only lets pictures leave storage through the Storage API, so an owner removes
    // them here first; make_delete then deletes the design. Someone the design was shared with
    // only leaves it, and its pictures stay.
    const design = await this.rpc<Design>('make_get', { p_id: id });
    if (design.role === 'owner') await this.removePictures(id);
    await this.rpc('make_delete', { p_id: id });
  }

  /** Every picture in a design's folder. A picture that will not go is left, never the design. */
  private async removePictures(designId: string): Promise<void> {
    const bucket = this.sb.storage.from(BUCKET);
    for (;;) {
      const { data, error } = await bucket.list(designId, { limit: 100 });
      if (error || !data?.length) return;
      const { error: removeError } = await bucket.remove(data.map((f) => `${designId}/${f.name}`));
      if (removeError || data.length < 100) return;
    }
  }

  // ----------------------------------------------------------------- sharing

  async listShares(id: string): Promise<Share[]> {
    return (await this.rpc<Share[]>('make_shares', { p_id: id })) ?? [];
  }

  async share(id: string, email: string, role: ShareRole): Promise<Share> {
    if (!isEmail(email)) throw new ApiError('invalid', 'Enter an email address.', { field: 'email' });
    return this.rpc<Share>('make_share', { p_id: id, p_email: email.trim().toLowerCase(), p_role: role });
  }

  async unshare(id: string, userId: string): Promise<void> {
    await this.rpc('make_unshare', { p_id: id, p_user: userId });
  }

  async findPeople(query: string): Promise<PublicUser[]> {
    if (query.trim().length < 2) return [];
    return (await this.rpc<PublicUser[]>('make_find_people', { p_query: query })) ?? [];
  }

  // ---------------------------------------------------------------- pictures

  async uploadImage(designId: string, file: File): Promise<string> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new ApiError('invalid', 'Use a PNG, JPEG, WebP, GIF or SVG picture.');
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError('too_large', 'Pictures can be up to 15 MB.');
    await this.me();
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
    const path = `${designId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw toApiError(error as RawError, 'That picture could not be uploaded.');
    return `${STORAGE_PREFIX}${path}`;
  }

  async imageUrl(src: string): Promise<string> {
    if (!src.startsWith(STORAGE_PREFIX)) return src;
    const path = src.slice(STORAGE_PREFIX.length);
    const cached = this.signedUrls.get(path);
    if (cached && cached.expires > Date.now() + 60_000) return cached.url;
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data) throw toApiError(error as RawError, 'That picture could not be loaded.');
    this.signedUrls.set(path, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
    return data.signedUrl;
  }
}

interface NotificationRow {
  id: string;
  service_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
  actor: { id: string; name: string; color: string } | null;
}

function toNotification(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    service: r.service_id as AppNotification['service'],
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    createdAt: r.created_at,
    readAt: r.read_at,
    actor: r.actor,
  };
}

function toUser(p: ProfileRow): User {
  return { id: p.id, name: p.name, email: p.email, color: p.color, accountType: p.account_type ?? 'external', createdAt: p.created_at };
}
