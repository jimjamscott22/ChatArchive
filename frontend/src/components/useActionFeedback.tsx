import { useEffect, useRef, useState } from "react";
import ModalShell from "./ModalShell";

type Notice = {
  message: string;
  kind: "success" | "error";
  retry?: () => void | Promise<void>;
};
type Confirmation = { message: string; title: string; label: string };

/** Keep feedback in the surface that owns the action, including inside dialogs. */
export default function useActionFeedback(app = false) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [retrying, setRetrying] = useState(false);
  const resolveConfirmation = useRef<((confirmed: boolean) => void) | null>(null);
  const retryPending = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    resolveConfirmation.current?.(false);
    resolveConfirmation.current = null;
  }, []);

  const notify = (message: string, kind: Notice["kind"] = "success", retry?: Notice["retry"]) => {
    setNotice({ message, kind, retry });
  };

  const confirmAction = (message: string, title: string, label = "Delete") => {
    // A second trigger cannot replace an unresolved destructive decision.
    if (resolveConfirmation.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      resolveConfirmation.current = resolve;
      setConfirmation({ message, title, label });
    });
  };

  const finishConfirmation = (confirmed: boolean) => {
    const resolve = resolveConfirmation.current;
    resolveConfirmation.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  };

  const retry = async () => {
    if (!notice?.retry || retryPending.current) return;
    retryPending.current = true;
    setRetrying(true);
    try {
      await notice.retry();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed. Please try again.", "error", notice.retry);
    } finally {
      retryPending.current = false;
      setRetrying(false);
    }
  };

  const feedback = (
    <>
      {notice && (
        <div className={`action-feedback ${app ? "action-feedback-app" : ""} ${notice.kind === "error" ? "status-error" : "status-success"}`}
          role={notice.kind === "error" ? "alert" : "status"}>
          <p>{notice.message}</p>
          <div className="feedback-actions">
            {notice.retry && <button type="button" onClick={retry} disabled={retrying}>{retrying ? "Trying again…" : "Try again"}</button>}
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {confirmation && (
        <ModalShell title={confirmation.title} onClose={() => finishConfirmation(false)} className="confirmation-modal" initialFocusRef={cancelRef}
          actions={<>
            <button type="button" ref={cancelRef} onClick={() => finishConfirmation(false)}>Cancel</button>
            <button type="button" className="danger" onClick={() => finishConfirmation(true)}>{confirmation.label}</button>
          </>}>
          <p>{confirmation.message}</p>
        </ModalShell>
      )}
    </>
  );

  return { notify, confirmAction, feedback };
}
