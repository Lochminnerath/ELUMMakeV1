import { useEffect, useId, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { DesignElement, ImageElement, Page, PathElement, ShapeElement, TextElement } from '../api/types';
import { filterCss, isShape, layoutText, parseBackground, pathD, shapePath, textWidth } from './model';

/**
 * Draws pages as SVG: the canvas, thumbnails, the page strip and presenting all use this, so a
 * design looks the same everywhere. Exports draw the same shapes onto a canvas (export.ts).
 */

const imageCache = new Map<string, string>();

/** The loadable URL for an element's picture (signed links for uploaded pictures). */
export function useImageSrc(src: string): string | null {
  const [url, setUrl] = useState<string | null>(() => imageCache.get(src) ?? (src.startsWith('storage:') ? null : src));
  useEffect(() => {
    let live = true;
    const known = imageCache.get(src);
    if (known) {
      setUrl(known);
      return;
    }
    api.imageUrl(src).then(
      (u) => {
        imageCache.set(src, u);
        if (live) setUrl(u);
      },
      () => live && setUrl(null),
    );
    return () => {
      live = false;
    };
  }, [src]);
  return url;
}

export function PageBackground({ page, width, height }: { page: Page; width: number; height: number }) {
  const id = useId().replace(/:/g, '');
  const bg = parseBackground(page.background);
  if ('color' in bg) return <rect width={width} height={height} fill={bg.color} />;
  const r = ((bg.gradient.angle - 90) * Math.PI) / 180;
  const x = Math.cos(r) / 2;
  const y = Math.sin(r) / 2;
  return (
    <>
      <defs>
        <linearGradient id={`bg-${id}`} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
          <stop offset="0" stopColor={bg.gradient.from} />
          <stop offset="1" stopColor={bg.gradient.to} />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#bg-${id})`} />
    </>
  );
}

/** A fill that may be a gradient: the gradient is defined beside it, and the fill points to it. */
function usePaint(paint: string, prefix: string): { fill: string; defs: ReactNode } {
  const id = `${prefix}-${useId().replace(/:/g, '')}`;
  const p = parseBackground(paint);
  if (paint === 'none') return { fill: 'none', defs: null };
  if ('color' in p) return { fill: p.color, defs: null };
  const r = ((p.gradient.angle - 90) * Math.PI) / 180;
  const x = Math.cos(r) / 2;
  const y = Math.sin(r) / 2;
  return {
    fill: `url(#${id})`,
    defs: (
      <defs>
        <linearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
          <stop offset="0" stopColor={p.gradient.from} />
          <stop offset="1" stopColor={p.gradient.to} />
        </linearGradient>
      </defs>
    ),
  };
}

function Shape({ el }: { el: ShapeElement }) {
  const paint = usePaint(el.fill, 'fill');
  return (
    <>
      {paint.defs}
      <path d={shapePath(el.type, el.w, el.h, el.radius)} fill={paint.fill} stroke={el.strokeWidth > 0 ? el.stroke : 'none'} strokeWidth={el.strokeWidth} strokeLinejoin="round" />
    </>
  );
}

function PathShape({ el }: { el: PathElement }) {
  const paint = usePaint(el.closed ? el.fill : 'none', 'path');
  return (
    <>
      {paint.defs}
      <path
        d={pathD(el)}
        fill={paint.fill}
        stroke={el.strokeWidth > 0 ? el.stroke : 'none'}
        strokeWidth={el.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function TextShape({ el, hideText }: { el: TextElement; hideText?: boolean }) {
  const lines = layoutText(el);
  const lineH = el.fontSize * el.lineHeight;
  const x = el.align === 'center' ? el.w / 2 : el.align === 'right' ? el.w : 0;
  const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
  const pad = el.fontSize * 0.12;
  return (
    <>
    {el.highlight &&
      !hideText &&
      lines.map((line, i) => {
        if (!line.trim()) return null;
        const w = textWidth(line, el);
        const left = el.align === 'center' ? x - w / 2 : el.align === 'right' ? x - w : x;
        return <rect key={`hl-${i}`} x={left - pad} y={i * lineH + (lineH - el.fontSize) / 2 - pad / 2} width={w + pad * 2} height={el.fontSize + pad} rx={pad} fill={el.highlight} />;
      })}
    <text
      fontFamily={`"${el.fontFamily}", Manrope, system-ui, sans-serif`}
      fontSize={el.fontSize}
      fontWeight={el.fontWeight}
      fontStyle={el.italic ? 'italic' : 'normal'}
      textDecoration={el.underline ? 'underline' : undefined}
      letterSpacing={el.letterSpacing || undefined}
      fill={el.color}
      stroke={el.outline && el.outline.width > 0 ? el.outline.color : undefined}
      strokeWidth={el.outline && el.outline.width > 0 ? el.outline.width : undefined}
      strokeLinejoin="round"
      paintOrder="stroke"
      textAnchor={anchor}
      opacity={hideText ? 0 : 1}
      style={{ whiteSpace: 'pre' }}
    >
      {lines.map((line, i) => (
        // Baseline at about 80% of the font size down each line, centred in its line height.
        <tspan key={i} x={x} y={i * lineH + (lineH - el.fontSize) / 2 + el.fontSize * 0.8}>
          {line || ' '}
        </tspan>
      ))}
    </text>
    </>
  );
}

function ImageShape({ el }: { el: ImageElement }) {
  const id = useId().replace(/:/g, '');
  const url = useImageSrc(el.src);
  return (
    <>
      <defs>
        <clipPath id={`clip-${id}`}>
          {el.mask && el.mask !== 'rect' ? <path d={shapePath(el.mask, el.w, el.h)} /> : <rect width={el.w} height={el.h} rx={el.radius} />}
        </clipPath>
      </defs>
      {url ? (
        <image
          href={url}
          width={el.w}
          height={el.h}
          preserveAspectRatio={el.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
          clipPath={`url(#clip-${id})`}
        />
      ) : (
        <rect width={el.w} height={el.h} rx={el.radius} fill="#e2e5ee" clipPath={`url(#clip-${id})`} />
      )}
    </>
  );
}

export function ElementShape({ el, hideText }: { el: DesignElement; hideText?: boolean }): ReactNode {
  switch (el.type) {
    case 'text':
      return <TextShape el={el} hideText={hideText} />;
    case 'image':
      return <ImageShape el={el} />;
    case 'path':
      return <PathShape el={el} />;
    case 'line': {
      const id = `arrow-${el.id}`;
      return (
        <>
          {el.arrow && (
            <defs>
              <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={el.stroke} />
              </marker>
            </defs>
          )}
          <line
            x1={0}
            y1={0}
            x2={el.w}
            y2={el.h}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={el.dashed ? `${el.strokeWidth * 3} ${el.strokeWidth * 2}` : undefined}
            markerEnd={el.arrow ? `url(#${id})` : undefined}
          />
        </>
      );
    }
    default:
      return isShape(el) ? <Shape el={el} /> : null;
  }
}

/** The move, turn and mirror that put an element in place, as an SVG transform. */
export function placeTransform(el: DesignElement): string {
  if (el.type === 'line') return `translate(${el.x} ${el.y})`;
  let t = `translate(${el.x} ${el.y})`;
  if (el.rotation) t += ` rotate(${el.rotation} ${el.w / 2} ${el.h / 2})`;
  if (el.flipX || el.flipY) t += ` translate(${el.flipX ? el.w : 0} ${el.flipY ? el.h : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})`;
  return t;
}

/** One element, moved and rotated into place on its page. */
export function PlacedElement({ el, hideText }: { el: DesignElement; hideText?: boolean }) {
  if (el.hidden) return null;
  const filter = filterCss(el);
  const blend = el.blend && el.blend !== 'normal' ? el.blend : undefined;
  return (
    <g transform={placeTransform(el)} opacity={el.opacity} style={filter || blend ? { filter, mixBlendMode: blend } : undefined}>
      <ElementShape el={el} hideText={hideText} />
    </g>
  );
}

/** A whole page as an SVG that scales to fit its box. */
export function PageView({
  page,
  width,
  height,
  className,
  label,
}: {
  page: Page;
  width: number;
  height: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <PageBackground page={page} width={width} height={height} />
      {page.elements.map((el) => (
        <PlacedElement key={el.id} el={el} />
      ))}
    </svg>
  );
}
