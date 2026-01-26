"use client";

import React, { useEffect, useMemo, useState } from "react";
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

  const [audience, setAudience] = useState<Audience | "">("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [q, setQ] = useState("");

  const [items, setItems] = useState<Announcement[]>([]);

  // modal
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

      // ✅ IMPORTANT:
      // api.ts already prefixes /api if you pass "/announcements"
      // If you pass "/api/announcements" you end up with "/api/api/announcements" in some setups.
      const res = await api.get("/announcements", { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setErr(extractErr(e, "Failed to load announcements"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, pinnedOnly]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((a) => {
      const t = (a.title || "").toLowerCase();
      const d = (a.description || "").toLowerCase();
      return t.includes(needle) || d.includes(needle);
    });
  }, [q, items]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
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

  function validate(p: Upsert): string | null {
    if (!p.title.trim()) return "Title is required.";
    if (!p.description.trim()) return "Description is required.";
    return null;
  }

  async function submit() {
    setFormError(null);
    const v = validate(form);
    if (v) return setFormError(v);

    setBusy(true);
    try {
      if (mode === "create") {
        const res = await api.post("/announcements", { ...form });
        const created: Announcement | null =
          res?.data && typeof res.data === "object" ? (res.data as Announcement) : null;

        if (created?.id) setItems((prev) => [created, ...prev]);
        else await load();
      } else {
        if (!editing?.id) throw new Error("No announcement selected.");
        const res = await api.put(`/announcements/${editing.id}`, { ...form });
        const updated: Announcement | null =
          res?.data && typeof res.data === "object" ? (res.data as Announcement) : null;

        if (updated?.id) setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        else await load();
      }

      setOpen(false);
    } catch (e: any) {
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

    const prev = items;
    setItems((p) => p.filter((x) => x.id !== a.id));

    try {
      await api.delete(`/announcements/${a.id}`);
    } catch (e: any) {
      setItems(prev);
      setErr(extractErr(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(a: Announcement, file: File) {
    setBusy(true);
    setErr(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      // ✅ removed multipart header block; browser sets boundaries automatically
      const res = await api.post(`/announcements/${a.id}/attachments`, fd);

      const updated: Announcement | null =
        res?.data && typeof res.data === "object" ? (res.data as Announcement) : null;

      if (updated?.id) setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      else await load();
    } catch (e: any) {
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

    try {
      const res = await api.delete(`/announcements/${a.id}/attachments/${encodeURIComponent(filename)}`);
      const updated: Announcement | null =
        res?.data && typeof res.data === "object" ? (res.data as Announcement) : null;

      if (updated?.id) setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      else await load();
    } catch (e: any) {
      setErr(extractErr(e, "Remove attachment failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Announcements</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>{loading ? "Loading…" : `${filtered.length} announcement(s)`}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={input} />
          <button onClick={load} style={btnSecondary} disabled={loading || busy}>
            Refresh
          </button>
          <button onClick={openCreate} style={btnPrimary} disabled={busy}>
            + New
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <Chip active={audience === ""} onClick={() => setAudience("")} label="All audiences" />
        <Chip active={audience === "all"} onClick={() => setAudience("all")} label="Audience: All" />
        <Chip active={audience === "teachers"} onClick={() => setAudience("teachers")} label="Teachers" />
        <Chip active={audience === "parents"} onClick={() => setAudience("parents")} label="Parents" />
        <Chip active={audience === "students"} onClick={() => setAudience("students")} label="Students" />
        <div style={{ width: 10 }} />
        <Chip active={pinnedOnly} onClick={() => setPinnedOnly((p) => !p)} label={pinnedOnly ? "Pinned only ✓" : "Pinned only"} />
      </div>

      {err && (
        <div style={alert}>
          <b style={{ marginRight: 8 }}>Error:</b> {err}
          <button onClick={load} style={{ ...btnSecondary, marginLeft: 12 }} disabled={busy}>
            Retry
          </button>
        </div>
      )}

      <div style={card}>
        {loading ? (
          <div style={{ padding: 14, opacity: 0.8 }}>Loading announcements…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.8 }}>No announcements yet.</div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{a.title}</div>
                    {a.pinned && <Badge text="PINNED" />}
                    <Badge text={`AUDIENCE: ${String(a.audience || "all").toUpperCase()}`} subtle />
                  </div>

                  <div style={{ opacity: 0.8, marginTop: 8, whiteSpace: "pre-wrap" }}>{a.description}</div>

                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 10 }}>{a.created_at ? `Posted: ${formatDate(a.created_at)}` : ""}</div>

                  {a.attachments?.length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, marginBottom: 6 }}>Attachments</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {a.attachments.map((att) => (
                          <div key={att.filename} style={attachmentPill}>
                            <a href={att.url} target="_blank" rel="noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: 800 }}>
                              {att.filename}
                            </a>
                            <button
                              onClick={() => deleteAttachment(a, att.filename)}
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

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <label style={btnSecondary as any}>
                    Upload
                    <input
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!f) return;
                        uploadAttachment(a, f);
                      }}
                      disabled={busy}
                    />
                  </label>

                  <button style={btnSecondary} onClick={() => openEdit(a)} disabled={busy}>
                    Edit
                  </button>
                  <button style={btnDanger} onClick={() => remove(a)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <Modal title={mode === "create" ? "New Announcement" : "Edit Announcement"} onClose={closeModal}>
          {formError && <div style={{ ...alert, marginTop: 0 }}>{formError}</div>}

          <div style={grid}>
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
                style={{ ...fieldInput, minHeight: 140, resize: "vertical" }}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Write the announcement…"
              />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button style={btnSecondary} onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button style={btnPrimary} onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** UI bits */
function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active ? "#fff" : "rgba(255,255,255,0.06)",
        color: active ? "#0b0b0f" : "#fff",
        fontWeight: 900,
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
        fontSize: 11,
        fontWeight: 950,
        letterSpacing: 0.6,
        padding: "6px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: subtle ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
        opacity: subtle ? 0.85 : 1,
      }}
    >
      {text}
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(900px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#0b0b0f",
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
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={iconBtn}>
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>{label}</div>
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

function extractErr(e: any, fallback: string) {
  const msg = e?.response?.data?.message || e?.response?.data?.error || e?.response?.data || e?.message;
  if (!msg) return fallback;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

/** Styles */
const card: React.CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  overflow: "hidden",
};

const input: React.CSSProperties = {
  width: 240,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  outline: "none",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
};

const fieldInput: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  outline: "none",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#fff",
  color: "#0b0b0f",
  fontWeight: 900,
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
};

const btnDanger: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 800,
};

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
};

const alert: React.CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const attachmentPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
};

const miniDanger: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 900,
  cursor: "pointer",
};

// ✅ Force TS to treat this file as a module even in weird edge-cases
export {};
