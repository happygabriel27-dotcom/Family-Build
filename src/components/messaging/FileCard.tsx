/* ============================================================
   FamilyBuild — File Card
   ------------------------------------------------------------
   Shared rendering for a FileRecord in chat bubbles, the Files
   page, Documents, and shared-content panels. Images with an
   inline preview render as thumbnails; everything else renders
   as a metadata card (name · type · size) with a download/open
   action where content is available.
   ============================================================ */

import type { FileRecord } from "../../data/types";
import { fileEmoji, formatFileSize } from "../../services/fileService";
import { Icon } from "../ui/Icon";

interface FileCardProps {
  file: FileRecord;
  /** Compact variant inside chat bubbles. */
  compact?: boolean;
  onOpenImage?: (file: FileRecord) => void;
  onDownload?: (file: FileRecord) => void;
}

export function FileCard({ file, compact, onOpenImage, onDownload }: FileCardProps) {
  const hasPreview = Boolean(file.dataUrl);

  if (file.kind === "image" && hasPreview && onOpenImage) {
    return (
      <button
        type="button"
        className="msg-image-thumb"
        onClick={() => onOpenImage(file)}
        title={`${file.name} — click to view`}
      >
        <img src={file.dataUrl} alt={file.name} loading="lazy" />
      </button>
    );
  }

  return (
    <div className={`msg-file-card ${compact ? "msg-file-card--compact" : ""}`}>
      <span className="msg-file-card__icon" aria-hidden="true">
        {file.kind === "image" ? <Icon name="image" size={18} /> : <span>{fileEmoji(file.kind)}</span>}
      </span>
      <span className="msg-file-card__meta">
        <strong>{file.name}</strong>
        <small>
          {formatFileSize(file.sizeBytes)}{hasPreview ? "" : " · preview unavailable"}
        </small>
      </span>
      {onDownload && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onDownload(file)}
          aria-label={`Download ${file.name}`}
          title={hasPreview ? "Download" : "Demo file — binary content not stored"}
        >
          <Icon name="download" size={14} />
        </button>
      )}
    </div>
  );
}