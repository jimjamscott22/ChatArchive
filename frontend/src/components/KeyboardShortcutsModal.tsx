import ModalShell from "./ModalShell";

export default function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ["Ctrl/Cmd + K", "Focus search"],
    ["Ctrl/Cmd + I", "Open import"],
    ["Ctrl/Cmd + ,", "Open settings"],
    ["Ctrl/Cmd + E", "Open export menu"],
    ["Ctrl/Cmd + B", "Toggle sidebar"],
    ["Arrow Up / Down", "Navigate conversations when a list row is focused"],
    ["Esc", "Close open overlays"],
    ["Shift + ?", "Open keyboard shortcuts"],
  ];

  return (
    <ModalShell title="Keyboard Shortcuts" onClose={onClose} className="shortcut-modal">
      <div className="shortcut-list">
        {shortcuts.map(([keys, description]) => (
          <div key={keys} className="shortcut-row">
            <kbd>{keys}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
