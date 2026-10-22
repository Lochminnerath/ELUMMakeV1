export type { Role } from './errors';

/** A minimal public profile, returned when searching for people. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  color: string;
  accountType: 'external' | 'google' | 'github';
}

/** Full user information returned from authenticated endpoints. */
export interface User extends PublicUser {
  createdAt: string;
}

/** A signed-in session containing the user. */
export interface Session {
  user: User;
}

/** User role within a shared design. */
export type ShareRole = 'viewer' | 'commenter' | 'editor';

/** A share record linking a user to a design with a role. */
export interface Share {
  id: string;
  name: string;
  email: string;
  color: string;
  accountType: 'external' | 'google' | 'github';
  role: ShareRole;
}

/** A design summary, used in list views. */
export interface DesignSummary {
  id: string;
  title: string;
  kind: 'presentation' | 'document' | 'poster' | 'social';
  width: number;
  height: number;
  role: Role | null;
  owner: User | null;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  cover: string | null;
  tags?: string[];
  viewCount?: number;
}

/** Full design with content. */
export interface Design extends DesignSummary {
  content: DesignContent;
  version: number;
  updatedBy: User | null;
}

/** Input for creating a new design. */
export interface NewDesignInput {
  title?: string;
  kind?: 'presentation' | 'document' | 'poster' | 'social';
  width?: number;
  height?: number;
  content?: DesignContent;
  tags?: string[];
}

/** Result of saving a design. */
export interface SaveResult {
  version: number;
  updatedAt: string;
}

/** A design page (image URL or JSON content). */
export type DesignPage = string | Record<string, unknown>;

/** Design content containing pages. */
export interface DesignContent {
  pages: DesignPage[];
}

/** Brand kit asset (color or font). */
export interface BrandKitAsset {
  id?: string;
  value: string;
  label?: string;
}

/** A brand kit containing colors, fonts, and optional logo. */
export interface BrandKit {
  id: string;
  name: string;
  description: string | null;
  assets: {
    colors: BrandKitAsset[];
    fonts: BrandKitAsset[];
    logo?: string;
  };
  isPublic: boolean;
  updatedAt: string;
  owner: User | null;
}

/** A comment on a design. */
export interface Comment {
  id: string;
  body: string;
  position: { page: number; x: number; y: number } | null;
  resolved: boolean;
  user: User;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

/** An annotation on a design page. */
export interface Annotation {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  body: string;
  resolved: boolean;
  user: User;
  createdAt: string;
  updatedAt: string;
}

/** A design version for history/restore. */
export interface DesignVersion {
  version: number;
  title: string;
  savedBy: User | null;
  savedAt: string;
  preview: string | null;
}

/** A saved design template. */
export interface DesignTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  kind: 'presentation' | 'document' | 'poster' | 'social';
  width: number;
  height: number;
  thumbnail: string | null;
  isPublic: boolean;
  updatedAt: string;
  owner: User | null;
}

/** A favorite design. */
export interface Favorite {
  id: string;
  designId: string;
  createdAt: string;
}

/** Sign-up input. */
export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  accountType?: 'external' | 'google' | 'github';
}

/** Sign-in input. */
export interface SignInInput {
  email: string;
  password: string;
}

/** Accepted image MIME types for uploads. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];
