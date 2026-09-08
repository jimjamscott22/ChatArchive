import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
