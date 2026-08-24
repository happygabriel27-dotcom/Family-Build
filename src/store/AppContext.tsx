/* ============================================================
   FamilyBuild — App Context
   ------------------------------------------------------------
   Centralized session/auth state, toasts, and sidebar UI state.
   Authentication flows through services/authService.ts (the
   mock backend seam) — components never touch credentials.
   Business data lives in DataContext, not here.
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
import {
  clearSession,
  createSession,
  currentSessionUser,
  getUserById,
  signIn as authSignIn,
  signUp as authSignUp,
  type AuthResult,
} from "../services/authService";
import { STORAGE_KEYS, load, save } from "../services/storage";
import type { User } from "../data/types";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface AppContextType {
  /** Null when not signed in (login screen is shown). */
  user: User | null;
  /** Credential sign-in via the auth service. */
  signIn: (email: string, password: string) => AuthResult;
  /** Self-registration — new accounts default to the WORKER role. */
  signUp: (name: string, email: string, password: string) => AuthResult;
  /** Development tool: switch to a seeded demo account directly. */
  demoSignIn: (userId: string) => void;
  signOut: () => void;
  toasts: Toast[];
  showToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: number) => void;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  toggleCollapsed: () => void;
  closeSidebar: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  /* Session is resolved once from the auth service on mount. */
  const [user, setUser] = useState<User | null>(() => currentSessionUser());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    load<boolean>(STORAGE_KEYS.sidebarCollapsed, false),
  );

  useEffect(() => {
    save(STORAGE_KEYS.sidebarCollapsed, sidebarCollapsed);
  }, [sidebarCollapsed]);

  const signIn = useCallback((email: string, password: string): AuthResult => {
    const result = authSignIn(email, password);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const signUp = useCallback((name: string, email: string, password: string): AuthResult => {
    const result = authSignUp({ name, email, password });
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  /** Dev-only role switching (Settings → Switch demo role). */
  const demoSignIn = useCallback((userId: string) => {
    const account = getUserById(userId);
    if (account) {
      createSession(account.id);
      setUser(account);
    }
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleCollapsed = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const value = useMemo(
    () => ({
      user,
      signIn,
      signUp,
      demoSignIn,
      signOut,
      toasts,
      showToast,
      dismissToast,
      sidebarOpen,
      sidebarCollapsed,
      toggleSidebar,
      toggleCollapsed,
      closeSidebar,
    }),
    [
      user,
      signIn,
      signUp,
      demoSignIn,
      signOut,
      toasts,
      showToast,
      dismissToast,
      sidebarOpen,
      sidebarCollapsed,
      toggleSidebar,
      toggleCollapsed,
      closeSidebar,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}