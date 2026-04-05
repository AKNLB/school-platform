"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), 3000)
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [toasts, removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div style={wrap}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              ...toastCard,
              ...(toast.type === "success"
                ? toastSuccess
                : toast.type === "error"
                  ? toastError
                  : toastInfo),
            }}
          >
            <div style={toastMessage}>{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={closeBtn}
              aria-label="Close toast"
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  top: 20,
  right: 20,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxWidth: 380,
};

const toastCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
  backdropFilter: "blur(10px)",
  color: "#fff",
};

const toastSuccess: React.CSSProperties = {
  background: "rgba(22,163,74,0.92)",
};

const toastError: React.CSSProperties = {
  background: "rgba(185,28,28,0.94)",
};

const toastInfo: React.CSSProperties = {
  background: "rgba(30,41,59,0.94)",
};

const toastMessage: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.4,
};

const closeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
};