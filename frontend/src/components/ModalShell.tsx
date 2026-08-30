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
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    
    // Cleanup if component unmounts unexpectedly
    return () => {
      if (dialog && dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    
    if (!isInDialog) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Handle native Escape key
        e.preventDefault();
        handleClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <div className="modal-header-actions">
          {headerActions}
          <button
            type="button"
            className="close-btn"
            aria-label={`Close ${title}`}
            onClick={handleClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>

      {actions ? <div className="modal-actions">{actions}</div> : null}
    </dialog>
  );
}
