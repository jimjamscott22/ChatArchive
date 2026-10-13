# Frontend review checklist and initial plan

Recorded on 2026-10-09 from the supplied React Best Practices review. Findings 1 and 3 are complete; the remaining items
remain open. Check off a finding only after its behavior and acceptance checks
have been verified.

The review identified opportunities for more reliable conversation switching,
smoother long-thread reading, and better keyboard behavior while preserving
ChatArchive's existing archival style. It covered React performance plus
interaction and accessibility source code. It was a source-code review with
tests and a production build; it did not include a visual browser audit.

## Findings

- [x] **1. High priority — Prevent conversation switching from showing the wrong thread.**
  Opening A and then B starts requests without guarding against out-of-order
  responses; A can replace B if it finishes last. The normal reader has no
  dedicated detail-loading state, and network failures are only logged.
  Add latest-request protection, a visible loading indicator, and an inline
  error with Retry. Keep the selected row and reader consistent.
  Evidence: [conversation loading](../frontend/src/App.tsx#L579).

- [ ] **2. High priority — Isolate the expensive Markdown reader from unrelated UI updates.**
  Markdown and syntax highlighting render inside the main `App` component,
  which also rerenders for search typing, sidebar resizing, and menu changes.
  The main reader and standalone view duplicate the rendering path.
  Extract a shared memoized reader, stabilize its Markdown configuration, and
  cache message ordering. Profile a long, code-heavy conversation before
  deciding whether incremental rendering is necessary; actual latency has not
  been measured. Skill rules: `rerender-memo`, `rerender-no-inline-components`.
  Evidence: [Markdown configuration](../frontend/src/App.tsx#L1286),
  [message rendering](../frontend/src/App.tsx#L2464).

- [x] **3. High priority — Scope arrow-key navigation and complete theme-picker keyboard support.**
  The global Up/Down handler runs outside inputs and dialogs, including in the
  reader and theme options. The theme picker declares menu semantics but lacks
  arrow-key navigation, focus management, and Escape dismissal, so arrows can
  switch conversations behind it. Restrict conversation navigation to the
  list, give the picker its own keyboard handling, and restore trigger focus
  on dismissal.
  Evidence: [global shortcuts](../frontend/src/App.tsx#L281),
  [theme picker](../frontend/src/App.tsx#L2586).

- [ ] **4. Medium priority — Keep search results visible while refreshing.**
  Every search request replaces the list with skeletons, removing context and
  unmounting rows while users refine a query. Reserve skeletons for initial
  loading; retain previous results during refresh with an “Updating results…”
  status and an accessible busy indication. Preserve stale-response protection.
  Evidence: [list loading UI](../frontend/src/App.tsx#L1730).

- [ ] **5. Medium priority — Reduce the initial JavaScript download.**
  The reviewed production build reported a single **536.32 kB JavaScript
  bundle (162.85 kB gzipped)** and a Vite size warning. Markdown/highlighting
  loads eagerly; settings, duplicate management, and analytics share the
  application module. Introduce lazy-loading boundaries around the reader and
  infrequently opened tools with appropriately sized loading placeholders.
  Measure entry-bundle size and the first-open experience.
  Skill rule: `bundle-conditional`.
  Evidence: [eager imports](../frontend/src/App.tsx#L1).

- [ ] **6. Medium priority — Replace disruptive browser alerts with contextual feedback.**
  Tagging, moving, deleting, and other actions use native `alert()` or
  `confirm()` dialogs, interrupting work with limited context or recovery.
  Use non-blocking success messages, inline actionable errors, and the existing
  dialog pattern for destructive confirmations.
  Evidence: [tagging feedback](../frontend/src/App.tsx#L738),
  [deletion confirmation](../frontend/src/App.tsx#L941).

Evidence links retain the supplied review's line numbers; these may move as
implementation progresses and have not been revalidated for this document.

## Existing foundations and review verification

- Search is debounced and protects against stale responses.
- Initial requests start independently.
- Dialogs use native `<dialog>` elements.
- Theme selection persists and exposes checked-state semantics.
- The supplied review reported **15 frontend tests passed** and a successful
  **TypeScript/Vite production build**, with the bundle warning above.
- The review changed no source files. Mobile layout, contrast across all 11
  themes, and actual rendering performance remain unverified in a browser.
- This documentation task does not rerun or independently confirm those
  historical checks.

## Brief plan: tackle findings 1, 3, then 2

Preserve existing styles, CSS theme tokens, menu radio semantics, reduced-motion
support, and the authenticated `apiFetch()` path. Use the existing frontend test
patterns and update fetch mocks where needed. The first two steps are implemented and verified below. Reader optimization
remains the next step.

1. [x] **Make conversation loading reliable (finding 1).**
   Update `frontend/src/App.tsx` with a request identity guard and dedicated
   loading/error state; only the latest selection may update details or status.
   Add reader loading and Retry UI using `frontend/src/styles.css`.
   Extend `frontend/src/App.test.tsx` to cover A/B responses finishing in
   reverse order, a stale failure after B succeeds, and failure followed by
   Retry. Acceptance: the reader matches the selected row, stale responses
   cannot overwrite it, and the current request exposes loading and recovery.

2. [x] **Fix keyboard scope and theme-picker focus (finding 3).**
   Update `frontend/src/App.tsx` so conversation arrows work only within the
   list. Give the picker focus on opening, Up/Down navigation, Home/End,
   Enter/Space selection, Escape dismissal, and focus return to its trigger.
   Extend `frontend/src/App.test.tsx` to verify arrows in the reader or picker
   never change the selected conversation, list navigation still works, and
   dismissal restores focus. Check theme persistence and keyboard use in a
   browser, including dismissal by clicking outside the picker.

3. [ ] **Share and memoize the Markdown reader (finding 2).**
   Record a React Profiler baseline for a long, code-heavy conversation.
   Extract `frontend/src/components/ConversationReader.tsx` for both normal
   and standalone views, keep Markdown configuration stable, and memoize
   ordering and rendering with stable props. Add reader tests for message
   order, Markdown/code output, and both viewing paths. Compare profiler
   results during search typing, resizing, and menu changes; only consider
   incremental rendering if measured latency remains a problem.

For each implementation step, run `npm test` and `npm run build` from
`frontend/`, perform the relevant browser checks, and record results before
checking off the corresponding finding. Inspect desktop/mobile rendering and
theme switching after shared reader changes. Keep each step in a focused
commit. Findings 4–6 remain queued for later work.

## Implementation verification — 2026-10-12

Completed findings 1 and 3 in `frontend/src/App.tsx`, with regression tests in
`frontend/src/App.test.tsx`. Conversation requests now guard both fetch and JSON
completion, select the requested row immediately, clear old reader content,
show an accessible loading status or inline error with Retry, and invalidate
pending responses on Home, analytics, archive changes, and authentication loss.
Normal and standalone readers share this request/error behavior.

Conversation arrows are handled only on focused list rows and move focus to the
new row. The theme menu focuses its checked option when opened, supports wrapping
Up/Down plus Home/End, preserves native Enter/Space activation, closes on Escape,
Tab, and outside click, and restores trigger focus for selection, Escape, and
outside dismissal. Shortcut help now describes the list-only arrow scope.

- `cd frontend && npm test`: **24 tests passed**, including nine new regression
  cases for stale success/failure, errors and Retry, missing/malformed responses,
  standalone recovery, leaving a pending reader, and keyboard/focus behavior.
- `cd frontend && npm run build`: **passed** TypeScript and Vite compilation.
  The bundle remains **538.06 kB (163.39 kB gzipped)** with the existing Vite size
  warning; finding 5 remains open.
- Playwright/Chromium against `http://127.0.0.1:5174/` with mocked API responses:
  verified desktop (1440 × 1000) and mobile (390 × 844) theme interaction,
  stale-response rejection, loading, error/Retry, list focus/navigation, menu
  arrows/Home/End/Enter/Space/Escape/Tab, outside dismissal, focus return, and
  theme persistence after reload. Screenshots were kept outside the repository.
  No framework overlay, blank screen, uncaught application errors, or unexpected
  console errors; the intentional missing-conversation response logged its
  expected HTTP 404. The Browser skill/plugin was unavailable, so bundled
  Playwright was used.
- No live database/provider verification or full contrast audit across all 11
  themes was performed. Backend code and API contracts were unchanged.

Finding 2 (shared memoized reader and profiling) is next. Findings 4–6 remain
queued. No performance improvement is claimed by this pass.
