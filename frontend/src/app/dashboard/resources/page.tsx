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

const QUICK_CATEGORIES = [
  "Mathematics",
  "English",
  "Science",
  "Social Studies",
  "Examination",
  "Templates",
  "Policies",
  "Admin",
];

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
    const worksheets = items.filter((x) => x.filetype === "worksheet").length;
    const templates = items.filter((x) => x.filetype === "template").length;

    return { total, categories, visibleAll, versions, worksheets, templates };
  }, [items]);

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = (item.category || "Uncategorized").trim() || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [items]);

  const recentResources = useMemo(() => {
    return [...items]
      .sort((a, b) => (b.upload_date || "").localeCompare(a.upload_date || ""))
      .slice(0, 5);
  }, [items]);

  function openUpload(prefill?: Partial<UploadForm>) {
    setUploadOpen(true);
    setForm({
      ...DEFAULT_FORM,
      ...prefill,
    });
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
      <div style={backgroundGlowOne} />
      <div style={backgroundGlowTwo} />

      <div style={page}>
        <section style={hero}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={eyebrow}>Teacher & Admin Resource Hub</div>
            <h1 style={heroTitle}>Resources</h1>
            <p style={heroText}>
              Centralize lesson notes, worksheets, policies, guides, templates, and school
              materials so teachers and administrators can work faster and stay aligned.
            </p>

            <div style={heroBadgeRow}>
              <HeroMiniBadge label="Teacher ready" value={`${stats.worksheets} worksheets`} />
              <HeroMiniBadge label="Admin ready" value={`${stats.templates} templates`} />
              <HeroMiniBadge label="Shared library" value={`${stats.visibleAll} public files`} />
            </div>
          </div>

          <div style={heroRightCard}>
            <div style={heroRightTitle}>Quick Actions</div>
            <div style={heroQuickGrid}>
              <button onClick={() => void loadResources()} style={quickActionBtn} disabled={loading || busy}>
                <span style={quickIcon}>↻</span>
                Refresh Library
              </button>
              <button onClick={() => openUpload()} style={quickActionBtnPrimary} disabled={busy}>
                <span style={quickIcon}>＋</span>
                Upload Resource
              </button>
              <button
                onClick={() => openUpload({ type: "worksheet", category: "Examination", visibility: "student" })}
                style={quickActionBtn}
                disabled={busy}
              >
                <span style={quickIcon}>📝</span>
                New Worksheet
              </button>
              <button
                onClick={() => openUpload({ type: "template", category: "Templates", visibility: "teacher" })}
                style={quickActionBtn}
                disabled={busy}
              >
                <span style={quickIcon}>📋</span>
                New Template
              </button>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Total Files" value={String(stats.total)} accent="blue" />
          <StatCard label="Categories" value={String(stats.categories)} accent="purple" />
          <StatCard label="Visible To All" value={String(stats.visibleAll)} accent="green" />
          <StatCard label="Versioned Files" value={String(stats.versions)} accent="amber" />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightHeader}>
              <div>
                <div style={insightTitle}>Top Categories</div>
                <div style={insightSub}>Most-used teaching and admin buckets</div>
              </div>
            </div>

            {topCategories.length === 0 ? (
              <div style={emptyMini}>No categories yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {topCategories.map((cat) => (
                  <div key={cat.name} style={categoryRow}>
                    <div>
                      <div style={categoryName}>{cat.name}</div>
                      <div style={categoryMeta}>Available in the shared library</div>
                    </div>
                    <div style={categoryCount}>{cat.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={insightCard}>
            <div style={insightHeader}>
              <div>
                <div style={insightTitle}>Recent Uploads</div>
                <div style={insightSub}>Latest files added by staff</div>
              </div>
            </div>

            {recentResources.length === 0 ? (
              <div style={emptyMini}>No recent uploads yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentResources.map((item) => (
                  <div key={item.id} style={recentRow}>
                    <div style={recentIcon}>{iconForType(item.filetype)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={recentName}>{item.filename}</div>
                      <div style={recentMeta}>
                        {item.category || "Uncategorized"} • {formatDateTime(item.upload_date)}
                      </div>
                    </div>
                    <a href={downloadUrl(item.id)} style={miniLinkBtn}>
                      Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={shortcutSection}>
          <div style={shortcutTitle}>Quick Category Upload</div>
          <div style={shortcutSub}>Jump straight into the type of resource teachers and admins add most often.</div>

          <div style={shortcutGrid}>
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                style={shortcutBtn}
                onClick={() =>
                  openUpload({
                    category: cat,
                    type: cat === "Templates" ? "template" : cat === "Policies" ? "policy" : "file",
                  })
                }
              >
                {cat}
              </button>
            ))}
          </div>
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
              <div style={panelSub}>
                Search, filter, download, version, and manage school resources from one place.
              </div>
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
                          <div style={{ minWidth: 0 }}>
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
                          <Badge text={`VERSION ${latest.version || 1}`} />
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

            <div style={uploadTipCard}>
              <div style={uploadTipTitle}>Helpful Tip</div>
              <div style={uploadTipText}>
                Use categories like <b>Mathematics</b>, <b>Science</b>, <b>Templates</b>, or <b>Policies</b> so
                teachers and admins can find files faster.
              </div>
            </div>

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
                  placeholder="e.g. Mathematics, Policies, Templates"
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

function HeroMiniBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMiniBadge}>
      <div style={heroMiniLabel}>{label}</div>
      <div style={heroMiniValue}>{value}</div>
    </div>
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
  background: "linear-gradient(180deg, #0b1220 0%, #111827 42%, #0f172a 100%)",
  color: "#f8fafc",
  padding: 24,
  position: "relative",
  overflow: "hidden",
};

const backgroundGlowOne: CSSProperties = {
  position: "absolute",
  top: -120,
  right: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
  pointerEvents: "none",
};

const backgroundGlowTwo: CSSProperties = {
  position: "absolute",
  bottom: -160,
  left: -120,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
  pointerEvents: "none",
};

const page: CSSProperties = {
  maxWidth: 1380,
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
};

const hero: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "stretch",
  gap: 18,
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
  fontSize: 34,
  fontWeight: 950,
  margin: 0,
};

const heroText: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const heroBadgeRow: CSSProperties = {
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

const heroRightCard: CSSProperties = {
  minWidth: 320,
  flex: "0 0 360px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.74)",
  backdropFilter: "blur(10px)",
  padding: 18,
};

const heroRightTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  marginBottom: 12,
};

const heroQuickGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const quickActionBtn: CSSProperties = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
};

const quickActionBtnPrimary: CSSProperties = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

const quickIcon: CSSProperties = {
  display: "inline-block",
  marginRight: 8,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(10px)",
  padding: 16,
};

const insightHeader: CSSProperties = {
  marginBottom: 14,
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

const categoryRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const categoryName: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
};

const categoryMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const categoryCount: CSSProperties = {
  minWidth: 36,
  height: 36,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  background: "rgba(96,165,250,0.16)",
  color: "#dbeafe",
};

const recentRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const recentIcon: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(96,165,250,0.14)",
  fontSize: 18,
  flexShrink: 0,
};

const recentName: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const recentMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const shortcutSection: CSSProperties = {
  marginBottom: 18,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(10px)",
  padding: 16,
};

const shortcutTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const shortcutSub: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#94a3b8",
};

const shortcutGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 14,
};

const shortcutBtn: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
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

const emptyMini: CSSProperties = {
  padding: "10px 0",
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

const uploadTipCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(96,165,250,0.08)",
  marginBottom: 14,
};

const uploadTipTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#dbeafe",
  marginBottom: 6,
};

const uploadTipText: CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
  lineHeight: 1.5,
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