/**
 * Shared data shapes for ELUM Make. The Supabase API and the in-browser preview API both speak
 * these, so the screens never know which one is behind them.
 */

/** What someone can do with a design. */
export type Role = 'owner' | 'editor' | 'viewer';
export type ShareRole = Exclude<Role, 'owner'>;

/**
 * `type`: an ELUM Type address (handle@elum.space).
 * `external`: the person's own email provider.
 */
export type AccountType = 'type' | 'external';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Avatar colour, one of the product colours. */
  color: string;
  accountType: AccountType;
  createdAt: string;
  /** Their profile picture (set in ELUM Account), as a link the browser can load. */
  pictureUrl?: string | null;
}

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'color'>;

export interface Session {
  user: User;
}

export interface SignUpInput {
  name: string;
  /** Their own email, for `external` accounts. Unused for Type accounts. */
  email: string;
  password: string;
  /** Defaults to `external`. `type` creates an ELUM Type address (needs the ELUM platform). */
  accountType?: AccountType;
  /** Type accounts: the name before @<type domain>. */
  handle?: string;
  /** Type accounts: an outside address for getting back in after a forgotten password. */
  recoveryEmail?: string;
}

export interface SignInInput {
  /** An email, an ELUM Type address, or just the name before @<type domain>. */
  email: string;
  password: string;
}

// ------------------------------------------------------------------ designs

export type DesignKind = 'presentation' | 'poster' | 'social' | 'custom';

/** A design's pages and what is on them. Kept here so the API layer has no editor dependency. */
export interface DesignContent {
  pages: Page[];
}

export interface Page {
  id: string;
  /** A colour, or a CSS gradient written as "linear:<angle>:<from>:<to>". */
  background: string;
  elements: DesignElement[];
  /** Speaker notes, shown when presenting. */
  notes?: string;
  /** How this page arrives when presenting. Missing means it simply appears. */
  transition?: PageTransition;
}

export type PageTransition = 'none' | 'fade' | 'slide';
/** How an element comes in when presenting, one after another in layer order. */
export type Appear = 'fade' | 'slide' | 'scale';

/** The ready-made shapes, drawn from their box (see shapePath in editor/model.ts). */
export type ShapeType = 'rect' | 'ellipse' | 'triangle' | 'star' | 'diamond' | 'pentagon' | 'hexagon' | 'heart' | 'arrow' | 'bubble' | 'cross' | 'burst';

export type ElementType = 'text' | ShapeType | 'line' | 'image' | 'path';

/** How an element mixes with what is under it, as in design tools' blend modes. */
export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'difference' | 'luminosity';

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

interface BaseElement {
  id: string;
  type: ElementType;
  /** Position and size in page pixels; the page is width × height from the design. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, around the centre. */
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  name?: string;
  /** Elements sharing a group id are selected and moved together. */
  groupId?: string;
  /** Present mode: the element comes in on a click, with this effect. */
  appear?: Appear;
  /** Mirrored across its middle, side to side or top to bottom. */
  flipX?: boolean;
  flipY?: boolean;
  /** A soft shadow behind it. */
  shadow?: Shadow;
  /** A blur over the whole element, in page pixels. */
  blur?: number;
  blend?: Blend;
  /** Present mode: clicking the element opens this https link, or goes to this page ("page:<n>"). */
  link?: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  lineHeight: number;
  letterSpacing: number;
  /** An outline drawn around each letter. */
  outline?: { color: string; width: number };
  /** Shown in capitals, whatever was typed. */
  uppercase?: boolean;
  /** A band of colour behind each line, like a highlighter. */
  highlight?: string;
}

export interface ShapeElement extends BaseElement {
  type: ShapeType;
  /** A colour, or a gradient written as "linear:<angle>:<from>:<to>". */
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Rounded corners, for rectangles. */
  radius: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  /** Drawn from (x, y) to (x + w, y + h); w and h may be negative. */
  stroke: string;
  strokeWidth: number;
  arrow: boolean;
  dashed: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  /** "storage:<path>" for pictures uploaded to the design, or a data: / https: URL. */
  src: string;
  fit: 'cover' | 'contain';
  radius: number;
  /** The picture shown inside a shape instead of its rectangle. */
  mask?: ShapeType;
  /** Light, contrast and colour: 100 is as taken; grayscale and sepia go from 0 to 100. */
  adjust?: ImageAdjust;
}

export interface ImageAdjust {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  /** Turns every colour round the colour wheel, in degrees. */
  hue: number;
}

/**
 * A vector drawn with the pen or the brush. Points are fractions of its box (0 to 1), so it
 * stretches with the box like every other element.
 */
export interface PathElement extends BaseElement {
  type: 'path';
  points: [number, number][];
  closed: boolean;
  /** Curves through the points instead of straight lines between them. */
  smooth: boolean;
  /** A colour, a gradient as for shapes, or "none". */
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type DesignElement = TextElement | ShapeElement | LineElement | ImageElement | PathElement;

export interface DesignSummary {
  id: string;
  title: string;
  kind: DesignKind;
  width: number;
  height: number;
  role: Role;
  owner: PublicUser | null;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  /** The first page, for thumbnails. */
  cover: Page | null;
  /** Only filled in by tag search. */
  tags?: string[];
}

export interface Design extends DesignSummary {
  content: DesignContent;
  version: number;
  updatedBy: PublicUser | null;
}

export interface NewDesignInput {
  title?: string;
  kind?: DesignKind;
  width?: number;
  height?: number;
  content?: DesignContent;
}

export interface SaveResult {
  version: number;
  updatedAt: string;
}

export interface Share extends PublicUser {
  role: ShareRole;
}

// ------------------------------------------------------------ notifications

export type ServiceId = 'write' | 'type' | 'browse' | 'make' | 'store';

export interface AppNotification {
  id: string;
  service: ServiceId | 'elum';
  type: string;
  title: string;
  body: string | null;
  /** A path inside the service, or a full URL. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
  actor: Pick<PublicUser, 'id' | 'name' | 'color'> | null;
}

// ------------------------------------------------------------ enhanced features

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
  owner: PublicUser | null;
}

/** A comment on a design. */
export interface Comment {
  id: string;
  body: string;
  position: { page: number; x: number; y: number } | null;
  resolved: boolean;
  user: PublicUser;
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
  user: PublicUser;
  createdAt: string;
  updatedAt: string;
}

/** A design version for history/restore. */
export interface DesignVersion {
  version: number;
  title: string;
  savedBy: PublicUser | null;
  savedAt: string;
  /** The first page as it was, for a thumbnail. */
  preview: Page | null;
}

/** A saved design template. */
export interface DesignTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  kind: DesignKind;
  width: number;
  height: number;
  thumbnail: string | null;
  isPublic: boolean;
  updatedAt: string;
  owner: PublicUser | null;
}

/** A favorite design. */
export interface Favorite {
  id: string;
  designId: string;
  createdAt: string;
}
