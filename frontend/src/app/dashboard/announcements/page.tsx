"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Audience = "all" | "teachers" | "parents" | "students";
type SortValue = "newest" | "oldest" | "title" | "audience";

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

type Upsert = {
  title: string;
  description: string;
  audience: Audience;
  pinned: boolean;
};

const emptyForm: Upsert = {
  title: "",
  description: "",
  audience: "all",
  pinned: false,
};

export default function AnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [audience, setAudience] = useState<Audience | "">("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("newest");

  const [items, setItems] = useState<Announcement[]>([]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<Upsert>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const params: Record<string, string> = {};
      if (audience) params.audience = audience;
      if (pinnedOnly) params.pinned = "true";

      const res = await api.get("/announcements", { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load announcements"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [audience, pinnedOnly]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = items.filter((a) => {
      if (!needle) return true;
      const t = (a.title || "").toLowerCase();
      const d = (a.description || "").toLowerCase();
      const aud = (a.audience || "").toLowerCase();
      return t.includes(needle) || d.includes(needle) || aud.includes(needle);
    });

    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      if (sortBy === "oldest") {
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      }

      if (sortBy === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }

      if (sortBy === "audience") {
        return String(a.audience || "").localeCompare(String(b.audience || ""));
      }

      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

    return list;
  }, [q, items, sortBy]);

  const stats = useMemo(() => {
    const total = items.length;
    const pinned = items.filter((x) => x.pinned).length;
    const teacher = items.filter((x) => x.audience === "teachers").length;
    const parent = items.filter((x) => x.audience === "parents").length;
    const student = items.filter((x) => x.audience === "students").length;
    const allAudience = items.filter((x) => x.audience === "all").length;
    const attachments = items.reduce((sum, item) => sum + (item.attachments?.length || 0), 0);

    return { total, pinned, teacher, parent, student, allAudience, attachments };
  }, [items]);

  const pinnedItems = useMemo(() => filtered.filter((x) => x.pinned), [filtered]);
  const normalItems = useMemo(() => filtered.filter((x) => !x.pinned), [filtered]);

  const recentHighlights = useMemo(() => {
    return [...items]
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 4);
  }, [items]);

  const hasActiveFilters = Boolean(audience || pinnedOnly || q.trim() || sortBy !== "newest");

  function openCreate(prefill?: Partial<Upsert>) {
    setMode("create");
    setEditing(null);
    setForm({ ...emptyForm, ...prefill });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(a: Announcement) {
    setMode("edit");
    setEditing(a);
    setForm({
      title: a.title ?? "",
      description: a.description ?? "",
      audience: a.audience ?? "all",
      pinned: !!a.pinned,
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function clearFilters() {
    setAudience("");
    setPinnedOnly(false);
    setQ("");
    setSortBy("newest");
  }

  function validate(p: Upsert): string | null {
    if (!p.title.trim()) return "Title is required.";
    if (!p.description.trim()) return "Description is required.";
    if (p.title.trim().length < 4) return "Title must be at least 4 characters.";
    if (p.description.trim().length < 10) return "Message should be at least 10 characters.";
    return null;
  }

  async function submit() {
    setFormError(null);
    setErr(null);
    setSuccess(null);

    const v = validate(form);
    if (v) {
      setFormError(v);
      return;
    }

    setBusy(true);

    try {
      if (mode === "create") {
        const res = await api.post("/announcements", { ...form });
        const created = isAnnouncement(res?.data) ? res.data : null;

        if (created?.id) {
          setItems((prev) => [created, ...prev]);
        } else {
          await load();
        }

        setSuccess("Announcement created successfully.");
      } else {
        if (!editing?.id) throw new Error("No announcement selected.");

        const res = await api.put(`/announcements/${editing.id}`, { ...form });
        const updated = isAnnouncement(res?.data) ? res.data : null;

        if (updated?.id) {
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          await load();
        }

        setSuccess("Announcement updated successfully.");
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Announcement) {
    const ok = window.confirm(`Delete "${a.title}"? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    const prev = items;
    setItems((p) => p.filter((x) => x.id !== a.id));

    try {
      await api.delete(`/announcements/${a.id}`);
      setSuccess("Announcement deleted.");
    } catch (e: unknown) {
      setItems(prev);
      setErr(extractErr(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(a: Announcement, file: File) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post(`/announcements/${a.id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = isAnnouncement(res?.data) ? res.data : null;
      if (updated?.id) {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        await load();
      }

      setSuccess("Attachment uploaded.");
    } catch (e: unknown) {
      setErr(extractErr(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttachment(a: Announcement, filename: string) {
    const ok = window.confirm("Remove this attachment?");
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const res = await api.delete(`/announcements/${a.id}/attachments/${encodeURIComponent(filename)}`);
      const updated = isAnnouncement(res?.data) ? res.data : null;

      if (updated?.id) {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        await load();
      }

      setSuccess("Attachment removed.");
    } catch (e: unknown) {
      setErr(extractErr(e, "Remove attachment failed"));
    } finally {
      setBusy(false);
    }
  }

  async function quickTogglePinned(a: Announcement) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    const prev = items;
    const nextPinned = !a.pinned;

    setItems((current) =>
      current.map((x) => (x.id === a.id ? { ...x, pinned: nextPinned } : x))
    );

    try {
      const res = await api.put(`/announcements/${a.id}`, {
        title: a.title,
        description: a.description,
        audience: a.audience,
        pinned: nextPinned,
      });

      const updated = isAnnouncement(res?.data) ? res.data : null;
      if (updated?.id) {
        setItems((current) => current.map((x) => (x.id === updated.id ? updated : x)));
      }

      setSuccess(nextPinned ? "Announcement pinned." : "Announcement unpinned.");
    } catch (e: unknown) {
      setItems(prev);
      setErr(extractErr(e, "Pin update failed"));
    } finally {
      setBusy(false);
    }
  }

  function renderAnnouncement(a: Announcement) {
    const attachmentCount = a.attachments?.length || 0;

    return (
      <article
        key={a.id}
        style={{
          ...announcementCard,
          ...(a.pinned ? pinnedCard : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = a.pinned
            ? "rgba(250,204,21,0.36)"
            : "rgba(255,255,255,0.08)";
        }}
      >
        <div style={announcementTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={announcementTitleRow}>
              <h3 style={announcementTitle}>{a.title}</h3>
              {a.pinned && <Badge text="PINNED" />}
              <AudienceBadge audience={a.audience} />
              {attachmentCount > 0 ? <Badge text={`${attachmentCount} ATTACHMENT${attachmentCount > 1 ? "S" : ""}`} subtle /> : null}
            </div>

            <div style={announcementBody}>{a.description}</div>

            <div style={metaRow}>
              <span style={metaText}>{a.created_at ? formatDate(a.created_at) : "Date unavailable"}</span>
              {a.created_at ? <span style={metaDot}>•</span> : null}
              {a.created_at ? <span style={metaText}>{timeAgo(a.created_at)}</span> : null}
              {a.created_by_user_id ? <span style={metaDot}>•</span> : null}
              {a.created_by_user_id ? <span style={metaText}>Author ID: {a.created_by_user_id}</span> : null}
            </div>

            {a.attachments?.length ? (
              <div style={{ marginTop: 14 }}>
                <div style={attachmentsLabel}>Attachments</div>
                <div style={attachmentWrap}>
                  {a.attachments.map((att) => (
                    <div key={att.filename} style={attachmentPill}>
                      <span style={attachmentIcon}>📎</span>
                      <a href={att.url} target="_blank" rel="noreferrer" style={attachmentLink}>
                        {att.filename}
                      </a>
                      <button
                        onClick={() => void deleteAttachment(a, att.filename)}
                        style={miniDanger}
                        disabled={busy}
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={actionsCol}>
            <button
              style={a.pinned ? btnPrimary : btnSecondary}
              onClick={() => void quickTogglePinned(a)}
              disabled={busy}
            >
              {a.pinned ? "Unpin" : "Pin"}
            </button>

            <label style={btnSecondary}>
              Upload
              <input
                type="file"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (!f) return;
                  void uploadAttachment(a, f);
                }}
                disabled={busy}
              />
            </label>

            <button style={btnSecondary} onClick={() => openEdit(a)} disabled={busy}>
              Edit
            </button>
            <button style={btnDanger} onClick={() => void remove(a)} disabled={busy}>
              Delete
            </button>
          </div>
        </div>
      </article>
    );
  }

  const messageLength = form.description.trim().length;

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={heroCard}>
          <div style={heroGlowA} />
          <div style={heroGlowB} />

          <div style={heroContent}>
            <div>
              <div style={eyebrow}>School Platform</div>
              <h1 style={heroTitle}>Announcements</h1>
              <p style={subtitle}>
                Share updates with teachers, parents, and students from one polished communication hub.
              </p>

              <div style={heroMiniStats}>
                <HeroMiniBadge label="Published" value={String(stats.total)} />
                <HeroMiniBadge label="Pinned" value={String(stats.pinned)} />
                <HeroMiniBadge label="Attachments" value={String(stats.attachments)} />
              </div>
            </div>

            <div style={heroActions}>
              <button onClick={() => void load()} style={btnSecondary} disabled={loading || busy}>
                Refresh
              </button>
              <button onClick={() => openCreate({ audience: "teachers" })} style={btnSecondary} disabled={busy}>
                Teachers Update
              </button>
              <button onClick={() => openCreate({ audience: "parents" })} style={btnSecondary} disabled={busy}>
                Parents Update
              </button>
              <button onClick={openCreate} style={btnPrimary} disabled={busy}>
                + New Announcement
              </button>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pinned" value={stats.pinned} />
          <StatCard label="All Audience" value={stats.allAudience} />
          <StatCard label="Teachers" value={stats.teacher} />
          <StatCard label="Parents" value={stats.parent} />
          <StatCard label="Students" value={stats.student} />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Recent Highlights</div>
            <div style={insightSub}>Latest posts across the communication hub</div>

            {recentHighlights.length === 0 ? (
              <div style={emptyMini}>No recent announcements yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {recentHighlights.map((item) => (
                  <button
                    key={item.id}
                    style={highlightRowBtn}
                    onClick={() => openEdit(item)}
                  >
                    <div style={highlightRow}>
                      <div style={highlightIcon}>{item.pinned ? "📌" : "📣"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={highlightTitle}>{item.title}</div>
                        <div style={highlightMeta}>
                          {titleizeAudience(item.audience)} • {item.created_at ? timeAgo(item.created_at) : "--"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Quick Posting Lanes</div>
            <div style={insightSub}>Start with the most common communication flows</div>

            <div style={quickPostGrid}>
              <button style={quickPostBtn} onClick={() => openCreate({ audience: "all", pinned: true })}>
                📌 Urgent School-wide
              </button>
              <button style={quickPostBtn} onClick={() => openCreate({ audience: "teachers" })}>
                👩‍🏫 Staff Notice
              </button>
              <button style={quickPostBtn} onClick={() => openCreate({ audience: "parents" })}>
                👨‍👩‍👧 Parent Update
              </button>
              <button style={quickPostBtn} onClick={() => openCreate({ audience: "students" })}>
                🎓 Student Notice
              </button>
            </div>
          </div>
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, message, or audience..."
              style={searchInput}
            />

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortValue)} style={selectInput}>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="title">Sort: Title</option>
              <option value="audience">Sort: Audience</option>
            </select>
          </div>

          <div style={toolbarRight}>
            <Chip active={audience === ""} onClick={() => setAudience("")} label="All audiences" />
            <Chip active={audience === "all"} onClick={() => setAudience("all")} label="Audience: All" />
            <Chip active={audience === "teachers"} onClick={() => setAudience("teachers")} label="Teachers" />
            <Chip active={audience === "parents"} onClick={() => setAudience("parents")} label="Parents" />
            <Chip active={audience === "students"} onClick={() => setAudience("students")} label="Students" />
            <Chip
              active={pinnedOnly}
              onClick={() => setPinnedOnly((p) => !p)}
              label={pinnedOnly ? "Pinned only ✓" : "Pinned only"}
            />
            <button onClick={clearFilters} style={btnSecondary} disabled={busy}>
              Clear
            </button>
          </div>
        </section>

        {hasActiveFilters && (
          <div style={chipBar}>
            {q.trim() ? <ActiveChip label={`Search: ${q.trim()}`} onRemove={() => setQ("")} /> : null}
            {audience ? <ActiveChip label={`Audience: ${titleizeAudience(audience)}`} onRemove={() => setAudience("")} /> : null}
            {pinnedOnly ? <ActiveChip label="Pinned only" onRemove={() => setPinnedOnly(false)} /> : null}
            {sortBy !== "newest" ? <ActiveChip label={`Sort: ${sortLabel(sortBy)}`} onRemove={() => setSortBy("newest")} /> : null}
          </div>
        )}

        {err && (
          <div style={alertError}>
            <b style={{ marginRight: 8 }}>Error:</b>
            {err}
            <button
              onClick={() => void load()}
              style={{ ...btnSecondary, marginLeft: 12 }}
              disabled={busy}
            >
              Retry
            </button>
          </div>
        )}

        {success && (
          <div style={alertSuccess}>
            <b style={{ marginRight: 8 }}>Success:</b>
            {success}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div style={panelHeaderTop}>
              <div>
                <div style={panelTitle}>Announcement Feed</div>
                <div style={panelSubtitle}>
                  {loading ? "Loading..." : `${filtered.length} result(s) shown`}
                </div>
              </div>

              <div style={resultPill}>
                {filtered.length} visible
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Loading announcements...</div>
              <div style={emptyStateText}>Please wait while updates are being pulled in.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyStateIcon}>📣</div>
              <div style={emptyStateTitle}>No announcements found</div>
              <div style={emptyStateText}>
                Try changing filters, clearing the search, or creating a new update for your school community.
              </div>

              <div style={emptyStateActions}>
                <button onClick={clearFilters} style={btnSecondary}>
                  Clear Filters
                </button>
                <button onClick={openCreate} style={btnPrimary}>
                  + New Announcement
                </button>
              </div>
            </div>
          ) : (
            <>
              {pinnedItems.length > 0 && (
                <>
                  <div style={sectionDivider}>📌 Pinned Announcements</div>
                  {pinnedItems.map(renderAnnouncement)}
                </>
              )}

              {normalItems.length > 0 && (
                <>
                  <div style={sectionDivider}>All Announcements</div>
                  {normalItems.map(renderAnnouncement)}
                </>
              )}
            </>
          )}
        </section>

        {open && (
          <Modal title={mode === "create" ? "New Announcement" : "Edit Announcement"} onClose={closeModal}>
            {formError && <div style={{ ...alertError, marginTop: 0 }}>{formError}</div>}

            <div style={composeCard}>
              <div style={composeTitle}>Compose</div>
              <div style={composeSub}>
                Write clear updates for the right audience and pin important notices to the top.
              </div>
            </div>

            <div style={formGrid}>
              <Field label="Title" full>
                <input
                  style={fieldInput}
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. School reopens Monday"
                />
              </Field>

              <Field label="Audience">
                <select
                  style={fieldInput}
                  value={form.audience}
                  onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value as Audience }))}
                >
                  <option value="all">All</option>
                  <option value="teachers">Teachers</option>
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                </select>
              </Field>

              <Field label="Pinned">
                <button
                  style={form.pinned ? btnPrimary : btnSecondary}
                  onClick={() => setForm((p) => ({ ...p, pinned: !p.pinned }))}
                  type="button"
                >
                  {form.pinned ? "Pinned ✓" : "Not pinned"}
                </button>
              </Field>

              <Field label="Message" full>
                <textarea
                  style={{ ...fieldInput, minHeight: 170, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Write the announcement..."
                />
              </Field>
            </div>

            <div style={composeFooter}>
              <div style={composeHint}>
                Audience: <b>{titleizeAudience(form.audience)}</b> • Message length: <b>{messageLength}</b>
              </div>

              <div style={modalActions}>
                <button style={btnSecondary} onClick={closeModal} disabled={busy}>
                  Cancel
                </button>
                <button style={btnPrimary} onClick={() => void submit()} disabled={busy}>
                  {busy ? "Saving..." : mode === "create" ? "Publish" : "Save Changes"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function HeroMiniBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMiniBadge}>
      <div style={heroMiniLabel}>{label}</div>
      <div style={heroMiniValue}>{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active ? "#ffffff" : "rgba(255,255,255,0.06)",
        color: active ? "#0b1220" : "#f8fafc",
        fontWeight: 900,
        cursor: "pointer",
        transition: "all 0.18s ease",
      }}
    >
      {label}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={activeChip}>
      <span>{label}</span>
      <button onClick={onRemove} style={activeChipBtn}>
        ✕
      </button>
    </div>
  );
}

function Badge({ text, subtle }: { text: string; subtle?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 950,
        letterSpacing: 0.6,
        padding: "6px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: subtle ? "rgba(255,255,255,0.06)" : "rgba(96,165,250,0.18)",
        color: "#e5eefc",
        opacity: subtle ? 0.9 : 1,
      }}
    >
      {text}
    </span>
  );
}

function AudienceBadge({ audience }: { audience: Audience }) {
  const colors: Record<Audience, string> = {
    all: "#64748b",
    teachers: "#2563eb",
    parents: "#16a34a",
    students: "#d97706",
  };

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 950,
        letterSpacing: 0.6,
        padding: "6px 8px",
        borderRadius: 999,
        background: colors[audience],
        color: "#ffffff",
      }}
    >
      {audience.toUpperCase()}
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
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.72)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#0f172a",
          boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, color: "#f8fafc" }}>{title}</div>
          <button onClick={onClose} style={iconBtn}>
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
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800, color: "#cbd5e1" }}>{label}</div>
      {children}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function titleizeAudience(audience: Audience | "") {
  if (!audience) return "All audiences";
  if (audience === "all") return "All";
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function sortLabel(value: SortValue) {
  if (value === "newest") return "Newest";
  if (value === "oldest") return "Oldest";
  if (value === "title") return "Title";
  return "Audience";
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const msg =
    err?.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    ("message" in err.response.data || "error" in err.response.data)
      ? (err.response.data as { message?: string; error?: string }).message ||
        (err.response.data as { message?: string; error?: string }).error
      : typeof err?.response?.data === "string"
        ? err.response.data
        : err?.message;

  if (!msg) return fallback;
  return msg;
}

function isAnnouncement(value: unknown): value is Announcement {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "number" && typeof v.title === "string";
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(59,130,246,0.15), transparent 35%), radial-gradient(circle at top left, rgba(168,85,247,0.10), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
};

const page: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
};

const heroCard: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.88))",
  boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
  marginBottom: 18,
};

const heroContent: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  padding: 24,
};

const heroGlowA: CSSProperties = {
  position: "absolute",
  width: 240,
  height: 240,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.18)",
  filter: "blur(40px)",
  top: -60,
  right: -20,
};

const heroGlowB: CSSProperties = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "rgba(168,85,247,0.12)",
  filter: "blur(42px)",
  bottom: -70,
  left: -30,
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#93c5fd",
  marginBottom: 6,
};

const heroTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 950,
  margin: 0,
};

