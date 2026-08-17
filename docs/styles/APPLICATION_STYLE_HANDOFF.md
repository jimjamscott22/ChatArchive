# ChatArchive Style Handoff

This document summarizes ChatArchive's visual system so another AI agent can apply the same style language to a different web app.

## Visual Direction

ChatArchive uses an archival, typewriter-inspired interface. The overall feel is warm, textural, and document-like rather than glossy or SaaS-modern.

Core traits:

- Parchment, charcoal, coffee, and muted ink color palettes
- Serif reading typography with typewriter-style labels and controls
- Small-radius cards and panels with visible borders
- Dashed dividers, ruled-paper textures, and subtle paper-grain overlays
- Muted gold or theme-specific accent colors
- Tactile "typewriter key" buttons with inset shadows and pressed states
- Compact information density with readable spacing
- Semantic CSS class names rather than utility-heavy styling

## Implementation Structure

The frontend styling is centralized in `frontend/src/styles.css`. The React components mostly apply semantic class names from `frontend/src/App.tsx` and `frontend/src/components/ModalShell.tsx`.

The app does not use Tailwind. It uses plain CSS with custom properties and theme selectors.

The theme is applied to the root HTML element:

```css
html[data-theme="dark"] { /* theme variables */ }
html[data-theme="light"] { /* theme variables */ }
```

In the current app, `App.tsx` sets this as:

```tsx
document.documentElement.setAttribute("data-theme", theme);
```

The theme preference is stored in `localStorage` under `chatarchive-theme`.

## Theme Token System

Each theme defines the same core variables. Copy this token structure first, then build components from the tokens.

Essential tokens:

```css
:root {
  --bg-primary: #1c1812;
  --bg-secondary: #231e16;
  --bg-tertiary: #2c2519;
  --app-background: var(--bg-primary);

  --text-primary: #e8dcc8;
  --text-secondary: #b8a88a;
  --text-muted: #7a6a52;

  --border-color: #3d3126;
  --accent: #c4944a;
  --accent-hover: #d4aa6a;
  --accent-subtle: rgba(196, 148, 74, 0.12);

  --surface-panel: rgba(35, 30, 22, 0.72);
  --surface-panel-strong: rgba(35, 30, 22, 0.92);
  --surface-elevated: rgba(25, 21, 15, 0.78);

  --hero-gradient: linear-gradient(135deg, rgba(35, 30, 22, 0.94), rgba(25, 21, 15, 0.96));
  --gradient-subtle: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  --gradient-accent: linear-gradient(135deg, var(--accent), var(--accent-hover));

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 20px rgba(0, 0, 0, 0.4), 0 3px 8px rgba(0, 0, 0, 0.25);
  --shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.45), 0 6px 12px rgba(0, 0, 0, 0.3);

  --key-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --key-shadow-press: inset 0 1px 0 rgba(0, 0, 0, 0.4), inset 0 -1px 0 rgba(255, 255, 255, 0.05);
}
```

The main default theme is aged charcoal and parchment:

- `--bg-primary`: `#1c1812`
- `--bg-secondary`: `#231e16`
- `--bg-tertiary`: `#2c2519`
- `--text-primary`: `#e8dcc8`
- `--text-secondary`: `#b8a88a`
- `--text-muted`: `#7a6a52`
- `--border-color`: `#3d3126`
- `--accent`: `#c4944a`
- `--accent-hover`: `#d4aa6a`

Light mode reverses the feel into parchment and ink:

- `--bg-primary`: `#f5edd8`
- `--bg-secondary`: `#ede3c6`
- `--bg-tertiary`: `#e5d9b5`
- `--text-primary`: `#1a1208`
- `--text-secondary`: `#4a3520`
- `--text-muted`: `#7a5a38`
- `--border-color`: `#c4a86a`
- `--accent`: `#8b4513`
- `--accent-hover`: `#a0521e`

Existing named themes:

- `dark`
- `light`
- `sepia`
- `coffee`
- `rose`
- `sunset`
- `nord`
- `dracula`
- `solarized-dark`
- `ocean`
- `forest`

## Typography

Fonts are loaded in `frontend/index.html` from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

Font roles:

- Body and reading text: `"Lora", Georgia, "Times New Roman", serif`
- Brand/title display: `"Special Elite", cursive`
- Section headings: `"Playfair Display", Georgia, serif`
- Labels, metadata, buttons, counters: `"Courier Prime", monospace`
- Code blocks: `"Monaco", "Menlo", "Ubuntu Mono", monospace`

Typography patterns:

