import { useState } from "react";
import ModalShell from "./ModalShell";
import type { Conversation, ProjectType, ConversationDetail } from "../types";

export default function MoveToProjectModal({
  conversation,
  projects,
  onClose,
  onMove,
}: {
  conversation: ConversationDetail;
  projects: ProjectType[];
  onClose: () => void;
  onMove: (conversationId: number, projectId: number | null) => Promise<void>;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    conversation.project?.id || null
  );
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    setError(null);
    setMoving(true);
    try {
      await onMove(conversation.id, selectedProjectId);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to move conversation. Please try again.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <ModalShell
      title="Move to Project"
      onClose={onClose}
      className="move-project-modal"
      actions={
        <>
          <button onClick={onClose} disabled={moving}>
            Cancel
          </button>
          <button onClick={handleMove} disabled={moving} className="primary">
            {moving ? "Moving..." : "Move"}
          </button>
        </>
      }
    >
      <div className="move-project-summary">
        <p><strong>Conversation:</strong> {conversation.title || "Untitled"}</p>
        <p><strong>Current Project:</strong> {conversation.project?.name || "Uncategorized"}</p>
      </div>

      {error && <p className="status-error" role="alert">{error} Choose a project and use Move to try again.</p>}
      <div className="form-group">
        <label htmlFor="move-project-select"><strong>Move to:</strong></label>
        <select
          id="move-project-select"
          value={selectedProjectId !== null ? selectedProjectId.toString() : "none"}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedProjectId(val === "none" ? null : parseInt(val, 10));
          }}
        >
          <option value="none">📂 Uncategorized</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              📁 {project.name}
            </option>
          ))}
        </select>
      </div>
    </ModalShell>
  );
}
