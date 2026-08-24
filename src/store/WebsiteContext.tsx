/* ============================================================
   FamilyBuild — Website Settings Context
   ------------------------------------------------------------
   Holds the centralized website/branding configuration in React
   state and applies its side effects (document title, favicon).
   Branding never touches UI theme colors — those are fixed by
   the design system. Mounted ABOVE authentication so the
   sign-in/sign-up/forgot/reset pages render branded lockups from
   the same source as the app shell.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WebsiteSettings } from "../data/types";
import {
  applyDocumentIdentity,
  resolveFavicon,
  setBrowserFavicon,
  loadWebsiteSettings,
  saveWebsiteSettings,
  DEFAULT_WEBSITE_SETTINGS,
} from "../services/websiteService";

interface WebsiteContextType {
  settings: WebsiteSettings;
  /** Merges a partial patch and persists it. */
  updateSettings: (patch: Partial<WebsiteSettings>) => void;
  /** Restores factory defaults. */
  resetSettings: () => void;
}

const WebsiteContext = createContext<WebsiteContextType | null>(null);

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WebsiteSettings>(() => loadWebsiteSettings());
  /* The favicon lives in BROWSER chrome (tab/bookmarks), so the browser's
     own color scheme — not an in-app theme toggle — drives adaptation.
     This reads a media query; it never changes application styling. */
  const [prefersDarkScheme, setPrefersDarkScheme] = useState<boolean>(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    applyDocumentIdentity(settings);
  }, [settings]);

  /* Re-resolve whenever settings or the browser scheme change. */
  useEffect(() => {
    let cancelled = false;
    void resolveFavicon(settings, prefersDarkScheme).then((href) => {
      if (!cancelled) setBrowserFavicon(href);
    });
    return () => {
      cancelled = true;
    };
  }, [settings, prefersDarkScheme]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setPrefersDarkScheme(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const updateSettings = useCallback((patch: Partial<WebsiteSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveWebsiteSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_WEBSITE_SETTINGS };
    saveWebsiteSettings(next);
    setSettings(next);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  );

  return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>;
}

export function useWebsite(): WebsiteContextType {
  const ctx = useContext(WebsiteContext);
  if (!ctx) throw new Error("useWebsite must be used within WebsiteProvider");
  return ctx;
}