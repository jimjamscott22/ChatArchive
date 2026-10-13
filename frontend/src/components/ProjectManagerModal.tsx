import useActionFeedback from "./useActionFeedback";
import React, { useState } from "react";
import ModalShell from "./ModalShell";
import { API_URL, apiFetch, apiErrorMessage } from "../api";
import type { ProjectType } from "../types";

export default function ProjectManagerModal({
  projects,
  onClose,
  onProjectsUpdated,
}: {
  projects: ProjectType[];
  onClose: () => void;
  onProjectsUpdated: () => void;
}) {
  const { notify, confirmAction, feedback } = useActionFeedback();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#8B5CF6");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await apiFetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, "Failed to create project."));
      }

      await onProjectsUpdated();
      resetForm();
      setStatus("Project created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: ProjectType) => {
    const message = `Delete project "${project.name}"? Conversations will become uncategorized.`;
    if (!await confirmAction(message, "Delete project")) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, "Failed to delete project."));
      }
      await onProjectsUpdated();
      setStatus("Project deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Manage Projects" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
      {feedback}
      <form onSubmit={handleSubmit} className="tag-form">
        <h3>Create New Project</h3>
        <div className="form-group">
          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <input
            id="project-description"
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="tag-color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={saving}
              aria-label="Project color"
            />
            <span className="tag-preview" style={{ backgroundColor: color }}>
              {name.trim() || "Preview"}
            </span>
          </div>
        </div>
        <div className="tag-form-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
        {status && <div className="status-success" role="status">{status}</div>}
        {error && <div className="status-error" role="alert">{error}</div>}
      </form>

      <div className="tag-list">
        <div className="tag-list-header">Existing projects</div>
        {projects.length === 0 ? (
          <div className="empty">No projects yet. Create one above.</div>
        ) : (
          <div className="tag-list-items">
            {projects.map((project) => (
              <div key={project.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-badge" style={{ backgroundColor: project.color || "#8B5CF6", color: "white" }}>
                    {project.name}
                  </span>
                  <div className="tag-row-info">
                    <div className="tag-row-name">{project.name}</div>
                    <div className="tag-row-meta">
                      {project.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="tag-row-actions">
                  <span className="tag-count">{project.conversation_count} conv</span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(project)}
                    disabled={saving}
                    title="Delete project"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