- Body text is `14px`, `line-height: 1.5`.
- Conversation/message content is slightly larger, around `14.5px`, with `line-height: 1.75`.
- Main titles use `Special Elite`, normal weight, and slight letter spacing.
- Section headings use `Playfair Display`, often `600` weight.
- Labels use uppercase `Courier Prime`, `10px-11px`, bold, with `0.08em-0.16em` letter spacing.
- Metadata uses small monospace text, usually `10px-12px`, muted color, and modest tracking.

## Layout System

The app shell is a fixed-height, full-viewport flex layout:

```css
html,
body {
  height: 100vh;
  overflow: hidden;
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
```

Primary layout:

- Left sidebar: `268px` wide, fixed/flex-shrink `0`
- Collapsed sidebar: `60px`
- Main content: flexible column, `overflow: hidden`
- Main content body: scrollable pane with `overflow-y: auto`
- Conversation reading width: `max-width: 800px`
- Dashboard/overview width: `max-width: 1080px`

Responsive breakpoints:

- `1024px`: sidebar becomes fixed/off-canvas and main content uses full width
- `900px`: multi-column grids collapse from 4/2 columns to fewer columns
- `720px`: content padding shrinks, messages lose left offset, modals become viewport-width
- `560px`: sidebar and meta pills become more mobile-friendly, modal actions stack

## Surfaces And Cards

Cards and panels should look like archival paper objects.

Use:

- `background: var(--surface-panel)` or `var(--bg-secondary)`
- `border: 1px solid var(--border-color)`
- `border-radius: 2px-4px` for core archive elements
- `box-shadow: var(--shadow-sm)` or `var(--shadow-md)`
- Accent borders for selected/important states
- Dashed borders for separators and metadata sections

Representative card pattern:

```css
.archive-card {
  padding: 12px 14px;
  border-radius: 2px;
  border: 1px solid var(--border-color);
  border-left: 3px solid transparent;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-sm);
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.archive-card:hover,
.archive-card.active {
  background: var(--bg-tertiary);
  border-left-color: var(--accent);
  box-shadow: var(--shadow-md);
}
```

Texture pattern:

```css
.paper-texture::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 28px,
    rgba(196, 148, 74, 0.04) 28px,
    rgba(196, 148, 74, 0.04) 29px
  );
}
```

## Buttons And Controls

Primary action buttons use a typewriter-key treatment:

```css
.primary-key-btn {
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 10px 18px;
  font-family: "Courier Prime", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: var(--key-shadow);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, box-shadow 0.1s ease;
}

.primary-key-btn:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.primary-key-btn:active {
  box-shadow: var(--key-shadow-press);
  transform: translateY(1px);
}
```

Secondary buttons:

- Background: `var(--bg-secondary)` or transparent
- Border: `1px solid var(--border-color)`
- Hover: `var(--bg-tertiary)`, accent border, accent text
- Same monospace uppercase style when used as tools/actions

Icon buttons:

- Transparent by default
- `7px` padding
- `3px` radius
- Muted text color
- Hover changes to `var(--bg-tertiary)` and `var(--accent)`
- Some use a subtle circular `::before` bloom on hover

Focus states are explicit and accessible:

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

## Forms And Inputs

Inputs use inset surfaces:

```css
input,
select {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-primary);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-tertiary);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15), 0 0 0 2px var(--accent-subtle);
}
```

Labels should usually be uppercase, small, and monospace.

## Tags, Chips, And Badges

Tags are compact and document-like:

```css
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 2px;
  border: 1px dashed currentColor;
  font-family: "Courier Prime", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0.85;
}

.tag-badge:hover {
  opacity: 1;
  transform: rotate(-0.5deg);
}
```

Filter chips use pill shapes, but still keep muted colors and simple borders:

- Default: `var(--bg-tertiary)`, muted text, border color
- Hover: accent border and primary text
- Active: accent background, white text

## Modals

Modals use a dark overlay, blur, accent top border, and a slight scale/slide animation.

Modal shell traits:

- Overlay: fixed `inset: 0`, `rgba(0, 0, 0, 0.8)`, `backdrop-filter: blur(4px)`
- Modal: `var(--bg-secondary)`, `1px` border, `3px` accent top border
- Radius: `3px`
- Shadow: blocky offset plus large blur
- Header bottom border: dashed
- Close button: large text button, muted until hover

