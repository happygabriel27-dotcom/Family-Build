/* ============================================================
   FamilyBuild — Messages
   ------------------------------------------------------------
   Direct messages AND group chats on the existing messaging
   architecture (Conversation/Message collections).

   Features:
   - Text messages with image/file attachments (FileRecord refs)
   - Group chats: create, rename, add/remove portal members,
     leave; creator/admin manages membership
   - Conversation details panel: Media / Files / Links / Members
   - In-thread message search
   - Authorization-aware contact rules per role

   Attachments are references into the centralized files
   collection — no duplicated physical payloads.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { useData } from "../store/DataContext";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { FileCard } from "../components/messaging/FileCard";
import { MemberPickerModal } from "../components/messaging/MemberPickerModal";
import { ConversationInfoPanel } from "../components/messaging/ConversationInfoPanel";
import {
  MAX_INLINE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  detectFileKind,
  readFileAsDataUrl,
} from "../services/fileService";
import type { Conversation, FileRecord, Person } from "../data/types";
import { formatTime, timeAgo } from "../utils/format";

export function MessagesPage() {
  const { user, showToast } = useApp();
  const data = useData();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<FileRecord[]>([]);
  const [lightbox, setLightbox] = useState<FileRecord | null>(null);
  const [addMembersFor, setAddMembersFor] = useState<Conversation | null>(null);
  const [renameGroup, setRenameGroup] = useState<Conversation | null>(null);
  /** Two-step delete: first click opens the confirm dialog. */
  const [pendingDelete, setPendingDelete] = useState<{ conversationId: string; messageId: string } | null>(null);
  /** Two-step removal: confirm before removing another member from a group. */
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{ conversationId: string; personId: string } | null>(null);
  /** Two-step leave: confirm before leaving a group. */
  const [pendingLeaveGroup, setPendingLeaveGroup] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  const me = data.personById(user.personId);
  const myId = me?.id ?? "";
  const role = user.role;

  /* Role-based contact rules (authorization-aware messaging):
     owner ↔ everyone; manager ↔ team + clients + CS + developers;
     worker ↔ managers; developer ↔ managers/CS/owner;
     customer-service ↔ relevant organization members.
     Private conversations stay private to their participants. */
  const allowedContacts = useMemo(() => {
    return data.people.filter((p) => {
      if (p.id === myId) return false;
      switch (role) {
        case "owner":
          return true;
        case "manager":
          return (
            p.kind === "worker" ||
            p.kind === "property-owner" ||
            p.kind === "builder" ||
            p.kind === "developer" ||
            p.kind === "customer-service" ||
            p.kind === "admin"
          );
        case "worker":
          return p.kind === "builder";
        case "developer":
          return p.kind === "customer-service" || p.kind === "builder" || p.kind === "admin";
        case "customer-service":
          // Support communication: relevant organization members.
          return true;
        default:
          return false;
      }
    });
  }, [data.people, myId, role]);

  const myConversations = useMemo(
    () =>
      data.conversations
        .filter((c) => c.participantIds.includes(myId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.conversations, myId],
  );

  const filteredConversations = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return myConversations;
    return myConversations.filter((c) => {
      if (c.subject.toLowerCase().includes(q)) return true;
      return c.participantIds.some((pid) => (data.personById(pid)?.name ?? "").toLowerCase().includes(q));
    });
  }, [myConversations, listQuery, data]);

  const active = activeId ? data.conversations.find((c) => c.id === activeId) : null;

  const filesById = useMemo(() => new Map(data.files.map((f) => [f.id, f])), [data.files]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length, activeId]);

  useEffect(() => {
    if (active && !active.messages.every((m) => m.readBy.includes(myId))) {
      data.markConversationRead(active.id, myId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* Reset transient thread state when switching conversations. */
  useEffect(() => {
    setThreadSearch("");
    setSearchOpen(false);
    setStagedFiles([]);
  }, [activeId]);

  const conversationTitle = (conv: Conversation) =>
    conv.kind === "group"
      ? conv.subject
      : conv.participantIds.filter((p) => p !== myId).map((pid) => data.personById(pid)?.name ?? pid).join(", ") || "?";

  const lastMessage = (conv: Conversation) => conv.messages[conv.messages.length - 1];

  const hasUnread = (conv: Conversation) =>
    conv.messages.some((m) => m.senderId !== myId && !m.readBy.includes(myId));

  /* In-thread search: matches text or attachment filenames. */
  const visibleMessages = useMemo(() => {
    if (!active) return [];
    const q = threadSearch.trim().toLowerCase();
    if (!q) return active.messages;
    return active.messages.filter((m) => {
      if (m.text.toLowerCase().includes(q)) return true;
      return (m.attachments ?? []).some((a) =>
        (filesById.get(a.fileId)?.name ?? "").toLowerCase().includes(q),
      );
    });
  }, [active, threadSearch, filesById]);

  const send = () => {
    if (!active || (!draft.trim() && stagedFiles.length === 0)) return;
    data.sendMessage(active.id, myId, draft.trim(), stagedFiles.map((f) => f.id));
    setDraft("");
    setStagedFiles([]);
  };

  const stageAttachment = async (fileList: FileList | null) => {
    if (!fileList || !active) return;
    for (const browserFile of Array.from(fileList)) {
      if (browserFile.size > MAX_UPLOAD_BYTES) {
        showToast(`${browserFile.name} is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1_000_000)} MB in demo mode)`, "error");
        continue;
      }
      const kind = detectFileKind(browserFile.name, browserFile.type);
      let dataUrl: string | undefined;
      if (kind === "image" && browserFile.size <= MAX_INLINE_IMAGE_BYTES) {
        try {
          dataUrl = await readFileAsDataUrl(browserFile);
        } catch {
          dataUrl = undefined;
        }
      }
      const record = data.addFileRecord({
        name: browserFile.name,
        kind,
        mimeType: browserFile.type || "application/octet-stream",
        sizeBytes: browserFile.size,
        uploadedById: myId,
        description: undefined,
        visibility: "conversation",
        conversationId: active.id,
        storageKey: `mock://uploads/${Date.now()}-${browserFile.name}`,
        ...(dataUrl ? { dataUrl } : {}),
      });
      setStagedFiles((prev) => [...prev, record]);
    }
    if (attachInputRef.current) attachInputRef.current.value = "";
  };

  const unstageAttachment = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
    data.deleteFileRecord(id);
  };

  const downloadFile = (file: FileRecord) => {
    if (!file.dataUrl) {
      showToast("Demo build — binary content is not stored locally for this file.", "info");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const openImage = (file: FileRecord) => setLightbox(file);

  return (
    <div className={`messages-page ${infoOpen && active ? "messages-page--with-info" : ""}`}>
      <div className="messages-list">
        <div className="messages-list__header">
          <h1 className="page-header__title" style={{ fontSize: 16 }}>Messages</h1>
          <button className="btn btn--primary btn--sm" onClick={() => setNewOpen(true)}>
            + New
          </button>
        </div>
        <div className="messages-list__search">
          <input
            type="search"
            placeholder="Search conversations…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
        {filteredConversations.length === 0 ? (
          <EmptyState
            icon="💬"
            title={listQuery ? "No matching conversations" : "No conversations yet"}
            text={listQuery ? "Try a different name or subject." : "Start a conversation or group chat."}
            action={
              !listQuery ? (
                <button className="btn btn--primary btn--sm" onClick={() => setNewOpen(true)}>
                  + New message
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="conversation-list">
            {filteredConversations.map((conv) => {
              const last = lastMessage(conv);
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={`conversation-item ${activeId === conv.id ? "active" : ""}`}
                    onClick={() => setActiveId(conv.id)}
                  >
                    {conv.kind === "group" ? (
                      <span className="group-avatar">
                        {conv.image ? <img src={conv.image} alt="" /> : <span>{conv.subject.slice(0, 2).toUpperCase()}</span>}
                      </span>
                    ) : (
                      <Avatar name={conversationTitle(conv)} size={34} />
                    )}
                    <span className="conversation-item__body">
                      <span className="conversation-item__top">
                        <strong>{conversationTitle(conv)}</strong>
                        {last && <time>{timeAgo(last.timestamp)}</time>}
                      </span>
                      <span className="conversation-item__subject">
                        {conv.kind === "group" ? `Group · ${conv.participantIds.length} members` : conv.subject}
                      </span>
                      {last && (
                        <span className="conversation-item__preview">
                          {last.text.trim() || `📎 ${(last.attachments ?? []).length} attachment(s)`}
                        </span>
                      )}
                    </span>
                    {hasUnread(conv) && <span className="unread-dot" aria-label="Unread messages" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="messages-thread">
        {!active ? (
          <EmptyState
            icon="✉️"
            title="Select a conversation"
            text="Choose a conversation on the left, or start a new one."
          />
        ) : (
          <>
            <div className="messages-thread__header">
              {active.kind === "group" ? (
                <span className="group-avatar">
                  {active.image ? <img src={active.image} alt="" /> : <span>{active.subject.slice(0, 2).toUpperCase()}</span>}
                </span>
              ) : (
                <Avatar name={conversationTitle(active)} size={32} />
              )}
              <div>
                <strong>{conversationTitle(active)}</strong>
                <small>
                  {active.kind === "group"
                    ? `${active.participantIds.length} members`
                    : `${active.subject}${active.propertyId ? ` · ${data.propertyById(active.propertyId)?.name}` : ""}`}
                </small>
              </div>
              <div className="messages-thread__header-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSearchOpen((v) => !v)}
                  aria-label="Search in conversation"
                  title="Search in conversation"
                >
                  <Icon name="search" size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setInfoOpen((v) => !v)}
                  aria-label="Conversation details"
                  title="Details & shared content"
                >
                  <Icon name="info" size={14} />
                </button>
              </div>
            </div>

            {searchOpen && (
              <div className="messages-thread__searchbar">
                <input
                  type="search"
                  autoFocus
                  placeholder="Search messages and attachments…"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  aria-label="Search within this conversation"
                />
                {threadSearch.trim() && (
                  <span className="messages-thread__searchcount">
                    {visibleMessages.length} result{visibleMessages.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}

            <div className="messages-thread__body">
              {active.messages.length === 0 ? (
                <p className="messages-thread__empty">No messages yet — say hello.</p>
              ) : visibleMessages.length === 0 ? (
                <p className="messages-thread__empty">No messages match “{threadSearch}”.</p>
              ) : (
                visibleMessages.map((msg) => {
                  const mine = msg.senderId === myId;
                  const attachments = (msg.attachments ?? [])
                    .map((a) => filesById.get(a.fileId))
                    .filter((f): f is FileRecord => Boolean(f));

                  /* Deleted message — clean tombstone, no residual content. */
                  if (msg.deleted) {
                    return (
                      <div key={msg.id} className={`chat-bubble chat-bubble--deleted ${mine ? "chat-bubble--mine" : ""}`}>
                        {!mine && <small className="chat-bubble__sender">{data.actorName(msg.senderId)}</small>}
                        <p>Message deleted</p>
                        <time>{formatTime(msg.timestamp)}</time>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`chat-bubble ${mine ? "chat-bubble--mine" : ""}`}>
                      {!mine && <small className="chat-bubble__sender">{data.actorName(msg.senderId)}</small>}
                      {msg.text.trim() && <p>{msg.text}</p>}
                      {attachments.length > 0 && (
                        <div className="msg-attachments">
                          {attachments.map((file) => (
                            <FileCard key={file.id} file={file} compact onOpenImage={openImage} onDownload={downloadFile} />
                          ))}
                        </div>
                      )}
                      <time>{formatTime(msg.timestamp)}</time>
                      {mine && (
                        <button
                          type="button"
                          className="chat-bubble__delete"
                          onClick={() => setPendingDelete({ conversationId: active.id, messageId: msg.id })}
                          aria-label="Delete message"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {stagedFiles.length > 0 && (
              <div className="composer-staged">
                {stagedFiles.map((file) => (
                  <span key={file.id} className="member-chip">
                    📎 {file.name}
                    <button type="button" onClick={() => unstageAttachment(file.id)} aria-label={`Remove ${file.name}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form
              className="messages-thread__composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                ref={attachInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => void stageAttachment(e.target.files)}
                aria-label="Attach files"
              />
              <button
                type="button"
                className="btn btn--ghost composer-attach-btn"
                onClick={() => attachInputRef.current?.click()}
                aria-label="Attach a file"
                title="Attach images or files"
              >
                <Icon name="paperclip" size={16} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                aria-label="Message text"
              />
              <button type="submit" className="btn btn--primary" disabled={!draft.trim() && stagedFiles.length === 0} aria-label="Send message">
                <Icon name="send" size={15} /> Send
              </button>
            </form>
          </>
        )}
      </div>

      {infoOpen && active && (
        <ConversationInfoPanel
          conversation={active}
          filesById={filesById}
          personById={data.personById}
          myId={myId}
          myRole={role}
          onClose={() => setInfoOpen(false)}
          onOpenImage={openImage}
          onDownload={downloadFile}
          onAddMembers={() => setAddMembersFor(active)}
          onRemoveMember={(personId) => {
            /* Step 1 of 2 — open confirmation; nothing is removed yet. */
            setPendingRemoveMember({ conversationId: active.id, personId });
          }}
          onLeaveGroup={() => {
            /* Step 1 of 2 — open confirmation; nothing happens yet. */
            setPendingLeaveGroup(active);
          }}
          onRenameGroup={() => setRenameGroup(active)}
        />
      )}

      {newOpen && (
        <NewConversationModal
          contacts={allowedContacts}
          onClose={() => setNewOpen(false)}
          onStartDirect={(contactId, subject) => {
            const conv = data.startOrGetConversation([myId, contactId], subject.trim() || "General");
            setActiveId(conv.id);
            setNewOpen(false);
          }}
          onCreateGroup={(name, memberIds) => {
            const conv = data.createGroupConversation({ name, memberIds, createdById: myId });
            setActiveId(conv.id);
            setInfoOpen(true);
            setNewOpen(false);
            showToast(`Group "${name}" created`, "success");
          }}
        />
      )}

      {addMembersFor && (
        <MemberPickerModal
          title={`Add members to “${addMembersFor.subject}”`}
          candidates={allowedContacts.filter((p) => !addMembersFor.participantIds.includes(p.id))}
          selectedIds={[]}
          confirmLabel="Add to group"
          onClose={() => setAddMembersFor(null)}
          onConfirm={(ids) => {
            data.addConversationMembers(addMembersFor.id, ids, myId);
            setAddMembersFor(null);
            showToast(`${ids.length} member${ids.length > 1 ? "s" : ""} added`, "success");
          }}
        />
      )}

      {renameGroup && (
        <RenameGroupModal
          conversation={renameGroup}
          onClose={() => setRenameGroup(null)}
          onSave={(name) => {
            data.updateConversation(renameGroup.id, { subject: name });
            setRenameGroup(null);
            showToast("Group renamed", "success");
          }}
        />
      )}

      {lightbox && (
        <Modal title={lightbox.name} subtitle={`${lightbox.mimeType}`} onClose={() => setLightbox(null)} wide>
          <div className="lightbox">
            {lightbox.dataUrl ? (
              <img src={lightbox.dataUrl} alt={lightbox.name} />
            ) : (
              <EmptyState icon="🖼️" title="No preview available" text="This demo file has no inline preview stored." />
            )}
          </div>
        </Modal>
      )}

      {/* Two-step destructive confirmation for message deletion. */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete message"
          message="Are you sure you want to delete this message? This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            data.deleteMessage(pendingDelete.conversationId, pendingDelete.messageId, myId);
            showToast("Message deleted", "info");
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Two-step destructive confirmation for group member removal (step 2). */}
      {pendingRemoveMember && (
        <ConfirmDialog
          title={`Remove ${data.actorName(pendingRemoveMember.personId)} from this group?`}
          message="They will no longer be able to participate in this group conversation unless they are added again."
          confirmLabel="Remove Member"
          danger
          onConfirm={() => {
            data.removeConversationMember(pendingRemoveMember.conversationId, pendingRemoveMember.personId);
            showToast("Member removed from group", "success");
          }}
          onCancel={() => setPendingRemoveMember(null)}
        />
      )}

      {/* Two-step destructive confirmation for leaving a group (step 2). */}
      {pendingLeaveGroup && (
        <ConfirmDialog
          title={`Leave “${pendingLeaveGroup.subject}”?`}
          message="You will no longer receive messages from this group unless you are added again."
          confirmLabel="Leave Group"
          danger
          onConfirm={() => {
            data.leaveConversation(pendingLeaveGroup.id, myId);
            setInfoOpen(false);
            setActiveId(null);
            showToast("You left the group", "info");
          }}
          onCancel={() => setPendingLeaveGroup(null)}
        />
      )}
    </div>
  );
}

/* ---------- New conversation / group modal ---------- */

function NewConversationModal({
  contacts,
  onClose,
  onStartDirect,
  onCreateGroup,
}: {
  contacts: ReturnType<typeof useData>["people"];
  onClose: () => void;
  onStartDirect: (contactId: string, subject: string) => void;
  onCreateGroup: (name: string, memberIds: string[]) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Modal
        title="New conversation"
        subtitle="You can only message people your role is permitted to contact."
        onClose={onClose}
        footer={
          mode === "direct" ? (
            <>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!contactId}
                onClick={() => onStartDirect(contactId, subject)}
              >
                Start conversation
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!groupName.trim() || groupMembers.length === 0}
                onClick={() => onCreateGroup(groupName.trim(), groupMembers)}
              >
                Create group ({groupMembers.length})
              </button>
            </>
          )
        }
      >
        <div className="modal-tabs" role="tablist" aria-label="Conversation type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "direct"}
            className={`modal-tab ${mode === "direct" ? "active" : ""}`}
            onClick={() => setMode("direct")}
          >
            Direct message
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "group"}
            className={`modal-tab ${mode === "group" ? "active" : ""}`}
            onClick={() => setMode("group")}
          >
            Group chat
          </button>
        </div>

        {contacts.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
            No contacts available for your role yet.
          </p>
        ) : mode === "direct" ? (
          <>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="nc-contact">To</label>
              <select id="nc-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nc-subject">Subject</label>
              <input id="nc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Kitchen renovation timeline" />
            </div>
          </>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label htmlFor="nc-group-name">Group name</label>
              <input
                id="nc-group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Inventory Team"
              />
            </div>
            <div className="form-group">
              <label>Members ({groupMembers.length} selected)</label>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPickerOpen(true)}>
                {groupMembers.length === 0 ? "+ Add members" : "Edit members"}
              </button>
              {groupMembers.length > 0 && (
                <div className="member-picker__selected" style={{ marginTop: 8 }}>
                  {groupMembers.map((id) => {
                    const person = contacts.find((c) => c.id === id);
                    return (
                      <span key={id} className="member-chip">
                        {person?.name ?? id}
                        <button
                          type="button"
                          onClick={() => setGroupMembers((prev) => prev.filter((m) => m !== id))}
                          aria-label={`Remove ${person?.name}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {pickerOpen && (
        <MemberPickerModal
          title="Select group members"
          subtitle="Search existing portal members by name or email, then multi-select."
          candidates={contacts}
          selectedIds={groupMembers}
          confirmLabel="Use selection"
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setGroupMembers(ids);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

function RenameGroupModal({
  conversation,
  onClose,
  onSave,
}: {
  conversation: Conversation;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(conversation.subject);
  return (
    <Modal
      title="Rename group"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            Save name
          </button>
        </>
      }
    >
      <div className="form-group">
        <label htmlFor="rg-name">Group name</label>
        <input id="rg-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
    </Modal>
  );
}

export type { Person };