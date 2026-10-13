import React, { type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReactMarkdown from "react-markdown";

import ConversationReader from "./ConversationReader";
import { type Message } from "../utils/conversationPresentation";

vi.mock("react-markdown", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-markdown")>();
  return { ...actual, default: vi.fn((props: ComponentProps<typeof actual.default>) => <actual.default {...props} />) };
});

const messages: readonly Message[] = Object.freeze([
  { id: 2, role: "assistant", content: "## Archive notes\n\nA **search** with [archive links](https://example.com).\n\n- Search the archive\n\n`search`\n\n```typescript\nconst search = 'archive';\n```", order_index: 1, created_at: "invalid date" },
  { id: 1, role: "user", content: "First question", order_index: 0 },
]);
const readerProps = { conversationId: 1, source: "chatgpt", messages, highlightQuery: "" };

describe("ConversationReader", () => {
  beforeEach(() => {
    vi.mocked(ReactMarkdown).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: [], total: 0 }) })));
    localStorage.setItem("chatarchive_api_token", "test-token");
  });

  it("orders messages without mutating input and preserves metadata, Markdown, and code", async () => {
    const { container } = render(<ConversationReader {...readerProps} />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".message"));
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("First question")).toBeInTheDocument();
    expect(within(rows[0]).getByText("You")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archive notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "archive links" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("listitem")).toHaveTextContent("Search the archive");
    expect(container.querySelector("pre code .hljs-keyword")).toHaveTextContent("const");
    expect(screen.getByText(/invalid date/)).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
    expect(screen.getByText("Message 2")).toBeInTheDocument();
    expect(messages[0].id).toBe(2);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("skips Markdown parsing during unrelated parent updates and query changes", () => {
    function Parent() {
      const [count, setCount] = React.useState(0);
      const [query, setQuery] = React.useState("");
      return <>
        <button onClick={() => setCount(count + 1)}>Other UI {count}</button>
        <input aria-label="Reader query" value={query} onChange={e => setQuery(e.target.value)} />
        <ConversationReader {...readerProps} highlightQuery={query} />
      </>;
    }
    const { container } = render(<Parent />);
    expect(ReactMarkdown).toHaveBeenCalledTimes(2);
    const code = container.querySelector("pre code");
    const heading = screen.getByRole("heading", { name: "Archive notes" });
    fireEvent.click(screen.getByRole("button", { name: "Other UI 0" }));
    expect(ReactMarkdown).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "search archive" } });
    expect(container.querySelectorAll("mark").length).toBeGreaterThan(0);
    expect(container.querySelector("mark mark")).toBeNull();
    expect(container.querySelector("code mark")).toBeNull();
    expect(container.querySelector("pre code")).toBe(code);
    expect(screen.getByRole("heading", { name: "Archive notes" })).toBe(heading);
    expect(ReactMarkdown).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(container.querySelector("mark")).toBeNull();
    expect(ReactMarkdown).toHaveBeenCalledTimes(2);
  });

  it("renders updated message content, provider labels, and resource requests", async () => {
    const { rerender } = render(<ConversationReader {...readerProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const updated = messages.map(message => message.id === 2 ? { ...message, content: "Updated answer" } : message);
    rerender(<ConversationReader {...readerProps} conversationId={2} source="claude" messages={updated} />);
    expect(screen.getByText("Updated answer")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Archive notes" })).not.toBeInTheDocument();
    expect(ReactMarkdown).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/conversations/2/resources"), expect.anything()));
  });
});
