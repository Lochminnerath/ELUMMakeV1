import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Bold, BringToFront, ImageUp, Italic, Lock, SendToBack, Underline, Unlock } from 'lucide-react';
import { DeleteIcon, DuplicateIcon } from '../components/icons/ElumIcons';
import type { ReactNode } from 'react';
import type { DesignElement, Page, TextElement } from '../api/types';
import { ColorField } from './ColorField';
import { backgroundCss, BACKGROUNDS, bounds, FONTS, PAGE_SIZES, textHeight, unionBox } from './model';

/** The panel beside the page: what is selected, and how to change it. With nothing selected, the page. */

export type Arrange = 'front' | 'forward' | 'backward' | 'back';
export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

interface InspectorProps {
  page: Page;
  width: number;
  height: number;
  selected: DesignElement[];
  readOnly: boolean;
  onChange(ids: string[], changes: Partial<DesignElement> | ((el: DesignElement) => DesignElement)): void;
  onPage(changes: Partial<Page>): void;
  onResize(width: number, height: number): void;
  onArrange(how: Arrange): void;
  onAlign(how: Align): void;
  onDistribute(axis: 'x' | 'y'): void;
  onDuplicate(): void;
  onDelete(): void;
  onReplaceImage(): void;
}

const ICON = { size: 16, strokeWidth: 1.75 };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector__section">
      <h3 className="inspector__heading">{title}</h3>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="num-field">
      <span className="num-field__label">{label}</span>
      <input
        className="input input--sm"
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v)) onChange(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : v);
        }}
      />
      {suffix && <span className="num-field__suffix">{suffix}</span>}
    </label>
  );
}

