/* ============================================================
   FamilyBuild — Website Settings Service
   ------------------------------------------------------------
   Centralized application identity/branding configuration.
   The Sidebar, authentication pages, and document head all read
   from here — brand values are never hard-coded in components.

   Branding controls IDENTITY ASSETS ONLY (names, logo, text).
   Application UI colors (navigation, buttons, semantic status
   colors) are owned exclusively by the fixed design system in
   styles.css — the logo/brand never drives theming.

   Storage seam: localStorage today; a real backend replaces
   load/save without touching consumers.
   ============================================================ */

import { STORAGE_KEYS, load, save } from "./storage";
import type { CSSProperties } from "react";
import type {
  LogoBackgroundMode,
  WebsiteSettings,
} from "../data/types";
import { DEFAULT_LOGO_BACKGROUND_MODE } from "../data/types";

const LOGO_BACKGROUND_MODES: LogoBackgroundMode[] = ["original", "transparent", "custom"];

/** Resolves a persisted/unknown value into a valid logo background mode. */
function normalizeLogoBackgroundMode(value: unknown): LogoBackgroundMode {
  return LOGO_BACKGROUND_MODES.includes(value as LogoBackgroundMode)
    ? (value as LogoBackgroundMode)
    : DEFAULT_LOGO_BACKGROUND_MODE;
}

/**
 * Inline background style for the LOGO CONTAINER ONLY.
 * Returns `undefined` for the letter-mark fallback (keeps its fixed
 * design-system background). For uploaded logos:
 *  - "original"/"transparent" → transparent container (image shows as-is)
 *  - "custom"                 → the chosen color, scoped to this element
 * This must NEVER be connected to theme/accent variables.
 */
export function getLogoBackgroundStyle(settings: Pick<WebsiteSettings, "logoDataUrl" | "logoBackgroundMode" | "logoBackgroundColor">): CSSProperties | undefined {
  if (!settings.logoDataUrl) return undefined;
  const mode = normalizeLogoBackgroundMode(settings.logoBackgroundMode);
  if (mode === "custom" && settings.logoBackgroundColor?.trim()) {
    return { background: settings.logoBackgroundColor.trim() };
  }
  return { background: "transparent" };
}

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  brandName: "FamilyBuild",
  subBrandName: "Properties & Construction",
  logoText: "F",
  title: "FamilyBuild — Properties & Construction Management",
  shortDescription:
    "FamilyBuild is a business management portal for properties, construction projects, tasks, inventory, purchasing, finance, and client support.",
  organizationName: "FamilyBuild Construction & Properties",
  loginTagline: "Properties & Construction Management",
  updatedAt: new Date().toISOString(),
};

/* Fixed letter-mark favicon background — part of the design system,
   NOT configurable by branding. */
const FAVICON_BRAND_COLOR = "#2563eb";

/* ---------- Persistence ---------- */

export function loadWebsiteSettings(): WebsiteSettings {
  const stored = load<Partial<WebsiteSettings>>(STORAGE_KEYS.websiteSettings, {});
  /* Drop legacy keys (e.g. removed "accentColor") from persisted state. */
  const { accentColor: _legacyAccentColor, ...legacyFree } = stored as Partial<WebsiteSettings> & {
    accentColor?: string;
  };
  return {
    ...DEFAULT_WEBSITE_SETTINGS,
    ...legacyFree,
    // Guard against persisted empty strings breaking the lockup.
    brandName: stored.brandName?.trim() || DEFAULT_WEBSITE_SETTINGS.brandName,
    logoText: stored.logoText?.trim() || DEFAULT_WEBSITE_SETTINGS.logoText,
    // Logo Background defaults to "original" so existing logos are unchanged.
    logoBackgroundMode: normalizeLogoBackgroundMode(stored.logoBackgroundMode),
    logoBackgroundColor: stored.logoBackgroundColor?.trim() || undefined,
    // Favicon defaults to "automatic" — existing sites keep their behavior.
    faviconMode: stored.faviconMode === "custom" ? "custom" : "automatic",
    faviconDataUrl: stored.faviconDataUrl?.trim() || undefined,
  };
}

export function saveWebsiteSettings(settings: WebsiteSettings): void {
  const { accentColor: _legacyAccentColor, ...clean } = settings as WebsiteSettings & {
    accentColor?: string;
  };
  save(STORAGE_KEYS.websiteSettings, { ...clean, updatedAt: new Date().toISOString() });
}

