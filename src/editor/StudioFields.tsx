import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Blend, DesignElement, ImageAdjust, ImageElement, PathElement, ShapeType, TextElement } from '../api/types';
import { ColorField } from './ColorField';
import { BLENDS, isGradient, NO_ADJUST, parseBackground, PHOTO_FILTERS, SHAPES, shapePath, textHeight } from './model';

/**
 * The design-studio parts of the panel beside the page: gradient fills, pen paths, text effects,
 * picture adjustments and masks, and effects any element can have (flip, shadow, blur, blend).
 */

type Change = (ids: string[], changes: Partial<DesignElement> | ((el: DesignElement) => DesignElement)) => void;

const ICON = { size: 16, strokeWidth: 1.75 };

/** A labelled slider with its number beside it. */
export function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange(v: number): void }) {
  return (
    <label className="slider">
      <span className="slider__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className="slider__value">
        {Math.round(value * 10) / 10}
        {suffix}
      </span>
    </label>
  );
}

/**
 * A fill that is a plain colour or a two-colour gradient. Gradients are written the same way as
 * page backgrounds ("linear:<angle>:<from>:<to>").
 */
export function PaintField({ label, value, onChange, allowNone = false }: { label: string; value: string; onChange(paint: string): void; allowNone?: boolean }) {
  const p = parseBackground(value === 'none' ? '#ffffff' : value);
  const gradient = 'gradient' in p ? p.gradient : null;
  const solid = 'color' in p ? p.color : gradient!.from;
  const g = gradient ?? { angle: 135, from: solid, to: '#9b84ee' };
  const write = (next: typeof g) => onChange(`linear:${Math.round(next.angle)}:${next.from}:${next.to}`);
  return (
    <div className="paint-field">
      <div className="segmented segmented--sm" role="group" aria-label={`${label}: colour or gradient`}>
        {allowNone && (
          <button type="button" aria-pressed={value === 'none'} onClick={() => onChange('none')}>
            None
          </button>
        )}
        <button type="button" aria-pressed={value !== 'none' && !isGradient(value)} onClick={() => onChange(solid)}>
          Colour
        </button>
        <button type="button" aria-pressed={isGradient(value)} onClick={() => write(g)}>
          Gradient
        </button>
      </div>
      {value !== 'none' && !gradient && <ColorField label={label} value={solid} onChange={onChange} />}
      {gradient && (
        <div className="paint-field__gradient">
          <span className="paint-field__preview" style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }} aria-hidden="true" />
          <ColorField label={`${label}: start colour`} value={g.from} onChange={(c) => write({ ...g, from: c })} />
          <ColorField label={`${label}: end colour`} value={g.to} onChange={(c) => write({ ...g, to: c })} />
          <Slider label="Angle" value={g.angle} min={0} max={360} suffix="°" onChange={(v) => write({ ...g, angle: v })} />
        </div>
      )}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="inspector__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

/** A pen or brush path: its line and, when closed, its fill. */
export function PathFields({ paths, onChange }: { paths: PathElement[]; onChange: Change }) {
  const ids = paths.map((p) => p.id);
  const first = paths[0];
  const set = (changes: Partial<PathElement>) => onChange(ids, changes as Partial<DesignElement>);
  return (
    <>
      <div className="inspector__row">
        <span className="inspector__label">Line</span>
        <ColorField label="Line colour" value={first.stroke} onChange={(c) => set({ stroke: c })} />
        <Slider label="Width" value={first.strokeWidth} min={0} max={80} onChange={(v) => set({ strokeWidth: v })} />
      </div>
      {first.closed && (
        <div className="inspector__field">
          <span className="inspector__label">Fill</span>
          <PaintField label="Fill" value={first.fill} allowNone onChange={(c) => set({ fill: c })} />
        </div>
      )}
      <div className="inspector__checks">
        <Checkbox label="Smooth curves" checked={first.smooth} onChange={(v) => set({ smooth: v })} />
        <Checkbox label="Closed shape" checked={first.closed} onChange={(v) => set({ closed: v, fill: v && first.fill === 'none' ? '#bacafc' : first.fill })} />
      </div>
      {paths.length === 1 && <p className="inspector__hint muted">Double-click the path to move its points.</p>}
    </>
  );
}

