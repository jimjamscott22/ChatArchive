# Export Bundle Resources Implementation Plan

Related specification:
[`docs/specs/EXPORT_BUNDLE_RESOURCES.md`](../specs/EXPORT_BUNDLE_RESOURCES.md)

## 1. Delivery strategy

Implement the feature as vertical, independently verifiable slices while
preserving existing direct JSON imports. The work should not start with UI or
database coupling. First establish safe archive reading and canonical parser
output, then persist it, expose it through authenticated APIs, and finally add
the frontend workflow.

Recommended logical commits:

1. Add canonical bundle types and safe ZIP inventory.
2. Parse ChatGPT and Claude bundles into canonical projects/resources.
3. Add project provenance, resources, and import manifest schema.
4. Persist bundle projects/resources and private object storage.
5. Add bundle import and resource APIs.
6. Add ZIP import and resource browsing UI.
7. Add resource search, deletion lifecycle, documentation, and final
   verification.

Each commit must keep existing parser tests passing. Do not combine schema,
storage, API, and frontend behavior into one unreviewable change.

## 2. Prerequisites and evidence collection

### 2.1 Obtain sanitized samples

Before hard-coding provider field names, collect:

- ZIP entry inventories from current ChatGPT and Claude personal exports;
- workspace/Edu inventory only if those account types are in scope;
- minimal redacted conversation objects containing project IDs;
- one example each of:
  - Claude artifact creation and update;
  - Claude attachment with extracted text;
  - ChatGPT uploaded image reference;
  - ChatGPT generated image or file reference;
  - project metadata, when present;
  - referenced-but-omitted resource.

Do not commit real exports. Create minimal synthetic fixtures reproducing only
the necessary shapes. Record uncertain provider fields in fixture comments and
adapter documentation.

### 2.2 Confirm storage policy

Before binary persistence:

- confirm the configured Supabase bucket is private;
- confirm the practical per-object limit;
- decide whether raw ZIP retention is enabled by default;
- confirm cleanup behavior for the current import-history deletion endpoint.

If private storage cannot be confirmed, implement metadata and inline artifact
support first and keep binary storage disabled with an explicit warning.

## 3. Phase 1: canonical bundle model and safe ZIP reader

### 3.1 Add canonical types

Create `backend/app/importers/bundle_types.py` containing dataclasses or
Pydantic models:

- `ParsedBundle`
- `ParsedProject`
- `ParsedResource`
- `BundleInventoryEntry`
- `ImportWarning`
- `ResourceAvailability`
- `ResourceKind`

Keep the existing parsed conversation dictionary contract initially to avoid a
large unrelated importer rewrite. Add `source_project_id` as an optional key.

Requirements:

- models contain metadata and entry references, not loaded binary blobs;
- warnings have stable codes and structured context;
- raw provider metadata is JSON-serializable;
- resource associations use provider source IDs until persistence resolves DB
  IDs.

### 3.2 Add safe archive reader

Create `backend/app/importers/bundle_reader.py` using Python's standard
`zipfile` module.

Responsibilities:

- validate extension and ZIP signature;
- inventory normalized entries;
- enforce compressed, expanded, entry-count, per-entry, and compression-ratio
  limits;
- reject traversal, absolute/drive paths, null bytes, symlinks, and encryption;
- skip nested archives with a structured warning;
- stream selected entry bytes with an enforced actual-byte limit;
- expose case-insensitive filename lookup without discarding full normalized
  paths;
- avoid extracting to the repository or process working directory.

Configuration should be centralized in a `BundleLimits` model with environment
overrides added only when operators need them. Defaults must match the
specification.

### 3.3 Tests

Add `backend/tests/test_bundle_reader.py`. It must remain offline and import
neither `app.main` nor `app.database`.

Cover:

- valid ZIP inventory;
- duplicate basenames in separate directories;
- POSIX and Windows traversal;
- absolute and drive-letter paths;
- null-byte names where constructible;
- symlinks;
- encrypted flag;
- excessive entry count;
- excessive declared and actual expanded size;
- excessive compression ratio;
- nested archive warning;
- corrupt data/CRC;
- mixed-case authoritative filenames;
- bounded reads.

Generate ZIPs in memory during tests rather than committing large binary
fixtures.

### 3.4 Exit criteria

- No provider parser changes are required to use the archive reader.
- Malicious archives fail before any persistence code can run.
- Full backend parser suite remains green.

## 4. Phase 2: provider bundle adapters

