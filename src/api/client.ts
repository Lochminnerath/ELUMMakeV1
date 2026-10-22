import type {
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
import { ACCEPTED_IMAGE_TYPES } from './types';

/** The interface that both LocalApi and SupabaseApi must implement. */
export interface MakeApi {
  readonly mode: 'local' | 'supabase';

  // --- accounts ---
  restoreSession(): Promise<Session | null>;
  signUp(input: SignUpInput): Promise<Session>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  updateProfile(input: { name: string }): Promise<User>;
  onUnauthorized(handler: () => void): () => void;

  // --- designs ---
  listDesigns(): Promise<DesignSummary[]>;
  createDesign(input?: NewDesignInput): Promise<DesignSummary>;
  getDesign(id: string): Promise<Design>;
  saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult>;
  renameDesign(id: string, title: string): Promise<void>;
  resizeDesign(id: string, width: number, height: number): Promise<void>;
  duplicateDesign(id: string): Promise<DesignSummary>;
  deleteDesign(id: string): Promise<void>;

  // --- sharing ---
  listShares(id: string): Promise<Share[]>;
  share(id: string, email: string, role: ShareRole): Promise<Share>;
  unshare(id: string, userId: string): Promise<void>;
  findPeople(query: string): Promise<PublicUser[]>;

  // --- pictures ---
  uploadImage(designId: string, file: File): Promise<string>;
  imageUrl(src: string): Promise<string>;

  // --- version history ---
  versionHistory(designId: string): Promise<DesignVersion[]>;
  restoreVersion(designId: string, version: number): Promise<SaveResult>;

  // --- comments ---
  comments(designId: string): Promise<Comment[]>;
  addComment(designId: string, body: string, parentId?: string, position?: { page: number; x: number; y: number }): Promise<Comment>;
  resolveComment(commentId: string, resolved: boolean): Promise<void>;

  // --- annotations ---
  annotations(designId: string): Promise<Annotation[]>;
  addAnnotation(designId: string, pageNumber: number, x: number, y: number, body: string): Promise<Annotation>;

  // --- brand kits ---
  brandKits(): Promise<BrandKit[]>;
  saveBrandKit(id: string | null, name: string, description: string, assets: { colors: BrandKitAsset[]; fonts: BrandKitAsset[]; logo?: string }): Promise<BrandKit>;
  getBrandKit(id: string): Promise<BrandKit>;

  // --- templates ---
  templates(category?: string): Promise<DesignTemplate[]>;
  saveAsTemplate(designId: string, title: string, description?: string, category?: string): Promise<DesignTemplate>;

  // --- search & analytics ---
  tagSearch(tags: string[], kind?: DesignKind): Promise<DesignSummary[]>;
  incrementViews(designId: string): Promise<void>;

  // --- favorites ---
  favorites(): Promise<Favorite[]>;
  toggleFavorite(designId: string, favorited: boolean): Promise<void>;
}

export { ACCEPTED_IMAGE_TYPES };
