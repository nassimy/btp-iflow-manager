import { useEffect, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const show = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  return { toast, show };
}

export function Toast({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [toast?.id]);

  if (!toast) return null;

  const colors = {
    success: { bg: "#EAF3DE", color: "#27500A", border: "#97C459" },
    error:   { bg: "#FCEBEB", color: "#791F1F", border: "#F09595" },
    info:    { bg: "#E6F1FB", color: "#0C447C", border: "#85B7EB" },
  };
  const c = colors[toast.type] || colors.success;

  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem",
      padding: "10px 18px", borderRadius: 8,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 13, fontWeight: 500, zIndex: 9999,
      opacity: visible ? 1 : 0, transition: "opacity 0.25s",
      pointerEvents: "none",
    }}>
      {toast.message}
    </div>
  );
}
