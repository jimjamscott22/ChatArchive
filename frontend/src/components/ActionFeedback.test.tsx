import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TagManagerModal from "./TagManagerModal";
import ProjectManagerModal from "./ProjectManagerModal";
import SettingsModal from "./SettingsModal";
import DuplicatesModal from "./DuplicatesModal";
import useActionFeedback from "./useActionFeedback";

const item = { id: 1, name: "Archive", created_at: "2026-10-13T00:00:00Z", conversation_count: 2 };
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.setItem("chatarchive_api_token", "test-token");
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.stubGlobal("confirm", vi.fn());
  vi.stubGlobal("alert", vi.fn());
});

describe("Contextual action feedback", () => {
  it.each(["tag", "project"])("confirms %s deletion and retains contextual failure and success", async kind => {
    const changed = vi.fn();
    let attempts = 0;
    const fetchMock = vi.fn(async () => response({ detail: "Deletion unavailable; try again." }, ++attempts > 1));
    vi.stubGlobal("fetch", fetchMock);
    render(kind === "tag" ? <TagManagerModal tags={[item]} onClose={vi.fn()} onTagsUpdated={changed} />
      : <ProjectManagerModal projects={[item]} onClose={vi.fn()} onProjectsUpdated={changed} />);
    const title = `Delete ${kind}`;
    const parent = screen.getByRole("dialog", { name: kind === "tag" ? "Manage Tags" : "Manage Projects" });
    fireEvent.click(within(parent).getByRole("button", { name: "Delete" }));
    let decision = screen.getByRole("dialog", { name: title });
    expect(decision).toHaveTextContent('"Archive"');
    expect(within(decision).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent(decision, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(parent).toHaveAttribute("open");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(parent).getByRole("button", { name: "Delete" }));
    decision = screen.getByRole("dialog", { name: title });
    fireEvent.click(within(decision).getByRole("button", { name: "Delete" }));
    expect(await within(parent).findByRole("alert")).toHaveTextContent("Deletion unavailable");
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(within(parent).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: title })).getByRole("button", { name: "Delete" }));
    expect(await within(parent).findByRole("status")).toHaveTextContent(`${kind === "tag" ? "Tag" : "Project"} deleted.`);
    expect(changed).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("keeps import deletion feedback within Settings and reconfirms a retry", async () => {
    let attempts = 0;
    const changed = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return response({ deleted_conversations: 2 }, ++attempts > 1);
      if (url.includes("/import/history")) return response({ items: [{ id: 7, filename: "archive.zip", source_type: "claude", file_format: "zip", status: "completed", imported_count: 2, created_at: item.created_at }] });
      return response({ id: 1, allowed_formats: "json", default_format: "json", auto_merge_duplicates: false, keep_separate: true, skip_empty_conversations: true });
    }));
    render(<SettingsModal onClose={vi.fn()} onConversationsChanged={changed} />);
    fireEvent.click(screen.getByRole("tab", { name: "Import History" }));
    fireEvent.click(await screen.findByTitle("Delete this import and its conversations"));
    let decision = screen.getByRole("dialog", { name: "Delete import" });
    expect(decision).toHaveTextContent('"archive.zip"');
    fireEvent.click(within(decision).getByRole("button", { name: "Delete" }));
    const parent = screen.getByRole("dialog", { name: "Import & Export Settings" });
    expect(await within(parent).findByRole("alert")).toHaveTextContent("Failed to delete import");
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(within(parent).getByRole("button", { name: "Try again" }));
    decision = screen.getByRole("dialog", { name: "Delete import" });
    expect(attempts).toBe(1);
    fireEvent.click(within(decision).getByRole("button", { name: "Delete" }));
    expect(await within(parent).findByRole("status")).toHaveTextContent("Deleted import and 2 conversation(s).");
    expect(changed).toHaveBeenCalledOnce();
    expect(alert).not.toHaveBeenCalled();
  });

  it("retains duplicate selection after failure and confirms the exact bulk IDs", async () => {
    let attempts = 0;
    const changed = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return response({ deleted_count: 1 }, ++attempts > 1);
      return response({ groups: [{ key: "same", source: "chatgpt", source_id: "same", title: "Duplicates", count: 2, total_messages: 2,
        conversations: [1, 2].map(id => ({ id, source: "chatgpt", source_id: "same", title: `Thread ${id}`, message_count: 1, created_at: item.created_at, updated_at: item.created_at })) }], total_groups: 1, total_duplicates: 2, strategy: "source_id" });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DuplicatesModal onClose={vi.fn()} onSuccess={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: /Duplicates.*2 duplicates/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete Selected (1)" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Delete selected conversations" })).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your selection is retained");
    expect(checkboxes[1]).toBeChecked();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Delete selected conversations" })).getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted 1 conversation(s).");
    const deleteRequests = fetchMock.mock.calls.filter(([,init]) => init?.method === "DELETE");
    expect(JSON.parse(deleteRequests[0][1]?.body as string)).toEqual({ conversation_ids: [2] });
    expect(changed).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("resolves a dismissed confirmation as cancellation, including unmount", async () => {
    const completed = vi.fn();
    function Harness() {
      const { confirmAction, feedback } = useActionFeedback();
      return <><button onClick={async () => completed(await confirmAction("Delete archive?", "Decision"))}>Start</button>{feedback}</>;
    }
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Decision" }));
    await act(async () => {});
    expect(completed).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    view.unmount();
    await act(async () => {});
    expect(completed).toHaveBeenLastCalledWith(false);
    expect(completed).toHaveBeenCalledTimes(2);
  });
});
