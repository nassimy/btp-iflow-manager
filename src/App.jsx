import { useState, useEffect, useCallback } from "react";
import { fetchIFlows, fetchPackages, uploadIFlow, deployIFlow, deleteIFlow } from "./mock/api";
import { IFlowTable } from "./components/IFlowTable";
import { UploadModal } from "./components/UploadModal";
import { ConfirmDeployModal, ConfirmDeleteModal } from "./components/ConfirmModal";
import { Button, EnvBadge, Spinner } from "./components/UI";
import { Toast, useToast } from "./components/Toast";
import { Upload } from "lucide-react";

const ENVS = ["Development", "QA / Testing", "Production"];

const STAT_CARDS = [
  { label: "Total",       key: "total",       color: "#1A1A18" },
  { label: "Running",     key: "started",     color: "#27500A" },
  { label: "Errors",      key: "error",       color: "#A32D2D" },
  { label: "Not deployed",key: "notDeployed", color: "#854F0B" },
];

export default function App() {
  const [env, setEnv]           = useState("Development");
  const [iflows, setIFlows]     = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [pkgFilter, setPkgFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showUpload, setShowUpload]     = useState(false);
  const [deployTarget, setDeployTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, show: showToast } = useToast();

  const load = useCallback(async (e = env) => {
    setLoading(true);
    try {
      const [flows, pkgs] = await Promise.all([fetchIFlows(e), fetchPackages()]);
      setIFlows(flows);
      setPackages(pkgs);
    } catch (err) {
      showToast("Failed to load iFlows.", "error");
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => { load(env); }, [env]);

  const handleEnv = e => { setEnv(e); setSearch(""); setPkgFilter(""); setStatusFilter(""); };

  const handleUpload = async (data) => {
    await uploadIFlow(data);
    await load(env);
    showToast(`"${data.name}" uploaded to ${env}.`, "success");
  };

  const handleDeploy = async (id) => {
    await deployIFlow(id);
    await load(env);
    showToast("iFlow deployed successfully.", "success");
  };

  const handleDelete = async (id) => {
    await deleteIFlow(id);
    await load(env);
    showToast("iFlow deleted.", "error");
  };

  // Filtered list
  const visible = iflows.filter(f => {
    if (pkgFilter && f.packageId !== pkgFilter) return false;
    if (statusFilter && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const stats = {
    total:       iflows.length,
    started:     iflows.filter(f => f.status === "started").length,
    error:       iflows.filter(f => f.status === "error").length,
    notDeployed: iflows.filter(f => f.status === "not deployed").length,
  };

  const inputStyle = {
    fontSize: 13, padding: "5px 10px", height: 32,
    borderRadius: 7, border: "1px solid #D8D6CF",
    background: "#fff", color: "#1A1A18", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F2", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #ECEAE3",
        padding: "0 2rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A18" }}>iFlow Manager</span>
          <span style={{ fontSize: 11, color: "#9B9890", fontWeight: 500, marginLeft: 2 }}>BTP Integration Suite</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EnvBadge env={env} />
          <Button variant="primary" onClick={() => setShowUpload(true)}>
            <Upload size={13} /> Upload iFlow
          </Button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {/* Environment tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "1px solid #ECEAE3", paddingBottom: 0 }}>
          {ENVS.map(e => (
            <button
              key={e}
              onClick={() => handleEnv(e)}
              style={{
                fontSize: 13, padding: "7px 16px", cursor: "pointer",
                border: "1px solid transparent", borderBottom: "none",
                borderRadius: "7px 7px 0 0", fontFamily: "inherit",
                background: env === e ? "#fff" : "transparent",
                color: env === e ? "#1A1A18" : "#6B6963",
                fontWeight: env === e ? 600 : 400,
                borderColor: env === e ? "#ECEAE3" : "transparent",
                marginBottom: env === e ? -1 : 0,
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" }}>
          {STAT_CARDS.map(s => (
            <div key={s.key} style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#9B9890", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{loading ? "—" : stats[s.key]}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
          <input
            style={{ ...inputStyle, width: 210 }}
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={inputStyle} value={pkgFilter} onChange={e => setPkgFilter(e.target.value)}>
            <option value="">All packages</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="started">Started</option>
            <option value="stopped">Stopped</option>
            <option value="error">Error</option>
            <option value="not deployed">Not deployed</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9B9890" }}>
            {loading ? <Spinner size={13} /> : `${visible.length} iFlow${visible.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, overflow: "hidden" }}>
          {loading
            ? <div style={{ textAlign: "center", padding: "3rem", color: "#6B6963" }}><Spinner size={20} /></div>
            : <IFlowTable iflows={visible} onDeploy={setDeployTarget} onDelete={setDeleteTarget} />
          }
        </div>
      </main>

      {/* Modals */}
      {showUpload && (
        <UploadModal
          packages={packages}
          env={env}
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
        />
      )}
      {deployTarget && (
        <ConfirmDeployModal
          iflow={deployTarget}
          onConfirm={handleDeploy}
          onClose={() => setDeployTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          iflow={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <Toast toast={toast} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
