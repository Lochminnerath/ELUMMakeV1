import { Popover } from '../components/Popover';
import { SWATCHES } from './model';

/** A colour button that opens the ELUM palette, with a custom colour for anything else. */
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
      {(close) => (
        <div className="color-pop__body">
          <div className="color-pop__grid" role="group" aria-label={label}>
            {allowNone && (
              <button
                type="button"
                className="color-pop__swatch"
                data-none
                aria-label="No colour"
                aria-pressed={value === 'none'}
                onClick={() => {
                  onChange('none');
                  close();
                }}
              />
            )}
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="color-pop__swatch"
                style={{ background: c }}
                aria-label={c}
                aria-pressed={value.toLowerCase() === c}
                onClick={() => {
                  onChange(c);
                  close();
                }}
              />
            ))}
          </div>
          <label className="color-pop__custom">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#141a2e'} onChange={(e) => onChange(e.target.value)} />
            <span>Custom colour</span>
          </label>
        </div>
      )}
    </Popover>
  );
}
