# Export Bundle Resources Specification

Status: Proposed  
Target: ChatArchive  
Initial providers: ChatGPT and Claude

## 1. Summary

ChatArchive currently imports one extracted conversation JSON file at a time and
normalizes it into conversations and text messages. This feature adds support
for importing a provider's complete data-export ZIP while preserving useful
non-conversation content:

- provider project membership and available project metadata;
- generated artifacts such as Claude code, HTML, React, Markdown, and SVG
  artifacts;
- attachment metadata and extracted document text;
- images, documents, audio, and generated files when their bytes are present in
  the export;
- explicit records for referenced files whose bytes are absent.

The feature is an archive and discovery capability. It does not promise to
recreate a ChatGPT or Claude account, restore provider-native projects, or
recover files that the provider omitted.

## 2. Background

The current import flow is conversation-centric:

1. `ImportModal` accepts one `application/json` file.
2. `/import/{source}` rejects non-JSON filenames and caps uploads at 100 MB.
3. A source parser produces `Conversation` and linear `Message` dictionaries.
4. `_ingest_parsed_conversations` stores those rows.
5. The reader renders every message as Markdown.

Some additional content is already preserved lossily:

- Claude artifact tool blocks become Markdown code fences.
- Claude attachment extracted text is appended to the parent message.
- ChatGPT image-only content becomes `[image]`.
- Unrecognized conversation fields remain in `Conversation.raw_json`, but are
  not exposed as structured data.

ChatArchive's existing `Project` model is a local folder. It is not currently
linked to ChatGPT Projects or Claude Projects.

Provider exports are not a stable public API. OpenAI's and Anthropic's
documented guarantees differ by plan and may change. Import must therefore
discover capabilities from the files actually supplied and report omissions
without failing the entire bundle.

## 3. Goals

### 3.1 User goals

- Upload the original ChatGPT or Claude export ZIP without manually extracting
  `conversations.json`.
- Keep conversations grouped by their provider project when an association is
  present.
- Find, inspect, and download generated artifacts and bundled files from the
  conversation reader.
- Search textual artifacts and extracted attachment text.
- See whether a referenced resource was stored, represented by metadata only,
  or unavailable from the export.
- Re-import a newer export without creating duplicate provider projects or
  resources when auto-merge is enabled.
- Delete an import and its owned resources using the existing import-history
  workflow.

### 3.2 Engineering goals

- Preserve existing direct JSON imports and their response contract.
- Keep source-specific parsing separate from archive safety and persistence.
- Use additive database changes.
- Keep the default backend parser test suite offline; parser tests must not
  import `app.main` or `app.database`.
- Treat all imported content as untrusted.
- Avoid fetching provider URLs during import.

## 4. Non-goals

The initial release will not:

- restore data into ChatGPT or Claude;
- import account profile, billing, subscriptions, sessions, feedback,
  model-comparison votes, telemetry, or audit logs;
- import or execute credentials, connectors, Custom GPT actions, or tool
  secrets;
- reconstruct files whose bytes are not in the uploaded archive;
- follow signed, authenticated, or expiring provider URLs;
- perform OCR, speech-to-text, document conversion, or malware scanning;
- execute imported code;
- render imported HTML or SVG in the application origin;
- import nested ZIP archives;
- preserve every ChatGPT regeneration branch;
- replace the existing local project-management feature.

`chat.html` and other rendered conversation copies are inventory entries only;
the structured conversation JSON remains authoritative.

## 5. Terminology

- **Bundle**: one uploaded ZIP produced by a provider's data-export workflow.
- **Bundle entry**: a file listed in the ZIP central directory.
- **Resource**: a useful non-message item associated with an import, project,
  conversation, or message.
- **Artifact**: generated textual or visual work represented in conversation
  data, such as a Claude artifact or ChatGPT canvas-like document.
