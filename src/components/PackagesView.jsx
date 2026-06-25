import { useState } from "react";
import { Spinner } from "./UI";
import { ChevronRight, Search } from "lucide-react";

const STATUS_COLOR = {
  started:       { bg: "#EAF3DE", color: "#27500A", dot: "#5A9E2F" },
  error:         { bg: "#FCEBEB", color: "#791F1F", dot: "#D95B5B" },
  "not deployed":{ bg: "#FAEEDA", color: "#633806", dot: "#C98A2A" },
  stopped:       { bg: "#F1EFE8", color: "#444441", dot: "#9B9890" },
};

function StatPill({ count, status }) {
  if (!count) return null;
  const s = STATUS_COLOR[status] || STATUS_COLOR["not deployed"];
  const label = status === "not deployed" ? "off" : status === "started" ? "running" : status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, padding: "2px 8px", borderRadius: 20,
      background: s.bg, color: s.color, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {count} {label}
    </span>
  );
}

const EMOJIS = ["📦", "💼", "🏭", "🔗", "📊", "🛠️", "🌐", "🔒", "⚡", "🎯"];
const emoji = (name) => EMOJIS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % EMOJIS.length];

export function PackagesView({ packages, iflows, loading, onSelect }) {
  const [search, setSearch] = useState("");

  const filtered = packages.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Build stats per package
  const statsFor = (pkgId) => {
    const pkg = iflows.filter(f => f.packageId === pkgId);
    return {
      total:       pkg.length,
      started:     pkg.filter(f => f.status === "started").length,
      error:       pkg.filter(f => f.status === "error").length,
      stopped:     pkg.filter(f => f.status === "stopped").length,
      notDeployed: pkg.filter(f => f.status === "not deployed").length,
    };
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A18", marginBottom: 2 }}>Packages</h2>
          <p style={{ fontSize: 13, color: "#6B6963" }}>
            {loading ? "Loading…" : `${packages.length} package${packages.length !== 1 ? "s" : ""} · ${iflows.length} iFlows total`}
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9B9890", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search packages…"
            style={{
              fontSize: 13, padding: "5px 10px 5px 28px", height: 32,
              borderRadius: 7, border: "1px solid #D8D6CF",
              background: "#fff", color: "#1A1A18", fontFamily: "inherit", width: 200,
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#6B6963" }}><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#6B6963", fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          No packages found.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map(pkg => {
            const s = statsFor(pkg.id);
            const hasError = s.error > 0;
            return (
              <div
                key={pkg.id}
                onClick={() => onSelect(pkg)}
                style={{
                  background: "#fff",
                  border: `1px solid ${hasError ? "#F09595" : "#ECEAE3"}`,
                  borderRadius: 12, padding: "1.1rem 1.25rem",
                  cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s",
                  display: "flex", flexDirection: "column", gap: 10,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{emoji(pkg.name)}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A18", lineHeight: 1.3 }}>{pkg.name}</div>
                      <div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace", marginTop: 2 }}>{pkg.id}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="#9B9890" style={{ flexShrink: 0, marginTop: 2 }} />
                </div>

                {/* iFlow count */}
                <div style={{ fontSize: 13, color: "#6B6963" }}>
                  <strong style={{ color: "#1A1A18", fontSize: 20, fontWeight: 700 }}>{s.total}</strong>
                  {" "}iFlow{s.total !== 1 ? "s" : ""}
                </div>

                {/* Status pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <StatPill count={s.started}     status="started" />
                  <StatPill count={s.error}       status="error" />
                  <StatPill count={s.stopped}     status="stopped" />
                  <StatPill count={s.notDeployed} status="not deployed" />
                  {s.total === 0 && <span style={{ fontSize: 11, color: "#9B9890" }}>No iFlows</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
