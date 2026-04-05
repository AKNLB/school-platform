"use client";

import React from "react";

export default function LoadingState({ text = "Loading..." }: { text?: string }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.spinner} />
      <div style={styles.text}>{text}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderRadius: 18,
    padding: 28,
    background: "#fff",
    border: "1px solid #e2e8f0",
    display: "grid",
    justifyItems: "center",
    gap: 12,
  },
  spinner: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "3px solid #cbd5e1",
    borderTop: "3px solid #2563eb",
    animation: "spin 1s linear infinite",
  },
  text: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: 700,
  },
};