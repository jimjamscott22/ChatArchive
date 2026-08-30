
--- Guide for navigation-drawer ---
## Overview

A navigation drawer is a panel that slides in from the edge of the viewport over the page content, dimming everything behind it. It is opened from a trigger button and dismissed by swiping the panel off-screen, tapping the dimmed backdrop, or pressing Escape.

This guide implements the drawer as:

- A `popover="manual"` element promoted to the top layer so the panel and its `::backdrop` overlay every other element on the page, regardless of stacking context.
- A horizontally scrolling container with two CSS scroll-snap stops — one for "open", one for "closed" — so the swipe gesture is handled natively by the browser. This delivers momentum, velocity, and interruption tracking for free, with no JavaScript pointer-event code.
- A scroll-driven animation that ties the backdrop's opacity to the scroll position, so the dim fades in and out smoothly as the user drags the panel.
- An `IntersectionObserver` on the panel that detects when it has fully entered or fully left the viewport, and uses those moments to update focus, `aria-expanded`, and `inert`.

This approach is preferred over JavaScript-driven `transform` animations because the scroll mechanism gives the user direct control of the panel's position (their finger drives it, not a tween) and it much more closely matches the interaction patterns that users are accustomed to in native mobile apps.

## Implementation

### 1. Markup

The drawer is a single popover containing a horizontal scroller, which contains the visible "sheet". The trigger button lives in the page content.

```html
<!-- popover="manual" is REQUIRED. Do not use popover="auto" or "hint". -->
<div class="Drawer" id="drawer" popover="manual">
  <div class="Drawer-scroller">
    <nav class="Drawer-sheet" tabindex="-1">
      <!-- tabindex="-1" makes the sheet programmatically focusable so we
           can move focus into it when the drawer opens, without adding it
           to the natural tab order. -->
      <ul>
        <li><a href="/page-1">Page 1</a></li>
        <li><a href="/page-2">Page 2</a></li>
        <!-- ... -->
      </ul>
    </nav>
  </div>
</div>

<main>
  <header>
    <!-- aria-controls links the trigger to the drawer; aria-expanded
         reflects the current state for assistive tech. -->
    <button id="drawer-open"
            aria-label="Menu"
            aria-expanded="false"
            aria-controls="drawer">
      <!-- MANDATORY: Inline decorative SVGs MUST define aria-hidden="true" -->
      <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
    </button>
  </header>
  <!-- Page content. -->
</main>
```

### 2. Styles

#### Reset the popover and fill the viewport

The popover must cover the whole viewport so its `::backdrop` dims the entire page and the swipe surface extends edge-to-edge. The default user-agent popover styles (centered, auto-sized, bordered) get in the way and must be reset.

```css
.Drawer {
  /* min() caps the sheet width on large screens but on a phone leaves
     a 20% peek of page content visible, which is the affordance that
     tells the user they can tap outside to dismiss. */
  --drawer-width: min(20em, 80dvw);

  /* Custom property driven by the scroll-driven animation below.
     0 = drawer fully closed (transparent backdrop).
     1 = drawer fully open (visible backdrop). */
  --drawer-backdrop: 0;

  /* Reset UA popover style that would constrain the element. */
  width: auto;
  height: auto;
  background: transparent;
  border: 0;
  overflow: visible;
}

/* Style the popover's ::backdrop to achieve the overlay effect and
   provide visual affordances indicating that the rest of the page is inert */
.Drawer::backdrop {
  background: #000;
  /* Use calc() to limit the opacity range so the content beneath is visible */
  opacity: calc(var(--drawer-backdrop) / 2);
}
```

#### Build the swipe surface with scroll snap

The scroller is a horizontal grid wider than the viewport: column 1 holds the sheet (width `--drawer-width`), column 2 is an empty pseudo-element spacer the width of the viewport. Snapping between the two columns is what opens and closes the drawer.

