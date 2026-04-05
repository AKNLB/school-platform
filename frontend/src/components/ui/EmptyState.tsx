import type { ReactNode, CSSProperties } from "react";

export default function EmptyState({
  title = "Nothing here yet",
  text = "No records found.",
  action,
  compact = false,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        padding: compact ? 16 : 24,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>{text}</div>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}