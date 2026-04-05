"use client";

import React from "react";

export default function ErrorState({
  text = "Something went wrong.",
  onRetry,
}: {
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={styles.wrap}>
      <div style={styles.icon}>⚠️</div>
      <div style={styles.title}>Request failed</div>
      <div style={styles.text}>{text}</div>
      {onRetry && (
        <button onClick={onRetry} style={styles.btn}>
          Retry
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderRadius: 18,
    padding: 28,
    background: "#fff",
    border: "1px solid #fecaca",
    display: "grid",
    justifyItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    color: "#991b1b",
  },
  text: {
    fontSize: 14,
    color: "#7f1d1d",
    textAlign: "center",
    maxWidth: 480,
  },
  btn: {
    marginTop: 6,
    border: "none",
    borderRadius: 12,
    background: "#dc2626",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
};