/** Logos from the ELUM brand kit, swapped for the reversed set on dark grounds. */

export function MakeLockup({ height = 28 }: { height?: number }) {
  // The lockup's viewBox is 337 x 104.
  const width = Math.round((height * 337) / 104);
  return (
    <span className="brand-lockup" style={{ height }}>
      <img className="theme-light-only" src="/brand/make/elum-make-lockup.svg" width={width} height={height} alt="ELUM Make" />
      <img className="theme-dark-only" src="/brand/make/elum-make-lockup-reversed.svg" width={width} height={height} alt="ELUM Make" />
    </span>
  );
}

export function MakeMark({ size = 32 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ height: size }}>
      <img className="theme-light-only" src="/brand/make/elum-make-mark.svg" width={size} height={size} alt="" />
      <img className="theme-dark-only" src="/brand/make/elum-make-mark-reversed.svg" width={size} height={size} alt="" />
    </span>
  );
}

export function ElumLockup({ height = 20 }: { height?: number }) {
  return (
    <span className="brand-lockup" style={{ height }}>
      <img className="theme-light-only" src="/brand/logos/elum-lockup-horizontal.svg" height={height} alt="ELUM" />
      <img className="theme-dark-only" src="/brand/logos/elum-lockup-horizontal-reversed.svg" height={height} alt="ELUM" />
    </span>
  );
}

/** The symbol for a single Make design: a slide on its stack, with the Make mark on it. */
export function DesignIcon({ size = 24, label }: { size?: number; label?: string }) {
  // The symbol's viewBox is 60 x 48; size is its height.
  const width = Math.round((size * 60) / 48);
  const alt = label ?? '';
  return (
    <span className="design-icon" style={{ height: size, width }} aria-hidden={label ? undefined : true}>
      <img className="theme-light-only" src="/brand/make/elum-make-design.svg" width={width} height={size} alt={alt} />
      <img className="theme-dark-only" src="/brand/make/elum-make-design-reversed.svg" width={width} height={size} alt={alt} />
    </span>
  );
}