### 4.1 Shared dispatch

Create `backend/app/importers/bundles.py` with a small explicit dispatch layer
for bundle-capable providers only:

```python
def parse_export_bundle(
    source: Literal["chatgpt", "claude"],
    reader: BundleReader,
) -> ParsedBundle:
    ...
```

This does not replace the repository's source-specific direct import endpoints.
It only keeps the new bundle endpoint from duplicating archive orchestration.

### 4.2 ChatGPT adapter

Create `backend/app/importers/chatgpt_bundle.py`.

Tasks:

- discover `conversations.json` and supported numbered variants;
- reject a bundle with no authoritative conversation JSON;
- concatenate conversation arrays deterministically without flattening message
  branches;
- call or refactor `parse_chatgpt_export` for core conversations;
- retain conversation `project_id` as `source_project_id`;
- discover project metadata using sample-backed filenames and shapes;
- create placeholder projects for referenced IDs lacking metadata;
- inspect message content parts and metadata for asset references;
- resolve references against ZIP entries using IDs and normalized metadata;
- create stored-entry references for matched files;
- create metadata-only/unavailable resources for unmatched references;
- preserve transcripts and existing `[image]` readable fallback;
- treat canvas/tool-generated content as generic artifacts only when complete
  content is present.

Avoid guessing that every non-JSON ZIP file belongs to a conversation.
Unassociated files remain inventory entries with a warning until a supported
association is known.

### 4.3 Claude adapter

Create `backend/app/importers/claude_bundle.py`.

Refactor artifact and attachment extraction from
`backend/app/importers/claude.py` into reusable pure helpers without changing
existing rendered message output.

Tasks:

- discover and parse `conversations.json`;
- retain `project_uuid` as `source_project_id`;
- create placeholder projects when only UUIDs are available;
- extract artifact `tool_use` blocks as resources;
- extract legacy `<antArtifact>` variants using an XML-tolerant or bounded
  parser strategy rather than one unbounded broad regex;
- preserve logical artifact ID, title, type, language, and revision order;
- retain complete artifact content in the existing Markdown message;
- create attachment resources from `attachments`, `files`, and sample-confirmed
  variants;
- preserve extracted content as `text_content`;
- match binary entries only when supported evidence exists;
- retain expiring URLs as inert metadata and never fetch them.

Do not wire the entire unused preprocessing pipeline into production as part of
this feature. Reuse or move narrowly applicable extraction helpers.

### 4.4 Tests

Add:

- `backend/tests/test_chatgpt_bundle_parser.py`
- `backend/tests/test_claude_bundle_parser.py`

Use minimal in-memory synthetic ZIPs. Cover:

- plain bundle with conversations only;
- project association with and without metadata;
- same project name with different provider IDs;
- numbered ChatGPT files;
- artifact create and update;
- artifact content containing tag-like text;
- attachment extracted text;
- matched bundled binary;
- omitted binary;
- ambiguous asset match;
- unsupported companion files;
- deterministic warnings and inventory;
- direct JSON parser behavior unchanged.

### 4.5 Exit criteria

- Both providers produce the canonical `ParsedBundle`.
- Every detected resource has an explicit availability value.
- Existing direct JSON parser output remains compatible.

## 5. Phase 3: database schema and migration

### 5.1 Models

Update `backend/app/models.py`:

- add provider provenance fields and relationships to `Project`;
- add `Resource`;
- add relationships from import history, project, conversation, and message;
- add manifest/count fields to `ImportHistory`;
- add indexes defined by the specification.

Use string values with validation for kind/availability unless PostgreSQL enum
migrations are deliberately adopted. String columns make future provider kinds
less invasive.

### 5.2 Migration

This repository does not currently use Alembic. Add an idempotent migration
script following the existing migration-script convention:

`backend/migrate_add_bundle_resources.py`

The migration must:

- add nullable project provenance columns;
- create the unique `(source, source_id)` index;
- add import-history columns with server defaults;
- create `resources` and all indexes;
- create or update resource full-text search support;
- detect an already-applied migration safely;
- run only against PostgreSQL;
- not import `app.main`;
- document rollback SQL even if the script itself is forward-only.

If migration inspection reveals existing production schema drift, stop and
resolve that evidence before adding compensating assumptions.

### 5.3 Schemas

Update `backend/app/schemas.py` with:

- `ResourceSummary`
- `ResourceDetail`
- `ResourceListResponse`
- `BundleImportCounts`
- `BundleImportWarning`
- `BundleImportResponse`

