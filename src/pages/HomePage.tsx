import { LayoutTemplate, MoreHorizontal, Plus, Search, Star as StarIcon, Tag, X } from 'lucide-react';
import { RenameIcon } from '../components/icons/ElumIcons';
import { DeleteIcon, DuplicateIcon, SignOutIcon } from '../components/icons/ElumIcons';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, errorMessage, type DesignSummary, type DesignTemplate } from '../api';
import { SaveTemplateDialog } from '../editor/SaveTemplateDialog';
import { useUser } from '../auth/AuthProvider';
import { DesignIcon, MakeLockup } from '../components/Brand';
import { Dialog } from '../components/Dialog';
import { Loader } from '../components/Loader';
import { Menu } from '../components/Menu';
import { NotificationBell } from '../components/NotificationBell';
import { useToast } from '../components/Toast';
import { UserMenu } from '../components/UserMenu';
import { newPage, normalizeContent, PAGE_SIZES, type PageSize } from '../editor/model';
import { PageView } from '../editor/render';
import { TEMPLATES, type Template } from '../editor/templates';
import { formatWhen } from '../lib/time';
import { ThemeToggle } from '../theme/ThemeToggle';
import './HomePage.css';
import { ElumLauncher } from '../components/ElumLauncher';

type Filter = 'all' | 'mine' | 'shared' | 'favourites';

const TAGS_KEY = 'elum.make.tags';
/** Where the account keeps the tags you have used (a flat key in the user's metadata). */
const ACCOUNT_TAGS_KEY = 'make_tags';

/** The tags you have used, kept here and on the account so they can be looked up anywhere. */
function localTags(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(TAGS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function keepTags(tags: string[]) {
  const json = JSON.stringify(tags.slice(0, 200));
  try {
    localStorage.setItem(TAGS_KEY, json);
  } catch {
    // The account still keeps them.
  }
  void api.rememberSeen?.(ACCOUNT_TAGS_KEY, json).catch(() => undefined);
}

export function cleanTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}

const STARTED_KEY = 'elum.make.store-clicks';

/** True the first time this tab sees a Store click, so one click makes one design. */
function firstTime(click: string): boolean {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(STARTED_KEY) ?? '[]');
    if (seen.includes(click)) return false;
    sessionStorage.setItem(STARTED_KEY, JSON.stringify([...seen, click].slice(-50)));
  } catch {
    // Without storage, every visit starts one.
  }
  return true;
}

