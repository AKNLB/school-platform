"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Audience = "all" | "teachers" | "parents" | "students";
type SortValue = "date-asc" | "date-desc" | "title" | "audience";
type ViewMode = "upcoming" | "past" | "all";

type SchoolEvent = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  audience: Audience;
  created_at: string | null;
};

type EventForm = {
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  audience: Audience;
};

const emptyForm: EventForm = {
  title: "",
  description: "",
  date: todayLocalISO(),
  start_time: "",
  end_time: "",
  location: "",
  audience: "all",
};

export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<SchoolEvent[]>([]);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("date-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (audience) params.audience = audience;

      const res = await api.get("/events", { params });
      const rows = Array.isArray(res.data) ? res.data : [];
      setItems(rows);
    } catch (e: unknown) {
      setError(extractErr(e, "Failed to load events"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [audience, dateFilter]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const today = todayLocalISO();

    let list = items.filter((event) => {
      const title = (event.title || "").toLowerCase();
      const description = (event.description || "").toLowerCase();
      const location = (event.location || "").toLowerCase();
      const audienceText = (event.audience || "").toLowerCase();

      const matchesSearch =
        !needle ||
        title.includes(needle) ||
        description.includes(needle) ||
        location.includes(needle) ||
        audienceText.includes(needle) ||
        event.date.includes(needle);

      const matchesView =
        viewMode === "all" ||
        (viewMode === "upcoming" && event.date >= today) ||
        (viewMode === "past" && event.date < today);

      return matchesSearch && matchesView;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "date-desc") {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.start_time || "99:99").localeCompare(a.start_time || "99:99");
      }

      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortBy === "audience") {
        return a.audience.localeCompare(b.audience) || a.date.localeCompare(b.date);
      }

      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.start_time || "99:99").localeCompare(b.start_time || "99:99");
    });

    return list;
  }, [items, search, sortBy, viewMode]);

  const stats = useMemo(() => {
    const total = items.length;
    const today = todayLocalISO();
    const upcoming = items.filter((x) => x.date >= today).length;
    const todayCount = items.filter((x) => x.date === today).length;
    const teachers = items.filter((x) => x.audience === "teachers").length;
    const parents = items.filter((x) => x.audience === "parents").length;
    const students = items.filter((x) => x.audience === "students").length;
    const allAudience = items.filter((x) => x.audience === "all").length;

    return { total, upcoming, todayCount, teachers, parents, students, allAudience };
  }, [items]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>();

    for (const event of filtered) {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date)!.push(event);
    }

    return Array.from(map.entries()).map(([date, events]) => ({
      date,
      events,
    }));
  }, [filtered]);

  const upcomingHighlights = useMemo(() => {
    const today = todayLocalISO();
    return sortEvents(items.filter((x) => x.date >= today)).slice(0, 4);
  }, [items]);

  const locations = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => {
      const loc = (item.location || "").trim();
      if (loc) values.add(loc);
    });
    return Array.from(values).slice(0, 6);
  }, [items]);

  const hasActiveFilters = Boolean(
    search.trim() || audience || dateFilter || sortBy !== "date-asc" || viewMode !== "upcoming"
  );

  function openCreate(prefill?: Partial<EventForm>) {
    setMode("create");
    setEditing(null);
    setForm({
      ...emptyForm,
      date: dateFilter || todayLocalISO(),
      ...prefill,
    });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(event: SchoolEvent) {
    setMode("edit");
    setEditing(event);
    setForm({
      title: event.title ?? "",
      description: event.description ?? "",
      date: event.date ?? todayLocalISO(),
      start_time: event.start_time ?? "",
      end_time: event.end_time ?? "",
      location: event.location ?? "",
      audience: event.audience ?? "all",
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function resetFilters() {
    setAudience("");
    setDateFilter("");
    setSearch("");
    setSortBy("date-asc");
    setViewMode("upcoming");
  }

  function validate(payload: EventForm): string | null {
    if (!payload.title.trim()) return "Title is required.";
    if (payload.title.trim().length < 4) return "Title must be at least 4 characters.";
    if (!payload.date.trim()) return "Date is required.";
    if (payload.start_time && !isTime(payload.start_time)) return "Start time must be HH:MM.";
    if (payload.end_time && !isTime(payload.end_time)) return "End time must be HH:MM.";
    if (payload.start_time && payload.end_time && payload.start_time > payload.end_time) {
      return "End time must be after start time.";
    }
    return null;
  }

  async function submit() {
    setFormError(null);
    setError(null);
    setSuccess(null);

    const validation = validate(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    setBusy(true);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location.trim() || null,
        audience: form.audience,
      };

      if (mode === "create") {
        const res = await api.post("/events", payload);
        const created = isEvent(res.data) ? res.data : null;

        if (created?.id) {
          setItems((prev) => sortEvents([created, ...prev]));
        } else {
          await load();
        }

        setSuccess("Event created successfully.");
      } else {
        if (!editing?.id) throw new Error("No event selected.");
        const res = await api.put(`/events/${editing.id}`, payload);
        const updated = isEvent(res.data) ? res.data : null;

        if (updated?.id) {
          setItems((prev) => sortEvents(prev.map((x) => (x.id === updated.id ? updated : x))));
        } else {
          await load();
        }

        setSuccess("Event updated successfully.");
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to save event"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(event: SchoolEvent) {
    const ok = window.confirm(`Delete "${event.title}"?`);
    if (!ok) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    const previous = items;
    setItems((prev) => prev.filter((x) => x.id !== event.id));

    try {
      await api.delete(`/events/${event.id}`);
      setSuccess("Event deleted.");
    } catch (e: unknown) {
      setItems(previous);
      setError(extractErr(e, "Failed to delete event"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={heroCard}>
          <div style={heroGlowA} />
          <div style={heroGlowB} />

          <div style={heroContent}>
            <div>
              <div style={eyebrow}>School Platform</div>
              <h1 style={heroTitle}>Events</h1>
              <p style={subtitle}>
                Manage school events, calendars, reminders, and audience-specific schedules
                from one organized workspace.
              </p>

              <div style={heroMiniStats}>
                <HeroMiniBadge label="Upcoming" value={String(stats.upcoming)} />
                <HeroMiniBadge label="Today" value={String(stats.todayCount)} />
                <HeroMiniBadge label="Total" value={String(stats.total)} />
              </div>
            </div>

            <div style={heroActions}>
              <button onClick={() => void load()} style={btnSecondary} disabled={loading || busy}>
                Refresh
              </button>
              <button onClick={() => openCreate({ audience: "all" })} style={btnSecondary} disabled={busy}>
                School-wide
              </button>
              <button onClick={() => openCreate()} style={btnPrimary} disabled={busy}>
                + New Event
              </button>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Total Events" value={stats.total} accent="blue" />
          <StatCard label="Upcoming" value={stats.upcoming} accent="green" />
          <StatCard label="Today" value={stats.todayCount} accent="red" />
          <StatCard label="Teachers" value={stats.teachers} accent="amber" />
          <StatCard label="Parents" value={stats.parents} accent="violet" />
          <StatCard label="Students" value={stats.students} accent="slate" />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Upcoming Highlights</div>
            <div style={insightSub}>Next key items on the school calendar</div>

            {upcomingHighlights.length === 0 ? (
              <div style={emptyMini}>No upcoming events yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {upcomingHighlights.map((event) => (
                  <button
                    key={event.id}
                    style={highlightRowBtn}
                    onClick={() => openEdit(event)}
                  >
                    <div style={highlightRow}>
                      <div style={highlightIcon}>📅</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={highlightTitle}>{event.title}</div>
                        <div style={highlightMeta}>
                          {formatDate(event.date)} • {formatTimeRange(event.start_time, event.end_time)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Quick Event Lanes</div>
            <div style={insightSub}>Create common school events faster</div>

            <div style={quickCreateGrid}>
              <button style={quickCreateBtn} onClick={() => openCreate({ audience: "teachers", title: "Staff Meeting" })}>
                👩‍🏫 Staff Meeting
              </button>
              <button style={quickCreateBtn} onClick={() => openCreate({ audience: "parents", title: "Parent Meeting" })}>
                👨‍👩‍👧 Parent Meeting
              </button>
              <button style={quickCreateBtn} onClick={() => openCreate({ audience: "students", title: "Student Assembly" })}>
                🎓 Student Assembly
              </button>
              <button style={quickCreateBtn} onClick={() => openCreate({ audience: "all", title: "School Event" })}>
                🏫 School-wide Event
              </button>
            </div>
          </div>
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <div style={fieldBlock}>
              <label style={fieldLabel}>Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, location, audience..."
                style={fieldInput}
              />
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={fieldInput}
              />
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortValue)}
                style={fieldInput}
              >
                <option value="date-asc">Date ascending</option>
                <option value="date-desc">Date descending</option>
                <option value="title">Title</option>
                <option value="audience">Audience</option>
              </select>
            </div>
          </div>

          <div style={toolbarRight}>
            <Chip active={viewMode === "upcoming"} onClick={() => setViewMode("upcoming")} label="Upcoming" />
            <Chip active={viewMode === "past"} onClick={() => setViewMode("past")} label="Past" />
            <Chip active={viewMode === "all"} onClick={() => setViewMode("all")} label="All Dates" />
            <Chip active={audience === ""} onClick={() => setAudience("")} label="All Audiences" />
            <Chip active={audience === "all"} onClick={() => setAudience("all")} label="All" />
            <Chip active={audience === "teachers"} onClick={() => setAudience("teachers")} label="Teachers" />
            <Chip active={audience === "parents"} onClick={() => setAudience("parents")} label="Parents" />
            <Chip active={audience === "students"} onClick={() => setAudience("students")} label="Students" />
            <button onClick={resetFilters} style={btnSecondary}>
              Reset
            </button>
          </div>
        </section>

        {hasActiveFilters && (
          <div style={chipBar}>
            {search.trim() ? <ActiveChip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} /> : null}
            {dateFilter ? <ActiveChip label={`Date: ${dateFilter}`} onRemove={() => setDateFilter("")} /> : null}
            {audience ? <ActiveChip label={`Audience: ${capitalize(audience)}`} onRemove={() => setAudience("")} /> : null}
            {viewMode !== "upcoming" ? (
              <ActiveChip label={`View: ${capitalize(viewMode)}`} onRemove={() => setViewMode("upcoming")} />
            ) : null}
            {sortBy !== "date-asc" ? (
              <ActiveChip label={`Sort: ${sortLabel(sortBy)}`} onRemove={() => setSortBy("date-asc")} />
            ) : null}
          </div>
        )}

        {locations.length > 0 && (
          <section style={locationsCard}>
            <div style={locationsTitle}>Popular Locations</div>
            <div style={locationsWrap}>
              {locations.map((location) => (
                <button
                  key={location}
                  style={locationPill}
                  onClick={() => setSearch(location)}
                >
                  📍 {location}
                </button>
              ))}
            </div>
          </section>
        )}

        {error && (
          <div style={alertBox}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {error}
          </div>
        )}

        {success && (
          <div style={successBox}>
            <strong style={{ marginRight: 8 }}>Success:</strong>
            {success}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div style={panelHeaderTop}>
              <div>
                <div style={panelTitle}>Event Schedule</div>
                <div style={panelSubtitle}>
                  {loading ? "Loading events..." : `${filtered.length} event(s) shown`}
                </div>
              </div>

              <div style={resultPill}>
                {filtered.length} visible
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Loading events...</div>
              <div style={emptyStateText}>Please wait while the schedule is prepared.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyStateIcon}>🗓️</div>
              <div style={emptyStateTitle}>No events found</div>
              <div style={emptyStateText}>
                Create your first event or adjust the filters.
              </div>
              <div style={emptyActions}>
                <button onClick={resetFilters} style={btnSecondary}>
                  Clear Filters
                </button>
                <button onClick={() => openCreate()} style={btnPrimary}>
                  + New Event
                </button>
              </div>
            </div>
          ) : (
            <div style={eventList}>
              {groupedByDate.map((group) => (
                <div key={group.date}>
                  <div style={dateDivider}>{formatDate(group.date)}</div>
                  {group.events.map((event) => (
                    <article key={event.id} style={eventCard}>
                      <div style={eventTop}>
                        <div style={{ flex: 1 }}>
                          <div style={eventTitleRow}>
                            <h3 style={eventTitle}>{event.title}</h3>
                            <Badge text={`AUDIENCE: ${String(event.audience || "all").toUpperCase()}`} />
                            {isUpcoming(event.date) && <Badge text="UPCOMING" subtle />}
                            {event.date === todayLocalISO() && <Badge text="TODAY" subtle />}
                          </div>

                          <div style={eventMetaRow}>
                            <div style={metaPill}>📅 {formatDate(event.date)}</div>
                            <div style={metaPill}>🕒 {formatTimeRange(event.start_time, event.end_time)}</div>
                            <div style={metaPill}>📍 {event.location || "No location set"}</div>
                          </div>

                          <div style={eventBody}>
                            {event.description?.trim() ? event.description : "No description provided."}
                          </div>

                          <div style={metaText}>
                            {event.created_at
                              ? `Created: ${formatDateTime(event.created_at)}`
                              : "Created timestamp unavailable"}
                          </div>
                        </div>

                        <div style={actionsCol}>
                          <button style={btnSecondary} onClick={() => openEdit(event)} disabled={busy}>
                            Edit
                          </button>
                          <button style={btnDanger} onClick={() => void remove(event)} disabled={busy}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {open && (
          <Modal title={mode === "create" ? "New Event" : "Edit Event"} onClose={closeModal}>
            {formError && <div style={{ ...alertBox, marginBottom: 12 }}>{formError}</div>}

            <div style={composeCard}>
              <div style={composeTitle}>Event Planning</div>
              <div style={composeSub}>
                Add clear event details so teachers, parents, and students know exactly when and where to show up.
              </div>
            </div>

            <div style={formGrid}>
              <Field label="Title" full>
                <input
                  style={fieldInput}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Parent Meeting"
                />
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  style={fieldInput}
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
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

              <Field label="Start Time">
                <input
                  type="time"
                  style={fieldInput}
                  value={form.start_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  style={fieldInput}
                  value={form.end_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </Field>

              <Field label="Location" full>
                <input
                  style={fieldInput}
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Main Hall"
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  style={{ ...fieldInput, minHeight: 140, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add event details..."
                />
              </Field>
            </div>

            <div style={composeFooter}>
              <div style={composeHint}>
                Audience: <b>{capitalize(form.audience)}</b> • Schedule:{" "}
                <b>{formatTimeRange(form.start_time || null, form.end_time || null)}</b>
              </div>

              <div style={modalActions}>
                <button style={btnSecondary} onClick={closeModal} disabled={busy}>
                  Cancel
                </button>
                <button style={btnPrimary} onClick={() => void submit()} disabled={busy}>
                  {busy ? "Saving..." : mode === "create" ? "Create Event" : "Save Changes"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "blue" | "green" | "amber" | "violet" | "slate" | "red";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(59,130,246,0.22)",
    green: "rgba(34,197,94,0.22)",
    amber: "rgba(245,158,11,0.22)",
    violet: "rgba(139,92,246,0.22)",
    slate: "rgba(148,163,184,0.18)",
    red: "rgba(239,68,68,0.20)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
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
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active ? "#ffffff" : "rgba(255,255,255,0.06)",
        color: active ? "#0b1220" : "#f8fafc",
        fontWeight: 900,
        cursor: "pointer",
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
          width: "min(900px, 100%)",
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800, color: "#cbd5e1" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function isEvent(value: unknown): value is SchoolEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "number" && typeof v.title === "string";
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

  return msg || fallback;
}

function todayLocalISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function formatDate(dateValue: string) {
  try {
    const d = new Date(`${dateValue}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "No time set";
  if (start && end) return `${formatTime(start)} - ${formatTime(end)}`;
  if (start) return `${formatTime(start)} onward`;
  return `Until ${formatTime(end || "")}`;
}

function formatTime(value: string) {
  try {
    const [hour, minute] = value.split(":");
    const d = new Date();
    d.setHours(Number(hour), Number(minute), 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return value;
  }
}

function isUpcoming(dateValue: string) {
  return dateValue >= todayLocalISO();
}

function sortEvents(list: SchoolEvent[]) {
  return [...list].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    const aStart = a.start_time || "99:99";
    const bStart = b.start_time || "99:99";
    return aStart.localeCompare(bStart);
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortLabel(value: SortValue) {
  if (value === "date-desc") return "Date descending";
  if (value === "title") return "Title";
  if (value === "audience") return "Audience";
  return "Date ascending";
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at top left, rgba(139,92,246,0.10), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
};

const page: CSSProperties = {
  maxWidth: 1400,
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
  width: 250,
  height: 250,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.18)",
  filter: "blur(42px)",
  top: -70,
  right: -30,
};

const heroGlowB: CSSProperties = {
  position: "absolute",
  width: 230,
  height: 230,
  borderRadius: "50%",
  background: "rgba(139,92,246,0.14)",
  filter: "blur(44px)",
  bottom: -70,
  left: -40,
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
  maxWidth: 760,
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

const quickCreateGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const quickCreateBtn: CSSProperties = {
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
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 8,
};

const toolbarLeft: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarRight: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const fieldBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#cbd5e1",
};

const fieldInput: CSSProperties = {
  minWidth: 180,
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

const locationsCard: CSSProperties = {
  marginBottom: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  padding: 16,
};

const locationsTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#fff",
};

const locationsWrap: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
};

const locationPill: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontWeight: 800,
  cursor: "pointer",
};

const alertBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#fee2e2",
};

const successBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.28)",
  background: "rgba(34,197,94,0.12)",
  color: "#dcfce7",
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
};

const emptyStateText: CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.82,
};

const emptyActions: CSSProperties = {
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

const dateDivider: CSSProperties = {
  padding: "12px 16px",
  fontWeight: 900,
  color: "#cbd5e1",
  fontSize: 13,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  letterSpacing: 0.4,
};

const eventList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const eventCard: CSSProperties = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const eventTop: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const eventTitleRow: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const eventTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 950,
  color: "#ffffff",
};

const eventMetaRow: CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const metaPill: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 800,
};

const eventBody: CSSProperties = {
  marginTop: 12,
  color: "#e5e7eb",
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
};

const metaText: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#94a3b8",
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