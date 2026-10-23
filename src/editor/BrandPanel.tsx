import { ImagePlus, Palette, Pencil, Plus, Wand2, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api, errorMessage, type BrandKit } from '../api';
import { Dialog } from '../components/Dialog';
import { ColorField } from './ColorField';
import { FONTS } from './model';
import { useImageSrc } from './render';

/** Your brand kits: pick one to use here, apply it to the page, or make and change kits. */
export function BrandPanel({
  kits,
  error,
  activeId,
  designId,
  readOnly,
  onPick,
  onApply,
  onAddLogo,
  onSaved,
  onRetry,
}: {
  kits: BrandKit[] | null;
  error: string | null;
  activeId: string | null;
  designId: string;
  readOnly: boolean;
  onPick(id: string | null): void;
  onApply(): void;
  onAddLogo(src: string): void;
  onSaved(kit: BrandKit): void;
  onRetry(): void;
}) {
  const [editing, setEditing] = useState<BrandKit | 'new' | null>(null);
  const active = kits?.find((k) => k.id === activeId) ?? null;

  return (
    <div className="side-panel">
      <div className="side-panel__head">
        <h3 className="side-panel__title">Brand kits</h3>
        <p className="side-panel__sub muted">A kit’s colours and fonts show first in every picker while it is in use.</p>
      </div>

      {error ? (
        <div className="side-panel__empty" role="alert">
          <p>{error}</p>
          <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : kits === null ? (
        <div className="kits" aria-busy="true">
          <div className="kit kit--skeleton skeleton" />
        </div>
      ) : (
        <>
          {kits.length === 0 ? (
            <div className="side-panel__empty">
              <Palette size={32} strokeWidth={1.5} aria-hidden="true" />
              <p>Keep your colours, fonts and logo together, ready for every design.</p>
            </div>
          ) : (
            <ul className="kits" role="list">
              {kits.map((k, i) => (
                <li key={k.id} className="kit stagger" style={{ '--i': i } as CSSProperties} data-active={k.id === activeId || undefined}>
                  <button type="button" className="kit__pick" aria-pressed={k.id === activeId} onClick={() => onPick(k.id === activeId ? null : k.id)}>
                    <span className="kit__swatches" aria-hidden="true">
                      {k.assets.colors.slice(0, 6).map((c, j) => (
                        <span key={j} style={{ background: c.value }} />
                      ))}
                    </span>
                    <span className="kit__name">{k.name}</span>
                    <span className="kit__fonts muted">{k.assets.fonts.map((f) => f.value).join(', ') || 'No fonts yet'}</span>
                  </button>
                  <button type="button" className="icon-btn kit__edit" aria-label={`Edit ${k.name}`} data-tip="Edit" onClick={() => setEditing(k)}>
                    <Pencil size={15} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="side-panel__actions">
            {active && !readOnly && (
              <button type="button" className="elum-btn elum-btn--primary elum-btn--sm" onClick={onApply}>
                <Wand2 size={15} strokeWidth={1.75} /> Apply {active.name} to this page
              </button>
            )}
            {active?.assets.logo && !readOnly && (
              <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => onAddLogo(active.assets.logo!)}>
                <ImagePlus size={15} strokeWidth={1.75} /> Add the logo
              </button>
            )}
            <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => setEditing('new')}>
              <Plus size={15} strokeWidth={1.75} /> New brand kit
            </button>
          </div>
        </>
      )}

      <KitDialog
        kit={editing}
        designId={designId}
        onClose={() => setEditing(null)}
        onSaved={(k) => {
          onSaved(k);
          setEditing(null);
        }}
      />
    </div>
  );
}

const STARTER = ['#141a2e', '#7093f8', '#f59a52'];

function KitDialog({ kit, designId, onClose, onSaved }: { kit: BrandKit | 'new' | null; designId: string; onClose(): void; onSaved(kit: BrandKit): void }) {
  const [name, setName] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!kit) return;
    setError(null);
    if (kit === 'new') {
      setName('');
      setColors(STARTER);
      setFonts(['Sora', 'Manrope']);
      setLogo(undefined);
    } else {
      setName(kit.name);
      setColors(kit.assets.colors.map((c) => c.value));
      setFonts(kit.assets.fonts.map((f) => f.value));
      setLogo(kit.assets.logo);
    }
  }, [kit]);

  const save = async () => {
    if (!name.trim()) {
      setError('Give the kit a name.');
      return;
    }
    setBusy(true);
    try {
      const saved = await api.saveBrandKit(kit === 'new' || !kit ? null : kit.id, name.trim(), kit && kit !== 'new' ? (kit.description ?? '') : '', {
        colors: colors.map((value) => ({ value })),
        fonts: fonts.map((value) => ({ value })),
        logo,
      });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      setLogo(await api.uploadImage(designId, file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!kit}
      onClose={() => !busy && onClose()}
      title={kit === 'new' ? 'New brand kit' : 'Edit brand kit'}
      width={500}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="kit-form" className="elum-btn elum-btn--primary" disabled={busy}>
            {kit === 'new' ? 'Make the kit' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="kit-form"
        className="kit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <label htmlFor="kit-name">Name</label>
          <input id="kit-name" className="input" value={name} maxLength={80} placeholder="Like “Studio Rosa” or “Spring launch”" onChange={(e) => setName(e.target.value)} />
        </div>

        <fieldset className="kit-form__set">
          <legend>Colours</legend>
          <div className="kit-form__colours">
            {colors.map((c, i) => (
              <span key={i} className="kit-form__colour">
                <ColorField label={`Colour ${i + 1}`} value={c} onChange={(v) => setColors((list) => list.map((x, j) => (j === i ? v : x)))} />
                <button type="button" className="kit-form__remove" aria-label={`Remove colour ${i + 1}`} onClick={() => setColors((list) => list.filter((_, j) => j !== i))}>
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            ))}
            {colors.length < 12 && (
              <button type="button" className="kit-form__add" aria-label="Add a colour" data-tip="Add a colour" onClick={() => setColors((list) => [...list, '#9b84ee'])}>
                <Plus size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </fieldset>

        <fieldset className="kit-form__set">
          <legend>Fonts</legend>
          <p className="muted kit-form__hint">The first is for headings, the second for everything else.</p>
          <div className="kit-form__fonts">
            {FONTS.map((f) => {
              const at = fonts.indexOf(f.family);
              return (
                <button
                  key={f.family}
                  type="button"
                  className="kit-form__font"
                  aria-pressed={at >= 0}
                  style={{ fontFamily: f.family }}
                  onClick={() => setFonts((list) => (at >= 0 ? list.filter((x) => x !== f.family) : [...list, f.family]))}
                >
                  {at >= 0 && <span className="kit-form__order">{at + 1}</span>}
                  {f.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="kit-form__set">
          <legend>Logo</legend>
          <div className="kit-form__logo">
            {logo ? <LogoPreview src={logo} /> : <span className="kit-form__logo-empty muted">No logo yet</span>}
            <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus size={15} strokeWidth={1.75} /> {logo ? 'Change' : 'Upload a logo'}
            </button>
            {logo && (
              <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={() => setLogo(undefined)}>
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(file);
              }}
            />
          </div>
        </fieldset>
        {error && <span className="field-error">{error}</span>}
      </form>
    </Dialog>
  );
}

function LogoPreview({ src }: { src: string }) {
  const url = useImageSrc(src);
  return <span className="kit-form__logo-img">{url && <img src={url} alt="Your logo" />}</span>;
}
