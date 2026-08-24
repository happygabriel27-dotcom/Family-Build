/* ============================================================
   FamilyBuild — Website Management
   ------------------------------------------------------------
   Administrative section for the Owner (or roles granted
   website.* permissions) to configure the application's visual
   identity and content:

   - Branding: brand name, sub-brand, logo (letter mark or
     small image), organization name
   - Content: application title, short description, login tagline

   Branding covers IDENTITY ASSETS only. Application UI colors
   are owned by the fixed design system and are intentionally
   NOT configurable here.

   All values live in the centralized website settings; the
   Sidebar, auth pages, and document head read from the same
   source. Changes apply on Save.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { useWebsite } from "../store/WebsiteContext";
import { can } from "../data/permissions";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Icon } from "../components/ui/Icon";
import { MAX_UPLOAD_BYTES, readFileAsDataUrl } from "../services/fileService";
import { getLogoBackgroundStyle, resolveFavicon } from "../services/websiteService";
import type { FaviconMode, LogoBackgroundMode, WebsiteSettings } from "../data/types";
import { DEFAULT_LOGO_BACKGROUND_COLOR } from "../data/types";

const LOGO_BACKGROUND_OPTIONS: { value: LogoBackgroundMode; label: string; hint: string }[] = [
  { value: "original", label: "Original Image", hint: "Show the uploaded image exactly as provided." },
  { value: "transparent", label: "Transparent", hint: "No extra background — ideal for transparent PNGs." },
  { value: "custom", label: "Custom Color", hint: "Pick a background color for the logo only." },
];

const FAVICON_MODE_OPTIONS: { value: FaviconMode; label: string; hint: string }[] = [
  { value: "automatic", label: "Automatic", hint: "Derived from the organization logo; adapts to a light or dark browser tab for visibility." },
  { value: "custom", label: "Custom Favicon", hint: "Use a dedicated uploaded favicon everywhere. Overrides the automatic variant." },
];

/**
 * Live browser-tab mock preview. Resolves the same favicon the real
 * document head receives (draft-aware) without touching browser UI.
 */
