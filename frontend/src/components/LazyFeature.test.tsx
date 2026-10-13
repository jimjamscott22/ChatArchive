import { lazy } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LazyFeature from "./LazyFeature";

describe("LazyFeature", () => {
  it("keeps a loading reader scoped to its content until the module arrives", async () => {
    let finish!: (module: { default: () => JSX.Element }) => void;
    const Reader = lazy(() => new Promise<{ default: () => JSX.Element }>(resolve => { finish = resolve; }));
    render(<><button>Archive controls</button><LazyFeature label="conversation reader" reader><Reader /></LazyFeature></>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading conversation reader");
    expect(screen.getByRole("button", { name: "Archive controls" })).toBeVisible();
    await act(async () => finish({ default: () => <p>Reader loaded</p> }));
    expect(await screen.findByText("Reader loaded")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows recovery and allows closing a failed tool without blanking the app", async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const Tool = lazy(() => Promise.reject(new Error("Chunk unavailable")));
    const close = vi.fn();
    render(<LazyFeature label="Settings" onClose={close}><Tool /></LazyFeature>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection and reload");
    expect(screen.getByRole("button", { name: "Reload application" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
    expect(close).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});
