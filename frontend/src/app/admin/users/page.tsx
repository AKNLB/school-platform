"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, type AuthedUser } from "@/lib/auth";

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  role: "admin" | "teacher" | "parent" | "student";
  is_active: boolean;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [me, setMe] = useState<AuthedUser>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRow["role"]>("teacher");
  const [newPassword, setNewPassword] = useState("");

  const isAdmin = useMemo(() => me?.role === "admin", [me]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  }

  async function loadUsers() {
    setError(null);
    const rows = await api<UserRow[]>("/api/admin/users");
    setUsers(rows);
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
        setLoading(false);

        await loadUsers();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function createUser() {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const payload: any = {
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase() || null,
        role: newRole,
      };
      if (newPassword.trim()) payload.password = newPassword.trim();

      const res = await api<{ ok: boolean; user: any; temp_password?: string }>(
        "/api/admin/users",
        { method: "POST", body: JSON.stringify(payload) }
      );

      const temp = res.temp_password ? ` Temp password: ${res.temp_password}` : "";
      setNotice(`Created ${res.user.username}.${temp}`);

      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("teacher");

      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(id: number, patch: any) {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      await api("/api/admin/users/" + id, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setNotice("Saved.");
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Failed to update user");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: number) {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; temp_password: string; user: any }>(
        `/api/admin/users/${id}/reset-password`,
        { method: "POST" }
      );
      setNotice(`Temp password for ${res.user.username}: ${res.temp_password}`);
    } catch (e: any) {
      setError(e?.message || "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!me) return null;
  if (!isAdmin) return null;

  return (
    <main style={{ padding: "2rem", maxWidth: 1000 }}>
      <h1>Admin • Users</h1>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #c00" }}>
          <b>Error:</b> {error}
        </div>
      )}
      {notice && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #0a0" }}>
          {notice}
        </div>
      )}

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #ddd" }}>
        <h2 style={{ marginTop: 0 }}>Create user</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px", gap: 12 }}>
          <div>
            <label>Username</label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="teacher2"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </div>

          <div>
            <label>Email (optional)</label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="teacher2@school.com"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </div>

          <div>
            <label>Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              <option value="teacher">teacher</option>
              <option value="parent">parent</option>
              <option value="student">student</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Password (optional)</label>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to auto-generate a temp password"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </div>

        <button
          onClick={createUser}
          disabled={busy || !newUsername.trim()}
          style={{ padding: "10px 14px", marginTop: 12 }}
        >
          {busy ? "Working..." : "Create user"}
        </button>
      </section>

      <section style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Users</h2>
          <button onClick={loadUsers} disabled={busy} style={{ padding: "8px 12px" }}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 12, border: "1px solid #ddd" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 180px 1fr 140px 120px 260px",
              gap: 8,
              padding: 10,
              fontWeight: 700,
              borderBottom: "1px solid #ddd",
            }}
          >
            <div>ID</div>
            <div>Username</div>
            <div>Email</div>
            <div>Role</div>
            <div>Active</div>
            <div>Actions</div>
          </div>

          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 180px 1fr 140px 120px 260px",
                gap: 8,
                padding: 10,
                borderTop: "1px solid #eee",
                alignItems: "center",
              }}
            >
              <div>{u.id}</div>
              <div>{u.username}</div>

              <input
                defaultValue={u.email ?? ""}
                placeholder="(none)"
                style={{ width: "100%", padding: 8 }}
                onBlur={(e) => updateUser(u.id, { email: e.target.value.trim().toLowerCase() || null })}
                disabled={busy}
              />

              <select
                value={u.role}
                onChange={(e) => updateUser(u.id, { role: e.target.value })}
                style={{ width: "100%", padding: 8 }}
                disabled={busy}
              >
                <option value="teacher">teacher</option>
                <option value="parent">parent</option>
                <option value="student">student</option>
                <option value="admin">admin</option>
              </select>

              <input
                type="checkbox"
                checked={u.is_active}
                onChange={(e) => updateUser(u.id, { is_active: e.target.checked })}
                disabled={busy}
              />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={busy} onClick={() => resetPassword(u.id)} style={{ padding: "8px 10px" }}>
                  Reset password
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