/** Your designs, and ways to start a new one. */
export function HomePage() {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DesignSummary | null>(null);
  const [removing, setRemoving] = useState<DesignSummary | null>(null);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [tagsOf, setTagsOf] = useState<Map<string, string[]>>(new Map());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagging, setTagging] = useState<DesignSummary | null>(null);
  const [templating, setTemplating] = useState<DesignSummary | null>(null);
  const [myTemplates, setMyTemplates] = useState<DesignTemplate[]>([]);

  const load = useCallback(async () => {
    try {
      setDesigns(await api.listDesigns());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Favourites, your templates and tags load beside the designs; each is fine to miss.
  useEffect(() => {
    api.favorites().then((list) => setFavourites(new Set(list.map((f) => f.designId))), () => undefined);
    api.templates().then(setMyTemplates, () => undefined);
    void (async () => {
      const fromAccount = await api.seenRelease?.(ACCOUNT_TAGS_KEY).catch(() => null);
      let account: string[] = [];
      try {
        const parsed = JSON.parse(fromAccount ?? '[]');
        if (Array.isArray(parsed)) account = parsed.filter((t): t is string => typeof t === 'string');
      } catch {
        // Nothing usable on the account.
      }
      const vocab = [...new Set([...account, ...localTags()])];
      if (!vocab.length) return;
      const tagged = await api.tagSearch(vocab).catch(() => []);
      setTagsOf(new Map(tagged.map((d) => [d.id, d.tags ?? []])));
      // Only keep tags that are still on a design.
      const used = [...new Set(tagged.flatMap((d) => d.tags ?? []))];
      if (used.length !== vocab.length) keepTags(used);
    })();
  }, []);

  const toggleFavourite = async (d: DesignSummary) => {
    const on = !favourites.has(d.id);
    setFavourites((set) => {
      const next = new Set(set);
      if (on) next.add(d.id);
      else next.delete(d.id);
      return next;
    });
    try {
      await api.toggleFavorite(d.id, on);
    } catch (e) {
      setFavourites((set) => {
        const next = new Set(set);
        if (on) next.delete(d.id);
        else next.add(d.id);
        return next;
      });
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  const allTags = useMemo(() => [...new Set([...tagsOf.values()].flat())].sort(), [tagsOf]);

  const fromMyTemplate = async (t: DesignTemplate) => {
    setCreating(t.id);
    try {
      const design = await api.createFromTemplate(t.id);
      navigate(`/m/${design.id}`);
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
      setCreating(null);
    }
  };

  const create = async (key: string, input: Parameters<typeof api.createDesign>[0], replace = false) => {
    setCreating(key);
    try {
      const design = await api.createDesign(input);
      navigate(`/m/${design.id}`, { replace });
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
      setCreating(null);
    }
  };

  const fromSize = (size: PageSize) =>
    create(size.id, { title: `Untitled ${size.label.split(' (')[0].toLowerCase()}`, kind: size.kind, width: size.width, height: size.height, content: { pages: [newPage()] } });
  const fromTemplate = (t: Template, replace = false) => create(t.id, { title: t.name, kind: t.kind, width: t.width, height: t.height, content: t.build() }, replace);

  // ELUM Store's "Use in Make" opens /?template=<id>&from=<click>: start that design straight away.
  // Each click is started once, even when Back (through sign-in) lands on the same address again.
  const [params, setParams] = useSearchParams();
  const asked = params.get('template');
  const click = params.get('from');
  const started = useRef(false);
  useEffect(() => {
    if (!asked || started.current) return;
    started.current = true;
    const t = TEMPLATES.find((x) => x.id === asked);
    if (!t) toast('That template is not in Make. Pick one below.', { tone: 'error' });
    if (!t || (click && !firstTime(click))) {
      setParams({}, { replace: true });
      return;
    }
    void fromTemplate(t, true);
    // Runs for the address it was opened with, not on every render.
  }, [asked]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (designs ?? []).filter(
      (d) =>
        (filter === 'all' || (filter === 'favourites' ? favourites.has(d.id) : filter === 'mine' ? d.role === 'owner' : d.role !== 'owner')) &&
        (!tagFilter || (tagsOf.get(d.id) ?? []).includes(tagFilter)) &&
        (!q || d.title.toLowerCase().includes(q) || d.owner?.name.toLowerCase().includes(q) || (tagsOf.get(d.id) ?? []).some((t) => t.includes(q))),
    );
  }, [designs, filter, query, favourites, tagFilter, tagsOf]);

  const duplicate = async (d: DesignSummary) => {
    try {
      const copy = await api.duplicateDesign(d.id);
      setDesigns((list) => [copy, ...(list ?? [])]);
      toast(`Made a copy of “${d.title}”.`, { tone: 'success' });
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  const firstName = user.name.split(' ')[0];

  return (
    <div className="home route-in">
      <header className="app-header">
        <Link to="/" className="brand-link" aria-label="ELUM Make home">
          <MakeLockup height={30} />
        </Link>
        <div className="app-header__end">
          <ThemeToggle />
          <ElumLauncher />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      <main className="home__main">
        <section className="home__start" aria-labelledby="start-heading">
          <h1 id="start-heading" className="home__hello">
            What will you make{firstName ? `, ${firstName}` : ''}?
          </h1>
          <h2 className="home__label">Start blank</h2>
          <ul className="sizes" role="list">
            {PAGE_SIZES.map((s) => (
              <li key={s.id}>
                <button type="button" className="size-card" onClick={() => void fromSize(s)} disabled={!!creating}>
                  <span className="size-card__frame">
                    <span className="size-card__shape" style={{ aspectRatio: `${s.width} / ${s.height}` }}>
                      {creating === s.id ? <Loader size={20} /> : <Plus size={18} strokeWidth={1.75} aria-hidden="true" />}
                    </span>
                  </span>
                  <span className="size-card__label">{s.label}</span>
                  <span className="size-card__dims muted">
                    {s.width} × {s.height}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <h2 className="home__label">Start from a template</h2>
          <ul className={`templates${allTemplates ? ' is-open' : ''}`} role="list">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <TemplateCard template={t} busy={creating === t.id} disabled={!!creating} onPick={() => void fromTemplate(t)} />
              </li>
            ))}
          </ul>
          <button type="button" className="templates__more" onClick={() => setAllTemplates((v) => !v)} aria-expanded={allTemplates}>
            {allTemplates ? 'Show fewer templates' : `Show all ${TEMPLATES.length} templates`}
          </button>

          {myTemplates.length > 0 && (
            <>
              <h2 className="home__label">Your templates</h2>
              <ul className="templates my-templates" role="list">
                {myTemplates.map((t, i) => (
                  <li key={t.id} className="stagger" style={{ '--i': i } as CSSProperties}>
                    <button type="button" className="template-card" onClick={() => void fromMyTemplate(t)} disabled={!!creating}>
                      <span className="template-card__thumb my-template__thumb">
                        <span className="my-template__frame" style={{ aspectRatio: `${t.width} / ${t.height}` }}>
                          <LayoutTemplate size={22} strokeWidth={1.5} aria-hidden="true" />
                        </span>
                        {creating === t.id && (
                          <span className="template-card__busy">
                            <Loader size={28} />
                          </span>
                        )}
                      </span>
                      <span className="design-card__title">{t.title}</span>
                      <span className="design-card__meta muted">{t.description || `${t.width} × ${t.height}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="home__designs" aria-labelledby="designs-heading">
          <div className="home__designs-head">
            <h2 id="designs-heading" className="home__title">
              Your designs
            </h2>
            <div className="segmented" role="group" aria-label="Show">
              {(['all', 'favourites', 'mine', 'shared'] as Filter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'favourites' ? 'Favourites' : f === 'mine' ? 'Yours' : 'Shared with you'}
                </button>
              ))}
            </div>
            <label className="home__search">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="visually-hidden">Search designs</span>
              <input className="input input--sm" type="search" placeholder="Search designs" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {allTags.length > 0 && (
            <div className="tag-chips" role="group" aria-label="Filter by tag">
              {allTags.map((t) => (
                <button key={t} type="button" className="tag-chip" aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                  <Tag size={12} strokeWidth={2} aria-hidden="true" /> {t}
                </button>
              ))}
              {tagFilter && (
                <button type="button" className="tag-chip tag-chip--clear" onClick={() => setTagFilter(null)}>
                  Clear
                </button>
              )}
            </div>
          )}

          {error ? (
            <div className="home__error" role="alert">
              <p>{error}</p>
              <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : designs === null ? (
            <ul className="design-grid" role="list" aria-busy="true" aria-label="Loading your designs">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="design-card design-card--skeleton">
                  <span className="design-card__thumb skeleton" />
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line skeleton--short" />
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <div className="empty-state">
              <DesignIcon size={56} />
              <h2>{filter === 'favourites' && !query && !tagFilter ? 'No favourites yet' : query || filter !== 'all' || tagFilter ? 'Nothing here' : 'No designs yet'}</h2>
              <p>
                {filter === 'favourites' && !query && !tagFilter
                  ? 'Star a design to keep it here, close at hand.'
                  : query || filter !== 'all' || tagFilter
                    ? 'Try another search or filter.'
                    : 'Pick a size or a template above to make your first one.'}
              </p>
            </div>
          ) : (
            <ul className="design-grid" role="list">
              {shown.map((d, i) => (
                <li key={d.id} className="design-card stagger" style={{ '--i': i } as CSSProperties}>
                  <button
                    type="button"
                    className="design-card__star"
                    aria-pressed={favourites.has(d.id)}
                    aria-label={favourites.has(d.id) ? `Remove ${d.title} from favourites` : `Add ${d.title} to favourites`}
                    data-tip={favourites.has(d.id) ? 'Favourite' : 'Add to favourites'}
                    onClick={() => void toggleFavourite(d)}
                  >
                    <StarIcon size={16} strokeWidth={1.75} />
                  </button>
                  <div className="design-card__main">
                  <Link to={`/m/${d.id}`} className="design-card__open">
                    <span className="design-card__thumb">
                      {d.cover ? (
                        <PageView page={normalizeContent({ pages: [d.cover] }).pages[0]} width={d.width} height={d.height} className="design-card__svg" />
                      ) : (
                        <span className="design-card__blank" style={{ aspectRatio: `${d.width} / ${d.height}` }} />
                      )}
                    </span>
                    <span className="design-card__title">{d.title}</span>
                    <span className="design-card__meta muted">
                      {d.role === 'owner' ? `Edited ${formatWhen(d.updatedAt)}` : `Shared by ${d.owner?.name ?? 'someone'}`} · {d.pageCount}{' '}
                      {d.pageCount === 1 ? 'page' : 'pages'}
                    </span>
                  </Link>
                  <Menu
                    label={`More for ${d.title}`}
                    placement="bottom-end"
                    items={[
                      ...(d.role !== 'viewer' ? [{ label: 'Rename', icon: <RenameIcon size={16} strokeWidth={1.75} />, onSelect: () => setRenaming(d) }] : []),
                      { label: favourites.has(d.id) ? 'Remove from favourites' : 'Add to favourites', icon: <StarIcon size={16} strokeWidth={1.75} />, onSelect: () => void toggleFavourite(d) },
                      ...(d.role !== 'viewer' ? [{ label: 'Tags…', icon: <Tag size={16} strokeWidth={1.75} />, onSelect: () => setTagging(d) }] : []),
                      { label: 'Make a copy', icon: <DuplicateIcon size={16} strokeWidth={1.75} />, onSelect: () => void duplicate(d) },
                      { label: 'Save as a template…', icon: <LayoutTemplate size={16} strokeWidth={1.75} />, onSelect: () => setTemplating(d) },
                      'separator',
                      d.role === 'owner'
                        ? { label: 'Delete', icon: <DeleteIcon size={16} strokeWidth={1.75} />, danger: true, onSelect: () => setRemoving(d) }
                        : { label: 'Remove from your designs', icon: <SignOutIcon size={16} strokeWidth={1.75} />, onSelect: () => setRemoving(d) },
                    ]}
                    trigger={(props) => (
                      <button type="button" className="icon-btn design-card__more" aria-label={`More for ${d.title}`} data-tip="More" {...props}>
                        <MoreHorizontal size={18} strokeWidth={1.75} />
                      </button>
                    )}
                  />
                  </div>
                  {(tagsOf.get(d.id) ?? []).length > 0 && (
                    <span className="design-card__tags">
                      {(tagsOf.get(d.id) ?? []).map((t) => (
                        <button key={t} type="button" className="tag-chip tag-chip--sm" aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                          {t}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <RenameDialog
        design={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={(id, title) => setDesigns((list) => list?.map((x) => (x.id === id ? { ...x, title } : x)) ?? null)}
      />
      <TagsDialog
        design={tagging}
        tags={tagging ? (tagsOf.get(tagging.id) ?? []) : []}
        suggestions={allTags}
        onClose={() => setTagging(null)}
        onSaved={(id, tags) => {
          setTagsOf((m) => new Map(m).set(id, tags));
          keepTags([...new Set([...allTags, ...tags, ...localTags()])]);
        }}
      />
      <SaveTemplateDialog
        design={templating}
        onClose={() => setTemplating(null)}
        onSaved={(t) => {
          setMyTemplates((list) => [t, ...list]);
          toast(`Saved “${t.title}” to your templates.`, { tone: 'success' });
        }}
      />
      <RemoveDialog design={removing} onClose={() => setRemoving(null)} onRemoved={(id) => setDesigns((list) => list?.filter((x) => x.id !== id) ?? null)} />
    </div>
  );
}

function TemplateCard({ template, busy, disabled, onPick }: { template: Template; busy: boolean; disabled: boolean; onPick: () => void }) {
  const cover = useMemo(() => template.build().pages[0], [template]);
  return (
    <button type="button" className="template-card" onClick={onPick} disabled={disabled}>
      <span className="template-card__thumb">
        <PageView page={cover} width={template.width} height={template.height} className="design-card__svg" />
        {busy && (
          <span className="template-card__busy">
            <Loader size={28} />
          </span>
        )}
      </span>
      <span className="design-card__title">{template.name}</span>
      <span className="design-card__meta muted">{template.description}</span>
    </button>
  );
}

function RenameDialog({ design, onClose, onRenamed }: { design: DesignSummary | null; onClose: () => void; onRenamed: (id: string, title: string) => void }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (design) {
      setTitle(design.title);
      setError(null);
    }
  }, [design]);
  const save = async () => {
    if (!design) return;
    setBusy(true);
    try {
      await api.renameDesign(design.id, title);
      onRenamed(design.id, title.trim());
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!design}
      onClose={onClose}
      title="Rename design"
      width={420}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rename-design" className="elum-btn elum-btn--primary" disabled={busy || !title.trim()}>
            Save
          </button>
        </>
      }
    >
      <form
        id="rename-design"
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="rename-input">Name</label>
        <input id="rename-input" className="input" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} aria-invalid={!!error} />
        {error && <span className="field-error">{error}</span>}
      </form>
    </Dialog>
  );
}

function TagsDialog({
  design,
  tags,
  suggestions,
  onClose,
  onSaved,
}: {
  design: DesignSummary | null;
  tags: string[];
  suggestions: string[];
  onClose(): void;
  onSaved(id: string, tags: string[]): void;
}) {
  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (design) {
      setList(tags);
      setDraft('');
      setError(null);
    }
    // Starts from the design's tags each time it opens.
  }, [design]);
  const addDraft = (raw = draft) => {
    const parts = raw.split(',').map(cleanTag).filter(Boolean);
    if (!parts.length) return list;
    const next = [...new Set([...list, ...parts])].slice(0, 20);
    setList(next);
    setDraft('');
    return next;
  };
  const save = async () => {
    if (!design) return;
    const next = draft.trim() ? addDraft() : list;
    setBusy(true);
    try {
      await api.setTags(design.id, next);
      onSaved(design.id, [...next].sort());
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const unused = suggestions.filter((t) => !list.includes(t));
  return (
    <Dialog
      open={!!design}
      onClose={onClose}
      title="Tags"
      description={design ? `Tags help you find “${design.title}” later. Up to 20.` : undefined}
      width={460}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="tags-form" className="elum-btn elum-btn--primary" disabled={busy}>
            Save tags
          </button>
        </>
      }
    >
      <form
        id="tags-form"
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="tags-input">Add a tag</label>
        <div className="tags-input">
          {list.map((t) => (
            <span key={t} className="tag-chip" aria-pressed="true">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setList((l) => l.filter((x) => x !== t))}>
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
          <input
            id="tags-input"
            className="tags-input__field"
            value={draft}
            maxLength={60}
            placeholder={list.length ? '' : 'Like “client”, “q4” or “launch”'}
            onChange={(e) => (e.target.value.includes(',') ? addDraft(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                addDraft();
              } else if (e.key === 'Backspace' && !draft && list.length) setList((l) => l.slice(0, -1));
            }}
          />
        </div>
        {unused.length > 0 && (
          <div className="tag-chips tag-chips--suggest">
            {unused.slice(0, 12).map((t) => (
              <button key={t} type="button" className="tag-chip tag-chip--sm" onClick={() => setList((l) => [...l, t].slice(0, 20))}>
                + {t}
              </button>
            ))}
          </div>
        )}
        {error && <span className="field-error">{error}</span>}
      </form>
    </Dialog>
  );
}

function RemoveDialog({ design, onClose, onRemoved }: { design: DesignSummary | null; onClose: () => void; onRemoved: (id: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const owner = design?.role === 'owner';
  const remove = async () => {
    if (!design) return;
    setBusy(true);
    try {
      await api.deleteDesign(design.id);
      onRemoved(design.id);
      onClose();
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!design}
      onClose={onClose}
      title={owner ? 'Delete this design?' : 'Remove it from your designs?'}
      description={
        owner
          ? `“${design?.title}” and its pictures are deleted for everyone it is shared with. This cannot be undone.`
          : `You will no longer see “${design?.title}”. ${design?.owner?.name ?? 'The owner'} can share it with you again.`
      }
      width={440}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`elum-btn ${owner ? 'elum-btn--danger' : 'elum-btn--primary'}`} disabled={busy} onClick={() => void remove()}>
            {owner ? 'Delete' : 'Remove'}
          </button>
        </>
      }
    />
  );
}