- **Attachment**: a user-uploaded or provider-generated file.
- **Provider project**: a ChatGPT or Claude project identifier and metadata.
- **Availability**:
  - `stored`: resource bytes are stored in private object storage;
  - `inline`: complete textual content is stored in PostgreSQL;
  - `metadata_only`: the export describes the resource but contains no bytes or
    complete text;
  - `unavailable`: the export references a resource that cannot be resolved.

## 6. Scope and prioritization

| Export content | Initial behavior |
|---|---|
| Conversation JSON | Import using the existing source parser behavior |
| Numbered ChatGPT conversation JSON files | Combine and import as one bundle |
| Provider project association | Map to a stable local project |
| Project name, description, and instructions | Preserve when present |
| Claude artifact tool blocks | Preserve in the message and create a first-class resource |
| Claude legacy artifact tags | Extract as first-class textual resources |
| Attachment filename, MIME type, size, and extracted text | Preserve when present |
| Image/file bytes included in ZIP | Store privately and link to their context |
| Referenced image/file without bytes | Create `metadata_only` or `unavailable` resource |
| Voice transcript | Preserve as searchable text |
| Audio bytes included in ZIP | Store as a downloadable resource |
| Web citations and source links | Preserve in resource/message metadata when available |
| ChatGPT canvas-like or tool-generated documents | Best-effort generic artifact import with warnings |
| Memories and custom instructions outside project metadata | Defer |
| Custom GPT definitions | Defer |
| Feedback, shares, profile, billing, telemetry | Skip |

## 7. User experience

### 7.1 Import

The import modal will:

1. Keep the provider selector.
2. Accept `.json` and `.zip`.
3. Describe ZIP import as the preferred option for projects and resources.
4. Upload a ZIP to the new bundle endpoint; direct JSON continues to use the
   existing endpoint.
5. Show progress states: uploading, validating, importing conversations,
   storing resources, and complete.
6. Show a completion summary:
   - conversations inserted, updated, and skipped;
   - projects created or matched;
   - resources stored, inline, metadata-only, and unavailable;
   - warnings grouped by category.

A bundle may finish with `partial` status when conversations are imported but
one or more optional resources cannot be stored. A malformed or unsafe archive
fails before conversation ingestion.

### 7.2 Projects

- A provider project maps to one local `Project` using `(source, source_id)`.
- Existing manual projects have null provider identity and remain unchanged.
- A provider project name collision does not overwrite or merge an unrelated
  manual project.
- If only a provider project ID is available, ChatArchive creates a renameable
  placeholder such as `Claude project ab12cd34`.
- Re-import resolves by provider identity before display name.
- Provider instructions are archived but are never treated as application
  instructions or executed.

### 7.3 Conversation reader

When a conversation has resources, the reader displays an "Artifacts & files"
section containing:

- title or filename;
- resource kind and MIME type;
- size when known;
- source project/conversation context;
- availability badge;
- preview or download action when supported.

Initial preview behavior:

- code, Markdown, and plain text: read-only text preview;
- raster images: image preview loaded through authenticated API access;
- HTML and SVG: source preview and download only;
- PDFs, office documents, audio, and unknown binaries: download only;
- missing resources: metadata and an explanation that the provider export did
  not include the bytes.

Claude artifact content remains in the message body for readable conversation
context. The resource entry is an additional structured representation, not a
replacement.

### 7.4 Search

Global search includes:

- resource title and filename;
- inline artifact content;
- attachment extracted text.

Search results continue to open the parent conversation. Resource matches
identify the matching resource in the snippet and scroll to the resource
section when practical.

## 8. Canonical import model

Source parsers will produce a shared, persistence-independent representation:

```python
ParsedBundle(
    source: str,
    conversations: list[ParsedConversation],
    projects: list[ParsedProject],
    resources: list[ParsedResource],
    inventory: list[BundleInventoryEntry],
    warnings: list[ImportWarning],
)
```

`ParsedConversation` retains the existing conversation dictionary fields and
adds `source_project_id`.

`ParsedProject` includes:

