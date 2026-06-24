import { StatusBadge, Button } from "./UI";
import { Play, PowerOff } from "lucide-react";

const TH = ({ children, style }) => (
  <th style={{
    textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B6963",
    padding: "8px 12px", borderBottom: "1px solid #ECEAE3",
    whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em",
    ...style,
  }}>
    {children}
  </th>
);

const TD = ({ children, style }) => (
  <td style={{ padding: "10px 12px", verticalAlign: "middle", ...style }}>
    {children}
  </td>
);

export function IFlowTable({ iflows, onDeploy, onDelete, selected, onToggle, onToggleAll }) {
  if (iflows.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6B6963", fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        No iFlows match the current filters.
      </div>
    );
  }

  const allChecked = iflows.length > 0 && iflows.every(f => selected.has(f.id));
  const someChecked = iflows.some(f => selected.has(f.id)) && !allChecked;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#FAFAF8" }}>
            <TH style={{ width: 36, paddingRight: 0 }}>
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked; }}
                onChange={() => onToggleAll(iflows)}
                style={{ cursor: "pointer", width: 14, height: 14 }}
              />
            </TH>
            <TH>Name / ID</TH>
            <TH>Package</TH>
            <TH>Version</TH>
            <TH>Status</TH>
            <TH>Deployed by</TH>
            <TH style={{ textAlign: "right" }}>Actions</TH>
          </tr>
        </thead>
        <tbody>
          {iflows.map((f, i) => {
            const isSelected = selected.has(f.id);
            const isDeployed = f.status !== "not deployed";
            return (
              <tr
                key={f.id}
                style={{
                  borderBottom: "1px solid #ECEAE3",
                  background: isSelected ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8",
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "#F5F3EE")}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? "#EFF6FF" : i % 2 === 0 ? "#fff" : "#FAFAF8"}
              >
                <TD style={{ paddingRight: 0, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(f.id)}
                    style={{ cursor: "pointer", width: 14, height: 14 }}
                  />
                </TD>
                <TD>
                  <div style={{ fontWeight: 600, color: "#1A1A18" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "#9B9890", marginTop: 1, fontFamily: "monospace" }}>{f.id}</div>
                </TD>
                <TD>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20,
                    background: "#ECEAE3", color: "#444441", fontWeight: 500,
                  }}>
                    {f.packageName}
                  </span>
                </TD>
                <TD>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6B6963" }}>{f.version}</span>
                </TD>
                <TD><StatusBadge status={f.status} /></TD>
                <TD>
                  <span style={{ fontSize: 12, color: "#6B6963" }}>{f.deployedBy}</span>
                </TD>
                <TD style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <Button
                      variant="success"
                      onClick={() => onDeploy(f)}
                      disabled={isDeployed}
                      style={{ padding: "4px 10px", height: 28, fontSize: 12 }}
                      title={isDeployed ? "iFlow is already deployed" : "Deploy iFlow to runtime"}
                    >
                      <Play size={12} /> Deploy
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => onDelete(f)}
                      disabled={!isDeployed}
                      style={{ padding: "4px 10px", height: 28, fontSize: 12 }}
                      title={!isDeployed ? "iFlow is not deployed" : "Undeploy iFlow from runtime"}
                    >
                      <PowerOff size={12} /> Undeploy
                    </Button>
                  </div>
                </TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}