```css
.Drawer-scroller {
  position: relative;
  display: grid;
  /* Sheet on the left, full-viewport spacer on the right. The user
     scrolls between the two snap stops to open and close. */
  grid-template-columns: var(--drawer-width) 100%;

  overflow-x: scroll;
  /* Stop the swipe from chaining into the page's vertical scroll
     when the user reaches either snap edge. */
  overscroll-behavior: none;
  scrollbar-width: none;
  /* `mandatory` guarantees the drawer always settles fully open or
     fully closed — never half-open after a partial swipe. */
  scroll-snap-type: x mandatory;
}

/* Enable smooth scrolling natively, but only if the user has not
   requested reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  .Drawer-scroller {
    scroll-behavior: smooth;
  }
}

/* The empty spacer that creates the "closed" snap stop. */
.Drawer-scroller::after {
  content: '';
  scroll-snap-align: end;
  /* Open the popover already scrolled to this stop (drawer off-screen),
     so the JS only needs to scroll to the open position to
     animate it in. */
  scroll-initial-target: nearest;
}

.Drawer-sheet {
  display: grid;
  grid-template-rows: auto 1fr;
  /* Use `svh` (small viewport height) — not `vh` or `dvh` — so the
     sheet height does not jump when the iOS Safari address bar
     resizes mid-swipe. */
  height: 100svh;

  background: #333;
  color: #fff;
  overflow-y: auto;
  scroll-snap-align: start;
  scrollbar-width: none;
}
```

#### Tie the backdrop opacity to the scroll position

A scroll-driven animation maps `--drawer-backdrop` from 1 (open) to 0 (closed) across the scroller's range, so the backdrop fades in and out perfectly synced with the drag.

```css
/* MANDATORY: Wrap this entire block in @supports. Browsers that don't
   support animation-timeline still parse the @keyframes and would
   apply the animation's `0%` value (--drawer-backdrop: 1) at all
   times, leaving the backdrop permanently opaque. The @supports gate
   ensures the animation is only registered where it actually works. */
@supports (animation-timeline: scroll()) {
  .Drawer {
    /* timeline-scope lets .Drawer reference a scroll-timeline that
       is defined on its descendant (the scroller). Without this, the
       timeline name is not visible to the .Drawer element. */
    timeline-scope: --drawer-fade;
    animation: fade-drawer-backdrop linear both;
    animation-timeline: --drawer-fade;
  }

  .Drawer-scroller {
    /* The horizontal scroll position of this element drives the
       timeline named `--drawer-fade`. */
    scroll-timeline: --drawer-fade x;
  }

  /* @property is REQUIRED. Without registering --drawer-backdrop with
     a `<number>` syntax, the browser treats it as a string and cannot
     interpolate it — the backdrop would jump from 0 to 1 with no
     fade. */
  @property --drawer-backdrop {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  @keyframes fade-drawer-backdrop {
    /* Scroll position 0 = drawer fully open = backdrop visible. */
    0% { --drawer-backdrop: 1 }
    /* Scroll position 100% = drawer fully closed = backdrop hidden. */
    100% { --drawer-backdrop: 0 }
  }
}
```

### 3. Open and close the drawer

Opening is two steps: promote the popover to the top layer, then scroll the sheet into view. Closing is one step: scroll back to the spacer; an observer (step 4) hides the popover once the sheet is fully off-screen.

```js
const drawer = document.getElementById('drawer');
const openBtn = document.getElementById('drawer-open');
const scroller = drawer.querySelector('.Drawer-scroller');
const sheet = drawer.querySelector('.Drawer-sheet');

function openDrawer() {
  // Show the popover first so the element is in the top layer before
  // we trigger any scrolling. `scroll-initial-target` (set on the
  // ::after spacer) places the initial scroll position at the closed
  // stop, so the drawer enters the top layer already off-screen.
  drawer.showPopover();

  // Scroll the sheet into view. The `behavior: 'auto'` option defers
  // to the CSS `scroll-behavior` property, which will be smooth unless
  // the user prefers reduced motion. Snap takes over at the end and
  // locks the drawer fully open.
  scroller.scrollTo({left: 0, behavior: 'auto'});
}

function closeDrawer() {
  // Scroll back to the spacer. Do NOT call hidePopover() here —
  // doing so would remove the element from the top layer mid-animation
  // and the close animation would not be visible. The
  // IntersectionObserver in step 4 hides the popover once the sheet
  // has actually left the viewport.
  scroller.scrollTo({left: scroller.offsetWidth, behavior: 'auto'});
}
```

