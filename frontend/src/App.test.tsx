import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

type FetchMockOptions = {
  duplicatesError?: boolean;
};

const baseConversation = {
  id: 1,
  source: "chatgpt",
  title: "Refactor search filters",
  created_at: "2026-03-18T12:00:00Z",
  updated_at: "2026-03-18T12:30:00Z",
  message_count: 4,
  word_count: 420,
  last_message_preview: "Let us tighten the archive search flow.",
  tags: [
    {
      id: 1,
      name: "coding",
      description: "Programming work",
      color: "#3B82F6",
      created_at: "2026-03-18T12:00:00Z",
      conversation_count: 1,
    },
  ],
  project: {
    id: 1,
    name: "Archive polish",
    description: "Frontend cleanup",
    color: "#8B5CF6",
    created_at: "2026-03-18T12:00:00Z",
    conversation_count: 1,
  },
};

function jsonResponse(data: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => data,
  } as Response;
}

function installFetchMock(options: FetchMockOptions = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/settings/supabase-dashboard-url")) {
      return jsonResponse({ configured: false, dashboard_url: null });
    }

    if (url.includes("/tags")) {
      return jsonResponse({
        items: baseConversation.tags,
        total: baseConversation.tags.length,
      });
    }

    if (url.includes("/projects")) {
      return jsonResponse({
        items: [baseConversation.project],
        total: 1,
      });
    }

    if (url.includes("/conversations/duplicates")) {
      if (options.duplicatesError) {
        return jsonResponse({ detail: "scan failed" }, { ok: false, status: 500 });
      }
      return jsonResponse({
        groups: [],
        total_duplicates: 0,
        total_groups: 0,
        strategy: "source_id",
      });
    }

    if (url.includes("/conversations/search")) {
      return jsonResponse({
        items: [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (url.includes("/conversations?")) {
      return jsonResponse({
        items: [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (url.includes("/conversations/1")) {
      return jsonResponse({
        ...baseConversation,
        messages: [
          {
            id: 10,
            conversation_id: 1,
            role: "user",
            content: "How should we improve the UI?",
            content_type: "text",
            created_at: "2026-03-18T12:00:00Z",
            order_index: 0,
            source_id: "m1",
          },
        ],
      });
    }

    throw new Error(`Unhandled fetch URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App UI improvements", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("chatarchive_api_token", "test-token");
    installFetchMock();
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("open", vi.fn());
  });

  it("opens the project manager with dialog semantics", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /manage projects/i }));

    expect(await screen.findByRole("dialog", { name: /manage projects/i })).toBeInTheDocument();
  });

  it("closes the duplicates modal when Escape is pressed", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicates/i }));
    await screen.findByText(/find duplicate conversations/i);

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/find duplicate conversations/i)).not.toBeInTheDocument();
    });
  });

  it("includes tag and project filters in search requests", async () => {
    const fetchMock = installFetchMock();
    render(<App />);

    // Tag filtering is a group of toggle chips (not a <select>) — click to select.
    const tagGroup = await screen.findByRole("group", { name: /filter by tag/i });
    const codingChip = within(tagGroup).getByRole("button", { name: /coding/i });
    expect(codingChip).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(codingChip);
    expect(codingChip).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText(/filter by project/i), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/search conversations/i), {
      target: { value: "refactor" },
    });

    await waitFor(() => {
      const searchRequest = fetchMock.mock.calls
        .map(([url]) => String(url))
        .find((url) => url.includes("/conversations/search?") && url.includes("q=refactor"));

      expect(searchRequest).toBeDefined();
      // Multi-tag filtering appends a repeatable `tags` param, not singular `tag`.
      expect(searchRequest).toContain("tags=coding");
      expect(searchRequest).toContain("project_id=1");
    });
  });

  it("renders each sidebar conversation as a keyboard-focusable control", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/refactor search filters/i)).toHaveLength(2);
    });

    expect(screen.getAllByRole("button", { name: /refactor search filters/i })).toHaveLength(2);
  });

  it("shows an explicit error state when duplicate loading fails", async () => {
    installFetchMock({ duplicatesError: true });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicates/i }));

    expect(await screen.findByText(/couldn't load duplicate scan/i)).toBeInTheDocument();
    expect(screen.queryByText(/no duplicate conversations found/i)).not.toBeInTheDocument();
  });
});
