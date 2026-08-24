/* ============================================================
   FamilyBuild — Sign In
   ------------------------------------------------------------
   Credential-based sign-in through the auth service.
   Validation → error messages → loading state → session creation
   → role/permission-driven dashboard. Demo credentials are listed
   for development convenience only.
   ============================================================ */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { isValidEmail } from "../services/authService";
import { BrandMark } from "../components/ui/BrandMark";

export function LoginPage() {
  const { signIn } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    // Simulated network latency so the loading state is observable;
    // the real backend call replaces this seam without UI changes.
    window.setTimeout(() => {
      const result = signIn(email, password);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate("/", { replace: true });
    }, 450);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Organization branding comes from the centralized website settings. */}
        <div className="login-card__brand">
          <BrandMark />
        </div>
        <h1 className="login-card__heading">Sign in</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="form-errors" role="alert" style={{ marginBottom: 14 }}>
              <div>{error}</div>
            </div>
          )}

          <button type="submit" className="btn btn--primary login-card__submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-card__links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span aria-hidden="true">·</span>
          <Link to="/signup">Create an account</Link>
        </div>

        <p className="login-card__note">
          Development build — demo accounts all use the password{" "}
          <code>demo1234</code>: owner@example.com · manager@example.com ·
          developer@example.com · worker@example.com · support@example.com ·
          cs2@example.com. This screen is replaced by real authentication when
          a backend is connected.
        </p>
      </div>
    </div>
  );
}