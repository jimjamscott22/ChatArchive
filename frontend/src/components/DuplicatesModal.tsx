import useActionFeedback from "./useActionFeedback";
import { useState, useEffect } from "react";
import ModalShell from "./ModalShell";
import SourceIcon from "./SourceIcon";
import { API_URL, apiFetch } from "../api";
import type { DuplicateGroup, DuplicatesData } from "../types";

export default function DuplicatesModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { notify, confirmAction, feedback } = useActionFeedback();
  const [duplicates, setDuplicates] = useState<DuplicatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<'source_id' | 'title' | 'both'>('source_id');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const getSourceInfo = (source: string) => {
    const sources: Record<string, { icon: string; name: string }> = {
      chatgpt: { icon: '💬', name: 'ChatGPT' },
      claude: { icon: '🤖', name: 'Claude' },
      gemini: { icon: '✨', name: 'Gemini' },
      copilot: { icon: '👨‍💻', name: 'Copilot' },
    };
    return sources[source] || { icon: '📝', name: source };
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    setSelectedForDeletion(new Set());
    loadDuplicates();
  }, [strategy]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/conversations/duplicates?strategy=${strategy}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setDuplicates(data);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      setDuplicates(null);
      setError("Couldn't load duplicate scan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpanded = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSelection = (convId: number) => {
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(convId)) {
      newSelected.delete(convId);
    } else {
      newSelected.add(convId);
    }
    setSelectedForDeletion(newSelected);
  };

  const selectAllInGroup = (group: DuplicateGroup) => {
    const newSelected = new Set(selectedForDeletion);
    group.conversations.forEach(conv => newSelected.add(conv.id));
    setSelectedForDeletion(newSelected);
  };

  const keepNewestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    const keeperId = sorted[0]?.id;
    const newSelected = new Set(selectedForDeletion);
    sorted.forEach((conv) => {
      if (conv.id === keeperId) newSelected.delete(conv.id);
      else newSelected.add(conv.id);
    });
    setSelectedForDeletion(newSelected);
  };

  const keepOldestInGroup = (group: DuplicateGroup) => {
    const sorted = [...group.conversations].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    const keeperId = sorted[0]?.id;
    const newSelected = new Set(selectedForDeletion);
    sorted.forEach((conv) => {
      if (conv.id === keeperId) newSelected.delete(conv.id);
      else newSelected.add(conv.id);
    });
    setSelectedForDeletion(newSelected);
  };

  const handleBulkDelete = async () => {
    if (deleting) return;
    if (selectedForDeletion.size === 0) {
      notify("Select the conversations to delete, then try again.", "error");
      return;
    }

    const message = `Delete ${selectedForDeletion.size} conversation(s)? This cannot be undone.`;
    if (!await confirmAction(message, "Delete selected conversations")) return;

    const deletionIds = new Set(selectedForDeletion);
    setDeleting(true);
    try {
      const response = await apiFetch(`${API_URL}/conversations/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_ids: Array.from(deletionIds)
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete conversations");
      }

      const result = await response.json();
      notify(`Deleted ${result.deleted_count} conversation(s).`);

      // Update local state instead of re-querying
      setDuplicates(prev => {
        if (!prev) return prev;
        const updatedGroups = prev.groups
          .map(group => ({
            ...group,
            conversations: group.conversations.filter(c => !deletionIds.has(c.id)),
            count: group.conversations.filter(c => !deletionIds.has(c.id)).length,
            total_messages: group.conversations
              .filter(c => !deletionIds.has(c.id))
              .reduce((sum, c) => sum + c.message_count, 0),
          }))
          .filter(group => group.conversations.length > 1);
        return {
          ...prev,
          groups: updatedGroups,
          total_groups: updatedGroups.length,
          total_duplicates: updatedGroups.reduce((sum, g) => sum + g.count, 0),
        };
      });
      setSelectedForDeletion(prev => new Set([...prev].filter(id => !deletionIds.has(id))));
      onSuccess();
    } catch (error) {
      console.error("Delete failed:", error);
      notify("Failed to delete conversations. Your selection is retained; try again.", "error", handleBulkDelete);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      title="Find Duplicate Conversations"
      onClose={onClose}
      className="duplicates-modal"
      actions={
        <>
          <button onClick={onClose}>Cancel</button>
          <button
            className="danger"
            onClick={handleBulkDelete}
            disabled={selectedForDeletion.size === 0 || deleting}
          >
            {deleting ? "Deleting..." : `Delete Selected (${selectedForDeletion.size})`}
          </button>
        </>
      }
    >
      {feedback}
      <div className="strategy-selector">
        <label>Detection Method:</label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
          <option value="source_id">By Source ID (original conversation ID)</option>
          <option value="title">By Title (exact match)</option>
          <option value="both">Both Methods (comprehensive)</option>
        </select>
      </div>

      {!loading && duplicates && (
        <div className="duplicates-summary">
          <div className="stat">
            <span className="label">Duplicate Groups:</span>
            <span className="value">{duplicates.total_groups}</span>
          </div>
          <div className="stat">
            <span className="label">Total Duplicates:</span>
            <span className="value">{duplicates.total_duplicates}</span>
          </div>
          <div className="stat">
            <span className="label">Selected for Deletion:</span>
            <span className="value">{selectedForDeletion.size}</span>
          </div>
        </div>
      )}

      <div className="duplicates-content">
        {loading ? (
          <div className="loading">Loading duplicates...</div>
        ) : error ? (
          <div className="status-error">{error}</div>
        ) : !duplicates || duplicates.groups.length === 0 ? (
          <div className="empty">
            <p>No duplicate conversations found!</p>
            <small>Try a different detection method or import more conversations.</small>
          </div>
        ) : (
          <div className="duplicate-groups">
            {duplicates.groups.map((group) => (
                <div key={group.key} className="duplicate-group">
                  <div
                    className="group-header"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedGroups.has(group.key)}
                    onClick={() => toggleGroupExpanded(group.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleGroupExpanded(group.key);
                      }
                    }}
                  >
                  <div className="group-info">
                    <h3>
                      <SourceIcon source={group.source} size={16} /> {group.title || "Untitled"}
                    </h3>
                    <div className="group-meta">
                      <span>{group.count} duplicates</span>
                      <span>•</span>
                      <span>{group.total_messages} total messages</span>
                      {group.source_id && (
                        <>
                          <span>•</span>
                          <span>ID: {group.source_id.slice(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="expand-btn">
                    {expandedGroups.has(group.key) ? "▼" : "▶"}
                  </button>
                </div>

                {expandedGroups.has(group.key) && (
                  <div className="group-content">
                    <div className="group-actions">
                      <button onClick={() => keepNewestInGroup(group)}>
                        Keep Newest
                      </button>
                      <button onClick={() => keepOldestInGroup(group)}>
                        Keep Oldest
                      </button>
                      <button onClick={() => selectAllInGroup(group)}>
                        Select All
                      </button>
                    </div>

                    <div className="conversations-list">
                      {group.conversations.map((conv) => (
                        <div key={conv.id} className="duplicate-conversation">
                          <input
                            type="checkbox"
                            checked={selectedForDeletion.has(conv.id)}
                            onChange={() => toggleSelection(conv.id)}
                          />
                          <div className="conv-info">
                            <div className="conv-title">
                              {conv.title || "Untitled"}
                            </div>
                            <div className="conv-details">
                              <span>ID: {conv.id}</span>
                              <span>•</span>
                              <span>{conv.message_count} messages</span>
                              {conv.created_at && (
                                <>
                                  <span>•</span>
                                  <span>{formatDateTime(conv.created_at)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
