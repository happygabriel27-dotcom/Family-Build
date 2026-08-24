import { initials } from "../../utils/format";

interface AvatarProps {
  name: string;
  size?: number;
}

const AVATAR_TONES = ["#2563eb", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#dc2626"];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function Avatar({ name, size = 30 }: AvatarProps) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: toneFor(name),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}