/* ============================================================
   FamilyBuild — Forgot Password
   ------------------------------------------------------------
   Sign In → Forgot Password → request reset → (mock delivery)
   → Reset Password → back to Sign In.

   MOCK BEHAVIOR (clearly separated from production):
   There is no email service yet. In production, requestPasswordReset
   would email a one-time link and return nothing sensitive. For this
   demo the service returns the token so the dev UI can offer it —
   shown ONLY on this screen and clearly labeled as mock behavior.
   Tokens are hashed at rest, expire in 30 minutes, and are
   single-use; they are never exposed in the normal app UI.
   ============================================================ */

import { useState } from "react";
import { Link } from "react-router-dom";
import { isValidEmail, requestPasswordReset } from "../services/authService";
import { BrandMark } from "../components/ui/BrandMark";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [mockToken, setMockToken] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter the email for your account.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    window.setTimeout(() => {
      const result = requestPasswordReset(email);
      setSubmitting(false);
      // Generic confirmation either way — never reveal whether the
      // account exists to avoid account enumeration.
      setRequested(true);
      if (result.matched && result.mockToken) {
        setMockToken(result.mockToken);
      }
    }, 450);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Organization branding comes from the centralized website settings. */}
        <div className="login-card__brand">
          <BrandMark />
        </div>
        <h1 className="login-card__heading">Forgot password</h1>

        {!requested ? (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="forgot-email">Account email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </div>

            {error && (
              <div className="form-errors" role="alert" style={{ marginBottom: 14 }}>
                <div>{error}</div>
              </div>
            )}

            <button type="submit" className="btn btn--primary login-card__submit" disabled={submitting}>
              {submitting ? "Requesting…" : "Request password reset"}
            </button>
          </form>
        ) : (
          <>
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <strong>Check your inbox</strong>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
                If an account exists for <strong>{email.trim()}</strong>, a password
                reset link has been sent. The link expires in 30 minutes and can be
                used once.
              </p>
            </div>

            {/* ---- MOCK-ONLY dev panel: no email service is connected yet. ---- */}
            {mockToken && (
              <div className="card" style={{ padding: 14, marginBottom: 12, borderColor: "var(--warning)" }}>
                <strong>Development mode only</strong>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 10px" }}>
                  No email backend is connected in this build, so the reset link is
                  surfaced here instead of being emailed. This panel will not exist in
                  production.
                </p>
                <Link className="btn btn--secondary btn--sm" to={`/reset-password?token=${encodeURIComponent(mockToken)}`}>
                  Open mock reset link
                </Link>
              </div>
            )}
          </>
        )}

        <div className="login-card__links">
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}