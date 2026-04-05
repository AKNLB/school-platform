"use client";

import React from "react";

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title = "Please confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>{title}</div>
        <div style={styles.message}>{message}</div>

        <div style={styles.actions}>
          <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              ...styles.confirmBtn,
              ...(danger ? styles.dangerBtn : styles.primaryBtn),
            }}
          >
            {busy ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9998,
    backdropFilter: "blur(6px)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 25px 80px rgba(0,0,0,0.22)",
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#475569",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  confirmBtn: {
    borderRadius: 12,
    border: "none",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryBtn: {
    background: "#2563eb",
  },
  dangerBtn: {
    background: "#dc2626",
  },
};