import { useEffect, useId, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { DesignElement, ImageElement, Page, TextElement } from '../api/types';
import { layoutText, parseBackground, starPoints } from './model';

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

function TextShape({ el, hideText }: { el: TextElement; hideText?: boolean }) {
  const lines = layoutText(el);
  const lineH = el.fontSize * el.lineHeight;
  const x = el.align === 'center' ? el.w / 2 : el.align === 'right' ? el.w : 0;
  const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
  return (
    <text
      fontFamily={`"${el.fontFamily}", Manrope, system-ui, sans-serif`}
      fontSize={el.fontSize}
      fontWeight={el.fontWeight}
      fontStyle={el.italic ? 'italic' : 'normal'}
      textDecoration={el.underline ? 'underline' : undefined}
      letterSpacing={el.letterSpacing || undefined}
      fill={el.color}
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
  );
}

function ImageShape({ el }: { el: ImageElement }) {
  const id = useId().replace(/:/g, '');
  const url = useImageSrc(el.src);
  return (
    <>
      <defs>
        <clipPath id={`clip-${id}`}>
          <rect width={el.w} height={el.h} rx={el.radius} />
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
        <rect width={el.w} height={el.h} rx={el.radius} fill="#e2e5ee" />
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
    default: {
      const common = { fill: el.fill, stroke: el.strokeWidth > 0 ? el.stroke : 'none', strokeWidth: el.strokeWidth };
      if (el.type === 'rect') return <rect width={el.w} height={el.h} rx={Math.min(el.radius, el.w / 2, el.h / 2)} {...common} />;
      if (el.type === 'ellipse') return <ellipse cx={el.w / 2} cy={el.h / 2} rx={el.w / 2} ry={el.h / 2} {...common} />;
      if (el.type === 'triangle') return <polygon points={`${el.w / 2},0 ${el.w},${el.h} 0,${el.h}`} strokeLinejoin="round" {...common} />;
      return <polygon points={starPoints(el.w, el.h)} strokeLinejoin="round" {...common} />;
    }
  }
}

/** One element, moved and rotated into place on its page. */
export function PlacedElement({ el, hideText }: { el: DesignElement; hideText?: boolean }) {
  if (el.hidden) return null;
  const transform =
    el.type === 'line' || !el.rotation
      ? `translate(${el.x} ${el.y})`
      : `translate(${el.x} ${el.y}) rotate(${el.rotation} ${el.w / 2} ${el.h / 2})`;
  return (
    <g transform={transform} opacity={el.opacity}>
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
