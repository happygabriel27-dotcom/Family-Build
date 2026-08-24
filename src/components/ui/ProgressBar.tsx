interface ProgressBarProps {
  value: number; // 0–100
  label?: string;
  tone?: "primary" | "success" | "warning" | "danger";
}

export function ProgressBar({ value, label, tone = "primary" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress">
      {label && (
        <div className="progress__label">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}