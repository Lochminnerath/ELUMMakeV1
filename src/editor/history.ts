import { useCallback, useRef, useState } from 'react';

/**
 * Undo and redo for the design. Most changes are one step each. A drag (move, resize, rotate)
 * updates the screen live with `preview` and becomes a single step when it ends with `commit`.
 */
export interface History<T> {
  value: T;
  /** A change that is one undo step. */
  change(next: T | ((current: T) => T)): void;
  /** A live change during a drag; not a step until `commit`. */
  preview(next: T | ((current: T) => T)): void;
  /** Ends a drag: the state before it becomes one undo step (if anything changed). */
  commit(): void;
  /** Replaces everything without a step, such as when loading or after someone else's save. */
  reset(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

const LIMIT = 100;

export function useHistory<T>(initial: T): History<T> {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] });
  // The state when a drag began.
  const dragStart = useRef<T | null>(null);

  const resolve = (next: T | ((current: T) => T), current: T) => (typeof next === 'function' ? (next as (c: T) => T)(current) : next);

  const change = useCallback((next: T | ((current: T) => T)) => {
    setState((s) => {
      const value = resolve(next, s.present);
      if (value === s.present) return s;
      return { past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const preview = useCallback((next: T | ((current: T) => T)) => {
    setState((s) => {
      if (dragStart.current === null) dragStart.current = s.present;
      return { ...s, present: resolve(next, s.present) };
    });
  }, []);

  const commit = useCallback(() => {
    const before = dragStart.current;
    dragStart.current = null;
    if (before === null) return;
    setState((s) => (s.present === before ? s : { past: [...s.past, before].slice(-LIMIT), present: s.present, future: [] }));
  }, []);

  const reset = useCallback((next: T) => {
    dragStart.current = null;
    setState({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return {
    value: state.present,
    change,
    preview,
    commit,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