The reusable React component is `frontend/src/components/ModalShell.tsx`. It handles:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby`
- Escape key close
- Focus restoration
- Click outside to close

## Conversation And Message Styling

Messages appear as archival note cards:

- Outer message card uses gradient surface, border, left accent strip, and shadow.
- User messages use `var(--bg-tertiary)` and accent left border.
- Assistant messages use `var(--gradient-subtle)` and border-colored left strip.
- Avatar boxes are square-ish (`36px`, `3px` radius) with small hard shadows.
- Message body is a nested paper bubble with its own border and a small diamond pointer.
- On mobile, the message body loses its left margin and the pointer is hidden.

Markdown content styling:

- Paragraphs spaced by `12px`
- Headings use increasing `em` sizes with clear margins
- Blockquotes use a left border and italic secondary text
- Inline code uses `var(--bg-tertiary)`, small radius, and monospace
- Code blocks use `var(--bg-tertiary)`, border, radius, padding, and horizontal scroll
- Tables use full width and themed borders
- Links are accent-colored and underline on hover

The app also imports `highlight.js/styles/github-dark.css` for syntax highlighting.

## Icon And Source Colors

Icons come from `lucide-react`.

Source-specific colors are defined globally:

```css
--chatgpt-color: #10a37f;
--claude-color: #d97757;
--gemini-color: #4285f4;
--copilot-color: #8957e5;
```

Source avatars and source tags use gradient backgrounds from these colors to darker variants.

## Motion

Motion is subtle and quick:

- General hover transitions: `0.15s-0.2s`
- Sidebar width transition: `0.3s ease`
- Dropdowns animate from `translateY(-6px)` and opacity `0`
- Modals animate from `scale(0.95) translateY(16px)` and opacity `0`
- Skeleton loading uses a horizontal shimmer
- Empty/welcome icon gently floats
- Drag/drop project zones pulse their dashed border

Avoid large, bouncy, or highly elastic motion. The style should feel mechanical and tactile.

## Scrollbars

The app uses thin custom WebKit scrollbars:

```css
*::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: var(--accent);
  opacity: 0.3;
  border-radius: 2px;
}
```

## Accessibility Notes

Patterns worth preserving:

- `sr-only` helper for invisible labels
- `focus-visible` outline using the accent color
- Dialog ARIA in `ModalShell`
- Escape-to-close modals
- Focus restoration after modal close
- `role="button"` and `tabIndex={0}` on clickable non-button elements

Areas to improve if porting:

- Prefer real `<button>` elements over clickable `<div>` where possible.
- Ensure theme palettes preserve contrast in all states.
- If using emoji icons, provide accessible names or replace them with SVG icons.

## Practical Porting Checklist

For another web app, apply the style in this order:

1. Add the CSS variable theme system.
2. Load the four fonts: `Special Elite`, `Playfair Display`, `Lora`, and `Courier Prime`.
3. Set the body to `Lora`, `14px`, `line-height: 1.5`, and `background: var(--app-background)`.
4. Build app shell with a bordered sidebar and scrollable main content.
5. Style cards with `var(--bg-secondary)`, visible borders, small radius, shadows, and accent left/top borders.
6. Use uppercase monospace labels and buttons.
7. Add typewriter-key shadows to primary/tool buttons.
8. Use dashed separators and subtle repeating-linear-gradient paper textures.
9. Add custom focus rings and compact scrollbars.
10. Keep interactions quick, restrained, and tactile.

## Minimal Starter CSS

Use this as a compact seed for another app:

```css
:root {
  --bg-primary: #1c1812;
  --bg-secondary: #231e16;
  --bg-tertiary: #2c2519;
  --app-background: var(--bg-primary);
  --text-primary: #e8dcc8;
  --text-secondary: #b8a88a;
  --text-muted: #7a6a52;
  --border-color: #3d3126;
  --accent: #c4944a;
  --accent-hover: #d4aa6a;
  --accent-subtle: rgba(196, 148, 74, 0.12);
  --surface-panel: rgba(35, 30, 22, 0.72);
  --surface-panel-strong: rgba(35, 30, 22, 0.92);
  --gradient-subtle: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2);
  --key-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --key-shadow-press: inset 0 1px 0 rgba(0, 0, 0, 0.4), inset 0 -1px 0 rgba(255, 255, 255, 0.05);
}

body {
  margin: 0;
  background: var(--app-background);
  color: var(--text-primary);
  font-family: "Lora", Georgia, "Times New Roman", serif;
  font-size: 14px;
  line-height: 1.5;
}

.archive-panel {
  background: var(--surface-panel);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  box-shadow: var(--shadow-sm);
}

.archive-title {
  font-family: "Special Elite", cursive;
  font-weight: 400;
  letter-spacing: 0.03em;
}

.archive-label {
  font-family: "Courier Prime", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.archive-button {
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--accent);
  color: #fff;
  padding: 10px 18px;
  font-family: "Courier Prime", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: var(--key-shadow);
  cursor: pointer;
}

.archive-button:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.archive-button:active {
  box-shadow: var(--key-shadow-press);
  transform: translateY(1px);
}
```
