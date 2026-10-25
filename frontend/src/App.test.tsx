import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

type FetchMockOptions = {
  action?: (url: string, init?: RequestInit) => Promise<Response> | undefined;
  search?: (query: string) => Promise<Response>;
  list?: () => Promise<Response>;
  duplicatesError?: boolean;
  detail?: (id: number) => Promise<Response>;
  twoConversations?: boolean;
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
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const action = options.action?.(url, init);
    if (action) return action;

    if (url.includes("/settings/import")) {
      return jsonResponse({
        id: 1,
        allowed_formats: "json",
        default_format: "json",
        auto_merge_duplicates: false,
        keep_separate: true,
        skip_empty_conversations: true,
        updated_at: "2026-03-18T12:00:00Z",
      });
    }

    if (url.includes("/import/history")) {
      return jsonResponse({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      });
    }

    if (url.includes("/stats")) {
      return jsonResponse({
        total_conversations: 1123,
        total_messages: 9000,
        sources: { chatgpt: 1056, claude: 67 },
        date_range: { oldest: "2024-01-05T00:00:00Z", newest: new Date().toISOString() },
      });
    }

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
      if (options.search) return options.search(new URL(url).searchParams.get("q") || "");
      return jsonResponse({
        items: options.twoConversations ? [baseConversation, { ...baseConversation, id: 2, title: "Second thread" }] : [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (url.includes("/conversations?")) {
      if (options.list) return options.list();
      return jsonResponse({
        items: options.twoConversations ? [baseConversation, { ...baseConversation, id: 2, title: "Second thread" }] : [baseConversation],
        total: 1,
        page: 1,
        page_size: 100,
        pages: 1,
      });
    }

    if (/\/conversations\/\d+\/resources/.test(url)) {
      return jsonResponse({
        items: [],
        total: 0,
        page: 1,
        page_size: 50,
        pages: 0,
      });
    }

    if (url.includes("/import/chatgpt/bundle")) {
      return jsonResponse({
        import_history_id: 7,
        status: "partial",
        conversations: { imported: 2, updated: 0, skipped: 0 },
        projects: { created: 1, matched: 0 },
        resources: { stored: 1, inline: 1, metadata_only: 1, unavailable: 1 },
        warnings: [
          {
            code: "RESOURCE_BYTES_MISSING",
            message: "The provider export omitted one file.",
          },
        ],
      });
    }

    if (url.includes("/import/chatgpt")) {
      return jsonResponse([{ ...baseConversation, id: 2 }]);
    }

    const detailId = url.match(/\/conversations\/(\d+)$/);
    if (detailId && options.detail) return options.detail(Number(detailId[1]));

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
    
    // Polyfill HTMLDialogElement for jsdom
    HTMLDialogElement.prototype.showModal = vi.fn(function mock(this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function mock(this: HTMLDialogElement) {
      this.open = false;
    });

    window.history.replaceState(null, "", "/");
    localStorage.setItem("chatarchive_api_token", "test-token");
    localStorage.removeItem("chatarchive-theme");
    installFetchMock();
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("open", vi.fn());
  });

  it("cancels conversation deletion and keeps failures recoverable", async () => {
    let deletes = 0;
    installFetchMock({ action: (_url, init) => init?.method === "DELETE"
      ? Promise.resolve(jsonResponse({}, { ok: ++deletes > 1, status: deletes > 1 ? 200 : 500 })) : undefined });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    fireEvent.click(screen.getByTitle("Delete conversation"));
    let dialog = screen.getByRole("dialog", { name: "Delete conversation" });
    expect(dialog).toHaveTextContent('Delete "Refactor search filters" and all its messages?');
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(deletes).toBe(0);
    fireEvent.click(screen.getByTitle("Delete conversation"));
    dialog = screen.getByRole("dialog", { name: "Delete conversation" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete conversation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to delete conversation");
    expect(screen.getByTitle("Delete conversation")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(deletes).toBe(1);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Delete conversation" })).getByRole("button", { name: "Delete conversation" }));
    await screen.findByText('Deleted "Refactor search filters".');
    expect(deletes).toBe(2);
    expect(alert).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("offers non-blocking auto-tag failure, retry, success, and dismissal", async () => {
    let attempts = 0;
    installFetchMock({ action: url => url.includes("/auto-tag")
      ? Promise.resolve(jsonResponse({ tagged_count: 3 }, { ok: ++attempts > 1 })) : undefined });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /auto-tag all/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to auto-tag");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Tagged 3 conversations.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Tagged 3 conversations.")).not.toBeInTheDocument();
    expect(alert).not.toHaveBeenCalled();
  });

  it("keeps a failed project move open with its selection and allows retry", async () => {
    let attempts = 0;
    installFetchMock({ action: url => url.endsWith("/move")
      ? Promise.resolve(jsonResponse({}, { ok: ++attempts > 1 })) : undefined });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    fireEvent.click(screen.getByTitle("More options"));
    fireEvent.click(screen.getByRole("button", { name: /move to project/i }));
    const select = await screen.findByLabelText("Move to:");
    fireEvent.change(select, { target: { value: "none" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to move conversation");
    expect(select).toHaveValue("none");
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await screen.findByText("Conversation moved to Uncategorized.");
    expect(screen.queryByRole("dialog", { name: "Move to Project" })).not.toBeInTheDocument();
    expect(alert).not.toHaveBeenCalled();
  });

  it("confirms tag removal within the app", async () => {
    let removals = 0;
    installFetchMock({ action: (url, init) => url.endsWith("/tags/1") && init?.method === "DELETE"
      ? Promise.resolve((removals++, jsonResponse({}))) : undefined });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove tag coding" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Remove tag" })).getByRole("button", { name: "Remove tag" }));
    await screen.findByText("Tag removed from conversation.");
    expect(removals).toBe(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["success", "empty", "failure"])("retains mounted rows during a search refresh ending in %s", async (outcome) => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    installFetchMock({ search: () => pending });
    render(<App />);
    const row = await screen.findByRole("button", { name: "Refactor search filters" });
    fireEvent.change(screen.getByLabelText(/search conversations/i), { target: { value: "new" } });
    await screen.findByText("Updating results…");
    const list = screen.getByLabelText("Conversation list in sidebar");
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(row.isConnected).toBe(true);
    expect(document.querySelector(".skeleton-container")).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=new"), expect.anything()));
    await act(async () => finish(outcome === "failure"
      ? jsonResponse({}, { ok: false, status: 500 })
      : jsonResponse({ items: outcome === "empty" ? [] : [{ ...baseConversation, title: "New result" }], total: 1, pages: 1 })));
    expect(list).toHaveAttribute("aria-busy", "false");
    if (outcome === "failure") {
      expect(row.isConnected).toBe(true);
      expect(screen.getByRole("alert")).toHaveTextContent("Previous results are still shown");
      expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    } else {
      expect(screen.queryByText("Updating results…")).not.toBeInTheDocument();
      if (outcome === "success") await screen.findByRole("button", { name: "New result" });
      else expect(screen.queryByRole("button", { name: "Refactor search filters" })).not.toBeInTheDocument();
    }
  });

  it("ignores search responses during the next query's debounce window", async () => {
    let finish!: (response: Response) => void;
    installFetchMock({ search: query => query === "old"
      ? new Promise(resolve => { finish = resolve; })
      : Promise.resolve(jsonResponse({ items: [{ ...baseConversation, title: "Latest result" }], pages: 1, total: 1 })) });
    render(<App />);
    await screen.findByRole("button", { name: "Refactor search filters" });
    const input = screen.getByLabelText(/search conversations/i);
    fireEvent.change(input, { target: { value: "old" } });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(input, { target: { value: "latest" } });
    await act(async () => finish(jsonResponse({ items: [{ ...baseConversation, title: "Stale result" }], pages: 1 })));
    expect(screen.queryByRole("button", { name: "Stale result" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Latest result" });
  });

  it("cancels the pending search debounce when filters are cleared", async () => {
    const fetchMock = installFetchMock();
    render(<App />);
    await screen.findByRole("button", { name: "Refactor search filters" });
    fireEvent.change(screen.getByLabelText(/search conversations/i), { target: { value: "old" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("q=old"))).toBe(false);
    expect(screen.getByLabelText(/search conversations/i)).toHaveValue("");
  });

  it("uses skeletons only before the first successful list response", async () => {
    let finish!: (response: Response) => void;
    installFetchMock({ list: () => new Promise(resolve => { finish = resolve; }) });
    render(<App />);
    expect(document.querySelector(".skeleton-container")).not.toBeNull();
    expect(screen.queryByText("Updating results…")).not.toBeInTheDocument();
    await act(async () => finish(jsonResponse({ items: [], pages: 0, total: 0 })));
    fireEvent.change(screen.getByLabelText(/search conversations/i), { target: { value: "query" } });
    expect(document.querySelector(".skeleton-container")).toBeNull();
    expect(screen.getByText("Updating results…")).toBeVisible();
  });

  it.each(["success", "failure"])("ignores a stale detail %s after switching threads", async (outcome) => {
    let finishFirst!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { finishFirst = resolve; });
    installFetchMock({ twoConversations: true, detail: async (id) => id === 1 ? first : jsonResponse({ ...baseConversation, id: 2, title: "Second thread", messages: [] }) });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading conversation");
    fireEvent.click(screen.getByRole("button", { name: "Second thread" }));
    await within(screen.getByRole("main")).findByRole("heading", { name: "Second thread" });
    await act(async () => { finishFirst(outcome === "success" ? jsonResponse({ ...baseConversation, messages: [] }) : jsonResponse({}, { ok: false, status: 404 })); });
    expect(within(screen.getByRole("main")).getByRole("heading", { name: "Second thread" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second thread" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a detail error and retries the selected conversation", async () => {
    let attempts = 0;
    installFetchMock({ detail: async () => {
      if (++attempts === 1) throw new Error("offline");
      return jsonResponse({ ...baseConversation, messages: [] });
    } });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load conversation");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    expect(attempts).toBe(2);
  });

  it("does not reopen a pending conversation after returning home", async () => {
    let finish!: (response: Response) => void;
    installFetchMock({ detail: () => new Promise<Response>((resolve) => { finish = resolve; }) });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    await act(async () => { finish(jsonResponse({ ...baseConversation, messages: [] })); });
    expect(document.querySelector(".conversation-view")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading conversation...")).not.toBeInTheDocument();
  });

  it.each(["missing", "malformed"])("offers Retry for a %s detail response", async (kind) => {
    installFetchMock({ detail: async () => kind === "missing"
      ? jsonResponse({}, { ok: false, status: 404 })
      : jsonResponse({ ...baseConversation, messages: null }) });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(kind === "missing" ? "Conversation not found" : "Conversation could not be loaded");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(document.querySelector(".conversation-view")).not.toBeInTheDocument();
  });

  it("allows standalone conversation loading to recover with Retry", async () => {
    window.history.replaceState({}, "", "?conversation=1");
    let attempts = 0;
    installFetchMock({ detail: async () => ++attempts === 1
      ? jsonResponse({}, { ok: false, status: 500 })
      : jsonResponse({ ...baseConversation, messages: [] }) });
    try {
      render(<App />);
      await screen.findByRole("alert");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await screen.findByRole("heading", { name: "Refactor search filters" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it.each([false, true])("renders the ordered Markdown reader in standalone=%s mode", async (standalone) => {
    if (standalone) window.history.replaceState({}, "", "?conversation=1");
    installFetchMock({ detail: async () => jsonResponse({ ...baseConversation, messages: [
      { id: 2, role: "assistant", content: "## Shared reader\n\n```typescript\nconst answer = 42;\n```", order_index: 1 },
      { id: 1, role: "user", content: "Earlier question", order_index: 0 },
    ] }) });
    try {
      render(<App />);
      if (!standalone) fireEvent.click(await screen.findByRole("button", { name: "Refactor search filters" }));
      await screen.findByRole("heading", { name: "Shared reader" });
      const rows = document.querySelectorAll(".conversation-view .message");
      expect(rows[0]).toHaveTextContent("Earlier question");
      expect(rows[1]).toHaveTextContent("Shared reader");
      expect(rows[1].querySelector("code .hljs-keyword")).toHaveTextContent("const");
    } finally {
      window.history.replaceState({}, "", "/");
    }
  });

  it("scopes conversation arrows to focused list rows", async () => {
    const fetchMock = installFetchMock({ twoConversations: true, detail: async (id) => jsonResponse({ ...baseConversation, id, title: id === 1 ? baseConversation.title : "Second thread", messages: [] }) });
    render(<App />);
    const first = await screen.findByRole("button", { name: "Refactor search filters" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = screen.getByRole("button", { name: "Second thread" });
    expect(second).toHaveFocus();
    await within(screen.getByRole("main")).findByRole("heading", { name: "Second thread" });
    const count = fetchMock.mock.calls.length;
    fireEvent.keyDown(screen.getByRole("main"), { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(fetchMock.mock.calls.length).toBe(count);
    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(first).toHaveFocus();
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
  });

  it("focuses and navigates theme options without opening conversations", async () => {
    const fetchMock = installFetchMock();
    render(<App />);
    await screen.findByRole("button", { name: "Refactor search filters" });
    const trigger = screen.getByRole("button", { name: /choose theme/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "Modernist" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("menuitemradio", { name: "Forest" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "Modernist" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/conversations/1"))).toBe(false);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Forest" }));
    expect(trigger).toHaveFocus();
    expect(localStorage.getItem("chatarchive-theme")).toBe("forest");
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "Forest" })).toHaveFocus();
    fireEvent.click(screen.getByTestId("theme-palette-backdrop"));
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the project manager with dialog semantics", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /manage projects/i }));

    await screen.findByRole("heading", { name: "Create New Project" });
    expect(screen.getByRole("dialog", { name: /manage projects/i })).toBeInTheDocument();
  });

  it("closes the duplicates modal when Escape is pressed", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicates/i }));
    await screen.findByText(/find duplicate conversations/i);

    fireEvent(screen.getByRole("dialog", { name: "Find Duplicate Conversations" }), new Event("cancel", { cancelable: true }));

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

    it("applies and persists a selected theme while announcing the current choice", async () => {
    render(<App />);

    const paletteButton = await screen.findByRole("button", { name: /choose theme/i });
    expect(paletteButton).toHaveAccessibleName(/current: modernist/i);

    fireEvent.click(paletteButton);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Ocean" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "ocean");
    expect(localStorage.getItem("chatarchive-theme")).toBe("ocean");
    expect(paletteButton).toHaveAccessibleName(/current: ocean/i);
  });

  it("toggles from a palette theme to light without treating it as dark", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /choose theme/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("chatarchive-theme")).toBe("light");
  });

  it("makes auto-merge and keep-separate mutually exclusive in import settings", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    await screen.findByText(/only json imports are supported/i);
    const dialog = screen.getByRole("dialog", { name: /import & export settings/i });

    expect(within(dialog).getByText(/only json imports are supported/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "CSV" })).not.toBeInTheDocument();

    const autoMerge = within(dialog).getByRole("checkbox", {
      name: /auto-merge duplicate conversations/i,
    });
    const keepSeparate = within(dialog).getByRole("checkbox", {
      name: /keep imported data separate/i,
    });

    expect(autoMerge).not.toBeChecked();
    expect(keepSeparate).toBeChecked();

    fireEvent.click(autoMerge);
    expect(autoMerge).toBeChecked();
    expect(keepSeparate).not.toBeChecked();

    fireEvent.click(keepSeparate);
    expect(keepSeparate).toBeChecked();
    expect(autoMerge).not.toBeChecked();
  });

  it("routes ChatGPT ZIP files to bundle import and keeps the summary visible", async () => {
    const fetchMock = installFetchMock();
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: /import conversations/i }))[0]);
    await screen.findByLabelText(/select file/i);
    const dialog = screen.getByRole("dialog", { name: /import conversations/i });
    const fileInput = within(dialog).getByLabelText(/select file/i);
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["zip"], "export.zip", { type: "application/zip" })],
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /import from chatgpt/i }));

    expect(await within(dialog).findByText(/bundle imported with some unavailable resources/i)).toBeInTheDocument();
    expect(within(dialog).getByText("conversations added").parentElement).toHaveTextContent(
      "2conversations added",
    );
    expect(within(dialog).getByText(/provider export omitted one file/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/import/chatgpt/bundle")),
    ).toBe(true);
    expect(within(dialog).getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("shows conversations by month on the Timeline and returns there from the reader", async () => {
    const now = new Date();
    const thisMonth = { ...baseConversation, id: 1, source: "claude", message_count: 2, created_at: now.toISOString() };
    const fetchMock = installFetchMock({
      list: async () => jsonResponse({ items: [thisMonth], total: 1, page: 1, page_size: 100, pages: 1 }),
    });
    render(<App />);
    await screen.findAllByRole("button", { name: /refactor search filters/i });

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
    expect(await within(timeline).findByText("1,123")).toBeInTheDocument();
    expect(within(timeline).getByText("1,056")).toBeInTheDocument();

    const monthName = now.toLocaleDateString("en-US", { month: "long" });
    const currentHead = within(timeline).getByRole("heading", { name: new RegExp(monthName) }).parentElement!;
    expect(currentHead).toHaveClass("current");
    const row = await within(timeline).findByRole("button", { name: /refactor search filters/i });
    expect(row).toHaveTextContent(/claude · 2 msgs/i);
    expect(within(timeline).getByRole("button", { name: "Later month" })).toBeDisabled();
    expect(within(timeline).getAllByText("No conversations").length).toBeGreaterThan(0);

    const timelineRequest = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes("date_from") && url.includes("sort_by=created_at"));
    expect(timelineRequest).toBeDefined();

    fireEvent.click(row);
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    fireEvent.click(screen.getByRole("button", { name: "Back to Timeline" }));
    expect(await screen.findByRole("region", { name: "Timeline" })).toBeInTheDocument();
  });

  it("removes a shared tag filter from the Timeline chips", async () => {
    installFetchMock();
    render(<App />);
    const tagGroup = await screen.findByRole("group", { name: /filter by tag/i });
    fireEvent.click(within(tagGroup).getByRole("button", { name: /coding/i }));

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(within(timeline).getByText(/tagged coding/i)).toBeInTheDocument();
    fireEvent.click(within(timeline).getByRole("button", { name: "Remove tag filter coding" }));
    expect(within(timeline).queryByText(/tagged coding/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const libraryTags = await screen.findByRole("group", { name: /filter by tag/i });
    expect(within(libraryTags).getByRole("button", { name: /coding/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the URL hash in sync with the screen and responds to Back and deep links", async () => {
    render(<App />);
    await screen.findAllByRole("button", { name: /refactor search filters/i });
    expect(window.location.hash).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    await screen.findByRole("region", { name: "Timeline" });
    expect(window.location.hash).toBe("#/timeline");

    fireEvent.click(screen.getByRole("button", { name: "Analytics" }));
    await waitFor(() => expect(window.location.hash).toBe("#/analytics"));

    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    await waitFor(() => expect(window.location.hash).toBe("#/"));

    // A pasted or edited link switches screens without a reload.
    act(() => { window.location.hash = "#/timeline"; });
    expect(await screen.findByRole("region", { name: "Timeline" })).toBeInTheDocument();

    act(() => { window.location.hash = "#/"; });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Timeline" })).not.toBeInTheDocument());
  });

  it("opens a conversation from a #/c/<id> link and records it in the URL", async () => {
    window.history.replaceState(null, "", "/#/c/1");
    render(<App />);
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    expect(window.location.hash).toBe("#/c/1");

    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    await waitFor(() => expect(window.location.hash).toBe("#/"));
  });

  it("starts on the Timeline when loaded from #/timeline", async () => {
    window.history.replaceState(null, "", "/#/timeline");
    render(<App />);
    expect(await screen.findByRole("region", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the conversation link through a 401 lock and unlock", async () => {
    window.history.replaceState(null, "", "/#/c/1");
    let reject = false;
    installFetchMock({
      action: (url) => (reject && url.includes("/conversations/search") ? Promise.resolve(jsonResponse({}, { ok: false, status: 401 })) : undefined),
    });
    render(<App />);
    await within(screen.getByRole("main")).findByRole("heading", { name: "Refactor search filters" });

    reject = true;
    fireEvent.change(screen.getByLabelText(/search conversations/i), { target: { value: "refactor" } });
    fireEvent.change(await screen.findByLabelText(/api token/i), { target: { value: "new-token" } });
    expect(window.location.hash).toBe("#/c/1");

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await within(await screen.findByRole("main")).findByRole("heading", { name: "Refactor search filters" });
    expect(window.location.hash).toBe("#/c/1");
  });
});
