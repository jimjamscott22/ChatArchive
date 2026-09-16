# Handoff: Resizable / repositionable sidebar layout

I can't write directly into your local ChatArchive folder — only read from it. Apply the snippets below yourself in `frontend/src/App.tsx` and `frontend/src/styles.css` (or hand this file to Claude Code / another dev).

## Scope

Your app already has two real panels: `.sidebar` (fixed 268px, collapsible) and `.main-content`. The mockup's 5-panel drag/reorder board doesn't map to this 2-panel app, so this implements the realistic subset:

1. **Resizable sidebar** — drag the existing collapse-handle edge to resize instead of just collapsing; width persists to `localStorage`.
2. **Sidebar position toggle** — Left (current) or Right, via a `sidebarPosition` state + a `sidebar-right` class.
3. Hide/show stays as your existing collapse + full-width-view toggles — no change needed there.

## 1. State (near existing `sidebarCollapsed`, ~App.tsx:203)

```tsx
const [sidebarWidth, setSidebarWidth] = useState(
  () => Number(localStorage.getItem('chatarchive-sidebar-width')) || 268
);
const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>(
  () => (localStorage.getItem('chatarchive-sidebar-position') as 'left' | 'right') || 'left'
);
const resizingRef = useRef(false);

const startResize = (e: React.MouseEvent) => {
  e.preventDefault();
  resizingRef.current = true;
  document.body.style.cursor = 'col-resize';
};

useEffect(() => {
  function onMove(e: MouseEvent) {
    if (!resizingRef.current) return;
    const raw = sidebarPosition === 'left' ? e.clientX : window.innerWidth - e.clientX;
    const next = Math.min(420, Math.max(200, raw));
    setSidebarWidth(next);
  }
  function onUp() {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    document.body.style.cursor = '';
    localStorage.setItem('chatarchive-sidebar-width', String(sidebarWidth));
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  return () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
}, [sidebarPosition, sidebarWidth]);

const toggleSidebarPosition = () => {
  const next = sidebarPosition === 'left' ? 'right' : 'left';
  setSidebarPosition(next);
  localStorage.setItem('chatarchive-sidebar-position', next);
};
```

## 2. JSX (~App.tsx:1345)

Add the position class, an inline width style, and a resize handle. Keep everything else in `<aside>` unchanged.

```tsx
<div className={`app-container${fullWidthConvo && selectedConversation ? ' sidebar-hidden' : ''}${sidebarPosition === 'right' ? ' sidebar-right' : ''}`}>
  <div className="theme-transition-wash" key={theme} aria-hidden="true" />
  <aside
    className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
    style={!sidebarCollapsed ? { width: sidebarWidth } : undefined}
  >
    {/* ...unchanged sidebar contents... */}

    <div
      className="sidebar-resize-handle"
      onMouseDown={startResize}
      title="Drag to resize"
    />

    <button
      className="sidebar-collapse-handle"
      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
    </button>
  </aside>

  <main className="main-content">
    {/* Add a position toggle button somewhere in main-header-top or a settings modal: */}
    {/* <button className="icon-btn" onClick={toggleSidebarPosition} title="Move sidebar to other side">
      {sidebarPosition === 'left' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
    </button> */}
    {/* ...unchanged... */}
  </main>
</div>
```

Reordering `<aside>`/`<main>` in the DOM isn't necessary — `.sidebar-right` handles it in CSS (flexbox `order`).

## 3. CSS (`styles.css`, near `.app-container` ~line 617 and `.sidebar` ~line 700)

```css
.app-container.sidebar-right .sidebar {
  order: 2;
  border-right: none;
  border-left: 1px solid var(--border-color);
  box-shadow: -14px 0 42px rgba(0, 0, 0, 0.12);
}
.app-container.sidebar-right .sidebar-collapse-handle {
  right: auto;
  left: -14px;
  border-left: 2px solid var(--border-color);
  border-right: none;
  border-radius: 4px 0 0 4px;
}
.app-container.sidebar-right .sidebar-resize-handle {
  right: auto;
  left: -3px;
}

.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 19;
}
.sidebar-resize-handle:hover {
  background: var(--accent);
  opacity: 0.3;
}
```

Note: `.sidebar` already has `transition: width 0.3s ease` (line ~700), which will fight the drag by lagging behind the mouse. Set `transition: none` while `resizingRef.current` is true, e.g. add `sidebarCollapsed ? '' : (resizingRef.current ? 'no-transition' : '')` as a class, or simplest: change the CSS transition to only apply on the `collapsed` toggle:

```css
.sidebar { transition: none; }
.sidebar:not(.resizing) { transition: width 0.3s ease; } /* toggle a .resizing class from JS during drag */
```

## Files referenced
- `frontend/src/App.tsx` — state block ~203, main render ~1345-1900
- `frontend/src/styles.css` — `.app-container` ~617, `.sidebar` ~700-800