function Toggle({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} data-tip={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function Inspector(props: InspectorProps) {
  const { page, width, height, selected, readOnly, onChange, onPage } = props;

  if (readOnly) {
    return (
      <div className="inspector">
        <p className="inspector__note muted">You can view this design. Ask the owner to let you edit it, or make your own copy from the home page.</p>
        {page.notes && (
          <Section title="Speaker notes">
            <p className="inspector__notes-read">{page.notes}</p>
          </Section>
        )}
      </div>
    );
  }

  if (!selected.length) {
    const size = PAGE_SIZES.find((s) => s.width === width && s.height === height);
    return (
      <div className="inspector">
        <Section title="Page background">
          <div className="bg-grid" role="group" aria-label="Backgrounds">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg}
                type="button"
                className="bg-grid__swatch"
                style={{ background: backgroundCss(bg) }}
                aria-label={bg.startsWith('linear') ? 'Gradient' : bg}
                aria-pressed={page.background === bg}
                onClick={() => onPage({ background: bg })}
              />
            ))}
            <ColorField label="Custom background" value={page.background.startsWith('#') ? page.background : '#ffffff'} onChange={(c) => onPage({ background: c })} />
          </div>
        </Section>
        <Section title="Size">
          <select
            className="select"
            aria-label="Page size"
            value={size?.id ?? 'custom'}
            onChange={(e) => {
              const s = PAGE_SIZES.find((x) => x.id === e.target.value);
              if (s) props.onResize(s.width, s.height);
            }}
          >
            {!size && <option value="custom">Custom ({width} × {height})</option>}
            {PAGE_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {s.width} × {s.height}
              </option>
            ))}
          </select>
          <p className="inspector__hint muted">Every page in the design shares one size. Elements keep their place.</p>
        </Section>
        <Section title="Speaker notes">
          <textarea
            className="textarea"
            rows={4}
            placeholder="Notes for when you present this page"
            value={page.notes ?? ''}
            onChange={(e) => onPage({ notes: e.target.value })}
          />
        </Section>
      </div>
    );
  }

  const ids = selected.map((el) => el.id);
  const one = selected.length === 1 ? selected[0] : null;
  const box = unionBox(selected.map(bounds))!;
  const set = (changes: Partial<DesignElement>) => onChange(ids, changes);
  const texts = selected.filter((el): el is TextElement => el.type === 'text');
  const shapes = selected.filter((el) => el.type === 'rect' || el.type === 'ellipse' || el.type === 'triangle' || el.type === 'star');
  const setText = (changes: Partial<TextElement>) =>
    onChange(
      texts.map((t) => t.id),
      (el) => {
        if (el.type !== 'text') return el;
        const next = { ...el, ...changes };
        return { ...next, h: textHeight(next) };
      },
    );
  const allLocked = selected.every((el) => el.locked);

  return (
    <div className="inspector">
      <Section title={one ? labelFor(one) : `${selected.length} selected`}>
        <div className="inspector__actions">
          <Toggle label="Duplicate (Ctrl+D)" onClick={props.onDuplicate}>
            <DuplicateIcon {...ICON} />
          </Toggle>
          <Toggle label={allLocked ? 'Unlock' : 'Lock'} pressed={allLocked} onClick={() => set({ locked: !allLocked })}>
            {allLocked ? <Lock {...ICON} /> : <Unlock {...ICON} />}
          </Toggle>
          <Toggle label="Bring to front" onClick={() => props.onArrange('front')}>
            <BringToFront {...ICON} />
          </Toggle>
          <Toggle label="Forward" onClick={() => props.onArrange('forward')}>
            <ArrowUpToLine {...ICON} />
          </Toggle>
          <Toggle label="Backward" onClick={() => props.onArrange('backward')}>
            <ArrowDownToLine {...ICON} />
          </Toggle>
          <Toggle label="Send to back" onClick={() => props.onArrange('back')}>
            <SendToBack {...ICON} />
          </Toggle>
          <Toggle label="Delete" onClick={props.onDelete}>
            <DeleteIcon {...ICON} />
          </Toggle>
        </div>
      </Section>

      {texts.length > 0 && (
        <Section title="Text">
          <select className="select" aria-label="Font" value={texts[0].fontFamily} onChange={(e) => setText({ fontFamily: e.target.value })} style={{ fontFamily: texts[0].fontFamily }}>
            {FONTS.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="inspector__row">
            <NumberField label="Size" value={texts[0].fontSize} min={4} max={1000} onChange={(v) => setText({ fontSize: v })} />
            <ColorField label="Text colour" value={texts[0].color} onChange={(c) => setText({ color: c })} />
          </div>
          <div className="inspector__actions">
            <Toggle label="Bold" pressed={texts[0].fontWeight >= 600} onClick={() => setText({ fontWeight: texts[0].fontWeight >= 600 ? 400 : 700 })}>
              <Bold {...ICON} />
            </Toggle>
            <Toggle label="Italic" pressed={texts[0].italic} onClick={() => setText({ italic: !texts[0].italic })}>
              <Italic {...ICON} />
            </Toggle>
            <Toggle label="Underline" pressed={texts[0].underline} onClick={() => setText({ underline: !texts[0].underline })}>
              <Underline {...ICON} />
            </Toggle>
            <span className="inspector__gap" />
            <Toggle label="Align left" pressed={texts[0].align === 'left'} onClick={() => setText({ align: 'left' })}>
              <AlignLeft {...ICON} />
            </Toggle>
            <Toggle label="Centre" pressed={texts[0].align === 'center'} onClick={() => setText({ align: 'center' })}>
              <AlignCenter {...ICON} />
            </Toggle>
            <Toggle label="Align right" pressed={texts[0].align === 'right'} onClick={() => setText({ align: 'right' })}>
              <AlignRight {...ICON} />
            </Toggle>
          </div>
          <div className="inspector__row">
            <NumberField label="Line" value={texts[0].lineHeight} min={0.7} max={3} step={0.05} onChange={(v) => setText({ lineHeight: v })} />
            <NumberField label="Letters" value={texts[0].letterSpacing} min={-20} max={100} step={0.5} onChange={(v) => setText({ letterSpacing: v })} />
          </div>
        </Section>
      )}

      {shapes.length > 0 && (
        <Section title="Shape">
          <div className="inspector__row">
            <span className="inspector__label">Fill</span>
            <ColorField label="Fill" value={(shapes[0] as { fill: string }).fill} onChange={(c) => onChange(shapes.map((s) => s.id), { fill: c } as Partial<DesignElement>)} />
            <span className="inspector__label">Border</span>
            <ColorField label="Border colour" value={(shapes[0] as { stroke: string }).stroke} onChange={(c) => onChange(shapes.map((s) => s.id), { stroke: c } as Partial<DesignElement>)} />
          </div>
          <div className="inspector__row">
            <NumberField label="Border" value={(shapes[0] as { strokeWidth: number }).strokeWidth} min={0} max={200} onChange={(v) => onChange(shapes.map((s) => s.id), { strokeWidth: v } as Partial<DesignElement>)} />
            {shapes[0].type === 'rect' && (
              <NumberField label="Corners" value={(shapes[0] as { radius: number }).radius} min={0} max={2000} onChange={(v) => onChange(shapes.map((s) => s.id), { radius: v } as Partial<DesignElement>)} />
            )}
          </div>
        </Section>
      )}

      {one?.type === 'line' && (
        <Section title="Line">
          <div className="inspector__row">
            <ColorField label="Line colour" value={one.stroke} onChange={(c) => set({ stroke: c } as Partial<DesignElement>)} />
            <NumberField label="Width" value={one.strokeWidth} min={1} max={200} onChange={(v) => set({ strokeWidth: v } as Partial<DesignElement>)} />
          </div>
          <div className="inspector__checks">
            <label>
              <input type="checkbox" checked={one.arrow} onChange={(e) => set({ arrow: e.target.checked } as Partial<DesignElement>)} /> Arrow
            </label>
            <label>
              <input type="checkbox" checked={one.dashed} onChange={(e) => set({ dashed: e.target.checked } as Partial<DesignElement>)} /> Dashed
            </label>
          </div>
        </Section>
      )}

      {one?.type === 'image' && (
        <Section title="Picture">
          <div className="segmented" role="group" aria-label="Fit">
            <button type="button" aria-pressed={one.fit === 'cover'} onClick={() => set({ fit: 'cover' } as Partial<DesignElement>)}>
              Fill frame
            </button>
            <button type="button" aria-pressed={one.fit === 'contain'} onClick={() => set({ fit: 'contain' } as Partial<DesignElement>)}>
              Fit whole picture
            </button>
          </div>
          <div className="inspector__row">
            <NumberField label="Corners" value={one.radius} min={0} max={2000} onChange={(v) => set({ radius: v } as Partial<DesignElement>)} />
            <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={props.onReplaceImage}>
              <ImageUp {...ICON} /> Replace
            </button>
          </div>
        </Section>
      )}

      <Section title="Position">
        {one && one.type !== 'line' ? (
          <>
            <div className="inspector__row">
              <NumberField label="X" value={one.x} onChange={(v) => set({ x: v })} />
              <NumberField label="Y" value={one.y} onChange={(v) => set({ y: v })} />
            </div>
            <div className="inspector__row">
              <NumberField
                label="W"
                value={one.w}
                min={8}
                onChange={(v) => onChange(ids, (el) => (el.type === 'text' ? { ...el, w: v, h: textHeight({ ...el, w: v }) } : { ...el, w: v }))}
              />
              <NumberField label="H" value={one.h} min={8} onChange={(v) => one.type !== 'text' && set({ h: v })} />
            </div>
            <div className="inspector__row">
              <NumberField label="Turn" value={one.rotation} min={-360} max={360} suffix="°" onChange={(v) => set({ rotation: ((v % 360) + 360) % 360 })} />
              <NumberField label="Opacity" value={Math.round(one.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => set({ opacity: v / 100 })} />
            </div>
          </>
        ) : (
          <div className="inspector__row">
            <NumberField label="Opacity" value={Math.round(selected[0].opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => set({ opacity: v / 100 })} />
            <span className="muted inspector__hint">
              {Math.round(box.w)} × {Math.round(box.h)}
            </span>
          </div>
        )}
        <div className="inspector__actions" role="group" aria-label={selected.length > 1 ? 'Align to each other' : 'Align on the page'}>
          <Toggle label="Align left" onClick={() => props.onAlign('left')}>
            <AlignStartVertical {...ICON} />
          </Toggle>
          <Toggle label="Centre across" onClick={() => props.onAlign('hcenter')}>
            <AlignCenterVertical {...ICON} />
          </Toggle>
          <Toggle label="Align right" onClick={() => props.onAlign('right')}>
            <AlignEndVertical {...ICON} />
          </Toggle>
          <Toggle label="Align top" onClick={() => props.onAlign('top')}>
            <AlignStartHorizontal {...ICON} />
          </Toggle>
          <Toggle label="Centre down" onClick={() => props.onAlign('vcenter')}>
            <AlignCenterHorizontal {...ICON} />
          </Toggle>
          <Toggle label="Align bottom" onClick={() => props.onAlign('bottom')}>
            <AlignEndHorizontal {...ICON} />
          </Toggle>
        </div>
        {selected.length > 2 && (
          <div className="inspector__row">
            <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => props.onDistribute('x')}>
              Space evenly across
            </button>
            <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => props.onDistribute('y')}>
              Space evenly down
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

export function labelFor(el: DesignElement): string {
  if (el.name) return el.name;
  switch (el.type) {
    case 'text':
      return el.text.split('\n')[0].slice(0, 40) || 'Text';
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return 'Circle';
    case 'triangle':
      return 'Triangle';
    case 'star':
      return 'Star';
    case 'line':
      return el.arrow ? 'Arrow' : 'Line';
    case 'image':
      return 'Picture';
  }
}