Add resource counts to conversation/project responses only if doing so does not
introduce per-row count queries. Prefer batched counts or a dedicated resource
endpoint.

### 5.4 Tests

Because default tests must stay offline:

- test schema serialization without importing `app.database`;
- test model metadata and constraints without opening an engine;
- add opt-in PostgreSQL migration verification documented separately;
- do not make the ordinary parser test suite require Supabase.

### 5.5 Exit criteria

- Migration is additive and idempotent.
- Manual projects with null provider identity remain valid.
- Resource ownership and delete behavior are explicit at the ORM and database
  levels.

## 6. Phase 4: persistence and private storage

### 6.1 Generalize storage

Refactor `backend/app/storage.py` without changing raw JSON upload behavior for
existing endpoints.

Add:

- MIME-aware private object upload;
- generated storage paths based on import ID and SHA-256;
- streaming or bounded byte handling;
- object existence/reuse check where supported;
- authenticated download support;
- batch cleanup under one import prefix;
- safe content-disposition filename helper.

Do not use `get_public_url` for resources. If short-lived signed URLs are used,
their lifetime must be brief and they must not be persisted.

### 6.2 Bundle ingestion service

Create `backend/app/bundle_ingest.py` or a similarly focused service.

Responsibilities:

- create and finalize import history;
- resolve provider projects by `(source, source_id)`;
- disambiguate display-name conflicts deterministically;
- pass conversations through shared ingestion behavior;
- map provider conversation/message IDs to persisted rows;
- store inline resources;
- upload matched resource entries;
- persist metadata-only/unavailable resources;
- track uploaded paths for compensating cleanup;
- produce structured counts and warnings.

Refactor `_ingest_parsed_conversations` out of `main.py` only if required to
share it cleanly. Preserve current duplicate and skip-empty semantics.

### 6.3 Re-import rules

Implement auto-merge behavior:

- rebuild message-associated resource rows alongside rebuilt messages;
- resolve stable resources by source identity;
- use SHA-256 fallback only within the same parent context;
- reuse identical stored objects;
- do not delete previously stored bytes merely because a later export omitted
  them;
- keep keep-separate behavior unchanged.

### 6.4 Failure behavior tests

Use fakes for storage and persistence boundaries where practical.

Cover:

- all uploads succeed;
- one optional upload fails and import becomes partial;
- raw ZIP backup fails but parsed import continues;
- database failure after object upload triggers cleanup attempt;
- cleanup failure becomes an auditable warning;
- name collision with manual project;
- auto-merge resource reuse;
- keep-separate duplicate resources;
- attachment over per-resource limit;
- no private storage configured.

### 6.5 Exit criteria

- Conversation-only bundles still import if optional resource storage fails.
- No failure path silently loses the resource state or leaves it reported as
  stored.
- Storage URLs are not public or persisted.

## 7. Phase 5: backend API

### 7.1 Import route

Add to `backend/app/main.py`:

`POST /import/{source}/bundle`

The route should remain thin:

1. validate supported source and filename;
2. apply compressed upload limit while reading;
3. call archive validation/parser;
4. call bundle ingestion;
5. translate known failures to stable 400/413/422/500 responses;
6. return `BundleImportResponse`.

Avoid catching all exceptions as user-visible implementation details. Log
tracebacks server-side without imported content and return sanitized errors.

Update `backend/app/import_policy.py` so `.zip` is accepted only by the bundle
route. Existing direct JSON endpoints must continue rejecting ZIPs.

### 7.2 Resource routes

Add:

- `GET /conversations/{conversation_id}/resources`
- `GET /projects/{project_id}/resources`
- `GET /resources/{resource_id}`
- `GET /resources/{resource_id}/content`

Requirements:

- all use the existing bearer-token protection;
- list endpoints paginate;
- list responses exclude large `text_content`;
- metadata fetch caps inline text or links to content endpoint;
- content response applies safe MIME and disposition headers;
- unavailable resources return a stable 409 or 404 contract chosen and
  documented consistently;
- cross-resource IDs cannot expose another record accidentally.

### 7.3 Import deletion

Extend import-history deletion:

- collect storage paths before deleting rows;
- delete database-owned records in one transaction;
- remove objects after commit with recorded cleanup failures;
- delete provider projects only when unreferenced;
- preserve projects shared with newer imports.

### 7.4 API documentation and tests

Update `docs/API.md`.