const subtitle: CSSProperties = {
  marginTop: 8,
  maxWidth: 720,
  opacity: 0.88,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const heroMiniStats: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const heroMiniBadge: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
};

const heroMiniLabel: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const heroMiniValue: CSSProperties = {
  fontSize: 14,
  color: "#fff",
  fontWeight: 900,
  marginTop: 4,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const insightGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
};

const insightCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  padding: 16,
};

const insightTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const insightSub: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#94a3b8",
};

const highlightRowBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "left",
  cursor: "pointer",
};

const highlightRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const highlightIcon: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(96,165,250,0.14)",
  fontSize: 18,
  flexShrink: 0,
};

const highlightTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
};

const highlightMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const quickPostGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const quickPostBtn: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
};

const statCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  marginTop: 8,
  color: "#ffffff",
};

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 8,
};

const toolbarLeft: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  flex: 1,
};

const toolbarRight: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const chipBar: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};

const activeChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(96,165,250,0.12)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 800,
};

const activeChipBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const panel: CSSProperties = {
  marginTop: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(8px)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.2)",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const panelHeaderTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const panelTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
};

const panelSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 13,
};

const resultPill: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 800,
};

const sectionDivider: CSSProperties = {
  padding: "12px 16px",
  fontWeight: 900,
  color: "#cbd5e1",
  fontSize: 13,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  letterSpacing: 0.4,
};

