import { useState } from "react";
import { Modal, ModalTitle, ModalActions } from "./Modal";
import { Button, Spinner } from "./UI";
import { Play, Trash2 } from "lucide-react";

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
        Deploy <strong style={{ color: "#1A1A18" }}>{iflow.name}</strong> ({iflow.version}) to <strong style={{ color: "#1A1A18" }}>{iflow.env}</strong>?
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
      <ModalTitle>Delete iFlow?</ModalTitle>
      <p style={{ fontSize: 13, color: "#6B6963", marginBottom: "0.5rem" }}>
        Permanently remove <strong style={{ color: "#1A1A18" }}>{iflow.name}</strong> ({iflow.id}) from <strong style={{ color: "#1A1A18" }}>{iflow.env}</strong>?
      </p>
      <p style={{ fontSize: 12, color: "#791F1F" }}>This action cannot be undone.</p>
      <ModalActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={handle} disabled={loading}>
          {loading ? <><Spinner size={13} /> Deleting…</> : <><Trash2 size={13} /> Delete</>}
        </Button>
      </ModalActions>
    </Modal>
  );
}
