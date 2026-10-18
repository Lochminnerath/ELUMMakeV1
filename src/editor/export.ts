import { api } from '../api';
import type { DesignElement, Page, TextElement } from '../api/types';
import { fontString, layoutText, parseBackground } from './model';

/**
 * Exports: each page drawn onto a canvas, then saved as PNG, or gathered into a PDF.
 * The drawing mirrors render.tsx so exports match what is on screen.
 */

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const url = await api.imageUrl(src);
    // Fetched as a blob first, so the canvas stays exportable (no cross-origin taint).
    const blob = await (await fetch(url)).blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement) {
  const lines = layoutText(el);
  const lineH = el.fontSize * el.lineHeight;
  ctx.font = fontString(el);
  ctx.fillStyle = el.color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = el.align;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${el.letterSpacing}px`;
  const x = el.align === 'center' ? el.w / 2 : el.align === 'right' ? el.w : 0;
  lines.forEach((line, i) => {
    const y = i * lineH + (lineH - el.fontSize) / 2 + el.fontSize * 0.8;
    ctx.fillText(line, x, y);
    if (el.underline && line) {
      const width = ctx.measureText(line).width;
      const start = el.align === 'center' ? x - width / 2 : el.align === 'right' ? x - width : x;
      ctx.fillRect(start, y + el.fontSize * 0.1, width, Math.max(1, el.fontSize / 15));
    }
  });
}

async function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement) {
  if (el.hidden) return;
  ctx.save();
  ctx.globalAlpha = el.opacity;
  ctx.translate(el.x, el.y);
  if (el.type !== 'line' && el.rotation) {
    ctx.translate(el.w / 2, el.h / 2);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-el.w / 2, -el.h / 2);
  }
  if (el.type === 'text') drawText(ctx, el);
  else if (el.type === 'line') {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';
    if (el.dashed) ctx.setLineDash([el.strokeWidth * 3, el.strokeWidth * 2]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(el.w, el.h);
    ctx.stroke();
    if (el.arrow) {
      const a = Math.atan2(el.h, el.w);
      const s = el.strokeWidth * 4;
      ctx.setLineDash([]);
      ctx.fillStyle = el.stroke;
      ctx.beginPath();
      ctx.moveTo(el.w, el.h);
      ctx.lineTo(el.w - s * Math.cos(a - 0.45), el.h - s * Math.sin(a - 0.45));
      ctx.lineTo(el.w - s * Math.cos(a + 0.45), el.h - s * Math.sin(a + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  } else if (el.type === 'image') {
    const img = await loadImage(el.src);
    roundedRect(ctx, el.w, el.h, el.radius);
    ctx.clip();
    if (img) {
      const scale = el.fit === 'cover' ? Math.max(el.w / img.naturalWidth, el.h / img.naturalHeight) : Math.min(el.w / img.naturalWidth, el.h / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (el.w - w) / 2, (el.h - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#e2e5ee';
      ctx.fillRect(0, 0, el.w, el.h);
    }
  } else {
    ctx.beginPath();
    if (el.type === 'rect') ctx.roundRect(0, 0, el.w, el.h, Math.max(0, Math.min(el.radius, el.w / 2, el.h / 2)));
    else if (el.type === 'ellipse') ctx.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
    else if (el.type === 'triangle') {
      ctx.moveTo(el.w / 2, 0);
      ctx.lineTo(el.w, el.h);
      ctx.lineTo(0, el.h);
      ctx.closePath();
    } else {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.2;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const px = el.w / 2 + Math.cos(a) * r * el.w;
        const py = el.h / 2 + Math.sin(a) * r * el.h * 1.05 + el.h * 0.03;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draws a page onto a new canvas, `scale` times its design size. */
export async function renderPage(page: Page, width: number, height: number, scale = 1): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const bg = parseBackground(page.background);
  if ('color' in bg) ctx.fillStyle = bg.color;
  else {
    const r = ((bg.gradient.angle - 90) * Math.PI) / 180;
    const dx = (Math.cos(r) * width) / 2;
    const dy = (Math.sin(r) * height) / 2;
    const g = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
    g.addColorStop(0, bg.gradient.from);
    g.addColorStop(1, bg.gradient.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, width, height);
  for (const el of page.elements) await drawElement(ctx, el);
  return canvas;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Design';
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), type, quality));

export async function exportPng(page: Page, width: number, height: number, filename: string) {
  // Large enough to stay sharp, small enough for any browser's canvas limit.
  const scale = Math.min(2, 8000 / Math.max(width, height));
  download(await toBlob(await renderPage(page, width, height, scale), 'image/png'), `${filename}.png`);
}

export async function exportPdf(pages: Page[], width: number, height: number, filename: string) {
  const scale = Math.min(1.5, 6000 / Math.max(width, height));
  const images: Uint8Array[] = [];
  for (const page of pages) {
    const blob = await toBlob(await renderPage(page, width, height, scale), 'image/jpeg', 0.92);
    images.push(new Uint8Array(await blob.arrayBuffer()));
  }
  download(buildPdf(images, Math.round(width * scale), Math.round(height * scale), width * 0.75, height * 0.75), `${filename}.pdf`);
}

/**
 * A minimal PDF: one page per JPEG, each filling a page of the design's size (in points, at
 * 96 pixels to 72 points). JPEGs embed as they are (DCTDecode), so nothing is re-encoded.
 */
export function buildPdf(jpegs: Uint8Array[], pixelWidth: number, pixelHeight: number, pointWidth: number, pointHeight: number): Blob {
  return new Blob(pdfBytes(jpegs, pixelWidth, pixelHeight, pointWidth, pointHeight) as BlobPart[], { type: 'application/pdf' });
}

export function pdfBytes(jpegs: Uint8Array[], pixelWidth: number, pixelHeight: number, pointWidth: number, pointHeight: number): Uint8Array[] {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  const n = jpegs.length;
  // 1 catalog, 2 pages, then per page: page, image, contents.
  const pageId = (i: number) => 3 + i * 3;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${jpegs.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`));
  const w = pointWidth.toFixed(2);
  const h = pointHeight.toFixed(2);
  jpegs.forEach((jpeg, i) => {
    const p = pageId(i);
    object(p, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`),
    );
    object(p + 1, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(p + 2, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  });
  const xref = length;
  const count = 3 + n * 3;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return chunks;
}