Do not import `app.main` in the existing offline suite. Put route-level tests in
an explicit integration test target configured with a live test PostgreSQL
database, or extract request-independent route logic into testable pure
services. Document the separation in `docs/TESTING.md`.

### 7.5 Exit criteria

- API contracts match the specification.
- Direct JSON endpoints are regression-compatible.
- Resource content cannot be accessed without authentication.

## 8. Phase 6: frontend import and resource UI

### 8.1 Types and API helpers

Add frontend types for:

- bundle import response;
- warning;
- resource summary/detail;
- resource availability.

Use `apiFetch()` for every API request. Do not introduce raw `fetch()` calls
against `API_URL`.

### 8.2 Import modal

Update `ImportModal` in `frontend/src/App.tsx`:

- accept `.json,application/json,.zip,application/zip`;
- route `.zip` to `/import/{source}/bundle`;
- allow ZIP only for ChatGPT and Claude;
- keep direct JSON status copy and behavior;
- add stage-oriented accessible status copy;
- render structured bundle counts and grouped warnings;
- avoid auto-closing the modal before users can read partial/unavailable
  warnings;
- refresh conversations, projects, and resource counts on completion.

Update source instructions to say the untouched ZIP is preferred.

### 8.3 Conversation resource panel

Add a focused component rather than expanding `App.tsx` further if practical:

`frontend/src/components/ConversationResources.tsx`

Behavior:

- fetch summary metadata on demand for the selected conversation;
- show availability badges and type icons;
- lazy-load text/image content;
- download through authenticated `apiFetch`, convert response to a Blob, and
  create a short-lived object URL;
- revoke object URLs on replacement/unmount;
- never inject imported HTML with `dangerouslySetInnerHTML`;
- render code/plain text in a bounded read-only panel;
- show source for HTML/SVG rather than active preview;
- display provider-omission guidance for metadata-only/unavailable resources.

### 8.4 Project resource access

Add resource count or access from the project view only after conversation
resources work. Avoid creating a second full file manager in the first release.

### 8.5 Styles and accessibility

Update `frontend/src/styles.css` using existing semantic theme tokens for all 11
themes.

Verify:

- keyboard access and visible focus;
- screen-reader labels;
- text labels in status badges;
- narrow/mobile layout;
- long filenames and large warning lists;
- reduced-motion behavior;
- dark/light and several non-default themes.

### 8.6 Frontend tests

Update `frontend/src/App.test.tsx` fetch mock for every new API call.

Add component tests for:

- JSON still uses old endpoint;
- ZIP uses bundle endpoint;
- unsupported source disables ZIP;
- success summary;
- partial result remains visible;
- warnings and unavailable counts;
- resource loading;
- authenticated download;
- failed download;
- object URL cleanup;
- HTML/SVG is not injected as active content;
- empty resource state.

### 8.7 Exit criteria

- A user can import a ZIP and understand exactly what was and was not
  preserved.
- Resource content is loaded only on demand.
- No new API call bypasses `apiFetch()`.

## 9. Phase 7: search and lifecycle completeness

### 9.1 Search

Extend PostgreSQL search to include resource title, filename, and inline text.

Prefer one of:

- a resource search vector joined back to the parent conversation; or
- a maintained aggregate vector that combines messages and resource text.

Choose based on query-plan evidence using representative row counts. Do not
concatenate binary metadata into message bodies.

Requirements:

- retain current source/tag/project/date filters;
- deduplicate conversations matching both messages and resources;
- identify resource matches in snippets;
- preserve pagination correctness.

Add focused tests to `backend/tests/test_query_filters.py` only if they remain
database-independent; otherwise use the opt-in PostgreSQL integration target.

### 9.2 Client export behavior

Decide explicitly whether ChatArchive's own JSON/Markdown/PDF conversation
exports include:

- resource metadata;
- inline artifact content already present in messages;
- links or filenames for stored attachments.

The initial safe behavior is metadata in JSON, readable artifact content once
through messages, and filenames/availability in Markdown/PDF. Do not embed
large binary base64 data.

### 9.3 Import cleanup verification

Exercise:

- delete a conversation with resources;
- delete an import with unique and shared projects;
- merge a newer import;
- retry after partial storage failure;
- remove stale object prefixes with an explicit maintenance command if needed.

## 10. Documentation updates

Update:

- `docs/IMPORT_GUIDE.md`
  - untouched ZIP flow;
  - support matrix;
  - explanation of omitted provider files;
  - privacy warning;
