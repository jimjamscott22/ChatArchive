import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConversationResources from "./ConversationResources";


function response(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
    blob: async () => new Blob(),
    ...overrides,
  } as Response;
}


describe("ConversationResources", () => {
  beforeEach(() => {
    localStorage.setItem("chatarchive_api_token", "test-token");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:resource-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("shows omitted resources without offering an unsafe action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          json: async () => ({
            items: [
              {
                id: 1,
                kind: "attachment",
                title: "missing.pdf",
                filename: "missing.pdf",
                mime_type: "application/pdf",
                availability: "metadata_only",
              },
            ],
          }),
        }),
      ),
    );

    render(<ConversationResources conversationId={4} />);

    expect(await screen.findByText("missing.pdf")).toBeInTheDocument();
    expect(screen.getByText(/did not include usable content/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download missing/i })).not.toBeInTheDocument();
  });

  it("renders imported HTML as inert source text", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      if (String(input).includes("/conversations/4/resources")) {
        return response({
          json: async () => ({
            items: [
              {
                id: 2,
                kind: "artifact",
                title: "Demo page",
                mime_type: "text/html",
                availability: "inline",
              },
            ],
          }),
        });
      }
      return response({
        text: async () => "<script>window.bad = true</script><h1>Preview</h1>",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConversationResources conversationId={4} />);
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));

    expect(await screen.findByText(/window\.bad = true/)).toBeInTheDocument();
    expect(document.querySelector(".resource-text-preview script")).toBeNull();
    await waitFor(() => {
      const contentCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/resources/2/content"),
      );
      expect(contentCall?.[1]?.headers).toBeInstanceOf(Headers);
      expect((contentCall?.[1]?.headers as Headers).get("Authorization")).toBe(
        "Bearer test-token",
      );
    });
  });

  it("revokes image preview URLs when unmounted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).includes("/conversations/4/resources")) {
          return response({
            json: async () => ({
              items: [
                {
                  id: 3,
                  kind: "image",
                  title: "chart.png",
                  mime_type: "image/png",
                  availability: "stored",
                },
              ],
            }),
          });
        }
        return response({ blob: async () => new Blob(["image"]) });
      }),
    );

    const { unmount } = render(<ConversationResources conversationId={4} />);
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    await screen.findByRole("img", { name: "chart.png" });
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:resource-preview");
  });

  it("loads all resource pages and displays the complete count", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get("page") || 1);
      return response({ json: async () => ({
        items: Array.from({ length: page === 3 ? 1 : 50 }, (_, index) => ({
          id: (page - 1) * 50 + index + 1,
          kind: "attachment", availability: "metadata_only",
          title: `File ${(page - 1) * 50 + index + 1}`,
        })),
        page, page_size: 50, pages: 3, total: 101,
      }) });
    }));

    render(<ConversationResources conversationId={4} />);

    expect(await screen.findByText("File 101")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(101);
    expect(screen.getByText("101", { selector: ".resource-count" })).toBeInTheDocument();
  });

  it("reports failure on a later resource page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get("page") || 1);
      return page === 1
        ? response({ json: async () => ({ items: [], page: 1, pages: 2, total: 51, page_size: 50 }) })
        : response({ ok: false, status: 500, json: async () => ({ detail: "Later page failed" }) });
    }));

    render(<ConversationResources conversationId={4} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Later page failed");
  });

  it("ignores a pending old page when the conversation changes", async () => {
    let finishOldPage!: (value: Response) => void;
    const pendingPage = new Promise<Response>((resolve) => { finishOldPage = resolve; });
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/conversations/4/") && url.searchParams.get("page") === "2") {
        return pendingPage;
      }
      const oldConversation = url.pathname.includes("/conversations/4/");
      return response({ json: async () => ({
        items: [{ id: oldConversation ? 1 : 2, title: oldConversation ? "Old file" : "Current file",
          kind: "attachment", availability: "metadata_only" }],
        page: 1, pages: oldConversation ? 3 : 1, total: oldConversation ? 101 : 1, page_size: 50,
      }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<ConversationResources conversationId={4} />);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) =>
      new URL(String(url)).searchParams.get("page") === "2")).toBe(true));

    rerender(<ConversationResources conversationId={5} />);
    expect(await screen.findByText("Current file")).toBeInTheDocument();
    await act(async () => {
      finishOldPage(response({ json: async () => ({
        items: [{ id: 3, title: "Stale file", kind: "attachment", availability: "metadata_only" }],
        page: 2, pages: 3, total: 101, page_size: 50,
      }) }));
    });

    expect(screen.queryByText("Old file")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale file")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => new URL(String(url)).searchParams.get("page") === "3")).toBe(false);
  });
});
