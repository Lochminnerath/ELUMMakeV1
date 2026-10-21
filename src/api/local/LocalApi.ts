import { ACCEPTED_IMAGE_TYPES, type MakeApi } from '../client';
import { ApiError } from '../errors';
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
  User,
} from '../types';
import { checkSignUp, cleanName, cleanTitle, isEmail } from '../validation';
import { hashPassword, verifyPassword, type PasswordHash } from './passwords';

/**
 * Preview mode: Make without the ELUM platform, for working on the app on your own computer.
 * Everything lives in this browser's localStorage and nothing reaches Supabase, so accounts made
 * here are not real ELUM accounts. Netlify builds refuse to ship this (scripts/require-supabase.mjs).
 */

const KEY = 'elum.make.preview';
const SESSION_KEY = 'elum.make.preview.session';
/** Pictures are kept inline in preview mode, so they stay small. */
const MAX_PREVIEW_IMAGE = 2 * 1024 * 1024;
const COLORS = ['#f59a52', '#3fc4a0', '#9b84ee', '#ec7fa9', '#e9b949', '#7093f8'];

interface StoredUser extends User {
  password: PasswordHash;
}

interface StoredDesign {
  id: string;
  ownerId: string;
  title: string;
  kind: Design['kind'];
  width: number;
  height: number;
  content: DesignContent;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  shares: { userId: string; role: ShareRole }[];
  tags?: string[];
  viewCount?: number;
}

interface Store {
  users: StoredUser[];
  designs: StoredDesign[];
}

export class LocalApi implements MakeApi {
  readonly mode = 'local' as const;
  private readonly unauthorizedHandlers = new Set<() => void>();

