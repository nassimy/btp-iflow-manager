import { useState, useEffect } from "react";
import { deployIFlow, deleteIFlow } from "../api";
import { Button, Spinner, StatusBadge } from "./UI";
import { ConfirmBulkModal } from "./ConfirmModal";
import { PowerOff, Play, RotateCcw, X, AlertTriangle, Plus, Pencil, Trash2, Users } from "lucide-react";

// ── Storage helpers ────────────────────────────────────────────────────────────
const SESSION_KEY = "iflow_maintenance_session";
const GROUPS_KEY  = "iflow_maintenance_groups";

const loadSession = () => { try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(SESSION_KEY);
const loadGroups  = () => { try { const r = localStorage.getItem(GROUPS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveGroups  = (g) => localStorage.setItem(GROUPS_KEY, JSON.stringify(g));

const uid = () => `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Shared table helpers ───────────────────────────────────────────────────────
const thStyle = (extra = {}) => ({
  textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B6963",
  padding: "8px 12px", borderBottom: "1px solid #ECEAE3",
  whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em", ...extra,
});
const tdStyle = (extra = {}) => ({ padding: "10px 12px", verticalAlign: "middle", ...extra });

// ── Group Editor Modal ─────────────────────────────────────────────────────────
function GroupEditorModal({ group, iflows, onSave, onClose }) {
  const [name, setName]         = useState(group?.name || "");
  const [selected, setSelected] = useState(new Set(group?.iflowIds || []));
  const [search, setSearch]     = useState("");

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filtered = iflows.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.id.toLowerCase().includes(search.toLowerCase())
  );

  const allChecked  = filtered.length > 0 && filtered.every(f => selected.has(f.id));
  const someChecked = filtered.some(f => selected.has(f.id)) && !allChecked;

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach(f => next.delete(f.id));
      else filtered.forEach(f => next.add(f.id));
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ id: group?.id || uid(), name: name.trim(), iflowIds: [...selected] });
    onClose();
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", width: 560, maxWidth: "94vw", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: "1.25rem", color: "#1A1A18" }}>
          {group ? "Edit Group" : "New Group"}
        </h2>

        {/* Group name */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 12, color: "#6B6963", fontWeight: 500, display: "block", marginBottom: 4 }}>Group Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Finance, Sales…"
            style={{ width: "100%", fontSize: 13, padding: "6px 10px", borderRadius: 7, border: "1px solid #D8D6CF", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {/* Search */}
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search iFlows…"
            style={{ width: "100%", fontSize: 13, padding: "6px 10px", borderRadius: 7, border: "1px solid #D8D6CF", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ fontSize: 12, color: "#9B9890", marginBottom: "0.5rem" }}>
          {selected.size} iFlow{selected.size !== 1 ? "s" : ""} selected
        </div>

        {/* iFlow list */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #ECEAE3", borderRadius: 8, marginBottom: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FAFAF8" }}>
                <th style={thStyle({ width: 36 })}>
                  <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} style={{ cursor: "pointer" }} />
                </th>
                <th style={thStyle()}>Name / ID</th>
                <th style={thStyle()}>Package</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={f.id} onClick={() => toggle(f.id)} style={{ cursor: "pointer", borderBottom: "1px solid #ECEAE3", background: selected.has(f.id) ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8" }}
                  onMouseEnter={e => !selected.has(f.id) && (e.currentTarget.style.background = "#F5F3EE")}
                  onMouseLeave={e => e.currentTarget.style.background = selected.has(f.id) ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8"}
                >
                  <td style={tdStyle({ width: 36 })}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={tdStyle()}>
                    <div style={{ fontWeight: 600, color: "#1A1A18" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace" }}>{f.id}</div>
                  </td>
                  <td style={tdStyle()}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#ECEAE3", color: "#444441", fontWeight: 500 }}>{f.packageName}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "#9B9890", fontSize: 13 }}>No iFlows match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!name.trim() || selected.size === 0}>
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Group Card ─────────────────────────────────────────────────────────────────
function GroupCard({ group, iflows, onEdit, onDelete, onAction }) {
  const groupIFlows   = iflows.filter(f => group.iflowIds.includes(f.id));
  const deployed      = groupIFlows.filter(f => f.status !== "not deployed");
  const notDeployed   = groupIFlows.filter(f => f.status === "not deployed");
  const missing       = group.iflowIds.length - groupIFlows.length; // iflows not in current list

  const EMOJI = ["💼", "📦", "🏭", "🔗", "📊", "🛠️", "🌐", "🔒"];
  const emoji = EMOJI[Math.abs(group.name.charCodeAt(0)) % EMOJI.length];

  return (
    <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, padding: "1rem 1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A18" }}>{group.name}</div>
            <div style={{ fontSize: 12, color: "#9B9890" }}>{group.iflowIds.length} iFlow{group.iflowIds.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button style={{ height: 26, padding: "2px 8px", fontSize: 11 }} onClick={() => onEdit(group)}>
            <Pencil size={11} /> Edit
          </Button>
          <Button variant="danger" style={{ height: 26, padding: "2px 8px", fontSize: 11 }} onClick={() => onDelete(group.id)}>
            <Trash2 size={11} />
          </Button>
        </div>
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#EAF3DE", color: "#27500A", fontWeight: 600 }}>
          ● {deployed.length} deployed
        </span>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#FAEEDA", color: "#633806", fontWeight: 600 }}>
          ○ {notDeployed.length} not deployed
        </span>
        {missing > 0 && (
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#FCEBEB", color: "#791F1F", fontWeight: 600 }}>
            ⚠ {missing} not found
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="danger"
          style={{ flex: 1, justifyContent: "center", height: 30, fontSize: 12 }}
          disabled={deployed.length === 0}
          title={deployed.length === 0 ? "No iFlows are deployed" : `Undeploy ${deployed.length} iFlow${deployed.length !== 1 ? "s" : ""}`}
          onClick={() => onAction({ action: "undeploy", iflows: deployed, groupName: group.name })}
        >
          <PowerOff size={12} /> Undeploy {deployed.length > 0 ? deployed.length : ""}
        </Button>
        <Button
          variant="success"
          style={{ flex: 1, justifyContent: "center", height: 30, fontSize: 12 }}
          disabled={notDeployed.length === 0}
          title={notDeployed.length === 0 ? "All iFlows are already deployed" : `Restore ${notDeployed.length} iFlow${notDeployed.length !== 1 ? "s" : ""}`}
          onClick={() => onAction({ action: "deploy", iflows: notDeployed, groupName: group.name })}
        >
          <Play size={12} /> Restore {notDeployed.length > 0 ? notDeployed.length : ""}
        </Button>
      </div>
    </div>
  );
}

// ── Custom session (ad-hoc) ────────────────────────────────────────────────────
function CustomTab({ iflows, session, setSession }) {
  const [selected, setSelected] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [showCancel, setShowCancel] = useState(false);

  const deployedIFlows = iflows.filter(f => f.status !== "not deployed");
  const allChecked  = deployedIFlows.length > 0 && deployedIFlows.every(f => selected.has(f.id));
  const someChecked = deployedIFlows.some(f => selected.has(f.id)) && !allChecked;

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allChecked) deployedIFlows.forEach(f => next.delete(f.id));
      else deployedIFlows.forEach(f => next.add(f.id));
      return next;
    });
  };
  const toggle = (id) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleExclude = (id) => setExcluded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const selectedIFlows = iflows.filter(f => selected.has(f.id));
  const restoreIFlows  = session?.iflows.filter(f => !excluded.has(f.id)) || [];

  const elapsed = session ? (() => {
    const ms = Date.now() - new Date(session.startedAt).getTime();
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })() : null;

  const formatTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      {session ? (
        <>
          {/* Active session banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FAEEDA", border: "1px solid #E8C97A", borderRadius: 10, padding: "12px 16px", marginBottom: "1.5rem" }}>
            <AlertTriangle size={18} color="#854F0B" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#633806" }}>🔧 Custom maintenance active</div>
              <div style={{ fontSize: 12, color: "#854F0B", marginTop: 2 }}>
                Started {formatTime(session.startedAt)} · {elapsed} ago · {session.iflows.length} iFlow{session.iflows.length !== 1 ? "s" : ""} undeployed
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="success" onClick={() => setBulkAction({ action: "deploy", iflows: restoreIFlows })} disabled={restoreIFlows.length === 0}>
                <RotateCcw size={13} /> Restore {restoreIFlows.length > 0 ? restoreIFlows.length : ""}
              </Button>
              <Button variant="danger" onClick={() => setShowCancel(true)}><X size={13} /> Cancel Session</Button>
            </div>
          </div>

          {/* Snapshot table */}
          <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #ECEAE3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A18" }}>Undeployed iFlows</div>
                <div style={{ fontSize: 12, color: "#6B6963", marginTop: 2 }}>Uncheck any iFlows you want to leave undeployed when restoring.</div>
              </div>
              <span style={{ fontSize: 12, color: "#9B9890" }}>{restoreIFlows.length} / {session.iflows.length} will be restored</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#FAFAF8" }}>
                <th style={thStyle({ width: 36 })}>Restore</th>
                <th style={thStyle()}>Name / ID</th>
                <th style={thStyle()}>Package</th>
                <th style={thStyle()}>Version</th>
              </tr></thead>
              <tbody>
                {session.iflows.map((f, i) => {
                  const will = !excluded.has(f.id);
                  return (
                    <tr key={f.id} style={{ borderBottom: "1px solid #ECEAE3", background: will ? (i % 2 === 0 ? "#fff" : "#FAFAF8") : "#F9F8F6", opacity: will ? 1 : 0.5 }}>
                      <td style={tdStyle({ width: 36 })}><input type="checkbox" checked={will} onChange={() => toggleExclude(f.id)} style={{ cursor: "pointer" }} /></td>
                      <td style={tdStyle()}><div style={{ fontWeight: 600, color: "#1A1A18" }}>{f.name}</div><div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace" }}>{f.id}</div></td>
                      <td style={tdStyle()}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#ECEAE3", color: "#444441", fontWeight: 500 }}>{f.packageName}</span></td>
                      <td style={tdStyle()}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6B6963" }}>{f.version}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Selection bar */}
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E6F1FB", border: "1px solid #85B7EB", borderRadius: 8, padding: "8px 14px", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: 13, color: "#0C447C", fontWeight: 600 }}>{selected.size} iFlow{selected.size !== 1 ? "s" : ""} selected</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Button variant="danger" style={{ height: 28, padding: "4px 12px", fontSize: 12 }} onClick={() => setBulkAction({ action: "undeploy", iflows: selectedIFlows })}>
                  <PowerOff size={12} /> Start Maintenance
                </Button>
                <Button style={{ height: 28, padding: "4px 10px", fontSize: 12 }} onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
          )}

          {/* Deployed iFlows table */}
          <div style={{ background: "#fff", border: "1px solid #ECEAE3", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #ECEAE3" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A18" }}>Deployed iFlows</div>
              <div style={{ fontSize: 12, color: "#6B6963", marginTop: 2 }}>Only currently deployed iFlows are shown.</div>
            </div>
            {deployedIFlows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#6B6963", fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>No deployed iFlows found.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#FAFAF8" }}>
                  <th style={thStyle({ width: 36 })}><input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} style={{ cursor: "pointer" }} /></th>
                  <th style={thStyle()}>Name / ID</th>
                  <th style={thStyle()}>Package</th>
                  <th style={thStyle()}>Status</th>
                  <th style={thStyle()}>Deployed by</th>
                </tr></thead>
                <tbody>
                  {deployedIFlows.map((f, i) => {
                    const isSel = selected.has(f.id);
                    return (
                      <tr key={f.id} onClick={() => toggle(f.id)} style={{ borderBottom: "1px solid #ECEAE3", cursor: "pointer", background: isSel ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8" }}
                        onMouseEnter={e => !isSel && (e.currentTarget.style.background = "#F5F3EE")}
                        onMouseLeave={e => e.currentTarget.style.background = isSel ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8"}
                      >
                        <td style={tdStyle({ width: 36 })}><input type="checkbox" checked={isSel} onChange={() => toggle(f.id)} onClick={e => e.stopPropagation()} style={{ cursor: "pointer" }} /></td>
                        <td style={tdStyle()}><div style={{ fontWeight: 600, color: "#1A1A18" }}>{f.name}</div><div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace" }}>{f.id}</div></td>
                        <td style={tdStyle()}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#ECEAE3", color: "#444441", fontWeight: 500 }}>{f.packageName}</span></td>
                        <td style={tdStyle()}><StatusBadge status={f.status} /></td>
                        <td style={tdStyle()}><span style={{ fontSize: 12, color: "#6B6963" }}>{f.deployedBy}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Bulk modal */}
      {bulkAction && (
        <ConfirmBulkModal
          iflows={bulkAction.iflows}
          action={bulkAction.action}
          onConfirm={async (id) => { if (bulkAction.action === "undeploy") await deleteIFlow(id); else await deployIFlow(id); }}
          onClose={() => {
            if (bulkAction.action === "undeploy") {
              const snap = { startedAt: new Date().toISOString(), iflows: bulkAction.iflows };
              setSession(snap); saveSession(snap);
              setSelected(new Set());
            } else {
              setSession(null); clearSession(); setExcluded(new Set());
            }
            setBulkAction(null);
          }}
        />
      )}

      {/* Cancel confirm */}
      {showCancel && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowCancel(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", width: 400, maxWidth: "94vw", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: "1rem", color: "#1A1A18" }}>Cancel Session?</h2>
            <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>The snapshot of {session?.iflows.length} iFlow{session?.iflows.length !== 1 ? "s" : ""} will be discarded.</p>
            <p style={{ fontSize: 12, color: "#791F1F" }}>iFlows will remain undeployed — redeploy them manually from the Dashboard.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <Button onClick={() => setShowCancel(false)}>Keep Session</Button>
              <Button variant="danger" onClick={() => { setSession(null); clearSession(); setShowCancel(false); setExcluded(new Set()); }}>Discard Snapshot</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Maintenance Tab ───────────────────────────────────────────────────────
export function MaintenanceTab({ iflows }) {
  const [subTab, setSubTab]       = useState("groups");
  const [groups, setGroups]       = useState(() => loadGroups());
  const [session, setSession]     = useState(() => loadSession());
  const [editingGroup, setEditing] = useState(null);  // null | "new" | group object
  const [deleteGroupId, setDeleteGroupId] = useState(null);
  const [groupBulk, setGroupBulk] = useState(null);

  // Persist groups
  useEffect(() => { saveGroups(groups); }, [groups]);

  const handleSaveGroup = (g) => {
    setGroups(prev => prev.some(x => x.id === g.id) ? prev.map(x => x.id === g.id ? g : x) : [...prev, g]);
    setEditing(null);
  };

  const handleDeleteGroup = (id) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setDeleteGroupId(null);
  };

  const groupToDelete = groups.find(g => g.id === deleteGroupId);

  const SUB_TABS = [
    { id: "groups", label: "Groups" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

      {/* Sub-tab header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A18", marginBottom: 2 }}>🔧 Maintenance Mode</h2>
          <p style={{ fontSize: 13, color: "#6B6963" }}>Undeploy iFlows for maintenance and restore them when done.</p>
        </div>
        {subTab === "groups" && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={13} /> New Group
          </Button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #ECEAE3", marginBottom: "1.25rem" }}>
        {SUB_TABS.map(({ id, label }) => {
          const isActive = subTab === id;
          const showDot  = id === "custom" && !!session;
          return (
            <button key={id} onClick={() => setSubTab(id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "0 4px", height: 38, fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? "#1A1A18" : "#6B6963", background: "none", border: "none",
              borderBottom: isActive ? "2px solid #1A1A18" : "2px solid transparent",
              cursor: "pointer", fontFamily: "inherit", marginRight: 20, position: "relative",
            }}>
              {label}
              {showDot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8A600", position: "absolute", top: 6, right: -4 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Groups sub-tab ── */}
      {subTab === "groups" && (
        <>
          {groups.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#6B6963" }}>
              <Users size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No groups yet</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Create a group to quickly undeploy and restore a set of iFlows.</div>
              <Button variant="primary" onClick={() => setEditing("new")}><Plus size={13} /> New Group</Button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {groups.map(g => (
                <GroupCard
                  key={g.id}
                  group={g}
                  iflows={iflows}
                  onEdit={setEditing}
                  onDelete={setDeleteGroupId}
                  onAction={setGroupBulk}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Custom sub-tab ── */}
      {subTab === "custom" && (
        <CustomTab iflows={iflows} session={session} setSession={setSession} />
      )}

      {/* ── Group editor modal ── */}
      {editingGroup && (
        <GroupEditorModal
          group={editingGroup === "new" ? null : editingGroup}
          iflows={iflows}
          onSave={handleSaveGroup}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── Delete group confirm ── */}
      {deleteGroupId && (
        <div onClick={e => { if (e.target === e.currentTarget) setDeleteGroupId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", width: 400, maxWidth: "94vw", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: "1rem", color: "#1A1A18" }}>Delete Group?</h2>
            <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>
              Delete <strong style={{ color: "#1A1A18" }}>{groupToDelete?.name}</strong>? This only removes the group definition — your iFlows are not affected.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <Button onClick={() => setDeleteGroupId(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDeleteGroup(deleteGroupId)}>Delete Group</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group bulk action modal ── */}
      {groupBulk && (
        <ConfirmBulkModal
          iflows={groupBulk.iflows}
          action={groupBulk.action}
          onConfirm={async (id) => { if (groupBulk.action === "undeploy") await deleteIFlow(id); else await deployIFlow(id); }}
          onClose={() => setGroupBulk(null)}
        />
      )}
    </div>
  );
}