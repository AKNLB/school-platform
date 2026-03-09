"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

type ResourceRow = {
  id: number;
  filename: string;
  stored_name: string;
  filetype: string;
  version: number;
  uploader: string | null;
  upload_date: string;
  category: string | null;
  visibility: string | null;
  root_id: number | null;
};

type UploadForm = {
  type: string;
  uploader: string;
  category: string;
  visibility: string;
};

const DEFAULT_FORM: UploadForm = {
  type: "file",
  uploader: "",
  category: "",
  visibility: "all",
};

const RESOURCE_TYPES = [
  "file",
  "worksheet",
  "lesson-note",
  "presentation",
  "guide",
  "policy",
  "template",
];

const VISIBILITY_OPTIONS = ["all", "teacher", "parent", "student"];

export default function ResourcesPage() {
  const [items, setItems] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<UploadForm>(DEFAULT_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const versionInputRef = useRef<HTMLInputElement | null>(null);
  const [versionTarget, setVersionTarget] = useState<ResourceRow | null>(null);

  async function loadResources() {
    setLoading(true);
    setErr(null);

    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      if (typeFilter) params.type = typeFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (visibilityFilter) params.visibility = visibilityFilter;

      const res = await api.get("/resources", { params });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load resources."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResources();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<number, ResourceRow[]>();

    for (const item of items) {
      const root = item.root_id || item.id;
      if (!map.has(root)) map.set(root, []);
      map.get(root)!.push(item);
    }

    const groups = Array.from(map.values()).map((group) =>
      [...group].sort((a, b) => (b.version || 1) - (a.version || 1))
    );

    groups.sort((a, b) => {
      const da = a[0]?.upload_date || "";
      const db = b[0]?.upload_date || "";
      return db.localeCompare(da);
    });

    return groups;
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const categories = new Set(items.map((x) => (x.category || "").trim()).filter(Boolean)).size;
    const visibleAll = items.filter((x) => (x.visibility || "all") === "all").length;
    const versions = items.filter((x) => Number(x.version || 1) > 1).length;

    return { total, categories, visibleAll, versions };
  }, [items]);

  function openUpload() {
    setUploadOpen(true);
    setForm(DEFAULT_FORM);
    setUploadFile(null);
    setFormError(null);
  }

  function closeUpload() {
    if (busy) return;
    setUploadOpen(false);
  }

  async function submitUpload() {
    setFormError(null);
    setErr(null);
    setSuccess(null);

    if (!uploadFile) {
      setFormError("Please choose a file.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("type", form.type || "file");
      fd.append("uploader", form.uploader || "");
      fd.append("category", form.category || "");
      fd.append("visibility", form.visibility || "all");

      await api.post("/resources", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Resource uploaded successfully.");
      setUploadOpen(false);
      await loadResources();
    } catch (e: unknown) {
      setFormError(extractErr(e, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(resource: ResourceRow) {
    const ok = window.confirm(`Delete "${resource.filename}"?`);
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await api.delete(`/resources/${resource.id}`);
      setSuccess("Resource deleted.");
      await loadResources();
    } catch (e: unknown) {
      setErr(extractErr(e, "Delete failed."));
    } finally {
      setBusy(false);
    }
  }

  function startNewVersion(resource: ResourceRow) {
    setVersionTarget(resource);
    if (versionInputRef.current) {
      versionInputRef.current.value = "";
      versionInputRef.current.click();
    }
  }

  async function uploadNewVersion(file: File, resource: ResourceRow) {
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (resource.uploader) fd.append("uploader", resource.uploader);

      await api.post(`/resources/${resource.id}/version`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(`New version uploaded for "${resource.filename}".`);
      await loadResources();
    } catch (e: unknown) {
      setErr(extractErr(e, "Version upload failed."));
    } finally {
      setBusy(false);
      setVersionTarget(null);
    }
  }

  function downloadUrl(id: number) {
    return `/api/resources/${id}/download`;
  }

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Knowledge Center</div>
            <h1 style={heroTitle}>Resources</h1>
            <p style={heroText}>
              Upload, organize, version, and distribute school files such as lesson
              notes, worksheets, presentations, templates, and policies.
            </p>
          </div>

          <div style={heroActions}>
            <button onClick={() => void loadResources()} style={btnSecondary} disabled={loading || busy}>
              Refresh
            </button>
            <button onClick={openUpload} style={btnPrimary} disabled={busy}>
              + Upload Resource
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Total Files" value={String(stats.total)} accent="blue" />
          <StatCard label="Categories" value={String(stats.categories)} accent="purple" />
          <StatCard label="Visible To All" value={String(stats.visibleAll)} accent="green" />
          <StatCard label="Versioned Files" value={String(stats.versions)} accent="amber" />
        </section>

        {err && (
          <div style={errorAlert}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {err}
          </div>
        )}

        {success && (
          <div style={successAlert}>
            <strong style={{ marginRight: 8 }}>Success:</strong>
            {success}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Resource Library</div>
              <div style={panelSub}>Search, filter, and manage uploaded files.</div>
            </div>
          </div>

          <div style={toolbar}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search filename, category, or type..."
              style={searchInput}
            />

            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={fieldInput}>
              <option value="">All types</option>
              {RESOURCE_TYPES.map((x) => (
                <option key={x} value={x}>
                  {titleize(x)}
                </option>
              ))}
            </select>

            <input
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="Category filter"
              style={fieldInput}
            />

            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              style={fieldInput}
            >
              <option value="">All visibility</option>
              {VISIBILITY_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {titleize(x)}
                </option>
              ))}
            </select>

            <button onClick={() => void loadResources()} style={btnSecondary} disabled={loading || busy}>
              Apply
            </button>
          </div>

          {loading ? (
            <div style={emptyState}>Loading resources...</div>
          ) : grouped.length === 0 ? (
            <div style={emptyState}>No resources found.</div>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              {grouped.map((versions) => {
                const latest = versions[0];
                const hasMoreVersions = versions.length > 1;

                return (
                  <article key={latest.root_id || latest.id} style={resourceCard}>
                    <div style={resourceTop}>
                      <div style={{ flex: 1 }}>
                        <div style={titleRow}>
                          <div style={fileIcon}>{iconForType(latest.filetype)}</div>
                          <div>
                            <div style={resourceTitle}>{latest.filename}</div>
                            <div style={resourceMeta}>
                              Uploaded {formatDateTime(latest.upload_date)}
                              {latest.uploader ? ` • by ${latest.uploader}` : ""}
                            </div>
                          </div>
                        </div>

                        <div style={badgeRow}>
                          <Badge text={`TYPE: ${String(latest.filetype || "file").toUpperCase()}`} />
                          <Badge text={`CATEGORY: ${String(latest.category || "uncategorized").toUpperCase()}`} subtle />
                          <Badge text={`VISIBILITY: ${String(latest.visibility || "all").toUpperCase()}`} subtle />
                          <Badge text={`V${latest.version || 1}`} />
                        </div>
                      </div>

                      <div style={actionWrap}>
                        <a href={downloadUrl(latest.id)} style={linkBtn}>
                          Download
                        </a>
                        <button onClick={() => startNewVersion(latest)} style={btnSecondary} disabled={busy}>
                          New Version
                        </button>
                        <button onClick={() => void handleDelete(latest)} style={btnDanger} disabled={busy}>
                          Delete
                        </button>
                      </div>
                    </div>

                    {hasMoreVersions && (
                      <div style={versionSection}>
                        <div style={versionTitle}>Version History</div>
                        <div style={versionList}>
                          {versions.map((v) => (
                            <div key={v.id} style={versionRow}>
                              <div>
                                <div style={versionName}>
                                  v{v.version || 1} • {v.filename}
                                </div>
                                <div style={versionMeta}>
                                  {formatDateTime(v.upload_date)}
                                  {v.uploader ? ` • ${v.uploader}` : ""}
                                </div>
                              </div>

                              <a href={downloadUrl(v.id)} style={miniLinkBtn}>
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <input
          ref={versionInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!file || !versionTarget) return;
            void uploadNewVersion(file, versionTarget);
          }}
        />

        {uploadOpen && (
          <Modal title="Upload Resource" onClose={closeUpload}>
            {formError && <div style={{ ...errorAlert, marginBottom: 12 }}>{formError}</div>}

            <div style={formGrid}>
              <Field label="Choose File" full>
                <input
                  type="file"
                  style={fieldInput}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </Field>

              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  style={fieldInput}
                >
                  {RESOURCE_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {titleize(x)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Visibility">
                <select
                  value={form.visibility}
                  onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}
                  style={fieldInput}
                >
                  {VISIBILITY_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {titleize(x)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Uploader">
                <input
                  value={form.uploader}
                  onChange={(e) => setForm((prev) => ({ ...prev, uploader: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. Admin, Teacher A"
                />
              </Field>

              <Field label="Category">
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. Mathematics, Policy, Templates"
                />
              </Field>
            </div>

            <div style={modalActions}>
              <button style={btnSecondary} onClick={closeUpload} disabled={busy}>
                Cancel
              </button>
              <button style={btnPrimary} onClick={() => void submitUpload()} disabled={busy}>
                {busy ? "Uploading..." : "Upload"}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
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
    <div onMouseDown={onClose} style={modalOverlay}>
      <div onMouseDown={(e) => e.stopPropagation()} style={modalCard}>
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "green" | "purple" | "amber";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.30)",
    green: "rgba(34,197,94,0.30)",
    purple: "rgba(168,85,247,0.30)",
    amber: "rgba(245,158,11,0.30)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function Badge({ text, subtle }: { text: string; subtle?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.6,
        padding: "6px 9px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: subtle ? "rgba(255,255,255,0.05)" : "rgba(96,165,250,0.16)",
        color: "#e2e8f0",
      }}
    >
      {text}
    </span>
  );
}

function titleize(v: string) {
  return String(v || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join(" ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function iconForType(type: string) {
  const t = String(type || "").toLowerCase();
  if (t.includes("worksheet")) return "📝";
  if (t.includes("presentation")) return "📽️";
  if (t.includes("guide")) return "📘";
  if (t.includes("policy")) return "📜";
  if (t.includes("template")) return "📋";
  if (t.includes("lesson")) return "📚";
  return "📁";
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg = (data as { message?: string; error?: string }).message || (data as { error?: string }).error;
    if (msg) return msg;
  }
  return err?.message || fallback;
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
};

const page: CSSProperties = {
  maxWidth: 1380,
  margin: "0 auto",
};

const hero: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
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
  fontSize: 32,
  fontWeight: 950,
  margin: 0,
};

const heroText: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const panel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const panelTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const panelSub: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#94a3b8",
};

const toolbar: CSSProperties = {
  padding: 16,
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.4fr) repeat(4, minmax(140px, 0.8fr))",
  gap: 12,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const fieldInput: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const emptyState: CSSProperties = {
  padding: 22,
  color: "#cbd5e1",
};

const resourceCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 16,
};

const resourceTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const titleRow: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const fileIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(96,165,250,0.14)",
  border: "1px solid rgba(96,165,250,0.24)",
  fontSize: 22,
  flexShrink: 0,
};

const resourceTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const resourceMeta: CSSProperties = {
  marginTop: 5,
  fontSize: 13,
  color: "#94a3b8",
};

const badgeRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 14,
};

const actionWrap: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const versionSection: CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const versionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#cbd5e1",
  marginBottom: 10,
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const versionList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const versionRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const versionName: CSSProperties = {
  fontWeight: 800,
  color: "#fff",
  fontSize: 14,
};

const versionMeta: CSSProperties = {
  marginTop: 4,
  color: "#94a3b8",
  fontSize: 12,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  fontWeight: 800,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.72)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};

const modalCard: CSSProperties = {
  width: "min(900px, 100%)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0f172a",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const modalHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const modalTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#fff",
};

const statCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(8px)",
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const statValue: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 950,
  color: "#fff",
};

const btnPrimary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
};

const btnSecondary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

const btnDanger: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
  fontWeight: 800,
  cursor: "pointer",
};

const linkBtn: CSSProperties = {
  ...btnPrimary,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const miniLinkBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
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

const errorAlert: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
};

const successAlert: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.22)",
  background: "rgba(20,83,45,0.24)",
  color: "#bbf7d0",
};