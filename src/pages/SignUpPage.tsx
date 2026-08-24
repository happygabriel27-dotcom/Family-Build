/* ============================================================
   FamilyBuild — Sign Up
   ------------------------------------------------------------
   Self-registration through the auth service. New accounts are
   created with the safe default WORKER role — never Owner or
   other elevated roles. An Owner can promote the account later
   through People management.
   ============================================================ */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { isValidEmail, isValidPassword } from "../services/authService";
import { BrandMark } from "../components/ui/BrandMark";

export function SignUpPage() {
  const { signUp } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];

    if (!name.trim()) errs.push("Name is required.");
    if (!email.trim()) errs.push("Email is required.");
    else if (!isValidEmail(email)) errs.push("Enter a valid email address.");
    if (!password) errs.push("Password is required.");
    else if (!isValidPassword(password))
      errs.push("Password must be at least 8 characters and include letters and numbers.");
    if (password && confirmPassword !== password) errs.push("Passwords do not match.");

    setErrors(errs);
    if (errs.length > 0) return;

    setSubmitting(true);
    window.setTimeout(() => {
      const result = signUp(name, email, password);
      setSubmitting(false);
      if (!result.ok) {
        setErrors([result.error]);
        return;
      }
      // Authenticated session established — role + permissions load
      // with the app shell, then land on the dashboard.
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
        <h1 className="login-card__heading">Create account</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="signup-name">Full name *</label>
            <input
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jamie Rivera"
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="signup-email">Email *</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label htmlFor="signup-password">Password *</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters with letters & numbers"
              autoComplete="new-password"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="signup-confirm">Confirm password *</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
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
            {submitting ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="login-card__note">
          New accounts start with basic Worker access. The Owner can assign a
          different role after reviewing your account.
        </p>

        <div className="login-card__links">
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}