### 4. Detect open and closed state

Use an `IntersectionObserver` on the sheet — not the scroll position — as the source of truth for the drawer's state. The observer fires regardless of how the sheet moved (user swipe, programmatic scroll, snap settle), so all dismissal paths converge in the same callback.

```js
function onDrawerOpened() {
  // Mark the rest of the page inert so keyboard and screen-reader
  // users cannot tab into content hidden behind the drawer.
  document.querySelector('main').inert = true;
  openBtn.setAttribute('aria-expanded', 'true');
  // Move focus into the drawer for keyboard users.
  sheet.focus();
}

function onDrawerClosed() {
  // Hide the popover only after the close animation completes,
  // so the slide-out is visible to the user.
  drawer.hidePopover();
  document.querySelector('main').inert = false;
  openBtn.setAttribute('aria-expanded', 'false');
}

// Treat "any pixel of the sheet visible inside the popover root" as
// "open enough to count as not closed". This threshold is intentionally
// tiny so the closed callback only fires once the sheet is truly gone.
const visibleThreshold = 1 / window.innerWidth;

const observer = new IntersectionObserver(
  (entries) => {
    // During programmatic scrolling the observer can deliver multiple
    // entries in one batch. Only the most recent describes the
    // current state; earlier entries are intermediate positions.
    const entry = entries.at(-1);
    if (entry.intersectionRatio < visibleThreshold) onDrawerClosed();
    if (entry.intersectionRatio === 1) onDrawerOpened();
  },
  // root: drawer makes the popover element the intersection root,
  // so the ratio reflects the sheet's visibility within the popover
  // (i.e. how much of it has been swiped on-screen).
  {root: drawer, threshold: [visibleThreshold, 1]},
);
observer.observe(sheet);
```

### 5. Wire up the trigger and dismissal handlers

```js
// Open trigger.
openBtn.addEventListener('click', openDrawer);

// Light-dismiss: a tap on the dimmed area (anywhere inside the
// popover but outside the sheet) closes the drawer. We implement
// this manually because popover="manual" disables the browser's
// built-in light-dismiss (which would also fire mid-swipe — see step 1).
drawer.addEventListener('click', (event) => {
  if (!sheet.contains(event.target)) closeDrawer();
});

// Escape key. Listen on document because focus may be inside the
// drawer when the user presses Escape.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});
```

### Fallback strategies

The drawer's core mechanics — scroll snap, `IntersectionObserver`, and `inert` — are all Baseline Widely available and required for the component to function. The popover API, the scroll-driven animation that fades the backdrop, and `scroll-initial-target` are progressive enhancements with simple fallbacks that can be easily implemented if wide browser support is required.

#### Backdrop fade fallback (no `animation-timeline` support):

Scroll-driven animations has limited availability.
Supported by: Chrome 115 (Jul 2023), Edge 115 (Jul 2023), and Safari 26 (Sep 2025).
Unsupported in: Firefox.

Detect with `CSS.supports('animation-timeline: scroll()')` and write `--drawer-backdrop` from a `scroll` event listener if not supported. The CSS `@supports` block in step 2 ensures the keyframes never apply in unsupported browsers, so the JavaScript value is the only writer.

```js
if (!CSS.supports('animation-timeline: scroll()')) {
  scroller.addEventListener('scroll', () => {
    // Same mapping as the @keyframes: 0 scroll = 1 (open),
    // sheet-width scroll = 0 (closed).
    const ratio = 1 - scroller.scrollLeft / sheet.offsetWidth;
    drawer.style.setProperty('--drawer-backdrop', ratio);
  });
}
```

