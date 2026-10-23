import { createContext, useContext } from 'react';
import type { BrandKit } from '../api/types';

/** The brand kit in use in the editor: its colours and fonts come first in every picker. */
export interface ActiveKit {
  id: string;
  name: string;
  colors: string[];
  fonts: string[];
  logo?: string;
}

export const KitContext = createContext<ActiveKit | null>(null);

export function useKit(): ActiveKit | null {
  return useContext(KitContext);
}

export function toActiveKit(kit: BrandKit): ActiveKit {
  return {
    id: kit.id,
    name: kit.name,
    colors: kit.assets.colors.map((c) => c.value.toLowerCase()).filter((c) => /^#[0-9a-f]{6}$/.test(c)),
    fonts: kit.assets.fonts.map((f) => f.value).filter(Boolean),
    logo: kit.assets.logo,
  };
}

const KEY = 'elum.make.kit';

/** The kit picked in the editor, remembered on this device. */
export function rememberedKit(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberKit(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered; the kit still applies for now.
  }
}