/* ---------- Runtime application ---------- */

/** Generates a small SVG letter-mark favicon from brand settings. */
export function buildFaviconDataUrl(letter: string, color: string = FAVICON_BRAND_COLOR): string {
  const safeLetter = (letter || "F").slice(0, 2).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="43" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${safeLetter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Syncs the browser tab title (favicon is applied separately & async). */
export function applyDocumentIdentity(settings: WebsiteSettings): void {
  document.title = settings.title || DEFAULT_WEBSITE_SETTINGS.title;
}

/**
 * Applies the favicon to the document head. Reuses the single
 * existing <link rel="icon"> — never adds duplicates.
 */
export function setBrowserFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

/* ---------- Favicon resolution ---------- */

const FAVICON_TILE_SIZE = 64;
/** Rounded-square tiles composited BEHIND the logo when contrast is poor.
    Favicon-scoped colors only — never used anywhere in the app UI. */
const FAVICON_LIGHT_TILE = "#e8edf4";
const FAVICON_DARK_TILE = "#1f2937";

/** Cache of generated favicons keyed by source data URL + dark flag. */
const faviconCache = new Map<string, string>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load favicon source"));
    img.src = src;
  });
}

/** Average relative luminance (0–1) of non-transparent pixels. */
function measureLuminance(ctx: CanvasRenderingContext2D, size: number): number {
  const { data } = ctx.getImageData(0, 0, size, size);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // ignore transparent pixels
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    count++;
  }
  return count > 0 ? sum / count : -1;
}

/**
 * Draws `img` contained (never stretched/cropped) centered on an
 * optional rounded tile background covering the full canvas.
 */
function drawContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  tile?: string,
): void {
  ctx.clearRect(0, 0, size, size);
  if (tile) {
    const radius = size * 0.22;
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();
  }
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

/**
 * Builds a theme-adaptive favicon variant from the logo image:
 *  - dark browser scheme + dark logo  → composite on a light tile
 *  - light browser scheme + light logo → composite on a dark tile
 *  - otherwise → the ORIGINAL image is preserved untouched
 * Returns the original data URL if analysis fails for any reason,
 * so a broken result is never produced.
 */
async function buildAdaptiveFavicon(sourceDataUrl: string, prefersDark: boolean): Promise<string> {
  const cacheKey = `${sourceDataUrl}|${prefersDark ? "d" : "l"}`;
  const cached = faviconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_TILE_SIZE;
  canvas.height = FAVICON_TILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  const img = await loadImage(sourceDataUrl);
  drawContained(ctx, img, FAVICON_TILE_SIZE);
  const luminance = measureLuminance(ctx, FAVICON_TILE_SIZE);

  /* Contrast thresholds: only intervene when visibility is at risk. */
  let tile: string | undefined;
  if (luminance >= 0 && luminance <= 0.35 && prefersDark) {
    tile = FAVICON_LIGHT_TILE; // dark logo on a dark tab
  } else if (luminance >= 0.75 && !prefersDark) {
    tile = FAVICON_DARK_TILE; // white/light logo on a light tab
  }

  if (!tile) {
    faviconCache.set(cacheKey, sourceDataUrl);
    return sourceDataUrl;
  }

  drawContained(ctx, img, FAVICON_TILE_SIZE, tile);
  const result = canvas.toDataURL("image/png");
  faviconCache.set(cacheKey, result);
  return result;
}

/**
 * Resolves the favicon to display:
 *   custom upload → automatic adaptive variant of the logo → letter-mark.
 * The main website logo itself is NEVER modified — adaptation happens
 * on a generated copy used only in the browser tab.
 */
export async function resolveFavicon(settings: WebsiteSettings, prefersDark: boolean): Promise<string> {
  if ((settings.faviconMode ?? "automatic") === "custom" && settings.faviconDataUrl) {
    return settings.faviconDataUrl;
  }
  if (!settings.logoDataUrl) {
    return buildFaviconDataUrl(settings.logoText);
  }
  try {
    return await buildAdaptiveFavicon(settings.logoDataUrl, prefersDark);
  } catch {
    /* Safe fallback: original logo as-is rather than a distorted icon. */
    return settings.logoDataUrl;
  }
}