#### Initial scroll position fallback (no `scroll-initial-target` support):

scroll-initial-target has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

Detect with `CSS.supports('scroll-initial-target', 'nearest')` and inside `openDrawer()`, jump-scroll the scroller to the closed position immediately after `showPopover()`. Without this, the drawer would appear instantly in the open position with no slide-in animation.

```js
async function openDrawer() {
  drawer.showPopover();

  if (!CSS.supports('scroll-initial-target', 'nearest')) {
    // Jump-scroll to the closed stop so the scroll below
    // animates the drawer in from off-screen.
    scroller.scrollTo({left: scroller.offsetWidth, behavior: 'instant'});
    // Wait two animation frames for the jump-scroll to commit.
    // A single rAF is not enough — the second `scrollTo` would
    // cancel the first before the browser has a chance to apply it.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
  }

  scroller.scrollTo({left: 0, behavior: 'auto'});
}
```

#### `@property` fallback (no registered custom properties):

Baseline status for Registered custom properties: Newly available. It's been Baseline since 2024-07-09.
Supported by: Chrome 85 (Aug 2020), Edge 85 (Aug 2020), Firefox 128 (Jul 2024), and Safari 16.4 (Mar 2023).

`@property` is only needed because the scroll-driven animation interpolates `--drawer-backdrop` between keyframes — without registration, the property would be treated as a string and would jump between 0 and 1 with no fade. If the scroll-driven animation fallback above is in place, that JavaScript writes a fresh numeric string to `--drawer-backdrop` on every scroll frame and never interpolates, so no separate `@property` fallback is needed since all browsers that support scroll-driven animations also support `@property`.


#### Popover API fallback (no `popover` attribute support):

Baseline status for the api.HTMLElement.showPopover capability: Newly available. It's been Baseline since 2024-04-16.
Supported by: Chrome 114 (May 2023), Edge 114 (Jun 2023), Firefox 125 (Apr 2024), and Safari 17 (Sep 2023).

Because this component uses `popover="manual"` and implements dismissal entirely from JavaScript, it does not depend on the popover API's defining behaviors — light-dismiss, the `popovertarget` attribute, top-layer-managed Escape handling, or focus management. The only popover features it actually uses are top-layer promotion (via `showPopover()`) and the `::backdrop` pseudo-element, which have been Baseline since April 2024.

If wider browser support is needed, do not branch on feature detection — simply do not use popover at all. Drop the `popover="manual"` attribute, replace top-layer promotion with `position: fixed` and a high `z-index`, replace `::backdrop` with a sibling element styled identically (using the same `--drawer-backdrop` custom property), and toggle visibility from a class instead of `showPopover()`/`hidePopover()`. The rest of the component (scroll snap, the scroll-driven backdrop animation, the `IntersectionObserver`, and the dismissal handlers) is unchanged.


--- Guide for customize-scrollbar-color-and-thickness ---
# Customize the color or thickness of a scrollbar

You can customize the appearance of scrollbars using the standard CSS properties `scrollbar-color` and `scrollbar-width`.

*   **`scrollbar-color`**: Accepts two `<color>` values. The first applies to the thumb (the moving part), and the second to the track (the fixed background).
*   **`scrollbar-width`**: Accepts `auto` (default), `thin` (a thinner variant), or `none` (hides the scrollbar completely while maintaining scrollability).

## Apply `scrollbar-color` and `scrollbar-width`

MANDATORY: Use `scrollbar-color` and `scrollbar-width` on the scrollable container.

When using `scrollbar-color`, use CSS variables to keep thumb and track colors separate, for readability and maintainability (especially when using fallbacks).

```css
.scroller {
  --scrollbar-thumb: var(--color-neutral-70);
  --scrollbar-track: var(--color-neutral-90);

  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}
```

## Fallback strategies

Baseline status for scrollbar-width: Newly available. It's been Baseline since 2024-12-11.
Supported by: Chrome 121 (Jan 2024), Edge 121 (Jan 2024), Firefox 64 (Dec 2018), and Safari 18.2 (Dec 2024).

