import type {
  AppNotification,
  BrandKit,
  BrandKitAsset,
  Comment,
  Design,
  DesignContent,
  DesignSummary,
  DesignTemplate,
  DesignVersion,
  Favorite,
  Annotation,
  NewDesignInput,
  PublicUser,
  Role,
  SaveResult,
  Session,
  Share,
  ShareRole,
  SignInInput,
  SignUpInput,
  DesignKind,
  User,
} from './types';

/** The contract every Make backend fulfils: Supabase in production, the browser in preview. */
export interface MakeApi {
  /** `remote` for the ELUM platform on Supabase, `local` for in-browser preview mode. */
  readonly mode: 'remote' | 'local';

  // Accounts.
  restoreSession(): Promise<Session | null>;
  signUp(input: SignUpInput): Promise<Session>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  updateProfile(input: { name: string }): Promise<User>;
  onUnauthorized(handler: () => void): () => void;

  // Designs
  listDesigns(): Promise<DesignSummary[]>;
  createDesign(input?: NewDesignInput): Promise<DesignSummary>;
  getDesign(id: string): Promise<Design>;
  saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult>;
  renameDesign(id: string, title: string): Promise<void>;
  resizeDesign(id: string, width: number, height: number): Promise<void>;
  duplicateDesign(id: string): Promise<DesignSummary>;
  deleteDesign(id: string): Promise<void>;

  // Sharing
  listShares(id: string): Promise<Share[]>;
  share(id: string, email: string, role: ShareRole): Promise<Share>;
  unshare(id: string, userId: string): Promise<void>;
  findPeople(query: string): Promise<PublicUser[]>;

  // Pictures
  uploadImage(designId: string, file: File): Promise<string>;
  imageUrl(src: string): Promise<string>;

  // Version history
  versionHistory(designId: string): Promise<DesignVersion[]>;
  restoreVersion(designId: string, version: number): Promise<SaveResult>;

  // Comments
  comments(designId: string): Promise<Comment[]>;
  addComment(designId: string, body: string, parentId?: string, position?: { page: number; x: number; y: number }): Promise<Comment>;
  resolveComment(commentId: string, resolved: boolean): Promise<void>;

  // Annotations
  annotations(designId: string): Promise<Annotation[]>;
  addAnnotation(designId: string, pageNumber: number, x: number, y: number, body: string): Promise<Annotation>;

  // Brand kits
  brandKits(): Promise<BrandKit[]>;
  saveBrandKit(id: string | null, name: string, description: string, assets: { colors: BrandKitAsset[]; fonts: BrandKitAsset[]; logo?: string }): Promise<BrandKit>;
  getBrandKit(id: string): Promise<BrandKit>;

  // Templates
  templates(category?: string): Promise<DesignTemplate[]>;
  saveAsTemplate(designId: string, title: string, description?: string, category?: string): Promise<DesignTemplate>;

  // Search & analytics
  tagSearch(tags: string[], kind?: DesignKind): Promise<DesignSummary[]>;
  incrementViews(designId: string): Promise<void>;

  // Favorites
  favorites(): Promise<Favorite[]>;
  toggleFavorite(designId: string, favorited: boolean): Promise<void>;

  // Notifications (optional, only on Supabase)
  readonly notifications?: NotificationsApi;
}

export interface NotificationsApi {
  list(options?: { before?: string; unreadOnly?: boolean; limit?: number }): Promise<AppNotification[]>;
  markRead(ids?: string[]): Promise<void>;
  subscribe(onNew: (n: AppNotification) => void): () => void;
}

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
