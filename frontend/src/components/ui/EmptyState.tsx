"use client";

import React from "react";

export default function EmptyState({
  title = "Nothing here yet",
  text = "No records found.",
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={styles.wrap}>
      <div style={styles.icon}>📭</div>
      <div style={styles.title}>{title}</div>
      <div style={styles.text}>{text}</div>
      {action ? <div style={styles.action}>{action}</div> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderRadius: 18,
    padding: 30,
    background: "#fff",
    border: "1px solid #e2e8f0",
    display: "grid",
    justifyItems: "center",
    gap: 10,
    textAlign: "center",
  },
  icon: {
    fontSize: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  text: {
    fontSize: 14,
    color: "#64748b",
    maxWidth: 520,
  },
  action: {
    marginTop: 8,
  },
};