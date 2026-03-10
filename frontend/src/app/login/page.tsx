"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("abc-learning-centre");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completion = useMemo(() => {
    const fields = [schoolSlug.trim(), username.trim(), password.trim()];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [schoolSlug, username, password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: schoolSlug.trim(),
          username: username.trim(),
          password,
          remember_me: rememberMe,
        }),
      });

      if (!res.ok) {
        throw new Error("Login failed");
      }

      router.push("/dashboard");
    } catch {
      setError("Invalid school, username, or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageShell}>
      <div style={bgGlowOne} />
      <div style={bgGlowTwo} />

      <section style={page}>
        <div style={leftPanel}>
          <div style={brandBadge}>School Platform</div>

          <h1 style={heroTitle}>Welcome back</h1>
          <p style={heroText}>
            Sign in to access your premium school workspace for students, finance,
            report cards, tasks, records, and administration.
          </p>

          <div style={heroCard}>
            <div style={heroCardTitle}>What’s inside</div>

            <div style={featureList}>
              <FeatureItem
                icon="🎓"
                title="Student Management"
                text="Profiles, attendance, academic records, and finance history in one place."
              />
              <FeatureItem
                icon="📊"
                title="Academic Control"
                text="Scores, report cards, and classroom performance tracking made simple."
              />
              <FeatureItem
                icon="⚙️"
                title="School Operations"
                text="Announcements, tasks, settings, branding, and administrative workflows."
              />
            </div>
          </div>

          <div style={miniStatsRow}>
            <MiniStat label="Secure Access" value="Active" />
            <MiniStat label="Workspace" value="Premium" />
            <MiniStat label="Readiness" value={`${completion}%`} />
          </div>
        </div>

        <div style={rightPanel}>
          <div style={loginCard}>
            <div style={loginTop}>
              <div>
                <div style={eyebrow}>Account Access</div>
                <h2 style={loginTitle}>Sign in</h2>
                <p style={loginSub}>Enter your school and account credentials to continue.</p>
              </div>

              <div style={statusPill}>{completion}% ready</div>
            </div>

            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${completion}%` }} />
            </div>

            <form onSubmit={onSubmit} style={formGrid}>
              <Field label="School Slug">
                <input
                  type="text"
                  placeholder="e.g. abc-learning-centre"
                  value={schoolSlug}
                  onChange={(e) => setSchoolSlug(e.target.value)}
                  required
                  style={fieldInput}
                />
              </Field>

              <Field label="Username or Email">
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={fieldInput}
                />
              </Field>

              <Field label="Password">
                <div style={passwordWrap}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ ...fieldInput, paddingRight: 90 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={toggleBtn}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>

              <div style={formOptions}>
                <label style={checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button type="button" style={textBtn}>
                  Need help?
                </button>
              </div>

              {error && <div style={errorBox}>{error}</div>}

              <button type="submit" disabled={submitting} style={submitBtn}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div style={footerNote}>
              Protected school access. Only authorized users can enter the dashboard.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldBlock}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div style={featureItem}>
      <div style={featureIcon}>{icon}</div>
      <div>
        <div style={featureTitle}>{title}</div>
        <div style={featureText}>{text}</div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  );
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #020617 0%, #0f172a 45%, #111827 100%)",
  color: "#f8fafc",
  position: "relative",
  overflow: "hidden",
  padding: 24,
};

const bgGlowOne: CSSProperties = {
  position: "absolute",
  top: -120,
  left: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
  pointerEvents: "none",
};

const bgGlowTwo: CSSProperties = {
  position: "absolute",
  bottom: -140,
  right: -100,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)",
  pointerEvents: "none",
};

const page: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  minHeight: "calc(100vh - 48px)",
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 24,
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const leftPanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const rightPanel: CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const brandBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(96,165,250,0.24)",
  color: "#dbeafe",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 48,
  fontWeight: 950,
  lineHeight: 1.02,
};

const heroText: CSSProperties = {
  margin: 0,
  maxWidth: 680,
  color: "#cbd5e1",
  fontSize: 16,
  lineHeight: 1.7,
};

const heroCard: CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(12px)",
  padding: 20,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const heroCardTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
  marginBottom: 14,
};

const featureList: CSSProperties = {
  display: "grid",
  gap: 14,
};

const featureItem: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const featureIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(96,165,250,0.14)",
  flexShrink: 0,
  fontSize: 18,
};

const featureTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
};

const featureText: CSSProperties = {
  marginTop: 4,
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.55,
};

const miniStatsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
  gap: 12,
};

const miniStatCard: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
};

const miniStatLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
};

const miniStatValue: CSSProperties = {
  marginTop: 8,
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const loginCard: CSSProperties = {
  width: "100%",
  maxWidth: 500,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.80)",
  backdropFilter: "blur(14px)",
  padding: 24,
  boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
};

const loginTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: "#93c5fd",
  marginBottom: 6,
};

const loginTitle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 950,
};

const loginSub: CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: "#cbd5e1",
  lineHeight: 1.6,
  fontSize: 14,
};

const statusPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.14)",
  border: "1px solid rgba(34,197,94,0.24)",
  color: "#bbf7d0",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const progressTrack: CSSProperties = {
  marginTop: 16,
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
};

const formGrid: CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 20,
};

const fieldBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#cbd5e1",
};

const fieldInput: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(2,6,23,0.42)",
  color: "#fff",
  outline: "none",
  fontSize: 14,
};

const passwordWrap: CSSProperties = {
  position: "relative",
};

const toggleBtn: CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  borderRadius: 10,
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const formOptions: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const checkboxLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#cbd5e1",
  fontSize: 14,
};

const textBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#93c5fd",
  cursor: "pointer",
  fontWeight: 800,
  padding: 0,
};

const errorBox: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
  fontSize: 14,
  fontWeight: 700,
};

const submitBtn: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const footerNote: CSSProperties = {
  marginTop: 18,
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.5,
};