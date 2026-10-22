import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { LocalApi } from './LocalApi';

const signUp = (api: LocalApi, name: string, email: string) => api.signUp({ name, email, password: 'long-password-1' });

describe('preview mode', () => {
  it('signs up, signs out and signs back in', async () => {
    const api = new LocalApi();
    const { user } = await signUp(api, 'Ada', 'ada@example.org');
    expect(user.name).toBe('Ada');
    await api.signOut();
    expect(await api.restoreSession()).toBeNull();
    await expect(api.signIn({ email: 'ada@example.org', password: 'wrong-password' })).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await api.signIn({ email: 'ADA@example.org', password: 'long-password-1' })).user.id).toBe(user.id);
  });

  it('refuses ELUM Type addresses without the platform', async () => {
    await expect(new LocalApi().signUp({ name: 'Fen', email: '', password: 'long-password-1', accountType: 'type', handle: 'fen' })).rejects.toBeInstanceOf(ApiError);
  });

  it('saves designs with versions and refuses stale saves', async () => {
    const api = new LocalApi();
    await signUp(api, 'Ada', 'ada@example.org');
    const d = await api.createDesign({ title: 'Deck', content: { pages: [{ id: 'p', background: '#fff', elements: [] }] } });
    expect((await api.listDesigns())[0]).toMatchObject({ title: 'Deck', role: 'owner', pageCount: 1 });
    const saved = await api.saveDesign(d.id, 1, { pages: [] });
    expect(saved.version).toBe(2);
    await expect(api.saveDesign(d.id, 1, { pages: [] })).rejects.toMatchObject({ code: 'conflict' });
    await api.resizeDesign(d.id, 1080, 1080);
    expect((await api.getDesign(d.id)).version).toBe(2);
  });

  it('shares with viewers who cannot change things', async () => {
    const api = new LocalApi();
    const bo = await signUp(api, 'Bo', 'bo@example.org');
    await api.signOut();
    await signUp(api, 'Ada', 'ada@example.org');
    const d = await api.createDesign({ title: 'Poster' });
    expect((await api.findPeople('bo'))[0].id).toBe(bo.user.id);
    await api.share(d.id, 'bo@example.org', 'viewer');
    await api.signOut();
    await api.signIn({ email: 'bo@example.org', password: 'long-password-1' });
    expect((await api.getDesign(d.id)).role).toBe('viewer');
    await expect(api.saveDesign(d.id, 1, { pages: [] })).rejects.toMatchObject({ code: 'forbidden' });
    const copy = await api.duplicateDesign(d.id);
    expect(copy.role).toBe('owner');
    await api.deleteDesign(d.id);
    expect((await api.listDesigns()).map((x) => x.id)).toEqual([copy.id]);
  });

  it('keeps strangers out', async () => {
    const api = new LocalApi();
    await signUp(api, 'Ada', 'ada@example.org');
    const d = await api.createDesign();
    await api.signOut();
    await signUp(api, 'Cy', 'cy@example.org');
    await expect(api.getDesign(d.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('keeps history, comments, kits, templates, tags and favourites', async () => {
    const api = new LocalApi();
    await signUp(api, 'Ada', 'ada@example.org');
    const page = (id: string) => ({ id, background: '#fff', elements: [] });
    const d = await api.createDesign({ title: 'Deck', content: { pages: [page('p1')] } });
    await api.saveDesign(d.id, 1, { pages: [page('p2')] });
    expect((await api.versionHistory(d.id)).map((v) => v.version)).toEqual([1]);
    expect((await api.restoreVersion(d.id, 1)).version).toBe(3);
    expect((await api.getDesign(d.id)).content.pages[0].id).toBe('p1');

    const c = await api.addComment(d.id, '  Nice  ', undefined, { page: 0, x: 1, y: 2 });
    await api.addComment(d.id, 'Thanks', c.id);
    await api.resolveComment(c.id, true);
    const [first] = await api.comments(d.id);
    expect(first).toMatchObject({ body: 'Nice', resolved: true, position: { page: 0 } });
    expect(first.replies[0].body).toBe('Thanks');
    await expect(api.addComment(d.id, '   ')).rejects.toMatchObject({ code: 'invalid' });

    const kit = await api.saveBrandKit(null, 'ELUM', '', { colors: [{ value: '#ec7fa9' }], fonts: [] });
    expect((await api.getBrandKit(kit.id)).assets.colors[0].value).toBe('#ec7fa9');

    const t = await api.saveAsTemplate(d.id, 'Mine', undefined, 'work');
    expect(await api.templates('other')).toEqual([]);
    expect((await api.getDesign((await api.createFromTemplate(t.id)).id)).content.pages[0].id).toBe('p1');

    await api.setTags(d.id, ['Launch', ' launch ', 'Q4']);
    expect((await api.tagSearch(['q4']))[0].tags).toEqual(['launch', 'q4']);
    await api.toggleFavorite(d.id, true);
    await api.toggleFavorite(d.id, true);
    expect(await api.favorites()).toHaveLength(1);
    await api.toggleFavorite(d.id, false);
    expect(await api.favorites()).toHaveLength(0);
  });
});