### Fallbacks & browser support for scrollbar-color

Baseline status for scrollbar-color: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 121 (Jan 2024), Edge 121 (Jan 2024), Firefox 64 (Dec 2018), and Safari 26.2 (Dec 2025).

This feature is progressive enhancement and does not always require fallbacks.

If the styling is important and the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.

Wrap legacy fallbacks in an `@supports not (scrollbar-color: auto)` block to prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively.

If you are using custom properties to define colors, these will cascade to the legacy WebKit selectors automatically. You do NOT need to duplicate them.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }

  .scroller::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }

  .scroller::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
}
```



--- Guide for visually-texture-content ---
## Overview
To apply realistic weathering or texture patterns (like grunge, noise, or paper texture) to an element, use CSS Masking (`mask-image`) with a repeating texture image. This allows you to make the content itself appear textured by making parts of it semi-transparent, rather than just overlaying a texture on top. This creates a more realistic physical material appearance.

## Implementation
To apply a texture pattern:

### Method 1: Using a repeating raster image (Recommended for realistic textures)
This is the most common method for realistic textures.

```css
.weathered-element {
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: url('grunge-pattern.png');
  -webkit-mask-repeat: repeat; /* Repeat the pattern to fill the area */
  -webkit-mask-size: 300px; /* Control the scale of the texture */

  /* Standard property for modern browsers */
  mask-image: url('grunge-pattern.png');
  mask-repeat: repeat;
  mask-size: 300px;
}
```

### Method 2: Using CSS Gradients for geometric patterns
You can generate patterns using CSS gradients. This is self-contained and does not require external image files.

```css
.patterned-element {
  --checkerboard-gradient: 
    linear-gradient(45deg, #000 25%, transparent 25%), 
    linear-gradient(-45deg, #000 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #000 75%), 
    linear-gradient(-45deg, transparent 75%, #000 75%);

  /* Apply a checkerboard pattern as a mask */
  -webkit-mask-image: var(--checkerboard-gradient);
  -webkit-mask-size: 20px 20px;
  -webkit-mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  
  mask-image: var(--checkerboard-gradient);
  mask-size: 20px 20px;
  mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
```

### Alpha vs Luminance Masking Modes

By default, CSS masks use `mask-mode: match-source`. This means the browser automatically decides whether to use the **alpha channel** (transparency) or the **luminance** (brightness) of the mask based on what kind of source you provide:

| Mask Source Type | Default Mask Mode | Masking Behavior |
| :--- | :--- | :--- |
| **Inline SVG `<mask>` element** | `luminance` | Opacity is determined by the brightness of colors. **White** reveals content, **black** hides it, and **gray** creates semi-transparency. |
| **Direct Image File** (e.g. PNG, SVG file) | `alpha` | Opacity is determined by transparency. **Opaque** parts reveal content, and **transparent** parts hide it. |
| **CSS Gradient** | `alpha` | Opacity is determined by transparency. **Opaque** colors (like `black`) reveal content, and **transparent** colors hide it. |

> **Note:** You can explicitly override the default mask mode using the `mask-mode` CSS property (e.g., `mask-mode: luminance;` or `mask-mode: alpha;`).

## Fallback strategies
Baseline status for Masks: Widely available. It's been Baseline since 2023-12-07.
Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).

If a browser does not support `mask-image` or the prefixed version:
- The element will display without the texture (clean and solid fill).
- Ensure the content is still readable without the texture (progressive enhancement).
- You can use a background image or an overlay as a fallback to simulate the texture, although it will not affect the transparency of the content itself.

```css
/* Fallback: Use a background image for browsers without mask support */
@supports (not (mask-image: url(x))) and (not (-webkit-mask-image: url(x))) {
  .weathered-element {
    /* Fallback adds texture on top or behind, depending on implementation */
    background-image: url('grunge-pattern.svg');
    background-color: #fff; /* Ensure background is solid if needed */
  }
}
```


--- Guide for dark-mode ---
# Dark mode

The `color-scheme` property indicates which color schemes (such as light or dark) your page supports. This informs the browser that it can automatically theme native UI elements—like scrollbars, form controls, and the default canvas background—to match your site's design and help minimize white flashes during initial loading.

## Implementation

### 1. Declare supported schemes in HTML

MANDATORY: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- MANDATORY: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Apply page-wide color scheme to CSS :root or html

MANDATORY: Apply the `color-scheme` property to the `html` element or the `:root` pseudo-class. Browsers specifically look to the root element to determine the theme for the entire viewport—including the root scrollbars and the initial "canvas" background. If applied only to the `body`, these global UI surfaces may remain in light mode because the `body` does not control the window's rendering context.

```css
/* MANDATORY: Apply color-scheme to :root or html for viewport-wide theming */
:root {
  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}
```

### 3. Define light and dark color tokens

You can use the `light-dark()` function to define color tokens that automatically adapt to different `color-scheme` values.

It is recommended that you also keep the raw color values in separate custom properties, which makes it easier to combine them in different ways (and makes fallback behavior easier, if needed).

For more control over the colors of built-in UI such as `accent-color` or `scrollbar-color`, authors **can optionally** add their own dynamic colors with use of custom properties and/or the `light-dark()` function. This function automatically picks the correct color based on the computed `color-scheme` of the element and eliminates the need for redundant media queries, but is not required for a basic implementation.

```css
:root {
  --color-brand-light: oklch(45% 0.23 270);
  --color-brand-dark: oklch(85% 0.15 210);
  --color-brand-text-light: white;
  --color-brand-text-dark: oklch(40% 0.23 270);

  --color-brand: light-dark(var(--color-brand-light), var(--color-brand-dark));
  --color-brand-text: light-dark(var(--color-brand-text-light), var(--color-brand-text-dark));

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}

button.primary {
  /* These automatically adapt to color scheme */
  background-color: var(--color-brand);
  color: var(--color-brand-text);
}
```

OPTIONAL: A number of system colors are available, which also automatically adapt to the used color scheme (and other color modes, e.g. forced colors), such as `canvas`, `canvastext`, `accentcolor` (check support) , `buttonborder` etc. These are typically too limited to be useful, beyond very specific cases where you need to exactly match certain default browser UI or as fallbacks/defaults.

#### OPTIONAL: Tailor color pairs to context

Even when overriding the system default, it can be useful to use the `prefers-color-scheme` media query to define **different** color pairs that take into account the colors of the browser and OS chrome around the page (or of the surrounding page, when the page is used as an iframe).

For example, use a slightly dimmer light theme when the system setting is `dark`, or a more contrasting dark theme when the system setting is `light`, so the page is not visually overpowered by the surrounding UI.


## Fine-grained browser UI customization

Setting `color-scheme` already adapts browser UI to the used color scheme, but this will use OS defaults and/or system colors that may not perfectly align with the website design.
Modern browsers expose several fine-grained customization hooks for these.
Do not reimplement native controls simply to customize their appearance without exhausting the customization hooks modern browsers provide.

### Setting the accent color

Some browser UI (e.g. checked checkboxes or sliders) uses an accent color.
This resolves to the OS setting by default, but you can use the `accent-color` property to set it to a color that better aligns with the page, such as the page's brand color.

```css
html {
  accent-color: light-dark(var(--color-accent-light), var(--color-accent-dark));
}
```

### Issues to be aware of when using accent-color

- When placing visual elements over the accent color (e.g. a checkbox checkmark), Chrome and Safari will automatically select a contrasting color, whereas Safari will modify the accent color, and may not maintain adequate contrast.

### Scrollbar colors

You can use `scrollbar-color` together with `light-dark()` to set custom scrollbar colors that adapt to the color scheme used.

```css
:root {
  --color-scrollbar-track: light-dark(#eee, #222);
  --color-scrollbar-thumb: light-dark(#999, #666);
  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}
```

### Issues to be aware of when using scrollbar-color

- Do NOT animate or transition `scrollbar-color`. A [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=311752) causes the scrollbar to flicker every time `scrollbar-color` changes.
- On macOS, `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. You MUST pair custom colors with `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render them.
- Even with `scrollbar-width` applied, macOS overlay scrollbars render the track (gutter) as transparent by default. If the design requires a visible track background color on MacOS, you MUST apply `scrollbar-gutter: stable;` to the scrollable container, but note that it only appears after the user hovers over the scrollbar.
- Even with `scrollbar-gutter: stable` the track may be transparent on MacOS. The thumb should not depend on the track color to be visible.

### Further customization

Most browser UI exposes pseudo-elements to fully customize its appearance, such as:
- `::placeholder`
- `::spelling-error`
- `::grammar-error`
- `::selection`
- `::search-text`
- `::target-text`
- `::file-selector-button`

You can use `light-dark()` colors on any of these to apply colors that adapt to the used color scheme.

## OPTIONAL: Implementing a color-scheme toggle

**DO NOT** set `color-scheme: light` or `color-scheme: dark` on the root element by default.
The default color-scheme MUST be the user's system preference, which happens automatically when setting `color-scheme` to `light dark`.

For website-specific customization, a manual toggle could be provided to allow users to choose between light, dark, or system-default modes.

If a user-facing toggle to override it is desired, it should:
- Update the `<meta name="color-scheme">` element to reflect the chosen theme (`light dark` for system default, `light` for light, and `dark` for dark).
- If branching is desired for non-color values, set a class on `<html>` to match the theme preference and use descendant selectors. While `:root:has(> head > meta[name="color-scheme"][content="dark"])` would technically work, it is slower and confers no benefit, since we are already using JS to update the `<meta>` element.
- Persist user choice in `localStorage`.
- **IMPORTANT**: The CSS should be written to default to the system preference, with overrides for user-specified color-schemes. That way, if JS fails to execute, the site still defaults to the system color-scheme.
- The system-level OS theme can change at any time. If you are using JS to read `matchMedia("(prefers-color-scheme: dark)").matches`, you MUST also use `addEventListener("change", fn)` to react to changes. CSS automatically adapts to changes.
- **IMPORTANT**: To avoid a Flash of Unstyled Content (FOUC) for users who have pinned a different color scheme than their system default, use an inline script (NOT `type=module`, NOT `defer`) to set it when the page loads:

```html
<meta name="color-scheme" content="light dark">
<script>
{
  const colorScheme = localStorage.getItem("color-scheme");
  if (colorScheme) {
    document.querySelector('meta[name="color-scheme"]').content = colorScheme;
  }
}
</script>
```

### UX considerations

Use a two-state control:
1. System setting.
2. The opposite (e.g. light when the system setting is dark, and dark when the system setting is light). Selecting this setting must pin that exact color scheme, not a dynamically computed "opposite of system setting" value. Example scenario:
    1. The OS is set to light mode.
    2. The user selects the opposite setting for this website (dark).
    3. The user changes their system setting to dark.
    4. The website should remain dark.

**DON'T** expose all three states (system, light, dark). While the rationale is plausible — "Follow system (currently dark)" is a distinct user intent from "Always dark" — it provides suboptimal UX:
- Users cannot meaningfully express intent for problems they don't currently have. A manual toggle is a temporary comfort adjustment ("it's too bright right now"), not a long-term preference ("make sure this never changes").
- Two of the three options always produce the same visual result, violating the principle of feedback.

## Component-specific overrides

You can override the global theme for specific elements by setting `color-scheme` on them.
This is useful for "dark mode" sections within a light-themed site, such as code blocks or media players.

```css
pre, code {
  /* Forces element and its children to use dark themed UI */
  color-scheme: dark;
}
```

For more information about component-specific overrides and their gotchas, see `component-specific-light-dark-theme` (via `npx -y modern-web-guidance@latest retrieve "component-specific-light-dark-theme"`).

## Known issues to be aware of

### Issues to be aware of when using color-scheme

- Chrome and Firefox respect `color-scheme` for iframes: they render embedded pages in the correct color scheme and adjust the embedded page's `prefers-color-scheme` media query to reflect the embedding context's `color-scheme`. Safari does not, and resolves `prefers-color-scheme` to the system setting even inside iframes.
  - **If you control both parent and iframe:** pass the parent's color scheme to the iframe explicitly — via a URL parameter (`?theme=dark`) at iframe construction time, or via `postMessage()` (which also lets you react to runtime changes). In the iframe, set a class on `<html>` (and/or `color-scheme` on `:root`) from that signal instead of relying on `prefers-color-scheme`.
  - **If you only control the embedded page:** there is no reliable way to detect the embedding context's `color-scheme` from inside the iframe in Safari. Expose an explicit theme parameter on your embed API (e.g. a query string or `postMessage` protocol) and document it for embedders.

## Fallback strategies

### Fallbacks & browser support for color-scheme

Baseline status for color-scheme: Widely available. It's been Baseline since 2022-02-03.
Supported by: Chrome 98 (Feb 2022), Edge 98 (Feb 2022), Firefox 96 (Jan 2022), and Safari 13 (Sep 2019).

The `color-scheme` property is **progressive enhancement**.
Browsers that do not support it will ignore this property and use their default light-mode UI.

To adapt to the user's preferences in older browsers, use `prefers-color-scheme` media queries to provide different colors when dark mode is preferred.

- DO use the media query to switch custom properties on `:root` or `html`
- Avoid using the media query on individual components unless the component requires a very specific type of dark mode customization beyond colors.

```css
:root {
  /* Define brand colors for each mode */
  --color-brand-light: #0056b3;
  --color-brand-dark: #00e5ff;
  --color-brand: var(--color-brand-light);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --color-brand: var(--color-brand-dark);
  }

  /* Ignored in older browsers */
  color-scheme: light dark;
}

button.primary {
	background-color: var(--color-brand);
}
```

### Fallbacks & browser support for light-dark()

Baseline status for light-dark(): Newly available. It's been Baseline since 2024-05-13.
Supported by: Chrome 123 (Mar 2024), Edge 123 (Mar 2024), Firefox 120 (Nov 2023), and Safari 17.5 (May 2024).

For browsers that support `color-scheme` but not yet `light-dark()`, light and dark versions of colors should first be defined as custom properties, and the `prefers-color-scheme` media query should be used to set colors for the respective mode like in the example below:

```css
:root {
  /* Define browser UI accent color for each mode */
  --brand-accent-light: #0056b3;
  --brand-accent-dark: #00e5ff;
  --accent-color: var(--brand-accent-light);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --accent-color: var(--brand-accent-dark);
  }

  /* OPTIONAL: use light-dark() for more control of built-in UI colors */
  @supports (color: light-dark(white, black)) {
    --accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));
  }

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;

  /* Example inherited color property */
  accent-color: var(--accent-color);
}

pre, code {
  color-scheme: dark;

  /* **Mandatory**: any inherited color properties must be set again, even if to the same design tokens */
  accent-color: var(--accent-color);
}
```

### Fallbacks & browser support for scrollbar-color

Baseline status for scrollbar-color: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 121 (Jan 2024), Edge 121 (Jan 2024), Firefox 64 (Dec 2018), and Safari 26.2 (Dec 2025).

This feature is progressive enhancement and does not always require fallbacks.

If the styling is important and the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.

Wrap legacy fallbacks in an `@supports not (scrollbar-color: auto)` block to prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively.

If you are using custom properties to define colors, these will cascade to the legacy WebKit selectors automatically. You do NOT need to duplicate them.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }

  .scroller::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }

  .scroller::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
}
```

### Fallbacks & browser support for accent-color

accent-color has limited availability.
Supported by: Chrome 93 (Aug 2021), Edge 93 (Sep 2021), Firefox 92 (Sep 2021), and Safari 26.2 (Dec 2025).

The `accent-color` property is progressive enhancement.
Browsers that do not support this property will ignore it and use their default UI colors.