  private read(): Store {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Store;
    } catch {
      // Unreadable storage starts fresh.
    }
    return { users: [], designs: [] };
  }

  private write(store: Store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      throw new ApiError('server', 'Storage is full. Please clear some data.');
    }
  }

  private findUser(id: string): StoredUser | null {
    return this.read().users.find(u => u.id === id) ?? null;
  }

  private findDesign(id: string): StoredDesign | null {
    return this.read().designs.find(d => d.id === id) ?? null;
  }

  private findDesignByTitle(title: string): StoredDesign | null {
    return this.read().designs.find(d => d.title === title) ?? null;
  }

  private toUser(u: StoredUser): User {
    return { id: u.id, name: u.name, email: u.email, color: u.color, accountType: u.accountType, createdAt: u.createdAt };
  }

  private toSummary(d: StoredDesign, userId: string): DesignSummary {
    const share = d.shares.find(s => s.userId === userId);
    const role = d.ownerId === userId ? 'owner' : (share?.role ?? null);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      width: d.width,
      height: d.height,
      role: role as Role,
      owner: this.toUser(this.findUser(d.ownerId)!) ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      pageCount: d.content.pages.length,
      cover: d.content.pages[0] ?? null,
      tags: d.tags,
      viewCount: d.viewCount,
    };
  }

  private toDesign(d: StoredDesign, userId: string): Design {
    const summary = this.toSummary(d, userId);
    const share = d.shares.find(s => s.userId === userId);
    const updatedBy = d.updatedBy ? this.findUser(d.updatedBy) : null;
    return {
      ...summary,
      content: d.content,
      version: d.version,
      updatedBy: updatedBy ? this.toUser(updatedBy) : null,
    };
  }

  // ---------------------------------------------------------------- accounts

  async restoreSession(): Promise<Session | null> {
    const store = this.read();
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const { userId } = JSON.parse(raw) as { userId: string };
      const user = store.users.find(u => u.id === userId);
      if (!user) return null;
      return { user: this.toUser(user) };
    } catch {
      return null;
    }
  }

  async signUp(input: SignUpInput): Promise<Session> {
    const { name, email, password } = checkSignUp(input);
    const store = this.read();
    if (store.users.find(u => u.email === email)) {
      throw new ApiError('email_taken', 'An account with this email already exists. Sign in instead.', { field: 'email' });
    }
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name,
      email,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      accountType: input.accountType ?? 'external',
      createdAt: new Date().toISOString(),
      password: hashPassword(password),
    };
    store.users.push(user);
    this.write(store);
    const session = { userId: user.id };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: this.toUser(user) };
  }

  async signIn(input: SignInInput): Promise<Session> {
    const { email, password } = input;
    const store = this.read();
    const user = store.users.find(u => u.email === email);
    if (!user) throw new ApiError('invalid_credentials', 'That email and password do not match.');
    if (!verifyPassword(user.password, password)) {
      throw new ApiError('invalid_credentials', 'That email and password do not match.');
    }
    const session = { userId: user.id };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: this.toUser(user) };
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    if (!user) throw new ApiError('unauthorized', 'Your session has ended. Sign in again.');
    user.name = cleanName(input.name);
    this.write(store);
    return this.toUser(user);
  }

  onUnauthorized(handler: () => void): () => void {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  }

  // ---------------------------------------------------------------- designs

  async listDesigns(): Promise<DesignSummary[]> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    return store.designs
      .filter(d => d.ownerId === userId || d.shares.some(s => s.userId === userId))
      .map(d => this.toSummary(d, userId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createDesign(input: NewDesignInput = {}): Promise<DesignSummary> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design: StoredDesign = {
      id: crypto.randomUUID(),
      ownerId: userId,
      title: cleanTitle(input.title) || 'Untitled design',
      kind: input.kind ?? 'presentation',
      width: input.width ?? 1920,
      height: input.height ?? 1080,
      content: input.content ?? { pages: [] },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      shares: [],
      tags: input.tags ?? [],
      viewCount: 0,
    };
    store.designs.push(design);
    this.write(store);
    return this.toSummary(design, userId);
  }

  async getDesign(id: string): Promise<Design> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    if (design.ownerId !== userId && !design.shares.some(s => s.userId === userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    return this.toDesign(design, userId);
  }

  async saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== userId && !design.shares.some(s => s.userId === userId)) {
      throw new ApiError('forbidden', 'You do not have permission to edit this design.');
    }
    if (design.version !== version) {
      throw new ApiError('conflict', 'Someone else changed this design. Your view was updated.', { version: design.version });
    }
    design.content = content;
    if (title !== undefined) design.title = cleanTitle(title) || design.title;
    design.version += 1;
    design.updatedAt = new Date().toISOString();
    design.updatedBy = userId;
    this.write(store);
    return { version: design.version, updatedAt: design.updatedAt };
  }

  async renameDesign(id: string, title: string): Promise<void> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== userId && !design.shares.some(s => s.userId === userId)) {
      throw new ApiError('forbidden', 'You do not have permission to edit this design.');
    }
    const clean = cleanTitle(title);
    if (!clean) throw new ApiError('invalid', 'Give the design a name.');
    design.title = clean;
    design.updatedAt = new Date().toISOString();
    design.updatedBy = userId;
    this.write(store);
  }

  async resizeDesign(id: string, width: number, height: number): Promise<void> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== userId && !design.shares.some(s => s.userId === userId)) {
      throw new ApiError('forbidden', 'You do not have permission to edit this design.');
    }
    design.width = Math.round(width);
    design.height = Math.round(height);
    design.updatedAt = new Date().toISOString();
    design.updatedBy = userId;
    this.write(store);
  }

  async duplicateDesign(id: string): Promise<DesignSummary> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== userId && !design.shares.some(s => s.userId === userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    const newDesign: StoredDesign = {
      ...design,
      id: crypto.randomUUID(),
      title: `Copy of ${design.title}`,
      ownerId: userId,
      shares: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
    store.designs.push(newDesign);
    this.write(store);
    return this.toSummary(newDesign, userId);
  }

  async deleteDesign(id: string): Promise<void> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId === userId) {
      store.designs = store.designs.filter(d => d.id !== id);
    } else if (design.shares.some(s => s.userId === userId)) {
      design.shares = design.shares.filter(s => s.userId !== userId);
    } else {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    this.write(store);
  }

  // ---------------------------------------------------------------- sharing

  async listShares(id: string): Promise<Share[]> {
    const store = this.read();
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    return design.shares.map(s => {
      const user = store.users.find(u => u.id === s.userId);
      return user ? { ...this.toUser(user), role: s.role } : { id: s.userId, name: '', email: '', color: '', accountType: 'external', role: s.role };
    });
  }

  async share(id: string, email: string, role: ShareRole): Promise<Share> {
    if (!isEmail(email)) throw new ApiError('invalid', 'Enter an email address.', { field: 'email' });
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('forbidden', 'You do not have permission to share this design.');
    }
    const user = store.users.find(u => u.email === email);
    if (!user) throw new ApiError('not_found', 'There is no account with that email.');
    const existing = design.shares.find(s => s.userId === user.id);
    if (existing) {
      existing.role = role;
    } else {
      design.shares.push({ userId: user.id, role });
    }
    design.updatedAt = new Date().toISOString();
    design.updatedBy = session.userId;
    this.write(store);
    return { ...this.toUser(user), role };
  }

  async unshare(id: string, userId: string): Promise<void> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const design = store.designs.find(d => d.id === id);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId === session.userId) {
      design.shares = design.shares.filter(s => s.userId !== userId);
    } else if (design.shares.some(s => s.userId === session.userId)) {
      design.shares = design.shares.filter(s => s.userId !== userId);
    } else {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    this.write(store);
  }

  async findPeople(query: string): Promise<PublicUser[]> {
    if (query.trim().length < 2) return [];
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const q = query.toLowerCase();
    return store.users
      .filter(u => u.id !== session.userId && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
      .map(u => this.toUser(u))
      .slice(0, 8);
  }

  // ---------------------------------------------------------------- pictures

  async uploadImage(designId: string, file: File): Promise<string> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new ApiError('invalid', 'Use a PNG, JPEG, WebP, GIF or SVG picture.');
    if (file.size > MAX_PREVIEW_IMAGE) throw new ApiError('too_large', 'Pictures can be up to 2 MB in preview mode.');
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('forbidden', 'You do not have permission to upload to this design.');
    }
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${designId}/${crypto.randomUUID()}.${ext}`;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    // Store the data URL in localStorage under the design key
    const imagesKey = `elum.make.preview.images.${designId}`;
    let images: Record<string, string> = {};
    try { images = JSON.parse(localStorage.getItem(imagesKey) ?? '{}'); } catch { /* ignore */ }
    images[path] = dataUrl;
    localStorage.setItem(imagesKey, JSON.stringify(images));
    return `storage:${path}`;
  }

  async imageUrl(src: string): Promise<string> {
    if (!src.startsWith('storage:')) return src;
    const path = src.slice(8);
    const store = this.read();
    const design = store.designs.find(d => d.id === path.split('/')[0]);
    if (!design) return src;
    const imagesKey = `elum.make.preview.images.${design.id}`;
    try {
      const images: Record<string, string> = JSON.parse(localStorage.getItem(imagesKey) ?? '{}');
      return images[path] ?? src;
    } catch {
      return src;
    }
  }

  // ================================================================= NEW FEATURES (Local API)

  // --- Versioning ---
  async versionHistory(designId: string): Promise<DesignVersion[]> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    // In local mode, we just return the current state as the only version
    const savedBy = design.updatedBy ? store.users.find(u => u.id === design.updatedBy) : null;
    return [{
      version: design.version,
      title: design.title,
      savedBy: savedBy ? this.toUser(savedBy) : null,
      savedAt: design.updatedAt,
      preview: design.content.pages[0] ?? null,
    }];
  }

  async restoreVersion(designId: string, _version: number): Promise<SaveResult> {
    // In local mode, just return current state (no actual versioning in preview)
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    return { version: design.version, updatedAt: design.updatedAt };
  }

  // --- Comments ---
  async comments(designId: string): Promise<Comment[]> {
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    // In local mode, return empty (no comments in preview)
    return [];
  }

  async addComment(designId: string, _body: string, _parentId?: string, _position?: { page: number; x: number; y: number }): Promise<Comment> {
    // In local mode, return a mock comment (no actual comments in preview)
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    return {
      id: crypto.randomUUID(),
      body: _body,
      position: _position ?? null,
      resolved: false,
      user: user ? this.toUser(user) : { id: session.userId, name: '', email: '', color: '', accountType: 'external' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };
  }

  async resolveComment(_commentId: string, _resolved: boolean): Promise<void> {
    // No-op in local mode
  }

  // --- Annotations ---
  async annotations(designId: string): Promise<Annotation[]> {
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    if (design.ownerId !== session.userId && !design.shares.some(s => s.userId === session.userId)) {
      throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    }
    // In local mode, return empty (no annotations in preview)
    return [];
  }

  async addAnnotation(designId: string, _pageNumber: number, _x: number, _y: number, _body: string): Promise<Annotation> {
    // In local mode, return a mock annotation (no actual annotations in preview)
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    return {
      id: crypto.randomUUID(),
      pageNumber: _pageNumber,
      x: _x,
      y: _y,
      body: _body,
      resolved: false,
      user: user ? this.toUser(user) : { id: session.userId, name: '', email: '', color: '', accountType: 'external' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // --- Brand kits ---
  async brandKits(): Promise<BrandKit[]> {
    // In local mode, return empty (no brand kits in preview)
    return [];
  }

  async saveBrandKit(_id: string | null, _name: string, _description: string, _assets: { colors: BrandKitAsset[]; fonts: BrandKitAsset[]; logo?: string }): Promise<BrandKit> {
    // In local mode, return a mock brand kit (no actual brand kits in preview)
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    return {
      id: crypto.randomUUID(),
      name: _name,
      description: _description || null,
      assets: _assets,
      isPublic: false,
      updatedAt: new Date().toISOString(),
      owner: user ? this.toUser(user) : null,
    };
  }

  async getBrandKit(_id: string): Promise<BrandKit> {
    // In local mode, return a mock brand kit (no actual brand kits in preview)
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    return {
      id: _id,
      name: 'Mock Brand Kit',
      description: null,
      assets: { colors: [], fonts: [] },
      isPublic: false,
      updatedAt: new Date().toISOString(),
      owner: user ? this.toUser(user) : null,
    };
  }

  // --- Templates ---
  async templates(_category?: string): Promise<DesignTemplate[]> {
    // In local mode, return empty (no templates in preview)
    return [];
  }

  async saveAsTemplate(designId: string, _title: string, _description?: string, _category?: string): Promise<DesignTemplate> {
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (!design) throw new ApiError('not_found', 'This design does not exist.');
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const user = store.users.find(u => u.id === session.userId);
    return {
      id: crypto.randomUUID(),
      title: _title,
      description: _description || null,
      category: _category ?? '',
      kind: design.kind,
      width: design.width,
      height: design.height,
      thumbnail: design.content.pages[0] ?? null,
      isPublic: false,
      updatedAt: new Date().toISOString(),
      owner: user ? this.toUser(user) : null,
    };
  }

  // --- Search & analytics ---
  async tagSearch(tags: string[], kind?: string): Promise<DesignSummary[]> {
    const store = this.read();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as { userId: string };
    const userId = session.userId;
    return store.designs
      .filter(d => (d.ownerId === userId || d.shares.some(s => s.userId === userId)) &&
                   (!tags.length || d.tags?.some(t => tags.includes(t))) &&
                   (!kind || d.kind === kind))
      .map(d => this.toSummary(d, userId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async incrementViews(designId: string): Promise<void> {
    const store = this.read();
    const design = store.designs.find(d => d.id === designId);
    if (design) {
      design.viewCount = (design.viewCount ?? 0) + 1;
      this.write(store);
    }
  }

  // --- Favorites ---
  async favorites(): Promise<Favorite[]> {
    // In local mode, return empty (no favorites in preview)
    return [];
  }

  async toggleFavorite(_designId: string, _favorited: boolean): Promise<void> {
    // No-op in local mode
  }
}

function publicUser(u: StoredUser): User {
  return { id: u.id, name: u.name, email: u.email, color: u.color, accountType: u.accountType, createdAt: u.createdAt };
}
