"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, type AuthedUser } from "@/lib/auth";
import api from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

type UserRole = "admin" | "teacher" | "parent" | "student";

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
};

type CreateUserResponse = {
  ok: boolean;
  user: UserRow;
  temp_password?: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [me, setMe] = useState<AuthedUser>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("teacher");
  const [newPassword, setNewPassword] = useState("");

  const isAdmin = useMemo(() => me?.role === "admin", [me]);

  async function loadUsers(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    setError(null);

    try {
      const res = await api.get("/admin/users");
      setUsers(Array.isArray(res.data) ? (res.data as UserRow[]) : []);
    } catch (e: unknown) {
      const message = extractErr(e, "Failed to load users");
      setError(message);
      showToast(message, "error");
    } finally {
      if (showRefreshState) setRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const who = await fetchMe();
        if (!alive) return;

        if (!who) {
          router.replace("/login");
          return;
        }

        if (who.role !== "admin") {
          router.replace("/dashboard");
          return;
        }

        setMe(who);
        await loadUsers();
      } catch (e: unknown) {
        if (!alive) return;
        const message = extractErr(e, "Failed to load admin workspace");
        setError(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const inactive = users.length - active;
    const admins = users.filter((u) => u.role === "admin").length;
    const teachers = users.filter((u) => u.role === "teacher").length;
    const parents = users.filter((u) => u.role === "parent").length;
    const students = users.filter((u) => u.role === "student").length;

    return {
      total: users.length,
      active,
      inactive,
      admins,
      teachers,
      parents,
      students,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search.trim() ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase()) ||
        String(u.id).includes(search);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function createUser() {
    setError(null);

    const username = newUsername.trim().toLowerCase();
    const email = newEmail.trim().toLowerCase();

    if (!username) {
      const message = "Username is required.";
      setError(message);
      showToast(message, "error");
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        username,
        email: email || null,
        role: newRole,
      };

      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await api.post("/admin/users", payload);
      const data = res.data as CreateUserResponse;

      const temp = data.temp_password ? ` Temp password: ${data.temp_password}` : "";
      showToast(`Created ${data.user.username}.${temp}`, "success");

      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("teacher");

      await loadUsers();
    } catch (e: unknown) {
      const message = extractErr(e, "Failed to create user");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(id: number, patch: Partial<UserRow>) {
    setError(null);
    setBusy(true);

    try {
      await api.patch(`/admin/users/${id}`, patch);
      showToast("User updated successfully.", "success");
      await loadUsers();
    } catch (e: unknown) {
      const message = extractErr(e, "Failed to update user");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: number) {
    setError(null);
    setBusy(true);

    try {
      const res = await api.post(`/admin/users/${id}/reset-password`);
      const data = res.data as { ok: boolean; temp_password: string; user: UserRow };
      showToast(`Temp password for ${data.user.username}: ${data.temp_password}`, "success");
    } catch (e: unknown) {
      const message = extractErr(e, "Failed to reset password");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <LoadingState text="Loading admin workspace..." />
        </div>
      </main>
    );
  }

  if (!me || !isAdmin) return null;

  if (error && users.length === 0) {
    return (
      <main style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <ErrorState text={error} onRetry={() => void loadUsers()} />
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Administration</div>
            <h1 style={styles.heroTitle}>Admin Users</h1>
            <p style={styles.heroText}>
              Create school users, manage access levels, activate or deactivate accounts,
              and reset passwords from one secure control center.
            </p>

            <div style={styles.heroBadges}>
              <HeroBadge label="Role" value="Admin" />
              <HeroBadge label="Users" value={String(userStats.total)} />
              <HeroBadge label="Active" value={String(userStats.active)} />
            </div>
          </div>

          <div style={styles.heroActions}>
            <button
              onClick={() => void loadUsers(true)}
              disabled={busy || refreshing}
              style={styles.secondaryBtn}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={styles.secondaryBtn}
            >
              Back to Dashboard
            </button>
          </div>
        </section>

        <section style={styles.statsGrid}>
          <StatCard label="Total Users" value={String(userStats.total)} />
          <StatCard label="Active Users" value={String(userStats.active)} />
          <StatCard label="Teachers" value={String(userStats.teachers)} />
          <StatCard label="Parents" value={String(userStats.parents)} />
          <StatCard label="Students" value={String(userStats.students)} />
          <StatCard label="Admins" value={String(userStats.admins)} />
        </section>

        {error ? (
          <div style={styles.inlineErrorWrap}>
            <ErrorState text={error} onRetry={() => void loadUsers()} />
          </div>
        ) : null}

        <div style={styles.layout}>
          <section style={styles.leftColumn}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Create User</div>
                  <div style={styles.panelSub}>
                    Add teachers, parents, students, or another admin account.
                  </div>
                </div>
              </div>

              <div style={styles.panelBody}>
                <div style={styles.formGrid}>
                  <Field label="Username">
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="teacher2"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Email (optional)">
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="teacher2@school.com"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Role">
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      style={styles.input}
                    >
                      <option value="teacher">teacher</option>
                      <option value="parent">parent</option>
                      <option value="student">student</option>
                      <option value="admin">admin</option>
                    </select>
                  </Field>

                  <Field label="Password (optional)" full>
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate a temporary password"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div style={styles.formHint}>
                  If no password is provided, the backend generates a temporary password for the new user.
                </div>

                <div style={styles.formActions}>
                  <button
                    onClick={createUser}
                    disabled={busy || !newUsername.trim()}
                    style={styles.primaryBtn}
                  >
                    {busy ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Filters</div>
                  <div style={styles.panelSub}>Quickly narrow the user list.</div>
                </div>
              </div>

              <div style={styles.panelBody}>
                <div style={styles.formGrid}>
                  <Field label="Search">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search username, email, id, or role..."
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Role">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
                      style={styles.input}
                    >
                      <option value="all">all</option>
                      <option value="admin">admin</option>
                      <option value="teacher">teacher</option>
                      <option value="parent">parent</option>
                      <option value="student">student</option>
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                      style={styles.input}
                    >
                      <option value="all">all</option>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Users</div>
                  <div style={styles.panelSub}>
                    {filteredUsers.length} of {users.length} users visible
                  </div>
                </div>
              </div>

              <div style={styles.usersWrap}>
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    title="No users found"
                    text="No users match your current filters."
                  
                  />
                ) : (
                  filteredUsers.map((u) => (
                    <div key={u.id} style={styles.userCard}>
                      <div style={styles.userTop}>
                        <div>
                          <div style={styles.userName}>{u.username}</div>
                          <div style={styles.userMeta}>
                            ID #{u.id} {u.email ? `• ${u.email}` : "• no email"}
                          </div>
                        </div>

                        <div style={styles.userBadges}>
                          <span style={roleBadge(u.role)}>{u.role}</span>
                          <span style={statusBadge(u.is_active)}>
                            {u.is_active ? "active" : "inactive"}
                          </span>
                        </div>
                      </div>

                      <div style={styles.userGrid}>
                        <Field label="Email">
                          <input
                            defaultValue={u.email ?? ""}
                            placeholder="(none)"
                            style={styles.input}
                            onBlur={(e) =>
                              updateUser(u.id, {
                                email: e.target.value.trim().toLowerCase() || null,
                              } as Partial<UserRow>)
                            }
                            disabled={busy}
                          />
                        </Field>

                        <Field label="Role">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              updateUser(u.id, { role: e.target.value as UserRole } as Partial<UserRow>)
                            }
                            style={styles.input}
                            disabled={busy}
                          >
                            <option value="teacher">teacher</option>
                            <option value="parent">parent</option>
                            <option value="student">student</option>
                            <option value="admin">admin</option>
                          </select>
                        </Field>

                        <Field label="Active">
                          <label style={styles.switchRow}>
                            <input
                              type="checkbox"
                              checked={u.is_active}
                              onChange={(e) =>
                                updateUser(u.id, { is_active: e.target.checked } as Partial<UserRow>)
                              }
                              disabled={busy}
                            />
                            <span>{u.is_active ? "Enabled" : "Disabled"}</span>
                          </label>
                        </Field>
                      </div>

                      <div style={styles.userActions}>
                        <button
                          disabled={busy}
                          onClick={() => resetPassword(u.id)}
                          style={styles.secondaryBtn}
                        >
                          Reset Password
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
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
        gap: 8,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function HeroBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.heroBadge}>
      <div style={styles.heroBadgeLabel}>{label}</div>
      <div style={styles.heroBadgeValue}>{value}</div>
    </div>
  );
}

function roleBadge(role: UserRole): React.CSSProperties {
  const map: Record<UserRole, React.CSSProperties> = {
    admin: {
      background: "rgba(59,130,246,0.16)",
      color: "#dbeafe",
      border: "1px solid rgba(59,130,246,0.28)",
    },
    teacher: {
      background: "rgba(34,197,94,0.16)",
      color: "#bbf7d0",
      border: "1px solid rgba(34,197,94,0.28)",
    },
    parent: {
      background: "rgba(245,158,11,0.16)",
      color: "#fde68a",
      border: "1px solid rgba(245,158,11,0.28)",
    },
    student: {
      background: "rgba(168,85,247,0.16)",
      color: "#e9d5ff",
      border: "1px solid rgba(168,85,247,0.28)",
    },
  };

  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    ...map[role],
  };
}

function statusBadge(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    background: active ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)",
    color: active ? "#bbf7d0" : "#fecaca",
    border: active
      ? "1px solid rgba(34,197,94,0.28)"
      : "1px solid rgba(239,68,68,0.28)",
  };
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg =
      (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error;
    if (msg) return msg;
  }
  return err?.message || fallback;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 45%, #111827 100%)",
    padding: 24,
    position: "relative",
    overflow: "hidden",
  },

  container: {
    maxWidth: 1450,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  bgGlowOne: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
    pointerEvents: "none",
  },

  bgGlowTwo: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
    pointerEvents: "none",
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 24,
    borderRadius: 24,
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#93c5fd",
    marginBottom: 8,
  },

  heroTitle: {
    margin: 0,
    fontSize: 36,
    fontWeight: 950,
    color: "#fff",
  },

  heroText: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 800,
  },

  heroBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },

  heroBadge: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
  },

  heroBadgeLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  heroBadgeValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#fff",
    fontWeight: 900,
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  statsGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  statCard: {
    borderRadius: 18,
    padding: 16,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  statValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 950,
    color: "#fff",
  },

  inlineErrorWrap: {
    marginTop: 18,
  },

  layout: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 18,
    alignItems: "start",
  },

  leftColumn: {
    display: "grid",
    gap: 18,
  },

  rightColumn: {
    display: "grid",
    gap: 18,
  },

  panel: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.76)",
    overflow: "hidden",
  },

  panelHeader: {
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
  },

  panelSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
  },

  panelBody: {
    padding: 18,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  fieldLabel: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: 800,
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.44)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },

  formHint: {
    marginTop: 14,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.5,
  },

  formActions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },

  usersWrap: {
    padding: 18,
    display: "grid",
    gap: 14,
  },

  userCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  userTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  userName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
  },

  userMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#94a3b8",
  },

  userBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  userGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr 180px 140px",
    gap: 14,
  },

  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#e2e8f0",
    minHeight: 44,
  },

  userActions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};