function FaviconTabPreview({ settings }: { settings: WebsiteSettings }) {
  const [href, setHref] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    void resolveFavicon(settings, dark).then((resolved) => {
      if (!cancelled) setHref(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [settings]);

  return (
    <div className="favicon-tab-preview">
      <span className="favicon-tab-preview__icon">
        {href ? <img src={href} alt="Favicon preview" /> : null}
      </span>
      <span className="favicon-tab-preview__title">{settings.title || "Browser tab"}</span>
      <span className="favicon-tab-preview__close" aria-hidden="true">×</span>
    </div>
  );
}

export function WebsiteManagementPage() {
  const { user, showToast } = useApp();
  const { settings, updateSettings, resetSettings } = useWebsite();

  const [draft, setDraft] = useState<WebsiteSettings>(settings);
  const [resetOpen, setResetOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  if (!can(user.role, "website.view")) {
    return <AccessDeniedPage />;
  }

  const mayBranding = can(user.role, "website.branding.edit");
  const mayContent = can(user.role, "website.content.edit");

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const set = (patch: Partial<WebsiteSettings>) => setDraft((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (!draft.brandName.trim()) {
      showToast("Brand name cannot be empty.", "error");
      return;
    }
    updateSettings({
      ...draft,
      brandName: draft.brandName.trim(),
      subBrandName: draft.subBrandName.trim(),
      organizationName: draft.organizationName.trim(),
      title: draft.title.trim(),
      loginTagline: draft.loginTagline.trim(),
      logoText: draft.logoText.trim().slice(0, 2) || "F",
    });
    showToast("Website settings saved", "success");
  };

  const pickLogo = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Logo must be an image file.", "error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES / 4) {
      showToast("Logo image too large — keep it under 500 KB.", "error");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      set({ logoDataUrl: dataUrl });
    } catch {
      showToast("Could not read the logo file.", "error");
    }
  };

  const pickFavicon = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Favicon must be an image file (PNG, SVG, ICO…).", "error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES / 4) {
      showToast("Favicon too large — keep it under 500 KB.", "error");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      set({ faviconDataUrl: dataUrl, faviconMode: "custom" });
    } catch {
      showToast("Could not read the favicon file.", "error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Website Management</h1>
          <p className="page-header__subtitle">
            Configure the organization's identity and branding. Changes apply to the sidebar,
            authentication pages, and browser tab — never to application colors.
          </p>
        </div>
        <button type="button" className="btn btn--primary" disabled={!dirty} onClick={save}>
          Save changes
        </button>
      </div>

      {/* ---------- Branding ---------- */}
      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Branding</h2>
            <p className="card__subtitle">Organization identity shown across the portal.</p>
          </div>
        </div>
        <fieldset disabled={!mayBranding} style={{ border: "none" }}>
          <div className="form-row-2">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="wm-brand">Brand name *</label>
              <input id="wm-brand" value={draft.brandName} onChange={(e) => set({ brandName: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="wm-subbrand">Sub-brand name</label>
              <input id="wm-subbrand" value={draft.subBrandName} onChange={(e) => set({ subBrandName: e.target.value })} />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="wm-org">Organization name</label>
              <input id="wm-org" value={draft.organizationName} onChange={(e) => set({ organizationName: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="wm-logotext">Letter mark (fallback logo)</label>
              <input
                id="wm-logotext"
                maxLength={2}
                value={draft.logoText}
                onChange={(e) => set({ logoText: e.target.value })}
                placeholder="Up to 2 characters"
                disabled={Boolean(draft.logoDataUrl)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Logo image (optional)</label>
            <div className="logo-controls">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void pickLogo(e.target.files?.[0] ?? null)}
                aria-label="Upload logo image"
                disabled={!mayBranding}
              />
              {draft.logoDataUrl && (
                <>
                  <span className="brand-mark" style={{ width: 30, height: 30 }}>
                    <img src={draft.logoDataUrl} alt="Logo preview" />
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      set({ logoDataUrl: undefined });
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                  >
                    Remove logo
                  </button>
                </>
              )}
            </div>
            <small style={{ color: "var(--text-muted)" }}>
              When no image is set, the letter mark is used. The favicon is generated automatically.
            </small>
          </div>

          <div className="form-group">
            <label>Logo background</label>
            {LOGO_BACKGROUND_OPTIONS.map((option) => (
              <div key={option.value} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                <input
                  type="radio"
                  id={`wm-logo-bg-${option.value}`}
                  name="logoBackgroundMode"
                  value={option.value}
                  checked={(draft.logoBackgroundMode ?? "original") === option.value}
                  onChange={() => set({ logoBackgroundMode: option.value })}
                  disabled={!draft.logoDataUrl}
                />
                <label htmlFor={`wm-logo-bg-${option.value}`} style={{ cursor: draft.logoDataUrl ? "pointer" : "default" }}>
                  {option.label}
                </label>
                {(draft.logoBackgroundMode ?? "original") === option.value && (
                  <small style={{ color: "var(--text-muted)" }}>{option.hint}</small>
                )}
              </div>
            ))}
            {!draft.logoDataUrl && (
              <small style={{ color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                Upload a logo image to configure its background. The letter-mark fallback keeps its fixed color.
              </small>
            )}
            {(draft.logoBackgroundMode ?? "original") === "custom" && (
              <div className="logo-controls" style={{ marginTop: 6 }}>
                <input
                  type="color"
                  aria-label="Logo background color"
                  value={draft.logoBackgroundColor || DEFAULT_LOGO_BACKGROUND_COLOR}
                  onChange={(e) => set({ logoBackgroundColor: e.target.value })}
                  disabled={!draft.logoDataUrl}
                />
                <code>{(draft.logoBackgroundColor || DEFAULT_LOGO_BACKGROUND_COLOR).toUpperCase()}</code>
                {/* Preview mark — background is scoped to this element only. */}
                <span className="brand-mark" style={{ width: 30, height: 30, ...getLogoBackgroundStyle(draft) }}>
                  <img src={draft.logoDataUrl} alt="Logo preview" />
                </span>
                <small style={{ color: "var(--text-muted)" }}>Affects the logo container only — never the theme.</small>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Browser tab icon (favicon)</label>
            {FAVICON_MODE_OPTIONS.map((option) => {
              const checked = (draft.faviconMode ?? "automatic") === option.value;
              return (
                <div key={option.value} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                  <input
                    type="radio"
                    id={`wm-favicon-${option.value}`}
                    name="faviconMode"
                    value={option.value}
                    checked={checked}
                    onChange={() => set({ faviconMode: option.value })}
                  />
                  <label htmlFor={`wm-favicon-${option.value}`} style={{ cursor: "pointer" }}>
                    {option.label}
                  </label>
                  {checked && <small style={{ color: "var(--text-muted)" }}>{option.hint}</small>}
                </div>
              );
            })}
            {(draft.faviconMode ?? "automatic") === "custom" && (
              <div className="logo-controls" style={{ marginTop: 6 }}>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*,.ico"
                  aria-label="Upload favicon"
                  onChange={(e) => void pickFavicon(e.target.files?.[0] ?? null)}
                />
                {draft.faviconDataUrl && (
                  <>
                    <span className="brand-mark" style={{ width: 30, height: 30 }}>
                      <img src={draft.faviconDataUrl} alt="Favicon preview" />
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        set({ faviconDataUrl: undefined });
                        if (faviconInputRef.current) faviconInputRef.current.value = "";
                      }}
                    >
                      Remove favicon
                    </button>
                  </>
                )}
              </div>
            )}
            <small style={{ color: "var(--text-muted)", display: "block", marginTop: 4 }}>
              The favicon appears only in browser UI (tab, bookmarks). It never affects the website,
              the main logo, or its background.
            </small>
            <div className="favicon-tab-preview-wrap" style={{ marginTop: 8 }}>
              <small style={{ color: "var(--text-subtle)", display: "block", marginBottom: 4 }}>Browser tab preview</small>
              <FaviconTabPreview settings={draft} />
            </div>
          </div>
        </fieldset>
        {!mayBranding && (
          <p className="perm-note"><Icon name="shield" size={13} /> You do not have website.branding.edit permission.</p>
        )}
      </div>

      {/* ---------- Content ---------- */}
      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Application content</h2>
            <p className="card__subtitle">Titles and descriptions used across the site and sign-in pages.</p>
          </div>
        </div>
        <fieldset disabled={!mayContent} style={{ border: "none" }}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="wm-title">Application title (browser tab)</label>
            <input id="wm-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="wm-tagline">Login page tagline</label>
            <input id="wm-tagline" value={draft.loginTagline} onChange={(e) => set({ loginTagline: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="wm-description">Short description</label>
            <textarea
              id="wm-description"
              rows={3}
              value={draft.shortDescription}
              onChange={(e) => set({ shortDescription: e.target.value })}
            />
          </div>
        </fieldset>
        {!mayContent && (
          <p className="perm-note"><Icon name="shield" size={13} /> You do not have website.content.edit permission.</p>
        )}
      </div>

      {/* ---------- Live preview ---------- */}
      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Preview</h2>
            <p className="card__subtitle">How the current draft will appear (sidebar & sign-in).</p>
          </div>
        </div>
        <div className="brand-preview-grid">
          <div className="brand-preview brand-preview--sidebar">
            <div className="sidebar__brand">
              <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 14, ...getLogoBackgroundStyle(draft) }}>
                {draft.logoDataUrl ? <img src={draft.logoDataUrl} alt="" /> : <span>{draft.logoText.slice(0, 2)}</span>}
              </div>
              <div className="brand-lockup">
                <span className="sidebar__brand-name">{draft.brandName || "Brand"}</span>
                <span className="sidebar__brand-sub">{draft.subBrandName}</span>
              </div>
            </div>
            <p className="brand-preview__caption">Sidebar header</p>
          </div>
          <div className="brand-preview brand-preview--login">
            <div className="login-card__brand">
              <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 14, ...getLogoBackgroundStyle(draft) }}>
                {draft.logoDataUrl ? <img src={draft.logoDataUrl} alt="" /> : <span>{draft.logoText.slice(0, 2)}</span>}
              </div>
              <div className="brand-lockup">
                <strong>{draft.brandName || "Brand"}</strong>
                <small>{draft.subBrandName}</small>
              </div>
            </div>
            <p className="brand-preview__tagline">{draft.loginTagline}</p>
            <p className="brand-preview__caption">Sign-in card</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Reset</h2>
            <p className="card__subtitle">Restore factory branding defaults.</p>
          </div>
        </div>
        <button type="button" className="btn btn--danger" onClick={() => setResetOpen(true)}>
          Reset to defaults
        </button>
      </div>

      {dirty && (
        <div className="save-bar">
          <span>You have unsaved changes.</span>
          <div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDraft(settings)}>
              Discard
            </button>{" "}
            <button type="button" className="btn btn--primary btn--sm" onClick={save}>
              Save changes
            </button>
          </div>
        </div>
      )}

      {resetOpen && (
        <ConfirmDialog
          title="Reset website settings?"
          message="Brand name, logo, and descriptions will return to factory defaults. Application UI colors are not affected."
          confirmLabel="Reset settings"
          danger
          onConfirm={() => {
            resetSettings();
            setDraft({ ...settings });
            setResetOpen(false);
            showToast("Website settings restored to defaults", "success");
          }}
          onCancel={() => setResetOpen(false)}
        />
      )}
    </div>
  );
}