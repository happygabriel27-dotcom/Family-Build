import { useEffect, useRef, useState, type ReactNode } from "react";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  /** Accessible name for the trigger button. */
  label: string;
}

/** Lightweight dropdown menu with click-outside and Escape handling. */
export function Dropdown({ trigger, children, align = "right", label }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`dropdown__menu dropdown__menu--${align}`}
          role="menu"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  icon?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
}

export function DropdownItem({ icon, onClick, children, danger }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`dropdown__item ${danger ? "dropdown__item--danger" : ""}`}
      onClick={onClick}
    >
      {icon && <span className="dropdown__item-icon">{icon}</span>}
      {children}
    </button>
  );
}