/** Capitals, an outline round each letter, and a highlighter band behind each line. */
export function TextEffects({ texts, onChange }: { texts: TextElement[]; onChange: Change }) {
  const first = texts[0];
  const set = (changes: Partial<TextElement>) =>
    onChange(
      texts.map((t) => t.id),
      (el) => {
        if (el.type !== 'text') return el;
        const next = { ...el, ...changes };
        return { ...next, h: textHeight(next) };
      },
    );
  const outline = first.outline ?? { color: '#141a2e', width: 0 };
  return (
    <div className="inspector__group">
      <div className="inspector__checks">
        <Checkbox label="Capitals" checked={!!first.uppercase} onChange={(v) => set({ uppercase: v || undefined })} />
        <Checkbox label="Outline" checked={outline.width > 0} onChange={(v) => set({ outline: v ? { color: outline.color, width: Math.max(1, Math.round(first.fontSize / 24)) } : undefined })} />
        <Checkbox label="Highlight" checked={!!first.highlight} onChange={(v) => set({ highlight: v ? '#fde68a' : undefined })} />
      </div>
      {outline.width > 0 && (
        <div className="inspector__row">
          <span className="inspector__label">Outline</span>
          <ColorField label="Outline colour" value={outline.color} onChange={(c) => set({ outline: { ...outline, color: c } })} />
          <Slider label="Width" value={outline.width} min={0} max={Math.max(20, Math.round(first.fontSize / 4))} onChange={(v) => set({ outline: { ...outline, width: v } })} />
        </div>
      )}
      {first.highlight && (
        <div className="inspector__row">
          <span className="inspector__label">Highlight</span>
          <ColorField label="Highlight colour" value={first.highlight} onChange={(c) => set({ highlight: c })} />
        </div>
      )}
    </div>
  );
}

