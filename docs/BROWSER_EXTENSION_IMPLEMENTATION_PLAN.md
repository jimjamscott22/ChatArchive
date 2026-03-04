# Browser Extension Implementation Plan

## Purpose and Scope

This document outlines a concrete plan to build a browser extension that automatically captures and archives AI-assistant conversations from supported chat sites (ChatGPT, Claude, GitHub Copilot, Gemini) directly into the ChatArchive backend — without requiring manual export/import.

The extension targets the same conversation data model already used by the existing import pipeline (`source`, `source_id`, `title`, `messages`) so no breaking schema changes are needed.

---

## MVP Goals

1. Auto-detect when a conversation ends or is navigated away from on a supported site.
2. Extract the conversation (title, messages, source ID) via a content script.
3. Send the payload to the running local ChatArchive backend over `http://localhost:8000`.
4. Deduplicate against already-archived conversations using `source_id`.
5. Show a minimal popup indicating archive status (success / queued / error).

Out-of-scope for MVP:
- Cloud/remote backend support (localhost only)
- Semantic tagging from the extension (tagging runs server-side on ingest)
- Firefox support (Chrome/Chromium first)

---

## Proposed Extension Architecture (Manifest v3)

```
extension/
├── manifest.json            # MV3 manifest
├── background/
│   └── worker.js            # Service worker – queue, retry, send to API
├── content/
│   ├── adapters/
│   │   ├── chatgpt.js       # ChatGPT DOM adapter
│   │   ├── claude.js        # Claude DOM adapter
│   │   ├── copilot.js       # GitHub Copilot adapter
│   │   └── gemini.js        # Gemini adapter
│   └── content.js           # Shared content-script bootstrap
├── popup/
│   ├── popup.html
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Components

| Component | Role |
|---|---|
| `manifest.json` | Declares permissions, host patterns, and scripts |
| `content.js` | Injected into matching pages; selects and runs the correct site adapter |
| `adapters/<site>.js` | Site-specific DOM scraping logic returning a normalized payload |
| `background/worker.js` | Receives messages from content scripts, manages the send queue, retries on failure |
| `popup/` | Simple status UI – last archived conversation, queue depth, error indicator |
| `options/` | User-configurable backend URL, pause/resume toggle, per-site enable/disable |

### `manifest.json` skeleton

```json
{
  "manifest_version": 3,
  "name": "ChatArchive",
  "version": "0.1.0",
  "description": "Auto-archive AI conversations to your local ChatArchive instance.",
  "permissions": ["storage", "alarms"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://github.com/copilot/*",
    "https://gemini.google.com/*",
    "http://localhost:8000/*"
  ],
  "background": { "service_worker": "background/worker.js" },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://github.com/copilot/*",
        "https://gemini.google.com/*"
      ],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": { "default_popup": "popup/popup.html" }
}
```

---

## Backend Integration Points and API Contract

### New endpoint: `POST /import/extension`

The extension sends a single conversation payload. This endpoint mirrors the existing import logic but accepts JSON instead of a file upload.

**Request body:**

```json
{
  "source": "chatgpt",
  "source_id": "abc123",
  "title": "Python help",
  "created_at": "2024-06-01T12:00:00Z",
  "updated_at": "2024-06-01T12:30:00Z",
  "messages": [
    {
      "role": "user",
      "content": "How do I reverse a list in Python?",
      "timestamp": "2024-06-01T12:00:05Z"
    },
    {
      "role": "assistant",
      "content": "You can use `my_list[::-1]` or `list.reverse()`.",
      "timestamp": "2024-06-01T12:00:10Z"
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": 42,
  "source": "chatgpt",
  "source_id": "abc123",
  "title": "Python help",
  "created_at": "2024-06-01T12:00:00",
  "updated_at": "2024-06-01T12:30:00",
  "message_count": 2,
  "action": "created"
}
```

`action` is `"created"` for new conversations or `"updated"` when the same `source_id` already exists and the incoming payload has a newer `updated_at`.

**Response (200 OK – duplicate, no-op):**

```json
{
  "id": 42,
  "action": "no_change"
}
```

**Authentication header (when token is configured):**

```
X-ChatArchive-Token: <extension-token>
```

---

## Data Normalization Strategy

The extension payload maps directly to the existing `Conversation` / `Message` schema:

| Extension field | DB column | Notes |
|---|---|---|
| `source` | `conversations.source` | Lowercase site name |
| `source_id` | `conversations.source_id` | Site's own conversation ID |
| `title` | `conversations.title` | Scraped from page `<h1>` / conversation header |
| `created_at` | `conversations.created_at` | ISO-8601 UTC |
| `updated_at` | `conversations.updated_at` | ISO-8601 UTC |
| `messages[].role` | `messages.role` | `"user"` or `"assistant"` |
| `messages[].content` | `messages.content` | Plain text or markdown |
| `messages[].timestamp` | `messages.timestamp` | Optional; null if not available |

Server-side auto-tagging runs after ingest using the existing `TaggerEngine`, identical to the file-import flow.

---

## Site Adapter Strategy

Each adapter is a small ES module that implements a single function:

```js
// adapters/chatgpt.js
export function scrape() {
  const sourceId = window.location.pathname.split('/c/')[1]?.split('/')[0];
  if (!sourceId) return null;

  const title = document.querySelector('h1')?.innerText?.trim() ?? 'Untitled';
  const turns = [...document.querySelectorAll('[data-message-author-role]')];
  const messages = turns.map(el => ({
    role: el.dataset.messageAuthorRole,   // 'user' | 'assistant'
    content: el.innerText.trim(),
    timestamp: el.dataset.messageCreatedAt ?? null,
  }));

  return { source: 'chatgpt', source_id: sourceId, title, messages };
}
```

| Site | Source ID strategy | Message selector hint |
|---|---|---|
| ChatGPT | URL path `/c/<id>` | `[data-message-author-role]` |
| Claude | URL path `/chat/<uuid>` | `.human-turn`, `.ai-turn` |
| GitHub Copilot | URL fragment or session token | `.user-message`, `.assistant-message` |
| Gemini | URL param `?bard=<id>` | `[data-conversation-id]` turns |

Adapters use DOM selectors and must tolerate site redesigns gracefully (return `null` on failure so the worker skips silently).

---

## Reliability Strategy

### Send Queue

The background worker maintains a persistent queue in `chrome.storage.local`:

```
queue: [
  { id: "<uuid>", payload: {...}, attempts: 0, nextRetry: <timestamp> },
  ...
]
```

1. Content script sends `{ type: "ARCHIVE", payload }` to the worker.
2. Worker appends to queue and attempts immediate send.
3. On success: item removed from queue.
4. On failure (network error, 5xx): `attempts++`; exponential back-off (5 s, 30 s, 5 min, 30 min, drop after 5 attempts).
5. `chrome.alarms` ticks every 60 seconds to drain the queue.

### Idempotency / Dedup

The server deduplicates by `(source, source_id)`. Sending the same conversation twice is safe and results in `action: "no_change"`. The worker clears the item from the queue on any 2xx response.

---

## Security and Auth Considerations

| Concern | Approach |
|---|---|
| Unauthenticated access | Optional `X-ChatArchive-Token` header; server checks against a hashed token stored in `.env` (`EXTENSION_API_TOKEN`). Disabled by default for localhost-only setups. |
| CORS | Backend adds `chrome-extension://*` to `allow_origins` when the token feature is enabled. |
| Rate limiting | Server enforces `MAX_EXTENSION_RPM=60` (configurable). Requests beyond the limit receive `429`. Worker backs off for 60 s on `429`. |
| Data in transit | HTTPS is used when the backend is deployed remotely; localhost is HTTP only (acceptable for local use). |
| Sensitive content | The extension never transmits data to any third party — only to the user's own configured backend URL. |
| Manifest permissions | Only the minimum required `host_permissions` are declared; no `<all_urls>`. |

---

## Testing Strategy

### Unit tests (Jest / Vitest)

- Adapter scrape functions: mock `document` via `jsdom`; assert normalized payload shape.
- Queue logic: mock `chrome.storage.local`; assert retry back-off intervals.

### Integration tests (Playwright or WebdriverIO)

- Load a static HTML snapshot of each supported site.
- Load the unpacked extension.
- Assert that a conversation payload reaches the mock backend server.

### Backend tests (pytest – extending existing test suite)

- `POST /import/extension` with valid payload → 201 + correct DB row.
- Duplicate `source_id` → 200 + `action: "no_change"`.
- Invalid payload (missing `source`) → 422.
- Token mismatch → 401.

### Manual smoke tests

- Install unpacked extension in Chrome.
- Open a ChatGPT/Claude conversation.
- Navigate away; verify the conversation appears in ChatArchive UI.

---

## Phased Milestone Plan

### Milestone 1 – Backend endpoint (1 week)
- Implement `POST /import/extension` in `backend/app/main.py`.
- Add request schema to `backend/app/schemas.py`.
- Write pytest tests for the new endpoint.
- Document endpoint in `docs/API.md`.

### Milestone 2 – Extension scaffold + ChatGPT adapter (1 week)
- Create the `extension/` directory with MV3 manifest, background worker skeleton, and popup.
- Implement `adapters/chatgpt.js`.
- Manual smoke-test against local ChatArchive.

### Milestone 3 – Claude and Gemini adapters (1 week)
- Implement `adapters/claude.js` and `adapters/gemini.js`.
- Write jsdom-based unit tests for both adapters.

### Milestone 4 – GitHub Copilot adapter + queue/retry (1 week)
- Implement `adapters/copilot.js`.
- Implement persistent send queue with exponential back-off in `background/worker.js`.
- Add `chrome.alarms`-based queue drain.

### Milestone 5 – Auth, options UI, and packaging (1 week)
- Add `X-ChatArchive-Token` support (optional; backend + extension).
- Build options page (backend URL, per-site toggles, token input).
- Add CORS update for extension origin.
- Package as a `.zip` for Chrome Web Store submission.

### Milestone 6 – End-to-end tests and documentation (1 week)
- Playwright E2E tests for each site adapter.
- Update `README.md` and `docs/` with extension install and configuration instructions.
- Final code review and release tag.

---

## Definition of Done for MVP

- [ ] `POST /import/extension` endpoint is live and returns correct responses for create, update, and no-change cases.
- [ ] ChatGPT, Claude, Gemini, and GitHub Copilot adapters successfully extract conversations in manual testing.
- [ ] Background worker persists queue to `chrome.storage.local` and retries on failure.
- [ ] Duplicate conversations are deduplicated by `source_id` without error.
- [ ] Popup shows last-archived conversation and any queue errors.
- [ ] All new pytest and Jest tests pass in CI.
- [ ] `docs/API.md` documents the new endpoint.
- [ ] Extension has been loaded as an unpacked extension and archived at least 5 real conversations end-to-end.
