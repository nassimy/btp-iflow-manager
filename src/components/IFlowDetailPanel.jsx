import { useState, useEffect } from "react";
import { fetchIFlowDetail, fetchIFlowConfigurations, fetchRuntimeDetail } from "../api";
import { StatusBadge, Spinner, Button } from "./UI";
import { X, AlertTriangle, Settings, Info, Clock } from "lucide-react";

function Section({ title, icon: Icon, children }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.6rem" }}>
        <Icon size={13} color="#6B6963" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B6963", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #F0EEE8", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#6B6963", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1A1A18", fontWeight: 500, textAlign: "right", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function formatDate(odataDate) {
  if (!odataDate) return null;
  // SAP returns /Date(1234567890000)/
  const match = odataDate.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toLocaleString();
  return odataDate;
}

export function IFlowDetailPanel({ iflow, onClose }) {
  const [detail, setDetail]         = useState(null);
  const [configs, setConfigs]       = useState([]);
  const [runtime, setRuntime]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [activeTab, setActiveTab]   = useState("overview");

  useEffect(() => {
    if (!iflow) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setConfigs([]);
    setRuntime(null);

    Promise.all([
      fetchIFlowDetail(iflow.id).catch(() => null),
      fetchIFlowConfigurations(iflow.id).catch(() => []),
      fetchRuntimeDetail(iflow.id).catch(() => null),
    ]).then(([d, c, r]) => {
      setDetail(d);
      setConfigs(c);
      setRuntime(r);
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [iflow?.id]);

  if (!iflow) return null;

  const TABS = [
    { id: "overview", label: "Overview",      icon: Info },
    { id: "config",   label: `Config (${configs.length})`, icon: Settings },
    ...(runtime?.errorInfo ? [{ id: "error", label: "Error", icon: AlertTriangle }] : []),
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
      {/* Modal — fixed size so it never shrinks with less content */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "95vw", height: "80vh",
          background: "#fff", borderRadius: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: "1px solid #E0DED8",
          zIndex: 201, display: "flex", flexDirection: "column",
          animation: "fadeIn 0.15s ease",
        }}
      >

        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #ECEAE3", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A18", marginBottom: 4, wordBreak: "break-word" }}>{iflow.name}</div>
              <div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace", marginBottom: 6 }}>{iflow.id}</div>
              <StatusBadge status={iflow.status} />
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6963", padding: 4, flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #ECEAE3", padding: "0 1.25rem", flexShrink: 0 }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            const isError  = id === "error";
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "0 2px", height: 38, fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isError ? "#791F1F" : isActive ? "#1A1A18" : "#6B6963",
                background: "none", border: "none",
                borderBottom: isActive ? `2px solid ${isError ? "#791F1F" : "#1A1A18"}` : "2px solid transparent",
                cursor: "pointer", fontFamily: "inherit", marginRight: 16,
              }}>
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#6B6963" }}><Spinner size={24} /></div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#791F1F", fontSize: 13 }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <div>{error}</div>
            </div>
          ) : (
            <>
              {/* ── Overview tab ── */}
              {activeTab === "overview" && (
                <>
                  {/* Version mismatch warning */}
                  {(() => {
                    const dv = (detail?.Version || iflow.version || "").trim();
                    const rv = (runtime?.version || "").trim();
                    console.log("[detail] design version:", JSON.stringify(dv), "runtime version:", JSON.stringify(rv), "match:", dv === rv);
                    return runtime && dv && rv && dv !== rv ? (
                    <div style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      background: "#FAEEDA", border: "1px solid #E8C97A",
                      borderRadius: 8, padding: "10px 12px", marginBottom: "1rem",
                    }}>
                      <AlertTriangle size={15} color="#854F0B" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#633806", marginBottom: 2 }}>Version mismatch</div>
                        <div style={{ fontSize: 12, color: "#854F0B" }}>
                          Design version <strong>{dv}</strong> differs from deployed runtime version <strong>{rv}</strong>. Redeploy to sync them.
                        </div>
                      </div>
                    </div>
                    ) : null;
                  })()}

                  <Section title="Details" icon={Info}>
                    <Field label="Name"        value={iflow.name} />
                    <Field label="ID"          value={iflow.id} mono />
                    <Field label="Design version" value={(detail?.Version || iflow.version || "").trim()} mono />
                    <Field label="Package"     value={iflow.packageName} />
                    <Field label="Package ID"  value={iflow.packageId} mono />
                    <Field label="Description" value={detail?.Description} />
                  </Section>

                  <Section title="Runtime" icon={Clock}>
                    {runtime ? (
                      <>
                        <Field label="Status"          value={<StatusBadge status={iflow.status} />} />
                        <Field label="Deployed by"     value={runtime.deployedBy} />
                        <Field label="Deployed on"     value={formatDate(runtime.deployedOn)} />
                        <Field label="Runtime version" value={runtime.version} mono />
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#9B9890", padding: "8px 0" }}>Not deployed to runtime.</div>
                    )}
                  </Section>
                </>
              )}

              {/* ── Config tab ── */}
              {activeTab === "config" && (
                <Section title="Configuration Parameters" icon={Settings}>
                  {configs.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#9B9890", padding: "8px 0" }}>No configuration parameters found.</div>
                  ) : (
                    <div style={{ border: "1px solid #ECEAE3", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#FAFAF8" }}>
                            <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#6B6963", borderBottom: "1px solid #ECEAE3", fontSize: 11 }}>Key</th>
                            <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#6B6963", borderBottom: "1px solid #ECEAE3", fontSize: 11 }}>Value</th>
                            <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#6B6963", borderBottom: "1px solid #ECEAE3", fontSize: 11 }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {configs.map((c, i) => (
                            <tr key={c.key} style={{ borderBottom: i < configs.length - 1 ? "1px solid #ECEAE3" : "none", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                              <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#1A1A18", fontWeight: 500 }}>{c.key}</td>
                              <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#444441", wordBreak: "break-all" }}>{c.value || <span style={{ color: "#C0BDB6" }}>—</span>}</td>
                              <td style={{ padding: "7px 10px", color: "#9B9890" }}>{c.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              )}

              {/* ── Error tab ── */}
              {activeTab === "error" && runtime?.errorInfo && (
                <Section title="Error Information" icon={AlertTriangle}>
                  <div style={{ background: "#FCEBEB", border: "1px solid #F09595", borderRadius: 8, padding: "12px", fontSize: 12, color: "#791F1F", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {runtime.errorInfo}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #ECEAE3", flexShrink: 0 }}>
          <Button onClick={onClose} style={{ width: "100%", justifyContent: "center" }}>Close</Button>
        </div>
      </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
    </>
  );
}