- `docs/API.md`
  - bundle and resource endpoints;
  - response/error schemas;
- `docs/TESTING.md`
  - offline parser tests;
  - in-memory malicious ZIP cases;
  - opt-in PostgreSQL/storage integration tests;
- `docs/DEVELOPMENT.md`
  - migration command;
  - private bucket requirements and limits;
- `CLAUDE.md` and `AGENTS.md`
  - only architectural/command facts that future agents must know.

Do not document provider files as guaranteed unless official provider
documentation guarantees them.

## 11. Verification matrix

Run fresh verification after the final implementation revision.

### Backend offline

From `backend/`:

```bash
python -m pytest tests/ -v
python verify_parsers.py
```

If the managed environment is required:

```bash
uv run python -m pytest tests/ -v
uv run python verify_parsers.py
```

Expected:

- all existing and new parser/archive tests pass;
- no test imports `app.main` or `app.database`;
- no Supabase connection is attempted.

### Backend integration

Against a dedicated disposable PostgreSQL database and private test bucket:

- apply migration twice to prove idempotency;
- import ChatGPT conversation-only bundle;
- import Claude artifact bundle;
- import bundled image;
- import missing binary;
- auto-merge same bundle;
- delete import and verify rows/objects;
- verify unauthenticated resource access fails;
- verify HTML/SVG downloads with safe headers;
- inspect resource search query plan.

Never run destructive migration/deletion checks against the user's production
database or bucket.

### Frontend

From `frontend/`:

```bash
npm test
npm run build
```

Expected:

- all tests pass with no unmatched fetch URLs;
- TypeScript compiles;
- Vite production bundle completes.

### Manual application verification

With a non-production test environment:

- desktop ZIP import;
- mobile/narrow ZIP import;
- all summary states;
- project grouping and filtering;
- artifact preview and download;
- authenticated image preview;
- omitted-resource explanation;
- import deletion;
- theme switching and persistence;
- keyboard navigation;
- reduced motion.

### Packaging

Before release, verify the Windows PyInstaller build because archive and
resource-response modules must be included. No additional hidden import should
be necessary for standard-library ZIP support, but the built executable must be
tested rather than assumed.

## 12. Rollout and rollback

### Rollout

1. Deploy additive schema migration.
2. Deploy backend canonical types, parsers, storage, and endpoints.
3. Verify direct JSON import in the deployed environment.
4. Deploy frontend ZIP selection and resource panel.
5. Enable binary storage only after private bucket verification.
6. Monitor partial imports, storage failures, unavailable-resource ratios, and
   archive rejection codes without logging imported content.

### Rollback

- Frontend can hide ZIP selection while direct JSON imports remain functional.
- Backend bundle endpoints can be disabled without dropping additive tables.
- Existing conversation/message data does not depend on resource rows.
- Storage objects are namespaced by import ID and can be cleaned separately.
- Do not drop columns/tables during an application rollback; use the documented
  migration rollback only after data-retention review.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Provider export schema changes | Isolated provider adapters, synthetic fixtures, stable warnings |
| Provider omits binaries | Explicit metadata-only/unavailable states; no network recovery promise |
| ZIP bomb/path traversal | Preflight plus streamed hard limits; no filesystem extraction |
| Imported active content causes XSS | No raw HTML injection; HTML/SVG download/source only |
| Sensitive resources become public | Private bucket and authenticated content endpoint |
| Object storage and DB diverge | Tracked uploads, compensating cleanup, partial status |
| Project name collision | Resolve by provider identity; deterministic display suffix |
| Re-import duplicates resources | Stable IDs, parent-scoped hashes, merge tests |
| Search becomes slow | Dedicated indexed vector and query-plan verification |
| Main component grows further | New focused resource component |
| Offline tests begin requiring DB | Keep parser/archive modules independent of `main`/`database` |

## 14. Definition of done

The feature is complete only when:

- the specification acceptance criteria are checked against implementation;
- untouched supported ZIPs import conversations and discoverable resources;
- omitted resources are visible rather than silently dropped;
- provider project associations survive re-import;
- unsafe archives are rejected before persistence;
- resource access is authenticated and active content is not executed;
- delete and auto-merge lifecycle tests pass;
- backend offline tests, frontend tests, and frontend build pass freshly;
- PostgreSQL/private-storage integration checks pass in a disposable
  environment;
- desktop, mobile, accessibility, themes, and Windows packaging are verified;
- user and developer documentation reflects actual, not assumed, provider
  behavior.

