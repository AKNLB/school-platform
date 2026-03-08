"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "@/lib/api";

type Audience = "all" | "teachers" | "parents" | "students";

type Attachment = {
  filename: string;
  url: string;
};

type Announcement = {
  id: number;
  title: string;
  description: string;
  audience: Audience;
  pinned: boolean;
  created_at: string | null;
  created_by_user_id: number | null;
  attachments: Attachment[];
};

type UpsertAnnouncement = {
  title: string;
  description: string;
  audience: Audience;
  pinned: boolean;
};

const EMPTY_FORM: UpsertAnnouncement = {
  title: "",
  description: "",
  audience: "all",
  pinned: false,
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [audienceFilter, setAudienceFilter] = useState<Audience | "">("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<UpsertAnnouncement>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAnnouncements() {
    setLoading(true);
    setPageError(null);

    try {
      const params: Record<string, string> = {};
      if (audienceFilter) params.audience = audienceFilter;
      if (pinnedOnly) params.pinned = "true";

      const res = await api.get("/announcements", { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      setItems([]);
      setPageError(extractErr(error, "Failed to load announcements."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, [audienceFilter, pinnedOnly]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      pinned: items.filter((x) => x.pinned).length,
      teachers: items.filter((x) => x.audience === "teachers").length,
      parents: items.filter((x) => x.audience === "parents").length,
      students: items.filter((x) => x.audience === "students").length,
    };
  }, [items]);

  function openCreateModal() {
    setMode("create");
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  }

  function openEditModal(item: Announcement) {
    setMode("edit");
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description,
      audience: item.audience,
      pinned: item.pinned,
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function validateForm(values: UpsertAnnouncement): string | null {
    if (!values.title.trim()) return "Title is required.";
    if (!values.description.trim()) return "Description is required.";
    return null;
  }

  async function handleSubmit() {
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    setBusy(true);
    setFormError(null);

    try {
      if (mode === "create") {
        const res = await api.post("/announcements", form);
        const created = res?.data as Announcement | undefined;

        if (created?.id) {
          setItems((prev) => [created, ...prev]);
        } else {
          await loadAnnouncements();
        }
      } else {
        if (!editing?.id) throw new Error("No announcement selected.");

        const res = await api.put(`/announcements/${editing.id}`, form);
        const updated = res?.data as Announcement | undefined;

        if (updated?.id) {
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          await loadAnnouncements();
        }
      }

      setOpen(false);
    } catch (error: any) {
      setFormError(extractErr(error, "Failed to save announcement."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: Announcement) {
    const confirmed = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusy(true);
    setPageError(null);

    const previous = items;
    setItems((prev) => prev.filter((x) => x.id !== item.id));

    try {
      await api.delete(`/announcements/${item.id}`);
    } catch (error: any) {
      setItems(previous);
      setPageError(extractErr(error, "Failed to delete announcement."));
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadAttachment(item: Announcement, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    setPageError(null);

    try {
      const res = await api.post(`/announcements/${item.id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = res?.data as Announcement | undefined;
      if (updated?.id) {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        await loadAnnouncements();
      }
    } catch (error: any) {
      setPageError(extractErr(error, "Failed to upload attachment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAttachment(item: Announcement, filename: string) {
    const confirmed = window.confirm("Remove this attachment?");
    if (!confirmed) return;

    setBusy(true);
    setPageError(null);

    try {
      const res = await api.delete(
        `/announcements/${item.id}/attachments/${encodeURIComponent(filename)}`
      );

      const updated = res?.data as Announcement | undefined;
      if (updated?.id) {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        await loadAnnouncements();
      }
    } catch (error: any) {
      setPageError(extractErr(error, "Failed to remove attachment."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={page}>
      <div style={topBar}>
        <div>
          <h1 style={title}>Announcements</h1>
          <p style={subtitle}>
            Create updates for teachers, parents, and students.
          </p>
        </div>

        <div style={topActions}>
          <button onClick={loadAnnouncements} style={buttonSecondary} disabled={loading || busy}>
            Refresh
          </button>
          <button onClick={openCreateModal} style={buttonPrimary} disabled={busy}>
            + New Announcement
          </button>
        </div>
      </div>

      <div style={statsGrid}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pinned" value={stats.pinned} />
        <StatCard label="Teachers" value={stats.teachers} />
        <StatCard label="Parents" value={stats.parents} />
        <StatCard label="Students" value={stats.students} />
      </div>

      <div style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements..."
          style={searchInput}
        />

        <div style={filterRow}>
          <Chip active={audienceFilter === ""} onClick={() => setAudienceFilter("")} label="All" />
          <Chip active={audienceFilter === "all"} onClick={() => setAudienceFilter("all")} label="Audience: All" />
          <Chip active={audienceFilter === "teachers"} onClick={() => setAudienceFilter("teachers")} label="Teachers" />
          <Chip active={audienceFilter === "parents"} onClick={() => setAudienceFilter("parents")} label="Parents" />
          <Chip active={audienceFilter === "students"} onClick={() => setAudienceFilter("students")} label="Students" />
          <Chip
            active={pinnedOnly}
            onClick={() => setPinnedOnly((prev) => !prev)}
            label={pinnedOnly ? "Pinned only ✓" : "Pinned only"}
          />
        </div>
      </div>

      {pageError && (
        <div style={errorBox}>
          <strong>Error:</strong> {pageError}
        </div>
      )}

      <div style={panel}>
        {loading ? (
          <div style={emptyState}>Loading announcements...</div>
        ) : filteredItems.length === 0 ? (
          <div style={emptyState}>No announcements found.</div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} style={announcementRow}>
              <div style={{ flex: 1 }}>
                <div style={announcementHeader}>
                  <div style={announcementTitle}>{item.title}</div>
                  {item.pinned && <Badge text="PINNED" />}
                  <Badge text={item.audience.toUpperCase()} subtle />
                </div>

                <div style={announcementBody}>{item.description}</div>

                <div style={metaText}>
                  {item.created_at ? `Posted ${formatDate(item.created_at)}` : "No date"}
                </div>

                {item.attachments?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={attachmentsLabel}>Attachments</div>
                    <div style={attachmentList}>
                      {item.attachments.map((att) => (
                        <div key={att.filename} style={attachmentPill}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            style={attachmentLink}
                          >
                            {att.filename}
                          </a>
                          <button
                            onClick={() => handleDeleteAttachment(item, att.filename)}
                            style={miniDanger}
                            disabled={busy}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={rowActions}>
                <label style={buttonSecondary}>
                  Upload
                  <input
                    type="file"
                    hidden
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (file) handleUploadAttachment(item, file);
                    }}
                  />
                </label>

                <button style={buttonSecondary} onClick={() => openEditModal(item)} disabled={busy}>
                  Edit
                </button>

                <button style={buttonDanger} onClick={() => handleDelete(item)} disabled={busy}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <Modal
          title={mode === "create" ? "Create Announcement" : "Edit Announcement"}
          onClose={closeModal}
        >
          {formError && <div style={{ ...errorBox, marginTop: 0 }}>{formError}</div>}

          <div style={formGrid}>
            <Field label="Title" full>
              <input
                style={fieldInput}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="School resumes Monday"
              />
            </Field>

            <Field label="Audience">
              <select
                style={fieldInput}
                value={form.audience}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, audience: e.target.value as Audience }))
                }
              >
                <option value="all">All</option>
                <option value="teachers">Teachers</option>
                <option value="parents">Parents</option>
                <option value="students">Students</option>
              </select>
            </Field>

            <Field label="Pinned">
              <button
                type="button"
                style={form.pinned ? buttonPrimary : buttonSecondary}
                onClick={() => setForm((prev) => ({ ...prev, pinned: !prev.pinned }))}
              >
                {form.pinned ? "Pinned ✓" : "Not pinned"}
              </button>
            </Field>

            <Field label="Message" full>
              <textarea
                style={{ ...fieldInput, minHeight: 150, resize: "vertical" }}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Write your announcement here..."
              />
            </Field>
          </div>

          <div style={modalActions}>
            <button style={buttonSecondary} onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button style={buttonPrimary} onClick={handleSubmit} disabled={busy}>
              {busy ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...chip,
        background: active ? "#ffffff" : "rgba(255,255,255,0.06)",
        color: active ? "#0b0b0f" : "#ffffff",
      }}
    >
      {label}
    </button>
  );
}

function Badge({ text, subtle }: { text: string; subtle?: boolean }) {
  return (
    <span
      style={{
        ...badge,
        background: subtle ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
        opacity: subtle ? 0.85 : 1,
      }}
    >
      {text}
    </span>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div onMouseDown={onClose} style={modalBackdrop}>
      <div onMouseDown={(e) => e.stopPropagation()} style={modalCard}>
        <div style={modalHeader}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={iconButton}>
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function extractErr(error: any, fallback: string) {
  const msg =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data ||
    error?.message;

  if (!msg) return fallback;
  if (typeof msg === "string") return msg;

  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

const page: CSSProperties = {
  padding: 8,
};

const topBar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 950,
};

const subtitle: CSSProperties = {
  marginTop: 6,
  opacity: 0.72,
};

const topActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginTop: 18,
};

const statCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
};

const statValue: CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
};

const statLabel: CSSProperties = {
  marginTop: 6,
  opacity: 0.75,
  fontSize: 13,
};

const toolbar: CSSProperties = {
  marginTop: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const searchInput: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  outline: "none",
};

const filterRow: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const panel: CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  overflow: "hidden",
};

const emptyState: CSSProperties = {
  padding: 18,
  opacity: 0.8,
};

const announcementRow: CSSProperties = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const announcementHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const announcementTitle: CSSProperties = {
  fontWeight: 950,
  fontSize: 17,
};

const announcementBody: CSSProperties = {
  marginTop: 8,
  opacity: 0.85,
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
};

const metaText: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.65,
};

const attachmentsLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
  marginBottom: 6,
};

const attachmentList: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const attachmentPill: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
};

const attachmentLink: CSSProperties = {
  color: "#fff",
  textDecoration: "none",
  fontWeight: 800,
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
};

const fieldInput: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  outline: "none",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 14,
};

const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};

const modalCard: CSSProperties = {
  width: "min(900px, 100%)",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0b0b0f",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const modalHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const buttonPrimary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#fff",
  color: "#0b0b0f",
  fontWeight: 900,
  cursor: "pointer",
};

const buttonSecondary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const buttonDanger: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 800,
  cursor: "pointer",
};

const miniDanger: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 900,
  cursor: "pointer",
};

const iconButton: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const badge: CSSProperties = {
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0.6,
  padding: "6px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
};

const chip: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  fontWeight: 900,
  cursor: "pointer",
};

const errorBox: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,120,120,0.3)",
  background: "rgba(255,80,80,0.08)",
  color: "#ffd5d5",
};