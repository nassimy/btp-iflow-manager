export function Modal({ children, onClose }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
    >
      <div style={{
        background: "#fff", border: "1px solid #E0DED8",
        borderRadius: 12, padding: "1.5rem", width: 460, maxWidth: "94vw",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ children }) {
  return <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: "1.25rem", color: "#1A1A18" }}>{children}</h2>;
}

export function ModalActions({ children }) {
  return <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem" }}>{children}</div>;
}
