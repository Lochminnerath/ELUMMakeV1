import { ACCEPTED_IMAGE_TYPES, type MakeApi } from '../client';
import { ApiError } from '../errors';
import type {
  BrandKit,
  Comment,
  Design,
  DesignTemplate,
  DesignVersion,
  Favorite,
  DesignContent,
  DesignSummary,
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
  views?: number;
}

interface StoredVersion {
  designId: string;
  version: number;
  title: string;
  content: DesignContent;
  savedBy: string | null;
  savedAt: string;
}

interface StoredComment {
  id: string;
  designId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  position: { page: number; x: number; y: number } | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredKit {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  assets: BrandKit['assets'];
  updatedAt: string;
}

interface StoredTemplate {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  category: string;
  kind: Design['kind'];
  width: number;
  height: number;
  content: DesignContent;
  updatedAt: string;
}

interface Store {
  users: StoredUser[];
  designs: StoredDesign[];
  // Added later, so older browsers may not have them yet.
  versions?: StoredVersion[];
  comments?: StoredComment[];
  kits?: StoredKit[];
  templates?: StoredTemplate[];
  favorites?: { accountId: string; designId: string; createdAt: string }[];
}

const SNAPSHOT_MS = 2 * 60 * 1000;

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
      throw new ApiError('storage_full', 'This browser has run out of space for preview designs. Delete some, or connect ELUM.');
    }
  }

  private me(): StoredUser {
    const id = localStorage.getItem(SESSION_KEY);
    const user = id ? this.read().users.find((u) => u.id === id) : undefined;
    if (!user) {
      this.unauthorizedHandlers.forEach((h) => h());
      throw new ApiError('unauthorized', 'Your session has ended. Sign in again.');
    }
    return user;
  }

  onUnauthorized(handler: () => void): () => void {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  }

  // ---------------------------------------------------------------- accounts

  async restoreSession(): Promise<Session | null> {
    const id = localStorage.getItem(SESSION_KEY);
    const user = id ? this.read().users.find((u) => u.id === id) : undefined;
    return user ? { user: publicUser(user) } : null;
  }

  async signUp(input: SignUpInput): Promise<Session> {
    if (input.accountType === 'type') throw new ApiError('invalid', 'ELUM Type addresses need the ELUM platform. Use your own email for now.');
    const { name, email, password } = checkSignUp(input);
    const store = this.read();
    if (store.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError('email_taken', 'An account with this email already exists. Sign in instead.', { field: 'email' });
    }
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name,
      email,
      color: COLORS[store.users.length % COLORS.length],
      accountType: 'external',
      createdAt: new Date().toISOString(),
      password: await hashPassword(password),
    };
    store.users.push(user);
    this.write(store);
    localStorage.setItem(SESSION_KEY, user.id);
    return { user: publicUser(user) };
  }

  async signIn(input: SignInInput): Promise<Session> {
    const user = this.read().users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
    if (!user || !(await verifyPassword(input.password, user.password))) {
      throw new ApiError('invalid_credentials', 'That email and password do not match.');
    }
    localStorage.setItem(SESSION_KEY, user.id);
    return { user: publicUser(user) };
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const me = this.me();
    const store = this.read();
    const user = store.users.find((u) => u.id === me.id)!;
    user.name = cleanName(input.name);
    this.write(store);
    return publicUser(user);
  }

  // ----------------------------------------------------------------- designs

  private roleOf(d: StoredDesign, me: string): Role | null {
    if (d.ownerId === me) return 'owner';
    return d.shares.find((s) => s.userId === me)?.role ?? null;
  }

  private find(id: string, need: Role = 'viewer'): { store: Store; design: StoredDesign; role: Role } {
    const me = this.me().id;
    const store = this.read();
    const design = store.designs.find((d) => d.id === id);
    const role = design ? this.roleOf(design, me) : null;
    if (!design || !role) throw new ApiError('not_found', 'This design does not exist, or it has not been shared with you.');
    if (need === 'owner' && role !== 'owner') throw new ApiError('forbidden', 'Only the owner can do that.');
    if (need === 'editor' && role === 'viewer') throw new ApiError('forbidden', 'You can view this design but not change it.');
    return { store, design, role };
  }

  private summary(store: Store, d: StoredDesign, role: Role): DesignSummary {
    const owner = store.users.find((u) => u.id === d.ownerId);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      width: d.width,
      height: d.height,
      role,
      owner: owner ? person(owner) : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      pageCount: d.content.pages.length,
      cover: d.content.pages[0] ?? null,
    };
  }

  async listDesigns(): Promise<DesignSummary[]> {
    const me = this.me().id;
    const store = this.read();
    return store.designs
      .map((d) => ({ d, role: this.roleOf(d, me) }))
      .filter((x): x is { d: StoredDesign; role: Role } => x.role !== null)
      .sort((a, b) => b.d.updatedAt.localeCompare(a.d.updatedAt))
      .map(({ d, role }) => this.summary(store, d, role));
  }

  async createDesign(input: NewDesignInput = {}): Promise<DesignSummary> {
    const me = this.me().id;
    const store = this.read();
    const now = new Date().toISOString();
    const design: StoredDesign = {
      id: crypto.randomUUID(),
      ownerId: me,
      title: cleanTitle(input.title),
      kind: input.kind ?? 'presentation',
      width: input.width ?? 1920,
      height: input.height ?? 1080,
      content: input.content ?? { pages: [] },
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: me,
      shares: [],
    };
    store.designs.push(design);
    this.write(store);
    return this.summary(store, design, 'owner');
  }

  async getDesign(id: string): Promise<Design> {
    const { store, design, role } = this.find(id);
    const updater = store.users.find((u) => u.id === design.updatedBy);
    return { ...this.summary(store, design, role), content: design.content, version: design.version, updatedBy: updater ? person(updater) : null };
  }

  async saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult> {
    const { store, design } = this.find(id, 'editor');
    if (design.version !== version) throw new ApiError('conflict', 'Someone else changed this design. Your view was updated.', { version: design.version });
    if (!Array.isArray(content?.pages)) throw new ApiError('invalid', 'That design could not be read.');
    this.keepVersion(store, design);
    design.content = content;
    if (title?.trim()) design.title = cleanTitle(title);
    design.version += 1;
    design.updatedAt = new Date().toISOString();
    design.updatedBy = this.me().id;
    this.write(store);
    return { version: design.version, updatedAt: design.updatedAt };
  }

  // ----------------------------------------------------------------- history

  /** Keeps the design as it is now, at most every 2 minutes and the newest 50. */
  private keepVersion(store: Store, design: StoredDesign, force = false) {
    const versions = (store.versions ??= []);
    const mine = versions.filter((v) => v.designId === design.id);
    if (!force && mine.some((v) => Date.now() - Date.parse(v.savedAt) < SNAPSHOT_MS)) return;
    if (mine.some((v) => v.version === design.version)) return;
    versions.push({ designId: design.id, version: design.version, title: design.title, content: design.content, savedBy: design.updatedBy, savedAt: new Date().toISOString() });
    const keep = new Set(mine.map((v) => v.version).concat(design.version).sort((a, b) => b - a).slice(0, 50));
    store.versions = versions.filter((v) => v.designId !== design.id || keep.has(v.version));
  }

  async versionHistory(designId: string): Promise<DesignVersion[]> {
    const { store } = this.find(designId);
    return (store.versions ?? [])
      .filter((v) => v.designId === designId)
      .sort((a, b) => b.version - a.version)
      .map((v) => {
        const by = store.users.find((u) => u.id === v.savedBy);
        return { version: v.version, title: v.title, savedBy: by ? person(by) : null, savedAt: v.savedAt, preview: v.content.pages[0] ?? null };
      });
  }

  async restoreVersion(designId: string, version: number): Promise<SaveResult> {
    const { store, design } = this.find(designId, 'editor');
    const old = store.versions?.find((v) => v.designId === designId && v.version === version);
    if (!old) throw new ApiError('not_found', 'That version is no longer kept.');
    this.keepVersion(store, design, true);
    design.content = old.content;
    design.title = old.title;
    design.version += 1;
    design.updatedAt = new Date().toISOString();
    design.updatedBy = this.me().id;
    this.write(store);
    return { version: design.version, updatedAt: design.updatedAt };
  }

  // ---------------------------------------------------------------- comments

  private commentJson(store: Store, c: StoredComment): Comment {
    const author = store.users.find((u) => u.id === c.authorId)!;
    const replies = (store.comments ?? []).filter((r) => r.parentId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { id: c.id, body: c.body, position: c.position, resolved: c.resolved, user: person(author), createdAt: c.createdAt, updatedAt: c.updatedAt, replies: replies.map((r) => this.commentJson(store, r)) };
  }

  async comments(designId: string): Promise<Comment[]> {
    const { store } = this.find(designId);
    return (store.comments ?? [])
      .filter((c) => c.designId === designId && !c.parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => this.commentJson(store, c));
  }

  async addComment(designId: string, body: string, parentId?: string, position?: { page: number; x: number; y: number }): Promise<Comment> {
    const { store } = this.find(designId);
    const text = body.trim();
    if (!text || text.length > 4000) throw new ApiError('invalid', 'Write a comment of up to 4000 characters.');
    if (parentId && !store.comments?.some((c) => c.id === parentId && c.designId === designId)) throw new ApiError('not_found', 'That comment is no longer there.');
    const now = new Date().toISOString();
    const comment: StoredComment = { id: crypto.randomUUID(), designId, authorId: this.me().id, parentId: parentId ?? null, body: text, position: position ?? null, resolved: false, createdAt: now, updatedAt: now };
    (store.comments ??= []).push(comment);
    this.write(store);
    return this.commentJson(store, comment);
  }

  async resolveComment(commentId: string, resolved: boolean): Promise<void> {
    const comment = this.read().comments?.find((c) => c.id === commentId);
    if (!comment) throw new ApiError('not_found', 'That comment is no longer there.');
    const { store } = this.find(comment.designId, comment.authorId === this.me().id ? 'viewer' : 'editor');
    const stored = store.comments!.find((c) => c.id === commentId)!;
    stored.resolved = resolved;
    stored.updatedAt = new Date().toISOString();
    this.write(store);
  }

  // -------------------------------------------------------------- brand kits

  private kitJson(store: Store, k: StoredKit): BrandKit {
    const owner = store.users.find((u) => u.id === k.ownerId);
    return { id: k.id, name: k.name, description: k.description, assets: k.assets, isPublic: false, updatedAt: k.updatedAt, owner: owner ? person(owner) : null };
  }

  async brandKits(): Promise<BrandKit[]> {
    const me = this.me().id;
    const store = this.read();
    return (store.kits ?? [])
      .filter((k) => k.ownerId === me)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((k) => this.kitJson(store, k));
  }

  async getBrandKit(id: string): Promise<BrandKit> {
    const me = this.me().id;
    const store = this.read();
    const kit = store.kits?.find((k) => k.id === id && k.ownerId === me);
    if (!kit) throw new ApiError('not_found', 'That brand kit is not in your account.');
    return this.kitJson(store, kit);
  }

  async saveBrandKit(id: string | null, name: string, description: string, assets: BrandKit['assets']): Promise<BrandKit> {
    const me = this.me().id;
    const store = this.read();
    if (!name.trim()) throw new ApiError('invalid', 'Give the brand kit a name, and keep the description short.');
    const kits = (store.kits ??= []);
    let kit: StoredKit | undefined;
    if (id) {
      kit = kits.find((k) => k.id === id && k.ownerId === me);
      if (!kit) throw new ApiError('not_found', 'That brand kit is not in your account.');
    } else {
      if (kits.filter((k) => k.ownerId === me).length >= 20) throw new ApiError('conflict', 'You have 20 brand kits already. Delete one first.');
      kit = { id: crypto.randomUUID(), ownerId: me, name: '', description: null, assets: { colors: [], fonts: [] }, updatedAt: '' };
      kits.push(kit);
    }
    Object.assign(kit, { name: name.trim(), description: description || null, assets, updatedAt: new Date().toISOString() });
    this.write(store);
    return this.kitJson(store, kit);
  }

  // --------------------------------------------------------------- templates

  private templateJson(store: Store, t: StoredTemplate): DesignTemplate {
    const owner = store.users.find((u) => u.id === t.ownerId);
    return { id: t.id, title: t.title, description: t.description, category: t.category, kind: t.kind, width: t.width, height: t.height, thumbnail: null, isPublic: false, updatedAt: t.updatedAt, owner: owner ? person(owner) : null };
  }

  async templates(category?: string): Promise<DesignTemplate[]> {
    const me = this.me().id;
    const store = this.read();
    return (store.templates ?? [])
      .filter((t) => t.ownerId === me && (!category || t.category === category))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => this.templateJson(store, t));
  }

  async saveAsTemplate(designId: string, title: string, description?: string, category?: string): Promise<DesignTemplate> {
    const { store, design } = this.find(designId);
    if (!title.trim()) throw new ApiError('invalid', 'Give the template a name.');
    const template: StoredTemplate = {
      id: crypto.randomUUID(),
      ownerId: this.me().id,
      title: title.trim(),
      description: description ?? null,
      category: category?.trim() || 'mine',
      kind: design.kind,
      width: design.width,
      height: design.height,
      content: design.content,
      updatedAt: new Date().toISOString(),
    };
    (store.templates ??= []).push(template);
    this.write(store);
    return this.templateJson(store, template);
  }

  async createFromTemplate(templateId: string): Promise<DesignSummary> {
    const me = this.me().id;
    const template = this.read().templates?.find((t) => t.id === templateId && t.ownerId === me);
    if (!template) throw new ApiError('not_found', 'That template is not in your account.');
    return this.createDesign({ title: template.title, kind: template.kind, width: template.width, height: template.height, content: structuredClone(template.content) });
  }

  // --------------------------------------------------- tags, views, favourites

  async setTags(designId: string, tags: string[]): Promise<void> {
    const { store, design } = this.find(designId, 'editor');
    const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 40))].sort();
    if (clean.length > 20) throw new ApiError('invalid', 'A design can have up to 20 tags.');
    design.tags = clean;
    this.write(store);
  }

  async tagSearch(tags: string[], kind?: string): Promise<DesignSummary[]> {
    const me = this.me().id;
    const want = tags.map((t) => t.trim().toLowerCase());
    const store = this.read();
    return store.designs
      .filter((d) => (d.tags ?? []).some((t) => want.includes(t)) && (!kind || d.kind === kind))
      .map((d) => ({ d, role: this.roleOf(d, me) }))
      .filter((x): x is { d: StoredDesign; role: Role } => x.role !== null)
      .sort((a, b) => b.d.updatedAt.localeCompare(a.d.updatedAt))
      .map(({ d, role }) => ({ ...this.summary(store, d, role), tags: d.tags ?? [] }));
  }

  async incrementViews(designId: string): Promise<void> {
    const { store, design } = this.find(designId);
    design.views = (design.views ?? 0) + 1;
    this.write(store);
  }

  async favorites(): Promise<Favorite[]> {
    const me = this.me().id;
    const store = this.read();
    return (store.favorites ?? [])
      .filter((f) => f.accountId === me && store.designs.some((d) => d.id === f.designId && this.roleOf(d, me)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => ({ id: f.designId, designId: f.designId, createdAt: f.createdAt }));
  }

  async toggleFavorite(designId: string, favorited: boolean): Promise<void> {
    const { store } = this.find(designId);
    const me = this.me().id;
    const list = (store.favorites ??= []).filter((f) => !(f.accountId === me && f.designId === designId));
    if (favorited) list.push({ accountId: me, designId, createdAt: new Date().toISOString() });
    store.favorites = list;
    this.write(store);
  }

  async seenRelease(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(`elum.make.account.${this.me().id}.${key}`);
    } catch {
      return null;
    }
  }

  async rememberSeen(key: string, id: string): Promise<void> {
    try {
      localStorage.setItem(`elum.make.account.${this.me().id}.${key}`, id);
    } catch {
      // Preview mode keeps everything in this browser; without storage there is nowhere to keep it.
    }
  }

  async renameDesign(id: string, title: string): Promise<void> {
    if (!title.trim()) throw new ApiError('invalid', 'Give the design a name.');
    const { store, design } = this.find(id, 'editor');
    design.title = cleanTitle(title);
    design.updatedAt = new Date().toISOString();
    this.write(store);
  }

  async resizeDesign(id: string, width: number, height: number): Promise<void> {
    if (width < 100 || height < 100 || width > 8000 || height > 8000) throw new ApiError('invalid', 'Pages can be 100 to 8000 pixels on each side.');
    const { store, design } = this.find(id, 'editor');
    design.width = Math.round(width);
    design.height = Math.round(height);
    this.write(store);
  }

  async duplicateDesign(id: string): Promise<DesignSummary> {
    const { design } = this.find(id);
    return this.createDesign({
      title: `Copy of ${design.title}`,
      kind: design.kind,
      width: design.width,
      height: design.height,
      content: structuredClone(design.content),
    });
  }

  async deleteDesign(id: string): Promise<void> {
    const { store, design, role } = this.find(id);
    if (role === 'owner') store.designs = store.designs.filter((d) => d.id !== id);
    else design.shares = design.shares.filter((s) => s.userId !== this.me().id);
    this.write(store);
  }

  // ----------------------------------------------------------------- sharing

  async listShares(id: string): Promise<Share[]> {
    const { store, design } = this.find(id);
    return design.shares.flatMap((s) => {
      const user = store.users.find((u) => u.id === s.userId);
      return user ? [{ ...person(user), role: s.role }] : [];
    });
  }

  async share(id: string, email: string, role: ShareRole): Promise<Share> {
    if (!isEmail(email)) throw new ApiError('invalid', 'Enter an email address.', { field: 'email' });
    const { store, design } = this.find(id, 'editor');
    const user = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new ApiError('not_found', 'There is no account with that address in this preview.');
    if (user.id === design.ownerId) throw new ApiError('invalid', 'That is the owner of this design.');
    design.shares = [...design.shares.filter((s) => s.userId !== user.id), { userId: user.id, role }];
    this.write(store);
    return { ...person(user), role };
  }

  async unshare(id: string, userId: string): Promise<void> {
    const { store, design } = this.find(id, userId === this.me().id ? 'viewer' : 'editor');
    if (userId === design.ownerId) throw new ApiError('invalid', 'The owner cannot be removed.');
    design.shares = design.shares.filter((s) => s.userId !== userId);
    this.write(store);
  }

  async findPeople(query: string): Promise<PublicUser[]> {
    const me = this.me().id;
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return this.read()
      .users.filter((u) => u.id !== me && (u.email.toLowerCase().startsWith(q) || u.name.toLowerCase().split(' ').some((w) => w.startsWith(q))))
      .slice(0, 8)
      .map(person);
  }

  // ---------------------------------------------------------------- pictures

  async uploadImage(designId: string, file: File): Promise<string> {
    this.find(designId, 'editor');
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new ApiError('invalid', 'Use a PNG, JPEG, WebP, GIF or SVG picture.');
    if (file.size > MAX_PREVIEW_IMAGE) throw new ApiError('too_large', 'In preview mode pictures can be up to 2 MB. Connect ELUM for up to 15 MB.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new ApiError('invalid', 'That picture could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async imageUrl(src: string): Promise<string> {
    return src;
  }
}

function publicUser(u: StoredUser): User {
  return { id: u.id, name: u.name, email: u.email, color: u.color, accountType: u.accountType, createdAt: u.createdAt };
}

function person(u: StoredUser): PublicUser {
  return { id: u.id, name: u.name, email: u.email, color: u.color };
}
