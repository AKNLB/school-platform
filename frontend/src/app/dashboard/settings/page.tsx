"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

type SettingsData = {
  school_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string | null;
  principal_name: string;
  principal_signature_url?: string | null;
  teacher_signature_url?: string | null;
};

type FormState = {
  school_name: string;
  address: string;
  phone: string;
  email: string;
  principal_name: string;
};

const emptyForm: FormState = {
  school_name: "",
  address: "",
  phone: "",
  email: "",
  principal_name: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const principalSigInputRef = useRef<HTMLInputElement | null>(null);
  const teacherSigInputRef = useRef<HTMLInputElement | null>(null);

  async function loadSettings() {
    setLoading(true);
    setErr(null);

    try {
      const res = await api.get("/settings");
      const data = normalizeSettings(res?.data);
      setSettings(data);
      setForm({
        school_name: data.school_name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        principal_name: data.principal_name,
      });
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load settings."));
      setSettings(null);
      setForm(emptyForm);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  const profileStats = useMemo(() => {
    const completed = [
      form.school_name,
      form.address,
      form.phone,
      form.email,
      form.principal_name,
      settings?.logo_url,
      settings?.principal_signature_url,
      settings?.teacher_signature_url,
    ].filter(Boolean).length;

    const total = 8;
    const pct = Math.round((completed / total) * 100);

    return {
      completed,
      total,
      pct,
    };
  }, [form, settings]);

  const completionChecklist = useMemo(() => {
    return [
      { label: "School name", done: Boolean(form.school_name.trim()) },
      { label: "Address", done: Boolean(form.address.trim()) },
      { label: "Phone", done: Boolean(form.phone.trim()) },
      { label: "Email", done: Boolean(form.email.trim()) },
      { label: "Principal name", done: Boolean(form.principal_name.trim()) },
      { label: "School logo", done: Boolean(settings?.logo_url) },
      { label: "Principal signature", done: Boolean(settings?.principal_signature_url) },
      { label: "Teacher signature", done: Boolean(settings?.teacher_signature_url) },
    ];
  }, [form, settings]);

  const brandingSummary = useMemo(() => {
    const hasLogo = Boolean(settings?.logo_url);
    const hasPrincipal = Boolean(settings?.principal_signature_url);
    const hasTeacher = Boolean(settings?.teacher_signature_url);

    if (hasLogo && hasPrincipal && hasTeacher) return "Complete brand pack";
    if (hasLogo || hasPrincipal || hasTeacher) return "Partially configured";
    return "Assets missing";
  }, [settings]);

  const unsavedChanges = useMemo(() => {
    if (!settings) return false;

    return (
      form.school_name !== (settings.school_name || "") ||
      form.address !== (settings.address || "") ||
      form.phone !== (settings.phone || "") ||
      form.email !== (settings.email || "") ||
      form.principal_name !== (settings.principal_name || "")
    );
  }, [form, settings]);

  async function saveSettings() {
    setSaving(true);
    setErr(null);
    setSuccess(null);

    try {
      await api.put("/settings", {
        school_name: form.school_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        principal_name: form.principal_name.trim(),
      });

      setSuccess("Settings saved successfully.");
      await loadSettings();
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(kind: "logo" | "principal_signature" | "teacher_signature", file: File) {
    const okTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExt = ["png", "jpg", "jpeg", "webp"];

    if (!okTypes.includes(file.type) && !allowedExt.includes(extension)) {
      setErr("Please upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    setUploadingKind(kind);
    setErr(null);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);

      await api.post("/settings/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(
        kind === "logo"
          ? "School logo uploaded."
          : kind === "principal_signature"
            ? "Principal signature uploaded."
            : "Teacher signature uploaded."
      );

      await loadSettings();
    } catch (e: unknown) {
      setErr(extractErr(e, "Upload failed."));
    } finally {
      setUploadingKind(null);
    }
  }

  function resetForm() {
    if (!settings) return;
    setForm({
      school_name: settings.school_name || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      principal_name: settings.principal_name || "",
    });
    setSuccess(null);
    setErr(null);
  }

  return (
    <div style={pageShell}>
      <div style={bgGlowOne} />
      <div style={bgGlowTwo} />

      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Branding & School Identity</div>
            <h1 style={heroTitle}>Settings</h1>
            <p style={heroText}>
              Control how your school appears across the dashboard, finance receipts,
              report cards, and official documents. Keep your identity polished,
              consistent, and ready for print.
            </p>

            <div style={heroMiniRow}>
              <HeroMiniBadge label="Completion" value={`${profileStats.pct}%`} />
              <HeroMiniBadge label="Brand Pack" value={brandingSummary} />
              <HeroMiniBadge label="Changes" value={unsavedChanges ? "Unsaved edits" : "Saved"} />
            </div>
          </div>

          <div style={heroActions}>
            <button onClick={() => void loadSettings()} style={btnSecondary} disabled={loading || saving}>
              Refresh
            </button>
            <button onClick={resetForm} style={btnGhost} disabled={loading || saving}>
              Reset
            </button>
            <button onClick={() => void saveSettings()} style={btnPrimary} disabled={loading || saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Profile Completion" value={`${profileStats.pct}%`} accent="blue" />
          <StatCard label="Filled Items" value={`${profileStats.completed}/${profileStats.total}`} accent="green" />
          <StatCard label="Logo" value={settings?.logo_url ? "Added" : "Missing"} accent="purple" />
          <StatCard label="Signatures" value={signatureStatus(settings)} accent="amber" />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Setup Checklist</div>
            <div style={insightSub}>Track what still needs attention before documents look official.</div>

            <div style={checklistWrap}>
              {completionChecklist.map((item) => (
                <div key={item.label} style={checklistRow}>
                  <div style={checkIcon(item.done)}>{item.done ? "✓" : "•"}</div>
                  <div style={checkText}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Document Readiness</div>
            <div style={insightSub}>How prepared your school profile is for reports and receipts.</div>

            <div style={progressCard}>
              <div style={progressTop}>
                <div style={progressLabel}>Readiness Score</div>
                <div style={progressValue}>{profileStats.pct}%</div>
              </div>

              <div style={progressTrack}>
                <div style={{ ...progressFill, width: `${profileStats.pct}%` }} />
              </div>

              <div style={progressFoot}>
                {profileStats.pct >= 100
                  ? "Everything needed for polished output is in place."
                  : "Complete the remaining items to improve report cards and finance documents."}
              </div>
            </div>
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

        {loading ? (
          <section style={panel}>
            <div style={loadingBox}>Loading settings...</div>
          </section>
        ) : (
          <div style={contentGrid}>
            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <div style={panelTitle}>School Information</div>
                  <div style={panelSub}>Core identity details used across the platform.</div>
                </div>
              </div>

              <div style={panelBody}>
                <div style={infoTipCard}>
                  <div style={infoTipTitle}>School Profile Tip</div>
                  <div style={infoTipText}>
                    These details power the header area on report cards, financial documents,
                    and printable school records.
                  </div>
                </div>

                <div style={formGrid}>
                  <Field label="School Name" full>
                    <input
                      style={fieldInput}
                      value={form.school_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, school_name: e.target.value }))}
                      placeholder="Enter school name"
                    />
                  </Field>

                  <Field label="Address" full>
                    <textarea
                      style={{ ...fieldInput, minHeight: 100, resize: "vertical" }}
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter school address"
                    />
                  </Field>

                  <Field label="Phone">
                    <input
                      style={fieldInput}
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      style={fieldInput}
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter school email"
                    />
                  </Field>

                  <Field label="Principal Name" full>
                    <input
                      style={fieldInput}
                      value={form.principal_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, principal_name: e.target.value }))}
                      placeholder="Enter principal name"
                    />
                  </Field>
                </div>

                <div style={sectionFooter}>
                  <button onClick={resetForm} style={btnSecondary} disabled={saving}>
                    Reset Changes
                  </button>
                  <button onClick={() => void saveSettings()} style={btnPrimary} disabled={saving}>
                    {saving ? "Saving..." : "Save School Info"}
                  </button>
                </div>
              </div>
            </section>

            <section style={rightColumn}>
              <section style={panel}>
                <div style={panelHeader}>
                  <div>
                    <div style={panelTitle}>Brand Assets</div>
                    <div style={panelSub}>Upload your logo and signatures.</div>
                  </div>
                </div>

                <div style={assetGrid}>
                  <AssetCard
                    title="School Logo"
                    subtitle="Shows on PDFs and school identity areas"
                    imageUrl={settings?.logo_url || null}
                    buttonLabel={uploadingKind === "logo" ? "Uploading..." : "Upload Logo"}
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingKind !== null}
                    status={settings?.logo_url ? "Ready" : "Missing"}
                  />

                  <AssetCard
                    title="Principal Signature"
                    subtitle="Used on report cards and official documents"
                    imageUrl={settings?.principal_signature_url || null}
                    buttonLabel={uploadingKind === "principal_signature" ? "Uploading..." : "Upload Signature"}
                    onClick={() => principalSigInputRef.current?.click()}
                    disabled={uploadingKind !== null}
                    status={settings?.principal_signature_url ? "Ready" : "Missing"}
                  />

                  <AssetCard
                    title="Teacher Signature"
                    subtitle="Used on academic reports"
                    imageUrl={settings?.teacher_signature_url || null}
                    buttonLabel={uploadingKind === "teacher_signature" ? "Uploading..." : "Upload Signature"}
                    onClick={() => teacherSigInputRef.current?.click()}
                    disabled={uploadingKind !== null}
                    status={settings?.teacher_signature_url ? "Ready" : "Missing"}
                  />
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    void uploadAsset("logo", file);
                  }}
                />

                <input
                  ref={principalSigInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    void uploadAsset("principal_signature", file);
                  }}
                />

                <input
                  ref={teacherSigInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    void uploadAsset("teacher_signature", file);
                  }}
                />
              </section>

              <section style={panel}>
                <div style={panelHeader}>
                  <div>
                    <div style={panelTitle}>Live Preview</div>
                    <div style={panelSub}>How your official documents will feel.</div>
                  </div>
                </div>

                <div style={previewCard}>
                  <div style={previewTop}>
                    <div style={previewLogoWrap}>
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="School logo" style={previewLogo} />
                      ) : (
                        <div style={previewLogoFallback}>LOGO</div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={previewSchoolName}>{form.school_name || "Your School Name"}</div>
                      <div style={previewMeta}>{form.address || "School address will appear here"}</div>
                      <div style={previewMeta}>
                        {form.phone || "Phone"} {form.email ? `• ${form.email}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={previewDivider} />

                  <div style={previewDocTitle}>Official School Document</div>
                  <div style={previewText}>
                    This preview reflects your report card and finance document header style.
                    Add your logo and signatures to make all exports feel complete and premium.
                  </div>

                  <div style={signaturePreviewRow}>
                    <SignaturePreview
                      label="Teacher Signature"
                      src={settings?.teacher_signature_url || null}
                    />
                    <SignaturePreview
                      label={form.principal_name || "Principal"}
                      src={settings?.principal_signature_url || null}
                    />
                  </div>
                </div>
              </section>

              <section style={panel}>
                <div style={panelHeader}>
                  <div>
                    <div style={panelTitle}>Contact Snapshot</div>
                    <div style={panelSub}>Quick view of the school’s public-facing details.</div>
                  </div>
                </div>

                <div style={snapshotGrid}>
                  <SnapshotTile label="School Name" value={form.school_name || "--"} />
                  <SnapshotTile label="Principal" value={form.principal_name || "--"} />
                  <SnapshotTile label="Phone" value={form.phone || "--"} />
                  <SnapshotTile label="Email" value={form.email || "--"} />
                </div>
              </section>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  title,
  subtitle,
  imageUrl,
  buttonLabel,
  onClick,
  disabled,
  status,
}: {
  title: string;
  subtitle: string;
  imageUrl: string | null;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  status: string;
}) {
  return (
    <div style={assetCard}>
      <div style={assetTopRow}>
        <div style={assetPreview}>
          {imageUrl ? (
            <img src={imageUrl} alt={title} style={assetImage} />
          ) : (
            <div style={assetPlaceholder}>No file</div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={assetTitle}>{title}</div>
          <div style={assetSubtitle}>{subtitle}</div>
          <div style={assetStatus(imageUrl ? true : false)}>{status}</div>
        </div>
      </div>

      <button onClick={onClick} style={btnSecondary} disabled={disabled}>
        {buttonLabel}
      </button>
    </div>
  );
}

function SignaturePreview({ label, src }: { label: string; src: string | null }) {
  return (
    <div style={signatureBox}>
      <div style={signatureLine}>
        {src ? <img src={src} alt={label} style={signatureImage} /> : null}
      </div>
      <div style={signatureLabel}>{label}</div>
    </div>
  );
}

function SnapshotTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={snapshotTile}>
      <div style={snapshotLabel}>{label}</div>
      <div style={snapshotValue}>{value}</div>
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

function normalizeSettings(data: unknown): SettingsData {
  const value = (data || {}) as Partial<SettingsData>;

  return {
    school_name: value.school_name || "",
    address: value.address || "",
    phone: value.phone || "",
    email: value.email || "",
    logo_url: value.logo_url || null,
    principal_name: value.principal_name || "",
    principal_signature_url: value.principal_signature_url || null,
    teacher_signature_url: value.teacher_signature_url || null,
  };
}

function signatureStatus(settings: SettingsData | null) {
  const principal = !!settings?.principal_signature_url;
  const teacher = !!settings?.teacher_signature_url;

  if (principal && teacher) return "Complete";
  if (principal || teacher) return "Partial";
  return "Missing";
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
  position: "relative",
  overflow: "hidden",
};

const bgGlowOne: CSSProperties = {
  position: "absolute",
  top: -120,
  right: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
  pointerEvents: "none",
};

const bgGlowTwo: CSSProperties = {
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
  maxWidth: 1400,
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
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

const heroMiniRow: CSSProperties = {
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

const checklistWrap: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const checklistRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const checkIcon = (done: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  background: done ? "rgba(34,197,94,0.16)" : "rgba(148,163,184,0.14)",
  color: done ? "#bbf7d0" : "#cbd5e1",
  border: done ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(148,163,184,0.24)",
});

const checkText: CSSProperties = {
  color: "#e5e7eb",
  fontWeight: 700,
};

const progressCard: CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const progressTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const progressLabel: CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
  fontWeight: 800,
};

const progressValue: CSSProperties = {
  fontSize: 20,
  color: "#fff",
  fontWeight: 900,
};

const progressTrack: CSSProperties = {
  marginTop: 12,
  height: 12,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(168,85,247,0.95))",
};

const progressFoot: CSSProperties = {
  marginTop: 12,
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.5,
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

const contentGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 16,
  alignItems: "start",
};

const rightColumn: CSSProperties = {
  display: "grid",
  gap: 16,
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

const panelBody: CSSProperties = {
  padding: 16,
};

const infoTipCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(96,165,250,0.08)",
  marginBottom: 14,
};

const infoTipTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#dbeafe",
  marginBottom: 6,
};

const infoTipText: CSSProperties = {
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

const fieldInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const sectionFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const assetGrid: CSSProperties = {
  padding: 16,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
};

const assetCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const assetTopRow: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
};

const assetPreview: CSSProperties = {
  width: 120,
  height: 100,
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.7)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  flexShrink: 0,
};

const assetImage: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};

const assetPlaceholder: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 700,
};

const assetTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
};

const assetSubtitle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.45,
  marginTop: 4,
};

const assetStatus = (ready: boolean): CSSProperties => ({
  marginTop: 10,
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  background: ready ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.16)",
  color: ready ? "#bbf7d0" : "#fde68a",
  border: ready ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(245,158,11,0.28)",
});

const previewCard: CSSProperties = {
  padding: 16,
  margin: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
};

const previewTop: CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
};

const previewLogoWrap: CSSProperties = {
  width: 82,
  height: 82,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.8)",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  flexShrink: 0,
};

const previewLogo: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const previewLogoFallback: CSSProperties = {
  color: "#93c5fd",
  fontWeight: 900,
  fontSize: 14,
};

const previewSchoolName: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#fff",
};

const previewMeta: CSSProperties = {
  marginTop: 4,
  color: "#cbd5e1",
  fontSize: 13,
};

const previewDivider: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.10)",
  margin: "16px 0",
};

const previewDocTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const previewText: CSSProperties = {
  marginTop: 8,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const signaturePreviewRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 18,
};

const signatureBox: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  padding: 12,
  background: "rgba(15,23,42,0.55)",
};

const signatureLine: CSSProperties = {
  height: 60,
  borderBottom: "1px solid rgba(255,255,255,0.18)",
  display: "grid",
  placeItems: "end start",
};

const signatureImage: CSSProperties = {
  maxWidth: "100%",
  maxHeight: 46,
  objectFit: "contain",
};

const signatureLabel: CSSProperties = {
  marginTop: 10,
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 700,
};

const snapshotGrid: CSSProperties = {
  padding: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const snapshotTile: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const snapshotLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
};

const snapshotValue: CSSProperties = {
  marginTop: 8,
  color: "#fff",
  fontWeight: 900,
  lineHeight: 1.5,
};

const btnPrimary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "transparent",
  color: "#cbd5e1",
  fontWeight: 800,
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

const loadingBox: CSSProperties = {
  padding: 20,
  color: "#cbd5e1",
};