/** Ready-made looks, sliders for light and colour, and a shape to show the picture inside. */
export function PictureFields({ el, onChange }: { el: ImageElement; onChange: Change }) {
  const adjust = el.adjust ?? NO_ADJUST;
  const setAdjust = (changes: Partial<ImageAdjust>) => onChange([el.id], { adjust: { ...adjust, ...changes } } as Partial<DesignElement>);
  const same = (a: ImageAdjust) => (Object.keys(NO_ADJUST) as (keyof ImageAdjust)[]).every((k) => a[k] === adjust[k]);
  return (
    <>
      <div className="inspector__field">
        <span className="inspector__label">Filters</span>
        <div className="photo-filters" role="group" aria-label="Filters">
          {PHOTO_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="photo-filters__item"
              aria-pressed={same(f.adjust)}
              onClick={() => onChange([el.id], { adjust: f.id === 'original' ? undefined : f.adjust } as Partial<DesignElement>)}
            >
              <span className="photo-filters__swatch" style={{ filter: filterFor(f.adjust) }} aria-hidden="true" />
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="inspector__group">
        <Slider label="Brightness" value={adjust.brightness} min={0} max={200} suffix="%" onChange={(v) => setAdjust({ brightness: v })} />
        <Slider label="Contrast" value={adjust.contrast} min={0} max={200} suffix="%" onChange={(v) => setAdjust({ contrast: v })} />
        <Slider label="Saturation" value={adjust.saturate} min={0} max={300} suffix="%" onChange={(v) => setAdjust({ saturate: v })} />
        <Slider label="Black and white" value={adjust.grayscale} min={0} max={100} suffix="%" onChange={(v) => setAdjust({ grayscale: v })} />
        <Slider label="Warmth" value={adjust.sepia} min={0} max={100} suffix="%" onChange={(v) => setAdjust({ sepia: v })} />
        <Slider label="Hue" value={adjust.hue} min={0} max={360} suffix="°" onChange={(v) => setAdjust({ hue: v })} />
      </div>
      <div className="inspector__field">
        <span className="inspector__label">Shape</span>
        <div className="mask-grid" role="group" aria-label="Show the picture inside a shape">
          {SHAPES.filter((x) => x.type !== 'arrow' && x.type !== 'bubble').map((x) => (
            <button
              key={x.type}
              type="button"
              className="mask-grid__item"
              aria-label={x.label}
              data-tip={x.label}
              aria-pressed={(el.mask ?? 'rect') === x.type}
              onClick={() => onChange([el.id], { mask: x.type === 'rect' ? undefined : (x.type as ShapeType) } as Partial<DesignElement>)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d={shapePath(x.type, 20, 20, x.type === 'rect' ? 3 : 0)} transform="translate(2 2)" fill="currentColor" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const filterFor = (a: ImageAdjust) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) grayscale(${a.grayscale}%) sepia(${a.sepia}%) hue-rotate(${a.hue}deg)`;

/** Flip, shadow, blur and blend: for anything on the page. */
export function EffectsFields({ selected, onChange, children }: { selected: DesignElement[]; onChange: Change; children?: ReactNode }) {
  const ids = selected.map((el) => el.id);
  const first = selected[0];
  const set = (changes: Partial<DesignElement>) => onChange(ids, changes);
  const shadow = first.shadow;
  const flippable = selected.some((el) => el.type !== 'line');
  return (
    <>
      {flippable && (
        <div className="inspector__actions">
          <button type="button" className="icon-btn" aria-label="Flip side to side" data-tip="Flip side to side" aria-pressed={!!first.flipX} onClick={() => set({ flipX: !first.flipX || undefined })}>
            <FlipHorizontal2 {...ICON} />
          </button>
          <button type="button" className="icon-btn" aria-label="Flip upside down" data-tip="Flip upside down" aria-pressed={!!first.flipY} onClick={() => set({ flipY: !first.flipY || undefined })}>
            <FlipVertical2 {...ICON} />
          </button>
        </div>
      )}
      <div className="inspector__checks">
        <Checkbox label="Shadow" checked={!!shadow} onChange={(v) => set({ shadow: v ? { x: 0, y: 12, blur: 28, color: '#141a2e66' } : undefined })} />
      </div>
      {shadow && (
        <div className="inspector__group">
          <div className="inspector__row">
            <span className="inspector__label">Colour</span>
            <ColorField label="Shadow colour" value={shadow.color.slice(0, 7)} onChange={(c) => set({ shadow: { ...shadow, color: `${c}${shadow.color.slice(7) || '66'}` } })} />
          </div>
          <Slider label="Across" value={shadow.x} min={-100} max={100} onChange={(v) => set({ shadow: { ...shadow, x: v } })} />
          <Slider label="Down" value={shadow.y} min={-100} max={100} onChange={(v) => set({ shadow: { ...shadow, y: v } })} />
          <Slider label="Softness" value={shadow.blur} min={0} max={120} onChange={(v) => set({ shadow: { ...shadow, blur: v } })} />
          <Slider
            label="Strength"
            value={Math.round((parseInt(shadow.color.slice(7, 9) || 'ff', 16) / 255) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => set({ shadow: { ...shadow, color: `${shadow.color.slice(0, 7)}${Math.round((v / 100) * 255).toString(16).padStart(2, '0')}` } })}
          />
        </div>
      )}
      <Slider label="Blur" value={first.blur ?? 0} min={0} max={60} onChange={(v) => set({ blur: v || undefined })} />
      <label className="inspector__field">
        <span className="inspector__label">Blend</span>
        <select className="select" aria-label="Blend mode" value={first.blend ?? 'normal'} onChange={(e) => set({ blend: e.target.value === 'normal' ? undefined : (e.target.value as Blend) })}>
          {BLENDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {children}
    </>
  );
}
