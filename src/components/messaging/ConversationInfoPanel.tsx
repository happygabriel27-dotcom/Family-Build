/* ============================================================
   FamilyBuild — Conversation Info Panel
   ------------------------------------------------------------
   Conversation-level shared-content area: Media (images),
   Files, Links (auto-detected in messages), and Members for
   groups. Every authorized conversation member can browse the
   shared collection without scrolling the whole thread.
   ============================================================ */

import { useMemo, useState } from "react";
import type { Conversation, FileRecord, Person } from "../../data/types";
import { ROLE_LABELS, type UserRole } from "../../data/types";
import { formatDateTime } from "../../utils/format";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { FileCard } from "./FileCard";

type InfoTab = "media" | "files" | "links" | "members";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function extractLinks(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

interface ConversationInfoPanelProps {
  conversation: Conversation;
  filesById: Map<string, FileRecord>;
  personById: (id: string) => Person | undefined;
  myId: string;
  myRole: UserRole;
  onClose: () => void;
  onOpenImage: (file: FileRecord) => void;
  onDownload: (file: FileRecord) => void;
  onAddMembers: () => void;
  onRemoveMember: (personId: string) => void;
  onLeaveGroup: () => void;
  onRenameGroup: () => void;
}

export function ConversationInfoPanel({
  conversation,
  filesById,
  personById,
  myId,
  myRole,
  onClose,
  onOpenImage,
  onDownload,
  onAddMembers,
  onRemoveMember,
  onLeaveGroup,
  onRenameGroup,
}: ConversationInfoPanelProps) {
  const isGroup = conversation.kind === "group";
  const isAdmin =
    isGroup &&
    ((conversation.adminIds?.includes(myId) ?? false) || conversation.createdById === myId);

  const [tab, setTab] = useState<InfoTab>(isGroup ? "members" : "media");

  /* Shared content collected from every message attachment. */
  const { media, files, links } = useMemo(() => {
    const mediaList: FileRecord[] = [];
    const fileList: FileRecord[] = [];
    const linkSet = new Map<string, { url: string; senderId: string; at: string }>();

    for (const msg of conversation.messages) {
      for (const att of msg.attachments ?? []) {
        const file = filesById.get(att.fileId);
        if (!file) continue;
        if (file.kind === "image") mediaList.push(file);
        else fileList.push(file);
      }
      for (const url of extractLinks(msg.text)) {
        if (!linkSet.has(url)) linkSet.set(url, { url, senderId: msg.senderId, at: msg.timestamp });
      }
    }
    return {
      media: mediaList.reverse(),
      files: fileList.reverse(),
      links: [...linkSet.values()].reverse(),
    };
  }, [conversation.messages, filesById]);

  const tabs: Array<{ id: InfoTab; label: string; count?: number }> = [
    ...(isGroup ? [{ id: "members" as InfoTab, label: "Members", count: conversation.participantIds.length }] : []),
    { id: "media", label: "Media", count: media.length },
    { id: "files", label: "Files", count: files.length },
    { id: "links", label: "Links", count: links.length },
  ];

  return (
    <aside className="info-panel" aria-label="Conversation details">
      <div className="info-panel__header">
        <div className="info-panel__identity">
          {isGroup ? (
            <div className="group-avatar group-avatar--panel">
              {conversation.image ? (
                <img src={conversation.image} alt={conversation.subject} />
              ) : (
                <span>{conversation.subject.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          ) : (
            (() => {
              const other = conversation.participantIds.find((p) => p !== myId);
              return <Avatar name={other ? (personById(other)?.name ?? "?") : "?"} size={38} />;
            })()
          )}
          <div>
            <strong>{conversation.subject}</strong>
            <small>
              {isGroup
                ? `${conversation.participantIds.length} members · created ${formatDateTime(conversation.createdAt ?? conversation.updatedAt)}`
                : (personById(conversation.participantIds.find((p) => p !== myId) ?? "")?.title ?? "")}
            </small>
          </div>
        </div>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close details panel">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="info-panel__tabs" role="tablist" aria-label="Shared content categories">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`info-panel__tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <em>({t.count})</em>}
          </button>
        ))}
      </div>

      <div className="info-panel__body">
        {tab === "members" && isGroup && (
          <div className="member-list">
            {isAdmin && (
              <div className="member-list__actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={onAddMembers}>
                  + Add members
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onRenameGroup}>
                  Rename group
                </button>
              </div>
            )}
            {conversation.participantIds.map((pid) => {
              const person = personById(pid);
              const isCreator = conversation.createdById === pid;
              const canRemove = isAdmin && pid !== myId && !isCreator;
              return (
                <div key={pid} className="member-row member-row--static">
                  <Avatar name={person?.name ?? "?"} size={30} />
                  <span className="member-row__body">
                    <strong>
                      {person?.name ?? pid}
                      {pid === myId && <em> (you)</em>}
                    </strong>
                    <small>{person?.email}</small>
                  </span>
                  <span className="role-badge">{person?.kind === "admin" ? ROLE_LABELS.owner : (person?.title ?? "")}</span>
                  {isCreator && <span className="badge badge--success">Owner</span>}
                  {canRemove && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm member-row__remove"
                      onClick={() => onRemoveMember(pid)}
                      aria-label={`Remove ${person?.name}`}
                      title="Remove from group"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {!isAdmin && (
              <button type="button" className="btn btn--danger-ghost btn--sm member-list__leave" onClick={onLeaveGroup}>
                Leave group
              </button>
            )}
          </div>
        )}

        {tab === "media" && (
          media.length === 0 ? (
            <p className="info-panel__empty">No images shared in this conversation yet.</p>
          ) : (
            <div className="media-grid">
              {media.map((file) =>
                file.dataUrl ? (
                  <button key={file.id} type="button" className="msg-image-thumb" onClick={() => onOpenImage(file)} title={file.name}>
                    <img src={file.dataUrl} alt={file.name} loading="lazy" />
                  </button>
                ) : (
                  <div key={file.id} className="media-grid__placeholder" title={`${file.name} (no preview stored)`}>
                    <Icon name="image" size={20} />
                    <small>{file.name}</small>
                  </div>
                ),
              )}
            </div>
          )
        )}

        {tab === "files" && (
          files.length === 0 ? (
            <p className="info-panel__empty">No files shared in this conversation yet.</p>
          ) : (
            <div className="info-panel__files">
              {files.map((file) => (
                <FileCard key={file.id} file={file} compact onOpenImage={onOpenImage} onDownload={onDownload} />
              ))}
            </div>
          )
        )}

        {tab === "links" && (
          links.length === 0 ? (
            <p className="info-panel__empty">No links shared in this conversation yet.</p>
          ) : (
            <ul className="link-list">
              {links.map(({ url, senderId, at }) => (
                <li key={url} className="link-item">
                  <Icon name="link" size={14} />
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    {url}
                  </a>
                  <small>
                    {personById(senderId)?.name ?? "Unknown"} · {formatDateTime(at)}
                  </small>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {myRole && null}
    </aside>
  );
}