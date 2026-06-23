// ─── Button ──────────────────────────────────
const VARIANTS = {
  default: { bg: "#F5F4F0", border: "#D8D6CF", color: "#1A1A18", hoverBg: "#ECEAE3" },
  primary: { bg: "#E6F1FB", border: "#85B7EB", color: "#0C447C", hoverBg: "#B5D4F4" },
  danger:  { bg: "#FCEBEB", border: "#F09595", color: "#791F1F", hoverBg: "#F7C1C1" },
  success: { bg: "#EAF3DE", border: "#97C459", color: "#27500A", hoverBg: "#C0DD97" },
};

export function Button({ children, variant = "default", onClick, disabled, style }) {
  const v = VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 13, padding: "5px 13px", height: 32,
        borderRadius: 7, border: `1px solid ${v.border}`,
        background: v.bg, color: v.color, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", fontWeight: 500, opacity: disabled ? 0.55 : 1,
        transition: "background 0.15s",
        ...style,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = v.hoverBg)}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = v.bg)}
    >
      {children}
    </button>
  );
}

// ─── Status Badge ─────────────────────────────
const STATUS_STYLES = {
  started:       { bg: "#EAF3DE", color: "#27500A" },
  stopped:       { bg: "#F1EFE8", color: "#444441" },
  error:         { bg: "#FCEBEB", color: "#791F1F" },
  "not deployed":{ bg: "#FAEEDA", color: "#633806" },
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["not deployed"];
  const label = status === "not deployed" ? "Not deployed"
    : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{
      fontSize: 11, padding: "3px 9px", borderRadius: 20,
      fontWeight: 600, whiteSpace: "nowrap",
      background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

// ─── Environment Badge ────────────────────────
const ENV_STYLES = {
  "Development":  { bg: "#E6F1FB", color: "#0C447C" },
  "QA / Testing": { bg: "#FAEEDA", color: "#633806" },
  "Production":   { bg: "#EAF3DE", color: "#27500A" },
};

export function EnvBadge({ env }) {
  const s = ENV_STYLES[env] || ENV_STYLES["Development"];
  return (
    <span style={{
      fontSize: 12, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {env}
    </span>
  );
}

// ─── Form Row ─────────────────────────────────
export function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: 12, color: "#6B6963", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputStyle = {
  width: "100%", fontSize: 13, padding: "6px 10px",
  borderRadius: 7, border: "1px solid #D8D6CF",
  background: "#fff", color: "#1A1A18",
  fontFamily: "inherit", outline: "none",
};

// ─── Spinner ──────────────────────────────────
export function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid currentColor`, borderTopColor: "transparent",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
    }} />
  );
}
