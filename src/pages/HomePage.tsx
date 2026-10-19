import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { RenameIcon } from '../components/icons/ElumIcons';
import { DeleteIcon, DuplicateIcon, SignOutIcon } from '../components/icons/ElumIcons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, errorMessage, type DesignSummary } from '../api';
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

type Filter = 'all' | 'mine' | 'shared';

/** Your designs, and ways to start a new one. */
export function HomePage() {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DesignSummary | null>(null);
  const [removing, setRemoving] = useState<DesignSummary | null>(null);

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

  const create = async (key: string, input: Parameters<typeof api.createDesign>[0]) => {
    setCreating(key);
    try {
      const design = await api.createDesign(input);
      navigate(`/m/${design.id}`);
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
      setCreating(null);
    }
  };

  const fromSize = (size: PageSize) =>
    create(size.id, { title: `Untitled ${size.label.split(' (')[0].toLowerCase()}`, kind: size.kind, width: size.width, height: size.height, content: { pages: [newPage()] } });
  const fromTemplate = (t: Template) => create(t.id, { title: t.name, kind: t.kind, width: t.width, height: t.height, content: t.build() });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (designs ?? []).filter(
      (d) =>
        (filter === 'all' || (filter === 'mine' ? d.role === 'owner' : d.role !== 'owner')) &&
        (!q || d.title.toLowerCase().includes(q) || d.owner?.name.toLowerCase().includes(q)),
    );
  }, [designs, filter, query]);

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
    <div className="home">
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
          <ul className="templates" role="list">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <TemplateCard template={t} busy={creating === t.id} disabled={!!creating} onPick={() => void fromTemplate(t)} />
              </li>
            ))}
          </ul>
        </section>

        <section className="home__designs" aria-labelledby="designs-heading">
          <div className="home__designs-head">
            <h2 id="designs-heading" className="home__title">
              Your designs
            </h2>
            <div className="segmented" role="group" aria-label="Show">
              {(['all', 'mine', 'shared'] as Filter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'mine' ? 'Yours' : 'Shared with you'}
                </button>
              ))}
            </div>
            <label className="home__search">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="visually-hidden">Search designs</span>
              <input className="input input--sm" type="search" placeholder="Search designs" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {error ? (
            <div className="home__error" role="alert">
              <p>{error}</p>
              <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : designs === null ? (
            <div className="home__loading">
              <Loader size={36} label="Loading your designs" />
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-state">
              <DesignIcon size={56} />
              <h2>{query || filter !== 'all' ? 'Nothing here' : 'No designs yet'}</h2>
              <p>{query || filter !== 'all' ? 'Try another search or filter.' : 'Pick a size or a template above to make your first one.'}</p>
            </div>
          ) : (
            <ul className="design-grid" role="list">
              {shown.map((d) => (
                <li key={d.id} className="design-card">
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
                      { label: 'Make a copy', icon: <DuplicateIcon size={16} strokeWidth={1.75} />, onSelect: () => void duplicate(d) },
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
