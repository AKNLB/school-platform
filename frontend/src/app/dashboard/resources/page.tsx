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

type SortValue = "newest" | "oldest" | "name-asc" | "name-desc" | "category" | "versions";

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

const FAVORITES_KEY = "resources:favorites:v1";
const PINNED_KEY = "resources:pinned:v1";

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
  const [sortBy, setSortBy] = useState<SortValue>("newest");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<UploadForm>(DEFAULT_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const versionInputRef = useRef<HTMLInputElement | null>(null);
  const [versionTarget, setVersionTarget] = useState<ResourceRow | null>(null);

  const [favoriteRoots, setFavoriteRoots] = useState<number[]>([]);
  const [pinnedRoots, setPinnedRoots] = useState<number[]>([]);

  useEffect(() => {
    try {
      const rawFav = window.localStorage.getItem(FAVORITES_KEY);
      const rawPinned = window.localStorage.getItem(PINNED_KEY);

      if (rawFav) setFavoriteRoots(safeParseNumberArray(rawFav));
      if (rawPinned) setPinnedRoots(safeParseNumberArray(rawPinned));
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteRoots));
    } catch {
      // ignore localStorage errors
    }
  }, [favoriteRoots]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedRoots));
    } catch {
      // ignore localStorage errors
    }
  }, [pinnedRoots]);

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

  const groupedBase = useMemo(() => {
    const map = new Map<number, ResourceRow[]>();

    for (const item of items) {
      const root = item.root_id || item.id;
      if (!map.has(root)) map.set(root, []);
      map.get(root)!.push(item);
    }

    return Array.from(map.entries()).map(([root, group]) => {
      const versions = [...group].sort((a, b) => (b.version || 1) - (a.version || 1));
      const latest = versions[0];
      return {
        root,
        latest,
        versions,
        versionCount: versions.length,
        latestDate: latest?.upload_date || "",
        isPinned: pinnedRoots.includes(root),
        isFavorite: favoriteRoots.includes(root),
      };
    });
  }, [items, pinnedRoots, favoriteRoots]);

  const grouped = useMemo(() => {
    const arr = [...groupedBase];

    arr.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      switch (sortBy) {
        case "oldest":
          return a.latestDate.localeCompare(b.latestDate);
        case "name-asc":
          return String(a.latest?.filename || "").localeCompare(String(b.latest?.filename || ""));
        case "name-desc":
          return String(b.latest?.filename || "").localeCompare(String(a.latest?.filename || ""));
        case "category":
          return String(a.latest?.category || "Uncategorized").localeCompare(
            String(b.latest?.category || "Uncategorized")
          );
        case "versions":
          return b.versionCount - a.versionCount;
        case "newest":
        default:
          return b.latestDate.localeCompare(a.latestDate);
      }
    });

    return arr;
  }, [groupedBase, sortBy]);

  const pinnedResources = useMemo(() => grouped.filter((g) => g.isPinned), [grouped]);
  const favoriteResources = useMemo(() => grouped.filter((g) => g.isFavorite), [grouped]);

  const stats = useMemo(() => {
    const total = items.length;
    const categories = new Set(items.map((x) => (x.category || "").trim()).filter(Boolean)).size;
    const visibleAll = items.filter((x) => (x.visibility || "all") === "all").length;
    const versions = items.filter((x) => Number(x.version || 1) > 1).length;
    const worksheets = items.filter((x) => x.filetype === "worksheet").length;
    const templates = items.filter((x) => x.filetype === "template").length;
    const groupedCount = grouped.length;
    const pinnedCount = pinnedResources.length;
    const favoriteCount = favoriteResources.length;

    return {
      total,
      categories,
      visibleAll,
      versions,
      worksheets,
      templates,
      groupedCount,
      pinnedCount,
      favoriteCount,
    };
  }, [items, grouped.length, pinnedResources.length, favoriteResources.length]);

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

  const duplicateCandidates = useMemo(() => {
    if (!uploadFile) return [];
    const targetName = uploadFile.name.trim().toLowerCase();
    if (!targetName) return [];

    const seen = new Set<number>();
    const matches: ResourceRow[] = [];

    for (const group of groupedBase) {
      const latest = group.latest;
      if (!latest) continue;
      const name = String(latest.filename || "").trim().toLowerCase();
      if (name === targetName && !seen.has(group.root)) {
        seen.add(group.root);
        matches.push(latest);
      }
    }

    return matches.slice(0, 3);
  }, [uploadFile, groupedBase]);

  const hasActiveFilters = Boolean(q.trim() || typeFilter || categoryFilter || visibilityFilter);
  const activeFilterCount = [q.trim(), typeFilter, categoryFilter, visibilityFilter].filter(Boolean).length;

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

  function clearFilters() {
    setQ("");
    setTypeFilter("");
    setCategoryFilter("");
    setVisibilityFilter("");
    setSortBy("newest");
    setSuccess(null);
    setErr(null);
  }

  function toggleFavorite(root: number) {
    setFavoriteRoots((prev) => (prev.includes(root) ? prev.filter((x) => x !== root) : [...prev, root]));
  }

  function togglePinned(root: number) {
    setPinnedRoots((prev) => (prev.includes(root) ? prev.filter((x) => x !== root) : [...prev, root]));
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
              Centralize lesson notes, worksheets, policies, guides, templates, and school materials
              so teachers and administrators can work faster and stay aligned.
            </p>

            <div style={heroBadgeRow}>
              <HeroMiniBadge label="Teacher ready" value={`${stats.worksheets} worksheets`} />
              <HeroMiniBadge label="Admin ready" value={`${stats.templates} templates`} />
              <HeroMiniBadge label="Shared library" value={`${stats.visibleAll} public files`} />
              <HeroMiniBadge label="Pinned" value={`${stats.pinnedCount} important`} />
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
                onClick={() =>
                  openUpload({ type: "worksheet", category: "Examination", visibility: "student" })
                }
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
          <StatCard label="Latest Files" value={String(stats.groupedCount)} accent="blue" />
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
                  <button
                    key={cat.name}
                    style={categoryRowButton}
                    onClick={() => {
                      setCategoryFilter(cat.name);
                      void loadResources();
                    }}
                  >
                    <div style={categoryRow}>
                      <div>
                        <div style={categoryName}>{cat.name}</div>
                        <div style={categoryMeta}>Available in the shared library</div>
                      </div>
                      <div style={categoryCount}>{cat.count}</div>
                    </div>
                  </button>
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

        {pinnedResources.length > 0 && (
          <section style={featuredSection}>
            <div style={sectionTitleRow}>
              <div>
                <div style={shortcutTitle}>Pinned Resources</div>
                <div style={shortcutSub}>Important school files kept at the top for everyone.</div>
              </div>
            </div>

            <div style={featuredGrid}>
              {pinnedResources.slice(0, 4).map((group) => (
                <FeaturedResourceCard
                  key={group.root}
                  resource={group.latest}
                  root={group.root}
                  versionCount={group.versionCount}
                  isFavorite={group.isFavorite}
                  onToggleFavorite={() => toggleFavorite(group.root)}
                  onOpenDownload={() => undefined}
                  downloadUrl={downloadUrl(group.latest.id)}
                />
              ))}
            </div>
          </section>
        )}

        {favoriteResources.length > 0 && (
          <section style={shortcutSection}>
            <div style={sectionTitleRow}>
              <div>
                <div style={shortcutTitle}>My Favorites</div>
                <div style={shortcutSub}>Quick access to the resources used most often.</div>
              </div>
            </div>

            <div style={favoriteGrid}>
              {favoriteResources.slice(0, 6).map((group) => (
                <div key={group.root} style={favoriteCard}>
                  <div style={favoriteTop}>
                    <div style={favoriteIcon}>{iconForType(group.latest.filetype)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={favoriteName}>{group.latest.filename}</div>
                      <div style={favoriteMeta}>
                        {group.latest.category || "Uncategorized"} • v{group.latest.version || 1}
                      </div>
                    </div>
                  </div>

                  <div style={favoriteActions}>
                    <a href={downloadUrl(group.latest.id)} style={miniLinkBtn}>
                      Open
                    </a>
                    <button
                      onClick={() => toggleFavorite(group.root)}
                      style={miniGhostBtn}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={shortcutSection}>
          <div style={shortcutTitle}>Quick Category Upload</div>
          <div style={shortcutSub}>
            Jump straight into the type of resource teachers and admins add most often.
          </div>

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
            <div style={panelHeaderTop}>
              <div>
                <div style={panelTitle}>Resource Library</div>
                <div style={panelSub}>
                  Search, filter, sort, download, version, pin, and manage school resources from one place.
                </div>
              </div>

              <div style={resultsPill}>
                {stats.groupedCount} {stats.groupedCount === 1 ? "resource" : "resources"} found
                {hasActiveFilters ? ` • ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active` : ""}
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

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortValue)} style={fieldInput}>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name-asc">Sort: Name A–Z</option>
              <option value="name-desc">Sort: Name Z–A</option>
              <option value="category">Sort: Category</option>
              <option value="versions">Sort: Most Versions</option>
            </select>

            <div style={toolbarActions}>
              <button onClick={() => void loadResources()} style={btnSecondary} disabled={loading || busy}>
                Apply
              </button>
              <button onClick={clearFilters} style={btnSecondary} disabled={busy}>
                Clear
              </button>
            </div>
          </div>

          {hasActiveFilters && (
            <div style={chipWrap}>
              {q.trim() ? (
                <FilterChip label={`Search: ${q.trim()}`} onRemove={() => setQ("")} />
              ) : null}
              {typeFilter ? <FilterChip label={`Type: ${titleize(typeFilter)}`} onRemove={() => setTypeFilter("")} /> : null}
              {categoryFilter ? (
                <FilterChip label={`Category: ${categoryFilter}`} onRemove={() => setCategoryFilter("")} />
              ) : null}
              {visibilityFilter ? (
                <FilterChip
                  label={`Visibility: ${titleize(visibilityFilter)}`}
                  onRemove={() => setVisibilityFilter("")}
                />
              ) : null}
            </div>
          )}

          {loading ? (
            <div style={emptyState}>Loading resources...</div>
          ) : grouped.length === 0 ? (
            <div style={libraryEmptyWrap}>
              <div style={libraryEmptyIcon}>📚</div>
              <div style={libraryEmptyTitle}>No resources found</div>
              <div style={libraryEmptyText}>
                Try adjusting your filters, clearing the search, or uploading a new resource for teachers and admin.
              </div>

              <div style={libraryEmptyActions}>
                <button onClick={clearFilters} style={btnSecondary}>
                  Clear Filters
                </button>
                <button onClick={() => openUpload()} style={btnPrimary}>
                  Upload Resource
                </button>
                <button
                  onClick={() =>
                    openUpload({ type: "worksheet", category: "Examination", visibility: "student" })
                  }
                  style={btnSecondary}
                >
                  Add Worksheet
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              {grouped.map((group) => {
                const latest = group.latest;
                const hasMoreVersions = group.versions.length > 1;

                return (
                  <article key={group.root} style={resourceCard}>
                    <div style={resourceTop}>
                      <div style={{ flex: 1 }}>
                        <div style={titleRow}>
                          <div style={fileIcon}>{iconForType(latest.filetype)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={resourceTitleRow}>
                              <div style={resourceTitle}>{latest.filename}</div>
                              {group.isPinned && <span style={pinnedPill}>Pinned</span>}
                              {group.isFavorite && <span style={favoritePill}>Favorite</span>}
                            </div>

                            <div style={resourceMeta}>
                              Uploaded {formatDateTime(latest.upload_date)}
                              {latest.uploader ? ` • by ${latest.uploader}` : ""}
                              {group.versionCount > 1 ? ` • ${group.versionCount} versions` : ""}
                            </div>
                          </div>
                        </div>

                        <div style={badgeRow}>
                          <Badge text={`TYPE: ${String(latest.filetype || "file").toUpperCase()}`} />
                          <Badge text={`CATEGORY: ${String(latest.category || "uncategorized").toUpperCase()}`} subtle />
                          <VisibilityBadge visibility={latest.visibility || "all"} />
                          <Badge text={`VERSION ${latest.version || 1}`} />
                        </div>
                      </div>

                      <div style={actionWrap}>
                        <button onClick={() => togglePinned(group.root)} style={btnSecondary} disabled={busy}>
                          {group.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button onClick={() => toggleFavorite(group.root)} style={btnSecondary} disabled={busy}>
                          {group.isFavorite ? "Unfavorite" : "Favorite"}
                        </button>
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
                          {group.versions.map((v) => (
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

            {duplicateCandidates.length > 0 && (
              <div style={duplicateCard}>
                <div style={duplicateTitle}>Possible duplicate detected</div>
                <div style={duplicateText}>
                  A file with the same name already exists. You can still upload as a new file, or open one of these
                  and upload a new version instead.
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {duplicateCandidates.map((item) => (
                    <div key={item.id} style={duplicateRow}>
                      <div>
                        <div style={duplicateName}>{item.filename}</div>
                        <div style={duplicateMeta}>
                          {item.category || "Uncategorized"} • v{item.version || 1} • {formatDateTime(item.upload_date)}
                        </div>
                      </div>
                      <button
                        style={btnSecondary}
                        onClick={() => {
                          setUploadOpen(false);
                          startNewVersion(item);
                        }}
                        disabled={busy}
                      >
                        Upload New Version
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

function VisibilityBadge({ visibility }: { visibility: string }) {
  const v = String(visibility || "all").toLowerCase();

  const colorMap: Record<string, { bg: string; border: string; color: string }> = {
    all: {
      bg: "rgba(34,197,94,0.16)",
      border: "1px solid rgba(34,197,94,0.28)",
      color: "#bbf7d0",
    },
    teacher: {
      bg: "rgba(96,165,250,0.16)",
      border: "1px solid rgba(96,165,250,0.28)",
      color: "#dbeafe",
    },
    student: {
      bg: "rgba(245,158,11,0.16)",
      border: "1px solid rgba(245,158,11,0.28)",
      color: "#fde68a",
    },
    parent: {
      bg: "rgba(168,85,247,0.16)",
      border: "1px solid rgba(168,85,247,0.28)",
      color: "#e9d5ff",
    },
  };

  const styles = colorMap[v] || colorMap.all;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.6,
        padding: "6px 9px",
        borderRadius: 999,
        border: styles.border,
        background: styles.bg,
        color: styles.color,
      }}
    >
      VISIBILITY: {v.toUpperCase()}
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={filterChip}>
      <span>{label}</span>
      <button style={filterChipBtn} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function FeaturedResourceCard({
  resource,
  root,
  versionCount,
  isFavorite,
  onToggleFavorite,
  onOpenDownload,
  downloadUrl,
}: {
  resource: ResourceRow;
  root: number;
  versionCount: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenDownload: () => void;
  downloadUrl: string;
}) {
  void root;
  void onOpenDownload;

  return (
    <div style={featuredCard}>
      <div style={featuredIcon}>{iconForType(resource.filetype)}</div>
      <div style={featuredName}>{resource.filename}</div>
      <div style={featuredMeta}>
        {resource.category || "Uncategorized"} • {titleize(resource.visibility || "all")} • {versionCount}{" "}
        {versionCount === 1 ? "version" : "versions"}
      </div>

      <div style={featuredBadgeRow}>
        <span style={featuredPill}>Pinned</span>
        {isFavorite ? <span style={featuredPillMuted}>Favorite</span> : null}
      </div>

      <div style={featuredActions}>
        <a href={downloadUrl} style={miniLightBtn}>
          Open
        </a>
        <button onClick={onToggleFavorite} style={miniGhostBtn}>
          {isFavorite ? "Unfavorite" : "Favorite"}
        </button>
      </div>
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

function safeParseNumberArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  } catch {
    return [];
  }
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

const categoryRowButton: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
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

const featuredSection: CSSProperties = {
  marginBottom: 18,
};

const sectionTitleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const featuredGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const featuredCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.92) 100%)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
};

const featuredIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(250,204,21,0.14)",
  border: "1px solid rgba(250,204,21,0.24)",
  fontSize: 22,
  marginBottom: 12,
};

const featuredName: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
};

const featuredMeta: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const featuredBadgeRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const featuredPill: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.16)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,0.25)",
};

const featuredPillMuted: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  border: "1px solid rgba(255,255,255,0.12)",
};

const featuredActions: CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 14,
  flexWrap: "wrap",
};

const favoriteGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const favoriteCard: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const favoriteTop: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const favoriteIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(236,72,153,0.12)",
  border: "1px solid rgba(236,72,153,0.22)",
  fontSize: 18,
  flexShrink: 0,
};

const favoriteName: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#fff",
};

const favoriteMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const favoriteActions: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  flexWrap: "wrap",
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

const panelHeaderTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
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

const resultsPill: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 800,
};

const toolbar: CSSProperties = {
  padding: 16,
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.4fr) repeat(5, minmax(140px, 0.8fr))",
  gap: 12,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const toolbarActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const chipWrap: CSSProperties = {
  padding: "12px 16px 0 16px",
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterChip: CSSProperties = {
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

const filterChipBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
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

const libraryEmptyWrap: CSSProperties = {
  padding: "42px 22px",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
};

const libraryEmptyIcon: CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 20,
  display: "grid",
  placeItems: "center",
  background: "rgba(96,165,250,0.12)",
  border: "1px solid rgba(96,165,250,0.18)",
  fontSize: 32,
};

const libraryEmptyTitle: CSSProperties = {
  marginTop: 16,
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const libraryEmptyText: CSSProperties = {
  marginTop: 8,
  maxWidth: 620,
  color: "#94a3b8",
  lineHeight: 1.6,
};

const libraryEmptyActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: 18,
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

const resourceTitleRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
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

const pinnedPill: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.16)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,0.24)",
};

const favoritePill: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(236,72,153,0.16)",
  color: "#fbcfe8",
  border: "1px solid rgba(236,72,153,0.24)",
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

const duplicateCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(245,158,11,0.22)",
  background: "rgba(245,158,11,0.09)",
  marginBottom: 14,
};

const duplicateTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#fde68a",
};

const duplicateText: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#e2e8f0",
  lineHeight: 1.5,
};

const duplicateRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const duplicateName: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
};

const duplicateMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#cbd5e1",
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

const miniLightBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  textDecoration: "none",
};

const miniGhostBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
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