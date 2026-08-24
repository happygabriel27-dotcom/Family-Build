/* ============================================================
   FamilyBuild — Reset Password
   ------------------------------------------------------------
   Completes the forgot-password flow:
     reset token → validation → password update → token invalidated.

   The token arrives via the reset link (?token=…). Validation and
   the single-use invalidation live in the auth service so a real
   backend can replace them without touching this component.
   ============================================================ */

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isValidPassword, resetPassword, validateResetToken } from "../services/authService";
import { BrandMark } from "../components/ui/BrandMark";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /* Validate the token up-front so bad/expired links fail fast. */
  const tokenCheck = useMemo(() => validateResetToken(token), [token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];

    if (!password) errs.push("New password is required.");
    else if (!isValidPassword(password))
      errs.push("Password must be at least 8 characters and include letters and numbers.");
    if (password && confirmPassword !== password) errs.push("Passwords do not match.");

    setErrors(errs);
    if (errs.length > 0 || !tokenCheck.valid) return;

    setSubmitting(true);
    window.setTimeout(() => {
      const result = resetPassword(token, password);
      setSubmitting(false);
      if (!result.ok) {
        setErrors([result.error]);
        return;
      }
      setSuccess(true);
    }, 450);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Organization branding comes from the centralized website settings. */}
        <div className="login-card__brand">
          <BrandMark />
        </div>
        <h1 className="login-card__heading">Reset password</h1>

        {!tokenCheck.valid ? (
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <strong style={{ color: "var(--danger)" }}>Reset link unavailable</strong>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
              {tokenCheck.error ?? "This reset link is not valid."} Request a new one to continue.
            </p>
          </div>
        ) : success ? (
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <strong>Password updated</strong>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 12px" }}>
              Your password has been changed and the reset link has been invalidated.
              Sign in with your new password.
            </p>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate("/login", { replace: true })}>
              Go to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="reset-password">New password *</label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters with letters & numbers"
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label htmlFor="reset-confirm">Confirm new password *</label>
              <input
                id="reset-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
              />
            </div>

            {errors.length > 0 && (
              <div className="form-errors" role="alert" style={{ marginBottom: 14 }}>
                {errors.map((err) => (
                  <div key={err}>• {err}</div>
                ))}
              </div>
            )}

            <button type="submit" className="btn btn--primary login-card__submit" disabled={submitting}>
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <div className="login-card__links">
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}