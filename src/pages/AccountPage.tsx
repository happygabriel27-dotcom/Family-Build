/* ============================================================
   FamilyBuild — Account (personal settings)
   ------------------------------------------------------------
   Profile information, session state, and password/security.
   Available to every role — no administrative access here.
   ============================================================ */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { changePassword, isValidPassword } from "../services/authService";
import { ROLE_LABELS } from "../data/types";
import { Avatar } from "../components/ui/Avatar";

export function AccountPage() {
  const { user, signOut, showToast } = useApp();
  const data = useData();
  const navigate = useNavigate();

  /* Change-password form state */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [savingPw, setSavingPw] = useState(false);

  if (!user) return null;
  const person = data.personById(user.personId);

  const submitPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!currentPw) errs.push("Current password is required.");
    if (!newPw) errs.push("New password is required.");
    else if (!isValidPassword(newPw))
      errs.push("New password must be at least 8 characters and include letters and numbers.");
    if (newPw && confirmPw !== newPw) errs.push("New passwords do not match.");

    setPwErrors(errs);
    if (errs.length > 0) return;

    setSavingPw(true);
    window.setTimeout(() => {
      const result = changePassword(user.id, currentPw, newPw);
      setSavingPw(false);
      if (!result.ok) {
        setPwErrors([result.error]);
        return;
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToast("Password updated", "success");
    }, 400);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Account</h1>
          <p className="page-header__subtitle">Your identity, role, session, and security.</p>
        </div>
      </div>

      <div className="card account-card">
        <Avatar name={user.name} size={56} />
        <div className="account-card__info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className={`role-badge role-badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Profile details</h2>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-item__label">Display name</div>
            <div className="info-item__value">{user.name}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Email</div>
            <div className="info-item__value">{user.email}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Role</div>
            <div className="info-item__value">{ROLE_LABELS[user.role]}</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Title</div>
            <div className="info-item__value">{user.title}</div>
          </div>
          {person?.phone && (
            <div className="info-item">
              <div className="info-item__label">Phone</div>
              <div className="info-item__value">{person.phone}</div>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 12 }}>
          Profile editing is disabled in this demo build — it will be enabled when real
          authentication and a user database are connected.
        </p>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Password & security</h2>
            <p className="card__subtitle">Update your sign-in password.</p>
          </div>
        </div>
        <form onSubmit={submitPasswordChange} noValidate>
          <div className="form-grid">
            <div className="form-group form-group--full">
              <label htmlFor="acct-current-pw">Current password *</label>
              <input
                id="acct-current-pw"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="acct-new-pw">New password *</label>
              <input
                id="acct-new-pw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters with letters & numbers"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="acct-confirm-pw">Confirm new password *</label>
              <input
                id="acct-confirm-pw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {pwErrors.length > 0 && (
            <div className="form-errors" role="alert" style={{ margin: "10px 0" }}>
              {pwErrors.map((err) => (
                <div key={err}>• {err}</div>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn--primary" disabled={savingPw}>
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Session</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 12 }}>
          You are signed in as <strong>{user.email}</strong> ({ROLE_LABELS[user.role]}).
          Signing out ends this session and returns you to the login screen.
        </p>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            signOut();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}