import useActionFeedback from "./useActionFeedback";
import React, { useState } from "react";
import { Tag } from "lucide-react";
import ModalShell from "./ModalShell";
import { API_URL, apiFetch, apiErrorMessage } from "../api";
import type { TagType } from "../types";

export default function TagManagerModal({
  tags,
  onClose,
  onTagsUpdated,
}: {
  tags: TagType[];
  onClose: () => void;
  onTagsUpdated: () => void;
}) {
  const { notify, confirmAction, feedback } = useActionFeedback();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#3B82F6");
    setEditingTag(null);
    setError(null);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setName(tag.name);
    setDescription(tag.description || "");
    setColor(tag.color || "#3B82F6");
    setStatus(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tag name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      color: color.trim() || null,
    };

    setSaving(true);
    try {
      const response = await apiFetch(
        editingTag ? `${API_URL}/tags/${editingTag.id}` : `${API_URL}/tags`,
        {
          method: editingTag ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, "Failed to save tag."));
      }

      await onTagsUpdated();
      resetForm();
      setStatus(editingTag ? "Tag updated." : "Tag created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: TagType) => {
    const message = `Delete tag "${tag.name}"? This will remove it from all conversations.`;
    if (!await confirmAction(message, "Delete tag")) return;

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, "Failed to delete tag."));
      }
      await onTagsUpdated();
      if (editingTag?.id === tag.id) {
        resetForm();
      }
      setStatus("Tag deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Manage Tags" onClose={onClose} className="tag-manager-modal" bodyClassName="tag-manager-content">
      {feedback}
      <form className="tag-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tag name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. research"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="tag-color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Tag color"
            />
            <span className="tag-preview" style={{ backgroundColor: color }}>
              {name.trim() || "Preview"}
            </span>
          </div>
        </div>

        <div className="tag-form-actions">
          {editingTag && (
            <button type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingTag ? "Save Tag" : "Create Tag"}
          </button>
        </div>

        {status && <div className="status-success" role="status">{status}</div>}
        {error && <div className="status-error" role="alert">{error}</div>}
      </form>

      <div className="tag-list">
        <div className="tag-list-header">Existing tags</div>
        {tags.length === 0 ? (
          <div className="empty">No tags created yet.</div>
        ) : (
          <div className="tag-list-items">
            {tags.map((tag) => (
              <div key={tag.id} className="tag-row">
                <div className="tag-row-main">
                  <span className="tag-badge" style={{ backgroundColor: tag.color || "#6B7280", color: "white" }}>
                    {tag.name}
                  </span>
                  <div className="tag-row-info">
                    <div className="tag-row-name">{tag.name}</div>
                    <div className="tag-row-meta">
                      {tag.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="tag-row-actions">
                  <span className="tag-count">{tag.conversation_count} conv</span>
                  <button type="button" onClick={() => handleEdit(tag)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(tag)} disabled={saving}>
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
