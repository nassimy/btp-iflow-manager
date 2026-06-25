import { useState } from "react";
import { Modal, ModalTitle, ModalActions } from "./Modal";
import { Button, Spinner } from "./UI";
import { Play, PowerOff, RotateCcw } from "lucide-react";

// ── Single Deploy ─────────────────────────────────────────────────────────────
export function ConfirmDeployModal({ iflow, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    await onConfirm(iflow.id);
    setLoading(false);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <ModalTitle>Deploy iFlow?</ModalTitle>
      <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>
        Deploy <strong style={{ color: "#1A1A18" }}>{iflow.name}</strong> ({iflow.version}) to the runtime?
      </p>
      <p style={{ fontSize: 12, color: "#6B6963" }}>
        This will start the iFlow on the tenant. Any currently running version will be replaced.
      </p>
      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="success" onClick={handle} disabled={loading}>
          {loading ? <><Spinner size={13} /> Deploying…</> : <><Play size={13} /> Deploy</>}
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ── Single Redeploy ───────────────────────────────────────────────────────────
export function ConfirmRedeployModal({ iflow, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    await onConfirm(iflow.id);
    setLoading(false);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <ModalTitle>Redeploy iFlow?</ModalTitle>
      <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>
        Redeploy <strong style={{ color: "#1A1A18" }}>{iflow.name}</strong> ({iflow.version})?
      </p>
      <p style={{ fontSize: 12, color: "#854F0B" }}>
        The currently running instance will be stopped and restarted. There may be a brief interruption.
      </p>
      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handle} disabled={loading}>
          {loading ? <><Spinner size={13} /> Redeploying…</> : <><RotateCcw size={13} /> Redeploy</>}
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ── Single Undeploy ───────────────────────────────────────────────────────────
export function ConfirmDeleteModal({ iflow, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    await onConfirm(iflow.id);
    setLoading(false);
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <ModalTitle>Undeploy iFlow?</ModalTitle>
      <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>
        Undeploy <strong style={{ color: "#1A1A18" }}>{iflow.name}</strong> ({iflow.id}) from the runtime?
      </p>
      <p style={{ fontSize: 12, color: "#854F0B" }}>
        The iFlow will stop running but will remain in the Design workspace. You can redeploy it at any time.
      </p>
      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={handle} disabled={loading}>
          {loading ? <><Spinner size={13} /> Undeploying…</> : <><PowerOff size={13} /> Undeploy</>}
        </Button>
      </ModalActions>
    </Modal>
  );
}

// ── Bulk Action ───────────────────────────────────────────────────────────────
export function ConfirmBulkModal({ iflows, action, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  const isDeploy = action === "deploy";

  const handle = async () => {
    setLoading(true);
    let done = 0;
    for (const f of iflows) {
      await onConfirm(f.id);
      done++;
      setProgress(`${done} / ${iflows.length}`);
    }
    setLoading(false);
    onClose();
  };

  return (
    <Modal onClose={!loading ? onClose : undefined}>
      <ModalTitle>{isDeploy ? "Deploy" : "Undeploy"} {iflows.length} iFlow{iflows.length !== 1 ? "s" : ""}?</ModalTitle>

      <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.75rem" }}>
        The following iFlows will be <strong>{isDeploy ? "deployed to" : "undeployed from"}</strong> the runtime:
      </p>

      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #ECEAE3", borderRadius: 8, marginBottom: "0.75rem" }}>
        {iflows.map((f, i) => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
            borderBottom: i < iflows.length - 1 ? "1px solid #ECEAE3" : "none",
            background: i % 2 === 0 ? "#fff" : "#FAFAF8",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: isDeploy ? "#97C459" : "#F09595" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A18" }}>{f.name}</div>
              <div style={{ fontSize: 11, color: "#9B9890", fontFamily: "monospace" }}>{f.id}</div>
            </div>
          </div>
        ))}
      </div>

      {!isDeploy && (
        <p style={{ fontSize: 12, color: "#854F0B", marginBottom: "0.5rem" }}>
          These iFlows will stop running but remain in the Design workspace and can be redeployed at any time.
        </p>
      )}

      {loading && progress && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 12, color: "#6B6963", marginBottom: 4 }}>
            {isDeploy ? "Deploying" : "Undeploying"} {progress}…
          </div>
          <div style={{ height: 4, background: "#ECEAE3", borderRadius: 4 }}>
            <div style={{
              height: 4, borderRadius: 4,
              background: isDeploy ? "#97C459" : "#F09595",
              width: `${(parseInt(progress) / iflows.length) * 100}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant={isDeploy ? "success" : "danger"} onClick={handle} disabled={loading}>
          {loading
            ? <><Spinner size={13} /> {isDeploy ? "Deploying" : "Undeploying"}…</>
            : <>{isDeploy ? <Play size={13} /> : <PowerOff size={13} />} {isDeploy ? "Deploy" : "Undeploy"} All</>
          }
        </Button>
      </ModalActions>
    </Modal>
  );
}