- `source`, `source_id`;
- `name`, `description`, `instructions`;
- provider timestamps when available;
- raw provider metadata.

`ParsedResource` includes:

- stable source resource ID when available;
- logical artifact ID and version index when available;
- kind (`artifact`, `image`, `attachment`, `audio`,
  `project_knowledge`, `citation`, or `other`);
- title, filename, MIME type, byte size, and SHA-256;
- inline text or an archive-entry reference, never an unbounded in-memory blob;
- provider project, conversation, and message source IDs;
- availability and raw metadata.

Parsers must not write to PostgreSQL or Supabase. Archive reading must not
depend on provider-specific parsing.

## 9. Database model

### 9.1 `projects` additions

- `source VARCHAR(50) NULL`
- `source_id VARCHAR(255) NULL`
- `instructions TEXT NULL`
- `raw_json TEXT NULL`
- unique index on `(source, source_id)`; PostgreSQL permits multiple null pairs
  for manual projects.

The existing globally unique project display name remains in the first release.
Imported name collisions receive a deterministic provider suffix. Removing the
name uniqueness constraint is outside this feature.

### 9.2 `resources` table

- `id`
- `import_history_id` with `ON DELETE CASCADE`
- nullable `project_id`, `conversation_id`, and `message_id`
- `source` and nullable `source_id`
- `logical_id` and nullable `version_index`
- `kind`
- `title`, `filename`, `mime_type`
- `availability`
- nullable `byte_size`, `sha256`, `storage_path`
- nullable `text_content`
- `metadata_json`
- `created_at`

Indexes:

- import history;
- project;
- conversation;
- message;
- `(source, source_id)`;
- `(conversation_id, logical_id, version_index)`;
- full-text index covering title, filename, and `text_content`.

### 9.3 `import_history` additions

- `manifest_json TEXT NULL`
- `resource_count INTEGER NOT NULL DEFAULT 0`
- `unavailable_resource_count INTEGER NOT NULL DEFAULT 0`
- `warning_count INTEGER NOT NULL DEFAULT 0`

The manifest contains only entry metadata and parser warnings, not binary
content.

## 10. API

### 10.1 Import a bundle

`POST /import/{source}/bundle`

Request:

- multipart field `file`, `.zip`;
- current import settings continue to control conversation duplicate behavior.

Response:

```json
{
  "import_history_id": 42,
  "status": "success",
  "conversations": {
    "imported": 100,
    "updated": 4,
    "skipped": 2
  },
  "projects": {
    "created": 3,
    "matched": 1
  },
  "resources": {
    "stored": 12,
    "inline": 9,
    "metadata_only": 5,
    "unavailable": 2
  },
  "warnings": [
    {
      "code": "RESOURCE_BYTES_MISSING",
      "message": "The export references diagram.png but does not contain it.",
      "entry": null
    }
  ]
}
```

Supported `source` values initially are `chatgpt` and `claude`. Other sources
return 400 until they implement the bundle parser contract.

### 10.2 Resource metadata

- `GET /conversations/{conversation_id}/resources`
- `GET /projects/{project_id}/resources`
- `GET /resources/{resource_id}`

These endpoints return metadata and inline textual content subject to response
size limits. Large text content may be requested separately.

### 10.3 Resource content

`GET /resources/{resource_id}/content`

- requires the existing bearer token;
- returns inline text or streams stored bytes;
- sets `Content-Disposition: attachment` for HTML, SVG, executable, or unknown
  content;
- sets `X-Content-Type-Options: nosniff`;
- never redirects to a permanent public URL.

### 10.4 Import deletion

Deleting import history removes:

- conversations still owned by that import according to existing semantics;
- associated resource rows;
- stored resource objects;
- provider projects created by that import only when no remaining conversation
  or resource references them.

Object-storage deletion failures are reported and retried or left as auditable
cleanup warnings; they must not silently leave public objects.

## 11. Provider behavior

### 11.1 ChatGPT

The importer will discover:

