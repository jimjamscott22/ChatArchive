import { ReactNode, useEffect, useId, useRef } from "react";

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  actions?: ReactNode;
  headerActions?: ReactNode;
};

export default function ModalShell({
  title,
  onClose,
  children,
  className = "",
  bodyClassName = "",
  actions,
  headerActions,
}: ModalShellProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-header-actions">
            {headerActions}
            <button
              ref={closeButtonRef}
              type="button"
              className="close-btn"
              aria-label={`Close ${title}`}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>

        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
