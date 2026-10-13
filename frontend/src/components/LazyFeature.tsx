import React, { Suspense, type ReactNode } from "react";
import ModalShell from "./ModalShell";

type Props = {
  label: string;
  children: ReactNode;
  onClose?: () => void;
  reader?: boolean;
};

function FeatureStatus({ label, onClose, reader, failed = false }: Omit<Props, "children"> & { failed?: boolean }) {
  const content = (
    <div className={reader ? "welcome-state feature-placeholder" : "feature-placeholder"}>
      <p role={failed ? "alert" : "status"}>
        {failed ? `Couldn't open ${label}. Check your connection and reload to try again.` : `Loading ${label}…`}
      </p>
      {failed && <button className="empty-action-btn" onClick={() => window.location.reload()}>Reload application</button>}
    </div>
  );
  return onClose ? <ModalShell title={label} onClose={onClose}>{content}</ModalShell> : content;
}

class FeatureBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <FeatureStatus {...this.props} failed /> : this.props.children;
  }
}

export default function LazyFeature(props: Props) {
  return (
    <FeatureBoundary {...props}>
      <Suspense fallback={<FeatureStatus {...props} />}>{props.children}</Suspense>
    </FeatureBoundary>
  );
}