- `conversations.json`;
- numbered conversation JSON files used by larger exports;
- project metadata files when present;
- files/assets included by the provider.

Conversation behavior remains unchanged: import the `current_node` parent path,
or the last-child path when `current_node` is absent.

The parser will:

- retain `project_id` as `source_project_id`;
- resolve content-part and message-metadata asset references against safe ZIP
  entries;
- preserve text and transcripts;
- create resource records for unresolved references instead of substituting
  only `[image]`;
- retain `[image]` in the message when no better readable representation exists;
- import tool/canvas content generically only when complete content is present.

No assumption is made that `projects.json` or asset bytes exist.

### 11.2 Claude

The importer will discover `conversations.json`, user files for inventory only,
and any bundled file entries.

The parser will:

- retain `project_uuid` as `source_project_id`;
- extract `tool_use` blocks named `artifacts`;
- support legacy `<antArtifact>`/case variants when present in message text;
- preserve artifact type, title, language, logical ID, and revisions;
- retain artifact content in the message while also creating a resource;
- preserve attachment extracted text as searchable resource text;
- resolve attachment/file metadata against bundled files where possible;
- create metadata-only resources for expiring or absent file references;
- continue skipping non-user-facing token-budget blocks.

Anthropic officially guarantees conversation and user data, not project
knowledge or binary attachments. Their absence is expected and is not itself an
import failure.

## 12. Archive and content security

All bundle contents are untrusted.

### 12.1 ZIP validation

Default configurable limits:

- 100 MB compressed upload;
- 500 MB total declared and actual uncompressed data;
- 5,000 entries;
- 50 MB per stored resource;
- maximum 100:1 compression ratio per entry.

The reader must:

- reject absolute paths, drive-letter paths, null bytes, and `..` traversal;
- normalize both slash styles;
- reject symbolic links and encrypted entries;
- skip nested archives with a warning;
- validate entry count and declared sizes before reading;
- enforce actual streamed byte limits while reading;
- validate CRC through the ZIP library;
- avoid extracting the archive tree to the working directory;
- match known files by normalized path and identifiers, not unsanitized
  basenames alone.

### 12.2 Content handling

- Detect MIME type using content signatures when possible; do not trust the
  filename alone.
- Sanitize filenames for storage and response headers.
- Store objects under generated paths, not archive paths.
- Use a private bucket and authenticated download endpoint or short-lived
  signed access.
- Never use `get_public_url` for imported resources.
- Do not log message, artifact, attachment, or account content.
- Do not render arbitrary HTML or SVG inline.
- Apply a restrictive CSP to any future sandboxed preview.
- Do not execute macros, scripts, notebooks, or binaries.

## 13. Storage and transaction behavior

Stored object path:

`imports/{import_history_id}/resources/{sha256}/{safe_filename}`

The raw ZIP, when retained, uses:

`imports/{import_history_id}/raw/{safe_filename}`

Import sequence:

1. Validate ZIP structure and produce an inventory.
2. Create an `ImportHistory` row with `processing` status.
3. Parse provider metadata into the canonical model.
4. Resolve or create provider projects.
5. Ingest conversations and messages.
6. Upload resource objects under the import prefix.
7. Persist resource rows and manifest.
8. Commit and finalize status.

Database writes are transactional after the history row is created. Object
storage is not transactional:

- uploaded paths are tracked as they are created;
- a database failure triggers best-effort object cleanup;
- an optional resource upload failure creates an unavailable resource and marks
  the import `partial`;
- malformed or unsafe archives fail before any conversation is ingested.

Raw export backup failure remains non-fatal and produces a warning.

## 14. Duplicate and re-import behavior

When keep-separate is enabled, each import creates separate conversations and
resources, matching current behavior.

When auto-merge is enabled:

- conversations resolve by `(source, source_id)`;
- provider projects resolve by `(source, source_id)`;
- resources with stable IDs resolve by source identity and parent context;
- resources without stable IDs resolve by parent context, kind, and SHA-256;
- message-associated resources are rebuilt when their merged conversation's
  messages are rebuilt;
