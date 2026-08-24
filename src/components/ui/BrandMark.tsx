/* ============================================================
   FamilyBuild — Brand Mark
   ------------------------------------------------------------
   Single rendering point for the application logo + brand
   lockup. Reads the CENTRALIZED website settings — no page
   hard-codes the brand name, sub-brand, or logo.
   Used by: Sidebar, Sign In, Sign Up, Forgot/Reset Password.
   ============================================================ */

import { useWebsite } from "../../store/WebsiteContext";
import { getLogoBackgroundStyle } from "../../services/websiteService";

interface BrandMarkProps {
  /** Hide the text lockup (collapsed sidebar). */
  showText?: boolean;
  /** Mark size in px. */
  markSize?: number;
  /** Render as h1 (auth pages) or span (sidebar). */
  heading?: boolean;
}

export function BrandMark({ showText = true, markSize = 30, heading = false }: BrandMarkProps) {
  const { settings } = useWebsite();

  /* Logo Background is applied ONLY to this mark container — it never
     touches the sidebar, page, or theme colors. */
  const logoBackgroundStyle = getLogoBackgroundStyle(settings);

  return (
    <>
      <div
        className="brand-mark"
        style={{ width: markSize, height: markSize, fontSize: markSize * 0.47, ...logoBackgroundStyle }}
      >
        {settings.logoDataUrl ? (
          <img src={settings.logoDataUrl} alt={`${settings.brandName} logo`} />
        ) : (
          <span aria-hidden="true">{settings.logoText.slice(0, 2)}</span>
        )}
      </div>
      {showText && (
        <div className="brand-lockup">
          {heading ? (
            <h1 className="login-card__title">{settings.brandName}</h1>
          ) : (
            <span className="sidebar__brand-name">{settings.brandName}</span>
          )}
          <span className={heading ? "login-card__subtitle" : "sidebar__brand-sub"}>
            {settings.subBrandName}
          </span>
        </div>
      )}
    </>
  );
}