const emptyState: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#cbd5e1",
};

const emptyStateIcon: CSSProperties = {
  fontSize: 34,
};

const emptyStateTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#ffffff",
  marginTop: 12,
};

const emptyStateText: CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.82,
};

const emptyStateActions: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const emptyMini: CSSProperties = {
  padding: "10px 0",
  color: "#cbd5e1",
};

const announcementCard: CSSProperties = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  transition: "all 0.2s ease",
  borderColor: "rgba(255,255,255,0.08)",
};

const pinnedCard: CSSProperties = {
  borderTop: "1px solid rgba(250,204,21,0.36)",
  background: "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(15,23,42,0.35))",
  boxShadow: "inset 0 0 0 1px rgba(250,204,21,0.12)",
};

const announcementTop: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const announcementTitleRow: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const announcementTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 950,
  color: "#ffffff",
};

const announcementBody: CSSProperties = {
  marginTop: 8,
  color: "#e5e7eb",
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
};

const metaRow: CSSProperties = {
  marginTop: 10,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const metaText: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
};

const metaDot: CSSProperties = {
  color: "#475569",
  fontSize: 12,
};

const attachmentsLabel: CSSProperties = {
  fontSize: 12,
  opacity: 0.9,
  fontWeight: 800,
  color: "#cbd5e1",
  marginBottom: 8,
};

const attachmentWrap: CSSProperties = {
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

const attachmentIcon: CSSProperties = {
  fontSize: 14,
};

const attachmentLink: CSSProperties = {
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 800,
};

const actionsCol: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const composeCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(96,165,250,0.08)",
  marginBottom: 14,
};

const composeTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#dbeafe",
  marginBottom: 6,
};

const composeSub: CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const composeFooter: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginTop: 14,
};

const composeHint: CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const searchInput: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const selectInput: CSSProperties = {
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const fieldInput: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const btnPrimary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnDanger: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 800,
  cursor: "pointer",
};

const iconBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const alertError: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
};

const alertSuccess: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.22)",
  background: "rgba(20,83,45,0.24)",
  color: "#bbf7d0",
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