- unchanged stored objects may be reused by SHA-256;
- missing content in a newer export does not delete previously stored bytes
  unless the provider explicitly marks the resource deleted.

The import summary distinguishes inserted, updated, reused, skipped, and
unavailable items.

## 15. Error and warning model

Errors fail the bundle:

- invalid ZIP;
- archive safety violation;
- missing or invalid authoritative conversation data;
- unsupported provider;
- upload over configured compressed limit;
- database failure.

Warnings permit `success` or `partial`:

- provider project metadata absent;
- resource bytes absent;
- unsupported companion JSON;
- nested archive skipped;
- optional resource too large;
- unrecognized artifact type;
- ambiguous asset reference;
- raw ZIP backup failure;
- optional object upload failure.

Warnings use stable codes so the frontend and tests do not depend on prose.

## 16. Accessibility and performance

- Import status is announced through an ARIA live region.
- Availability badges include text, not color alone.
- Resource actions are keyboard accessible.
- Image previews have filename-based fallback alt text.
- Resource lists initially render metadata only; binary and large text content
  loads on demand.
- ZIP entries and resources are streamed within configured limits.
- Conversation list payloads do not include resource bodies.
- Bundle imports remain synchronous initially, but stage-level progress copy
  must not imply byte-level progress the backend cannot report.

## 17. Acceptance criteria

### Import and compatibility

- Existing ChatGPT and Claude JSON imports retain their current behavior and
  API response shape.
- A valid ChatGPT or Claude ZIP containing `conversations.json` imports without
  manual extraction.
- Numbered ChatGPT conversation files import as one history item.
- Unsafe ZIP paths, symlinks, excessive entry counts, and excessive expanded
  size are rejected before conversation ingestion.
- Unsupported companion files produce warnings rather than aborting a valid
  conversation import.

### Projects

- Conversations carrying the same provider project ID map to the same local
  project.
- Re-import with auto-merge does not duplicate that provider project.
- Manual projects are not overwritten by name collisions.
- Project instructions are stored as inert text.

### Resources

- A Claude artifact with complete content appears in its message and in the
  resource panel.
- Artifact title, type, logical ID, and version are preserved when present.
- Attachment extracted text is searchable.
- Bundled image bytes can be previewed through authenticated access.
- Bundled files can be downloaded with a safe filename.
- Referenced but omitted files show a clear unavailable or metadata-only state.
- HTML and SVG are not rendered in the application origin.

### Lifecycle

- Import history reports conversation, project, resource, unavailable, and
  warning counts.
- Deleting an import removes its resource rows and stored objects without
  deleting shared provider projects still in use.
- Re-import with auto-merge does not duplicate stable resources.

### Verification

- Backend parser and ZIP-safety tests run offline.
- Frontend tests cover JSON and ZIP selection, summary states, resource lists,
  and failed downloads.
- The frontend production build succeeds.
- Manual verification covers desktop and mobile import flow, project grouping,
  theme compatibility, keyboard use, and authenticated resource access.

## 18. Success measures

- Users can import an untouched provider ZIP for supported sources.
- Every detected resource ends in an explicit availability state; silent loss
  is treated as a defect.
- Project associations survive import and auto-merge.
- No imported active content executes in ChatArchive's origin.
- Existing JSON import regression tests remain green.

## 19. Open questions requiring sample exports

Implementation should begin with sanitized file inventories and minimal
representative JSON fragments from current personal and, if relevant, workspace
exports. Samples are needed to confirm:

- current ChatGPT project metadata filenames and schemas;
- how ChatGPT ZIP asset filenames map to asset pointers;
- whether personal exports include numbered conversation files;
- Claude artifact revision fields and legacy tag casing;
- whether either provider includes binary attachments for the target account
  types;
- maximum expected archive and individual resource sizes.

Unknown sample-specific fields must not block the generic bundle framework.
Provider adapters should isolate subsequent schema updates.

