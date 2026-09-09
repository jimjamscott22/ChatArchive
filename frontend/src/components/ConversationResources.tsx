import { useEffect, useRef, useState } from "react";
import { Download, FileCode2, FileImage, FileText, Paperclip } from "lucide-react";

import { API_URL, apiFetch, apiErrorMessage } from "../api";

type ResourceAvailability = "stored" | "inline" | "metadata_only" | "unavailable";

type ResourceSummary = {
  id: number;
  kind: string;
  title?: string | null;
  filename?: string | null;
  mime_type?: string | null;
  availability: ResourceAvailability;
  byte_size?: number | null;
};

type ResourceListResponse = {
  items: ResourceSummary[];
  page: number;
  pages: number;
  total: number;
  page_size: number;
};

function ResourceIcon({ resource }: { resource: ResourceSummary }) {
  if (resource.mime_type?.startsWith("image/")) return <FileImage size={18} />;
  if (resource.kind === "artifact") return <FileCode2 size={18} />;
  if (resource.mime_type?.startsWith("text/")) return <FileText size={18} />;
  return <Paperclip size={18} />;
}

function formatBytes(size?: number | null): string | null {
  if (size == null) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConversationResources({
  conversationId,
}: {
  conversationId: number;
}) {
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<Record<number, string>>({});
  const [previewImages, setPreviewImages] = useState<Record<number, string>>({});
  const objectUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setLoading(true);
    setError(null);
    setResources([]);
    setPreviewText({});
    setPreviewImages({});

    const loadResources = async () => {
      const items: ResourceSummary[] = [];
      let page = 1;
      let pages = 1;
      do {
        const endpoint = `${API_URL}/conversations/${conversationId}/resources`;
        const response = await apiFetch(page === 1 ? endpoint : `${endpoint}?page=${page}`);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(apiErrorMessage(body, "Unable to load resources"));
        }
        const data = await response.json() as ResourceListResponse;
        if (cancelled) return;
        items.push(...data.items);
        pages = data.pages;
        page += 1;
      } while (page <= pages);
      setResources(items);
    };

    loadResources()
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load resources");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [],
  );

  const fetchContent = async (resource: ResourceSummary): Promise<Response> => {
    const response = await apiFetch(`${API_URL}/resources/${resource.id}/content`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(apiErrorMessage(body, "Unable to load resource content"));
    }
    return response;
  };

  const previewResource = async (resource: ResourceSummary) => {
    try {
      setError(null);
      const response = await fetchContent(resource);
      if (resource.mime_type?.startsWith("image/") && resource.mime_type !== "image/svg+xml") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const previous = previewImages[resource.id];
        if (previous) {
          URL.revokeObjectURL(previous);
          objectUrls.current.delete(previous);
        }
        objectUrls.current.add(url);
        setPreviewImages((current) => ({ ...current, [resource.id]: url }));
      } else {
        const text = await response.text();
        setPreviewText((current) => ({ ...current, [resource.id]: text }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to preview resource");
    }
  };

  const downloadResource = async (resource: ResourceSummary) => {
    try {
      setError(null);
      const response = await fetchContent(resource);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrls.current.add(url);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resource.filename || resource.title || `resource-${resource.id}`;
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
      }, 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to download resource");
    }
  };

  if (!loading && resources.length === 0 && !error) return null;

  return (
    <section className="conversation-resources" aria-labelledby="resources-heading">
      <div className="resource-section-heading">
        <div>
          <span className="overview-section-label">Export bundle</span>
          <h3 id="resources-heading">Artifacts &amp; files</h3>
        </div>
        {!loading && <span className="resource-count">{resources.length}</span>}
      </div>

      {loading && <p className="resource-state" aria-live="polite">Loading artifacts and files…</p>}
      {error && <p className="status-error" role="alert">{error}</p>}

      <div className="resource-list">
        {resources.map((resource) => {
          const canOpen = resource.availability === "stored" || resource.availability === "inline";
          const canPreview =
            canOpen &&
            (resource.kind === "artifact" ||
              resource.mime_type?.startsWith("text/") ||
              resource.mime_type?.startsWith("image/"));
          return (
            <article className="resource-card" key={resource.id}>
              <div className="resource-icon" aria-hidden="true">
                <ResourceIcon resource={resource} />
              </div>
              <div className="resource-copy">
                <div className="resource-title-row">
                  <strong>{resource.title || resource.filename || "Untitled resource"}</strong>
                  <span className={`resource-availability ${resource.availability}`}>
                    {resource.availability.replace("_", " ")}
                  </span>
                </div>
                <p>
                  {[resource.kind, resource.mime_type, formatBytes(resource.byte_size)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {!canOpen && (
                  <p className="resource-omission">
                    The provider export described this item but did not include usable content.
                  </p>
                )}
                {previewText[resource.id] !== undefined && (
                  <pre className="resource-text-preview">{previewText[resource.id]}</pre>
                )}
                {previewImages[resource.id] && (
                  <img
                    className="resource-image-preview"
                    src={previewImages[resource.id]}
                    alt={resource.filename || resource.title || "Imported resource"}
                  />
                )}
              </div>
              {canOpen && (
                <div className="resource-actions">
                  {canPreview && (
                    <button type="button" onClick={() => previewResource(resource)}>
                      Preview
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Download ${resource.filename || resource.title || "resource"}`}
                    onClick={() => downloadResource(resource)}
                  >
                    <Download size={15} />
                    Download
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
