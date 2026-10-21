import { useState } from 'react';
import { Popover } from '../components/Popover';
import { SWATCHES } from './model';

const RECENT_KEY = 'elum.make.custom-colours';
const RECENT_LIMIT = 8;

/** #abc or #aabbcc, with or without the #, as #aabbcc; null for anything else. */
export function parseHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return null;
}

/** The custom colours used on this device, newest first. */
export function recentColours(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && parseHex(c) === c) : [];
  } catch {
    return [];
  }
}

export function rememberColour(colour: string): string[] {
  const next = [colour, ...recentColours().filter((c) => c !== colour)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Without storage the colour still applies; it is just not remembered.
  }
  return next;
}

/** A colour button that opens the ELUM palette, your own colours, and any colour by picker or code. */
export function ColorField({ label, value, onChange, allowNone = false }: { label: string; value: string; onChange(color: string): void; allowNone?: boolean }) {
  return (
    <Popover
      label={label}
      placement="bottom-start"
      className="color-pop"
      trigger={(props) => (
        <button type="button" className="color-field" aria-label={`${label}: ${value === 'none' ? 'none' : value}`} data-tip={label} {...props}>
          <span className="color-field__chip" data-none={value === 'none' || undefined} style={value === 'none' ? undefined : { background: value }} />
        </button>
      )}
    >
      {(close) => <ColourPanel label={label} value={value} allowNone={allowNone} onChange={onChange} close={close} />}
    </Popover>
  );
}

function ColourPanel({ label, value, allowNone, onChange, close }: { label: string; value: string; allowNone: boolean; onChange(color: string): void; close(): void }) {
  const [recent, setRecent] = useState(recentColours);
  const [code, setCode] = useState(/^#[0-9a-f]{6}$/i.test(value) ? value : '');
  const parsed = parseHex(code);

  const pick = (colour: string, keepOpen = false) => {
    onChange(colour);
    if (!keepOpen) close();
  };
  const custom = (colour: string, keepOpen = false) => {
    setRecent(rememberColour(colour));
    setCode(colour);
    pick(colour, keepOpen);
  };

  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      className="color-pop__swatch"
      style={{ background: c }}
      aria-label={c}
      aria-pressed={value.toLowerCase() === c}
      onClick={() => pick(c)}
    />
  );

  return (
    <div className="color-pop__body">
      <div className="color-pop__grid" role="group" aria-label={label}>
        {allowNone && (
          <button type="button" className="color-pop__swatch" data-none aria-label="No colour" aria-pressed={value === 'none'} onClick={() => pick('none')} />
        )}
        {SWATCHES.map(swatch)}
      </div>
      {recent.length > 0 && (
        <div className="color-pop__recent">
          <span className="color-pop__heading">Your colours</span>
          <div className="color-pop__grid" role="group" aria-label="Your colours">
            {recent.map(swatch)}
          </div>
        </div>
      )}
      <div className="color-pop__custom">
        <label className="color-pop__wheel" data-tip="Pick any colour">
          <input
            type="color"
            aria-label="Pick any colour"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#141a2e'}
            onInput={(e) => {
              // While dragging in the picker: show the colour, keep the panel open.
              setCode((e.target as HTMLInputElement).value);
              onChange((e.target as HTMLInputElement).value);
            }}
            onChange={(e) => custom(e.target.value, true)}
          />
        </label>
        <form
          className="color-pop__code"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed) custom(parsed);
          }}
        >
          <input
            type="text"
            inputMode="text"
            aria-label="Colour code"
            placeholder="#12ab34"
            spellCheck={false}
            maxLength={7}
            value={code}
            aria-invalid={code !== '' && !parsed}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="elum-btn elum-btn--secondary elum-btn--sm" disabled={!parsed}>
            Use
          </button>
        </form>
      </div>
    </div>
  );
}
