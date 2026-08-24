/* ============================================================
   FamilyBuild — Portal Member Picker
   ------------------------------------------------------------
   PRIMARY workflow for adding people to group chats: search
   EXISTING portal members (by name or email), optionally filter
   by role/kind, and multi-select. This never creates external
   accounts — email search matches registered people only.
   (External email invitations are a future feature.)
   ============================================================ */

import { useMemo, useState } from "react";
import type { Person } from "../../data/types";
import { ROLE_LABELS, type UserRole } from "../../data/types";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";

const KIND_FILTERS: Array<{ label: string; kinds: Person["kind"][] }> = [
  { label: "All", kinds: ["manager", "builder", "developer", "worker", "customer-service", "admin", "property-owner"] },
  { label: "Managers", kinds: ["builder"] },
  { label: "Workers", kinds: ["worker"] },
  { label: "Developers", kinds: ["developer"] },
  { label: "Customer Service", kinds: ["customer-service"] },
  { label: "Clients", kinds: ["property-owner"] },
];

/** Maps a Person kind to the closest account role for display. */
function roleLabelFor(person: Person): string {
  switch (person.kind) {
    case "admin":
      return ROLE_LABELS.owner;
    case "builder":
      return ROLE_LABELS.manager;
    case "worker":
      return ROLE_LABELS.worker;
    case "developer":
      return ROLE_LABELS.developer;
    case "customer-service":
      return ROLE_LABELS["customer-service"];
    case "property-owner":
      return "Client";
    default:
      return person.title;
  }
}

interface MemberPickerModalProps {
  title: string;
  subtitle?: string;
  /** Portal members available for selection. */
  candidates: Person[];
  /** Pre-selected person ids (existing members). */
  selectedIds: string[];
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export function MemberPickerModal({
  title,
  subtitle,
  candidates,
  selectedIds,
  confirmLabel = "Add members",
  onClose,
  onConfirm,
}: MemberPickerModalProps) {
  const [query, setQuery] = useState("");
  const [filterIndex, setFilterIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kinds = KIND_FILTERS[filterIndex].kinds;
    return candidates.filter((p) => {
      if (!kinds.includes(p.kind)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    });
  }, [candidates, query, filterIndex]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle ?? "Search existing portal members by name or email."}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
          >
            {confirmLabel} ({selected.size})
          </button>
        </>
      }
    >
      <div className="member-picker">
        <input
          type="search"
          className="member-picker__search"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search portal members"
        />

        <div className="member-picker__filters" role="tablist" aria-label="Role filters">
          {KIND_FILTERS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={filterIndex === i}
              className={`member-picker__filter ${filterIndex === i ? "active" : ""}`}
              onClick={() => setFilterIndex(i)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="member-picker__selected">
            {[...selected].map((id) => {
              const person = candidates.find((c) => c.id === id);
              if (!person) return null;
              return (
                <span key={id} className="member-chip">
                  {person.name}
                  <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${person.name}`}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <ul className="member-picker__list">
          {filtered.length === 0 ? (
            <li className="member-picker__empty">No portal members match your search.</li>
          ) : (
            filtered.map((person) => {
              const isSelected = selected.has(person.id);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    className={`member-row ${isSelected ? "member-row--selected" : ""}`}
                    onClick={() => toggle(person.id)}
                    aria-pressed={isSelected}
                  >
                    <Avatar name={person.name} size={30} />
                    <span className="member-row__body">
                      <strong>{person.name}</strong>
                      <small>{person.email}</small>
                    </span>
                    <span className="role-badge">{roleLabelFor(person)}</span>
                    <span className={`member-row__check ${isSelected ? "checked" : ""}`} aria-hidden="true">
                      ✓
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <p className="member-picker__note">
          Only existing portal members can be added. Inviting someone by email is not available yet.
        </p>
      </div>
    </Modal>
  );
}

export type { UserRole };