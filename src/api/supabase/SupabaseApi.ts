import { ApiError, type Role } from '../errors';
import type {
  MakeApi,
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
  SaveResult,
  Session,
  Share,
  ShareRole,
  SignInInput,
  SignUpInput,
  User,
} from '../types';
import { ACCEPTED_IMAGE_TYPES } from '../types';
import { createClient } from './client';

export class SupabaseApi implements MakeApi {
  readonly mode = 'supabase' as const;
  private readonly unauthorizedHandlers = new Set<() => void>();
  private readonly supabase = createClient();

  // --- accounts ---

  async restoreSession(): Promise<Session | null> {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error || !session) return null;
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (!user) return null;
    return { user: this.toUser(user) };
  }

  async signUp(input: SignUpInput): Promise<Session> {
    const { data, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name, accountType: input.accountType ?? 'external' } },
    });
    if (error) throw new ApiError('server', error.message);
    if (!data.user) throw new ApiError('server', 'Sign up failed.');
    // Create user record
    const { error: userError } = await this.supabase
      .from('users')
      .insert({
        id: data.user.id,
        name: input.name,
        email: input.email,
        accountType: input.accountType ?? 'external',
      });
    if (userError) throw new ApiError('server', userError.message);
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    if (!user) throw new ApiError('server', 'Could not retrieve user.');
    return { user: this.toUser(user) };
  }

  async signIn(input: SignInInput): Promise<Session> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw new ApiError('invalid_credentials', error.message);
    if (!data.user) throw new ApiError('server', 'Sign in failed.');
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    if (!user) throw new ApiError('server', 'Could not retrieve user.');
    return { user: this.toUser(user) };
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new ApiError('server', error.message);
  }

  async updateProfile(input: { name: string }): Promise<User> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('users')
      .update({ name: input.name })
      .eq('id', user.id);
    if (error) throw new ApiError('server', error.message);
    const { data: updatedUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (!updatedUser) throw new ApiError('server', 'Could not retrieve user.');
    return this.toUser(updatedUser);
  }

  onUnauthorized(handler: () => void): () => void {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  }

  // --- designs ---

  async listDesigns(): Promise<DesignSummary[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('list_user_designs', { user_id_param: user.id });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(d => this.toSummary(d));
  }

  async createDesign(input: NewDesignInput = {}): Promise<DesignSummary> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .from('designs')
      .insert({
        id: crypto.randomUUID(),
        owner_id: user.id,
        title: input.title || 'Untitled design',
        kind: input.kind ?? 'presentation',
        width: input.width ?? 1920,
        height: input.height ?? 1080,
        content: input.content ?? { pages: [] },
        tags: input.tags ?? [],
      })
      .select()
      .single();
    if (error) throw new ApiError('server', error.message);
    return this.toSummary(data);
  }

  async getDesign(id: string): Promise<Design> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .from('designs')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new ApiError('not_found', 'Design not found.');
    return this.toDesign(data);
  }

  async saveDesign(id: string, version: number, content: DesignContent, title?: string): Promise<SaveResult> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('designs')
      .update({
        content,
        title: title,
        version: version + 1,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('version', version);
    if (error) {
      if (error.code === '23505') {
        throw new ApiError('conflict', 'Someone else changed this design.');
      }
      throw new ApiError('server', error.message);
    }
    const { data } = await this.supabase
      .from('designs')
      .select('version, updated_at')
      .eq('id', id)
      .single();
    if (!data) throw new ApiError('server', 'Could not retrieve updated design.');
    return { version: data.version, updatedAt: data.updated_at };
  }

  async renameDesign(id: string, title: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('designs')
      .update({ title, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id);
    if (error) throw new ApiError('server', error.message);
  }

  async resizeDesign(id: string, width: number, height: number): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('designs')
      .update({ width, height, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id);
    if (error) throw new ApiError('server', error.message);
  }

  async duplicateDesign(id: string): Promise<DesignSummary> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data: original } = await this.supabase
      .from('designs')
      .select('*')
      .eq('id', id)
      .single();
    if (!original) throw new ApiError('not_found', 'Design not found.');
    const { data, error } = await this.supabase
      .from('designs')
      .insert({
        id: crypto.randomUUID(),
        owner_id: user.id,
        title: `Copy of ${original.title}`,
        kind: original.kind,
        width: original.width,
        height: original.height,
        content: original.content,
        tags: original.tags,
      })
      .select()
      .single();
    if (error) throw new ApiError('server', error.message);
    return this.toSummary(data);
  }

  async deleteDesign(id: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('designs')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);
    if (error) throw new ApiError('server', error.message);
  }

  // --- sharing ---

  async listShares(id: string): Promise<Share[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_design_shares', { design_id_param: id });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(s => ({
      id: s.user_id,
      name: s.user_name,
      email: s.user_email,
      color: s.user_color,
      accountType: s.user_account_type as 'external' | 'google' | 'github',
      role: s.role as ShareRole,
    }));
  }

  async share(id: string, email: string, role: ShareRole): Promise<Share> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('share_design', { design_id_param: id, email_param: email, role_param: role });
    if (error) throw new ApiError('server', error.message);
    return {
      id: data.user_id,
      name: data.user_name,
      email: data.user_email,
      color: data.user_color,
      accountType: data.user_account_type as 'external' | 'google' | 'github',
      role,
    };
  }

  async unshare(id: string, userId: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .from('shares')
      .delete()
      .eq('design_id', id)
      .eq('user_id', userId);
    if (error) throw new ApiError('server', error.message);
  }

  async findPeople(query: string): Promise<PublicUser[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('search_users', { query_param: query });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(u => this.toPublicUser(u));
  }

  // --- pictures ---

  async uploadImage(designId: string, file: File): Promise<string> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError('invalid', 'Use a PNG, JPEG, WebP, GIF or SVG picture.');
    }
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${designId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.supabase.storage
      .from('design-images')
      .upload(path, file);
    if (error) throw new ApiError('server', error.message);
    return `storage:${path}`;
  }

  async imageUrl(src: string): Promise<string> {
    if (!src.startsWith('storage:')) return src;
    const path = src.slice(8);
    const { data } = this.supabase.storage
      .from('design-images')
      .getPublicUrl(path);
    return data.publicUrl;
  }

  // --- version history ---

  async versionHistory(designId: string): Promise<DesignVersion[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_design_versions', { design_id_param: designId });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(v => ({
      version: v.version,
      title: v.title,
      savedBy: v.saved_by_id ? this.toUser({
        id: v.saved_by_id,
        name: v.saved_by_name,
        email: v.saved_by_email,
        color: v.saved_by_color,
        accountType: 'external',
        createdAt: '',
      }) : null,
      savedAt: v.saved_at,
      preview: v.preview,
    }));
  }

  async restoreVersion(designId: string, version: number): Promise<SaveResult> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    // Get the version content
    const { data: design } = await this.supabase
      .from('designs')
      .select('content, version')
      .eq('id', designId)
      .single();
    if (!design) throw new ApiError('not_found', 'Design not found.');
    // Create a new version entry
    const { error } = await this.supabase
      .from('design_versions')
      .insert({
        design_id: designId,
        version: design.version + 1,
        saved_by: user.id,
        saved_at: new Date().toISOString(),
      });
    if (error) throw new ApiError('server', error.message);
    return { version: design.version + 1, updatedAt: new Date().toISOString() };
  }

  // --- comments ---

  async comments(designId: string): Promise<Comment[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_design_comments', { design_id_param: designId });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(c => ({
      id: c.id,
      body: c.body,
      position: c.position,
      resolved: c.resolved,
      user: this.toUser({
        id: c.user_id,
        name: c.user_name,
        email: c.user_email,
        color: c.user_color,
        accountType: 'external',
        createdAt: '',
      }),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      replies: (c.replies || []).map((r: any) => ({
        id: r.id,
        body: r.body,
        position: null,
        resolved: false,
        user: this.toUser({
          id: r.user_id,
          name: r.user_name,
          email: r.user_email,
          color: r.user_color,
          accountType: 'external',
          createdAt: '',
        }),
        createdAt: r.created_at,
        updatedAt: r.created_at,
        replies: [],
      })),
    }));
  }

  async addComment(designId: string, body: string, parentId?: string, position?: { page: number; x: number; y: number }): Promise<Comment> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .from('comments')
      .insert({
        design_id: designId,
        user_id: user.id,
        body,
        parent_id: parentId || null,
        position,
      })
      .select()
      .single();
    if (error) throw new ApiError('server', error.message);
    return {
      id: data.id,
      body: data.body,
      position: data.position,
      resolved: data.resolved,
      user: this.toUser({
        id: data.user_id,
        name: data.user_name,
        email: data.user_email,
        color: data.user_color,
        accountType: 'external',
        createdAt: '',
      }),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      replies: [],
    };
  }

  async resolveComment(commentId: string, resolved: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('comments')
      .update({ resolved, updated_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) throw new ApiError('server', error.message);
  }

  // --- annotations ---

  async annotations(designId: string): Promise<Annotation[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_design_annotations', { design_id_param: designId });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(a => ({
      id: a.id,
      pageNumber: a.page_number,
      x: a.x,
      y: a.y,
      body: a.body,
      resolved: a.resolved,
      user: this.toUser({
        id: a.user_id,
        name: a.user_name,
        email: a.user_email,
        color: a.user_color,
        accountType: 'external',
        createdAt: '',
      }),
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));
  }

  async addAnnotation(designId: string, pageNumber: number, x: number, y: number, body: string): Promise<Annotation> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .from('annotations')
      .insert({
        design_id: designId,
        user_id: user.id,
        page_number: pageNumber,
        x,
        y,
        body,
      })
      .select()
      .single();
    if (error) throw new ApiError('server', error.message);
    return {
      id: data.id,
      pageNumber: data.page_number,
      x: data.x,
      y: data.y,
      body: data.body,
      resolved: data.resolved,
      user: this.toUser({
        id: data.user_id,
        name: data.user_name,
        email: data.user_email,
        color: data.user_color,
        accountType: 'external',
        createdAt: '',
      }),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // --- brand kits ---

  async brandKits(): Promise<BrandKit[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_user_brand_kits', { user_id_param: user.id });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(bk => ({
      id: bk.id,
      name: bk.name,
      description: bk.description,
      assets: bk.assets,
      isPublic: bk.is_public,
      updatedAt: bk.updated_at,
      owner: bk.owner_id ? this.toUser({
        id: bk.owner_id,
        name: bk.owner_name,
        email: bk.owner_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }) : null,
    }));
  }

  async saveBrandKit(id: string | null, name: string, description: string, assets: { colors: BrandKitAsset[]; fonts: BrandKitAsset[]; logo?: string }): Promise<BrandKit> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    let data: any;
    let error: any;
    if (id) {
      ({ data, error } = await this.supabase
        .from('brand_kits')
        .update({ name, description, assets, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single());
    } else {
      ({ data, error } = await this.supabase
        .from('brand_kits')
        .insert({ name, description, assets, user_id: user.id })
        .select()
        .single());
    }
    if (error) throw new ApiError('server', error.message);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      assets: data.assets,
      isPublic: data.is_public,
      updatedAt: data.updated_at,
      owner: this.toUser({
        id: data.user_id,
        name: data.user_name,
        email: data.user_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }),
    };
  }

  async getBrandKit(id: string): Promise<BrandKit> {
    const { data, error } = await this.supabase
      .from('brand_kits')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new ApiError('not_found', 'Brand kit not found.');
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      assets: data.assets,
      isPublic: data.is_public,
      updatedAt: data.updated_at,
      owner: data.user_id ? this.toUser({
        id: data.user_id,
        name: data.user_name,
        email: data.user_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }) : null,
    };
  }

  // --- templates ---

  async templates(category?: string): Promise<DesignTemplate[]> {
    const { data, error } = await this.supabase
      .rpc('get_public_templates', { category_param: category ?? '' });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      kind: t.kind,
      width: t.width,
      height: t.height,
      thumbnail: t.thumbnail,
      isPublic: t.is_public,
      updatedAt: t.updated_at,
      owner: t.owner_id ? this.toUser({
        id: t.owner_id,
        name: t.owner_name,
        email: t.owner_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }) : null,
    }));
  }

  async saveAsTemplate(designId: string, title: string, description?: string, category?: string): Promise<DesignTemplate> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('save_as_template', {
        design_id_param: designId,
        title_param: title,
        description_param: description ?? '',
        category_param: category ?? '',
        user_id_param: user.id,
      });
    if (error) throw new ApiError('server', error.message);
    const { data: template } = await this.supabase
      .from('design_templates')
      .select('*')
      .eq('id', data)
      .single();
    if (!template) throw new ApiError('server', 'Could not retrieve template.');
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      kind: template.kind,
      width: template.width,
      height: template.height,
      thumbnail: template.thumbnail,
      isPublic: template.is_public,
      updatedAt: template.updated_at,
      owner: template.user_id ? this.toUser({
        id: template.user_id,
        name: template.user_name,
        email: template.user_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }) : null,
    };
  }

  // --- search & analytics ---

  async tagSearch(tags: string[], kind?: string): Promise<DesignSummary[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('search_designs_by_tags', { tags_param: tags, kind_param: kind ?? '' });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(d => this.toSummary(d));
  }

  async incrementViews(designId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('increment_view_count', { design_id_param: designId });
    if (error) throw new ApiError('server', error.message);
  }

  // --- favorites ---

  async favorites(): Promise<Favorite[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { data, error } = await this.supabase
      .rpc('get_user_favorites', { user_id_param: user.id });
    if (error) throw new ApiError('server', error.message);
    return (data || []).map(f => ({
      id: f.id,
      designId: f.design_id,
      createdAt: f.created_at,
    }));
  }

  async toggleFavorite(designId: string, favorited: boolean): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new ApiError('unauthorized', 'Not signed in.');
    const { error } = await this.supabase
      .rpc('toggle_favorite', {
        user_id_param: user.id,
        design_id_param: designId,
        favorited_param: favorited,
      });
    if (error) throw new ApiError('server', error.message);
  }

  // --- helpers ---

  private toUser(u: any): User {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      color: u.color,
      accountType: u.account_type || 'external',
      createdAt: u.created_at,
    };
  }

  private toPublicUser(u: any): PublicUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      color: u.color,
      accountType: u.account_type || 'external',
    };
  }

  private toSummary(d: any): DesignSummary {
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      width: d.width,
      height: d.height,
      role: d.role,
      owner: d.owner_id ? this.toUser({
        id: d.owner_id,
        name: d.owner_name,
        email: d.owner_email,
        color: d.owner_color,
        accountType: 'external',
        createdAt: d.created_at,
      }) : null,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      pageCount: d.page_count,
      cover: d.cover,
      tags: d.tags,
      viewCount: d.view_count,
    };
  }

  private toDesign(d: any): Design {
    const summary = this.toSummary(d);
    return {
      ...summary,
      content: d.content,
      version: d.version,
      updatedBy: d.updated_by ? this.toUser({
        id: d.updated_by,
        name: d.updated_by_name,
        email: d.updated_by_email,
        color: '',
        accountType: 'external',
        createdAt: '',
      }) : null,
    };
  }
}
